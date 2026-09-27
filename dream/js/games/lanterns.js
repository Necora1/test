/* ==========================================================
   lanterns — a calm puzzle. Touching a lantern flips it and the
   four around it, lit to dark or dark to lit. Light all 25 and
   they float away into the sky. (Every board can be solved: it
   starts lit and gets scrambled by real touches.)
   ========================================================== */
(() => {
  const Void = window.Void;
  const N = 5;

  Void.dream.arcade.register({
    id: 'lanterns',
    name: 'lanterns',
    unit: 'moves',
    how: 'touching a lantern flips it and its neighbours. light all of them.',
    mount(api) {
      const box = document.createElement('div');
      box.className = 'lanterns';
      const grid = document.createElement('div');
      grid.className = 'lantern-grid';
      grid.setAttribute('role', 'grid');
      grid.setAttribute('aria-label', 'Lanterns');
      const foot = document.createElement('div');
      foot.className = 'lantern-foot';
      box.append(grid, foot);
      api.stage.append(box);

      let lit = [];
      let moves = 0;
      let done = false;
      let timers = [];
      const cells = [];

      for (let i = 0; i < N * N; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lantern';
        b.style.setProperty('--i', String(i));
        b.style.setProperty('--sway', `${(((i * 37) % 11) - 5) * 0.4}deg`);
        b.innerHTML = '<span class="l-string" aria-hidden="true"></span><span class="l-body" aria-hidden="true"><i></i></span>';
        b.addEventListener('click', () => touch(i, true));
        b.addEventListener('keydown', (e) => {
          const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -N, ArrowDown: N }[e.key];
          if (move == null) return;
          const j = i + move;
          if (j < 0 || j >= N * N || (Math.abs(move) === 1 && Math.floor(j / N) !== Math.floor(i / N))) return;
          e.preventDefault();
          cells[j].focus();
        });
        cells.push(b);
      }
      grid.append(...cells);

      const around = (i) => {
        const r = Math.floor(i / N);
        const c = i % N;
        return [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
          .filter(([y, x]) => y >= 0 && y < N && x >= 0 && x < N)
          .map(([y, x]) => y * N + x);
      };

      function paint() {
        cells.forEach((b, i) => {
          b.classList.toggle('is-lit', lit[i]);
          b.setAttribute('aria-label', `Lantern ${Math.floor(i / N) + 1}, ${(i % N) + 1}: ${lit[i] ? 'lit' : 'dark'}`);
        });
        const on = lit.filter(Boolean).length;
        api.score(`moves ${moves}  ·  lit ${on} / ${N * N}`);
      }

      function touch(i, byHand) {
        if (done && byHand) return;
        around(i).forEach((j) => { lit[j] = !lit[j]; });
        if (!byHand) return;
        Void.dream.sound.wake();
        moves++;
        const note = Math.floor(i / N) + (i % N);
        Void.dream.sound.chime(Void.dream.sound.step(note, 262), { vol: lit[i] ? 0.09 : 0.05, dur: 1.1 });
        cells[i].classList.remove('is-touched');
        void cells[i].offsetWidth;
        cells[i].classList.add('is-touched');
        paint();
        if (lit.every(Boolean)) win();
      }

      function win() {
        done = true;
        const best = api.record(moves, 'low');
        grid.classList.add('is-free');
        const r = grid.getBoundingClientRect();
        Void.dream.fx.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 80, speed: 420 });
        [0, 2, 4, 7, 9, 10].forEach((n, k) => Void.dream.sound.chime(Void.dream.sound.step(n, 262), { when: k * 0.12, vol: 0.1, dur: 2 }));
        foot.innerHTML = `<p class="go-big">all lit</p><p>${moves} moves${best ? ' · a new best ✧' : ''}</p>`;
        const again = document.createElement('button');
        again.type = 'button';
        again.className = 'send-btn';
        again.innerHTML = '<span class="btn-label">new sky</span>';
        again.addEventListener('click', scramble);
        foot.append(again);
      }

      function scramble() {
        timers.forEach(clearTimeout);
        grid.classList.remove('is-free');
        lit = Array(N * N).fill(true);
        // scramble with real touches, so it can always be undone
        let presses = 0;
        while (presses < 7 || lit.every(Boolean)) {
          touch(Math.floor(Math.random() * N * N), false);
          presses++;
        }
        moves = 0;
        done = false;
        foot.innerHTML = '<p class="lantern-hint">tip: go row by row. if a lantern is dark, touch the one right under it.</p>';
        paint();
      }

      scramble();
      return { destroy() { timers.forEach(clearTimeout); } };
    }
  });
})();
