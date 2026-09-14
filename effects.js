// 1. Parallax Stars Background Box-Shadow Generator
function generateStarShadows(count) {
  let shadows = '';
  for (let i = 0; i < count; i++) {
    const x = (Math.random() * 2000) | 0;
    const y = (Math.random() * 2000) | 0;
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

const fogClouds = [
  { x: 0.2, y: 0.3, r: 0.55, alpha: 0.08 },
  { x: 0.8, y: 0.7, r: 0.65, alpha: 0.06 },
  { x: 0.5, y: 0.4, r: 0.50, alpha: 0.07 },
  { x: 0.3, y: 0.8, r: 0.60, alpha: 0.05 }
];

let fogTime = 0;
let fogC1 = { r: 180, g: 195, b: 220 };
let fogC2 = { r: 100, g: 115, b: 140 };
let targetFogC1 = { r: 180, g: 195, b: 220 };
let targetFogC2 = { r: 100, g: 115, b: 140 };

window.updateFogTheme = function(color1, color2) {
  targetFogC1 = color1;
  targetFogC2 = color2;
};

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
let accelRate = 0.04; 
let warpAnimId = null;

for (let i = 0; i < 300; i++) {
  stars.push({
    x: Math.random() * warpCanvas.width,
    y: Math.random() * warpCanvas.height,
    size: Math.random() * 2.5 + 0.8, 
    speedMultiplier: Math.random() * 0.5 + 0.5
  });
}

function animateWarp() {
  // 1. Calculate speed with a forced minimum step so it doesn't linger forever
  let diff = targetSpeed - warpSpeed;
  let step = diff * accelRate;
  
  if (Math.abs(step) < 0.2) step = (step > 0 ? 0.2 : -0.2); 
  warpSpeed += step;
  
  // Clamp speed so it doesn't overshoot
  if ((diff > 0 && warpSpeed > targetSpeed) || (diff < 0 && warpSpeed < targetSpeed)) {
      warpSpeed = targetSpeed;
  }

  warpCtx.clearRect(0, 0, warpCanvas.width, warpCanvas.height);

  // 2. Dynamic Shake & Glow tied directly to warpSpeed
  if (document.body.classList.contains('hyper-warp-active')) {
     let baseIntensity = Math.min(Math.max(warpSpeed, 0) / 220, 1);
     let intensity = Math.pow(baseIntensity, 1.5); 
     
     if (intensity > 0.01) { 
         const time = performance.now() * 0.03;
         const shakeX = (Math.sin(time) * 12 + (Math.random() - 0.5) * 8) * intensity;
         const shakeY = (Math.cos(time * 0.8) * 12 + (Math.random() - 0.5) * 8) * intensity;
         const shakeR = (Math.sin(time * 0.5) * 1.5) * intensity;

         document.documentElement.style.setProperty('--shake-x', `${shakeX}px`);
         document.documentElement.style.setProperty('--shake-y', `${shakeY}px`);
         document.documentElement.style.setProperty('--shake-r', `${shakeR}deg`);
         
         // RESTORED CSS GLOW FOR THE UI
         document.documentElement.style.setProperty('--glow-radius', `${20 * intensity}px`);
         document.documentElement.style.setProperty('--glow-alpha', `${0.6 * intensity}`);
         document.documentElement.style.setProperty('--warp-brightness', `${1 + (0.6 * intensity)}`);

         const glow = warpCtx.createRadialGradient(
             warpCanvas.width / 2, warpCanvas.height, 0, 
             warpCanvas.width / 2, warpCanvas.height, warpCanvas.height * 0.7 
         );
         glow.addColorStop(0, `rgba(255, 255, 255, ${0.4 * intensity})`);
         glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
         warpCtx.fillStyle = glow;
         warpCtx.fillRect(0, 0, warpCanvas.width, warpCanvas.height);

     } else if (targetSpeed === 0) {
         // BUG FIX: Only remove the effect classes when we are coming to a full STOP
         document.documentElement.style.setProperty('--shake-x', `0px`);
         document.documentElement.style.setProperty('--shake-y', `0px`);
         document.documentElement.style.setProperty('--shake-r', `0deg`);
         document.documentElement.style.setProperty('--glow-radius', `0px`);
         document.documentElement.style.setProperty('--glow-alpha', `0`);
         document.documentElement.style.setProperty('--warp-brightness', `1`);
         document.body.classList.remove('hyper-warp-active'); 
     }
  }

  // 3. Fading leftover stars smoothly 
  if (targetSpeed === 0 && warpSpeed < 120) {
     warpCanvas.style.opacity = Math.max(0, warpSpeed / 120).toString();
  }

  // 4. Stop condition: wait until speed is truly 0
  if (warpSpeed > 0) {
    warpCtx.strokeStyle = 'white';
    warpCtx.fillStyle = 'white';
    
    warpCtx.shadowBlur = Math.min(warpSpeed * 0.1, 30); 
    warpCtx.shadowColor = 'rgba(255, 255, 255, 0.9)';
    
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      star.y -= warpSpeed * star.speedMultiplier;

      if (star.y < 0) {
        star.y = warpCanvas.height;
        star.x = Math.random() * warpCanvas.width;
      }

      const trailLength = warpSpeed * star.speedMultiplier * 0.5;

      warpCtx.lineWidth = star.size;
      warpCtx.lineCap = 'round';
      warpCtx.beginPath();
      
      if (trailLength > 0.5) {
        warpCtx.moveTo(star.x, star.y);
        warpCtx.lineTo(star.x, star.y + trailLength);
        warpCtx.stroke();
      } else {
        warpCtx.arc(star.x, star.y, star.size / 2, 0, Math.PI * 2);
        warpCtx.fill();
      }
    }
    warpAnimId = requestAnimationFrame(animateWarp);
  } else {
    warpCtx.clearRect(0, 0, warpCanvas.width, warpCanvas.height);
    warpCanvas.style.opacity = '0';
    warpAnimId = null;
  }
}

function startWarpEffect(isHyperMode = false) {
  document.body.classList.add('warp-animating');
  warpCanvas.style.opacity = '1'; 
  
  if (isHyperMode) {
    warpCanvas.classList.add('hyper-speed');
    document.body.classList.add('hyper-warp-active');
    targetSpeed = 220;  
    accelRate = 0.04;   
  } else {
    document.body.classList.add('warp-bloom');
    // CHANGED: Boosted starting speed from 70 to 150 for a faster initial blast
    warpSpeed = 150;     
    targetSpeed = 0;    
    // CHANGED: Slowed down the deceleration so it plays longer
    accelRate = 0.015;   
  }
  
  if (!warpAnimId) animateWarp();
}

function stopWarpEffect() {
  targetSpeed = 0; 
  // Adjusted so it decelerates nicely without dragging out forever
  accelRate = 0.05; 
  document.body.classList.remove('warp-bloom');
  
  setTimeout(() => { warpCanvas.classList.remove('hyper-speed'); }, 50);
  
  setTimeout(() => { 
    document.body.classList.add('ui-reveal'); 
    document.body.classList.remove('warp-animating'); 
  }, 700);
}

// Initial Page Load Intro
document.body.classList.add('intro-active'); 
startWarpEffect(false);
// Increase this timeout to give you more play time before it fades
setTimeout(() => { stopWarpEffect(); }, 1500);