(() => {
  const out = {};
  const foot = document.querySelector('.footer');
  const inner = document.querySelector('.footer-inner');
  if (foot) {
    const fr = foot.getBoundingClientRect();
    out.footer = { x: Math.round(fr.x), y: Math.round(fr.y), w: Math.round(fr.width), h: Math.round(fr.height), right: Math.round(fr.right), bottom: Math.round(fr.bottom), vh: window.innerHeight };
  }
  if (inner) {
    const ir = inner.getBoundingClientRect();
    out.inner = { x: Math.round(ir.x), y: Math.round(ir.y), w: Math.round(ir.width), h: Math.round(ir.height), right: Math.round(ir.right), overflowX: ir.right > window.innerWidth };
    // links
    const links = inner.querySelector('.footer-links');
    if (links) {
      const lr = links.getBoundingClientRect();
      out.links = { w: Math.round(lr.width), right: Math.round(lr.right), x: Math.round(lr.x) };
    }
    // marquee
    const mq = inner.querySelector('.footer-marquee');
    if (mq) {
      const mr = mq.getBoundingClientRect();
      const innerSpan = mq.querySelector('span');
      const sr = innerSpan ? innerSpan.getBoundingClientRect() : null;
      out.marquee = { w: Math.round(mr.width), right: Math.round(mr.right), innerW: sr ? Math.round(sr.width) : null, innerRight: sr ? Math.round(sr.right) : null, text: innerSpan ? innerSpan.textContent : null };
      // is marquee text wider than footer inner?
      out.marqueeFits = sr ? sr.width <= ir.width : 'unknown';
    }
    // note
    const note = inner.querySelector('.footer-note');
    if (note) {
      const nr = note.getBoundingClientRect();
      out.note = { w: Math.round(nr.width), right: Math.round(nr.right) };
    }
  }
  // check computed style of marquee
  if (inner) {
    const mq = inner.querySelector('.footer-marquee');
    if (mq) {
      const cs = getComputedStyle(mq);
      out.marqueeStyle = { width: cs.width, maxWidth: cs.maxWidth, overflow: cs.overflow, whiteSpace: cs.whiteSpace, transform: cs.transform };
    }
  }
  return JSON.stringify(out, null, 1);
})()
