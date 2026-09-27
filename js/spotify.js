/* ==========================================================
   spotify.js — plays the favorite songs through one Spotify
   embed, using Spotify's iFrame API. Shared by both versions.

     Void.spotify.mount(el)   where the player goes (once)
     Void.spotify.play(i)     play song i (the same song again
                              pauses or resumes it)
     Void.spotify.toggle() / .next() / .prev()

   Every change is announced as Void.on('spotify', state) with
   { index, song, playing, mode }, mode being
   idle · loading · ready · fallback. When a song ends, the next
   one starts. If the API can't load, a plain Spotify player is
   used instead (one song at a time, play pressed by hand).
   ========================================================== */
(() => {
  const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
  const songs = Void.favorites || [];

  let slot = null;
  let height = 80;
  let mode = 'idle';
  let controller = null;
  let fallbackFrame = null;
  let current = -1;
  let playing = false;
  let wantPlay = false;  // start as soon as the chosen song has loaded
  let playTimer = 0;
  let lastPosition = 0;
  let lastDuration = 0;
  let lastSent = '';

  // a song is a track id, or (when only the record could be found) an album id
  const kind = (song) => (song.album ? 'album' : 'track');
  const idOf = (song) => song.album || song.spotify;
  const uriOf = (song) => `spotify:${kind(song)}:${idOf(song)}`;
  const embedUrl = (song) => `https://open.spotify.com/embed/${kind(song)}/${encodeURIComponent(idOf(song))}?utm_source=generator`;
  const state = () => ({ index: current, song: songs[current] || null, playing, mode });

  function announce() {
    const key = `${current}|${playing}|${mode}`;
    if (key === lastSent) return;
    lastSent = key;
    Void.emit('spotify', state());
  }

  function kick() {
    clearTimeout(playTimer);
    if (!wantPlay || !controller) return;
    wantPlay = false;
    controller.play();
  }

  function play(i) {
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
      announce();
      return;
    }

    current = i;
    if (mode === 'fallback') {
      if (fallbackFrame) fallbackFrame.src = embedUrl(song);
      announce();
      return;
    }

    // not loaded yet: remember the choice and play it once ready
    wantPlay = true;
    announce();
    load();
  }

  function onUpdate(e) {
    const d = e?.data || {};
    const wasPlaying = playing;
    playing = d.isPaused === false;
    if (playing) wantPlay = false;

    const position = Number(d.position) || 0;
    const duration = Number(d.duration) || 0;

    // the song ran out on its own: go on to the next one
    const endedHere = duration > 0 && position >= duration - 1000;
    const endedJustBefore = lastDuration > 0 && lastPosition >= lastDuration - 2500;
    if (wasPlaying && d.isPaused && (endedHere || endedJustBefore) && songs.length > 1) {
      lastPosition = 0;
      lastDuration = 0;
      playing = false;
      play((current + 1) % songs.length);
      return;
    }

    lastPosition = position;
    lastDuration = duration;
    announce();
  }

  function load() {
    if (mode !== 'idle' || !slot) return;
    mode = 'loading';
    announce();

    const giveUp = setTimeout(fallback, 15000);

    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      clearTimeout(giveUp);
      if (mode !== 'loading') return;
      const start = songs[current >= 0 ? current : 0];
      IFrameAPI.createController(slot, { uri: uriOf(start), width: '100%', height }, (ctrl) => {
        controller = ctrl;
        mode = 'ready';
        ctrl.addListener('ready', () => { if (wantPlay) kick(); });
        ctrl.addListener('playback_update', onUpdate);
        if (wantPlay) { clearTimeout(playTimer); playTimer = setTimeout(kick, 1500); }
        announce();
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
    fallbackFrame.height = String(height);
    fallbackFrame.loading = 'lazy';
    fallbackFrame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    slot.replaceWith(fallbackFrame);
    announce();
  }

  Void.spotify = {
    songs,
    state,
    embedUrl,
    play,
    mount(el, options = {}) {
      if (slot || !el) return;
      slot = el;
      if (options.height) height = options.height;
      load();
    },
    toggle() {
      if (mode === 'ready' && current >= 0) controller.togglePlay();
      else if (current < 0 && songs.length) play(0);
    },
    next() { if (songs.length) play(current < 0 ? 0 : (current + 1) % songs.length); },
    prev() { if (songs.length) play(current < 0 ? 0 : (current - 1 + songs.length) % songs.length); },
    indexOf(spotifyId) { return songs.findIndex((s) => s.spotify === spotifyId); }
  };
})();
