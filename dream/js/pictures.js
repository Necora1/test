/* ==========================================================
   pictures.js — the gallery as polaroids scattered on the sky
   Each one develops like a real instant photo as it loads.
   With a mouse you can pick them up and move them around;
   clicking one (without dragging) looks at it up close.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $ } = Void;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const wall = $('#polaroids');
  const status = $('#picStatus');
  const more = $('#picMore');
  const viewer = $('#picViewer');
  const frame = $('#picViewerFrame');
  const photo = $('#picViewerImg');
  const caption = $('#picViewerText');
  const counter = $('#picViewerCount');
  const pinLink = $('#picViewerLink');

  let state = 'idle'; // idle · loading · ready · error
  let pins = [];
  let current = -1;
  let stack = 20;

  // the same tilt for the same picture every visit
  const jitter = (i, salt) => {
    const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const shorten = (text, n) => (text.length > n ? `${text.slice(0, n - 1).trim()}…` : text);

  function render() {
    wall.replaceChildren(...pins.map((pin, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'polaroid';
      card.dataset.index = String(i);
      card.style.setProperty('--r', `${((jitter(i, 1) - 0.5) * 11).toFixed(2)}deg`);
      card.style.setProperty('--nx', `${((jitter(i, 2) - 0.5) * 18).toFixed(1)}px`);
      card.style.setProperty('--ny', `${((jitter(i, 3) - 0.5) * 22).toFixed(1)}px`);
      card.style.setProperty('--c', pin.color);
      card.style.setProperty('--i', String(Math.min(i, 16)));
      card.setAttribute('aria-label', pin.text ? `Open picture: ${pin.text}` : `Open picture ${i + 1}`);

      const shot = document.createElement('span');
      shot.className = 'polaroid-photo';
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false; // or the browser's own image drag takes over
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('load', () => {
        setTimeout(() => card.classList.add('is-developed'), 150 + Math.random() * 500);
      }, { once: true });
      img.addEventListener('error', () => card.classList.add('is-broken'), { once: true });
      img.src = pin.thumb;
      shot.append(img);

      const words = document.createElement('span');
      words.className = 'polaroid-caption';
      words.textContent = pin.text ? shorten(pin.text, 40) : '';

      card.append(shot, words);
      return card;
    }));
  }

  function say(text, retry = false) {
    const p = document.createElement('p');
    p.textContent = text;
    const parts = [p];
    if (retry) {
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'hand-link';
      again.textContent = 'try again';
      again.addEventListener('click', load);
      parts.push(again);
    }
    status.replaceChildren(...parts);
    status.hidden = false;
  }

  async function load() {
    if (state === 'loading' || state === 'ready') return;
    state = 'loading';
    say('developing…');
    try {
      pins = await Void.pinterest.load();
      state = 'ready';
      status.hidden = true;
      if (pins.length) render();
      else say('no pictures here yet.');
    } catch (err) {
      console.warn('[dream] Pinterest feed failed:', err.message);
      state = 'error';
      say("the pictures couldn't come through from Pinterest right now.", true);
    }
    more.href = Void.pinterest.profileUrl();
    more.hidden = false;
  }

  /* ---------- pick them up and move them (mouse) ---------- */
  function wireDragging() {
    wall.addEventListener('dragstart', (e) => e.preventDefault());
    wall.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.polaroid');
      if (!card || !finePointer || e.button !== 0) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const fromX = parseFloat(card.style.getPropertyValue('--dx')) || 0;
      const fromY = parseFloat(card.style.getPropertyValue('--dy')) || 0;
      let moved = false;

      const move = (ev) => {
        const mx = ev.clientX - startX;
        const my = ev.clientY - startY;
        if (!moved) {
          if (Math.hypot(mx, my) < 6) return;
          moved = true;
          card.classList.add('is-dragging');
          card.style.zIndex = String(++stack);
        }
        card.style.setProperty('--dx', `${fromX + mx}px`);
        card.style.setProperty('--dy', `${fromY + my}px`);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        card.classList.remove('is-dragging');
        if (moved) {
          card.dataset.dragged = '1';
          setTimeout(() => { delete card.dataset.dragged; }, 80);
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  /* ---------- looking at one up close ---------- */
  function show(i, dir = '') {
    if (!pins.length) return;
    current = (i + pins.length) % pins.length;
    const pin = pins[current];
    frame.style.setProperty('--c', pin.color);
    frame.dataset.dir = dir;
    frame.classList.remove('is-moving');
    void frame.offsetWidth;
    if (dir) frame.classList.add('is-moving');
    photo.src = pin.thumb;
    photo.alt = pin.text || `Picture ${current + 1}`;
    if (pin.w && pin.h) { photo.width = pin.w; photo.height = pin.h; }
    const big = new Image();
    big.onload = () => { if (pins[current] === pin) photo.src = pin.full; };
    big.src = pin.full;
    caption.textContent = pin.text;
    caption.hidden = !pin.text;
    counter.textContent = `${current + 1} / ${pins.length}`;
    pinLink.href = pin.link;
    [1, -1].forEach((step) => { new Image().src = pins[(current + step + pins.length) % pins.length].thumb; });
  }

  function wireViewer() {
    wall.addEventListener('click', (e) => {
      const card = e.target.closest('.polaroid');
      if (!card || card.dataset.dragged) return;
      show(Number(card.dataset.index));
      Void.modal.open(viewer);
    });
    $('#picPrev').addEventListener('click', () => show(current - 1, 'prev'));
    $('#picNext').addEventListener('click', () => show(current + 1, 'next'));
    viewer.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1, 'prev'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1, 'next'); }
    });
    let sx = 0;
    let sy = 0;
    let tracking = false;
    frame.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      tracking = true;
      sx = e.clientX;
      sy = e.clientY;
    });
    frame.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) show(current + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'prev');
    });
    frame.addEventListener('pointercancel', () => { tracking = false; });
  }

  Void.dream.pictures = {
    load,
    init() {
      wireDragging();
      wireViewer();
      Void.on('page:shown', (id) => { if (id === 'gallery') load(); });
    }
  };
})();
