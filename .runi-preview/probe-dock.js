(() => {
  const out = {};
  const t = document.querySelector('.dock-toggle');
  const cs = getComputedStyle(t);
  out.bodyClass = document.body.className;
  out.dockOpacity = cs.opacity;
  out.dockAnim = cs.animationName + ' / ' + cs.animationPlayState;
  const chain = [];
  let el = t;
  while (el && el !== document.documentElement.parentElement) {
    const c = getComputedStyle(el);
    chain.push(`${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ').join('.') : ''} op=${c.opacity} vis=${c.visibility} disp=${c.display}`);
    el = el.parentElement;
  }
  out.chain = chain;
  out.labelWidth = cs.getPropertyValue('--label-w');
  out.htmlClasses = document.documentElement.className;
  out.fontsReady = document.fonts ? document.fonts.status : 'n/a';
  out.jacquard = document.fonts ? document.fonts.check('16px Jacquard') : 'n/a';
  out.silkscreen = document.fonts ? document.fonts.check('16px Silkscreen') : 'n/a';
  out.stageOpacity = getComputedStyle(document.querySelector('.stage')).opacity;
  return JSON.stringify(out, null, 1);
})()
