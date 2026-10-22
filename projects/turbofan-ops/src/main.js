import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Engine, PHASES, FAULTS, LIMITS, DESIGN, isa } from './engine.js';
import { TurbofanModel } from './model.js';
import { Flow, heat } from './flow.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastT; function toast(m, ms = 3000) { const t = $('#toast'); t.innerHTML = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
const q = new URLSearchParams(location.hash.slice(1));

// ── renderer and scene ──
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.localClippingEnabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.target.set(-0.3, 0, 0); controls.minDistance = 1.2; controls.maxDistance = 30;
const sun = new THREE.DirectionalLight('#ffffff', 2.2); sun.position.set(4, 8, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); scene.add(sun, new THREE.HemisphereLight('#dfe8f5', '#47505a', 0.6));
const apron = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#6f747a', roughness: 0.95, metalness: 0 })); apron.rotation.x = -Math.PI / 2; apron.position.y = -2.9; apron.receiveShadow = true; scene.add(apron);
const grid = new THREE.GridHelper(200, 100, '#888c90', '#7c8085'); grid.position.y = -2.89; grid.material.transparent = true; grid.material.opacity = 0.25; scene.add(grid);
// clouds far below when flying
const clouds = new THREE.Group(); scene.add(clouds);
{ const cm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.9 }); for (let i = 0; i < 70; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 5, 10, 8), cm); c.scale.y = 0.35; c.position.set((Math.random() - 0.5) * 160, -22 - Math.random() * 8, (Math.random() - 0.5) * 160); clouds.add(c); } }

const model = new TurbofanModel(); scene.add(model.group);
const flow = new Flow(5200); scene.add(flow.points);
// fire and stall flames
const flameTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(0.35, 'rgba(255,140,40,.8)'); g.addColorStop(1, 'rgba(200,30,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const fireG = new THREE.BufferGeometry(); const FIRE_N = 500; const firePos = new Float32Array(FIRE_N * 3); fireG.setAttribute('position', new THREE.BufferAttribute(firePos, 3));
const fire = new THREE.Points(fireG, new THREE.PointsMaterial({ size: 0.28, map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fire.visible = false; fire.frustumCulled = false; scene.add(fire);
const fireSeed = Array.from({ length: FIRE_N }, () => ({ x: -0.3 - Math.random() * 1.1, a: 0.25 + Math.random() * 1.1, t: Math.random() }));
const fireLight = new THREE.PointLight('#ff6a1a', 0, 6, 1.5); fireLight.position.set(-0.8, 0.5, 0.5); scene.add(fireLight);
const burst = new THREE.Group(); scene.add(burst);
for (const x of [1.6, -2.7]) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); s.position.set(x, 0, 0); s.scale.set(2.4, 2.4, 1); burst.add(s); }
const combLight = new THREE.PointLight('#ff7a20', 0, 2.2, 1.5); combLight.position.set(-0.75, 0.25, 0.25); scene.add(combLight);

// ── engine ──
const E = new Engine();
const S = { speed: 1, slow: +(q.get('slow') || 0.025), flow: q.get('flow') !== '0', labels: true, sound: false, explode: 0, fault: 'none', tab: 'cockpit' };
if (q.get('phase') && PHASES[q.get('phase')]) E.setPhase(q.get('phase'));
if (q.get('run') === '1') quickStart();
/** Put the engine straight into stable idle (for links and tests). */
function quickStart() {
  E.action('apu', true); E.action('mode', 'start'); E.action('master', true);
  for (let i = 0; i < 900; i++) E.step(0.05);
  E.action('mode', 'norm'); E.log.push({ t: E.t, m: 'Engine started (quick start)' });
}

// ── cameras ──
const VIEWS = {
  three: { p: [4.2, 1.6, 4.6], t: [-0.3, 0, 0], name: 'Three-quarter' },
  side: { p: [-0.4, 0.6, 5.6], t: [-0.4, 0, 0], name: 'Side cutaway' },
  front: { p: [6.5, 0.4, 0.8], t: [0.8, 0, 0], name: 'Inlet' },
  core: { p: [-0.2, 0.55, 1.9], t: [-0.4, 0.2, 0], name: 'Core close-up' },
  comb: { p: [-0.55, 0.85, 1.7], t: [-0.8, 0.25, 0.1], name: 'Combustor' },
  rear: { p: [-6.5, 0.6, 2.4], t: [-1.6, 0, 0], name: 'Exhaust' },
  rev: { p: [-1.2, 1.9, 3.8], t: [-1.0, 0.6, 0], name: 'Thrust reverser' },
};
let fly = null;
function setView(k, instant) {
  const v = VIEWS[k]; if (!v) return;
  const to = { p: new THREE.Vector3(...v.p), t: new THREE.Vector3(...v.t) };
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === k));
  if (instant) { camera.position.copy(to.p); controls.target.copy(to.t); controls.update(); return; }
  fly = { from: { p: camera.position.clone(), t: controls.target.clone() }, to, u: 0 };
}

// ── controls ──
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { S.tab = b.dataset.tab; document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b)); document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('show', t.id === `tab-${b.dataset.tab}`)); }));
$('#apu').addEventListener('click', () => E.action('apu', !E.apuBleed));
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => E.action('mode', b.dataset.mode)));
$('#master').addEventListener('click', () => E.action('master', !E.master));
const lever = $('#lever');
/** Thrust lever: 0–18 reverse, 22 idle, 62 climb, 82 FLX/MCT, 100 TOGA. */
function applyLever() {
  const v = +lever.value;
  if (v < 18) { if (!E.wow) { lever.value = 22; toast('Reverse thrust is only available on the ground'); return applyLever(); } E.action('tla', 0); E.action('rev', (18 - v) / 18); }
  else { E.action('rev', 0); E.action('tla', Math.max(0, (v - 22) / 78)); }
}
lever.addEventListener('input', applyLever);
document.querySelectorAll('[data-detent]').forEach((b) => b.addEventListener('click', () => { lever.value = b.dataset.detent; applyLever(); }));
$('#firehandle').addEventListener('click', () => { if (!E.fireHandle) { E.action('fireHandle'); toast('Fire handle pulled: fuel, hydraulic and bleed valves shut; agents armed'); } });
$('#agent1').addEventListener('click', () => E.action('agent1'));
$('#agent2').addEventListener('click', () => E.action('agent2'));
$('#contign').addEventListener('click', () => E.action('contIgn', !E.contIgn));
$('#autostart').addEventListener('click', () => { E.autoStart = !E.autoStart; toast(E.autoStart ? 'Auto start: the FADEC aborts a bad start by itself' : 'Manual start: you must watch EGT and abort a hot start yourself (ENG MASTER OFF)'); });
$('#phase').innerHTML = Object.entries(PHASES).map(([k, p]) => `<option value="${k}">${esc(p.name)}</option>`).join('');
$('#phase').value = E.phase;
$('#phase').addEventListener('change', (e) => { E.setPhase(e.target.value); if (!E.wow && +lever.value < 22) { lever.value = 22; applyLever(); } toast(`${PHASES[E.phase].name}: ${Math.round(E.alt * 3.281).toLocaleString()} ft, Mach ${E.mach.toFixed(2)}`); });
$('#oat').addEventListener('input', (e) => { E.dT = +e.target.value; $('#oat-v').textContent = `ISA${E.dT >= 0 ? '+' : ''}${E.dT} °C`; });
$('#fault').innerHTML = Object.entries(FAULTS).map(([k, f]) => `<option value="${k}">${esc(f.name)}</option>`).join('');
$('#fault-go').addEventListener('click', () => {
  const f = $('#fault').value; E.action('fault', f);
  if (f === 'bird') { birdT = 0; }
  toast(f === 'none' ? 'Faults cleared' : `<b>${esc(FAULTS[f].name)}</b>: ${esc(FAULTS[f].desc)}`, 5000);
});
$('#reset').addEventListener('click', () => { const ph = E.phase; E.reset(ph); lever.value = 22; applyLever(); toast('Engine reset — cold and stopped'); });
$('#quick').addEventListener('click', () => { const ph = E.phase; E.reset(ph); quickStart(); lever.value = 22; applyLever(); toast('Engine running at idle'); });
document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { S.speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('active', x === b)); }));
$('#cut').addEventListener('click', (e) => { model.setCutaway(!model.cut); e.currentTarget.classList.toggle('active', model.cut); });
$('#xray').addEventListener('click', (e) => { const on = !e.currentTarget.classList.contains('active'); model.setXray(on); e.currentTarget.classList.toggle('active', on); });
$('#flowbtn').addEventListener('click', (e) => { S.flow = !S.flow; e.currentTarget.classList.toggle('active', S.flow); });
$('#lblbtn').addEventListener('click', (e) => { S.labels = !S.labels; e.currentTarget.classList.toggle('active', S.labels); $('#labels').style.display = S.labels ? '' : 'none'; });
$('#explode').addEventListener('input', (e) => { S.explode = +e.target.value; model.setExplode(S.explode); });
$('#slow').addEventListener('input', (e) => { S.slow = +e.target.value; $('#slow-v').textContent = S.slow >= 1 ? 'real speed' : `1/${Math.round(1 / S.slow)} speed`; });
$('#snd').addEventListener('click', (e) => { S.sound = !S.sound; e.currentTarget.classList.toggle('active', S.sound); if (S.sound) audio().resume(); else if (AC) master.gain.value = 0; });
$('#panel-toggle').addEventListener('click', () => $('#app').classList.toggle('collapsed'));
window.addEventListener('keydown', (e) => { if (e.target.closest('input, select')) return; const v = Object.keys(VIEWS)[+e.key - 1]; if (v) setView(v); if (e.key === 'ArrowUp') { lever.value = Math.min(100, +lever.value + 4); applyLever(); } if (e.key === 'ArrowDown') { lever.value = Math.max(0, +lever.value - 4); applyLever(); } });

// ── EICAS display ──
const eic = $('#eicas'), eg = eic.getContext('2d');
function dial(x, y, R, val, min, max, label, unit, amber, red, cmd, fmt) {
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, ang = (v) => a0 + (a1 - a0) * Math.max(0, Math.min(1.05, (v - min) / (max - min)));
  eg.lineWidth = 3; eg.strokeStyle = '#dfe6ee'; eg.beginPath(); eg.arc(x, y, R, a0, ang(amber ?? max)); eg.stroke();
  if (amber != null) { eg.strokeStyle = '#ffb020'; eg.beginPath(); eg.arc(x, y, R, ang(amber), ang(red)); eg.stroke(); }
  if (red != null) { eg.strokeStyle = '#ff3b30'; eg.lineWidth = 5; eg.beginPath(); eg.moveTo(x + Math.cos(ang(red)) * (R - 8), y + Math.sin(ang(red)) * (R - 8)); eg.lineTo(x + Math.cos(ang(red)) * (R + 6), y + Math.sin(ang(red)) * (R + 6)); eg.stroke(); }
  for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10; eg.strokeStyle = '#8b97a3'; eg.lineWidth = 1.5; eg.beginPath(); eg.moveTo(x + Math.cos(a) * (R - 6), y + Math.sin(a) * (R - 6)); eg.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); eg.stroke(); }
  if (cmd != null) { const a = ang(cmd); eg.fillStyle = '#39d0ff'; eg.beginPath(); eg.arc(x + Math.cos(a) * (R + 7), y + Math.sin(a) * (R + 7), 4, 0, 7); eg.fill(); }
  const over = red != null && val >= red, warn = amber != null && val >= amber;
  const a = ang(val); eg.strokeStyle = over ? '#ff3b30' : warn ? '#ffb020' : '#3dff8f'; eg.lineWidth = 3.5; eg.beginPath(); eg.moveTo(x, y); eg.lineTo(x + Math.cos(a) * (R - 4), y + Math.sin(a) * (R - 4)); eg.stroke();
  eg.fillStyle = over ? '#ff3b30' : warn ? '#ffb020' : '#3dff8f'; eg.font = '600 20px "JetBrains Mono", monospace'; eg.textAlign = 'right';
  eg.strokeStyle = '#4d5965'; eg.lineWidth = 1; eg.strokeRect(x + 4, y + 4, R - 2, 26); eg.fillText(fmt(val), x + R - 2, y + 24);
  eg.fillStyle = '#39d0ff'; eg.font = '600 13px Inter, sans-serif'; eg.textAlign = 'center'; eg.fillText(label, x, y + R + 22); eg.fillStyle = '#8b97a3'; eg.font = '11px Inter, sans-serif'; eg.fillText(unit, x, y + R + 36);
}
function drawEicas() {
  const W = eic.width, H = eic.height; eg.fillStyle = '#070b10'; eg.fillRect(0, 0, W, H);
  const n1max = E.n1Target ? Math.min(LIMITS.N1, E.wow ? 104 : 104) : 104;
  dial(95, 92, 62, E.N1, 0, 110, 'N1', '%', null, LIMITS.N1, E.lit ? E.n1Target() : null, (v) => v.toFixed(1));
  dial(265, 92, 62, E.EGT, 0, 1200, 'EGT', '°C', E.startPhase === 'accel' || E.startPhase === 'light' ? LIMITS.EGT_START - 50 : LIMITS.EGT - 35, E.startPhase === 'accel' || E.startPhase === 'light' ? LIMITS.EGT_START : LIMITS.EGT, null, (v) => Math.round(v));
  void n1max;
  eg.textAlign = 'left'; eg.font = '12px Inter, sans-serif';
  const row = (y, label, val, unit, col = '#3dff8f') => { eg.fillStyle = '#39d0ff'; eg.fillText(label, 14, y); eg.fillStyle = col; eg.font = '600 17px "JetBrains Mono", monospace'; eg.textAlign = 'right'; eg.fillText(val, 230, y); eg.textAlign = 'left'; eg.fillStyle = '#8b97a3'; eg.font = '11px Inter, sans-serif'; eg.fillText(unit, 236, y); eg.font = '12px Inter, sans-serif'; };
  row(190, 'N2', E.N2.toFixed(1), '%', E.N2 > LIMITS.N2 ? '#ff3b30' : '#3dff8f');
  row(214, 'FF', Math.round(E.FF * 3600).toLocaleString(), 'kg/h');
  row(238, 'OIL PRESS', Math.round(E.oilP), 'psi', E.oilP < LIMITS.OILP_LO && E.N2 > 50 ? '#ff3b30' : '#3dff8f');
  row(262, 'OIL TEMP', Math.round(E.oilT), '°C');
  row(286, 'OIL QTY', E.oilQty.toFixed(1), 'qt', E.oilQty < 6 ? '#ffb020' : '#3dff8f');
  row(310, 'VIB N1 / N2', `${E.vib1.toFixed(1)} / ${E.vib2.toFixed(1)}`, '', E.vib1 > 4 || E.vib2 > 3.5 ? '#ffb020' : '#3dff8f');
  // status flags
  const flag = (x, y, txt, on, col) => { eg.strokeStyle = on ? col : '#2a3440'; eg.lineWidth = 1.5; eg.strokeRect(x, y, 70, 22); eg.fillStyle = on ? col : '#3a4652'; eg.font = '600 11px Inter, sans-serif'; eg.textAlign = 'center'; eg.fillText(txt, x + 35, y + 15); eg.textAlign = 'left'; };
  flag(286, 172, 'START VLV', E.starterValve, '#3dff8f'); flag(286, 198, E.ignA && E.ignB ? 'IGN A+B' : E.ignA ? 'IGN A' : E.ignB ? 'IGN B' : 'IGN', E.ignA || E.ignB || E.contIgn, '#3dff8f');
  flag(286, 224, 'FUEL', E.fuelValve, '#3dff8f'); flag(286, 250, 'REV', E.revPos > 0.05, E.revPos > 0.95 ? '#3dff8f' : '#ffb020');
  flag(286, 276, 'AVAIL', E.startPhase === 'run' && E.lit, '#3dff8f'); flag(286, 302, 'FIRE', E.fire, '#ff3b30');
  // thrust and mode line
  eg.fillStyle = '#8b97a3'; eg.font = '11px Inter, sans-serif'; eg.fillText(`${PHASES[E.phase].name.toUpperCase()} · ${E.wow ? 'ON GROUND' : 'IN FLIGHT'} · OAT ${Math.round(E.c.T0 - 273.15)} °C`, 14, H - 10);
}
function drawEcam() {
  const box = $('#ecam');
  box.innerHTML = E.msgs.length ? E.msgs.map((m) => `<div class="m ${m.lvl}"><b>${esc(m.txt)}</b>${(m.act || []).map((a) => `<span>${esc(a)}</span>`).join('')}</div>`).join('') : '<div class="m ok">No warnings</div>';
}

// ── engine data tab ──
function drawData() {
  const c = E.c, K = (t) => Math.round(t - 273.15), kP = (p) => (p / 1000).toFixed(p < 2e5 ? 1 : 0);
  const rows = [['0', 'Free stream', c.T0, c.P0], ['2', 'Fan face', c.T2, c.P2], ['13', 'Fan exit (bypass)', c.T13, c.P13], ['25', 'Booster exit', c.T25, c.P25], ['3', 'HPC exit', c.T3, c.P3], ['4', 'Combustor exit', c.T4, c.P4], ['45', 'HPT exit', c.T45, c.P45], ['5', 'LPT exit', c.T5, c.P5]];
  $('#stations').innerHTML = `<tr><th>Stn</th><th></th><th>T °C</th><th>P kPa</th></tr>` + rows.map(([s, n, T, P]) => `<tr><td>${s}</td><td>${n}</td><td style="color:${tcol(T)}">${K(T)}</td><td>${kP(P)}</td></tr>`).join('');
  const F = c.F, tsfc = F > 500 ? (E.FF / F) * 1e6 : 0, Vj = (c.Wb * c.V19 + c.Wc * c.V9) / Math.max(1, c.W), etaP = c.V0 > 5 && Vj > c.V0 ? 2 / (1 + Vj / c.V0) : null;
  const perf = [
    ['Net thrust', `${(F / 1000).toFixed(1)} kN`, `${Math.round(F / 4.448).toLocaleString()} lbf`],
    ['Fuel flow', `${Math.round(E.FF * 3600).toLocaleString()} kg/h`, ''],
    ['TSFC', tsfc ? `${tsfc.toFixed(1)} g/kN·s` : '—', tsfc ? `${(tsfc * 0.0353).toFixed(3)} lb/lbf·h` : ''],
    ['Airflow', `${c.W.toFixed(0)} kg/s`, `core ${c.Wc.toFixed(1)} kg/s`],
    ['Bypass ratio', c.bpr.toFixed(1), ''],
    ['Overall pressure ratio', c.opr.toFixed(1), ''],
    ['Fan / core jet', `${Math.round(c.V19)} / ${Math.round(c.V9)} m/s`, `flight ${Math.round(c.V0)} m/s`],
    ['Bypass share of thrust', F > 500 ? `${Math.round((c.Fb / F) * 100)}%` : '—', ''],
    ['Propulsive efficiency', etaP ? `${Math.round(etaP * 100)}%` : '— (static)', ''],
    ['Spool speeds', `${Math.round(E.N1 / 100 * DESIGN.N1RPM).toLocaleString()} / ${Math.round(E.N2 / 100 * DESIGN.N2RPM).toLocaleString()} rpm`, 'N1 / N2'],
  ];
  $('#perf').innerHTML = perf.map(([a, b, cc]) => `<tr><td>${a}</td><td><b>${b}</b></td><td>${cc}</td></tr>`).join('');
  // history
  const cv = $('#hist'), g = cv.getContext('2d'), W = cv.width, H = cv.height; g.fillStyle = '#0b1016'; g.fillRect(0, 0, W, H);
  const h = E.hist; if (h.length > 1) {
    const t1 = h.at(-1)[0], t0 = t1 - 180, X = (t) => ((t - t0) / 180) * W;
    const line = (i, max, col) => { g.strokeStyle = col; g.lineWidth = 1.8; g.beginPath(); h.forEach((p, k) => { const x = X(p[0]), y = H - 6 - (p[i] / max) * (H - 14); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
    g.strokeStyle = 'rgba(255,255,255,.06)'; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * H / 4); g.lineTo(W, i * H / 4); g.stroke(); }
    line(1, 110, '#3dff8f'); line(2, 110, '#39d0ff'); line(3, 1200, '#ff9f43'); line(4, 4500, '#e9e4dc');
  }
}
const tcol = (T) => { const c = new THREE.Color(); heat(c, T, true); return `#${c.getHexString()}`; };

// ── log and checklist ──
let logN = 0;
function drawLog() {
  if (E.log.length === logN) return; logN = E.log.length;
  $('#log').innerHTML = E.log.slice(-60).reverse().map((l) => `<li><b>${fmtT(l.t)}</b> ${esc(l.m)}</li>`).join('');
}
const fmtT = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const STEPS = [
  ['APU BLEED ON — air for the starter', () => E.apuBleed],
  ['ENG MODE → IGN/START', () => E.mode === 'start' || E.startPhase === 'run'],
  ['ENG MASTER → ON (FADEC opens the starter valve)', () => E.master],
  ['N2 ≥ 16%: igniter on', () => E.ignA || E.lit],
  ['N2 ≥ 22%: fuel on', () => E.fuelValve],
  ['Light-off within 15 s (EGT rises)', () => E.lit],
  ['N2 50%: starter cut-out', () => E.N2 > 50 && E.lit],
  ['Stable idle: N1 ≈ 19.5%, N2 ≈ 58%, EGT ≈ 450 °C', () => E.startPhase === 'run' && E.lit],
  ['ENG MODE → NORM', () => E.mode === 'norm' && E.lit],
];
function drawChecklist() { $('#check').innerHTML = STEPS.map(([t, f]) => `<li class="${f() ? 'done' : ''}">${esc(t)}</li>`).join(''); }

// ── labels ──
const LABELS = [
  ['Fan', 1.25, 0.75, 0.1, 'fan'], ['Spinner', 1.6, 0.15, 0.15, 'spinner'], ['Outlet guide vanes', 0.72, 0.82, 0.25, 'ogv'], ['Booster (LPC)', 0.85, 0.42, 0.12, 'booster'],
  ['High-pressure compressor', 0.0, 0.34, 0.1, 'hpc'], ['Combustor', -0.75, 0.4, 0.15, 'combustor'], ['HP turbine', -1.07, 0.38, 0.1, 'hpt'], ['LP turbine', -1.55, 0.46, 0.1, 'lpt'],
  ['Exhaust plug', -2.7, 0.12, 0.1, 'plug'], ['Thrust reverser', -1.0, 1.05, 0.35, 'sleeve'], ['Accessory gearbox', 0.7, -1.2, 0.2, 'agb'], ['Bypass duct', -0.3, 0.8, 0.3, 'corecowl'],
];
const lblEls = LABELS.map(([t]) => { const d = document.createElement('div'); d.className = 'lbl'; d.textContent = t; $('#labels').appendChild(d); return d; });
const _v = new THREE.Vector3();
function updateLabels() {
  if (!S.labels) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  LABELS.forEach(([, x, y, z, part], i) => {
    const P = model.parts[part]; const dx = P ? P.obj.position.x - P.base.x : 0;
    _v.set(x + dx, y, z).project(camera); const el = lblEls[i];
    if (_v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) { el.style.display = 'none'; return; }
    el.style.display = ''; el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
  });
}

// ── learn tab ──
const INFO = [
  ['fan', 'Fan', 'Eighteen wide-chord, swept fan blades (carbon-fibre composite with titanium leading edges) turn at about 4,400 rpm. Most of the air goes around the core through the bypass duct, and that cold bypass jet makes about 85–90% of the take-off thrust.', 'front'],
  ['ogv', 'Outlet guide vanes', 'Fixed vanes behind the fan that take the swirl out of the bypass air so it leaves straight, and carry structural loads to the fan case.', 'front'],
  ['booster', 'Booster (LP compressor)', 'Three stages on the LP shaft that raise the core air pressure by about 1.8 before the HP compressor.', 'core'],
  ['hpc', 'High-pressure compressor', 'Ten stages on the HP spool (about 16,600 rpm) squeeze the air about 17 times; with the fan and booster, the overall pressure ratio reaches about 40 at take-off. Variable stator vanes and bleed valves keep it away from stall at low speed — that is why the FADEC limits how fast fuel can be added.', 'core'],
  ['combustor', 'Combustor', 'An annular, lean-burn combustor with 18 fuel nozzles and two igniters. The gas reaches about 1,900 K — hotter than the melting point of the turbine blade alloy, which survives thanks to film cooling and thermal-barrier coatings.', 'comb'],
  ['hpt', 'HP turbine', 'Two stages extract enough energy from the hot gas to drive the HP compressor. Its blades are single-crystal nickel alloy with internal cooling passages.', 'core'],
  ['lpt', 'LP turbine', 'Seven stages drive the fan and booster through the LP shaft that runs inside the HP spool. EGT is measured between its stages.', 'core'],
  ['sleeve', 'Thrust reverser', 'On landing the translating sleeve slides aft, blocker doors close off the bypass duct and cascade vanes turn the fan air forwards. Reverse thrust is only available on the ground with the thrust lever at idle.', 'rev'],
  ['agb', 'Accessory gearbox', 'Driven by the HP spool through a radial tower shaft. It carries the fuel pump, oil pumps, generator, hydraulic pump — and the air turbine starter, which uses APU bleed air to spin the core for a start.', 'three'],
  ['lpshaft', 'Two spools', 'The LP spool (fan + booster + LPT) and the HP spool (HPC + HPT) are mechanically independent and turn at different speeds: N1 and N2 on the cockpit display.', 'side'],
];
$('#info').innerHTML = INFO.map(([k, t, d, v]) => `<button data-info="${k}" data-v="${v}"><b>${esc(t)}</b><span>${esc(d)}</span></button>`).join('');
$('#info').addEventListener('click', (e) => { const b = e.target.closest('[data-info]'); if (!b) return; setView(b.dataset.v); flash(b.dataset.info); });
function flash(part) {
  const P = model.parts[part]; if (!P) return;
  const mats = new Set(); P.obj.traverse((o) => { if (o.material && o.material.emissive) mats.add(o.material); });
  for (const m of mats) { m.userData.e = m.emissive.getHex(); m.userData.ei = m.emissiveIntensity; m.emissive.set('#39d0ff'); m.emissiveIntensity = 0.6; }
  setTimeout(() => { for (const m of mats) { m.emissive.setHex(m.userData.e); m.emissiveIntensity = m.userData.ei; } }, 1400);
}

// ── sound ──
let AC = null, master, fanOsc, coreOsc, noiseG, hissG, fanG, coreG;
function audio() {
  if (AC) return AC;
  AC = new AudioContext(); master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
  const mk = (type) => { const o = AC.createOscillator(); o.type = type; const g = AC.createGain(); g.gain.value = 0; o.connect(g).connect(master); o.start(); return [o, g]; };
  [fanOsc, fanG] = mk('sawtooth'); [coreOsc, coreG] = mk('triangle');
  const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const n1 = AC.createBufferSource(); n1.buffer = buf; n1.loop = true; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; noiseG = AC.createGain(); noiseG.gain.value = 0; n1.connect(lp).connect(noiseG).connect(master); n1.start();
  const n2 = AC.createBufferSource(); n2.buffer = buf; n2.loop = true; const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000; hissG = AC.createGain(); hissG.gain.value = 0; n2.connect(hp).connect(hissG).connect(master); n2.start();
  return AC;
}
function bang() { if (!S.sound || !AC) return; const t = AC.currentTime, b = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (AC.sampleRate * 0.08)); const s = AC.createBufferSource(); s.buffer = b; const g = AC.createGain(); g.gain.value = 1.2; s.connect(g).connect(master); s.start(t); }
function sound() {
  if (!S.sound || !AC) return;
  const n1 = E.N1 / 100, n2 = E.N2 / 100;
  fanOsc.frequency.value = 40 + n1 * 18 * 73 * 0.25; fanG.gain.value = Math.min(0.06, n1 * 0.08);
  coreOsc.frequency.value = 400 + n2 * 2200; coreG.gain.value = Math.min(0.03, n2 * 0.035);
  noiseG.gain.value = Math.min(0.5, (E.c.F / 120000) * 0.45 + (E.lit ? 0.04 : 0));
  hissG.gain.value = E.starterValve ? 0.05 : 0;
}

// ── loop ──
function resize() { const r = canvas.parentElement.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(canvas.parentElement);
let last = performance.now(), slowT = 0, bangs = 0, birdT = -1, shake = 0, a1 = 0, a2 = 0;
function frame(now) {
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  const sdt = real * S.speed, n = Math.max(1, Math.ceil(sdt / 0.05)); for (let i = 0; i < n; i++) E.step(sdt / n);
  // rotors (display speed scaled so the blades stay readable)
  const rps1 = (E.N1 / 100) * DESIGN.N1RPM / 60, rps2 = (E.N2 / 100) * DESIGN.N2RPM / 60;
  a1 += rps1 * 2 * Math.PI * real * S.slow; a2 += rps2 * 2 * Math.PI * real * S.slow;
  model.lp.rotation.x = -a1; model.hp.rotation.x = -a2;
  // combustor flame, igniter sparks, hot sections
  const c = E.c, hot = E.lit ? Math.min(1, (c.T4 - c.T3) / 1100) : 0;
  model.flameMat.opacity = hot * 0.85 * (0.85 + Math.random() * 0.15); model.flameMat.color.set(hot > 0.7 ? '#ffd27a' : '#ff8a2a');
  combLight.intensity = hot * 6;
  for (const [i, sp] of model.igniters.entries()) sp.material.opacity = (i === 0 ? E.ignA : E.ignB || (E.contIgn && i === 1)) && Math.random() < 0.35 ? 1 : 0;
  model.hptMat.emissiveIntensity = Math.max(0, (c.T45 - 900) / 900) * 0.8;
  model.plugMat.emissiveIntensity = Math.max(0, (E.EGT - 450) / 900) * 0.6;
  model.setReverser(E.revPos);
  model.starterMesh.material.emissive?.set(E.starterValve ? '#3dff8f' : '#000000');
  // airflow
  flow.update(real, E, S.slow, S.flow);
  // stall bursts and shake
  if (E.bang && E.bang !== bangs) { bangs = E.bang; burst.children.forEach((s) => (s.material.opacity = 1)); shake = 0.5; bang(); }
  burst.children.forEach((s) => { s.material.opacity = Math.max(0, s.material.opacity - real * 2.5); });
  // bird strike animation
  if (birdT >= 0) { birdT += real; model.bird.visible = birdT < 0.6; model.bird.position.set(8 - birdT * 11.3, 0.55, 0.15); if (birdT > 0.6) birdT = -1; }
  model.fan.material.color.set(E.bladeDamage ? '#3a2f2c' : '#2b2f36');
  // fire
  fire.visible = E.fire; fireLight.intensity = E.fire ? 3 + Math.random() * 2 : 0;
  if (E.fire) { for (let i = 0; i < FIRE_N; i++) { const s = fireSeed[i]; s.t += real * (0.6 + Math.random()); if (s.t > 1) s.t = 0; const rr = 0.66 + s.t * 0.22; firePos[i * 3] = s.x - s.t * 0.3; firePos[i * 3 + 1] = Math.sin(s.a) * rr + s.t * 0.3; firePos[i * 3 + 2] = Math.cos(s.a) * rr; } fireG.attributes.position.needsUpdate = true; }
  // environment
  apron.visible = grid.visible = E.wow; clouds.visible = !E.wow;
  scene.background = new THREE.Color(E.wow ? '#9db3c9' : E.alt > 8000 ? '#3f6fb0' : '#6f9fd6');
  if (!E.wow) { clouds.position.x -= real * c.V0 * 0.05; if (clouds.position.x < -80) clouds.position.x += 160; }
  // camera
  if (fly) { fly.u = Math.min(1, fly.u + real / 1.2); const e = fly.u < 0.5 ? 2 * fly.u * fly.u : 1 - Math.pow(-2 * fly.u + 2, 2) / 2; camera.position.lerpVectors(fly.from.p, fly.to.p, e); controls.target.lerpVectors(fly.from.t, fly.to.t, e); if (fly.u >= 1) fly = null; }
  controls.update();
  if (shake > 0 || E.vib1 > 3) { shake = Math.max(0, shake - real); const k = shake * 0.04 + Math.max(0, E.vib1 - 3) * 0.004; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; }
  slowT += real; if (slowT > 0.12) { slowT = 0; drawEicas(); drawEcam(); drawChecklist(); if (S.tab === 'data') drawData(); drawLog(); hudTop(); }
  sound(); updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function hudTop() {
  $('#hud').innerHTML = `<div><small>Thrust</small><b>${(E.c.F / 1000).toFixed(1)}<span> kN</span></b></div><div><small>N1</small><b>${E.N1.toFixed(1)}<span>%</span></b></div><div><small>EGT</small><b style="color:${E.EGT > LIMITS.EGT ? '#ff3b30' : E.EGT > LIMITS.EGT - 35 ? '#ffb020' : ''}">${Math.round(E.EGT)}<span> °C</span></b></div><div><small>Phase</small><b class="ph">${esc(E.startPhase === 'run' ? (E.revPos > 0.5 ? 'REVERSE' : E.tla > 0.9 ? 'TOGA' : E.tla > 0.05 ? 'THRUST' : 'IDLE') : E.startPhase === 'off' ? (E.N2 > 2 ? 'RUN-DOWN' : 'STOPPED') : E.startPhase.toUpperCase())}</b></div>`;
  $('#master').classList.toggle('on', E.master); $('#master').textContent = E.master ? 'ON' : 'OFF';
  $('#apu').classList.toggle('on', E.apuBleed); $('#contign').classList.toggle('on', E.contIgn); $('#autostart').classList.toggle('on', E.autoStart);
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === E.mode));
  $('#firehandle').classList.toggle('lit', E.fire); $('#firehandle').classList.toggle('pulled', E.fireHandle);
  $('#agent1').classList.toggle('used', E.agent1); $('#agent2').classList.toggle('used', E.agent2);
  $('#agent1').disabled = !E.fireHandle; $('#agent2').disabled = !E.fireHandle;
  $('#lever-v').textContent = E.revPos > 0.05 || +lever.value < 18 ? `REV ${Math.round(E.rev * 100)}%` : `TLA ${Math.round(E.tla * 100)}% → N1 ${E.lit ? E.n1Target().toFixed(1) : '—'}%`;
}
// boot
setView(q.get('view') || 'three', true); resize();
if (q.has('tla')) { lever.value = 22 + 78 * +q.get('tla'); applyLever(); }
if (q.get('fault') && FAULTS[q.get('fault')]) { $('#fault').value = q.get('fault'); }
$('#slow').value = S.slow; $('#slow-v').textContent = S.slow >= 1 ? 'real speed' : `1/${Math.round(1 / S.slow)} speed`;
requestAnimationFrame(frame);
setTimeout(() => $('#loader').classList.add('done'), 300);
window.__tf = { E, model, camera, setView, S, quickStart, isa };   // handle for automated browser tests
