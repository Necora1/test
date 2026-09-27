/* ==========================================================
   songs.js — favorite songs (interests page)
   The track list is ours; the sound comes from one Spotify
   embed that we tell which song to load (Spotify's iFrame API).
   A song keeps playing while you look around the other pages,
   with a small "now playing" chip in the corner.
   If the API can't load, a plain Spotify player is used instead.
   ========================================================== */
(() => {
  const { $ } = Void;
  const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
  const EMBED_HEIGHT = 80;
  const songs = Void.favorites || [];
  const player = (Void.songs = {});

  const list = $('#songList');
  const slot = $('#spotifyEmbed');
  const note = $('#playerNote');
  const mini = $('#miniPlayer');
  const miniTitle = $('#miniTitle');
  const miniArtist = $('#miniArtist');
  const miniToggle = $('#miniToggle');

  let mode = 'idle';     // idle · loading · ready · fallback
  let controller = null;
  let fallbackFrame = null;
  let current = -1;      // the song loaded in the player
  let playing = false;
  let wantPlay = false;  // start playing as soon as the chosen song has loaded
  let playTimer = 0;
  let lastPosition = 0;
  let lastDuration = 0;
  let heldByChip = false;
  let page = null;
  let built = false;

  const uriOf = (song) => `spotify:track:${song.spotify}`;
  const embedUrl = (song) => `https://open.spotify.com/embed/track/${encodeURIComponent(song.spotify)}?utm_source=generator`;

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
      if (row) choose(Number(row.dataset.index));
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
        const on = i === current;
        row.classList.toggle('is-current', on);
        row.classList.toggle('is-playing', on && playing);
        row.setAttribute('aria-pressed', String(on && playing));
      });
    }
    paintMini();
  }

  /* ---------- the "now playing" chip on other pages ---------- */
  function paintMini() {
    if (!mini) return;
    const song = songs[current];
    const show = !!song && mode === 'ready' && page !== 'interests' && (playing || heldByChip);
    mini.hidden = !show;
    if (!show) return;
    miniTitle.textContent = song.title;
    miniArtist.textContent = song.artist;
    mini.classList.toggle('is-playing', playing);
    miniToggle.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  /* ---------- playing ---------- */
  function kick() {
    clearTimeout(playTimer);
    if (!wantPlay || !controller) return;
    wantPlay = false;
    controller.play();
  }

  function choose(i) {
    const song = songs[i];
    if (!song) return;

    if (mode === 'ready') {
      if (i === current) { controller.togglePlay(); return; }
      current = i;
      wantPlay = true;
      lastPosition = 0;
      lastDuration = 0;
      controller.loadUri(uriOf(song));
      // 'ready' usually starts it; this is the backup
      clearTimeout(playTimer);
      playTimer = setTimeout(kick, 1500);
      paint();
      return;
    }

    current = i;
    if (mode === 'fallback') {
      if (fallbackFrame) fallbackFrame.src = embedUrl(song);
      paint();
      return;
    }

    // the API is still on its way: remember the choice and play it once ready
    wantPlay = true;
    paint();
    loadApi();
  }

  function onUpdate(e) {
    const d = e?.data || {};
    const wasPlaying = playing;
    playing = d.isPaused === false;
    if (playing) { wantPlay = false; heldByChip = false; }

    const position = Number(d.position) || 0;
    const duration = Number(d.duration) || 0;

    // the song ran out on its own: go on to the next one
    const endedHere = duration > 0 && position >= duration - 1000;
    const endedJustBefore = lastDuration > 0 && lastPosition >= lastDuration - 2500;
    if (wasPlaying && d.isPaused && (endedHere || endedJustBefore) && songs.length > 1) {
      lastPosition = 0;
      lastDuration = 0;
      choose((current + 1) % songs.length);
      return;
    }

    lastPosition = position;
    lastDuration = duration;
    paint();
  }

  /* ---------- loading Spotify ---------- */
  function loadApi() {
    if (mode !== 'idle' || !slot) return;
    mode = 'loading';
    note.textContent = 'loading spotify…';
    note.hidden = false;

    const giveUp = setTimeout(fallback, 15000);

    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      clearTimeout(giveUp);
      if (mode !== 'loading') return;
      const start = songs[current >= 0 ? current : 0];
      IFrameAPI.createController(slot, { uri: uriOf(start), width: '100%', height: EMBED_HEIGHT }, (ctrl) => {
        controller = ctrl;
        mode = 'ready';
        note.hidden = true;
        ctrl.addListener('ready', () => { if (wantPlay) kick(); });
        ctrl.addListener('playback_update', onUpdate);
        if (wantPlay) { clearTimeout(playTimer); playTimer = setTimeout(kick, 1500); }
        paint();
      });
    };

    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => { clearTimeout(giveUp); fallback(); };
    document.head.append(script);
  }

  // No iFrame API (blocked or down): a normal Spotify player, one song at a time
  function fallback() {
    if (mode !== 'loading') return;
    mode = 'fallback';
    const song = songs[current >= 0 ? current : 0];
    fallbackFrame = document.createElement('iframe');
    fallbackFrame.title = 'Spotify player';
    fallbackFrame.src = embedUrl(song);
    fallbackFrame.height = String(EMBED_HEIGHT);
    fallbackFrame.loading = 'lazy';
    fallbackFrame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    slot.replaceWith(fallbackFrame);
    note.hidden = true;
    paint();
  }

  /* ---------- wiring ---------- */
  if (miniToggle) {
    miniToggle.addEventListener('click', () => {
      if (!controller) return;
      heldByChip = true;
      controller.togglePlay();
    });
  }

  Void.on('page:shown', (id) => {
    page = id;
    if (id === 'interests') {
      heldByChip = false;
      build();
      loadApi();
    }
    paintMini();
  });

  player.current = () => songs[current] || null;
  player.isPlaying = () => playing;
})();
