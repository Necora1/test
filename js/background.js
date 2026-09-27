/* ==========================================================
   background.js — the sky (fog + parallax stars), the warp
   effect and the send shake
   ========================================================== */
(() => {
  const { $, clamp, hexToRgb } = Void;
  const html = document.documentElement;
  const TAU = Math.PI * 2;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isLite = () => html.classList.contains('lite');

  let W = 0;
  let H = 0;
  let DPR = 1;

  /* ==========================================================
     SKY — one canvas. Fog is painted on a tiny canvas and scaled
     up (soft and cheap, no CSS blur); stars are drawn on top.
     ========================================================== */
  const sky = (Void.sky = {});
  const canvas = $('#sky');
  const ctx = canvas.getContext('2d', { alpha: false });
  const fog = document.createElement('canvas');
  const fctx = fog.getContext('2d');
  const FOG_SCALE = 0.15;

  const LAYERS = [
    // density: stars per px² · speed: upward drift in px/s · depth: parallax strength
    { density: 0.00014, size: [0.6, 1.2], speed: 9, depth: 0.3 },
    { density: 0.00004, size: [1.2, 1.9], speed: 16, depth: 0.6 },
    { density: 0.000018, size: [1.9, 2.8], speed: 26, depth: 1 }
  ];

  const CLOUDS = [
    { x: 0.2, y: 0.3, r: 0.55, a: 0.08 },
    { x: 0.8, y: 0.7, r: 0.65, a: 0.06 },
    { x: 0.5, y: 0.4, r: 0.50, a: 0.07 },
    { x: 0.3, y: 0.8, r: 0.60, a: 0.05 }
  ];

  const col = { bg: [3, 3, 3], star: [255, 255, 255], fog1: [180, 195, 220], fog2: [100, 115, 140] };
  const target = { bg: [3, 3, 3], star: [255, 255, 255], fog1: [180, 195, 220], fog2: [100, 115, 140] };

  let stars = [];
  let starArea = 0;
  let grain = null;
  let clock = 0;
  let raf = 0;
  let lastPaint = 0;
  let settled = false;
  let px = 0; let py = 0; let tpx = 0; let tpy = 0;

  const rgb = (c, a = 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;

  function makeStars() {
    const area = W * H;
    const amount = isLite() ? 0.45 : 1;
    stars = LAYERS.map((layer) => {
      const n = Math.round(area * layer.density * amount);
      const list = new Array(n);
      for (let i = 0; i < n; i++) {
        list[i] = {
          x: Math.random(),
          y: Math.random(),
          s: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
          p: Math.random() * TAU,
          f: 0.35 + Math.random() * 1.3
        };
      }
      return list;
    });
    starArea = area;
  }

  function makeGrain() {
    // a little noise on top of the fog hides colour banding in the dark gradients
    const g = document.createElement('canvas');
    g.width = g.height = 96;
    const gctx = g.getContext('2d');
    const img = gctx.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    gctx.putImageData(img, 0, 0);
    grain = ctx.createPattern(g, 'repeat');
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    fog.width = Math.max(24, Math.round(W * FOG_SCALE));
    fog.height = Math.max(24, Math.round(H * FOG_SCALE));
    // Only rebuild the star field when the area really changes, so the
    // mobile address bar sliding in and out doesn't reshuffle the sky.
    if (!starArea || Math.abs(W * H - starArea) / starArea > 0.35) makeStars();
    grain = null;
    Void.warp?.resize();
    sky.wake();
  }

  function drawFog(t) {
    const fw = fog.width;
    const fh = fog.height;
    const size = Math.max(fw, fh);
    const c1 = col.fog1;
    const c2 = col.fog2;
    const count = isLite() ? 2 : CLOUDS.length;
    fctx.clearRect(0, 0, fw, fh);
    for (let i = 0; i < count; i++) {
      const c = CLOUDS[i];
      const cx = (c.x + Math.sin(t * 0.12 + i * 1.5) * 0.12) * fw;
      const cy = (c.y + Math.cos(t * 0.096 + i * 2.1) * 0.12) * fh;
      const g = fctx.createRadialGradient(cx, cy, 0, cx, cy, c.r * size);
      g.addColorStop(0, rgb(c1, c.a));
      g.addColorStop(0.5, rgb(c2, c.a * 0.4));
      g.addColorStop(1, rgb(c2, 0));
      fctx.fillStyle = g;
      fctx.fillRect(0, 0, fw, fh);
    }
  }

  function drawStars(t, moving) {
    const scroll = moving ? window.scrollY : 0;
    ctx.fillStyle = rgb(col.star);
    for (let li = 0; li < LAYERS.length; li++) {
      const layer = LAYERS[li];
      const list = stars[li];
      const offY = (moving ? t * layer.speed : 0) + scroll * 0.08 * layer.depth + py * 18 * layer.depth;
      const offX = px * 24 * layer.depth;
      const big = li === 2;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        let y = (s.y * H - offY) % H;
        if (y < 0) y += H;
        let x = (s.x * W - offX) % W;
        if (x < 0) x += W;
        const a = moving ? 0.6 + 0.3 * Math.sin(t * s.f + s.p) : 0.75;
        if (big) {
          ctx.globalAlpha = a * 0.12;
          ctx.beginPath();
          ctx.arc(x, y, s.s * 1.6, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(x, y, s.s / 2, 0, TAU);
          ctx.fill();
        } else {
          ctx.globalAlpha = a;
          ctx.fillRect(x, y, s.s, s.s);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function paint(t, moving) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = rgb(col.bg);
    ctx.fillRect(0, 0, W, H);

    drawFog(t);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(fog, 0, 0, W, H);

    if (!isLite()) {
      if (!grain) makeGrain();
      ctx.globalAlpha = 0.016;
      ctx.fillStyle = grain;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    drawStars(t, moving);
  }

  function frame(now) {
    raf = 0;
    const moving = !Void.motion.reduced;

    // Lite mode: at most ~30 frames a second
    if (moving && isLite() && lastPaint && now - lastPaint < 31) { raf = requestAnimationFrame(frame); return; }
    const dt = Math.min(0.1, lastPaint ? (now - lastPaint) / 1000 : 1 / 60);
    lastPaint = now;
    if (moving) clock += dt;

    // ease colours towards the current page theme (~1.5 s)
    const k = 1 - Math.exp(-dt / 0.42);
    let diff = 0;
    for (const key in col) {
      for (let i = 0; i < 3; i++) {
        const d = target[key][i] - col[key][i];
        col[key][i] += d * k;
        diff += Math.abs(d);
      }
    }
    if (diff < 0.6) for (const key in col) col[key] = target[key].slice();

    const pk = Math.min(1, dt * 3);
    px += (tpx - px) * pk;
    py += (tpy - py) * pk;

    paint(clock, moving);

    const colorsMoving = diff >= 0.6;
    const pointerMoving = Math.abs(tpx - px) + Math.abs(tpy - py) > 0.001;
    settled = !moving && !colorsMoving && !pointerMoving;
    if (!settled && !document.hidden) raf = requestAnimationFrame(frame);
  }

  sky.wake = () => {
    if (!raf) {
      lastPaint = 0;
      raf = requestAnimationFrame(frame);
    }
  };

  sky.setTheme = (theme, instant = false) => {
    target.bg = hexToRgb(theme.bg);
    target.star = hexToRgb(theme.stars);
    target.fog1 = theme.fog1.slice();
    target.fog2 = theme.fog2.slice();
    if (instant) for (const key in col) col[key] = target[key].slice();
    sky.wake();
  };

  sky.starColor = () => col.star;

  sky.init = () => {
    resize();
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 120);
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sky.wake(); });
    window.addEventListener('scroll', () => { if (Void.motion.reduced) return; sky.wake(); }, { passive: true });
    Void.on('settings', () => {
      if (!starArea) return;
      makeStars();
      sky.wake();
    });
    if (finePointer) {
      window.addEventListener('pointermove', (e) => {
        if (Void.motion.reduced) return;
        tpx = e.clientX / W - 0.5;
        tpy = e.clientY / H - 0.5;
        sky.wake();
      }, { passive: true });
    }
  };

  /* ==========================================================
     WARP — star streaks over the whole page. Used for the intro
     and after something is sent.
     ========================================================== */
  const warp = (Void.warp = {});
  const wc = $('#warp');
  const wctx = wc.getContext('2d');
  const glow = $('#warpGlow');
  const stage = $('#stage');
  const MAX_SPEED = 220; // px per 1/60 s at full speed

  let streaks = [];
  let wraf = 0;
  let mode = null;
  let t0 = 0;
  let wlast = 0;
  let resolveCurrent = null;
  let shaking = false;
  let WDPR = 1;

  const sendCurve = (t) => {
    if (t < 0.25) { const u = t / 0.25; return u * u * (3 - 2 * u); } // ramp up
    if (t < 0.55) return 1;                                            // hold
    return Math.pow(1 - (t - 0.55) / 0.45, 2.2);                      // settle
  };

  const TIMELINES = {
    intro: { dur: 1.7, speed: (t) => 150 * Math.pow(1 - t, 2.2), bloom: (t) => 0.5 * Math.pow(1 - t, 1.8), glow: 0, shake: 0 },
    send: { dur: 2.0, speed: (t) => MAX_SPEED * sendCurve(t), bloom: () => 0, glow: 1, shake: 1 }
  };

  function makeStreaks() {
    const n = Math.round(clamp((W * H) / 4200, 70, 300) * (isLite() ? 0.5 : 1));
    streaks = [];
    for (let i = 0; i < n; i++) {
      streaks.push({ x: Math.random() * W, y: Math.random() * H, w: Math.random() * 2.2 + 0.7, m: Math.random() * 0.5 + 0.5 });
    }
  }

  warp.resize = () => {
    WDPR = Math.min(window.devicePixelRatio || 1, 1.5);
    wc.width = Math.round(W * WDPR);
    wc.height = Math.round(H * WDPR);
    if (streaks.length) makeStreaks();
  };

  function applyShake(amount, t) {
    if (amount < 0.01) {
      if (shaking) {
        stage.style.translate = '';
        stage.style.rotate = '';
        shaking = false;
      }
      return;
    }
    shaking = true;
    // A few layered sine waves: a low rumble, never more than ~3 px
    const e = amount * amount;
    const x = (Math.sin(t * 83) * 1.3 + Math.sin(t * 131 + 1.7) * 0.7 + Math.sin(t * 29 + 0.3) * 1.1) * e;
    const y = (Math.cos(t * 97 + 0.5) * 1.1 + Math.sin(t * 149 + 2.1) * 0.6 + Math.cos(t * 23) * 0.9) * e;
    const r = Math.sin(t * 17 + 0.9) * 0.2 * e;
    stage.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    stage.style.rotate = `${r.toFixed(3)}deg`;
  }

  function drawStreaks(speed, dt) {
    const move = speed * dt * 60;
    const fade = clamp(speed / 45, 0, 1);
    const sc = col.star;
    const c = [sc[0] + (255 - sc[0]) * 0.55, sc[1] + (255 - sc[1]) * 0.55, sc[2] + (255 - sc[2]) * 0.55];

    // move
    for (const s of streaks) {
      s.y -= move * s.m;
      const trail = speed * s.m * 0.5;
      if (s.y + trail < 0) {
        s.y += H + trail;
        s.x = Math.random() * W;
      }
    }

    // draw in two passes (soft glow, bright core), batched by width
    wctx.globalCompositeOperation = 'lighter';
    wctx.lineCap = 'round';
    const passes = [[3.2, 0.1], [1, 0.8]];
    for (const [widthMul, alpha] of passes) {
      for (let bucket = 0; bucket < 3; bucket++) {
        const lo = 0.7 + bucket * 0.74;
        const hi = lo + 0.74;
        wctx.beginPath();
        let any = false;
        for (const s of streaks) {
          if (s.w < lo || s.w >= hi) continue;
          const trail = Math.max(0.5, speed * s.m * 0.5);
          wctx.moveTo(s.x, s.y);
          wctx.lineTo(s.x, s.y + trail);
          any = true;
        }
        if (!any) continue;
        wctx.lineWidth = (lo + 0.37) * widthMul;
        wctx.strokeStyle = rgb(c, alpha * fade);
        wctx.stroke();
      }
    }
    wctx.globalCompositeOperation = 'source-over';
  }

  function stop() {
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.clearRect(0, 0, wc.width, wc.height);
    wc.style.visibility = 'hidden';
    glow.style.opacity = '0';
    applyShake(0, 0);
    mode = null;
    wraf = 0;
    const done = resolveCurrent;
    resolveCurrent = null;
    done?.();
  }

  function warpFrame(now) {
    if (!mode) { wraf = 0; return; }
    const tl = TIMELINES[mode];
    const dt = Math.min(0.05, (now - wlast) / 1000 || 1 / 60);
    wlast = now;
    const t = Math.min(1, (now - t0) / 1000 / tl.dur);
    const speed = tl.speed(t);
    const intensity = Math.min(1, speed / MAX_SPEED);

    wctx.setTransform(WDPR, 0, 0, WDPR, 0, 0);
    wctx.clearRect(0, 0, W, H);

    const bloom = tl.bloom(t);
    if (bloom > 0.004) {
      const g = wctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, `rgba(255, 255, 255, ${bloom * 0.45})`);
      g.addColorStop(1, `rgba(255, 255, 255, ${bloom * 0.1})`);
      wctx.fillStyle = g;
      wctx.fillRect(0, 0, W, H);
    }

    drawStreaks(speed, dt);

    glow.style.opacity = (tl.glow * Math.pow(intensity, 1.5) * 0.85).toFixed(3);
    applyShake(tl.shake * intensity, now / 1000);

    if (t >= 1) { stop(); return; }
    wraf = requestAnimationFrame(warpFrame);
  }

  // Starts a warp. Resolves when it has fully settled.
  warp.start = (name) => new Promise((resolve) => {
    if (Void.motion.reduced || !TIMELINES[name]) { resolve(); return; }
    if (resolveCurrent) resolveCurrent();
    resolveCurrent = resolve;
    if (!streaks.length) makeStreaks();
    mode = name;
    t0 = performance.now();
    wlast = t0;
    wc.style.visibility = 'visible';
    if (!wraf) wraf = requestAnimationFrame(warpFrame);
  });

  // Fast-forward the current warp (used when the visitor clicks during the intro)
  warp.hurry = () => {
    if (!mode) return;
    const dur = TIMELINES[mode].dur * 1000;
    const elapsed = performance.now() - t0;
    if (elapsed < dur * 0.8) t0 = performance.now() - dur * 0.8;
  };

  warp.isActive = () => !!mode;

  warp.init = () => {
    warp.resize();
    Void.on('settings', () => { if (Void.motion.reduced && mode) stop(); });
  };
})();
