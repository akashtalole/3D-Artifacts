/**
 * Krishi Yantra: showroom, field work and the wheat crop cycle.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildTractor } from './tractor.js';
import { BUILD, impPaint } from './implements.js';
import { buildFarm, planPasses, buildPath, samplePath, FL, FW } from './field.js';
import { TRACTORS, COLOURS, IMPLEMENTS, ORDER, CYCLE, fmtL } from './data.js';

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const q = new URLSearchParams(location.hash.slice(1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;

// ── scene ──
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#bcd6ec'); scene.fog = new THREE.Fog('#bcd6ec', 90, 320);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1200);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49;
const sun = new THREE.DirectionalLight('#fff3df', 1.75); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
const sc = sun.shadow.camera; sc.left = sc.bottom = -38; sc.right = sc.top = 38; sc.near = 1; sc.far = 220;
scene.add(sun, sun.target, new THREE.HemisphereLight('#eef4ff', '#6f6a48', 0.6));
sun.position.set(FL / 2 + 30, 70, FW / 2 + 40); sun.target.position.set(FL / 2, 0, FW / 2);
const farm = buildFarm(); scene.add(farm.group);

// ── state ──
const state = {
  hp: TRACTORS[q.get('hp')] ? +q.get('hp') : 50, colour: COLOURS.find((c) => c[0] === q.get('colour'))?.[1] || COLOURS[0][1],
  imp: ORDER.includes(q.get('imp')) ? q.get('imp') : 'rotavator', mode: 'show', cam: 'follow',
  hitch: 0.6, pto: false, run: false, mult: 15, playing: true, stage: 0, stageT: 0, job: null,
};
let T = null, I = null, trail = null;   // tractor, implement, trailed-implement kinematics

// ── assembly ──
function assemble() {
  if (T) scene.remove(T.root); if (I && I.root.parent) I.root.parent.remove(I.root);
  T = buildTractor(TRACTORS[state.hp], state.colour); scene.add(T.root);
  I = state.imp ? BUILD[state.imp](T.hitchH0) : null; trail = null;
  if (I) {
    if (I.hitch === 'drawbar') { scene.add(I.root); trail = { h: 0 }; }
    else if (I.hitch === 'stationary') { I.root.position.set(-1.0 * T.s, 0, 0); T.root.add(I.root); I.ptoIn = I.ptoIn.clone().add(I.root.position); }
    T.attach(I);
  }
  T.setHitch(state.hitch);
}
function placeTrailer(dt) {
  if (!trail || !I) return;
  T.root.updateMatrixWorld(true); const p = T.root.localToWorld(T.drawbar.clone()), L = I.len || 3;
  const ax = new THREE.Vector3(Math.cos(trail.h), 0, -Math.sin(trail.h)), a = p.clone().addScaledVector(ax, -L);
  const want = Math.atan2(-(p.z - a.z), p.x - a.x); if (dt === 0) trail.h = T.root.rotation.y; else trail.h = want;
  I.root.position.set(p.x, 0, p.z); I.root.rotation.y = trail.h;
}

// ── showroom ──
const SHOW = new THREE.Vector3(-6, 0, 6);
function showroom() {
  state.job = null; T.root.position.copy(SHOW); T.root.rotation.y = 0.2; T.setHitch(state.hitch);
  if (trail) { trail.h = T.root.rotation.y; placeTrailer(0); }
  farm.laser.visible = state.imp === 'leveller';
}

// ── field jobs ──
const GATE = [-7, 2];
function startJob(id, { dur = null, keepField = false } = {}) {
  const d = IMPLEMENTS[id];
  if (!keepField && state.mode === 'field') { farm.reset(id === 'sprayer' || id === 'reaper' ? 'sown' : 'stubble'); farm.clearCrop(id === 'sprayer' || id === 'reaper' ? 1 : 0, id === 'reaper' ? 1 : id === 'sprayer' ? 0.35 : 0); }
  let path;
  if (id === 'trolley') path = buildPath([{ a: [-4, farm.road], b: [150, farm.road], down: false }], [farm.threshing.x - 2, farm.threshing.z - 1]);
  else if (id === 'thresher') path = null;
  else path = buildPath(planPasses(d.w), GATE, [GATE[0], GATE[1] + 4]);
  const v = path ? (dur ? path.L / dur : (d.v / 3.6) * state.mult) : 0;
  state.job = { id, path, d: 0, v, last: null, worked: 0, t: 0, done: false, dur };
  if (id === 'thresher') { T.root.position.set(farm.threshing.x + 3, 0, farm.threshing.z); T.root.rotation.y = 0; state.pto = true; I.setFill?.(0.3); }
  else { const p = samplePath(path, 0); T.root.position.set(p.x, 0, p.z); T.root.rotation.y = p.h; }
  if (trail) { trail.h = T.root.rotation.y; placeTrailer(0); }
  farm.laser.visible = id === 'leveller';
  if (id === 'trolley') I.setTip?.(0);
}
const _v = new THREE.Vector3();
function stepJob(dt) {
  const j = state.job; if (!j || j.done) return;
  const d = IMPLEMENTS[j.id]; j.t += dt;
  if (j.id === 'thresher') { I.update(dt, 0, { pto: true, working: true }); T.update(dt, 0, 0, true); j.worked += dt; if (j.dur && j.t > j.dur) j.done = true; return; }
  const ds = j.v * dt; j.d = Math.min(j.path.L, j.d + ds);
  const p = samplePath(j.path, j.d), r = T.root, ph = r.rotation.y;
  let dh = p.h - ph; dh = ((dh + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  r.position.set(p.x, 0, p.z); r.rotation.y = p.h;
  const steer = clamp(Math.atan((T.wb * dh) / Math.max(0.01, ds)), -0.6, 0.6);
  const wantH = p.down ? 0 : 0.75; T.setHitch(T.h + (wantH - T.h) * Math.min(1, dt * 3 * Math.max(1, j.v / 6)));
  const working = p.down && T.h < 0.08, pto = j.id === 'rotavator' || j.id === 'sprayer' || j.id === 'reaper';
  T.update(dt, ds, steer, pto); placeTrailer(dt);
  if (j.id === 'leveller') farm.laserHead.rotation.y += dt * 12;
  I.update(dt, ds, { working, pto: pto || working, open: true, h: T.h });
  // the tool's footprint on the field
  r.updateMatrixWorld(true); I.root.updateMatrixWorld(true); I.root.localToWorld(_v.set(I.toolX, 0, 0));
  const tool = { x: _v.x, z: _v.z };
  if (working && j.last) {
    const w = d.w, dx = tool.x - j.last.x, dz = tool.z - j.last.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.001) {
      const along = Math.abs(dx) > Math.abs(dz);
      const rect = along ? [j.last.x, tool.x, tool.z - w / 2, tool.z + w / 2] : [tool.x - w / 2, tool.x + w / 2, j.last.z, tool.z];
      if (d.soil) farm.paint(d.soil, ...rect);
      if (j.id === 'drill') farm.touch(...rect, 1);
      if (j.id === 'reaper') farm.touch(...rect, 2);
      j.worked += Math.hypot(dx, dz);
    }
  }
  j.last = tool;
  if (j.d >= j.path.L) j.done = true;
}
function jobStats() {
  const j = state.job; if (!j) return null; const d = IMPLEMENTS[j.id], tr = TRACTORS[state.hp];
  const lph = 0.22 * tr.kw * d.lf, realH = j.id === 'thresher' ? j.t / 3600 * 60 : (j.d / (d.v / 3.6)) / 3600;
  const area = Math.min(FL * FW, j.worked * d.w) / 1e4;
  return { area, realH, fuel: lph * realH, lph, cap: (d.w * d.v * d.eff) / 10, prog: j.path ? j.d / j.path.L : (j.dur ? j.t / j.dur : 0) };
}

// ── crop cycle ──
const DONE_SOIL = { plough: 'ploughed', harrow: 'harrowed', cultivator: 'cultivated', leveller: 'levelled', drill: 'sown' };
function enterStage(i) {
  state.stage = i; state.stageT = 0; const s = CYCLE[i];
  // rebuild the field as it stands at the start of this stage
  farm.reset('stubble'); let soil = null; for (let k = 0; k < i; k++) if (DONE_SOIL[CYCLE[k].id]) soil = DONE_SOIL[CYCLE[k].id];
  if (soil) farm.paint(soil, 0, FL, 0, FW);
  const after = (id) => CYCLE.findIndex((c) => c.id === id) < i;
  if (after('irrigate')) for (let k = 0; k < 12; k++) farm.wet(FL);
  farm.clearCrop(after('drill') ? (after('reaper') ? 2 : 1) : 0, after('sprayer') ? (after('grow') ? 1 : 0.35) : after('irrigate') ? 0.18 : 0.08);
  farm.flow.visible = false;
  const imp = s.imp || (s.id === 'grow' || s.id === 'irrigate' || s.id === 'stubble' ? null : null);
  if (imp !== state.imp || !I) { state.imp = imp; assemble(); }
  $$('.card').forEach((c) => c.classList.toggle('active', c.dataset.id === state.imp));
  if (imp) startJob(imp, { dur: s.dur, keepField: true });
  else { state.job = null; T.root.position.set(-9, 0, 2); T.root.rotation.y = 0.3; T.setHitch(0.6); farm.laser.visible = false; }
  renderCycle(); renderImp();
}
function stepCycle(dt) {
  const s = CYCLE[state.stage]; state.stageT += dt; const p = clamp(state.stageT / s.dur, 0, 1);
  if (s.imp) stepJob(dt);
  if (s.id === 'irrigate') { farm.flow.visible = p < 0.98; farm.flow.scale.x = Math.max(0.01, p * FL); farm.flow.position.x = (p * FL) / 2; farm.wet(p * FL); farm.setGrowth(lerp(0.08, 0.18, p)); }
  if (s.id === 'sprayer' && state.job) { if (Math.floor(state.stageT * 4) !== Math.floor((state.stageT - dt) * 4)) farm.setGrowth(lerp(0.22, 0.35, p)); }
  if (s.id === 'grow' && Math.floor(state.stageT * 5) !== Math.floor((state.stageT - dt) * 5)) farm.setGrowth(lerp(0.35, 1, p));
  if (s.id === 'trolley' && state.job) I.setTip?.(0);
  if (state.stageT >= s.dur && (!state.job || state.job.done || s.id === 'thresher')) { if (state.stage < CYCLE.length - 1) enterStage(state.stage + 1); else state.playing = false; }
}

// ── cameras ──
let camAnim = null;
function setCam(c) { state.cam = c; $$('#cams button').forEach((b) => b.classList.toggle('active', b.dataset.cam === c)); if (c === 'over') { camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(FL / 2 - 30, 38, FW + 34), t1: new THREE.Vector3(FL / 2, 0, FW / 2), u: 0 }; } }
controls.addEventListener('start', () => { if (state.cam !== 'over') { state.cam = 'free'; $$('#cams button').forEach((b) => b.classList.remove('active')); } });
function chase(dt, snap) {
  if (!T || state.cam === 'free' || state.cam === 'over') return;
  const r = T.root, f = new THREE.Vector3(Math.cos(r.rotation.y), 0, -Math.sin(r.rotation.y)), side = new THREE.Vector3(-f.z, 0, f.x);
  const c = r.position.clone(); const big = state.mode === 'show' ? 1 : 1.35;
  let pos, tgt = c.clone().add(new THREE.Vector3(0, 1.0, 0)).addScaledVector(f, -0.8);
  if (state.cam === 'side') pos = c.clone().addScaledVector(side, 9 * big).add(new THREE.Vector3(0, 2.5, 0)).addScaledVector(f, -1);
  else if (state.cam === 'rear') { pos = c.clone().addScaledVector(f, -7.5 * big).addScaledVector(side, 2.5).add(new THREE.Vector3(0, 3.6, 0)); tgt = c.clone().addScaledVector(f, -2); }
  else if (state.cam === 'cab') { pos = c.clone().add(new THREE.Vector3(0, 2.3 * T.s, 0)).addScaledVector(f, -0.15); tgt = pos.clone().addScaledVector(f, I?.hitch === 'front' ? 4 : -5).add(new THREE.Vector3(0, -1.6, 0)); }
  else if (I?.hitch === 'front') { pos = c.clone().addScaledVector(f, 8 * big).addScaledVector(side, 6 * big).add(new THREE.Vector3(0, 4 * big, 0)); tgt = c.clone().addScaledVector(f, 2.2).add(new THREE.Vector3(0, 0.8, 0)); }
  else pos = c.clone().addScaledVector(f, -6.5 * big).addScaledVector(side, 6.5 * big).add(new THREE.Vector3(0, 4.2 * big, 0));
  const k = snap ? 1 : Math.min(1, dt * 2.5); camera.position.lerp(pos, k); controls.target.lerp(tgt, k);
  controls.minDistance = state.cam === 'cab' ? 0.05 : 1;
}

// ── UI ──
function renderLeft() {
  $('#colours').innerHTML = COLOURS.map(([n, c]) => `<button data-c="${c}" title="${n}" style="--c:${c}" class="${c === state.colour ? 'active' : ''}"></button>`).join('');
  $$('#colours button').forEach((b) => b.addEventListener('click', () => { state.colour = b.dataset.c; T.paint.color.set(state.colour); renderLeft(); }));
  $$('#hps button').forEach((b) => b.classList.toggle('active', +b.dataset.hp === state.hp));
}
$$('#hps button').forEach((b) => b.addEventListener('click', () => { state.hp = +b.dataset.hp; assemble(); restartMode(); renderLeft(); renderImp(); renderCalc(); renderTractor(); }));
$('#cards').innerHTML = ORDER.map((id) => `<button class="card" data-id="${id}"><span class="ph" id="th-${id}"></span><b>${esc(IMPLEMENTS[id].short)}</b></button>`).join('');
$$('.card').forEach((c) => c.addEventListener('click', () => { state.imp = c.dataset.id; if (state.mode === 'cycle') setMode('field'); assemble(); restartMode(); $$('.card').forEach((x) => x.classList.toggle('active', x === c)); renderImp(); renderCalc(); }));
$$('#modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
$$('#cams button').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));
$$('.tabs button').forEach((b) => b.addEventListener('click', () => { $$('.tabs button').forEach((x) => x.classList.toggle('active', x === b)); $$('.tab').forEach((t) => t.classList.toggle('show', t.id === `tab-${b.dataset.tab}`)); }));
function setMode(m) {
  state.mode = m; $$('#modes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  if (m === 'cycle') { state.playing = true; enterStage(0); $$('.tabs button').find((b) => b.dataset.tab === 'cycle').click(); }
  else { if (!state.imp) { state.imp = 'rotavator'; assemble(); } restartMode(); }
  renderCtrl(); setCam('follow'); snap = true;
}
let snap = true;
function restartMode() { if (state.mode === 'show') { farm.reset('stubble'); farm.clearCrop(); showroom(); } else if (state.mode === 'field') startJob(state.imp); snap = true; }
function renderCtrl() {
  const d = IMPLEMENTS[state.imp] || {};
  if (state.mode === 'show') {
    $('#ctrl').innerHTML = `<label class="mini">Hitch <input type="range" id="hitch" min="0" max="1" step="0.01" value="${state.hitch}"/></label>
      <button class="btn ${state.pto ? 'on' : ''}" id="pto">PTO 540</button><button class="btn ${state.run ? 'on' : ''}" id="run">${state.run ? '■ Stop' : '▶ Work'}</button>
      <button class="btn" id="go">🌾 Take it to the field</button>`;
    $('#hitch').oninput = (e) => { state.hitch = +e.target.value; T.setHitch(state.hitch); };
    $('#pto').onclick = () => { state.pto = !state.pto; renderCtrl(); };
    $('#run').onclick = () => { state.run = !state.run; if (state.run) { state.hitch = 0; T.setHitch(0); } renderCtrl(); };
    $('#go').onclick = () => setMode('field');
  } else if (state.mode === 'field') {
    $('#ctrl').innerHTML = `<button class="btn primary" id="play">${state.playing ? '❚❚' : '▶'}</button><div class="seg" id="mult">${[5, 15, 40].map((m) => `<button data-m="${m}" class="${m === state.mult ? 'active' : ''}">${m}×</button>`).join('')}</div>
      <div class="prog"><i id="pbar"></i><span id="ptext"></span></div><button class="btn" id="again">↺ Restart</button>`;
    $('#play').onclick = () => { state.playing = !state.playing; renderCtrl(); };
    $$('#mult button').forEach((b) => b.addEventListener('click', () => { state.mult = +b.dataset.m; if (state.job?.path) state.job.v = (d.v / 3.6) * state.mult; renderCtrl(); }));
    $('#again').onclick = () => { startJob(state.imp); state.playing = true; renderCtrl(); };
  } else {
    $('#ctrl').innerHTML = `<button class="btn primary" id="play">${state.playing ? '❚❚' : '▶'}</button><div class="prog"><i id="pbar"></i><span id="ptext"></span></div><button class="btn" id="next">Next ⏭</button>`;
    $('#play').onclick = () => { state.playing = !state.playing; renderCtrl(); };
    $('#next').onclick = () => enterStage(Math.min(CYCLE.length - 1, state.stage + 1));
  }
}
function hpCheck(id, hp = state.hp) { const d = IMPLEMENTS[id]; if (hp < d.hp[0]) return [`Under-powered: needs ${d.hp[0]}–${d.hp[1]} HP`, 'warn']; if (hp > d.hp[1] + 20) return [`Over-sized: ${d.hp[0]}–${d.hp[1]} HP is enough`, 'warn']; return [`Good match (${d.hp[0]}–${d.hp[1]} HP)`, 'ok']; }
function renderImp() {
  const id = state.imp; if (!id) { $('#tab-imp').innerHTML = `<h3>${esc(CYCLE[state.stage].name)}</h3><p class="lead">${esc(CYCLE[state.stage].what)}</p>`; return; }
  const d = IMPLEMENTS[id], [chk, cls] = hpCheck(id), hitch = { '3pt': 'Three-point linkage', pto: 'Three-point linkage + PTO', drawbar: 'Drawbar (trailed)', front: 'Front mount, PTO belt drive', stationary: 'Stationary, PTO-driven' }[d.hitch];
  $('#tab-imp').innerHTML = `<h3>${esc(d.name)}</h3><p class="lead">${esc(d.what)}</p>
    <table class="spec"><tr><td>Hitch</td><td>${hitch}</td></tr>${d.w ? `<tr><td>Working width</td><td>${d.w} m</td></tr>` : ''}<tr><td>Depth</td><td>${esc(d.depth)}</td></tr>${d.v ? `<tr><td>Typical speed</td><td>${d.v} km/h</td></tr>` : ''}
    ${d.w ? `<tr><td>Field capacity</td><td>${((d.w * d.v * d.eff) / 10).toFixed(2)} ha/h (${((d.w * d.v * d.eff) / 10 * 2.471).toFixed(2)} acre/h)</td></tr>` : ''}<tr><td>Tractor power</td><td>${d.hp[0]}–${d.hp[1]} HP</td></tr><tr><td>Indicative price</td><td>${fmtL(d.price[0])} – ${fmtL(d.price[1])}</td></tr></table>
    <p class="${cls}" style="margin:8px 0">${state.hp} HP tractor: ${chk}</p>
    <h4>Parts</h4><ul class="checks">${d.parts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    <p class="muted">Field capacity = width × speed × field efficiency (${Math.round(d.eff * 100)}%) ÷ 10. Figures are typical and illustrative.</p>`;
}
const calc = { area: 5, unit: 'acre', diesel: 95, wage: 600 };
function renderCalc() {
  const id = state.imp && IMPLEMENTS[state.imp].w ? state.imp : 'rotavator';
  $('#tab-calc').innerHTML = `<p class="muted">Time, fuel and cost to work a field with a ${state.hp} HP tractor.</p>
    <div class="grid2"><label class="field">Implement<select id="cimp">${ORDER.filter((k) => IMPLEMENTS[k].w).map((k) => `<option value="${k}" ${k === id ? 'selected' : ''}>${esc(IMPLEMENTS[k].short)}</option>`).join('')}</select></label>
    <label class="field">Area<input id="carea" type="number" min="0.5" step="0.5" value="${calc.area}"/></label>
    <label class="field">Unit<select id="cunit"><option ${calc.unit === 'acre' ? 'selected' : ''}>acre</option><option ${calc.unit === 'ha' ? 'selected' : ''}>ha</option></select></label>
    <label class="field">Diesel ₹/L<input id="cdiesel" type="number" min="50" step="1" value="${calc.diesel}"/></label>
    <label class="field">Operator ₹/day (8 h)<input id="cwage" type="number" min="0" step="50" value="${calc.wage}"/></label></div><div id="cout"></div>`;
  const run = () => {
    const k = $('#cimp').value, d = IMPLEMENTS[k], tr = TRACTORS[state.hp]; calc.area = +$('#carea').value; calc.unit = $('#cunit').value; calc.diesel = +$('#cdiesel').value; calc.wage = +$('#cwage').value;
    const ha = calc.unit === 'acre' ? calc.area / 2.471 : calc.area, cap = (d.w * d.v * d.eff) / 10, hours = ha / cap, lph = 0.22 * tr.kw * d.lf, fuel = lph * hours, km = (ha * 1e4) / d.w / 1000;
    const cost = fuel * calc.diesel + (hours / 8) * calc.wage, [chk, cls] = hpCheck(k);
    $('#cout').innerHTML = `<h4>Results</h4><div class="kpis"><div class="big"><b>${hours.toFixed(1)} h</b><span>working time for ${calc.area} ${calc.unit} (${ha.toFixed(2)} ha)</span></div>
      <div><b>${cap.toFixed(2)} ha/h</b><span>field capacity (${(cap * 2.471).toFixed(2)} acre/h)</span></div><div><b>${km.toFixed(1)} km</b><span>distance driven in work</span></div>
      <div><b>${lph.toFixed(1)} L/h</b><span>fuel at ${Math.round(d.lf * 100)}% load</span></div><div><b>${fuel.toFixed(0)} L</b><span>diesel, ${(fuel / ha).toFixed(1)} L/ha</span></div>
      <div><b>₹${Math.round(cost).toLocaleString('en-IN')}</b><span>fuel + operator (no wear or ownership)</span></div><div><b>₹${Math.round(cost / calc.area).toLocaleString('en-IN')}</b><span>per ${calc.unit}</span></div></div>
      <p class="${cls}">${chk}</p><p class="muted">Fuel ≈ 0.22 L per kWh at the engine × tractor power × load factor. Rule-of-thumb estimates.</p>`;
  };
  $$('#tab-calc input, #tab-calc select').forEach((e) => e.addEventListener('input', run)); run();
}
function renderCycle() {
  $('#tab-cycle').innerHTML = `<p class="muted">Wheat after paddy, rabi season in north-west India: conventional tillage, laser levelling, line sowing, then harvest and threshing. Press <b>Crop cycle</b> to play it.</p>
    <ul class="cyc">${CYCLE.map((s, i) => `<li data-i="${i}" class="${state.mode === 'cycle' && i === state.stage ? 'cur' : state.mode === 'cycle' && i < state.stage ? 'done' : ''}"><em>${esc(s.date)}</em><span><b>${esc(s.name)}</b>${s.imp ? ` · ${esc(IMPLEMENTS[s.imp].short)}` : ''}<small>${esc(s.what)}</small></span></li>`).join('')}</ul>`;
  $$('.cyc li').forEach((li) => li.addEventListener('click', () => { if (state.mode !== 'cycle') { state.mode = 'cycle'; $$('#modes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === 'cycle')); renderCtrl(); setCam('follow'); } state.playing = true; enterStage(+li.dataset.i); snap = true; }));
}
function renderTractor() {
  const t = TRACTORS[state.hp];
  $('#tab-tractor').innerHTML = `<h3>${esc(t.name)}</h3><table class="spec"><tr><td>Engine</td><td>${t.hp} HP (${t.kw} kW)</td></tr><tr><td>Drive</td><td>${t.wd}WD${t.cab ? ', closed cab' : ', ROPS canopy'}</td></tr><tr><td>Weight</td><td>${t.weight.toLocaleString('en-IN')} kg</td></tr><tr><td>Hydraulic lift</td><td>${t.lift.toLocaleString('en-IN')} kg at the lower links</td></tr><tr><td>PTO</td><td>540 rpm (6-spline)</td></tr><tr><td>Speeds</td><td>${t.speed}</td></tr><tr><td>Fuel tank</td><td>${t.fuelTank} L</td></tr><tr><td>Indicative price</td><td>${fmtL(t.price[0])} – ${fmtL(t.price[1])}</td></tr></table>
    <h4>Three-point linkage</h4><p class="muted">Two lower links and a top link carry mounted implements. The lift arms, through the lift rods, raise them hydraulically. Draft control senses the pull on the top link and adjusts depth; position control holds a set height. The PTO shaft at the rear drives rotavators, sprayers, threshers and reapers at 540 rpm.</p>
    <h4>Matches</h4><ul class="checks">${ORDER.map((k) => { const [c, cl] = hpCheck(k); return `<li><b>${esc(IMPLEMENTS[k].short)}</b>: <span class="${cl}">${esc(c)}</span></li>`; }).join('')}</ul>`;
}
function hud() {
  const j = state.job, st = jobStats(); let h = '';
  if (state.mode === 'show') h = `<div class="hcard"><h2>${esc(TRACTORS[state.hp].name)}${I ? ` + ${esc(IMPLEMENTS[state.imp].short)}` : ''}</h2><span class="muted">Hitch ${Math.round((1 - state.hitch) * 100)}% down · PTO ${state.pto ? 'on, 540 rpm' : 'off'}</span></div>`;
  else {
    const top = state.mode === 'cycle' ? `<div class="day"><b>${esc(CYCLE[state.stage].date)}</b><span>step ${state.stage + 1} of ${CYCLE.length}</span></div><h2>${esc(CYCLE[state.stage].name)}</h2>` : `<h2>${esc(IMPLEMENTS[state.imp].name)}</h2>`;
    const kv = st && j ? (j.id === 'thresher' ? [['Grain', `${(st.realH * 1.2).toFixed(1)} t`], ['Rate', '≈1.2 t/h'], ['Fuel', `${st.fuel.toFixed(1)} L`]] : j.id === 'trolley' ? [['Load', '40 bags · 2 t'], ['Speed', '20 km/h']] : [['Area', `${st.area.toFixed(3)} of ${(FL * FW / 1e4).toFixed(3)} ha`], ['Real time', `${Math.floor(st.realH)} h ${Math.round((st.realH % 1) * 60)} min`], ['Fuel', `${st.fuel.toFixed(1)} L`], ['Capacity', `${st.cap.toFixed(2)} ha/h`]]) : [];
    h = `<div class="hcard">${top}</div><div class="kv">${kv.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>`;
  }
  $('#hud').innerHTML = h;
  if ($('#pbar')) { const p = state.mode === 'cycle' ? clamp(state.stageT / CYCLE[state.stage].dur, 0, 1) : st ? st.prog : 0; $('#pbar').style.width = `${p * 100}%`; $('#ptext').textContent = state.mode === 'cycle' ? `${CYCLE[state.stage].name} · ${Math.round(p * 100)}%` : j?.done ? 'Field finished' : `${Math.round(p * 100)}% of the plot`; }
}

// thumbnails of each implement
async function thumbs() {
  const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); tr.setSize(200, 120); tr.setPixelRatio(1); tr.toneMapping = THREE.NeutralToneMapping;
  const ts = new THREE.Scene(); ts.environment = scene.environment; ts.environmentIntensity = 0.7; const l = new THREE.DirectionalLight('#fff', 1.7); l.position.set(-5, 8, 6); ts.add(l, new THREE.HemisphereLight('#fff', '#888', 0.6));
  const tc = new THREE.PerspectiveCamera(30, 200 / 120, 0.05, 200);
  for (const id of ORDER) {
    await new Promise((r) => setTimeout(r, 20));
    const imp = BUILD[id](0.3); imp.update(0.1, 0.1, { working: true, pto: true, open: true }); for (let k = 0; k < 40; k++) imp.update(0.1, 0, { working: true, pto: false, open: true });
    ts.add(imp.root); const b = new THREE.Box3().setFromObject(imp.root), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    tc.position.set(c.x - s * 0.7, c.y + s * 0.42, c.z + s * 0.75); tc.lookAt(c); tr.render(ts, tc); ts.remove(imp.root);
    const el = document.getElementById(`th-${id}`); if (el) { const img = new Image(); img.src = tr.domElement.toDataURL(); img.alt = ''; img.id = `th-${id}`; el.replaceWith(img); }
  }
  tr.dispose();
}

// ── loop ──
function resize() { const v = $('.view'), w = v.clientWidth, h = v.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe($('.view'));
const clock = new THREE.Clock(); let uiT = 0;
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  if (state.mode === 'show') {
    const ds = state.run ? dt * 1.2 : 0; T.update(dt, ds, 0, state.pto || (state.run && I?.hitch !== '3pt'));
    I?.update(dt, ds, { working: state.run, pto: state.pto || state.run, open: state.run, h: state.hitch });
    if (state.imp === 'leveller') farm.laserHead.rotation.y += dt * 12;
  } else if (state.playing) { if (state.mode === 'field') stepJob(dt); else stepCycle(dt); }
  if (camAnim) { camAnim.u = Math.min(1, camAnim.u + dt * 1.4); const e = camAnim.u * camAnim.u * (3 - 2 * camAnim.u); camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (camAnim.u >= 1) camAnim = null; }
  else chase(dt, snap); snap = false;
  uiT += dt; if (uiT > 0.2) { uiT = 0; hud(); }
  controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop);
}
resize(); assemble(); renderLeft(); renderImp(); renderCalc(); renderCycle(); renderTractor();
$$('.card').forEach((c) => c.classList.toggle('active', c.dataset.id === state.imp));
showroom(); renderCtrl();
const m0 = q.get('mode'); if (m0 === 'field' || m0 === 'cycle') setMode(m0);
if (m0 === 'cycle' && q.get('stage')) enterStage(clamp(+q.get('stage'), 0, CYCLE.length - 1));
if (q.get('cam')) setCam(q.get('cam'));
if (q.get('tab')) $$('.tabs button').find((b) => b.dataset.tab === q.get('tab'))?.click();
if (q.get('run')) { state.run = true; state.pto = true; state.hitch = 0; T.setHitch(0); renderCtrl(); }
loop();
setTimeout(() => $('#loader').classList.add('done'), 300);
setTimeout(thumbs, 700);
window.__ky = { snap: () => { snap = true; if (camAnim) camAnim.u = 0.999; hud(); }, state, farm, get T() { return T; }, get I() { return I; }, stepJob, stepCycle, enterStage, startJob, setMode, setCam, jobStats, camera, controls };   // handle for automated browser tests
