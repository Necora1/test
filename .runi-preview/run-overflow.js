#!/usr/bin/env node
/* Run act-overflow.js via CDP at given viewport, return JSON */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function run(w, h, label) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`,
    `--window-size=${w},${h}`, 'about:blank'
  ], { stdio: 'ignore' });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let wsUrl;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch {}
    await sleep(250);
  }
  if (!wsUrl) throw new Error('chrome never came up');

  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8123/index.html' });
  await sleep(4000);

  const expr = fs.readFileSync('/Users/gash/Desktop/Projects/My-website/.runi-preview/act-overflow.js', 'utf8');
  const facts = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  const value = facts.result?.value;
  console.log(`=== ${label} (${w}x${h}) ===`);
  console.log(value);
  ws.close();
  chrome.kill();
  await sleep(300);
}

const path = require('path');
(async () => {
  await run(1280, 1000, 'desktop');
  await run(360, 780, 'mobile');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
