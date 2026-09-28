/* ==========================================================
   views.js — the rooms of the dream
   Home is renn's room; each thing in it opens a room (#about,
   #gallery, #interests, #favoomfs, #send — the same addresses
   as the classic version — and #games, #guitar, #oracle,
   #wishes). The camera travels there first (memory/engine.js),
   then the room surfaces over it; closing fades it, then the
   camera drifts back out.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $, $$ } = Void;
  const ROOMS = ['about', 'gallery', 'interests', 'favoomfs', 'send', 'games', 'guitar', 'oracle', 'wishes'];
  const scene = $('#scene');
  let current = 'home';
  let closing = null;

  const resolve = () => {
    const id = decodeURIComponent(location.hash.replace(/^#\/?/, '')).toLowerCase();
    return ROOMS.includes(id) ? id : 'home';
  };

  let token = 0;

  function show(id, { instant = false } = {}) {
    if (id === current) return;
    const prev = current;
    current = id;
    const mine = ++token;
    document.body.dataset.view = id;
    Void.dream.palette.setView(id);
    Void.dream.sky.setFocus(id === 'home' ? 0 : 1);
    const quick = instant || Void.motion.reduced;

    // the room we're leaving fades first, then the camera moves
    if (prev !== 'home') {
      const old = $(`#view-${prev}`);
      if (old) {
        old.classList.remove('is-opening', 'is-waiting');
        if (quick) old.hidden = true;
        else {
          old.classList.add('is-closing');
          clearTimeout(closing);
          closing = setTimeout(() => { old.hidden = true; old.classList.remove('is-closing'); }, 450);
        }
      }
    }

    const arrive = Void.dream.memory ? Void.dream.memory.goTo(id, { instant: quick }) : Promise.resolve();

    if (id === 'home') {
      scene.inert = false;
      const spot = $(`.hotspot[data-view="${prev}"]`);
      arrive.then(() => { if (mine === token && spot && !instant) spot.focus({ preventScroll: true }); });
    } else {
      const room = $(`#view-${id}`);
      room.classList.remove('is-closing', 'is-opening');
      room.hidden = false;
      room.scrollTop = 0;
      scene.inert = true;
      // the room surfaces once the camera is nearly there
      if (!quick) room.classList.add('is-waiting');
      arrive.then(() => {
        if (mine !== token) return;
        room.classList.remove('is-waiting');
        if (!quick) {
          void room.offsetWidth;
          room.classList.add('is-opening');
        }
        const head = room.querySelector('.view-title');
        if (head) head.focus({ preventScroll: true });
        Void.emit('page:shown', id);
      });
    }
    Void.emit('view', { id, prev });
  }

  const goHome = () => {
    if (location.hash && location.hash !== '#home') location.hash = 'home';
    else show('home');
  };

  Void.dream.views = {
    current: () => current,
    resolve,
    show,
    home: goHome,
    init() {
      window.addEventListener('hashchange', () => show(resolve()));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && current !== 'home' && !Void.modal.isOpen()) goHome();
      });
      $$('[data-close-view]').forEach((btn) => btn.addEventListener('click', goHome));
      // clicking the empty space around a room closes it too (only when the
      // press started there, so dragging a photo or selecting text doesn't)
      const isBackdrop = (el, room) => el === room || el.classList.contains('view-inner');
      $$('.view').forEach((room) => {
        let downOnBackdrop = false;
        room.addEventListener('pointerdown', (e) => { downOnBackdrop = isBackdrop(e.target, room); });
        room.addEventListener('click', (e) => {
          if (downOnBackdrop && isBackdrop(e.target, room)) goHome();
          downOnBackdrop = false;
        });
      });
      show(resolve(), { instant: true });
    }
  };
})();
