(async () => {
  const s = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const inp = document.querySelector('#siteSearchInput');
  inp.value = 'gal';
  document.querySelector('#siteSearch').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  await s(800);
  out.filteredOut = [...document.querySelectorAll('.portal.is-filtered-out')]
    .map((p) => p.querySelector('.portal-name').textContent.trim());
  out.hits = [...document.querySelectorAll('.portal.is-hit')]
    .map((p) => p.querySelector('.portal-name').textContent.trim());
  out.tip = document.querySelector('#tipBar').textContent.trim();
  out.stillOnHome = document.body.dataset.page;

  // now clear it again
  inp.value = '';
  document.querySelector('#siteSearch').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  await s(400);
  out.afterClearFiltered = document.querySelectorAll('.portal.is-filtered-out').length;
  return JSON.stringify(out, null, 1);
})()
