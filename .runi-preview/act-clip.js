(() => {
  const out = {};
  // dock area at bottom
  const dock = document.querySelector('.dock');
  if (dock) {
    const r = dock.getBoundingClientRect();
    out.dockRect = `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    out.dockRight = Math.round(r.right);
    out.dockBottom = Math.round(r.bottom);
    out.vw = window.innerWidth;
    out.vh = window.innerHeight;
    out.dockOverflowsRight = r.right > window.innerWidth + 1;
    out.dockOverflowsBottom = r.bottom > window.innerHeight + 1;
  }
  // check each nav pill for clipping
  out.pills = [...document.querySelectorAll('.nav-pill')].map(p => {
    const r = p.getBoundingClientRect();
    return { text: p.textContent.trim().slice(0, 20), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width) };
  });
  // topbar
  const tb = document.querySelector('.topbar');
  if (tb) {
    const r = tb.getBoundingClientRect();
    out.topbar = `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} right=${Math.round(r.right)}`;
  }
  // status line
  const st = document.querySelector('.topbar-status');
  if (st) {
    const r = st.getBoundingClientRect();
    out.statusRect = `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    out.statusOverflows = r.right > window.innerWidth + 1;
    // which text nodes are cut
    out.statusText = st.textContent.trim();
  }
  // footer
  const foot = document.querySelector('.footer');
  if (foot) {
    const r = foot.getBoundingClientRect();
    out.footer = `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    out.footerRight = Math.round(r.right);
    out.footerOverflows = r.right > window.innerWidth + 1;
  }
  // hero title
  const ht = document.querySelector('.hero-title, .page-title');
  if (ht) {
    const r = ht.getBoundingClientRect();
    out.titleRect = `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    out.titleOverflows = r.width > window.innerWidth;
    out.titleText = ht.textContent.trim();
  }
  // body scrollWidth
  out.scrollWidth = document.documentElement.scrollWidth;
  out.vw = window.innerWidth;
  return JSON.stringify(out, null, 1);
})()
