/* ==========================================================
   zero.js — the world, being zeroed
   Outside renn's door everything is already 0. The room is the
   last thing with data left in it, and while you stay it loses
   that too, one bit at a time, lowest first: the colours get
   coarser, then whole blocks of the picture go to 0, then the
   words start turning into zeros. The corner shows the bits that
   are left: 11111111 … 00000000.

   When the last bit goes you're back outside, in the zeros.
   Knocking again (or typing "again") restores it from the tape.

   ?bits=3        hold the room at 3 bits left (for looking at it)
   ?zero=fast     a bit every 4 seconds instead of every minute
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $ } = Void;
  const html = document.documentElement;

  const params = new URLSearchParams(location.search);
  const fixed = params.has('bits') ? 8 - Math.max(0, Math.min(8, Number(params.get('bits')) || 0)) : null;
  const fast = params.get('zero') === 'fast';
  const GRACE = fast ? 2 : 45;       // seconds before the first bit goes
  const PER_BIT = fast ? 4 : 60;     // seconds for each bit after that

  let inside = 0;                    // seconds spent inside since the last restore
  let lost = 0;                      // bits zeroed, fractional
  let last = performance.now();
  let restoring = null;              // { from, t0 } while the bits come back
  let ended = false;
  const readout = $('#bitsLeft');

  /* ---------- the words, rotting ---------- */
  const originals = new Map();       // text node → what it said
  const ROT_SEL = '.view:not([hidden]) h1, .view:not([hidden]) h2, .view:not([hidden]) p, .view:not([hidden]) li, .memory-caption, .scene-hint, .hot-label, .travel-caption, .tuned-home, .view:not([hidden]) .tuned';
  function rot(count) {
    const nodes = [];
    document.querySelectorAll(ROT_SEL).forEach((el) => {
      if (el.closest('input, textarea, [contenteditable]') || !el.getClientRects().length) return;
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (/[a-z]/i.test(n.nodeValue)) nodes.push(n);
    });
    for (let i = 0; i < count && nodes.length; i++) {
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      const text = n.nodeValue;
      const spots = [];
      for (let k = 0; k < text.length; k++) if (/[a-z]/i.test(text[k])) spots.push(k);
      if (!spots.length) continue;
      if (!originals.has(n)) originals.set(n, text);
      const k = spots[Math.floor(Math.random() * spots.length)];
      n.nodeValue = text.slice(0, k) + (Math.random() < 0.8 ? '0' : '1') + text.slice(k + 1);
    }
  }
  function unrot() {
    originals.forEach((text, n) => { n.nodeValue = text; });
    originals.clear();
  }

  /* ---------- the readout ---------- */
  let shown = -1;
  function show(bitsLeft) {
    if (!readout || bitsLeft === shown) return;
    shown = bitsLeft;
    readout.textContent = '1'.repeat(bitsLeft) + '0'.repeat(8 - bitsLeft);
    readout.classList.remove('is-flipping');
    void readout.offsetWidth;
    readout.classList.add('is-flipping');
    html.dataset.bits = String(bitsLeft);
  }

  /* ---------- every frame ---------- */
  let rotClock = 0;
  function frame(_clock, _dt, now = performance.now()) {
    const dt = Math.min(0.5, (now - last) / 1000);
    last = now;
    const door = Void.dream.door;
    const here = door?.inside && !document.hidden;
    if (restoring) {
      const k = Math.min(1, (now - restoring.t0) / 1400);
      lost = restoring.from * Math.pow(1 - k, 2);
      if (k >= 1) restoring = null;
    } else if (fixed !== null) {
      lost = fixed;
    } else if (here && !ended) {
      inside += dt;
      lost = Math.max(0, Math.min(8, (inside - GRACE) / PER_BIT));
      // never mid-sentence: someone writing keeps the last bit alive
      const typing = document.activeElement?.matches?.('input, textarea, [contenteditable]');
      if (typing || Void.dream.views.current() === 'send') lost = Math.min(lost, 7.9);
    }
    Void.dream.memory.setDecay(lost);
    show(8 - Math.min(8, Math.floor(lost + 1e-6)));

    // the words go once the picture is well on its way
    if (here && lost >= 4.5 && fixed === null) {
      rotClock += dt;
      const every = 4 - (lost - 4.5);     // faster as it goes
      if (rotClock > every) { rotClock = 0; rot(1 + Math.floor(lost - 4.5)); }
    }
    // the last bit: the room is gone, you're outside in the zeros
    if (lost >= 8 && !ended && fixed === null && here) {
      ended = true;
      setTimeout(() => door.leave({ zeroed: true }), 1800);
    }
  }

  function restore() {
    restoring = { from: lost, t0: performance.now() };
    inside = 0;
    ended = false;
    unrot();
  }

  Void.dream.zero = {
    restore,
    get lost() { return lost; },
    init() {
      show(8);
      Void.dream.onFrame(frame);
      Void.on('door:again', restore);
    }
  };
})();
