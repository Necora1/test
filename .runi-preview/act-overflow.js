(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom) }; };
  const out = { vw: window.innerWidth, vh: window.innerHeight, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight };
  const issues = [];
  const check = (name, el) => {
    if (!el) return;
    const bb = r(el);
    const clipped = bb.x < 0 || bb.right > window.innerWidth || bb.y < 0 || bb.bottom > window.innerHeight;
    if (clipped) issues.push({ name, ...bb });
  };
  // major containers
  check('dock', document.querySelector('.dock'));
  check('topbar', document.querySelector('.topbar'));
  check('status', document.querySelector('.status-bar'));
  check('footer', document.querySelector('.footer'));
  check('hero-title', document.querySelector('.hero-title'));
  document.querySelectorAll('.nav-pill').forEach((p) => check('pill:' + p.textContent.trim(), p));
  document.querySelectorAll('.portal').forEach((p) => check('portal:' + (p.querySelector('.portal-name')?.textContent || '?'), p));
  check('dock-toggle', document.querySelector('.dock-toggle'));
  check('dock-panel', document.querySelector('.dock-panel'));
  out.issues = issues;
  out.horizontalOverflow = out.docW > window.innerWidth;
  return JSON.stringify(out, null, 1);
})()
