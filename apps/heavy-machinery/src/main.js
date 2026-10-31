/**
 * Earthmovers: showroom, operate, configure, compare, fleet planner, sandbox and job site.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BUILDERS } from './machines.js';
import { M, anchor } from './kit.js';
import { MACHINES, ORDER, PAINTS, OPTIONS, MATERIALS, HAULERS, fmtL } from './data.js';
import { Terrain } from './terrain.js';
import { buildSite, TRUCK_SCALE, TRUCK_M3 } from './site.js';

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const q = new URLSearchParams(location.hash.slice(1));
const D2R = Math.PI / 180;
let toastT; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

// ── renderer and scene ──
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 2; controls.maxDistance = 400;
const sun = new THREE.DirectionalLight('#fff7ea', 1.7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target, new THREE.HemisphereLight('#f2f6ff', '#7d7466', 0.55));
function shadowBox(r, cx = 0, cz = 0) { const c = sun.shadow.camera; c.left = c.bottom = -r; c.right = c.top = r; c.near = 1; c.far = r * 6; c.updateProjectionMatrix(); sun.position.set(cx + r * 0.6, r * 1.6, cz + r * 0.9); sun.target.position.set(cx, 0, cz); }

// showroom stage
const stage = new THREE.Group(); scene.add(stage);
const turn = new THREE.Group(); stage.add(turn);
const floor = new THREE.Mesh(new THREE.CircleGeometry(160, 64), new THREE.MeshStandardMaterial({ color: '#d4d8dc', roughness: 0.75 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.25; floor.receiveShadow = true; stage.add(floor);
const plinth = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.3, 0.25, 96), new THREE.MeshStandardMaterial({ color: '#2b3038', roughness: 0.5, metalness: 0.3 })); plinth.position.y = -0.125; plinth.receiveShadow = true; turn.add(plinth);
const ringM = new THREE.MeshStandardMaterial({ color: '#f2b705', emissive: '#f2b705', emissiveIntensity: 0.8 });
const ring = new THREE.Mesh(new THREE.TorusGeometry(9.15, 0.04, 8, 128), ringM); ring.rotation.x = Math.PI / 2; ring.position.y = -0.11; ring.scale.setScalar(1.018); turn.add(ring);
for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.01, 0.06), new THREE.MeshStandardMaterial({ color: '#555c66' })); t.position.set(Math.cos(a) * 8.4, 0.006, Math.sin(a) * 8.4); t.rotation.y = -a; turn.add(t); }
const holder = new THREE.Group(); turn.add(holder);

// sandbox world
const sand = new THREE.Group(); sand.visible = false; scene.add(sand);
const terrain = new Terrain(56, 0.25); sand.add(terrain.mesh);
const sandHolder = new THREE.Group(); sand.add(sandHolder);
let truckS = null;
// job site (built on first visit)
let site = null; const siteHolder = new THREE.Group(); siteHolder.visible = false; scene.add(siteHolder);

// ── state ──
const state = {
  id: ORDER.includes(q.get('m')) ? q.get('m') : 'backhoe', mode: 'show', tab: 'over', demo: false, demoT: 0,
  hot: true, dims: false, spin: false, snd: false, speed: 1, follow: null, fleet: null,
  cfg: Object.fromEntries(ORDER.map((id) => [id, { tool: null, opts: new Set(OPTIONS.filter((o) => o.def && (!o.only || o.only.includes(id))).map((o) => o.id)) }])),
  paint: PAINTS.find((p) => p.id === q.get('paint')) ? q.get('paint') : 'yellow',
  drive: { v: 0, steer: 0 }, keys: new Set(), moved: 0,
};
let mach = null, rest = {}, rangeData = null;

function setPaint(id) {
  const p = PAINTS.find((x) => x.id === id) || PAINTS[0]; state.paint = p.id;
  M.paint.color.set(p.hex); M.rim.color.set(p.rim);
  $$('.swatches button').forEach((b) => b.classList.toggle('active', b.dataset.p === p.id));
}

// ── machine loading ──
function frameBox(obj) { obj.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(obj, true); }
function loadMachine(id, { keepCam = false } = {}) {
  state.id = id; state.demo = false;
  if (mach) mach.root.parent?.remove(mach.root);
  mach = BUILDERS[id]();
  const cfg = state.cfg[id];
  if (cfg.tool && mach.tools[cfg.tool]) mach.setTool(cfg.tool); else cfg.tool = mach.toolId;
  rest = Object.fromEntries(mach.order.map((k) => [k, mach.get(k)]));
  // centre the machine on the plinth
  const b = frameBox(mach.root); mach.center = b.getCenter(new THREE.Vector3()); mach.size = b.getSize(new THREE.Vector3()); mach.box = b;
  if (state.mode === 'sand') placeInSandbox(); else { mach.root.position.set(-mach.center.x, 0, -mach.center.z); holder.add(mach.root); }
  // eye point in the cab, for the cab camera
  const cabH = mach.hotspots.find((h) => h.name === 'Cab'); mach.eye = cabH ? anchor(cabH.obj.parent, 0.25, 1.3, 0) : null;
  applyOptions(); mach.update(0);
  rangeData = computeRange(mach);
  $$('.card').forEach((c) => c.classList.toggle('active', c.dataset.id === id));
  $('#title').innerHTML = `<b>${esc(MACHINES[id].name)}</b><span>${esc(MACHINES[id].cls)}</span>`;
  buildHotspots(); renderTabs(); clearDims();
  if (!keepCam) setCam('iso', true);
  sound.reset();
}
function applyOptions() {
  if (!mach) return; const o = state.cfg[state.id].opts;
  M.lamp.emissiveIntensity = o.has('led') ? 2.2 : 0.15;
  for (const b of mach.beacons) b.visible = o.has('beacon');
}

// ── cameras ──
let camAnim = null;
function setCam(v, instant = false) {
  $$('#cams button').forEach((b) => b.classList.toggle('active', b.dataset.cam === v));
  state.cam = v;
  if (state.mode === 'site') { const t = new THREE.Vector3(0, 0, 0); const p = v === 'top' ? new THREE.Vector3(0, 150, 1) : v === 'side' ? new THREE.Vector3(0, 30, 120) : v === 'front' ? new THREE.Vector3(120, 30, 0) : new THREE.Vector3(62, 74, 100); t.set(0, 0, -3); state.follow = null; return flyTo(p, t, instant); }
  if (!mach) return;
  const b = frameBox(mach.root), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), R = Math.max(s.x, s.y * 1.3, s.z) * 0.62 + 1.5;
  const fov = camera.fov * D2R, dist = R / Math.sin(fov / 2) * (camera.aspect < 1 ? 1.12 : 1);
  if (v === 'cab' && mach.eye) { const e = mach.eye.getWorldPosition(new THREE.Vector3()), qn = mach.eye.parent.getWorldQuaternion(new THREE.Quaternion()), f = new THREE.Vector3(1, -0.18, 0).applyQuaternion(qn); return flyTo(e, e.clone().addScaledVector(f, 6), instant, true); }
  const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(mach.root.getWorldQuaternion(new THREE.Quaternion())), side = new THREE.Vector3(0, 0, 1).applyQuaternion(mach.root.getWorldQuaternion(new THREE.Quaternion()));
  let p;
  if (v === 'side') p = c.clone().addScaledVector(side, dist).add(new THREE.Vector3(0, s.y * 0.15, 0));
  else if (v === 'front') p = c.clone().addScaledVector(fwd, dist).add(new THREE.Vector3(0, s.y * 0.3, 0));
  else if (v === 'top') p = c.clone().add(new THREE.Vector3(0.01, dist * 1.1, 0));
  else p = c.clone().addScaledVector(fwd, dist * 0.62).addScaledVector(side, dist * 0.72).add(new THREE.Vector3(0, dist * 0.38, 0));
  flyTo(p, c, instant);
}
function flyTo(p, t, instant, cab = false) {
  controls.minDistance = cab ? 0.1 : 2;
  if (instant) { camera.position.copy(p); controls.target.copy(t); controls.update(); camAnim = null; return; }
  camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: p.clone(), t1: t.clone(), u: 0 };
}

// ── hotspots and dimensions ──
const labels = $('#labels');
let hsEls = [];
function buildHotspots() {
  labels.querySelectorAll('.hs').forEach((e) => e.remove()); hsEls = [];
  if (!mach || state.mode === 'site') return;
  for (const h of mach.hotspots) {
    const el = document.createElement('div'); el.className = 'hs'; el.innerHTML = `<i></i><span>${esc(h.name)}</span>`;
    el.addEventListener('click', () => showTip(h)); labels.appendChild(el); hsEls.push([h, el]);
  }
}
function showTip(h) {
  const c = $('#tipcard'); c.innerHTML = `<button aria-label="Close">×</button><b>${esc(h.name)}</b><p>${esc(h.text)}</p>`; c.classList.add('show');
  c.querySelector('button').onclick = () => c.classList.remove('show');
  const p = h.obj.getWorldPosition(new THREE.Vector3()), dir = camera.position.clone().sub(controls.target).normalize();
  flyTo(p.clone().addScaledVector(dir, Math.max(7, mach.size.length() * 0.55)), p);
}
let dimG = null, dimEls = [];
function clearDims() { if (dimG) dimG.parent?.remove(dimG); dimG = null; dimEls.forEach((e) => e.remove()); dimEls = []; }
function buildDims() {
  clearDims(); if (!state.dims || !mach || state.mode === 'site') return;
  // box in the machine's own frame
  const r = mach.root, saved = [r.position.clone(), r.rotation.y, r.parent]; const tmp = new THREE.Group(); scene.add(tmp); tmp.add(r); r.position.set(0, 0, 0); r.rotation.y = 0;
  const b = frameBox(r); tmp.remove(r); scene.remove(tmp); saved[2].add(r); r.position.copy(saved[0]); r.rotation.y = saved[1];
  dimG = new THREE.Group(); r.add(dimG);
  const mat = new THREE.LineBasicMaterial({ color: '#f2b705' });
  const line = (a, c, label) => {
    const g = new THREE.BufferGeometry().setFromPoints([a, c]); dimG.add(new THREE.Line(g, mat));
    const d = c.clone().sub(a).normalize(), n = Math.abs(d.y) > 0.5 ? new THREE.Vector3(0.25, 0, 0) : new THREE.Vector3(0, 0.25, 0);
    for (const p of [a, c]) dimG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p.clone().sub(n), p.clone().add(n)]), mat));
    const el = document.createElement('div'); el.className = 'dim'; el.textContent = label; labels.appendChild(el); dimEls.push(el); el._p = a.clone().add(c).multiplyScalar(0.5); el._o = dimG;
  };
  const z = b.max.z + 0.8, x = b.max.x + 0.8;
  line(new THREE.Vector3(b.min.x, 0.02, z), new THREE.Vector3(b.max.x, 0.02, z), `L ${(b.max.x - b.min.x).toFixed(2)} m`);
  line(new THREE.Vector3(x, 0.02, b.min.z), new THREE.Vector3(x, 0.02, b.max.z), `W ${(b.max.z - b.min.z).toFixed(2)} m`);
  line(new THREE.Vector3(b.min.x - 0.6, 0, z), new THREE.Vector3(b.min.x - 0.6, b.max.y, z), `H ${b.max.y.toFixed(2)} m`);
}

// ── working range (computed from the 3D model) ──
const REACH = { excavator: ['boom', 'stick'], backhoe: ['boom', 'dipper', 'extend'], loader: ['lift'], skid: ['lift'], telehandler: ['boom', 'extend'] };
function computeRange(m) {
  const js = REACH[m.id]; if (!js || !m.tool?.userData.tip) return null;
  const saved = Object.fromEntries(m.order.map((k) => [k, m.get(k)]));
  if (m.id === 'excavator') { m.set('swing', 0); m.set('bucket', 60); } if (m.id === 'backhoe') { m.set('swing', 0); m.set('bucket', -60); }
  const N = js.length === 1 ? 40 : js.length === 2 ? 34 : 14, pts = [], v = new THREE.Vector3();
  const rec = (i) => {
    if (i === js.length) { m.root.updateWorldMatrix(true, true); m.tool.userData.tip.getWorldPosition(v); m.root.worldToLocal(v); pts.push([v.x, v.y]); return; }
    const j = m.joints[js[i]]; for (let k = 0; k <= N; k++) { m.set(js[i], j.min + ((j.max - j.min) * k) / N); rec(i + 1); }
  };
  rec(0); for (const [k, val] of Object.entries(saved)) m.set(k, val); m.update(0);
  const flip = pts.reduce((s, p) => s + p[0], 0) < 0 ? -1 : 1; for (const p of pts) p[0] *= flip;
  const maxH = Math.max(...pts.map((p) => p[1])), minY = Math.min(...pts.map((p) => p[1]));
  const ground = pts.filter((p) => Math.abs(p[1]) < 0.35), reachG = ground.length ? Math.max(...ground.map((p) => p[0])) : 0, reachMax = Math.max(...pts.map((p) => p[0]));
  return { pts, maxH, depth: Math.min(0, minY), reachG, reachMax, flip };
}
function rangeSVG(r) {
  if (!r) return '<p class="muted">This machine works with a blade rather than an arm: no reach chart.</p>';
  const b = mach.box; const xs = r.pts.map((p) => p[0]), x0 = Math.min(-mach.size.x * 0.6, ...xs) - 0.5, x1 = Math.max(...xs) + 0.8, y0 = Math.min(r.depth, 0) - 0.6, y1 = Math.max(r.maxH, mach.size.y) + 0.6;
  const W = 320, H = Math.min(260, Math.max(150, (W * (y1 - y0)) / (x1 - x0))), sx = W / (x1 - x0), sy = H / (y1 - y0);
  const X = (x) => ((x - x0) * sx).toFixed(1), Y = (y) => (H - (y - y0) * sy).toFixed(1);
  const dots = r.pts.map(([x, y]) => `<circle cx="${X(x)}" cy="${Y(y)}" r="1.6"/>`).join('');
  const lx = r.flip < 0 ? -(b.max.x - mach.center.x) : (b.min.x - mach.center.x), hx = r.flip < 0 ? -(b.min.x - mach.center.x) : (b.max.x - mach.center.x);
  let grid = ''; for (let gx = Math.ceil(x0); gx <= x1; gx += 1) grid += `<line x1="${X(gx)}" y1="0" x2="${X(gx)}" y2="${H}" stroke="#ffffff10"/>`; for (let gy = Math.ceil(y0); gy <= y1; gy += 1) grid += `<line x1="0" y1="${Y(gy)}" x2="${W}" y2="${Y(gy)}" stroke="#ffffff10"/>`;
  return `<svg viewBox="0 0 ${W} ${H.toFixed(0)}" role="img" aria-label="Working range">${grid}
    <rect x="${X(Math.min(lx, hx))}" y="${Y(mach.size.y)}" width="${(Math.abs(hx - lx) * sx).toFixed(1)}" height="${(mach.size.y * sy).toFixed(1)}" fill="#f2b70522" stroke="#f2b70566" rx="3"/>
    <line x1="0" y1="${Y(0)}" x2="${W}" y2="${Y(0)}" stroke="#9aa4b0" stroke-width="1.2"/>
    <g fill="#f2b705" fill-opacity=".38">${dots}</g>
    <text x="6" y="14" fill="#9aa4b0" font-size="10">1 m grid · ground line · tool-tip positions</text></svg>
    <div class="nums"><div><b>${r.maxH.toFixed(1)} m</b><span>max height</span></div><div><b>${(r.reachG || r.reachMax).toFixed(1)} m</b><span>${r.reachG ? 'reach at ground' : 'max reach'}</span></div><div><b>${(-r.depth).toFixed(1)} m</b><span>dig depth</span></div></div>`;
}

// ── panels ──
function renderTabs() { renderOverview(); renderOperate(); renderConfig(); renderCompare(); renderFleet(); }
function renderOverview() {
  const d = MACHINES[state.id];
  $('#tab-over').innerHTML = `<h3>${esc(d.name)}</h3><div class="muted">${esc(d.cls)}</div><p class="lead">${esc(d.tag)}</p>
    <div class="chips">${d.apps.map((a) => `<span>${esc(a)}</span>`).join('')}</div>
    <h4>Typical specification</h4><table class="specs">${d.specs.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    <div class="price"><span class="muted">Indicative price</span><b>${fmtL(d.price[0])} – ${fmtL(d.price[1])}</b></div>
    <h4>Working range of this model</h4><div class="range">${rangeSVG(rangeData)}</div>
    <h4>Walkaround</h4><div class="hlist">${mach.hotspots.map((h, i) => `<button data-h="${i}"><b>${esc(h.name)}</b> <span class="muted">· ${esc(h.text.split('.')[0])}</span></button>`).join('')}</div>
    <h4>Class examples</h4><p class="muted">${esc(d.examples)}. Figures above are typical of the class and illustrative, not any manufacturer's published specification.</p>`;
  $$('#tab-over [data-h]').forEach((b) => b.addEventListener('click', () => showTip(mach.hotspots[+b.dataset.h])));
}
const KEYS = [['w', 's'], ['a', 'd'], ['i', 'k'], ['j', 'l'], ['u', 'o'], ['t', 'g'], ['y', 'h'], ['r', 'f']];
function opJoints() { return mach.order.filter((k) => !k.startsWith('_')); }
function keyFor(name, i) { return mach.keymap?.[name] || (mach.keymap ? null : KEYS[i]); }
function renderOperate() {
  const js = opJoints();
  $('#tab-op').innerHTML = `<div class="row"><button id="demo" class="btn primary">▶ Demo cycle</button><button id="rest" class="btn">Reset pose</button>${state.mode !== 'sand' ? '<button id="tosand" class="btn">⛏ Try it in the sandbox</button>' : ''}</div>
    <div id="sliders">${js.map((k, i) => { const j = mach.joints[k], kk = keyFor(k, i); return `<label class="slider"><span>${esc(j.label)} ${kk ? `<em><kbd>${kk[0].toUpperCase()}</kbd><kbd>${kk[1].toUpperCase()}</kbd></em>` : ''}<b id="v-${k}"></b></span><input type="range" data-j="${k}" min="${j.min}" max="${j.max}" step="${j.unit === '°' ? 0.5 : 0.01}" value="${j.value}"/></label>`; }).join('')}</div>
    <h4>Tool tip</h4><div class="readout" id="tipread"></div>
    <h4>Driving ${state.mode === 'sand' ? '' : '<span class="muted">(sandbox)</span>'}</h4>
    <table class="keys"><tr><td><kbd>↑</kbd> <kbd>↓</kbd></td><td>Forward / reverse</td></tr><tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>${mach.drive.kind === 'tracks' ? 'Counter-rotate the tracks' : mach.drive.kind === 'artic' ? 'Articulate' : 'Steer'}</td></tr><tr><td><kbd>Space</kbd></td><td>Stop</td></tr></table>
    <p class="muted">Each control has two keys. The rams follow every joint, and their rods slide in and out of the barrels.</p>`;
  $$('#tab-op input[data-j]').forEach((inp) => inp.addEventListener('input', () => { state.demo = false; mach.set(inp.dataset.j, +inp.value); }));
  $('#demo').onclick = () => { state.demo = !state.demo; state.demoT = 0; $('#demo').textContent = state.demo ? '■ Stop demo' : '▶ Demo cycle'; };
  $('#rest').onclick = () => { state.demo = false; mach.pose(rest); };
  $('#tosand')?.addEventListener('click', () => setMode('sand'));
}
function syncOperate() {
  if (state.tab !== 'op' || !mach) return;
  for (const k of opJoints()) { const j = mach.joints[k], el = document.getElementById(`v-${k}`); if (el) el.textContent = j.unit === '°' ? `${j.value.toFixed(0)}°` : j.unit === 'm' ? `${j.value.toFixed(2)} m` : `${Math.round(j.value * 100)}%`; const inp = document.querySelector(`#tab-op input[data-j="${k}"]`); if (inp && document.activeElement !== inp) inp.value = j.value; }
  const t = mach.tip(new THREE.Vector3());
  if (t) { const o = mach.root.position, g = state.mode === 'sand' ? terrain.height(t.x, t.z) : 0, reach = Math.hypot(t.x - o.x, t.z - o.z);
    $('#tipread').innerHTML = `<div><b>${reach.toFixed(2)} m</b><span>reach from centre</span></div><div><b>${(t.y - (state.mode === 'sand' ? o.y : 0)).toFixed(2)} m</b><span>height</span></div><div><b>${(t.y - g).toFixed(2)} m</b><span>above ground</span></div>`; }
  else $('#tipread').innerHTML = '<div><b>—</b><span>no tool tip</span></div>';
}
function renderConfig() {
  const id = state.id, d = MACHINES[id], cfg = state.cfg[id];
  const opts = OPTIONS.filter((o) => !o.only || o.only.includes(id));
  $('#tab-cfg').innerHTML = `<h4>Fleet livery</h4><div class="swatches">${PAINTS.map((p) => `<button data-p="${p.id}" title="${esc(p.name)}" style="--c:${p.hex}" class="${p.id === state.paint ? 'active' : ''}"></button>`).join('')}</div><p class="muted" id="pname">${esc(PAINTS.find((p) => p.id === state.paint).name)}</p>
    <h4>Attachment</h4><div class="opts">${Object.entries(mach.tools).map(([k, t]) => `<label><input type="radio" name="tool" value="${k}" ${k === cfg.tool ? 'checked' : ''}/><span>${esc(t.name)}</span><em>${t.price ? '+' + fmtL(t.price) : 'standard'}</em></label>`).join('')}</div>
    <h4>Options</h4><div class="opts">${opts.map((o) => `<label><input type="checkbox" data-o="${o.id}" ${cfg.opts.has(o.id) ? 'checked' : ''}/><span>${esc(o.name)}</span><em>+${fmtL(o.price)}</em></label>`).join('')}</div>
    <h4>Finance</h4><div class="grid2"><label class="field">Down payment<select id="fdown">${[10, 15, 20, 25, 30].map((v) => `<option ${v === 20 ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="field">Interest % p.a.<input id="frate" type="number" min="6" max="18" step="0.25" value="10.5"/></label><label class="field">Tenure (months)<select id="ften">${[24, 36, 48, 60].map((v) => `<option ${v === 48 ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="field">Hours per month<input id="fhrs" type="number" min="50" max="600" step="10" value="200"/></label></div>
    <div class="quote" id="quote"></div><div class="row"><button id="dlq" class="btn">⬇ Download quote</button></div>
    <p class="muted">Indicative ex-showroom figures, mid-range for the class. GST at 18% (earthmoving machinery). Not an offer.</p>`;
  $$('#tab-cfg [data-p]').forEach((b) => b.addEventListener('click', () => { setPaint(b.dataset.p); $('#pname').textContent = PAINTS.find((p) => p.id === state.paint).name; thumbsDirty = true; }));
  $$('#tab-cfg input[name=tool]').forEach((r) => r.addEventListener('change', () => { cfg.tool = r.value; mach.setTool(r.value); rangeData = computeRange(mach); renderOverview(); renderQuote(); renderFleet(); toast(mach.tools[r.value].name); }));
  $$('#tab-cfg [data-o]').forEach((c) => c.addEventListener('change', () => { if (c.checked) cfg.opts.add(c.dataset.o); else cfg.opts.delete(c.dataset.o); applyOptions(); renderQuote(); }));
  ['#fdown', '#frate', '#ften', '#fhrs'].forEach((s) => $(s).addEventListener('input', renderQuote));
  $('#dlq').onclick = () => { const txt = quoteText(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = `quote-${id}.txt`; a.click(); };
  renderQuote();
}
function quote() {
  const id = state.id, d = MACHINES[id], cfg = state.cfg[id];
  const base = (d.price[0] + d.price[1]) / 2, tool = mach.tools[cfg.tool]?.price || 0;
  const opts = OPTIONS.filter((o) => cfg.opts.has(o.id) && (!o.only || o.only.includes(id)));
  const sub = base + tool + opts.reduce((s, o) => s + o.price, 0), gst = sub * 0.18, total = sub + gst;
  const down = +($('#fdown')?.value || 20) / 100, rate = +($('#frate')?.value || 10.5) / 1200, n = +($('#ften')?.value || 48), P = total * (1 - down);
  const emi = rate > 0 ? (P * rate * (1 + rate) ** n) / ((1 + rate) ** n - 1) : P / n, hrs = +($('#fhrs')?.value || 200);
  return { base, tool, opts, sub, gst, total, down: total * down, emi, n, hrs, perHour: (emi * 1e5) / hrs + d.m.cost * 0.55 };
}
function renderQuote() {
  const r = quote(), d = MACHINES[state.id], cfg = state.cfg[state.id];
  $('#quote').innerHTML = `<table><tr><td>${esc(d.name)} (${esc(d.cls)})</td><td>${fmtL(r.base)}</td></tr>${r.tool ? `<tr><td>${esc(mach.tools[cfg.tool].name)}</td><td>${fmtL(r.tool)}</td></tr>` : ''}${r.opts.map((o) => `<tr><td>${esc(o.name)}</td><td>${fmtL(o.price)}</td></tr>`).join('')}
    <tr><td>Subtotal</td><td>${fmtL(r.sub)}</td></tr><tr><td>GST 18%</td><td>${fmtL(r.gst)}</td></tr><tr class="tot"><td>On-road estimate</td><td>${fmtL(r.total)}</td></tr>
    <tr><td>Down payment</td><td>${fmtL(r.down)}</td></tr><tr><td>EMI × ${r.n} months</td><td>₹${Math.round(r.emi * 1e5).toLocaleString('en-IN')}</td></tr><tr><td>Owning + operating, per hour</td><td>≈₹${Math.round(r.perHour).toLocaleString('en-IN')}</td></tr></table>`;
}
function quoteText() {
  const r = quote(), d = MACHINES[state.id], cfg = state.cfg[state.id], L = (s, v) => `${s.padEnd(52, '.')} ${v}`;
  return [`EARTHMOVERS · indicative quote`, `${d.name} (${d.cls})`, `Livery: ${PAINTS.find((p) => p.id === state.paint).name}`, '', L('Base machine', fmtL(r.base)), r.tool ? L(mach.tools[cfg.tool].name, fmtL(r.tool)) : L(mach.tools[cfg.tool]?.name || 'Standard tool', 'included'), ...r.opts.map((o) => L(o.name, fmtL(o.price))), '', L('Subtotal', fmtL(r.sub)), L('GST 18%', fmtL(r.gst)), L('On-road estimate', fmtL(r.total)), '', L('Down payment', fmtL(r.down)), L(`EMI x ${r.n} months`, `Rs ${Math.round(r.emi * 1e5).toLocaleString('en-IN')}`), '', 'Indicative figures for a typical machine of this class. Not an offer.'].join('\n');
}
const METRICS = [['weight', 'Operating weight', 't', 1], ['power', 'Engine power', 'kW', 0], ['price', 'Indicative price', 'lakh', 0], ['fuel', 'Fuel tank', 'L', 0], ['speed', 'Top speed', 'km/h', 0], ['pw', 'Power-to-weight', 'kW/t', 1]];
let cmpMetric = 'power';
function renderCompare() {
  const val = (id, k) => (k === 'pw' ? MACHINES[id].m.power / MACHINES[id].m.weight : MACHINES[id].m[k]);
  const [key, label, unit, dp] = METRICS.find((m) => m[0] === cmpMetric), max = Math.max(...ORDER.map((id) => val(id, key)));
  const sorted = [...ORDER].sort((a, b) => val(b, key) - val(a, key));
  $('#tab-cmp').innerHTML = `<div class="row">${METRICS.map(([k, l]) => `<button class="btn ${k === cmpMetric ? 'on' : ''}" data-mt="${k}">${l}</button>`).join('')}</div>
    <h4>${label}</h4><div class="bars">${sorted.map((id) => `<div class="b ${id === state.id ? 'cur' : ''}" data-go="${id}"><span>${esc(MACHINES[id].name)}</span><i style="width:${Math.max(2, (val(id, key) / max) * 100)}%"></i><em>${key === 'price' ? fmtL(val(id, key)) : val(id, key).toFixed(dp) + ' ' + unit}</em></div>`).join('')}</div>
    <h4>Side by side</h4><table class="cmp"><tr><th>Machine</th><th>t</th><th>kW</th><th>kW/t</th><th>Price</th></tr>${ORDER.map((id) => { const m = MACHINES[id].m; return `<tr class="${id === state.id ? 'cur' : ''}"><td>${esc(MACHINES[id].name)}</td><td>${m.weight}</td><td>${m.power}</td><td>${(m.power / m.weight).toFixed(1)}</td><td>${fmtL(m.price)}</td></tr>`; }).join('')}</table>
    <p class="muted">Typical class values. The haul truck's weight is its empty weight; loaded it weighs ≈163 t.</p>`;
  $$('#tab-cmp [data-mt]').forEach((b) => b.addEventListener('click', () => { cmpMetric = b.dataset.mt; renderCompare(); }));
  $$('#tab-cmp [data-go]').forEach((b) => b.addEventListener('click', () => loadMachine(b.dataset.go)));
}
// fleet planner
const LOADERS = ['excavator', 'loader', 'backhoe', 'skid'];
function renderFleet() {
  const f = state.fleet ||= { loader: LOADERS.includes(state.id) ? state.id : 'excavator', mat: 'soil', hauler: 'tipper', dist: 2, vol: 20000, hours: 10 };
  $('#tab-fleet').innerHTML = `<p class="muted">Match a loading machine to haulers, and estimate production, fleet size, time and cost for a cut-and-haul job.</p>
    <div class="grid2"><label class="field">Loading machine<select id="fl">${LOADERS.map((id) => `<option value="${id}" ${id === f.loader ? 'selected' : ''}>${esc(MACHINES[id].name)}</option>`).join('')}</select></label>
    <label class="field">Material<select id="fm">${MATERIALS.map((m) => `<option value="${m.id}" ${m.id === f.mat ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
    <label class="field">Hauler<select id="fh">${HAULERS.map((h) => `<option value="${h.id}" ${h.id === f.hauler ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label>
    <label class="field">One-way haul (km)<input id="fd" type="number" min="0.2" max="30" step="0.1" value="${f.dist}"/></label>
    <label class="field">Job volume (bank m³)<input id="fv" type="number" min="100" step="500" value="${f.vol}"/></label>
    <label class="field">Hours per day<input id="fhd" type="number" min="4" max="22" step="1" value="${f.hours}"/></label></div>
    <div id="fout"></div>`;
  const bind = (s, k, num) => $(s).addEventListener('input', (e) => { f[k] = num ? +e.target.value : e.target.value; fleetCalc(); });
  bind('#fl', 'loader'); bind('#fm', 'mat'); bind('#fh', 'hauler'); bind('#fd', 'dist', 1); bind('#fv', 'vol', 1); bind('#fhd', 'hours', 1);
  fleetCalc();
}
function fleetCalc() {
  const f = state.fleet, L = MACHINES[f.loader], mat = MATERIALS.find((m) => m.id === f.mat), H = HAULERS.find((h) => h.id === f.hauler);
  const cap = f.loader === state.id && mach?.tools[state.cfg[state.id].tool]?.cap ? mach.tools[state.cfg[state.id].tool].cap : L.m.cap;
  const cycle = L.cycle * (mat.id === 'rock' ? 1.18 : mat.id === 'clay' ? 1.08 : 1), bucketL = cap * mat.fill, bucketT = bucketL * mat.density;
  const passes = Math.max(1, Math.ceil(Math.min(H.cap / bucketL, H.payload / bucketT) - 0.15)), loadL = Math.min(H.cap, passes * bucketL, H.payload / mat.density);
  const tLoad = passes * cycle, tHaul = (f.dist / (H.speed * 0.8)) * 3600, tRet = (f.dist / H.speed) * 3600, tCycle = H.spot + tLoad + tHaul + H.dump + tRet;
  const trucks = Math.max(1, Math.ceil(tCycle / (tLoad + H.spot))), eff = 50 / 60;
  const loaderProd = (3600 / (tLoad + H.spot)) * loadL, fleetProd = Math.min(loaderProd, trucks * (3600 / tCycle) * loadL) * eff;
  const bankPerH = fleetProd / mat.swell, days = f.vol / (bankPerH * f.hours), costH = L.m.cost + trucks * H.cost, perM3 = costH / bankPerH;
  const fuelH = L.fuelLph + trucks * (H.payload > 50 ? 70 : H.payload > 28 ? 22 : 12);
  const segs = [['Spot', H.spot, '#9aa4b0'], ['Load', tLoad, '#f2b705'], ['Haul', tHaul, '#ef7d14'], ['Dump', H.dump, '#c4241b'], ['Return', tRet, '#3fcf8e']];
  const warn = passes > 12 ? `<p class="muted" style="color:var(--warn)">${passes} passes per load is slow: pick a bigger loading machine or a smaller hauler (3–6 passes is the usual target).</p>` : passes < 2 ? `<p class="muted" style="color:var(--warn)">One pass fills the hauler: the loading machine is oversized for it.</p>` : '';
  $('#fout').innerHTML = `<h4>Results</h4><div class="kpis"><div class="big"><b>${Math.round(bankPerH).toLocaleString('en-IN')} m³/h</b><span>bank volume moved, with a 50-minute working hour</span></div>
    <div><b>${trucks}</b><span>haulers to keep the loader busy</span></div><div><b>${passes}</b><span>passes per load (${(passes * bucketT).toFixed(1)} t)</span></div>
    <div><b>${Math.ceil(days)} days</b><span>for ${f.vol.toLocaleString('en-IN')} m³ at ${f.hours} h/day</span></div><div><b>₹${perM3.toFixed(0)}</b><span>per bank m³ (owning + operating)</span></div>
    <div><b>${Math.round(cycle)} s</b><span>loader cycle</span></div><div><b>${Math.round(fuelH)} L/h</b><span>fleet fuel, ≈${Math.round(fuelH * 2.68)} kg CO₂/h</span></div></div>
    <h4>Hauler cycle, ${Math.round(tCycle / 60)} min ${Math.round(tCycle % 60)} s</h4><div class="timeline">${segs.map(([n, s, c]) => `<div style="flex:${s};background:${c}" title="${n} ${Math.round(s)} s">${s / tCycle > 0.08 ? n : ''}</div>`).join('')}</div>
    <div class="legend">${segs.map(([n, s, c]) => `<span><i style="background:${c}"></i>${n} ${Math.round(s)} s</span>`).join('')}</div>${warn}
    <p class="muted">Bucket ${cap} m³ × fill ${mat.fill} · ${mat.density} t/m³ loose · swell ${mat.swell}. Hauler speeds ${Math.round(H.speed * 0.8)} km/h loaded, ${H.speed} km/h empty. Rule-of-thumb estimates for planning only.</p>`;
}

// ── modes ──
function setMode(mode) {
  state.mode = mode; $$('#modes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  stage.visible = mode === 'show'; sand.visible = mode === 'sand'; siteHolder.visible = mode === 'site';
  $('.view').classList.toggle('dark', mode !== 'show');
  $('#sitebar').classList.toggle('show', mode === 'site'); $('#tipcard').classList.remove('show');
  $('#title').style.display = mode === 'site' ? 'none' : '';
  scene.background = new THREE.Color(mode === 'show' ? '#dfe3e7' : '#a9c4dd');
  scene.fog = mode === 'show' ? new THREE.Fog('#dfe3e7', 40, 140) : mode === 'sand' ? new THREE.Fog('#a9c4dd', 50, 160) : new THREE.Fog('#a9c4dd', 140, 420);
  labels.querySelectorAll('.mlabel').forEach((e) => e.remove());
  if (mode === 'site') {
    if (!site) { site = buildSite(); siteHolder.add(site.group); for (const a of site.actors) { const el = document.createElement('div'); el.className = 'mlabel'; el.innerHTML = `${esc(a.name)}<em></em>`; el.onclick = () => follow(a); a.el = el; } }
    for (const a of site.actors) labels.appendChild(a.el);
    shadowBox(80); sun.shadow.mapSize.set(4096, 4096); sun.shadow.map?.dispose(); sun.shadow.map = null;
    buildHotspots(); clearDims(); setCam('iso', true); renderSiteBar();
    $('#hint').textContent = 'Click a machine label to follow it · drag to orbit';
  } else {
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.map?.dispose(); sun.shadow.map = null;
    if (mode === 'sand') { shadowBox(30); placeInSandbox(); $('#hint').textContent = 'Keys move the joints (see Operate) · arrows drive · drag to orbit'; }
    else { shadowBox(14); mach.root.position.set(-mach.center.x, 0, -mach.center.z); mach.root.rotation.y = 0; holder.add(mach.root); if (truckS) truckS.root.visible = false; $('#hint').textContent = 'Drag to orbit · wheel to zoom · right-drag to pan'; }
    buildHotspots(); buildDims(); setCam('iso', true);
  }
  renderOperate(); if (mode === 'sand') { $$('.tabs button').find((b) => b.dataset.tab === 'op')?.click(); }
}
function placeInSandbox() {
  sandHolder.add(mach.root); mach.root.position.set(0, terrain.height(0, 0), 0); mach.root.rotation.y = 0; state.drive.v = 0;
  if (!truckS) { truckS = BUILDERS.truck(); truckS.root.scale.setScalar(TRUCK_SCALE); sandHolder.add(truckS.root); }
  truckS.root.visible = ['excavator', 'loader', 'backhoe', 'skid'].includes(state.id);
  const d = state.id === 'excavator' ? 6.6 : state.id === 'loader' ? 7.5 : 6;
  truckS.root.position.set(state.id === 'backhoe' ? -6 : state.id === 'excavator' ? 0.3 : 3, 0, -d); truckS.root.rotation.y = 0; truckS.update(0);
}
function follow(a) { state.follow = a; toast(`Following: ${a.name}`); }
function renderSiteBar() {
  if (!site) return; const s = site.stats, t = site.t || 0, hh = Math.floor(7 + t / 3600), mm = Math.floor((t % 3600) / 60);
  $('#sitebar').innerHTML = `<div class="seg"><button data-sp="1" class="${state.speed === 1 ? 'active' : ''}">1×</button><button data-sp="4" class="${state.speed === 4 ? 'active' : ''}">4×</button><button data-sp="12" class="${state.speed === 12 ? 'active' : ''}">12×</button><button data-sp="0" class="${state.speed === 0 ? 'active' : ''}">❚❚</button></div>
    <div class="stat">Shift clock <b>${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</b></div><div class="stat">Truck loads <b>${s.loads}</b></div><div class="stat">Hauled <b>${s.tonnes.toLocaleString('en-IN')} t</b></div>
    <div class="stat">Crusher feed <b>${Math.round(s.hopper)} t</b></div><div class="stat">Pallets lifted <b>${s.pallets}</b></div><div class="stat">Trench dug <b>${s.trench.toFixed(1)} m</b></div><div class="stat">Fleet fuel <b>${Math.round(s.fuel)} L</b></div>
    ${state.follow ? `<button class="btn" id="unfollow">✕ Stop following ${esc(state.follow.name)}</button>` : ''}`;
  $$('#sitebar [data-sp]').forEach((b) => b.addEventListener('click', () => { state.speed = +b.dataset.sp; renderSiteBar(); }));
  $('#unfollow')?.addEventListener('click', () => { state.follow = null; setCam('iso'); });
}

// ── sandbox physics: digging, dumping, driving ──
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion();
const DENS = 1.6;   // t per loose m³
function sandStep(dt) {
  const m = mach, r = m.root, d = state.drive, k = state.keys;
  // driving
  const acc = k.has('arrowup') ? 1 : k.has('arrowdown') ? -1 : 0, st = k.has('arrowleft') ? 1 : k.has('arrowright') ? -1 : 0;
  if (k.has(' ')) d.v = 0;
  d.v += (acc * m.drive.maxSpeed - d.v) * Math.min(1, dt * (acc ? 0.9 : 2.5));
  let yaw = 0;
  if (m.drive.kind === 'tracks') yaw = st * m.drive.turn * dt * (Math.abs(d.v) > 0.2 ? Math.sign(d.v) : 1);
  else { if (m.drive.kind === 'artic') m.set('steer', m.get('steer') + st * 40 * dt); else d.steer = THREE.MathUtils.clamp(d.steer + st * dt * 1.2, -0.6, 0.6); if (!st && m.drive.kind !== 'artic') d.steer *= 1 - Math.min(1, dt * 2); const sa = m.drive.kind === 'artic' ? m.get('steer') * D2R * 0.5 : d.steer; yaw = (d.v * Math.tan(sa) / (m.drive.wheelbase || 3)) * dt; for (const s of m.steerWheels) s.rotation.y = d.steer; }
  r.rotation.y += yaw;
  const fwd = _v.set(1, 0, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, r.rotation.y), ds = d.v * dt;
  const lim = terrain.size / 2 - 5; r.position.x = THREE.MathUtils.clamp(r.position.x + fwd.x * ds, -lim, lim); r.position.z = THREE.MathUtils.clamp(r.position.z + fwd.z * ds, -lim, lim);
  r.position.y += (terrain.height(r.position.x, r.position.z) - r.position.y) * Math.min(1, dt * 8);
  if (Math.abs(ds) > 1e-5 || yaw) m.roll(ds, m.drive.kind === 'tracks' ? -yaw * 4 / Math.max(0.05, Math.abs(ds) + 0.05) * 0 : 0);
  if (m.drive.kind === 'tracks' && yaw && Math.abs(ds) < 1e-4) for (const t of m.tracks) t.userData.advance(yaw * 1.2 * (t.userData.side || 1));
  // tools
  const tool = m.tool?.userData; if (!tool) return; m.root.updateWorldMatrix(true, true);
  if (tool.kind === 'bucket') {
    const tip = tool.tip.getWorldPosition(new THREE.Vector3()), g = terrain.height(tip.x, tip.z), cap = m.tools[m.toolId].cap || 0.5;
    if (tip.y < g - 0.02 && m.load < cap) { const vol = terrain.cut(tip.x, tip.z, Math.max(0.35, tool.w * 0.42), tip.y); m.load = Math.min(cap * 1.15, m.load + vol * 0.9); }
    tool.soil.parent.getWorldQuaternion(_q); _n.copy(tool.mouthN).applyQuaternion(_q);
    if (_n.y < -0.25 && m.load > 0) {
      const rel = Math.min(m.load, cap * 3 * dt); m.load -= rel;
      const mouth = tool.soil.getWorldPosition(new THREE.Vector3());
      if (truckS?.root.visible && inTruck(mouth)) { truckS.setLoad(truckS.load + rel / TRUCK_M3); state.truckT = (state.truckT || 0) + rel * DENS; }
      else terrain.add(mouth.x, mouth.z, rel, Math.max(0.7, tool.w * 0.6));
    }
    tool.soil.visible = m.load > 0.01; tool.soil.scale.y = Math.max(0.01, Math.min(1, m.load / cap)) * (tool.w > 1.5 ? 0.5 : 0.35);
  } else if (tool.kind === 'blade') {
    // sample points along the blade's cutting edge
    const w = m.id === 'dozer' ? 3.4 : 3.7, edge = tool.tip; let cutTot = 0; const pts = [];
    for (let i = 0; i <= 8; i++) { const p = new THREE.Vector3(edge.position.x, edge.position.y, -w / 2 + (w * i) / 8); edge.parent.localToWorld(p); pts.push(p); const g = terrain.height(p.x, p.z), y = Math.max(p.y, r.position.y - 0.3); if (y < g - 0.02) cutTot += terrain.cut(p.x, p.z, 0.32, y); }
    if (cutTot > 0) {
      if (m.id === 'dozer') { const c = pts[4], ahead = fwd.clone().multiplyScalar(1.1 + Math.abs(d.v) * 0.2); terrain.add(c.x + ahead.x, c.z + ahead.z, cutTot, 1.7); }
      else { const lr = m.root.worldToLocal(pts[0].clone()).x < m.root.worldToLocal(pts[8].clone()).x ? pts[0] : pts[8]; terrain.add(lr.x, lr.z, cutTot, 0.8); }
      m.load = cutTot;
    }
  } else if (tool.kind === 'auger') { const tip = tool.tip.getWorldPosition(new THREE.Vector3()); tool.spin.rotation.y += dt * 8; if (tip.y < terrain.height(tip.x, tip.z)) terrain.cut(tip.x, tip.z, 0.28, tip.y); }
  else if (tool.kind === 'sweeper') tool.spin.rotation.z += dt * 10;
  terrain.sync();
}
function inTruck(p) { truckS.root.updateWorldMatrix(true, true); const l = truckS.root.worldToLocal(p.clone()); return l.x > -4.4 && l.x < 3.4 && Math.abs(l.z) < 3.0 && l.y > 2.0 && l.y < 12; }
function sandHud() {
  const m = mach, cap = m.tools[m.toolId]?.cap; const bits = [];
  if (m.tool?.userData.kind === 'bucket') bits.push(`<span>Bucket <b>${(m.load || 0).toFixed(2)} / ${cap} m³</b></span>`);
  if (truckS?.root.visible) bits.push(`<span>Dump truck <b>${(truckS.load * TRUCK_M3 * DENS).toFixed(1)} t</b> of ${Math.round(TRUCK_M3 * DENS)} t</span>`);
  bits.push(`<span>Dug <b>${terrain.moved.toFixed(1)} m³</b></span>`, `<span>Speed <b>${(Math.abs(state.drive.v) * 3.6).toFixed(1)} km/h</b></span>`);
  $('#hud').innerHTML = bits.join('') + `<span style="pointer-events:auto"><button class="btn" id="resetsand" style="padding:1px 8px">↺ Reset ground</button></span>`;
  $('#resetsand').onclick = () => { terrain.reset(); truckS?.setLoad(0); state.truckT = 0; };
}

// ── engine sound ──
const sound = (() => {
  let ac = null, osc, osc2, gain, filt, lvl = 0;
  return {
    on() { if (ac) return; ac = new AudioContext(); osc = ac.createOscillator(); osc.type = 'sawtooth'; osc2 = ac.createOscillator(); osc2.type = 'square'; filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 380; gain = ac.createGain(); gain.gain.value = 0; osc.connect(filt); osc2.connect(filt); filt.connect(gain).connect(ac.destination); osc.start(); osc2.start(); },
    off() { if (!ac) return; ac.close(); ac = null; },
    set(activity) { if (!ac) return; lvl += (Math.min(1, activity) - lvl) * 0.08; const f = 34 + lvl * 46; osc.frequency.setTargetAtTime(f, ac.currentTime, 0.05); osc2.frequency.setTargetAtTime(f * 0.5, ac.currentTime, 0.05); filt.frequency.setTargetAtTime(300 + lvl * 700, ac.currentTime, 0.1); gain.gain.setTargetAtTime(0.05 + lvl * 0.07, ac.currentTime, 0.1); },
    reset() { lvl = 0; },
  };
})();

// ── UI wiring ──
$$('#modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
$$('#cams button').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));
$$('#toggles button').forEach((b) => b.addEventListener('click', () => {
  const t = b.dataset.t; state[t] = !state[t]; b.classList.toggle('active', state[t]);
  if (t === 'hot') labels.classList.toggle('nohs', !state.hot);
  if (t === 'dims') buildDims();
  if (t === 'snd') state.snd ? sound.on() : sound.off();
}));
$$('.tabs button').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; $$('.tabs button').forEach((x) => x.classList.toggle('active', x === b)); $$('.tab').forEach((t) => t.classList.toggle('show', t.id === `tab-${state.tab}`)); if (state.tab === 'fleet') renderFleet(); }));
const JOINT_RATE = { '°': 32, m: 0.6, '': 0.7 };
addEventListener('keydown', (e) => { if (e.target.closest('input, select, textarea')) return; const k = e.key.toLowerCase(); state.keys.add(k); if (k.startsWith('arrow') || k === ' ') e.preventDefault(); });
addEventListener('keyup', (e) => state.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => state.keys.clear());
function keyJoints(dt) {
  if (!mach || state.mode === 'site') return 0; let act = 0;
  opJoints().forEach((name, i) => { const kk = keyFor(name, i); if (!kk) return; const dir = (state.keys.has(kk[0]) ? 1 : 0) - (state.keys.has(kk[1]) ? 1 : 0); if (dir) { const j = mach.joints[name]; mach.set(name, j.value + dir * JOINT_RATE[j.unit] * dt); state.demo = false; act += 1; } });
  return act;
}

// cards and thumbnails
function renderCards() {
  $('#cards').innerHTML = ORDER.map((id) => `<button class="card" data-id="${id}"><span class="ph" id="th-${id}"></span><span><b>${esc(MACHINES[id].name)}</b><small>${esc(MACHINES[id].cls)}</small></span></button>`).join('');
  $$('.card').forEach((c) => c.addEventListener('click', () => { if (state.mode === 'site') setMode('show'); loadMachine(c.dataset.id); }));
}
let thumbsDirty = false;
async function makeThumbs() {
  const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); tr.setSize(192, 124); tr.setPixelRatio(1); tr.toneMapping = THREE.NeutralToneMapping;
  const ts = new THREE.Scene(); ts.environment = scene.environment; ts.environmentIntensity = 0.7; const l = new THREE.DirectionalLight('#fff', 1.6); l.position.set(5, 8, 6); ts.add(l, new THREE.HemisphereLight('#fff', '#888', 0.6));
  const tc = new THREE.PerspectiveCamera(30, 192 / 124, 0.1, 200);
  for (const id of ORDER) {
    await new Promise((r) => setTimeout(r, 30));
    const m = BUILDERS[id](); const root = m.root;
    ts.add(root); const b = frameBox(root), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    tc.position.set(c.x + s * 0.62, c.y + s * 0.32, c.z + s * 0.78); tc.lookAt(c); tr.render(ts, tc); ts.remove(root);
    const el = document.getElementById(`th-${id}`); if (el) { const img = new Image(); img.src = tr.domElement.toDataURL(); img.alt = ''; el.replaceWith(img); img.id = `th-${id}`; }
  }
  tr.dispose();
}

// ── frame loop ──
function resize() { const v = $('.view'), w = v.clientWidth, h = v.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe($('.view'));
const clock = new THREE.Clock(); let dimT = 0, uiT = 0, siteT = 0;
const _p = new THREE.Vector3();
function project(p, el) { _p.copy(p).project(camera); const v = $('.view'); if (_p.z > 1 || _p.z < -1) { el.style.display = 'none'; return; } el.style.display = ''; el.style.left = `${(_p.x * 0.5 + 0.5) * v.clientWidth}px`; el.style.top = `${(-_p.y * 0.5 + 0.5) * v.clientHeight}px`; }
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  if (camAnim) { camAnim.u = Math.min(1, camAnim.u + dt * 1.6); const e = camAnim.u * camAnim.u * (3 - 2 * camAnim.u); camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (camAnim.u >= 1) camAnim = null; }
  let activity = 0;
  if (state.mode === 'site' && site) {
    if (!site.t) site.t = 0; const sdt = dt * state.speed; site.t += sdt; site.update(site.t, sdt);
    for (const a of site.actors) { const b = a.m.root; _v.set(b.position.x, (a.m.top ||= frameBox(b).max.y - b.position.y) + 0.8, b.position.z); project(_v, a.el); a.el.querySelector('em').textContent = a.status; }
    if (state.follow) { const r = state.follow.m.root, fwd = new THREE.Vector3(1, 0, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, r.rotation.y), sz = state.follow.m.top || 4; const want = r.position.clone().addScaledVector(fwd, -sz * 3.2).add(new THREE.Vector3(sz * 1.2, sz * 1.6, sz * 1.6)); camera.position.lerp(want, Math.min(1, dt * 2)); controls.target.lerp(r.position.clone().add(new THREE.Vector3(0, sz * 0.4, 0)), Math.min(1, dt * 4)); }
    siteT += dt; if (siteT > 0.5) { siteT = 0; renderSiteBar(); }
    activity = 0.6;
  } else if (mach) {
    activity += keyJoints(dt) * 0.4;
    if (state.demo) { state.demoT += dt; mach.playDemo(state.demoT); activity += 0.6; }
    if (state.mode === 'sand') { sandStep(dt); activity += Math.abs(state.drive.v) / mach.drive.maxSpeed; uiT += dt; if (uiT > 0.2) { uiT = 0; sandHud(); } }
    else $('#hud').innerHTML = '';
    mach.update(dt); truckS?.update(dt);
    if (state.spin && state.mode === 'show') turn.rotation.y += dt * 0.25;
    for (const b of mach.beacons) b.userData.beacon.material.emissiveIntensity = 0.4 + 0.8 * Math.max(0, Math.sin(clock.elapsedTime * 7));
    for (const [h, el] of hsEls) { el.style.visibility = state.hot ? 'visible' : 'hidden'; h.obj.getWorldPosition(_v); project(_v, el); }
    for (const el of dimEls) { _v.copy(el._p); el._o.localToWorld(_v); project(_v, el); }
    if (state.dims && (state.demo || state.keys.size)) { dimT += dt; if (dimT > 0.6) { dimT = 0; buildDims(); } }
    syncOperate();
  }
  if (state.snd) sound.set(activity);
  controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop);
}

// ── boot ──
renderCards(); setPaint(state.paint); shadowBox(14); scene.background = new THREE.Color('#dfe3e7'); scene.fog = new THREE.Fog('#dfe3e7', 40, 140);
resize(); loadMachine(state.id);
if (q.get('tool') && mach.tools[q.get('tool')]) { state.cfg[state.id].tool = q.get('tool'); mach.setTool(q.get('tool')); rangeData = computeRange(mach); renderTabs(); }
if (q.get('mode') && ['show', 'sand', 'site'].includes(q.get('mode'))) setMode(q.get('mode'));
if (q.get('tab')) $$('.tabs button').find((b) => b.dataset.tab === q.get('tab'))?.click();
if (q.get('cam')) setCam(q.get('cam'), true);
if (q.get('demo')) { state.demo = true; state.demoT = +q.get('demo') || 0; }
if (q.get('dims')) $('[data-t="dims"]').click();
loop();
setTimeout(() => $('#loader').classList.add('done'), 300);
setTimeout(makeThumbs, 600);
window.__hm = { state, get mach() { return mach; }, get site() { return site; }, terrain, get truck() { return truckS; }, loadMachine, setMode, setCam, setPaint, camera, controls, sandStep, computeRange };   // handle for automated browser tests
