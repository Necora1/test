/* ==========================================================
   profile.js — the old-profile-page bits
   the "right now" box, the visit counter, the home-card search,
   the banner LogIn link and the banner height.
   ========================================================== */
(() => {
  const { $, $$, store } = Void;
  const VISIT_KEY = 'void_visits';
  const SEEN_KEY = 'void_last_seen';
  const TIP_HTML = '<b>TIP:</b> everything you send here is anonymous. No account needed.';

  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const setAll = (sel, text) => $$(sel).forEach((el) => { el.textContent = text; });

  /* ---------- visit counter: an odometer that rolls up on load ---------- */
  function visits() {
    const n = (Number(store.raw(VISIT_KEY)) || 0) + 1;
    store.setRaw(VISIT_KEY, String(n));

    const el = $('#visitCount');
    if (!el) return;
    const digits = String(n).padStart(6, '0').split('');
    el.setAttribute('aria-label', String(n));
    el.replaceChildren(...digits.map(() => {
      const cell = document.createElement('span');
      cell.className = 'odo-digit';
      cell.setAttribute('aria-hidden', 'true');
      const strip = document.createElement('span');
      strip.className = 'odo-strip';
      for (let d = 0; d <= 9; d++) {
        const digit = document.createElement('span');
        digit.textContent = String(d);
        strip.append(digit);
      }
      cell.append(strip);
      return cell;
    }));

    // roll once the page is visible
    const roll = () => {
      el.querySelectorAll('.odo-strip').forEach((strip, i) => {
        strip.style.transitionDelay = `${0.15 + i * 0.09}s`;
        strip.style.transform = `translateY(${-Number(digits[i]) * 1.1}em)`;
      });
    };
    if (document.body.classList.contains('is-booting')) Void.on('revealed', roll);
    else requestAnimationFrame(roll);
  }

  /* ---------- how long since this visitor was last here ---------- */
  function lastSeen() {
    const prev = Number(store.raw(SEEN_KEY)) || 0;
    store.setRaw(SEEN_KEY, String(Date.now()));
    if (!prev) return 'first time!';
    const mins = Math.round((Date.now() - prev) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  /* ---------- the banner search filters the home cards ---------- */
  function search() {
    const form = $('#siteSearch');
    const input = $('#siteSearchInput');
    const tip = $('#tipBar');
    if (!form || !input) return;

    const reset = () => {
      $$('.portal').forEach((p) => p.classList.remove('is-filtered-out', 'is-hit'));
      if (tip) {
        tip.classList.remove('is-note');
        tip.innerHTML = TIP_HTML;
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = input.value.trim();
      const q = raw.toLowerCase();
      if (!q) { reset(); return; }
      Void.nav.go('home');

      let hits = 0;
      $$('.portal').forEach((p) => {
        const text = p.textContent.toLowerCase();
        const hit = text.includes(q);
        p.classList.toggle('is-filtered-out', !hit);
        p.classList.toggle('is-hit', hit);
        if (hit) hits++;
      });

      if (tip) {
        tip.classList.add('is-note');
        tip.textContent = hits
          ? `Found ${hits} page${hits === 1 ? '' : 's'} for “${raw}”.`
          : `Nothing here matches “${raw}”. Try gallery, send or favoomfs.`;
      }
    });

    // the little ✕ in the field, or deleting everything, clears the search
    input.addEventListener('input', () => { if (!input.value.trim()) reset(); });
  }

  /* ---------- banner LogIn: same action as the menu button ---------- */
  function loginShortcut() {
    const btn = $('#topLoginBtn');
    const real = $('#loginBtn');
    if (!btn || !real) return;
    btn.addEventListener('click', () => real.click());
    const sync = () => { btn.hidden = Void.auth.isLoggedIn(); };
    Void.on('auth', sync);
    sync();
  }

  /* ---------- keep the page clear of the fixed banner ---------- */
  function measureBanner() {
    const bar = $('.topbar');
    if (!bar) return;
    const apply = () => {
      document.documentElement.style.setProperty('--topbar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    };
    apply();
    document.fonts?.ready.then(apply);
    if (window.ResizeObserver) new ResizeObserver(apply).observe(bar);
    else window.addEventListener('resize', apply, { passive: true });
  }

  Void.profile = {
    init() {
      const now = Void.rightNow || {};
      if (now.moods?.length) setAll('.mood-word', pick(now.moods));
      if (now.listening?.length) setAll('.now-playing', pick(now.listening));
      setAll('.stamp', lastSeen());
      visits();
      const year = $('#footYear');
      if (year) year.textContent = String(new Date().getFullYear());
      measureBanner();
      search();
      loginShortcut();
    }
  };
})();
