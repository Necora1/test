(() => {
  const out = {};
  out.bodyClass = document.body.className;
  out.htmlClasses = document.documentElement.className;
  out.reduced = Void.motion.reduced;
  out.settings = JSON.stringify(Void.settings);
  out.fabricVisible = getComputedStyle(document.body, '::before').display;
  out.marqueeAnim = getComputedStyle(document.querySelector('.footer-marquee span')).animationName;
  out.docScrollWidth = document.documentElement.scrollWidth;
  out.viewportWidth = window.innerWidth;
  out.horizontalOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  const over = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) && !el.closest('.footer-marquee') && !el.classList.contains('warp-glow')) {
      over.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
    }
  });
  out.overflowing = over.slice(0, 8);
  return JSON.stringify(out, null, 1);
})()
