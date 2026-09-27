(() => {
  const out = {};
  out.page = document.body.dataset.page;
  out.title = document.querySelector('.page:not([hidden]) .page-title, .page:not([hidden]) .hero-title')?.textContent.trim();
  out.bannerH = document.querySelector('.topbar').getBoundingClientRect().height;
  out.tipTextTop = Math.round(document.querySelector('#tipBar').getBoundingClientRect().top + parseFloat(getComputedStyle(document.querySelector('#tipBar')).paddingTop));
  out.clearsBanner = out.tipTextTop >= out.bannerH;
  out.barBottom = Math.round(document.querySelector('.topbar').getBoundingClientRect().bottom);
  out.tipOverlaps = (() => {
    const t = document.querySelector('#tipBar'), b = document.querySelector('.topbar');
    const tr = t.getBoundingClientRect(), br = b.getBoundingClientRect();
    const contentTop = tr.top + parseFloat(getComputedStyle(t).paddingTop);
    return contentTop < br.bottom;
  })();
  out.canvas = !!document.querySelector('#sky');
  out.stars = (() => { const c = document.querySelector('#sky'); return c ? c.width + 'x' + c.height : 'missing'; })();
  out.dockOpacity = getComputedStyle(document.querySelector('.dock-toggle')).opacity;
  out.fonts = { jacquard: document.fonts.check('16px Jacquard'), silkscreen: document.fonts.check('16px Silkscreen') };
  out.overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  out.viewport = window.innerWidth + 'x' + window.innerHeight;
  return JSON.stringify(out, null, 1);
})()
