/* ==========================================================
   skin.js — the old-web dressing
   mood / listening / last-active, the visitor counter, the
   home-card search and the banner login button.
   Nothing here touches the sky, the fog, the stars or the warp.
   ========================================================== */
(() => {
  const { $, $$, store } = Void;
  const VISIT_KEY = 'void_visits';
  const SEEN_KEY = 'void_last_seen';

  const MOODS = [
    'bored z z 1,', 'listening to sad songs', 'in the void', 'sleepy ...',
    'hyper >:3', 'wired on coffee', 'thinking about the stars',
    'nostalgic for 2008', 'not here'
  ];

  const LISTENING = [
    'the smiths', 'slowdive', 'radiohead',
    'bauhaus', 'the cure', 'evanescence', 'violent vira', 'g n r'
  ];

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function setAll(sel, text) {
    $$(sel).forEach((el) => { el.textContent = text; });
  }

  /* ---------- the counter, stamped like the old ones ---------- */
  function visitors() {
    let n = Number(store.raw(VISIT_KEY)) || 0;
    n += 1;
    store.setRaw(VISIT_KEY, String(n));
    const shown = String(n).padStart(6, '0');
    const el = $('#visitCount');
    if (el) el.textContent = shown.split('').join('');
    return n;
  }

  /* ---------- when they were last here ---------- */
  function lastSeen() {
    const prev = Number(store.raw(SEEN_KEY)) || 0;
    store.setRaw(SEEN_KEY, String(Date.now()));
    if (!prev) return 'just now';
    const mins = Math.round((Date.now() - prev) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  /* ---------- the home-card search ---------- */
  function search() {
    const form = $('#siteSearch');
    const input = $('#siteSearchInput');
    const tip = $('#tipBar');
    if (!form || !input) return;

    const reset = () => {
      $$('.portal').forEach((p) => p.classList.remove('is-filtered-out', 'is-hit'));
      if (tip) {
        tip.classList.remove('is-note');
        tip.innerHTML = '<b>TIP:</b> everything you send here is anonymous. The stars, the fog and the warp are all still there &#8212; only the paint changed.';
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim().toLowerCase();
      if (!q) { reset(); return; }
      Void.nav.go('home');

      let hits = 0;
      $$('.portal').forEach((p) => {
        const name = (p.querySelector('.portal-name')?.textContent || '').toLowerCase();
        const blurb = (p.querySelector('.portal-blurb')?.textContent || '').toLowerCase();
        const hit = name.includes(q) || blurb.includes(q);
        p.classList.toggle('is-filtered-out', !hit);
        p.classList.toggle('is-hit', hit);
        if (hit) hits++;
      });

      if (tip) {
        tip.classList.add('is-note');
        tip.textContent = hits
          ? `Found ${hits} page${hits === 1 ? '' : 's'} for “${input.value.trim()}”.`
          : `Nothing here matches “${input.value.trim()}”. Try gallery, send or favoomfs.`;
      }
    });

    input.addEventListener('search', () => { if (!input.value.trim()) reset(); });
  }

  /* ---------- banner login button (same action as the dock one) ---------- */
  function loginShortcut() {
    const btn = $('#topLoginBtn');
    const real = $('#loginBtn');
    if (!btn || !real) return;
    btn.addEventListener('click', () => real.click());
    Void.on('auth', (in_) => { btn.hidden = !!in_; });
  }

  /* ---------- keep the page clear of the fixed banner ---------- */
  function measureBanner() {
    const bar = document.querySelector('.topbar');
    if (!bar) return;
    const apply = () => {
      document.documentElement.style.setProperty('--topbar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    };
    apply();
    window.addEventListener('resize', apply, { passive: true });
    document.fonts?.ready.then(apply);
    if (window.ResizeObserver) new ResizeObserver(apply).observe(bar);
  }

  Void.skin = {
    init() {
      visitors();
      setAll('.mood-word', pick(MOODS));
      setAll('.now-playing', pick(LISTENING));
      setAll('.stamp', lastSeen());
      const year = $('#footYear');
      if (year) year.textContent = String(new Date().getFullYear());
      measureBanner();
      search();
      loginShortcut();
    }
  };
})();
