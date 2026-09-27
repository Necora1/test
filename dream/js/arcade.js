/* ==========================================================
   arcade.js — the games room
   Games register themselves (js/games/*.js) and get mounted
   into one little screen when their cartridge is picked:

   Void.dream.arcade.register({
     id, name, how,                       // how = one line of rules
     mount(api) → { destroy() }           // api below
   })
   api.stage           the element to draw the game into
   api.score(text)     what the score line says
   api.best()          the saved best (or null)
   api.record(v, dir)  save v if it beats the best ('high' | 'low')
   api.active()        true while the games room is open
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $ } = Void;
  const KEY = 'dream_best';

  const games = [];
  const carts = $('#carts');
  const stage = $('#arcadeStage');
  const scoreEl = $('#arcadeScore');
  const bestEl = $('#arcadeBest');
  const howEl = $('#arcadeHow');

  let current = null;
  let running = null;
  let open = false;
  const bests = Void.store.get(KEY, {}) || {};

  const bestText = (g) => (bests[g.id] == null ? '' : `best: ${bests[g.id]}${g.unit ? ` ${g.unit}` : ''}`);

  function paintCarts() {
    [...carts.children].forEach((b) => {
      const g = games.find((x) => x.id === b.dataset.game);
      b.setAttribute('aria-selected', String(g === current));
      b.tabIndex = g === current ? 0 : -1;
      b.querySelector('.cart-best').textContent = bestText(g);
    });
    bestEl.textContent = current ? bestText(current) : '';
  }

  function pick(id) {
    const g = games.find((x) => x.id === id) || games[0];
    if (running) { running.destroy?.(); running = null; }
    current = g;
    stage.replaceChildren();
    stage.dataset.game = g.id;
    scoreEl.textContent = '';
    howEl.textContent = g.how;
    paintCarts();
    Void.store.set('dream_game', g.id);
    running = g.mount({
      stage,
      score: (text) => { scoreEl.textContent = text; },
      best: () => (bests[g.id] ?? null),
      record(value, dir = 'high') {
        const old = bests[g.id];
        const better = old == null || (dir === 'high' ? value > old : value < old);
        if (better) {
          bests[g.id] = value;
          Void.store.set(KEY, bests);
          paintCarts();
        }
        return better;
      },
      active: () => open
    });
  }

  function cart(g) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `cart cart-${g.id}`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'arcadeScreen');
    b.dataset.game = g.id;
    b.innerHTML = `<span class="cart-label"><span class="cart-art" aria-hidden="true"></span><span class="cart-name"></span></span><span class="cart-best"></span>`;
    b.querySelector('.cart-name').textContent = g.name;
    b.addEventListener('click', () => { if (current !== g) pick(g.id); });
    return b;
  }

  Void.dream.arcade = {
    register(game) { games.push(game); },
    init() {
      carts.append(...games.map(cart));
      carts.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = games.indexOf(current) + (e.key === 'ArrowRight' ? 1 : -1);
        const g = games[(i + games.length) % games.length];
        pick(g.id);
        carts.querySelector(`[data-game="${g.id}"]`).focus();
        e.preventDefault();
      });
      Void.on('view', ({ id }) => {
        open = id === 'games';
        if (open && !current) pick(Void.store.get('dream_game', games[0]?.id));
        Void.emit('arcade:visible', open);
      });
    }
  };
})();
