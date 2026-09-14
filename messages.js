// 5. Drawing Canvas & Submission Logic
const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas?.getContext('2d');
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const undoBtn = document.getElementById('undoBtn');
const bgToggleBtn = document.getElementById('bgToggleBtn');
const brushSize = document.getElementById('brushSize');
const brushColor = document.getElementById('brushColor');
const sendDrawingBtn = document.getElementById('sendDrawingBtn');

const DRAWING_WEBHOOK_URL = 'https://discord.com/api/webhooks/1547590235834032199/R6chHgBOhBcWmcaJG9Pw2gtc6-j80t1DCuVv97T3ons86uUucCFlp1Qv9YKTC1_4jKQW';
const TEXT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1547595509298892881/eCAh-1xAP_nbdmyfZpUUxHhOUXFE5uPBCpgxSr5jgIciUc_zq97V5P1VOG6OPnNri7fx';

let isSubmitting = false;

if (drawCanvas && drawCtx) {
  let isDrawing = false;
  let isEraser = false;
  let undoStack = [];

  const dpr = window.devicePixelRatio || 1;
  const VIRTUAL_WIDTH = 550;
  const VIRTUAL_HEIGHT = 350;

  function initResolution() {
    drawCanvas.width = VIRTUAL_WIDTH * dpr;
    drawCanvas.height = VIRTUAL_HEIGHT * dpr;
    drawCtx.scale(dpr, dpr);
    drawCtx.imageSmoothingEnabled = true;
    drawCtx.imageSmoothingQuality = 'high';
  }
  initResolution();

  function saveState() {
    undoStack.push(drawCanvas.toDataURL());
    if (undoStack.length > 30) undoStack.shift();
  }

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

  bgToggleBtn?.addEventListener('click', () => {
    const isWhiteBg = drawCanvas.classList.toggle('bg-white');
    brushColor.value = isWhiteBg ? '#000000' : '#ffffff';
  });

  undoBtn?.addEventListener('click', () => {
    if (undoStack.length > 0) {
      const lastState = undoStack.pop();
      const img = new Image();
      img.src = lastState;
      img.onload = () => {
        drawCtx.save();
        drawCtx.setTransform(1, 0, 0, 1, 0, 0);
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        drawCtx.drawImage(img, 0, 0, drawCanvas.width, drawCanvas.height);
        drawCtx.restore();
      };
    } else {
      drawCtx.save();
      drawCtx.setTransform(1, 0, 0, 1, 0, 0);
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      drawCtx.restore();
    }
  });

  function getPos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: ((clientX - rect.left) * (drawCanvas.width / rect.width)) / dpr,
      y: ((clientY - rect.top) * (drawCanvas.height / rect.height)) / dpr
    };
  }

  let lastPos = { x: 0, y: 0 };
  let lastMidPos = { x: 0, y: 0 };

  function startDrawing(e) {
    if (isDrawing || isSubmitting) return;
    saveState();
    isDrawing = true;
    drawCanvas.classList.add('active-glow');
    
    const pos = getPos(e);
    lastPos = pos;
    lastMidPos = pos;

    if (isEraser) {
      drawCtx.globalCompositeOperation = 'destination-out';
    } else {
      drawCtx.globalCompositeOperation = 'source-over';
      drawCtx.fillStyle = brushColor.value;
    }
    
    drawCtx.beginPath();
    drawCtx.arc(pos.x, pos.y, brushSize.value / 2, 0, Math.PI * 2);
    drawCtx.fill();
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const rawPos = getPos(e);

    const smoothing = 0.45;
    const currentPos = {
      x: lastPos.x + (rawPos.x - lastPos.x) * smoothing,
      y: lastPos.y + (rawPos.y - lastPos.y) * smoothing
    };

    const midPos = {
      x: (lastPos.x + currentPos.x) / 2,
      y: (lastPos.y + currentPos.y) / 2
    };

    if (isEraser) {
      drawCtx.globalCompositeOperation = 'destination-out';
    } else {
      drawCtx.globalCompositeOperation = 'source-over';
      drawCtx.strokeStyle = brushColor.value;
    }

    drawCtx.lineWidth = brushSize.value;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';

    drawCtx.beginPath();
    drawCtx.moveTo(lastMidPos.x, lastMidPos.y);
    drawCtx.quadraticCurveTo(lastPos.x, lastPos.y, midPos.x, midPos.y);
    drawCtx.stroke();

    lastPos = currentPos;
    lastMidPos = midPos;
  }

  function stopDrawing() {
    isDrawing = false;
    drawCanvas.classList.remove('active-glow');
  }

  drawCanvas.addEventListener('mousedown', startDrawing);
  drawCanvas.addEventListener('mousemove', draw);
  drawCanvas.addEventListener('mouseup', stopDrawing);
  drawCanvas.addEventListener('mouseleave', stopDrawing);

  drawCanvas.addEventListener('touchstart', startDrawing, { passive: false });
  drawCanvas.addEventListener('touchmove', draw, { passive: false });
  drawCanvas.addEventListener('touchend', stopDrawing);

  sendDrawingBtn?.addEventListener('click', () => {
    if (isSubmitting) return;

    drawCanvas.toBlob(async (blob) => {
      if (!blob) return;
      isSubmitting = true;

      const formData = new FormData();
      formData.append('file', blob, 'drawing.png');
      
      const embed = {
        title: "🎨 New anonymous drawing recieved.",
        color: 0xFFFFFF,
        image: { url: "attachment://drawing.png" },
        footer: { text: "Renn's Void • Anonymous Canvas" },
        timestamp: new Date().toISOString()
      };

      formData.append('payload_json', JSON.stringify({ embeds: [embed] }));

      const btnSpan = sendDrawingBtn.querySelector('span');
      if (btnSpan) btnSpan.innerText = 'Sending...';
      sendDrawingBtn.disabled = true;

      try {
        const response = await fetch(DRAWING_WEBHOOK_URL, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          if (typeof startWarpEffect === 'function') startWarpEffect(true); 
          
          drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
          undoStack = []; 
          if (btnSpan) btnSpan.innerText = 'Sent! 🎨✨';
          
          await new Promise(resolve => setTimeout(resolve, 1300));
          
          if (typeof stopWarpEffect === 'function') stopWarpEffect();
          
          await new Promise(resolve => setTimeout(resolve, 400));
        } else {
          if (btnSpan) btnSpan.innerText = 'Failed to send ❌';
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (err) {
        if (btnSpan) btnSpan.innerText = 'Error sending ❌';
        await new Promise(resolve => setTimeout(resolve, 1500));
      } finally {
        if (btnSpan) btnSpan.innerText = 'Send anonymously 🎨🤫';
        sendDrawingBtn.disabled = false;
        isSubmitting = false;
      }
    }, 'image/png');
  });
}

// 6. Text Message Submission Logic
const messageText = document.getElementById('messageText');
const sendMessageBtn = document.getElementById('sendMessageBtn');
let attachedSong = null; // Holds the selected track

sendMessageBtn?.addEventListener('click', async () => {
  const text = messageText?.value.trim();
  
  // Allow sending if there is either text OR an attached song
  if ((!text && !attachedSong) || isSubmitting) return; 
  isSubmitting = true;

  const embed = {
    title: "✍️ New anonymous message received.",
    description: text || "*No text, just vibes.*",
    color: attachedSong ? 0x1DB954 : 0xFFFFFF, // Spotify green if a song is attached
    footer: { text: "Renn's Void • Anonymous Text" },
    timestamp: new Date().toISOString()
  };

  // Inject the song data into the webhook embed if one exists
  if (attachedSong) {
    embed.fields = [{
      name: "🎵 Attached Song",
      value: `[${attachedSong.title} by ${attachedSong.artist}](${attachedSong.url})`
    }];
    embed.thumbnail = { url: attachedSong.cover };
  }

  const btnSpan = sendMessageBtn.querySelector('span');
  if (btnSpan) btnSpan.innerText = 'Sending...';
  sendMessageBtn.disabled = true;

  try {
    const response = await fetch(TEXT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (response.ok) {
      if (typeof startWarpEffect === 'function') startWarpEffect(true);

      if (messageText) messageText.value = '';
      attachedSong = null; 
      
      // Reset the music button back to the SVG icon
      const openSpotifyBtn = document.getElementById('openSpotifyBtn');
      if (openSpotifyBtn) {
        openSpotifyBtn.classList.remove('attached');
        openSpotifyBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.621.539.3.719 1.02.419 1.56-.239.54-.959.72-1.559.3z"/>
        </svg>`;
      }

      if (btnSpan) btnSpan.innerText = 'Sent! ✍️✨';
      await new Promise(resolve => setTimeout(resolve, 1300));
      if (typeof stopWarpEffect === 'function') stopWarpEffect();
      await new Promise(resolve => setTimeout(resolve, 400));
    } else {
      if (btnSpan) btnSpan.innerText = 'Failed to send ❌';
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  } catch (err) {
    if (btnSpan) btnSpan.innerText = 'Error sending ❌';
    await new Promise(resolve => setTimeout(resolve, 1500));
  } finally {
    if (btnSpan) btnSpan.innerText = 'Send anonymously ✍️🤫';
    sendMessageBtn.disabled = false;
    isSubmitting = false;
  }
});

// 7. Spotify Modal & Search Logic
const openSpotifyBtn = document.getElementById('openSpotifyBtn');
const spotifyModal = document.getElementById('spotifyModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const songSearchInput = document.getElementById('songSearch');
const searchResults = document.getElementById('searchResults');
let debounceTimer;

if (openSpotifyBtn && spotifyModal && closeModalBtn) {
  openSpotifyBtn.addEventListener('click', () => {
    spotifyModal.classList.remove('hidden');
    setTimeout(() => songSearchInput.focus(), 100);
  });

  closeModalBtn.addEventListener('click', () => {
    spotifyModal.classList.add('hidden');
  });

  spotifyModal.addEventListener('click', (e) => {
    if (e.target === spotifyModal) {
      spotifyModal.classList.add('hidden');
    }
  });

  // API Search Functionality
  songSearchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();
    
    if (query.length === 0) {
      searchResults.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        searchResults.innerHTML = '<div style="color:#888; text-align:center; padding: 20px;">Searching...</div>';
        
        // Using a CORS proxy to bypass mobile WebKit strict tracking prevention
        const targetUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=15`;
        const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);
        
        searchResults.innerHTML = '';
        
        if (data.results.length === 0) {
          searchResults.innerHTML = '<div style="color:#888; text-align:center; padding: 20px;">No songs found.</div>';
          return;
        }

        data.results.forEach(track => {
          const trackEl = document.createElement('div');
          trackEl.className = 'track-item';
          trackEl.innerHTML = `
            <img src="${track.artworkUrl60}" class="track-img" alt="Cover">
            <div class="track-info">
              <span class="track-title">${track.trackName}</span>
              <span class="track-artist">${track.artistName}</span>
            </div>
          `;
          
          trackEl.addEventListener('click', () => {
            attachedSong = {
              title: track.trackName,
              artist: track.artistName,
              url: track.trackViewUrl, 
              cover: track.artworkUrl100
            };
            
            // Swap SVG for the album cover on the button
            openSpotifyBtn.classList.add('attached');
            openSpotifyBtn.innerHTML = `
              <img src="${track.artworkUrl60}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 2px solid #1DB954; display: block;">
            `;
            
            spotifyModal.classList.add('hidden');
            songSearchInput.value = ''; 
            searchResults.innerHTML = '';
          });
          
          searchResults.appendChild(trackEl);
        });
      } catch (err) {
        searchResults.innerHTML = '<div style="color:#ff6b6b; text-align:center; padding: 20px;">Search failed. Try again.</div>';
      }
    }, 500);
  });
}