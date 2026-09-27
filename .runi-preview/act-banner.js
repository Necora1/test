(() => {
  const out = {};
  const bar = document.querySelector('.topbar');
  const tip = document.querySelector('#tipBar');
  const hero = document.querySelector('#homeTitle');
  const cs = getComputedStyle(document.documentElement);
  out.topbarHVar = cs.getPropertyValue('--topbar-h').trim();
  out.topbarHeight = Math.round(bar.getBoundingClientRect().height);
  out.barBottom = Math.round(bar.getBoundingClientRect().bottom);
  out.tipTop = Math.round(tip.getBoundingClientRect().top);
  out.heroTop = Math.round(hero.getBoundingClientRect().top);
  out.tipClearsBar = tip.getBoundingClientRect().top >= bar.getBoundingClientRect().bottom - 1;
  out.tipOverlapsBar = (() => {
    const a = tip.getBoundingClientRect(), b = bar.getBoundingClientRect();
    return a.top < b.bottom && a.bottom > b.top;
  })();
  out.viewport = window.innerWidth + 'x' + window.innerHeight;
  out.overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  return JSON.stringify(out, null, 1);
})()
