/**
 * PQC Road Works: timeline, cameras, HUD, labels and the side panels.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildRoad, T0, T_END, stageAt, JOINTS } from './road.js';
import { STAGES, ROAD, DOWELS, TIEBAR, REFS } from './data.js';
import { crossSection, transverseJoint, longitudinalJoint, panelPlan, dowelFor } from './diagrams.js';

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const q = new URLSearchParams(location.hash.slice(1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const L = ROAD.L;

// ── scene ──
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#b9d3ea'); scene.fog = new THREE.Fog('#b9d3ea', 120, 420);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1500);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49; controls.target.set(0, 0, 0);
const sun = new THREE.DirectionalLight('#fff6e6', 1.7); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
const sc = sun.shadow.camera; sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.near = 1; sc.far = 260;
scene.add(sun, sun.target, new THREE.HemisphereLight('#eef4ff', '#7a7258', 0.6));
const road = buildRoad(); scene.add(road.group);

// ── state ──
const state = { T: q.get('t') ? +q.get('t') : 0, playing: !q.get('t'), speed: 1, view: 'follow', labels: true, slab: 300, logSeen: 0 };
if (q.get('stage') && T0[q.get('stage')] !== undefined) { state.T = T0[q.get('stage')] + (+q.get('p') || 0) * STAGES.find((s) => s.id === q.get('stage')).dur; state.playing = false; }

// ── site clock: hours since Day 1 00:00 for each stage ──
const CLOCK = { sub: [7, 3 * 24 + 18], gsb: [4 * 24 + 7, 6 * 24 + 18], dlc: [7 * 24 + 7, 14 * 24 + 17], mem: [15 * 24 + 7, 15 * 24 + 12], str: [15 * 24 + 12, 15 * 24 + 18], pav: [16 * 24 + 6, 16 * 24 + 9.5], saw: [16 * 24 + 10.25, 17 * 24 + 6], cur: [17 * 24 + 6, 30 * 24 + 18], seal: [31 * 24 + 8, 32 * 24 + 17], open: [33 * 24 + 8, 44 * 24 + 12] };
const placedAt = (x) => 16 * 24 + 6 + x / 60;   // slip-form at ≈1 m/min from 06:00 on Day 17
function clockAt(T) { const s = stageAt(T), p = clamp((T - T0[s.id]) / s.dur, 0, 1), [a, b] = CLOCK[s.id]; return lerp(a, b, p); }
const fmtClock = (h) => { const d = Math.floor(h / 24) + 1, hh = Math.floor(h % 24), mm = Math.floor((h * 60) % 60); return [`Day ${d}`, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`]; };
const ch = (x) => `Ch 0+${String(Math.round(clamp(x, 0, L))).padStart(3, '0')}`;

// ── QC log, generated from the work as it passes ──
const LOG = [];
{
  const rnd = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };
  const at = (id, p) => T0[id] + p * STAGES.find((s) => s.id === id).dur;
  [20, 60, 100, 140, 172].forEach((x, i) => LOG.push([at('sub', (x + 36) / (L + 38)), `${ch(x)} · Subgrade field density ${(97.3 + rnd(i) * 1.6).toFixed(1)}% of MDD (≥97%)`]));
  [25, 75, 125, 168].forEach((x, i) => LOG.push([at('gsb', (x + 36) / (L + 38)), `${ch(x)} · GSB field density ${(98.2 + rnd(i + 9) * 1.3).toFixed(1)}% of MDD (≥98%)`]));
  [30, 90, 150].forEach((x, i) => LOG.push([at('dlc', (x + 4) / (L + 6)), `${ch(x)} · DLC cubes cast; density ${(98.3 + rnd(i + 3)).toFixed(1)}% of trial`]));
  LOG.push([at('dlc', 1), 'DLC 7-day compressive strength: mean 11.8 MPa, lowest 9.6 MPa (≥10 / ≥7.5 MPa)']);
  LOG.push([at('mem', 1), 'Separation membrane: 125 µm polythene, laps ≥300 mm, no tears']);
  LOG.push([at('str', 1), 'Stringline levels checked against design at every stake']);
  for (let x = 15, i = 0; x < L; x += 30, i++) LOG.push([at('pav', x / (L + 30)), `${ch(x)} · Slump ${22 + Math.round(rnd(i + 20) * 8)} mm, concrete ${(26 + rnd(i + 30) * 3.4).toFixed(1)} °C (≤30 °C)`]);
  for (let x = 45, n = 1; x < L; x += 60, n++) LOG.push([at('pav', (x + 2) / (L + 30)), `${ch(x)} · Beam and cube set ${n} cast for 7- and 28-day tests`]);
  LOG.push([at('pav', 0.45), 'Edge slump behind the paver 3 mm; dowel alignment checked by MIT scan']);
  JOINTS.forEach((x, i) => { if (i % 6 === 0 || i === JOINTS.length - 1) { const p = (i + 0.999) / JOINTS.length, h = lerp(...CLOCK.saw, p) - placedAt(x); LOG.push([at('saw', p), `Joint ${ch(x)} sawn ${h.toFixed(1)} h after placing (4–24 h); depth ${Math.round(state.slab / 4)}–${Math.round(state.slab / 3)} mm`]); } });
  LOG.push([at('cur', 0.05), 'Hessian laid and wetted; slab closed to traffic']);
  LOG.push([at('cur', 0.5), 'Curing log: day 7, hessian wet at every inspection']);
  LOG.push([at('cur', 1), '14 days of wet curing complete']);
  LOG.push([at('seal', 1), 'All joints sealed: groove 10 × 25 mm, sealant recessed ≈4 mm']);
  LOG.push([at('open', 0.62), 'Surface regularity: maximum gap 2 mm under the 3 m straightedge (≤3 mm)']);
  LOG.push([at('open', 0.7), 'Cores: thickness 301–307 mm (design 300 mm)']);
  LOG.push([at('open', 0.74), '28-day flexural strength 4.9 MPa (≥4.5 MPa)']);
  LOG.push([at('open', 0.8), 'Opened to traffic on Day 45, 28 days after paving']);
  LOG.sort((a, b) => a[0] - b[0]);
}

// ── left: stage list; bottom: timeline ──
$('#stages').innerHTML = STAGES.map((s) => `<li data-s="${s.id}"><span><b>${esc(s.name)}</b><small>${esc(s.day)}</small><div class="bar"><i></i></div></span></li>`).join('');
$$('#stages li').forEach((li) => li.addEventListener('click', () => seek(T0[li.dataset.s] + 0.01, true)));
$('#segs').innerHTML = STAGES.map((s) => `<div style="flex:${s.dur}" data-s="${s.id}">${esc(s.name.split(' ')[0])}</div>`).join('');
function seek(T, play) { state.T = clamp(T, 0, T_END); if (play !== undefined) state.playing = play; first = true; renderStage(true); }
{ const tr = $('#track'); let drag = false; const go = (e) => { const r = tr.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * T_END); };
  tr.addEventListener('pointerdown', (e) => { drag = true; tr.setPointerCapture(e.pointerId); go(e); }); tr.addEventListener('pointermove', (e) => drag && go(e)); tr.addEventListener('pointerup', () => { drag = false; }); }
$('#play').onclick = () => { if (state.T >= T_END) state.T = 0; state.playing = !state.playing; };
$$('#speeds button').forEach((b) => b.addEventListener('click', () => { state.speed = +b.dataset.s; $$('#speeds button').forEach((x) => x.classList.toggle('active', x === b)); }));
$$('#views button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.v)));
$$('#toggles button').forEach((b) => b.addEventListener('click', () => { const t = b.dataset.t; if (t === 'xray') road.state.xray = !road.state.xray; else state.labels = !state.labels; b.classList.toggle('active', t === 'xray' ? road.state.xray : state.labels); }));
$$('.tabs button').forEach((b) => b.addEventListener('click', () => { $$('.tabs button').forEach((x) => x.classList.toggle('active', x === b)); $$('.tab').forEach((t) => t.classList.toggle('show', t.id === `tab-${b.dataset.tab}`)); }));

// ── cameras ──
let camAnim = null;
function setView(v) {
  state.view = v; $$('#views button').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  if (v === 'overview') flyTo(new THREE.Vector3(L / 2 - 75, 62, 105), new THREE.Vector3(L / 2 + 5, -1, 0));
  else if (v === 'section') { flyTo(new THREE.Vector3(-8.5, 0.9, 6.5), new THREE.Vector3(0, -0.75, 2.2)); sun.position.set(-40, 45, 35); sun.target.position.set(0, 0, 0); }
}
function flyTo(p, t) { camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: p, t1: t, u: 0 }; }
controls.addEventListener('start', () => { if (state.view === 'follow' || state.view === 'close') { state.view = 'free'; $$('#views button').forEach((b) => b.classList.remove('active')); } });
const FOLLOW = { sub: [-16, 10, 18], gsb: [-16, 10, 18], dlc: [-14, 9, 15], mem: [-10, 7, 12], str: [-10, 6, 13], pav: [-12, 15, 27], saw: [-6, 5, 9], cur: [-12, 8, 16], seal: [-5, 4, 7], open: [-26, 11, 20] };
const CLOSE = { sub: [-6, 4, 7], gsb: [-6, 4, 7], dlc: [-6, 4, 6], mem: [-4, 3, 5], str: [-4, 3, 5], pav: [-11, 5.5, 9], saw: [-3, 2.4, 4], cur: [-5, 4, 6], seal: [-2.2, 1.6, 2.6], open: [-12, 6, 12] };
function followCam(dt, instant) {
  const s = road.stats, st = s.st, f = s.front ?? 0;
  const off = (state.view === 'close' ? CLOSE : FOLLOW)[st];
  let tx = clamp(f, -5, L + 10) + (st === 'pav' ? -13 : st === 'open' ? 0 : -3);
  if (st === 'pav' && state.view === 'close') tx = s.xpav - 4;
  if (st === 'open') tx = road.stats.qcAt ?? 70;
  const target = new THREE.Vector3(tx, st === 'open' ? -1 : -0.3, 0), pos = target.clone().add(new THREE.Vector3(...off));
  const k = instant ? 1 : Math.min(1, dt * 2.2);
  camera.position.lerp(pos, k); controls.target.lerp(target, k);
  sun.position.set(tx + 30, 60, 40); sun.target.position.set(tx, 0, 0);
}

// ── HUD ──
function hud() {
  const s = road.stats, st = STAGES.find((x) => x.id === s.st), [d, t] = fmtClock(clockAt(state.T));
  const kv = [];
  if (s.st === 'pav') {
    kv.push(['Slab', `${s.paved.toFixed(0)} m`], ['Concrete', `${s.conc.toFixed(0)} m³`], ['Dumper loads', `${Math.round(s.conc / 6)}`], ['Dowels', `${s.dowels}`], ['Tie bars', `${s.ties}`], ['Paving', '≈1.0 m/min']);
  } else if (s.st === 'saw') {
    const i = Math.min(s.sawn, JOINTS.length - 1), age = clockAt(state.T) - placedAt(JOINTS[i]);
    kv.push(['Joints sawn', `${s.sawn} / ${JOINTS.length}`], ['Age at cut', `${age.toFixed(1)} h`, age >= 4 && age <= 24 ? 'ok' : 'warn'], ['Window', '4–24 h'], ['Depth', `${Math.round(state.slab / 4)}–${Math.round(state.slab / 3)} mm`]);
  } else if (s.st === 'seal') kv.push(['Joints sealed', `${s.sealed} / ${JOINTS.length}`]);
  else if (s.st === 'cur') kv.push(['Curing', `day ${Math.max(1, Math.floor(clockAt(state.T) / 24) - 15)} of 14+`]);
  else if (s.st === 'open') kv.push(['Concrete age', `${Math.floor((clockAt(state.T) - placedAt(90)) / 24)} days`]);
  if (s.front !== undefined && s.st !== 'open') kv.unshift(['Front', ch(s.front)]);
  $('#hud').innerHTML = `<div class="card"><div class="day"><b>${d}</b><span>${t}</span></div><h2>${STAGES.indexOf(st) + 1}. ${esc(st.name)}</h2></div><div class="kv">${kv.map(([k, v, c]) => `<span class="${c || ''}">${k} <b>${v}</b></span>`).join('')}</div>`;
}

// ── labels ──
const labelsEl = $('#labels'); const lblEls = new Map();
const LAYERS = [['PQC M40', '300 mm', -0.15], ['DLC', '150 mm', -0.375], ['GSB', '150 mm', -0.525], ['Subgrade', '500 mm', -0.85]];
const layerEls = LAYERS.map(([n, t]) => { const e = document.createElement('div'); e.className = 'lbl layer'; e.innerHTML = `<b>${n}</b> · ${t}`; labelsEl.appendChild(e); return e; });
const _v = new THREE.Vector3(), _b = new THREE.Box3();
function project(p, el) { _v.copy(p).project(camera); const v = $('.view'); if (_v.z > 1) { el.style.display = 'none'; return; } el.style.display = ''; el.style.left = `${(_v.x * 0.5 + 0.5) * v.clientWidth}px`; el.style.top = `${(-_v.y * 0.5 + 0.5) * v.clientHeight}px`; }
function labels() {
  for (const a of road.labels) {
    let el = lblEls.get(a); const r = a.rig.root;
    if (!el) { el = document.createElement('div'); el.className = 'lbl'; el.textContent = a.name; labelsEl.appendChild(el); lblEls.set(a, el); }
    const vis = state.labels && r.visible && (!a.fixed || state.view === 'overview');
    if (!vis) { el.style.display = 'none'; continue; }
    if (!a.h) { _b.setFromObject(r); a.h = _b.max.y - r.position.y; }
    r.getWorldPosition(_v); _v.y += a.h + 0.6; project(_v, el);
  }
  const showLayers = state.labels && (state.view === 'section' || state.view === 'free' && camera.position.x < 0);
  LAYERS.forEach(([, , y], i) => { const el = layerEls[i]; const built = [road.stats.paved > 0, state.T > T0.dlc + 2, state.T > T0.gsb + 2, state.T > T0.sub + 3][i]; if (!showLayers || !built) { el.style.display = 'none'; return; } project(new THREE.Vector3(0, y, 0.6), el); });
}

// ── right panels ──
let lastStage = null;
function renderStage(force) {
  const s = stageAt(state.T);
  if (!force && s === lastStage) return; lastStage = s;
  $('#tab-stage').innerHTML = `<div class="muted">Stage ${STAGES.indexOf(s) + 1} of ${STAGES.length} · ${esc(s.day)}</div><h3>${esc(s.name)}</h3><p class="lead">${esc(s.what)}</p>
    <h4>Requirements</h4><table class="req">${s.req.map(([k, v, r]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td><td><span class="ref">${esc(r)}</span></td></tr>`).join('')}</table>
    <h4>Plant and crew</h4><div class="chips">${s.machines.map((m) => `<span>${esc(m)}</span>`).join('')}</div>
    <h4>Quality checks</h4><ul class="checks">${s.qc.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    <p class="muted" style="margin-top:14px">Typical values; the contract specification and the current editions of the codes govern.</p>`;
}
function renderDraw() {
  const t = state.slab, d = dowelFor(t);
  $('#tab-draw').innerHTML = `<div class="grid2"><label class="field">Slab thickness<select id="slab">${DOWELS.map((x) => `<option value="${x.t}" ${x.t === t ? 'selected' : ''}>${x.t} mm</option>`).join('')}</select></label>
    <div class="field">Dowels (IRC:58 guidance)<b style="font-family:var(--mono);padding-top:6px">Ø${d.d} × ${d.L} @ ${d.s}</b></div></div>
    <div class="draw"><h4>Typical cross-section</h4>${crossSection(t)}<h4>Transverse contraction joint</h4>${transverseJoint(t)}<h4>Longitudinal joint</h4>${longitudinalJoint(t)}<h4>Joint layout</h4>${panelPlan(t)}</div>
    <p class="muted">Drawings are schematic. Dowel sizes follow the IRC:58 table as commonly applied; confirm against the current edition and the design.</p>`;
  $('#slab').onchange = (e) => { state.slab = +e.target.value; renderDraw(); renderCalc(); };
}
const calc = { len: 1, width: 7.5, js: 4.5, cement: 400, speed: 1.0, haul: 5, dumper: 6 };
function renderCalc() {
  const c = calc, t = state.slab, d = dowelFor(t);
  $('#tab-calc').innerHTML = `<p class="muted">Quantities and paving logistics for a stretch of JPCP.</p>
    <div class="grid2">
      <label class="field">Slab thickness<select data-k="t">${DOWELS.map((x) => `<option value="${x.t}" ${x.t === t ? 'selected' : ''}>${x.t} mm</option>`).join('')}</select></label>
      <label class="field">Length (km)<input data-k="len" type="number" min="0.1" step="0.1" value="${c.len}"/></label>
      <label class="field">Paved width (m)<select data-k="width">${[7.0, 7.5, 8.75, 10.5].map((w) => `<option ${w === c.width ? 'selected' : ''}>${w}</option>`).join('')}</select></label>
      <label class="field">Joint spacing (m)<select data-k="js">${[4.0, 4.5, 5.0].map((w) => `<option ${w === c.js ? 'selected' : ''}>${w}</option>`).join('')}</select></label>
      <label class="field">Cement (kg/m³)<input data-k="cement" type="number" min="300" max="480" step="10" value="${c.cement}"/></label>
      <label class="field">Paver speed (m/min)<input data-k="speed" type="number" min="0.3" max="3" step="0.1" value="${c.speed}"/></label>
      <label class="field">Plant to paver (km)<input data-k="haul" type="number" min="0.2" max="30" step="0.5" value="${c.haul}"/></label>
      <label class="field">Dumper load (m³)<input data-k="dumper" type="number" min="3" max="12" step="0.5" value="${c.dumper}"/></label>
    </div><div id="cout"></div>`;
  $$('#tab-calc [data-k]').forEach((el) => el.addEventListener('input', () => { const k = el.dataset.k; if (k === 't') { state.slab = +el.value; renderDraw(); } else calc[k] = +el.value; calcOut(); }));
  calcOut();
}
function calcOut() {
  const c = calc, t = state.slab / 1000, d = dowelFor(state.slab), m = c.len * 1000;
  const joints = Math.floor(m / c.js), perJoint = Math.round(c.width / (d.s / 1000)), dowels = joints * perJoint;
  const dSteel = dowels * Math.PI * (d.d / 2000) ** 2 * (d.L / 1000) * 7850 / 1000;
  const lanes = Math.max(1, Math.round(c.width / 3.5)), ties = Math.floor(m / (TIEBAR.s / 1000)) * (lanes - 1), tSteel = ties * Math.PI * (TIEBAR.d / 2000) ** 2 * (TIEBAR.L / 1000) * 7850 / 1000;
  const pqc = m * c.width * t, dlc = m * (c.width + 2) * 0.15, gsb = m * (c.width + 3) * 0.15, cementT = (pqc * c.cement) / 1000;
  const rate = c.speed * 60 * c.width * t, cycle = 4 + ((2 * c.haul) / 25) * 60 + 3, dumpers = Math.ceil(rate / (c.dumper * (60 / cycle)));
  const perDay = c.speed * 60 * 8, days = m / perDay;
  $('#cout').innerHTML = `<h4>Results</h4><div class="kpis">
    <div class="big"><b>${Math.round(pqc).toLocaleString('en-IN')} m³</b><span>PQC (M40) for ${c.len} km × ${c.width} m × ${state.slab} mm</span></div>
    <div><b>${Math.round(dlc).toLocaleString('en-IN')} m³</b><span>DLC, 150 mm, PQC width + 2 m</span></div><div><b>${Math.round(gsb).toLocaleString('en-IN')} m³</b><span>GSB, 150 mm, PQC width + 3 m</span></div>
    <div><b>${joints.toLocaleString('en-IN')}</b><span>contraction joints @ ${c.js} m</span></div><div><b>${dowels.toLocaleString('en-IN')}</b><span>dowels Ø${d.d} × ${d.L} (${perJoint} per joint), ${dSteel.toFixed(1)} t</span></div>
    <div><b>${ties.toLocaleString('en-IN')}</b><span>tie bars Ø${TIEBAR.d} × ${TIEBAR.L}, ${tSteel.toFixed(1)} t</span></div><div><b>${Math.round(cementT).toLocaleString('en-IN')} t</b><span>cement in PQC (${Math.round(cementT * 20).toLocaleString('en-IN')} bags)</span></div>
    <div><b>${rate.toFixed(0)} m³/h</b><span>concrete demand at ${c.speed} m/min</span></div><div><b>${dumpers}</b><span>dumpers of ${c.dumper} m³ (cycle ${Math.round(cycle)} min)</span></div>
    <div><b>${Math.round(perDay)} m/day</b><span>at 8 effective paving hours</span></div><div><b>${Math.ceil(days)} days</b><span>of paving for ${c.len} km</span></div></div>
    <p class="muted">The batching plant must deliver at least the concrete demand rate. A paver that stops and restarts leaves bumps, so plan supply for continuous paving. Rule-of-thumb figures for planning.</p>`;
}
function renderQC() {
  const seen = LOG.filter(([t]) => t <= state.T);
  if (seen.length === state.logSeen && $('#tab-qc').innerHTML) return; state.logSeen = seen.length;
  $('#tab-qc').innerHTML = `<p class="muted">Tests and checks recorded as the work passes. ${seen.length} of ${LOG.length} entries so far.</p><ul class="log">${seen.slice().reverse().map(([t, s]) => { const [d, h] = fmtClock(clockAt(t)); return `<li><em>${d}<br>${h}</em><span>${esc(s)} ✓</span></li>`; }).join('')}</ul>`;
}
$('#tab-ref').innerHTML = `<h4>Codes followed</h4><ul class="reflist">${REFS.map(([a, b]) => `<li><b>${esc(a)}</b>: ${esc(b)}</li>`).join('')}</ul>
  <h4>Sequence (IRC:15)</h4><p class="muted">Prepared subgrade → GSB / drainage layer → DLC sub-base → separation membrane → stringlines → slip-form paving with dowel and tie-bar inserters → texturing → curing compound → saw cutting → wet curing (≥14 days) → joint sealing → checks → opening (≥28 days).</p>
  <h4>About this model</h4><p class="muted">A 180 m, two-lane stretch with a 300 mm M40 slab, contraction joints every 4.5 m (${JOINTS.length} joints), ${Math.round(ROAD.width / ROAD.dowelSpacing)} dowels per joint and tie bars at ${TIEBAR.s} mm along the centre line. Machines are generic. Values are typical of the codes cited; the contract specification and the current editions govern.</p>`;

// ── loop ──
function resize() { const v = $('.view'), w = v.clientWidth, h = v.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe($('.view'));
const clock = new THREE.Clock(); let uiT = 0, first = true;
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  if (state.playing) { state.T += dt * state.speed; if (state.T >= T_END) { state.T = T_END; state.playing = false; } }
  road.update(state.T, dt * (state.playing ? state.speed : 0));
  if (camAnim) { camAnim.u = Math.min(1, camAnim.u + dt * 1.5); const e = camAnim.u * camAnim.u * (3 - 2 * camAnim.u); camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (camAnim.u >= 1) camAnim = null; }
  else if (state.view === 'follow' || state.view === 'close') followCam(dt, first);
  first = false;
  uiT += dt; if (uiT > 0.15) { uiT = 0; hud(); renderStage(); renderQC();
    const cur = stageAt(state.T).id; $$('#stages li').forEach((li) => { const id = li.dataset.s, s = STAGES.find((x) => x.id === id), p = clamp((state.T - T0[id]) / s.dur, 0, 1); li.classList.toggle('cur', id === cur); li.classList.toggle('done', p >= 1 && id !== cur); li.querySelector('i').style.width = `${p * 100}%`; });
    $$('#segs div').forEach((d) => d.classList.toggle('cur', d.dataset.s === cur)); $('#head').style.width = `${(state.T / T_END) * 100}%`; $('#play').textContent = state.playing ? '❚❚' : '▶'; }
  labels();
  controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop);
}
resize(); renderStage(true); renderDraw(); renderCalc(); renderQC();
if (q.get('view')) setView(q.get('view'));
if (q.get('xray')) $('[data-t="xray"]').click();
if (q.get('tab')) $$('.tabs button').find((b) => b.dataset.tab === q.get('tab'))?.click();
loop();
setTimeout(() => $('#loader').classList.add('done'), 300);
window.__pqc = { state, road, seek, setView, camera, controls, T0, T_END };   // handle for automated browser tests
