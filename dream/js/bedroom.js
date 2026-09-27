/* ==========================================================
   bedroom.js — the about room, in 3D (three.js, vendored)
   Late afternoon in renn's room: sun through the window, a beam
   of light with dust turning in it, the bed, the desk, a guitar
   leaning on the wall, a record player, covers pinned up.
   Drag to look around. Things you can click:
     window        day ↔ night
     guitar        the guitar room
     camera        the pictures
     record player plays the room's song (and spins while it does)
     covers        play that song
     lamp          on / off
     letter        scrolls down to the letter
     plant         it's happy you noticed
   Only renders while the about room is open. Without WebGL the
   room just isn't there and the letter is the page.
   ========================================================== */
import * as THREE from '../vendor/three.module.min.js';

const Void = window.Void;
const $ = (s) => document.querySelector(s);
const section = $('#view-about');
const holder = $('#bedroom');
const canvas = $('#bedroomCanvas');
const tag = $('#bedroomTag');
const songs = Void.favorites || [];
const reduced = () => document.documentElement.classList.contains('reduce-motion');

let started = false;
let open = false;

/* ---------- little canvas textures ---------- */
function canvasTexture(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const planks = () => canvasTexture(512, 512, (c, w, h) => {
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const y = (i * h) / rows;
    const shade = 150 + Math.random() * 30;
    c.fillStyle = `rgb(${shade + 40}, ${shade - 10}, ${shade - 60})`;
    c.fillRect(0, y, w, h / rows);
    c.strokeStyle = 'rgba(60, 30, 10, 0.18)';
    for (let k = 0; k < 14; k++) {
      c.beginPath();
      const yy = y + Math.random() * (h / rows);
      c.moveTo(0, yy);
      c.bezierCurveTo(w * 0.3, yy + 4, w * 0.6, yy - 4, w, yy + 2);
      c.stroke();
    }
    c.fillStyle = 'rgba(40, 20, 5, 0.5)';
    c.fillRect(0, y, w, 2);
    const cut = Math.random() * w;
    c.fillRect(cut, y, 2, h / rows);
  }
});

const duvet = () => canvasTexture(256, 256, (c, w, h) => {
  c.fillStyle = '#b9cfe6';
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 8; i++) {
    c.fillRect(i * 32, 0, 10, h);
    c.fillRect(0, i * 32, w, 10);
  }
});

function skyTexture(night) {
  return canvasTexture(512, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    if (night) {
      g.addColorStop(0, '#060a1c');
      g.addColorStop(0.6, '#1b2350');
      g.addColorStop(1, '#3a3160');
    } else {
      g.addColorStop(0, '#7fb3e8');
      g.addColorStop(0.45, '#f6c99a');
      g.addColorStop(0.75, '#ff9d6b');
      g.addColorStop(1, '#f7d7a8');
    }
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    if (night) {
      c.fillStyle = '#fff';
      for (let i = 0; i < 160; i++) { c.globalAlpha = Math.random(); c.fillRect(Math.random() * w, Math.random() * h * 0.7, 1.5, 1.5); }
      c.globalAlpha = 1;
      c.fillStyle = '#fff8e0';
      c.beginPath(); c.arc(w * 0.3, h * 0.28, 26, 0, 7); c.fill();
    } else {
      const s = c.createRadialGradient(w * 0.7, h * 0.62, 0, w * 0.7, h * 0.62, 180);
      s.addColorStop(0, 'rgba(255,250,220,1)');
      s.addColorStop(0.15, 'rgba(255,230,170,0.9)');
      s.addColorStop(1, 'rgba(255,200,140,0)');
      c.fillStyle = s;
      c.fillRect(0, 0, w, h);
      // rooftops and trees far away
      c.fillStyle = 'rgba(120, 70, 70, 0.55)';
      for (let x = 0; x < w; x += 40) {
        const hh = 40 + Math.random() * 70;
        c.fillRect(x, h - hh, 34, hh);
      }
      c.fillStyle = 'rgba(70, 90, 60, 0.6)';
      for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(Math.random() * w, h - 10, 30 + Math.random() * 30, 0, 7); c.fill(); }
    }
    // curtains of cloud
    c.fillStyle = night ? 'rgba(120,130,200,0.12)' : 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h * 0.5, 90, 18, 0, 0, 7); c.fill(); }
  });
}

function dotTexture() {
  return canvasTexture(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,245,220,0.7)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}

/* ---------- the room ---------- */
function build() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a1c18, 9, 18);
  scene.background = new THREE.Color(0x1a1210);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 50);

  const clickable = [];
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
  const box = (w, h, d, material, x, y, z, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const group = (x, y, z, name, action) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.userData = { name, action };
    scene.add(g);
    if (action) clickable.push(g);
    return g;
  };

  // walls, floor, a window cut in the back wall
  const W = 8;
  const D = 7;
  const H = 3.2;
  const wallMat = mat(0xe9d8c0);
  const floorTex = planks();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(3, 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xffffff, { map: floorTex, roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xf3e7d6, { emissive: 0x3a2a1e, emissiveIntensity: 0.6 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  scene.add(ceiling);

  const win = { x: 1.4, y: 1.75, w: 1.9, h: 1.5 };
  const back = -D / 2;
  const t = 0.12;
  box(W, win.y - win.h / 2, t, wallMat, 0, (win.y - win.h / 2) / 2, back);
  box(W, H - (win.y + win.h / 2), t, wallMat, 0, (H + win.y + win.h / 2) / 2, back);
  const leftW = win.x - win.w / 2 + W / 2;
  box(leftW, win.h, t, wallMat, -W / 2 + leftW / 2, win.y, back);
  const rightW = W / 2 - (win.x + win.w / 2);
  box(rightW, win.h, t, wallMat, W / 2 - rightW / 2, win.y, back);
  box(t, H, D, mat(0xe2cfb5), -W / 2, H / 2, 0);
  box(t, H, D, mat(0xe2cfb5), W / 2, H / 2, 0);
  // a skirting board
  box(W, 0.12, 0.03, mat(0xf6efe4), 0, 0.06, back + 0.07);

  // window frame and panes
  const frameMat = mat(0xfaf5ec, { roughness: 0.5 });
  const windowGroup = group(win.x, win.y, back, 'the window', 'window');
  box(win.w + 0.16, 0.08, 0.2, frameMat, 0, -win.h / 2, 0.02, windowGroup);
  box(win.w + 0.16, 0.08, 0.14, frameMat, 0, win.h / 2, 0, windowGroup);
  box(0.08, win.h, 0.14, frameMat, -win.w / 2, 0, 0, windowGroup);
  box(0.08, win.h, 0.14, frameMat, win.w / 2, 0, 0, windowGroup);
  box(0.05, win.h, 0.08, frameMat, 0, 0, 0, windowGroup);
  box(win.w, 0.05, 0.08, frameMat, 0, 0.1, 0, windowGroup);
  box(win.w + 0.3, 0.05, 0.32, frameMat, 0, -win.h / 2 - 0.04, 0.1, windowGroup); // sill
  // what's outside
  const dayTex = skyTexture(false);
  const nightTex = skyTexture(true);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshBasicMaterial({ map: dayTex, fog: false }));
  outside.position.set(win.x, win.y, back - 3);
  scene.add(outside);
  windowGroup.userData.hit = [outside];
  // sheer curtains
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0xfff4e6, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 1 });
  const curtains = [-1, 1].map((side) => {
    const geo = new THREE.PlaneGeometry(0.55, win.h + 0.5, 12, 1);
    const m = new THREE.Mesh(geo, curtainMat);
    m.position.set(win.x + side * (win.w / 2 + 0.12), win.y - 0.05, back + 0.22);
    m.userData.base = geo.attributes.position.array.slice();
    scene.add(m);
    return m;
  });

  // lights: the sun through the window, the room's warm fill
  const hemi = new THREE.HemisphereLight(0xffe2c4, 0x3a2a22, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc98a, 3.2);
  sun.position.set(win.x + 2.6, 4.6, back - 6);
  sun.target.position.set(-0.6, 0, -0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0006;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const moonLight = new THREE.DirectionalLight(0x8fa6ff, 0);
  moonLight.position.copy(sun.position);
  moonLight.target.position.copy(sun.target.position);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(512, 512);
  scene.add(moonLight, moonLight.target);

  // the beam of light, and the dust in it
  const beamDir = sun.target.position.clone().sub(sun.position).normalize();
  const beamStart = new THREE.Vector3(win.x, win.y, back);
  const beamLen = Math.min(5.2, (win.y - 0.02) / Math.max(0.05, -beamDir.y));
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uStrength: { value: 1 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vView; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vView = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uTime; uniform float uStrength; varying vec2 vUv; varying vec3 vN; varying vec3 vView; void main(){ float along = vUv.y; float edge = pow(abs(dot(vN, vView)), 1.6); float flicker = 0.85 + 0.15 * sin(uTime * 0.7 + vUv.x * 12.0); float a = edge * smoothstep(0.0, 0.2, along) * smoothstep(1.0, 0.75, along) * 0.07 * flicker * uStrength; gl_FragColor = vec4(vec3(1.0, 0.82, 0.55) * a, a); }'
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.72, beamLen, 24, 1, true), beamMat);
  beam.position.copy(beamStart).addScaledVector(beamDir, beamLen / 2);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), beamDir);
  beam.scale.set(1.15, 1, 0.7);
  scene.add(beam);

  const DUST = 1400;
  const dustGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(DUST * 3);
  const seed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    pos[i * 3] = (Math.random() - 0.5) * (W - 0.6);
    pos[i * 3 + 1] = Math.random() * (H - 0.2);
    pos[i * 3 + 2] = (Math.random() - 0.5) * (D - 0.6);
    seed[i] = Math.random();
  }
  // half of them gather where the sun is, so the beam looks full
  for (let i = 0; i < DUST / 2; i++) {
    const k = Math.random() * beamLen;
    const p = beamStart.clone().addScaledVector(beamDir, k);
    pos[i * 3] = p.x + (Math.random() - 0.5) * 1.6;
    pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * 1.2;
    pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 1.2;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uTex: { value: dotTexture() },
      uStart: { value: beamStart },
      uDir: { value: beamDir },
      uSun: { value: 1 },
      uScale: { value: 1 }
    },
    vertexShader: `
      attribute float seed;
      uniform float uTime; uniform vec3 uStart; uniform vec3 uDir; uniform float uSun; uniform float uScale;
      varying float vLight;
      void main() {
        vec3 p = position;
        float s = seed * 6.2831;
        p += vec3(sin(uTime * 0.13 + s * 3.0), sin(uTime * 0.09 + s * 5.0) * 0.6 - 0.0, cos(uTime * 0.11 + s * 7.0)) * 0.22;
        p.y = mod(p.y - uTime * (0.01 + seed * 0.02), 3.0);
        vec3 rel = p - uStart;
        float k = dot(rel, uDir);
        float d = length(rel - uDir * k);
        float inBeam = smoothstep(0.7, 0.1, d) * step(0.0, k) * uSun;
        vLight = 0.06 + inBeam * (0.45 + 0.2 * sin(uTime * 2.0 + s * 9.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min(6.0, (2.0 + seed * 3.0) * uScale / -mv.z * (0.6 + inBeam));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uTex; varying float vLight;
      void main() { vec4 c = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vec3(1.0, 0.9, 0.7) * c.a * vLight, c.a * vLight); }`
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // a rug
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), mat(0xc98f7a, { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-0.4, 0.005, 0.8);
  rug.scale.set(1.3, 1, 1);
  rug.receiveShadow = true;
  scene.add(rug);
  const rugRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.2, 48), mat(0xf2d6b8, { roughness: 1 }));
  rugRing.rotation.x = -Math.PI / 2;
  rugRing.position.set(-0.4, 0.008, 0.8);
  rugRing.scale.set(1.3, 1, 1);
  scene.add(rugRing);

  // the bed, against the left wall
  const bed = group(-2.7, 0, -1.3, 'the bed', 'bed');
  box(1.7, 0.35, 2.3, mat(0x8a5a3b), 0, 0.18, 0, bed);
  box(1.72, 0.9, 0.1, mat(0x7a4d31), 0, 0.45, -1.15, bed);
  box(1.6, 0.22, 2.15, mat(0xfbf7f0), 0, 0.46, 0.02, bed);
  const duvetMesh = box(1.66, 0.14, 1.5, mat(0xffffff, { map: duvet(), roughness: 0.95 }), 0, 0.62, 0.35, bed);
  duvetMesh.rotation.z = 0.02;
  const pillow = (x) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), mat(0xfff9f2));
    p.scale.set(0.62, 0.2, 0.36);
    p.position.set(x, 0.66, -0.8);
    p.castShadow = true;
    p.receiveShadow = true;
    bed.add(p);
  };
  pillow(-0.38);
  pillow(0.38);
  const blanket = box(1.7, 0.08, 0.5, mat(0xd98f8f, { roughness: 1 }), 0, 0.7, 0.95, bed);
  blanket.rotation.x = 0.05;
  // a plush on the bed
  const plush = new THREE.Group();
  const plushMat = mat(0xf6e6d0);
  const bodyP = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), plushMat);
  const headP = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), plushMat);
  headP.position.y = 0.2;
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), plushMat);
    ear.position.set(s * 0.08, 0.31, 0);
    plush.add(ear);
  });
  plush.add(bodyP, headP);
  plush.position.set(0.45, 0.78, -0.45);
  plush.traverse((o) => { o.castShadow = true; });
  bed.add(plush);

  // fairy lights over the bed
  const bulbs = [];
  for (let i = 0; i < 22; i++) {
    const k = i / 21;
    const x = -3.9 + 0.03;
    const z = -3.0 + k * 3.4;
    const y = 2.55 - Math.sin(k * Math.PI) * 0.35 - Math.sin(k * Math.PI * 3) * 0.05;
    const hue = [0xfff1c4, 0xffc4d6, 0xc4e6ff, 0xd8ffc4][i % 4];
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 1.2 }));
    b.position.set(x + 0.08, y, z);
    b.userData.phase = Math.random() * 6;
    scene.add(b);
    bulbs.push(b);
  }
  const fairyGlow = new THREE.PointLight(0xffd9b0, 0.4, 3.5, 2);
  fairyGlow.position.set(-3.6, 2.3, -1.4);
  scene.add(fairyGlow);

  // the desk under the window, and what's on it
  const desk = new THREE.Group();
  desk.position.set(1.6, 0, -2.95);
  scene.add(desk);
  const wood = mat(0xa56d45, { roughness: 0.6 });
  box(2.2, 0.06, 0.8, wood, 0, 0.78, 0, desk);
  [[-1.02, -0.34], [1.02, -0.34], [-1.02, 0.34], [1.02, 0.34]].forEach(([x, z]) => box(0.06, 0.78, 0.06, wood, x, 0.39, z, desk));
  box(0.6, 0.35, 0.72, mat(0x94603b), 0.78, 0.55, 0, desk); // drawers

  // the laptop, glowing
  const screenTex = canvasTexture(256, 160, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#0b2233');
    g.addColorStop(1, '#3a1f5c');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff6e8';
    c.font = 'italic 30px Georgia, serif';
    c.fillText("renn's void", 40, 86);
    c.fillStyle = 'rgba(191,227,218,0.8)';
    c.font = '14px monospace';
    c.fillText('> dreaming...', 40, 116);
  });
  const laptop = new THREE.Group();
  laptop.position.set(-0.35, 0.81, 0.02);
  desk.add(laptop);
  box(0.62, 0.025, 0.42, mat(0xc9ccd3, { metalness: 0.4, roughness: 0.4 }), 0, 0, 0, laptop);
  const lid = new THREE.Group();
  lid.position.set(0, 0.01, -0.2);
  lid.rotation.x = -0.28;
  laptop.add(lid);
  box(0.62, 0.4, 0.02, mat(0xc9ccd3, { metalness: 0.4, roughness: 0.4 }), 0, 0.2, 0, lid);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.35), new THREE.MeshBasicMaterial({ map: screenTex }));
  screen.position.set(0, 0.2, 0.012);
  lid.add(screen);

  // the letter
  const letter = group(0.25, 0.815, 0.2, 'the letter ↓', 'letter');
  letter.rotation.y = 0.25;
  desk.remove(letter);
  desk.add(letter);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), mat(0xfbf5ea, { roughness: 1 }));
  paper.rotation.x = -Math.PI / 2;
  paper.receiveShadow = true;
  letter.add(paper);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16), mat(0xb3243a, { roughness: 0.4 }));
  seal.position.set(0.06, 0.006, 0.1);
  letter.add(seal);

  // the camera
  const cam = group(0.05, 0.81, -0.22, 'my camera', 'camera');
  desk.remove(cam);
  desk.add(cam);
  box(0.24, 0.14, 0.1, mat(0x222226, { roughness: 0.5 }), 0, 0.07, 0, cam);
  box(0.08, 0.03, 0.06, mat(0x222226), -0.06, 0.155, 0, cam);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 20), mat(0x111114, { metalness: 0.6, roughness: 0.3 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0.02, 0.07, 0.08);
  lens.castShadow = true;
  cam.add(lens);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), new THREE.MeshStandardMaterial({ color: 0x3a5a8c, metalness: 0.9, roughness: 0.1 }));
  glass.position.set(0.02, 0.07, 0.126);
  cam.add(glass);

  // a mug, steaming
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 18), mat(0xe8d9ff, { roughness: 0.5 }));
  mug.position.set(-0.85, 0.865, 0.18);
  mug.castShadow = true;
  desk.add(mug);
  const steam = [];
  const steamMat = new THREE.SpriteMaterial({ map: dotTexture(), transparent: true, opacity: 0.25, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(steamMat.clone());
    sp.userData.k = i / 6;
    desk.add(sp);
    steam.push(sp);
  }

  // the lamp
  const lamp = group(-0.95, 0.81, -0.22, 'the lamp', 'lamp');
  desk.remove(lamp);
  desk.add(lamp);
  const brass = mat(0xc9a15a, { metalness: 0.7, roughness: 0.35 });
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.03, 20), brass);
  lamp.add(lampBase);
  box(0.02, 0.45, 0.02, brass, 0, 0.23, 0, lamp);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xf2c38a, emissive: 0xffb866, emissiveIntensity: 0.2, side: THREE.DoubleSide }));
  shade.position.set(0, 0.5, 0);
  lamp.add(shade);
  const lampLight = new THREE.PointLight(0xffb866, 0, 4, 2);
  lampLight.position.set(0, 0.44, 0);
  lampLight.castShadow = false;
  lamp.add(lampLight);

  // the guitar, leaning on the wall by the desk
  const guitar = group(3.55, 0, -2.2, 'the guitar', 'guitar');
  guitar.rotation.set(0, -1.2, 0.12);
  const gWood = mat(0xd89655, { roughness: 0.45 });
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 32), gWood);
  lower.rotation.x = Math.PI / 2;
  lower.position.y = 0.3;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 32), gWood);
  upper.rotation.x = Math.PI / 2;
  upper.position.y = 0.58;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), mat(0x1a0f08));
  hole.position.set(0, 0.5, 0.051);
  guitar.add(lower, upper, hole);
  box(0.06, 0.62, 0.035, mat(0x4a2c18), 0, 1.02, 0.03, guitar);
  box(0.09, 0.16, 0.03, mat(0x2d1a0e), 0, 1.4, 0.02, guitar);
  box(0.16, 0.025, 0.02, mat(0x2d1a0e), 0, 0.22, 0.06, guitar);
  guitar.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // the record player on a crate
  const player = group(3.2, 0, 0.6, 'the record player', 'record');
  box(0.8, 0.5, 0.6, mat(0xb88457, { roughness: 1 }), 0, 0.25, 0, player);
  box(0.62, 0.1, 0.46, mat(0x3a2a22, { roughness: 0.5 }), 0, 0.55, 0, player);
  const record = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.01, 40), mat(0x0c0c0e, { roughness: 0.25, metalness: 0.2 }));
  record.position.set(-0.06, 0.61, 0);
  record.castShadow = true;
  player.add(record);
  const labelTex = canvasTexture(128, 128, (c) => { c.fillStyle = '#f29fc0'; c.beginPath(); c.arc(64, 64, 64, 0, 7); c.fill(); c.fillStyle = '#1d1830'; c.beginPath(); c.arc(64, 64, 6, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillRect(30, 40, 50, 6); });
  const recordLabel = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), new THREE.MeshStandardMaterial({ map: labelTex }));
  recordLabel.rotation.x = -Math.PI / 2;
  recordLabel.position.set(-0.06, 0.616, 0);
  player.add(recordLabel);
  box(0.02, 0.02, 0.28, brass, 0.2, 0.63, 0.02, player);
  player.rotation.y = -0.4;

  // records leaning against the crate
  // covers pinned on the wall above the bed, and a few by the window
  const loader = new THREE.TextureLoader();
  const pinned = [
    ['veil', -2.2, 2.05, -0.12], ['deep-love', -1.55, 2.2, 0.08], ['memory', -2.9, 2.25, 0.1],
    ['anthems', -0.9, 1.95, -0.05], ['march-5', -1.6, 1.6, -0.1], ['sun-and-moon', -2.4, 1.5, 0.12],
    ['treehouse', 3.0, 2.3, -0.06], ['milk', 3.1, 1.75, 0.08]
  ];
  pinned.forEach(([cover, x, y, rot]) => {
    const song = songs.find((s) => s.cover === cover);
    if (!song) return;
    const tex = loader.load(`../assets/covers/${cover}.jpg`);
    tex.colorSpace = THREE.SRGBColorSpace;
    const g = group(x, y, back + 0.075, `${song.title} — ${song.artist}`, 'cover');
    g.userData.song = song;
    g.rotation.z = rot;
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.54), mat(0xfbf7f0));
    frame.position.z = -0.003;
    frame.receiveShadow = true;
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    pic.position.y = 0.04;
    pic.receiveShadow = true;
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), new THREE.MeshStandardMaterial({ color: 0xf6d7a8, transparent: true, opacity: 0.8 }));
    tape.position.set(0, 0.27, 0.002);
    tape.rotation.z = 0.2;
    g.add(frame, pic, tape);
  });

  // a plant in the corner
  const plant = group(-3.4, 0, 1.9, 'the plant', 'plant');
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.36, 20), mat(0xc0704f));
  pot.position.y = 0.18;
  pot.castShadow = true;
  plant.add(pot);
  const leafMat = mat(0x4f8a4a, { roughness: 0.6, side: THREE.DoubleSide });
  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), leafMat);
    leaf.scale.set(0.9, 0.12, 0.55);
    const a = (i / 9) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.y = 0.36;
    pivot.rotation.y = a;
    leaf.position.set(0.2, 0.18 + (i % 3) * 0.14, 0);
    leaf.rotation.z = 0.5 + (i % 3) * 0.15;
    leaf.castShadow = true;
    pivot.add(leaf);
    plant.add(pivot);
    leaves.push(pivot);
  }

  // a book stack and a floor cushion, because it's a room someone lives in
  const books = new THREE.Group();
  books.position.set(-0.9, 0, -3.1);
  scene.add(books);
  [0x6b8fb3, 0xd9a441, 0x9c5a7a, 0x4f7a5a].forEach((c, i) => {
    const b = box(0.42 - i * 0.03, 0.07, 0.3, mat(c), 0, 0.035 + i * 0.07, 0, books);
    b.rotation.y = (i % 2 ? 0.15 : -0.1);
  });
  const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 12), mat(0x7b8fc9, { roughness: 1 }));
  cushion.scale.set(1, 0.3, 1);
  cushion.position.set(0.5, 0.12, 1.2);
  cushion.castShadow = true;
  cushion.receiveShadow = true;
  scene.add(cushion);

  /* ---------- looking around ---------- */
  const target = new THREE.Vector3(0.2, 1.15, -1.2);
  let yaw = 0;
  let pitch = 0;
  let tYaw = 0;
  let tPitch = 0;
  let drag = null;
  let hover = null;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 70 : 52;
    camera.updateProjectionMatrix();
    dustMat.uniforms.uScale.value = h * renderer.getPixelRatio() * 0.05;
  }

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...clickable, outside], true);
    for (const h of hits) {
      let o = h.object;
      if (o === outside) return windowGroup;
      while (o && !clickable.includes(o)) o = o.parent;
      if (o) return o;
    }
    return null;
  }

  function setHover(g, e) {
    if (g !== hover) {
      if (hover) hover.traverse((o) => { if (o.isMesh && o.material.emissive && o.userData.glow) o.material.emissive.setHex(o.userData.glow.base); });
      hover = g;
      if (g) {
        g.traverse((o) => {
          if (o.isMesh && o.material.emissive && !o.material.map?.isCanvasTexture) {
            if (!o.userData.glow) { o.material = o.material.clone(); o.userData.glow = { base: o.material.emissive.getHex() }; }
            o.material.emissive.setHex(0x3a2a10);
          }
        });
      }
      canvas.style.cursor = g ? 'pointer' : 'grab';
      tag.textContent = g ? g.userData.name : '';
      tag.hidden = !g;
    }
    if (g && e) {
      tag.style.left = `${e.clientX}px`;
      tag.style.top = `${e.clientY}px`;
    }
  }

  /* ---------- things happening ---------- */
  let night = false;
  let lampOn = false;
  let spinning = false;
  let wiggle = 0;
  const say = (text, extra) => Void.dream.toast?.(text, extra);

  function act(g) {
    const what = g.userData.action;
    Void.dream.sound?.chime(Void.dream.sound.step(3, 330), { vol: 0.06, dur: 0.8 });
    if (what === 'window') {
      night = !night;
      outside.material.map = night ? nightTex : dayTex;
      outside.material.needsUpdate = true;
      if (night && !lampOn) toggleLamp(true);
      say(night ? 'night, suddenly. the fairy lights feel important now.' : 'the sun comes back.');
    } else if (what === 'lamp') toggleLamp(!lampOn);
    else if (what === 'guitar') { say('it\'s a little out of tune.'); setTimeout(() => { location.hash = 'guitar'; }, 500); }
    else if (what === 'camera') { say('i take pictures of everything.'); setTimeout(() => { location.hash = 'gallery'; }, 600); }
    else if (what === 'record') {
      const song = Void.dream.palette.tuned('about');
      if (song) Void.dream.tapes.play(songs.indexOf(song));
    } else if (what === 'cover') {
      Void.dream.tapes.play(songs.indexOf(g.userData.song));
    } else if (what === 'letter') {
      section.querySelector('.letter')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    } else if (what === 'plant') {
      wiggle = 1;
      say('the plant is called gerald. he is doing his best.');
    } else if (what === 'bed') {
      say('i go to sleep way too late. this site is proof.');
    }
  }

  function toggleLamp(on) {
    lampOn = on;
    shade.material.emissiveIntensity = on ? 1.4 : 0.2;
  }

  Void.on('spotify', (st) => { spinning = !!st.playing; });

  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: tYaw, pitch: tPitch, moved: false };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = (e.clientX - drag.x) / window.innerWidth;
      const dy = (e.clientY - drag.y) / window.innerHeight;
      if (Math.hypot(dx, dy) > 0.01) drag.moved = true;
      tYaw = Math.max(-0.75, Math.min(0.75, drag.yaw - dx * 2.2));
      tPitch = Math.max(-0.25, Math.min(0.3, drag.pitch + dy * 1.2));
      return;
    }
    setHover(pick(e), e);
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasClick = drag && !drag.moved;
    drag = null;
    canvas.style.cursor = hover ? 'pointer' : 'grab';
    if (wasClick) {
      const g = pick(e);
      if (g) act(g);
    }
  });
  canvas.addEventListener('pointerleave', () => setHover(null));

  /* ---------- the loop ---------- */
  const clock = new THREE.Clock();
  let sunAmt = 1;
  function frame() {
    requestAnimationFrame(frame);
    if (!open) return;
    const dt = Math.min(0.05, clock.getDelta());
    const time = reduced() ? 0 : clock.elapsedTime;

    // the camera: dragged, plus a slow breath
    yaw += (tYaw - yaw) * (1 - Math.exp(-dt / 0.25));
    pitch += (tPitch - pitch) * (1 - Math.exp(-dt / 0.25));
    const sway = reduced() ? 0 : Math.sin(time * 0.2) * 0.04;
    const radius = 4.9;
    const a = yaw + sway;
    camera.position.set(target.x + Math.sin(a) * radius, target.y + 0.45 + pitch * 2.2, target.z + Math.cos(a) * radius);
    camera.lookAt(target.x, target.y - pitch * 0.4, target.z);

    // day and night
    sunAmt += ((night ? 0 : 1) - sunAmt) * (1 - Math.exp(-dt / 0.6));
    sun.intensity = 3.2 * sunAmt;
    moonLight.intensity = 0.7 * (1 - sunAmt);
    hemi.intensity = 0.2 + 0.4 * sunAmt;
    hemi.color.setHex(night ? 0x8090c0 : 0xffe2c4);
    beamMat.uniforms.uStrength.value = sunAmt;
    beamMat.uniforms.uTime.value = time;
    dustMat.uniforms.uTime.value = time;
    dustMat.uniforms.uSun.value = sunAmt;
    lampLight.intensity += ((lampOn ? 2.2 : 0) - lampLight.intensity) * (1 - Math.exp(-dt / 0.2));
    fairyGlow.intensity = 0.3 + 1.1 * (1 - sunAmt);
    renderer.toneMappingExposure = 0.9 + 0.2 * sunAmt;
    bulbs.forEach((b) => { b.material.emissiveIntensity = (0.8 + 1.4 * (1 - sunAmt)) * (0.7 + 0.3 * Math.sin(time * 2 + b.userData.phase)); });

    // curtains breathing in a draft
    curtains.forEach((c, ci) => {
      const arr = c.geometry.attributes.position.array;
      const base = c.userData.base;
      for (let i = 0; i < arr.length; i += 3) {
        const down = (0.9 - base[i + 1]) / 2;
        arr[i + 2] = base[i + 2] + Math.sin(time * 1.1 + base[i] * 9 + ci) * 0.05 * Math.max(0, down);
      }
      c.geometry.attributes.position.needsUpdate = true;
    });

    // steam, the record, the plant
    steam.forEach((sp) => {
      const k = (sp.userData.k + time * 0.25) % 1;
      sp.position.set(-0.85 + Math.sin(k * 8 + sp.userData.k * 5) * 0.03, 0.95 + k * 0.4, 0.18);
      sp.scale.setScalar(0.05 + k * 0.12);
      sp.material.opacity = 0.22 * (1 - k);
    });
    if (spinning) { record.rotation.y += dt * 3.5; recordLabel.rotation.z += dt * 3.5; }
    wiggle = Math.max(0, wiggle - dt * 0.8);
    leaves.forEach((l, i) => { l.rotation.z = Math.sin(time * 1.5 + i) * 0.03 + Math.sin(time * 14 + i) * 0.15 * wiggle; });
    plush.rotation.y = Math.sin(time * 0.5) * 0.1;

    renderer.render(scene, camera);
  }

  resize();
  window.addEventListener('resize', resize);
  canvas.style.cursor = 'grab';
  frame();
}

function start() {
  if (started) return;
  started = true;
  try {
    build();
    holder.classList.add('is-ready');
    section.classList.add('has-3d');
  } catch (err) {
    console.warn('[dream] no 3D bedroom:', err.message);
    section.classList.add('no-3d');
  }
}

Void.on('view', ({ id }) => {
  open = id === 'about';
  if (open) start();
});
if (Void.dream.views.current() === 'about') { open = true; start(); }
