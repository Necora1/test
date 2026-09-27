/* ==========================================================
   navigation.js — pages (router + themes) and the floating dock
   (the gallery and the song player load themselves on 'page:shown')
   ========================================================== */
(() => {
  const { $, $$, pages } = Void;
  const html = document.documentElement;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const byId = Object.fromEntries(pages.map((p) => [p.id, p]));

  const nav = (Void.nav = {});
  const pageEls = new Map();
  const themeMeta = $('meta[name="theme-color"]');

  let current = null;
  let booted = false;
  let pending = null; // page swap waiting for the old page to fade out

  /* ==========================================================
     ROUTER — #about, #gallery… Back/forward buttons work.
     ========================================================== */
  function resolve(hash) {
    const id = decodeURIComponent((hash || '').replace(/^#\/?/, '')).toLowerCase();
    const page = byId[id];
    if (!page || !pageEls.has(id)) return 'home';
    if (page.requiresAuth && !Void.auth.isLoggedIn()) return 'home';
    return id;
  }

  function applyTheme(id, instant) {
    const theme = (byId[id] || byId.home).theme;
    html.style.setProperty('--bg', theme.bg);
    html.style.setProperty('--accent', theme.accent);
    if (themeMeta) themeMeta.content = theme.bg;
    Void.sky.setTheme(theme, instant);
  }

  function playEnter(el) {
    el.classList.remove('is-entering');
    if (Void.motion.reduced) return;
    Void.emit('page:enter', el);
    void el.offsetWidth; // restart the animation
    el.classList.add('is-entering');
    clearTimeout(el._enterTimer);
    el._enterTimer = setTimeout(() => el.classList.remove('is-entering'), 1500);
  }

  nav.show = (id, { instant = false } = {}) => {
    if (!pageEls.has(id)) id = 'home';
    if (id === current) return;

    const prevId = current;
    const prev = prevId ? pageEls.get(prevId) : null;
    const next = pageEls.get(id);
    current = id;
    document.body.dataset.page = id;
    applyTheme(id, instant);

    // A quick second click cancels the first swap; swap() below hides every other page anyway
    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }

    const swap = () => {
      pending = null;
      pageEls.forEach((el) => {
        if (el !== next) {
          el.hidden = true;
          el.classList.remove('is-leaving', 'is-entering');
        }
      });
      next.hidden = false;
      window.scrollTo(0, 0);
      if (booted) playEnter(next);
      Void.emit('page:shown', id);
    };

    if (prev && !prev.hidden && booted && !instant && !Void.motion.reduced) {
      prev.classList.add('is-leaving');
      pending = { timer: setTimeout(swap, 180) };
    } else {
      swap();
    }

    Void.emit('page', { id, prev: prevId });
  };

  nav.current = () => current;

  nav.go = (id) => {
    if (location.hash === `#${id}`) { nav.show(resolve(location.hash)); return; }
    try { location.hash = id; } catch { nav.show(id); }
  };

  function fixHash(id) {
    if (!location.hash || location.hash.slice(1) === id) return;
    try { history.replaceState(null, '', `#${id}`); } catch { /* sandboxed frame */ }
  }

  function onHashChange() {
    const id = resolve(location.hash);
    fixHash(id);
    nav.show(id);
  }

  // Called once the intro reveals the page
  nav.reveal = () => {
    booted = true;
    const el = pageEls.get(current);
    if (el) playEnter(el);
  };

  /* ==========================================================
     MENU + HOME CARDS, built from Void.pages in config.js
     ========================================================== */
  function build() {
    const list = $('#dockLinks');
    pages.filter((p) => p.nav).forEach((p, i) => {
      const li = document.createElement('li');
      li.style.setProperty('--i', i);
      if (p.cta) li.className = 'is-wide';
      const a = document.createElement('a');
      a.href = `#${p.id}`;
      a.className = p.cta ? 'nav-pill is-cta' : 'nav-pill';
      a.dataset.pageLink = p.id;
      a.style.setProperty('--pc', p.theme.accent);
      if (!p.cta) {
        const dot = document.createElement('i');
        dot.className = 'nav-dot';
        dot.setAttribute('aria-hidden', 'true');
        a.append(dot);
      }
      const text = document.createElement('span');
      text.textContent = p.label;
      a.append(text);
      li.append(a);
      list.append(li);
    });

    const portals = $('#portals');
    if (!portals) return;
    pages.filter((p) => p.portal).forEach((p) => {
      const a = document.createElement('a');
      a.href = `#${p.id}`;
      a.className = p.cta ? 'portal is-wide' : 'portal';
      a.dataset.pageLink = p.id;
      a.style.setProperty('--pc', p.theme.accent);
      a.innerHTML = '<span class="portal-name"></span><span class="portal-blurb"></span>'
        + '<svg class="portal-arrow icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>';
      a.querySelector('.portal-name').textContent = p.label;
      a.querySelector('.portal-blurb').textContent = p.blurb || '';
      portals.append(a);
    });
  }

  /* ==========================================================
     DOCK — icon ▸ label (hover / after navigating) ▸ expanded.
     Only transform and opacity animate, so it stays smooth on
     every screen shape.
     ========================================================== */
  const dock = $('#dock');
  const bar = $('#dockBar');
  const toggle = $('#dockToggle');
  const panel = $('#dockPanel');
  const labelText = $('#dockLabelText');
  const whereText = $('#dockWhere');

  let state = 'icon';
  let hovering = false;
  let hoverTimer = 0;
  let collapseTimer = 0;
  const magnet = { release() {} };

  function setState(next) {
    if (next === state) return;
    state = next;
    dock.dataset.state = next;
    const open = next === 'expanded';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    panel.inert = !open;
    if (next !== 'icon') magnet.release();
  }

  function measureLabel() {
    const width = Math.ceil(labelText.getBoundingClientRect().width);
    if (width) dock.style.setProperty('--label-w', `${width}px`);
  }

  function scheduleCollapse(ms) {
    clearTimeout(collapseTimer);
    collapseTimer = setTimeout(() => {
      if (state === 'label' && !hovering) setState('icon');
    }, ms);
  }

  nav.openMenu = (viaKeyboard = false) => {
    clearTimeout(collapseTimer);
    setState('expanded');
    if (viaKeyboard) {
      const target = panel.querySelector('[aria-current="page"]') || panel.querySelector('a, button');
      setTimeout(() => target?.focus({ preventScroll: true }), 80);
    }
  };

  nav.closeMenu = ({ focusToggle = false } = {}) => {
    if (state !== 'expanded') return;
    setState(hovering ? 'label' : 'icon');
    if (hovering) scheduleCollapse(1200);
    if (focusToggle) toggle.focus({ preventScroll: true });
  };

  function wireDock() {
    let keyboard = false;
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') keyboard = true;
    });
    toggle.addEventListener('click', (e) => {
      const viaKeyboard = keyboard || e.detail === 0;
      keyboard = false;
      if (state === 'expanded') nav.closeMenu();
      else nav.openMenu(viaKeyboard);
    });

    // Hover shows the current page name (mouse only)
    toggle.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovering = true;
      clearTimeout(collapseTimer);
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => { if (state === 'icon') setState('label'); }, 120);
    });
    toggle.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovering = false;
      clearTimeout(hoverTimer);
      if (state === 'label') scheduleCollapse(350);
    });

    // Tap or click anywhere else closes the menu
    document.addEventListener('pointerdown', (e) => {
      if (state !== 'expanded') return;
      if (panel.contains(e.target) || toggle.contains(e.target)) return;
      nav.closeMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state === 'expanded' && !Void.modal.isOpen()) nav.closeMenu({ focusToggle: true });
    });

    panel.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-page-link]');
      if (link && link.dataset.pageLink === current) {
        e.preventDefault();
        nav.closeMenu();
      } else if (e.target.closest('.dock-foot button')) {
        nav.closeMenu();
      }
    });

    // Magnetic pull on the menu button (mouse only)
    if (finePointer) {
      const RADIUS = 90;
      const PULL = 8;
      let tx = 0; let ty = 0; let x = 0; let y = 0; let raf = 0;
      const step = () => {
        x += (tx - x) * 0.2;
        y += (ty - y) * 0.2;
        if (Math.abs(tx - x) < 0.05 && Math.abs(ty - y) < 0.05) { x = tx; y = ty; }
        toggle.style.translate = x || y ? `${x.toFixed(2)}px ${y.toFixed(2)}px` : '';
        raf = x !== tx || y !== ty ? requestAnimationFrame(step) : 0;
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
      magnet.release = () => { tx = 0; ty = 0; kick(); };

      window.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        if (state !== 'icon' || !booted || Void.motion.reduced) {
          if (tx || ty) magnet.release();
          return;
        }
        const r = bar.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy);
        if (d < RADIUS) {
          const pull = Math.min(d, PULL) * (1 - d / RADIUS);
          tx = (dx / (d || 1)) * pull;
          ty = (dy / (d || 1)) * pull;
        } else if (tx || ty) {
          tx = 0; ty = 0;
        } else {
          return;
        }
        kick();
      }, { passive: true });
    }

    // Page changed: show its name on the button for a moment
    Void.on('page', ({ id }) => {
      const page = byId[id] || byId.home;
      labelText.textContent = page.short;
      whereText.textContent = page.label;
      measureLabel();
      $$('[data-page-link]').forEach((a) => {
        if (a.dataset.pageLink === id) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      if (!booted) return;
      if (state !== 'label') setState('label');
      scheduleCollapse(1600);
    });

    document.fonts?.ready.then(measureLabel);
  }

  /* ==========================================================
     init
     ========================================================== */
  nav.init = () => {
    $$('.page').forEach((el) => pageEls.set(el.dataset.page, el));
    build();
    wireDock();
    window.addEventListener('hashchange', onHashChange);

    const first = resolve(location.hash);
    fixHash(first);
    nav.show(first, { instant: true });

    Void.on('auth', (loggedIn) => {
      if (!loggedIn && current === 'admin') nav.go('home');
    });
  };
})();
