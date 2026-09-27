/* ==========================================================
   oracle.js — the dream reads cards
   A deck of 22 made-up cards. Shuffle, and three are dealt:
   what was, what is, what's coming. Each card is painted when
   it turns over (a little sea, a moon, its sign), in the
   colours of the song it belongs to, and the middle card
   offers its song.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $ } = Void;
  const songs = Void.favorites || [];

  const DECK = [
    ['0', 'the sleeper', '☾', 'you were resting longer than you knew. something kept watch while you did.'],
    ['I', 'the lantern', '✦', 'a small light carried carefully. it is enough to see the next step, not the whole road.'],
    ['II', 'the second moon', '◐', 'there is another way of looking at the same night. try it.'],
    ['III', 'the cassette', '♪', 'something you keep rewinding. it still has something to tell you.'],
    ['IV', 'the paper boat', '⛵', 'fragile, but it floats. send it out anyway.'],
    ['V', 'the jellyfish', '❋', 'move in soft pushes. no need to swim hard to get somewhere.'],
    ['VI', 'the unsent letter', '✉', 'words you wrote and kept. they are lighter once they leave.'],
    ['VII', 'the static', '▒', 'noise, for now. a signal is underneath it, tuning in.'],
    ['VIII', 'the polaroid', '▣', 'a moment developing slowly. give it time before you judge it.'],
    ['IX', 'the tide', '≋', 'what goes out comes back, changed a little by the trip.'],
    ['X', 'the staircase', '⌇', 'every step looks the same from inside. you are still climbing.'],
    ['XI', 'the moth', '⚘', 'drawn to warmth. choose which lights you circle.'],
    ['XII', 'the drowned bell', '◎', 'an old sound under the water. it rings when the sea is still.'],
    ['XIII', 'the rain', '☂', 'a washing, not a punishment. the window will be clearer after.'],
    ['XIV', 'the mirror sea', '◇', 'the sky looks up at itself. be as kind to your reflection.'],
    ['XV', 'the clock without hands', '◌', 'it is exactly the right time for this. there is no hurry.'],
    ['XVI', 'the ghost', '☁', 'someone is still near in the ways that count.'],
    ['XVII', 'the garden', '❀', 'things grow when no one is looking at them.'],
    ['XVIII', 'the signal', '⌁', 'someone out there is on the same frequency as you.'],
    ['XIX', 'the window', '▢', 'the view is there whether or not you look. look.'],
    ['XX', 'the void', '●', 'an empty space is also room. what would you put there?'],
    ['XXI', 'the morning', '☼', 'it comes, even after the longest dreams.']
  ];
  const PLACES = ['what was', 'what is', "what's coming"];

  const table = $('#oracleTable');
  const shuffleBtn = $('#oracleShuffle');
  const reading = $('#oracleReading');

  let busy = false;

  const songFor = (i) => songs[(i * 7 + 3) % songs.length];
  const hex = (h) => h || '#223';

  // the card's face: a tiny painting of the dream
  function paint(canvas, card, i) {
    const song = songFor(i);
    const pal = song?.palette || ['#0b1620', '#2c5560', '#f4ecd8', '#6fb3a8'];
    const w = 160;
    const h = 250;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const c = canvas.getContext('2d');
    c.scale(dpr, dpr);
    let seed = i * 97 + 13;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    const sky = c.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, hex(pal[0]));
    sky.addColorStop(1, hex(pal[1]));
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    // stars
    c.fillStyle = hex(pal[2]);
    for (let k = 0; k < 40; k++) {
      c.globalAlpha = 0.3 + rnd() * 0.7;
      c.fillRect(rnd() * w, rnd() * h * 0.6, 1.2, 1.2);
    }
    c.globalAlpha = 1;
    // the moon, with a glow
    const mx = 30 + rnd() * 100;
    const my = 30 + rnd() * 50;
    const glow = c.createRadialGradient(mx, my, 0, mx, my, 50);
    glow.addColorStop(0, `${hex(pal[2])}aa`);
    glow.addColorStop(1, `${hex(pal[2])}00`);
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    c.fillStyle = hex(pal[2]);
    c.beginPath();
    c.arc(mx, my, 12, 0, Math.PI * 2);
    c.fill();
    // the sea, in bands
    const sea = h * 0.62;
    for (let k = 0; k < 9; k++) {
      c.fillStyle = k % 2 ? hex(pal[0]) : hex(pal[1]);
      c.globalAlpha = 0.9;
      c.fillRect(0, sea + k * ((h - sea) / 9), w, (h - sea) / 9 + 1);
    }
    c.globalAlpha = 0.8;
    c.fillStyle = hex(pal[2]);
    for (let k = 0; k < 14; k++) {
      const yy = sea + 4 + rnd() * (h - sea - 8);
      const ww = 4 + rnd() * 14;
      c.fillRect(mx - ww / 2 + (rnd() - 0.5) * 20, yy, ww, 1.2);
    }
    c.globalAlpha = 1;
    // its sign, big, in the middle
    c.font = '64px "Fraunces", Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = hex(pal[3]);
    c.shadowBlur = 18;
    c.fillStyle = hex(pal[2]);
    c.fillText(card[2], w / 2, h * 0.46);
    c.shadowBlur = 0;
  }

  function cardEl(place, idx) {
    const card = DECK[idx];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tarot';
    el.dataset.place = String(place);
    el.setAttribute('aria-label', `${PLACES[place]}: turn the card over`);
    el.innerHTML = `
      <span class="tarot-inner">
        <span class="tarot-back" aria-hidden="true"><i></i></span>
        <span class="tarot-face">
          <canvas></canvas>
          <span class="tarot-num">${card[0]}</span>
          <span class="tarot-name">${card[1]}</span>
        </span>
      </span>
      <span class="tarot-place">${PLACES[place]}</span>`;
    paint(el.querySelector('canvas'), card, idx);
    el.addEventListener('click', () => turn(el, place, idx), { once: true });
    return el;
  }

  function turn(el, place, idx) {
    if (el.classList.contains('is-turned')) return;
    el.classList.add('is-turned');
    el.setAttribute('aria-label', `${PLACES[place]}: ${DECK[idx][1]}`);
    const r = el.getBoundingClientRect();
    Void.dream.fx.burst(r.left + r.width / 2, r.top + r.height * 0.4, { count: 22, speed: 200, gravity: 80 });
    Void.dream.sound.chime(Void.dream.sound.step([2, 4, 7][place], 330), { vol: 0.12, dur: 2.2 });

    const card = DECK[idx];
    const line = document.createElement('div');
    line.className = 'reading-line';
    line.style.setProperty('--i', String(place));
    const head = document.createElement('p');
    head.className = 'reading-head';
    head.textContent = `${PLACES[place]} · ${card[1]}`;
    const text = document.createElement('p');
    text.className = 'reading-text';
    text.textContent = card[3];
    line.append(head, text);
    if (place === 1) {
      const song = songFor(idx);
      if (song) {
        const play = document.createElement('button');
        play.type = 'button';
        play.className = 'tuned';
        play.innerHTML = '<span class="tuned-lead">it sounds like</span> <span class="tuned-song"></span> <span class="tuned-play" aria-hidden="true">&#9656;</span>';
        play.querySelector('.tuned-song').textContent = `${song.title} — ${song.artist}`;
        play.addEventListener('click', () => Void.dream.tapes.play(songs.indexOf(song)));
        line.append(play);
      }
    }
    const slots = [...reading.children];
    const before = slots.find((s) => Number(s.dataset.place) > place);
    line.dataset.place = String(place);
    reading.insertBefore(line, before || null);
  }

  async function deal() {
    if (busy) return;
    busy = true;
    shuffleBtn.disabled = true;
    Void.dream.sound.wake();
    reading.replaceChildren();
    table.replaceChildren();
    table.classList.remove('is-dealt');

    // the deck, riffled
    const pile = document.createElement('div');
    pile.className = 'tarot-pile';
    for (let i = 0; i < 12; i++) {
      const b = document.createElement('span');
      b.className = 'tarot-back pile-card';
      b.style.setProperty('--i', String(i));
      b.style.setProperty('--sx', `${(Math.random() - 0.5) * 260}px`);
      b.style.setProperty('--sy', `${(Math.random() - 0.5) * 60}px`);
      b.style.setProperty('--sr', `${(Math.random() - 0.5) * 50}deg`);
      b.innerHTML = '<i></i>';
      pile.append(b);
    }
    table.append(pile);
    if (!Void.motion.reduced) {
      for (let k = 0; k < 5; k++) Void.dream.sound.chime(180 + Math.random() * 60, { vol: 0.03, dur: 0.15, wet: 0.2, when: k * 0.12, type: 'triangle' });
      await Void.wait(1300);
    }
    pile.remove();

    const picks = [];
    while (picks.length < 3) {
      const n = Math.floor(Math.random() * DECK.length);
      if (!picks.includes(n)) picks.push(n);
    }
    const row = document.createElement('div');
    row.className = 'tarot-row';
    picks.forEach((idx, place) => {
      const el = cardEl(place, idx);
      el.style.setProperty('--i', String(place));
      row.append(el);
    });
    table.append(row);
    table.classList.add('is-dealt');
    row.querySelector('.tarot')?.focus({ preventScroll: true });
    shuffleBtn.querySelector('.btn-label').textContent = 'shuffle again';
    shuffleBtn.disabled = false;
    busy = false;
  }

  Void.dream.oracle = {
    init() {
      shuffleBtn.addEventListener('click', deal);
    }
  };
})();
