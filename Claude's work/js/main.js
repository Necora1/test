/* ==========================================================
   main.js — start everything in order, then play the intro
   ========================================================== */
(() => {
  const { $, config } = Void;
  const body = document.body;

  function wireSettings() {
    const reduce = $('#setReduceMotion');
    const intro = $('#setIntro');
    const lite = $('#setLite');

    const sync = () => {
      reduce.checked = Void.motion.reduced;
      intro.checked = !!Void.settings.intro;
      lite.checked = !!Void.settings.lite;
    };

    $('#settingsBtn').addEventListener('click', () => {
      sync();
      Void.modal.open('settingsModal');
    });
    reduce.addEventListener('change', () => Void.setSetting('reduceMotion', reduce.checked));
    intro.addEventListener('change', () => Void.setSetting('intro', intro.checked));
    lite.addEventListener('change', () => Void.setSetting('lite', lite.checked));
    Void.on('settings', sync);
  }

  function boot() {
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      body.classList.remove('is-booting');
      Void.nav.reveal();
    };

    const playIntro = Void.settings.intro && !Void.motion.reduced;
    if (playIntro) {
      Void.warp.start('intro');
      setTimeout(reveal, 850);
      // clicking or pressing a key during the intro skips ahead
      const skip = () => {
        Void.warp.hurry();
        reveal();
      };
      window.addEventListener('pointerdown', skip, { once: true });
      window.addEventListener('keydown', skip, { once: true });
    } else {
      requestAnimationFrame(reveal);
    }
  }

  Void.sky.init();
  Void.warp.init();
  Void.auth.init();
  Void.nav.init();
  Void.music.init();
  Void.messages.init();
  Void.drawing.init();
  wireSettings();

  const tag = $('#versionTag');
  if (tag) tag.textContent = config.version;

  boot();
})();
