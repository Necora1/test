/* ==========================================================
   wishes.js — the wish jar
   Write a wish and let it go: it folds into a star and flies up
   into the sky, where it stays (on the home sky, and drawn as a
   constellation in the room). Wishes only live in this browser.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $ } = Void;
  const KEY = 'dream_wishes';
  const MAX = 40;

  const form = $('#wishForm');
  const input = $('#wishText');
  const map = $('#constellation');
  const empty = $('#wishEmpty');
  const said = $('#wishSaid');
  const clear = $('#wishClear');
  const count = $('#wishCount');

  let wishes = (Void.store.get(KEY, []) || []).filter((w) => w && typeof w.text === 'string');

  const save = () => Void.store.set(KEY, wishes);

  // somewhere in the upper sky, not too close to the others
  function spot() {
    let best = null;
    let bestD = -1;
    for (let i = 0; i < 24; i++) {
      const c = { x: 0.07 + Math.random() * 0.86, y: 0.07 + Math.random() * 0.26 };
      // keep clear of the title and the moon
      if (c.x > 0.34 && c.x < 0.66 && c.y > 0.28) continue;
      const d = wishes.reduce((m, w) => Math.min(m, Math.hypot((w.x - c.x) * 1.6, w.y - c.y)), 9);
      if (d > bestD) { best = c; bestD = d; }
    }
    return best;
  }

  const SVG = 'http://www.w3.org/2000/svg';
  function render() {
    map.querySelectorAll('.wish-line, .wish-star').forEach((n) => n.remove());
    empty.hidden = wishes.length > 0;
    clear.hidden = wishes.length === 0;
    count.textContent = wishes.length ? `${wishes.length} ${wishes.length === 1 ? 'wish' : 'wishes'} in the sky` : '';
    const pt = (w) => [w.x * 1000, (w.y / 0.36) * 360];
    if (wishes.length > 1) {
      const line = document.createElementNS(SVG, 'polyline');
      line.setAttribute('class', 'wish-line');
      line.setAttribute('points', wishes.map((w) => pt(w).join(',')).join(' '));
      map.append(line);
    }
    wishes.forEach((w, i) => {
      const [x, y] = pt(w);
      const g = document.createElementNS(SVG, 'g');
      g.setAttribute('class', 'wish-star');
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `Wish ${i + 1}: ${w.text}`);
      g.style.setProperty('--d', `${(i % 7) * -0.7}s`);
      g.innerHTML = `<circle class="wish-halo" cx="${x}" cy="${y}" r="16"></circle>
        <path class="wish-core" d="M${x} ${y - 8} L${x + 2.2} ${y - 2.2} L${x + 8} ${y} L${x + 2.2} ${y + 2.2} L${x} ${y + 8} L${x - 2.2} ${y + 2.2} L${x - 8} ${y} L${x - 2.2} ${y - 2.2}Z"></path>`;
      const tell = () => { said.textContent = `“${w.text}”`; said.classList.remove('is-new'); void said.offsetWidth; said.classList.add('is-new'); };
      g.addEventListener('pointerenter', tell);
      g.addEventListener('focus', tell);
      g.addEventListener('click', tell);
      map.append(g);
    });
  }

  function release(text) {
    const place = spot();
    const wish = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, x: place.x, y: place.y, at: Date.now() };
    const r = input.getBoundingClientRect();
    const m = map.getBoundingClientRect();
    const tx = m.left + place.x * m.width;
    const ty = m.top + (place.y / 0.36) * m.height;

    // the words fold up into a spark…
    const words = document.createElement('span');
    words.className = 'wish-words';
    words.textContent = text;
    words.style.left = `${r.left + 12}px`;
    words.style.top = `${r.top + r.height / 2}px`;
    document.body.append(words);
    const after = () => {
      words.remove();
      // …and the spark flies up to its place
      Void.dream.fx.fly(r.left + r.width / 2, r.top + r.height / 2, tx, ty, {
        duration: 1.2,
        onDone: () => {
          wishes.push(wish);
          if (wishes.length > MAX) wishes = wishes.slice(-MAX);
          save();
          render();
          said.textContent = `“${text}”`;
          [0, 2, 4, 7, 9].forEach((n, i) => Void.dream.sound.chime(Void.dream.sound.step(n + 3), { when: i * 0.09, vol: 0.09 }));
        }
      });
    };
    if (Void.motion.reduced) after();
    else words.addEventListener('animationend', after, { once: true });
  }

  Void.dream.wishes = {
    list: () => wishes,
    init() {
      render();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.replace(/\s+/g, ' ').trim();
        if (!text) { input.focus(); return; }
        Void.dream.sound.wake();
        release(text.slice(0, 90));
        input.value = '';
      });
      clear.addEventListener('click', () => {
        if (!confirm('Let all your wishes go? They disappear from the sky.')) return;
        wishes = [];
        save();
        render();
        said.textContent = '';
      });
    }
  };
})();
