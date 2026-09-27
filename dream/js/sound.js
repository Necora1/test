/* ==========================================================
   sound.js — the dream's little synth (everything but the rain)
   · chime(freq)   a soft bell, for games and the title letters
   · pluck(freq)   a plucked string (Karplus–Strong), for the guitar
   · thud()        something falling into the sea
   All of it goes through one big soft room (a reverb made from
   decaying noise). Nothing is loaded: every sound is computed.
   M mutes it (remembered).
   ========================================================== */
(() => {
  const Void = window.Void;
  const MUTE_KEY = 'dream_muted';

  let ctx = null;
  let master = null;
  let room = null;
  let roomLevel = null;
  let muted = !!Void.store.get(MUTE_KEY, false);
  const strings = new Map();

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.85;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 8;
      master.connect(limiter);
      limiter.connect(ctx.destination);

      // the room: stereo noise that dies away over three seconds
      room = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 3.2);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
      }
      room.buffer = ir;
      roomLevel = ctx.createGain();
      roomLevel.gain.value = 0.5;
      room.connect(roomLevel);
      roomLevel.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function out(node, wet) {
    node.connect(master);
    if (wet > 0) {
      const send = ctx.createGain();
      send.gain.value = wet;
      node.connect(send);
      send.connect(room);
    }
  }

  // a pentatonic ladder, so any run of notes sounds like something
  const PENTA = [0, 2, 4, 7, 9];
  const step = (n, base = 392) => {
    const oct = Math.floor(n / 5);
    return base * Math.pow(2, (PENTA[((n % 5) + 5) % 5] + 12 * oct) / 12);
  };

  function chime(freq, { vol = 0.16, dur = 1.4, wet = 0.6, when = 0, type = 'sine' } = {}) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime + when;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[1, 1], [2.01, 0.28], [3.98, 0.08]].forEach(([mult, level]) => {
      const o = c.createOscillator();
      o.type = mult === 1 ? type : 'sine';
      o.frequency.value = freq * mult;
      const g = c.createGain();
      g.gain.value = level;
      o.connect(g);
      g.connect(env);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
    out(env, wet);
  }

  function thud({ vol = 0.35 } = {}) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.45);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.65);
    out(g, 0.3);
  }

  // Karplus–Strong: a burst of noise going round a short delay line,
  // averaged a little each time, which is what a string does
  function stringBuffer(freq, bright) {
    const key = `${freq.toFixed(1)}|${bright > 0.5 ? 1 : 0}|${Math.floor(Math.random() * 2)}`;
    if (strings.has(key)) return strings.get(key);
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 3.4);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq - 0.5));
    let lp = 0;
    const soften = bright > 0.5 ? 0.85 : 0.45;
    for (let i = 0; i < N; i++) {
      lp += ((Math.random() * 2 - 1) - lp) * soften;
      d[i] = lp;
    }
    // every string rings about as long, whatever its pitch (~30% left after a second)
    const decay = Math.pow(0.3, 1 / freq);
    for (let i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + d[Math.max(0, i - N - 1)]);
    // and the very end fades out instead of stopping with a click
    const tail = Math.floor(sr * 0.3);
    for (let i = 0; i < tail; i++) d[len - 1 - i] *= i / tail;
    strings.set(key, buf);
    return buf;
  }

  function pluck(freq, { vol = 0.5, bright = 0.5, when = 0, pan = 0 } = {}) {
    const c = ensure();
    if (!c || muted) return;
    const src = c.createBufferSource();
    src.buffer = stringBuffer(freq, bright);
    const body = c.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 1800 + bright * 3200;
    body.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(body);
    body.connect(g);
    let last = g;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      last = p;
    }
    out(last, 0.8);
    src.start(c.currentTime + when);
  }

  Void.dream.sound = {
    step,
    chime,
    thud,
    pluck,
    wake: ensure,
    // how big the room sounds (0 dry … 1 cathedral)
    setRoom(v) { if (ensure()) roomLevel.gain.value = v; },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      Void.store.set(MUTE_KEY, muted);
      if (master) master.gain.value = muted ? 0 : 0.85;
      return muted;
    }
  };
})();
