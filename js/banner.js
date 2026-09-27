/* ==========================================================
   banner.js — the top banner: page search, the LogIn link,
   keeping the page clear of the banner, and the footer year
   ========================================================== */
(() => {
  const { $, $$ } = Void;
  const TIP_HTML = '<b>TIP:</b> everything you send here is anonymous. No account needed.';

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

  Void.banner = {
    init() {
      const year = $('#footYear');
      if (year) year.textContent = String(new Date().getFullYear());
      measureBanner();
      search();
      loginShortcut();
    }
  };
})();
