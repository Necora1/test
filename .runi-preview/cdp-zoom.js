/* Zoom harness: renders a selector's box at 3x for close inspection.
   Usage: node cdp-zoom.js <url> <outPng> <selector> [waitMs] [w] [h] */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [, , url, outPng, selector, waitMsArg, wArg, hArg] = process.argv;
const waitMs = Number(waitMsArg || 3500);
const W = Number(wArg || 1280);
const H = Number(hArg || 1000);
const port = 9300 + Math.floor(Math.random() * 500);
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpz-'));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
  `--window-size=${W},${H}`, '--force-device-scale-factor=1', 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let wsUrl;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const page = (await res.json()).find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch {}
    await sleep(250);
  }
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  await send('Page.enable');
  await send('Runtime.enable');
  if (process.env.RUNI_DEVICE) {
    const [dw, dh] = process.env.RUNI_DEVICE.split('x').map(Number);
    await send('Emulation.setDeviceMetricsOverride', { width: dw, height: dh, deviceScaleFactor: 2, mobile: true });
  }
  await send('Page.navigate', { url });
  await sleep(waitMs);
  if (process.env.RUNI_PRE) {
    await send('Runtime.evaluate', { expression: process.env.RUNI_PRE, awaitPromise: true });
    await sleep(900);
  }

  const box = await send('Runtime.evaluate', {
    expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null; el.scrollIntoView({block:'center'});
      const r = el.getBoundingClientRect();
      return {x:r.x, y:r.y, w:r.width, h:r.height,
        radius: getComputedStyle(el).borderRadius,
        overflow: getComputedStyle(el).overflow,
        html: el.outerHTML.slice(0,400)}; })()`,
    returnByValue: true
  });
  const b = box.result.value;
  if (!b) { console.log('selector not found:', selector); chrome.kill(); process.exit(1); }
  console.log('--- box ---');
  console.log(JSON.stringify(b, null, 1));

  const pad = 14;
  const clip = { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.w + pad * 2, height: b.h + pad * 2, scale: 3 };
  const shot = await send('Page.captureScreenshot', { format: 'png', clip });
  fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
  console.log('--- wrote', path.basename(outPng), fs.statSync(outPng).size, 'bytes ---');
  ws.close(); chrome.kill(); await sleep(200); process.exit(0);
})().catch((e) => { console.error('FAIL', e); chrome.kill(); process.exit(1); });
