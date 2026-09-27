(() => {
  const out = {};
  const dl = document.querySelector('.dock-label');
  const mq = document.querySelector('.footer-marquee span');
  const wg = document.querySelector('.warp-glow');
  out.dockLabelOpacity = dl ? getComputedStyle(dl).opacity : 'n-a';
  out.dockLabelVisible = dl ? dl.getClientRects().length > 0 && getComputedStyle(dl).opacity !== '0' : 'n-a';
  out.dockState = document.querySelector('.dock')?.dataset.state;
  out.marqueeClippedOnPurpose = getComputedStyle(document.querySelector('.footer-marquee')).overflow;
  out.marqueeAnim = getComputedStyle(mq).animationName;
  out.warpIsIntroOnly = !!wg && getComputedStyle(wg).position;
  out.warpOpacity = wg ? getComputedStyle(wg).opacity : 'n-a';
  out.anyVisibleSquishedButton = [...document.querySelectorAll('.btn, .send-btn, .top-search-btn, [role="tab"]')]
    .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 24; })
    .map((b) => b.className);
  return JSON.stringify(out, null, 1);
})()
