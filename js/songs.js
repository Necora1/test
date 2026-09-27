/* ==========================================================
   songs.js — favorite songs on the interests page
   The track list is drawn here; the playing itself is done by
   spotify.js. A song keeps playing while you look around the
   other pages, with a small "now playing" chip in the corner.
   ========================================================== */
(() => {
  const { $ } = Void;
  const songs = Void.favorites || [];

  const list = $('#songList');
  const slot = $('#spotifyEmbed');
  const note = $('#playerNote');
  const mini = $('#miniPlayer');
  const miniTitle = $('#miniTitle');
  const miniArtist = $('#miniArtist');
  const miniToggle = $('#miniToggle');

  let st = Void.spotify.state();
  let heldByChip = false;
  let page = null;
  let built = false;

  /* ---------- the list ---------- */
  function build() {
    if (built || !list) return;
    built = true;
    const width = Math.max(2, String(songs.length).length);

    songs.forEach((song, i) => {
      const li = document.createElement('li');
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'song-row';
      row.dataset.index = String(i);
      row.setAttribute('aria-pressed', 'false');

      const num = document.createElement('span');
      num.className = 'song-num';
      num.textContent = String(i + 1).padStart(width, '0');

      const cover = document.createElement('img');
      cover.className = 'song-cover';
      cover.alt = '';
      cover.width = 44;
      cover.height = 44;
      cover.loading = 'lazy';
      cover.decoding = 'async';
      if (song.cover) cover.src = `assets/covers/${song.cover}.jpg`;

      const text = document.createElement('span');
      text.className = 'song-text';
      const title = document.createElement('span');
      title.className = 'song-title';
      title.textContent = song.title;
      const artist = document.createElement('span');
      artist.className = 'song-artist';
      if (song.explicit) {
        const e = document.createElement('abbr');
        e.className = 'explicit';
        e.title = 'explicit';
        e.textContent = 'E';
        artist.append(e);
      }
      artist.append(song.artist);
      text.append(title, artist);

      const eq = document.createElement('span');
      eq.className = 'song-eq';
      eq.setAttribute('aria-hidden', 'true');
      eq.innerHTML = '<i></i><i></i><i></i>';

      row.append(num, cover, text, eq);
      li.append(row);
      list.append(li);
    });

    list.addEventListener('click', (e) => {
      const row = e.target.closest('.song-row');
      if (row) Void.spotify.play(Number(row.dataset.index));
    });

    // up / down arrows move through the list
    list.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const rows = [...list.querySelectorAll('.song-row')];
      const i = rows.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
    });
  }

  function paint() {
    if (list) {
      list.querySelectorAll('.song-row').forEach((row, i) => {
        const on = i === st.index;
        row.classList.toggle('is-current', on);
        row.classList.toggle('is-playing', on && st.playing);
        row.setAttribute('aria-pressed', String(on && st.playing));
      });
    }
    if (note) {
      note.hidden = st.mode === 'ready' || st.mode === 'fallback';
      if (st.mode === 'loading') note.textContent = 'loading spotify…';
    }
    paintMini();
  }

  /* ---------- the "now playing" chip on other pages ---------- */
  function paintMini() {
    if (!mini) return;
    const show = !!st.song && st.mode === 'ready' && page !== 'interests' && (st.playing || heldByChip);
    mini.hidden = !show;
    if (!show) return;
    miniTitle.textContent = st.song.title;
    miniArtist.textContent = st.song.artist;
    mini.classList.toggle('is-playing', st.playing);
    miniToggle.setAttribute('aria-label', st.playing ? 'Pause' : 'Play');
  }

  /* ---------- the footer marquee says what's playing ---------- */
  const marquee = $('.footer-marquee span');
  const marqueeIdle = marquee ? marquee.textContent : '';
  function paintMarquee() {
    if (!marquee) return;
    marquee.textContent = st.song && st.playing
      ? `\u266A NOW PLAYING: ${st.song.title} \u2014 ${st.song.artist} \u266A ${marqueeIdle}`
      : marqueeIdle;
  }

  /* ---------- wiring ---------- */
  Void.on('spotify', (next) => {
    st = next;
    if (st.playing) heldByChip = false;
    paint();
    paintMarquee();
  });

  if (miniToggle) {
    miniToggle.addEventListener('click', () => {
      heldByChip = true;
      Void.spotify.toggle();
    });
  }

  Void.on('page:shown', (id) => {
    page = id;
    if (id === 'interests') {
      heldByChip = false;
      build();
      Void.spotify.mount(slot, { height: 80 });
      paint();
    }
    paintMini();
  });
})();
