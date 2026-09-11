// 5. Drawing Canvas & Submission Logic
const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas?.getContext('2d');
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const clearBtn = document.getElementById('clearBtn');
const brushSize = document.getElementById('brushSize');
const brushColor = document.getElementById('brushColor');
const sendDrawingBtn = document.getElementById('sendDrawingBtn');

const DRAWING_WEBHOOK_URL = 'https://discord.com/api/webhooks/1547590235834032199/R6chHgBOhBcWmcaJG9Pw2gtc6-j80t1DCuVv97T3ons86uUucCFlp1Qv9YKTC1_4jKQW';
const TEXT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1547595509298892881/eCAh-1xAP_nbdmyfZpUUxHhOUXFE5uPBCpgxSr5jgIciUc_zq97V5P1VOG6OPnNri7fx';

if (drawCanvas && drawCtx) {
  let isDrawing = false;
  let isEraser = false;

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
      drawCtx.globalCompositeOperation = 'destination-out';
    } else {
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

  drawCanvas.addEventListener('mousedown', startDrawing);
  drawCanvas.addEventListener('mousemove', draw);
  drawCanvas.addEventListener('mouseup', stopDrawing);
  drawCanvas.addEventListener('mouseleave', stopDrawing);

  drawCanvas.addEventListener('touchstart', startDrawing);
  drawCanvas.addEventListener('touchmove', draw);
  drawCanvas.addEventListener('touchend', stopDrawing);

  clearBtn?.addEventListener('click', () => {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  });

  sendDrawingBtn?.addEventListener('click', () => {
    drawCanvas.toBlob(async (blob) => {
      if (!blob) return;

      const formData = new FormData();
      formData.append('file', blob, 'drawing.png');
      
      // Build a beautiful Discord Embed card for the drawing
      const embed = {
        title: "🎨 New anonymous drawing recieved.",
        color: 0xFFFFFF, // Hot Pink border
        image: {
          url: "attachment://drawing.png" // Embeds the drawn file beautifully
        },
        footer: {
          text: "Renn's Void • Anonymous Canvas",
        },
        timestamp: new Date().toISOString()
      };

      // Discord requires JSON payloads to be attached to the form data when sending files
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
          startWarpEffect();
          drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
          if (btnSpan) btnSpan.innerText = 'Sent! 🎨✨';
          await new Promise(resolve => setTimeout(resolve, 1500));
          stopWarpEffect();
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          if (btnSpan) btnSpan.innerText = 'Failed to send ❌';
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err) {
        if (btnSpan) btnSpan.innerText = 'Error sending ❌';
        await new Promise(resolve => setTimeout(resolve, 2000));
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

openSpotifyBtn?.addEventListener('click', () => spotifyModal.classList.remove('hidden'));
closeModalBtn?.addEventListener('click', () => spotifyModal.classList.add('hidden'));

let searchTimeout;
songSearch?.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  
  if (query.length < 2) {
    searchResults.innerHTML = '';
    return;
  }

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

      document.querySelectorAll('.track-item').forEach(item => {
        item.addEventListener('click', () => {
          attachedTrack = {
            title: item.dataset.title,
            artist: item.dataset.artist
          };
          openSpotifyBtn.classList.add('attached');
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
  if (!text && !attachedTrack) return;

  // Build the text Embed card
  const embed = {
    title: "✍️ New anonymous text message received.",
    description: text ? `>>> ${text}` : "*No text message provided.*", // Fixed: Added message text back to embed
    color: 0xFFFFFF, // Pure White border
    fields: [],
    footer: {
      text: "Renn's Void • Anonymous Text",
    },
    timestamp: new Date().toISOString()
  };
  
  // If a song is attached, add it as a separate section in the card
  if (attachedTrack) {
    const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(attachedTrack.title + ' ' + attachedTrack.artist)}`;
    embed.fields.push({
      name: "🎵 Attached Track",
      value: `[${attachedTrack.title} - ${attachedTrack.artist}](${spotifySearchUrl})`,
      inline: false
    });
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
      messageText.value = '';
      attachedTrack = null;
      openSpotifyBtn.classList.remove('attached');
      if (btnSpan) btnSpan.innerText = 'Sent! ✍️✨';
      startWarpEffect();
      await new Promise(resolve => setTimeout(resolve, 1500));
      stopWarpEffect();
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      if (btnSpan) btnSpan.innerText = 'Failed to send ❌';
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (err) {
    if (btnSpan) btnSpan.innerText = 'Error sending ❌';
    await new Promise(resolve => setTimeout(resolve, 2000));
  } finally {
    if (btnSpan) btnSpan.innerText = 'Send anonymously ✍️🤫';
    sendMessageBtn.disabled = false;
  }
});

