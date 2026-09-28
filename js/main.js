/* ==========================================================
   main.js — pressing play
   Starts everything, and opens the eyes on the room.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $ } = Void;

  // song search, the letter, the sketchbook
  Void.music.init();
  Void.messages.init();
  Void.drawing.init();
  // the sketchbook starts on paper, with ink
  document.getElementById('bgToggleBtn')?.click();

  // the room, and everything in it
  Void.dream.sky.init();
  Void.dream.life.init();
  Void.dream.door.init();
  Void.dream.scene.init();
  Void.dream.tapes.init();
  Void.dream.pictures.init();
  Void.dream.fx.init();
  Void.dream.wishes.init();
  Void.dream.oracle.init();
  Void.dream.guitar.init();
  Void.dream.arcade.init();
  Void.dream.extras.init();
  Void.dream.camera.init();
  Void.dream.views.init();

  // rain on the window
  const rainBtn = $('#rainBtn');
  rainBtn.addEventListener('click', () => {
    const on = Void.dream.rain.toggle();
    Void.dream.memory.setRain(!!on);
    rainBtn.setAttribute('aria-pressed', String(!!on));
  });

  // the eyes open
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('is-asleep')));
})();
