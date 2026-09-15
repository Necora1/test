// ==========================================
// 1. Navigation & Dynamic Dock Setup
// ==========================================

const sections = document.querySelectorAll('.section');
let currentActiveSectionId = 'home';
let autoCollapseTimer = null;
let sectionTransitionTimer = null;

const themes = {
  about: { bg: '#010a14', stars: '#a3d5ff', fog1: { r: 0, g: 100, b: 200 }, fog2: { r: 0, g: 200, b: 255 } },
  gallery: { bg: '#1c0d02', stars: '#ffe49e', fog1: { r: 255, g: 190, b: 80 }, fog2: { r: 255, g: 110, b: 90 } },
  interests: { bg: '#100517', stars: '#d9b3ff', fog1: { r: 150, g: 50, b: 200 }, fog2: { r: 200, g: 100, b: 255 } },
  send: { bg: '#021207', stars: '#a3ffa3', fog1: { r: 0, g: 180, b: 80 }, fog2: { r: 50, g: 255, b: 150 } },
  favoomfs: { bg: '#140202', stars: '#ffb3b3', fog1: { r: 220, g: 20, b: 60 }, fog2: { r: 255, g: 100, b: 100 } },
  default: { bg: '#030303', stars: '#ffffff', fog1: { r: 180, g: 195, b: 220 }, fog2: { r: 100, g: 115, b: 140 } },
  admin: { bg: '#120202', stars: '#ff4d4d', fog1: { r: 180, g: 0, b: 0 }, fog2: { r: 80, g: 0, b: 0 } }
};

// Nav Dock State Machine: 'icon' | 'label' | 'expanded'
let currentDockState = 'icon';

const navDock = document.getElementById('navDock');
const dockToggleBtn = document.getElementById('dockToggleBtn');
const dockActiveLabel = document.getElementById('dockActiveLabel');
const currentTabBadge = document.getElementById('currentTabBadge');

function resetAutoCollapseTimer() {
  clearTimeout(autoCollapseTimer);
  if (currentDockState !== 'icon') {
    autoCollapseTimer = setTimeout(() => {
      setDockState('icon');
    }, 5000); 
  }
}

function setDockState(newState) {
  if (!navDock) return;

  clearTimeout(sectionTransitionTimer);

  currentDockState = newState;
  navDock.className = `nav-dock state-${newState}`;
  resetAutoCollapseTimer();
  setTimeout(updateButtonRects, 300);
}

// Hover Intent & Grace Delay Handlers
let hoverEnterTimer = null;
let hoverLeaveTimer = null;

const HOVER_ENTER_DELAY = 180;
const HOVER_LEAVE_DELAY = 350;

dockToggleBtn?.addEventListener('mouseenter', () => {
  clearTimeout(hoverLeaveTimer);
  hoverEnterTimer = setTimeout(() => {
    if (currentDockState === 'icon') {
      setDockState('label');
    }
  }, HOVER_ENTER_DELAY);
});

dockToggleBtn?.addEventListener('mouseleave', () => {
  clearTimeout(hoverEnterTimer);
  hoverLeaveTimer = setTimeout(() => {
    if (currentDockState === 'label') {
      setDockState('icon');
    }
  }, HOVER_LEAVE_DELAY);
});

navDock?.addEventListener('mousemove', resetAutoCollapseTimer);

dockToggleBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (currentDockState === 'expanded') {
    setDockState('label');
  } else {
    setDockState('expanded');
  }
});

document.addEventListener('click', (e) => {
  if (currentDockState === 'expanded' && navDock && !navDock.contains(e.target)) {
    setDockState('icon');
  }
});

// Master Section Switcher
window.showSection = function(sectionId, evt) {
  if (evt) evt.preventDefault();

  sections.forEach(sec => sec.classList.remove('active'));
  const targetEl = document.getElementById(sectionId);
  if (targetEl) targetEl.classList.add('active');

  currentActiveSectionId = sectionId;

  const activeTheme = themes[sectionId] || themes.default;
  document.body.style.backgroundColor = activeTheme.bg;
  document.documentElement.style.setProperty('--star-color', activeTheme.stars);
  if (typeof window.updateFogTheme === 'function') {
    window.updateFogTheme(activeTheme.fog1, activeTheme.fog2);
  }

  if (dockActiveLabel) {
    dockActiveLabel.innerText = sectionId.toUpperCase();
  }
  if (currentTabBadge) {
    currentTabBadge.innerText = `LOCATION: ${sectionId.toUpperCase()}`;
  }

  // Hide active section button inside dock menu only
  const dockNavBtns = document.querySelectorAll('#dockMenu .nav-btn');
  dockNavBtns.forEach(btn => {
    const targetSection = btn.getAttribute('data-section');
    if (targetSection === sectionId) {
      btn.style.display = 'none';
    } else {
      btn.style.display = 'inline-block';
    }
  });

  setDockState('label');
  sectionTransitionTimer = setTimeout(() => {
    setDockState('icon');
  }, 1600);

  setTimeout(updateButtonRects, 350);
};


// ==========================================
// 2. Magnetic Button Physics
// ==========================================

const buttons = Array.from(document.querySelectorAll('#dockToggleBtn, .dock-menu .nav-btn, .dock-side-group .nav-btn'));
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

const ATTRACT_RADIUS = 50;
const MAX_PULL = 6;

function animateButtons(timestamp = performance.now()) {
  if (document.hidden) {
    requestAnimationFrame(animateButtons);
    return;
  }

  buttonStates.forEach((state, idx) => {
    const rectInfo = cachedRects[idx];
    if (!rectInfo || !state.el.offsetParent) return;

    if (currentDockState !== 'icon') {
      if (Math.abs(state.x) > 0.01 || Math.abs(state.y) > 0.01) {
        state.x += (0 - state.x) * 0.1;
        state.y += (0 - state.y) * 0.1;
        state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0)`;
      } else {
        state.x = 0;
        state.y = 0;
        state.el.style.transform = '';
      }
      return;
    }

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
      targetX = floatX * (1 - pullFactor) + (dx / (dist || 1)) * cappedOffset * pullFactor;
      targetY = floatY * (1 - pullFactor) + (dy / (dist || 1)) * cappedOffset * pullFactor;
    }

    state.x += (targetX - state.x) * 0.05;
    state.y += (targetY - state.y) * 0.05;

    state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0)`;
  });

  requestAnimationFrame(animateButtons);
}
requestAnimationFrame(animateButtons);


// ==========================================
// 3. Auth & Control Panel Logic
// ==========================================

const AUTH_API_URL = 'https://api.zeroedmyworld.com';

const initLoginBtn = document.getElementById('initLoginBtn');
const logoutNavBtn = document.getElementById('logoutNavBtn');
const profileNavBtn = document.getElementById('profileNavBtn');
const loginModal = document.getElementById('loginModal');
const logoutModal = document.getElementById('logoutModal');
const closeLoginBtn = document.getElementById('closeLoginBtn');
const closeLogoutBtn = document.getElementById('closeLogoutBtn');
const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
const submitLoginBtn = document.getElementById('submitLoginBtn');
const loginError = document.getElementById('loginError');
const adminNavBtn = document.getElementById('adminNavBtn');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');

// Modals Trigger Handlers
initLoginBtn?.addEventListener('click', () => loginModal?.classList.remove('hidden'));
closeLoginBtn?.addEventListener('click', () => loginModal?.classList.add('hidden'));
logoutNavBtn?.addEventListener('click', () => logoutModal?.classList.remove('hidden'));
closeLogoutBtn?.addEventListener('click', () => logoutModal?.classList.add('hidden'));
cancelLogoutBtn?.addEventListener('click', () => logoutModal?.classList.add('hidden'));

confirmLogoutBtn?.addEventListener('click', () => {
  logoutModal?.classList.add('hidden');
  logout();
});


function showAdminPanelUI() {
  if (adminNavBtn) adminNavBtn.style.display = 'inline-block';
  if (logoutNavBtn) logoutNavBtn.style.display = 'inline-block';
  if (profileNavBtn) profileNavBtn.style.display = 'inline-block'; // Show on login
  if (initLoginBtn) initLoginBtn.style.display = 'none';
}

function showLoggedOutUI() {
  if (adminNavBtn) adminNavBtn.style.display = 'none';
  if (logoutNavBtn) logoutNavBtn.style.display = 'none';
  if (profileNavBtn) profileNavBtn.style.display = 'none'; // Hide on logout
  if (initLoginBtn) initLoginBtn.style.display = 'inline-block';
}

function logout() {
  localStorage.removeItem('void_auth_token');
  localStorage.removeItem('void_user');
  showLoggedOutUI();
  if (currentActiveSectionId === 'admin') {
    showSection('home');
  }
}

// Authentication Submit Action
async function performLogin() {
  const username = loginUser?.value.trim();
  const password = loginPass?.value;

  if (!username || !password) {
    if (loginError) {
      loginError.innerText = 'Please fill in all fields.';
      loginError.style.display = 'block';
    }
    return;
  }

  try {
    const res = await fetch(`${AUTH_API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.token) localStorage.setItem('void_auth_token', data.token);
      if (data.user) localStorage.setItem('void_user', JSON.stringify(data.user));

      if (loginError) loginError.style.display = 'none';
      if (loginModal) loginModal.classList.add('hidden');
      if (loginUser) loginUser.value = '';
      if (loginPass) loginPass.value = '';

      showAdminPanelUI();
      showSection('admin');
    } else {
      if (loginError) {
        loginError.innerText = 'Invalid credentials.';
        loginError.style.display = 'block';
      }
    }
  } catch (err) {
    if (loginError) {
      loginError.innerText = 'Connection error.';
      loginError.style.display = 'block';
    }
  }
}

submitLoginBtn?.addEventListener('click', performLogin);

[loginUser, loginPass].forEach(input => {
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performLogin();
    }
  });
});

// Restore Auth Session on Page Load
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('void_auth_token');
  if (token) {
    showAdminPanelUI();
  } else {
    showLoggedOutUI();
  }
});