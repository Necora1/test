/* ==========================================================
   tapes.js — the favorite songs as cassette tapes, and the
   walkman that plays them (through spotify.js). Once a tape is
   in, the walkman stays at the bottom of the screen wherever you
   go, and the whole dream takes the colours of the song.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $, $$ } = Void;
  const songs = Void.favorites || [];

  const shelf = $('#tapeShelf');
  const walkman = $('#walkman');
  const slot = $('#walkmanSlot');
  const title = $('#wmTitle');
  const playBtn = $('#wmPlay');
  const tuck = $('#wmTuck');

  let st = Void.spotify.state();

  function setTucked(tucked) {
    walkman.classList.toggle('is-tucked', tucked);
    tuck.setAttribute('aria-expanded', String(!tucked));
    tuck.setAttribute('aria-label', tucked ? 'Bring the player back' : 'Tuck the player away');
  }

  function cassette(song, i) {
    const tape = document.createElement('button');
    tape.type = 'button';
    tape.className = 'tape';
    tape.dataset.index = String(i);
    tape.setAttribute('aria-pressed', 'false');
    tape.setAttribute('aria-label', `${song.title} by ${song.artist}${song.explicit ? ' (explicit)' : ''}`);
    if (song.palette) tape.style.setProperty('--shell', song.palette[3]);
    tape.innerHTML = `
      <span class="tape-shell">
        <span class="tape-label">
          <img class="tape-cover" alt="" loading="lazy" decoding="async" width="44" height="44">
          <span class="tape-words"><span class="tape-title"></span><span class="tape-artist"></span></span>
        </span>
        <span class="tape-window"><i class="reel"></i><span class="tape-ribbon"></span><i class="reel"></i></span>
      </span>`;
    const cover = tape.querySelector('.tape-cover');
    if (song.cover) cover.src = `../assets/covers/${song.cover}.jpg`;
    else cover.remove();
    tape.querySelector('.tape-title').textContent = song.title;
    tape.querySelector('.tape-artist').textContent = song.artist;
    return tape;
  }

  function play(i) {
    if (walkman.hidden) {
      walkman.hidden = false;
      document.body.classList.add('has-walkman');
      Void.spotify.mount(slot, { height: 80 });
    }
    setTucked(false);
    Void.spotify.play(i);
  }

  function paint() {
    $$('.tape[data-index]').forEach((tape) => {
      const on = Number(tape.dataset.index) === st.index;
      tape.classList.toggle('is-current', on);
      tape.classList.toggle('is-playing', on && st.playing);
      tape.setAttribute('aria-pressed', String(on && st.playing));
    });
    title.textContent = st.song ? `${st.song.title} — ${st.song.artist}` : 'pick a tape';
    walkman.classList.toggle('is-playing', st.playing);
    walkman.classList.toggle('is-loading', st.mode === 'loading');
    playBtn.setAttribute('aria-label', st.playing ? 'Pause' : 'Play');
    document.body.classList.toggle('is-playing', st.playing);
  }

  // the little "tuned to …" notes: each room is tuned to a song
  function paintTuned() {
    $$('[data-tune]').forEach((btn) => {
      const song = Void.dream.palette.tuned(btn.dataset.tune);
      if (!song) { btn.hidden = true; return; }
      btn.querySelector('.tuned-song').textContent = `${song.title} — ${song.artist}`;
      btn.dataset.index = String(songs.indexOf(song));
    });
  }

  Void.dream.tapes = {
    play,
    init() {
      shelf.append(...songs.map(cassette));
      shelf.addEventListener('click', (e) => {
        const tape = e.target.closest('.tape');
        if (tape) play(Number(tape.dataset.index));
      });

      paintTuned();
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tune]');
        if (btn && btn.dataset.index) play(Number(btn.dataset.index));
      });

      $('#wmPrev').addEventListener('click', () => Void.spotify.prev());
      $('#wmNext').addEventListener('click', () => Void.spotify.next());
      playBtn.addEventListener('click', () => Void.spotify.toggle());
      tuck.addEventListener('click', () => setTucked(!walkman.classList.contains('is-tucked')));

      // out of the way in rooms where there's reading or writing to do
      Void.on('view', ({ id }) => {
        if (!walkman.hidden) setTucked(id !== 'home' && id !== 'interests');
      });

      Void.on('spotify', (next) => {
        st = next;
        paint();
        Void.dream.palette.setSong(st.playing ? st.song : null);
      });
      paint();
    }
  };
})();
