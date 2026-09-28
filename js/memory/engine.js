/* ==========================================================
   memory/engine.js — the room, lit, and remembered
   Takes the painted layers (paint.js) and lights them on the GPU
   every frame, then runs them through a "memory" pass:

   scene   the low sun in the window, sinking as the day goes; the
           light it rakes across the bed (branch shadows drifting in
           it), rays in the air with dust turning in them, the lamp,
           the laptop, fairy lights, night and rain in the window,
           a warm glow under whatever you point at
   bloom   bright parts bleed light (plus a red halation, like film)
   post    a lens flare off the sun (a streak, a red ghost ring, a
           green dot, a hexagon), zoom blur while the camera moves,
           chromatic fringes,
           soft-focus edges, light leaks, a faded warm grade,
           vignette, grain and a slight gate weave

   The camera never cuts: every room is somewhere in this one
   room, and going there is a slow move with the light changing
   on the way. goTo(id) resolves when it's nearly there.

   Void.dream.memory = { init, goTo, setHover, toScreen, setRain,
                         setLucid, pulseVoid, toggleLamp, setVisible,
                         pan, current }
   ========================================================== */
(() => {
  const Void = window.Void;
  const html = document.documentElement;
  const canvas = document.getElementById('memory');
  const reduced = () => html.classList.contains('reduce-motion');
  const BOARD = { W: 1600, H: 1000 };
  const IA = BOARD.W / BOARD.H;

  /* ---------- where each room is, and what the light is like there ---------- */
  // x, y: the point looked at (board px) · zoom · tod: 0 afternoon → 1 night
  // lamp, screen, lights: how bright · dof: blur around the point · dim: darker behind a room
  const PRESETS = {
    home: { x: 800, y: 500, zoom: 1, tod: 0, lamp: 0, screen: 0.15, lights: 0.35, dof: 0, dim: 0 },
    wishes: { x: 872, y: 470, zoom: 2.5, tod: 1, lamp: 0.2, screen: 0.15, lights: 1, dof: 0.2, dim: 0, caption: 'out the window, and up' },
    gallery: { x: 340, y: 540, zoom: 2.0, tod: 0.35, lamp: 0.3, screen: 0.15, lights: 1.2, dof: 0.7, dim: 0.3, caption: 'pictures of when it was warm' },
    favoomfs: { x: 220, y: 300, zoom: 2.4, tod: 0.25, lamp: 0, screen: 0.15, lights: 0.7, dof: 0.7, dim: 0.3, caption: 'the people who stayed' },
    about: { x: 1088, y: 342, zoom: 2.6, tod: 0.05, lamp: 0, screen: 0.15, lights: 0.35, dof: 0.75, dim: 0.25, caption: 'the note i left for whoever comes in' },
    interests: { x: 1350, y: 500, zoom: 2.2, tod: 0.18, lamp: 0.2, screen: 0.15, lights: 0.5, dof: 0.7, dim: 0.32, caption: 'every tape i wore out' },
    guitar: { x: 1290, y: 610, zoom: 2.3, tod: 0.08, lamp: 0, screen: 0.15, lights: 0.4, dof: 0.6, dim: 0.28, caption: 'it is always a little out of tune' },
    games: { x: 800, y: 860, zoom: 2.4, tod: 0.8, lamp: 0, screen: 1.5, lights: 0.7, dof: 0.8, dim: 0.32, caption: 'the laptop, way past midnight' },
    send: { x: 640, y: 590, zoom: 2.6, tod: 0.88, lamp: 1, screen: 0.3, lights: 0.9, dof: 0.8, dim: 0.32, caption: 'writing things i never send' },
    oracle: { x: 1120, y: 840, zoom: 2.4, tod: 1, lamp: 0.45, screen: 0.2, lights: 1.3, dof: 0.8, dim: 0.32, caption: 'cards on the bed at 3am' }
  };


  /* ---------- the camera's settings (the settings panel changes these) ---------- */
  const LOOKS = {
    candy: { grade: 1, exposure: -0.2, hdr: 0.85, bloom: 0.85, rays: 0.7, flare: 0.8, anamorphic: 0.4, dirt: 0.5, dust: 1.4, grain: 0.45, ca: 0.5, dreamy: 0.12, vignette: 0.8, leaks: 0.7, adapt: 1 },
    memory: { grade: 0, exposure: 0, hdr: 0.3, bloom: 1, rays: 0.8, flare: 1, anamorphic: 0.15, dirt: 0.35, dust: 1, grain: 1, ca: 1, dreamy: 1, vignette: 1, leaks: 1, adapt: 0.6 },
    super8: { grade: 2, exposure: 0.05, hdr: 0.2, bloom: 1.1, rays: 0.7, flare: 0.9, anamorphic: 0, dirt: 0.2, dust: 1, grain: 2, ca: 1.3, dreamy: 1.2, vignette: 1.5, leaks: 1.4, adapt: 0.3 },
    vhs: { grade: 3, exposure: 0, hdr: 0, bloom: 0.8, rays: 0.5, flare: 0.6, anamorphic: 0, dirt: 0, dust: 0.8, grain: 0.8, ca: 2, dreamy: 0.5, vignette: 0.9, leaks: 0.3, adapt: 0.4 },
    cinestill: { grade: 4, exposure: 0.1, hdr: 0.5, bloom: 1.4, rays: 1, flare: 1, anamorphic: 0.35, dirt: 0.4, dust: 1.1, grain: 0.9, ca: 0.8, dreamy: 0.6, vignette: 1, leaks: 0.6, adapt: 0.7 },
    mono: { grade: 5, exposure: 0, hdr: 0.8, bloom: 0.9, rays: 1, flare: 0.8, anamorphic: 0.1, dirt: 0.5, dust: 1.2, grain: 1.4, ca: 0, dreamy: 0.6, vignette: 1.2, leaks: 0, adapt: 0.7 },
    clean: { grade: 0, exposure: 0, hdr: 0.2, bloom: 0.6, rays: 0.5, flare: 0.5, anamorphic: 0, dirt: 0, dust: 0.6, grain: 0.2, ca: 0, dreamy: 0, vignette: 0.4, leaks: 0, adapt: 0.4 }
  };
  const DEFAULTS = { v: 4, look: 'candy', ...LOOKS.candy, birds: 1, time: 0, timePasses: false, sway: 1, quality: 1, guides: false };
  const SETTINGS_KEY = 'dream_camera';
  const saved = Void.store.get(SETTINGS_KEY, {}) || {};
  const settings = { ...DEFAULTS, ...(saved.v === DEFAULTS.v ? saved : {}) };
  let readBuf = null;
  let snap = null;          // a photo was asked for: taken right after the next frame
  let frameNo = 0;
  let exposureAuto = 1;
  let exposureTarget = 1;
  let passing = 0;          // "let time pass": where the day has got to

  let gl = null;
  let layers = null;
  let progs = {};
  let tex = {};
  let fbo = {};
  let quad = null;
  let RW = 0;
  let RH = 0;
  let BW = 0;
  let BH = 0;
  let visible = true;
  let fallback = null;

  // the camera and the light, as they are right now
  const cur = { ...PRESETS.home };
  let view4 = [0.5, 0.5, 1, 1];
  let from = { ...cur };
  let to = { ...cur };
  let move = null;          // { t, dur, resolve, arrived }
  let view = 'home';
  let panX = 0;             // phones: looking left and right around the room
  let hover = { x: 0.5, y: 0.5, r: 0.06, a: 0, ta: 0 };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, bx: 0.5, by: 0.5 };
  let lampToggle = 0;
  let rain = 0;
  let rainT = 0;
  let lucid = 0;
  let lucidT = 0;
  let voidAmt = 0;
  let voidT = -1;
  let fade = 0;
  let flash = 0;
  let zoomBlur = 0;
  let clock = 0;
  let last = 0;
  let aspect = 1;

  /* ---------- shaders ---------- */
  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const COMMON = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.07 + 13.1; a *= 0.5; } return v; }
  `;

  const SCENE = COMMON + `
    uniform sampler2D uAlb; uniform sampler2D uBlur; uniform sampler2D uSun; uniform sampler2D uEmit; uniform sampler2D uFg; uniform sampler2D uGlass;
    uniform vec2 uSunB;          // the sun, in board uv (it sinks as the day goes)
    uniform vec4 uView;          // centre x, y and visible width, height (board uv)
    uniform vec2 uFgShift;
    uniform float uAspect;
    uniform float uTime; uniform float uTod; uniform float uLamp; uniform float uScreen; uniform float uLights;
    uniform float uRain; uniform float uDof; uniform float uDim; uniform float uLucid; uniform float uVoid; uniform float uFade;
    uniform vec2 uFocus;
    uniform vec4 uHover;
    uniform vec2 uMouseB;
    uniform float uDustAmt; uniform float uBirds;

    float dust(vec2 uv) {
      float d = 0.0;
      vec2 m = uv - uMouseB;
      uv += normalize(m + 1e-5) * 0.03 * exp(-dot(m * vec2(1.6, 1.0), m * vec2(1.6, 1.0)) * 180.0);
      for (int i = 0; i < 2; i++) {
        float sc = i == 0 ? 70.0 : 130.0;
        vec2 p = uv * vec2(sc * 1.6, sc) + vec2(uTime * (0.12 + float(i) * 0.1), -uTime * (0.05 + float(i) * 0.04));
        vec2 id = floor(p);
        vec2 f = fract(p) - 0.5;
        float h = hash(id);
        vec2 o = vec2(hash(id + 7.3), hash(id + 1.9)) - 0.5;
        o += 0.22 * vec2(sin(uTime * 0.6 + h * 20.0), cos(uTime * 0.45 + h * 13.0));
        float r = length(f - o * 0.7);
        float size = mix(0.035, 0.09, hash(id + 3.1)) * (i == 0 ? 1.0 : 0.7);
        float on = step(0.6, hash(id + 11.0));
        d += on * smoothstep(size, 0.0, r) * (0.55 + 0.45 * sin(uTime * 1.7 + h * 30.0));
      }
      return d;
    }

    void main() {
      vec2 c = vec2(vUv.x - 0.5, 0.5 - vUv.y);

      // "void": everything turns and falls into the middle
      if (uVoid > 0.001) {
        vec2 a = c * vec2(uAspect, 1.0);
        float r = length(a);
        float ang = uVoid * 7.0 * exp(-r * 2.2);
        float s = sin(ang); float co = cos(ang);
        a = mat2(co, s, -s, co) * a;
        a *= 1.0 + uVoid * 3.0 * exp(-r * 3.0);
        c = a / vec2(uAspect, 1.0);
      }
      // lucid: the room folds into a kaleidoscope
      if (uLucid > 0.001) {
        vec2 a = c * vec2(uAspect, 1.0);
        float r = length(a);
        float ang = atan(a.y, a.x) + uTime * 0.05;
        float seg = 6.2831853 / 8.0;
        ang = mod(ang, seg);
        ang = abs(ang - seg * 0.5);
        r *= 1.0 + 0.06 * sin(r * 16.0 - uTime * 1.4);
        vec2 k = r * vec2(cos(ang), sin(ang)) / vec2(uAspect, 1.0);
        c = mix(c, k * 0.9, uLucid);
      }

      vec2 uv = uView.xy + c * uView.zw;

      vec3 alb = texture2D(uAlb, uv).rgb;
      vec3 soft = texture2D(uBlur, uv).rgb;
      float fd = length((uv - uFocus) * vec2(1.6, 1.0));
      float dof = clamp(uDof * smoothstep(0.03, 0.22, fd) + uFade * 0.85, 0.0, 1.0);
      alb = mix(alb, soft, dof);

      vec3 st = texture2D(uSun, uv).rgb;
      float light = st.r;
      float air = st.g;
      // leaves outside the window, moving in the light
      vec2 lp = uv * vec2(15.0, 9.0) + vec2(sin(uTime * 0.31) * 0.7 + uTime * 0.025, cos(uTime * 0.23) * 0.5);
      float leaf = fbm(lp) + 0.25 * noise(lp * 3.0 + uTime * 0.2);
      light *= 1.0 - smoothstep(0.66, 0.84, leaf) * st.b * 0.8;
      light *= 0.95 + 0.05 * sin(uTime * 1.1 + uv.x * 18.0);

      float sunAmt = (1.0 - smoothstep(0.0, 0.72, uTod)) * (1.0 - uRain * 0.85);
      float moonAmt = smoothstep(0.72, 1.0, uTod) * (1.0 - uRain * 0.6);
      float night = smoothstep(0.35, 1.0, uTod);
      vec3 sunCol = vec3(1.0, 0.7, 0.4);
      vec3 moonCol = vec3(0.42, 0.55, 0.95);

      vec3 amb = mix(vec3(0.5, 0.36, 0.25), vec3(0.5, 0.38, 0.52), smoothstep(0.0, 0.6, uTod));
      amb = mix(amb, vec3(0.14, 0.15, 0.27), smoothstep(0.55, 1.0, uTod));
      amb = mix(amb, amb * vec3(0.78, 0.84, 0.95), uRain);

      vec3 col = alb * amb;
      col += alb * light * (sunCol * 3.2 * sunAmt + moonCol * 0.55 * moonAmt) + light * sunCol * 0.3 * sunAmt;
      col += air * (sunCol * 0.3 * sunAmt + moonCol * 0.08 * moonAmt);
      col += uDustAmt * dust(uv) * (air * 2.6 + light * 0.5) * (sunCol * sunAmt + moonCol * moonAmt * 0.4) * 0.9;

      vec3 em = texture2D(uEmit, uv).rgb;
      vec3 lampCol = vec3(1.0, 0.64, 0.32);
      col += em.r * lampCol * uLamp * 1.3 + alb * em.r * uLamp * lampCol * 1.4;
      vec3 scr = vec3(0.45, 0.66, 1.0);
      col += em.g * scr * uScreen * 1.2 + alb * em.g * uScreen * scr * 0.7;
      float tw = 0.6 + 0.4 * sin(uTime * 2.2 + hash(floor(uv * vec2(220.0, 140.0))) * 6.28);
      col += em.b * vec3(1.0, 0.8, 0.52) * uLights * tw * (0.9 + night * 1.6);

      // the window: lit from outside, the sun low in it; a night sky later on
      float glass = texture2D(uGlass, uv).r;
      if (glass > 0.001) {
        vec3 outside = alb * mix(1.05, 0.9, smoothstep(0.0, 0.7, uTod)) * mix(vec3(1.0), vec3(0.62, 0.5, 0.62), smoothstep(0.2, 0.7, uTod));
        vec2 wp = uv * vec2(420.0, 260.0);
        float star = step(0.985, hash(floor(wp))) * smoothstep(0.32, 0.05, length(fract(wp) - 0.5)) * (0.5 + 0.5 * sin(uTime * 2.0 + hash(floor(wp) + 3.0) * 20.0));
        vec3 sky = mix(vec3(0.02, 0.03, 0.09), vec3(0.12, 0.1, 0.24), smoothstep(0.2, 0.62, uv.y)) + star * 0.8 + alb * 0.08;
        outside = mix(outside, sky, night);
        float lane = floor(uv.x * 380.0);
        float drop = step(0.9, hash(vec2(lane, floor(uv.y * 26.0 + uTime * (3.0 + hash(vec2(lane, 1.0)) * 5.0)))));
        outside += uRain * drop * vec3(0.5, 0.55, 0.6) * 0.3;
        outside = mix(outside, outside * vec3(0.72, 0.76, 0.86), uRain * 0.6);
        // now and then a few birds cross the sky
        if (uBirds > 0.001) {
          float b = 0.0;
          float cyc = uTime / 26.0;
          float k = fract(cyc) * 4.0;
          for (int i = 0; i < 5; i++) {
            float fi = float(i);
            vec2 bp = vec2(0.43 + (k - fi * 0.12) * 0.065, 0.3 + fi * 0.018 + sin(k * 3.0 + fi) * 0.012 + hash(vec2(floor(cyc), fi)) * 0.05);
            vec2 q = (uv - bp) * vec2(1.6, 1.0) / 0.0055;
            float flap = sin(uTime * 11.0 + fi * 2.0);
            q.x = abs(q.x);
            float dd = abs(q.y + q.x * (0.35 + 0.35 * flap) - q.x * q.x * 0.25);
            b += smoothstep(0.35, 0.0, dd) * step(q.x, 1.1);
          }
          outside *= 1.0 - clamp(b, 0.0, 1.0) * 0.85 * uBirds;
        }
        col = mix(col, outside, glass);
      }
      // the sun itself, going down behind the glass
      vec2 sd = (uv - uSunB) * vec2(1.6, 1.0);
      float sdist = length(sd);
      float disk = smoothstep(0.0115, 0.0085, sdist);
      float corona = exp(-sdist * sdist * 4000.0) * 1.0 + exp(-sdist * 55.0) * 0.12;
      col += glass * (disk * 2.6 + corona * 1.1) * vec3(1.0, 0.84, 0.58) * sunAmt;
      col += (1.0 - glass) * exp(-sdist * 9.0) * 0.08 * sunCol * sunAmt;

      // what you're pointing at glows a little
      float hd = length((uv - uHover.xy) * vec2(1.6, 1.0));
      col += uHover.w * exp(-(hd * hd) / (uHover.z * uHover.z)) * vec3(1.0, 0.78, 0.5) * 0.22;
      // and the mouse carries a faint warmth
      vec2 mm = (uv - uMouseB) * vec2(1.6, 1.0);
      col += exp(-dot(mm, mm) * 90.0) * vec3(1.0, 0.8, 0.6) * 0.04 * (1.0 - uDim);

      // the curtain in front, closer, so it moves more
      vec4 fg = texture2D(uFg, uv + uFgShift + vec2(sin(uTime * 0.6 + uv.y * 3.0) * 0.003, 0.0));
      vec3 fgLit = fg.rgb * (amb * 0.8 + sunCol * sunAmt * 1.1 + vec3(0.2, 0.25, 0.4) * night);
      col = mix(col, fgLit, fg.a * (1.0 - uFade * 0.5));

      col *= 1.0 - uDim;
      gl_FragColor = vec4(col, 1.0);
    }`;

  const BRIGHT = COMMON + `
    uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThreshold;
    void main() {
      vec3 c = vec3(0.0);
      c += texture2D(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
      c += texture2D(uTex, vUv + uTexel * vec2(1.0, -1.0)).rgb;
      c += texture2D(uTex, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
      c += texture2D(uTex, vUv + uTexel * vec2(1.0, 1.0)).rgb;
      c *= 0.25;
      float l = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.45, l), 1.0);
    }`;

  const BLUR = COMMON + `
    uniform sampler2D uTex; uniform vec2 uDir;
    void main() {
      vec3 c = texture2D(uTex, vUv).rgb * 0.2270270270;
      c += texture2D(uTex, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
      c += texture2D(uTex, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
      c += texture2D(uTex, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
      c += texture2D(uTex, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
      gl_FragColor = vec4(c, 1.0);
    }`;

  const POST = COMMON + `
    uniform sampler2D uScene; uniform sampler2D uBloom; uniform sampler2D uBloomWide; uniform sampler2D uAvg;
    uniform vec2 uRes; uniform float uTime; uniform float uFlash; uniform float uZoomBlur;
    uniform float uLucid; uniform float uFade; uniform vec3 uLeak;
    uniform vec2 uSunS; uniform float uFlare;   // the sun on screen, and how much it flares
    uniform float uSunVis;                       // how much sun there is to make rays with
    // the camera settings
    uniform float uExposure; uniform float uHdr; uniform float uBloomAmt; uniform float uRays;
    uniform float uAnamorphic; uniform float uDirt; uniform float uGrain; uniform float uCA;
    uniform float uDreamy; uniform float uVignette; uniform float uGrade; uniform float uRainLens;
    uniform float uLeaks;
    uniform sampler2D uGuides; uniform vec4 uViewP; uniform float uGuideAmt;   // perspective guides, on top of everything

    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

    // raindrops sitting on the lens
    vec2 drops(vec2 uv, float t, out float rim) {
      vec2 off = vec2(0.0);
      rim = 0.0;
      vec2 grid = vec2(18.0, 11.0);
      for (int k = 0; k < 2; k++) {
        vec2 g = uv * grid * (k == 0 ? 1.0 : 1.7);
        vec2 id = floor(g);
        vec2 f = fract(g) - 0.5;
        float h = hash(id + float(k) * 7.1);
        float life = fract(t * (0.05 + h * 0.08) + h);
        vec2 c = (vec2(hash(id + 3.3), hash(id + 5.1)) - 0.5) * 0.6;
        c.y += life * life * (h > 0.7 ? 0.8 : 0.0);          // some run down
        float r = (0.12 + 0.2 * hash(id + 9.7)) * smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.85, 1.0, life));
        vec2 q = (f - c) * vec2(1.0, 1.25);
        float d = length(q);
        float inside = smoothstep(r, r * 0.8, d) * step(0.35, h);
        off += q * inside * -0.6 / grid;
        rim += smoothstep(r * 0.7, r, d) * inside;
      }
      return off;
    }

    vec3 grade(vec3 c, vec2 uv, float ft) {
      if (uGrade < 0.5) {
        // memory: a soft shoulder, faded blacks, warm highlights
        c = c / (c + vec3(0.9)) * 1.75;
        c = mix(vec3(0.05, 0.04, 0.065), vec3(1.0, 0.965, 0.9), c);
        return pow(max(c, 0.0), vec3(0.98, 1.0, 1.04));
      } else if (uGrade < 1.5) {
        // eye candy: filmic, punchy, teal in the shadows and gold in the light
        c = aces(c * 1.1);
        float l = luma(c);
        c = mix(c, c * vec3(0.86, 0.98, 1.12), (1.0 - smoothstep(0.0, 0.45, l)) * 0.55);
        c = mix(c, c * vec3(1.1, 1.0, 0.86), smoothstep(0.45, 1.0, l) * 0.5);
        float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
        c = mix(vec3(luma(c)), c, 1.0 + 0.45 * (1.0 - sat));
        return max(c, 0.0);
      } else if (uGrade < 2.5) {
        // super 8: warm, faded, a little magenta in the blacks, flickering
        c = c / (c + vec3(0.8)) * 1.7;
        c = mix(vec3(0.09, 0.05, 0.07), vec3(1.0, 0.93, 0.78), c);
        c *= 0.94 + 0.08 * hash(vec2(ft, 9.0));
        return c;
      } else if (uGrade < 3.5) {
        // vhs: washed, cool, soft
        c = c / (c + vec3(0.85)) * 1.7;
        c = mix(vec3(luma(c)), c, 0.72) * vec3(0.95, 1.0, 1.06);
        return mix(vec3(0.06, 0.06, 0.08), vec3(0.98), c);
      } else if (uGrade < 4.5) {
        // cinestill 800t: tungsten night film, red halos, teal shadows
        c = aces(c * 1.15);
        c = mix(c * vec3(0.78, 0.97, 1.1), c * vec3(1.05, 0.98, 0.92), smoothstep(0.1, 0.7, luma(c)));
        return c;
      }
      // black & white, a little warm, contrasty
      float l = luma(c / (c + vec3(0.8)) * 1.75);
      l = smoothstep(0.02, 0.98, l);
      return vec3(l) * vec3(1.03, 1.0, 0.95);
    }

    void main() {
      vec2 uv = vUv;
      bool vhs = uGrade > 2.5 && uGrade < 3.5;
      bool s8 = uGrade > 1.5 && uGrade < 2.5;
      float fps = s8 ? 18.0 : 12.0;
      float ft = floor(uTime * fps);
      // the film shivers in the gate (a lot more on super 8)
      uv += (vec2(hash(vec2(ft, 1.0)), hash(vec2(ft, 2.0))) - 0.5) * (s8 ? 0.005 : 0.0012);
      if (vhs) {
        uv.x += sin(uv.y * 240.0 + uTime * 9.0) * 0.0007;
        float band = fract(uTime * 0.06);
        float tb = smoothstep(0.035, 0.0, abs(uv.y - band));
        uv.x += tb * (hash(vec2(floor(uv.y * 200.0), ft)) - 0.5) * 0.03;
        if (uv.y < 0.025) uv.x += (hash(vec2(floor(uv.y * 400.0), ft)) - 0.5) * 0.04;
      }

      float rim = 0.0;
      if (uRainLens > 0.001) uv += drops(uv, uTime, rim) * uRainLens;

      vec3 col;
      if (uZoomBlur > 0.002) {
        col = vec3(0.0);
        for (int i = 0; i < 10; i++) {
          float k = float(i) / 9.0;
          col += texture2D(uScene, mix(uv, vec2(0.5), k * uZoomBlur * 0.12)).rgb;
        }
        col /= 10.0;
      } else {
        col = texture2D(uScene, uv).rgb;
      }
      vec2 d = uv - 0.5;
      float e = dot(d, d);
      float ca = (vhs ? 0.03 : 0.012) * uCA * (1.0 - uZoomBlur * 0.7);
      vec2 cadir = vhs ? vec2(0.12, 0.0) : d * e;
      col.r = mix(col.r, texture2D(uScene, uv - cadir * ca).r, 0.85);
      col.b = mix(col.b, texture2D(uScene, uv + cadir * ca).b, 0.85);

      // pseudo HDR: pull detail out of the shadows and the light at once
      vec3 avg = texture2D(uAvg, uv).rgb;
      float la = luma(avg);
      col *= mix(1.0, clamp(0.26 / (la + 0.05), 0.6, 1.7), uHdr * 0.3);     // local tone mapping
      col += (col - avg) * uHdr * 0.55;                                     // clarity
      col = max(col, 0.0);
      col *= exp2(uExposure);

      vec3 bloom = texture2D(uBloom, uv).rgb;
      vec3 wide = texture2D(uBloomWide, uv).rgb;
      col += (bloom * 0.55 + wide * 0.45) * uBloomAmt;
      col += (bloom + wide) * vec3(1.0, 0.42, 0.22) * (uGrade > 3.5 && uGrade < 4.5 ? 0.6 : 0.2) * uBloomAmt;   // halation
      col = mix(col, col * 0.6 + wide * 1.2 + bloom * 0.3, smoothstep(0.1, 0.32, e) * 0.35 * uDreamy);           // soft edges

      // anamorphic streaks: bright things smear sideways
      if (uAnamorphic > 0.001) {
        vec3 an = vec3(0.0);
        for (int i = 1; i <= 8; i++) {
          float o = float(i) * 0.022;
          an += (texture2D(uBloom, uv + vec2(o, 0.0)).rgb + texture2D(uBloom, uv - vec2(o, 0.0)).rgb) * (1.0 - float(i) / 9.0);
        }
        col += vec3(0.55, 0.7, 1.0) * luma(an) * 0.12 * uAnamorphic;
      }

      // god rays: the light itself, streaming out from the sun between the bars
      if (uRays > 0.001 && uSunVis > 0.001) {
        vec2 dir = (uv - uSunS) / 40.0 * 0.85;
        vec2 p = uv;
        float decay = 1.0;
        vec3 rays = vec3(0.0);
        for (int i = 0; i < 40; i++) {
          p -= dir;
          rays += texture2D(uBloom, p).rgb * decay;
          decay *= 0.955;
        }
        col += rays / 40.0 * vec3(1.0, 0.78, 0.5) * 1.0 * uRays * uSunVis;
      }

      // the lens flare: a streak up through the sun, and ghosts across the frame
      vec3 flare = vec3(0.0);
      if (uFlare > 0.001) {
        float asp = uRes.x / uRes.y;
        vec2 fs = (uv - uSunS) * vec2(asp, 1.0);
        float up = fs.y > 0.0 ? 1.8 : 10.0;
        float streak = exp(-abs(fs.x) * 70.0) * exp(-abs(fs.y) * up) * 0.26;
        streak += exp(-abs(fs.y) * 160.0) * exp(-abs(fs.x) * 7.0) * 0.08;
        flare = vec3(1.0, 0.72, 0.36) * streak;
        vec2 axis = vec2(0.5) - uSunS;
        vec2 g1 = (uv - (uSunS + axis * 0.55 + vec2(-0.08, -0.12))) * vec2(asp, 1.0);
        float gl1 = length(g1);
        float ring = smoothstep(0.125, 0.112, gl1) * smoothstep(0.05, 0.11, gl1);
        flare += vec3(1.0, 0.28, 0.2) * (ring * 0.4 + exp(-gl1 * gl1 * 90.0) * 0.14);
        vec2 g2 = (uv - (uSunS + axis * 0.55 + vec2(-0.1, -0.16))) * vec2(asp, 1.0);
        flare += vec3(0.5, 1.0, 0.45) * smoothstep(0.012, 0.004, length(g2)) * 0.6;
        vec2 g3 = (uv - (uSunS + vec2(-0.2, 0.12))) * vec2(asp, 1.0);
        float hex = max(abs(g3.x) * 0.866 + abs(g3.y) * 0.5, abs(g3.y));
        flare += vec3(1.0, 0.62, 0.3) * smoothstep(0.1, 0.085, hex) * 0.16;
        vec2 g4 = (uv - (uSunS - axis * 0.25)) * vec2(asp, 1.0);
        flare += vec3(1.0, 0.8, 0.5) * smoothstep(0.03, 0.0, length(g4)) * 0.18;
        // a rainbow arc, very faint, opposite the sun
        vec2 g5 = (uv - (uSunS + axis * 1.2)) * vec2(asp, 1.0);
        float arc = smoothstep(0.02, 0.0, abs(length(g5) - 0.3));
        flare += (0.5 + 0.5 * cos(6.2831 * (length(g5) * 12.0 + vec3(0.0, 0.33, 0.67)))) * arc * 0.06;
        flare *= uFlare;
        col += flare;
      }

      // dirt and smudges on the lens, only visible where light hits them
      if (uDirt > 0.001) {
        float dirt = 0.0;
        for (int i = 0; i < 3; i++) {
          vec2 g = uv * vec2(5.0, 3.5) * (1.0 + float(i) * 1.7);
          vec2 id = floor(g);
          vec2 f = fract(g) - 0.5 - (vec2(hash(id + float(i)), hash(id + 4.0 + float(i))) - 0.5) * 0.6;
          float r = 0.12 + 0.3 * hash(id + 2.0);
          dirt += smoothstep(r, r * 0.3, length(f)) * (0.3 + 0.7 * hash(id + 8.0)) / (1.0 + float(i));
        }
        dirt += fbm(uv * 14.0) * 0.4;
        float lightOn = luma(wide) * 3.0 + luma(flare) * 2.0;
        col += vec3(1.0, 0.8, 0.6) * dirt * lightOn * 0.25 * uDirt;
      }
      col += rim * 0.25 * luma(wide) * uRainLens;

      // light leaks drifting through the corners
      vec2 lk = uv - vec2(1.02 + 0.06 * sin(uTime * 0.11), 0.95 + 0.05 * cos(uTime * 0.08));
      col += uLeak * exp(-dot(lk, lk) * 5.0) * (0.22 + 0.08 * sin(uTime * 0.5)) * uLeaks;
      vec2 lk2 = uv - vec2(-0.08, 0.12 + 0.1 * sin(uTime * 0.07));
      col += vec3(1.0, 0.55, 0.3) * exp(-dot(lk2, lk2) * 8.0) * 0.12 * uLeaks;

      float g = dot(col, vec3(0.3, 0.59, 0.11));
      col = mix(col, vec3(g) * vec3(1.05, 1.0, 0.92) + 0.08, uFade * 0.6);
      col = col * (1.0 + uFlash * 0.9) + uFlash * vec3(0.1, 0.07, 0.05);

      col = grade(col, uv, ft);

      if (uLucid > 0.001) {
        float r = length(d * vec2(uRes.x / uRes.y, 1.0));
        vec3 rainbow = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + r * 1.4 - uTime * 0.09));
        col = mix(col, col * rainbow * 1.55, uLucid * 0.7);
      }

      col *= 1.0 - 1.1 * uVignette * dot(d * vec2(0.9, 1.1), d * vec2(0.9, 1.1));
      if (s8) {
        // the rounded gate of a super 8 frame
        vec2 q = abs(d) * 2.0;
        float gate = smoothstep(1.0, 0.94, pow(pow(q.x, 6.0) + pow(q.y * 1.02, 6.0), 1.0 / 6.0));
        col *= gate;
      }
      if (vhs) {
        col *= 0.9 + 0.1 * sin(vUv.y * uRes.y * 1.6);
        col += (hash(vec2(floor(vUv.y * uRes.y * 0.5), ft)) - 0.5) * 0.05;
      }
      float gr = hash(uv * uRes + ft * 17.13) - 0.5;
      col += gr * 0.07 * uGrain;
      vec2 sg = uv * vec2(90.0, 56.0);
      float sp = step(s8 ? 0.996 : 0.9992, hash(floor(sg) + ft)) * smoothstep(0.22, 0.05, length(fract(sg) - 0.5));
      col = mix(col, col * 0.55, sp * 0.7 * min(1.0, uGrain));
      if (s8 && hash(vec2(ft, 3.0)) > 0.93) {
        // a hair caught in the gate, for a few frames
        float hx = hash(vec2(floor(uTime * 0.5), 1.0));
        col *= 1.0 - smoothstep(0.003, 0.0, abs(uv.x - hx - 0.05 * sin(uv.y * 5.0))) * 0.6;
      }
      if (uGuideAmt > 0.0) {
        vec2 gb = uViewP.xy + vec2(vUv.x - 0.5, 0.5 - vUv.y) * uViewP.zw;
        vec4 gd = texture2D(uGuides, gb);
        float inside = step(0.0, gb.x) * step(gb.x, 1.0) * step(0.0, gb.y) * step(gb.y, 1.0);
        col = mix(col, gd.rgb, gd.a * uGuideAmt * inside);
      }
      gl_FragColor = vec4(col, 1.0);
    }`;

  /* ---------- GL plumbing ---------- */
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function program(frag, uniforms) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {};
    uniforms.forEach((u) => { loc[u] = gl.getUniformLocation(p, u); });
    return { p, loc };
  }

  function texture(source) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return t;
  }

  function target(w, h) {
    const t = texture(null);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { t, f, w, h };
  }

  function bindTex(unit, t, loc) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(loc, unit);
  }

  function draw(targetFb, w, h) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFb ? targetFb.f : null);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function setup() {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('no WebGL');
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    progs.scene = program(SCENE, ['uAlb', 'uBlur', 'uSun', 'uEmit', 'uFg', 'uView', 'uFgShift', 'uAspect', 'uTime', 'uTod', 'uLamp', 'uScreen', 'uLights', 'uRain', 'uDof', 'uDim', 'uLucid', 'uVoid', 'uFade', 'uFocus', 'uHover', 'uMouseB', 'uGlass', 'uSunB', 'uDustAmt', 'uBirds']);
    progs.bright = program(BRIGHT, ['uTex', 'uTexel', 'uThreshold']);
    progs.blur = program(BLUR, ['uTex', 'uDir']);
    progs.post = program(POST, ['uScene', 'uBloom', 'uBloomWide', 'uAvg', 'uRes', 'uTime', 'uFlash', 'uZoomBlur', 'uLucid', 'uFade', 'uLeak', 'uSunS', 'uFlare', 'uSunVis', 'uExposure', 'uHdr', 'uBloomAmt', 'uRays', 'uAnamorphic', 'uDirt', 'uGrain', 'uCA', 'uDreamy', 'uVignette', 'uGrade', 'uRainLens', 'uLeaks', 'uGuides', 'uViewP', 'uGuideAmt']);

    tex.alb = texture(layers.albedo);
    tex.blur = texture(layers.blur);
    tex.sun = texture(layers.sun);
    tex.emit = texture(layers.emit);
    tex.fg = texture(layers.fg);
    tex.glass = texture(layers.glass);
    tex.guides = texture(layers.guides);
  }

  function resize() {
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    aspect = cw / ch;
    if (!gl) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const budget = 1300000 * settings.quality * settings.quality;
    const s = Math.min(dpr, Math.sqrt(budget / (cw * ch)));
    RW = Math.max(64, Math.round(cw * s));
    RH = Math.max(64, Math.round(ch * s));
    canvas.width = RW;
    canvas.height = RH;
    BW = Math.max(16, Math.round(RW / 4));
    BH = Math.max(16, Math.round(RH / 4));
    Object.values(fbo).forEach((f) => { gl.deleteFramebuffer(f.f); gl.deleteTexture(f.t); });
    fbo = {
      scene: target(RW, RH),
      b1: target(BW, BH),
      b2: target(BW, BH),
      w1: target(Math.max(8, BW >> 2), Math.max(8, BH >> 2)),
      w2: target(Math.max(8, BW >> 2), Math.max(8, BH >> 2)),
      a1: target(Math.max(8, BW >> 1), Math.max(8, BH >> 1)),
      a2: target(Math.max(8, BW >> 1), Math.max(8, BH >> 1))
    };
    readBuf = new Uint8Array(fbo.a2.w * fbo.a2.h * 4);
  }

  /* ---------- the camera ---------- */
  // how much of the board fits on screen at zoom 1 ("cover")
  function baseVis() {
    return aspect > IA ? [1, IA / aspect] : [aspect / IA, 1];
  }

  function viewRect() {
    const [bw, bh] = baseVis();
    const breathe = reduced() ? 0 : Math.sin(clock * 0.07) * 0.012 * settings.sway;
    const zoom = cur.zoom * (1 + breathe * 0.5) * (1 + hover.a * 0.025) * (1 - fade * 0.06);
    const vw = bw / zoom;
    const vh = bh / zoom;
    let cx = cur.x / BOARD.W;
    let cy = cur.y / BOARD.H;
    if (view === 'home') cx += panX;
    // lean a little towards what you're pointing at, and with the mouse
    cx += (hover.x - cx) * hover.a * 0.03 + mouse.x * 0.008 / cur.zoom + (reduced() ? 0 : Math.sin(clock * 0.05) * 0.004 * settings.sway);
    cy += (hover.y - cy) * hover.a * 0.03 + mouse.y * 0.006 / cur.zoom;
    cx = Math.min(1 - vw / 2, Math.max(vw / 2, cx));
    cy = Math.min(1 - vh / 2, Math.max(vh / 2, cy));
    return [cx, cy, vw, vh];
  }

  // board px → CSS px, for the hotspots
  function toScreen(bx, by) {
    const [cx, cy, vw, vh] = viewRect();
    return [((bx / BOARD.W - cx) / vw + 0.5) * window.innerWidth, ((by / BOARD.H - cy) / vh + 0.5) * window.innerHeight];
  }

  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const KEYS = ['x', 'y', 'zoom', 'tod', 'lamp', 'screen', 'lights', 'dof', 'dim'];

  function goTo(id, { instant = false } = {}) {
    const preset = PRESETS[id] || PRESETS.home;
    view = PRESETS[id] ? id : 'home';
    if (move?.resolve) move.resolve();
    from = { ...cur };
    to = { ...preset };
    if (view === 'home') { panX = 0; to.tod = homeTod(); }
    if (instant || reduced()) {
      KEYS.forEach((k) => { cur[k] = to[k]; });
      move = null;
      return Promise.resolve();
    }
    // a longer trip for a longer move
    const dist = Math.hypot((to.x - from.x) / BOARD.W, (to.y - from.y) / BOARD.H) + Math.abs(Math.log(to.zoom / from.zoom)) * 0.5;
    const dur = Math.min(3.2, 1.5 + dist * 1.8);
    return new Promise((resolve) => { move = { t: 0, dur, resolve, arrived: false }; });
  }

  // the light at home: the setting, or the day slowly going by
  function homeTod() {
    if (!settings.timePasses) return settings.time;
    return 0.5 - 0.5 * Math.cos(passing);
  }

  /* ---------- the loop ---------- */
  function frame(t, dt, now) {
    const realDt = last ? Math.min(0.25, (now - last) / 1000) : 1 / 60;
    last = now;
    const step = reduced() ? realDt : realDt;
    clock += reduced() ? 0 : step;

    if (move) {
      move.t += step / move.dur;
      const k = Math.min(1, move.t);
      const e = ease(k);
      KEYS.forEach((key) => { cur[key] = from[key] + (to[key] - from[key]) * e; });
      // the zoom itself travels on a log scale, so it feels even
      cur.zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * e);
      const speed = Math.sin(k * Math.PI);
      zoomBlur = speed * 0.9;
      flash = speed * speed * 0.35;
      if (!move.arrived && k > 0.72) { move.arrived = true; move.resolve(); }
      if (k >= 1) move = null;
    } else {
      zoomBlur *= 0.8;
      flash *= 0.85;
    }

    if (settings.timePasses) passing += step * (Math.PI * 2 / 240);   // a whole day in four minutes
    if (view === 'home' && !move) cur.tod += (homeTod() - cur.tod) * Math.min(1, step * 0.8);

    mouse.x += (mouse.tx - mouse.x) * Math.min(1, step * 3);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, step * 3);
    hover.a += (hover.ta - hover.a) * Math.min(1, step * 5);
    rain += (rainT - rain) * Math.min(1, step * 0.8);
    lucid += (lucidT - lucid) * Math.min(1, step * 0.9);
    fade += ((html.classList.contains('is-drifting') ? 1 : 0) - fade) * Math.min(1, step * 0.25);
    if (voidT >= 0) {
      voidT += step;
      voidAmt = voidT < 1 ? Math.pow(voidT, 2) : Math.max(0, 1 - (voidT - 1) * 1.6);
      if (voidT > 1.8) { voidT = -1; voidAmt = 0; }
    }

    const [cx, cy, vw, vh] = viewRect();
    mouse.bx = cx + mouse.tx * 0.5 * vw;
    mouse.by = cy + mouse.ty * 0.5 * vh;

    if (!gl) { drawFallback(cx, cy, vw, vh); return; }
    if (!visible) return;

    // 1. the lit room
    const S = progs.scene;
    gl.useProgram(S.p);
    bindTex(0, tex.alb, S.loc.uAlb);
    bindTex(1, tex.blur, S.loc.uBlur);
    bindTex(2, tex.sun, S.loc.uSun);
    bindTex(3, tex.emit, S.loc.uEmit);
    bindTex(4, tex.fg, S.loc.uFg);
    gl.uniform4f(S.loc.uView, cx, cy, vw, vh);
    view4 = [cx, cy, vw, vh];
    gl.uniform2f(S.loc.uFgShift, -mouse.x * 0.02 / cur.zoom, -mouse.y * 0.012 / cur.zoom);
    gl.uniform1f(S.loc.uAspect, aspect);
    gl.uniform1f(S.loc.uTime, clock);
    gl.uniform1f(S.loc.uTod, Math.min(1, cur.tod + rain * 0.25));
    gl.uniform1f(S.loc.uLamp, Math.min(1.4, cur.lamp + lampToggle));
    gl.uniform1f(S.loc.uScreen, cur.screen);
    gl.uniform1f(S.loc.uLights, cur.lights);
    gl.uniform1f(S.loc.uRain, rain);
    gl.uniform1f(S.loc.uDof, cur.dof);
    gl.uniform1f(S.loc.uDim, cur.dim);
    gl.uniform1f(S.loc.uLucid, lucid);
    gl.uniform1f(S.loc.uVoid, voidAmt);
    gl.uniform1f(S.loc.uFade, fade);
    gl.uniform2f(S.loc.uFocus, cur.x / BOARD.W, cur.y / BOARD.H);
    gl.uniform4f(S.loc.uHover, hover.x, hover.y, hover.r, hover.a);
    bindTex(5, tex.glass, S.loc.uGlass);
    const sunY = layers.sunAt[1] + Math.min(1, cur.tod) * 70;
    gl.uniform2f(S.loc.uSunB, layers.sunAt[0] / BOARD.W, sunY / BOARD.H);
    gl.uniform2f(S.loc.uMouseB, mouse.bx, mouse.by);
    gl.uniform1f(S.loc.uDustAmt, settings.dust);
    gl.uniform1f(S.loc.uBirds, settings.birds);
    draw(fbo.scene, RW, RH);

    // 2. bloom: what's bright, shrunk and blurred, then shrunk and blurred again, wider
    gl.useProgram(progs.bright.p);
    bindTex(0, fbo.scene.t, progs.bright.loc.uTex);
    gl.uniform2f(progs.bright.loc.uTexel, 1 / RW, 1 / RH);
    gl.uniform1f(progs.bright.loc.uThreshold, 0.8 - lucid * 0.2);
    draw(fbo.b1, BW, BH);
    const B = progs.blur;
    gl.useProgram(B.p);
    [[fbo.b1, fbo.b2, 1, 0], [fbo.b2, fbo.b1, 0, 1], [fbo.b1, fbo.b2, 2, 0], [fbo.b2, fbo.b1, 0, 2]].forEach(([src, dst, dx, dy]) => {
      bindTex(0, src.t, B.loc.uTex);
      gl.uniform2f(B.loc.uDir, dx / BW, dy / BH);
      draw(dst, BW, BH);
    });
    const ww = fbo.w1.w;
    const wh = fbo.w1.h;
    [[fbo.b1, fbo.w1, 1, 0], [fbo.w1, fbo.w2, 0, 1], [fbo.w2, fbo.w1, 2, 0], [fbo.w1, fbo.w2, 0, 2]].forEach(([src, dst, dx, dy]) => {
      bindTex(0, src.t, B.loc.uTex);
      gl.uniform2f(B.loc.uDir, dx / ww, dy / wh);
      draw(dst, ww, wh);
    });

    // 2b. the whole frame, averaged, for the HDR look and the eye adapting to the light
    gl.useProgram(progs.bright.p);
    bindTex(0, fbo.scene.t, progs.bright.loc.uTex);
    gl.uniform2f(progs.bright.loc.uTexel, 2 / RW, 2 / RH);
    gl.uniform1f(progs.bright.loc.uThreshold, -1);
    draw(fbo.a1, fbo.a1.w, fbo.a1.h);
    gl.useProgram(B.p);
    [[fbo.a1, fbo.a2, 2, 0], [fbo.a2, fbo.a1, 0, 2], [fbo.a1, fbo.a2, 4, 0], [fbo.a2, fbo.a1, 0, 4], [fbo.a1, fbo.a2, 2, 2]].forEach(([src, dst, dx, dy]) => {
      bindTex(0, src.t, B.loc.uTex);
      gl.uniform2f(B.loc.uDir, dx / src.w, dy / src.h);
      draw(dst, dst.w, dst.h);
    });
    if (++frameNo % 12 === 0 && readBuf) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.a2.f);
      gl.readPixels(0, 0, fbo.a2.w, fbo.a2.h, gl.RGBA, gl.UNSIGNED_BYTE, readBuf);
      let sum = 0;
      for (let i = 0; i < readBuf.length; i += 16) sum += (readBuf[i] * 0.2126 + readBuf[i + 1] * 0.7152 + readBuf[i + 2] * 0.0722) / 255;
      const avgL = sum / (readBuf.length / 16);
      exposureTarget = Math.min(1.35, Math.max(0.7, 0.13 / Math.max(0.02, avgL)));
    }
    exposureAuto += (exposureTarget - exposureAuto) * Math.min(1, step * 0.9);

    // 3. the memory of it
    const P = progs.post;
    gl.useProgram(P.p);
    bindTex(0, fbo.scene.t, P.loc.uScene);
    bindTex(1, fbo.b1.t, P.loc.uBloom);
    bindTex(2, fbo.w2.t, P.loc.uBloomWide);
    bindTex(3, fbo.a2.t, P.loc.uAvg);
    gl.uniform2f(P.loc.uRes, RW, RH);
    gl.uniform1f(P.loc.uTime, clock);
    gl.uniform1f(P.loc.uFlash, flash);
    gl.uniform1f(P.loc.uZoomBlur, reduced() ? 0 : zoomBlur);
    gl.uniform1f(P.loc.uLucid, lucid);
    gl.uniform1f(P.loc.uFade, fade);
    const glow = Void.dream.palette.current.glow;
    gl.uniform3f(P.loc.uLeak, 0.6 + glow[0] * 0.4, 0.35 + glow[1] * 0.25, 0.2 + glow[2] * 0.2);
    // where the sun is on screen: the flare follows the camera
    const sunY2 = layers.sunAt[1] + Math.min(1, cur.tod) * 70;
    const [sx, sy] = toScreen(layers.sunAt[0], sunY2);
    const su = sx / window.innerWidth;
    const sv = 1 - sy / window.innerHeight;
    const onScreen = Math.max(0, Math.min(1, (0.62 - Math.max(Math.abs(su - 0.5), Math.abs(sv - 0.5))) / 0.12));
    const sunAmt = (1 - Math.min(1, cur.tod / 0.72)) * (1 - rain * 0.85);
    gl.uniform2f(P.loc.uSunS, su, sv);
    const sunVis = sunAmt * onScreen * (1 - cur.dim) * (1 - fade * 0.6);
    gl.uniform1f(P.loc.uFlare, sunVis * settings.flare);
    gl.uniform1f(P.loc.uSunVis, sunVis);
    const adapt = Math.log2(exposureAuto) * settings.adapt;
    gl.uniform1f(P.loc.uExposure, settings.exposure + adapt);
    gl.uniform1f(P.loc.uHdr, settings.hdr);
    gl.uniform1f(P.loc.uBloomAmt, settings.bloom);
    gl.uniform1f(P.loc.uRays, settings.rays);
    gl.uniform1f(P.loc.uAnamorphic, settings.anamorphic);
    gl.uniform1f(P.loc.uDirt, settings.dirt);
    gl.uniform1f(P.loc.uGrain, settings.grain);
    gl.uniform1f(P.loc.uCA, settings.ca);
    gl.uniform1f(P.loc.uDreamy, settings.dreamy);
    gl.uniform1f(P.loc.uVignette, settings.vignette);
    gl.uniform1f(P.loc.uGrade, settings.grade);
    gl.uniform1f(P.loc.uRainLens, rain);
    gl.uniform1f(P.loc.uLeaks, settings.leaks);
    bindTex(4, tex.guides, P.loc.uGuides);
    gl.uniform4f(P.loc.uViewP, view4[0], view4[1], view4[2], view4[3]);
    gl.uniform1f(P.loc.uGuideAmt, settings.guides ? 1 : 0);
    draw(null, RW, RH);
    if (snap) { const done = snap; snap = null; canvas.toBlob(done, 'image/png'); }
  }

  /* ---------- without WebGL: the painting, moved by CSS ---------- */
  function drawFallback(cx, cy, vw, vh) {
    if (!fallback) return;
    const sx = window.innerWidth / (vw * layers.albedo.width);
    const sy = window.innerHeight / (vh * layers.albedo.height);
    const tx = -(cx - vw / 2) * layers.albedo.width * sx;
    const ty = -(cy - vh / 2) * layers.albedo.height * sy;
    fallback.style.transform = `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`;
    fallback.style.filter = `brightness(${1 - cur.dim}) blur(${cur.dof * 3}px)`;
  }

  /* ---------- public ---------- */
  Void.dream.memory = {
    PRESETS,
    current: () => view,
    toScreen,
    goTo,
    async init() {
      const mobile = Math.min(screen.width, screen.height) < 700;
      layers = await Void.dream.memoryPaint.paint({ scale: mobile ? 1.1 : 1.5 });
      // the camera looks at where things actually ended up in the painting
      Object.entries(layers.focus || {}).forEach(([id, [x, y]]) => {
        if (PRESETS[id] && id !== 'home') { PRESETS[id].x = x; PRESETS[id].y = y; }
      });
      if (/[?&]guides\b/.test(location.search)) settings.guides = true;
      aspect = window.innerWidth / window.innerHeight;
      try {
        setup();
      } catch (err) {
        console.warn('[dream] memory without WebGL:', err.message);
        gl = null;
        html.classList.add('no-webgl');
        fallback = layers.albedo;
        fallback.className = 'memory-fallback';
        canvas.replaceWith(fallback);
      }
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('pointermove', (e) => {
        mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
      if (gl) {
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gl = null; });
        canvas.addEventListener('webglcontextrestored', () => { try { setup(); resize(); } catch { /* stays dark */ } });
      }
      Void.dream.onFrame(frame);
      html.classList.add('memory-ready');
      return layers;
    },
    setHover(spot) {
      if (spot) {
        hover.x = (spot.x + spot.w / 2) / BOARD.W;
        hover.y = (spot.y + spot.h / 2) / BOARD.H;
        hover.r = Math.max(spot.w, spot.h) / BOARD.W * 0.9;
        hover.ta = 1;
      } else hover.ta = 0;
    },
    // phones look around the room by dragging sideways
    pan(dx) {
      const [bw] = baseVis();
      const limit = Math.max(0, (1 - bw) / 2);
      panX = Math.max(-limit, Math.min(limit, panX + dx));
    },
    setRain(on) { rainT = on ? 1 : 0; },
    setLucid(on) { lucidT = on ? 1 : 0; },
    pulseVoid() { if (!reduced()) voidT = 0; },
    toggleLamp() { lampToggle = lampToggle ? 0 : 1; return !!lampToggle; },
    setVisible(v) { visible = v; canvas.classList.toggle('is-hidden', !v); },

    // the settings panel
    LOOKS,
    settings,
    set(key, value) {
      settings[key] = value;
      if (key === 'quality') resize();
      if (key === 'timePasses' && value) passing = Math.acos(1 - 2 * Math.min(1, Math.max(0, settings.time)));
      Void.store.set(SETTINGS_KEY, settings);
      Void.emit('camera', settings);
    },
    look(name) {
      if (!LOOKS[name]) return;
      Object.assign(settings, LOOKS[name], { look: name });
      Void.store.set(SETTINGS_KEY, settings);
      Void.emit('camera', settings);
    },
    reset() {
      Object.assign(settings, DEFAULTS);
      resize();
      Void.store.set(SETTINGS_KEY, settings);
      Void.emit('camera', settings);
    },
    tod: () => cur.tod,
    snapshot() { return new Promise((resolve) => { snap = resolve; if (!gl) resolve(null); }); }
  };
})();
