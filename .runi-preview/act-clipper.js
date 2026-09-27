(() => {
  const out = { vw: window.innerWidth, vh: window.innerHeight, checks: {} };
  // walk every element, find those whose box spills past a parent's padding box
  const spill = [];
  document.querySelectorAll('body *').forEach((el) => {
    const pr = el.parentElement ? el.parentElement.getBoundingClientRect() : null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (!pr) return;
    const overflowsParent = r.right > pr.right + 0.5 || r.left < pr.left - 0.5 || r.bottom > pr.bottom + 0.5 || r.top < pr.top - 0.5;
    if (overflowsParent) {
      const cs = getComputedStyle(el);
      if (cs.overflow === 'hidden' || cs.overflow === 'clip' || cs.overflowX === 'hidden') {
        // this element is a clipper — report children that it clips
        const clipped = [];
        el.querySelectorAll('*').forEach((child) => {
          const cr = child.getBoundingClientRect();
          if (cr.right > pr.right + 0.5 || cr.left < pr.left - 0.5) {
            clipped.push(`${child.tagName}.${String(child.className).split(' ')[0]} R${Math.round(cr.right)} vs P${Math.round(pr.right)}`);
          }
        });
        if (clipped.length) spill.push(`${el.tagName}.${String(el.className).split(' ')[0]} clips: ${clipped.slice(0, 4).join(' | ')}`);
      }
    }
  });
  out.spill = spill.slice(0, 20);

  // specific checks
  const portalArrows = [...document.querySelectorAll('.portal-arrow')].map(a => {
    const r = a.getBoundingClientRect();
    const p = a.closest('.portal').getBoundingClientRect();
    return { cut: r.right > p.right, right: Math.round(r.right), parentRight: Math.round(p.right), text: a.closest('.portal').querySelector('.portal-name')?.textContent };
  });
  out.arrows = portalArrows;

  // dock toggle and menu
  const dock = document.querySelector('.dock-toggle');
  if (dock) {
    const r = dock.getBoundingClientRect();
    out.dockToggle = { right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) };
  }
  // footer text width vs container
  const footInner = document.querySelector('.footer-inner');
  if (footInner) {
    const r = footInner.getBoundingClientRect();
    const txt = footInner.querySelector('.footer-note');
    if (txt) {
      const tr = txt.getBoundingClientRect();
      out.footer = { innerW: Math.round(r.width), textW: Math.round(tr.width), textRight: Math.round(tr.right), containerRight: Math.round(r.right) };
    }
    const marquee = footInner.querySelector('.footer-marquee');
    if (marquee) {
      const mr = marquee.getBoundingClientRect();
      out.marquee = { w: Math.round(mr.width), right: Math.round(mr.right), overflow: mr.width > r.width };
    }
  }
  // top-links (About/Gallery/LogIn in banner)
  const tl = document.querySelector('.top-links');
  if (tl) {
    const r = tl.getBoundingClientRect();
    out.toplinks = { right: Math.round(r.right), width: Math.round(r.width), parentRight: Math.round(tl.parentElement.getBoundingClientRect().right) };
  }
  return JSON.stringify(out, null, 1);
})()
