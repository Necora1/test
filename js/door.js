/* ==========================================================
   door.js — outside renn's door, before you come in
   It's night in the hallway, dark enough that it looks like a phone
   photo. Warm light leaks under a plain door with a strip of masking
   tape on it: "zeroed my world". In the corner the real time runs,
   the outside world's clock.

   Knock (click it, or Enter), and after a moment: "come in". The door
   swings in, the sunset spills out onto the hallway floor, you step
   through, and the clock rewinds from the real time to 0:00:00:
   closing the door behind you zeroes the world. Inside it's always
   5:47 pm.

   Type "leave" in the room to step back out. Links straight to a room
   (#guitar…) skip the door, and so does coming back in the same tab.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $ } = Void;
  const html = document.documentElement;
  const KEY = 'zeroed_inside';

  const el = $('#doorScene');
  const hall = el?.querySelector('.door-hall');
  const spill = el?.querySelector('.door-spill');
  const leaf = $('#doorLeaf');
  const leafCanvas = leaf?.querySelector('canvas');
  const clock = $('#doorClock');

  let geo = null;
  let state = 'closed';           // closed · knocking · opening · inside
  let enteredResolve;
  const entered = new Promise((res) => { enteredResolve = res; });
  let clockTimer = 0;
  let firstDone = false;
  // the first time in resolves `entered`; coming back in after "leave" says so on the bus
  function wentIn(from) {
    if (firstDone) Void.emit('door:again', { from });
    else enteredResolve({ from });
    firstDone = true;
  }

  const secondsToday = () => {
    const d = new Date();
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  };
  const hms = (t) => `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

  /* ---------- the geometry: one door at the end of a narrow hall ---------- */
  // the camera stands a little to the left, so the hall isn't symmetric:
  // the right wall shows, the left one is mostly lost in the dark
  function measure() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const narrow = vw < vh;
    const dw = Math.min(vw * (narrow ? 0.4 : 0.3), vh * 0.26);
    const dh = dw * 2.45;                      // 80 × 200 cm, near enough
    const floor = vh * 0.84;
    const cx = vw * (narrow ? 0.52 : 0.55);
    const x0 = cx - dw / 2;
    return {
      vw, vh, dw, dh, cx, floor, x0,
      y0: floor - dh,
      vp: [cx - dw * 0.7, floor - dh * 0.66],
      wall: { x0: x0 - dw * 0.42, x1: x0 + dw + dw * 0.5, y0: floor - dh * 1.28, y1: floor }
    };
  }

  function canvasFor(c, w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  const lin = (ctx, x0, y0, x1, y1, stops) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  };
  const rad = (ctx, x, y, r0, r1, stops) => {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  };
  const poly = (ctx, pts, fill) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  };
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // sensor noise, the kind a phone makes in a dark hallway: grey and a little colour
  let noiseTile = null;
  function noise() {
    if (noiseTile) return noiseTile;
    noiseTile = document.createElement('canvas');
    noiseTile.width = noiseTile.height = 256;
    const n = noiseTile.getContext('2d');
    const img = n.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 90;
      img.data[i] = v + (Math.random() - 0.5) * 30;
      img.data[i + 1] = v + (Math.random() - 0.5) * 30;
      img.data[i + 2] = v + (Math.random() - 0.5) * 40;
      img.data[i + 3] = 255;
    }
    n.putImageData(img, 0, 0);
    return noiseTile;
  }
  function grainOn(ctx, w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(noise(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /* ---------- the hallway, at night ---------- */
  function paintHall(g) {
    seed = 3;
    const ctx = canvasFor(hall, g.vw, g.vh);
    const { vw, vh, wall, vp, x0, y0, dw, dh, floor } = g;
    const out = ([x, y], k) => [vp[0] + (x - vp[0]) * k, vp[1] + (y - vp[1]) * k];
    const K = 8;
    const tl = [wall.x0, wall.y0];
    const tr = [wall.x1, wall.y0];
    const br = [wall.x1, wall.y1];
    const bl = [wall.x0, wall.y1];
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, vw, vh);
    // ceiling, walls, floor: nearly black, the paint only just there
    poly(ctx, [tl, tr, out(tr, K), out(tl, K)], '#0b0b0d');
    poly(ctx, [tl, bl, out(bl, K), out(tl, K)], lin(ctx, wall.x0, 0, 0, 0, [[0, '#131316'], [0.4, '#0a0a0c'], [1, '#050506']]));
    poly(ctx, [tr, br, out(br, K), out(tr, K)], lin(ctx, wall.x1, 0, vw, 0, [[0, '#17171a'], [1, '#0c0c0e']]));
    poly(ctx, [bl, br, out(br, K), out(bl, K)], '#0e0c0a');
    // laminate, boards running away from you, joints staggered
    ctx.save();
    poly(ctx, [bl, br, out(br, K), out(bl, K)]);
    ctx.clip();
    const boardW = dw * 0.23;
    for (let k = -24; k <= 24; k++) {
      const x = x0 + k * boardW;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, floor);
      ctx.lineTo(...out([x, floor], K));
      ctx.stroke();
      for (let j = 0; j < 4; j++) {
        const t = 1.1 + ((k * 37 + j * 53) % 97) / 97 * 5;
        const a = out([x, floor], t);
        const b = out([x + boardW, floor], t);
        ctx.beginPath();
        ctx.moveTo(...a);
        ctx.lineTo(...b);
        ctx.stroke();
      }
      const shade = rnd();
      ctx.fillStyle = shade < 0.5 ? `rgba(0,0,0,${shade * 0.3})` : `rgba(120, 100, 80, ${(shade - 0.5) * 0.06})`;
      poly(ctx, [[x, floor], [x + boardW, floor], out([x + boardW, floor], K), out([x, floor], K)]);
      ctx.fill();
    }
    ctx.restore();
    // the end wall
    poly(ctx, [tl, tr, br, bl], '#141417');
    // skirting, square, on the end wall and down the right wall
    const sk = dh * 0.045;
    poly(ctx, [[wall.x0, floor - sk], [wall.x1, floor - sk], br, bl], '#1b1b1f');
    poly(ctx, [[wall.x1, floor - sk], br, out(br, K), out([wall.x1, floor - sk], K)], '#18181b');
    // the casing round the door: flat boards, square corners
    const cs = dw * 0.075;
    poly(ctx, [[x0 - cs, y0 - cs], [x0 + dw + cs, y0 - cs], [x0 + dw + cs, floor], [x0 - cs, floor]], '#1d1d21');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x0 - 2, y0 - 2, dw + 4, 2);
    ctx.fillRect(x0 - 2, y0, 2, dh);
    ctx.fillRect(x0 + dw, y0, 2, dh);
    // the doorway itself is a hole: the room is behind it
    ctx.clearRect(x0, y0, dw, dh);
    // a light switch on the right wall, square, off
    const sw = out([wall.x1, y0 + dh * 0.45], 1.28);
    ctx.fillStyle = '#26262a';
    ctx.fillRect(sw[0], sw[1], dw * 0.075, dw * 0.1);
    ctx.fillStyle = '#1a1a1d';
    ctx.fillRect(sw[0] + dw * 0.02, sw[1] + dw * 0.02, dw * 0.035, dw * 0.06);

    // light: from under the door, a warm fan across the floor…
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.translate(g.cx, floor);
    ctx.scale(1, 0.26);
    ctx.fillStyle = rad(ctx, 0, 0, 0, dw * 1.5, [[0, 'rgba(255, 170, 95, 0.34)'], [0.25, 'rgba(230, 140, 70, 0.14)'], [1, 'rgba(200, 110, 50, 0)']]);
    ctx.fillRect(-dw * 2, -dw * 2, dw * 4, dw * 4);
    ctx.restore();
    // …a smeared reflection of the gap in the laminate…
    ctx.filter = `blur(${Math.max(4, dw * 0.05)}px)`;
    ctx.fillStyle = lin(ctx, 0, floor, 0, floor + dh * 0.22, [[0, 'rgba(255, 180, 110, 0.16)'], [1, 'rgba(255, 180, 110, 0)']]);
    poly(ctx, [[x0 + dw * 0.2, floor], [x0 + dw * 0.8, floor], [x0 + dw * 0.88, floor + dh * 0.22], [x0 + dw * 0.12, floor + dh * 0.22]]);
    ctx.fill();
    ctx.filter = 'none';
    // …and a little up the casing and the walls either side
    ctx.fillStyle = rad(ctx, g.cx, floor, 0, dw * 1.1, [[0, 'rgba(255, 160, 90, 0.08)'], [1, 'rgba(255, 160, 90, 0)']]);
    ctx.fillRect(0, 0, vw, vh);
    // moonlight from a window behind you: a pale skewed square on the right wall
    const mA = out([wall.x1, y0 + dh * 0.05], 1.9);
    const mB = out([wall.x1, y0 + dh * 0.05], 2.9);
    const mC = out([wall.x1, y0 + dh * 0.62], 2.9);
    const mD = out([wall.x1, y0 + dh * 0.62], 1.9);
    ctx.filter = 'blur(10px)';
    poly(ctx, [mA, mB, mC, mD], 'rgba(120, 140, 190, 0.07)');
    ctx.filter = 'none';
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = dw * 0.04;
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    ctx.beginPath();
    ctx.moveTo(...mid(mA, mB)); ctx.lineTo(...mid(mD, mC));
    ctx.moveTo(...mid(mA, mD)); ctx.lineTo(...mid(mB, mC));
    ctx.stroke();
    ctx.restore();

    // the lens: darker corners, noise
    ctx.fillStyle = rad(ctx, g.cx, vh * 0.55, Math.min(vw, vh) * 0.2, Math.max(vw, vh) * 0.75, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.75)']]);
    ctx.fillRect(0, 0, vw, vh);
    ctx.clearRect(x0, y0, dw, dh);
    grainOn(ctx, vw, vh, 0.22);
    ctx.clearRect(x0, y0, dw, dh);
  }

  // the light that pours out once the door opens: on the floor, the walls, into the air
  function paintSpill(g) {
    const ctx = canvasFor(spill, g.vw, g.vh);
    const { vw, vh, x0, dw, floor, cx, vp } = g;
    // the doorway's shape laid on the floor, stretching towards you
    const far = [[x0, floor], [x0 + dw, floor]];
    const near = far.map(([x, y]) => [x + (x - vp[0]) * 1.8 + dw * 0.5, y + (y - vp[1]) * 1.8]);
    ctx.filter = 'blur(14px)';
    poly(ctx, [far[0], far[1], near[1], near[0]], lin(ctx, 0, floor, 0, vh, [[0, 'rgba(255, 190, 120, 0.7)'], [1, 'rgba(255, 150, 80, 0.12)']]));
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rad(ctx, cx, floor - g.dh * 0.4, 10, Math.max(vw, vh) * 0.6, [[0, 'rgba(255, 170, 100, 0.22)'], [0.5, 'rgba(255, 140, 70, 0.06)'], [1, 'rgba(255, 140, 70, 0)']]);
    ctx.fillRect(0, 0, vw, vh);
  }

  /* ---------- the door ---------- */
  function paintLeaf(g) {
    const { dw, dh } = g;
    leaf.style.left = `${g.x0}px`;
    leaf.style.top = `${g.y0}px`;
    leaf.style.width = `${dw}px`;
    leaf.style.height = `${dh}px`;
    const ctx = canvasFor(leafCanvas, dw, dh);
    seed = 11;
    // a plain laminated door, pale grey in daylight, near black now
    ctx.fillStyle = lin(ctx, 0, 0, dw, dh, [[0, '#2c2d31'], [0.55, '#26272a'], [1, '#2a2622']]);
    ctx.fillRect(0, 0, dw, dh);
    // the grain in the laminate: long, faint, not quite straight
    for (let i = 0; i < 140; i++) {
      const x = rnd() * dw;
      const w = 0.4 + rnd() * 1.2;
      ctx.strokeStyle = rnd() < 0.5 ? `rgba(0,0,0,${0.02 + rnd() * 0.035})` : `rgba(255,255,255,${0.006 + rnd() * 0.01})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (rnd() - 0.5) * 6, dh * 0.33, x + (rnd() - 0.5) * 6, dh * 0.66, x + (rnd() - 0.5) * 4, dh);
      ctx.stroke();
    }
    // scuffs low down, where it gets kicked shut
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.12})`;
      ctx.fillRect(dw * (0.2 + rnd() * 0.6), dh * (0.9 + rnd() * 0.07), dw * (0.02 + rnd() * 0.08), 1 + rnd() * 2);
    }
    // the warm floor light reaches the bottom of it, just
    ctx.fillStyle = lin(ctx, 0, dh * 0.8, 0, dh, [[0, 'rgba(255, 160, 90, 0)'], [1, 'rgba(255, 160, 90, 0.07)']]);
    ctx.fillRect(0, dh * 0.8, dw, dh * 0.2);
    // hinges
    [0.1, 0.88].forEach((y) => {
      ctx.fillStyle = '#1a1a1c';
      ctx.fillRect(0, dh * y, dw * 0.025, dh * 0.05);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, dh * y, dw * 0.025, 1);
    });
    // a strip of masking tape with the name on it, in marker, a bit crooked
    ctx.save();
    ctx.translate(dw * 0.47, dh * 0.3);
    ctx.rotate(-0.035);
    const tw = dw * 0.5;
    const th = dw * 0.085;
    ctx.beginPath();
    ctx.moveTo(-tw / 2, -th / 2);
    for (let k = 0; k <= 6; k++) ctx.lineTo(-tw / 2 + (k % 2 ? 2 : -1), -th / 2 + (th * k) / 6);
    ctx.lineTo(tw / 2, th / 2);
    for (let k = 6; k >= 0; k--) ctx.lineTo(tw / 2 + (k % 2 ? -2 : 1), -th / 2 + (th * k) / 6);
    ctx.closePath();
    ctx.fillStyle = '#4a463d';
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-tw / 2, th / 2 - 1, tw, 1);
    ctx.fillStyle = 'rgba(10, 10, 12, 0.85)';
    ctx.font = `600 ${th * 0.78}px Caveat, cursive`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('zeroed my world', -tw / 2 + th * 0.35, th * 0.04);
    ctx.restore();
    // the handle: a square rose, a straight steel lever, a keyhole
    const hx = dw * 0.9;
    const hy = dh * 0.52;
    const rw = dw * 0.045;
    const rh = dw * 0.13;
    ctx.fillStyle = '#3b3c40';
    ctx.fillRect(hx - rw / 2, hy - rh / 2, rw, rh);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(hx - rw / 2, hy - rh / 2, rw, 1);
    const lw = dw * 0.17;
    const lt = dw * 0.024;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(hx - lw, hy - lt / 2 + 3, lw, lt);
    ctx.fillStyle = lin(ctx, 0, hy - lt / 2, 0, hy + lt / 2, [[0, '#7a7b80'], [0.35, '#515256'], [1, '#2e2f33']]);
    ctx.fillRect(hx - lw, hy - lt / 2, lw, lt);
    ctx.fillStyle = '#3b3c40';
    ctx.fillRect(hx - rw / 2, hy + rh * 0.62, rw, rh * 0.45);
    ctx.fillStyle = '#0a0a0b';
    ctx.fillRect(hx - 1, hy + rh * 0.72, 2, rh * 0.2);
    // the gaps: a line of light under the door and down the latch side
    ctx.fillStyle = 'rgba(255, 196, 130, 0.9)';
    ctx.fillRect(0, dh - 1.5, dw, 1.5);
    ctx.fillStyle = lin(ctx, 0, 0, 0, dh, [[0, 'rgba(255, 196, 130, 0.25)'], [1, 'rgba(255, 196, 130, 0.6)']]);
    ctx.fillRect(dw - 1, 0, 1, dh);
    grainOn(ctx, dw, dh, 0.25);
  }

  function paint() {
    geo = measure();
    el.style.setProperty('--ox', `${geo.cx}px`);
    el.style.setProperty('--oy', `${geo.y0 + geo.dh * 0.5}px`);
    paintHall(geo);
    paintSpill(geo);
    paintLeaf(geo);
    el.classList.add('is-painted');
  }

  /* ---------- the clock outside ---------- */
  function tick() {
    const t = hms(secondsToday());
    if (clock) clock.textContent = t;
    const corner = $('#tapeCounter');
    if (corner && state !== 'inside') corner.textContent = t;
  }

  /* ---------- in ---------- */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function knock() {
    if (state !== 'closed') return;
    state = 'knocking';
    const snd = Void.dream.sound;
    const quick = Void.motion.reduced;
    el.classList.add('is-knocking');
    if (!quick) {
      snd.knock();
      leaf.classList.add('is-knocked');
      await wait(190);
      snd.knock({ vol: 0.6 });
      await wait(170);
      snd.knock({ vol: 0.75 });
      await wait(120);
      leaf.classList.remove('is-knocked');
      await wait(700);
      el.classList.add('is-answered');           // "come in"
      await wait(1000);
      snd.latch();
    }
    enter(quick);
  }

  async function enter(quick = false) {
    state = 'opening';
    const from = secondsToday();
    const snd = Void.dream.sound;
    clearInterval(clockTimer);
    // don't open onto an unpainted room
    for (let i = 0; i < 100 && !html.classList.contains('memory-ready'); i++) await wait(100);
    if (quick) {
      el.classList.add('is-gone');
    } else {
      el.classList.add('is-open');
      snd.swell();
      [0, 4, 7, 11].forEach((n, i) => snd.chime(snd.step(n, 262), { vol: 0.05, dur: 3.2, wet: 0.8, when: 0.5 + i * 0.12 }));
      await wait(1500);
      el.classList.add('is-through');
    }
    try { sessionStorage.setItem(KEY, '1'); } catch { /* fine */ }
    state = 'inside';
    wentIn(from);
    await wait(quick ? 400 : 1700);
    el.hidden = true;
    html.classList.remove('at-door');
  }

  // skip it: straight in, the clock still winds back
  function skip() {
    state = 'inside';
    clearInterval(clockTimer);
    if (el) el.hidden = true;
    html.classList.remove('at-door');
    wentIn(3600 * 4 + 60 * 17 + 32);
  }

  /* ---------- and out again ---------- */
  function leave() {
    if (state !== 'inside' || !el) return;
    if (location.hash && location.hash !== '#home') location.hash = 'home';
    try { sessionStorage.removeItem(KEY); } catch { /* fine */ }
    html.classList.add('at-door');
    el.hidden = false;
    el.classList.remove('is-knocking', 'is-answered', 'is-gone');
    el.classList.add('is-open', 'is-through');
    void el.offsetWidth;
    el.classList.remove('is-through');
    Void.dream.sound.swell({ dur: 1.6, vol: 0.08 });
    setTimeout(() => {
      el.classList.remove('is-open');
      Void.dream.sound.knock({ vol: 0.5, when: 1.1 });
    }, 900);
    state = 'closed';
    tick();
    clockTimer = setInterval(tick, 1000);
    setTimeout(() => leaf.focus({ preventScroll: true }), 1400);
  }

  Void.dream = Void.dream || {};
  Void.dream.door = {
    entered,
    get inside() { return state === 'inside'; },
    leave,
    init() {
      if (!el) { skip(); return; }
      let been = false;
      try { been = sessionStorage.getItem(KEY) === '1'; } catch { /* fine */ }
      const deep = location.hash && location.hash !== '#home';
      if (been || deep || /[?&]nodoor\b/.test(location.search)) { skip(); return; }
      tick();
      clockTimer = setInterval(tick, 1000);
      const draw = () => paint();
      Promise.all([document.fonts.load('600 20px Caveat'), document.fonts.load('italic 400 30px Fraunces')]).catch(() => {}).then(draw);
      let rt = 0;
      window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!el.hidden) draw(); }, 150); });
      if (!matchMedia('(hover: hover)').matches) { const h = el.querySelector('.door-hint'); if (h) h.textContent = 'tap the door to knock'; }
      leaf.addEventListener('click', knock);
      document.addEventListener('keydown', (e) => {
        if (el.hidden || state !== 'closed') return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); knock(); }
      }, true);
      // a link to a room, followed while standing outside: just go in
      window.addEventListener('hashchange', () => {
        if (state === 'closed' && location.hash && location.hash !== '#home') enter(true);
      });
      leaf.focus({ preventScroll: true });
    }
  };
})();
