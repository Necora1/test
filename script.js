// 1. Navigation Tab Switcher
const sections = document.querySelectorAll('.section');
const navButtons = document.querySelectorAll('.nav-btn');

function showSection(sectionId, evt) {
  const clickEvent = evt || window.event;
  
  sections.forEach(sec => {
    sec.classList.toggle('active', sec.id === sectionId);
  });
  
  navButtons.forEach(btn => {
    const onclickAttr = btn.getAttribute('onclick');
    
    // Strict boolean cast (!!) prevents toggle() from glitching on undefined values
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
}

// 2. Generate Random Coordinates for Parallax Stars
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

// 3. Animated Noise Fog Canvas
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
let time = 0;

function drawFog() {
  let pixelIndex = 0;

  for (let y = 0; y < height; y++) {
    const ny = y * noiseScale;
    for (let x = 0; x < width; x++) {
      const nx = (x + time) * noiseScale;
      const noiseValue = noise(nx, ny) * 0.5 + 0.5;
      const intensity = (noiseValue * 255) | 0;
      const alpha = (intensity * 0.05) | 0;

      buf32[pixelIndex++] = (alpha << 24) | (intensity << 16) | (intensity << 8) | intensity;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  time += fogSpeed * width;
  requestAnimationFrame(drawFog);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
drawFog();

// 4. Organic Floating & Magnetic Button Physics
const buttons = Array.from(document.querySelectorAll('.nav-btn'));
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

// Tighter activation zones
const ATTRACT_RADIUS = 90;  // Reduced: only triggers when close
const NEAR_RADIUS = 30;     // Border draw animation threshold
const MAX_PULL = 20;        // Max offset limit in pixels to prevent overlap

function animateButtons(timestamp = performance.now()) {
  buttonStates.forEach((state) => {
    const rect = state.el.getBoundingClientRect();
    
    // Calculate button center relative to un-transformed layout position
    const centerX = rect.left + rect.width / 2 - state.x;
    const centerY = rect.top + rect.height / 2 - state.y;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const dist = Math.hypot(dx, dy);

    // Subtle idle float
    const t = timestamp * state.speed + state.phase;
    const floatX = Math.sin(t) * state.ampX;
    const floatY = Math.cos(t * 0.8) * state.ampY;

    let targetX = floatX;
    let targetY = floatY;

    if (dist < ATTRACT_RADIUS) {
      const pullFactor = Math.pow(1 - dist / ATTRACT_RADIUS, 1);
      
      // Cap the pull distance so the button nudges slightly toward mouse without overlapping neighbors
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

    // Smoother interpolation factor (0.07) for gentle, controlled movement
    state.x += (targetX - state.x) * 0.05;
    state.y += (targetY - state.y) * 0.05;

    state.el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0)`;
  });

  requestAnimationFrame(animateButtons);
}

requestAnimationFrame(animateButtons);

// 5. Drawing Canvas & Submission Logic
const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas?.getContext('2d');
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const clearBtn = document.getElementById('clearBtn');
const brushSize = document.getElementById('brushSize');
const brushColor = document.getElementById('brushColor');
const sendDrawingBtn = document.getElementById('sendDrawingBtn');


// Discord Webhooks
const DRAWING_WEBHOOK_URL = 'https://discord.com/api/webhooks/1547590235834032199/R6chHgBOhBcWmcaJG9Pw2gtc6-j80t1DCuVv97T3ons86uUucCFlp1Qv9YKTC1_4jKQW';
const TEXT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1547595509298892881/eCAh-1xAP_nbdmyfZpUUxHhOUXFE5uPBCpgxSr5jgIciUc_zq97V5P1VOG6OPnNri7fx';
if (drawCanvas && drawCtx) {
  let isDrawing = false;
  let isEraser = false;

  // Tool Mode Switcher
  penBtn?.addEventListener('click', () => {
    isEraser = false;
    penBtn.classList.add('active');
    eraserBtn.classList.remove('active');
  });

  eraserBtn?.addEventListener('click', () => {
    isEraser = true;
    eraserBtn.classList.add('active');
    penBtn.classList.remove('active');
  });

  function getPos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (drawCanvas.width / rect.width),
      y: (clientY - rect.top) * (drawCanvas.height / rect.height)
    };
  }

  function startDrawing(e) {
    isDrawing = true;
    const pos = getPos(e);
    drawCtx.beginPath();
    drawCtx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);

    if (isEraser) {
      // Cut through existing canvas pixels
      drawCtx.globalCompositeOperation = 'destination-out';
    } else {
      // Normal painting mode
      drawCtx.globalCompositeOperation = 'source-over';
      drawCtx.strokeStyle = brushColor.value;
    }

    drawCtx.lineWidth = brushSize.value;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    drawCtx.lineTo(pos.x, pos.y);
    drawCtx.stroke();
  }

  function stopDrawing() {
    isDrawing = false;
  }

  // Mouse & Touch Listeners
  drawCanvas.addEventListener('mousedown', startDrawing);
  drawCanvas.addEventListener('mousemove', draw);
  drawCanvas.addEventListener('mouseup', stopDrawing);
  drawCanvas.addEventListener('mouseleave', stopDrawing);

  drawCanvas.addEventListener('touchstart', startDrawing);
  drawCanvas.addEventListener('touchmove', draw);
  drawCanvas.addEventListener('touchend', stopDrawing);

  // Clear Canvas
  clearBtn?.addEventListener('click', () => {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  });

  // Send Drawing to Discord
  sendDrawingBtn?.addEventListener('click', () => {
    drawCanvas.toBlob(async (blob) => {
      if (!blob) return;

      const formData = new FormData();
      formData.append('file', blob, 'drawing.png');
      formData.append('content', '🎨 **New anonymous drawing received.**');

      const btnSpan = sendDrawingBtn.querySelector('span');
      if (btnSpan) btnSpan.innerText = 'Sending...';
      sendDrawingBtn.disabled = true;

      try {
        const response = await fetch(DRAWING_WEBHOOK_URL, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          alert('Drawing sent to renn.');
          drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        } else {
          alert('Failed to send drawing.');
        }
      } catch (err) {
        alert('Error sending drawing.');
      } finally {
        if (btnSpan) btnSpan.innerText = 'Send anonymously 🎨🤫';
        sendDrawingBtn.disabled = false;
      }
    }, 'image/png');
  });
}

// 6. Text Message & Spotify Search Logic
const openSpotifyBtn = document.getElementById('openSpotifyBtn');
const spotifyModal = document.getElementById('spotifyModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const songSearch = document.getElementById('songSearch');
const searchResults = document.getElementById('searchResults');
const messageText = document.getElementById('messageText');
const sendMessageBtn = document.getElementById('sendMessageBtn');

let attachedTrack = null;

// Modal Controls
openSpotifyBtn?.addEventListener('click', () => spotifyModal.classList.remove('hidden'));
closeModalBtn?.addEventListener('click', () => spotifyModal.classList.add('hidden'));

// Search API (Using iTunes as a proxy for instant, keyless search)
let searchTimeout;
songSearch?.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  
  if (query.length < 2) {
    searchResults.innerHTML = '';
    return;
  }

  // Debounce API calls by 500ms
  searchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`);
      const data = await res.json();
      
      searchResults.innerHTML = data.results.map(track => `
        <div class="track-item" data-title="${track.trackName}" data-artist="${track.artistName}">
          <img src="${track.artworkUrl100}" class="track-img" alt="Album Art">
          <div class="track-info">
            <span class="track-title">${track.trackName}</span>
            <span class="track-artist">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#b3b3b3"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.621.539.3.719 1.02.419 1.56-.239.54-.959.72-1.559.3z"/></svg>
              ${track.artistName}
            </span>
          </div>
        </div>
      `).join('');

      // Add click listeners to select a song
      document.querySelectorAll('.track-item').forEach(item => {
        item.addEventListener('click', () => {
          attachedTrack = {
            title: item.dataset.title,
            artist: item.dataset.artist
          };
          openSpotifyBtn.classList.add('attached'); // Turns icon green
          spotifyModal.classList.add('hidden');
        });
      });
    } catch (err) {
      console.error("Search failed", err);
    }
  }, 500);
});

// Send Message & Song to Discord
sendMessageBtn?.addEventListener('click', async () => {
  const text = messageText.value.trim();
  if (!text && !attachedTrack) return alert("Write a message or attach a song.");

  // Prepend header to payload
  let discordPayload = `✍️ **New anonymous text message received.**\n\n${text}`;
  
  if (attachedTrack) {
    const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(attachedTrack.title + ' ' + attachedTrack.artist)}`;
    discordPayload += `\n\n🎵 **Attached Song:** [${attachedTrack.title} - ${attachedTrack.artist}](${spotifySearchUrl})`;
  }

  const btnSpan = sendMessageBtn.querySelector('span');
  if (btnSpan) btnSpan.innerText = 'Sending...';
  sendMessageBtn.disabled = true;

  try {
    const response = await fetch(TEXT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: discordPayload })
    });

    if (response.ok) {
      alert('Message sent to renn.');
      messageText.value = '';
      attachedTrack = null;
      openSpotifyBtn.classList.remove('attached');
    }
  } catch (err) {
    alert('Failed to send message.');
  } finally {
    if (btnSpan) btnSpan.innerText = 'Send anonymously ✍️🤫';
    sendMessageBtn.disabled = false;
  }
});

// 7. Dynamic Star Speed (Warp Effect on Load)
window.addEventListener('load', () => {
  // Get all the star layers [Die Sterne: German for "the stars". Plural of "der Stern".]
  const starLayers = document.querySelectorAll('#stars, #stars2, #stars3');
  
  // Collect their active CSS animations
  let animations = [];
  starLayers.forEach(layer => {
    animations.push(...layer.getAnimations());
  });

  // Set the starting speed [Die Geschwindigkeit: German for "the speed".]
  let currentSpeed = 40; // 40x normal speed (change this to make it faster/slower)
  const normalSpeed = 1;

  // Apply the fast speed right away
  animations.forEach(anim => anim.playbackRate = currentSpeed);

  // Function to smoothly slow them down like hitting the brakes
  function decelerate() {
    currentSpeed -= 0.5; // This controls how fast it slows down
    
    if (currentSpeed < normalSpeed) {
      currentSpeed = normalSpeed;
    }

    // Update the speed for all stars
    animations.forEach(anim => anim.playbackRate = currentSpeed);

    // Keep looping until we reach normal speed
    if (currentSpeed > normalSpeed) {
      requestAnimationFrame(decelerate);
    }
  }

  // Stay at max speed for a moment, then start slowing down
  setTimeout(() => {
    requestAnimationFrame(decelerate);
  }, 800); // 800ms (0.8 seconds) of fast movement before slowing
});