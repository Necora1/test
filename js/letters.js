/* ==========================================================
   letters.js — what happens when you send something
   messages.js and drawing.js (shared with the classic version)
   call Void.warp.start('send') once a letter or drawing is on
   its way. In the dream that's an envelope folding itself up
   and flying off into the sky, leaving a trail of little stars.
   ========================================================== */
(() => {
  const Void = window.Void;
  let active = false;

  function sparkle(x, y) {
    const s = document.createElement('i');
    s.className = 'trail-star';
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 30}px`);
    document.body.append(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
  }

  Void.warp = {
    init() {},
    hurry() {},
    isActive: () => active,
    start() {
      if (Void.motion.reduced || active) return Promise.resolve();
      active = true;
      return new Promise((resolve) => {
        const panel = document.querySelector('#view-send .send-panel:not([hidden])') || document.querySelector('#view-send');
        const r = panel.getBoundingClientRect();
        const x0 = r.left + r.width / 2;
        const y0 = Math.min(r.top + r.height / 2, innerHeight * 0.55);
        const x1 = innerWidth * (0.72 + Math.random() * 0.2);
        const y1 = -140;

        const env = document.createElement('div');
        env.className = 'flying-letter';
        env.innerHTML = '<i class="fl-flap"></i><i class="fl-seal">r</i>';
        env.style.left = `${x0}px`;
        env.style.top = `${y0}px`;
        document.body.append(env);
        Void.dream.sky.ripple(x0, y0, 1.4);

        const dx = x1 - x0;
        const dy = y1 - y0;
        const flight = env.animate([
          { transform: 'translate(-50%, -50%) scale(0.15) rotate(0deg)', opacity: 0 },
          { transform: 'translate(-50%, -50%) scale(1.05) rotate(-3deg)', opacity: 1, offset: 0.16 },
          { transform: 'translate(-50%, -50%) scale(1) rotate(-4deg)', opacity: 1, offset: 0.3 },
          { transform: `translate(calc(-50% + ${dx * 0.3}px), calc(-50% + ${dy * 0.12 - 70}px)) scale(0.85) rotate(-16deg)`, opacity: 1, offset: 0.58 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.22) rotate(-34deg)`, opacity: 0 }
        ], { duration: 2300, easing: 'cubic-bezier(0.45, 0, 0.3, 1)', fill: 'forwards' });

        const trail = setInterval(() => {
          const b = env.getBoundingClientRect();
          if (b.width) sparkle(b.left + b.width / 2, b.top + b.height / 2);
        }, 70);

        flight.finished.catch(() => {}).then(() => {
          clearInterval(trail);
          env.remove();
          active = false;
          resolve();
        });
      });
    }
  };
})();
