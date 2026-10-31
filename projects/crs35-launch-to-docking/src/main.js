import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createMaterials } from 'iss/model/materials.js';
import { buildISS } from 'iss/model/iss.js';
import { createEarth, createSky, createEnvironment } from 'iss/scene/earth.js';
import { Orbit, sunECI, gmst } from 'iss/sim/orbit.js';
import { buildFalcon9, buildPad, buildLandingZone, buildDragon } from './model/falcon9.js';
import * as TR from './sim/trajectory.js';
import { FACTS, SOURCES, ACTS, CHAPTERS, RNDZ_KEYS, PORT } from './data/mission.js';

const D2R = Math.PI / 180;
const smooth = THREE.MathUtils.smoothstep;
const $ = (s) => document.querySelector(s);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = new THREE.Vector3(0, 1, 0);
const REm = TR.RE * 1000;

// ── Renderer & passes ────────────────────────────────────────────────────────
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const far = new THREE.Scene();
far.background = new THREE.Color(0x000000);
const launchScene = new THREE.Scene();
const dockScene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 4e5);
const farCam = new THREE.PerspectiveCamera(45, 1, 1e3, 1.2e9);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

const labelRenderer = new CSS2DRenderer({ element: $('#labels') });
const composer = new EffectComposer(renderer);
const farPass = new RenderPass(far, farCam);
const nearPass = new RenderPass(launchScene, camera);
nearPass.clear = false;
nearPass.clearDepth = true;
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.6, 2.2);
composer.addPass(farPass);
composer.addPass(nearPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ── Far scene: Earth, stars, Sun, twilight sky ───────────────────────────────
const mats = createMaterials();
const earth = createEarth();
far.add(earth.group);
const sky = createSky();
far.add(sky.stars, sky.sun);

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(3e7, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: { sunDir: { value: V() }, fade: { value: 1 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 sunDir; uniform float fade; varying vec3 vW;
      void main(){
        vec3 d = normalize(vW - cameraPosition);
        float sunAlt = sunDir.y;
        float dawn = smoothstep(-0.32, -0.02, sunAlt);
        vec3 night = vec3(0.004, 0.007, 0.018);
        vec3 deep = mix(night, vec3(0.03, 0.06, 0.15), dawn);
        float horizon = 1.0 - smoothstep(-0.02, 0.45, d.y);
        float az = max(0.0, dot(normalize(d.xz + 1e-5), normalize(sunDir.xz + 1e-5)));
        vec3 glow = vec3(0.55, 0.22, 0.06) * pow(az, 5.0) * horizon * dawn * 1.4 + vec3(0.06, 0.1, 0.22) * horizon * dawn;
        vec3 col = deep + glow;
        gl_FragColor = vec4(col, fade * clamp(0.35 + dawn, 0.0, 0.95));
        #include <colorspace_fragment>
      }`,
  }),
);
skyDome.renderOrder = -1;
far.add(skyDome);

// Orbit-act overlay (ECI → world: (X, Z, −Y), metres)
const overlay = new THREE.Group();
far.add(overlay);
const eciToWorld = (v, out = V()) => out.set(v.x, v.z, -v.y);
function orbitLine(color, opacity) {
  const pts = [];
  for (let i = 0; i <= 256; i++) pts.push(V());
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  line.frustumCulled = false;
  return line;
}
const issOrbitLine = orbitLine(0xffffff, 0.55);
const dragonOrbitLine = orbitLine(0x5ce1e6, 0.85);
overlay.add(issOrbitLine, dragonOrbitLine);
function marker(color, size) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, '#fff');
  grd.addColorStop(0.25, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, sizeAttenuation: false, transparent: true }));
  s.scale.setScalar(size);
  return s;
}
const issMarker = marker('#ffffff', 0.035);
const dragonMarker = marker('#5ce1e6', 0.03);
overlay.add(issMarker, dragonMarker);
const label = (text, cls) => { const el = document.createElement('div'); el.className = `lbl ${cls || ''}`; el.textContent = text; return new CSS2DObject(el); };
const issLbl = label('ISS', 'iss');
const dragonLbl = label('Dragon');
issMarker.add(issLbl);
dragonMarker.add(dragonLbl);

// ── Launch act: pad, ground, Falcon 9, landing zone ──────────────────────────
const lat = TR.SITE.lat * D2R, lon = TR.SITE.lon * D2R;
const E = new THREE.Vector3(-Math.sin(lon), Math.cos(lon), 0);
const N = new THREE.Vector3(-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat));
const U = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
const AZ = Math.asin(Math.cos(TR.INC) / Math.cos(lat));                 // ≈ 45° NE launch azimuth
const LX = E.clone().multiplyScalar(Math.sin(AZ)).addScaledVector(N, Math.cos(AZ));
const LY = U.clone();
const LZ = new THREE.Vector3().crossVectors(LX, LY);
const toLocal = (ecef, out = V()) => out.set(ecef.dot(LX), ecef.dot(LY), ecef.dot(LZ));
const Lmat = new THREE.Matrix4().set(LX.x, LX.y, LX.z, 0, LY.x, LY.y, LY.z, 0, LZ.x, LZ.y, LZ.z, 0, 0, 0, 0, 1);
const Pmat = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
const earthQuatLaunch = new THREE.Quaternion().setFromRotationMatrix(Lmat.clone().multiply(Pmat));
const eastL = toLocal(E);
const northL = toLocal(N);

const lzPos = northL.clone().multiplyScalar(-9000).addScaledVector(eastL, -1200).setY(0);   // ≈ 9 km south of the pad
const boosterTables = TR.boosterTables({ x: lzPos.x, z: lzPos.z });

const pad = buildPad(mats);
launchScene.add(pad.group);
const lz = buildLandingZone();
lz.position.copy(lzPos);
launchScene.add(lz);
const lzLabel = label('Landing zone', 'muted');
lzLabel.position.set(0, 60, 0);
lz.add(lzLabel);

const groundMat = new THREE.ShaderMaterial({
  transparent: true,
  uniforms: { east: { value: new THREE.Vector2(eastL.x, eastL.z).normalize() }, glowPos: { value: V() }, glow: { value: 0 }, fade: { value: 1 } },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform vec2 east; uniform vec3 glowPos; uniform float glow; uniform float fade; varying vec3 vW;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec2 p = vW.xz;
      float coast = dot(p, east) - 1500.0 - 2200.0 * (n(p / 9000.0) - 0.5) - 900.0 * (n(p / 2500.0) - 0.5);
      float sea = smoothstep(-40.0, 40.0, coast);
      float river = smoothstep(120.0, 0.0, abs(dot(p, east) + 6500.0 + 3000.0 * (n(p / 20000.0) - 0.5)));
      sea = max(sea, river * 0.9);
      vec3 land = mix(vec3(0.020, 0.024, 0.016), vec3(0.03, 0.028, 0.022), n(p / 600.0));
      vec3 col = mix(land, vec3(0.008, 0.012, 0.024), sea);
      float beach = smoothstep(80.0, 0.0, abs(coast));
      col += vec3(0.04, 0.038, 0.03) * beach;
      float town = step(0.97, h(floor(p / 140.0))) * smoothstep(9.0, 3.0, length(fract(p / 140.0) - 0.5) * 140.0) * (1.0 - sea) * step(4000.0, length(p));
      col += vec3(1.0, 0.72, 0.38) * town * 0.6;
      float d = length(vW - glowPos);
      col += vec3(1.0, 0.55, 0.22) * glow * 1.6e4 / (d * d + 1.2e4);
      gl_FragColor = vec4(col, fade);
      #include <colorspace_fragment>
    }`,
});
const ground = new THREE.Mesh(new THREE.CircleGeometry(220000, 128), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.2;
launchScene.add(ground);

const f9 = buildFalcon9(mats);
const s1 = f9.s1, s2 = f9.s2;
const dragonL = f9.dragon;
const dragonRoot = new THREE.Group();
s2.remove(dragonL.group);
dragonRoot.add(dragonL.group);
launchScene.add(s1, s2, dragonRoot);
const lblDragonL = label('Dragon');
lblDragonL.position.set(0, 72, 0);
dragonRoot.add(lblDragonL);
const lblBooster = label('Booster', 'muted');
lblBooster.position.set(0, 52, 0);
s1.add(lblBooster);

const sunL = new THREE.DirectionalLight(0xfff1e0, 0);
launchScene.add(sunL, sunL.target);
launchScene.add(new THREE.HemisphereLight(0x2b3a5c, 0x0a0a0a, 0.35));
launchScene.environment = createEnvironment(renderer);
launchScene.environmentIntensity = 0.15;

// Exhaust trail: every point is precomputed with its birth time and whether
// sunlight reaches it (the pre-dawn launch climbs out of Earth's shadow).
const sunEciL = sunECI(TR.LIFTOFF, V());
const g0 = gmst(TR.LIFTOFF);
const sunEcef = V().set(sunEciL.x * Math.cos(g0) + sunEciL.y * Math.sin(g0), -sunEciL.x * Math.sin(g0) + sunEciL.y * Math.cos(g0), sunEciL.z);
const sunLocal = toLocal(sunEcef).normalize();
const earthCenterL = new THREE.Vector3(0, -REm, 0);
function sunlit(p) {
  const q = V().subVectors(p, earthCenterL);
  const along = q.dot(sunLocal);
  if (along > 0) return 1;
  const perp = q.addScaledVector(sunLocal, -along).length();
  return smooth(perp, REm + 5e3, REm + 45e3);
}

const trail = (() => {
  const pos = [], birth = [], lit = [], size = [];
  const p = V();
  const add = (t, h, dr, cr, base) => {
    TR.localPos(h, dr, cr, p);
    pos.push(p.x, p.y, p.z); birth.push(t); lit.push(sunlit(p)); size.push(base + h * 5);
  };
  for (let t = 0; t <= TR.MILESTONES.seco; t += 0.4) {
    const e = TR.engineState(t);
    if (!e.s1 && !e.s2) continue;
    const s = TR.upperState(t);
    add(t, s.h, s.dr, 0, e.s2 ? 40 : 14);
  }
  for (let t = 141; t <= 465; t += 0.3) {
    if (!TR.engineState(t).booster) continue;
    const b = TR.boosterState(t, boosterTables);
    add(t, b.h, b.dr, b.cr, 16);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('birth', new THREE.Float32BufferAttribute(birth, 1));
  geo.setAttribute('lit', new THREE.Float32BufferAttribute(lit, 1));
  geo.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, scale: { value: 500 } },
    vertexShader: `attribute float birth; attribute float lit; attribute float size; uniform float time; uniform float scale;
      varying float vLit; varying float vAge; varying float vNear;
      void main(){
        vAge = time - birth; vLit = lit;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float s = (size + max(vAge, 0.0) * (1.0 + size * 0.01));
        vNear = smoothstep(s * 1.5, s * 6.0, -mv.z);       // fade puffs the camera is inside
        gl_PointSize = vAge < 0.0 ? 0.0 : clamp(s * scale / max(-mv.z, 1.0), 0.0, 220.0);
        // Not emitted yet: push outside the clip volume (some drivers still draw 1-px points)
        gl_Position = vAge < 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vLit; varying float vAge; varying float vNear;
      void main(){
        vec2 c = gl_PointCoord - 0.5; float r = length(c);
        if (r > 0.5 || vAge < 0.0) discard;
        float soft = smoothstep(0.5, 0.0, r);
        vec3 young = vec3(1.0, 0.55, 0.2) * exp(-max(vAge, 0.0) / 1.2) * 0.7;
        vec3 litCol = vec3(0.85, 0.8, 0.78) * vLit * 0.22;
        vec3 dark = vec3(0.03, 0.028, 0.028) * (1.0 - vLit);
        gl_FragColor = vec4((young + litCol + dark) * soft * vNear, soft * 0.5 * vNear);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
})();
launchScene.add(trail);

// ── Dock act: the station and Dragon ─────────────────────────────────────────
const iss = buildISS(mats);
iss.setConfig({ nauka: true, prichal: true, pirs: false, bishop: true, irosa: ['2B', '4B', '3A', '4A', '1A', '1B'], vehicles: ['dragon', 'soyuz', 'progress'] });
iss.setMBS(0);
iss.canadarm.solve(new THREE.Vector3(5.5, 9.5, 7.5));
dockScene.add(iss.group);
const dragonD = buildDragon(mats);
dragonD.setNose(1);
dockScene.add(dragonD.group);
const lblDragonD = label('Dragon CRS-35');
lblDragonD.position.set(-1, 3, 0);
dragonD.group.add(lblDragonD);
const plumeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(190,215,255,0.6)'); grd.addColorStop(1, 'rgba(120,160,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const puffs = dragonD.thrusters.map((p) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: plumeTex, color: new THREE.Color(2.5, 2.6, 3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.position.copy(p); s.visible = false; dragonD.group.add(s); return s;
});
const dSun = new THREE.DirectionalLight(0xfff4e6, 3.2);
dSun.castShadow = true;
dSun.shadow.mapSize.set(4096, 4096);
Object.assign(dSun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 460 });
dSun.shadow.bias = -0.0004;
dSun.shadow.normalBias = 0.05;
dSun.target.position.set(-8, 0, 0);
const dEarth = new THREE.DirectionalLight(0x86a8ff, 0.5);
dEarth.position.set(0, -100, 0);
dockScene.add(dSun, dSun.target, dEarth, new THREE.AmbientLight(0x8a97b8, 0.06));
dockScene.environment = createEnvironment(renderer);
const issOrbit = new Orbit({ altitudeKm: TR.ISS_ALT, inclinationDeg: 51.64, raanDeg: TR.RAAN / D2R, epoch: TR.LIFTOFF, startPhase: null });
issOrbit.u0 = TR.issU(0);
const portV = new THREE.Vector3(...PORT);

// ── State ────────────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const state = {
  t: params.has('t') ? +params.get('t') : -90,
  playing: params.get('paused') !== '1',
  speed: 'auto', autoCam: true, view: null, act: null, chapter: -1,
  snap: true, rate: 0, prevRange: null,
};
const T_MIN = ACTS[0].t0, T_MAX = ACTS[ACTS.length - 1].t1;

// ── Time & scrubber mapping (each act gets a fixed share of the bar) ─────────
function tToF(t) {
  let f0 = 0;
  for (const a of ACTS) {
    if (t <= a.t1) return f0 + a.width * Math.max(0, (t - a.t0) / (a.t1 - a.t0));
    f0 += a.width;
  }
  return 1;
}
function fToT(f) {
  let f0 = 0;
  for (const a of ACTS) {
    if (f <= f0 + a.width) return a.t0 + ((f - f0) / a.width) * (a.t1 - a.t0);
    f0 += a.width;
  }
  return T_MAX;
}
const actOf = (t) => (t < ACTS[1].t0 ? ACTS[0] : t < ACTS[2].t0 ? ACTS[1] : ACTS[2]);
const chapterIndex = (t) => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };

function fmtMET(t) {
  const sign = t < 0 ? '−' : '+';
  const a = Math.abs(Math.round(t));
  const h = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), s = a % 60;
  const p = (x) => String(x).padStart(2, '0');
  return `T${sign}${p(h)}:${p(m)}:${p(s)}`;
}

// ── UI ───────────────────────────────────────────────────────────────────────
$('#facts').innerHTML = FACTS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
$('#sources').innerHTML = SOURCES.map(([k, u]) => `<a href="${u}" target="_blank" rel="noopener">${k} ↗</a>`).join('');
const ACT_COLOR = { launch: 'var(--act-launch)', orbit: 'var(--act-orbit)', dock: 'var(--act-dock)' };
const chapterEls = [];
{
  const list = $('#chapters');
  let lastAct = null;
  CHAPTERS.forEach((c, i) => {
    if (c.act !== lastAct) {
      const h = document.createElement('li');
      h.className = 'act-h';
      h.style.setProperty('--c', ACT_COLOR[c.act]);
      h.textContent = ACTS.find((a) => a.id === c.act).title;
      list.appendChild(h);
      lastAct = c.act;
    }
    const li = document.createElement('li');
    li.className = 'chapter';
    li.style.setProperty('--c', ACT_COLOR[c.act]);
    li.innerHTML = `<span class="c-t">${fmtMET(c.t).replace('T', '')}</span>${c.title}`;
    li.addEventListener('click', () => seek(c.t + 0.01));
    list.appendChild(li);
    chapterEls[i] = li;
  });
  $('#acts').innerHTML = ACTS.map((a) => `<button data-act="${a.id}" style="--c:${ACT_COLOR[a.id]};width:${a.width * 100}%"><span>${a.title}</span></button>`).join('');
  $('#acts').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (b) seek(ACTS.find((a) => a.id === b.dataset.act).t0 + 0.01);
  });
  $('#ticks').innerHTML = ACTS.map((a) => `<i style="width:${a.width * 100}%;background:${ACT_COLOR[a.id]}"></i>`).join('');
}
const scrub = $('#scrub');
let scrubbing = false;
scrub.addEventListener('input', () => { scrubbing = true; seek(fToT(scrub.value / 10000)); });
scrub.addEventListener('change', () => { scrubbing = false; });
$('#play').addEventListener('click', () => setPlaying(!state.playing));
$('#speeds').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-speed]');
  if (!b) return;
  state.speed = b.dataset.speed === 'auto' ? 'auto' : +b.dataset.speed;
  document.querySelectorAll('#speeds button').forEach((x) => x.classList.toggle('active', x === b));
});
$('#btn-full').addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()));
for (const side of ['left', 'right']) $(`#btn-${side}`).addEventListener('click', () => { $(`#${side}`).classList.toggle('open'); $(`#${side === 'left' ? 'right' : 'left'}`).classList.remove('open'); });

const VIEWS = {
  launch: [['pad', 'Tracking cam'], ['chase', 'Rocket'], ['booster', 'Booster'], ['dragon', 'Dragon'], ['wide', 'Trajectory']],
  orbit: [['globe', 'Globe'], ['odragon', 'Dragon']],
  dock: [['approach', 'Station'], ['ddragon', 'Dragon'], ['centerline', 'Centerline cam']],
};
function renderViews(act) {
  $('#views').innerHTML = `<button class="auto${state.autoCam ? ' active' : ''}" data-v="auto">Auto cam</button><span class="sep"></span>` +
    VIEWS[act].map(([id, name]) => `<button data-v="${id}">${name}</button>`).join('');
  highlightView();
}
function highlightView() {
  document.querySelectorAll('#views button').forEach((b) => {
    b.classList.toggle('active', b.dataset.v === 'auto' ? state.autoCam : b.dataset.v === state.view);
  });
}
$('#views').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-v]');
  if (!b) return;
  if (b.dataset.v === 'auto') { state.autoCam = !state.autoCam; highlightView(); return; }
  state.autoCam = false;
  setView(b.dataset.v);
});
function toast(title, detail) {
  const el = $('#toast');
  el.innerHTML = `<b>${title}</b>${detail.split('. ')[0]}.`;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 4200);
}

function seek(t) {
  state.t = THREE.MathUtils.clamp(t, T_MIN, T_MAX);
  state.snap = true;
  state.prevRange = null;
  if (state.autoCam) state.view = null;
}
function setPlaying(p) {
  if (p && state.t >= T_MAX) seek(T_MIN);
  state.playing = p;
  $('#play').classList.toggle('playing', p);
}
setPlaying(state.playing);

// ── Cameras ──────────────────────────────────────────────────────────────────
const focus = { launch: V(), booster: V(), dragon: V(), vel: V(1, 0, 0) };
let tween = null;
function flyTo(pos, target, dur = 1.2) {
  tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), start: performance.now(), dur: dur * 1000, follow: null };
}

function viewTarget(v) {
  return { pad: focus.launch, chase: focus.launch, booster: focus.booster, dragon: focus.dragon, odragon: focus.dragon, ddragon: focus.dragon }[v] || null;
}
function setView(v, instant = false) {
  state.view = v;
  highlightView();
  const act = state.act;
  controls.enabled = v !== 'centerline' && v !== 'pad';
  camera.fov = 45;
  if (act === 'launch') {
    camera.near = v === 'wide' ? 100 : 1;
    camera.far = v === 'wide' ? 5e6 : 3e6;
  } else if (act === 'orbit') { camera.near = 1e4; camera.far = 1.2e9; } else { camera.near = 0.05; camera.far = 4000; }
  camera.updateProjectionMatrix();
  const d = instant ? 0.01 : 1.3;
  if (v === 'chase' || v === 'booster' || v === 'dragon') {
    const tgt = viewTarget(v);
    const off = v === 'dragon' ? new THREE.Vector3(-14, 6, 18) : v === 'booster' ? new THREE.Vector3(70, 25, 120) : new THREE.Vector3(-60, -10, 150);
    flyTo(tgt.clone().add(off), tgt, d);
    tween.follow = v;
  } else if (v === 'pad') {
    tween = null;
    camera.position.set(-380, 28, 520);
  } else if (v === 'wide') {
    flyTo(new THREE.Vector3(-120e3, 160e3, 420e3), new THREE.Vector3(420e3, 60e3, 0), d);
  } else if (v === 'globe') {
    const h = eciToWorld(TR.eciDir(Math.PI / 2, V()).cross(TR.eciDir(0, V())));
    const p = h.multiplyScalar(-1).add(new THREE.Vector3(0.6, 0.35, 0.8)).normalize().multiplyScalar(2.6e7);
    flyTo(p, new THREE.Vector3(0, 0, 0), d);
  } else if (v === 'odragon') {
    const tgt = focus.dragon;
    flyTo(tgt.clone().multiplyScalar(1.45), tgt, d);
    tween.follow = v;
  } else if (v === 'approach') {
    const t = new THREE.Vector3(6, 45, 0);
    flyTo(t.clone().add(new THREE.Vector3(120, 30, 165)), t, d);
  } else if (v === 'ddragon') {
    const tgt = focus.dragon;
    flyTo(tgt.clone().add(new THREE.Vector3(16, 8, 18)), tgt, d);
    tween.follow = v;
  } else if (v === 'centerline') {
    tween = null;
  }
}

const prevFollow = V();
function updateCamera(dt) {
  const v = state.view;
  if (v === 'pad') {
    // Ground tracking camera with a long lens that zooms as the rocket climbs
    controls.target.copy(focus.launch).add(new THREE.Vector3(0, 30, 0));
    camera.lookAt(controls.target);
    const dist = camera.position.distanceTo(controls.target);
    camera.fov = THREE.MathUtils.clamp(2 * Math.atan(260 / dist) / D2R, 0.6, 45);
    camera.updateProjectionMatrix();
    return;
  }
  if (v === 'centerline') {
    camera.position.copy(portV).add(new THREE.Vector3(0, 0.4, 0.9));
    camera.up.set(1, 0, 0);
    camera.lookAt(camera.position.clone().add(Y));
    camera.up.set(0, 1, 0);
    camera.fov = 50;
    camera.updateProjectionMatrix();
    return;
  }
  const tgt = viewTarget(v);
  if (tween) {
    const k = Math.min(1, (performance.now() - tween.start) / tween.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    if (tween.follow && tgt) {
      // keep the destination glued to a moving target
      tween.p1.add(V().subVectors(tgt, tween.t1));
      tween.t1.copy(tgt);
    }
    camera.position.lerpVectors(tween.p0, tween.p1, e);
    controls.target.lerpVectors(tween.t0, tween.t1, e);
    if (k >= 1) { tween = null; prevFollow.copy(tgt || controls.target); }
  } else if (tgt) {
    const d = V().subVectors(tgt, prevFollow);
    camera.position.add(d);
    controls.target.add(d);
    prevFollow.copy(tgt);
  }
  controls.update(dt);
}

// ── Per-act updates ──────────────────────────────────────────────────────────
const _p = V(), _q = new THREE.Quaternion(), _a = V(), _b = V();
function poseAlong(obj, pos, nose) {
  obj.position.copy(pos);
  _q.setFromUnitVectors(Y, nose.clone().normalize());
  obj.quaternion.copy(_q);
}
function upperPose(t, out) {
  const s = TR.upperState(t);
  TR.localPos(s.h, s.dr, 0, out.pos);
  if (t < 8) out.nose.set(0, 1, 0);
  else {
    const a = TR.upperState(t + 0.5), b = TR.upperState(t - 0.5);
    TR.localPos(a.h, a.dr, 0, _a);
    TR.localPos(b.h, b.dr, 0, _b);
    out.nose.subVectors(_a, _b).normalize();
  }
  out.s = s;
  return out;
}
const up1 = { pos: V(), nose: V() };
const bpose = { pos: V(), nose: V() };

function updateLaunch(t, now) {
  const M = TR.MILESTONES;
  const eng = TR.engineState(t);
  upperPose(Math.max(0, t), up1);
  const radialUp = (p) => V().subVectors(p, earthCenterL).normalize();

  // Upper stage + Dragon
  poseAlong(s2, up1.pos, up1.nose);
  if (t >= M.dragonSep) {
    const drift = up1.nose.clone().multiplyScalar((t - M.dragonSep) * 0.35);
    poseAlong(dragonRoot, up1.pos.clone().add(drift), up1.nose);
  } else poseAlong(dragonRoot, up1.pos, up1.nose);
  dragonL.setNose(smooth(t, M.nose[0], M.nose[1]));

  // Booster: with the stack until separation, then its own return trajectory
  if (t < M.sep) {
    poseAlong(s1, up1.pos, up1.nose);
    bpose.pos.copy(up1.pos);
  } else {
    const b = TR.boosterState(t, boosterTables);
    TR.localPos(b.h, b.dr, b.cr, bpose.pos);
    const b2 = TR.boosterState(t + 0.5, boosterTables), b0 = TR.boosterState(t - 0.5, boosterTables);
    const vel = TR.localPos(b2.h, b2.dr, b2.cr, V()).sub(TR.localPos(b0.h, b0.dr, b0.cr, V()));
    const upR = radialUp(bpose.pos);
    let nose;
    if (t < 150) nose = up1.nose.clone().lerp(V(-1, 0.25, 0), smooth(t, M.sep, 150));
    else if (t < 205) nose = V(-1, 0.25, 0);
    else if (t < 262) nose = V(-1, 0.25, 0).lerp(upR, smooth(t, 205, 262));
    else nose = upR;
    if (t >= M.landing[1]) { bpose.pos.y = Math.max(0, bpose.pos.y); nose = V(0, 1, 0); }
    poseAlong(s1, bpose.pos, nose.normalize());
    s1.userData.speed = vel.length();
  }
  f9.setFins(smooth(t, M.sep + 2, M.sep + 8));
  f9.setLegs(smooth(t, M.landing[0] + 4, M.landing[0] + 12));

  // Plumes: sea-level plume is tight near the ground and balloons with altitude
  const hS1 = Math.max(0, s1.position.y) / 1000;
  const k1 = Math.max(eng.s1, eng.booster);
  const balloon = 1 + Math.min(12, hS1 / 6);
  f9.plumeS1.userData.set((eng.booster ? 18 : 30) * (1 + hS1 / 25), 1.6 * balloon, k1, now / 1000);
  f9.engineLight.intensity = k1 * (s1.position.y < 2000 ? 6e4 : 0);
  f9.plumeMVac.userData.set(60 + Math.min(200, up1.s.h), 6 + Math.min(40, up1.s.h / 4), eng.s2, now / 1000);
  groundMat.uniforms.glowPos.value.copy(s1.position);
  groundMat.uniforms.glow.value = k1 * (s1.position.y < 3000 ? 1 - s1.position.y / 3000 : 0);

  // Who is the camera looking at, and is it in sunlight?
  focus.launch.copy(t < M.sep ? up1.pos : up1.pos).addScaledVector(up1.nose, 35);
  focus.booster.copy(bpose.pos).addScaledVector(Y.clone().applyQuaternion(s1.quaternion), 25);
  focus.dragon.copy(dragonRoot.position).addScaledVector(up1.nose, 64);
  const tgt = viewTarget(state.view) || focus.launch;
  const lit = sunlit(tgt);
  sunL.position.copy(tgt).addScaledVector(sunLocal, 500);
  sunL.target.position.copy(tgt);
  sunL.intensity = 3.2 * lit;
  lblBooster.element.classList.toggle('hidden', t < M.sep);
  lblDragonL.element.classList.toggle('hidden', t < M.dragonSep - 30);

  // Far scene in the launch frame
  earth.group.position.set(0, -REm, 0);
  earth.group.quaternion.copy(earthQuatLaunch);
  earth.uniforms.sunDir.value.copy(sunLocal);
  sky.sun.position.copy(sunLocal).multiplyScalar(2e7);
  skyDome.visible = true;
  skyDome.position.copy(camera.position);
  skyDome.material.uniforms.sunDir.value.copy(sunLocal);
  const camAlt = camera.position.distanceTo(earthCenterL) - REm;
  skyDome.material.uniforms.fade.value = 1 - smooth(camAlt, 15e3, 90e3);
  groundMat.uniforms.fade.value = 1 - smooth(camAlt, 30e3, 90e3);
  trail.material.uniforms.time.value = t;
  trail.material.uniforms.scale.value = renderer.domElement.height / (2 * Math.tan((camera.fov * D2R) / 2));

  return {
    readouts: [
      ['Altitude', (up1.s.h).toFixed(1), 'km', up1.s.h / 210],
      ['Speed', (up1.s.v * 3.6).toFixed(0), 'km/h', up1.s.v / 7450],
      ['Downrange', up1.s.dr.toFixed(0), 'km'],
      ['Booster alt', t < M.sep ? '—' : (Math.max(0, s1.position.y) / 1000).toFixed(1), 'km'],
    ],
    stages: [
      ['Falcon 9 first stage', t < M.sep ? (eng.s1 ? 'burning' : t < 0 ? 'on pad' : 'coast') : t >= M.landing[1] ? 'landed' : eng.booster ? `${eng.phase} burn` : 'returning', k1 > 0, 'booster'],
      ['Second stage (MVac)', t < M.ses ? (t < M.sep ? 'attached' : 'coast') : eng.s2 ? 'burning' : 'shut down', eng.s2 > 0, 'chase'],
      ['Cargo Dragon', t < M.dragonSep ? 'on second stage' : t < M.nose[1] ? 'free flying' : 'nosecone open', false, 'dragon'],
    ],
  };
}

function updateOrbit(t) {
  const date = new Date(TR.LIFTOFF.getTime() + t * 1000);
  const g = gmst(date);
  earth.group.position.set(0, 0, 0);
  earth.group.quaternion.setFromEuler(new THREE.Euler(0, g, 0));
  const sunE = sunECI(date, V());
  const sunW = eciToWorld(sunE);
  earth.uniforms.sunDir.value.copy(sunW);
  sky.sun.position.copy(sunW).multiplyScalar(4e8);
  sky.stars.quaternion.identity();
  skyDome.visible = false;

  const hD = TR.dragonAlt(t);
  const rI = (TR.RE + TR.ISS_ALT) * 1000, rD = (TR.RE + hD) * 1000;
  eciToWorld(TR.eciDir(TR.issU(t), V()), issMarker.position).multiplyScalar(rI);
  eciToWorld(TR.eciDir(TR.dragonUDisplay(t), V()), dragonMarker.position).multiplyScalar(rD);
  focus.dragon.copy(dragonMarker.position);
  for (const [line, r] of [[issOrbitLine, rI], [dragonOrbitLine, rD]]) {
    const pa = line.geometry.attributes.position;
    for (let i = 0; i <= 256; i++) {
      eciToWorld(TR.eciDir((i / 256) * Math.PI * 2, V()), _p).multiplyScalar(r);
      pa.setXYZ(i, _p.x, _p.y, _p.z);
    }
    pa.needsUpdate = true;
  }
  const lead = TR.phaseLead(t);
  const range = issMarker.position.distanceTo(dragonMarker.position) / 1000;
  const next = TR.PHASING_BURNS.find((b) => b.t > t);
  return {
    readouts: [
      ['Dragon alt', hD.toFixed(0), 'km', hD / TR.ISS_ALT],
      ['ISS alt', TR.ISS_ALT.toFixed(0), 'km', 1],
      ['ISS ahead by', lead.toFixed(1), '°', lead / 360],
      ['Range', range > 100 ? range.toFixed(0) : range.toFixed(1), 'km'],
      ['Next burn', next ? fmtMET(next.t - t).replace('T+', '') : '—', ''],
      ['Orbits flown', ((TR.dragonUDisplay(t) - TR.dragonUDisplay(600)) / (2 * Math.PI)).toFixed(1), ''],
    ],
    stages: [
      ['Cargo Dragon', next ? `phasing · ${hD} km` : 'final approach', false, 'odragon'],
      ['International Space Station', `${TR.ISS_ALT} km · 51.64°`, false, 'globe'],
    ],
  };
}

const easeKey = (s) => 0.3 * s + 0.7 * s * s * (3 - 2 * s);
function dragonRelPos(t, out) {
  const k = RNDZ_KEYS;
  if (t <= k[0][0]) return out.set(...k[0][1]);
  if (t >= k[k.length - 1][0]) return out.set(...k[k.length - 1][1]);
  let i = 0;
  while (i < k.length - 2 && k[i + 1][0] <= t) i++;
  const s = easeKey((t - k[i][0]) / (k[i + 1][0] - k[i][0]));
  return out.set(...k[i][1]).lerp(_a.set(...k[i + 1][1]), s);
}
const dragonAlpha = { a: 0, b: 0 };
function updateDock(t, dtSim, dtReal) {
  const s = issOrbit.state(t);
  const sun = s.sun;
  const sunF = smooth(s.sunElevation, -0.35, 1.4);
  dSun.intensity = 3.2 * sunF;
  dSun.position.copy(dSun.target.position).addScaledVector(sun, 220);
  dEarth.intensity = 0.04 + 0.7 * smooth(sun.y, -0.2, 0.8);
  dockScene.environmentIntensity = 0.12 + 0.6 * sunF;
  earth.group.position.set(0, -issOrbit.a * 1000, 0);
  earth.group.quaternion.setFromRotationMatrix(s.earthRot);
  earth.uniforms.sunDir.value.copy(sun);
  sky.stars.quaternion.setFromRotationMatrix(s.L);
  sky.sun.position.copy(sun).multiplyScalar(4e7);
  skyDome.visible = false;
  // Arrays track the Sun
  const aT = Math.atan2(-sun.x, sun.y), bT = Math.asin(THREE.MathUtils.clamp(sun.z, -1, 1));
  iss.setArrays(aT, bT);

  // Dragon
  const g = dragonD.group;
  dragonRelPos(t, g.position);
  const toPort = V().subVectors(portV, g.position);
  const dist = toPort.length();
  const alignBy = TR.T_RNDZ + 58 * 60;
  const k = smooth(t, alignBy - 480, alignBy);
  const nose = (dist > 1e-3 ? toPort.normalize() : V(0, -1, 0)).lerp(V(0, -1, 0), k).normalize();
  _q.setFromUnitVectors(V(-1, 0, 0), nose);
  g.quaternion.slerp(_q, state.snap ? 1 : 1 - Math.exp(-dtReal * 3));
  focus.dragon.copy(g.position);
  const range = g.position.distanceTo(portV);
  if (state.prevRange != null && dtSim > 0) state.rate += ((state.prevRange - range) / dtSim - state.rate) * 0.2;
  if (state.snap) state.rate = 0;
  state.prevRange = range;
  const moving = Math.abs(state.rate) > 0.002 && state.playing;
  puffs.forEach((p) => { p.visible = moving && Math.random() < 0.3; p.scale.setScalar(0.6 + Math.random() * 0.7); });
  const docked = range < 0.05;
  const off = Math.hypot(g.position.x - portV.x, g.position.z - portV.z);
  return {
    readouts: [
      ['Range to IDA-3', docked ? '0.00' : range < 100 ? range.toFixed(2) : range.toFixed(0), 'm', 1 - Math.min(1, range / 1000)],
      ['Closing rate', docked ? '0.0' : (state.rate * 100).toFixed(1), 'cm/s', Math.abs(state.rate) / 0.5],
      ['Off-axis', off.toFixed(1), 'm'],
      ['To docking', t < TR.T_DOCK ? fmtMET(TR.T_DOCK - t).replace('T+', '') : 'docked', ''],
    ],
    stages: [
      ['Cargo Dragon', docked ? (t > TR.T_DOCK + 600 ? 'hard capture' : 'soft capture') : 'rendezvous', moving, 'ddragon'],
      ['ISS · Harmony zenith port', 'IDA-3 ready', false, 'centerline'],
      ['Sun', s.inShadow ? 'orbital night' : 'orbital day', false, 'approach'],
    ],
  };
}

// ── Main loop ────────────────────────────────────────────────────────────────
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = farCam.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); setPlaying(!state.playing); }
  if (e.key === 'ArrowRight') seek(state.t + (state.act === 'orbit' ? 3600 : 10));
  if (e.key === 'ArrowLeft') seek(state.t - (state.act === 'orbit' ? 3600 : 10));
  if (e.key === 'f' || e.key === 'F') $('#btn-full').click();
});

let lastHud = 0;
let firstFrame = true;
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const now = performance.now();
  const ci = chapterIndex(state.t);
  const chap = CHAPTERS[ci];
  const warp = state.speed === 'auto' ? chap.warp : state.speed;
  const dtSim = state.playing ? dt * warp : 0;
  if (state.playing) {
    state.t += dtSim;
    if (state.t >= T_MAX) { state.t = T_MAX; setPlaying(false); }
  }
  const t = state.t;

  // Act switch
  const act = actOf(t).id;
  if (act !== state.act) {
    state.act = act;
    renderViews(act);
    nearPass.scene = act === 'dock' ? dockScene : launchScene;
    nearPass.enabled = act !== 'orbit';
    overlay.visible = act === 'orbit';
    controls.enabled = true;
    state.view = null;
  }
  if (pendingView && VIEWS[act].some(([id]) => id === pendingView)) { setView(pendingView, true); pendingView = null; }
  // Auto camera follows the chapter's suggestion
  const wanted = state.autoCam ? chap.cam : state.view || VIEWS[act][0][0];
  const valid = VIEWS[act].some(([id]) => id === wanted) || wanted === 'globe';
  if (wanted !== state.view && valid) setView(wanted, state.snap);

  let tele;
  if (act === 'launch') tele = updateLaunch(t, now);
  else if (act === 'orbit') tele = updateOrbit(t);
  else tele = updateDock(t, dtSim, dt);

  updateCamera(dt);
  farCam.position.copy(camera.position);
  farCam.quaternion.copy(camera.quaternion);
  farCam.fov = camera.fov;
  farCam.near = act === 'orbit' ? 1e4 : 1e3;
  farCam.updateProjectionMatrix();
  if (act !== 'launch') skyDome.position.copy(camera.position);

  composer.render();
  labelRenderer.render(act === 'orbit' ? far : act === 'dock' ? dockScene : launchScene, act === 'orbit' ? farCam : camera);

  // HUD
  if (!scrubbing) scrub.value = Math.round(tToF(t) * 10000);
  $('#fill').style.width = `${tToF(t) * 100}%`;
  if (ci !== state.chapter) {
    chapterEls.forEach((el, i) => { el.classList.toggle('current', i === ci); el.classList.toggle('done', i < ci); });
    const el = chapterEls[ci];
    const list = $('#chapters');
    if (el) list.scrollTop = Math.max(0, el.offsetTop - list.offsetTop - 60);
    if (state.chapter !== -1 && !state.snap) toast(chap.title, chap.detail);
    $('#now-title').textContent = chap.title;
    $('#now-detail').textContent = chap.detail;
    state.chapter = ci;
  }
  if (now - lastHud > 120) {
    lastHud = now;
    const date = new Date(TR.LIFTOFF.getTime() + t * 1000);
    $('#met').textContent = fmtMET(t);
    $('#utc').textContent = date.toISOString().slice(5, 19).replace('T', ' ');
    $('#edt').textContent = new Date(date.getTime() - 4 * 3600e3).toISOString().slice(11, 16);
    $('#act').textContent = actOf(t).title;
    document.querySelectorAll('#acts button').forEach((b) => b.classList.toggle('active', b.dataset.act === act));
    $('#tele-title').textContent = act === 'launch' ? 'Ascent' : act === 'orbit' ? 'Phasing' : 'Approach';
    $('#readouts').innerHTML = tele.readouts.map(([k, v, u, f], i) => `<div class="readout${tele.readouts.length % 2 && i === tele.readouts.length - 1 ? ' wide' : ''}"><div class="k">${k}</div><div class="v">${v}<span class="u">${u}</span></div>${f != null ? `<div class="bar"><i style="width:${Math.max(0, Math.min(1, f)) * 100}%"></i></div>` : ''}</div>`).join('');
    $('#stages').innerHTML = tele.stages.map(([n, st, burn, view]) => `<div class="stage${burn ? ' burn' : ''}" data-view="${view}"><span class="dot"></span>${n}<span class="st">${st}</span></div>`).join('');
  }
  state.snap = false;
  if (firstFrame) { firstFrame = false; setTimeout(() => $('#loader').classList.add('done'), 300); }
  requestAnimationFrame(frame);
}
$('#stages').addEventListener('click', (e) => {
  const s = e.target.closest('.stage');
  if (s && VIEWS[state.act].some(([id]) => id === s.dataset.view)) { state.autoCam = false; setView(s.dataset.view); }
});
let pendingView = params.get('view');
if (pendingView) state.autoCam = false;
if (params.has('speed')) state.speed = params.get('speed') === 'auto' ? 'auto' : +params.get('speed');
window.__crs = { state, seek, setView, camera, controls }; // debugging hook
requestAnimationFrame(frame);
