(() => {
  const out = {};
  const dockToggle = document.querySelector('.dock-toggle');
  if (dockToggle) {
    const r = dockToggle.getBoundingClientRect();
    out.dockToggle = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
    // text inside
    const label = dockToggle.querySelector('.dock-label');
    if (label) {
      const lr = label.getBoundingClientRect();
      out.label = { x: Math.round(lr.x), y: Math.round(lr.y), w: Math.round(lr.width), right: Math.round(lr.right), text: label.textContent.trim() };
    }
    const burger = dockToggle.querySelector('.burger');
    if (burger) {
      const br = burger.getBoundingClientRect();
      out.burger = { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height), right: Math.round(br.right) };
    }
  }
  // dock overall
  const dock = document.querySelector('.dock');
  if (dock) {
    const r = dock.getBoundingClientRect();
    out.dock = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom), vw: window.innerWidth, vh: window.innerHeight };
  }
  // portal cards: are titles cut?
  out.portals = [...document.querySelectorAll('.portal')].map((p) => {
    const pr = p.getBoundingClientRect();
    const nameEl = p.querySelector('.portal-name');
    const arrowEl = p.querySelector('.portal-arrow');
    return {
      parentW: Math.round(pr.width), parentRight: Math.round(pr.right),
      name: nameEl ? { text: nameEl.textContent, w: Math.round(nameEl.getBoundingClientRect().width), right: Math.round(nameEl.getBoundingClientRect().right) } : null,
      arrow: arrowEl ? { right: Math.round(arrowEl.getBoundingClientRect().right) } : null,
    };
  });
  return JSON.stringify(out, null, 1);
})()
