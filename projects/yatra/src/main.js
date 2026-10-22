import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { ROUTES, buildRoute, at, offset, limitAt, ground } from './route.js';
import { World, CHUNK } from './world.js';
import { TRAINS, BUSES, buildTrain, placeTrain, buildBus, placeBus, buildTraffic, setNight, RAIL_TOP } from './vehicles.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastT; function toast(m, ms = 2600) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
const q = new URLSearchParams(location.hash.slice(1));

// ── renderer, sky, lights ──
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.55;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#c9d6df', 0.0011);
const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 6000);
const controls = new OrbitControls(camera, canvas); controls.enabled = false; controls.enableDamping = true;
const sky = new Sky(); sky.scale.setScalar(5000); scene.add(sky);
Object.assign(sky.material.uniforms.turbidity, { value: 6 }); sky.material.uniforms.rayleigh.value = 1.6; sky.material.uniforms.mieCoefficient.value = 0.006; sky.material.uniforms.mieDirectionalG.value = 0.8;
const hemi = new THREE.HemisphereLight('#dfeaff', '#4a5a3a', 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4e0', 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 600 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const fill = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: '#4f7a33', roughness: 1 })); fill.rotation.x = -Math.PI / 2; scene.add(fill);

// rain
const RAIN_N = 6000, rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(RAIN_N * 6);
for (let i = 0; i < RAIN_N; i++) { const x = (Math.random() - 0.5) * 160, y = Math.random() * 80, z = (Math.random() - 0.5) * 160; rainPos.set([x, y, z, x + 0.15, y - 1.2, z], i * 6); }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#c8d4dc', transparent: true, opacity: 0.45 })); rain.frustumCulled = false; scene.add(rain);

// ── state ──
const S = {
  mode: q.get('mode') === 'road' ? 'road' : 'rail', type: q.get('v') || null, cam: q.get('cam') || 'chase',
  hour: q.has('hour') ? +q.get('hour') : 7.5, weather: q.get('w') || 'monsoon', warp: +(q.get('warp') || 1), playing: true,
  s: 0, v: 0, phase: 'dwell', until: 0, stopIdx: 0, t: 0, dist: 0, startClock: 0, sound: false, autoLoop: true,
};
let R = null, world = null, V = null, opp = [], traffic = [];

function seasonOf(w) { return w === 'monsoon' ? 'monsoon' : w === 'winter' ? 'winter' : 'summer'; }
function setup() {
  if (world) world.dispose();
  for (const o of [V?.group, ...opp.map((x) => x.T.group), ...traffic.map((x) => x.g)]) if (o) scene.remove(o);
  opp = []; traffic = [];
  R = buildRoute(ROUTES[S.mode]);
  const types = S.mode === 'rail' ? TRAINS : BUSES;
  if (!types[S.type]) S.type = S.mode === 'rail' ? 'vb' : 'lalpari';
  world = new World(scene, R, { season: seasonOf(S.weather), makeBus: (t) => buildBus(t, t === 'lalpari' ? 'सातारा · SATARA' : 'पुणे · PUNE') });
  V = S.mode === 'rail' ? buildTrain(S.type) : buildBus(S.type, 'पुणे · PUNE');
  scene.add(V.group);
  const first = R.def.stops[0];
  S.s = stopPos(first); S.v = 0; S.phase = 'dwell'; S.until = S.t + 6; S.stopIdx = 1; S.dist = 0; S.startClock = S.hour;
  S.trackside = null;
  for (let i = 0; i < 4; i++) world.update(S.s, 1200, 400);
  renderVehicleList(); drawProfile(); updateHash();
  toast(`${S.mode === 'rail' ? TRAINS[S.type].name : `MSRTC ${BUSES[S.type].name}`} — ${R.def.name}`, 3500);
}
const vdef = () => (S.mode === 'rail' ? TRAINS[S.type] : BUSES[S.type]);
const laneD = (s) => {
  if (S.mode === 'rail') return -2.65;   // Indian Railways run on the left line
  const st = R.def.stops.find((p) => Math.abs(p.s - s) < 160);
  if (!st) return -1.9;   // keep left
  const k = 1 - Math.min(1, Math.max(0, (Math.abs(st.s - s) - 40) / 120));
  return -1.9 - k * 9.5;
};
/** Where the front of the vehicle stops for a halt. */
function stopPos(st) { return S.mode === 'rail' ? st.s + Math.min(195, V ? V.length / 2 : 100) : st.s + 6; }

// ── driving ──
function step(dt) {
  S.t += dt; S.hour = (S.hour + dt / 3600) % 24;
  const D = vdef(), stops = R.def.stops;
  if (S.phase === 'dwell') {
    S.v = 0;
    if (S.t >= S.until) { if (S.stopIdx >= stops.length) { S.phase = 'end'; S.until = S.t + 12; arrived(); } else { S.phase = 'run'; horn(0.8); } }
  } else if (S.phase === 'end') {
    if (S.autoLoop && S.t >= S.until) setup();
    return;
  } else {
    const next = stops[S.stopIdx];
    const skip = next && (D.noStops || D.skip?.includes(next.name)) && S.stopIdx < stops.length - 1;
    let vt = limitAt(R, S.s + 20, D.vmax) / 3.6;
    for (const ahead of [80, 160, 320, 640, 1100]) { const vl = limitAt(R, S.s + ahead, D.vmax) / 3.6; vt = Math.min(vt, Math.sqrt(vl * vl + 2 * D.dec * 0.8 * ahead)); }
    if (next && !skip) { const dist = stopPos(next) - S.s; vt = Math.min(vt, Math.sqrt(Math.max(0, 2 * D.dec * 0.85 * (dist - 1)))); if (dist < 2 && S.v < 0.6) { S.phase = 'dwell'; S.until = S.t + (S.stopIdx === stops.length - 1 ? 4 : D.dwell); S.stopIdx++; S.v = 0; toast(`${next.mr} · ${next.name}`, 2200); } }
    else if (next && skip && S.s > next.s) S.stopIdx++;
    // grade resistance on the ghat climb for heavy trains
    const grade = at(R, S.s).grade, acc = Math.max(0.05, D.acc - (S.mode === 'rail' ? grade * 9.81 * 0.5 : grade * 9.81 * 0.3));
    if (S.v < vt) S.v = Math.min(vt, S.v + acc * dt); else S.v = Math.max(vt, S.v - D.dec * 1.3 * dt);
    S.s = Math.min(R.length - 5, S.s + S.v * dt); S.dist += S.v * dt;
    if (S.s >= R.length - 6) { S.phase = 'end'; S.until = S.t + 12; arrived(); }
  }
}
function arrived() { const last = R.def.stops.at(-1); toast(`Arrived at ${last.name} — ${(S.dist / 1000).toFixed(1)} km`, 4000); }

// ── oncoming trains and road traffic ──
let oppCooldown = 20;
function updateOthers(dt) {
  if (S.mode === 'rail') {
    oppCooldown -= dt;
    if (!opp.length && oppCooldown <= 0 && S.s < R.length - 4000) {
      const kinds = Object.keys(TRAINS).filter((k) => k !== S.type), kind = kinds[Math.floor(Math.random() * kinds.length)];
      const T = buildTrain(kind); scene.add(T.group);
      opp.push({ T, s: Math.min(R.length - 10, S.s + 2600 + Math.random() * 800), v: 0, kind });
    }
    for (const o of opp) {
      const vt = Math.min(TRAINS[o.kind].vmax, limitAt(R, o.s, TRAINS[o.kind].vmax)) / 3.6;
      o.v += Math.sign(vt - o.v) * Math.min(Math.abs(vt - o.v), 0.5 * dt);
      o.s -= o.v * dt;
      placeTrain(R, o.T, o.s, 2.65, -1);
    }
    for (const o of [...opp]) if (o.s + o.T.length < S.s - 1200 || o.s < 0) { scene.remove(o.T.group); opp.splice(opp.indexOf(o), 1); oppCooldown = 40 + Math.random() * 60; }
  } else {
    while (traffic.length < 10) {
      const kind = ['truck', 'car', 'car', 'auto', 'truck', 'car'][Math.floor(Math.random() * 6)];
      const g = buildTraffic(kind); scene.add(g);
      const last = traffic.reduce((m, x) => Math.max(m, x.s), S.s + 300);
      traffic.push({ g, s: Math.min(R.length - 20, last + 120 + Math.random() * 380), v: (kind === 'truck' ? 38 : kind === 'auto' ? 32 : 55) / 3.6, kind });
    }
    for (const t of traffic) {
      const lim = limitAt(R, t.s, 90) / 3.6; t.cur = Math.min(t.v, lim);
      t.s -= t.cur * dt;
      const a = offset(R, t.s - 2, 1.9, 0), b = offset(R, t.s + 2, 1.9, 0);
      t.g.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); t.g.rotation.y = -Math.atan2(a.z - b.z, a.x - b.x);
    }
    for (const t of [...traffic]) if (t.s < S.s - 300 || t.s < 5) { scene.remove(t.g); traffic.splice(traffic.indexOf(t), 1); }
  }
}

// ── world dynamics: signals, crossing gates, waterfalls ──
function updateDynamics(dt) {
  const tail = S.s - (S.mode === 'rail' ? V.length : 12);
  for (const sg of world.dynamic.signals) {
    let asp = 2;   // 0 red, 1 yellow, 2 green
    if (S.s > sg.s) { const behind = tail - sg.s; asp = behind < 1400 ? 0 : behind < 2800 ? 1 : 2; }
    const next = R.def.stops[S.stopIdx];
    if (S.s < sg.s && next && next.s - sg.s < 600 && next.s - sg.s > 0 && !vdef().noStops && !vdef().skip?.includes(next.name)) asp = 1;
    sg.lamps.forEach((l, k) => { l.material.emissiveIntensity = (k === 0 && asp === 0) || (k === 1 && asp === 1) || (k === 2 && asp === 2) ? 3 : 0; });
  }
  for (const gt of world.dynamic.gates) {
    const near = (S.s > gt.s - 900 && tail < gt.s + 20) || opp.some((o) => o.s > gt.s - 30 && o.s - o.T.length < gt.s + 900);
    for (const g of gt.gates) { const tgt = near ? 0 : g.lr * 1.35; g.pivot.rotation.z += (tgt - g.pivot.rotation.z) * Math.min(1, dt * 1.5); }
  }
  for (const f of world.dynamic.falls) f.tex.offset.y += dt * 1.6;
}

// ── sky, sun and weather ──
function updateSky() {
  const h = S.hour, dayT = (h - 6) / 12;
  const elev = Math.sin(dayT * Math.PI) * 72;
  const az = 90 + dayT * 180;
  const phi = THREE.MathUtils.degToRad(90 - elev), th = THREE.MathUtils.degToRad(az);
  const sv = new THREE.Vector3().setFromSphericalCoords(1, phi, th);
  sky.material.uniforms.sunPosition.value.copy(sv);
  const p = at(R, S.s);
  sun.position.set(p.x + sv.x * 300, p.y + Math.max(20, sv.y * 300), p.z + sv.z * 300); sun.target.position.set(p.x, p.y, p.z);
  const day = THREE.MathUtils.clamp((elev + 7) / 20, 0, 1), wet = S.weather === 'monsoon';
  sun.intensity = day * (wet ? 1.1 : 2.6); hemi.intensity = 0.32 + day * (wet ? 0.65 : 0.55); hemi.color.set(day < 0.3 ? '#8ea4d8' : '#dfeaff');
  sun.color.set(elev < 10 ? '#ffb070' : '#fff4e0');
  const fogDay = wet ? new THREE.Color('#9aa6ad') : S.weather === 'winter' ? new THREE.Color('#d6d2c4') : new THREE.Color('#cdd9e2');
  const fogCol = fogDay.clone().multiplyScalar(0.12 + 0.88 * day); if (elev < 8 && elev > -6) fogCol.lerp(new THREE.Color('#e0a070'), 0.25 * day);
  scene.fog.color.copy(fogCol); scene.fog.density = wet ? 0.0024 : S.weather === 'winter' ? 0.0016 : 0.0009;
  renderer.toneMappingExposure = wet ? 0.42 : 0.55;
  sky.material.uniforms.rayleigh.value = wet ? 4 : 1.6; sky.material.uniforms.turbidity.value = wet ? 18 : S.weather === 'winter' ? 10 : 5;
  const night = day < 0.25; setNight(night);
  for (const l of [...(V?.lights || []), ...opp.flatMap((o) => o.T.lights)]) l.intensity = night || inTunnel() ? 260 : 0;
  rain.visible = wet;
  fill.position.set(p.x, p.y - 45, p.z); fill.material.color.set(S.weather === 'summer' ? '#8a7a52' : S.weather === 'winter' ? '#6e7a44' : '#3f6a2c').multiplyScalar(0.3 + 0.7 * day);
  scene.background = null;
}
const inTunnel = () => !!R.tunnelAt(S.s, 0);

// ── cameras ──
const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3();
function updateCamera(dt) {
  const d = laneD(S.s), rail = S.mode === 'rail', front = S.s;
  let pos, look;
  const P = (s, dd, y) => { const o = offset(R, s, dd, y); return new THREE.Vector3(o.x, o.y, o.z); };
  if (S.cam === 'chase') { pos = P(front - (rail ? 34 : 22), d + 6, rail ? 11 : 8); look = P(front + 30, d, rail ? 3 : 2); }
  else if (S.cam === 'cab') { pos = P(front - (rail ? (S.type === 'express' || S.type === 'freight' ? 2.2 : 3) : 1.8), d + (rail ? 0.6 : -0.6), rail ? RAIL_TOP + 3.1 : 2.5); look = P(front + 80, d, rail ? 3 : 1.6); }
  else if (S.cam === 'side') {
    const plat = rail && R.def.stops.some((p) => Math.abs(p.s - front) < 260);   // under the platform canopy: stand on the platform
    pos = plat ? P(front - 70, 8, 2.75) : P(front - (rail ? 60 : 8), d + (rail ? 24 : 14), rail ? 9 : 6); look = P(front - (plat ? 40 : rail ? 50 : 6), d, 2.5);
  }
  else if (S.cam === 'window') { const sw = front - (rail ? 52 : 6); pos = P(sw, d - (rail ? 1.25 : 1.05), rail ? RAIL_TOP + 2.75 : 2.3); look = P(sw + 6, d - 40, rail ? 2 : 1.5); }
  else if (S.cam === 'trackside') {
    if (!S.trackside || S.s > S.trackside.s + 60 + (rail ? V.length : 20)) { const s = S.s + (rail ? 650 : 260); const side = -12 - Math.random() * 8; S.trackside = { s, pos: P(s, side, 0) }; S.trackside.pos.y = ground(R, s, side) + 1.7; }
    pos = S.trackside.pos.clone(); look = P(Math.min(S.s, S.trackside.s + 20), d, 2.5);
  } else if (S.cam === 'drone') { pos = P(front + 120, d - 90, 70); look = P(front - 30, d, 0); }
  if (S.cam === 'orbit') { const p = P(front - 20, d, 2); controls.target.lerp(p, 0.2); controls.update(); return; }
  const snap = S.cam === 'trackside' || S.cam === 'cab' || S.cam === 'window';
  if (snap || camPos.lengthSq() === 0 || camPos.distanceTo(pos) > 200) { camPos.copy(pos); camTarget.copy(look); }
  else { camPos.lerp(pos, Math.min(1, dt * 3)); camTarget.lerp(look, Math.min(1, dt * 4)); }
  // keep the camera above the terrain
  if (S.cam !== 'cab' && S.cam !== 'window' && !inTunnel()) { const p0 = at(R, S.s); const gy = groundY(camPos, p0); camPos.y = Math.max(camPos.y, gy + 1.5); }
  camera.position.copy(camPos); camera.lookAt(camTarget);
}

function groundY(v, p0) { const dx = v.x - p0.x, dz = v.z - p0.z; const d = -(dx * p0.nx + dz * p0.nz); return ground(R, S.s + (dx * p0.tx + dz * p0.tz), d); }

// ── HUD ──
const SPEED = $('#speed');
function hud() {
  const D = vdef(), p = at(R, S.s), sec = R.section(S.s), next = R.def.stops[Math.min(S.phase === 'run' ? S.stopIdx : S.stopIdx - 1, R.def.stops.length - 1)];
  const kmh = S.v * 3.6;
  SPEED.innerHTML = `<b>${Math.round(kmh)}</b><small>km/h</small><i style="--p:${Math.min(1, kmh / (D.vmax * 1.05))}"></i>`;
  const hh = Math.floor(S.hour), mm = Math.floor((S.hour % 1) * 60);
  const nd = S.phase === 'end' ? 0 : Math.max(0, stopPos(next) - S.s);
  $('#info').innerHTML = `<div><small>Section</small><b>${esc(sec.name)}</b></div>
    <div><small>${S.phase === 'dwell' ? 'Halt' : S.phase === 'end' ? 'Arrived' : D.noStops || D.skip?.includes(next.name) ? 'Passing' : 'Next stop'}</small><b>${esc(next.mr)} · ${esc(next.name)}</b><i>${S.phase === 'dwell' ? `departs in ${Math.max(0, Math.ceil(S.until - S.t))} s` : `${(nd / 1000).toFixed(1)} km`}</i></div>
    <div><small>Elevation</small><b>${Math.round(p.y)} m</b><i>${p.grade > 0.004 ? `climbing 1 in ${Math.round(1 / p.grade)}` : p.grade < -0.004 ? `falling 1 in ${Math.round(-1 / p.grade)}` : 'level'}${R.tunnelAt(S.s, 0) ? ' · tunnel' : R.bridgeAt(S.s, 0) ? ' · viaduct' : ''}</i></div>
    <div><small>Time</small><b>${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</b><i>${(S.dist / 1000).toFixed(1)} km travelled</i></div>`;
  const f = S.s / R.length; $('#pos').style.left = `${f * 100}%`;
}
function drawProfile() {
  const c = $('#profile'), g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const maxY = 700, X = (s) => (s / R.length) * W, Y = (y) => H - 8 - (y / maxY) * (H - 30);
  g.beginPath(); g.moveTo(0, H); for (let s = 0; s <= R.length; s += 200) g.lineTo(X(s), Y(at(R, s).y)); g.lineTo(W, H); g.closePath();
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, 'rgba(255,159,67,.55)'); grd.addColorStop(1, 'rgba(255,159,67,.05)'); g.fillStyle = grd; g.fill();
  for (const [a, b] of R.def.tunnels) { g.fillStyle = '#20262d'; g.fillRect(X(a), Y(at(R, a).y) - 3, X(b) - X(a), 6); }
  for (const [a, b] of R.def.bridges) { g.fillStyle = '#41b6ff'; g.fillRect(X(a), Y(at(R, a).y) - 2, Math.max(2, X(b) - X(a)), 4); }
  $('#stops').innerHTML = R.def.stops.map((st) => `<span style="left:${(st.s / R.length) * 100}%" title="${esc(st.name)} — ${Math.round(at(R, st.s).y)} m"><i></i><em style="transform:translateX(${st.s / R.length < 0.05 ? '-10%' : st.s / R.length > 0.95 ? '-90%' : '-50%'})">${esc(st.name.replace(' (Swargate)', ''))}</em></span>`).join('');
}

// ── sound ──
let AC = null, rumble = null, clackT = 0;
function audio() {
  if (AC) return AC;
  AC = new AudioContext();
  const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
  const gain = AC.createGain(); gain.gain.value = 0; src.connect(lp).connect(gain).connect(AC.destination); src.start();
  rumble = { gain, lp };
  return AC;
}
function horn(len = 1.2) {
  if (!S.sound) return; const ac = audio(), t = ac.currentTime;
  const freqs = S.mode === 'rail' ? (S.type === 'vb' ? [554, 659] : [311, 370, 466]) : [440, 554];
  const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.05); g.gain.setValueAtTime(0.09, t + len); g.gain.linearRampToValueAtTime(0, t + len + 0.25); g.connect(ac.destination);
  for (const f of freqs) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; o.connect(lp).connect(g); o.start(t); o.stop(t + len + 0.3); }
}
function soundFrame(dt) {
  if (!S.sound || !AC) return;
  const k = S.v / 30;
  rumble.gain.gain.value = Math.min(0.12, 0.02 + k * 0.08) * (inTunnel() ? 1.8 : 1); rumble.lp.frequency.value = 180 + k * 500;
  if (S.mode === 'rail' && S.v > 1) {   // clickety-clack at rail joints (13 m rails, two bogies)
    clackT -= dt * S.v;
    if (clackT <= 0) { clackT += 13; const t = AC.currentTime; for (const dl of [0, 0.12, 2.6 / Math.max(S.v, 1), 2.72 / Math.max(S.v, 1)]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.value = 90; g.gain.setValueAtTime(0.05, t + dl); g.gain.exponentialRampToValueAtTime(0.0001, t + dl + 0.06); o.connect(g).connect(AC.destination); o.start(t + dl); o.stop(t + dl + 0.08); } }
  }
}

// ── UI ──
function renderVehicleList() {
  const list = S.mode === 'rail' ? TRAINS : BUSES;
  $('#vehicles').innerHTML = Object.entries(list).map(([k, v]) => `<button data-v="${k}" class="${k === S.type ? 'active' : ''}"><b>${esc(v.name)}</b><small>${esc(v.desc)}</small><em>${v.vmax} km/h</em></button>`).join('');
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === S.mode));
  $('#route-name').textContent = R.def.name;
}
$('#vehicles').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; S.type = b.dataset.v; setup(); });
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { if (S.mode === b.dataset.mode) return; S.mode = b.dataset.mode; S.type = null; setup(); }));
document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));
function setCam(c) { S.cam = c; controls.enabled = c === 'orbit'; if (c === 'orbit') { const p = at(R, S.s); camera.position.set(p.x + 40, p.y + 30, p.z + 40); } camPos.set(0, 0, 0); S.trackside = null; document.querySelectorAll('[data-cam]').forEach((b) => b.classList.toggle('active', b.dataset.cam === c)); updateHash(); }
document.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => { S.weather = b.dataset.w; document.querySelectorAll('[data-w]').forEach((x) => x.classList.toggle('active', x === b)); world.setSeason(seasonOf(S.weather)); updateHash(); }));
document.querySelectorAll('[data-warp]').forEach((b) => b.addEventListener('click', () => { S.warp = +b.dataset.warp; document.querySelectorAll('[data-warp]').forEach((x) => x.classList.toggle('active', x === b)); }));
$('#hour').addEventListener('input', (e) => { S.hour = +e.target.value; });
$('#play').addEventListener('click', () => { S.playing = !S.playing; $('#play').textContent = S.playing ? '❚❚' : '▶'; });
$('#horn').addEventListener('click', () => { if (!S.sound) { S.sound = true; audio(); $('#snd').classList.add('active'); } horn(1.4); });
$('#snd').addEventListener('click', (e) => { S.sound = !S.sound; e.currentTarget.classList.toggle('active', S.sound); if (S.sound) audio().resume(); else if (AC) rumble.gain.gain.value = 0; });
$('#restart').addEventListener('click', () => setup());
$('#profile-wrap').addEventListener('click', (e) => {   // jump along the route
  const r = e.currentTarget.getBoundingClientRect(), f = (e.clientX - r.left) / r.width, s = f * R.length;
  S.s = s; S.v = limitAt(R, s, vdef().vmax) / 3.6 * 0.8; S.phase = 'run'; S.stopIdx = R.def.stops.findIndex((p) => stopPos(p) > s + 5); if (S.stopIdx < 0) S.stopIdx = R.def.stops.length; S.trackside = null; camPos.set(0, 0, 0);
  opp.forEach((o) => scene.remove(o.T.group)); opp = []; traffic.forEach((t) => scene.remove(t.g)); traffic = [];
  for (let i = 0; i < 6; i++) world.update(S.s, 1200, 400);
});
window.addEventListener('keydown', (e) => { if (e.target.closest('input')) return; if (e.key === 'h') $('#horn').click(); if (e.key === ' ') { e.preventDefault(); $('#play').click(); } const cams = ['chase', 'cab', 'side', 'window', 'trackside', 'drone', 'orbit']; if (/^[1-7]$/.test(e.key)) setCam(cams[+e.key - 1]); });
function updateHash() { const p = new URLSearchParams({ mode: S.mode, v: S.type, cam: S.cam, w: S.weather }); history.replaceState(null, '', `#${p}`); }
$('#panel-toggle').addEventListener('click', () => $('#app').classList.toggle('collapsed'));

// ── loop ──
function resize() { const r = canvas.parentElement.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(canvas.parentElement);
let last = performance.now(), hudT = 0;
function frame(now) {
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  const dt = S.playing ? real * S.warp : 0;
  const n = Math.max(1, Math.ceil(dt / 0.05)); for (let i = 0; i < n; i++) step(dt / n);
  if (S.mode === 'rail') placeTrain(R, V, S.s, -2.65, 1); else { const p = at(R, S.s); placeBus(R, V, S.s, laneD(S.s), -p.k * S.v * S.v * 0.004); }
  updateOthers(dt);
  world.update(S.s);
  updateDynamics(dt);
  updateSky();
  updateCamera(real);
  sky.position.copy(camera.position);
  if (rain.visible) { rain.position.copy(camera.position); rain.position.y -= 40; const arr = rainGeo.attributes.position.array; for (let i = 0; i < RAIN_N; i++) { let y = arr[i * 6 + 1] - real * 30; if (y < 0) y += 80; arr[i * 6 + 1] = y; arr[i * 6 + 4] = y - 1.2; } rainGeo.attributes.position.needsUpdate = true; }
  soundFrame(dt);
  hudT += real; if (hudT > 0.15) { hudT = 0; hud(); $('#hour').value = S.hour; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// boot
document.querySelectorAll('[data-w]').forEach((x) => x.classList.toggle('active', x.dataset.w === S.weather));
document.querySelectorAll('[data-warp]').forEach((x) => x.classList.toggle('active', +x.dataset.warp === S.warp));
setup(); setCam(S.cam); resize();
if (q.has('at')) { const s = +q.get('at'); S.s = s; S.phase = 'run'; S.v = limitAt(R, s, vdef().vmax) / 3.6; S.stopIdx = R.def.stops.findIndex((p) => stopPos(p) > s + 5); if (S.stopIdx < 0) S.stopIdx = R.def.stops.length; for (let i = 0; i < 8; i++) world.update(S.s, 1200, 400); }
requestAnimationFrame(frame);
setTimeout(() => $('#loader').classList.add('done'), 300);
window.__yatra = { S, scene, camera, step, stops: () => R.def.stops };   // handle for automated browser tests
void CHUNK;
