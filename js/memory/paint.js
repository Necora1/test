/* ==========================================================
   memory/paint.js — renn's room, painted in code
   The real room, remembered a little softer: an attic with a
   slatted ceiling sloping down on both sides, one white window
   with the red brick house across the street, heavy dark curtains
   half drawn, the radiator, the fan, the wire lamp. Late in the
   day: the sun going down behind the neighbours' roof, and a
   window-shaped patch of it lying on the floor.

   The room is built in 3D and projected through one camera, so
   everything shares one vanishing point:

     P(X, Y, z)   X, Y: position measured on the back wall (board
                  units, Y grows downwards); z: how far out from the
                  back wall, as a fraction of the way to the camera
                  (0 = on the back wall, 1 = at the camera)

   Eye level (the horizon) is at VP[1]; everything below it shows
   its top, everything above it its underside. The sunlight is
   traced the same way: each pane of the window is pushed along the
   light's direction until it lands on the floor.

   Layers handed to the engine:
   albedo   the room in dim, even light
   sun      R: where the sun lands · G: light in the air ·
            B: where branch shadows can drift through it
   emit     R: the lamps · G: the laptop screen · B: fairy lights
   glass    R: where you see out of the window · G: sky (not the
            house) · B: the house's windows (lit at night)
   fg       (empty) anything right in front of the camera
   guides   perspective guides (vanishing point, horizon, the
            lines everything is built on) — the camera panel shows them
   ========================================================== */
(() => {
  const Void = window.Void;
  const W = 1600;
  const H = 1000;

  /* ---------- the camera ---------- */
  const VP = [800, 470];                     // vanishing point = eye level
  const P = (X, Y, z) => [VP[0] + (X - VP[0]) / (1 - z), VP[1] + (Y - VP[1]) / (1 - z)];
  const NEAR = 0.72;                         // walls are drawn out to here (past the edges of the picture)

  /* ---------- the room (in wall units; ~200 units to a metre) ---------- */
  // an attic: straight walls up to the knee line, then the ceiling slopes
  // up to a flat strip in the middle
  const ROOM = { l: 250, r: 1350, floor: 700, knee: 300, ceil: 120, cl: 420, cr: 1180 };
  const WIN = { l: 640, r: 960, t: 222, b: 505, inset: -0.06, transom: 46, side: 60 };
  const FR = 12;                             // the white frame's thickness
  const MU = 4;                              // the thin bars
  const CUR = { top: 134, z: 0.045, lOut: 448, lInTop: 670, lInBot: 696, rInTop: 936, rInBot: 910, rOut: 1162 };
  CUR.lIn = (CUR.lInTop + CUR.lInBot) / 2;
  CUR.rIn = (CUR.rInTop + CUR.rInBot) / 2;
  const LIGHT = { dx: -60, dy: 1000 };       // how far the sunlight moves per unit of z (down and a little left)
  const SUN = [850, 312];                    // on screen: over the neighbours' roof, inside the window

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

  function line(ctx, a, b, style, width = 1) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
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
  const sc = (z) => 1 / (1 - z);             // how much bigger things are at depth z

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
  const face = (x0, x1, y0, y1, z0, z1, name) => (boxFaces(x0, x1, y0, y1, z0, z1).find(([n]) => n === name) || [])[1];

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

  // a flat ellipse lying on a horizontal plane (a disc on the floor, a mug's rim)
  function floorDisc(X, Y, z, r) {
    const c = P(X, Y, z);
    const f = P(X, Y, z - r / 1000);
    const n = P(X, Y, z + r / 1000);
    return [c[0], (f[1] + n[1]) / 2, r * sc(z), Math.abs(n[1] - f[1]) / 2];
  }

  /* ---------- the window's panes (wall units, on the back wall) ---------- */
  function panes() {
    const { l, r, t, b, transom, side } = WIN;
    const out = [[l + FR, t + FR, r - l - 2 * FR, transom - FR]];
    const y0 = t + transom + FR;
    const y1 = b - FR;
    const rh = (y1 - y0) / 3;
    const cx0 = l + side + FR;
    const cx1 = r - side - FR;
    const cw = (cx1 - cx0) / 3;
    const cols = [[l + FR, l + side]];
    for (let k = 0; k < 3; k++) cols.push([cx0 + k * cw + (k ? MU / 2 : 0), cx0 + (k + 1) * cw - (k < 2 ? MU / 2 : 0)]);
    cols.push([r - side, r - FR]);
    for (let k = 0; k < 3; k++) {
      const ya = y0 + k * rh + (k ? MU / 2 : 0);
      const yb = y0 + (k + 1) * rh - (k < 2 ? MU / 2 : 0);
      cols.forEach(([xa, xb]) => out.push([xa, ya, xb - xa, yb - ya]));
    }
    return out;
  }
  // the panes the curtains leave open (for the light)
  const openPanes = () => panes().map(([x, y, w, h]) => {
    const a = Math.max(x, CUR.lIn);
    const b = Math.min(x + w, CUR.rIn);
    return [a, y, b - a, h];
  }).filter(([, , w]) => w > 2);

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

  /* ---------- things in the room (for the paint, the light and the clicks) ---------- */
  const BED = { l: 250, r: 520, top: 590, rail: 612, head: 0.1, foot: NEAR };
  const NIGHT = { l: 545, r: 640, t: 612, z0: 0.33, z1: 0.43 };
  const CLOCK = { X: 606, z: 0.37, r: 15 };
  const LAPTOP = { l: 356, r: 456, z0: 0.25, z1: 0.31 };
  const CARDS = { x: 436, z: 0.37 };
  const FAN = { X: 500, z: 0.06, cy: 382, r: 58 };
  const DESK = { l: 1215, r: ROOM.r, t: 555, z0: 0.2, z1: 0.46 };
  const HUTCH = { l: 1290, shelf: 478, top: 408 };
  const BENCH = { l: 1128, r: 1208, t: 598, z0: 0.4, z1: 0.47 };
  const GUITAR = { X: 1244, z: 0.035 };
  const RAD = { l: 668, r: 932, t: 552, b: 652, z0: 0.004, z1: 0.03 };
  const SHELF = { l: 1290, r: ROOM.r, t: 252, b: 300, z0: 0.07, z1: 0.23 };
  const NOTE = { z0: 0.09, z1: 0.19, t: 318, b: 394 };
  const PHOTOS = { z0: 0.03, z1: 0.2, t: 330, b: 472 };
  const FRAMES = [[1188, 1288, 288, 420], [1302, 1340, 322, 372], [1302, 1340, 386, 430]];
  const LAMPC = { X: 800, z: 0.2, Y: 152, arm: 58 };   // the wire chandelier, hanging from the flat ceiling
  const RUG = { l: 960, r: 1345, z0: 0.28, z1: 0.56 };
  const SHAG = { l: 560, r: 1010, z0: 0.47, z1: 0.62 };

  /* ==========================================================
     THE ALBEDO
     ========================================================== */
  function paintRoom(ctx, covers) {
    rnd = mulberry(7);
    paintShell(ctx);
    paintWindow(ctx);
    paintRadiator(ctx);
    paintCurtains(ctx);
    paintSocket(ctx);
    paintFrames(ctx, covers);
    paintPhotoWall(ctx, covers);
    paintWallShelf(ctx);
    paintNote(ctx);
    paintChandelier(ctx);
    paintRugs(ctx);
    paintGuitar(ctx);
    paintFan(ctx);
    paintBed(ctx);
    paintOnBed(ctx);
    paintNightstand(ctx);
    paintDesk(ctx);
    paintBench(ctx);
  }

  // walls, the sloping ceiling, the floor, and the soft lines where they meet
  function shellQuads() {
    const { l, r, floor, knee, ceil, cl, cr } = ROOM;
    return {
      back: quad([[l, knee, 0], [cl, ceil, 0], [cr, ceil, 0], [r, knee, 0], [r, floor, 0], [l, floor, 0]]),
      left: quad([[l, knee, 0], [l, knee, NEAR], [l, floor, NEAR], [l, floor, 0]]),
      right: quad([[r, knee, 0], [r, knee, NEAR], [r, floor, NEAR], [r, floor, 0]]),
      lslope: quad([[l, knee, 0], [cl, ceil, 0], [cl, ceil, NEAR], [l, knee, NEAR]]),
      rslope: quad([[cr, ceil, 0], [r, knee, 0], [r, knee, NEAR], [cr, ceil, NEAR]]),
      top: quad([[cl, ceil, 0], [cr, ceil, 0], [cr, ceil, NEAR], [cl, ceil, NEAR]]),
      ceiling: quad([[l, knee, 0], [cl, ceil, 0], [cr, ceil, 0], [r, knee, 0], [r, knee, NEAR], [cr, ceil, NEAR], [cl, ceil, NEAR], [l, knee, NEAR]]),
      ground: quad([[l, floor, 0], [r, floor, 0], [r, floor, NEAR], [l, floor, NEAR]])
    };
  }

  function paintShell(ctx) {
    const { l, r, floor, knee, ceil, cl, cr } = ROOM;
    const q = shellQuads();

    // the back wall: white paint in the shade of its own window
    fillPoly(ctx, q.back, lin(ctx, 0, ceil, 0, floor, [[0, '#57524e'], [0.5, '#625c57'], [1, '#6b645e']]));
    ctx.save();
    path(ctx, q.back);
    ctx.clip();
    ctx.fillStyle = rad(ctx, 800, 470, 120, 700, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.38)']]);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // the straight walls under the slopes, getting darker towards you
    fillPoly(ctx, q.left, lin(ctx, P(l, 0, 0)[0], 0, 0, 0, [[0, '#56514c'], [1, '#2f2c29']]));
    fillPoly(ctx, q.right, lin(ctx, P(r, 0, 0)[0], 0, W, 0, [[0, '#5c5752'], [1, '#34312e']]));
    // the ceiling: white boards, the slopes catching the light off the floor
    const lsA = P(cl, ceil, 0);
    const lsB = P(cl, ceil, 0.45);
    fillPoly(ctx, q.lslope, lin(ctx, lsA[0], lsA[1], lsB[0], lsB[1], [[0, '#77716b'], [1, '#3e3a37']]));
    const rsB = P(cr, ceil, 0.45);
    fillPoly(ctx, q.rslope, lin(ctx, P(cr, ceil, 0)[0], ceil, rsB[0], rsB[1], [[0, '#7a746e'], [1, '#403c39']]));
    fillPoly(ctx, q.top, lin(ctx, 0, ceil, 0, P(0, ceil, 0.3)[1], [[0, '#7e7872'], [1, '#4a4642']]));
    grain(ctx, 0.08, () => path(ctx, q.back));
    grain(ctx, 0.08, () => path(ctx, q.left));
    grain(ctx, 0.08, () => path(ctx, q.right));

    // the ceiling boards, running across, parallel to the back wall
    ctx.save();
    path(ctx, q.ceiling);
    ctx.clip();
    for (let z = 0.014; z < NEAR; z += 0.022) {
      const pts = [P(l, knee, z), P(cl, ceil, z), P(cr, ceil, z), P(r, knee, z)];
      ctx.lineWidth = 1.1 * Math.sqrt(sc(z));
      ctx.strokeStyle = 'rgba(24, 21, 19, 0.5)';
      path(ctx, pts, false);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(230, 225, 215, 0.07)';
      path(ctx, pts.map(([x, y]) => [x, y + 2 * sc(z)]), false);
      ctx.stroke();
    }
    ctx.restore();
    // white trims where the slopes meet the flat ceiling and the walls
    [[cl, ceil], [cr, ceil], [l, knee], [r, knee]].forEach(([X, Y]) => {
      crease(ctx, P(X, Y, 0), P(X, Y, NEAR), 14, 0.35);
      line(ctx, P(X, Y, 0), P(X, Y, NEAR), 'rgba(170, 165, 158, 0.35)', 4);
    });

    // the floor: pale oak laminate, boards running across the room
    fillPoly(ctx, q.ground, lin(ctx, 0, floor, 0, H, [[0, '#6f6356'], [1, '#54493f']]));
    ctx.save();
    path(ctx, q.ground);
    ctx.clip();
    const rowZ = 0.036;
    let row = 0;
    for (let z = 0; z < NEAR; z += rowZ, row++) {
      const off = (row * 97) % 240;
      for (let X = l - off; X < r; X += 240) {
        const x0 = Math.max(l, X);
        const x1 = Math.min(r, X + 240);
        const t = rnd();
        fillPoly(ctx, quad([[x0, floor, z], [x1, floor, z], [x1, floor, z + rowZ], [x0, floor, z + rowZ]]),
          t < 0.5 ? `rgba(40, 28, 18, ${0.04 + t * 0.14})` : `rgba(215, 196, 168, ${(t - 0.5) * 0.12})`);
        line(ctx, P(x0, floor, z), P(x0, floor, z + rowZ), 'rgba(22, 16, 12, 0.4)', 0.9 * Math.sqrt(sc(z)));
      }
      line(ctx, P(l, floor, z), P(r, floor, z), 'rgba(22, 16, 12, 0.38)', 1 * Math.sqrt(sc(z)));
    }
    // the grain in the wood
    for (let i = 0; i < 900; i++) {
      const z = R(0, NEAR);
      const X = R(l, r);
      const a = P(X, floor, z);
      const b = P(X + R(30, 150), floor, z);
      line(ctx, a, b, rnd() < 0.5 ? `rgba(30, 20, 12, ${R(0.04, 0.1)})` : `rgba(225, 205, 175, ${R(0.03, 0.08)})`, R(0.5, 1.2) * Math.sqrt(sc(z)));
    }
    ctx.restore();
    grain(ctx, 0.1, () => path(ctx, q.ground));

    // skirting boards: along the back wall and both side walls
    const sk = 14;
    fillPoly(ctx, quad([[l, floor - sk, 0], [r, floor - sk, 0], [r, floor, 0], [l, floor, 0]]), '#827c75');
    fillPoly(ctx, quad([[l, floor - sk, 0], [l, floor - sk, NEAR], [l, floor, NEAR], [l, floor, 0]]), '#5e5954');
    fillPoly(ctx, quad([[r, floor - sk, 0], [r, floor - sk, NEAR], [r, floor, NEAR], [r, floor, 0]]), '#66615b');

    // where the surfaces meet: soft, dark corners
    const c = (a, b, w = 20, al = 0.5) => crease(ctx, P(...a), P(...b), w, al);
    c([l, knee, 0], [l, floor, 0]);
    c([r, knee, 0], [r, floor, 0]);
    c([l, knee, 0], [cl, ceil, 0], 16, 0.4);
    c([cl, ceil, 0], [cr, ceil, 0], 16, 0.4);
    c([cr, ceil, 0], [r, knee, 0], 16, 0.4);
    c([l, floor, 0], [r, floor, 0], 14, 0.45);
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
    ctx.quadraticCurveTo((x + x2) / 2 + R(-3, 3), (y + y2) / 2 + R(-3, 3), x2, y2);
    ctx.stroke();
    const n = depth > 3 ? 2 : 3;
    for (let i = 0; i < n; i++) branch(ctx, x2, y2, len * R(0.62, 0.8), ang + R(-0.7, 0.7), width * 0.68, depth - 1);
  }

  /* ---------- outside: the house across the street ---------- */
  const OUT = (() => {
    const { x, y, w, h } = GLASS;
    const ridge = y + h * 0.4;
    const eaves = y + h * 0.57;
    return {
      ridge,
      eaves,
      chimneys: [[x + w * 0.44, ridge - 46, 20, 60], [x + w * 0.9, ridge - 34, 18, 48]],
      gable: [x + w * 0.22, x + w * 0.36, ridge - 22],
      windows: [0.12, 0.43, 0.75].map((fx) => [x + w * fx, eaves + 22, w * 0.12, 54])
    };
  })();

  // the house's outline against the sky (roof, gable, chimneys)
  function houseShape(ctx) {
    const { x, y, w, h } = GLASS;
    const { ridge, eaves, chimneys, gable } = OUT;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + h + 10);
    ctx.lineTo(x - 10, eaves - 4);
    ctx.lineTo(x + w * 0.06, ridge);
    ctx.lineTo(gable[0] + 6, ridge);
    ctx.lineTo((gable[0] + gable[1]) / 2, gable[2]);
    ctx.lineTo(gable[1] - 6, ridge);
    ctx.lineTo(x + w * 0.96, ridge);
    ctx.lineTo(x + w + 10, eaves - 4);
    ctx.lineTo(x + w + 10, y + h + 10);
    ctx.closePath();
    chimneys.forEach(([cx, cy, cw, ch]) => ctx.rect(cx - 2, cy - 4, cw + 4, ch));
  }

  function paintOutside(ctx) {
    const { x, y, w, h } = GLASS;
    const { ridge, eaves, chimneys, gable, windows } = OUT;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    // the sky, going gold towards the roofs
    ctx.fillStyle = lin(ctx, 0, y, 0, ridge + 10, [[0, '#86aee0'], [0.35, '#b6c5e2'], [0.72, '#f3d0a4'], [1, '#ffb25e']]);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = rad(ctx, SUN[0], SUN[1], 0, 180, [[0, 'rgba(255, 242, 210, 0.95)'], [0.22, 'rgba(255, 206, 132, 0.55)'], [1, 'rgba(255, 180, 100, 0)']]);
    ctx.fillRect(x, y, w, h);
    // long thin clouds
    [[0.25, 0.16, 90], [0.7, 0.1, 70], [0.5, 0.26, 120]].forEach(([fx, fy, len]) => {
      ctx.fillStyle = 'rgba(255, 226, 196, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x + w * fx, y + h * fy, len, 4, -0.03, 0, 7);
      ctx.fill();
    });
    // a bare branch reaching in from the top corner
    rnd = mulberry(12);
    ctx.strokeStyle = 'rgba(48, 38, 42, 0.8)';
    branch(ctx, x + w + 6, y + 18, 46, 2.75, 4, 6);
    branch(ctx, x + w + 6, y + 70, 34, 3.0, 3, 5);
    rnd = mulberry(21);

    // the roof: grey metal, backlit, its ridge catching the sun
    houseShape(ctx);
    ctx.fillStyle = lin(ctx, 0, ridge, 0, eaves, [[0, '#6c6f7d'], [1, '#4d505c']]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.lineWidth = 1;
    for (let sx = x; sx < x + w; sx += 7) {
      ctx.beginPath();
      ctx.moveTo(sx, ridge);
      ctx.lineTo(sx - 3, eaves);
      ctx.stroke();
    }
    line(ctx, [x + w * 0.06, ridge], [x + w * 0.96, ridge], 'rgba(255, 214, 160, 0.9)', 2);
    // the little gable facing us, white-trimmed
    const [g0, g1, gt] = gable;
    fillPoly(ctx, [[g0, eaves], [(g0 + g1) / 2, gt], [g1, eaves]], '#7b7f8c');
    ctx.strokeStyle = '#d9d2ca';
    ctx.lineWidth = 2.5;
    path(ctx, [[g0, eaves], [(g0 + g1) / 2, gt], [g1, eaves]], false);
    ctx.stroke();
    // chimneys, brick, lit on the edge nearest the sun
    chimneys.forEach(([cx, cy, cw, ch]) => {
      ctx.fillStyle = lin(ctx, cx, 0, cx + cw, 0, [[0, '#8a4332'], [1, '#b0573c']]);
      ctx.fillRect(cx, cy, cw, ch);
      ctx.fillStyle = '#6b3428';
      ctx.fillRect(cx - 2, cy - 4, cw + 4, 5);
      ctx.fillStyle = 'rgba(255, 200, 140, 0.8)';
      ctx.fillRect(cx + cw - 2, cy, 2, ch * 0.6);
    });
    // the brick front, in its own shade
    ctx.fillStyle = lin(ctx, 0, eaves, 0, y + h, [[0, '#a2503a'], [1, '#7c3a2b']]);
    ctx.fillRect(x, eaves, w, y + h - eaves);
    ctx.strokeStyle = 'rgba(60, 24, 16, 0.35)';
    ctx.lineWidth = 0.8;
    for (let by = eaves + 4, k = 0; by < y + h; by += 4.5, k++) {
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(x + w, by);
      ctx.stroke();
      for (let bx = x + (k % 2) * 5; bx < x + w; bx += 10) {
        ctx.beginPath();
        ctx.moveTo(bx, by - 4.5);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#d6cec5';
    ctx.fillRect(x, eaves - 1, w, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, eaves + 4, w, 5);
    // its windows, white frames, the sky in the glass
    windows.forEach(([wx, wy, ww, wh]) => {
      ctx.fillStyle = '#e2dbd3';
      ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      ctx.fillStyle = lin(ctx, 0, wy, 0, wy + wh, [[0, '#7f8fb0'], [1, '#48526c']]);
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#e2dbd3';
      ctx.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
      ctx.fillRect(wx, wy + wh * 0.35, ww, 3);
    });
    // the warm haze of the low sun over everything outside
    ctx.fillStyle = 'rgba(255, 190, 130, 0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function paintWindow(ctx) {
    const { l, r, t, b, inset } = WIN;
    // the recess: the four sides of the hole in the wall, running into it
    const o = [P(l, t, 0), P(r, t, 0), P(r, b, 0), P(l, b, 0)];
    const i = [P(l, t, inset), P(r, t, inset), P(r, b, inset), P(l, b, inset)];
    fillPoly(ctx, [o[0], o[1], i[1], i[0]], '#46423f');   // top (in shadow)
    fillPoly(ctx, [o[0], i[0], i[3], o[3]], '#7c766f');   // left (the sun reaches it)
    fillPoly(ctx, [i[1], o[1], o[2], i[2]], '#56514c');   // right
    fillPoly(ctx, [i[3], i[2], o[2], o[3]], '#86807a');   // bottom

    paintOutside(ctx);

    // the frame: white plastic, seen against the light
    const bar = (x0, y0, x1, y1, col = '#aaa49e') => fillPoly(ctx, quad([[x0, y0, inset], [x1, y0, inset], [x1, y1, inset], [x0, y1, inset]]), col);
    const y0 = t + WIN.transom + FR;
    const y1 = b - FR;
    const rh = (y1 - y0) / 3;
    const cx0 = l + WIN.side + FR;
    const cx1 = r - WIN.side - FR;
    const cw = (cx1 - cx0) / 3;
    for (let k = 1; k < 3; k++) bar(l, y0 + k * rh - MU / 2, r, y0 + k * rh + MU / 2, '#b3ada7');
    for (let k = 1; k < 3; k++) bar(cx0 + k * cw - MU / 2, y0, cx0 + k * cw + MU / 2, y1, '#b3ada7');
    bar(l, t, r, t + FR);
    bar(l, b - FR, r, b);
    bar(l, t, l + FR, b);
    bar(r - FR, t, r, b);
    bar(l, t + WIN.transom, r, y0);
    bar(l + WIN.side, t + WIN.transom, cx0, b);
    bar(cx1, t + WIN.transom, r - WIN.side, b);
    // the handles on the two sashes that open
    bar(l + WIN.side - 7, (y0 + y1) / 2 - 12, l + WIN.side - 3, (y0 + y1) / 2 + 14, '#d6d0c9');
    bar(r - WIN.side + 3, (y0 + y1) / 2 - 12, r - WIN.side + 7, (y0 + y1) / 2 + 14, '#d6d0c9');

    // the sill, white, sticking out towards you, a water bottle on it
    box(ctx, l - 24, r + 24, b, b + 10, 0, 0.035, { top: '#a39c94', front: '#7a746d' });
    const bb = P(r - 46, b, 0.02);
    const bt = P(r - 46, b - 44, 0.02);
    ctx.fillStyle = 'rgba(190, 205, 215, 0.35)';
    roundRect(ctx, bb[0] - 9, bt[1], 18, bb[1] - bt[1], 5);
    ctx.fill();
    ctx.fillStyle = '#3d5d8a';
    ctx.fillRect(bb[0] - 5, bt[1] - 6, 10, 7);
  }

  function paintRadiator(ctx) {
    const { l, r, t, b, z0, z1 } = RAD;
    soft(ctx, 16, 'rgba(0,0,0,0.45)', () => { path(ctx, quad([[l, t + 6, 0], [r, t + 6, 0], [r, b + 8, 0], [l, b + 8, 0]])); ctx.fill(); });
    // pipes down to the floor
    [l + 12, r - 12].forEach((X) => line(ctx, P(X, b, 0.012), P(X, ROOM.floor, 0.012), '#8e8881', 5));
    box(ctx, l, r, t, b, z0, z1, { top: '#bcb6af', front: '#a29c95', left: '#8d8780', right: '#8d8780' });
    const f = face(l, r, t, b, z0, z1, 'front');
    const n = 14;
    for (let k = 0; k < n; k++) {
      const a = f[0][0] + (f[1][0] - f[0][0]) * (k / n);
      const w = (f[1][0] - f[0][0]) / n;
      ctx.fillStyle = lin(ctx, a, 0, a + w, 0, [[0, 'rgba(0,0,0,0.28)'], [0.35, 'rgba(255,255,255,0.1)'], [0.7, 'rgba(0,0,0,0.05)'], [1, 'rgba(0,0,0,0.3)']]);
      ctx.fillRect(a, f[0][1] + 6, w, f[3][1] - f[0][1] - 12);
    }
  }

  // the blackout curtains: heavy, dark, pulled most of the way
  function curtainPoly(side) {
    const { top, z } = CUR;
    const floor = ROOM.floor + 2;
    return side === 'l'
      ? quad([[CUR.lOut, top, z], [CUR.lInTop, top, z], [CUR.lInBot, floor, z + 0.012], [CUR.lOut - 6, floor, z + 0.012]])
      : quad([[CUR.rInTop, top, z], [CUR.rOut, top, z], [CUR.rOut + 6, floor, z + 0.012], [CUR.rInBot, floor, z + 0.012]]);
  }

  function paintCurtains(ctx) {
    const rod = [P(430, 126, CUR.z), P(1180, 126, CUR.z)];
    ['l', 'r'].forEach((side) => {
      const poly = curtainPoly(side);
      soft(ctx, 26, 'rgba(0,0,0,0.5)', () => { path(ctx, poly.map(([a, b2]) => [a + (side === 'l' ? 10 : -10), b2 + 4])); ctx.fill(); });
      fillPoly(ctx, poly, '#2a2523');
      // folds: soft vertical waves across the fabric
      ctx.save();
      path(ctx, poly);
      ctx.clip();
      const [tl, tr, br, bl] = poly;
      const folds = 8;
      for (let k = 0; k < folds; k++) {
        const u0 = k / folds;
        const u1 = (k + 1) / folds;
        const at = (p, q2, u) => [p[0] + (q2[0] - p[0]) * u, p[1] + (q2[1] - p[1]) * u];
        const a = at(tl, tr, u0);
        const b2 = at(tl, tr, u1);
        const c2 = at(bl, br, u1);
        const d = at(bl, br, u0);
        const midA = [(a[0] + d[0]) / 2, 0];
        const midB = [(b2[0] + c2[0]) / 2, 0];
        const lift = 0.1 + 0.08 * Math.sin(k * 2.3);
        ctx.fillStyle = lin(ctx, midA[0], 0, midB[0], 0, [[0, 'rgba(0,0,0,0.38)'], [0.45, `rgba(150, 132, 118, ${lift})`], [1, 'rgba(0,0,0,0.3)']]);
        path(ctx, [a, b2, c2, d]);
        ctx.fill();
      }
      grain(ctx, 0.12, () => path(ctx, poly));
      ctx.restore();
      // the rings along the top
      for (let k = 0; k <= 8; k++) {
        const X = side === 'l' ? CUR.lOut + (CUR.lInTop - CUR.lOut) * (k / 8) : CUR.rInTop + (CUR.rOut - CUR.rInTop) * (k / 8);
        const p = P(X, CUR.top - 2, CUR.z);
        ctx.strokeStyle = 'rgba(120, 114, 108, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(p[0], p[1], 4, 3, 0, 0, 7);
        ctx.stroke();
      }
    });
    line(ctx, rod[0], rod[1], '#1b1918', 4);
  }

  // a socket low on the back wall, the fan's cable running out of it
  function paintSocket(ctx) {
    const a = P(300, 520, 0);
    ctx.fillStyle = '#8f8a84';
    ctx.fillRect(a[0] - 16, a[1] - 9, 32, 18);
    ctx.fillStyle = '#2a2826';
    [[-7, 0], [7, 0]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(a[0] + dx, a[1] + dy, 2.4, 0, 7); ctx.fill(); });
    const end = P(FAN.X - 10, ROOM.floor, FAN.z);
    ctx.strokeStyle = '#161514';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a[0] + 7, a[1]);
    ctx.bezierCurveTo(a[0] + 10, a[1] + 90, end[0] - 90, end[1] - 20, end[0], end[1]);
    ctx.stroke();
  }

  // pictures on the back wall, right of the curtains: a painting of flowers by the sea, and two small ones
  function paintFrames(ctx, covers) {
    FRAMES.forEach(([x0, x1, y0, y1], i) => {
      const q = quad([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]]);
      soft(ctx, 10, 'rgba(0,0,0,0.55)', () => { path(ctx, q.map(([a, b]) => [a + 3, b + 6])); ctx.fill(); });
      fillPoly(ctx, q, '#141312');
      const pad = i ? 5 : 7;
      const [a, b] = [P(x0 + pad, y0 + pad, 0), P(x1 - pad, y1 - pad, 0)];
      if (i === 0) {
        // the painting: sky, sea, a bunch of flowers in a vase
        ctx.fillStyle = lin(ctx, 0, a[1], 0, b[1], [[0, '#8fa6c8'], [0.45, '#c7c9d8'], [0.5, '#3e6b9a'], [1, '#5a86b0']]);
        ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        const fx = (a[0] + b[0]) / 2;
        const fy = a[1] + (b[1] - a[1]) * 0.55;
        ctx.fillStyle = '#6a4a38';
        ctx.fillRect(fx - 10, fy + 10, 20, (b[1] - fy) - 14);
        for (let k = 0; k < 26; k++) {
          ctx.fillStyle = ['#e8a2a8', '#f2e6d8', '#d9674f', '#f0c05a', '#b98fc8', '#6d8a52'][k % 6];
          ctx.beginPath();
          ctx.arc(fx + R(-30, 30), fy + R(-34, 8), R(4, 9), 0, 7);
          ctx.fill();
        }
        grain(ctx, 0.3, () => { ctx.beginPath(); ctx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); });
      } else {
        const img = covers[(i * 5) % Math.max(1, covers.length)];
        ctx.fillStyle = '#d8d0c4';
        ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        if (img) {
          ctx.globalAlpha = 0.85;
          ctx.drawImage(img, a[0] + 3, a[1] + 3, b[0] - a[0] - 6, b[1] - a[1] - 6);
          ctx.globalAlpha = 1;
        }
      }
    });
  }

  // the left wall above the bed: pictures, pinned up in a loose grid, fairy lights over them
  function paintPhotoWall(ctx, covers) {
    const X = ROOM.l;
    let k = 0;
    const cols = 6;
    const rows = 4;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (rnd() < 0.15) continue;
        const za = PHOTOS.z0 + (PHOTOS.z1 - PHOTOS.z0) * (col / cols) + R(-0.002, 0.002);
        const zb = za + (PHOTOS.z1 - PHOTOS.z0) / cols * 0.72;
        const ya = PHOTOS.t + (PHOTOS.b - PHOTOS.t) * (row / rows) + R(-3, 3);
        const yb = ya + (PHOTOS.b - PHOTOS.t) / rows * 0.78;
        const q = quad([[X, ya, za], [X, ya, zb], [X, yb, zb], [X, yb, za]]);
        fillPoly(ctx, q.map(([a, b]) => [a + 2, b + 3]), 'rgba(0,0,0,0.4)');
        fillPoly(ctx, q, '#b9b2a7');
        const img = covers[k % Math.max(1, covers.length)];
        if (img) {
          ctx.globalAlpha = 0.85;
          const zi0 = za + (zb - za) * 0.1;
          const zi1 = zb - (zb - za) * 0.1;
          const yi0 = ya + (yb - ya) * 0.08;
          const yi1 = yb - (yb - ya) * 0.24;
          imageQuad(ctx, img, P(X, yi0, zi0), P(X, yi0, zi1), P(X, yi1, zi0));
          ctx.globalAlpha = 1;
        }
        fillPoly(ctx, q, 'rgba(30, 24, 20, 0.2)');
        k++;
      }
    }
    ctx.strokeStyle = 'rgba(20, 16, 14, 0.8)';
    ctx.lineWidth = 1.3;
    path(ctx, lightString(), false);
    ctx.stroke();
    lightBulbs().forEach(([bx, by]) => {
      ctx.fillStyle = '#c4b89c';
      ctx.beginPath();
      ctx.ellipse(bx, by + 4, 3, 4.5, 0, 0, 7);
      ctx.fill();
    });
  }

  // fairy lights sagging along the left wall, over the pictures
  function lightString() {
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const z = 0.01 + (k / 40) * 0.26;
      const sag = Math.sin(((k % 13.34) / 13.34) * Math.PI) * 22;
      pts.push(P(ROOM.l, 312 + sag, z));
    }
    return pts;
  }
  const lightBulbs = () => lightString().filter((_, i) => i % 3 === 1);

  // a black shelf hung on the right wall, papers in it
  function paintWallShelf(ctx) {
    const { l, r, t, b, z0, z1 } = SHELF;
    soft(ctx, 14, 'rgba(0,0,0,0.5)', () => { path(ctx, quad([[r, t + 10, z0], [r, t + 10, z1 + 0.02], [r, b + 24, z1 + 0.02], [r, b + 24, z0]])); ctx.fill(); });
    box(ctx, l, r, t, b, z0, z1, { bottom: '#111010', left: '#0f0e0e', front: '#1c1a19' });
    // the papers inside, seen through the open side
    for (let k = 0; k < 5; k++) {
      const y = b - 4 - k * 3;
      fillPoly(ctx, quad([[l + 1, y - 2, z0 + 0.03 + k * 0.004], [l + 1, y - 2, z0 + 0.13 - k * 0.006], [l + 1, y, z0 + 0.13 - k * 0.006], [l + 1, y, z0 + 0.03 + k * 0.004]]), ['#bdb6ad', '#a79f95', '#c9c1b6'][k % 3]);
    }
    fillPoly(ctx, quad([[l + 1, t + 12, z0 + 0.16], [l + 1, t + 12, z0 + 0.2], [l + 1, b - 2, z0 + 0.2], [l + 1, b - 2, z0 + 0.16]]), '#3d4c63');
  }

  // the note taped to the wall under it
  let noteCanvas = null;
  function paintNote(ctx) {
    if (!noteCanvas) {
      noteCanvas = document.createElement('canvas');
      noteCanvas.width = 200;
      noteCanvas.height = 150;
      const n = noteCanvas.getContext('2d');
      n.fillStyle = '#cfc8bc';
      n.fillRect(0, 0, 200, 150);
      n.fillStyle = 'rgba(210, 180, 130, 0.8)';
      n.fillRect(80, 0, 40, 12);
      n.fillStyle = '#2e2828';
      n.textAlign = 'center';
      n.font = '600 32px Caveat, cursive';
      n.fillText("hi, it's renn", 100, 66);
      n.font = '600 22px Caveat, cursive';
      n.fillText('(come in)', 100, 100);
      n.strokeStyle = 'rgba(40, 36, 36, 0.35)';
      n.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) {
        n.beginPath();
        n.moveTo(24, 118 + k * 9);
        n.lineTo(24 + 60 + ((k * 47) % 90), 118 + k * 9);
        n.stroke();
      }
    }
    const X = ROOM.r;
    const q = quad([[X, NOTE.t, NOTE.z0], [X, NOTE.t, NOTE.z1], [X, NOTE.b, NOTE.z1], [X, NOTE.b, NOTE.z0]]);
    soft(ctx, 8, 'rgba(0,0,0,0.5)', () => { path(ctx, q.map(([a, b]) => [a - 3, b + 5])); ctx.fill(); });
    imageQuad(ctx, noteCanvas, q[0], q[1], q[3]);
    fillPoly(ctx, q, 'rgba(30, 26, 22, 0.18)');
  }

  /* ---------- the wire lamp on the ceiling ---------- */
  function lampArms() {
    const { X, z, Y, arm } = LAMPC;
    return [0, 1, 2, 3, 4].map((k) => {
      const a = k * (Math.PI * 2 / 5) + 0.35;
      return { a, end: [X + Math.cos(a) * arm, Y + 8, z + Math.sin(a) * arm / 1000] };
    });
  }

  function paintChandelier(ctx) {
    const { X, z, Y } = LAMPC;
    const top = P(X, ROOM.ceil, z);
    const hub = P(X, Y, z);
    const s = sc(z);
    ctx.fillStyle = '#141313';
    ctx.beginPath();
    ctx.ellipse(top[0], top[1] + 2, 12 * s, 3 * s, 0, 0, 7);
    ctx.fill();
    line(ctx, top, hub, '#141313', 2.5 * s);
    // farthest arms first
    lampArms().sort((p, q) => p.end[2] - q.end[2]).forEach(({ a, end }) => {
      const e = P(...end);
      const es = sc(end[2]);
      line(ctx, hub, e, '#141313', 2 * es);
      // the bulb
      ctx.fillStyle = '#d8d2c8';
      ctx.beginPath();
      ctx.ellipse(e[0] + Math.cos(a) * 6 * es, e[1] + 2 * es, 5 * es, 6.5 * es, 0, 0, 7);
      ctx.fill();
      // the wire cage: two tilted squares around it
      ctx.strokeStyle = 'rgba(16, 15, 15, 0.95)';
      ctx.lineWidth = 1.1 * es;
      const ang = Math.atan2(Math.sin(a) * 0.35, Math.cos(a));
      [0, 0.45].forEach((tw) => {
        ctx.save();
        ctx.translate(e[0] + Math.cos(a) * 8 * es, e[1] + 2 * es);
        ctx.rotate(ang + tw);
        ctx.strokeRect(-15 * es, -11 * es, 30 * es, 22 * es);
        ctx.restore();
      });
    });
    ctx.fillStyle = '#141313';
    ctx.beginPath();
    ctx.arc(hub[0], hub[1], 4 * s, 0, 7);
    ctx.fill();
  }

  /* ---------- the floor: a striped rug by the desk, a dark shaggy one in front ---------- */
  function paintRugs(ctx) {
    const floor = ROOM.floor;
    {
      const { l, r, z0, z1 } = RUG;
      const outline = quad([[l, floor, z0], [r, floor, z0], [r, floor, z1], [l, floor, z1]]);
      soft(ctx, 6, 'rgba(0,0,0,0.35)', () => { path(ctx, outline); ctx.fill(); });
      fillPoly(ctx, outline, '#b5b2ab');
      ctx.save();
      path(ctx, outline);
      ctx.clip();
      // chevron stripes
      const n = 18;
      for (let i = -2; i < n + 2; i += 2) {
        const pts = [];
        const back = [];
        for (let k = 0; k <= 24; k++) {
          const z = z0 + (z1 - z0) * (k / 24);
          const zig = Math.abs(((k / 24) * 6) % 2 - 1) * 26;
          const X = l + (r - l) * (i / n) + zig;
          pts.push(P(X, floor, z));
          back.unshift(P(X + (r - l) / n, floor, z));
        }
        fillPoly(ctx, pts.concat(back), '#56606f');
      }
      grain(ctx, 0.3, () => path(ctx, outline));
      ctx.restore();
    }
    {
      const { l, r, z0, z1 } = SHAG;
      const pts = [];
      for (let k = 0; k <= 60; k++) {
        const u = k / 60;
        let X; let z;
        if (u < 0.25) { X = l + (r - l) * (u / 0.25); z = z0; }
        else if (u < 0.5) { X = r; z = z0 + (z1 - z0) * ((u - 0.25) / 0.25); }
        else if (u < 0.75) { X = r - (r - l) * ((u - 0.5) / 0.25); z = z1; }
        else { X = l; z = z1 - (z1 - z0) * ((u - 0.75) / 0.25); }
        pts.push(P(X + R(-5, 5), floor, z + R(-0.003, 0.003)));
      }
      soft(ctx, 12, 'rgba(0,0,0,0.5)', () => { path(ctx, pts); ctx.fill(); });
      fillPoly(ctx, pts, '#2e2926');
      ctx.save();
      path(ctx, pts);
      ctx.clip();
      for (let i = 0; i < 1400; i++) {
        const p = P(R(l, r), floor, R(z0, z1));
        ctx.strokeStyle = rnd() < 0.5 ? 'rgba(90, 82, 76, 0.35)' : 'rgba(10, 8, 8, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[0] + R(-3, 3), p[1] - R(3, 8));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // the guitar, standing in the corner, leaning back against the wall
  function guitarOutline(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, -238);
    ctx.bezierCurveTo(30, -238, 50, -222, 50, -196);
    ctx.bezierCurveTo(50, -172, 34, -160, 36, -144);
    ctx.bezierCurveTo(38, -126, 68, -112, 68, -76);
    ctx.bezierCurveTo(68, -28, 36, -6, 0, -6);
    ctx.bezierCurveTo(-36, -6, -68, -28, -68, -76);
    ctx.bezierCurveTo(-68, -112, -38, -126, -36, -144);
    ctx.bezierCurveTo(-34, -160, -50, -172, -50, -196);
    ctx.bezierCurveTo(-50, -222, -30, -238, 0, -238);
    ctx.closePath();
  }

  // a real guitar is ~1 m tall: 200 wall units, scaled by how close it stands
  function guitarPlace(ctx) {
    const foot = P(GUITAR.X, ROOM.floor, GUITAR.z);
    const s = (200 / (1 - GUITAR.z)) / 470;
    ctx.translate(foot[0], foot[1] + 3);
    ctx.rotate(0.1);
    ctx.scale(s, s);
  }

  function paintGuitar(ctx) {
    ctx.save();
    guitarPlace(ctx);
    soft(ctx, 16, 'rgba(0,0,0,0.6)', () => { ctx.save(); ctx.translate(-10, 4); ctx.scale(1, 0.12); ctx.beginPath(); ctx.ellipse(0, 0, 90, 40, 0, 0, 7); ctx.fill(); ctx.restore(); });
    soft(ctx, 20, 'rgba(0,0,0,0.45)', () => { ctx.save(); ctx.translate(30, -10); guitarOutline(ctx); ctx.fill(); ctx.restore(); });
    guitarOutline(ctx);
    ctx.fillStyle = '#2a1206';
    ctx.fill();
    ctx.save();
    ctx.translate(0, -122);
    ctx.scale(0.94, 0.965);
    ctx.translate(0, 122);
    guitarOutline(ctx);
    // orange sunburst
    ctx.fillStyle = rad(ctx, -10, -110, 10, 140, [[0, '#d98a3a'], [0.5, '#b0561f'], [1, '#4a1c08']]);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#1a0a04';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -140, 24, 0, 7);
    ctx.stroke();
    ctx.fillStyle = '#0e0603';
    ctx.beginPath();
    ctx.arc(0, -140, 19, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#1a0a04';
    roundRect(ctx, -26, -66, 52, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#23120a';
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

  // the standing fan by the curtain: black, round, a little turned
  function paintFan(ctx) {
    const { X, z, cy, r } = FAN;
    const s = sc(z);
    const [bx, by, brx, bry] = floorDisc(X, ROOM.floor, z, 44);
    soft(ctx, 10, 'rgba(0,0,0,0.6)', () => { ctx.beginPath(); ctx.ellipse(bx + 6, by + 3, brx * 1.1, bry * 1.3, 0, 0, 7); ctx.fill(); });
    ctx.fillStyle = lin(ctx, 0, by - bry, 0, by + bry, [[0, '#2a2828'], [1, '#0d0c0c']]);
    ctx.beginPath();
    ctx.ellipse(bx, by, brx, bry, 0, 0, 7);
    ctx.fill();
    const c = P(X, cy, z);
    line(ctx, [bx, by], [c[0], c[1] + 30 * s], '#121111', 5 * s);
    line(ctx, [bx, by - (by - c[1]) * 0.45], [bx + 5 * s, by - (by - c[1]) * 0.45], '#2a2828', 7 * s);
    // the motor behind, and the cage
    ctx.fillStyle = '#121111';
    ctx.beginPath();
    ctx.ellipse(c[0] - 10 * s, c[1], 18 * s, 20 * s, 0, 0, 7);
    ctx.fill();
    const rx = r * s * 0.82;
    const ry = r * s;
    ctx.fillStyle = 'rgba(18, 17, 17, 0.55)';
    [0, 1, 2].forEach((k) => {
      ctx.save();
      ctx.translate(c[0], c[1]);
      ctx.scale(0.82, 1);
      ctx.rotate(k * 2.09 + 0.4);
      ctx.beginPath();
      ctx.ellipse(0, -ry * 0.48, ry * 0.26, ry * 0.46, 0.25, 0, 7);
      ctx.fill();
      ctx.restore();
    });
    ctx.strokeStyle = 'rgba(14, 13, 13, 0.95)';
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], rx, ry, 0, 0, 7);
    ctx.stroke();
    ctx.lineWidth = 0.8 * s;
    [0.35, 0.62, 0.85].forEach((f) => { ctx.beginPath(); ctx.ellipse(c[0], c[1], rx * f, ry * f, 0, 0, 7); ctx.stroke(); });
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c[0] + Math.cos(a) * rx * 0.2, c[1] + Math.sin(a) * ry * 0.2);
      ctx.lineTo(c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry);
      ctx.stroke();
    }
    ctx.fillStyle = '#1c1b1b';
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], rx * 0.18, ry * 0.18, 0, 0, 7);
    ctx.fill();
  }

  /* ---------- the bed, along the left wall, running towards you ---------- */
  function bedTopQuad() {
    const { l, r, top, head, foot } = BED;
    return quad([[l, top, head], [r, top, head], [r, top, foot], [l, top, foot]]);
  }

  function paintBed(ctx) {
    const { l, r, top, rail, head, foot } = BED;
    const floor = ROOM.floor;
    soft(ctx, 24, 'rgba(0,0,0,0.7)', () => { path(ctx, quad([[l, floor, head], [r + 24, floor, head], [r + 24, floor, foot], [l, floor, foot]])); ctx.fill(); });
    // the headboard: dark wood, grooved
    box(ctx, l, r, 540, floor, head - 0.015, head, { top: '#4a3a2e', front: '#34281f', right: '#2a2019' });
    const hf = face(l, r, 540, floor, head - 0.015, head, 'front');
    for (let k = 1; k < 9; k++) {
      const x = hf[0][0] + (hf[1][0] - hf[0][0]) * (k / 9);
      line(ctx, [x, hf[0][1] + 6], [x, hf[3][1]], 'rgba(0,0,0,0.3)', 1.5);
    }
    // the frame and the side rail
    box(ctx, l, r, rail, floor - 30, head, foot, { right: '#2e231b' });
    // mattress under a white sheet
    box(ctx, l, r - 2, top, rail, head, foot, { top: '#b4afa7', right: '#9a948c' });
    const tq = bedTopQuad();
    ctx.save();
    path(ctx, tq);
    ctx.clip();
    // creases in the sheet
    for (let k = 0; k < 26; k++) {
      const z = R(head + 0.08, foot);
      const X = R(l + 10, r - 10);
      const a = P(X, top, z);
      const b = P(X + R(-60, 60), top, z + R(0.02, 0.06));
      const m = [(a[0] + b[0]) / 2 + R(-20, 20), (a[1] + b[1]) / 2 + R(-10, 10)];
      ctx.lineWidth = R(3, 8) * sc(z);
      ctx.strokeStyle = 'rgba(70, 66, 62, 0.22)';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]);
      ctx.stroke();
      ctx.lineWidth *= 0.5;
      ctx.strokeStyle = 'rgba(255, 252, 245, 0.16)';
      ctx.beginPath();
      ctx.moveTo(a[0] - 4, a[1] - 3);
      ctx.quadraticCurveTo(m[0] - 4, m[1] - 3, b[0] - 4, b[1] - 3);
      ctx.stroke();
    }
    ctx.restore();

    // a white pillow, and the plaid one in front of it
    [[262, 500, head + 0.004, head + 0.05, '#c8c2b9', false], [270, 470, head + 0.03, head + 0.085, '#8e8c88', true]].forEach(([x0, x1, z0, z1, col, plaid]) => {
      const tl = P(x0, top - 36, z0);
      const br = P(x1, top + 2, z1);
      soft(ctx, 10, 'rgba(0,0,0,0.5)', () => { roundRect(ctx, tl[0] + 5, tl[1] + 10, br[0] - tl[0], br[1] - tl[1], 16); ctx.fill(); });
      roundRect(ctx, tl[0], tl[1], br[0] - tl[0], br[1] - tl[1], 16);
      ctx.fillStyle = col;
      ctx.fill();
      if (plaid) {
        ctx.save();
        roundRect(ctx, tl[0], tl[1], br[0] - tl[0], br[1] - tl[1], 16);
        ctx.clip();
        for (let x = tl[0]; x < br[0]; x += 16) { ctx.fillStyle = 'rgba(40, 40, 46, 0.45)'; ctx.fillRect(x, tl[1], 5, br[1] - tl[1]); ctx.fillStyle = 'rgba(160, 60, 50, 0.3)'; ctx.fillRect(x + 9, tl[1], 1.5, br[1] - tl[1]); }
        for (let y = tl[1]; y < br[1]; y += 16) { ctx.fillStyle = 'rgba(40, 40, 46, 0.4)'; ctx.fillRect(tl[0], y, br[0] - tl[0], 5); }
        ctx.restore();
      }
      ctx.fillStyle = lin(ctx, 0, tl[1], 0, br[1], [[0, 'rgba(255,255,255,0.12)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.3)']]);
      roundRect(ctx, tl[0], tl[1], br[0] - tl[0], br[1] - tl[1], 16);
      ctx.fill();
    });

    // the grey check blanket, kicked down over the end of the bed
    const blanket = [];
    for (let k = 0; k <= 16; k++) {
      const u = k / 16;
      blanket.push(P(l + (r + 6 - l) * u, top - 6 - Math.sin(u * 9) * 5, 0.42 + Math.sin(u * 7 + 1) * 0.025));
    }
    blanket.push(P(r + 8, top - 4, foot), P(l, top - 4, foot));
    const side = [P(r + 6, top - 4, 0.44), P(r + 8, top, foot), P(r + 8, rail + 26, foot)];
    for (let k = 10; k >= 0; k--) side.push(P(r + 8, rail + 24 + Math.sin(k * 1.3) * 3, 0.44 + (foot - 0.44) * (k / 10)));
    [blanket, side].forEach((poly, i) => {
      fillPoly(ctx, poly, i ? '#3e4045' : '#4e5157');
      ctx.save();
      path(ctx, poly);
      ctx.clip();
      for (let z = 0.4; z < foot; z += 0.012) line(ctx, P(l - 50, top - 6, z), P(r + 60, top - 6, z), 'rgba(205, 210, 220, 0.2)', 1.2 * sc(z));
      for (let X = l - 40; X < r + 40; X += 12) line(ctx, P(X, top - 6, 0.4), P(X, top - 6, foot), 'rgba(205, 210, 220, 0.18)', 1.2);
      ctx.fillStyle = lin(ctx, 0, P(0, top, 0.42)[1], 0, H, [[0, 'rgba(255,255,255,0.06)'], [1, 'rgba(0,0,0,0.35)']]);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    });
    crease(ctx, blanket[0], blanket[16], 8, 0.4);
  }

  // what's on the bed: the laptop (open, facing you), the cards
  function laptopQuads() {
    const { l, r, z0, z1 } = LAPTOP;
    const y = BED.top - 2;
    const baseQ = quad([[l, y, z0], [r, y, z0], [r, y, z1], [l, y, z1]]);
    const lidQ = quad([[l, y - 64, z0 - 0.018], [r, y - 64, z0 - 0.018], [r, y, z0], [l, y, z0]]);
    const screenQ = quad([[l + 5, y - 60, z0 - 0.016], [r - 5, y - 60, z0 - 0.016], [r - 5, y - 5, z0 - 0.001], [l + 5, y - 5, z0 - 0.001]]);
    return { baseQ, lidQ, screenQ };
  }

  let screenCanvas = null;
  function screenImage() {
    if (screenCanvas) return screenCanvas;
    screenCanvas = document.createElement('canvas');
    screenCanvas.width = 160;
    screenCanvas.height = 100;
    const s = screenCanvas.getContext('2d');
    s.fillStyle = lin(s, 0, 0, 160, 100, [[0, '#1c1f3a'], [1, '#2a1830']]);
    s.fillRect(0, 0, 160, 100);
    // a show, paused: a pink-haired girl against a blue city sky
    s.fillStyle = lin(s, 0, 0, 0, 60, [[0, '#6f8fd0'], [1, '#c9b7c8']]);
    s.fillRect(46, 8, 110, 52);
    s.fillStyle = '#3d4466';
    for (let k = 0; k < 9; k++) s.fillRect(50 + k * 12, 36 - (k * 7) % 18, 8, 30);
    s.fillStyle = '#f07aa0';
    s.beginPath(); s.arc(130, 44, 13, 0, 7); s.fill();
    s.fillStyle = '#ff4f7c';
    s.beginPath(); s.arc(119, 34, 5, 0, 7); s.arc(141, 34, 5, 0, 7); s.fill();
    s.fillStyle = '#2b2b3b';
    s.beginPath(); s.arc(96, 38, 9, 0, 7); s.fill();
    s.fillStyle = 'rgba(255,255,255,0.8)';
    s.fillRect(6, 10, 34, 4);
    s.fillRect(6, 18, 26, 3);
    s.fillStyle = '#f6c6d8';
    s.fillRect(6, 8, 34, 44);
    s.fillStyle = 'rgba(255,255,255,0.35)';
    for (let k = 0; k < 3; k++) s.fillRect(6 + k * 50, 68, 44, 22);
    s.fillStyle = 'rgba(120, 160, 255, 0.9)';
    s.fillRect(0, 0, 160, 3);
    return screenCanvas;
  }

  function paintOnBed(ctx) {
    const { baseQ, lidQ, screenQ } = laptopQuads();
    soft(ctx, 8, 'rgba(0,0,0,0.6)', () => { path(ctx, baseQ.map(([a, b]) => [a + 4, b + 5])); ctx.fill(); });
    fillPoly(ctx, baseQ, '#3b3c42');
    ctx.save();
    path(ctx, baseQ);
    ctx.clip();
    for (let k = 1; k < 6; k++) line(ctx, P(LAPTOP.l, BED.top - 2, LAPTOP.z0 + (LAPTOP.z1 - LAPTOP.z0) * k / 8), P(LAPTOP.r, BED.top - 2, LAPTOP.z0 + (LAPTOP.z1 - LAPTOP.z0) * k / 8), 'rgba(0,0,0,0.45)', 1);
    ctx.restore();
    fillPoly(ctx, lidQ, '#26272c');
    imageQuad(ctx, screenImage(), screenQ[0], screenQ[1], screenQ[3]);
    // cards, fanned, lying flat on the sheet
    for (let i = 0; i < 5; i++) {
      const x = CARDS.x + i * 12;
      const z = CARDS.z + (i - 2) * 0.004;
      const q = quad([[x, BED.top - 1, z - 0.024], [x + 20, BED.top - 1, z - 0.027], [x + 24, BED.top - 1, z + 0.016], [x + 4, BED.top - 1, z + 0.019]]);
      fillPoly(ctx, q.map(([a, b]) => [a + 2, b + 2]), 'rgba(0,0,0,0.35)');
      fillPoly(ctx, q, '#26143a');
      path(ctx, q);
      ctx.strokeStyle = '#a88f5a';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  // the white nightstand beside the bed: the green alarm clock, and the letter
  function paintNightstand(ctx) {
    const { l, r, t, z0, z1 } = NIGHT;
    const floor = ROOM.floor;
    soft(ctx, 14, 'rgba(0,0,0,0.6)', () => { path(ctx, quad([[l - 6, floor, z0], [r + 10, floor, z0], [r + 10, floor, z1 + 0.02], [l - 6, floor, z1 + 0.02]])); ctx.fill(); });
    box(ctx, l, r, t, floor, z0, z1, { top: '#a39d94', front: '#7d7770', right: '#6b655f' });
    const f = face(l, r, t, floor, z0, z1, 'front');
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(f[0][0] + 6, f[0][1] + 8, f[1][0] - f[0][0] - 12, (f[3][1] - f[0][1]) * 0.3);
    // the letter, sealed
    const lt = quad([[l + 8, t, z0 + 0.02], [l + 42, t, z0 + 0.016], [l + 44, t, z0 + 0.07], [l + 10, t, z0 + 0.074]]);
    fillPoly(ctx, lt.map(([a, b]) => [a + 2, b + 2]), 'rgba(0,0,0,0.3)');
    fillPoly(ctx, lt, '#c9bda6');
    const seal = P(l + 26, t, z0 + 0.045);
    ctx.fillStyle = '#7d1f2c';
    ctx.beginPath();
    ctx.arc(seal[0], seal[1], 3.5, 0, 7);
    ctx.fill();
    // the alarm clock: green, two bells
    const s = sc(CLOCK.z);
    const base = P(CLOCK.X, t, CLOCK.z);
    const cr = CLOCK.r * s;
    const c = [base[0], base[1] - cr - 6 * s];
    soft(ctx, 8, 'rgba(0,0,0,0.5)', () => { ctx.beginPath(); ctx.ellipse(base[0] + 4, base[1], cr, 5 * s, 0, 0, 7); ctx.fill(); });
    ctx.strokeStyle = '#b39a55';
    ctx.lineWidth = 2 * s;
    [-0.6, 0.6].forEach((d) => { ctx.beginPath(); ctx.moveTo(c[0] + d * cr, c[1] + cr * 0.7); ctx.lineTo(c[0] + d * cr * 1.25, base[1]); ctx.stroke(); });
    ctx.beginPath();
    ctx.arc(c[0], c[1] - cr * 1.05, cr * 0.6, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = '#23483a';
    [-0.55, 0.55].forEach((d) => { ctx.beginPath(); ctx.arc(c[0] + d * cr, c[1] - cr * 0.85, cr * 0.36, Math.PI, 0); ctx.fill(); });
    ctx.fillStyle = rad(ctx, c[0] - cr * 0.3, c[1] - cr * 0.3, 1, cr * 1.2, [[0, '#3c7a5e'], [1, '#1c3a2e']]);
    ctx.beginPath();
    ctx.arc(c[0], c[1], cr, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#d8d2c6';
    ctx.beginPath();
    ctx.arc(c[0], c[1], cr * 0.78, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#2a2826';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c[0] + Math.cos(a) * cr * 0.62, c[1] + Math.sin(a) * cr * 0.62);
      ctx.lineTo(c[0] + Math.cos(a) * cr * 0.72, c[1] + Math.sin(a) * cr * 0.72);
      ctx.stroke();
    }
    // 5:47
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(c[0], c[1]);
    ctx.lineTo(c[0] + Math.cos(Math.PI * 2 * (5.78 / 12) - Math.PI / 2) * cr * 0.4, c[1] + Math.sin(Math.PI * 2 * (5.78 / 12) - Math.PI / 2) * cr * 0.4);
    ctx.moveTo(c[0], c[1]);
    ctx.lineTo(c[0] + Math.cos(Math.PI * 2 * (47 / 60) - Math.PI / 2) * cr * 0.6, c[1] + Math.sin(Math.PI * 2 * (47 / 60) - Math.PI / 2) * cr * 0.6);
    ctx.stroke();
  }

  /* ---------- the desk against the right wall ---------- */
  function tapeSlots() {
    const song = Void.favorites || [];
    const out = [];
    let z = DESK.z0 + 0.03;
    let i = 0;
    while (z < DESK.z0 + 0.15) {
      out.push({ z, dz: 0.0085, col: song[i % Math.max(1, song.length)]?.palette?.[3] || '#777' });
      z += 0.0095;
      i++;
    }
    return out;
  }

  function paintDesk(ctx) {
    const { l, r, t, z0, z1 } = DESK;
    const floor = ROOM.floor;
    soft(ctx, 20, 'rgba(0,0,0,0.5)', () => { path(ctx, quad([[l, floor, z0], [r, floor, z0], [r, floor, z1], [l, floor, z1]])); ctx.fill(); });
    // the hutch: a side panel at the back, two shelves
    box(ctx, HUTCH.l, r, HUTCH.top, t, z0, z0 + 0.012, { left: '#8a7255', front: '#9c8262', bottom: '#6d5a44' });
    // tapes standing in the hutch, spines to the room
    tapeSlots().forEach(({ z, dz, col }) => {
      const x = HUTCH.l + 4;
      const q = quad([[x, HUTCH.shelf + 22, z], [x, HUTCH.shelf + 22, z + dz], [x, t, z + dz], [x, t, z]]);
      fillPoly(ctx, q, col);
      fillPoly(ctx, quad([[x, HUTCH.shelf + 32, z + dz * 0.2], [x, HUTCH.shelf + 32, z + dz * 0.75], [x, t - 12, z + dz * 0.75], [x, t - 12, z + dz * 0.2]]), 'rgba(240, 225, 200, 0.55)');
      fillPoly(ctx, q, 'rgba(0,0,0,0.25)');
    });
    // mugs on the shelf
    [[0.26, '#5d8a66'], [0.3, '#d6d0c6'], [0.35, '#5d8a66']].forEach(([z, col]) => {
      const a = P(HUTCH.l + 20, HUTCH.shelf - 34, z);
      const b = P(HUTCH.l + 20, HUTCH.shelf, z + 0.02);
      ctx.fillStyle = col;
      ctx.fillRect(a[0] - 8 * sc(z), a[1], 18 * sc(z), b[1] - a[1]);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(a[0] + 4 * sc(z), a[1], 6 * sc(z), b[1] - a[1]);
    });
    [HUTCH.shelf, HUTCH.top].forEach((y) => box(ctx, HUTCH.l, r, y, y + 8, z0, z1, { left: '#8a7255', bottom: '#6d5a44', top: '#a88f6e', front: '#7d6750' }));
    // chrome legs
    [[l + 10, z0 + 0.01], [l + 10, z1 - 0.01]].forEach(([X, z]) => {
      const a = P(X, t + 15, z);
      const b = P(X, floor, z);
      const w = 7 * sc(z);
      ctx.fillStyle = lin(ctx, a[0] - w / 2, 0, a[0] + w / 2, 0, [[0, '#5a5856'], [0.4, '#c8c4be'], [1, '#3a3836']]);
      ctx.fillRect(a[0] - w / 2, a[1], w, b[1] - a[1]);
    });
    // the top: light wood
    box(ctx, l, r, t, t + 15, z0, z1, { top: '#a88f6e', left: '#7d6750', front: '#7d6750' });
    // a white desk lamp bending over it
    const lb = P(DESK.l + 55, t, 0.27);
    const s = sc(0.27);
    ctx.fillStyle = '#d0cac2';
    ctx.beginPath();
    ctx.ellipse(lb[0], lb[1], 16 * s, 4 * s, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#cfc9c1';
    ctx.lineWidth = 3.5 * s;
    ctx.beginPath();
    ctx.moveTo(lb[0], lb[1]);
    ctx.quadraticCurveTo(lb[0] - 4 * s, lb[1] - 95 * s, lb[0] - 34 * s, lb[1] - 88 * s);
    ctx.stroke();
    fillPoly(ctx, deskLampHead(), '#dcd6ce');
  }
  function deskLampHead() {
    const lb = P(DESK.l + 55, DESK.t, 0.27);
    const s = sc(0.27);
    return [[lb[0] - 26 * s, lb[1] - 94 * s], [lb[0] - 44 * s, lb[1] - 86 * s], [lb[0] - 48 * s, lb[1] - 70 * s], [lb[0] - 22 * s, lb[1] - 80 * s]];
  }

  // the keyboard bench: a black padded seat on crossed legs
  function paintBench(ctx) {
    const { l, r, t, z0, z1 } = BENCH;
    const floor = ROOM.floor;
    soft(ctx, 12, 'rgba(0,0,0,0.5)', () => { path(ctx, quad([[l, floor, z0], [r, floor, z0], [r, floor, z1], [l, floor, z1]])); ctx.fill(); });
    [z0 + 0.008, z1 - 0.008].forEach((z) => {
      const w = 5 * sc(z);
      line(ctx, P(l + 8, t + 14, z), P(r - 8, floor, z), '#121111', w);
      line(ctx, P(r - 8, t + 14, z), P(l + 8, floor, z), '#121111', w);
    });
    [l + 8, r - 8].forEach((X) => line(ctx, P(X, floor - 3, z0), P(X, floor - 3, z1), '#121111', 5 * sc(z1)));
    box(ctx, l, r, t, t + 14, z0, z1, { top: '#26242a', front: '#141316', left: '#1a191c' });
    const tp = face(l, r, t, t + 14, z0, z1, 'top');
    ctx.fillStyle = lin(ctx, 0, tp[0][1], 0, tp[2][1], [[0, 'rgba(255,255,255,0.08)'], [1, 'rgba(0,0,0,0)']]);
    path(ctx, tp);
    ctx.fill();
  }

  /* ==========================================================
     THE LIGHT
     ========================================================== */
  // the open panes, pushed along the sunlight onto a horizontal plane
  function panesOnPlane(Yp) {
    return openPanes().map(([x, y, w, h]) => [onPlane(x, y + h, Yp), onPlane(x + w, y + h, Yp), onPlane(x + w, y, Yp), onPlane(x, y, Yp)].map((p) => P(...p)));
  }

  function paintSun(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const floor = ROOM.floor;
    const q = shellQuads();

    // the window, lying on the floor
    ctx.save();
    path(ctx, q.ground);
    ctx.clip();
    panesOnPlane(floor).forEach((p) => soft(ctx, 7, 'rgba(255,0,0,0.72)', () => { path(ctx, p); ctx.fill(); }));
    ctx.restore();

    // the bounce off that patch: onto the ceiling, the wall under the window, the curtains' hems
    const patch = P(800, floor, 0.3);
    soft(ctx, 140, 'rgba(255,0,0,0.16)', () => { path(ctx, quad([[ROOM.cl + 60, ROOM.ceil, 0.02], [ROOM.cr - 60, ROOM.ceil, 0.02], [ROOM.cr - 60, ROOM.ceil, 0.25], [ROOM.cl + 60, ROOM.ceil, 0.25]])); ctx.fill(); });
    soft(ctx, 90, 'rgba(255,0,0,0.16)', () => { ctx.beginPath(); ctx.ellipse(patch[0], P(0, 640, 0)[1], 300, 70, 0, 0, 7); ctx.fill(); });

    // rim light: the sill, the left side of the recess, the curtains' inner edges, the fan, the bench
    const sill = quad([[WIN.l - 24, WIN.b, 0], [WIN.r + 24, WIN.b, 0], [WIN.r + 24, WIN.b, 0.035], [WIN.l - 24, WIN.b, 0.035]]);
    soft(ctx, 5, 'rgba(255,0,0,0.85)', () => { path(ctx, sill); ctx.fill(); });
    soft(ctx, 10, 'rgba(255,0,0,0.5)', () => { path(ctx, [P(WIN.l, WIN.t + 60, 0), P(WIN.l, WIN.t + 60, WIN.inset), P(WIN.l, WIN.b, WIN.inset), P(WIN.l, WIN.b, 0)]); ctx.fill(); });
    [[CUR.lInTop, CUR.lInBot, -1], [CUR.rInTop, CUR.rInBot, 1]].forEach(([a, b, dir]) => {
      const p0 = P(a, WIN.t, CUR.z);
      const p1 = P(b + (a - b) * 0.2, ROOM.floor - 60, CUR.z + 0.01);
      ctx.lineWidth = 3;
      soft(ctx, 4, 'rgba(255,0,0,0.85)', () => { ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); });
      // light soaking through the fabric near the gap
      ctx.lineWidth = 40;
      soft(ctx, 26, 'rgba(255,0,0,0.3)', () => { ctx.beginPath(); ctx.moveTo(p0[0] + dir * 22, p0[1] + 40); ctx.lineTo(p1[0] + dir * 22, p1[1] - 60); ctx.stroke(); });
    });
    const fc = P(FAN.X, FAN.cy, FAN.z);
    const fs = sc(FAN.z);
    ctx.lineWidth = 3;
    soft(ctx, 4, 'rgba(255,0,0,0.6)', () => { ctx.beginPath(); ctx.ellipse(fc[0], fc[1], FAN.r * fs * 0.82, FAN.r * fs, 0, -1.2, 1.0); ctx.stroke(); });
    ctx.save();
    guitarPlace(ctx);
    ctx.lineWidth = 4;
    soft(ctx, 6, 'rgba(255,0,0,0.35)', () => {
      ctx.beginPath();
      ctx.moveTo(-44, -200);
      ctx.bezierCurveTo(-50, -180, -36, -160, -36, -144);
      ctx.bezierCurveTo(-38, -126, -68, -112, -68, -76);
      ctx.stroke();
    });
    ctx.restore();
    // the top of the headboard and the pillows
    const hb = [P(BED.l, 540, BED.head), P(BED.r, 540, BED.head)];
    ctx.lineWidth = 3;
    soft(ctx, 5, 'rgba(255,0,0,0.45)', () => { ctx.beginPath(); ctx.moveTo(hb[0][0], hb[0][1]); ctx.lineTo(hb[1][0], hb[1][1]); ctx.stroke(); });

    // G — the beam: the open window pushed out along the light, a shaft coming down at you
    const shaft = [];
    [[CUR.lIn, WIN.t], [CUR.rIn, WIN.t], [CUR.rIn, WIN.b], [CUR.lIn, WIN.b]].forEach(([x, y]) => {
      shaft.push(P(x, y, 0));
      shaft.push(P(...onPlane(x, y, floor)));
    });
    const hull = convexHull(shaft);
    const g0 = P(800, 360, 0);
    const g1 = P(...onPlane(800, 360, floor));
    ctx.save();
    ctx.globalAlpha = 0.85;
    const gg = ctx.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
    gg.addColorStop(0, 'rgba(0,130,0,1)');
    gg.addColorStop(1, 'rgba(0,20,0,1)');
    ctx.filter = 'blur(18px)';
    path(ctx, hull);
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.restore();
    soft(ctx, 80, 'rgba(0,255,0,0.28)', () => { ctx.beginPath(); ctx.ellipse(SUN[0], SUN[1] + 20, 170, 190, 0, 0, 7); ctx.fill(); });

    // B — the branch's shadow drifts through the light on the floor
    ctx.save();
    ctx.filter = 'blur(20px)';
    ctx.fillStyle = 'rgb(0,0,255)';
    panesOnPlane(floor).forEach((p) => { path(ctx, p); ctx.fill(); });
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

  function bulbs() {
    return lampArms().map(({ a, end }) => {
      const e = P(...end);
      const es = sc(end[2]);
      return [e[0] + Math.cos(a) * 6 * es, e[1] + 2 * es, es];
    });
  }

  function paintEmit(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // R: the wire lamp's bulbs, their glow on the ceiling; the desk lamp and its pool
    bulbs().forEach(([x, y, s]) => soft(ctx, 4, 'rgba(255,0,0,1)', () => { ctx.beginPath(); ctx.ellipse(x, y, 5 * s, 6.5 * s, 0, 0, 7); ctx.fill(); }));
    const hub = P(LAMPC.X, LAMPC.Y, LAMPC.z);
    soft(ctx, 50, 'rgba(255,0,0,0.5)', () => { ctx.beginPath(); ctx.ellipse(hub[0], hub[1], 110, 60, 0, 0, 7); ctx.fill(); });
    soft(ctx, 140, 'rgba(255,0,0,0.3)', () => { ctx.beginPath(); ctx.ellipse(hub[0], hub[1] + 40, 420, 200, 0, 0, 7); ctx.fill(); });
    soft(ctx, 4, 'rgba(255,0,0,1)', () => { path(ctx, deskLampHead()); ctx.fill(); });
    const pool = P(DESK.l + 25, DESK.t, 0.27);
    soft(ctx, 40, 'rgba(255,0,0,0.6)', () => { ctx.beginPath(); ctx.ellipse(pool[0], pool[1], 90, 22, 0, 0, 7); ctx.fill(); });
    // G: the laptop screen, and its light on the sheet
    const { screenQ } = laptopQuads();
    soft(ctx, 3, 'rgba(0,255,0,1)', () => { path(ctx, screenQ); ctx.fill(); });
    const scr = [(screenQ[0][0] + screenQ[2][0]) / 2, (screenQ[0][1] + screenQ[2][1]) / 2];
    soft(ctx, 60, 'rgba(0,255,0,0.45)', () => { ctx.beginPath(); ctx.ellipse(scr[0], scr[1] + 40, 150, 70, 0, 0, 7); ctx.fill(); });
    // B: fairy lights
    lightBulbs().forEach(([bx, by]) => soft(ctx, 6, 'rgba(0,0,255,1)', () => { ctx.beginPath(); ctx.arc(bx, by + 4, 5, 0, 7); ctx.fill(); }));
    ctx.globalCompositeOperation = 'source-over';
  }

  // R: the glass you see out of · G: sky only · B: the windows across the street
  function paintGlass(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const rects = panes().map(toGlass);
    ctx.fillStyle = '#ffff00';
    rects.forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
    ctx.save();
    ctx.beginPath();
    rects.forEach(([x, y, w, h]) => ctx.rect(x, y, w, h));
    ctx.clip();
    houseShape(ctx);
    ctx.fillStyle = '#ff0000';
    ctx.fill();
    ctx.fillStyle = '#ff00ff';
    OUT.windows.forEach(([wx, wy, ww, wh]) => ctx.fillRect(wx, wy, ww, wh));
    ctx.restore();
    ['l', 'r'].forEach((side) => fillPoly(ctx, curtainPoly(side), '#000'));
  }

  function paintForeground(ctx) {
    ctx.clearRect(0, 0, W, H);
  }

  // the construction lines: the vanishing point, the horizon, and every
  // edge that should run into it — if something's off, it shows
  function paintGuides(ctx) {
    ctx.clearRect(0, 0, W, H);
    const ln = (a, b, color, width = 1.4, dash = []) => {
      ctx.setLineDash(dash);
      line(ctx, a, b, color, width);
    };
    const toVP = (X, Y, color = 'rgba(80, 255, 170, 0.9)') => ln(P(X, Y, 0), P(X, Y, NEAR + 0.2), color);
    const { l, r, floor, knee, ceil, cl, cr } = ROOM;
    // horizon (eye level) and the vanishing point
    ln([0, VP[1]], [W, VP[1]], 'rgba(255, 90, 90, 0.95)', 2, [10, 8]);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 90, 90, 1)';
    ctx.beginPath();
    ctx.arc(VP[0], VP[1], 7, 0, 7);
    ctx.fill();
    // the room's edges: floor corners, the knee line, the slopes' tops
    [[l, floor], [r, floor], [l, knee], [r, knee], [cl, ceil], [cr, ceil]].forEach(([X, Y]) => toVP(X, Y));
    // the back wall
    ctx.setLineDash([]);
    path(ctx, shellQuads().back);
    ctx.strokeStyle = 'rgba(80, 200, 255, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // a floor grid, a metre apart
    for (let X = l; X <= r; X += 200) toVP(X, floor, 'rgba(80, 200, 255, 0.35)');
    for (let z = 0.1; z < NEAR; z += 0.1) ln(P(l, floor, z), P(r, floor, z), 'rgba(80, 200, 255, 0.35)');
    // the furniture: box edges, extended to the vanishing point
    const edges = (x0, x1, y0, y1, z0, z1) => {
      [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([X, Y]) => ln(P(X, Y, z1), VP, 'rgba(255, 220, 90, 0.5)', 1, [4, 5]));
      boxFaces(x0, x1, y0, y1, z0, z1).forEach(([, pts]) => { ctx.setLineDash([]); path(ctx, pts); ctx.strokeStyle = 'rgba(255, 220, 90, 0.95)'; ctx.lineWidth = 1.6; ctx.stroke(); });
    };
    edges(BED.l, BED.r, BED.top, floor, BED.head, 0.6);
    edges(NIGHT.l, NIGHT.r, NIGHT.t, floor, NIGHT.z0, NIGHT.z1);
    edges(DESK.l, DESK.r, DESK.t, floor, DESK.z0, DESK.z1);
    edges(BENCH.l, BENCH.r, BENCH.t, floor, BENCH.z0, BENCH.z1);
    edges(RAD.l, RAD.r, RAD.t, RAD.b, RAD.z0, RAD.z1);
    edges(SHELF.l, SHELF.r, SHELF.t, SHELF.b, SHELF.z0, SHELF.z1);
    // the window, and the sunlight's path through its corners
    ctx.setLineDash([]);
    path(ctx, quad([[WIN.l, WIN.t, 0], [WIN.r, WIN.t, 0], [WIN.r, WIN.b, 0], [WIN.l, WIN.b, 0]]));
    ctx.strokeStyle = 'rgba(255, 150, 60, 0.95)';
    ctx.stroke();
    [[CUR.lIn, WIN.b], [CUR.rIn, WIN.b], [CUR.lIn, WIN.t], [CUR.rIn, WIN.t]].forEach(([x, y]) => ln(P(x, y, 0), P(...onPlane(x, y, floor)), 'rgba(255, 150, 60, 0.8)', 1.2, [6, 4]));
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
    const guitarFoot = P(GUITAR.X, ROOM.floor, GUITAR.z);
    const gH = 200 / (1 - GUITAR.z);
    const { baseQ, lidQ } = laptopQuads();
    const tapes = tapeSlots();
    const tz0 = tapes[0].z;
    const tz1 = tapes[tapes.length - 1].z + 0.01;
    const lampPts = bulbs().map(([x, y]) => [x, y]).concat([P(LAMPC.X, ROOM.ceil, LAMPC.z)]);
    return [
      { id: 'wishes', label: 'the window', ...bounds(quad([[CUR.lIn, WIN.t, WIN.inset], [CUR.rIn, WIN.t, WIN.inset], [CUR.rIn, WIN.b, WIN.inset], [CUR.lIn, WIN.b, WIN.inset]])) },
      { id: 'gallery', label: 'pictures i took', ...bounds(quad([[ROOM.l, PHOTOS.t, PHOTOS.z0], [ROOM.l, PHOTOS.t, PHOTOS.z1], [ROOM.l, PHOTOS.b, PHOTOS.z1], [ROOM.l, PHOTOS.b, PHOTOS.z0]])) },
      { id: 'favoomfs', label: 'my friends', ...bounds(FRAMES.flatMap(([x0, x1, y0, y1]) => quad([[x0, y0, 0], [x1, y1, 0]]))) },
      { id: 'about', label: 'a note on the wall', ...bounds(quad([[ROOM.r, NOTE.t, NOTE.z0], [ROOM.r, NOTE.b, NOTE.z1]]), 12) },
      { id: 'interests', label: 'the tapes', ...bounds(quad([[HUTCH.l, HUTCH.shelf + 20, tz0], [HUTCH.l, DESK.t, tz1]]), 8) },
      { id: 'guitar', label: 'my guitar', x: guitarFoot[0] - 40, y: guitarFoot[1] - gH, w: 96, h: gH + 6 },
      { id: 'games', label: 'my laptop', ...bounds(baseQ.concat(lidQ), 10) },
      { id: 'send', label: 'a letter for you', ...bounds(quad([[NIGHT.l + 8, NIGHT.t, NIGHT.z0 + 0.016], [NIGHT.l + 44, NIGHT.t, NIGHT.z0 + 0.074]]), 14) },
      { id: 'lamp', label: 'the lamp', ...bounds(lampPts, 18), action: 'lamp' },
      { id: 'oracle', label: 'the cards on my bed', ...bounds(quad([[CARDS.x - 4, BED.top, CARDS.z - 0.03], [CARDS.x + 76, BED.top, CARDS.z + 0.03]]), 12) }
    ];
  }

  /* ==========================================================
     PUBLIC
     ========================================================== */
  async function paint({ scale = 1.5 } = {}) {
    S = scale;
    try { await Promise.all([document.fonts.load('600 20px Caveat'), document.fonts.load('italic 300 30px Fraunces')]); } catch { /* fine */ }
    noteCanvas = null;
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
