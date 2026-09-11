// 1. Parallax Stars Background Box-Shadow Generator
function generateStarShadows(count) {
  let shadows = '';
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 2000) | 0;
    const y = (Math.random() * 2000) | 0;
    shadows += `${x}px ${y}px #FFF${i === count - 1 ? '' : ', '}`;
  }
  return shadows;
}

const rootStyle = document.documentElement.style;
rootStyle.setProperty('--shadows-small', generateStarShadows(700));
rootStyle.setProperty('--shadows-medium', generateStarShadows(200));
rootStyle.setProperty('--shadows-big', generateStarShadows(100));

// 2. Static Ambient Background Fog Canvas
const canvas = document.getElementById('fogCanvas');
const ctx = canvas.getContext('2d');
const renderScale = 0.25;

let width = 0;
let height = 0;
let imageData = null;
let buf32 = null;

function resizeCanvas() {
  width = canvas.width = (window.innerWidth * renderScale) | 0;
  height = canvas.height = (window.innerHeight * renderScale) | 0;
  imageData = ctx.createImageData(width, height);
  buf32 = new Uint32Array(imageData.data.buffer);
}

function lerp(a, b, t) { return a + t * (b - a); }
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

function gradient(x, y) {
  const random = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return random - Math.floor(random);
}

function noise(x, y) {
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const y0 = Math.floor(y);
  const y1 = y0 + 1;
  const sx = fade(x - x0);
  const sy = fade(y - y0);
  const n0 = gradient(x0, y0);
  const n1 = gradient(x1, y0);
  const ix0 = lerp(n0, n1, sx);
  const n2 = gradient(x0, y1);
  const n3 = gradient(x1, y1);
  const ix1 = lerp(n2, n3, sx);
  return lerp(ix0, ix1, sy);
}

const fogSpeed = 0.001;
const noiseScale = 0.01;
const fogDensity = 0.4;
let time = 0;

function drawFog() {
  let pixelIndex = 0;

  for (let y = 0; y < height; y++) {
    const ny = y * noiseScale;
    for (let x = 0; x < width; x++) {
      const nx = (x + time) * noiseScale;
      const noiseValue = noise(nx, ny) * 0.5 + 0.5;
      
      const intensity = (noiseValue * 255) | 0;
      const alpha = Math.min(255, (intensity * fogDensity) | 0);
      const gray = (intensity * 0.5) | 0; 

      buf32[pixelIndex++] = (alpha << 24) | (gray << 16) | (gray << 8) | gray;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  time += fogSpeed * width;
  requestAnimationFrame(drawFog);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
drawFog();

// 3. Star Blooming Reaction (Disabled as requested)
function triggerStarBloom() {
  // No-op: stars stay smooth and steady
}

// 4. Warp Canvas Effect
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

for (let i = 0; i < 200; i++) {
  stars.push({
    x: Math.random() * warpCanvas.width,
    y: Math.random() * warpCanvas.height,
    size: Math.random() * 2,
    speedMultiplier: Math.random() * 0.5 + 0.5
  });
}

function animateWarp() {
  warpSpeed += (targetSpeed - warpSpeed) * 0.02;

  warpCtx.clearRect(0, 0, warpCanvas.width, warpCanvas.height);

  if (warpSpeed > 0.01) {
    warpCtx.strokeStyle = 'white';
    
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      star.y -= warpSpeed * star.speedMultiplier;

      if (star.y < 0) {
        star.y = warpCanvas.height;
        star.x = Math.random() * warpCanvas.width;
      }

      const trailLength = (warpSpeed * star.speedMultiplier * 0.6) + star.size;
      warpCtx.lineWidth = star.size;
      warpCtx.lineCap = 'round';
      warpCtx.beginPath();
      warpCtx.moveTo(star.x, star.y);
      warpCtx.lineTo(star.x, star.y + trailLength);
      warpCtx.stroke();
    }
  }

  requestAnimationFrame(animateWarp);
}
animateWarp();

function startWarpEffect() {
  warpCanvas.style.opacity = '1'; 
  document.body.classList.add('warp-bloom');
  targetSpeed = 150;         
}

function stopWarpEffect() {
  targetSpeed = 0; 
  document.body.classList.remove('warp-bloom');
  setTimeout(() => {
    warpCanvas.style.opacity = '0'; 
  }, 1500); 
}

// 5. Initial Page Load Intro
startWarpEffect();

setTimeout(() => {
  stopWarpEffect();
}, 700);