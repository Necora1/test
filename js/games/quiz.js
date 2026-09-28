/* ==========================================================
   blurry covers — a cover comes into focus, one big pixel at a
   time. Name the song before it's sharp: the sooner, the more
   points (up to 100 a round, eight rounds).
   ========================================================== */
(() => {
  const Void = window.Void;
  const songs = (Void.favorites || []).filter((s) => s.cover);
  const ROUNDS = 8;
  const STEPS = [64, 44, 32, 24, 18, 13, 9, 6, 4, 2, 1];
  const SECONDS = 9;

  const shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  Void.dream.arcade.register({
    id: 'quiz',
    name: 'blurry covers',
    unit: 'pts',
    how: 'a cover slowly comes into focus. name the song before it does: the sooner, the more points.',
    mount(api) {
      const box = document.createElement('div');
      box.className = 'quiz';
      box.innerHTML = `
        <div class="quiz-frame"><canvas class="quiz-canvas" width="300" height="300" aria-label="A blurry album cover"></canvas><span class="quiz-timer"><i></i></span></div>
        <div class="quiz-side">
          <p class="quiz-round"></p>
          <div class="quiz-options" role="group" aria-label="Which song is it?"></div>
          <p class="quiz-said" role="status" aria-live="polite"></p>
        </div>`;
      api.stage.append(box);
      const canvas = box.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const small = document.createElement('canvas');
      const sctx = small.getContext('2d');
      const bar = box.querySelector('.quiz-timer i');
      const roundEl = box.querySelector('.quiz-round');
      const options = box.querySelector('.quiz-options');
      const said = box.querySelector('.quiz-said');

      let order = [];
      let round = 0;
      let score = 0;
      let img = null;
      let startAt = 0;
      let answered = true;
      let alive = true;
      let raf = 0;
      let lastStep = -1;
      let timers = [];

      function paint(px) {
        const S = 300;
        if (!img || !img.complete || !img.naturalWidth) {
          ctx.fillStyle = '#111';
          ctx.fillRect(0, 0, S, S);
          return;
        }
        if (px <= 1) {
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, 0, 0, S, S);
          return;
        }
        const n = Math.max(1, Math.round(S / px));
        small.width = n;
        small.height = n;
        sctx.imageSmoothingEnabled = true;
        sctx.drawImage(img, 0, 0, n, n);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, 0, 0, n, n, 0, 0, S, S);
      }

      function tick(now) {
        if (!alive) return;
        raf = requestAnimationFrame(tick);
        if (answered || !api.active()) return;
        const k = Math.min(1, (now - startAt) / (SECONDS * 1000));
        bar.style.transform = `scaleX(${1 - k})`;
        const s = Math.min(STEPS.length - 1, Math.floor(k * STEPS.length));
        if (s !== lastStep) { lastStep = s; paint(STEPS[s]); }
        if (k >= 1) answer(null);
      }

      function next() {
        if (round >= ROUNDS) { end(); return; }
        const song = order[round];
        round++;
        roundEl.textContent = `round ${round} of ${ROUNDS}`;
        said.textContent = '';
        const wrong = shuffle(songs.filter((s) => s !== song)).slice(0, 3);
        options.replaceChildren(...shuffle([song, ...wrong]).map((s) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'quiz-opt';
          b.dataset.right = String(s === song);
          b.innerHTML = '<span class="qo-title"></span><span class="qo-artist"></span>';
          b.querySelector('.qo-title').textContent = s.title;
          b.querySelector('.qo-artist').textContent = s.artist;
          b.addEventListener('click', () => answer(b));
          return b;
        }));
        img = new Image();
        img.onload = () => { lastStep = -1; startAt = performance.now(); answered = false; };
        img.src = `assets/covers/${song.cover}.jpg`;
        paint(64);
        bar.style.transform = 'scaleX(1)';
      }

      function answer(btn) {
        if (answered) return;
        answered = true;
        const k = Math.min(1, (performance.now() - startAt) / (SECONDS * 1000));
        paint(1);
        const right = options.querySelector('[data-right="true"]');
        options.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        right.classList.add('is-right');
        if (btn && btn === right) {
          const pts = Math.max(10, Math.round(100 * (1 - k)));
          score += pts;
          said.textContent = `yes! +${pts}`;
          const r = canvas.getBoundingClientRect();
          Void.dream.fx.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 24, speed: 240 });
          [0, 2, 4].forEach((n, i) => Void.dream.sound.chime(Void.dream.sound.step(n + 4, 392), { when: i * 0.07, vol: 0.09 }));
        } else {
          if (btn) btn.classList.add('is-wrong');
          said.textContent = btn ? `no, it's ${right.querySelector('.qo-title').textContent}` : `too slow, it's ${right.querySelector('.qo-title').textContent}`;
          Void.dream.sound.thud({ vol: 0.2 });
        }
        api.score(`score ${score}`);
        timers.push(setTimeout(next, 1700));
      }

      function end() {
        const best = api.record(score, 'high');
        options.replaceChildren();
        roundEl.textContent = 'done';
        said.innerHTML = `<span class="go-big">${score} points</span>${best ? ' · a new best ✧' : ''}`;
        const again = document.createElement('button');
        again.type = 'button';
        again.className = 'send-btn';
        again.innerHTML = '<span class="btn-label">play again</span>';
        again.addEventListener('click', begin);
        options.append(again);
        if (best) {
          const r = box.getBoundingClientRect();
          Void.dream.fx.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 70, speed: 400 });
        }
      }

      function begin() {
        Void.dream.sound.wake();
        timers.forEach(clearTimeout);
        order = shuffle(songs).slice(0, ROUNDS);
        round = 0;
        score = 0;
        api.score('score 0');
        next();
      }

      // a start screen, so the clock doesn't run before you're here
      roundEl.textContent = `${ROUNDS} rounds`;
      img = new Image();
      img.onload = () => paint(32);
      img.src = `assets/covers/${songs[Math.floor(Math.random() * songs.length)].cover}.jpg`;
      paint(64);
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'send-btn';
      go.innerHTML = '<span class="btn-label">start</span>';
      go.addEventListener('click', begin);
      options.append(go);
      raf = requestAnimationFrame(tick);

      return {
        destroy() {
          alive = false;
          cancelAnimationFrame(raf);
          timers.forEach(clearTimeout);
        }
      };
    }
  });
})();
