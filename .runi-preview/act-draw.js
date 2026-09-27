(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  document.querySelector('#tabDraw').click();
  await s(900);
  out.writePanelHidden = document.querySelector('#panelWrite').hidden;
  out.drawPanelHidden = document.querySelector('#panelDraw').hidden;
  out.activeTab = document.querySelector('#sendTabs').dataset.active;
  const cv = document.querySelector('#drawCanvas');
  const r = cv.getBoundingClientRect();
  out.canvasBox = `${Math.round(r.width)}x${Math.round(r.height)}`;
  out.canvasVisible = r.width > 0 && r.height > 0;
  out.toolButtons = [...document.querySelectorAll('.tool-btn')].map((b) => b.title);
  out.swatches = document.querySelectorAll('.swatch').length;
  out.sendDrawingBtn = document.querySelector('#sendDrawingBtn').textContent.trim();
  out.hint = document.querySelector('#canvasHint').textContent.trim();
  out.sendDisabled = document.querySelector('#sendDrawingBtn').disabled;
  return JSON.stringify(out, null, 1);
})()
