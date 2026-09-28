/* ==========================================================
   scene.js — home is renn's room (memory/engine.js paints it)
   · the things in the room are the way around: an invisible
     button sits on each one, following the camera
   · pointing at something warms it and names it, in handwriting
   · a title card fades in and out like the start of a film
   · on a phone you look around the room by dragging sideways
   · on the way to a room a caption says where you're going
   · the night sea (sky.js, life.js) is only switched on when
     you go out of the window, to make a wish
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $ } = Void;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const scene = $('#scene');
  const nav = $('#hotspots');
  const label = $('#hotLabel');
  const hint = $('#sceneHint');
  const title = $('#titleCard');
  const travel = $('#travelCaption');

  let spots = [];
  let hovered = null;
  let travelTimer = 0;
  let outsideTimer = 0;

  function splitTitle() {
    const name = $('.t-name');
    if (!name) return;
    const text = name.textContent;
    name.closest('h1')?.setAttribute('aria-label', "renn's void");
    name.textContent = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.setProperty('--i', String(i));
      s.setAttribute('aria-hidden', 'true');
      name.append(s);
    });
  }

  function build(hotspots) {
    spots = hotspots.map((h) => {
      const el = document.createElement(h.action ? 'button' : 'a');
      el.className = 'hotspot';
      el.dataset.view = h.id;
      if (h.action) { el.type = 'button'; el.dataset.action = h.action; } else el.href = `#${h.id}`;
      el.setAttribute('aria-label', h.label);
      el.innerHTML = '<i class="hot-dot" aria-hidden="true"></i>';
      const on = () => point(h, el);
      const off = () => { if (hovered === h) point(null); };
      el.addEventListener('pointerenter', on);
      el.addEventListener('pointerleave', off);
      el.addEventListener('focus', on);
      el.addEventListener('blur', off);
      el.addEventListener('click', (e) => {
        if (h.action === 'lamp') {
          e.preventDefault();
          const on2 = Void.dream.memory.toggleLamp();
          Void.dream.sound.chime(on2 ? 660 : 440, { vol: 0.05, dur: 0.4, wet: 0.2 });
          Void.dream.toast?.(on2 ? 'lamp on. better.' : 'lamp off.');
        }
        hint?.classList.add('is-gone');
      });
      nav.append(el);
      return { h, el };
    });
  }

  function point(h, el) {
    hovered = h;
    Void.dream.memory.setHover(h);
    Void.dream.palette.preview(h && !h.action ? h.id : null);
    if (h) {
      label.textContent = h.label;
      label.classList.add('is-on');
      if (finePointer && !h.action) Void.dream.sound.chime(Void.dream.sound.step(h.id.length % 7, 523), { vol: 0.025, dur: 0.6, wet: 0.5 });
    } else label.classList.remove('is-on');
  }

  // keep every button on its thing as the camera drifts
  function frame() {
    if (document.body.dataset.view !== 'home' || !spots.length) return;
    const m = Void.dream.memory;
    spots.forEach(({ h, el }) => {
      const [x0, y0] = m.toScreen(h.x, h.y);
      const [x1, y1] = m.toScreen(h.x + h.w, h.y + h.h);
      el.style.transform = `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`;
      el.style.width = `${(x1 - x0).toFixed(1)}px`;
      el.style.height = `${(y1 - y0).toFixed(1)}px`;
    });
    if (hovered) {
      const [lx, ly] = m.toScreen(hovered.x + hovered.w / 2, hovered.y);
      label.style.transform = `translate(${lx.toFixed(1)}px, ${(ly - 8).toFixed(1)}px)`;
    }
  }

  // phones: drag sideways to look around
  function wirePan() {
    let drag = null;
    scene.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      drag = { x: e.clientX, moved: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      Void.dream.memory.pan(-dx / window.innerWidth * 0.35);
      drag.x = e.clientX;
    }, { passive: true });
    window.addEventListener('pointerup', () => { drag = null; });
    window.addEventListener('pointercancel', () => { drag = null; });
  }

  // a line of handwriting on the way somewhere
  function caption(text) {
    clearTimeout(travelTimer);
    if (!text) { travel.classList.remove('is-on'); return; }
    travel.textContent = text;
    travel.classList.remove('is-on');
    void travel.offsetWidth;
    travel.classList.add('is-on');
    travelTimer = setTimeout(() => travel.classList.remove('is-on'), 2600);
  }

  Void.dream.scene = {
    async init() {
      splitTitle();
      const layers = await Void.dream.memory.init();
      build(layers.hotspots);
      if (!finePointer && hint) hint.textContent = 'drag sideways to look around. tap on things.';
      wirePan();
      Void.dream.onFrame(frame);
      setTimeout(() => title?.classList.add('is-gone'), 5200);

      Void.on('view', ({ id, prev }) => {
        point(null);
        const preset = Void.dream.memory.PRESETS[id];
        caption(id !== 'home' ? preset?.caption : prev !== 'home' ? 'back in my room' : '');
        // out the window: the night sea, the jellyfish, the stars. The sea is
        // switched on once the camera is at the window, and the room stops
        // drawing once the sea has covered it
        clearTimeout(outsideTimer);
        const m = Void.dream.memory;
        if (id === 'wishes') {
          outsideTimer = setTimeout(() => {
            Void.dream.sky.setVisible?.(true);
            document.body.classList.add('is-outside');
            outsideTimer = setTimeout(() => m.setVisible(false), 2400);
          }, Void.motion.reduced ? 0 : 1900);
        } else {
          m.setVisible(true);
          document.body.classList.remove('is-outside');
          outsideTimer = setTimeout(() => Void.dream.sky.setVisible?.(false), 1900);
        }
      });
    }
  };
})();
