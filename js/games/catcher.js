/* ==========================================================
   star catcher — a paper boat on the dream's sea, catching the
   stars that fall into it. Moon shards are worth five. The dark
   orbs are bits of the void: three of those and the boat sinks.
   Mouse / touch / arrow keys / A D. Catches in a row climb the
   scale; the whole thing gets faster as it goes.
   ========================================================== */
(() => {
  const Void = window.Void;
  const colors = Void.dream.palette.current;
  const rgba = (c, a) => `rgba(${(c[0] * 255) | 0}, ${(c[1] * 255) | 0}, ${(c[2] * 255) | 0}, ${a})`;
  const rand = (a, b) => a + Math.random() * (b - a);

  Void.dream.arcade.register({
    id: 'catcher',
    name: 'star catcher',
    how: 'catch the stars in the paper boat. moon shards are worth 5. dodge the dark bits of void. mouse, touch or ← →',
    mount(api) {
      const wrap = document.createElement('div');
      wrap.className = 'game-canvas-wrap';
      const canvas = document.createElement('canvas');
      canvas.className = 'game-canvas';
      canvas.setAttribute('aria-label', 'Star catcher game');
      canvas.tabIndex = 0;
      const overlay = document.createElement('div');
      overlay.className = 'game-overlay';
      wrap.append(canvas, overlay);
      api.stage.append(wrap);
      const ctx = canvas.getContext('2d');

      let W = 0;
      let H = 0;
      let dpr = 1;
      let state = 'ready'; // ready · play · over
      let boat = { x: 0.5, tx: 0.5, tilt: 0 };
      let things = [];
      let bits = [];
      let score = 0;
      let lives = 3;
      let combo = 0;
      let time = 0;
      let spawn = 0;
      let shake = 0;
      let flash = 0;
      let keys = { l: false, r: false };
      let alive = true;
      let raf = 0;
      let last = 0;
      const sky = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random() * 0.75, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6 }));

      function resize() {
        const r = wrap.getBoundingClientRect();
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = r.width;
        H = r.height;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }

      function say(html, button) {
        overlay.innerHTML = html;
        if (button) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'send-btn game-go';
          b.innerHTML = `<span class="btn-label">${button}</span>`;
          b.addEventListener('click', start);
          overlay.append(b);
        }
        overlay.hidden = false;
      }

      function hud() {
        api.score(`score ${score}  ·  ${'☾'.repeat(lives)}${'·'.repeat(3 - lives)}${combo > 2 ? `  ·  ×${combo}` : ''}`);
      }

      function start() {
        Void.dream.sound.wake();
        state = 'play';
        things = [];
        bits = [];
        score = 0;
        lives = 3;
        combo = 0;
        time = 0;
        spawn = 0.4;
        overlay.hidden = true;
        canvas.focus({ preventScroll: true });
        hud();
      }

      function over() {
        state = 'over';
        Void.dream.sound.thud({ vol: 0.4 });
        const best = api.record(score, 'high');
        say(`<p class="go-big">the boat sank</p><p>${score} ${score === 1 ? 'star' : 'stars'}${best && score > 0 ? ' · a new best ✧' : ''}</p>`, 'again');
        if (best && score > 0) {
          const r = canvas.getBoundingClientRect();
          Void.dream.fx.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 60, speed: 380 });
        }
      }

      function spawnThing() {
        const speedUp = 1 + time / 45;
        const r = Math.random();
        const voidChance = Math.min(0.34, 0.14 + time / 300);
        const kind = r < voidChance ? 'void' : r < voidChance + 0.07 ? 'moon' : 'star';
        things.push({
          kind,
          x: rand(0.06, 0.94),
          y: -0.05,
          vy: rand(0.16, 0.27) * speedUp * (kind === 'moon' ? 0.8 : 1),
          sway: kind === 'moon' ? rand(0.5, 1) : 0,
          p: rand(0, 6.28),
          rot: rand(0, 6.28)
        });
      }

      function pop(x, y, col, n = 14) {
        for (let i = 0; i < n; i++) {
          const a = rand(0, 6.28);
          const v = rand(40, 180);
          bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rand(0.4, 0.9), age: 0, col });
        }
      }

      function star(x, y, r, rot) {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? r * 0.45 : r;
          const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }

      function update(dt) {
        time += dt;
        if (keys.l) boat.tx -= dt * 1.1;
        if (keys.r) boat.tx += dt * 1.1;
        boat.tx = Math.max(0.05, Math.min(0.95, boat.tx));
        const before = boat.x;
        boat.x += (boat.tx - boat.x) * (1 - Math.exp(-dt / 0.07));
        boat.tilt = Math.max(-0.4, Math.min(0.4, (boat.x - before) / Math.max(dt, 0.001) * 0.25));

        spawn -= dt;
        if (spawn <= 0) {
          spawnThing();
          spawn = Math.max(0.28, 0.85 - time / 70) * rand(0.7, 1.3);
        }

        const seaY = 0.8;
        const bx = boat.x;
        for (let i = things.length - 1; i >= 0; i--) {
          const t = things[i];
          t.y += t.vy * dt;
          t.rot += dt * (t.kind === 'void' ? 1.5 : 2);
          if (t.sway) t.x += Math.sin(time * 2 + t.p) * t.sway * 0.12 * dt;
          const px = t.x * W;
          const py = t.y * H;
          // the boat's hull is about 90px wide
          if (t.y > seaY - 0.07 && t.y < seaY + 0.02 && Math.abs(px - bx * W) < Math.max(42, W * 0.065)) {
            things.splice(i, 1);
            if (t.kind === 'void') {
              lives--;
              combo = 0;
              shake = 0.35;
              flash = 1;
              pop(px, py, [0.1, 0.05, 0.15], 20);
              Void.dream.sound.thud({ vol: 0.3 });
              if (lives <= 0) { hud(); over(); return; }
            } else {
              combo++;
              const pts = t.kind === 'moon' ? 5 : 1;
              score += pts * (combo >= 10 ? 2 : 1);
              pop(px, py, t.kind === 'moon' ? colors.glow : colors.accent, t.kind === 'moon' ? 26 : 12);
              Void.dream.sound.chime(Void.dream.sound.step(Math.min(combo, 14), 330), { vol: 0.1, dur: 0.9 });
            }
            hud();
            continue;
          }
          if (t.y > seaY + 0.03) {
            things.splice(i, 1);
            if (t.kind !== 'void') { combo = 0; hud(); }
            pop(px, seaY * H, colors.glow, 5);
          }
        }
      }

      function draw(t) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (shake > 0) ctx.translate(rand(-6, 6) * shake, rand(-6, 6) * shake);
        const seaY = H * 0.8;

        // the sky, in the dream's colours
        const g = ctx.createLinearGradient(0, 0, 0, seaY);
        g.addColorStop(0, rgba(colors.sky, 1));
        g.addColorStop(1, rgba(colors.horizon, 1));
        ctx.fillStyle = g;
        ctx.fillRect(-10, -10, W + 20, seaY + 10);
        sky.forEach((s) => {
          ctx.fillStyle = rgba(colors.glow, 0.35 + 0.35 * Math.sin(t * 2 + s.p));
          ctx.fillRect(s.x * W, s.y * seaY, s.r, s.r);
        });
        // moon
        const mg = ctx.createRadialGradient(W * 0.8, H * 0.2, 0, W * 0.8, H * 0.2, H * 0.3);
        mg.addColorStop(0, rgba(colors.glow, 0.5));
        mg.addColorStop(1, rgba(colors.glow, 0));
        ctx.fillStyle = mg;
        ctx.fillRect(0, 0, W, seaY);
        ctx.fillStyle = rgba(colors.glow, 0.95);
        ctx.beginPath();
        ctx.arc(W * 0.8, H * 0.2, H * 0.06, 0, 6.283);
        ctx.fill();

        // the sea
        const sg = ctx.createLinearGradient(0, seaY, 0, H);
        sg.addColorStop(0, rgba(colors.horizon, 1));
        sg.addColorStop(1, rgba(colors.sky, 1));
        ctx.fillStyle = sg;
        ctx.fillRect(-10, seaY, W + 20, H - seaY + 10);
        ctx.strokeStyle = rgba(colors.glow, 0.25);
        ctx.lineWidth = 1;
        for (let k = 0; k < 6; k++) {
          const y = seaY + 6 + k * k * 3;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.03 + t * 2 + k) * 2);
          ctx.stroke();
        }

        // falling things
        things.forEach((o) => {
          const x = o.x * W;
          const y = o.y * H;
          if (o.kind === 'void') {
            const vg = ctx.createRadialGradient(x, y, 2, x, y, 20);
            vg.addColorStop(0, 'rgba(0,0,0,1)');
            vg.addColorStop(0.6, 'rgba(10,4,18,0.95)');
            vg.addColorStop(1, rgba(colors.accent, 0));
            ctx.fillStyle = vg;
            ctx.beginPath();
            ctx.arc(x, y, 20, 0, 6.283);
            ctx.fill();
            ctx.strokeStyle = rgba(colors.accent, 0.8);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y, 13, o.rot, o.rot + 4);
            ctx.stroke();
          } else if (o.kind === 'moon') {
            ctx.fillStyle = rgba(colors.glow, 1);
            ctx.shadowColor = rgba(colors.glow, 1);
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(x, y, 12, 0.6, 5.7);
            ctx.arc(x + 6, y, 9, 5.2, 1.1, true);
            ctx.fill();
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = 'rgba(255, 250, 235, 1)';
            ctx.shadowColor = rgba(colors.glow, 1);
            ctx.shadowBlur = 12;
            star(x, y, 9, o.rot);
            ctx.shadowBlur = 0;
          }
        });

        // the paper boat
        const bx = boat.x * W;
        const by = seaY + Math.sin(t * 2.4) * 2.5;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(boat.tilt * 0.35 + Math.sin(t * 1.7) * 0.03);
        ctx.fillStyle = '#f6efe2';
        ctx.strokeStyle = 'rgba(43,34,51,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath(); // hull
        ctx.moveTo(-46, -12); ctx.lineTo(46, -12); ctx.lineTo(30, 8); ctx.lineTo(-30, 8); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8dcc6';
        ctx.beginPath(); // sail
        ctx.moveTo(-22, -12); ctx.lineTo(4, -48); ctx.lineTo(24, -12); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(43,34,51,0.25)';
        ctx.beginPath(); ctx.moveTo(4, -48); ctx.lineTo(0, -12); ctx.stroke();
        ctx.restore();
        // its reflection
        ctx.fillStyle = 'rgba(246, 239, 226, 0.12)';
        ctx.fillRect(bx - 30, by + 10, 60, 3);

        // bits
        bits.forEach((b) => {
          ctx.fillStyle = rgba(b.col, 1 - b.age / b.life);
          ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
        });

        if (flash > 0) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = `rgba(20, 0, 30, ${flash * 0.45})`;
          ctx.fillRect(0, 0, W, H);
        }
      }

      function loop(now) {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
        last = now;
        if (!api.active()) return;
        if (state === 'play') update(dt);
        shake = Math.max(0, shake - dt);
        flash = Math.max(0, flash - dt * 2.5);
        for (let i = bits.length - 1; i >= 0; i--) {
          const b = bits[i];
          b.age += dt;
          if (b.age > b.life) { bits.splice(i, 1); continue; }
          b.vy += 300 * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
        }
        draw(now / 1000);
      }

      const move = (e) => {
        const r = canvas.getBoundingClientRect();
        boat.tx = Math.max(0.05, Math.min(0.95, (e.clientX - r.left) / r.width));
      };
      const key = (down) => (e) => {
        if (!api.active() || e.target.closest('input, textarea') || Void.modal.isOpen()) return;
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.l = down; if (state === 'play') e.preventDefault(); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.r = down; if (state === 'play') e.preventDefault(); }
        else if (down && (k === ' ' || k === 'Enter') && state !== 'play' && e.target === canvas) { e.preventDefault(); start(); }
      };
      const onDown = key(true);
      const onUp = key(false);

      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerdown', (e) => { move(e); if (state !== 'play') start(); });
      window.addEventListener('keydown', onDown);
      window.addEventListener('keyup', onUp);
      const ro = new ResizeObserver(resize);
      ro.observe(wrap);
      resize();
      const best = api.best();
      say(`<p class="go-big">star catcher</p><p>${best ? `your best: ${best}` : 'how many can you catch?'}</p>`, 'set sail');
      hud();
      raf = requestAnimationFrame(loop);

      return {
        destroy() {
          alive = false;
          cancelAnimationFrame(raf);
          ro.disconnect();
          window.removeEventListener('keydown', onDown);
          window.removeEventListener('keyup', onUp);
        }
      };
    }
  });
})();
