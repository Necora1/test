/* ==========================================================
   palette.js — the colours of the dream
   Every room is tuned to one of the favorite songs and takes
   the colours of its cover. While a song plays, the whole world
   takes that song's colours instead. Colours glide, never jump.

   Void.dream.palette.current  – { sky, horizon, glow, accent },
                                 each [r, g, b] in 0…1
   Void.dream.palette.tick(dt) – called by the sky every frame
   ========================================================== */
(() => {
  const Void = window.Void;
  Void.dream = Void.dream || {};
  const songs = Void.favorites || [];
  const root = document.documentElement;
  const KEYS = ['sky', 'horizon', 'glow', 'accent'];

  // which song each room is tuned to
  const TUNED = {
    home: '3QyD6PkfdRWUrlbEzXoqBT',      // deep love · Split end
    about: '1dGF5ymTyBB2ZmOypkeU1F',     // veil · 須田景凪
    gallery: '46JoGRd1QYQj3CrULjCi0j',   // 3月5日。 · Plastic Tree
    interests: '1MT1O2LP1GkE0sPG7cUktb', // PICNIC · SEAPOOL
    favoomfs: '2Rr4raGZMslo4jCPwddih1',  // happy news for sadness · Car Seat Headrest
    send: '1bnEw1xzEc5f05KdbU9M7r',      // September Come Take This Heart Away · Carissa's Wierd
    games: '1uK4zAdMcBRyinAOArUA5X',     // odoriko · Vaundy
    guitar: '3LOuU9L8SJ574EBc4PtOyA',    // Memory · Alex G
    oracle: '15kuqWifv5GzGq3A2P6EbC',    // Anthems For A Seventeen Year-Old Girl · yeule
    wishes: '1fkJeS8eigd7lwml2aqIGG'     // sun and moon · mage tears
  };
  const FALLBACK = ['#051014', '#12343a', '#bfe3da', '#3f8f86'];

  const hex = (h) => {
    const n = parseInt(String(h).replace('#', ''), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const toObj = (list) => Object.fromEntries(KEYS.map((k, i) => [k, hex(list[i] || FALLBACK[i])]));
  const songById = (id) => songs.find((s) => s.spotify === id) || null;

  let view = 'home';
  let playingSong = null;
  let preview = null;      // a room's colours, softly, while hovering its object
  const current = toObj(songById(TUNED.home)?.palette || FALLBACK);
  let target = toObj(songById(TUNED.home)?.palette || FALLBACK);
  let cssClock = 0;

  function base() {
    const song = playingSong || songById(TUNED[view]) || songById(TUNED.home);
    return song?.palette || FALLBACK;
  }

  function retarget() {
    const main = toObj(base());
    if (preview && !playingSong) {
      const hint = toObj(preview);
      KEYS.forEach((k) => { main[k] = main[k].map((v, i) => v + (hint[k][i] - v) * 0.4); });
    }
    target = main;
  }

  function writeCss() {
    const rgb = (c) => `${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)}`;
    KEYS.forEach((k) => root.style.setProperty(`--${k}`, rgb(current[k])));
  }

  Void.dream.palette = {
    current,
    tuned: (id) => songById(TUNED[id]),
    setView(id) { view = TUNED[id] ? id : 'home'; retarget(); },
    setSong(song) { playingSong = song && song.palette ? song : null; retarget(); },
    preview(id) { preview = id && TUNED[id] ? songById(TUNED[id])?.palette || null : null; retarget(); },
    tick(dt) {
      const k = 1 - Math.exp(-dt / 0.9);
      KEYS.forEach((key) => {
        const c = current[key];
        const t = target[key];
        for (let i = 0; i < 3; i++) c[i] += (t[i] - c[i]) * k;
      });
      cssClock += dt;
      if (cssClock > 0.1) { cssClock = 0; writeCss(); }
    }
  };

  writeCss();
})();
