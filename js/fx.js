/* ==========================================================
   fx.js — a glass sheet over everything, for sparks
   · burst(x, y)       a puff of little stars (wins, catches…)
   · fly(from, to)     a comet from one point to another
   · shooting stars that cross the sky now and then — click one
     to catch it
   · your wishes, hanging in the sky as a constellation (home)
   · a faint trail of sparks behind the mouse
   Only draws while there is something to draw.
   ========================================================== */
(() => {
  const Void = window.Void;
  const colors = Void.dream.palette.current;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  const label = document.getElementById('wishLabel');

  let W = 0;
  let H = 0;
  let dpr = 1;
  let sparks = [];
  let comets = [];
  let shooter = null;
  let nextShooter = 6 + Math.random() * 8;
  let dirty = false;
  let lastMove = { x: 0, y: 0, t: 0 };
  let hoverWish = null;

  const rand = (a, b) => a + Math.random() * (b - a);
  const rgba = (c, a) => `rgba(${(c[0] * 255) | 0}, ${(c[1] * 255) | 0}, ${(c[2] * 255) | 0}, ${a})`;
  // stars (shooting ones, and wishes) are out of the window only
  const home = () => document.body.classList.contains('is-outside');
  const reduced = () => Void.motion.reduced;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    dirty = true;
  }

  function star(x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? r * 0.38 : r;
      const a = rot + (i * Math.PI) / 4;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- public bits ---------- */
  function burst(x, y, { count = 26, speed = 260, hues = null, gravity = 240, life = 1.1, size = 5 } = {}) {
    if (reduced()) return;
    const palette = hues || [colors.glow, colors.accent, [1, 1, 1]];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.25 + Math.random() * 0.75);
      sparks.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.2,
        g: gravity, life: life * rand(0.6, 1.2), age: 0,
        r: size * rand(0.5, 1.3), rot: rand(0, 6.28), spin: rand(-6, 6),
        c: palette[i % palette.length], star: Math.random() < 0.6
      });
    }
  }

  function fly(x0, y0, x1, y1, { duration = 1.1, onDone = null, color = null } = {}) {
    if (reduced()) { onDone?.(); return; }
    comets.push({ x0, y0, x1, y1, t: 0, duration, onDone, c: color, trail: [] });
  }

  /* ---------- shooting stars ---------- */
  function launchShooter() {
    const fromLeft = Math.random() < 0.5;
    const y = rand(0.06, 0.3) * H;
    const speed = rand(520, 760);
    const angle = rand(0.18, 0.38);
    shooter = {
      x: fromLeft ? -40 : W + 40, y,
      vx: (fromLeft ? 1 : -1) * Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      trail: []
    };
  }

  function catchShooter(x, y) {
    if (!shooter) return false;
    if (Math.hypot(x - shooter.x, y - shooter.y) > (finePointer ? 60 : 80)) return false;
    burst(shooter.x, shooter.y, { count: 40, speed: 320 });
    Void.dream.sky.ripple(shooter.x, shooter.y, 1.4);
    [0, 2, 4, 7].forEach((n, i) => Void.dream.sound.chime(Void.dream.sound.step(n + 5), { when: i * 0.07, vol: 0.1 }));
    shooter = null;
    const caught = (Void.store.get('dream_stars', 0) || 0) + 1;
    Void.store.set('dream_stars', caught);
    Void.emit('star:caught', caught);
    return true;
  }

  /* ---------- the wish constellation ---------- */
  function wishPoints() {
    const list = Void.dream.wishes?.list() || [];
    return list.map((w) => ({ ...w, px: w.x * W, py: w.y * H }));
  }

  function drawConstellation(t) {
    const pts = wishPoints();
    if (!pts.length) return false;
    const fade = home() ? 1 : 0;
    if (!fade) return false;
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(colors.glow, 0.16);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.px, p.py) : ctx.moveTo(p.px, p.py)));
    ctx.stroke();
    pts.forEach((p, i) => {
      const tw = 0.65 + 0.35 * Math.sin(t * 1.6 + i * 2.1);
      const r = (p === hoverWish || p.id === hoverWish?.id ? 5.5 : 3.2) * (0.85 + 0.3 * tw);
      const g = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, r * 5);
      g.addColorStop(0, rgba(colors.glow, 0.55 * tw));
      g.addColorStop(1, rgba(colors.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(p.px - r * 5, p.py - r * 5, r * 10, r * 10);
      ctx.fillStyle = rgba([1, 0.98, 0.93], 0.95);
      star(p.px, p.py, r, t * 0.3 + i);
    });
    return true;
  }

  function pickWish(x, y) {
    if (!home()) return null;
    let best = null;
    let bestD = 22;
    wishPoints().forEach((p) => {
      const d = Math.hypot(p.px - x, p.py - y);
      if (d < bestD) { best = p; bestD = d; }
    });
    return best;
  }

  /* ---------- the loop ---------- */
  function frame(t, dt) {
    const hadSomething = dirty;
    dirty = false;

    // a shooting star every so often, over the home sky only
    if (home() && !reduced() && document.visibilityState === 'visible') {
      nextShooter -= dt;
      if (nextShooter <= 0 && !shooter) { launchShooter(); nextShooter = rand(9, 22); }
    }

    const busy = sparks.length || comets.length || shooter || (home() && (Void.dream.wishes?.list().length || 0));
    if (!busy && !hadSomething) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    let drew = drawConstellation(t);

    if (shooter) {
      shooter.x += shooter.vx * dt;
      shooter.y += shooter.vy * dt;
      shooter.trail.unshift({ x: shooter.x, y: shooter.y });
      if (shooter.trail.length > 22) shooter.trail.pop();
      ctx.lineCap = 'round';
      for (let i = 1; i < shooter.trail.length; i++) {
        const a = 1 - i / shooter.trail.length;
        ctx.strokeStyle = rgba(colors.glow, a * 0.8);
        ctx.lineWidth = 3.2 * a;
        ctx.beginPath();
        ctx.moveTo(shooter.trail[i - 1].x, shooter.trail[i - 1].y);
        ctx.lineTo(shooter.trail[i].x, shooter.trail[i].y);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(shooter.x, shooter.y, 0, shooter.x, shooter.y, 18);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, rgba(colors.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(shooter.x - 18, shooter.y - 18, 36, 36);
      if (shooter.x < -80 || shooter.x > W + 80 || shooter.y > H * 0.7 || !home()) shooter = null;
      drew = true;
    }

    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      c.t += dt / c.duration;
      const k = Math.min(1, c.t);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      // an arc, not a straight line
      const lift = Math.sin(k * Math.PI) * Math.min(160, Math.abs(c.x1 - c.x0) * 0.4 + 60);
      const x = c.x0 + (c.x1 - c.x0) * e;
      const y = c.y0 + (c.y1 - c.y0) * e - lift;
      c.trail.unshift({ x, y });
      if (c.trail.length > 18) c.trail.pop();
      const col = c.c || colors.glow;
      for (let j = 1; j < c.trail.length; j++) {
        const a = 1 - j / c.trail.length;
        ctx.strokeStyle = rgba(col, a * 0.7);
        ctx.lineWidth = 4 * a;
        ctx.beginPath();
        ctx.moveTo(c.trail[j - 1].x, c.trail[j - 1].y);
        ctx.lineTo(c.trail[j].x, c.trail[j].y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      star(x, y, 7, t * 4);
      if (c.t >= 1) {
        comets.splice(i, 1);
        burst(c.x1, c.y1, { count: 18, speed: 160, gravity: 60 });
        c.onDone?.();
      }
      drew = true;
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age >= s.life) { sparks.splice(i, 1); continue; }
      s.vx *= Math.pow(0.4, dt);
      s.vy = s.vy * Math.pow(0.4, dt) + s.g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.spin * dt;
      const a = 1 - s.age / s.life;
      ctx.fillStyle = rgba(s.c, a);
      if (s.star) star(s.x, s.y, s.r * (0.6 + a * 0.4), s.rot);
      else { ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.45, 0, 6.283); ctx.fill(); }
      drew = true;
    }

    if (drew) dirty = true; // clear next frame too, once things are gone
  }

  Void.dream.fx = {
    burst,
    fly,
    init() {
      resize();
      window.addEventListener('resize', resize);
      Void.dream.onFrame(frame);

      // catching a shooting star (capture phase, before the scene's own click)
      window.addEventListener('pointerdown', (e) => {
        if (!home() || !shooter) return;
        if (catchShooter(e.clientX, e.clientY)) e.stopPropagation();
      }, true);

      // hovering a wish shows what it was
      window.addEventListener('pointermove', (e) => {
        const now = performance.now();
        // a few sparks behind a quick mouse
        if (finePointer && !reduced() && home()) {
          const d = Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y);
          if (d > 26 && now - lastMove.t < 60 && Math.random() < 0.5) {
            sparks.push({
              x: e.clientX, y: e.clientY, vx: rand(-20, 20), vy: rand(-30, 10), g: 30, life: rand(0.5, 0.9), age: 0,
              r: rand(2, 3.5), rot: 0, spin: rand(-4, 4), c: Math.random() < 0.5 ? colors.glow : colors.accent, star: true
            });
          }
        }
        lastMove = { x: e.clientX, y: e.clientY, t: now };

        const w = pickWish(e.clientX, e.clientY);
        if (w?.id !== hoverWish?.id) {
          hoverWish = w;
          if (w) {
            label.textContent = w.text;
            label.style.left = `${w.px}px`;
            label.style.top = `${w.py}px`;
            label.hidden = false;
          } else label.hidden = true;
          dirty = true;
        }
      }, { passive: true });
      Void.on('view', () => { label.hidden = true; hoverWish = null; dirty = true; });
    }
  };
})();
