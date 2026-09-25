/*
 * Animated sunset / night sky, drawn entirely in code on a <canvas>.
 * Layers (back to front): sky gradient, stars, moon, sun + rays, clouds,
 * bloom, birds, mountain ridges with haze, floating motes.
 * Parallax comes from pointer position and page scroll; scrolling also sinks
 * the sun. Switching to the dark theme sets the sun and raises the moon.
 */
(function () {
  "use strict";

  var canvas = document.getElementById("sky");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var darkMQ = window.matchMedia("(prefers-color-scheme: dark)");

  /* ---------- helpers ---------- */
  function rng(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t, alpha) {
    var r = Math.round(a[0] + (b[0] - a[0]) * t);
    var g = Math.round(a[1] + (b[1] - a[1]) * t);
    var bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return alpha == null ? "rgb(" + r + "," + g + "," + bl + ")" : "rgba(" + r + "," + g + "," + bl + "," + alpha + ")";
  }
  function pair(a, b) { return [hex(a), hex(b)]; }

  // 1D value noise + fractal sum, used for mountain silhouettes
  function hash(i, s) { var x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); }
  function noise(x, s) {
    var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return hash(i, s) * (1 - u) + hash(i + 1, s) * u;
  }
  function fbm(x, s, ridged) {
    var v = 0, a = 0.5, f = 1;
    for (var o = 0; o < 5; o++) {
      var n = noise(x * f, s + o * 17);
      if (ridged) n = 1 - Math.abs(n * 2 - 1);
      v += a * n; a *= 0.5; f *= 2.03;
    }
    return v;
  }

  /* ---------- palette: [sunset, night] ---------- */
  var SKY_STOPS = [0, 0.26, 0.46, 0.6, 0.7, 0.84];
  var SKY = [
    pair("#1b1947", "#03050f"),
    pair("#4b2a70", "#0a1133"),
    pair("#b3456f", "#15214d"),
    pair("#ee7658", "#223263"),
    pair("#ffb168", "#333e6e"),
    pair("#ffdc9c", "#474474")
  ];
  var HAZE = pair("#ff9f80", "#2c3465");
  var RIDGE_LIGHT = pair("#ffcf9a", "#8e9ad0");

  var LAYERS = [
    { base: 0.555, amp: 0.17, freq: 0.0022, seed: 3,  ridged: true,  depth: 0.12, color: pair("#c0587e", "#232a52") },
    { base: 0.61,  amp: 0.15, freq: 0.0032, seed: 7,  ridged: true,  depth: 0.25, color: pair("#8e3f70", "#1a2044") },
    { base: 0.675, amp: 0.12, freq: 0.0046, seed: 11, ridged: false, depth: 0.45, color: pair("#5e2a5c", "#131836") },
    { base: 0.75,  amp: 0.10, freq: 0.0062, seed: 19, ridged: false, depth: 0.7,  color: pair("#35183f", "#0c1027") },
    { base: 0.84,  amp: 0.08, freq: 0.0082, seed: 23, ridged: false, depth: 1.0,  color: pair("#1a0c22", "#06070f") }
  ];

  /* ---------- state ---------- */
  var W = 0, H = 0, S = 1, DPR = 1;
  var p = isDark() ? 1 : 0;           // 0 = sunset, 1 = night
  var target = p;
  var intro = reduce ? 1 : 0;         // sunrise-on-load animation
  var mx = 0, my = 0, tmx = 0, tmy = 0;
  var last = 0, frameNo = 0;

  function isDark() {
    var th = root.getAttribute("data-theme");
    return th ? th === "dark" : darkMQ.matches;
  }

  /* ---------- clouds (pre-rendered sprites) ---------- */
  function makeCloud(seed) {
    var r = rng(seed);
    var w = 240 + r() * 420, h = w * (0.26 + r() * 0.14);
    var pad = h * 0.7;
    var cw = Math.ceil(w + pad * 2), ch = Math.ceil(h + pad * 2);
    var bottom = pad + h;

    var mask = document.createElement("canvas");
    mask.width = cw; mask.height = ch;
    var g = mask.getContext("2d");
    var n = 24 + ((r() * 18) | 0);
    for (var i = 0; i < n; i++) {
      var u = r(), hump = Math.sin(Math.PI * u);
      var pr = h * (0.16 + 0.34 * hump * (0.55 + 0.45 * r()));
      var px = pad + w * u;
      var py = bottom - pr * 0.72 - hump * h * 0.4 * r();
      var rg = g.createRadialGradient(px, py, 0, px, py, pr);
      rg.addColorStop(0, "rgba(0,0,0,1)");
      rg.addColorStop(0.55, "rgba(0,0,0,0.9)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rg;
      g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
    }

    function paint(stops, rim) {
      var c = document.createElement("canvas");
      c.width = cw; c.height = ch;
      var k = c.getContext("2d");
      k.drawImage(mask, 0, 0);
      k.globalCompositeOperation = "source-in";
      var lg = k.createLinearGradient(0, pad * 0.2, 0, bottom);
      stops.forEach(function (s) { lg.addColorStop(s[0], s[1]); });
      k.fillStyle = lg; k.fillRect(0, 0, cw, ch);
      // light spilling up onto the cloud's underside
      k.globalCompositeOperation = "source-atop";
      var rl = k.createLinearGradient(0, bottom - h * 0.45, 0, bottom + pad * 0.3);
      rl.addColorStop(0, "rgba(0,0,0,0)");
      rl.addColorStop(1, rim);
      k.fillStyle = rl; k.fillRect(0, 0, cw, ch);
      return c;
    }

    return {
      day: paint([[0, "#7e4b8a"], [0.5, "#dd7f8e"], [1, "#ffc596"]], "rgba(255,226,170,0.85)"),
      night: paint([[0, "#10152c"], [0.6, "#262e57"], [1, "#46507f"]], "rgba(150,165,220,0.45)"),
      w: cw, h: ch
    };
  }

  var clouds = [];
  (function initClouds() {
    var r = rng(42);
    for (var i = 0; i < 15; i++) {
      var d = 0.12 + r() * 0.88;
      clouds.push({
        sprite: makeCloud(1000 + i * 77),
        depth: d,
        x: r(),                                       // 0..1 of travel span
        y: 0.42 - d * 0.34 + (r() - 0.5) * 0.08,     // near clouds sit higher
        speed: 5 + d * 16
      });
    }
    clouds.sort(function (a, b) { return a.depth - b.depth; });
  })();

  /* ---------- stars, motes, birds ---------- */
  var stars = [];
  (function () {
    var r = rng(9);
    for (var i = 0; i < 260; i++) {
      stars.push({ x: r(), y: Math.pow(r(), 1.4) * 0.62, s: r() < 0.9 ? 0.6 + r() * 0.9 : 1.6 + r(), ph: r() * 6.28, sp: 0.6 + r() * 2.2 });
    }
  })();

  function glowSprite(rgb) {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var k = c.getContext("2d");
    var g = k.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(" + rgb + ",1)");
    g.addColorStop(0.25, "rgba(" + rgb + ",0.55)");
    g.addColorStop(1, "rgba(" + rgb + ",0)");
    k.fillStyle = g; k.fillRect(0, 0, 64, 64);
    return c;
  }
  var dustGlow = glowSprite("255,214,160");
  var flyGlow = glowSprite("200,255,150");

  var motes = [];
  (function () {
    var r = rng(5);
    for (var i = 0; i < 42; i++) {
      motes.push({ x: r(), y: 0.5 + r() * 0.5, vy: 0.006 + r() * 0.016, ph: r() * 6.28, sz: 4 + r() * 10, bl: 0.5 + r() * 2 });
    }
  })();

  // [rank behind the leader, side of the V]
  var FLOCK = [[0, 0], [1, -1], [1, 1], [2, -1], [2, 1], [3, -1], [3.2, 1]];
  var shooting = null;

  /* ---------- sizing & input ---------- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    S = clamp(W / 1400, 0.5, 1.3);
    requestRender();
  }

  window.addEventListener("pointermove", function (e) {
    tmx = (e.clientX / W) * 2 - 1;
    tmy = (e.clientY / H) * 2 - 1;
  }, { passive: true });

  function onScroll() {
    root.style.setProperty("--scroll", Math.min(window.scrollY, H * 1.5).toFixed(1));
    requestRender();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", resize);

  function themeChanged() {
    target = isDark() ? 1 : 0;
    if (reduce) p = target;
    requestRender();
  }
  new MutationObserver(themeChanged).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  if (darkMQ.addEventListener) darkMQ.addEventListener("change", themeChanged);

  /* ---------- drawing ---------- */
  function drawSky(pc) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    for (var i = 0; i < SKY.length; i++) g.addColorStop(SKY_STOPS[i], mix(SKY[i][0], SKY[i][1], pc));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars(t, a, ox, oy) {
    if (a <= 0.01) return;
    ctx.fillStyle = "#fff";
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var tw = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t * st.sp + st.ph);
      ctx.globalAlpha = a * tw * (1 - st.y * 0.9);
      var x = st.x * W + ox * 0.05, y = st.y * H + oy * 0.05;
      ctx.fillRect(x, y, st.s, st.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawShootingStar(dt, a) {
    if (reduce) return;
    if (!shooting && a > 0.7 && Math.random() < dt / 4) {
      shooting = { x: W * (0.3 + Math.random() * 0.7), y: H * Math.random() * 0.25, vx: -(600 + Math.random() * 400), vy: 260 + Math.random() * 160, life: 0 };
    }
    if (!shooting) return;
    var s = shooting;
    s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
    var fade = Math.sin(Math.PI * clamp(s.life / 0.9, 0, 1));
    var tx = s.x - s.vx * 0.12, ty = s.y - s.vy * 0.12;
    var g = ctx.createLinearGradient(s.x, s.y, tx, ty);
    g.addColorStop(0, "rgba(255,255,255," + 0.9 * fade * a + ")");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty); ctx.stroke();
    if (s.life > 0.9) shooting = null;
  }

  function drawMoon(a, x, y, R) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    var g = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 7);
    g.addColorStop(0, "rgba(200,215,255,0.35)");
    g.addColorStop(1, "rgba(200,215,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - R * 7, y - R * 7, R * 14, R * 14);
    var d = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, 0, x - R * 0.35, y - R * 0.35, R * 1.7);
    d.addColorStop(0, "#fbfaf2");
    d.addColorStop(1, "#d6d4c8");
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(120,120,110,0.16)";
    [[0.3, -0.2, 0.22], [-0.35, 0.25, 0.16], [0.1, 0.45, 0.12], [-0.2, -0.45, 0.1]].forEach(function (c) {
      ctx.beginPath(); ctx.arc(x + c[0] * R, y + c[1] * R, c[2] * R, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  function drawSun(t, a, x, y, R) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    // wide atmospheric glow
    var gr = Math.max(W, H) * 0.8;
    var g = ctx.createRadialGradient(x, y, R * 0.5, x, y, gr);
    g.addColorStop(0, "rgba(255,222,160,0.95)");
    g.addColorStop(0.07, "rgba(255,180,115,0.55)");
    g.addColorStop(0.28, "rgba(255,120,95,0.2)");
    g.addColorStop(1, "rgba(255,100,100,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // slowly turning god rays
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(x, y);
    ctx.rotate(reduce ? 0.3 : t * 0.025);
    var N = 16;
    for (var i = 0; i < N; i++) {
      ctx.rotate((Math.PI * 2) / N);
      var len = H * (0.55 + 0.3 * Math.sin(i * 1.7 + t * 0.35));
      var wd = 0.045 + 0.03 * Math.sin(i * 2.3 + t * 0.2);
      var lg = ctx.createLinearGradient(0, 0, len, 0);
      lg.addColorStop(0, "rgba(255,205,150,0.11)");
      lg.addColorStop(1, "rgba(255,205,150,0)");
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -len * wd); ctx.lineTo(len, len * wd); ctx.closePath(); ctx.fill();
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    // disc with a gently pulsing corona
    var pulse = reduce ? 1 : 1 + 0.04 * Math.sin(t * 1.3);
    var c = ctx.createRadialGradient(x, y, 0, x, y, R * 1.6 * pulse);
    c.addColorStop(0, "rgba(255,250,225,1)");
    c.addColorStop(0.55, "rgba(255,236,180,1)");
    c.addColorStop(0.62, "rgba(255,196,120,0.75)");
    c.addColorStop(1, "rgba(255,160,100,0)");
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y, R * 1.6 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawClouds(dt, pc, s) {
    var span = W * 1.4;
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      if (!reduce) c.x += (c.speed * S * dt) / span;
      if (c.x > 1) c.x -= 1;
      var sc = (0.35 + 0.85 * c.depth) * S;
      var w = c.sprite.w * sc, h = c.sprite.h * sc;
      var x = c.x * (span + w) - w - mx * c.depth * 50 * S;
      var y = c.y * H - h * 0.6 - s * c.depth * 0.18 - my * c.depth * 12;
      var base = 0.55 + 0.45 * c.depth;
      if (pc < 0.99) { ctx.globalAlpha = base * (1 - pc); ctx.drawImage(c.sprite.day, x, y, w, h); }
      if (pc > 0.01) { ctx.globalAlpha = base * pc; ctx.drawImage(c.sprite.night, x, y, w, h); }
    }
    ctx.globalAlpha = 1;
  }

  function drawBloom(a, x, y) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = a * 0.35;
    var g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * 0.45);
    g.addColorStop(0, "rgba(255,210,150,1)");
    g.addColorStop(1, "rgba(255,150,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawBirds(t, a, s) {
    if (a <= 0.02) return;
    var period = 42;
    var k = ((t % period) / period);
    var gx = -0.15 * W + k * W * 1.3 - mx * 20 * S;
    var gy = H * 0.3 + Math.sin(t * 0.5) * 12 - s * 0.1 - my * 6;
    var size = 11 * S + 4;
    ctx.save();
    ctx.strokeStyle = "rgba(40,18,48," + 0.8 * a + ")";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    for (var i = 0; i < FLOCK.length; i++) {
      var rank = FLOCK[i][0], side = FLOCK[i][1];
      var bx = gx - rank * size * 2.4 + Math.sin(t * 0.9 + i * 2) * 4;
      var by = gy + side * rank * size * 1.3 + Math.sin(t * 1.3 + i) * 3;
      var f = reduce ? 0.3 : Math.sin(t * 9 + i * 1.3);
      ctx.beginPath();
      ctx.moveTo(bx - size, by - f * size * 0.55);
      ctx.quadraticCurveTo(bx - size * 0.45, by - size * 0.25 - f * size * 0.15, bx, by);
      ctx.quadraticCurveTo(bx + size * 0.45, by - size * 0.25 - f * size * 0.15, bx + size, by - f * size * 0.55);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMountains(pc, s) {
    var step = Math.max(3, W / 260);
    var hazeA = 0.22 * (1 - pc * 0.4);
    for (var li = 0; li < LAYERS.length; li++) {
      var L = LAYERS[li];
      var ox = mx * L.depth * 60 * S + 4000 * L.depth;
      var oy = -s * L.depth * 0.32 - my * L.depth * 14;
      var pts = [];
      for (var x = -step; x <= W + step; x += step) {
        var n = fbm(((x + ox) / S) * L.freq, L.seed, L.ridged);
        pts.push(x, H * L.base - n * H * L.amp + oy);
      }
      ctx.beginPath();
      ctx.moveTo(-step, H + 2);
      for (var i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.lineTo(W + step, H + 2);
      ctx.closePath();
      ctx.fillStyle = mix(L.color[0], L.color[1], pc);
      ctx.fill();

      // rim light on the far ridges
      if (li < 3) {
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (var j = 2; j < pts.length; j += 2) ctx.lineTo(pts[j], pts[j + 1]);
        ctx.strokeStyle = mix(RIDGE_LIGHT[0], RIDGE_LIGHT[1], pc, 0.28 - li * 0.08);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // atmospheric haze between ranges
      if (li < LAYERS.length - 1) {
        var top = H * (L.base - L.amp * 0.6) + oy;
        var hg = ctx.createLinearGradient(0, top, 0, H * (L.base + 0.08) + oy);
        hg.addColorStop(0, mix(HAZE[0], HAZE[1], pc, 0));
        hg.addColorStop(1, mix(HAZE[0], HAZE[1], pc, hazeA));
        ctx.fillStyle = hg;
        ctx.fillRect(0, top, W, H - top);
      }
    }
  }

  function drawMotes(t, dt, pc, s) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      if (!reduce) {
        m.y -= m.vy * dt;
        if (m.y < 0.45) { m.y = 1.02; m.x = Math.random(); }
      }
      var x = m.x * W + Math.sin(t * 0.6 + m.ph) * 18 - mx * 70 * S;
      var y = m.y * H - s * 0.35 - my * 16;
      var blink = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(t * m.bl + m.ph);
      var sz = m.sz * (0.7 + 0.5 * S);
      if (pc < 0.99) {
        ctx.globalAlpha = 0.28 * blink * (1 - pc);
        ctx.drawImage(dustGlow, x - sz, y - sz, sz * 2, sz * 2);
      }
      if (pc > 0.01) {
        ctx.globalAlpha = Math.pow(blink, 3) * pc;
        ctx.drawImage(flyGlow, x - sz, y - sz, sz * 2, sz * 2);
      }
    }
    ctx.restore();
  }

  function render(t, dt) {
    var s = Math.min(window.scrollY, H * 1.2);
    var pc = clamp(p + (s / H) * 0.3, 0, 1);   // scrolling deepens the dusk
    var ei = 1 - Math.pow(1 - intro, 3);

    var R = clamp(Math.min(W, H) * 0.075, 34, 110);
    var sunX = W * 0.68 - mx * 14 * S;
    var sunY = H * (0.4 + p * 0.5) + (1 - ei) * H * 0.35 + s * 0.38 - my * 6;
    var moonX = W * (W < 700 ? 0.72 : 0.78) - mx * 10 * S;
    var moonY = H * (0.24 + (1 - p) * 0.7) + s * 0.12 - my * 5;
    var sunA = clamp(1 - p * 1.1, 0, 1);

    drawSky(pc);
    drawStars(t, smooth(0.35, 0.95, pc) * ei, -mx * 20, -my * 20);
    drawShootingStar(dt, smooth(0.6, 1, p));
    drawMoon(smooth(0.25, 0.9, p) * ei, moonX, moonY, R * 0.8);
    drawSun(t, sunA, sunX, sunY, R);
    ctx.globalAlpha = ei;
    drawClouds(dt, pc, s);
    ctx.globalAlpha = 1;
    drawBloom(sunA * smooth(1.2, 0.3, sunY / H), sunX, sunY);
    drawBirds(t, (1 - pc) * ei, s);
    drawMountains(pc, s);
    drawMotes(t, dt, pc, s);
  }

  /* ---------- loop ---------- */
  var pending = false;
  function requestRender() {
    if (!reduce || pending) return;
    pending = true;
    requestAnimationFrame(function (now) { pending = false; render(now / 1000, 0); });
  }

  function frame(now) {
    var t = now / 1000;
    var dt = last ? Math.min(0.05, t - last) : 0.016;
    last = t;
    p += (target - p) * (1 - Math.exp(-dt * 1.2));
    if (Math.abs(target - p) < 0.001) p = target;
    intro = Math.min(1, intro + dt / 2.6);
    mx += (tmx - mx) * (1 - Math.exp(-dt * 2.5));
    my += (tmy - my) * (1 - Math.exp(-dt * 2.5));
    // mostly hidden behind the content sheet: draw every other frame
    if (window.scrollY < H * 1.4 || (frameNo++ & 1) === 0) render(t, dt);
    requestAnimationFrame(frame);
  }

  resize();
  onScroll();
  if (reduce) requestRender();
  else requestAnimationFrame(frame);
})();
