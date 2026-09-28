/* ==========================================================
   memory/camera.js — the camera settings panel
   A panel that slides in from the right (the aperture button in
   the corner, or C): looks (eye candy, memory, super 8, vhs,
   cinestill 800t, black & white, clean), every effect on a
   slider, the time of day, "let time pass", birds, perspective
   guides (the lines the room was drawn on), resolution,
   and a button that takes a photo of the room (saved as a PNG).
   Everything applies live and is remembered in this browser.
   In the VHS look a tape counter sits in the corners.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $ } = Void;
  const html = document.documentElement;

  const LOOK_NAMES = [
    ['candy', 'eye candy (hdr)'],
    ['memory', 'memory'],
    ['super8', 'super 8'],
    ['vhs', 'vhs'],
    ['cinestill', 'cinestill 800t'],
    ['mono', 'black & white'],
    ['clean', 'clean']
  ];

  const SLIDERS = [
    ['the light', [
      ['time', 'time of day', 0, 1, 0.01, (v) => (v < 0.15 ? 'golden hour' : v < 0.5 ? 'sunset' : v < 0.8 ? 'dusk' : 'night')],
      ['exposure', 'exposure', -1.5, 1.5, 0.05, (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} ev`],
      ['adapt', 'eyes adjusting', 0, 1, 0.05],
      ['hdr', 'hdr / local contrast', 0, 1.6, 0.05]
    ]],
    ['the lens', [
      ['bloom', 'bloom', 0, 2.5, 0.05],
      ['rays', 'god rays', 0, 2.5, 0.05],
      ['flare', 'lens flare', 0, 2, 0.05],
      ['anamorphic', 'anamorphic streaks', 0, 2, 0.05],
      ['dirt', 'dirty lens', 0, 1.5, 0.05],
      ['ca', 'colour fringing', 0, 3, 0.05]
    ]],
    ['the film', [
      ['grain', 'grain', 0, 2.5, 0.05],
      ['dreamy', 'dreamy edges', 0, 2, 0.05],
      ['vignette', 'vignette', 0, 2, 0.05],
      ['leaks', 'light leaks', 0, 2, 0.05]
    ]],
    ['the room', [
      ['dust', 'dust in the light', 0, 2.5, 0.05],
      ['sway', 'camera drift', 0, 2, 0.05],
      ['quality', 'resolution', 0.5, 1.25, 0.05, (v) => `${Math.round(v * 100)}%`]
    ]]
  ];

  const panel = $('#cameraPanel');
  const btn = $('#cameraBtn');
  const osd = $('#vhsOsd');
  let inputs = {};
  let osdTimer = 0;

  const fmt = (v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, '') || '0');

  function build() {
    const m = Void.dream.memory;
    const s = m.settings;
    const body = panel.querySelector('.cam-body');

    const looks = document.createElement('div');
    looks.className = 'cam-looks';
    looks.setAttribute('role', 'group');
    looks.setAttribute('aria-label', 'Looks');
    LOOK_NAMES.forEach(([id, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `cam-look look-${id}`;
      b.dataset.look = id;
      b.textContent = label;
      b.addEventListener('click', () => { m.look(id); Void.dream.sound?.chime(660, { vol: 0.04, dur: 0.3, wet: 0.2 }); });
      looks.append(b);
    });
    body.append(looks);

    const toggles = document.createElement('div');
    toggles.className = 'cam-toggles';
    [['timePasses', 'let time pass'], ['birds', 'birds outside'], ['guides', 'perspective guides']].forEach(([key, label]) => {
      const t = document.createElement('label');
      t.className = 'cam-toggle';
      t.innerHTML = '<input type="checkbox"><span class="cam-switch" aria-hidden="true"></span><span></span>';
      t.querySelector('span:last-child').textContent = label;
      const cb = t.querySelector('input');
      cb.addEventListener('change', () => m.set(key, key === 'birds' ? (cb.checked ? 1 : 0) : cb.checked));
      inputs[key] = cb;
      toggles.append(t);
    });
    body.append(toggles);

    SLIDERS.forEach(([group, items]) => {
      const fs = document.createElement('fieldset');
      fs.className = 'cam-group';
      const lg = document.createElement('legend');
      lg.textContent = group;
      fs.append(lg);
      items.forEach(([key, label, min, max, step, show]) => {
        const row = document.createElement('label');
        row.className = 'cam-row';
        row.innerHTML = '<span class="cam-name"></span><output class="cam-val"></output><input type="range">';
        row.querySelector('.cam-name').textContent = label;
        const input = row.querySelector('input');
        const out = row.querySelector('output');
        Object.assign(input, { min, max, step });
        const paint = () => {
          out.textContent = show ? show(Number(input.value)) : fmt(Number(input.value));
          input.style.setProperty('--fill', `${((input.value - min) / (max - min)) * 100}%`);
        };
        input.addEventListener('input', () => { m.set(key, Number(input.value)); paint(); });
        inputs[key] = { input, paint, row };
        fs.append(row);
      });
      body.append(fs);
    });

    const actions = document.createElement('div');
    actions.className = 'cam-actions';
    const photo = document.createElement('button');
    photo.type = 'button';
    photo.className = 'send-btn cam-photo';
    photo.innerHTML = '<span class="btn-label">take a photo</span>';
    photo.addEventListener('click', takePhoto);
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'pill-btn';
    reset.textContent = 'back to default';
    reset.addEventListener('click', () => m.reset());
    actions.append(photo, reset);
    body.append(actions);

    sync(s);
  }

  // make the panel show what the settings are
  function sync(s) {
    panel.querySelectorAll('.cam-look').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.look === s.look)));
    Object.entries(inputs).forEach(([key, el]) => {
      if (el instanceof HTMLInputElement) { el.checked = !!s[key]; return; }
      el.input.value = s[key];
      el.paint();
    });
    inputs.time?.row.classList.toggle('is-off', !!s.timePasses);
    html.classList.toggle('is-vhs', s.grade === 3);
    html.classList.toggle('is-super8', s.grade === 2);
    clearInterval(osdTimer);
    if (s.grade === 3) { tickOsd(); osdTimer = setInterval(tickOsd, 1000); }
  }

  // a tape counter: the time on the tape starts at 5:47 pm, the day in the painting
  const start = Date.now();
  function tickOsd() {
    const secs = Math.floor((Date.now() - start) / 1000);
    const t = new Date(2009, 9, 14, 17, 47, 12 + secs);
    const hh = t.getHours() % 12 || 12;
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ss = String(t.getSeconds()).padStart(2, '0');
    osd.querySelector('.osd-time').textContent = `${hh}:${mm}:${ss} ${t.getHours() < 12 ? 'AM' : 'PM'}`;
    osd.querySelector('.osd-count').textContent = `${String(Math.floor(secs / 3600)).padStart(1, '0')}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  }

  async function takePhoto() {
    html.classList.remove('is-shutter');
    void html.offsetWidth;
    html.classList.add('is-shutter');
    Void.dream.sound?.thud({ vol: 0.12 });
    Void.dream.sound?.chime(1800, { vol: 0.03, dur: 0.08, wet: 0, type: 'square' });
    const blob = await Void.dream.memory.snapshot();
    if (!blob) { Void.dream.toast?.("the camera can't take photos without WebGL."); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `renns-room-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    Void.dream.toast?.('saved a photo of the room.');
  }

  function setOpen(open) {
    panel.classList.toggle('is-open', open);
    panel.inert = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector('.cam-look[aria-pressed="true"]')?.focus({ preventScroll: true });
  }

  // the caption's clock follows the light: 5:47 pm in the gold, near midnight at night
  function captionClock() {
    const cap = document.querySelector('.cap-place');
    if (!cap || Void.dream.views.current() !== 'home') return;
    const mins = 17 * 60 + 47 + Math.round(Void.dream.memory.tod() * 370);
    const h = Math.floor(mins / 60) % 24;
    const text = `my room, the light at ${h % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}.`;
    if (cap.textContent !== text) cap.textContent = text;
  }

  Void.dream.camera = {
    init() {
      setInterval(captionClock, 1000);
      if (!Void.dream.memory?.settings) return;
      build();
      panel.inert = true;
      btn.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
      panel.querySelector('.cam-close').addEventListener('click', () => setOpen(false));
      Void.on('camera', sync);
      document.addEventListener('keydown', (e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, textarea') || Void.modal.isOpen()) return;
        if (e.key === 'c' || e.key === 'C') {
          const v = Void.dream.views.current();
          if (v === 'guitar' || v === 'games') return;
          setOpen(!panel.classList.contains('is-open'));
        } else if (e.key === 'Escape' && panel.classList.contains('is-open')) {
          setOpen(false);
          e.stopPropagation();
        }
      }, true);
    }
  };
})();
