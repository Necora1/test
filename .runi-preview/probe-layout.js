(() => {
  const out = {};
  const inner = document.querySelector('.topbar-inner');
  out.viewport = window.innerWidth + 'x' + window.innerHeight;
  out.innerClient = inner.clientWidth + ' scroll=' + inner.scrollWidth;
  out.topbarScroll = document.querySelector('.topbar').scrollWidth;

  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return 'missing';
    const r = el.getBoundingClientRect();
    return `x=${Math.round(r.left)}..${Math.round(r.right)} w=${Math.round(r.width)}`;
  };
  out.brand = rect('.brand');
  out.searchbox = rect('.searchbox');
  out.topLinks = rect('.top-links');
  out.lastLink = rect('.top-links .top-link-btn');
  out.tip = rect('.tip');
  out.stage = rect('.stage');
  out.footer = rect('.footer');

  // anything sticking out past the viewport
  const over = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
      if (el.closest('.footer-marquee')) return; // the marquee is meant to be clipped
      over.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
  });
  out.overflowing = over.slice(0, 10);
  out.overflowCount = over.length;
  out.docScrollWidth = document.documentElement.scrollWidth;
  return JSON.stringify(out, null, 1);
})()
