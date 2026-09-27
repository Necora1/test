/* ==========================================================
   core.js — shared helpers: DOM, storage, events, network,
   settings and the dialog manager
   ========================================================== */
(() => {
  const Void = window.Void;
  const html = document.documentElement;

  /* ---------- DOM ---------- */
  Void.$ = (sel, root = document) => root.querySelector(sel);
  Void.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- small math / timing ---------- */
  Void.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  Void.clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  Void.hexToRgb = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  /* ---------- storage that never throws (private mode, blocked cookies…) ---------- */
  Void.store = {
    raw(key) { try { return localStorage.getItem(key); } catch { return null; } },
    setRaw(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
    get(key, fallback = null) {
      const value = Void.store.raw(key);
      if (value === null) return fallback;
      try { return JSON.parse(value); } catch { return fallback; }
    },
    set(key, value) { Void.store.setRaw(key, JSON.stringify(value)); },
    remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
  };

  /* ---------- tiny event bus ---------- */
  const bus = new EventTarget();
  Void.on = (type, fn) => bus.addEventListener(type, (e) => fn(e.detail));
  Void.emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

  /* ---------- network ---------- */
  Void.fetchWithTimeout = async (url, options = {}, ms = 10000) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  // JSONP: loads a script and waits for its callback. Works without CORS,
  // which is why the song search falls back to it.
  let jsonpCount = 0;
  Void.jsonp = (url, ms = 8000) => new Promise((resolve, reject) => {
    const name = `__voidJsonp${Date.now().toString(36)}${jsonpCount++}`;
    const script = document.createElement('script');
    let settled = false;
    const finish = () => {
      settled = true;
      clearTimeout(timer);
      script.remove();
      // keep a no-op around briefly so a late response can't throw
      window[name] = () => {};
      setTimeout(() => { delete window[name]; }, 30000);
    };
    const timer = setTimeout(() => { if (!settled) { finish(); reject(new Error('timed out')); } }, ms);
    window[name] = (data) => { if (!settled) { finish(); resolve(data); } };
    script.onerror = () => { if (!settled) { finish(); reject(new Error('could not load')); } };
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${name}`;
    document.head.appendChild(script);
  });

  // Turns a thrown error into a sentence a visitor can act on
  Void.describeError = (err, what = 'the server') => {
    const What = what.charAt(0).toUpperCase() + what.slice(1);
    if (!err) return 'Something went wrong. Try again.';
    if (err.code === 'config') return 'This feature isn\'t set up yet.';
    if (err.name === 'AbortError') return `${What} took too long to answer. Try again.`;
    if (err.status === 429) return 'Too many tries in a row. Wait a minute and try again.';
    if (err.status === 404) return `${What} isn't available right now.`;
    if (err.status >= 500) return `${What} is having trouble (error ${err.status}). Try again later.`;
    if (err.status) return `${What} refused the request (error ${err.status}).`;
    return `Couldn't reach ${what}. Check your connection and try again.`;
  };

  /* ---------- settings ---------- */
  const SETTINGS_KEY = 'void_settings';
  const systemReduce = matchMedia('(prefers-reduced-motion: reduce)');
  // reduceMotion: null = follow the device setting
  Void.settings = Object.assign({ reduceMotion: null, intro: true, lite: false, fabric: true, sparkles: true, crt: false }, Void.store.get(SETTINGS_KEY, {}));

  Void.motion = {
    get reduced() { return html.classList.contains('reduce-motion'); }
  };

  Void.applySettings = () => {
    const reduce = Void.settings.reduceMotion ?? systemReduce.matches;
    html.classList.toggle('reduce-motion', !!reduce);
    html.classList.toggle('lite', !!Void.settings.lite);
    html.classList.toggle('no-fabric', !Void.settings.fabric);
    html.classList.toggle('crt', !!Void.settings.crt);
    Void.emit('settings', Void.settings);
  };

  Void.setSetting = (key, value) => {
    Void.settings[key] = value;
    Void.store.set(SETTINGS_KEY, Void.settings);
    Void.applySettings();
  };

  systemReduce.addEventListener?.('change', Void.applySettings);
  Void.applySettings();

  /* ---------- keep dialogs inside the visible area (iOS keyboard) ---------- */
  const vv = window.visualViewport;
  if (vv) {
    const sync = () => {
      html.style.setProperty('--vv-top', `${vv.offsetTop}px`);
      html.style.setProperty('--vv-height', `${vv.height}px`);
    };
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    sync();
  }

  /* ---------- dialogs ---------- */
  const openDialogs = [];

  Void.modal = {
    open(id) {
      const dlg = typeof id === 'string' ? document.getElementById(id) : id;
      if (!dlg || dlg.open) return dlg;
      dlg._returnFocus = document.activeElement;
      dlg.showModal();
      openDialogs.push(dlg);
      html.classList.add('has-modal');
      // next frame so the opening transition runs
      requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('is-open')));
      Void.emit('modal:open', dlg.id);
      return dlg;
    },

    close(id) {
      const dlg = typeof id === 'string' ? document.getElementById(id) : id;
      if (!dlg || !dlg.open || dlg._closing) return;
      dlg._closing = true;
      dlg.classList.remove('is-open');
      const done = () => {
        dlg._closing = false;
        if (dlg.open) dlg.close();
        const i = openDialogs.indexOf(dlg);
        if (i > -1) openDialogs.splice(i, 1);
        if (!openDialogs.length) html.classList.remove('has-modal');
        const back = dlg._returnFocus;
        if (back && back.isConnected && back.offsetParent !== null && typeof back.focus === 'function') back.focus({ preventScroll: true });
        Void.emit('modal:close', dlg.id);
      };
      if (Void.motion.reduced) done(); else setTimeout(done, 200);
    },

    isOpen() { return openDialogs.length > 0; }
  };

  Void.$$('dialog.modal').forEach((dlg) => {
    // Escape: animate out instead of the instant native close
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); Void.modal.close(dlg); });

    // Click on the dimmed area closes; a drag that starts inside the card doesn't
    let downOnBackdrop = false;
    dlg.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === dlg; });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg && downOnBackdrop) Void.modal.close(dlg);
      else if (e.target.closest('[data-close]')) Void.modal.close(dlg);
      downOnBackdrop = false;
    });
  });

  /* ---------- buttons with a busy / result label ---------- */
  Void.buttonLabel = (btn, text) => {
    const label = btn.querySelector('.btn-label') || btn;
    if (!btn.dataset.idleLabel) btn.dataset.idleLabel = label.textContent;
    label.textContent = text;
  };
  Void.resetButton = (btn) => {
    const label = btn.querySelector('.btn-label') || btn;
    if (btn.dataset.idleLabel) label.textContent = btn.dataset.idleLabel;
    btn.classList.remove('is-busy', 'is-done', 'is-error');
    btn.disabled = false;
  };

  // shared "a send is in progress" flag for the message and drawing forms
  Void.sending = false;
})();
