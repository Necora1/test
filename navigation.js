// 1. Navigation Tab Switcher
const sections = document.querySelectorAll('.section');
const navButtons = document.querySelectorAll('.nav-btn');

let currentActiveSectionId = 'home';

// Define our tab-specific themes
/* Enhanced Glass Active/Hover State */
// Define our tab-specific themes
const themes = {
  // 1. ABOUT: Deep Ocean / Cyber Blue
  about: {
    bg: '#010a14',
    stars: '#a3d5ff',
    fog1: { r: 0, g: 100, b: 200 },
    fog2: { r: 0, g: 200, b: 255 },
    navText: '#a3d5ff',
    navBorder: 'rgba(163, 213, 255, 0.25)',
    navBg: 'rgba(255, 255, 255, 0.06)'
  },
  
  // 2. GALLERY: Sunrise / Warm Gold
  gallery: { 
    bg: '#1c0d02',
    stars: '#ffe49e',
    fog1: { r: 255, g: 190, b: 80 },
    fog2: { r: 255, g: 110, b: 90 },
    navText: '#e8c9a3',
    navBorder: 'rgba(255, 228, 158, 0.25)',
    navBg: 'rgba(255, 255, 255, 0.06)'
  },

  // 3. INTERESTS: Amethyst / Royal Purple
  interests: {
    bg: '#100517',
    stars: '#d9b3ff',
    fog1: { r: 150, g: 50, b: 200 },
    fog2: { r: 200, g: 100, b: 255 },
    navText: '#d9b3ff',
    navBorder: 'rgba(217, 179, 255, 0.25)',
    navBg: 'rgba(255, 255, 255, 0.06)'
  },

  // 4. SEND: Emerald / Nature Green
  send: {
    bg: '#021207',
    stars: '#a3ffa3',
    fog1: { r: 0, g: 180, b: 80 },
    fog2: { r: 50, g: 255, b: 150 },
    navText: '#a3ffa3',
    navBorder: 'rgba(163, 255, 163, 0.25)',
    navBg: 'rgba(255, 255, 255, 0.06)'
  },

  // 5. FAVOOMFS: Crimson / Rose
  favoomfs: {
    bg: '#140202',
    stars: '#ffb3b3',
    fog1: { r: 220, g: 20, b: 60 },
    fog2: { r: 255, g: 100, b: 100 },
    navText: '#ffb3b3',
    navBorder: 'rgba(255, 179, 179, 0.25)',
    navBg: 'rgba(255, 255, 255, 0.06)'
  },

  // Default Theme (Untouched as requested)
  default: { 
    bg: '#030303',
    stars: '#ffffff',
    fog1: { r: 180, g: 195, b: 220 },
    fog2: { r: 100, g: 115, b: 140 },
    navText: '#888888',
    navBorder: '#333333',
    navBg: 'rgba(255, 255, 255, 0.02)'
  }
};

function showSection(sectionId, evt) {
  const menuLabel = document.querySelector('#menuToggleBtn span');
  if (menuLabel) {
    menuLabel.innerText = sectionId.toUpperCase();
  }
  
  if (currentActiveSectionId === sectionId) return;
  currentActiveSectionId = sectionId;

  // Apply Theme Colors
  const theme = themes[sectionId] || themes.default;
  document.body.style.backgroundColor = theme.bg;
  
  // Update CSS Variables
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--star-color', theme.stars);
  rootStyle.setProperty('--nav-text', theme.navText);
  rootStyle.setProperty('--nav-border', theme.navBorder);
  rootStyle.setProperty('--nav-bg', theme.navBg);
  
  if (window.updateFogTheme) {
    window.updateFogTheme(theme.fog1, theme.fog2);
  }

  if (sectionId === 'send') {
    const goldBtn = document.querySelector('.gold-glow');
    if (goldBtn) {
      goldBtn.classList.remove('gold-glow');
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

// 2. Magnetic Button Physics
// Target both the toggle button and the navigation tabs
const buttons = Array.from(document.querySelectorAll('#menuToggleBtn, .expandable-nav .nav-btn'));
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
  speed: 0.0003 + index * 0.0001, 
  phase: index * 2.2,
  ampX: 1 + index * 0.3,         
  ampY: 0.8 + (index % 2) * 0.4   
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

// Softer magnetic pull values
const ATTRACT_RADIUS = 50;
const NEAR_RADIUS = 20;
const MAX_PULL = 6;

let scrollVelocity = 0;
let lastScrollY = window.scrollY;

window.addEventListener('scroll', () => {
  updateButtonRects();
  const currentScrollY = window.scrollY;
  const delta = currentScrollY - lastScrollY;
  scrollVelocity += delta * 0.15; // Accumulate momentum
  lastScrollY = currentScrollY;
});

function animateButtons(timestamp = performance.now()) {
  if (document.hidden) {
    requestAnimationFrame(animateButtons);
    return;
  }

  // Apply friction so the momentum smoothly degrades
  scrollVelocity *= 0.92;

  buttonStates.forEach((state, idx) => {
    const rectInfo = cachedRects[idx];
    if (!rectInfo) return;

    const dx = mouseX - rectInfo.centerX;
    const dy = mouseY - rectInfo.centerY;
    const dist = Math.hypot(dx, dy);

    const t = timestamp * state.speed + state.phase;
    const floatX = Math.sin(t) * state.ampX;

    // INJECT SCROLL VELOCITY HERE: Modifies the bounce amplitude dynamically
    const dynamicAmpY = state.ampY + Math.abs(scrollVelocity) * 0.4;
    const floatY = Math.cos(t * 0.8) * dynamicAmpY + scrollVelocity * 0.2;

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

// 3. Expandable Mobile/Desktop Menu Logic
const menuToggleBtn = document.getElementById('menuToggleBtn');
const mainNav = document.getElementById('mainNav');

menuToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Prevents immediate bubbling to document
  mainNav.classList.add('expanded');
  menuToggleBtn.classList.add('hidden-btn');
  setTimeout(updateButtonRects, 400); 
});

// Close when clicking anywhere outside the menu container
document.addEventListener('click', (e) => {
  if (mainNav.classList.contains('expanded') && !mainNav.contains(e.target)) {
    mainNav.classList.remove('expanded');
    menuToggleBtn.classList.remove('hidden-btn');
    setTimeout(updateButtonRects, 400); 
  }
});

// Auto-close menu when picking a tab
const originalShowSection = showSection;
window.showSection = function(sectionId, evt) {
  originalShowSection(sectionId, evt);
  
  if (mainNav.classList.contains('expanded')) {
    mainNav.classList.remove('expanded');
    menuToggleBtn.classList.remove('hidden-btn');
    setTimeout(updateButtonRects, 400); 
  }
};