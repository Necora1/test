/* ==========================================================
   door.js — outside renn's door, before you come in
   It's night in the hallway. Warm light leaks around a door with a
   brass 0 on it and a note taped under it: "zeroed my world". In the
   corner the real time runs, the outside world's clock.

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

  /* ---------- the geometry: one door, one vanishing point ---------- */
  function measure() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dw = Math.min(vw * 0.38, vh * 0.285);
    const dh = dw * 2.2;
    const floor = vh * 0.8;
    const cx = vw / 2;
    return {
      vw, vh, dw, dh, cx, floor,
      x0: cx - dw / 2,
      y0: floor - dh,
      vp: [cx, floor - dh * 0.58],              // eye level, a bit above the handle
      wall: { x0: cx - dw * 1.75, x1: cx + dw * 1.75, y0: floor - dh * 1.42, y1: floor }
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

  /* ---------- the hallway, at night ---------- */
  function paintHall(g) {
    const ctx = canvasFor(hall, g.vw, g.vh);
    const { vw, vh, wall, vp, x0, y0, dw, dh, floor } = g;
    // a point on the end wall's outline, pushed out along the corridor to the screen's edge
    const out = ([x, y], k) => [vp[0] + (x - vp[0]) * k, vp[1] + (y - vp[1]) * k];
    const K = 6;
    const tl = [wall.x0, wall.y0];
    const tr = [wall.x1, wall.y0];
    const br = [wall.x1, wall.y1];
    const bl = [wall.x0, wall.y1];
    // ceiling, side walls, floor
    poly(ctx, [tl, tr, out(tr, K), out(tl, K)], lin(ctx, 0, wall.y0, 0, 0, [[0, '#15161d'], [1, '#08080b']]));
    poly(ctx, [tl, bl, out(bl, K), out(tl, K)], lin(ctx, wall.x0, 0, 0, 0, [[0, '#1b1c25'], [1, '#0b0b0f']]));
    poly(ctx, [tr, br, out(br, K), out(tr, K)], lin(ctx, wall.x1, 0, vw, 0, [[0, '#191a22'], [1, '#09090c']]));
    poly(ctx, [bl, br, out(br, K), out(bl, K)], lin(ctx, 0, floor, 0, vh, [[0, '#1c1813'], [1, '#0c0a08']]));
    // floorboards running to the door
    ctx.save();
    poly(ctx, [bl, br, out(br, K), out(bl, K)]);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    for (let k = -14; k <= 14; k++) {
      const x = g.cx + k * dw * 0.24;
      ctx.beginPath();
      ctx.moveTo(x, floor);
      ctx.lineTo(...out([x, floor], K));
      ctx.stroke();
    }
    ctx.restore();
    // the end wall, the light from under the door warming it a little
    poly(ctx, [tl, tr, br, bl], lin(ctx, 0, wall.y0, 0, wall.y1, [[0, '#1d1f28'], [1, '#262631']]));
    ctx.save();
    poly(ctx, [tl, tr, br, bl]);
    ctx.clip();
    ctx.fillStyle = rad(ctx, g.cx, floor, 10, dw * 1.6, [[0, 'rgba(255, 170, 90, 0.22)'], [1, 'rgba(255, 170, 90, 0)']]);
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
    // moonlight from somewhere down the hall, on the left wall
    ctx.fillStyle = rad(ctx, wall.x0 - dw * 0.8, vp[1], 10, dw * 1.4, [[0, 'rgba(120, 150, 230, 0.12)'], [1, 'rgba(120, 150, 230, 0)']]);
    ctx.fillRect(0, 0, vw, vh);
    // skirting
    poly(ctx, [[wall.x0, floor - dh * 0.05], [wall.x1, floor - dh * 0.05], br, bl], '#2c2c36');
    // the corners of the corridor
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    [tl, tr, br, bl].forEach((p) => { ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...out(p, K)); ctx.stroke(); });
    // the door's casing
    const cs = dw * 0.075;
    poly(ctx, [[x0 - cs, y0 - cs], [x0 + dw + cs, y0 - cs], [x0 + dw + cs, floor], [x0 - cs, floor]], lin(ctx, x0 - cs, 0, x0 + dw + cs, 0, [[0, '#3b3c48'], [0.5, '#444553'], [1, '#34353f']]));
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 - cs * 0.5, y0 - cs * 0.5, dw + cs, dh + cs * 0.5);
    // the doorway itself is a hole: the room is behind it
    ctx.clearRect(x0, y0, dw, dh);
    // a light switch by the door
    const sx = x0 + dw + cs * 2.2;
    const sy = y0 + dh * 0.47;
    ctx.fillStyle = '#3f404c';
    ctx.fillRect(sx, sy, dw * 0.09, dw * 0.13);
    ctx.fillStyle = '#2a2a33';
    ctx.fillRect(sx + dw * 0.03, sy + dw * 0.035, dw * 0.03, dw * 0.06);
    // a pair of shoes left by the door
    [[-1.12, 0.05, -0.12], [-0.86, 0.08, 0.1]].forEach(([dx, dy, rot]) => {
      const x = g.cx + dx * dw;
      const y = floor + dy * dh;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(2, dw * 0.05, dw * 0.13, dw * 0.035, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#bdb8ae';
      ctx.beginPath();
      ctx.ellipse(0, 0, dw * 0.12, dw * 0.05, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#8f8a82';
      ctx.fillRect(-dw * 0.12, 0, dw * 0.24, dw * 0.03);
      ctx.fillStyle = '#2e2c30';
      ctx.beginPath();
      ctx.ellipse(-dw * 0.03, -dw * 0.012, dw * 0.05, dw * 0.02, 0, 0, 7);
      ctx.fill();
      ctx.restore();
    });
    // the doormat, with its zero
    const mat = [[g.cx - dw * 0.55, floor + 6], [g.cx + dw * 0.55, floor + 6], [g.cx + dw * 0.72, floor + dh * 0.12], [g.cx - dw * 0.72, floor + dh * 0.12]];
    poly(ctx, mat, '#3a2f25');
    ctx.save();
    ctx.translate(g.cx, floor + dh * 0.066);
    ctx.scale(1, 0.32);
    ctx.fillStyle = 'rgba(200, 170, 120, 0.45)';
    ctx.font = `italic 400 ${dw * 0.34}px Fraunces, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', 0, 0);
    ctx.restore();
  }

  // the light that pours out once the door opens: on the floor, the walls, into the air
  function paintSpill(g) {
    const ctx = canvasFor(spill, g.vw, g.vh);
    const { vw, vh, x0, dw, floor, cx } = g;
    ctx.fillStyle = lin(ctx, 0, floor, 0, vh, [[0, 'rgba(255, 196, 120, 0.85)'], [1, 'rgba(255, 150, 80, 0.15)']]);
    poly(ctx, [[x0, floor], [x0 + dw, floor], [cx + dw * 2.4, vh], [cx - dw * 1.6, vh]]);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rad(ctx, cx, floor - g.dh * 0.45, 10, Math.max(vw, vh) * 0.7, [[0, 'rgba(255, 180, 100, 0.35)'], [0.5, 'rgba(255, 140, 70, 0.1)'], [1, 'rgba(255, 140, 70, 0)']]);
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
    ctx.fillStyle = lin(ctx, 0, 0, dw, 0, [[0, '#7c7f8c'], [0.6, '#8a8d99'], [1, '#6e717d']]);
    ctx.fillRect(0, 0, dw, dh);
    ctx.fillStyle = lin(ctx, 0, 0, 0, dh, [[0, 'rgba(0,0,0,0.25)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(255,170,90,0.12)']]);
    ctx.fillRect(0, 0, dw, dh);
    // two panels
    [[0.08, 0.06, 0.84, 0.36], [0.08, 0.5, 0.84, 0.44]].forEach(([x, y, w, h]) => {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * dw, y * dh, w * dw, h * dh);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.strokeRect(x * dw + 2, y * dh + 2, w * dw - 4, h * dh - 4);
    });
    // the room number: a brass zero
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `italic 400 ${dw * 0.26}px Fraunces, Georgia, serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText('0', dw * 0.5 + 2, dh * 0.16 + 3);
    ctx.fillStyle = lin(ctx, 0, dh * 0.1, 0, dh * 0.22, [[0, '#f0d08a'], [0.5, '#b88a3e'], [1, '#e2bb6c']]);
    ctx.fillText('0', dw * 0.5, dh * 0.16);
    // the note, taped on, a bit crooked
    ctx.save();
    ctx.translate(dw * 0.5, dh * 0.33);
    ctx.rotate(-0.04);
    const nw = dw * 0.66;
    const nh = dw * 0.42;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-nw / 2 + 3, -nh / 2 + 5, nw, nh);
    ctx.fillStyle = '#e4dccb';
    ctx.fillRect(-nw / 2, -nh / 2, nw, nh);
    ctx.fillStyle = 'rgba(220, 200, 150, 0.7)';
    ctx.save(); ctx.rotate(-0.3); ctx.fillRect(-nw / 2 - 6, -nh / 2 + 4, nw * 0.2, 10); ctx.restore();
    ctx.save(); ctx.rotate(0.3); ctx.fillRect(nw / 2 - nw * 0.2, -nh / 2 - 26, nw * 0.2, 10); ctx.restore();
    ctx.fillStyle = '#2b2627';
    ctx.font = `600 ${dw * 0.06}px Caveat, cursive`;
    ctx.fillText('the void', -nw * 0.18, -nh * 0.3);
    ctx.strokeStyle = '#2b2627';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-nw * 0.34, -nh * 0.3);
    ctx.lineTo(-nw * 0.02, -nh * 0.31);
    ctx.stroke();
    ctx.font = `600 ${dw * 0.105}px Caveat, cursive`;
    ctx.fillText('zeroed my world', 0, -nh * 0.02);
    ctx.font = `600 ${dw * 0.055}px Caveat, cursive`;
    ctx.fillStyle = '#5a4f4a';
    ctx.fillText('(renn’s room · knock first)', 0, nh * 0.27);
    ctx.restore();
    // stickers
    const star = (x, y, r, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * Math.PI / 5;
        const rr = k % 2 ? r * 0.45 : r;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    };
    star(dw * 0.2, dh * 0.62, dw * 0.05, '#f2c14e');
    ctx.fillStyle = '#e98aa6';
    ctx.beginPath();
    ctx.arc(dw * 0.74, dh * 0.7, dw * 0.035, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#2d2a33';
    ctx.fillRect(dw * 0.26, dh * 0.8, dw * 0.16, dw * 0.1);
    ctx.fillStyle = '#e4dccb';
    ctx.fillRect(dw * 0.28, dh * 0.8 + dw * 0.02, dw * 0.12, dw * 0.04);
    ctx.fillStyle = '#2d2a33';
    [0.31, 0.37].forEach((x) => { ctx.beginPath(); ctx.arc(dw * x, dh * 0.8 + dw * 0.04, dw * 0.012, 0, 7); ctx.fill(); });
    // the handle, and a sign hanging from it
    const hx = dw * 0.86;
    const hy = dh * 0.53;
    ctx.fillStyle = '#1b1b20';
    ctx.beginPath();
    ctx.arc(hx, hy, dw * 0.04, 0, 7);
    ctx.fill();
    ctx.fillRect(hx - dw * 0.16, hy - dw * 0.015, dw * 0.16, dw * 0.03);
    ctx.fillRect(hx - dw * 0.01, hy + dw * 0.07, dw * 0.02, dw * 0.04);
    ctx.save();
    ctx.translate(hx - dw * 0.02, hy + dw * 0.03);
    ctx.rotate(0.08);
    ctx.strokeStyle = '#1b1b20';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-dw * 0.06, dw * 0.1);
    ctx.moveTo(0, 0);
    ctx.lineTo(dw * 0.06, dw * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#c9544a';
    ctx.fillRect(-dw * 0.13, dw * 0.1, dw * 0.26, dw * 0.13);
    ctx.fillStyle = '#fbe9dc';
    ctx.font = `600 ${dw * 0.04}px Caveat, cursive`;
    ctx.fillText('the world', 0, dw * 0.14);
    ctx.fillText('is on pause', 0, dw * 0.19);
    ctx.restore();
    // light slipping round the edges, from the room behind
    ctx.fillStyle = lin(ctx, dw - 6, 0, dw, 0, [[0, 'rgba(255, 190, 110, 0)'], [1, 'rgba(255, 190, 110, 0.55)']]);
    ctx.fillRect(dw - 6, 0, 6, dh);
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
