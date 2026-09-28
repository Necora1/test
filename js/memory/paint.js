/* ==========================================================
   memory/paint.js — renn's room, painted in code
   Late in the day, facing the window: the sun is low behind bare
   winter trees, the room is dark and warm, and the only real
   light is what comes straight through the glass — catching the
   folds of an unmade bed, the edge of a bookshelf, a guitar, a
   wall full of little photos.

   Everything is drawn once, on load, into layers that the memory
   engine (engine.js) lights and animates:

   albedo   the room as it looks in the dim, even light
   sun      R: where the low sun catches things (fold ridges, edges)
            G: light hanging in the air, rays from the window
            B: where branch shadows can move through that light
   emit     R: the lamp   G: the laptop screen   B: fairy lights
   glass    white where you see through the window (the engine puts
            the sun there, and the night later)
   fg       (empty for now) anything right in front of the camera

   The room is designed on a 1600 × 1000 board; HOTSPOTS and SUN
   are in those units.
   ========================================================== */
(() => {
  const Void = window.Void;
  const W = 1600;
  const H = 1000;

  /* ---------- the window ---------- */
  const WIN = { x: 736, y: 236, w: 272, h: 452 };
  const TRANSOM = 62;              // the small row of panes at the top
  const COLS = 3;
  const ROWS = 4;
  const SUN = [868, 548];           // low, near the horizon line
  const HORIZON = 566;

  /* ---------- what you can click (board units) ---------- */
  const HOTSPOTS = [
    { id: 'wishes', label: 'the window', x: 726, y: 226, w: 292, h: 470 },
    { id: 'gallery', label: 'pictures i took', x: 104, y: 428, w: 470, h: 262 },
    { id: 'favoomfs', label: 'my friends', x: 84, y: 206, w: 280, h: 204 },
    { id: 'about', label: 'a note on the wall', x: 1036, y: 292, w: 104, h: 104 },
    { id: 'interests', label: 'the tapes', x: 1196, y: 470, w: 300, h: 76 },
    { id: 'guitar', label: 'my guitar', x: 1240, y: 452, w: 120, h: 316 },
    { id: 'games', label: 'my laptop', x: 700, y: 800, w: 200, h: 124 },
    { id: 'send', label: 'a letter for you', x: 574, y: 594, w: 112, h: 52 },
    { id: 'lamp', label: 'the lamp', x: 586, y: 470, w: 88, h: 124, action: 'lamp' },
    { id: 'oracle', label: 'the cards on my bed', x: 1040, y: 800, w: 170, h: 90 }
  ];

  /* ---------- helpers ---------- */
  let S = 1;
  let rnd = mulberry(7);
  function mulberry(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = (a, b) => a + rnd() * (b - a);

  function layer(scale = 1) {
    const c = document.createElement('canvas');
    c.width = Math.round(W * S * scale);
    c.height = Math.round(H * S * scale);
    const ctx = c.getContext('2d');
    ctx.scale(S * scale, S * scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    return { c, ctx };
  }

  function path(ctx, pts, close = true) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    if (close) ctx.closePath();
  }

  function fillPoly(ctx, pts, style) {
    path(ctx, pts);
    ctx.fillStyle = style;
    ctx.fill();
  }

  // a soft-edged shape: only its blurred shadow is drawn
  function soft(ctx, blur, color, draw) {
    ctx.save();
    const a = ctx.getTransform().a;
    const off = 20000;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * a;
    ctx.shadowOffsetX = off * a;
    ctx.translate(-off, 0);
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    draw();
    ctx.restore();
  }

  function lin(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }

  function rad(ctx, x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  let grainPattern = null;
  function grain(ctx, alpha, clip) {
    if (!grainPattern) {
      const g = document.createElement('canvas');
      g.width = g.height = 256;
      const gx = g.getContext('2d');
      const img = gx.createImageData(256, 256);
      const r = mulberry(99);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (r() - 0.5) * 90 + (r() - 0.5) * 60;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      gx.putImageData(img, 0, 0);
      grainPattern = g;
    }
    ctx.save();
    if (clip) { clip(); ctx.clip(); }
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grainPattern, 'repeat');
    ctx.fillRect(-50, -50, W + 100, H + 100);
    ctx.restore();
  }

  const loadImg = (src) => new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });

  /* ---------- the window's panes ---------- */
  function panes() {
    const out = [];
    const bar = 7;
    const cw = WIN.w / COLS;
    for (let c = 0; c < COLS; c++) out.push([WIN.x + c * cw + bar / 2, WIN.y + bar / 2, cw - bar, TRANSOM - bar]);
    const top = WIN.y + TRANSOM + 12;
    const rh = (WIN.h - TRANSOM - 12) / ROWS;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) out.push([WIN.x + c * cw + bar / 2, top + r * rh + bar / 2, cw - bar, rh - bar]);
    }
    return out;
  }

  /* ---------- the bed: head against the wall under the window, foot
     towards you (cut off by the bottom of the picture). Its sides run
     towards the vanishing point, so it sits in the room properly. ---------- */
  const FLOOR_Y = 690;
  const HEAD_Y = 688;
  const bedL = (y) => 690 - 0.835 * (y - HEAD_Y);    // left edge of the mattress top
  const bedR = (y) => 1150 + 1.275 * (y - HEAD_Y);   // right edge
  const FOLD = (x) => 770 + Math.sin(x * 0.012) * 6 + (x - 900) * 0.01;   // where the duvet is folded back

  function makeFolds() { /* the bed is drawn directly now */ }

  let weave = null;
  function fabric(ctx) {
    // a fine cotton weave, much finer and calmer than sand
    if (!weave) {
      weave = document.createElement('canvas');
      weave.width = weave.height = 8;
      const w = weave.getContext('2d');
      w.fillStyle = '#808080';
      w.fillRect(0, 0, 8, 8);
      w.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 8; i += 2) { w.fillRect(i, 0, 1, 8); }
      w.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 1; i < 8; i += 2) { w.fillRect(0, i, 8, 1); }
    }
    ctx.save();
    bedShape(ctx);
    ctx.clip();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(weave, 'repeat');
    ctx.fillRect(-20, 600, W + 40, 420);
    ctx.restore();
  }

  // the top of the bed (duvet and all), plus a little of it hanging over the sides
  function bedShape(ctx, over = 0) {
    ctx.beginPath();
    ctx.moveTo(bedL(HEAD_Y) - over * 0.2, HEAD_Y);
    ctx.lineTo(bedR(HEAD_Y) + over * 0.2, HEAD_Y);
    ctx.lineTo(bedR(1010) + over, 1010);
    ctx.lineTo(bedL(1010) - over, 1010);
    ctx.closePath();
  }

  function duvetShape(ctx) {
    ctx.beginPath();
    ctx.moveTo(bedL(FOLD(bedL(770))) - 4, FOLD(bedL(770)));
    for (let x = bedL(770); x <= bedR(770); x += 20) ctx.lineTo(x, FOLD(x));
    ctx.lineTo(bedR(1010) + 50, 1010);
    ctx.lineTo(bedL(1010) - 50, 1010);
    ctx.closePath();
  }

  function paintFloor(ctx) {
    // old wooden boards, running away from you
    ctx.fillStyle = lin(ctx, 0, FLOOR_Y, 0, H, [[0, '#2a1b12'], [1, '#3b2618']]);
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, FLOOR_Y, W, H - FLOOR_Y);
    ctx.clip();
    for (let i = -30; i <= 40; i++) {
      const x0 = 872 + i * 30;
      const x1 = 872 + i * 30 * ((H - 470) / (FLOOR_Y - 470));
      ctx.strokeStyle = 'rgba(10, 5, 2, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x0, FLOOR_Y);
      ctx.lineTo(x1, H);
      ctx.stroke();
    }
    ctx.restore();
    grain(ctx, 0.12, () => { ctx.beginPath(); ctx.rect(0, FLOOR_Y, W, H - FLOOR_Y); });
    // skirting board
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(0, FLOOR_Y - 14, W, 14);
    ctx.fillStyle = 'rgba(255, 220, 170, 0.08)';
    ctx.fillRect(0, FLOOR_Y - 14, W, 2);
    // a crate of records by the shelf
    ctx.fillStyle = '#4a3322';
    ctx.fillRect(1400, 800, 150, 96);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let yy = 818; yy < 896; yy += 20) ctx.fillRect(1400, yy, 150, 3);
    ['#2b2230', '#c2415f', '#5a78c8', '#f0b43a', '#3f8f86'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(1410 + i * 27, 766 + (i % 2) * 5, 24, 40);
    });
  }

  /* ==========================================================
     THE ALBEDO
     ========================================================== */
  function paintRoom(ctx, covers) {
    rnd = mulberry(7);
    makeFolds();

    // the wall: dark, warm, a little lighter around the window
    ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#2a1d15'], [0.5, '#3b2a1f'], [1, '#2c1f16']]);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rad(ctx, 870, 460, 60, 760, [[0, 'rgba(160, 110, 60, 0.45)'], [0.5, 'rgba(110, 72, 40, 0.18)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, W, H);
    grain(ctx, 0.12);

    // a sloped ceiling up on the right, a line where it meets the wall
    fillPoly(ctx, [[1060, -10], [1610, -10], [1610, 330], [1360, 150]], lin(ctx, 1100, 0, 1500, 300, [[0, '#1c130d'], [1, '#2a1d15']]));
    ctx.strokeStyle = 'rgba(12, 8, 5, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(1060, -10);
    ctx.lineTo(1360, 150);
    ctx.lineTo(1610, 330);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10, 6, 4, 0.5)';
    ctx.fillRect(0, 0, W, 34);

    paintFloor(ctx);
    paintWindow(ctx);
    paintPhotoWall(ctx, covers);
    paintNightstand(ctx);
    paintNote(ctx);
    paintShelf(ctx);
    paintGuitar(ctx);
    paintBed(ctx);
  }

  function branch(ctx, x, y, len, ang, width, depth) {
    if (depth <= 0 || len < 3) return;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + x2) / 2 + R(-4, 4), (y + y2) / 2 + R(-4, 4), x2, y2);
    ctx.stroke();
    const n = depth > 3 ? 2 : 3;
    for (let i = 0; i < n; i++) branch(ctx, x2, y2, len * R(0.62, 0.8), ang + R(-0.7, 0.7), width * 0.68, depth - 1);
  }

  function trunk(ctx) {
    ctx.beginPath();
    ctx.moveTo(WIN.x + 10, WIN.y + WIN.h + 20);
    ctx.quadraticCurveTo(WIN.x + 30, WIN.y + 300, WIN.x - 10, WIN.y + 120);
    ctx.stroke();
  }

  function paintWindow(ctx) {
    const { x, y, w, h } = WIN;
    fillPoly(ctx, [[x - 22, y - 22], [x + w + 22, y - 22], [x + w + 22, y + h + 18], [x - 22, y + h + 18]], '#241810');
    // outside: pale winter sky, the sun going down, fields and a treeline
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = lin(ctx, 0, y, 0, y + h, [[0, '#8fb2de'], [0.3, '#b9cde6'], [0.55, '#f4d8a2'], [0.72, '#ffac50'], [0.76, '#f08a34'], [0.8, '#7a4a22'], [1, '#3a2412']]);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = rad(ctx, SUN[0], SUN[1], 0, 220, [[0, 'rgba(255, 236, 190, 0.9)'], [0.3, 'rgba(255, 190, 110, 0.5)'], [1, 'rgba(255, 170, 90, 0)']]);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(70, 42, 24, 0.85)';
    ctx.beginPath();
    ctx.moveTo(x, HORIZON + 6);
    for (let i = 0; i <= 30; i++) ctx.lineTo(x + (i / 30) * w, HORIZON - R(0, 16) + (i % 3) * 2);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(120, 72, 36, 0.6)';
    ctx.fillRect(x, HORIZON + 30, w, 3);
    // a big tree just outside, bare, its branches across the sky
    ctx.strokeStyle = 'rgba(38, 26, 20, 0.95)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 26;
    trunk(ctx);
    rnd = mulberry(12);
    ctx.strokeStyle = 'rgba(46, 34, 30, 0.8)';
    branch(ctx, x + 18, y + 250, 90, -1.0, 9, 6);
    branch(ctx, x + 6, y + 170, 80, -0.5, 7, 6);
    branch(ctx, x + w + 40, y + 190, 110, -2.4, 10, 6);
    branch(ctx, x + w + 30, y + 330, 90, -2.9, 7, 5);
    ctx.strokeStyle = 'rgba(60, 44, 40, 0.5)';
    branch(ctx, x + w * 0.6, y + h * 0.62, 70, -1.7, 4, 5);
    ctx.restore();
    rnd = mulberry(21);

    // mullions and frame, in shadow since the light is behind them
    ctx.fillStyle = '#4a3526';
    ctx.fillRect(x - 12, y - 12, w + 24, 14);
    ctx.fillRect(x - 12, y + h - 4, w + 24, 16);
    ctx.fillRect(x - 12, y - 12, 14, h + 24);
    ctx.fillRect(x + w - 4, y - 12, 16, h + 24);
    ctx.fillRect(x, y + TRANSOM, w, 12);
    const cw = w / COLS;
    for (let c = 1; c < COLS; c++) ctx.fillRect(x + c * cw - 3.5, y, 7, h);
    const rh = (h - TRANSOM - 12) / ROWS;
    for (let r = 1; r < ROWS; r++) ctx.fillRect(x, y + TRANSOM + 12 + r * rh - 3.5, w, 7);
    ctx.fillStyle = 'rgba(255, 240, 210, 0.08)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(R(x, x + w), R(y + h * 0.5, y + h), R(1, 3), 0, 7); ctx.fill(); }
    // the sill, and a jar on it
    fillPoly(ctx, [[x - 30, y + h + 8], [x + w + 30, y + h + 8], [x + w + 40, y + h + 24], [x - 40, y + h + 24]], '#5a4130');
    ctx.fillStyle = 'rgba(200, 190, 170, 0.35)';
    roundRect(ctx, x + w - 60, y + h - 36, 26, 44, 7);
    ctx.fill();
    ctx.fillStyle = '#6b4c2e';
    ctx.fillRect(x + w - 58, y + h - 42, 22, 7);

    // sheer curtains hanging either side, the rod above
    [[x - 64, 1], [x + w + 14, -1]].forEach(([cx, dir]) => {
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = lin(ctx, cx + k * 10, 0, cx + k * 10 + 14, 0, [[0, 'rgba(90, 64, 44, 0)'], [0.5, `rgba(${120 + k * 6}, ${84 + k * 4}, 58, 0.5)`], [1, 'rgba(90, 64, 44, 0)']]);
        ctx.beginPath();
        ctx.moveTo(cx + k * 10, y - 50);
        ctx.bezierCurveTo(cx + k * 10 + 8 * dir, y + 200, cx + k * 10 - 6 * dir, y + 400, cx + k * 10 + 4, y + h + 60);
        ctx.lineTo(cx + k * 10 + 16, y + h + 60);
        ctx.bezierCurveTo(cx + k * 10 + 10, y + 400, cx + k * 10 + 22, y + 200, cx + k * 10 + 14, y - 50);
        ctx.fill();
      }
    });
    ctx.strokeStyle = '#1e140d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 90, y - 50);
    ctx.lineTo(x + w + 90, y - 50);
    ctx.stroke();
  }

  function paintPhotoWall(ctx, covers) {
    // framed pictures of friends, up high
    [[96, 220, 110, 150], [224, 238, 128, 96], [230, 350, 60, 50]].forEach(([fx, fy, fw, fh], i) => {
      soft(ctx, 12, 'rgba(0,0,0,0.6)', () => ctx.fillRect(fx + 4, fy + 6, fw, fh));
      ctx.fillStyle = '#1c130d';
      ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = '#6d5a48';
      ctx.fillRect(fx + 8, fy + 8, fw - 16, fh - 16);
      const img = covers[(i + 3) % covers.length];
      if (img) { ctx.globalAlpha = 0.75; ctx.drawImage(img, fx + 12, fy + 12, fw - 24, fh - 24); ctx.globalAlpha = 1; }
      ctx.fillStyle = 'rgba(30, 18, 10, 0.35)';
      ctx.fillRect(fx + 8, fy + 8, fw - 16, fh - 16);
    });
    // a wall of little photos, stuck up in a loose grid
    let k = 0;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 11; col++) {
        if (rnd() < 0.22) continue;
        const px = 116 + col * 41 + R(-3, 3);
        const py = 438 + row * 36 + R(-3, 3);
        const s = R(22, 28);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(R(-0.06, 0.06));
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(2, 3, s, s);
        ctx.fillStyle = '#8a7462';
        ctx.fillRect(0, 0, s, s);
        const img = covers[k % covers.length];
        if (img && rnd() < 0.7) { ctx.globalAlpha = 0.8; ctx.drawImage(img, 2, 2, s - 4, s - 4); ctx.globalAlpha = 1; }
        else { ctx.fillStyle = ['#5a4a58', '#4a5a66', '#6b4a3a', '#56604a'][k % 4]; ctx.fillRect(2, 2, s - 4, s - 4); }
        ctx.fillStyle = 'rgba(30, 18, 10, 0.3)';
        ctx.fillRect(0, 0, s, s);
        ctx.restore();
        k++;
      }
    }
    // fairy lights over them
    ctx.strokeStyle = 'rgba(20, 14, 10, 0.8)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(90, 414);
    ctx.bezierCurveTo(220, 470, 360, 450, 420, 420);
    ctx.bezierCurveTo(480, 452, 540, 460, 590, 410);
    ctx.stroke();
    lightBulbs().forEach(([bx, by]) => {
      ctx.fillStyle = '#b8a888';
      ctx.beginPath();
      ctx.ellipse(bx, by + 4, 3, 4.5, 0, 0, 7);
      ctx.fill();
    });
  }

  function lightBulbs() {
    const pts = [];
    const bez = (p0, p1, p2, p3, t) => {
      const u = 1 - t;
      return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
    };
    for (let i = 1; i < 10; i++) pts.push(bez([90, 414], [220, 470], [360, 450], [420, 420], i / 10));
    for (let i = 1; i < 7; i++) pts.push(bez([420, 420], [480, 452], [540, 460], [590, 410], i / 7));
    return pts;
  }

  function paintNightstand(ctx) {
    fillPoly(ctx, [[562, 600], [698, 600], [704, 616], [556, 616]], '#4a3322');
    ctx.fillStyle = '#34241a';
    ctx.fillRect(566, 616, 130, 110);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(574, 628, 114, 40);
    // lamp
    ctx.fillStyle = '#2a1e16';
    ctx.beginPath();
    ctx.ellipse(630, 600, 22, 5, 0, 0, 7);
    ctx.fill();
    ctx.fillRect(627, 530, 6, 70);
    path(ctx, [[606, 484], [654, 484], [672, 536], [588, 536]]);
    ctx.fillStyle = lin(ctx, 588, 0, 672, 0, [[0, '#6e5438'], [0.5, '#8d6d48'], [1, '#5e4630']]);
    ctx.fill();
    // the letter, sealed
    ctx.save();
    ctx.translate(648, 606);
    ctx.rotate(0.06);
    fillPoly(ctx, [[-34, -8], [30, -10], [36, 4], [-30, 6]], '#b7a78e');
    ctx.fillStyle = '#7d1f2c';
    ctx.beginPath();
    ctx.arc(0, -2, 4.5, 0, 7);
    ctx.fill();
    ctx.restore();
  }

  function paintNote(ctx) {
    ctx.save();
    ctx.translate(1088, 342);
    ctx.rotate(0.06);
    soft(ctx, 10, 'rgba(0,0,0,0.6)', () => ctx.fillRect(-42, -34, 88, 74));
    ctx.fillStyle = '#b3a38a';
    ctx.fillRect(-44, -38, 88, 74);
    ctx.fillStyle = 'rgba(200, 160, 110, 0.7)';
    ctx.fillRect(-14, -44, 30, 12);
    ctx.fillStyle = '#2e2226';
    ctx.font = '600 20px Caveat, cursive';
    ctx.textAlign = 'center';
    ctx.fillText("hi, it's renn", 0, -4);
    ctx.font = '600 14px Caveat, cursive';
    ctx.fillText('(come in)', 2, 18);
    ctx.restore();
  }

  function paintShelf(ctx) {
    const x0 = 1190;
    const x1 = 1510;
    ctx.fillStyle = '#2b1d14';
    ctx.fillRect(x0, 250, x1 - x0, 540);
    ctx.fillStyle = '#1a110b';
    ctx.fillRect(x0 + 12, 262, x1 - x0 - 24, 520);
    const shelves = [262, 360, 458, 548, 648, 780];
    ctx.fillStyle = '#3a281b';
    shelves.forEach((sy) => ctx.fillRect(x0, sy - 10, x1 - x0, 12));
    // books
    [[262, 360], [360, 458], [548, 648]].forEach(([top, bot]) => {
      let bx = x0 + 16;
      while (bx < x1 - 30) {
        const bw = R(10, 22);
        const bh = R(56, bot - top - 16);
        if (rnd() < 0.08) { bx += R(14, 30); continue; }
        const tone = ['#4b3a2e', '#5a3e34', '#3e4038', '#624a36', '#3b3440', '#6a5840'][Math.floor(rnd() * 6)];
        ctx.save();
        ctx.translate(bx, bot - 12);
        ctx.rotate(rnd() < 0.1 ? R(-0.12, 0.12) : 0);
        ctx.fillStyle = tone;
        ctx.fillRect(0, -bh, bw, bh);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(bw - 2, -bh, 2, bh);
        ctx.fillStyle = 'rgba(210, 180, 130, 0.25)';
        ctx.fillRect(2, -bh + 10, bw - 4, 2);
        ctx.restore();
        bx += bw + 1;
      }
    });
    // the tape shelf: cassette spines in the songs' colours
    let tx = x0 + 18;
    (Void.favorites || []).slice(0, 40).forEach((s) => {
      if (tx > x1 - 26) return;
      ctx.fillStyle = s.palette?.[3] || '#777';
      ctx.fillRect(tx, 482, 8, 58);
      ctx.fillStyle = 'rgba(240, 225, 200, 0.55)';
      ctx.fillRect(tx + 2, 490, 4, 40);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(tx, 482, 8, 58);
      tx += 9.5;
    });
    // bottom shelf: records and a box
    ctx.fillStyle = '#1e1612';
    for (let i = 0; i < 12; i++) ctx.fillRect(x0 + 20 + i * 7, 668, 5, 104);
    ctx.fillStyle = '#4d3a2a';
    ctx.fillRect(x0 + 140, 700, 130, 72);
    // a plant on top, trailing down
    ctx.fillStyle = '#4a2e20';
    ctx.fillRect(1250, 212, 44, 38);
    ctx.strokeStyle = 'rgba(52, 64, 40, 0.9)';
    ctx.lineWidth = 2;
    for (let v = 0; v < 6; v++) {
      const ex = 1230 + v * 16;
      ctx.beginPath();
      ctx.moveTo(1270, 222);
      ctx.bezierCurveTo(ex - 20, 260, ex + 10, 300, ex, 330 + v * 22);
      ctx.stroke();
      for (let l = 0; l < 6; l++) {
        ctx.fillStyle = 'rgba(64, 80, 46, 0.9)';
        ctx.beginPath();
        ctx.ellipse(ex - 6 + R(-6, 6), 250 + l * (12 + v * 3), 6, 3.5, R(0, 3), 0, 7);
        ctx.fill();
      }
    }
  }

  function guitarOutline(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, -238);
    ctx.bezierCurveTo(28, -238, 46, -222, 46, -196);
    ctx.bezierCurveTo(46, -172, 32, -160, 34, -144);
    ctx.bezierCurveTo(36, -126, 62, -112, 62, -76);
    ctx.bezierCurveTo(62, -30, 34, -6, 0, -6);
    ctx.bezierCurveTo(-34, -6, -62, -30, -62, -76);
    ctx.bezierCurveTo(-62, -112, -36, -126, -34, -144);
    ctx.bezierCurveTo(-32, -160, -46, -172, -46, -196);
    ctx.bezierCurveTo(-46, -222, -28, -238, 0, -238);
    ctx.closePath();
  }

  function guitarPlace(ctx) {
    ctx.translate(1300, 760);
    ctx.rotate(-0.11);
    ctx.scale(0.64, 0.64);
  }

  function paintGuitar(ctx) {
    ctx.save();
    guitarPlace(ctx);
    soft(ctx, 18, 'rgba(0,0,0,0.6)', () => { ctx.save(); ctx.translate(18, -6); guitarOutline(ctx); ctx.fill(); ctx.fillRect(-8, -420, 16, 190); ctx.restore(); });
    guitarOutline(ctx);
    ctx.fillStyle = '#2a160a';
    ctx.fill();
    ctx.save();
    ctx.translate(0, -122);
    ctx.scale(0.94, 0.965);
    ctx.translate(0, 122);
    guitarOutline(ctx);
    ctx.fillStyle = rad(ctx, -24, -130, 8, 160, [[0, '#9a6a3c'], [0.6, '#6e4424'], [1, '#3e2210']]);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#1a0e06';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -140, 23, 0, 7);
    ctx.stroke();
    ctx.fillStyle = '#0e0703';
    ctx.beginPath();
    ctx.arc(0, -140, 18, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#1a0e06';
    roundRect(ctx, -24, -66, 48, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#23130a';
    ctx.fillRect(-9, -414, 18, 178);
    ctx.fillStyle = 'rgba(200, 180, 140, 0.4)';
    for (let f = 0; f < 12; f++) ctx.fillRect(-9, -250 - f * 13.5, 18, 1.2);
    fillPoly(ctx, [[-12, -414], [12, -414], [14, -468], [-14, -468]], '#160b05');
    ctx.strokeStyle = 'rgba(230, 210, 170, 0.55)';
    for (let s = 0; s < 6; s++) {
      ctx.lineWidth = 0.5 + (5 - s) * 0.1;
      ctx.beginPath();
      ctx.moveTo(-6 + s * 2.4, -412);
      ctx.lineTo(-8 + s * 3.2, -62);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintBed(ctx) {
    // a shadow on the floor and the wall where the bed meets them
    soft(ctx, 26, 'rgba(0, 0, 0, 0.7)', () => { bedShape(ctx, 70); ctx.fill(); });
    // the duvet hanging down over both sides, in shadow
    ctx.fillStyle = lin(ctx, 0, HEAD_Y, 0, H, [[0, '#2e2a28'], [1, '#1c1816']]);
    bedShape(ctx, 58);
    ctx.fill();
    // the mattress top: the fitted sheet at the head
    ctx.fillStyle = lin(ctx, 0, HEAD_Y, 0, 800, [[0, '#8f8880'], [1, '#a59d93']]);
    bedShape(ctx);
    ctx.fill();

    // pillows against the wall, under the window
    [[818, 716, 100, 30, -0.03], [1032, 713, 108, 32, 0.04]].forEach(([px, py, pw, ph, rot]) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      soft(ctx, 10, 'rgba(0, 0, 0, 0.55)', () => { roundRect(ctx, -pw + 6, -ph + 12, pw * 2, ph * 2, ph); ctx.fill(); });
      roundRect(ctx, -pw, -ph, pw * 2, ph * 2, ph * 0.95);
      ctx.fillStyle = lin(ctx, 0, -ph, 0, ph, [[0, '#d4cdc3'], [0.55, '#b8b0a6'], [1, '#8a837b']]);
      ctx.fill();
      // the dip where a head was
      ctx.fillStyle = 'rgba(70, 64, 60, 0.28)';
      ctx.beginPath();
      ctx.ellipse(8, 2, pw * 0.45, ph * 0.4, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60, 54, 50, 0.35)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, -pw + 5, -ph + 5, pw * 2 - 10, ph * 2 - 10, ph * 0.8);
      ctx.stroke();
      ctx.restore();
    });

    // the duvet: pulled up to just below the pillows, folded back at the top
    ctx.save();
    bedShape(ctx, 58);
    ctx.clip();
    duvetShape(ctx);
    ctx.fillStyle = lin(ctx, 0, 770, 0, H, [[0, '#8e939a'], [0.5, '#7a7f86'], [1, '#5c6066']]);
    ctx.fill();
    // long soft folds running down towards you
    [[760, 0.25, 34], [930, -0.1, 40], [1080, -0.3, 36], [640, 0.45, 30], [1240, -0.5, 38]].forEach(([x0, lean, w]) => {
      ctx.save();
      duvetShape(ctx);
      ctx.clip();
      const pts = (off) => {
        ctx.beginPath();
        ctx.moveTo(x0 + off, 790);
        ctx.bezierCurveTo(x0 + off + lean * 60, 860, x0 + off + lean * 140, 930, x0 + off + lean * 230, 1010);
      };
      ctx.lineCap = 'round';
      ctx.lineWidth = w;
      ctx.strokeStyle = 'rgba(30, 30, 34, 0.28)';
      pts(w * 0.35);
      ctx.stroke();
      ctx.lineWidth = w * 0.45;
      ctx.strokeStyle = 'rgba(200, 204, 210, 0.2)';
      pts(-w * 0.2);
      ctx.stroke();
      ctx.restore();
    });
    // the folded-back edge: the other side of the cover, a thick soft roll
    ctx.beginPath();
    const l = bedL(770) - 30;
    const r = bedR(770) + 30;
    ctx.moveTo(l, FOLD(l) - 4);
    for (let x = l; x <= r; x += 20) ctx.lineTo(x, FOLD(x) - 4);
    for (let x = r; x >= l; x -= 20) ctx.lineTo(x, FOLD(x) + 24 + Math.sin(x * 0.03) * 3);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 764, 0, 796, [[0, '#cfc8be'], [0.6, '#b3aca3'], [1, '#7d7771']]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 20, 24, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = l; x <= r; x += 20) (x === l ? ctx.moveTo(x, FOLD(x) + 25) : ctx.lineTo(x, FOLD(x) + 25 + Math.sin(x * 0.03) * 3));
    ctx.stroke();
    ctx.restore();
    fabric(ctx);

    // the laptop, open on the bed
    ctx.save();
    ctx.translate(800, 900);
    ctx.rotate(-0.08);
    ctx.scale(0.85, 0.85);
    soft(ctx, 10, 'rgba(0,0,0,0.6)', () => { fillPoly(ctx, [[-100, 6], [100, 6], [114, 30], [-114, 30]], '#000'); });
    fillPoly(ctx, [[-96, 0], [96, 0], [110, 22], [-110, 22]], '#6a6c72');
    fillPoly(ctx, [[-88, -108], [88, -108], [96, 0], [-96, 0]], '#55575e');
    fillPoly(ctx, [[-80, -100], [80, -100], [87, -8], [-87, -8]], '#141a26');
    ctx.fillStyle = 'rgba(150, 180, 230, 0.2)';
    for (let i = 0; i < 5; i++) ctx.fillRect(-66, -86 + i * 14, 50 + (i * 23) % 70, 4);
    ctx.restore();

    // tarot cards spilled on the duvet
    ctx.save();
    ctx.translate(1120, 850);
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i - 2) * 0.24);
      ctx.transform(1, 0, -0.3, 0.5, 0, 0);
      ctx.fillStyle = '#26143a';
      ctx.fillRect(-18, -64, 36, 60);
      ctx.strokeStyle = '#a88f5a';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-14, -60, 28, 52);
      ctx.fillStyle = '#a88f5a';
      ctx.beginPath();
      ctx.arc(0, -34, 6, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // headphones
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(640, 830, 38, 22, 0.25, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = '#141216';
    ctx.beginPath(); ctx.ellipse(606, 840, 11, 15, 0.25, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(678, 850, 11, 15, 0.25, 0, 7); ctx.fill();
  }

  /* ==========================================================
     THE LIGHT
     ========================================================== */
  function paintSun(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // R — the low sun throws the window across the bed, stretched towards you:
    // three long panes with the shadows of the bars between them
    ctx.save();
    bedShape(ctx, 58);
    ctx.clip();
    const cols = [[748, 830, 590, 790], [842, 922, 810, 1000], [934, 1000, 1020, 1190]];
    const bands = [[700, 742], [756, 812], [826, 902], [918, 1010]];
    cols.forEach(([t0, t1, b0, b1]) => {
      bands.forEach(([y0, y1]) => {
        const at = (y, a, b) => a + (b - a) * ((y - HEAD_Y) / (1010 - HEAD_Y));
        const q = [[at(y0, t0, b0), y0], [at(y0, t1, b1), y0], [at(y1, t1, b1), y1], [at(y1, t0, b0), y1]];
        soft(ctx, 7, 'rgba(255,0,0,0.85)', () => { path(ctx, q); ctx.fill(); });
      });
    });
    // the tops of the pillows and the rolled edge catch it hardest
    soft(ctx, 8, 'rgba(255,0,0,0.9)', () => { ctx.beginPath(); ctx.ellipse(818, 692, 90, 7, 0, 0, 7); ctx.ellipse(1032, 688, 96, 7, 0, 0, 7); ctx.fill(); });
    soft(ctx, 6, 'rgba(255,0,0,0.7)', () => { ctx.fillRect(700, 766, 420, 6); });
    ctx.restore();
    // and the floor beside the bed
    soft(ctx, 22, 'rgba(255,0,0,0.35)', () => { path(ctx, [[560, 700], [680, 700], [520, 1000], [300, 1000]]); ctx.fill(); });

    // rim light: the sill, the guitar's edge, the side of the shelf
    soft(ctx, 6, 'rgba(255,0,0,0.9)', () => { ctx.fillRect(WIN.x - 30, WIN.y + WIN.h + 6, WIN.w + 60, 5); });
    ctx.save();
    guitarPlace(ctx);
    ctx.lineWidth = 3;
    soft(ctx, 5, 'rgba(255,0,0,0.85)', () => {
      ctx.beginPath();
      ctx.moveTo(-40, -200);
      ctx.bezierCurveTo(-46, -180, -34, -160, -34, -144);
      ctx.bezierCurveTo(-36, -126, -62, -112, -62, -76);
      ctx.bezierCurveTo(-62, -50, -52, -30, -40, -20);
      ctx.stroke();
    });
    ctx.restore();
    soft(ctx, 6, 'rgba(255,0,0,0.35)', () => ctx.fillRect(1190, 250, 5, 400));
    soft(ctx, 10, 'rgba(255,0,0,0.25)', () => ctx.fillRect(0, FLOOR_Y - 14, W, 3));
    // the curtains glow where the sun comes through them
    soft(ctx, 26, 'rgba(255,0,0,0.5)', () => { ctx.fillRect(WIN.x - 60, WIN.y + 120, 40, 340); ctx.fillRect(WIN.x + WIN.w + 20, WIN.y + 120, 40, 340); });
    // a patch of light thrown onto the photos on the left
    soft(ctx, 30, 'rgba(255,0,0,0.55)', () => { path(ctx, [[330, 470], [470, 440], [500, 600], [352, 632]]); ctx.fill(); });
    soft(ctx, 12, 'rgba(255,0,0,0.5)', () => { ctx.fillRect(592, 596, 110, 6); });

    // G — the air near the window, and rays opening out from the sun
    soft(ctx, 90, 'rgba(0,255,0,0.32)', () => { ctx.beginPath(); ctx.ellipse(SUN[0], SUN[1] - 40, 230, 260, 0, 0, 7); ctx.fill(); });
    const rays = [[-2.6, 0.08], [-2.2, 0.05], [-1.9, 0.06], [-1.25, 0.05], [-0.9, 0.07], [-0.45, 0.05], [0.3, 0.07], [0.9, 0.06], [1.5, 0.05], [2.4, 0.07], [2.9, 0.05]];
    rays.forEach(([ang, spread], i) => {
      ctx.save();
      ctx.globalAlpha = 0.06 + (i % 3) * 0.025;
      soft(ctx, 20, 'rgba(0,255,0,1)', () => {
        ctx.beginPath();
        ctx.moveTo(SUN[0], SUN[1]);
        ctx.lineTo(SUN[0] + Math.cos(ang - spread) * 900, SUN[1] + Math.sin(ang - spread) * 900);
        ctx.lineTo(SUN[0] + Math.cos(ang + spread) * 900, SUN[1] + Math.sin(ang + spread) * 900);
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();
    });

    // B — where branch shadows sway through the light
    soft(ctx, 40, 'rgba(0,0,255,1)', () => { ctx.beginPath(); ctx.ellipse(880, 860, 360, 170, 0, 0, 7); ctx.fill(); });
    soft(ctx, 30, 'rgba(0,0,255,1)', () => { path(ctx, [[330, 470], [470, 440], [500, 600], [352, 632]]); ctx.fill(); });
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintEmit(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // R: the lamp's shade, and the pool of light it throws
    soft(ctx, 5, 'rgba(255,0,0,1)', () => { path(ctx, [[606, 484], [654, 484], [672, 536], [588, 536]]); ctx.fill(); });
    soft(ctx, 70, 'rgba(255,0,0,0.6)', () => { ctx.beginPath(); ctx.ellipse(630, 600, 170, 80, 0, 0, 7); ctx.fill(); });
    soft(ctx, 100, 'rgba(255,0,0,0.35)', () => { ctx.beginPath(); ctx.ellipse(630, 470, 190, 150, 0, 0, 7); ctx.fill(); });
    // G: the laptop screen, and its blue on the duvet
    ctx.save();
    ctx.translate(800, 900);
    ctx.rotate(-0.08);
    ctx.scale(0.85, 0.85);
    soft(ctx, 3, 'rgba(0,255,0,1)', () => { path(ctx, [[-80, -100], [80, -100], [87, -8], [-87, -8]]); ctx.fill(); });
    soft(ctx, 70, 'rgba(0,255,0,0.45)', () => { ctx.beginPath(); ctx.ellipse(0, -30, 190, 110, 0, 0, 7); ctx.fill(); });
    ctx.restore();
    // B: fairy lights
    lightBulbs().forEach(([bx, by]) => soft(ctx, 6, 'rgba(0,0,255,1)', () => { ctx.beginPath(); ctx.arc(bx, by + 4, 5, 0, 7); ctx.fill(); }));
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintGlass(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    panes().forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
    // the tree trunk just outside isn't sky
    ctx.save();
    ctx.beginPath();
    ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h);
    ctx.clip();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 26;
    trunk(ctx);
    ctx.restore();
  }

  function paintForeground(ctx) {
    // kept empty: the room is seen clearly, nothing smudged in front of it
    ctx.clearRect(0, 0, W, H);
  }

  /* ==========================================================
     PUBLIC
     ========================================================== */
  async function paint({ scale = 1.5 } = {}) {
    S = scale;
    try { await Promise.all([document.fonts.load('600 20px Caveat'), document.fonts.load('italic 300 30px Fraunces')]); } catch { /* fine */ }
    const coverNames = ['veil', 'deep-love', 'memory', 'anthems', 'march-5', 'sun-and-moon', 'treehouse', 'milk', 'county', 'harvest', 'boy', 'odoriko', 'time', 'september'];
    const covers = (await Promise.all(coverNames.map((n) => loadImg(`assets/covers/${n}.jpg`)))).filter(Boolean);

    const albedo = layer(1);
    paintRoom(albedo.ctx, covers);

    // a blurred copy, for depth of field
    const blur = layer(0.14);
    blur.ctx.setTransform(1, 0, 0, 1, 0, 0);
    const mid = document.createElement('canvas');
    mid.width = Math.round(albedo.c.width * 0.35);
    mid.height = Math.round(albedo.c.height * 0.35);
    const mctx = mid.getContext('2d');
    mctx.imageSmoothingQuality = 'high';
    mctx.drawImage(albedo.c, 0, 0, mid.width, mid.height);
    blur.ctx.imageSmoothingQuality = 'high';
    blur.ctx.drawImage(mid, 0, 0, blur.c.width, blur.c.height);

    const sun = layer(0.5);
    paintSun(sun.ctx);
    const emit = layer(0.5);
    paintEmit(emit.ctx);
    const glass = layer(0.5);
    paintGlass(glass.ctx);
    const fg = layer(0.5);
    paintForeground(fg.ctx);

    return {
      W, H,
      albedo: albedo.c,
      blur: blur.c,
      sun: sun.c,
      emit: emit.c,
      glass: glass.c,
      fg: fg.c,
      hotspots: HOTSPOTS,
      sunAt: SUN,
      windowRect: WIN
    };
  }

  Void.dream = Void.dream || {};
  Void.dream.memoryPaint = { paint, HOTSPOTS, W, H };
})();
