/* ==========================================================
   main.js — waking up inside the dream
   Starts everything, opens the eyes, and handles the way back
   to the classic version.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $, $$, store } = Void;
  const html = document.documentElement;
  const VERSION_KEY = 'void_version';

  // being here means this is the version you picked
  store.setRaw(VERSION_KEY, 'dream');

  // shared with the classic version: song search, the letter, the sketchbook
  Void.music.init();
  Void.messages.init();
  Void.drawing.init();
  // the sketchbook starts on paper, with ink
  document.getElementById('bgToggleBtn')?.click();

  // the dream itself
  Void.dream.sky.init();
  Void.dream.life.init();
  Void.dream.scene.init();
  Void.dream.tapes.init();
  Void.dream.pictures.init();
  Void.dream.views.init();

  // rain on the window
  const rainBtn = $('#rainBtn');
  rainBtn.addEventListener('click', () => {
    const on = Void.dream.rain.toggle();
    rainBtn.setAttribute('aria-pressed', String(!!on));
  });

  // back to the classic version: a flash of daylight, and you're awake
  $$('.to-classic').forEach((link) => link.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    store.setRaw(VERSION_KEY, 'classic');
    const view = Void.dream.views.current();
    const target = `${link.getAttribute('href')}${view !== 'home' ? `#${view}` : ''}`;
    if (Void.motion.reduced) { location.href = target; return; }
    html.classList.add('is-waking');
    setTimeout(() => { location.href = target; }, 900);
  }));
  window.addEventListener('pageshow', (e) => { if (e.persisted) html.classList.remove('is-waking'); });

  // the eyes open
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('is-asleep')));
})();
