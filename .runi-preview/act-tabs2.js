(() => {
  const out = {};
  const seg = document.querySelector('.segmented');
  const thumb = document.querySelector('.segmented-thumb');
  const tabs = [...document.querySelectorAll('.segmented [role="tab"]')];
  const sr = seg.getBoundingClientRect();
  const tr = thumb.getBoundingClientRect();
  out.radiusTokens = ['--r-sm','--r-md','--r-lg'].map((k) => k + '=' + getComputedStyle(document.documentElement).getPropertyValue(k).trim()).join(' ');
  out.segRadius = getComputedStyle(seg).borderRadius;
  out.tabRadius = getComputedStyle(tabs[0]).borderRadius;
  out.thumbRadius = getComputedStyle(thumb).borderRadius;
  out.thumbInside = tr.left >= sr.left - 0.5 && tr.right <= sr.right + 0.5 && tr.top >= sr.top - 0.5 && tr.bottom <= sr.bottom + 0.5;
  out.thumbBottomGap = +(sr.bottom - tr.bottom).toFixed(1);
  out.thumbTopGap = +(tr.top - sr.top).toFixed(1);
  out.tabFills = +((tabs[0].getBoundingClientRect().height) / (sr.height - 8)).toFixed(2);
  out.mood = document.querySelector('.mood-word').textContent;
  out.listening = document.querySelector('.now-playing').textContent;
  out.tip = document.querySelector('#tipBar').textContent.trim();
  out.footNote = document.querySelector('.footer-note').textContent.trim();
  out.marquee = document.querySelector('.footer-marquee span').textContent.trim();
  out.overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  return JSON.stringify(out, null, 1);
})()
