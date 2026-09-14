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

sendMessageBtn?.addEventListener('click', async () => {
  const text = messageText?.value.trim();
  if (!text || isSubmitting) return;
  isSubmitting = true;

  const embed = {
    title: "✍️ New anonymous message received.",
    description: text,
    color: 0xFFFFFF,
    footer: { text: "Renn's Void • Anonymous Text" },
    timestamp: new Date().toISOString()
  };

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