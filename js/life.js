/* ==========================================================
   life.js — what drifts through the dream
   · jellyfish, glowing like paper lanterns, pulsing their way
     up through the sky and shying away from the cursor
   · specks of dust (the "deep love" cover's snow)
   · rain streaks, when the rain is on
   Everything takes the current song's colours.
   ========================================================== */
(() => {
  const Void = window.Void;
  const canvas = document.getElementById('life');
  const ctx = canvas.getContext('2d');
  const colors = Void.dream.palette.current;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  let W = 0;
  let H = 0;
  let jellies = [];
  let dust = [];
  let drops = [];
  let raining = false;
  let rainAmount = 0;
  let pointer = { x: -9999, y: -9999 };

  const rand = (a, b) => a + Math.random() * (b - a);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgba = (c, a) => `rgba(${(c[0] * 255) | 0}, ${(c[1] * 255) | 0}, ${(c[2] * 255) | 0}, ${a})`;

  function makeJelly(anywhere) {
    const size = rand(16, 46);
    return {
      x: rand(0.05, 0.95) * W,
      y: anywhere ? rand(0.1, 1.05) * H : H + size * 3,
      vx: 0,
      size,
      depth: size / 46,
      rate: rand(1.1, 1.9),
      phase: rand(0, Math.PI * 2),
      tint: Math.random(),
      alpha: rand(0.55, 0.95),
      speed: rand(9, 20)
    };
  }

  function populate() {
    const small = W < 700;
    jellies = Array.from({ length: small ? 4 : 7 }, () => makeJelly(true));
    dust = Array.from({ length: small ? 40 : 80 }, () => ({
      x: rand(0, W), y: rand(0, H), r: rand(0.4, 1.5), vy: rand(4, 13), sway: rand(0, 6.28), a: rand(0.2, 0.7)
    }));
    drops = Array.from({ length: small ? 80 : 160 }, () => ({ x: rand(-0.2, 1) * W, y: rand(0, H), len: rand(10, 22), v: rand(650, 950) }));
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    populate();
  }

  /* ---------- drawing ---------- */
  function drawJelly(j, t) {
    const pulse = Math.sin(t * j.rate + j.phase);          // -1 … 1
    const w = j.size * (1 + pulse * 0.09);
    const h = j.size * 0.64 * (1 - pulse * 0.1);
    const glow = mix(colors.glow, colors.accent, j.tint * 0.5);
    const edge = mix(colors.glow, colors.accent, 0.55);
    const a = j.alpha;

    ctx.save();
    ctx.translate(j.x, j.y);
    ctx.rotate(Math.sin(t * 0.35 + j.phase) * 0.14 + j.vx * 0.01);

    // halo
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, -h * 0.3, 0, 0, -h * 0.3, w * 2.2);
    halo.addColorStop(0, rgba(glow, 0.2 * a));
    halo.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(-w * 2.3, -w * 2.5, w * 4.6, w * 4.6);
    ctx.globalCompositeOperation = 'source-over';

    // tentacles, swaying behind the bell
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.7, j.size / 42);
    ctx.strokeStyle = rgba(edge, 0.3 * a);
    for (let k = 0; k < 5; k++) {
      const x0 = (k / 4 - 0.5) * w * 1.3;
      const len = j.size * (1.3 + 0.35 * Math.sin(k * 1.7 + j.phase));
      ctx.beginPath();
      ctx.moveTo(x0, h * 0.12);
      for (let s = 1; s <= 7; s++) {
        const y = h * 0.12 + (len * s) / 7;
        const x = x0 + Math.sin(t * 1.7 + j.phase + s * 0.65 + k) * (1.5 + s * 1.3) * (j.size / 36);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // the bell, with a scalloped rim
    ctx.beginPath();
    ctx.moveTo(-w, h * 0.14);
    ctx.bezierCurveTo(-w, -h * 1.3, w, -h * 1.3, w, h * 0.14);
    for (let k = 1; k <= 6; k++) {
      const x1 = w - k * (w / 3);
      ctx.quadraticCurveTo(x1 + w / 6, h * 0.32, x1, h * 0.14);
    }
    const bell = ctx.createRadialGradient(0, -h * 0.55, 0, 0, -h * 0.2, w * 1.25);
    bell.addColorStop(0, rgba(glow, 0.62 * a));
    bell.addColorStop(0.55, rgba(mix(glow, colors.accent, 0.45), 0.28 * a));
    bell.addColorStop(1, rgba(colors.accent, 0.08 * a));
    ctx.fillStyle = bell;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(glow, 0.5 * a);
    ctx.stroke();

    // a little light inside
    ctx.fillStyle = rgba(colors.glow, 0.45 * a);
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.45, w * 0.22, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  let idle = false;
  function frame(t, dt) {
    // only out of the window, over the night sea
    if (!document.body.classList.contains('is-outside')) {
      if (!idle) { ctx.clearRect(0, 0, W, H); idle = true; }
      return;
    }
    idle = false;
    ctx.clearRect(0, 0, W, H);

    // dust drifting down
    ctx.fillStyle = rgba(colors.glow, 1);
    for (const d of dust) {
      d.y += d.vy * dt;
      d.x += Math.sin(t * 0.4 + d.sway) * 6 * dt;
      if (d.y > H + 4) { d.y = -4; d.x = rand(0, W); }
      ctx.globalAlpha = d.a * (0.55 + 0.45 * Math.sin(t * 1.3 + d.sway * 3));
      ctx.fillRect(d.x, d.y, d.r, d.r);
    }
    ctx.globalAlpha = 1;

    // jellyfish
    for (const j of jellies) {
      const pulse = Math.sin(t * j.rate + j.phase);
      // they move in pushes: faster while the bell contracts
      j.y -= (j.speed * (0.45 + Math.max(0, -pulse) * 1.6)) * dt * (0.6 + j.depth * 0.6);
      // shy of the cursor
      const dx = j.x - pointer.x;
      const dy = j.y - pointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 150 && dist > 0.1) j.vx += (dx / dist) * (150 - dist) * 0.9 * dt;
      j.vx *= Math.pow(0.35, dt);
      j.x += (j.vx + Math.sin(t * 0.2 + j.phase) * 5) * dt;
      if (j.y < -j.size * 4 || j.x < -120 || j.x > W + 120) Object.assign(j, makeJelly(false));
      drawJelly(j, t);
    }

    // rain
    rainAmount += ((raining ? 1 : 0) - rainAmount) * Math.min(1, dt * 1.5);
    if (rainAmount > 0.01) {
      ctx.strokeStyle = rgba(mix(colors.glow, colors.horizon, 0.3), 0.32 * rainAmount);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const r of drops) {
        r.y += r.v * dt;
        r.x += r.v * 0.18 * dt;
        if (r.y > H) { r.y = rand(-40, 0); r.x = rand(-0.2, 1) * W; }
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.len * 0.18, r.y - r.len);
      }
      ctx.stroke();
    }
  }

  Void.dream.life = {
    init() {
      resize();
      window.addEventListener('resize', resize);
      if (finePointer) {
        window.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; }, { passive: true });
        document.documentElement.addEventListener('pointerleave', () => { pointer = { x: -9999, y: -9999 }; });
      }
      Void.dream.onFrame(frame);
    },
    setRain(on) { raining = on; }
  };
})();
