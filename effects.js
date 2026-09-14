// 1. Parallax Stars Background Box-Shadow Generator
function generateStarShadows(count) {
  let shadows = '';
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 2000) | 0;
    const y = (Math.random() * 2000) | 0;
    // Using currentColor allows us to animate thousands of stars smoothly via CSS
    shadows += `${x}px ${y}px currentColor${i === count - 1 ? '' : ', '}`;
  }
  return shadows;
}

const rootStyle = document.documentElement.style;
rootStyle.setProperty('--shadows-small', generateStarShadows(500));
rootStyle.setProperty('--shadows-medium', generateStarShadows(150));
rootStyle.setProperty('--shadows-big', generateStarShadows(75));

// 2. High-Quality Soft Ambient Fog (Drifting Radial Gradients)
const canvas = document.getElementById('fogCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// Soft atmospheric fog clouds
const fogClouds = [
  { x: 0.2, y: 0.3, r: 0.55, alpha: 0.08 },
  { x: 0.8, y: 0.7, r: 0.65, alpha: 0.06 },
  { x: 0.5, y: 0.4, r: 0.50, alpha: 0.07 },
  { x: 0.3, y: 0.8, r: 0.60, alpha: 0.05 }
];

let fogTime = 0;

// Current and Target Fog Colors for smooth transitions
let fogC1 = { r: 180, g: 195, b: 220 };
let fogC2 = { r: 100, g: 115, b: 140 };
let targetFogC1 = { r: 180, g: 195, b: 220 };
let targetFogC2 = { r: 100, g: 115, b: 140 };

// Expose a function to update the target colors from navigation.js
window.updateFogTheme = function(color1, color2) {
  targetFogC1 = color1;
  targetFogC2 = color2;
};

// Smoothly interpolate current color towards target color
function lerpColor(curr, target, speed = 0.015) {
  curr.r += (target.r - curr.r) * speed;
  curr.g += (target.g - curr.g) * speed;
  curr.b += (target.b - curr.b) * speed;
}

function drawFog() {
  requestAnimationFrame(drawFog);
  if (document.hidden) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const h = canvas.height;
  const maxDim = Math.max(w, h);

  fogTime += 0.002;

  // Gently transition the colors every frame
  lerpColor(fogC1, targetFogC1);
  lerpColor(fogC2, targetFogC2);

  fogClouds.forEach((cloud, i) => {
    const cx = (cloud.x + Math.sin(fogTime + i * 1.5) * 0.12) * w;
    const cy = (cloud.y + Math.cos(fogTime * 0.8 + i * 2.1) * 0.12) * h;
    const radius = cloud.r * maxDim;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${Math.round(fogC1.r)}, ${Math.round(fogC1.g)}, ${Math.round(fogC1.b)}, ${cloud.alpha})`);
    grad.addColorStop(0.5, `rgba(${Math.round(fogC2.r)}, ${Math.round(fogC2.g)}, ${Math.round(fogC2.b)}, ${cloud.alpha * 0.4})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
drawFog();

// 3. Warp Canvas Effect
const warpCanvas = document.getElementById('starWarp');
const warpCtx = warpCanvas.getContext('2d');

warpCanvas.width = window.innerWidth;
warpCanvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  warpCanvas.width = window.innerWidth;
  warpCanvas.height = window.innerHeight;
});

const stars = [];
let warpSpeed = 0;   
let targetSpeed = 0; 
let warpAnimId = null;

// Increased from 150 to 450 for a dense, chaotic field
for (let i = 0; i < 450; i++) {
  stars.push({
    x: Math.random() * warpCanvas.width,
    y: Math.random() * warpCanvas.height,
    size: Math.random() * 2,
    speedMultiplier: Math.random() * 0.5 + 0.5
  });
}

function animateWarp() {
  warpSpeed += (targetSpeed - warpSpeed) * 0.025;

  warpCtx.clearRect(0, 0, warpCanvas.width, warpCanvas.height);

  // Keep rendering while speed is active or canvas is fading out
  if (warpSpeed > 0.005 || getComputedStyle(warpCanvas).opacity > '0.01') {
    warpCtx.strokeStyle = 'white';
    warpCtx.fillStyle = 'white';
    
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      star.y -= warpSpeed * star.speedMultiplier;

      if (star.y < 0) {
        star.y = warpCanvas.height;
        star.x = Math.random() * warpCanvas.width;
      }

      // Shrink trail length to zero as speed drops so stars turn into clean points
      const trailLength = warpSpeed * star.speedMultiplier * 0.6;

      warpCtx.lineWidth = star.size;
      warpCtx.lineCap = 'round';
      warpCtx.beginPath();
      
      if (trailLength > 0.5) {
        warpCtx.moveTo(star.x, star.y);
        warpCtx.lineTo(star.x, star.y + trailLength);
        warpCtx.stroke();
      } else {
        // Draw standard circular star dots as warp speed reaches zero
        warpCtx.arc(star.x, star.y, star.size / 2, 0, Math.PI * 2);
        warpCtx.fill();
      }
    }
    warpAnimId = requestAnimationFrame(animateWarp);
  } else {
    warpCtx.clearRect(0, 0, warpCanvas.width, warpCanvas.height);
    warpAnimId = null;
  }
}

function startWarpEffect(isHyperMode = false) {
  warpCanvas.style.opacity = '1'; 
  
  if (isHyperMode) {
    // Fast send animation
    warpCanvas.classList.add('hyper-speed');
    document.body.classList.add('hyper-warp-active');
    targetSpeed = 450; // Massively faster than the intro's 150
  } else {
    // Normal intro animation
    document.body.classList.add('warp-bloom');
    targetSpeed = 150;
  }
  
  if (!warpAnimId) animateWarp();
}


function stopWarpEffect() {
  targetSpeed = 0; 
  document.body.classList.remove('warp-bloom');
  document.body.classList.remove('hyper-warp-active');
  
  // Remove the fast transition so it fades out smoothly again
  setTimeout(() => { warpCanvas.classList.remove('hyper-speed'); }, 100);

  setTimeout(() => {
    document.body.classList.add('ui-reveal');
  }, 500);

  setTimeout(() => {
    warpCanvas.style.opacity = '0'; 
  }, 1000); 
}

// Initial Page Load Intro
document.body.classList.add('intro-active'); // Hides the UI immediately
startWarpEffect();
setTimeout(() => { stopWarpEffect(); }, 700);