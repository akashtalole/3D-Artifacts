import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STOPS, SITE, CITIES, KM, FACTORY_SPECS, RACK_SPECS, GPU_SPECS, SUPERCHIP_SPECS, SEASONS } from './data/specs.js';
import { sunPosition, sunVector, ist, plant } from './sim/env.js';
import { buildCampus, HUB, HALL_X, HALL_Z } from './model/campus.js';
import { updateFlows, flows, labels, label, canvasTex } from './model/kit.js';
import { HALL } from './model/hall.js';

const $ = (s) => document.querySelector(s);
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ── Renderer, scene, camera ────────────────────────────────────────────────
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const labelRenderer = new CSS2DRenderer({ element: $('#labels') });
labelRenderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#c9b9a4', 0.00022);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.02, 60000);
camera.position.set(600, 500, 900);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 0.3;
controls.maxDistance = 9000;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Sky, sun, lights
const sky = new Sky();
sky.scale.setScalar(50000);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU.mieDirectionalG.value = 0.85;
const sun = new THREE.DirectionalLight('#fff4e0', 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cfe3ff', '#6b5440', 0.5);
scene.add(hemi);

// Stars
{
  const N = 3000, p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 0.95 + 0.05, th = Math.random() * Math.PI * 2, r = 40000, s = Math.sqrt(1 - u * u);
    p.set([Math.cos(th) * s * r, u * r, Math.sin(th) * s * r], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  var stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);
}

// ── Campus ─────────────────────────────────────────────────────────────────
const campus = buildCampus(scene);
const hallA = campus.hallA;
const rack = hallA.rack;
// interior lights for the cut-away hall
for (const z of [-7, 0, 7]) for (const x of [-4, 4]) {
  const l = new THREE.PointLight('#f2f6ff', 18, 18, 1.6);
  l.position.set(HALL_X[0] + x, 4.3, HALL_Z + z);
  scene.add(l);
}
scene.updateMatrixWorld(true);
const rackPos = rack.group.getWorldPosition(new THREE.Vector3());   // floor centre, front faces +z
const trayLocal = rack.tray.group.position;
const trayBaseZ = rack.tray.baseZ;

// ── Token map: Indian cities at 3 m per km ─────────────────────────────────
const tokens = new THREE.Group(); scene.add(tokens);
const cityData = CITIES.map(([name, lat, lon]) => {
  const dx = (lon - SITE.lon) * 111.32 * Math.cos(SITE.lat * Math.PI / 180);
  const dz = -(lat - SITE.lat) * 110.57;
  const km = Math.hypot(dx, dz);
  const pos = new THREE.Vector3(dx * KM, 0, dz * KM);
  return { name, km, pos };
});
const pillarMat = new THREE.MeshBasicMaterial({ color: '#5ce1e6', transparent: true, opacity: 0.85, toneMapped: false });
const arcs = [];
for (const c of cityData) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 140, 10).translate(0, 70, 0), pillarMat);
  p.position.copy(c.pos); tokens.add(p);
  const ring = new THREE.Mesh(new THREE.RingGeometry(18, 26, 32).rotateX(-Math.PI / 2), pillarMat);
  ring.position.copy(c.pos).setY(2); tokens.add(ring);
  label(`<b>${c.name}</b><span>${Math.round(c.km / 10) * 10} km · ${(c.km * 1.4 / 200).toFixed(1)} ms</span>`, tokens, c.pos.clone().setY(160), 'tokens', 'city');
  const mid = HUB.clone().lerp(c.pos, 0.5); mid.y = 120 + c.pos.length() * 0.16;
  const curve = new THREE.QuadraticBezierCurve3(HUB.clone(), mid, c.pos.clone().setY(140));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)), new THREE.LineBasicMaterial({ color: '#5ce1e6', transparent: true, opacity: 0.25, fog: false }));
  tokens.add(line);
  arcs.push({ curve, len: curve.getLength() });
}
function particleSet(n, color, size) {
  const pos = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  pts.frustumCulled = false; tokens.add(pts);
  return { pts, pos, st: Array.from({ length: n }, (_, i) => ({ a: arcs[i % arcs.length], t: Math.random() })) };
}
const outTok = particleSet(900, '#7ff6ff', 3.2);
const inReq = particleSet(360, '#ffb35c', 2.6);
const tv = new THREE.Vector3();
function updateTokens(dt, util) {
  for (const [set, dir, k] of [[outTok, 1, 1], [inReq, -1, 0.7]]) {
    set.st.forEach((s, i) => {
      s.t += (dt * (400 + 1400 * util) * k) / s.a.len;
      if (s.t > 1) s.t -= 1;
      s.a.curve.getPoint(dir > 0 ? s.t : 1 - s.t, tv);
      set.pos[i * 3] = tv.x; set.pos[i * 3 + 1] = tv.y; set.pos[i * 3 + 2] = tv.z;
    });
    set.pts.geometry.attributes.position.needsUpdate = true;
  }
}

// ── Weather: monsoon clouds and rain ───────────────────────────────────────
const cloudTex = canvasTex(128, 128, (g, w, h) => {
  for (let i = 0; i < 40; i++) {
    const x = 20 + Math.random() * 88, y = 30 + Math.random() * 60, r = 14 + Math.random() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }
});
const clouds = new THREE.Group(); scene.add(clouds);
for (let i = 0; i < 70; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: '#9aa3ad', transparent: true, opacity: 0, depthWrite: false, fog: false }));
  const a = Math.random() * Math.PI * 2, r = 300 + Math.random() * 7000;
  s.position.set(Math.cos(a) * r, 900 + Math.random() * 900, Math.sin(a) * r);
  s.scale.setScalar(1400 + Math.random() * 1600);
  clouds.add(s);
}
const RAIN = 2500;
const rainPos = new Float32Array(RAIN * 6);
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0.35, fog: false }));
rain.frustumCulled = false; rain.visible = false; scene.add(rain);
const rainSeed = Array.from({ length: RAIN }, () => [Math.random(), Math.random(), Math.random()]);
function updateRain(t) {
  const c = controls.target, R = Math.min(200, Math.max(4, camera.position.distanceTo(c) * 0.8));
  for (let i = 0; i < RAIN; i++) {
    const [a, b, k] = rainSeed[i];
    const x = c.x + (a - 0.5) * 2 * R, z = c.z + (b - 0.5) * 2 * R;
    const y = c.y + R - (((k * R * 2) + t * 25) % (R * 2));
    const len = R * 0.025;
    rainPos.set([x, y, z, x + len * 0.1, y - len, z], i * 6);
  }
  rainGeo.attributes.position.needsUpdate = true;
}

// ── State ──────────────────────────────────────────────────────────────────
const SPEEDS = [[1, '1×'], [60, '1 min/s'], [600, '10 min/s'], [3600, '1 h/s']];
const state = { ms: Date.now(), live: true, speed: 1, playing: true, mode: 'inference', season: 'today', stop: 0, flows: true, labels: true, cutaway: true, tour: false, tourT: 0, explode: 0 };

function istParts() { return ist(state.ms); }
function setIstHour(hour) {
  const p = istParts();
  state.ms = Date.UTC(p.y, p.m, p.day, 0, 0, 0) - SITE.tz * 3600000 + hour * 3600000;
}
function setSeason(id) {
  state.season = id;
  const h = istParts().hour;
  if (SEASONS[id].date) {
    const [y, m, d] = SEASONS[id].date.split('-').map(Number);
    state.ms = Date.UTC(y, m - 1, d) - SITE.tz * 3600000 + h * 3600000;
    state.live = false;
  } else { state.ms = Date.now(); state.live = true; state.speed = 1; }
  document.querySelectorAll('#season button').forEach((b) => b.classList.toggle('active', b.dataset.s === id));
  syncSpeed();
}

// ── Views ──────────────────────────────────────────────────────────────────
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const trayTop = () => rackPos.y + trayLocal.y + 0.03;
const VIEWS = {
  campus: () => ({ pos: V(290, 150, 390), tgt: V(0, 0, -40) }),
  power: () => ({ pos: V(-40, 95, 30), tgt: V(-170, 4, -105) }),
  cooling: () => ({ pos: V(75, 48, 115), tgt: V(-5, 3, 22) }),
  hall: () => ({ pos: V(HALL_X[0] + 17, 27, HALL_Z + 31), tgt: V(HALL_X[0] - 1, 0, HALL_Z - 1) }),
  rack: () => ({ pos: V(rackPos.x + 1.55, 1.5, rackPos.z + 4.1), tgt: V(rackPos.x, 1.15, rackPos.z + 0.4) }),
  tray: () => ({ pos: V(rackPos.x + 0.42, trayTop() + 0.62, rackPos.z + trayBaseZ + 1.62), tgt: V(rackPos.x, trayTop(), rackPos.z + trayBaseZ + 0.74) }),
  spine: () => ({ pos: V(rackPos.x + 0.75, 1.55, rackPos.z - 3.35), tgt: V(rackPos.x, 1.2, rackPos.z - 0.55) }),
  tokens: () => ({ pos: V(2600, 3300, 3700), tgt: V(300, 0, -900) }),
};

let fly = null;
function goStop(i, instant = false) {
  state.stop = (i + STOPS.length) % STOPS.length;
  const s = STOPS[state.stop];
  const v = VIEWS[s.id]();
  if (instant) { camera.position.copy(v.pos); controls.target.copy(v.tgt); fly = null; scene.fog.density = s.id === 'tokens' ? 0.00003 : 0.0001; }
  else {
    const from = { pos: camera.position.clone(), tgt: controls.target.clone() };
    const d = from.pos.distanceTo(v.pos) + from.tgt.distanceTo(v.tgt);
    fly = { from, to: v, t0: performance.now(), dur: 1400 + Math.min(2600, Math.log10(1 + d) * 700) };
  }
  showPanel();
  document.querySelectorAll('#stops button').forEach((b, k) => b.classList.toggle('active', k === state.stop));
  updateHash();
}
function updateFly(now) {
  if (!fly) return;
  const k = Math.min(1, (now - fly.t0) / fly.dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const tgt = fly.from.tgt.clone().lerp(fly.to.tgt, e);
  const o0 = fly.from.pos.clone().sub(fly.from.tgt), o1 = fly.to.pos.clone().sub(fly.to.tgt);
  const d = Math.exp(Math.log(o0.length()) * (1 - e) + Math.log(o1.length()) * e);
  const dir = o0.normalize().lerp(o1.normalize(), e).normalize();
  const lift = Math.sin(Math.PI * e) * Math.min(400, fly.from.tgt.distanceTo(fly.to.tgt) * 0.25);
  controls.target.copy(tgt);
  camera.position.copy(tgt).addScaledVector(dir, d).add(new THREE.Vector3(0, lift, 0));
  if (k >= 1) fly = null;
}

// ── UI ─────────────────────────────────────────────────────────────────────
$('#stops').innerHTML = STOPS.map((s, i) => `<button data-i="${i}"><i>${i + 1}</i>${s.title}</button>`).join('');
$('#stops').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { stopTour(); goStop(+b.dataset.i); } });
$('#speed').innerHTML = SPEEDS.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('');
$('#speed').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.speed = +b.dataset.v; if (state.speed !== 1) state.live = false; state.playing = true; syncSpeed(); });
function syncSpeed() {
  document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('active', +b.dataset.v === state.speed));
  $('#play-ico').setAttribute('d', state.playing ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z');
}
$('#season').innerHTML = Object.entries(SEASONS).map(([k, s]) => `<button data-s="${k}">${s.label}</button>`).join('');
$('#season').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { setSeason(b.dataset.s); updateHash(); } });
$('#mode').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.mode = b.dataset.m;
  document.querySelectorAll('#mode button').forEach((x) => x.classList.toggle('active', x === b));
  updateHash();
});
$('#play').addEventListener('click', () => { state.playing = !state.playing; if (!state.playing) state.live = false; syncSpeed(); });
$('#hour').addEventListener('input', (e) => { state.live = false; setIstHour(+e.target.value); });
document.querySelectorAll('.toggles button').forEach((b) => b.addEventListener('click', () => {
  state[b.dataset.t] = !state[b.dataset.t];
  b.classList.toggle('active', state[b.dataset.t]);
}));
$('#brand').addEventListener('click', () => { stopTour(); goStop(0); });
$('#prev').addEventListener('click', () => { stopTour(); goStop(state.stop - 1); });
$('#next').addEventListener('click', () => { stopTour(); goStop(state.stop + 1); });
$('#tour').addEventListener('click', () => (state.tour ? stopTour() : startTour()));
function startTour() { state.tour = true; state.tourT = 0; $('#tour').classList.add('on'); goStop(state.stop === STOPS.length - 1 ? 0 : state.stop + 1); }
function stopTour() { state.tour = false; $('#tour').classList.remove('on'); }
controls.addEventListener('start', () => { if (fly) fly = null; });
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') { stopTour(); goStop(state.stop + 1); }
  if (e.key === 'ArrowLeft') { stopTour(); goStop(state.stop - 1); }
  if (e.key === ' ') { e.preventDefault(); $('#play').click(); }
  if (e.key === 't' || e.key === 'T') $('#tour').click();
});

const flowLpm = Math.round(plant({ mode: 'training', hour: 12, month: 0, sunEl: 0, solarMWp: 0 }).flowLpm);
const SPECS = {
  factory: FACTORY_SPECS, rack: RACK_SPECS, gpu: GPU_SPECS, tray: SUPERCHIP_SPECS,
  power: [['Grid', `${SITE.gridKV} kV · ${SITE.hz} Hz`], ['Substation', `${SITE.gridKV} → ${SITE.mvKV} kV`], ['Hall feeders', '33 kV · ≈ 22 MW each'], ['On-site solar', `${campus.solarMWp.toFixed(1)} MWp`], ['Back-up', '24 diesel gensets'], ['Envelope', '100 MW']],
  cooling: [['Rack inlet', `${SITE.coolantSetpoint} °C set · ${SITE.coolantMax} °C max`], ['ΔT at full load', `≈ ${SITE.designDeltaT} K`], ['Flow per rack', `≈ ${flowLpm} L/min (assumed)`], ['Heat rejection', '64 dry coolers'], ['Chillers', 'none'], ['Hot-day assist', 'adiabatic spray']],
  hall: [['Racks', '139 × NVL72'], ['GPUs', '10,008 Rubin'], ['IT load', '≈ 22 MW'], ['Per rack', '≈ 158 kW (assumed)'], ['Rows', '8 · 4 back-to-back pairs'], ['CDUs', '16 in-row']],
};
function showPanel() {
  const s = STOPS[state.stop];
  $('#p-kicker').textContent = s.kicker;
  $('#p-title').textContent = s.title;
  $('#p-text').textContent = s.text;
  $('#p-india').textContent = s.india;
  $('#p-specs').innerHTML = (SPECS[s.specs] || []).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('#p-count').textContent = `${state.stop + 1} / ${STOPS.length}`;
}
function updateHash() {
  const q = new URLSearchParams();
  if (state.season !== 'today') q.set('season', state.season);
  if (state.mode !== 'inference') q.set('mode', state.mode);
  if (!state.live) q.set('hour', istParts().hour.toFixed(2));
  history.replaceState(null, '', `#/${STOPS[state.stop].id}${q.toString() ? '?' + q : ''}`);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function readouts(p, parts, el) {
  const hh = Math.floor(parts.hour), mm = Math.floor((parts.hour - hh) * 60);
  $('#r-time').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} IST`;
  $('#r-sub').textContent = `${parts.day} ${MONTHS[parts.m]} ${parts.y} · Hyderabad${state.live ? ' · live' : ''}`;
  const sky = p.rain ? 'Monsoon rain' : el < -0.05 ? (p.cloud > 0.5 ? 'Cloudy night' : 'Clear night') : p.cloud > 0.6 ? 'Overcast' : p.cloud > 0.3 ? 'Partly cloudy' : 'Sunny';
  $('#r-wx').innerHTML = `<b>${p.amb.toFixed(1)} °C</b>${sky}`;
  const solarShare = Math.max(0, p.solar / p.facility);
  $('#mix-solar').style.width = `${(solarShare * 100).toFixed(1)}%`;
  $('#mix-a').textContent = `Solar ${p.solar.toFixed(1)} MW`;
  $('#mix-b').textContent = `Grid ${p.grid.toFixed(1)} MW`;
  const rows = [
    ['Workload', `${state.mode === 'training' ? 'Training' : 'Inference'} ${(p.util * 100).toFixed(0)} %`, 'wide'],
    ['IT load', `${p.it.toFixed(1)} MW`], ['Facility', `${p.facility.toFixed(1)} MW`],
    ['PUE', p.pue.toFixed(3)], ['Per rack', `${p.rackKW.toFixed(0)} kW`],
    ['Coolant in → out', `${p.supply.toFixed(0)} → ${p.ret.toFixed(1)} °C`, 'wide'],
    ['Cooling', p.assist ? 'Dry + adiabatic' : 'Dry coolers only', `wide${p.assist ? ' hot' : ''}`],
    ['Water', p.waterM3h > 0.05 ? `${p.waterM3h.toFixed(1)} m³/h` : '0 m³/h'],
    ['NVFP4 in use', `${p.zflops.toFixed(2)} ZFLOPS`],
  ];
  $('#r-grid').innerHTML = rows.map(([k, v, c]) => `<div class="${c || ''}"><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  if (document.activeElement !== $('#hour')) $('#hour').value = parts.hour;
}

// ── Resize ─────────────────────────────────────────────────────────────────
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
});

// ── Frame loop ─────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
const sunDir = new THREE.Vector3();
const fogDay = new THREE.Color('#c9b9a4'), fogNight = new THREE.Color('#0b0f18'), fogRain = new THREE.Color('#7d858d'), fogCol = new THREE.Color();
let lastUi = 0, elapsed = 0, curP = null;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  elapsed += dt;
  const now = performance.now();
  if (state.live) state.ms = Date.now();
  else if (state.playing) state.ms += dt * 1000 * state.speed;
  const parts = istParts();

  // Sun & sky
  const sp = sunPosition(state.ms);
  sunVector(sp, sunDir);
  const p = plant({ mode: state.mode, hour: parts.hour, month: parts.m, sunEl: sp.el, solarMWp: campus.solarMWp });
  curP = p;
  const day = ss(-0.12, 0.12, Math.sin(sp.el));
  const cloudK = p.cloud;
  skyU.sunPosition.value.copy(sunDir);
  skyU.turbidity.value = 4 + cloudK * 10;
  skyU.rayleigh.value = 1.2 + cloudK * 1.5 - (1 - day) * 0.6;
  skyU.mieCoefficient.value = 0.004 + cloudK * 0.01;
  sun.intensity = 3.3 * Math.pow(Math.max(0, Math.sin(sp.el)), 0.45) * (1 - 0.65 * cloudK);
  sun.color.setHSL(0.09, 0.6, 0.55 + 0.4 * ss(0, 0.5, Math.sin(sp.el)));
  hemi.intensity = 0.08 + 0.35 * day * (1 - 0.3 * cloudK);
  const inside = Math.abs(camera.position.x - HALL_X[0]) < HALL.w / 2 && Math.abs(camera.position.z - HALL_Z) < HALL.d / 2 && camera.position.y < HALL.h + 3;
  scene.environmentIntensity = inside ? 0.7 : 0.08 + 0.45 * day;
  stars.material.opacity = (1 - day) * (1 - cloudK) * 0.9;
  renderer.toneMappingExposure = 0.48 + (1 - day) * 0.2;
  for (const m of campus.night) m.emissiveIntensity = m.userData.night * (1 - day);

  // Fog / visibility
  const tokenView = STOPS[state.stop].id === 'tokens';
  fogCol.copy(fogDay).lerp(fogRain, cloudK * 0.7).lerp(fogNight, 1 - day);
  scene.fog.color.copy(fogCol);
  const targetFog = tokenView ? 0.00003 : 0.0001 * (1 + cloudK * 2);
  scene.fog.density += (targetFog - scene.fog.density) * Math.min(1, dt * 3);
  for (const c of clouds.children) c.material.opacity = Math.max(0, cloudK - 0.25) * 0.9 * (0.3 + 0.7 * day);
  rain.visible = p.rain;
  if (p.rain) updateRain(elapsed);

  // Shadows follow the view
  const span = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * 0.9, 2, 480);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.near = 0.5; sc.far = span * 6; sc.updateProjectionMatrix();
  sun.shadow.normalBias = span * 0.0008;
  sun.target.position.copy(controls.target);
  sun.position.copy(controls.target).addScaledVector(sunDir, span * 3);
  sun.castShadow = sp.el > 0.02;

  // Animation: flows, fans, tray, spine, flag, tokens, mist
  const u = p.util;
  updateFlows(dt, {
    power: 0.8 + 1.6 * (p.facility / 100), solar: 2.2 * (p.solar / Math.max(0.1, campus.solarMWp)),
    supply: 0.6 + 1.2 * u, return: 0.6 + 1.2 * u, coolant: 0.8 + 1.6 * u, data: 2,
  });
  for (const f of flows) f.mesh.visible = state.flows;
  campus.updateFans(dt, 0.4 + 0.6 * ss(15, 40, p.amb));
  campus.mist.material.opacity = p.assist ? 0.35 : 0;
  campus.updateFlag(elapsed);
  rack.updatePulses(dt, 0.15 + 0.6 * u);
  const stopId = STOPS[state.stop].id;
  const tgtExplode = stopId === 'tray' && !fly ? 1 : 0;
  state.explode += Math.sign(tgtExplode - state.explode) * Math.min(Math.abs(tgtExplode - state.explode), dt * 0.45 * (tgtExplode ? 1 : 2.5));
  rack.tray.setExplode(state.explode);
  rack.tray.group.position.z = trayBaseZ + (rack.tray.group.userData.slide || 0);
  hallA.rows[6].visible = !(stopId === 'spine');
  hallA.roof.visible = !state.cutaway;
  tokens.visible = stopId === 'tokens';
  if (tokens.visible) updateTokens(dt, u);

  // Labels: only the current stop's, once the camera has arrived
  $('#labels').classList.toggle('off', !state.labels);
  for (const l of labels) l.obj.visible = !fly && l.tags.includes(stopId) && (stopId !== 'tray' || state.explode > 0.95);

  // Tour
  if (state.tour && !fly) {
    state.tourT += dt;
    if (state.tourT > (stopId === 'tray' ? 15 : 11)) { state.tourT = 0; goStop(state.stop + 1); }
  }

  updateFly(now);
  controls.update();
  composer.render();
  labelRenderer.render(scene, camera);
  if (now - lastUi > 250) { lastUi = now; readouts(p, parts, Math.sin(sp.el)); }
  requestAnimationFrame(frame);
}

// ── Start ──────────────────────────────────────────────────────────────────
const [, hStop, hQuery] = location.hash.match(/^#\/([a-z]+)?\??(.*)$/) || [];
const q = new URLSearchParams(hQuery || '');
if (q.get('mode') === 'training') { state.mode = 'training'; document.querySelectorAll('#mode button').forEach((b) => b.classList.toggle('active', b.dataset.m === 'training')); }
setSeason(SEASONS[q.get('season')] ? q.get('season') : 'today');
if (q.has('hour')) { state.live = false; setIstHour(+q.get('hour')); }
syncSpeed();
const startIdx = Math.max(0, STOPS.findIndex((s) => s.id === hStop));
goStop(startIdx, true);
if (startIdx === STOPS.findIndex((s) => s.id === 'tray')) state.explode = 1;
window.__factory = { state, camera, controls, goStop, campus, rack, get plant() { return curP; } };
requestAnimationFrame(frame);
setTimeout(() => $('#loader').classList.add('done'), 600);
