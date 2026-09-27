/* ==========================================================
   views.js — the rooms of the dream
   The scene is the home; each object in it opens a room over
   the sky (#about, #gallery, #interests, #favoomfs, #send, the
   same addresses as the classic version). A room grows out of
   the object you clicked and sinks back into it when closed.
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

  function originOf(id, el) {
    const obj = $(`.obj[data-view="${id}"]`);
    const r = obj && obj.offsetParent ? obj.getBoundingClientRect() : null;
    el.style.setProperty('--ox', r ? `${r.left + r.width / 2}px` : '50vw');
    el.style.setProperty('--oy', r ? `${r.top + r.height / 2}px` : '60vh');
  }

  function show(id, { instant = false } = {}) {
    if (id === current) return;
    const prev = current;
    current = id;
    document.body.dataset.view = id;
    Void.dream.palette.setView(id);
    Void.dream.sky.setFocus(id === 'home' ? 0 : 1);

    // the room we're leaving
    if (prev !== 'home') {
      const old = $(`#view-${prev}`);
      if (old) {
        originOf(prev, old);
        old.classList.remove('is-opening');
        if (instant || Void.motion.reduced) old.hidden = true;
        else {
          old.classList.add('is-closing');
          clearTimeout(closing);
          closing = setTimeout(() => { old.hidden = true; old.classList.remove('is-closing'); }, 420);
        }
      }
    }

    if (id === 'home') {
      scene.inert = false;
      const obj = $(`.obj[data-view="${prev}"]`);
      if (obj && !instant) obj.focus({ preventScroll: true });
    } else {
      const room = $(`#view-${id}`);
      originOf(id, room);
      room.classList.remove('is-closing');
      room.hidden = false;
      room.scrollTop = 0;
      if (!instant && !Void.motion.reduced) {
        room.classList.remove('is-opening');
        void room.offsetWidth;
        room.classList.add('is-opening');
      }
      scene.inert = true;
      const head = room.querySelector('.view-title');
      if (head) head.focus({ preventScroll: true });
      Void.emit('page:shown', id);
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
