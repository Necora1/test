/* CDP harness: opens the site, waits real time, optionally seeds localStorage /
   emulates reduced motion, runs an actions script, reports facts + screenshot.
   Usage: node cdp-shot.js <url> <outPng> [waitMs] [w] [h] [actionsFile] */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [, , url, outPng, waitMsArg, wArg, hArg, exprFile] = process.argv;
const waitMs = Number(waitMsArg || 3500);
const W = Number(wArg || 1280);
const H = Number(hArg || 1000);
const port = 9300 + Math.floor(Math.random() * 500);
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
const reduced = process.env.RUNI_REDUCED === '1';
const seedLs = process.env.RUNI_LS || '';

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
  `--window-size=${W},${H}`, 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWs() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome never came up');
}

(async () => {
  const wsUrl = await getWs();
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const events = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) events.push(msg);
  });
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  if (reduced) {
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
  }
  if (process.env.RUNI_DEVICE) {
    const [dw, dh] = process.env.RUNI_DEVICE.split('x').map(Number);
    await send('Emulation.setDeviceMetricsOverride', {
      width: dw, height: dh, deviceScaleFactor: 2, mobile: true
    });
  }
  if (seedLs) {
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try{${seedLs}}catch(e){}`
    });
  }

  await send('Page.navigate', { url });
  await sleep(waitMs);

  let value = '{}';
  if (exprFile && fs.existsSync(exprFile)) {
    const expr = fs.readFileSync(exprFile, 'utf8');
    const facts = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (facts.exceptionDetails) value = 'EXCEPTION: ' + JSON.stringify(facts.exceptionDetails).slice(0, 500);
    else value = facts.result?.value ?? JSON.stringify(facts.result);
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));

  const problems = events.filter((e) =>
    (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') ||
    (e.method === 'Runtime.exceptionThrown'));
  console.log('--- facts ---');
  console.log(value);
  console.log('--- console errors:', problems.length, '---');
  problems.slice(0, 10).forEach((p) => console.log(JSON.stringify(p.params).slice(0, 300)));
  console.log('--- wrote', path.basename(outPng), fs.statSync(outPng).size, 'bytes ---');

  ws.close();
  chrome.kill();
  await sleep(300);
  process.exit(0);
})().catch((e) => { console.error('HARNESS FAIL', e); chrome.kill(); process.exit(1); });
