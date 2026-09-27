/* ==========================================================
   scene.js — the home of the dream: the title and the things
   floating around it (a note, polaroids, a tape, a photo strip,
   an envelope). They drift with the mouse at different depths,
   hovering one tints the sky towards its room, clicking the sky
   sends a ring through it.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $, $$ } = Void;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const scene = $('#scene');
  const glow = $('.cursor-glow');
  const hint = $('#sceneHint');

  let tx = 0;
  let ty = 0;
  let px = 0;
  let py = 0;
  let gx = -500;
  let gy = -500;
  let gtx = -500;
  let gty = -500;
  let hintTimer = 0;

  function splitTitle() {
    const name = $('.t-name');
    if (!name) return;
    const text = name.textContent;
    const title = name.closest('h1');
    if (title) title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
    name.textContent = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.setProperty('--i', String(i));
      s.setAttribute('aria-hidden', 'true');
      name.append(s);
    });
  }

  // the polaroid stack shows the first real pictures once they arrive
  function previewPictures() {
    Void.pinterest.load().then((pins) => {
      $$('.obj-polaroids .pola-img').forEach((img, i) => {
        const pin = pins[i];
        if (pin) img.style.backgroundImage = `url("${pin.thumb}")`;
      });
    }).catch(() => { /* the drawn placeholders stay */ });
  }

  function frame(t, dt) {
    const k = 1 - Math.exp(-(dt || 0.016) / 0.35);
    px += (tx - px) * k;
    py += (ty - py) * k;
    scene.style.setProperty('--px', px.toFixed(4));
    scene.style.setProperty('--py', py.toFixed(4));
    if (glow) {
      const g = 1 - Math.exp(-(dt || 0.016) / 0.12);
      gx += (gtx - gx) * g;
      gy += (gty - gy) * g;
      glow.style.transform = `translate(${gx.toFixed(1)}px, ${gy.toFixed(1)}px)`;
    }
  }

  Void.dream.scene = {
    init() {
      splitTitle();
      previewPictures();

      window.addEventListener('pointermove', (e) => {
        tx = (e.clientX / innerWidth) * 2 - 1;
        ty = (e.clientY / innerHeight) * 2 - 1;
        gtx = e.clientX;
        gty = e.clientY;
        if (hint && !hintTimer) hintTimer = setTimeout(() => hint.classList.add('is-gone'), 5000);
      }, { passive: true });
      if (!finePointer && glow) glow.remove();

      // hovering an object tints the sky towards its room
      $$('.obj').forEach((obj) => {
        const on = () => Void.dream.palette.preview(obj.dataset.view);
        const off = () => Void.dream.palette.preview(null);
        obj.addEventListener('pointerenter', on);
        obj.addEventListener('pointerleave', off);
        obj.addEventListener('focus', on);
        obj.addEventListener('blur', off);
        obj.addEventListener('click', () => {
          const r = obj.getBoundingClientRect();
          Void.dream.sky.ripple(r.left + r.width / 2, r.top + r.height / 2, 1.2);
          off();
        });
      });

      // clicking the empty sky sends a ring through it
      scene.addEventListener('click', (e) => {
        if (e.target.closest('a, button')) return;
        Void.dream.sky.ripple(e.clientX, e.clientY, 1);
        hint?.classList.add('is-gone');
      });

      Void.dream.onFrame(frame);
    }
  };
})();
