/* ==========================================================
   rain.js — rain on the window, made on the spot
   No sound files: soft filtered noise for the rain, slow swells,
   and the odd drop tapping the glass. Off until you turn it on.
   ========================================================== */
(() => {
  const Void = window.Void;
  let audio = null;
  let master = null;
  let on = false;
  let dripTimer = 0;

  function build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audio = new Ctx();

    // two seconds of pink-ish noise, looped
    const length = audio.sampleRate * 2;
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0; let b1 = 0; let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    }
    const noise = audio.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const high = audio.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 380;
    const low = audio.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 5200;

    // slow swells, like gusts
    const swell = audio.createGain();
    swell.gain.value = 0.85;
    const lfo = audio.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = audio.createGain();
    lfoDepth.gain.value = 0.18;
    lfo.connect(lfoDepth).connect(swell.gain);

    master = audio.createGain();
    master.gain.value = 0;

    noise.connect(high).connect(low).connect(swell).connect(master).connect(audio.destination);
    noise.start();
    lfo.start();
    return true;
  }

  // a single drop tapping the glass
  function drip() {
    if (!on || !audio) return;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500 + Math.random() * 1900, now);
    osc.frequency.exponentialRampToValueAtTime(700 + Math.random() * 400, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.015 + Math.random() * 0.035, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.14);
    dripTimer = setTimeout(drip, 120 + Math.random() * 900);
  }

  Void.dream.rain = {
    isOn: () => on,
    toggle() {
      if (!audio && !build()) return false;
      on = !on;
      const now = audio.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      if (on) {
        audio.resume();
        master.gain.linearRampToValueAtTime(0.5, now + 2.5);
        clearTimeout(dripTimer);
        drip();
      } else {
        master.gain.linearRampToValueAtTime(0, now + 1.2);
        clearTimeout(dripTimer);
        setTimeout(() => { if (!on) audio.suspend(); }, 1400);
      }
      Void.dream.life.setRain(on);
      return on;
    }
  };
})();
