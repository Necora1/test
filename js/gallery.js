/* ==========================================================
   gallery.js — pictures from Pinterest, laid out the way
   Pinterest lays them out (columns of different heights), with
   a viewer for looking at one picture at a time.
   The pins themselves come from pinterest.js.
   ========================================================== */
(() => {
  const { $ } = Void;
  const gallery = (Void.gallery = {});

  const grid = $('#pinGrid');
  const status = $('#galleryStatus');
  const more = $('#galleryMore');
  const viewer = $('#pinViewer');
  const frame = $('#viewerFrame');
  const photo = $('#viewerImg');
  const caption = $('#viewerText');
  const counter = $('#viewerCount');
  const pinLink = $('#viewerLink');

  const ROW = 2; // px, the same as grid-auto-rows in gallery.css

  let state = 'idle'; // idle · loading · ready · error
  let pins = [];
  let current = -1;
  let laidOutWidth = 0;

  /* ---------- the grid ---------- */
  // Each tile spans as many tiny rows as its height needs; the grid then
  // drops every tile into the shortest column, in order.
  function layout() {
    const width = grid.clientWidth;
    if (!width || !grid.children.length) return;
    const style = getComputedStyle(grid);
    const column = parseFloat(style.gridTemplateColumns);
    const gap = parseFloat(style.columnGap) || 0;
    if (!column) return;
    for (const tile of grid.children) {
      const ratio = Number(tile.dataset.ratio) || 1;
      tile.style.gridRowEnd = `span ${Math.max(1, Math.ceil((column * ratio + gap) / ROW))}`;
    }
    laidOutWidth = width;
  }

  function skeleton() {
    const ratios = [1.4, 0.9, 1.7, 1.1, 1.5, 1, 1.8, 1.2, 0.95];
    grid.replaceChildren(...ratios.map((r) => {
      const tile = document.createElement('span');
      tile.className = 'pin is-skeleton';
      tile.dataset.ratio = String(r);
      tile.style.aspectRatio = `1 / ${r}`;
      tile.setAttribute('aria-hidden', 'true');
      return tile;
    }));
    grid.setAttribute('aria-busy', 'true');
    layout();
  }

  function render() {
    const tiles = pins.map((pin, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pin';
      btn.dataset.index = String(i);
      btn.style.setProperty('--c', pin.color);
      btn.style.setProperty('--i', String(Math.min(i, 14)));
      if (pin.w && pin.h) btn.style.aspectRatio = `${pin.w} / ${pin.h}`;
      btn.dataset.ratio = pin.w && pin.h ? String(pin.h / pin.w) : '1';
      btn.setAttribute('aria-label', pin.text ? `Open picture: ${pin.text}` : `Open picture ${i + 1}`);

      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      if (pin.w && pin.h) { img.width = pin.w; img.height = pin.h; }
      img.addEventListener('load', () => btn.classList.add('is-loaded'), { once: true });
      img.addEventListener('error', () => btn.classList.add('is-broken'), { once: true });
      img.src = pin.thumb;
      btn.append(img);
      return btn;
    });
    grid.replaceChildren(...tiles);
    grid.removeAttribute('aria-busy');
    layout();
  }

  function say(text, { retry = false } = {}) {
    const p = document.createElement('p');
    p.textContent = text;
    const parts = [p];
    if (retry) {
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'btn';
      again.textContent = 'try again';
      again.addEventListener('click', () => gallery.load());
      parts.push(again);
    }
    status.replaceChildren(...parts);
    status.hidden = false;
  }

  gallery.load = async () => {
    if (!grid || state === 'loading' || state === 'ready') return;
    state = 'loading';
    status.hidden = true;
    more.hidden = true;
    skeleton();
    try {
      pins = await Void.pinterest.load();
      state = 'ready';
      if (pins.length) render();
      else { grid.replaceChildren(); say('No pictures here yet.'); }
      more.href = Void.pinterest.profileUrl();
      more.hidden = false;
    } catch (err) {
      console.warn('[gallery] Pinterest feed failed:', err.message);
      state = 'error';
      grid.replaceChildren();
      grid.removeAttribute('aria-busy');
      say("The pictures couldn't load from Pinterest right now.", { retry: true });
      more.href = Void.pinterest.profileUrl();
      more.hidden = false;
    }
  };

  /* ---------- the viewer ---------- */
  function show(i, direction = '') {
    if (!pins.length) return;
    current = (i + pins.length) % pins.length;
    const pin = pins[current];

    frame.style.setProperty('--c', pin.color);
    frame.dataset.dir = direction;
    frame.classList.remove('is-moving');
    void frame.offsetWidth; // restart the slide
    if (direction) frame.classList.add('is-moving');

    // the grid picture is already loaded, so show it at once, then swap in the big one
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

    // warm up the neighbours so arrowing through is instant
    [1, -1].forEach((step) => { new Image().src = pins[(current + step + pins.length) % pins.length].thumb; });
  }

  function wireViewer() {
    grid.addEventListener('click', (e) => {
      const tile = e.target.closest('.pin[data-index]');
      if (!tile) return;
      show(Number(tile.dataset.index));
      Void.modal.open(viewer);
    });

    $('#viewerPrev').addEventListener('click', () => show(current - 1, 'prev'));
    $('#viewerNext').addEventListener('click', () => show(current + 1, 'next'));

    viewer.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1, 'prev'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1, 'next'); }
    });

    // swipe left / right on touch screens
    let startX = 0;
    let startY = 0;
    let tracking = false;
    frame.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
    });
    frame.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) show(current + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'prev');
    });
    frame.addEventListener('pointercancel', () => { tracking = false; });
  }

  if (grid && viewer) wireViewer();

  // re-measure when the gallery changes width (window resized, page shown again)
  if (grid && window.ResizeObserver) {
    let raf = 0;
    new ResizeObserver(() => {
      if (raf || grid.clientWidth === laidOutWidth) return;
      raf = requestAnimationFrame(() => { raf = 0; layout(); });
    }).observe(grid);
  }
  Void.on('page:shown', (id) => { if (id === 'gallery') gallery.load(); });
})();
