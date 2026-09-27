/* ==========================================================
   effects.js — the liquid layer (styles in css/effects.css)
   · titles "melt" into place through an SVG displacement filter
   · a sheen and a tilt follow the mouse over the metal
   · buttons squish on press and spring back
   · pixel sparkles trail the cursor
   ========================================================== */
(() => {
  const { $ } = Void;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const fx = (Void.fx = {});

  /* ==========================================================
     MELT — the title is pushed around by fractal noise that
     calms down to nothing, like chrome settling into a mould.
     ========================================================== */
  const map = document.getElementById('liquidMap');
  const noise = document.getElementById('liquidNoise');
  let meltRaf = 0;
  let meltEl = null;

  const stopMelt = () => {
    cancelAnimationFrame(meltRaf);
    meltRaf = 0;
    if (meltEl) meltEl.style.removeProperty('--liquid');
    meltEl = null;
    map?.setAttribute('scale', '0');
  };

  fx.melt = (el, { strength = 36, duration = 1200 } = {}) => {
    if (!el || !map || !noise || Void.motion.reduced) return;
    stopMelt();
    meltEl = el;
    el.style.setProperty('--liquid', 'url(#liquid)');
    noise.setAttribute('seed', String(1 + Math.floor(Math.random() * 90)));
    const t0 = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const left = Math.pow(1 - t, 3); // how much wobble is left
      map.setAttribute('scale', (strength * left).toFixed(2));
      // the ripples stretch out as they calm down
      noise.setAttribute('baseFrequency', `${(0.008 + 0.014 * left).toFixed(4)} ${(0.03 + 0.05 * left).toFixed(4)}`);
      if (t < 1) meltRaf = requestAnimationFrame(step);
      else stopMelt();
    };
    meltRaf = requestAnimationFrame(step);
  };

  function wireMelt() {
    // every page's title melts in when the page appears
    Void.on('page:enter', (page) => {
      fx.melt(page.querySelector('.hero-title, .page-title'));
    });

    if (!finePointer) return;
    // a small ripple when the mouse touches a big title or the brand
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse' || meltRaf) return;
      const title = e.target.closest?.('.hero-title, .page-title, .brand-name');
      if (title && !title.contains(e.relatedTarget)) fx.melt(title, { strength: 14, duration: 800 });
    });
  }

  /* ==========================================================
     SHEEN + TILT — mouse only
     ========================================================== */
  const SHEEN = '.portal, .page-head, .panel-box, .pin, .contact-grid a, .btn, .send-btn, .nav-pill, .util-btn';

  function wireSheen() {
    if (!finePointer) return;
    let current = null;

    const leave = (el) => {
      el.style.removeProperty('--tilt-x');
      el.style.removeProperty('--tilt-y');
    };

    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = e.target.closest?.(SHEEN) || null;
      if (current && current !== el) leave(current);
      current = el;
      if (!el) return;

      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);

      if (el.classList.contains('portal') && !Void.motion.reduced) {
        el.style.setProperty('--tilt-x', `${((0.5 - y) * 8).toFixed(2)}deg`);
        el.style.setProperty('--tilt-y', `${((x - 0.5) * 10).toFixed(2)}deg`);
      }
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', () => {
      if (current) leave(current);
      current = null;
    });
  }

  /* ==========================================================
     PRESS — squish while held, jelly bounce on release
     ========================================================== */
  const PRESSABLE = '.btn, .send-btn, .nav-pill, .util-btn, .tool-btn, .dock-toggle, .portal, .top-search-btn, .attach-btn, .segmented [role="tab"], button.track, .oomf, .song-row, .viewer-nav, .mini-btn, .contact-grid a';

  function wirePress() {
    let pressed = null;

    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || Void.motion.reduced) return;
      const el = e.target.closest?.(PRESSABLE);
      if (!el || el.disabled) return;
      el.classList.remove('is-release');
      el.classList.add('is-pressed');
      pressed = el;
    });

    const release = () => {
      if (!pressed) return;
      const el = pressed;
      pressed = null;
      el.classList.remove('is-pressed');
      void el.offsetWidth; // restart the bounce if it was already playing
      el.classList.add('is-release');
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);

    document.addEventListener('animationend', (e) => {
      if (e.animationName === 'jelly-release') e.target.classList.remove('is-release');
    });
  }

  /* ==========================================================
     SPARKLES — a small pool of pixel stars, reused
     ========================================================== */
  function wireSparkles() {
    if (!finePointer) return;
    const layer = document.createElement('div');
    layer.className = 'sparkles';
    layer.setAttribute('aria-hidden', 'true');
    const pool = [];
    for (let i = 0; i < 24; i++) {
      const s = document.createElement('i');
      s.className = 'sparkle';
      s.addEventListener('animationend', () => s.classList.remove('is-on'));
      layer.append(s);
      pool.push(s);
    }
    document.body.append(layer);

    let next = 0;
    let lastTime = 0;
    let lastX = 0;
    let lastY = 0;

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !Void.settings.sparkles || Void.motion.reduced) return;
      if (e.target.closest?.('#drawCanvas, dialog')) return; // not while drawing or in a window
      const now = performance.now();
      if (now - lastTime < 40 || Math.hypot(e.clientX - lastX, e.clientY - lastY) < 12) return;
      lastTime = now;
      lastX = e.clientX;
      lastY = e.clientY;

      const s = pool[next];
      next = (next + 1) % pool.length;
      s.classList.remove('is-on');
      void s.offsetWidth;
      s.style.setProperty('--x', `${(e.clientX + Math.random() * 10 - 5).toFixed(0)}px`);
      s.style.setProperty('--y', `${(e.clientY + Math.random() * 10 - 2).toFixed(0)}px`);
      s.style.setProperty('--dx', `${(Math.random() * 28 - 14).toFixed(0)}px`);
      s.style.setProperty('--s', (0.6 + Math.random() * 0.8).toFixed(2));
      s.classList.add('is-on');
    }, { passive: true });
  }

  fx.init = () => {
    wireMelt();
    wireSheen();
    wirePress();
    wireSparkles();
    Void.on('settings', () => { if (Void.motion.reduced) stopMelt(); });
  };
})();
