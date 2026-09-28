/* ==========================================================
   memory/paint.js — renn's room, painted in code
   Late in the day, facing the window: the sun is low behind bare
   winter trees, the room is dark and warm, and the only real
   light comes straight through the glass.

   The room is built in 3D and projected through one camera, so
   everything shares one vanishing point:

     P(X, Y, z)   X, Y: position measured on the back wall (board
                  units, Y grows downwards); z: how far out from the
                  back wall, as a fraction of the way to the camera
                  (0 = on the back wall, 1 = at the camera)

   Eye level (the horizon) is at VP[1]; everything below it shows
   its top, everything above it its underside. The sunlight is
   traced the same way: each pane of the window is pushed along the
   light's direction until it lands on the bed, its foot, or the
   floor.

   Layers handed to the engine:
   albedo   the room in dim, even light
   sun      R: where the sun lands · G: light in the air ·
            B: where branch shadows can drift through it
   emit     R: the lamp · G: the laptop screen · B: fairy lights
   glass    white where you see out of the window
   fg       (empty) anything right in front of the camera
   guides   perspective guides (vanishing point, horizon, the
            lines everything is built on) — the camera panel shows them
   ========================================================== */
(() => {
  const Void = window.Void;
  const W = 1600;
  const H = 1000;

  /* ---------- the camera ---------- */
  const VP = [870, 460];                     // vanishing point = eye level
  const P = (X, Y, z) => [VP[0] + (X - VP[0]) / (1 - z), VP[1] + (Y - VP[1]) / (1 - z)];
  const DEPTH = 1000;                        // the camera is 1000 wall-units from the back wall
  const NEAR = 0.7;                          // walls are drawn out to here (past the edges of the picture)

  /* ---------- the room (in wall units) ---------- */
  const ROOM = { l: 380, r: 1300, ceil: 120, floor: 640 };
  const WIN = { l: 700, r: 960, t: 180, b: 505, inset: -0.04, transom: 60 };
  const BED = { l: 700, r: 1050, top: 530, mat: 548, base: 640, head: 0.0, foot: 0.385, fold: 0.1 };
  const LIGHT = { dx: 60, dy: 300 };         // how far the sunlight moves per unit of z (it comes down, towards you)
  const SUN = [846, 446];                    // on screen: just above the horizon, inside the window

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
        const v = 128 + (r() - 0.5) * 70 + (r() - 0.5) * 40;
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

  /* ---------- 3D shapes ---------- */
  const quad = (pts3) => pts3.map((p) => P(...p));

  // the faces of a box you can actually see from the camera, farthest first
  function boxFaces(x0, x1, y0, y1, z0, z1) {
    const f = [];
    if (y0 > VP[1]) f.push(['top', quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]])]);
    if (y1 < VP[1]) f.push(['bottom', quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]])]);
    if (VP[0] < x0) f.push(['left', quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]])]);
    if (VP[0] > x1) f.push(['right', quad([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]])]);
    f.push(['front', quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])]);
    return f;
  }

  function box(ctx, x0, x1, y0, y1, z0, z1, colors) {
    boxFaces(x0, x1, y0, y1, z0, z1).forEach(([name, pts]) => {
      if (!colors[name]) return;
      fillPoly(ctx, pts, colors[name]);
    });
  }

  // an image laid onto a (roughly flat) quad: p0 top-left, p1 top-right, p3 bottom-left
  function imageQuad(ctx, img, p0, p1, p3) {
    ctx.save();
    ctx.transform((p1[0] - p0[0]) / img.width, (p1[1] - p0[1]) / img.width, (p3[0] - p0[0]) / img.height, (p3[1] - p0[1]) / img.height, p0[0], p0[1]);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  // a soft darkening along a line where two surfaces meet
  function crease(ctx, a, b, width, alpha) {
    ctx.save();
    ctx.lineWidth = width;
    soft(ctx, width * 1.4, `rgba(0,0,0,${alpha})`, () => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
    ctx.restore();
  }

  /* ---------- the window's panes (wall units, on the back wall) ---------- */
  function panes() {
    const out = [];
    const bar = 7;
    const cw = (WIN.r - WIN.l) / 3;
    for (let c = 0; c < 3; c++) out.push([WIN.l + c * cw + bar / 2, WIN.t + bar / 2, cw - bar, WIN.transom - bar]);
    const top = WIN.t + WIN.transom + 10;
    const rh = (WIN.b - top) / 4;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) out.push([WIN.l + c * cw + bar / 2, top + r * rh + bar / 2, cw - bar, rh - bar]);
    }
    return out;
  }

  // the window on screen (the glass sits a little way into the wall)
  const glassTL = P(WIN.l, WIN.t, WIN.inset);
  const glassBR = P(WIN.r, WIN.b, WIN.inset);
  const GLASS = { x: glassTL[0], y: glassTL[1], w: glassBR[0] - glassTL[0], h: glassBR[1] - glassTL[1] };
  const toGlass = ([x, y, w, h]) => {
    const a = P(x, y, WIN.inset);
    const b = P(x + w, y + h, WIN.inset);
    return [a[0], a[1], b[0] - a[0], b[1] - a[1]];
  };

  /* ---------- sunlight: a point of the window pushed along the light ---------- */
  // where the light through (X, Y) on the window lands on a horizontal plane at height Yp
  const onPlane = (X, Y, Yp) => {
    const z = (Yp - Y) / LIGHT.dy;
    return [X + LIGHT.dx * z, Yp, z];
  };
  // …or on a vertical plane facing the camera at depth zp
  const onFace = (X, Y, zp) => [X + LIGHT.dx * zp, Y + LIGHT.dy * zp, zp];

  /* ---------- things in the room (for the paint, the light and the clicks) ---------- */
  const NIGHT = { l: 500, r: 620, t: 570, z0: 0.0, z1: 0.12 };
  const LAMP = { x: NIGHT.l + 42, z: 0.05 };   // stands on the nightstand, the letter beside it
  const SHELF = { l: 1190, r: ROOM.r, t: 175, z0: 0.06, z1: 0.27 };
  const SHELF_ROWS = [175, 262, 350, 438, 520, 640];
  const CRATE = { l: 1200, r: 1292, t: 585, z0: 0.31, z1: 0.41 };
  const LAPTOP = { l: 718, r: 818, z0: 0.24, z1: 0.32 };   // left of the sun, so it never covers it
  const CARDS = { x: 985, z: 0.3 };
  const GUITAR = { X: 1128, z: 0.31 };        // where it stands on the floor
  const NOTE = { l: 1060, r: 1140, t: 262, b: 328 };
  const PHOTOS = { z0: 0.07, z1: 0.36, t: 272, b: 470 };
  const FRIENDS = [[0.1, 0.17, 150, 250], [0.2, 0.28, 168, 232], [0.3, 0.34, 190, 240]];

  /* ==========================================================
     THE ALBEDO
     ========================================================== */
  function paintRoom(ctx, covers) {
    rnd = mulberry(7);
    paintShell(ctx);
    paintWindow(ctx);
    paintPhotoWall(ctx, covers);
    paintNote(ctx);
    paintShelf(ctx);
    paintRug(ctx);
    paintCrate(ctx);
    paintNightstand(ctx);
    paintBed(ctx);
    paintOnBed(ctx);
    paintGuitar(ctx);
  }

  // walls, ceiling, floor, and the soft dark lines where they meet
  function paintShell(ctx) {
    const { l, r, ceil, floor } = ROOM;
    const back = quad([[l, ceil, 0], [r, ceil, 0], [r, floor, 0], [l, floor, 0]]);
    const left = quad([[l, ceil, 0], [l, ceil, NEAR], [l, floor, NEAR], [l, floor, 0]]);
    const right = quad([[r, ceil, 0], [r, ceil, NEAR], [r, floor, NEAR], [r, floor, 0]]);
    const top = quad([[l, ceil, 0], [r, ceil, 0], [r, ceil, NEAR], [l, ceil, NEAR]]);
    const ground = quad([[l, floor, 0], [r, floor, 0], [r, floor, NEAR], [l, floor, NEAR]]);

    fillPoly(ctx, back, lin(ctx, 0, ceil, 0, floor, [[0, '#2c1f16'], [0.55, '#3e2c20'], [1, '#33251b']]));
    // warm bounce around the window
    ctx.save();
    path(ctx, back);
    ctx.clip();
    ctx.fillStyle = rad(ctx, 830, 380, 40, 520, [[0, 'rgba(170, 118, 66, 0.4)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // the side walls: the left catches a little more light than the right
    fillPoly(ctx, left, lin(ctx, 0, 0, P(l, 0, 0)[0], 0, [[0, '#2a1d15'], [1, '#3a2a1f']]));
    fillPoly(ctx, right, lin(ctx, P(r, 0, 0)[0], 0, W, 0, [[0, '#302219'], [1, '#1f160f']]));
    fillPoly(ctx, top, lin(ctx, 0, 0, 0, ceil, [[0, '#120c08'], [1, '#22170f']]));
    fillPoly(ctx, ground, lin(ctx, 0, floor, 0, H, [[0, '#2c1c12'], [1, '#3e281a']]));
    grain(ctx, 0.1, () => path(ctx, back));
    grain(ctx, 0.1, () => path(ctx, left));
    grain(ctx, 0.1, () => path(ctx, right));

    // floor boards, running straight at you (into the vanishing point)
    ctx.save();
    path(ctx, ground);
    ctx.clip();
    for (let X = l - 1400; X <= r + 1400; X += 34) {
      const a = P(X, floor, 0);
      const b = P(X, floor, NEAR);
      ctx.strokeStyle = 'rgba(10, 5, 2, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      // board ends, staggered
      for (let k = 0; k < 4; k++) {
        const z = ((X * 7 + k * 131) % 97) / 97 * NEAR;
        const e0 = P(X, floor, z);
        const e1 = P(X + 34, floor, z);
        ctx.beginPath();
        ctx.moveTo(e0[0], e0[1]);
        ctx.lineTo(e1[0], e1[1]);
        ctx.stroke();
      }
    }
    ctx.restore();
    grain(ctx, 0.12, () => path(ctx, ground));

    // skirting boards: on the back wall, and running along both side walls
    const skirt = 16;
    fillPoly(ctx, quad([[l, floor - skirt, 0], [r, floor - skirt, 0], [r, floor, 0], [l, floor, 0]]), '#3b2a1e');
    fillPoly(ctx, quad([[l, floor - skirt, 0], [l, floor - skirt, NEAR], [l, floor, NEAR], [l, floor, 0]]), '#35261b');
    fillPoly(ctx, quad([[r, floor - skirt, 0], [r, floor - skirt, NEAR], [r, floor, NEAR], [r, floor, 0]]), '#2c1f16');

    // where the surfaces meet: soft, dark corners
    const c = (a, b, w = 22, al = 0.55) => crease(ctx, P(...a), P(...b), w, al);
    c([l, ceil, 0], [l, floor, 0]);
    c([r, ceil, 0], [r, floor, 0]);
    c([l, ceil, 0], [r, ceil, 0]);
    c([l, floor, 0], [r, floor, 0], 16, 0.45);
    c([l, ceil, 0], [l, ceil, NEAR], 30);
    c([r, ceil, 0], [r, ceil, NEAR], 30);
    c([l, floor, 0], [l, floor, NEAR], 18, 0.4);
    c([r, floor, 0], [r, floor, NEAR], 18, 0.4);
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
    const { x, y, w, h } = GLASS;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + h + 20);
    ctx.quadraticCurveTo(x + 30, y + 280, x - 10, y + 110);
    ctx.stroke();
  }

  function paintWindow(ctx) {
    const { l, r, t, b, inset } = WIN;
    // the recess: the four sides of the hole in the wall, running into it
    const o = [P(l, t, 0), P(r, t, 0), P(r, b, 0), P(l, b, 0)];
    const i = [P(l, t, inset), P(r, t, inset), P(r, b, inset), P(l, b, inset)];
    fillPoly(ctx, [o[0], o[1], i[1], i[0]], '#1c130d');   // top reveal (in shadow)
    fillPoly(ctx, [o[0], i[0], i[3], o[3]], '#3a2a1f');   // left reveal
    fillPoly(ctx, [i[1], o[1], o[2], i[2]], '#35271c');   // right reveal
    fillPoly(ctx, [i[3], i[2], o[2], o[3]], '#4a3627');   // bottom reveal

    // outside: pale winter sky, the sun going down, fields to the horizon (eye level)
    const { x, y, w, h } = GLASS;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const hz = VP[1];
    ctx.fillStyle = lin(ctx, 0, y, 0, y + h, [[0, '#8fb2de'], [0.3, '#b9cde6'], [0.62, '#f4d8a2'], [(hz - y) / h - 0.02, '#ffac50'], [(hz - y) / h, '#f08a34'], [(hz - y) / h + 0.04, '#7a4a22'], [1, '#3a2412']]);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = rad(ctx, SUN[0], SUN[1], 0, 200, [[0, 'rgba(255, 236, 190, 0.9)'], [0.3, 'rgba(255, 190, 110, 0.45)'], [1, 'rgba(255, 170, 90, 0)']]);
    ctx.fillRect(x, y, w, h);
    // the far treeline sits right on the horizon
    ctx.fillStyle = 'rgba(70, 42, 24, 0.9)';
    ctx.beginPath();
    ctx.moveTo(x, hz + 4);
    for (let k = 0; k <= 30; k++) ctx.lineTo(x + (k / 30) * w, hz - R(0, 12) + (k % 3) * 2);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(38, 26, 20, 0.95)';
    ctx.lineWidth = 24;
    trunk(ctx);
    rnd = mulberry(12);
    ctx.strokeStyle = 'rgba(46, 34, 30, 0.8)';
    branch(ctx, x + 18, y + 230, 86, -1.0, 8, 6);
    branch(ctx, x + 6, y + 150, 76, -0.5, 7, 6);
    branch(ctx, x + w + 40, y + 170, 104, -2.4, 9, 6);
    branch(ctx, x + w + 30, y + 300, 86, -2.9, 7, 5);
    ctx.strokeStyle = 'rgba(60, 44, 40, 0.5)';
    branch(ctx, x + w * 0.6, y + h * 0.58, 64, -1.7, 4, 5);
    ctx.restore();
    rnd = mulberry(21);

    // the frame and the bars, in shadow (the light is behind them)
    ctx.fillStyle = '#4a3526';
    const bar = (a, bb) => fillPoly(ctx, a.concat(bb), '#4a3526');
    const cw = (r - l) / 3;
    const top = t + WIN.transom + 10;
    const rh = (b - top) / 4;
    [[l - 8, t - 8, r + 8, t + 4], [l - 8, b - 4, r + 8, b + 8], [l - 8, t - 8, l + 4, b + 8], [r - 4, t - 8, r + 8, b + 8], [l, t + WIN.transom, r, top]]
      .forEach(([x0, y0, x1, y1]) => fillPoly(ctx, quad([[x0, y0, inset], [x1, y0, inset], [x1, y1, inset], [x0, y1, inset]]), '#4a3526'));
    for (let c = 1; c < 3; c++) fillPoly(ctx, quad([[l + c * cw - 3.5, t, inset], [l + c * cw + 3.5, t, inset], [l + c * cw + 3.5, b, inset], [l + c * cw - 3.5, b, inset]]), '#4a3526');
    for (let rr = 1; rr < 4; rr++) fillPoly(ctx, quad([[l, top + rr * rh - 3.5, inset], [r, top + rr * rh - 3.5, inset], [r, top + rr * rh + 3.5, inset], [l, top + rr * rh + 3.5, inset]]), '#4a3526');
    void bar;

    // the sill sticks out towards you: a thin box, its top in view
    box(ctx, l - 26, r + 26, b + 4, b + 16, 0, 0.035, { top: '#6a4d38', front: '#3e2c1f' });
    // a jar on the sill
    const jb = P(r - 34, b + 4, 0.02);
    const jt = P(r - 34, b - 40, 0.02);
    ctx.fillStyle = 'rgba(200, 190, 170, 0.35)';
    roundRect(ctx, jb[0] - 13, jt[1], 26, jb[1] - jt[1], 7);
    ctx.fill();
    ctx.fillStyle = '#6b4c2e';
    ctx.fillRect(jb[0] - 11, jt[1] - 6, 22, 7);

    // sheer curtains, hanging a little way out from the wall
    [[l - 62, l - 8], [r + 8, r + 62]].forEach(([c0, c1]) => {
      for (let k = 0; k < 5; k++) {
        const X0 = c0 + (c1 - c0) * (k / 5);
        const X1 = c0 + (c1 - c0) * ((k + 1) / 5);
        const tl = P(X0, t - 36, 0.02);
        const tr = P(X1, t - 36, 0.02);
        const br = P(X1, 560, 0.02);
        const bl = P(X0, 560, 0.02);
        ctx.fillStyle = lin(ctx, tl[0], 0, tr[0], 0, [[0, 'rgba(90, 64, 44, 0)'], [0.5, `rgba(${118 + k * 6}, ${82 + k * 4}, 58, 0.5)`], [1, 'rgba(90, 64, 44, 0)']]);
        ctx.beginPath();
        ctx.moveTo(tl[0], tl[1]);
        ctx.bezierCurveTo(tl[0] + 6, tl[1] + 150, tl[0] - 4, bl[1] - 120, bl[0], bl[1]);
        ctx.lineTo(br[0], br[1]);
        ctx.bezierCurveTo(tr[0] - 4, br[1] - 120, tr[0] + 6, tr[1] + 150, tr[0], tr[1]);
        ctx.fill();
      }
    });
    const rodA = P(l - 90, t - 38, 0.02);
    const rodB = P(r + 90, t - 38, 0.02);
    ctx.strokeStyle = '#1e140d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(rodA[0], rodA[1]);
    ctx.lineTo(rodB[0], rodB[1]);
    ctx.stroke();
  }

  // the left wall: little photos in a loose grid, framed friends above, fairy lights
  function paintPhotoWall(ctx, covers) {
    const X = ROOM.l;
    FRIENDS.forEach(([z0, z1, y0, y1], i) => {
      const f = quad([[X, y0, z0], [X, y0, z1], [X, y1, z1], [X, y1, z0]]);
      soft(ctx, 10, 'rgba(0,0,0,0.6)', () => { path(ctx, f.map(([a, b]) => [a + 4, b + 6])); ctx.fill(); });
      fillPoly(ctx, f, '#1c130d');
      const zi0 = z0 + (z1 - z0) * 0.12;
      const zi1 = z1 - (z1 - z0) * 0.12;
      const yi0 = y0 + (y1 - y0) * 0.1;
      const yi1 = y1 - (y1 - y0) * 0.1;
      const img = covers[(i + 3) % covers.length];
      if (img) {
        ctx.globalAlpha = 0.8;
        imageQuad(ctx, img, P(X, yi0, zi0), P(X, yi0, zi1), P(X, yi1, zi0));
        ctx.globalAlpha = 1;
      }
    });
    let k = 0;
    const cols = 9;
    const rows = 6;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (rnd() < 0.2) continue;
        const za = PHOTOS.z0 + (PHOTOS.z1 - PHOTOS.z0) * (col / cols) + R(-0.003, 0.003);
        const zb = za + (PHOTOS.z1 - PHOTOS.z0) / cols * 0.7;
        const ya = PHOTOS.t + (PHOTOS.b - PHOTOS.t) * (row / rows) + R(-3, 3);
        const yb = ya + (PHOTOS.b - PHOTOS.t) / rows * 0.72;
        const q = quad([[X, ya, za], [X, ya, zb], [X, yb, zb], [X, yb, za]]);
        fillPoly(ctx, q.map(([a, b]) => [a + 2, b + 3]), 'rgba(0,0,0,0.4)');
        fillPoly(ctx, q, '#8a7462');
        const img = covers[k % covers.length];
        if (img && rnd() < 0.72) {
          ctx.globalAlpha = 0.82;
          const inset = 0.12;
          const z0i = za + (zb - za) * inset;
          const z1i = zb - (zb - za) * inset;
          const y0i = ya + (yb - ya) * inset;
          const y1i = yb - (yb - ya) * inset;
          imageQuad(ctx, img, P(X, y0i, z0i), P(X, y0i, z1i), P(X, y1i, z0i));
          ctx.globalAlpha = 1;
        }
        fillPoly(ctx, q, 'rgba(30, 18, 10, 0.25)');
        k++;
      }
    }
    ctx.strokeStyle = 'rgba(20, 14, 10, 0.8)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    lightString().forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    lightBulbs().forEach(([bx, by]) => {
      ctx.fillStyle = '#b8a888';
      ctx.beginPath();
      ctx.ellipse(bx, by + 4, 3, 4.5, 0, 0, 7);
      ctx.fill();
    });
  }

  // fairy lights sagging along the left wall
  function lightString() {
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const z = 0.03 + (k / 40) * 0.4;
      const sag = Math.sin(((k % 20) / 20) * Math.PI) * 26;
      pts.push(P(ROOM.l, 254 + sag, z));
    }
    return pts;
  }
  const lightBulbs = () => lightString().filter((_, i) => i % 3 === 1);

  function paintNote(ctx) {
    const q = quad([[NOTE.l, NOTE.t, 0], [NOTE.r, NOTE.t, 0], [NOTE.r, NOTE.b, 0], [NOTE.l, NOTE.b, 0]]);
    soft(ctx, 8, 'rgba(0,0,0,0.6)', () => { path(ctx, q.map(([a, b]) => [a + 3, b + 5])); ctx.fill(); });
    ctx.save();
    const cx = (q[0][0] + q[2][0]) / 2;
    const cy = (q[0][1] + q[2][1]) / 2;
    ctx.translate(cx, cy);
    ctx.rotate(0.05);
    ctx.translate(-cx, -cy);
    fillPoly(ctx, q, '#b3a38a');
    ctx.fillStyle = 'rgba(200, 160, 110, 0.7)';
    ctx.fillRect(cx - 14, q[0][1] - 5, 28, 10);
    ctx.fillStyle = '#2e2226';
    ctx.textAlign = 'center';
    ctx.font = '600 17px Caveat, cursive';
    ctx.fillText("hi, it's renn", cx, cy - 2);
    ctx.font = '600 12px Caveat, cursive';
    ctx.fillText('(come in)', cx, cy + 16);
    ctx.restore();
  }

  // a tall bookshelf against the right wall: we see its open side and its near end
  function paintShelf(ctx) {
    const { l, r, t, z0, z1 } = SHELF;
    const floor = ROOM.floor;
    soft(ctx, 20, 'rgba(0,0,0,0.6)', () => { path(ctx, quad([[l - 10, t, z0], [l - 10, t, z1 + 0.02], [l - 10, floor, z1 + 0.02], [l - 10, floor, z0]])); ctx.fill(); });
    // the inside (the back of the shelf is the wall itself)
    fillPoly(ctx, quad([[l, t, z0], [l, t, z1], [l, floor, z1], [l, floor, z0]]), '#140d08');
    // shelves, the books standing on them, spines towards the room
    const song = Void.favorites || [];
    let si = 0;
    for (let row = 0; row < SHELF_ROWS.length - 1; row++) {
      const top = SHELF_ROWS[row] + 12;
      const bot = SHELF_ROWS[row + 1];
      let z = z0 + 0.004;
      const tapes = row === 3;
      while (z < z1 - 0.01) {
        const dz = tapes ? 0.0065 : R(0.006, 0.012);
        const hgt = tapes ? (bot - top) * 0.62 : R((bot - top) * 0.55, (bot - top) * 0.92);
        const q = quad([[l, bot - hgt, z], [l, bot - hgt, z + dz * 0.92], [l, bot, z + dz * 0.92], [l, bot, z]]);
        let col;
        if (tapes) { col = song[si % Math.max(1, song.length)]?.palette?.[3] || '#777'; si++; }
        else col = ['#4b3a2e', '#5a3e34', '#3e4038', '#624a36', '#3b3440', '#6a5840'][Math.floor(rnd() * 6)];
        fillPoly(ctx, q, col);
        if (tapes) {
          const lbl = quad([[l, bot - hgt * 0.85, z + dz * 0.2], [l, bot - hgt * 0.85, z + dz * 0.72], [l, bot - hgt * 0.15, z + dz * 0.72], [l, bot - hgt * 0.15, z + dz * 0.2]]);
          fillPoly(ctx, lbl, 'rgba(240, 225, 200, 0.55)');
        }
        fillPoly(ctx, q, 'rgba(0,0,0,0.28)');
        z += dz;
      }
    }
    // the shelf boards (seen edge-on, running away from you)
    SHELF_ROWS.forEach((y) => fillPoly(ctx, quad([[l, y, z0], [l, y, z1], [l, y + 12, z1], [l, y + 12, z0]]), '#3a281b'));
    // the near end panel, facing you
    box(ctx, l, r, t, floor, z1, z1 + 0.012, { front: '#3a2a1e', left: '#2e2117' });
    // a plant on top, trailing down the side
    const pot = P(l + 60, t - 4, z0 + 0.1);
    ctx.fillStyle = '#4a2e20';
    ctx.fillRect(pot[0] - 20, pot[1] - 34, 40, 34);
    ctx.strokeStyle = 'rgba(52, 64, 40, 0.9)';
    ctx.lineWidth = 2;
    for (let v = 0; v < 6; v++) {
      const end = P(l, t + 60 + v * 26, z0 + 0.03 + v * 0.03);
      ctx.beginPath();
      ctx.moveTo(pot[0], pot[1] - 20);
      ctx.quadraticCurveTo(pot[0] - 40, pot[1] + 10, end[0], end[1]);
      ctx.stroke();
      for (let lf = 0; lf < 5; lf++) {
        const k2 = lf / 5;
        ctx.fillStyle = 'rgba(64, 80, 46, 0.9)';
        ctx.beginPath();
        ctx.ellipse(pot[0] + (end[0] - pot[0]) * k2 + R(-5, 5), pot[1] + (end[1] - pot[1]) * k2, 6, 3.5, R(0, 3), 0, 7);
        ctx.fill();
      }
    }
  }

  function paintRug(ctx) {
    const pts = [];
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      pts.push(P(875 + Math.cos(a) * 330, ROOM.floor, 0.5 + Math.sin(a) * 0.12));
    }
    fillPoly(ctx, pts, '#5a3a33');
    const inner = pts.map(([x, y]) => {
      const c = P(875, ROOM.floor, 0.5);
      return [c[0] + (x - c[0]) * 0.86, c[1] + (y - c[1]) * 0.86];
    });
    path(ctx, inner);
    ctx.strokeStyle = 'rgba(210, 170, 140, 0.45)';
    ctx.lineWidth = 4;
    ctx.stroke();
    grain(ctx, 0.25, () => path(ctx, pts));
  }

  function paintCrate(ctx) {
    const { l, r, t, z0, z1 } = CRATE;
    soft(ctx, 14, 'rgba(0,0,0,0.6)', () => { path(ctx, quad([[l - 8, ROOM.floor, z0], [r + 8, ROOM.floor, z0], [r + 8, ROOM.floor, z1 + 0.03], [l - 8, ROOM.floor, z1 + 0.03]])); ctx.fill(); });
    // records standing in it, sticking out of the top
    for (let i = 0; i < 6; i++) {
      const z = z0 + 0.012 + i * 0.013;
      fillPoly(ctx, quad([[l + 6, t - 40, z], [r - 6, t - 40, z], [r - 6, t, z], [l + 6, t, z]]), ['#2b2230', '#c2415f', '#5a78c8', '#f0b43a', '#3f8f86', '#1e1a24'][i]);
    }
    box(ctx, l, r, t, ROOM.floor, z0, z1, { top: '#5a3f2a', front: '#4a3322', left: '#3a281a' });
    const f = boxFaces(l, r, t, ROOM.floor, z0, z1).find(([n]) => n === 'front')[1];
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let k = 1; k < 4; k++) {
      const a = [f[0][0], f[0][1] + (f[3][1] - f[0][1]) * (k / 4)];
      const b = [f[1][0], f[1][1] + (f[2][1] - f[1][1]) * (k / 4)];
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }

  function paintNightstand(ctx) {
    const { l, r, t, z0, z1 } = NIGHT;
    soft(ctx, 14, 'rgba(0,0,0,0.6)', () => { path(ctx, quad([[l - 6, ROOM.floor, z0], [r + 10, ROOM.floor, z0], [r + 10, ROOM.floor, z1 + 0.02], [l - 6, ROOM.floor, z1 + 0.02]])); ctx.fill(); });
    box(ctx, l, r, t, ROOM.floor, z0, z1, { top: '#5a3f2a', front: '#3a281c', right: '#2e2016' });
    const f = boxFaces(l, r, t, ROOM.floor, z0, z1).find(([n]) => n === 'front')[1];
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;
    const d0 = [f[0][0] + 6, f[0][1] + 10];
    ctx.strokeRect(d0[0], d0[1], f[1][0] - f[0][0] - 12, (f[3][1] - f[0][1]) * 0.35);
    ctx.fillStyle = '#c9a15a';
    ctx.fillRect((f[0][0] + f[1][0]) / 2 - 6, d0[1] + (f[3][1] - f[0][1]) * 0.16, 12, 2.5);
    // the lamp, standing on it
    const base = P(LAMP.x, t, LAMP.z);
    const shadeTop = P(LAMP.x, t - 92, LAMP.z);
    ctx.fillStyle = '#2a1e16';
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], 20, 5, 0, 0, 7);
    ctx.fill();
    ctx.fillRect(base[0] - 2.5, shadeTop[1] + 40, 5, base[1] - shadeTop[1] - 40);
    lampShade(ctx, lin(ctx, base[0] - 40, 0, base[0] + 40, 0, [[0, '#6e5438'], [0.5, '#8d6d48'], [1, '#5e4630']]));
    // the letter, sealed, lying on top
    const lt = quad([[r - 44, t, 0.035], [r - 14, t, 0.03], [r - 12, t, 0.09], [r - 42, t, 0.095]]);
    fillPoly(ctx, lt, '#b7a78e');
    const sc = P(r - 28, t, 0.062);
    ctx.fillStyle = '#7d1f2c';
    ctx.beginPath();
    ctx.arc(sc[0], sc[1], 3.5, 0, 7);
    ctx.fill();
  }

  function lampShade(ctx, fill) {
    const a = P(LAMP.x - 12, NIGHT.t - 92, LAMP.z);
    const b = P(LAMP.x + 12, NIGHT.t - 92, LAMP.z);
    const c = P(LAMP.x + 22, NIGHT.t - 58, LAMP.z);
    const d = P(LAMP.x - 22, NIGHT.t - 58, LAMP.z);
    path(ctx, [a, b, c, d]);
    ctx.fillStyle = fill;
    ctx.fill();
    return [a, b, c, d];
  }

  // the bed: a frame, a mattress, the duvet over it all, pillows at the head
  function bedTop() {
    return quad([[BED.l, BED.top, BED.fold], [BED.r, BED.top, BED.fold], [BED.r + 10, BED.top, BED.foot], [BED.l - 10, BED.top, BED.foot]]);
  }

  function paintBed(ctx) {
    const { l, r, top, mat, base, head, foot, fold } = BED;
    // its shadow on the floor
    soft(ctx, 24, 'rgba(0,0,0,0.75)', () => { path(ctx, quad([[l - 20, base, head], [r + 20, base, head], [r + 26, base, foot + 0.05], [l - 26, base, foot + 0.05]])); ctx.fill(); });
    // the frame, low, dark wood
    box(ctx, l - 6, r + 6, 604, base, head, foot + 0.01, { top: '#2e1f15', front: '#3a281b' });
    // the mattress
    box(ctx, l, r, mat, 604, head, foot, { top: '#9d968d', front: '#7c756d' });
    // the fitted sheet showing at the head, above the fold
    fillPoly(ctx, quad([[l, mat, head], [r, mat, head], [r, mat, fold], [l, mat, fold]]), lin(ctx, 0, P(0, mat, head)[1], 0, P(0, mat, fold)[1], [[0, '#8f8880'], [1, '#aba399']]));

    // pillows leaning on the wall
    [[l + 14, l + 164, 0.012], [r - 164, r - 14, 0.015]].forEach(([x0, x1, z]) => {
      const tl = P(x0, 500, z);
      const br = P(x1, mat, z + 0.05);
      soft(ctx, 10, 'rgba(0,0,0,0.55)', () => { roundRect(ctx, tl[0] + 4, tl[1] + 10, br[0] - tl[0], br[1] - tl[1], 18); ctx.fill(); });
      roundRect(ctx, tl[0], tl[1], br[0] - tl[0], br[1] - tl[1], 18);
      ctx.fillStyle = lin(ctx, 0, tl[1], 0, br[1], [[0, '#d4cdc3'], [0.55, '#b8b0a6'], [1, '#8a837b']]);
      ctx.fill();
      ctx.fillStyle = 'rgba(70, 64, 60, 0.25)';
      ctx.beginPath();
      ctx.ellipse((tl[0] + br[0]) / 2 + 6, (tl[1] + br[1]) / 2 + 2, (br[0] - tl[0]) * 0.28, (br[1] - tl[1]) * 0.22, 0, 0, 7);
      ctx.fill();
    });

    // the duvet: over the top from the fold down to the foot, hanging over the end
    const dTop = bedTop();
    const dFront = quad([[l - 10, top, foot], [r + 10, top, foot], [r + 10, 612, foot + 0.01], [l - 10, 612, foot + 0.01]]);
    fillPoly(ctx, dTop, lin(ctx, 0, dTop[0][1], 0, dTop[2][1], [[0, '#8f949b'], [1, '#7b8087']]));
    fillPoly(ctx, dFront, lin(ctx, 0, dFront[0][1], 0, dFront[2][1], [[0, '#6f747b'], [1, '#4f5358']]));
    // soft folds on the top, running towards you (towards the vanishing point, like the bed)
    ctx.save();
    path(ctx, dTop);
    ctx.clip();
    [[760, 0.6], [870, -0.2], [985, 0.35], [1030, -0.5]].forEach(([X, lean]) => {
      const a = P(X, top, fold + 0.02);
      const b = P(X + lean * 40, top, foot);
      ctx.lineCap = 'round';
      ctx.lineWidth = 26;
      ctx.strokeStyle = 'rgba(30, 30, 34, 0.22)';
      ctx.beginPath();
      ctx.moveTo(a[0] + 8, a[1]);
      ctx.quadraticCurveTo((a[0] + b[0]) / 2 + lean * 30 + 8, (a[1] + b[1]) / 2, b[0] + 8, b[1]);
      ctx.stroke();
      ctx.lineWidth = 12;
      ctx.strokeStyle = 'rgba(205, 208, 214, 0.18)';
      ctx.beginPath();
      ctx.moveTo(a[0] - 6, a[1]);
      ctx.quadraticCurveTo((a[0] + b[0]) / 2 + lean * 30 - 6, (a[1] + b[1]) / 2, b[0] - 6, b[1]);
      ctx.stroke();
    });
    ctx.restore();
    // the folded-back edge: a thick soft roll across the bed
    const f0 = P(l - 6, top - 6, fold - 0.01);
    const f1 = P(r + 6, top - 6, fold - 0.01);
    const f2 = P(r + 6, top, fold + 0.03);
    const f3 = P(l - 6, top, fold + 0.03);
    ctx.beginPath();
    ctx.moveTo(f0[0], f0[1]);
    ctx.quadraticCurveTo((f0[0] + f1[0]) / 2, f0[1] - 4, f1[0], f1[1]);
    ctx.lineTo(f2[0], f2[1]);
    ctx.quadraticCurveTo((f2[0] + f3[0]) / 2, f2[1] + 6, f3[0], f3[1]);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, f0[1], 0, f3[1], [[0, '#d2cbc1'], [0.6, '#b3aca3'], [1, '#7d7771']]);
    ctx.fill();
    crease(ctx, f3, f2, 6, 0.45);
    // the edge where the top turns down into the foot
    crease(ctx, dFront[0], dFront[1], 5, 0.3);
    weave(ctx, dTop);
    weave(ctx, dFront);
  }

  let weavePat = null;
  function weave(ctx, pts) {
    if (!weavePat) {
      weavePat = document.createElement('canvas');
      weavePat.width = weavePat.height = 8;
      const w = weavePat.getContext('2d');
      w.fillStyle = '#808080';
      w.fillRect(0, 0, 8, 8);
      w.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 8; i += 2) w.fillRect(i, 0, 1, 8);
      w.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 1; i < 8; i += 2) w.fillRect(0, i, 8, 1);
    }
    ctx.save();
    path(ctx, pts);
    ctx.clip();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(weavePat, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // what's on the bed: the laptop (open, facing you), the cards, headphones
  function laptopQuads() {
    const { l, r, z0, z1 } = LAPTOP;
    const y = BED.top - 2;
    const baseQ = quad([[l, y, z0], [r, y, z0], [r, y, z1], [l, y, z1]]);
    const lidQ = quad([[l, y - 70, z0 - 0.02], [r, y - 70, z0 - 0.02], [r, y, z0], [l, y, z0]]);
    const screenQ = quad([[l + 6, y - 64, z0 - 0.017], [r - 6, y - 64, z0 - 0.017], [r - 6, y - 5, z0 - 0.001], [l + 6, y - 5, z0 - 0.001]]);
    return { baseQ, lidQ, screenQ };
  }

  function paintOnBed(ctx) {
    const { baseQ, lidQ, screenQ } = laptopQuads();
    soft(ctx, 8, 'rgba(0,0,0,0.6)', () => { path(ctx, baseQ.map(([a, b]) => [a + 4, b + 5])); ctx.fill(); });
    fillPoly(ctx, baseQ, '#6a6c72');
    fillPoly(ctx, lidQ, '#4d4f56');
    fillPoly(ctx, screenQ, '#141a26');
    ctx.fillStyle = 'rgba(150, 180, 230, 0.22)';
    for (let i = 0; i < 4; i++) {
      const a = P(LAPTOP.l + 14, BED.top - 56 + i * 12, LAPTOP.z0 - 0.012);
      ctx.fillRect(a[0], a[1], 26 + (i * 17) % 40, 3);
    }
    // cards, fanned, lying flat on the duvet
    for (let i = 0; i < 5; i++) {
      const x = CARDS.x + i * 13;
      const z = CARDS.z + (i - 2) * 0.006;
      const q = quad([[x, BED.top - 1, z - 0.03], [x + 22, BED.top - 1, z - 0.034], [x + 26, BED.top - 1, z + 0.02], [x + 4, BED.top - 1, z + 0.024]]);
      fillPoly(ctx, q.map(([a, b]) => [a + 2, b + 2]), 'rgba(0,0,0,0.35)');
      fillPoly(ctx, q, '#26143a');
      path(ctx, q);
      ctx.strokeStyle = '#a88f5a';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    // headphones
    const hp = P(880, BED.top - 2, 0.3);
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(hp[0], hp[1], 30, 12, 0.15, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = '#141216';
    ctx.beginPath(); ctx.ellipse(hp[0] - 28, hp[1] + 2, 9, 7, 0.15, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hp[0] + 28, hp[1] + 6, 9, 7, 0.15, 0, 7); ctx.fill();
  }

  // the guitar, standing on the floor, leaning back against the end of the shelf
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

  // a real guitar is ~1 m tall: 190 wall units, scaled by how close it stands
  function guitarPlace(ctx) {
    const foot = P(GUITAR.X, ROOM.floor, GUITAR.z);
    const s = (190 / (1 - GUITAR.z)) / 470;
    ctx.translate(foot[0], foot[1] + 4);
    ctx.rotate(0.13);
    ctx.scale(s, s);
  }

  function paintGuitar(ctx) {
    ctx.save();
    guitarPlace(ctx);
    soft(ctx, 16, 'rgba(0,0,0,0.6)', () => { ctx.save(); ctx.translate(-20, 4); ctx.scale(1, 0.12); ctx.beginPath(); ctx.ellipse(0, 0, 90, 40, 0, 0, 7); ctx.fill(); ctx.restore(); });
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
    for (let st = 0; st < 6; st++) {
      ctx.lineWidth = 0.5 + (5 - st) * 0.1;
      ctx.beginPath();
      ctx.moveTo(-6 + st * 2.4, -412);
      ctx.lineTo(-8 + st * 3.2, -62);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ==========================================================
     THE LIGHT
     ========================================================== */
  // the window's lower panes, pushed along the sunlight onto a horizontal plane
  function panesOnPlane(Yp) {
    return panes().map(([x, y, w, h]) => [onPlane(x, y + h, Yp), onPlane(x + w, y + h, Yp), onPlane(x + w, y, Yp), onPlane(x, y, Yp)].map((p) => P(...p)));
  }
  function panesOnFace(zp) {
    return panes().map(([x, y, w, h]) => [onFace(x, y, zp), onFace(x + w, y, zp), onFace(x + w, y + h, zp), onFace(x, y + h, zp)].map((p) => P(...p)));
  }

  function paintSun(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const { l, r, top, foot } = BED;

    // on the floor in front of the bed…
    ctx.save();
    path(ctx, quad([[ROOM.l, ROOM.floor, 0], [ROOM.r, ROOM.floor, 0], [ROOM.r, ROOM.floor, NEAR], [ROOM.l, ROOM.floor, NEAR]]));
    ctx.clip();
    panesOnPlane(ROOM.floor).forEach((q) => soft(ctx, 6, 'rgba(255,0,0,0.66)', () => { path(ctx, q); ctx.fill(); }));
    ctx.restore();
    // …the bed is in the way of the floor behind it
    ctx.globalCompositeOperation = 'source-over';
    fillPoly(ctx, quad([[l - 10, top, 0], [r + 10, top, 0], [r + 10, top, foot], [l - 10, top, foot]]), '#000');
    fillPoly(ctx, quad([[l - 10, top, foot], [r + 10, top, foot], [r + 10, ROOM.floor, foot + 0.01], [l - 10, ROOM.floor, foot + 0.01]]), '#000');
    ctx.globalCompositeOperation = 'lighter';
    // …on the duvet
    ctx.save();
    path(ctx, bedTop());
    ctx.clip();
    panesOnPlane(top).forEach((q) => soft(ctx, 5, 'rgba(255,0,0,0.58)', () => { path(ctx, q); ctx.fill(); }));
    ctx.restore();
    // …and down the foot of the bed
    ctx.save();
    path(ctx, quad([[l - 10, top, foot], [r + 10, top, foot], [r + 10, 612, foot + 0.01], [l - 10, 612, foot + 0.01]]));
    ctx.clip();
    panesOnFace(foot).forEach((q) => soft(ctx, 5, 'rgba(255,0,0,0.5)', () => { path(ctx, q); ctx.fill(); }));
    ctx.restore();

    // rim light: the sill, the tops of the pillows, the rolled edge, the guitar, the shelf's end
    const sill = quad([[WIN.l - 26, WIN.b + 4, 0], [WIN.r + 26, WIN.b + 4, 0], [WIN.r + 26, WIN.b + 4, 0.035], [WIN.l - 26, WIN.b + 4, 0.035]]);
    soft(ctx, 5, 'rgba(255,0,0,0.9)', () => { path(ctx, sill); ctx.fill(); });
    [[l + 14, l + 164, 0.012], [r - 164, r - 14, 0.015]].forEach(([x0, x1, z]) => {
      const a = P(x0 + 10, 502, z);
      const b = P(x1 - 10, 502, z);
      soft(ctx, 6, 'rgba(255,0,0,0.9)', () => { ctx.beginPath(); ctx.ellipse((a[0] + b[0]) / 2, a[1] + 3, (b[0] - a[0]) / 2, 5, 0, 0, 7); ctx.fill(); });
    });
    const fe = [P(l, top - 6, BED.fold - 0.01), P(r, top - 6, BED.fold - 0.01)];
    ctx.lineWidth = 4;
    soft(ctx, 5, 'rgba(255,0,0,0.75)', () => { ctx.beginPath(); ctx.moveTo(fe[0][0], fe[0][1]); ctx.lineTo(fe[1][0], fe[1][1]); ctx.stroke(); });
    ctx.save();
    guitarPlace(ctx);
    ctx.lineWidth = 4;
    soft(ctx, 5, 'rgba(255,0,0,0.8)', () => {
      ctx.beginPath();
      ctx.moveTo(-40, -200);
      ctx.bezierCurveTo(-46, -180, -34, -160, -34, -144);
      ctx.bezierCurveTo(-36, -126, -62, -112, -62, -76);
      ctx.bezierCurveTo(-62, -50, -52, -30, -40, -20);
      ctx.stroke();
    });
    ctx.restore();
    const se = [P(SHELF.l, SHELF.t, SHELF.z1 + 0.012), P(SHELF.l, ROOM.floor, SHELF.z1 + 0.012)];
    ctx.lineWidth = 3;
    soft(ctx, 5, 'rgba(255,0,0,0.4)', () => { ctx.beginPath(); ctx.moveTo(se[0][0], se[0][1]); ctx.lineTo(se[1][0], se[1][1]); ctx.stroke(); });
    const ns = quad([[NIGHT.l, NIGHT.t, NIGHT.z0], [NIGHT.r, NIGHT.t, NIGHT.z0], [NIGHT.r, NIGHT.t, NIGHT.z1], [NIGHT.l, NIGHT.t, NIGHT.z1]]);
    soft(ctx, 8, 'rgba(255,0,0,0.35)', () => { path(ctx, ns); ctx.fill(); });
    // the curtains glow where the sun comes through them
    [[WIN.l - 60, WIN.l - 12], [WIN.r + 12, WIN.r + 60]].forEach(([a, b]) => soft(ctx, 22, 'rgba(255,0,0,0.45)', () => { path(ctx, quad([[a, WIN.t + 90, 0.02], [b, WIN.t + 90, 0.02], [b, 520, 0.02], [a, 520, 0.02]])); ctx.fill(); }));
    // the photos on the left wall catch a little of the bounce
    soft(ctx, 40, 'rgba(255,0,0,0.3)', () => { path(ctx, quad([[ROOM.l, PHOTOS.t + 40, 0.2], [ROOM.l, PHOTOS.t + 40, 0.34], [ROOM.l, PHOTOS.b, 0.34], [ROOM.l, PHOTOS.b, 0.2]])); ctx.fill(); });

    // G — the beam: the window pushed out along the light, a shaft coming at you
    const shaft = [];
    [[WIN.l, WIN.t], [WIN.r, WIN.t], [WIN.r, WIN.b], [WIN.l, WIN.b]].forEach(([x, y]) => {
      shaft.push(P(x, y, 0));
      shaft.push(P(...onFace(x, y, 0.42)));
    });
    const hull = convexHull(shaft);
    const g0 = P(830, 380, 0);
    const g1 = P(...onFace(830, 380, 0.42));
    ctx.save();
    ctx.globalAlpha = 0.9;
    const gg = ctx.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
    gg.addColorStop(0, 'rgba(0,120,0,1)');
    gg.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.filter = 'blur(18px)';
    path(ctx, hull);
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.restore();
    soft(ctx, 80, 'rgba(0,255,0,0.3)', () => { ctx.beginPath(); ctx.ellipse(SUN[0], SUN[1] - 30, 190, 220, 0, 0, 7); ctx.fill(); });

    // B — branch shadows drift through the light on the bed and the floor
    ctx.save();
    ctx.filter = 'blur(20px)';
    path(ctx, bedTop());
    ctx.fillStyle = 'rgb(0,0,255)';
    ctx.fill();
    path(ctx, quad([[BED.l - 60, ROOM.floor, BED.foot], [BED.r + 120, ROOM.floor, BED.foot], [BED.r + 160, ROOM.floor, NEAR], [BED.l - 60, ROOM.floor, NEAR]]));
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  function convexHull(points) {
    const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    pts.forEach((p) => { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); });
    const upper = [];
    pts.slice().reverse().forEach((p) => { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); });
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  function paintEmit(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // R: the lamp's shade, and the pool it throws on the nightstand and the wall
    soft(ctx, 4, 'rgba(255,0,0,1)', () => { path(ctx, lampShade(ctx, '#000')); ctx.fill(); });
    const lamp = P(LAMP.x, NIGHT.t - 70, LAMP.z);
    soft(ctx, 60, 'rgba(255,0,0,0.6)', () => { ctx.beginPath(); ctx.ellipse(lamp[0], lamp[1] + 60, 130, 60, 0, 0, 7); ctx.fill(); });
    soft(ctx, 90, 'rgba(255,0,0,0.35)', () => { ctx.beginPath(); ctx.ellipse(lamp[0], lamp[1] - 40, 150, 130, 0, 0, 7); ctx.fill(); });
    // G: the laptop screen, and its blue on the duvet
    const { screenQ } = laptopQuads();
    soft(ctx, 3, 'rgba(0,255,0,1)', () => { path(ctx, screenQ); ctx.fill(); });
    const sc = [(screenQ[0][0] + screenQ[2][0]) / 2, (screenQ[0][1] + screenQ[2][1]) / 2];
    soft(ctx, 60, 'rgba(0,255,0,0.45)', () => { ctx.beginPath(); ctx.ellipse(sc[0], sc[1] + 30, 150, 70, 0, 0, 7); ctx.fill(); });
    // B: fairy lights
    lightBulbs().forEach(([bx, by]) => soft(ctx, 6, 'rgba(0,0,255,1)', () => { ctx.beginPath(); ctx.arc(bx, by + 4, 5, 0, 7); ctx.fill(); }));
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintGlass(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    panes().map(toGlass).forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
    ctx.save();
    ctx.beginPath();
    ctx.rect(GLASS.x, GLASS.y, GLASS.w, GLASS.h);
    ctx.clip();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 24;
    trunk(ctx);
    ctx.restore();
  }

  function paintForeground(ctx) {
    ctx.clearRect(0, 0, W, H);
  }

  // the construction lines: the vanishing point, the horizon, and every
  // edge that should run into it — if something's off, it shows
  function paintGuides(ctx) {
    ctx.clearRect(0, 0, W, H);
    const line = (a, b, color, width = 1.4, dash = []) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    };
    const toVP = (X, Y, z = NEAR + 0.2, color = 'rgba(80, 255, 170, 0.9)') => line(P(X, Y, 0), P(X, Y, z), color);
    // horizon (eye level) and the vanishing point
    line([0, VP[1]], [W, VP[1]], 'rgba(255, 90, 90, 0.95)', 2, [10, 8]);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 90, 90, 1)';
    ctx.beginPath();
    ctx.arc(VP[0], VP[1], 7, 0, 7);
    ctx.fill();
    // the room's four corner lines
    [[ROOM.l, ROOM.ceil], [ROOM.r, ROOM.ceil], [ROOM.l, ROOM.floor], [ROOM.r, ROOM.floor]].forEach(([X, Y]) => toVP(X, Y));
    // the back wall
    const bw = quad([[ROOM.l, ROOM.ceil, 0], [ROOM.r, ROOM.ceil, 0], [ROOM.r, ROOM.floor, 0], [ROOM.l, ROOM.floor, 0]]);
    ctx.setLineDash([]);
    path(ctx, bw);
    ctx.strokeStyle = 'rgba(80, 200, 255, 0.9)';
    ctx.stroke();
    // a floor grid
    for (let X = ROOM.l; X <= ROOM.r; X += 115) toVP(X, ROOM.floor, NEAR, 'rgba(80, 200, 255, 0.35)');
    for (let z = 0.1; z < NEAR; z += 0.1) line(P(ROOM.l, ROOM.floor, z), P(ROOM.r, ROOM.floor, z), 'rgba(80, 200, 255, 0.35)');
    // the bed, the shelf, the nightstand and the crate: their edges, extended to the vanishing point
    const edges = (x0, x1, y0, y1, z1) => {
      [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([X, Y]) => line(P(X, Y, z1), VP, 'rgba(255, 220, 90, 0.55)', 1, [4, 5]));
      boxFaces(x0, x1, y0, y1, 0, z1).forEach(([, pts]) => { ctx.setLineDash([]); path(ctx, pts); ctx.strokeStyle = 'rgba(255, 220, 90, 0.95)'; ctx.lineWidth = 1.6; ctx.stroke(); });
    };
    edges(BED.l, BED.r, BED.top, ROOM.floor, BED.foot);
    edges(SHELF.l, SHELF.r, SHELF.t, ROOM.floor, SHELF.z1);
    edges(NIGHT.l, NIGHT.r, NIGHT.t, ROOM.floor, NIGHT.z1);
    edges(CRATE.l, CRATE.r, CRATE.t, ROOM.floor, CRATE.z1);
    // the window and the sunlight's direction through its corners
    ctx.setLineDash([]);
    path(ctx, quad([[WIN.l, WIN.t, 0], [WIN.r, WIN.t, 0], [WIN.r, WIN.b, 0], [WIN.l, WIN.b, 0]]));
    ctx.strokeStyle = 'rgba(255, 150, 60, 0.95)';
    ctx.stroke();
    [[WIN.l, WIN.b], [WIN.r, WIN.b], [WIN.l, WIN.b - 90], [WIN.r, WIN.b - 90]].forEach(([x, y]) => line(P(x, y, 0), P(...onPlane(x, y, ROOM.floor)), 'rgba(255, 150, 60, 0.8)', 1.2, [6, 4]));
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('eye level (horizon)', 20, VP[1] - 8);
    ctx.fillText('vanishing point', VP[0] + 12, VP[1] - 10);
  }

  /* ---------- where you can click (board px), and where the camera looks ---------- */
  function bounds(pts, pad = 6) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x = Math.min(...xs) - pad;
    const y = Math.min(...ys) - pad;
    return { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad };
  }

  function hotspots() {
    const shelfSide = SHELF_ROWS[3];
    const guitarFoot = P(GUITAR.X, ROOM.floor, GUITAR.z);
    const gH = (190 / (1 - GUITAR.z));
    const { baseQ, lidQ } = laptopQuads();
    const list = [
      { id: 'wishes', label: 'the window', ...bounds(quad([[WIN.l, WIN.t, 0], [WIN.r, WIN.t, 0], [WIN.r, WIN.b, 0], [WIN.l, WIN.b, 0]])) },
      { id: 'gallery', label: 'pictures i took', ...bounds(quad([[ROOM.l, PHOTOS.t, PHOTOS.z0], [ROOM.l, PHOTOS.t, PHOTOS.z1], [ROOM.l, PHOTOS.b, PHOTOS.z1], [ROOM.l, PHOTOS.b, PHOTOS.z0]])) },
      { id: 'favoomfs', label: 'my friends', ...bounds(quad([[ROOM.l, 150, 0.1], [ROOM.l, 150, 0.34], [ROOM.l, 250, 0.34], [ROOM.l, 250, 0.1]])) },
      { id: 'about', label: 'a note on the wall', ...bounds(quad([[NOTE.l, NOTE.t, 0], [NOTE.r, NOTE.t, 0], [NOTE.r, NOTE.b, 0], [NOTE.l, NOTE.b, 0]]), 12) },
      { id: 'interests', label: 'the tapes', ...bounds(quad([[SHELF.l, shelfSide, SHELF.z0], [SHELF.l, shelfSide, SHELF.z1], [SHELF.l, SHELF_ROWS[4], SHELF.z1], [SHELF.l, SHELF_ROWS[4], SHELF.z0]])) },
      { id: 'guitar', label: 'my guitar', x: guitarFoot[0] - 26, y: guitarFoot[1] - gH - 6, w: 80, h: gH + 10 },
      { id: 'games', label: 'my laptop', ...bounds(baseQ.concat(lidQ), 10) },
      { id: 'send', label: 'a letter for you', ...bounds(quad([[NIGHT.r - 48, NIGHT.t, 0.03], [NIGHT.r - 8, NIGHT.t, 0.03], [NIGHT.r - 8, NIGHT.t, 0.1], [NIGHT.r - 48, NIGHT.t, 0.1]]), 12) },
      { id: 'lamp', label: 'the lamp', ...bounds([P(LAMP.x - 24, NIGHT.t - 92, LAMP.z), P(LAMP.x + 24, NIGHT.t, LAMP.z)], 8), action: 'lamp' },
      { id: 'oracle', label: 'the cards on my bed', ...bounds(quad([[CARDS.x - 4, BED.top, CARDS.z - 0.04], [CARDS.x + 80, BED.top, CARDS.z - 0.04], [CARDS.x + 80, BED.top, CARDS.z + 0.04], [CARDS.x - 4, BED.top, CARDS.z + 0.04]]), 12) }
    ];
    return list;
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
    const guides = layer(0.75);
    paintGuides(guides.ctx);

    const spots = hotspots();
    const focus = {};
    spots.forEach((h) => { focus[h.id] = [h.x + h.w / 2, h.y + h.h / 2]; });

    return {
      W, H,
      albedo: albedo.c,
      blur: blur.c,
      sun: sun.c,
      emit: emit.c,
      glass: glass.c,
      fg: fg.c,
      guides: guides.c,
      hotspots: spots,
      focus,
      sunAt: SUN,
      windowRect: GLASS
    };
  }

  Void.dream = Void.dream || {};
  Void.dream.memoryPaint = { paint, W, H };
})();
