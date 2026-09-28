/* ==========================================================
   guitar.js — a guitar you can actually play
   Drag across the strings to strum (either way), click a string
   to pluck it, pick a chord. "midwest tuning" retunes it to
   FACGCE, and "let it play" then fingerpicks instead of strumming. Keys: 1–8 chords, A S D F G H the
   strings (low to high), space strums. "let it play" strums a
   slow progression by itself. The strings are Karplus–Strong
   (sound.js), the reverb is the dream's room.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $, $$ } = Void;
  const colors = Void.dream.palette.current;

  const STD_OPEN = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]; // E A D G B e
  const STD_CHORDS = [
    ['Em', [0, 2, 2, 0, 0, 0]],
    ['C', [-1, 3, 2, 0, 1, 0]],
    ['G', [3, 2, 0, 0, 0, 3]],
    ['D', [-1, -1, 0, 2, 3, 2]],
    ['Am', [-1, 0, 2, 2, 1, 0]],
    ['Cmaj7', [-1, 3, 2, 0, 0, 0]],
    ['Fmaj7', [-1, -1, 3, 2, 1, 0]],
    ['Em9', [0, 2, 0, 0, 0, 2]]
  ];
  // a slow, sad, pretty loop: chord index, beats
  const STD_SONG = [[5, 4], [7, 4], [2, 4], [3, 4], [5, 4], [6, 4], [4, 4], [0, 4]];

  // FACGCE: the open tuning half of midwest emo is written in. Everything
  // rings; one finger (or none) makes a chord
  const MW_OPEN = [87.31, 110.0, 130.81, 196.0, 261.63, 329.63];
  const MW_CHORDS = [
    ['Fmaj9', [0, 0, 0, 0, 0, 0]],
    ['C/G', [2, 2, 2, 0, 0, 0]],
    ['Am7', [4, 3, 0, 0, 0, 0]],
    ['B♭maj9', [5, 5, 5, 0, 0, 0]],
    ['C', [7, 7, 7, 0, 0, 0]],
    ['Dm11', [9, 8, 9, 0, 0, 0]],
    ['Em', [11, 10, 11, 0, 0, 0]],
    ['F', [12, 12, 12, 0, 0, 0]]
  ];
  const MW_SONG = [[0, 4], [3, 4], [5, 4], [2, 4], [0, 4], [3, 4], [6, 4], [4, 4]];
  // fingerpicked eighths: bass, then twinkling up and down the top strings
  const TWINKLE = [0, 3, 5, 4, 1, 3, 5, 4];

  const TUNINGS = {
    standard: { open: STD_OPEN, chords: STD_CHORDS, song: STD_SONG, style: 'strum', bpm: 76 },
    midwest: { open: MW_OPEN, chords: MW_CHORDS, song: MW_SONG, style: 'twinkle', bpm: 138 }
  };
  let T = TUNINGS.standard;
  let OPEN = T.open;
  let CHORDS = T.chords;
  let SONG = T.song;
  const PATTERN = [['d', 0], ['d', 1], ['u', 1.5], ['u', 2.5], ['d', 3], ['u', 3.5]];
  const KEYS = ['a', 's', 'd', 'f', 'g', 'h'];

  const canvas = $('#guitarCanvas');
  const ctx = canvas.getContext('2d');
  const chordBox = $('#chords');
  const autoBtn = $('#gtrAuto');
  const roomBtn = $('#gtrRoom');
  const nowChord = $('#gtrChord');

  let W = 0;
  let H = 0;
  let dpr = 1;
  let chord = 0;
  const vib = OPEN.map(() => ({ amp: 0, phase: 0, freq: 0 }));
  let notes = [];
  let open = false;
  let auto = null;
  let lastPointer = null;

  const freqOf = (s) => {
    const fret = CHORDS[chord][1][s];
    return fret < 0 ? 0 : OPEN[s] * Math.pow(2, fret / 12);
  };
  const stringY = (s) => H * (0.2 + (5 - s) * 0.12);
  const rgba = (c, a) => `rgba(${(c[0] * 255) | 0}, ${(c[1] * 255) | 0}, ${(c[2] * 255) | 0}, ${a})`;

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  function pluck(s, { bright = 0.5, when = 0, vol = 0.45 } = {}) {
    const f = freqOf(s);
    if (!f) {
      // a muted string: a dead little tick
      vib[s].amp = Math.max(vib[s].amp, 0.8);
      return;
    }
    Void.dream.sound.pluck(f, { bright, when, vol, pan: (s - 2.5) * 0.12 });
    setTimeout(() => {
      vib[s].amp = 6 + bright * 5;
      vib[s].freq = 18 + s * 5;
      notes.push({ x: W * (0.25 + Math.random() * 0.4), y: stringY(s), age: 0, s });
    }, when * 1000);
  }

  function strum(dir = 'd', { bright = 0.55, spread = 0.028, vol = 0.4 } = {}) {
    const order = dir === 'd' ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1];
    order.forEach((s, i) => pluck(s, { bright, when: i * spread, vol: vol * (dir === 'u' ? 0.8 : 1) }));
    Void.dream.sky.ripple(innerWidth * (0.3 + Math.random() * 0.4), innerHeight * 0.3, 0.6);
  }

  function setChord(i) {
    chord = (i + CHORDS.length) % CHORDS.length;
    $$('.chord', chordBox).forEach((b, k) => b.setAttribute('aria-pressed', String(k === chord)));
    nowChord.textContent = CHORDS[chord][0];
  }

  // high shapes are drawn from their lowest fret, with "5fr" beside them
  const shapeOffset = (frets) => {
    const played = frets.filter((f) => f > 0);
    const max = played.length ? Math.max(...played) : 0;
    return max > 4 ? Math.min(...played) - 1 : 0;
  };

  function chordButton([name, frets], i) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chord';
    b.setAttribute('aria-pressed', String(i === chord));
    b.setAttribute('aria-label', `${name} chord (key ${i + 1})`);
    const off = shapeOffset(frets);
    const grid = frets.map((f, s) => {
      const top = f < 0 ? '<i class="c-x">×</i>' : f === 0 ? '<i class="c-o">○</i>' : '<i></i>';
      const dot = f > 0 ? `<b style="--s:${s};--f:${Math.min(f - off, 4)}"></b>` : '';
      return top.replace('<i', `<i style="--s:${s}"`) + dot;
    }).join('') + (off ? `<em class="c-fr">${off + 1}fr</em>` : '');
    b.innerHTML = `<span class="chord-name">${name}</span><span class="chord-grid" aria-hidden="true">${grid}</span><kbd>${i + 1}</kbd>`;
    b.addEventListener('click', () => { setChord(i); strum('d', { bright: 0.45 }); });
    return b;
  }

  /* ---------- playing by itself ---------- */
  function startAuto() {
    Void.dream.sound.wake();
    const beat = 60 / T.bpm;
    let bar = 0;
    const playBar = () => {
      const [c, beats] = SONG[bar % SONG.length];
      setChord(c);
      if (T.style === 'twinkle') {
        TWINKLE.forEach((string, n) => {
          const t = setTimeout(() => pluck(string, { bright: n % 4 === 0 ? 0.45 : 0.7, vol: n % 4 === 0 ? 0.4 : 0.3 }), n * (beat / 2) * 1000);
          auto.timers.push(t);
        });
      } else {
        PATTERN.forEach(([dir, at]) => {
          if (at >= beats) return;
          const t = setTimeout(() => strum(dir, { bright: dir === 'd' ? 0.5 : 0.35, vol: dir === 'd' ? 0.36 : 0.24 }), at * beat * 1000);
          auto.timers.push(t);
        });
      }
      bar++;
      auto.timers.push(setTimeout(playBar, beats * beat * 1000));
    };
    auto = { timers: [] };
    playBar();
    autoBtn.setAttribute('aria-pressed', 'true');
    autoBtn.querySelector('.btn-label').textContent = 'stop';
  }

  function stopAuto() {
    if (!auto) return;
    auto.timers.forEach(clearTimeout);
    auto = null;
    autoBtn.setAttribute('aria-pressed', 'false');
    autoBtn.querySelector('.btn-label').textContent = 'let it play';
  }

  /* ---------- drawing ---------- */
  function frame(t, dt) {
    if (!open || !W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // the soundhole, glowing like the moon
    const hx = W * 0.78;
    const hy = H * 0.5;
    const hr = Math.min(H * 0.36, W * 0.16);
    const ring = ctx.createRadialGradient(hx, hy, hr * 0.7, hx, hy, hr * 1.5);
    ring.addColorStop(0, rgba(colors.glow, 0.28));
    ring.addColorStop(1, rgba(colors.glow, 0));
    ctx.fillStyle = ring;
    ctx.fillRect(hx - hr * 1.6, hy - hr * 1.6, hr * 3.2, hr * 3.2);
    ctx.fillStyle = 'rgba(4, 6, 12, 0.85)';
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(colors.accent, 0.7);
    ctx.lineWidth = 3;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.arc(hx, hy, hr + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(colors.glow, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(hx, hy, hr + 13, 0, Math.PI * 2);
    ctx.stroke();

    // frets on the left
    for (let f = 1; f <= 4; f++) {
      const x = W * 0.06 + f * W * 0.07;
      ctx.fillStyle = 'rgba(255, 245, 225, 0.18)';
      ctx.fillRect(x, H * 0.14, 2, H * 0.72);
    }
    // where the chord's fingers are
    const off = shapeOffset(CHORDS[chord][1]);
    CHORDS[chord][1].forEach((fret, s) => {
      if (fret <= 0) return;
      const x = W * 0.06 + (fret - off - 0.5) * W * 0.07;
      ctx.fillStyle = rgba(colors.accent, 0.9);
      ctx.beginPath();
      ctx.arc(x, stringY(s), 7, 0, Math.PI * 2);
      ctx.fill();
    });

    // the strings
    for (let s = 0; s < 6; s++) {
      const v = vib[s];
      v.phase += dt * v.freq * 6;
      v.amp *= Math.pow(0.12, dt);
      const y = stringY(s);
      const muted = freqOf(s) === 0;
      ctx.strokeStyle = muted ? 'rgba(255,245,225,0.25)' : `rgba(255, 245, 225, ${0.55 + Math.min(0.45, v.amp / 10)})`;
      ctx.lineWidth = 3.2 - s * 0.42;
      if (v.amp > 0.5) {
        ctx.shadowColor = rgba(colors.glow, 0.9);
        ctx.shadowBlur = v.amp * 2;
      }
      ctx.beginPath();
      const steps = 48;
      for (let k = 0; k <= steps; k++) {
        const x = (k / steps) * W;
        const env = Math.sin((k / steps) * Math.PI);
        const off = v.amp * env * Math.sin(v.phase) * (k % 2 ? 1 : 0.96);
        k ? ctx.lineTo(x, y + off) : ctx.moveTo(x, y + off);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      // its key
      ctx.font = '600 15px Caveat, cursive';
      ctx.fillStyle = 'rgba(255,245,225,0.45)';
      ctx.fillText(KEYS[s].toUpperCase(), 8, y - 6);
    }

    // notes floating off the strings
    ctx.font = '22px Fraunces, Georgia, serif';
    ctx.textAlign = 'center';
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      n.age += dt;
      if (n.age > 1.6) { notes.splice(i, 1); continue; }
      const a = 1 - n.age / 1.6;
      ctx.fillStyle = rgba(n.s % 2 ? colors.glow : colors.accent, a);
      ctx.fillText(n.s % 3 ? '♪' : '♫', n.x + Math.sin(n.age * 5 + n.s) * 10, n.y - n.age * 60);
    }
    ctx.textAlign = 'start';
  }

  /* ---------- strumming with the pointer ---------- */
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    const y = e.clientY - r.top;
    const x = e.clientX - r.left;
    if (lastPointer && (e.buttons || e.pointerType !== 'mouse')) {
      const speed = Math.abs(y - lastPointer.y) / Math.max(1, e.timeStamp - lastPointer.t);
      for (let s = 0; s < 6; s++) {
        const sy = stringY(s);
        if ((lastPointer.y - sy) * (y - sy) < 0) pluck(s, { bright: Math.min(1, 0.3 + speed * 0.5), vol: 0.42 });
      }
    }
    lastPointer = { x, y, t: e.timeStamp };
  }

  function nearestString(y) {
    let best = -1;
    let bestD = 18;
    for (let s = 0; s < 6; s++) {
      const d = Math.abs(stringY(s) - y);
      if (d < bestD) { best = s; bestD = d; }
    }
    return best;
  }

  Void.dream.guitar = {
    init() {
      chordBox.append(...CHORDS.map(chordButton));
      setChord(0);

      const tuneBtn = $('#gtrTuning');
      tuneBtn.addEventListener('click', () => {
        const midwest = tuneBtn.getAttribute('aria-pressed') !== 'true';
        const playing = !!auto;
        stopAuto();
        T = midwest ? TUNINGS.midwest : TUNINGS.standard;
        OPEN = T.open;
        CHORDS = T.chords;
        SONG = T.song;
        tuneBtn.setAttribute('aria-pressed', String(midwest));
        chordBox.replaceChildren(...CHORDS.map(chordButton));
        setChord(0);
        Void.dream.sound.wake();
        // let the open strings ring out, so you hear the new tuning
        [0, 1, 2, 3, 4, 5].forEach((st, k) => pluck(st, { when: k * 0.09, bright: 0.6, vol: 0.34 }));
        if (playing) startAuto();
      });

      canvas.addEventListener('pointerdown', (e) => {
        Void.dream.sound.wake();
        canvas.setPointerCapture(e.pointerId);
        const r = canvas.getBoundingClientRect();
        const s = nearestString(e.clientY - r.top);
        if (s >= 0) pluck(s, { bright: 0.6 });
        lastPointer = { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp };
      });
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', () => { lastPointer = null; });
      canvas.addEventListener('pointerleave', () => { if (!canvas.hasPointerCapture?.(0)) lastPointer = null; });

      $('#gtrDown').addEventListener('click', () => { Void.dream.sound.wake(); strum('d'); });
      $('#gtrUp').addEventListener('click', () => { Void.dream.sound.wake(); strum('u'); });
      autoBtn.addEventListener('click', () => (auto ? stopAuto() : startAuto()));
      roomBtn.addEventListener('click', () => {
        const on = roomBtn.getAttribute('aria-pressed') !== 'true';
        roomBtn.setAttribute('aria-pressed', String(on));
        Void.dream.sound.setRoom(on ? 0.5 : 0.08);
      });

      document.addEventListener('keydown', (e) => {
        if (!open || e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, textarea') || Void.modal.isOpen()) return;
        const k = e.key.toLowerCase();
        if (/^[1-8]$/.test(k)) { setChord(Number(k) - 1); strum('d', { bright: 0.45 }); e.preventDefault(); e.stopPropagation(); }
        else if (KEYS.includes(k)) { Void.dream.sound.wake(); pluck(KEYS.indexOf(k), { bright: 0.55 }); e.preventDefault(); }
        else if (k === ' ') { Void.dream.sound.wake(); strum(e.shiftKey ? 'u' : 'd'); e.preventDefault(); }
      }, true);

      Void.on('view', ({ id }) => {
        open = id === 'guitar';
        if (open) requestAnimationFrame(resize);
        else stopAuto();
      });
      window.addEventListener('resize', () => { if (open) resize(); });
      Void.dream.onFrame(frame);
    }
  };
})();
