(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  document.getElementById('dockToggle').click();
  await sleep(1400);
  const dock = document.getElementById('dock');
  const panel = document.getElementById('dockPanel');
  const cs = getComputedStyle(panel);
  const r = panel.getBoundingClientRect();
  out.dockState = dock.dataset.state;
  out.panelOpacity = cs.opacity;
  out.panelVisibility = cs.visibility;
  out.panelRect = `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
  out.panelFullyInView = r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.left >= 0 && r.right <= window.innerWidth + 1;
  out.viewport = `${window.innerWidth}x${window.innerHeight}`;
  out.pills = [...document.querySelectorAll('.nav-pill')].map((p) => p.textContent.trim());
  out.current = [...document.querySelectorAll('.nav-pill[aria-current="page"]')].map((p) => p.textContent.trim());
  out.ctaIsGold = (() => {
    const cta = document.querySelector('.nav-pill.is-cta');
    return cta ? getComputedStyle(cta).backgroundImage.includes('gradient') : 'missing';
  })();
  out.utilButtons = [...document.querySelectorAll('.util-btn')].map((b) => b.textContent.trim());
  return JSON.stringify(out, null, 1);
})()
