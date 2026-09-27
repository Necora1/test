/* ==========================================================
   drawing.js — the anonymous canvas
   Strokes are kept as data, so undo/redo is exact and cheap,
   and the sent PNG includes the background you drew on.
   ========================================================== */
(() => {
  const { $, $$ } = Void;

  // Drawing space: same 11:7 shape as before at twice the resolution
  const W = 1100;
  const H = 700;
  const SCALE = W / 550; // brush sizes keep their old look
  const BG_DARK = '#0a0a0c';
  const BG_LIGHT = '#ffffff';

  Void.drawing = {
    init() {
      const canvas = $('#drawCanvas');
      const ctx = canvas.getContext('2d');
      const wrap = $('#canvasWrap');
      const hint = $('#canvasHint');
      const cursor = $('#brushCursor');
      const penBtn = $('#penBtn');
      const eraserBtn = $('#eraserBtn');
      const undoBtn = $('#undoBtn');
      const redoBtn = $('#redoBtn');
      const clearBtn = $('#clearBtn');
      const bgBtn = $('#bgToggleBtn');
      const sizeInput = $('#brushSize');
      const sizeDot = $('#sizeDot');
      const colorInput = $('#brushColor');
      const swatches = $$('.swatch[data-color]');
      const customSwatch = $('#customSwatch');
      const sendBtn = $('#sendDrawingBtn');
      const status = $('#drawingStatus');

      canvas.width = W;
      canvas.height = H;

      let history = [];   // { type: 'stroke', mode, color, points: [[x, y, width], …] } | { type: 'clear' }
      let redoStack = [];
      let tool = 'pen';
      let color = '#ffffff';
      let size = Number(sizeInput.value) || 4;
      let whiteBg = false;
      let active = null;
      let activePointer = null;
      let rect = null;

      /* ---------- painting ---------- */
      const setStyle = (s) => {
        ctx.globalCompositeOperation = s.mode === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      };

      const dot = (s) => {
        const [x, y, w] = s.points[0];
        ctx.beginPath();
        ctx.arc(x, y, w / 2, 0, Math.PI * 2);
        ctx.fill();
      };

      // Smooth curve through the midpoints between samples
      const segment = (s, i) => {
        const p = s.points;
        const [x0, y0, w0] = p[i - 1];
        const [x1, y1, w1] = p[i];
        ctx.lineWidth = (w0 + w1) / 2;
        ctx.beginPath();
        if (i === 1) {
          ctx.moveTo(x0, y0);
        } else {
          const [xp, yp] = p[i - 2];
          ctx.moveTo((xp + x0) / 2, (yp + y0) / 2);
        }
        if (i === 1) ctx.lineTo((x0 + x1) / 2, (y0 + y1) / 2);
        else ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        ctx.stroke();
      };

      const tail = (s) => {
        const p = s.points;
        const n = p.length;
        if (n < 2) return;
        const [x0, y0] = p[n - 2];
        const [x1, y1, w1] = p[n - 1];
        ctx.lineWidth = w1;
        ctx.beginPath();
        ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      };

      const paintStroke = (s) => {
        setStyle(s);
        dot(s);
        for (let i = 1; i < s.points.length; i++) segment(s, i);
        tail(s);
      };

      const redraw = () => {
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, W, H);
        for (const action of history) {
          if (action.type === 'clear') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, W, H);
          } else {
            paintStroke(action);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      };

      /* ---------- state ---------- */
      const isEmpty = () => {
        let start = 0;
        history.forEach((a, i) => { if (a.type === 'clear') start = i + 1; });
        return !history.slice(start).some((a) => a.type === 'stroke' && a.mode === 'pen');
      };

      const refresh = () => {
        undoBtn.disabled = history.length === 0;
        redoBtn.disabled = redoStack.length === 0;
        clearBtn.disabled = isEmpty();
        hint.classList.toggle('is-hidden', !isEmpty() || !!active);
      };

      const commit = (action) => {
        history.push(action);
        redoStack = [];
        refresh();
      };

      const undo = () => {
        if (!history.length) return;
        redoStack.push(history.pop());
        redraw();
        refresh();
      };

      const redo = () => {
        if (!redoStack.length) return;
        history.push(redoStack.pop());
        redraw();
        refresh();
      };

      const clear = () => {
        if (isEmpty()) return;
        commit({ type: 'clear' });
        redraw();
      };

      const reset = () => {
        history = [];
        redoStack = [];
        redraw();
        refresh();
      };

      /* ---------- pointer input (mouse, touch and pen) ---------- */
      const toPoint = (e) => {
        const x = (e.clientX - rect.left) * (W / rect.width);
        const y = (e.clientY - rect.top) * (H / rect.height);
        let w = size * SCALE;
        if (e.pointerType === 'pen' && e.pressure > 0) w *= 0.35 + e.pressure * 1.3;
        return [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(w * 10) / 10];
      };

      canvas.addEventListener('pointerdown', (e) => {
        if (activePointer !== null || Void.sending) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        activePointer = e.pointerId;
        canvas.setPointerCapture?.(e.pointerId);
        rect = canvas.getBoundingClientRect();
        active = { type: 'stroke', mode: tool, color, points: [toPoint(e)] };
        setStyle(active);
        dot(active);
        wrap.classList.add('is-drawing');
        hint.classList.add('is-hidden');
      });

      canvas.addEventListener('pointermove', (e) => {
        moveCursor(e);
        if (e.pointerId !== activePointer || !active) return;
        const samples = e.getCoalescedEvents?.() || [];
        setStyle(active);
        for (const ev of samples.length ? samples : [e]) {
          const pt = toPoint(ev);
          const lastPt = active.points[active.points.length - 1];
          if (Math.hypot(pt[0] - lastPt[0], pt[1] - lastPt[1]) < 1.5) continue;
          active.points.push(pt);
          segment(active, active.points.length - 1);
        }
      });

      const finish = (e) => {
        if (e.pointerId !== activePointer) return;
        if (active) {
          setStyle(active);
          tail(active);
          ctx.globalCompositeOperation = 'source-over';
          const done = active;
          active = null;
          commit(done);
        }
        activePointer = null;
        wrap.classList.remove('is-drawing');
      };
      canvas.addEventListener('pointerup', finish);
      canvas.addEventListener('pointercancel', finish);

      /* ---------- brush preview (mouse only) ---------- */
      function moveCursor(e) {
        if (e.pointerType !== 'mouse') {
          cursor.classList.remove('is-visible');
          return;
        }
        const r = rect && activePointer !== null ? rect : canvas.getBoundingClientRect();
        const d = Math.max(4, size * SCALE * (r.width / W));
        cursor.style.width = `${d}px`;
        cursor.style.height = `${d}px`;
        cursor.style.transform = `translate(${e.clientX - r.left - d / 2}px, ${e.clientY - r.top - d / 2}px)`;
        cursor.classList.add('is-visible');
      }
      canvas.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));

      /* ---------- toolbar ---------- */
      const setTool = (next) => {
        tool = next;
        penBtn.classList.toggle('is-active', next === 'pen');
        eraserBtn.classList.toggle('is-active', next === 'eraser');
        penBtn.setAttribute('aria-pressed', String(next === 'pen'));
        eraserBtn.setAttribute('aria-pressed', String(next === 'eraser'));
        cursor.classList.toggle('is-eraser', next === 'eraser');
      };

      const setColor = (value) => {
        color = value.toLowerCase();
        colorInput.value = color;
        let matched = false;
        swatches.forEach((s) => {
          const on = s.dataset.color.toLowerCase() === color;
          s.classList.toggle('is-active', on);
          s.setAttribute('aria-pressed', String(on));
          if (on) matched = true;
        });
        customSwatch.classList.toggle('is-active', !matched);
        customSwatch.style.setProperty('--picked', matched ? 'transparent' : color);
        sizeDot.style.color = color;
        setTool('pen');
      };

      const setSize = (value) => {
        size = Number(value);
        const px = Math.max(3, Math.min(18, size * 0.6 + 2));
        sizeDot.style.setProperty('--s', `${px}px`);
      };

      penBtn.addEventListener('click', () => setTool('pen'));
      eraserBtn.addEventListener('click', () => setTool('eraser'));
      undoBtn.addEventListener('click', undo);
      redoBtn.addEventListener('click', redo);
      clearBtn.addEventListener('click', clear);
      sizeInput.addEventListener('input', () => setSize(sizeInput.value));
      colorInput.addEventListener('input', () => setColor(colorInput.value));
      swatches.forEach((s) => s.addEventListener('click', () => setColor(s.dataset.color)));

      bgBtn.addEventListener('click', () => {
        whiteBg = !whiteBg;
        wrap.classList.toggle('is-white', whiteBg);
        bgBtn.classList.toggle('is-active', whiteBg);
        bgBtn.setAttribute('aria-pressed', String(whiteBg));
        if (whiteBg && color === '#ffffff') setColor('#000000');
        else if (!whiteBg && color === '#000000') setColor('#ffffff');
      });

      // Ctrl/Cmd + Z, Ctrl/Cmd + Shift + Z (or Y) while the canvas is on screen
      document.addEventListener('keydown', (e) => {
        if (!(e.metaKey || e.ctrlKey) || !canvas.offsetParent) return;
        if (e.target.closest('input, textarea, [contenteditable]')) return;
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
      });

      /* ---------- sending ---------- */
      // The PNG gets the background colour baked in, so black-on-white
      // drawings don't turn invisible in Discord.
      const exportPng = () => new Promise((resolve, reject) => {
        const out = document.createElement('canvas');
        out.width = W;
        out.height = H;
        const o = out.getContext('2d');
        o.fillStyle = whiteBg ? BG_LIGHT : BG_DARK;
        o.fillRect(0, 0, W, H);
        o.drawImage(canvas, 0, 0);
        out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('export failed'))), 'image/png');
      });

      const say = (msg, tone = '') => {
        status.textContent = msg;
        status.dataset.tone = tone;
      };

      sendBtn.addEventListener('click', async () => {
        if (Void.sending) return;
        if (isEmpty()) {
          say('Draw something first.', 'error');
          wrap.classList.remove('is-nudged');
          void wrap.offsetWidth;
          wrap.classList.add('is-nudged');
          return;
        }

        Void.sending = true;
        say('');
        sendBtn.disabled = true;
        sendBtn.classList.add('is-busy');
        Void.buttonLabel(sendBtn, 'Sending…');

        try {
          const blob = await exportPng();
          await Void.api.sendDrawing(blob);
          reset();
          sendBtn.classList.remove('is-busy');
          sendBtn.classList.add('is-done');
          Void.buttonLabel(sendBtn, 'Sent! 🎨✨');
          if (Void.config.preview) say('Preview: nothing was actually sent.', 'ok');
          await Promise.all([Void.warp.start('send'), Void.wait(1800)]);
        } catch (err) {
          sendBtn.classList.remove('is-busy');
          sendBtn.classList.add('is-error');
          Void.buttonLabel(sendBtn, 'Failed to send ❌');
          say(Void.describeError(err, 'Discord'), 'error');
          await Void.wait(1600);
        } finally {
          Void.resetButton(sendBtn);
          Void.sending = false;
        }
      });

      // for tests and the console
      Void.drawing.isEmpty = isEmpty;
      Void.drawing.exportPng = exportPng;

      setSize(size);
      setColor(color);
      refresh();
    }
  };
})();
