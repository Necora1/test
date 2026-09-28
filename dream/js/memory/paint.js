/* ==========================================================
   memory/paint.js — renn's room, painted in code
   Everything is drawn once, on load, into a few layers that the
   memory engine (engine.js) lights and animates:

   albedo   the room as it looks in soft, even light
   sun      R: where the sun lands on things
            G: the beams of light hanging in the air
            B: where leaf shadows can move through the light
   emit     R: the lamp   G: the laptop screen
            B: fairy lights   A: the window glass
   fg       a sheer curtain right in front of the camera, and a
            few out-of-focus lights (drawn over everything, moves
            more with the mouse, so the room has depth)

   The room is designed on a 1600 × 1000 board; HOTSPOTS are in
   those units. Vanishing point ≈ (820, 430).
   ========================================================== */
(() => {
  const Void = window.Void;
  const W = 1600;
  const H = 1000;
  const VP = [820, 430];

  /* ---------- the room's bones ---------- */
  const BACK = { x0: 250, x1: 1390, y0: 40, y1: 690 };
  // points on the side walls: u = 0 at the near edge of the picture, 1 at the back wall
  const leftWall = (u, v) => {
    const x = 250 * u;
    const top = -131 + 171 * u;
    const bot = 804 - 114 * u;
    return [x, top + (bot - top) * v];
  };
  const rightWall = (u, v) => {
    const x = 1390 + 210 * (1 - u);
    const top = 40 - 144 * (1 - u);
    const bot = 690 + 96 * (1 - u);
    return [x, top + (bot - top) * v];
  };
  const WIN = { u0: 0.2, u1: 0.78, v0: 0.26, v1: 0.66 };
  const winPt = (a, b) => leftWall(WIN.u0 + (WIN.u1 - WIN.u0) * a, WIN.v0 + (WIN.v1 - WIN.v0) * b);

  // where the sun lands on the back wall: the window, skewed across it
  const PATCH = [[700, 178], [1030, 222], [1052, 520], [722, 478]];
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const quadPt = (q, a, b) => lerp2(lerp2(q[0], q[1], a), lerp2(q[3], q[2], a), b);
  const FLOOR_PATCH = [[455, 772], [760, 748], [868, 912], [520, 946]];
  const BED_PATCH = [[905, 604], [1102, 596], [1160, 700], [940, 716]];

  /* ---------- what you can click (board units) ---------- */
  const HOTSPOTS = [
    { id: 'about', label: 'a note on the wall', x: 462, y: 186, w: 112, h: 92 },
    { id: 'interests', label: 'the tapes', x: 296, y: 262, w: 356, h: 70 },
    { id: 'games', label: 'my laptop', x: 392, y: 486, w: 170, h: 104 },
    { id: 'send', label: 'a letter for you', x: 560, y: 560, w: 96, h: 56 },
    { id: 'guitar', label: 'my guitar', x: 640, y: 372, w: 118, h: 410 },
    { id: 'gallery', label: 'pictures i took', x: 990, y: 128, w: 356, h: 190 },
    { id: 'oracle', label: 'the cards on my bed', x: 1036, y: 626, w: 150, h: 70 },
    { id: 'favoomfs', label: 'my friends', x: 1418, y: 206, w: 160, h: 300 },
    { id: 'wishes', label: 'the window', x: 40, y: 110, w: 190, h: 470 },
    { id: 'lamp', label: 'the lamp', x: 300, y: 408, w: 84, h: 178, action: 'lamp' }
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
    const off = 20000;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * S * (ctx.getTransform().a / S);
    ctx.shadowOffsetX = off * ctx.getTransform().a;
    ctx.translate(-off, 0);
    ctx.fillStyle = '#000';
    draw();
    ctx.restore();
  }

  function lin(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }

  function rad(ctx, x, y, r0, r1, stops, x1 = x, y1 = y) {
    const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1);
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

  // plaster, fabric and paper all get a little grain
  let grainPattern = null;
  function grain(ctx, alpha, pts) {
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
    if (pts) { path(ctx, pts); ctx.clip(); }
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

  /* ==========================================================
     THE ALBEDO — the room in soft light
     ========================================================== */
  function paintRoom(ctx, covers) {
    rnd = mulberry(7);

    // ceiling
    fillPoly(ctx, [[-10, -140], [1610, -120], [1390, 40], [250, 40]], lin(ctx, 0, -140, 0, 40, [[0, '#4a3c33'], [1, '#6f5e50']]));

    // back wall: warm plaster, darker up high and into the corners
    fillPoly(ctx, [[250, 40], [1390, 40], [1390, 690], [250, 690]], lin(ctx, 0, 40, 0, 690, [[0, '#9c8a76'], [0.35, '#b3a18b'], [1, '#a8957f']]));
    ctx.save();
    path(ctx, [[250, 40], [1390, 40], [1390, 690], [250, 690]]);
    ctx.clip();
    ctx.fillStyle = rad(ctx, 820, 420, 100, 760, [[0, 'rgba(255,240,220,0.14)'], [1, 'rgba(40,25,15,0.22)']]);
    ctx.fillRect(250, 40, 1140, 650);
    ctx.restore();
    grain(ctx, 0.16, [[250, 40], [1390, 40], [1390, 690], [250, 690]]);

    // side walls
    const L = [leftWall(0, 0), leftWall(1, 0), leftWall(1, 1), leftWall(0, 1)];
    fillPoly(ctx, L, lin(ctx, 0, 0, 250, 0, [[0, '#7d6c5c'], [1, '#9a8672']]));
    grain(ctx, 0.14, L);
    const Rw = [rightWall(1, 0), rightWall(0, 0), rightWall(0, 1), rightWall(1, 1)];
    fillPoly(ctx, Rw, lin(ctx, 1390, 0, 1600, 0, [[0, '#a4917c'], [1, '#8c7a67']]));
    grain(ctx, 0.14, Rw);

    // soft shadows where the walls meet
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    [[250, 40, 250, 690], [1390, 40, 1390, 690]].forEach(([x0, y0, x1, y1]) => {
      soft(ctx, 26, 'rgba(70, 50, 35, 0.35)', () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineWidth = 18; ctx.stroke(); });
    });
    soft(ctx, 30, 'rgba(60, 45, 30, 0.35)', () => { ctx.fillRect(250, 36, 1140, 14); });
    ctx.restore();

    paintFloor(ctx);
    paintWindow(ctx);
    paintRightWall(ctx);
    paintShelf(ctx, covers);
    paintNote(ctx);
    paintDeskAndChair(ctx);
    paintGuitar(ctx);
    paintBedWall(ctx, covers);
    paintBed(ctx);
    paintPlant(ctx);
    paintClutter(ctx);
  }

  function paintFloor(ctx) {
    const F = [[250, 690], [1390, 690], [1600, 786], [1610, 1010], [-10, 1010], [0, 804]];
    fillPoly(ctx, F, lin(ctx, 0, 690, 0, 1000, [[0, '#5a3e2c'], [1, '#6f4b33']]));
    ctx.save();
    path(ctx, F);
    ctx.clip();
    // boards running towards the back wall
    for (let i = -22; i <= 40; i++) {
      const bx = 250 + i * 38;
      const t = (1000 - VP[1]) / (690 - VP[1]);
      const fx = VP[0] + (bx - VP[0]) * t;
      const tint = R(-14, 14);
      const nb = 250 + (i + 1) * 38;
      const nfx = VP[0] + (nb - VP[0]) * t;
      path(ctx, [[bx, 690], [nb, 690], [nfx, 1000], [fx, 1000]]);
      ctx.fillStyle = `rgba(${120 + tint}, ${82 + tint * 0.7}, ${56 + tint * 0.5}, 0.35)`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(30, 18, 10, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(bx, 690);
      ctx.lineTo(fx, 1000);
      ctx.stroke();
    }
    // board ends, a few, in perspective
    for (let k = 0; k < 90; k++) {
      const y = R(695, 1000);
      const x = R(0, 1600);
      const len = 24 * ((y - VP[1]) / (690 - VP[1]));
      ctx.strokeStyle = 'rgba(30,18,10,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * 0.9, y);
      ctx.stroke();
    }
    // a soft sheen from the window
    ctx.fillStyle = rad(ctx, 360, 860, 10, 520, [[0, 'rgba(255,220,170,0.16)'], [1, 'rgba(255,220,170,0)']]);
    ctx.fillRect(0, 690, 1600, 320);
    ctx.restore();
    grain(ctx, 0.12, F);

    // skirting
    fillPoly(ctx, [[250, 674], [1390, 674], [1390, 690], [250, 690]], '#cbbba5');
    fillPoly(ctx, [leftWall(0, 0.975), leftWall(1, 0.975), leftWall(1, 1), leftWall(0, 1)], '#b3a28c');
    fillPoly(ctx, [rightWall(1, 0.975), rightWall(0, 0.975), rightWall(0, 1), rightWall(1, 1)], '#bba993');

    // a rug
    ctx.save();
    ctx.translate(760, 862);
    ctx.scale(1, 0.26);
    ctx.fillStyle = rad(ctx, 0, 0, 20, 420, [[0, '#9b6a62'], [0.8, '#86574f'], [1, '#6c443d']]);
    ctx.beginPath();
    ctx.arc(0, 0, 420, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(236, 214, 190, 0.55)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 370, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 340, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    grain(ctx, 0.2, [[340, 760], [1180, 760], [1180, 970], [340, 970]]);
  }

  function paintWindow(ctx) {
    const o = [winPt(0, 0), winPt(1, 0), winPt(1, 1), winPt(0, 1)];
    // outside: a late afternoon in the suburbs
    ctx.save();
    path(ctx, o);
    ctx.clip();
    const top = o[0][1];
    const bot = o[3][1];
    ctx.fillStyle = lin(ctx, 0, top, 0, bot, [[0, '#9dbad2'], [0.45, '#f3cf9e'], [0.8, '#ffc98a'], [1, '#f4b77a']]);
    ctx.fillRect(0, top - 40, 260, bot - top + 80);
    // the sun itself, low, just out of frame
    ctx.fillStyle = rad(ctx, 70, bot - 150, 0, 260, [[0, 'rgba(255,250,225,1)'], [0.2, 'rgba(255,236,190,0.9)'], [1, 'rgba(255,200,140,0)']]);
    ctx.fillRect(0, top - 40, 260, bot - top + 80);
    // a neighbour's roof and a tree, backlit
    ctx.fillStyle = 'rgba(118, 84, 78, 0.8)';
    path(ctx, [[60, bot - 70], [120, bot - 118], [200, bot - 84], [200, bot + 10], [60, bot + 10]]);
    ctx.fill();
    // the tree: a trunk and a dark, backlit crown, with light slipping through
    ctx.strokeStyle = 'rgba(58, 44, 36, 0.95)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(214, bot + 10);
    ctx.quadraticCurveTo(206, bot - 90, 222, top + 90);
    ctx.stroke();
    for (let i = 0; i < 70; i++) {
      const a = R(0, Math.PI * 2);
      const d = Math.sqrt(rnd()) * 70;
      const cx = 222 + Math.cos(a) * d * 1.1;
      const cy = top + 70 + Math.sin(a) * d * 1.3;
      ctx.fillStyle = `rgba(${62 + R(-10, 10)}, ${66 + R(-10, 10)}, 48, ${R(0.75, 0.95)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, R(8, 20), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 236, 196, 0.8)';
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.arc(R(160, 290), R(top + 10, top + 170), R(1.5, 3.5), 0, Math.PI * 2);
      ctx.fill();
    }
    // power lines, sagging
    ctx.strokeStyle = 'rgba(40, 32, 30, 0.55)';
    ctx.lineWidth = 1.3;
    [0.3, 0.36, 0.44].forEach((k) => {
      ctx.beginPath();
      ctx.moveTo(0, top + (bot - top) * k);
      ctx.quadraticCurveTo(130, top + (bot - top) * (k + 0.07), 260, top + (bot - top) * (k - 0.02));
      ctx.stroke();
    });
    ctx.restore();

    // frame, mullions, sill
    const frame = '#e9dfd0';
    const drawBar = (a0, b0, a1, b1, w) => {
      const p0 = winPt(a0, b0);
      const p1 = winPt(a1, b1);
      ctx.strokeStyle = frame;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
    };
    ctx.lineCap = 'butt';
    drawBar(0, 0, 1, 0, 16);
    drawBar(0, 1, 1, 1, 14);
    drawBar(0, 0, 0, 1, 20);
    drawBar(1, 0, 1, 1, 10);
    drawBar(0.5, 0, 0.5, 1, 9);
    drawBar(0, 0.46, 1, 0.46, 10);
    ctx.lineCap = 'round';
    // frame shading on the side facing us
    ctx.strokeStyle = 'rgba(120, 100, 80, 0.35)';
    ctx.lineWidth = 3;
    path(ctx, o);
    ctx.stroke();
    // sill
    const s0 = winPt(-0.06, 1.0);
    const s1 = winPt(1.06, 1.0);
    fillPoly(ctx, [[s0[0] - 16, s0[1] + 2], [s1[0], s1[1] - 2], [s1[0] + 6, s1[1] + 12], [s0[0] - 10, s0[1] + 30]], '#ddd0bd');
    // the jar on the sill, full of little lights
    const j = winPt(0.52, 1.0);
    ctx.save();
    ctx.translate(j[0], j[1] - 2);
    ctx.fillStyle = 'rgba(210, 225, 220, 0.45)';
    roundRect(ctx, -16, -44, 32, 44, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#b08a5a';
    roundRect(ctx, -12, -50, 24, 8, 2);
    ctx.fill();
    ctx.restore();
    // curtains, tied back on both sides
    const curtain = (a, dir) => {
      const t = winPt(a, -0.12);
      const b = winPt(a, 1.3);
      ctx.save();
      ctx.globalAlpha = 0.82;
      const g = lin(ctx, t[0] - 30, 0, t[0] + 30, 0, [[0, '#d9cdbb'], [0.5, '#f1e7d8'], [1, '#cfc2ae']]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(t[0] - 22 * dir, t[1]);
      ctx.bezierCurveTo(t[0] + 40 * dir, t[1] + 120, t[0] - 10 * dir, b[1] - 190, t[0] + 6 * dir, b[1] - 170);
      ctx.bezierCurveTo(t[0] + 20 * dir, b[1] - 120, t[0] - 10 * dir, b[1] - 40, t[0] - 30 * dir, b[1]);
      ctx.lineTo(t[0] - 60 * dir, b[1]);
      ctx.bezierCurveTo(t[0] - 50 * dir, b[1] - 100, t[0] - 40 * dir, t[1] + 200, t[0] - 60 * dir, t[1]);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    curtain(1.02, 1);
    const rod0 = winPt(-0.1, -0.14);
    const rod1 = winPt(1.12, -0.14);
    ctx.strokeStyle = '#6b5440';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(rod0[0], rod0[1]);
    ctx.lineTo(rod1[0], rod1[1]);
    ctx.stroke();
  }

  function paintRightWall(ctx) {
    // a corkboard of friends
    const q = [rightWall(0.78, 0.26), rightWall(0.2, 0.26), rightWall(0.2, 0.62), rightWall(0.78, 0.62)];
    soft(ctx, 18, 'rgba(40,25,15,0.45)', () => { path(ctx, q.map(([x, y]) => [x - 6, y + 8])); ctx.fill(); });
    fillPoly(ctx, q, '#9a6e46');
    const inner = [lerp2(q[0], q[2], 0.04), lerp2(q[1], q[3], 0.04), lerp2(q[2], q[0], 0.04), lerp2(q[3], q[1], 0.04)];
    fillPoly(ctx, inner, lin(ctx, 1420, 0, 1560, 0, [[0, '#b98f63'], [1, '#a57a50']]));
    grain(ctx, 0.5, inner);
    // pinned bits: photos, a ticket, a sticky note
    const cols = ['#efe8dc', '#f6e7a5', '#e9d4d4', '#dbe7ef', '#efe8dc'];
    [[0.25, 0.2], [0.62, 0.15], [0.3, 0.6], [0.66, 0.55], [0.45, 0.38]].forEach(([a, b], i) => {
      const p = quadPt(inner, a, b);
      const w = 44 * (1 - a * 0.25);
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.transform(1, -0.2, 0, 1, 0, 0);
      ctx.rotate(R(-0.15, 0.15));
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-w / 2 + 3, -w * 0.6 + 4, w, w * 1.15);
      ctx.fillStyle = cols[i];
      ctx.fillRect(-w / 2, -w * 0.6, w, w * 1.15);
      if (i !== 1) {
        ctx.fillStyle = ['#7b8fa6', '#a07a7a', '#6d8a6a', '#8a7aa6'][i % 4];
        ctx.fillRect(-w / 2 + 4, -w * 0.6 + 4, w - 8, w * 0.8);
      }
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(0, -w * 0.6 + 2, 3.5, 0, 7);
      ctx.fill();
      ctx.restore();
    });

    // a small framed picture: a house at dusk, one window lit
    ctx.save();
    ctx.translate(1262, 322);
    soft(ctx, 14, 'rgba(40,25,15,0.4)', () => ctx.fillRect(4, 8, 96, 116));
    ctx.fillStyle = '#3b2c22';
    ctx.fillRect(0, 0, 96, 116);
    ctx.fillStyle = '#efe6d6';
    ctx.fillRect(8, 8, 80, 100);
    ctx.fillStyle = lin(ctx, 0, 16, 0, 90, [[0, '#6a6f9a'], [1, '#e8a57e']]);
    ctx.fillRect(16, 16, 64, 76);
    ctx.fillStyle = '#2a2230';
    path(ctx, [[22, 92], [22, 62], [36, 50], [50, 60], [50, 52], [66, 44], [76, 54], [76, 92]]);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.fillRect(58, 62, 7, 8);
    ctx.fillRect(30, 70, 6, 7);
    ctx.restore();
  }

  function paintShelf(ctx) {
    // a plank on two brackets, full of tapes
    soft(ctx, 12, 'rgba(40, 25, 15, 0.5)', () => ctx.fillRect(300, 322, 350, 12));
    fillPoly(ctx, [[296, 314], [654, 314], [650, 326], [300, 326]], '#8b5f3d');
    ctx.fillStyle = '#6e4a2f';
    ctx.fillRect(300, 326, 350, 6);
    ctx.fillStyle = '#3d2c22';
    ctx.fillRect(330, 332, 5, 22);
    ctx.fillRect(612, 332, 5, 22);
    const songs = (Void.favorites || []).slice(0, 26);
    let x = 306;
    songs.forEach((s, i) => {
      if (x > 560) return;
      const col = s.palette?.[3] || '#999';
      const h = 42 + (i % 3) * 2;
      const w = 9;
      ctx.fillStyle = col;
      ctx.fillRect(x, 314 - h, w, h);
      ctx.fillStyle = 'rgba(255, 250, 240, 0.7)';
      ctx.fillRect(x + 2, 314 - h + 6, w - 4, h - 16);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + w - 1.5, 314 - h, 1.5, h);
      x += w + 1.5;
    });
    // a leaning record, a tiny cactus, a candle
    ctx.save();
    ctx.translate(590, 312);
    ctx.rotate(-0.22);
    ctx.fillStyle = '#2b2230';
    ctx.fillRect(-4, -58, 56, 58);
    ctx.fillStyle = '#f29fc0';
    ctx.beginPath();
    ctx.arc(24, -29, 12, 0, 7);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#b8714f';
    ctx.fillRect(630, 300, 16, 14);
    ctx.fillStyle = '#6e9160';
    roundRect(ctx, 632, 276, 12, 26, 6);
    ctx.fill();
  }

  function paintNote(ctx) {
    ctx.save();
    ctx.translate(518, 232);
    ctx.rotate(-0.07);
    soft(ctx, 10, 'rgba(40, 25, 15, 0.45)', () => ctx.fillRect(-46, -34, 94, 76));
    ctx.fillStyle = '#f6efdf';
    ctx.fillRect(-48, -38, 96, 76);
    ctx.strokeStyle = 'rgba(110,140,185,0.35)';
    ctx.lineWidth = 1;
    for (let y = -16; y < 36; y += 12) { ctx.beginPath(); ctx.moveTo(-44, y); ctx.lineTo(44, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(232, 190, 130, 0.8)';
    ctx.save();
    ctx.rotate(0.12);
    ctx.fillRect(-18, -46, 38, 14);
    ctx.restore();
    ctx.fillStyle = '#3a2b36';
    ctx.font = '600 22px Caveat, cursive';
    ctx.textAlign = 'center';
    ctx.fillText("hi, it's renn", 0, -2);
    ctx.font = '600 15px Caveat, cursive';
    ctx.fillText('(come in)', 2, 22);
    ctx.restore();
  }

  function paintDeskAndChair(ctx) {
    // contact shadow
    soft(ctx, 30, 'rgba(25, 15, 8, 0.55)', () => ctx.fillRect(292, 670, 360, 24));
    // desk top and legs
    fillPoly(ctx, [[282, 572], [662, 572], [676, 594], [270, 594]], lin(ctx, 0, 572, 0, 594, [[0, '#916445'], [1, '#7a5134']]));
    ctx.fillStyle = '#5e3d27';
    ctx.fillRect(270, 594, 406, 12);
    ctx.fillStyle = '#5a3a25';
    ctx.fillRect(282, 606, 12, 84);
    ctx.fillRect(652, 606, 12, 84);
    // drawers
    ctx.fillStyle = '#6d4830';
    ctx.fillRect(540, 606, 112, 76);
    ctx.strokeStyle = 'rgba(30,18,10,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(544, 610, 104, 34);
    ctx.strokeRect(544, 646, 104, 32);
    ctx.fillStyle = '#c9a15a';
    ctx.fillRect(588, 624, 16, 3);
    ctx.fillRect(588, 660, 16, 3);

    // the lamp
    ctx.fillStyle = '#3a3027';
    ctx.beginPath();
    ctx.ellipse(334, 574, 26, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a3027';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(334, 572);
    ctx.lineTo(328, 500);
    ctx.lineTo(348, 452);
    ctx.stroke();
    path(ctx, [[322, 418], [364, 418], [382, 468], [304, 468]]);
    ctx.fillStyle = lin(ctx, 304, 0, 382, 0, [[0, '#b98f5e'], [0.5, '#d8b07a'], [1, '#a47d50']]);
    ctx.fill();
    ctx.fillStyle = 'rgba(80,55,30,0.4)';
    ctx.beginPath();
    ctx.ellipse(343, 468, 39, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // the laptop, open
    soft(ctx, 10, 'rgba(20,12,6,0.5)', () => { path(ctx, [[400, 578], [556, 578], [566, 590], [392, 590]]); ctx.fill(); });
    path(ctx, [[402, 574], [554, 574], [566, 588], [390, 588]]);
    ctx.fillStyle = lin(ctx, 0, 574, 0, 588, [[0, '#c9ccd2'], [1, '#9ea2aa']]);
    ctx.fill();
    path(ctx, [[410, 492], [546, 492], [554, 574], [402, 574]]);
    ctx.fillStyle = '#a8acb4';
    ctx.fill();
    path(ctx, [[416, 498], [540, 498], [547, 568], [409, 568]]);
    ctx.fillStyle = '#1c2230';
    ctx.fill();
    // what's on the screen: faint, it's asleep
    ctx.fillStyle = 'rgba(160, 190, 230, 0.18)';
    for (let k = 0; k < 5; k++) ctx.fillRect(424, 508 + k * 10, 40 + (k * 17) % 60, 3);
    ctx.fillStyle = 'rgba(255, 190, 230, 0.2)';
    ctx.fillRect(500, 540, 34, 20);

    // mug, papers, the letter
    ctx.fillStyle = '#d9cfe8';
    roundRect(ctx, 596, 540, 26, 32, 5);
    ctx.fill();
    ctx.strokeStyle = '#d9cfe8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(624, 556, 8, -1.2, 1.2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(596, 566, 26, 6);
    ctx.save();
    ctx.translate(598, 584);
    ctx.rotate(0.05);
    ctx.fillStyle = '#efe5d2';
    path(ctx, [[-40, -6], [42, -8], [50, 6], [-34, 8]]);
    ctx.fill();
    ctx.fillStyle = '#e6dbc6';
    path(ctx, [[-36, -4], [4, 2], [44, -6]], false);
    ctx.strokeStyle = 'rgba(120,100,80,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#a92b3c';
    ctx.beginPath();
    ctx.arc(4, 1, 5, 0, 7);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(356, 584);
    ctx.rotate(-0.08);
    ctx.fillStyle = '#f3ecdf';
    ctx.fillRect(-20, -5, 44, 10);
    ctx.strokeStyle = '#2b2233';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.lineTo(26, -4);
    ctx.stroke();
    ctx.restore();

    // the chair, pulled out a little
    soft(ctx, 20, 'rgba(25,15,8,0.55)', () => { ctx.beginPath(); ctx.ellipse(470, 842, 110, 18, 0, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#5c3d28';
    [[398, 700], [540, 700], [388, 842], [552, 842]].forEach(([x, y], i) => ctx.fillRect(x, i < 2 ? 700 : 740, 10, i < 2 ? 90 : 104));
    fillPoly(ctx, [[392, 690], [552, 690], [572, 740], [372, 740]], lin(ctx, 0, 690, 0, 740, [[0, '#8a5d3d'], [1, '#6e4a30']]));
    ctx.fillStyle = '#5a3a25';
    ctx.fillRect(372, 740, 200, 10);
    // backrest, seen from behind
    ctx.fillStyle = '#6a4530';
    ctx.fillRect(398, 612, 10, 80);
    ctx.fillRect(536, 612, 10, 80);
    fillPoly(ctx, [[392, 604], [552, 604], [552, 632], [392, 632]], '#7d5337');
    ctx.fillRect(412, 650, 120, 8);
    // a hoodie over the back of the chair
    ctx.fillStyle = '#5f6f8a';
    path(ctx, [[392, 600], [470, 596], [556, 604], [548, 640], [520, 700], [470, 690], [420, 704], [400, 650]]);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    path(ctx, [[430, 640], [470, 690], [420, 704]]);
    ctx.fill();
  }

  function paintGuitar(ctx) {
    ctx.save();
    ctx.translate(700, 776);
    ctx.rotate(-0.12);
    // its shadow on the wall
    soft(ctx, 16, 'rgba(30, 18, 10, 0.4)', () => {
      ctx.save();
      ctx.translate(26, -10);
      ctx.beginPath();
      ctx.ellipse(0, -76, 60, 70, 0, 0, 7);
      ctx.ellipse(0, -196, 44, 42, 0, 0, 7);
      ctx.fill();
      ctx.fillRect(-8, -400, 16, 200);
      ctx.restore();
    });
    // a real guitar outline: wide lower bout, a waist, a smaller upper bout
    const outline = () => {
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
    };
    outline();
    ctx.fillStyle = '#4a2812';
    ctx.fill();
    ctx.save();
    ctx.translate(0, -122);
    ctx.scale(0.94, 0.965);
    ctx.translate(0, 122);
    outline();
    ctx.fillStyle = rad(ctx, -16, -120, 8, 150, [[0, '#f0bd7c'], [0.55, '#cf8c4a'], [1, '#8f4f22']]);
    ctx.fill();
    ctx.restore();
    // binding
    outline();
    ctx.strokeStyle = 'rgba(250, 235, 205, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // pickguard
    ctx.fillStyle = 'rgba(60, 30, 14, 0.75)';
    ctx.beginPath();
    ctx.moveTo(14, -150);
    ctx.bezierCurveTo(40, -148, 44, -118, 26, -104);
    ctx.bezierCurveTo(16, -112, 12, -130, 14, -150);
    ctx.fill();
    // soundhole and rosette
    ctx.strokeStyle = '#3a2112';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -140, 23, 0, 7);
    ctx.stroke();
    ctx.fillStyle = '#1c0f07';
    ctx.beginPath();
    ctx.arc(0, -140, 18, 0, 7);
    ctx.fill();
    // bridge
    ctx.fillStyle = '#2f1a0d';
    roundRect(ctx, -24, -66, 48, 10, 3);
    ctx.fill();
    // neck and headstock
    ctx.fillStyle = lin(ctx, -9, 0, 9, 0, [[0, '#3b2111'], [0.5, '#5a3419'], [1, '#3b2111']]);
    ctx.fillRect(-9, -412, 18, 178);
    ctx.fillStyle = '#c9b98f';
    for (let f = 0; f < 12; f++) ctx.fillRect(-9, -236 - f * 14.5, 18, 1.4);
    ctx.fillStyle = '#2a170b';
    path(ctx, [[-12, -412], [12, -412], [14, -468], [-14, -468]]);
    ctx.fill();
    ctx.fillStyle = '#d8c7a0';
    for (let p = 0; p < 3; p++) {
      ctx.beginPath(); ctx.arc(-18, -424 - p * 15, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(18, -424 - p * 15, 4, 0, 7); ctx.fill();
    }
    // strings
    ctx.strokeStyle = 'rgba(245, 235, 210, 0.85)';
    for (let s = 0; s < 6; s++) {
      ctx.lineWidth = 0.6 + (5 - s) * 0.12;
      ctx.beginPath();
      ctx.moveTo(-6 + s * 2.4, -410);
      ctx.lineTo(-8 + s * 3.2, -62);
      ctx.stroke();
    }
    // a strap, hanging
    ctx.strokeStyle = '#7a2e33';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-40, -30);
    ctx.bezierCurveTo(-70, 0, -60, 20, -30, 14);
    ctx.stroke();
    // gloss
    ctx.fillStyle = 'rgba(255,240,210,0.18)';
    ctx.beginPath();
    ctx.ellipse(-22, -110, 10, 40, -0.3, 0, 7);
    ctx.fill();
    ctx.restore();
  }

  function paintBedWall(ctx, covers) {
    // polaroids pinned in a loose row, some of them song covers
    const spots = [[1010, 150, -0.08], [1082, 170, 0.06], [1152, 146, -0.03], [1222, 172, 0.09], [1290, 152, -0.06], [1046, 238, 0.04], [1188, 240, -0.07], [1262, 250, 0.05]];
    spots.forEach(([x, y, r], i) => {
      ctx.save();
      ctx.translate(x + 30, y + 36);
      ctx.rotate(r);
      soft(ctx, 8, 'rgba(40,25,15,0.45)', () => ctx.fillRect(-28, -32, 60, 72));
      ctx.fillStyle = '#f4efe6';
      ctx.fillRect(-30, -36, 60, 72);
      const img = covers[i % covers.length];
      if (img) ctx.drawImage(img, -25, -31, 50, 50);
      else { ctx.fillStyle = '#7b8fa6'; ctx.fillRect(-25, -31, 50, 50); }
      ctx.fillStyle = 'rgba(255, 210, 150, 0.12)';
      ctx.fillRect(-25, -31, 50, 50);
      ctx.fillStyle = 'rgba(232, 190, 130, 0.85)';
      ctx.fillRect(-10, -42, 22, 9);
      ctx.restore();
    });
    // string lights draped above them
    ctx.strokeStyle = 'rgba(40, 32, 28, 0.7)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(960, 110);
    ctx.bezierCurveTo(1060, 170, 1140, 150, 1180, 118);
    ctx.bezierCurveTo(1230, 150, 1300, 160, 1370, 104);
    ctx.stroke();
    lightBulbs().forEach(([x, y]) => {
      ctx.fillStyle = '#f2e6c9';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 3.5, 5, 0, 0, 7);
      ctx.fill();
    });
  }

  function lightBulbs() {
    const pts = [];
    const bez = (p0, p1, p2, p3, t) => {
      const u = 1 - t;
      return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
    };
    for (let i = 1; i < 9; i++) pts.push(bez([960, 110], [1060, 170], [1140, 150], [1180, 118], i / 9));
    for (let i = 1; i < 9; i++) pts.push(bez([1180, 118], [1230, 150], [1300, 160], [1370, 104], i / 9));
    return pts;
  }

  function paintBed(ctx) {
    // headboard
    soft(ctx, 24, 'rgba(30,18,10,0.5)', () => ctx.fillRect(884, 440, 490, 120));
    fillPoly(ctx, [[880, 430], [1376, 430], [1376, 600], [880, 600]], lin(ctx, 0, 430, 0, 600, [[0, '#7a5439'], [1, '#5f3f29']]));
    ctx.strokeStyle = 'rgba(30,18,10,0.35)';
    ctx.lineWidth = 2;
    for (let x = 920; x < 1370; x += 46) { ctx.beginPath(); ctx.moveTo(x, 440); ctx.lineTo(x, 600); ctx.stroke(); }
    // shadow under the bed
    soft(ctx, 30, 'rgba(15,8,4,0.7)', () => { path(ctx, [[860, 790], [1440, 790], [1470, 860], [830, 860]]); ctx.fill(); });
    // frame, seen from its foot
    fillPoly(ctx, [[836, 720], [1432, 720], [1458, 822], [812, 822]], lin(ctx, 0, 720, 0, 822, [[0, '#6e4a31'], [1, '#553722']]));
    // the mattress and the duvet, rumpled
    const duvet = [[872, 560], [1380, 560], [1446, 760], [1450, 800], [820, 800], [822, 760]];
    fillPoly(ctx, duvet, lin(ctx, 0, 560, 0, 800, [[0, '#d9d2c7'], [0.5, '#e4ddd2'], [1, '#bfb6aa']]));
    ctx.save();
    path(ctx, duvet);
    ctx.clip();
    // folds: soft ridges and valleys
    for (let k = 0; k < 14; k++) {
      const x = R(860, 1420);
      const y = R(600, 780);
      const len = R(80, 220);
      const ang = R(-0.6, 0.6);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = lin(ctx, 0, -14, 0, 14, [[0, 'rgba(255,255,255,0)'], [0.45, 'rgba(255,255,255,0.35)'], [0.55, 'rgba(120,105,95,0.28)'], [1, 'rgba(120,105,95,0)']]);
      ctx.beginPath();
      ctx.ellipse(0, 0, len, 14, 0, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    grain(ctx, 0.14, duvet);
    // duvet's front edge hanging over
    fillPoly(ctx, [[820, 790], [1450, 790], [1462, 836], [806, 836]], lin(ctx, 0, 790, 0, 836, [[0, '#c9c0b3'], [1, '#a79d90']]));
    // pillows
    [[930, 540, 190], [1140, 536, 200]].forEach(([x, y, w]) => {
      soft(ctx, 14, 'rgba(40,25,15,0.35)', () => { roundRect(ctx, x, y + 14, w, 70, 30); ctx.fill(); });
      roundRect(ctx, x, y, w, 72, 30);
      ctx.fillStyle = lin(ctx, 0, y, 0, y + 72, [[0, '#f3eee6'], [1, '#d2cabe']]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,135,120,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 30, y + 36);
      ctx.quadraticCurveTo(x + w / 2, y + 50, x + w - 30, y + 30);
      ctx.stroke();
    });
    // a knitted throw at the foot, mustard
    const throwQ = [[836, 716], [1432, 716], [1454, 790], [816, 790]];
    fillPoly(ctx, throwQ, lin(ctx, 0, 716, 0, 790, [[0, '#b99a5c'], [1, '#95783f']]));
    ctx.save();
    path(ctx, throwQ);
    ctx.clip();
    ctx.strokeStyle = 'rgba(80, 60, 20, 0.35)';
    ctx.lineWidth = 2;
    for (let x = 800; x < 1470; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, 716);
      ctx.lineTo(x + (x - 1130) * 0.06, 790);
      ctx.stroke();
    }
    ctx.restore();
    // the tarot cards, fanned out on the duvet
    ctx.save();
    ctx.translate(1110, 668);
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i - 2) * 0.22);
      ctx.transform(1, 0, -0.25, 0.55, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-15, -56, 32, 54);
      ctx.fillStyle = '#3b1d5c';
      ctx.fillRect(-17, -60, 32, 54);
      ctx.strokeStyle = '#e8cf8f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-14, -57, 26, 48);
      ctx.fillStyle = '#e8cf8f';
      ctx.beginPath();
      ctx.arc(-1, -33, 5, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // headphones, left on the bed
    ctx.strokeStyle = '#2c2a30';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(1300, 650, 34, 20, 0.2, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = '#2c2a30';
    ctx.beginPath(); ctx.ellipse(1268, 660, 10, 14, 0.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(1334, 668, 10, 14, 0.2, 0, 7); ctx.fill();
  }

  function paintPlant(ctx) {
    // a big leafy plant in the corner by the window
    soft(ctx, 20, 'rgba(20,12,6,0.6)', () => { ctx.beginPath(); ctx.ellipse(190, 918, 80, 16, 0, 0, 7); ctx.fill(); });
    fillPoly(ctx, [[130, 810], [250, 810], [236, 920], [144, 920]], lin(ctx, 130, 0, 250, 0, [[0, '#8a4d34'], [0.5, '#b06a48'], [1, '#7d4530']]));
    fillPoly(ctx, [[124, 800], [256, 800], [256, 818], [124, 818]], '#9d5b3e');
    const leaf = (x, y, len, ang, shade) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(len * 0.35, -len * 0.3, len * 0.8, -len * 0.25, len, 0);
      ctx.bezierCurveTo(len * 0.8, len * 0.25, len * 0.35, len * 0.3, 0, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20, 40, 20, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len * 0.95, 0);
      ctx.stroke();
      ctx.restore();
    };
    ctx.strokeStyle = '#4d6b3c';
    ctx.lineWidth = 3;
    for (let i = 0; i < 17; i++) {
      const a = -Math.PI / 2 + R(-1.1, 1.1);
      const L = R(90, 230);
      const ex = 190 + Math.cos(a) * L;
      const ey = 800 + Math.sin(a) * L;
      ctx.beginPath();
      ctx.moveTo(190, 806);
      ctx.quadraticCurveTo(190 + Math.cos(a) * L * 0.3, 800 + Math.sin(a) * L * 0.7, ex, ey);
      ctx.stroke();
      const tones = ['#4f7a45', '#5f8b50', '#3f6538', '#6c9658'];
      leaf(ex, ey, R(50, 86), a + R(-0.9, 0.9), tones[i % 4]);
    }
  }

  function paintClutter(ctx) {
    // a stack of books by the bed, a record crate
    const book = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x, y + h - 3, w, 3); };
    soft(ctx, 14, 'rgba(20,12,6,0.55)', () => ctx.fillRect(1470, 900, 110, 20));
    book(1470, 870, 108, 22, '#6b8fb3');
    book(1478, 848, 96, 22, '#b8834a');
    book(1466, 828, 104, 20, '#8e5a78');
    book(1484, 810, 84, 18, '#e6dccb');
    soft(ctx, 14, 'rgba(20,12,6,0.55)', () => ctx.fillRect(700, 912, 150, 22));
    fillPoly(ctx, [[700, 832], [850, 832], [856, 924], [694, 924]], '#a8794f');
    ctx.strokeStyle = 'rgba(40,25,15,0.45)';
    ctx.lineWidth = 2;
    for (let y = 850; y < 920; y += 18) { ctx.beginPath(); ctx.moveTo(698, y); ctx.lineTo(854, y); ctx.stroke(); }
    ['#2b2230', '#c2415f', '#5a78c8', '#f0b43a', '#3f8f86'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(712 + i * 26, 800 + (i % 2) * 6, 22, 40);
    });
  }

  /* ==========================================================
     THE LIGHT
     ========================================================== */
  function paintSun(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // the window, projected: four panes with the cross of the frame between them
    const panes = (q, blur, amount, hard = false) => {
      const gap = 0.035;
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([i, j]) => {
        const a0 = i ? 0.5 + gap : 0;
        const a1 = i ? 1 : 0.5 - gap;
        const b0 = j ? 0.46 + gap : 0;
        const b1 = j ? 1 : 0.46 - gap;
        const pts = [quadPt(q, a0, b0), quadPt(q, a1, b0), quadPt(q, a1, b1), quadPt(q, a0, b1)];
        soft(ctx, blur, `rgba(255,0,0,${amount})`, () => { path(ctx, pts); ctx.fill(); });
        if (hard) fillPoly(ctx, pts, `rgba(255,0,0,${amount * 0.5})`);
      });
    };
    panes(PATCH, 8, 0.95, true);
    panes(FLOOR_PATCH, 10, 0.7, true);
    panes(BED_PATCH, 12, 0.75, true);
    // light bouncing up off the floor, and glancing off the window frame
    soft(ctx, 60, 'rgba(255,0,0,0.18)', () => { ctx.beginPath(); ctx.ellipse(660, 860, 220, 60, 0, 0, 7); ctx.fill(); });
    soft(ctx, 30, 'rgba(255,0,0,0.5)', () => { const s = winPt(0.5, 1.0); ctx.beginPath(); ctx.ellipse(s[0], s[1] - 2, 70, 10, -0.2, 0, 7); ctx.fill(); });
    // the curtain glows where the sun comes through it
    soft(ctx, 30, 'rgba(255,0,0,0.45)', () => { const c = winPt(1.02, 0.4); ctx.beginPath(); ctx.ellipse(c[0] - 6, c[1], 24, 160, 0.1, 0, 7); ctx.fill(); });

    // the beams in the air (G), from the window to where they land
    const beam = (pts, a) => {
      ctx.save();
      ctx.globalAlpha = a;
      soft(ctx, 26, 'rgba(0,255,0,1)', () => { path(ctx, pts); ctx.fill(); });
      ctx.restore();
    };
    beam([winPt(0.1, 0.05), winPt(0.95, 0.1), PATCH[1], PATCH[2], winPt(0.9, 0.95), winPt(0.1, 0.9)], 0.22);
    beam([winPt(0.2, 0.5), winPt(0.9, 0.55), FLOOR_PATCH[1], FLOOR_PATCH[2], FLOOR_PATCH[3], winPt(0.2, 1.0)], 0.2);
    beam([winPt(0.4, 0.3), winPt(0.95, 0.4), BED_PATCH[1], BED_PATCH[2], BED_PATCH[3], winPt(0.4, 0.9)], 0.12);
    // near the window the air is brightest
    soft(ctx, 80, 'rgba(0,255,0,0.35)', () => { const c = winPt(0.6, 0.5); ctx.beginPath(); ctx.ellipse(c[0] + 80, c[1], 120, 220, 0, 0, 7); ctx.fill(); });

    // B: where leaf shadows can drift through (the patches)
    [PATCH, FLOOR_PATCH, BED_PATCH].forEach((q) => soft(ctx, 20, 'rgba(0,0,255,1)', () => { path(ctx, q); ctx.fill(); }));
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintEmit(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // R: the lamp (shade, bulb, and the pool of light it throws on the desk and wall)
    soft(ctx, 6, 'rgba(255,0,0,1)', () => { path(ctx, [[322, 418], [364, 418], [382, 468], [304, 468]]); ctx.fill(); });
    soft(ctx, 60, 'rgba(255,0,0,0.55)', () => { ctx.beginPath(); ctx.ellipse(343, 540, 170, 90, 0, 0, 7); ctx.fill(); });
    soft(ctx, 90, 'rgba(255,0,0,0.3)', () => { ctx.beginPath(); ctx.ellipse(343, 380, 150, 140, 0, 0, 7); ctx.fill(); });
    // G: the laptop screen and its glow
    soft(ctx, 3, 'rgba(0,255,0,1)', () => { path(ctx, [[416, 498], [540, 498], [547, 568], [409, 568]]); ctx.fill(); });
    soft(ctx, 60, 'rgba(0,255,0,0.4)', () => { ctx.beginPath(); ctx.ellipse(478, 540, 150, 100, 0, 0, 7); ctx.fill(); });
    // B: fairy lights
    lightBulbs().forEach(([x, y]) => soft(ctx, 6, 'rgba(0,0,255,1)', () => { ctx.beginPath(); ctx.arc(x, y + 4, 5, 0, 7); ctx.fill(); }));
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintForeground(ctx) {
    ctx.clearRect(0, 0, W, H);
    // a sheer curtain hanging right in front of us, on the left
    ctx.save();
    ctx.filter = 'blur(10px)';
    for (let k = 0; k < 9; k++) {
      const x = -60 + k * 22;
      const g = ctx.createLinearGradient(x, 0, x + 34, 0);
      g.addColorStop(0, 'rgba(250, 240, 226, 0.0)');
      g.addColorStop(0.5, `rgba(255, 246, 232, ${0.35 + (k % 3) * 0.12})`);
      g.addColorStop(1, 'rgba(250, 240, 226, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, -40);
      ctx.bezierCurveTo(x + 24, 300, x - 14, 640, x + 16 + k * 3, 1040);
      ctx.lineTo(x + 50 + k * 3, 1040);
      ctx.bezierCurveTo(x + 20, 640, x + 58, 300, x + 34, -40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // out-of-focus fairy lights along the top edge (bokeh)
    for (let i = 0; i < 9; i++) {
      const x = 900 + i * 90 + R(-20, 20);
      const y = 18 + Math.sin(i * 0.9) * 16;
      const r = R(18, 30);
      ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, 'rgba(255, 226, 170, 0.5)'], [0.8, 'rgba(255, 214, 150, 0.35)'], [1, 'rgba(255, 214, 150, 0)']]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fill();
    }
  }

  /* ==========================================================
     PUBLIC
     ========================================================== */
  async function paint({ scale = 1.5 } = {}) {
    S = scale;
    try { await Promise.all([document.fonts.load('600 22px Caveat'), document.fonts.load('italic 300 30px Fraunces')]); } catch { /* fine */ }
    const coverNames = ['veil', 'deep-love', 'memory', 'anthems', 'march-5', 'sun-and-moon', 'treehouse', 'milk'];
    const covers = (await Promise.all(coverNames.map((n) => loadImg(`../assets/covers/${n}.jpg`)))).filter(Boolean);

    const albedo = layer(1);
    paintRoom(albedo.ctx, covers);

    // a blurred copy, for depth of field: shrink it down and let the GPU smooth it
    const blur = layer(0.14);
    blur.ctx.setTransform(1, 0, 0, 1, 0, 0);
    blur.ctx.imageSmoothingQuality = 'high';
    const mid = document.createElement('canvas');
    mid.width = Math.round(albedo.c.width * 0.35);
    mid.height = Math.round(albedo.c.height * 0.35);
    const mctx = mid.getContext('2d');
    mctx.imageSmoothingQuality = 'high';
    mctx.drawImage(albedo.c, 0, 0, mid.width, mid.height);
    blur.ctx.drawImage(mid, 0, 0, blur.c.width, blur.c.height);

    const sun = layer(0.5);
    paintSun(sun.ctx);
    const emit = layer(0.5);
    paintEmit(emit.ctx);

    const fg = layer(0.5);
    paintForeground(fg.ctx);

    return {
      W, H,
      albedo: albedo.c,
      blur: blur.c,
      sun: sun.c,
      emit: emit.c,
      fg: fg.c,
      hotspots: HOTSPOTS,
      window: [winPt(0, 0), winPt(1, 0), winPt(1, 1), winPt(0, 1)],
      lamp: [343, 440]
    };
  }

  Void.dream = Void.dream || {};
  Void.dream.memoryPaint = { paint, HOTSPOTS, W, H };
})();
