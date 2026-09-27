/* ==========================================================
   sky.js — the dream's sky and sea, painted by one shader
   · a hazy night sky over a sea that mirrors it
   · two moons (a big pale one, a small one in the song's colour)
   · stars, drifting haze, a path of moonlight on the water
   · the sky swirls around the cursor; clicks send rings through it
   · film grain, vignette, a warm light leak in the corner
   Rendered at a fraction of the screen size (it's all soft
   anyway) and it lowers that further if the device struggles.
   Without WebGL, a CSS gradient in the same colours is used.

   Also runs the one animation loop the dream uses:
   Void.dream.onFrame((t, dt) => …)
   ========================================================== */
(() => {
  const Void = window.Void;
  const palette = Void.dream.palette;
  const html = document.documentElement;
  const canvas = document.getElementById('sky');

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uMouseAmt;
    uniform vec3 uSky;
    uniform vec3 uHorizon;
    uniform vec3 uGlow;
    uniform vec3 uAccent;
    uniform float uFocus;
    uniform float uHorizonY;
    uniform vec2 uMoon;
    uniform float uMoonR;
    uniform vec4 uRipple[3];

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = r * p * 2.03 + vec2(17.0, 9.0);
        a *= 0.5;
      }
      return v;
    }

    vec3 sky(vec2 p, float t) {
      float h = clamp((p.y - uHorizonY) / 0.62, 0.0, 1.0);
      vec3 col = mix(uHorizon, uSky, smoothstep(0.0, 1.0, pow(h, 0.7)));

      // haze: slow domain-warped clouds, thicker near the horizon
      vec2 q = p * vec2(1.5, 2.6);
      vec2 w = vec2(fbm(q + vec2(t * 0.03, 0.0)), fbm(q + vec2(4.1, 1.7) - vec2(0.0, t * 0.02)));
      float cloud = fbm(q * 0.9 + 2.2 * w + vec2(-t * 0.035, t * 0.01));
      float thick = smoothstep(0.42, 0.86, cloud) * (0.3 + 0.7 * (1.0 - h));
      col = mix(col, mix(uAccent, uGlow, smoothstep(0.5, 0.95, cloud)), thick * 0.42);

      // stars, only where the sky is clear
      vec2 sp = p * 95.0;
      float s = hash(floor(sp));
      if (s > 0.984) {
        vec2 c = fract(sp) - 0.5;
        float twinkle = 0.55 + 0.45 * sin(t * (1.2 + s * 3.0) + s * 40.0);
        col += uGlow * smoothstep(0.14, 0.0, length(c)) * twinkle * h * (1.0 - thick);
      }

      // two moons: a big pale one, and a small one in the song's colour
      vec2 m = p - uMoon;
      float d = length(m);
      float R = uMoonR;
      col += uGlow * (exp(-d * d / (R * R * 7.0)) * 0.5 + exp(-d * 4.5) * 0.13);
      if (d < R * 1.05) {
        float surface = 0.88 + 0.12 * fbm(m * 22.0 + 3.0);
        col = mix(col, uGlow * surface, smoothstep(R, R - 0.003, d));
      }
      vec2 m2 = p - (uMoon + vec2(-R * 2.6, -R * 1.5));
      float d2 = length(m2);
      float R2 = R * 0.34;
      vec3 small = mix(uAccent, uGlow, 0.35);
      col += small * exp(-d2 * d2 / (R2 * R2 * 9.0)) * 0.35;
      col = mix(col, small, smoothstep(R2, R2 - 0.002, d2) * 0.95);
      return col;
    }

    vec3 sea(vec2 p, float horizon, float t) {
      float depth = horizon - p.y;
      float persp = 0.06 / (depth + 0.06);
      vec2 wave = vec2(
        noise(vec2(p.x * 8.0 * persp, depth * 70.0 * persp - t * 0.9)),
        noise(vec2(p.x * 6.0 * persp + 7.0, depth * 50.0 * persp - t * 0.7)));
      vec2 rp = vec2(p.x + (wave.x - 0.5) * 0.05 * (1.0 - 0.5 * persp),
                     horizon + depth + (wave.y - 0.5) * 0.035);
      vec3 col = sky(rp, t) * 0.55;

      // the moon's path of light on the water
      float across = (p.x - uMoon.x) * (3.0 + depth * 7.0);
      float path = exp(-across * across);
      float sparkle = noise(vec2(p.x * 55.0, depth * 150.0 - t * 2.4)) * 0.6
                    + noise(vec2(p.x * 140.0, depth * 340.0 - t * 3.2)) * 0.4;
      float glint = smoothstep(0.6, 0.92, sparkle);
      col += uGlow * glint * path * 0.85;

      col = mix(col, uSky * 0.6, smoothstep(0.0, 0.45, depth) * 0.55);
      return col;
    }

    void main() {
      float t = uTime;
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

      // the sky swirls a little around the cursor
      vec2 m = (uMouse - 0.5 * uRes) / uRes.y;
      vec2 dm = p - m;
      float ang = exp(-dot(dm, dm) * 24.0) * uMouseAmt * 0.32;
      float ca = cos(ang);
      float sa = sin(ang);
      p = m + mat2(ca, sa, -sa, ca) * dm;

      // rings where you clicked
      for (int i = 0; i < 3; i++) {
        vec4 r = uRipple[i];
        float age = t - r.z;
        if (age > 0.0 && age < 3.0) {
          vec2 dr = p - (r.xy - 0.5 * uRes) / uRes.y;
          float dist = length(dr);
          float edge = (dist - age * 0.32) * 26.0;
          float ring = exp(-edge * edge) * (1.0 - age / 3.0) * r.w;
          p += (dr / max(dist, 0.0001)) * ring * 0.014;
        }
      }

      float horizon = uHorizonY + 0.004 * sin(p.x * 9.0 + t * 0.4);
      vec3 col = p.y > horizon ? sky(p, t) : sea(p, horizon, t);

      // a thin line of light along the horizon
      col += uGlow * exp(-abs(p.y - horizon) * 90.0) * 0.16;

      // warm light leaking in from a corner, breathing slowly
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 lk = (uv - vec2(1.05 + 0.08 * sin(t * 0.07), -0.05)) * vec2(1.4, 1.0);
      col += uGlow * exp(-length(lk) * 2.4) * 0.14;

      // calmer and darker while a room is open
      col = mix(col, col * 0.5 + uSky * 0.28, uFocus * 0.85);

      // vignette and film grain
      vec2 v = uv - 0.5;
      col *= 1.0 - 0.88 * dot(v, v);
      col += (hash(gl_FragCoord.xy + fract(t * 7.0) * 311.0) - 0.5) * 0.05;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* ---------- the one loop ---------- */
  const listeners = [];
  Void.dream.onFrame = (fn) => listeners.push(fn);

  /* ---------- state ---------- */
  let gl = null;
  let program = null;
  let loc = {};
  const BUDGET = 380000;     // pixels drawn per frame: the same on a phone and a big monitor
  let quality = 1;           // lowered if the device struggles
  let scale = 0.5;           // render size as a fraction of CSS pixels
  let W = 0;
  let H = 0;
  let focus = 0;
  let focusTarget = 0;
  let mouse = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45, amt: 0, tamt: 0 };
  const ripples = new Float32Array(12);
  let rippleSlot = 0;
  let clock = 0;
  let last = 0;
  let slowFrames = 0;
  let frames = 0;

  const reduced = () => html.classList.contains('reduce-motion');

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader failed');
    return s;
  }

  function setup() {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' })
      || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('no WebGL');
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'link failed');
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    ['uRes', 'uTime', 'uMouse', 'uMouseAmt', 'uSky', 'uHorizon', 'uGlow', 'uAccent', 'uFocus', 'uHorizonY', 'uMoon', 'uMoonR', 'uRipple']
      .forEach((name) => { loc[name] = gl.getUniformLocation(program, name); });
  }

  function resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    scale = Math.min(1, Math.sqrt(BUDGET / (cssW * cssH))) * quality;
    W = Math.max(64, Math.round(cssW * scale));
    H = Math.max(64, Math.round(cssH * scale));
    canvas.width = W;
    canvas.height = H;
    if (gl) gl.viewport(0, 0, W, H);
  }

  // where the horizon and the moons sit, depending on the screen's shape
  function layout() {
    const aspect = W / H;
    if (aspect < 0.8) return { horizon: -0.2, moon: [aspect / 2 - 0.13, 0.33], r: 0.058 };
    return { horizon: -0.12, moon: [Math.min(0.37, aspect / 2 - 0.17), 0.25], r: 0.072 };
  }

  function draw() {
    const c = palette.current;
    const lay = layout();
    gl.uniform2f(loc.uRes, W, H);
    gl.uniform1f(loc.uTime, clock);
    gl.uniform2f(loc.uMouse, mouse.x * W, (1 - mouse.y) * H);
    gl.uniform1f(loc.uMouseAmt, mouse.amt);
    gl.uniform3fv(loc.uSky, c.sky);
    gl.uniform3fv(loc.uHorizon, c.horizon);
    gl.uniform3fv(loc.uGlow, c.glow);
    gl.uniform3fv(loc.uAccent, c.accent);
    gl.uniform1f(loc.uFocus, focus);
    gl.uniform1f(loc.uHorizonY, lay.horizon);
    gl.uniform2f(loc.uMoon, lay.moon[0], lay.moon[1]);
    gl.uniform1f(loc.uMoonR, lay.r);
    gl.uniform4fv(loc.uRipple, ripples);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;

    // reduced motion: time stands still, only colours glide
    if (!reduced()) clock += dt;

    const k = 1 - Math.exp(-dt / 0.25);
    mouse.x += (mouse.tx - mouse.x) * k;
    mouse.y += (mouse.ty - mouse.y) * k;
    mouse.amt += (mouse.tamt - mouse.amt) * (1 - Math.exp(-dt / 0.6));
    focus += (focusTarget - focus) * (1 - Math.exp(-dt / 0.5));

    palette.tick(dt);
    if (gl) draw();
    for (const fn of listeners) fn(clock, reduced() ? 0 : dt, now);

    // a struggling device gets a smaller canvas (it's soft anyway)
    if (gl && dt > 0.034) slowFrames++;
    if (++frames >= 90) {
      if (slowFrames > 45 && quality > 0.45) { quality *= 0.8; resize(); }
      frames = 0;
      slowFrames = 0;
    }
  }

  /* ---------- public ---------- */
  Void.dream.sky = {
    init() {
      try {
        setup();
      } catch (err) {
        console.warn('[dream] no WebGL sky:', err.message);
        gl = null;
        html.classList.add('no-webgl');
      }
      resize();
      let resizeTimer = 0;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 120);
      });

      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gl = null; });
      canvas.addEventListener('webglcontextrestored', () => { try { setup(); resize(); } catch { html.classList.add('no-webgl'); } });

      window.addEventListener('pointermove', (e) => {
        mouse.tx = e.clientX / innerWidth;
        mouse.ty = e.clientY / innerHeight;
        mouse.tamt = e.pointerType === 'mouse' ? 1 : 0.7;
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', () => { mouse.tamt = 0; });
      window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') mouse.tamt = 0; });

      requestAnimationFrame(frame);
    },

    // a ring through the sky at (x, y) in CSS pixels
    ripple(x, y, strength = 1) {
      if (reduced()) return;
      ripples.set([x * scale, (innerHeight - y) * scale, clock, strength], rippleSlot * 4);
      rippleSlot = (rippleSlot + 1) % 3;
    },

    setFocus(v) { focusTarget = v; }
  };
})();
