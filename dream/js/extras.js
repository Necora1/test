/* ==========================================================
   extras.js — the stranger corners of the dream
   · lucid mode: the sky folds into a kaleidoscope (L, or the
     button in the corner, or type "lucid")
   · the title is an instrument: touch the letters
   · the real time where you are, and the real moon's phase
   · leave it alone for a while and the dream drifts off
   · keys: 1–9 rooms, R rain, M mute, ? all the keys
   · words: type "wish" or "void" anywhere (no l, r or m in them,
     so they never trip the one-letter keys)
   · toast(text): a little handwritten note at the bottom
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $, $$ } = Void;
  const html = document.documentElement;
  const ROOMS = ['about', 'gallery', 'interests', 'favoomfs', 'send', 'games', 'guitar', 'oracle', 'wishes'];

  const toastEl = $('#dreamToast');
  let toastTimer = 0;
  function toast(text, { ms = 3200, href = null, linkText = '' } = {}) {
    toastEl.replaceChildren(document.createTextNode(text));
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.className = 'hand-link';
      a.textContent = linkText;
      toastEl.append(' ', a);
    }
    toastEl.hidden = false;
    toastEl.classList.remove('is-in');
    void toastEl.offsetWidth;
    toastEl.classList.add('is-in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-in'), ms);
  }

  /* ---------- lucid ---------- */
  const lucidBtn = $('#lucidBtn');
  let lucid = false;
  function setLucid(on) {
    lucid = on;
    html.classList.toggle('is-lucid', on);
    Void.dream.sky.setLucid(on ? 1 : 0);
    lucidBtn.setAttribute('aria-pressed', String(on));
    if (on) {
      Void.dream.sound.wake();
      [0, 4, 7, 11, 14].forEach((n, i) => Void.dream.sound.chime(220 * Math.pow(2, n / 12), { when: i * 0.11, vol: 0.07, dur: 2.4 }));
      toast('you know you are dreaming now.');
    } else toast('the sky settles down.');
  }

  /* ---------- the title is an instrument ---------- */
  function playableTitle() {
    $$('.t-name span, .t-rest').forEach((el, i) => {
      el.classList.add('is-playable');
      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        ring(el, i);
      });
      el.addEventListener('pointerdown', () => ring(el, i));
    });
  }
  function ring(el, i) {
    Void.dream.sound.chime(Void.dream.sound.step([0, 2, 4, 4, 7][i] ?? i, 330), { vol: 0.08, dur: 1.8 });
    el.classList.remove('is-rung');
    void el.offsetWidth;
    el.classList.add('is-rung');
    const r = el.getBoundingClientRect();
    Void.dream.sky.ripple(r.left + r.width / 2, r.top + r.height / 2, 0.7);
  }

  /* ---------- the time, and the real moon ---------- */
  function moonPhase(date = new Date()) {
    const synodic = 29.530588853;
    const known = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
    const age = ((date.getTime() / 86400000 - known) % synodic + synodic) % synodic;
    const names = ['a new moon', 'a waxing crescent', 'the first quarter', 'a waxing gibbous', 'a full moon', 'a waning gibbous', 'the last quarter', 'a waning crescent'];
    return names[Math.floor((age / synodic) * 8 + 0.5) % 8];
  }
  function clock() {
    const el = $('#dreamClock');
    if (!el) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    const h = now.getHours();
    const mood = h < 5 ? 'you should be asleep' : h < 11 ? 'good morning, dreamer' : h < 17 ? 'a daydream, then' : h < 22 ? 'good evening' : 'late again';
    el.textContent = `${time} where you are · the real moon is ${moonPhase(now)} · ${mood}`;
  }

  /* ---------- drifting off ---------- */
  let idle = 0;
  let drifting = false;
  const DRIFT_AFTER = 60;
  function wakeUp() {
    idle = 0;
    if (drifting) {
      drifting = false;
      html.classList.remove('is-drifting');
    }
  }

  /* ---------- keys & words ---------- */
  let typed = '';
  const WORDS = {
    wish: () => { location.hash = 'wishes'; },
    void: collapse
  };

  // "void": everything falls into the middle of the sky and back out
  let collapsing = false;
  function collapse() {
    if (collapsing || Void.motion.reduced) return;
    if (Void.dream.views.current() !== 'home') Void.dream.views.home();
    collapsing = true;
    // each thing gets pulled towards the middle of the sky
    $$('.objects .obj, .scene-title, .tuned-home').forEach((el) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--vx', `${innerWidth / 2 - (r.left + r.width / 2)}px`);
      el.style.setProperty('--vy', `${innerHeight * 0.42 - (r.top + r.height / 2)}px`);
    });
    html.classList.add('is-voiding');
    Void.dream.sound.thud({ vol: 0.45 });
    Void.dream.sky.ripple(innerWidth / 2, innerHeight * 0.42, 2);
    setTimeout(() => {
      Void.dream.fx.burst(innerWidth / 2, innerHeight * 0.42, { count: 120, speed: 620, gravity: 120, life: 1.6 });
      Void.dream.sky.ripple(innerWidth / 2, innerHeight * 0.42, 2.4);
      [0, 4, 7, 12].forEach((n, i) => Void.dream.sound.chime(196 * Math.pow(2, n / 12), { when: i * 0.05, vol: 0.1, dur: 2.5 }));
    }, 1000);
    setTimeout(() => { html.classList.remove('is-voiding'); collapsing = false; }, 2100);
  }

  function onKey(e) {
    wakeUp();
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (Void.modal.isOpen()) return;
    const k = e.key;

    if (k.length === 1 && /[a-z]/i.test(k)) {
      typed = (typed + k.toLowerCase()).slice(-8);
      const hit = Object.keys(WORDS).find((w) => typed.endsWith(w));
      if (hit) { typed = ''; WORDS[hit](); return; }
    }

    const view = Void.dream.views.current();
    const inGame = view === 'games' || view === 'guitar';
    if (/^[1-9]$/.test(k) && !inGame) {
      location.hash = ROOMS[Number(k) - 1];
    } else if (k === '0' && !inGame) {
      Void.dream.views.home();
    } else if ((k === 'l' || k === 'L') && !inGame) {
      setLucid(!lucid);
    } else if ((k === 'r' || k === 'R') && !inGame) {
      $('#rainBtn').click();
    } else if ((k === 'm' || k === 'M') && !inGame) {
      const muted = Void.dream.sound.toggleMute();
      toast(muted ? 'the dream is quiet now (m to undo)' : 'sound is back');
    } else if (k === '?') {
      Void.modal.open('keysModal');
    }
  }

  Void.dream.toast = toast;
  Void.dream.extras = {
    init() {
      lucidBtn.addEventListener('click', () => setLucid(!lucid));
      $('#keysBtn')?.addEventListener('click', () => Void.modal.open('keysModal'));
      playableTitle();
      clock();
      setInterval(clock, 20000);

      document.addEventListener('keydown', onKey);
      ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'scroll'].forEach((t) => window.addEventListener(t, wakeUp, { passive: true, capture: true }));
      setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        idle += 5;
        const calm = Void.dream.views.current() === 'home' && !Void.modal.isOpen() && !Void.motion.reduced;
        if (!drifting && calm && idle >= DRIFT_AFTER) {
          drifting = true;
          $$('.objects .obj').forEach((el) => el.style.setProperty('--x-num', String((parseFloat(el.style.getPropertyValue('--x')) || 50) / 100)));
          html.classList.add('is-drifting');
        }
      }, 5000);

      Void.on('star:caught', (n) => {
        toast(n === 1 ? 'you caught a falling star. make a wish?' : `you caught a falling star (${n} so far). make a wish?`, { href: '#wishes', linkText: 'wish →', ms: 5200 });
      });
    }
  };
})();
