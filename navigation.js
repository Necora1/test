// 1. Navigation Tab Switcher
const sections = document.querySelectorAll('.section');
const navButtons = document.querySelectorAll('.nav-btn');

let currentActiveSectionId = 'about';

function showSection(sectionId, evt) {
  if (currentActiveSectionId === sectionId) return;
  currentActiveSectionId = sectionId;

  if (sectionId === 'send') {
    const goldBtn = document.querySelector('.gold-glow');
    if (goldBtn) {
      goldBtn.classList.remove('gold-glow');
    }
  }

  if (sectionId === 'gallery') {
    const grid = document.getElementById('pinGrid');
    if (grid && !grid.dataset.loaded) {
        fetch('https://api.rss2json.com/v1/api.json?rss_url=https://www.pinterest.com/xqygen.rss')
        .then(res => res.json())
        .then(data => {
            if (data.items && data.items.length > 0) {
            grid.innerHTML = data.items.map(item => {
                const imgMatch = item.description.match(/src="([^"]+)"/);
                const imgSrc = imgMatch ? imgMatch[1] : item.thumbnail;
                return `
                <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="pin-card">
                    <img src="${imgSrc}" alt="${item.title || 'Pin'}" loading="lazy">
                </a>
                `;
            }).join('');
            grid.dataset.loaded = 'true';
            } else {
            grid.innerHTML = '<p>No pins found.</p>';
            }
        })
        .catch(() => {
            grid.innerHTML = '<p>Failed to load pins.</p>';
        });
    }
    }

  const clickEvent = evt || window.event;
  
  sections.forEach(sec => {
    sec.classList.toggle('active', sec.id === sectionId);
  });
  
  navButtons.forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick');
    const isActive = !!(
      (clickEvent && clickEvent.currentTarget === btn) || 
      (onclickAttr && onclickAttr.includes(`'${sectionId}'`))
    );
    
    btn.classList.toggle('active-btn', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  updateButtonRects();
}

// 2. Magnetic Button Physics (Layout-Cached)
const buttons = Array.from(document.querySelectorAll('nav .nav-btn'));
let mouseX = -1000;
let mouseY = -1000;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

const buttonStates = buttons.map((btn, index) => ({
  el: btn,
  x: 0,
  y: 0,
  speed: 0.0006 + index * 0.0002,
  phase: index * 2.2,
  ampX: 3 + index * 1.2,
  ampY: 2 + (index % 2) * 1.2
}));

let cachedRects = [];
function updateButtonRects() {
  cachedRects = buttonStates.map(state => {
    const rect = state.el.getBoundingClientRect();
    return {
      centerX: rect.left + rect.width / 2 - state.x,
      centerY: rect.top + rect.height / 2 - state.y
    };
  });
}

window.addEventListener('resize', updateButtonRects);
window.addEventListener('scroll', updateButtonRects);
setTimeout(updateButtonRects, 100);

const ATTRACT_RADIUS = 90;
const NEAR_RADIUS = 30;
const MAX_PULL = 20;

function animateButtons(timestamp = performance.now()) {
  buttonStates.forEach((state, idx) => {
    const rectInfo = cachedRects[idx];
    if (!rectInfo) return;

    const dx = mouseX - rectInfo.centerX;
    const dy = mouseY - rectInfo.centerY;
    const dist = Math.hypot(dx, dy);

    const t = timestamp * state.speed + state.phase;
    const floatX = Math.sin(t) * state.ampX;
    const floatY = Math.cos(t * 0.8) * state.ampY;

    let targetX = floatX;
    let targetY = floatY;

    if (dist < ATTRACT_RADIUS) {
      const pullFactor = 1 - dist / ATTRACT_RADIUS;
      const cappedOffset = Math.min(dist, MAX_PULL);
      const attractX = (dx / (dist || 1)) * cappedOffset * pullFactor;
      const attractY = (dy / (dist || 1)) * cappedOffset * pullFactor;

      targetX = floatX * (1 - pullFactor) + attractX;
      targetY = floatY * (1 - pullFactor) + attractY;

      if (dist < NEAR_RADIUS) {
        state.el.classList.add('near');
      } else {
        state.el.classList.remove('near');
      }
    } else {
      state.el.classList.remove('near');
    }

    state.x += (targetX - state.x) * 0.05;
    state.y += (targetY - state.y) * 0.05;

    state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0)`;
  });

  requestAnimationFrame(animateButtons);
}
requestAnimationFrame(animateButtons);