/* ==========================================================
   secrets.js — things you find by accident
   · type "void" anywhere (or the Konami code): a black hole
     opens where your mouse is, swallows the page and, after a
     moment, spits everything back out.
   · clicking a "dream version" link: your eyes close, and the
     site falls asleep into the other version.
   ========================================================== */
(() => {
  const { $, $$, store } = Void;
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  const VERSION_KEY = 'void_version';
  const html = document.documentElement;

  const springy = (() => {
    try {
      document.createElement('div').animate([{ opacity: 0 }, { opacity: 1 }], { easing: 'linear(0, 1)' }).cancel();
      return 'linear(0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%, 0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%, 1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%, 1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%, 0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1.004 83.8%, 1)';
    } catch { return 'cubic-bezier(0.34, 1.56, 0.64, 1)'; }
  })();

  /* ==========================================================
     THE BLACK HOLE
     ========================================================== */
  let pointer = null;
  let busy = false;
  window.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; }, { passive: true });

  function victims() {
    const page = $('.page:not([hidden])');
    const list = [];
    if (page) {
      [...page.children].forEach((child) => {
        if (child.classList.contains('portals')) list.push(...child.children);
        else list.push(child);
      });
    }
    list.push(...$$('.tip, .footer-inner, .topbar-inner, .dock-bar'));
    return list.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && r.bottom > -40 && r.top < innerHeight + 40;
    });
  }

  async function blackHole() {
    if (busy || document.body.classList.contains('is-booting')) return;
    if (Void.modal.isOpen()) return;
    busy = true;

    const x = pointer ? pointer.x : innerWidth / 2;
    const y = pointer ? pointer.y : innerHeight / 2;

    if (Void.motion.reduced) {
      // no swirling for people who asked for less motion: just a blink of darkness
      html.classList.add('is-eclipsed');
      await Void.wait(700);
      html.classList.remove('is-eclipsed');
      busy = false;
      return;
    }

    const hole = document.createElement('div');
    hole.className = 'blackhole';
    hole.style.left = `${x}px`;
    hole.style.top = `${y}px`;
    hole.innerHTML = '<i class="bh-disk"></i><i class="bh-core"></i>';
    document.body.append(hole);

    const falling = victims().map((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const spin = (dx > 0 ? 1 : -1) * (140 + Math.random() * 220);
      const anim = el.animate([
        { translate: '0 0', rotate: '0deg', scale: '1', opacity: 1, filter: 'blur(0)' },
        { translate: `${dx * 0.35}px ${dy * 0.35}px`, rotate: `${spin * 0.25}deg`, scale: '0.85', opacity: 1, filter: 'blur(0)', offset: 0.45 },
        { translate: `${dx}px ${dy}px`, rotate: `${spin}deg`, scale: '0.02', opacity: 0, filter: 'blur(6px)' }
      ], {
        duration: 1150,
        delay: Math.min(700, dist * 0.55),
        easing: 'cubic-bezier(0.55, 0, 0.9, 0.35)',
        fill: 'forwards'
      });
      return { el, anim, dx, dy, spin };
    });

    await Promise.all(falling.map((f) => f.anim.finished.catch(() => {})));
    hole.classList.add('is-full');
    await Void.wait(650);

    // …and out it all comes
    hole.classList.add('is-spitting');
    Void.warp.start('send');
    const back = falling.map(({ el, anim, dx, dy, spin }, i) => {
      const out = el.animate([
        { translate: `${dx}px ${dy}px`, rotate: `${spin}deg`, scale: '0.02', opacity: 0, filter: 'blur(6px)' },
        { translate: '0 0', rotate: '0deg', scale: '1', opacity: 1, filter: 'blur(0)' }
      ], { duration: 1000, delay: i * 25, easing: springy, fill: 'backwards' });
      anim.cancel();
      return out.finished.catch(() => {});
    });
    await Promise.all(back);
    hole.classList.add('is-gone');
    await Void.wait(500);
    hole.remove();
    busy = false;
  }

  let typed = '';
  let keys = [];
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const key = e.key.toLowerCase();
    keys = [...keys, key].slice(-KONAMI.length);
    typed = (typed + (key.length === 1 ? key : '·')).slice(-4);
    if (typed === 'void' || keys.join() === KONAMI.join()) {
      typed = '';
      keys = [];
      blackHole();
    }
  });

  Void.blackHole = blackHole;

  /* ==========================================================
     FALLING ASLEEP INTO THE DREAM VERSION
     ========================================================== */
  const lids = document.createElement('div');
  lids.className = 'eyelids';
  lids.setAttribute('aria-hidden', 'true');
  lids.innerHTML = '<i></i><i></i>';
  document.body.append(lids);

  document.addEventListener('click', (e) => {
    const link = e.target.closest?.('a.to-dream');
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    store.setRaw(VERSION_KEY, 'dream');
    const page = Void.nav.current();
    const target = `${link.getAttribute('href')}${page && page !== 'home' ? `#${page}` : ''}`;
    if (Void.motion.reduced) { location.href = target; return; }
    Void.nav.closeMenu();
    html.classList.add('is-falling-asleep');
    setTimeout(() => { location.href = target; }, 1250);
  });

  // coming back with the browser's back button: open the eyes again
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) html.classList.remove('is-falling-asleep');
  });
})();
