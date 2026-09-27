/* ==========================================================
   cover memory — sixteen cassette-coloured cards, eight pairs
   of album covers from the favourite songs. Turn two at a time;
   find all the pairs in as few moves as you can. When the board
   is clear, one of the songs you matched can go in the walkman.
   ========================================================== */
(() => {
  const Void = window.Void;
  const songs = (Void.favorites || []).filter((s) => s.cover);

  const shuffle = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  Void.dream.arcade.register({
    id: 'memory',
    name: 'cover memory',
    unit: 'moves',
    how: 'turn over two cards at a time and find the pairs of covers. fewer moves is better.',
    mount(api) {
      const board = document.createElement('div');
      board.className = 'memory';
      const after = document.createElement('div');
      after.className = 'memory-after';
      api.stage.append(board, after);

      let open = [];
      let moves = 0;
      let found = 0;
      let lock = false;
      let started = 0;
      let deck = [];
      let timers = [];

      const hud = () => api.score(`moves ${moves}  ·  pairs ${found} / 8`);

      function card(song, i) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mem-card';
        b.dataset.id = song.spotify;
        b.style.setProperty('--i', String(i));
        b.style.setProperty('--shell', song.palette?.[3] || '#7fb');
        b.setAttribute('aria-label', 'A face-down card');
        b.innerHTML = `<span class="mem-inner"><span class="mem-back" aria-hidden="true"><i></i></span><span class="mem-face"><img alt="" draggable="false" src="../assets/covers/${song.cover}.jpg"></span></span>`;
        b.addEventListener('click', () => flip(b, song));
        return b;
      }

      function flip(b, song) {
        if (lock || b.classList.contains('is-up')) return;
        if (!started) started = performance.now();
        Void.dream.sound.wake();
        b.classList.add('is-up');
        b.setAttribute('aria-label', `${song.title} by ${song.artist}`);
        open.push(b);
        Void.dream.sound.chime(Void.dream.sound.step(open.length === 1 ? 2 : 4, 330), { vol: 0.06, dur: 0.5, wet: 0.3 });
        if (open.length < 2) return;
        moves++;
        const [a, c] = open;
        open = [];
        if (a.dataset.id === c.dataset.id) {
          found++;
          [a, c].forEach((x) => { x.classList.add('is-matched'); x.disabled = true; });
          const r = c.getBoundingClientRect();
          Void.dream.fx.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 16, speed: 180 });
          [0, 2, 4].forEach((n, k) => Void.dream.sound.chime(Void.dream.sound.step(found + n, 392), { when: k * 0.08, vol: 0.09 }));
          hud();
          if (found === 8) timers.push(setTimeout(win, 500));
        } else {
          lock = true;
          hud();
          timers.push(setTimeout(() => {
            [a, c].forEach((x) => { x.classList.remove('is-up'); x.setAttribute('aria-label', 'A face-down card'); });
            lock = false;
          }, 850));
        }
      }

      function win() {
        const secs = Math.round((performance.now() - started) / 1000);
        const best = api.record(moves, 'low');
        const r = board.getBoundingClientRect();
        Void.dream.fx.burst(r.left + r.width / 2, r.top + r.height / 3, { count: 90, speed: 460 });
        [0, 2, 4, 5, 7, 9].forEach((n, k) => Void.dream.sound.chime(Void.dream.sound.step(n + 2, 392), { when: k * 0.1, vol: 0.1 }));
        const song = deck[Math.floor(Math.random() * deck.length)];
        after.innerHTML = `<p class="go-big">cleared!</p><p>${moves} moves · ${secs}s${best ? ' · a new best ✧' : ''}</p>`;
        const row = document.createElement('div');
        row.className = 'memory-actions';
        const again = document.createElement('button');
        again.type = 'button';
        again.className = 'send-btn';
        again.innerHTML = '<span class="btn-label">deal again</span>';
        again.addEventListener('click', deal);
        const play = document.createElement('button');
        play.type = 'button';
        play.className = 'tuned';
        play.innerHTML = '<span class="tuned-lead">play</span> <span class="tuned-song"></span> <span class="tuned-play" aria-hidden="true">&#9656;</span>';
        play.querySelector('.tuned-song').textContent = `${song.title} — ${song.artist}`;
        play.addEventListener('click', () => Void.dream.tapes.play((Void.favorites || []).indexOf(song)));
        row.append(again, play);
        after.append(row);
        after.hidden = false;
        board.classList.add('is-won');
      }

      function deal() {
        timers.forEach(clearTimeout);
        timers = [];
        deck = shuffle(songs).slice(0, 8);
        board.replaceChildren(...shuffle([...deck, ...deck]).map(card));
        board.classList.remove('is-won');
        after.hidden = true;
        open = [];
        moves = 0;
        found = 0;
        lock = false;
        started = 0;
        hud();
      }

      deal();
      return { destroy() { timers.forEach(clearTimeout); } };
    }
  });
})();
