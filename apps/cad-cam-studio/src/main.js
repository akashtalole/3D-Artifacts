import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { MATERIALS, TOOL_TYPES, FEATURES, newFeature, sampleDoc, syncOps, cutting, OP_LABEL, uid, holeCentres, featureDepth, DEFAULT_TOOLS } from './model.js';
import { buildPart, designHeightFn, massProps, scrapFn } from './cad.js';
import { generate, toGcode } from './cam.js';
import { StockSim, toolModel, Chips } from './sim.js';
import { rrect, circle, stadium, ring, contains } from './geom2d.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STORE = 'cadcam-studio:v1';
const OP_COLORS = ['#41b6ff', '#ff9f43', '#a77bff', '#3fcf8e', '#ff6b9a', '#ffd23f', '#4dd6c9', '#ff7a59', '#9bd14b', '#e06cf0'];
const fmtTime = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const num = (v, d = 2) => { const t = (+v).toFixed(d); return t.includes('.') ? t.replace(/\.?0+$/, '') : t; };

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  doc: null, mode: 'design', sel: { kind: 'stock' }, results: [], gcode: null, mass: null,
  show: { stock: true, compare: false, paths: true, code: false },
};
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

// ── Scene ──────────────────────────────────────────────────────────────────
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.75;
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 6000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.1;
scene.add(new THREE.HemisphereLight('#dfe8ff', '#30281f', 0.6));
const sun = new THREE.DirectionalLight('#ffffff', 1.8);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.3;
scene.add(sun, sun.target);

const machine = new THREE.Group(); machine.rotation.x = -Math.PI / 2; scene.add(machine);   // children use machine coords (Z up)
const toThree = (x, y, z) => new THREE.Vector3(x, z, -y);

const env = new THREE.Group(); machine.add(env);
const partMat = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.7, roughness: 0.32, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const part = new THREE.Mesh(new THREE.BufferGeometry(), partMat); part.castShadow = part.receiveShadow = true; machine.add(part);
const edges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#141a22', transparent: true, opacity: 0.8 })); machine.add(edges);
const stockGhost = new THREE.Group(); machine.add(stockGhost);
const highlight = new THREE.Group(); machine.add(highlight);
const paths = new THREE.Group(); machine.add(paths);
const toolHolder = new THREE.Group(); toolHolder.rotation.x = Math.PI / 2; machine.add(toolHolder);
let sim = null, chips = null;

function buildEnvironment() {
  env.clear(); stockGhost.clear();
  const { w, d, h } = state.doc.stock;
  // spoilboard + machine table with T-slots
  const spoil = new THREE.Mesh(new THREE.BoxGeometry(w + 60, d + 60, 12), new THREE.MeshStandardMaterial({ color: '#8a6d4f', roughness: 0.95 }));
  spoil.position.set(w / 2, d / 2, -h - 6); spoil.receiveShadow = true; env.add(spoil);
  const slotTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#5a616b'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#2b3036'; g.fillRect(26, 0, 12, 256); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  slotTex.repeat.set((w + 200) / 50, 1);
  const table = new THREE.Mesh(new THREE.BoxGeometry(w + 200, d + 140, 20), [null, null, null, null, new THREE.MeshStandardMaterial({ map: slotTex, metalness: 0.6, roughness: 0.5 }), null].map((m) => m || new THREE.MeshStandardMaterial({ color: '#4c535c', metalness: 0.6, roughness: 0.5 })));
  table.position.set(w / 2, d / 2, -h - 22); table.receiveShadow = true; env.add(table);
  // WCS triad at X0 Y0 Z0
  const L = Math.max(12, Math.min(w, d) * 0.18);
  for (const [dir, col] of [[[1, 0, 0], '#ff4d4d'], [[0, 1, 0], '#4ddc6a'], [[0, 0, 1], '#4da3ff']]) env.add(new THREE.ArrowHelper(new THREE.Vector3(...dir), new THREE.Vector3(0, 0, 0.05), L, col, L * 0.22, L * 0.12));
  // stock ghost
  const box = new THREE.BoxGeometry(w, d, h).translate(w / 2, d / 2, -h / 2);
  stockGhost.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineDashedMaterial({ color: '#8fb8d8', dashSize: 3, gapSize: 2, transparent: true, opacity: 0.7 })));
  stockGhost.children[0].computeLineDistances();
  stockGhost.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: '#8fb8d8', transparent: true, opacity: 0.05, depthWrite: false })));
  // lights / shadows sized to the stock
  const R = Math.hypot(w, d, h);
  const c = toThree(w / 2, d / 2, -h / 2);
  sun.position.copy(c).add(new THREE.Vector3(R * 0.6, R * 1.4, R * 0.8)); sun.target.position.copy(c);
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: R * 4 }); sun.shadow.camera.updateProjectionMatrix();
}

function setView(v) {
  const { w, d, h } = state.doc.stock;
  const c = toThree(w / 2, d / 2, -h / 2), R = Math.hypot(w, d) * 1.15;
  const off = { iso: [0.75, 0.8, 1.0], top: [0, 1.55, 0.001], front: [0, 0.25, 1.5], right: [1.5, 0.25, 0] }[v];
  camera.position.copy(c).add(new THREE.Vector3(...off).multiplyScalar(R));
  controls.target.copy(c); controls.update();
}

// ── Undo ───────────────────────────────────────────────────────────────────
const undoStack = [], redoStack = [];
const snap = () => JSON.stringify(state.doc);
function pushUndo(s) { undoStack.push(s); if (undoStack.length > 150) undoStack.shift(); redoStack.length = 0; syncUndo(); }
function syncUndo() { $('#undo').disabled = !undoStack.length; $('#redo').disabled = !redoStack.length; }
function undo() { if (!undoStack.length) return; redoStack.push(snap()); load(JSON.parse(undoStack.pop()), { keepView: true, keepUndo: true }); }
function redo() { if (!redoStack.length) return; undoStack.push(snap()); load(JSON.parse(redoStack.pop()), { keepView: true, keepUndo: true }); }
function commit(mutator) { pushUndo(snap()); mutator(); changed(); }

// ── Rebuild pipeline ───────────────────────────────────────────────────────
let cadT = 0, stockKey = '';
const editing = () => $('#right').contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
function changed({ cad = true } = {}) {
  syncOps(state.doc);
  renderLeft(); if (!editing()) renderRight();
  clearTimeout(cadT);
  cadT = setTimeout(() => { if (cad) rebuildCAD(); rebuildCAM(); renderLeft(); if (!editing()) renderRight(); $('#hud').innerHTML = hudText(); save(); }, 90);
}
/** Crisp model edges drawn from the feature definitions (the CSG mesh has T-junctions). */
function featureEdges() {
  const doc = state.doc, { stock } = doc, H = designHeightFn(doc), pos = [];
  const add = (pts, zf) => { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; pos.push(a[0], a[1], zf(a), b[0], b[1], zf(b)); } };
  const outward = (r, i, k) => { const [x, y] = r[i], [cx, cy] = r.c; const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1; return H(x + (dx / L) * k, y + (dy / L) * k); };
  const prof = doc.features.find((f) => f.type === 'profile' && f.visible !== false);
  const outline = prof ? ring(prof.shape === 'circle' ? circle(prof.cx, prof.cy, prof.d / 2) : rrect(prof.cx, prof.cy, prof.w, prof.h, prof.r)) : ring(rrect(stock.w / 2, stock.d / 2, stock.w, stock.d, 0));
  const oc = prof ? [prof.cx, prof.cy] : [stock.w / 2, stock.d / 2];
  outline.c = oc;
  const bottom = prof && !prof.through ? -prof.depth : -stock.h;
  add(outline, (p) => { const i = outline.indexOf(p); return outward(outline, i, -0.15); });
  add(outline, () => bottom);
  if (!prof) for (const [x, y] of [[0, 0], [stock.w, 0], [stock.w, stock.d], [0, stock.d]]) pos.push(x, y, H(Math.min(Math.max(x, 0.1), stock.w - 0.1), Math.min(Math.max(y, 0.1), stock.d - 0.1)), x, y, -stock.h);
  for (const f of doc.features) {
    if (f.visible === false || f.type === 'face' || f.type === 'profile') continue;
    const dep = featureDepth(f, stock);
    for (const r of featureRings(f)) {
      const cx = r.reduce((s, p) => s + p[0], 0) / r.length, cy = r.reduce((s, p) => s + p[1], 0) / r.length;
      r.c = [cx, cy];
      add(r, (p) => outward(r, r.indexOf(p), 0.15));
      if (!(f.type === 'holes' && f.through)) add(r, () => -dep);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
function rebuildCAD() {
  const t0 = performance.now();
  try {
    const geo = buildPart(state.doc);
    part.geometry.dispose(); part.geometry = geo;
    edges.geometry.dispose(); edges.geometry = featureEdges();
  } catch (e) { console.error(e); toast('Geometry kernel error — check feature sizes'); }
  const m = MATERIALS[state.doc.stock.material];
  partMat.color.set(m.color); partMat.metalness = m.metal; partMat.roughness = m.rough;
  state.mass = massProps(state.doc, designHeightFn(state.doc), m.density);
  state.cadMs = performance.now() - t0;
  renderHighlight();
}
function rebuildCAM() {
  const doc = state.doc;
  state.results = generate(doc);
  state.gcode = toGcode(doc, state.results);
  buildPaths();
  // simulation stock (rebuilt if the stock changed)
  const key = `${doc.stock.w}|${doc.stock.d}|${doc.stock.h}|${doc.stock.material}`;
  if (!sim || key !== stockKey) {
    if (sim) { machine.remove(sim.mesh); sim.geo.dispose(); }
    sim = new StockSim(doc.stock, new THREE.Color(MATERIALS[doc.stock.material].color).multiplyScalar(0.82));
    sim.mesh.material.metalness = Math.min(0.6, MATERIALS[doc.stock.material].metal);
    machine.add(sim.mesh);
    if (chips) machine.remove(chips.points);
    chips = new Chips(MATERIALS[doc.stock.material].color, -doc.stock.h);
    machine.add(chips.points);
    stockKey = key;
    buildEnvironment();
  }
  sim.setDesign(designHeightFn(doc), scrapFn(doc));
  sim.setMode(state.show.compare ? 'compare' : 'material');
  buildTimeline();
  applyVisibility();
}

// ── Toolpath drawing ───────────────────────────────────────────────────────
function buildPaths() {
  paths.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  paths.clear();
  const selOp = state.sel.kind === 'op' ? state.sel.id : null;
  let prev = { x: 0, y: 0, z: state.doc.machine.safeZ + 20 };
  state.results.forEach((r, i) => {
    if (!r.moves.length) return;
    const col = new THREE.Color(OP_COLORS[i % OP_COLORS.length]), plungeC = new THREE.Color('#ffe14d');
    const fp = [], fc = [], rp = [];
    for (const m of r.moves) {
      if (m.rapid) rp.push(prev.x, prev.y, prev.z, m.x, m.y, m.z);
      else {
        fp.push(prev.x, prev.y, prev.z, m.x, m.y, m.z);
        const c = Math.abs(m.x - prev.x) < 1e-6 && Math.abs(m.y - prev.y) < 1e-6 && m.z < prev.z ? plungeC : col;
        fc.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      prev = m;
    }
    const dim = selOp && selOp !== r.op.id;
    const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); g1.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
    paths.add(new THREE.LineSegments(g1, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: dim ? 0.12 : 0.95, depthTest: !(!dim && selOp) })));
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    const rl = new THREE.LineSegments(g2, new THREE.LineDashedMaterial({ color: '#ff5b5b', dashSize: 2, gapSize: 2, transparent: true, opacity: dim ? 0.08 : 0.6 }));
    rl.computeLineDistances(); paths.add(rl);
  });
}

// Feature outline highlight (design mode)
function featureRings(f) {
  const { stock } = state.doc;
  if (f.type === 'face') return [ring(rrect(stock.w / 2, stock.d / 2, stock.w, stock.d, 0))];
  if (f.type === 'rectPocket') return [ring(rrect(f.cx, f.cy, f.w, f.h, f.r))];
  if (f.type === 'circPocket') return [ring(circle(f.cx, f.cy, f.d / 2))];
  if (f.type === 'slot') return [ring(stadium(f.cx, f.cy, f.len, f.width, f.angle))];
  if (f.type === 'holes') return holeCentres(f).map(([x, y]) => ring(circle(x, y, f.d / 2)));
  if (f.type === 'profile') return [ring(f.shape === 'circle' ? circle(f.cx, f.cy, f.d / 2) : rrect(f.cx, f.cy, f.w, f.h, f.r))];
  return [];
}
function renderHighlight() {
  highlight.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  highlight.clear();
  if (state.sel.kind !== 'feature' && state.sel.kind !== 'op') return;
  const f = state.sel.kind === 'feature' ? state.doc.features.find((x) => x.id === state.sel.id) : state.doc.features.find((x) => x.id === state.doc.ops.find((o) => o.id === state.sel.id)?.featureId);
  if (!f) return;
  const depth = featureDepth(f, state.doc.stock);
  const mat = new THREE.LineBasicMaterial({ color: '#ff9f43', depthTest: false, transparent: true, opacity: 0.95 });
  for (const r of featureRings(f)) {
    for (const z of [0.02, -depth]) {
      const g = new THREE.BufferGeometry().setFromPoints([...r, r[0]].map(([x, y]) => new THREE.Vector3(x, y, z)));
      const l = new THREE.Line(g, mat); l.renderOrder = 10; highlight.add(l);
    }
    const step = Math.max(1, Math.floor(r.length / 8)), seg = [];
    for (let i = 0; i < r.length; i += step) seg.push(new THREE.Vector3(r[i][0], r[i][1], 0.02), new THREE.Vector3(r[i][0], r[i][1], -depth));
    const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), mat); l.renderOrder = 10; highlight.add(l);
  }
}

// ── Simulation ─────────────────────────────────────────────────────────────
const simState = { segs: [], total: 0, t: 0, idx: 0, frac: 0, playing: false, speed: 20, ri: -1, cur: null };
function buildTimeline() {
  const segs = []; let t = 0, prev = { x: 0, y: 0, z: state.doc.machine.safeZ + 20 };
  state.results.forEach((r, ri) => {
    if (!r.moves.length) return;
    segs.push({ dwell: true, a: prev, b: prev, t0: t, t1: t + state.doc.machine.toolChange, dur: state.doc.machine.toolChange, ri, mi: -1 }); t += state.doc.machine.toolChange;
    r.moves.forEach((m, mi) => {
      const d = Math.hypot(m.x - prev.x, m.y - prev.y, m.z - prev.z);
      const dur = Math.max(1e-4, m.rapid ? (d / state.doc.machine.rapid) * 60 : (d / m.f) * 60);
      segs.push({ a: prev, b: m, rapid: m.rapid, t0: t, t1: t + dur, dur, ri, mi });
      t += dur; prev = m;
    });
  });
  Object.assign(simState, { segs, total: t, t: 0, idx: 0, frac: 0, playing: false, ri: -1, cur: { x: 0, y: 0, z: state.doc.machine.safeZ + 20 } });
  sim.reset();
  setTool(-1);
  syncPlay(); updateSimUI(true);
}
const lerp = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });
function advance(toT, emit = true) {
  const S = simState;
  while (S.idx < S.segs.length) {
    const s = S.segs[S.idx];
    const f1 = s.t1 <= toT ? 1 : Math.max(S.frac, (toT - s.t0) / s.dur);
    if (s.ri !== S.ri) setTool(s.ri);
    if (!s.rapid && !s.dwell && f1 > S.frac) {
      const a = lerp(s.a, s.b, S.frac), b = lerp(s.a, s.b, f1);
      const tool = state.results[s.ri].tool;
      const vol = sim.sweep(a, b, tool);
      if (vol > 0 && emit) chips.emit(b.x, b.y, b.z, tool.d / 2, Math.min(6, 1 + vol / 8));
    }
    S.cur = lerp(s.a, s.b, f1);
    if (f1 >= 1) { S.idx++; S.frac = 0; } else { S.frac = f1; break; }
  }
  S.t = toT;
}
function seek(t) {
  t = Math.max(0, Math.min(simState.total, t));
  if (t < simState.t) { sim.reset(); Object.assign(simState, { idx: 0, frac: 0, t: 0, ri: -1 }); }
  advance(t, false);
  sim.update(); updateSimUI(true); renderRightStatsLive();
}
function setTool(ri) {
  simState.ri = ri;
  toolHolder.clear();
  const r = state.results[ri];
  if (r) toolHolder.add(toolModel(r.tool));
}
function syncPlay() { $('#play-ico').setAttribute('d', simState.playing ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z'); }
let lastLine = -1;
function updateSimUI(force) {
  const S = simState;
  $('#sim-time').textContent = `${fmtTime(S.t)} / ${fmtTime(S.total)}`;
  if (document.activeElement !== $('#sim-slider')) $('#sim-slider').value = S.total ? Math.round((S.t / S.total) * 1000) : 0;
  const seg = S.segs[Math.min(S.idx, S.segs.length - 1)];
  const r = seg && state.results[seg.ri];
  $('#sim-op').textContent = r ? `${seg.dwell ? 'Tool change → ' : ''}${r.label} · T${r.tool.num} Ø${r.tool.d} · S${r.c.rpm}` : 'No toolpaths';
  if (state.show.code && state.gcode) {
    const line = seg && seg.mi >= 0 ? state.gcode.lineOf[seg.ri]?.[seg.mi] ?? -1 : -1;
    if (line !== lastLine || force) { lastLine = line; renderGcode(line); }
  }
}
function renderGcode(cur) {
  const L = state.gcode.lines, rows = 60;
  const c = cur < 0 ? 0 : cur, start = Math.max(0, c - 18);
  $('#g-count').textContent = `${L.length} lines`;
  $('#glist').innerHTML = L.slice(start, start + rows).map((t, i) => `<div class="${start + i === cur ? 'cur' : ''}${t.startsWith('(') ? ' c' : ''}"><span class="ln">${start + i + 1}</span>${esc(t)}</div>`).join('');
}
$('#sim-play').onclick = () => {
  if (simState.t >= simState.total) seek(0);
  simState.playing = !simState.playing; syncPlay();
};
$('#sim-reset').onclick = () => { simState.playing = false; syncPlay(); seek(0); };
$('#sim-speed').onchange = (e) => { simState.speed = +e.target.value; };
$('#sim-slider').addEventListener('input', (e) => { simState.playing = false; syncPlay(); seek((+e.target.value / 1000) * simState.total); });
const toggle = (id, key, after) => $(id).addEventListener('click', () => { state.show[key] = !state.show[key]; $(id).classList.toggle('active', state.show[key]); after?.(); applyVisibility(); });
toggle('#t-stock', 'stock');
toggle('#t-compare', 'compare', () => { sim.setMode(state.show.compare ? 'compare' : 'material'); });
toggle('#t-paths', 'paths');
toggle('#t-code', 'code', () => { $('#gpanel').hidden = !state.show.code; updateSimUI(true); });

function applyVisibility() {
  const man = state.mode === 'manufacture';
  part.visible = !man || !state.show.stock;
  partMat.transparent = false; partMat.opacity = 1;
  edges.visible = part.visible;
  stockGhost.visible = !man;
  paths.visible = man && state.show.paths;
  if (sim) sim.mesh.visible = man && state.show.stock;
  if (chips) chips.points.visible = man;
  toolHolder.visible = man;
  highlight.visible = !man || state.sel.kind === 'op';
  $('#legend').innerHTML = man ? '<span><i style="background:#41b6ff"></i>cut</span><span><i style="background:#ffe14d"></i>plunge</span><span><i style="background:#ff5b5b"></i>rapid</span>' + (state.show.compare ? '<span><i style="background:#3fcf8e"></i>on size</span><span><i style="background:#ffb020"></i>stock left</span><span><i style="background:#ff3b30"></i>gouge</span><span><i style="background:#6b5a45"></i>scrap</span>' : '') : '';
}

// ── Left panel ─────────────────────────────────────────────────────────────
function featureSummary(f) {
  const s = state.doc.stock, dep = `${num(featureDepth(f, s))} deep`;
  switch (f.type) {
    case 'face': return `${num(f.depth)} mm off the top`;
    case 'rectPocket': return `${num(f.w)}×${num(f.h)} R${num(f.r)} · ${dep}`;
    case 'circPocket': return `Ø${num(f.d)} · ${dep}`;
    case 'slot': return `${num(f.len)}×${num(f.width)} @${num(f.angle)}° · ${dep}`;
    case 'holes': return `${holeCentres(f).length}× Ø${num(f.d)} · ${f.through ? 'through' : dep}`;
    case 'profile': return `${f.shape === 'circle' ? `Ø${num(f.d)}` : `${num(f.w)}×${num(f.h)} R${num(f.r)}`} · ${f.through ? 'through' : dep}`;
    default: return '';
  }
}
function renderLeft() {
  const d = state.doc, sel = state.sel;
  const isSel = (k, id) => sel.kind === k && (!id || sel.id === id);
  if (state.mode === 'design') {
    $('#left').innerHTML = `
      <h3>Stock</h3>
      <div class="card${isSel('stock') ? ' sel' : ''}" data-sel="stock"><div class="ic">▣</div><div><b>${num(d.stock.w)} × ${num(d.stock.d)} × ${num(d.stock.h)} mm</b><small>${esc(MATERIALS[d.stock.material].name)}</small></div></div>
      <h3>Add feature</h3>
      <div class="addgrid">${Object.entries(FEATURES).map(([k, v]) => `<button data-add="${k}" title="Add ${esc(v.label)}"><span>${v.icon}</span>${esc(v.label.replace('Rectangular', 'Rect.').replace('Circular', 'Round').replace('Outside ', ''))}</button>`).join('')}</div>
      <h3>Features <span>${d.features.length}</span></h3>
      <ul class="tree">${d.features.map((f) => `<li class="${isSel('feature', f.id) ? 'sel' : ''}${f.visible === false ? ' off' : ''}" data-sel="feature" data-id="${f.id}">
        <span class="ti">${FEATURES[f.type].icon}</span><span class="tn"><b>${esc(f.name)}</b><small>${esc(featureSummary(f))}</small></span>
        <button class="act" data-eye="${f.id}" title="Suppress / unsuppress">${f.visible === false ? '◌' : '◉'}</button>
        <button class="act" data-del="${f.id}" title="Delete">✕</button></li>`).join('') || '<li><span class="tn"><small>No features yet: add one above.</small></span></li>'}</ul>`;
  } else {
    const res = new Map(state.results.map((r) => [r.op.id, r]));
    $('#left').innerHTML = `
      <h3>Setup</h3>
      <div class="card${isSel('machine') ? ' sel' : ''}" data-sel="machine"><div class="ic">⚙</div><div><b>${esc(d.machine.name)}</b><small>${esc(MATERIALS[d.stock.material].name)} · ${num(d.stock.w)}×${num(d.stock.d)}×${num(d.stock.h)} · WCS top front-left</small></div></div>
      <h3>Operations <span>${d.ops.length}</span></h3>
      <ul class="tree">${d.ops.map((o, i) => {
        const r = res.get(o.id), t = d.tools.find((x) => x.id === o.toolId), f = d.features.find((x) => x.id === o.featureId);
        return `<li class="${isSel('op', o.id) ? 'sel' : ''}${o.enabled ? '' : ' off'}" data-sel="op" data-id="${o.id}">
          <input type="checkbox" data-en="${o.id}" ${o.enabled ? 'checked' : ''} title="Enable"/>
          <span class="dot" style="background:${OP_COLORS[i % OP_COLORS.length]}"></span>
          <span class="tn"><b>${esc(OP_LABEL[o.type])} · ${esc(f?.name || '')}</b><small>T${t?.num} Ø${num(t?.d)} · ${r ? fmtTime(r.time) : '—'}</small></span>
          ${r?.warnings.length ? `<span class="warn" title="${esc(r.warnings.join('\n'))}">⚠</span>` : ''}</li>`;
      }).join('')}</ul>
      <h3>Tool library <button class="act btn" data-addtool>+ Tool</button></h3>
      <ul class="tree">${d.tools.map((t) => `<li class="${isSel('tool', t.id) ? 'sel' : ''}" data-sel="tool" data-id="${t.id}"><span class="ti mono">T${t.num}</span><span class="tn"><b>${esc(t.name)}</b><small>${esc(TOOL_TYPES[t.type])} · Ø${num(t.d)} · ${t.flutes} fl · ${num(t.len)} mm</small></span>${d.ops.some((o) => o.toolId === t.id) ? '' : `<button class="act" data-deltool="${t.id}" title="Delete">✕</button>`}</li>`).join('')}</ul>`;
  }
}
$('#left').addEventListener('click', (e) => {
  const d = state.doc;
  const add = e.target.closest('[data-add]');
  if (add) { const f = newFeature(add.dataset.add, d.stock); commit(() => { d.features.push(f); state.sel = { kind: 'feature', id: f.id }; }); return; }
  const eye = e.target.closest('[data-eye]');
  if (eye) { e.stopPropagation(); const f = d.features.find((x) => x.id === eye.dataset.eye); commit(() => { f.visible = f.visible === false; }); return; }
  const del = e.target.closest('[data-del]');
  if (del) { e.stopPropagation(); commit(() => { d.features = d.features.filter((x) => x.id !== del.dataset.del); state.sel = { kind: 'stock' }; }); return; }
  if (e.target.closest('[data-addtool]')) { const n = Math.max(0, ...d.tools.map((t) => t.num)) + 1; const t = { id: uid('t'), num: n, type: 'flat', d: 4, flutes: 2, len: 15, name: `4 mm flat end mill` }; commit(() => { d.tools.push(t); state.sel = { kind: 'tool', id: t.id }; }); return; }
  const dt = e.target.closest('[data-deltool]');
  if (dt) { e.stopPropagation(); commit(() => { d.tools = d.tools.filter((t) => t.id !== dt.dataset.deltool); state.sel = { kind: 'machine' }; }); return; }
  if (e.target.matches('[data-en]')) { const o = d.ops.find((x) => x.id === e.target.dataset.en); commit(() => { o.enabled = e.target.checked; }); return; }
  const s = e.target.closest('[data-sel]');
  if (s) { state.sel = { kind: s.dataset.sel, id: s.dataset.id }; renderLeft(); renderRight(); renderHighlight(); if (state.mode === 'manufacture') buildPaths(); applyVisibility(); }
});

// ── Right panel (properties + summary) ─────────────────────────────────────
function field(obj, [key, label, kind, showIf]) {
  if (typeof showIf === 'function' && !showIf(obj)) return '';
  const v = obj[key];
  if (kind === 'bool') return `<label>${esc(label)}<input type="checkbox" data-k="${key}" ${v ? 'checked' : ''}/></label>`;
  if (Array.isArray(kind)) return `<label>${esc(label)}<select data-k="${key}">${kind.map((o) => `<option value="${o}" ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
  if (kind && typeof kind === 'object') return `<label>${esc(label)}<select data-k="${key}">${Object.entries(kind).map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
  const u = kind === 'deg' ? '°' : kind === 'int' ? '' : kind === 'pct' ? '%' : kind === 'rpm' ? 'rpm' : kind === 'feed' ? 'mm/min' : kind === 's' ? 's' : 'mm';
  const step = kind === 'int' ? 1 : kind === 'deg' ? 5 : kind === 'rpm' ? 100 : kind === 'feed' ? 50 : 0.1;
  return `<label>${esc(label)}<span class="unit" data-u="${u}"><input type="number" data-k="${key}" data-kind="${kind}" value="${v ?? ''}" step="${step}" ${typeof showIf === 'string' ? `placeholder="${esc(showIf)}"` : ''}/></span></label>`;
}
let editTarget = null;
function renderRight() {
  const d = state.doc, s = state.sel;
  let html = '';
  if (s.kind === 'stock') {
    editTarget = d.stock;
    html = `<div class="props"><div class="kind">Stock</div><h2>Raw material block</h2><div class="form">
      ${field(d.stock, ['w', 'Width (X)', 'mm'])}${field(d.stock, ['d', 'Depth (Y)', 'mm'])}${field(d.stock, ['h', 'Thickness (Z)', 'mm'])}
      ${field(d.stock, ['material', 'Material', Object.fromEntries(Object.entries(MATERIALS).map(([k, m]) => [k, m.name]))])}</div>
      <p class="note">Work origin: top surface, front-left corner (X0 Y0 Z0).</p></div>`;
  } else if (s.kind === 'feature') {
    const f = d.features.find((x) => x.id === s.id); if (!f) { state.sel = { kind: 'stock' }; return renderRight(); }
    editTarget = f;
    const def = FEATURES[f.type];
    html = `<div class="props"><div class="kind">${def.icon} ${esc(def.label)}</div>
      <div class="form"><label class="wide"><input type="text" data-k="name" value="${esc(f.name)}" aria-label="Name"/></label>
      ${def.fields.map((fl) => field(f, fl)).join('')}</div>
      ${featureWarnings(f).length ? `<ul class="warns">${featureWarnings(f).map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      <div class="btnrow"><button class="btn" data-dup>Duplicate</button><button class="btn danger" data-delsel>Delete</button></div></div>`;
  } else if (s.kind === 'op') {
    const o = d.ops.find((x) => x.id === s.id); if (!o) { state.sel = { kind: 'machine' }; return renderRight(); }
    editTarget = o;
    const t = d.tools.find((x) => x.id === o.toolId), f = d.features.find((x) => x.id === o.featureId);
    const auto = cutting(t, d.stock.material, d.machine), r = state.results.find((x) => x.op.id === o.id);
    const tools = Object.fromEntries(d.tools.map((x) => [x.id, `T${x.num} · ${x.name}`]));
    html = `<div class="props"><div class="kind">${esc(OP_LABEL[o.type])}</div><h2>${esc(f?.name || '')}</h2><div class="form">
      ${field(o, ['toolId', 'Tool', tools])}
      ${f?.type === 'rectPocket' ? field(o, ['strategy', 'Strategy', { offset: 'Offset (spiral out)', zigzag: 'Zig-zag + finish' }]) : ''}
      ${['pocket', 'slot', 'face'].includes(o.type) ? field(o, ['stepover', 'Stepover', 'pct']) : ''}
      ${o.type !== 'drill' ? field(o, ['stepdown', 'Stepdown', 'mm']) : field(o, ['peck', 'Peck depth', 'mm'])}
      ${field(o, ['rpm', 'Spindle', 'rpm', `auto ${auto.rpm}`])}
      ${field(o, ['feed', o.type === 'drill' ? 'Plunge feed' : 'Cutting feed', 'feed', `auto ${o.type === 'drill' ? auto.plunge : auto.feed}`])}
      ${o.type === 'profile' && f?.through ? field(o, ['tabs', 'Holding tabs', 'int']) + field(o, ['tabW', 'Tab width', 'mm']) + field(o, ['tabH', 'Tab height', 'mm']) : ''}
      </div>
      <p class="note">Auto feeds and speeds: Vc ${MATERIALS[d.stock.material].vc} m/min in ${esc(MATERIALS[d.stock.material].name)}, chip load ≈ ${num(auto.feed / auto.rpm / t.flutes, 3)} mm/tooth.</p>
      ${r ? `<dl class="stats"><div><dt>Cycle time</dt><dd>${fmtTime(r.time)}</dd></div><div><dt>Cutting length</dt><dd>${num(r.length / 1000, 2)} m</dd></div><div><dt>Moves</dt><dd>${r.moves.length}</dd></div><div><dt>Spindle / feed</dt><dd>${r.c.rpm} / ${r.c.feed}</dd></div></dl>` : ''}
      ${r?.warnings.length ? `<ul class="warns">${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}</div>`;
  } else if (s.kind === 'tool') {
    const t = d.tools.find((x) => x.id === s.id); if (!t) { state.sel = { kind: 'machine' }; return renderRight(); }
    editTarget = t;
    html = `<div class="props"><div class="kind">Tool</div><h2>T${t.num}</h2><div class="form">
      <label class="wide"><input type="text" data-k="name" value="${esc(t.name)}" aria-label="Name"/></label>
      ${field(t, ['num', 'Tool number', 'int'])}${field(t, ['type', 'Type', TOOL_TYPES])}${field(t, ['d', 'Diameter', 'mm'])}${field(t, ['flutes', 'Flutes', 'int'])}${field(t, ['len', 'Flute length', 'mm'])}</div></div>`;
  } else {
    editTarget = d.machine;
    html = `<div class="props"><div class="kind">Machine & stock</div><h2>Setup</h2><div class="form">
      <label class="wide"><input type="text" data-k="name" value="${esc(d.machine.name)}" aria-label="Machine name"/></label>
      ${field(d.machine, ['maxRpm', 'Max spindle', 'rpm'])}${field(d.machine, ['rapid', 'Rapid rate', 'feed'])}${field(d.machine, ['safeZ', 'Safe Z', 'mm'])}${field(d.machine, ['toolChange', 'Tool change', 's'])}
      ${field(d.stock, ['material', 'Material', Object.fromEntries(Object.entries(MATERIALS).map(([k, m]) => [k, m.name]))]).replace('data-k="material"', 'data-k="material" data-obj="stock"')}</div>
      <p class="note">G-code is GRBL-flavoured (G21 G90 G54, T# M6, G0/G1 only; peck cycles written out).</p></div>`;
  }
  // summary
  if (state.mode === 'design' && state.mass) {
    const m = state.mass;
    html += `<h3>Part</h3><dl class="stats"><div><dt>Part volume</dt><dd>${num(m.partCm3, 1)} cm³</dd></div><div><dt>Mass</dt><dd>${num(m.massG, 0)} g</dd></div>
      <div><dt>Material removed</dt><dd>${num((m.removedCm3 / m.stockCm3) * 100, 0)} %</dd></div><div><dt>Features</dt><dd>${d.features.length}</dd></div></dl>
      <p class="note">Solid rebuilt by CSG in ${num(state.cadMs || 0, 0)} ms.</p>`;
  }
  if (state.mode === 'manufacture') {
    const R = state.results.filter((r) => r.moves.length);
    const total = R.reduce((s, r) => s + r.time, 0), len = R.reduce((s, r) => s + r.length, 0);
    const tc = new Set(R.map((r) => r.tool.id)).size;
    html += `<h3>Program</h3><dl class="stats"><div><dt>Cycle time</dt><dd>${fmtTime(total)}</dd></div><div><dt>Cutting length</dt><dd>${num(len / 1000, 2)} m</dd></div>
      <div><dt>Tools used</dt><dd>${tc}</dd></div><div><dt>G-code lines</dt><dd>${state.gcode ? state.gcode.lines.length : 0}</dd></div>
      <div><dt>Removed so far</dt><dd>${sim ? num(sim.removed / 1000, 1) : 0} cm³</dd></div><div><dt>To remove</dt><dd>${state.mass ? num(state.mass.removedCm3, 1) : '—'} cm³</dd></div></dl>
      <ul class="optimes">${R.map((r) => `<li><span class="dot" style="background:${OP_COLORS[state.results.indexOf(r) % OP_COLORS.length]};width:8px;height:8px;border-radius:50%"></span><span>${esc(r.label)}</span><span>${fmtTime(r.time)}</span></li>`).join('')}</ul>`;
  }
  $('#right').innerHTML = html;
}
function featureWarnings(f) {
  const { stock } = state.doc, w = [];
  const dep = featureDepth(f, stock);
  if (dep <= 0) w.push('Depth must be greater than zero');
  if (dep > stock.h + 1e-6) w.push('Deeper than the stock');
  const rings = featureRings(f).flat();
  if (f.type !== 'profile' && f.type !== 'face' && rings.some(([x, y]) => x < -0.01 || y < -0.01 || x > stock.w + 0.01 || y > stock.d + 0.01)) w.push('Extends outside the stock');
  if (f.type === 'rectPocket' && f.r * 2 > Math.min(f.w, f.h)) w.push('Corner radius larger than half the pocket width');
  if (f.type === 'slot' && f.width > f.len) w.push('Slot width is larger than its length');
  return w;
}
let pendingSnap = null;
$('#right').addEventListener('focusin', () => { pendingSnap = snap(); });
$('#right').addEventListener('input', (e) => applyField(e.target, false));
$('#right').addEventListener('focusout', () => setTimeout(() => { if (!$('#right').contains(document.activeElement)) renderRight(); }, 0));
$('#right').addEventListener('change', (e) => {
  applyField(e.target, true);
  if (pendingSnap && pendingSnap !== snap()) pushUndo(pendingSnap);
  pendingSnap = snap();
});
$('#right').addEventListener('click', (e) => {
  if (e.target.matches('[data-delsel]') && state.sel.kind === 'feature') commit(() => { state.doc.features = state.doc.features.filter((x) => x.id !== state.sel.id); state.sel = { kind: 'stock' }; });
  if (e.target.matches('[data-dup]') && state.sel.kind === 'feature') {
    const f = state.doc.features.find((x) => x.id === state.sel.id);
    const c = { ...structuredClone(f), id: uid('f'), name: `${f.name} copy` };
    if ('cx' in c) c.cx += 10;
    commit(() => { state.doc.features.push(c); state.sel = { kind: 'feature', id: c.id }; });
  }
});
function applyField(el, final) {
  const k = el.dataset.k; if (!k || !editTarget) return;
  const target = el.dataset.obj === 'stock' ? state.doc.stock : editTarget;
  let v;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.type === 'number') {
    if (el.value === '') { if (['rpm', 'feed'].includes(k)) v = null; else return; }
    else { v = parseFloat(el.value); if (!Number.isFinite(v)) return; }
    if (v != null && !['cx', 'cy', 'angle', 'angle0'].includes(k)) v = Math.max(0, v);
    if (el.dataset.kind === 'int' && v != null) v = Math.max(k === 'tabs' ? 0 : 1, Math.round(v));
    if (['w', 'd', 'h', 'width', 'len', 'flutes', 'maxRpm', 'rapid'].includes(k) && v != null) v = Math.max(k === 'flutes' ? 1 : 0.1, v);
  } else v = el.value;
  target[k] = v;
  if (k === 'toolId' || el.tagName === 'SELECT' || el.type === 'checkbox') { changed(); if (final) renderRight(); }
  else changed();
}

// ── Viewport picking (click a face → select its feature) ───────────────────
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downXY = null;
canvas.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downXY || Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 4 || state.mode !== 'design') return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(part)[0];
  if (!hit) return;
  const p = machine.worldToLocal(hit.point.clone());
  const n = hit.face.normal;    // geometry is in machine coords
  const { stock } = state.doc;
  let found = null;
  for (const f of [...state.doc.features].reverse()) {
    if (f.visible === false) continue;
    const dep = featureDepth(f, stock), rings = featureRings(f);
    const shapes = f.type === 'holes' ? holeCentres(f).map(([x, y]) => circle(x, y, f.d / 2 + 0.3))
      : f.type === 'rectPocket' ? [rrect(f.cx, f.cy, f.w + 0.6, f.h + 0.6, f.r + 0.3)] : f.type === 'circPocket' ? [circle(f.cx, f.cy, f.d / 2 + 0.3)]
        : f.type === 'slot' ? [stadium(f.cx, f.cy, f.len + 0.6, f.width + 0.6, f.angle)] : [];
    if (f.type === 'face' && Math.abs(p.z + f.depth) < 0.05 && n.z > 0.9) { found = f; break; }
    if (f.type === 'profile') { const o = f.shape === 'circle' ? circle(f.cx, f.cy, f.d / 2 - 0.3) : rrect(f.cx, f.cy, f.w - 0.6, f.h - 0.6, Math.max(0, f.r - 0.3)); if (!contains(o, p.x, p.y)) { found = f; break; } continue; }
    if (shapes.some((s) => contains(s, p.x, p.y)) && p.z < 0.01 && p.z >= -dep - 0.5 && rings) { found = f; break; }
  }
  state.sel = found ? { kind: 'feature', id: found.id } : { kind: 'stock' };
  renderLeft(); renderRight(); renderHighlight();
});

// ── Modes, views, files ────────────────────────────────────────────────────
function setMode(m) {
  state.mode = m;
  $('#app').className = `mode-${m}`;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  if (m === 'manufacture' && !['op', 'tool', 'machine'].includes(state.sel.kind)) state.sel = { kind: 'machine' };
  if (m === 'design' && !['feature', 'stock'].includes(state.sel.kind)) state.sel = { kind: 'stock' };
  if (m === 'manufacture' && !state.sel.id && state.sel.kind === 'op') state.sel = { kind: 'machine' };
  renderLeft(); renderRight(); renderHighlight(); buildPaths(); applyVisibility(); resize();
  $('#hud').innerHTML = hudText();
}
function hudText() {
  const d = state.doc;
  return `<b>${esc(d.name)}</b> · ${num(d.stock.w)} × ${num(d.stock.d)} × ${num(d.stock.h)} mm · ${esc(MATERIALS[d.stock.material].name)}<br>${state.mode === 'design' ? 'Click a face to select its feature · drag to orbit · right-drag to pan' : 'Space plays the simulation · Compare shows stock left (amber) and gouges (red)'}`;
}
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
$('#undo').onclick = undo; $('#redo').onclick = redo;
function download(name, blob) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
const slug = () => state.doc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part';
$('#save').onclick = () => download(`${slug()}.cadcam.json`, new Blob([JSON.stringify(state.doc, null, 1)], { type: 'application/json' }));
$('#gcode').onclick = () => { if (!state.gcode) return; download(`${slug()}.nc`, new Blob([state.gcode.text], { type: 'text/plain' })); toast(`Exported ${state.gcode.lines.length} lines of G-code`); };
$('#stl').onclick = () => { const data = new STLExporter().parse(new THREE.Mesh(part.geometry), { binary: true }); download(`${slug()}.stl`, new Blob([data], { type: 'model/stl' })); toast('Exported STL (millimetres, Z up)'); };
$('#project').onchange = (e) => {
  const v = e.target.value; e.target.value = '';
  if (v === 'file') { $('#file').click(); return; }
  if (v === 'new') { pushUndo(snap()); load({ name: 'Untitled part', stock: { w: 100, d: 60, h: 10, material: 'alu' }, machine: { ...state.doc.machine }, tools: structuredClone(DEFAULT_TOOLS), features: [], ops: [] }, { keepUndo: true }); return; }
  if (v) { pushUndo(snap()); load(sampleDoc(v), { keepUndo: true }); }
};
$('#file').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d.stock || !Array.isArray(d.features) || !Array.isArray(d.tools)) throw new Error('bad');
    d.features = d.features.filter((x) => FEATURES[x.type]); d.ops = Array.isArray(d.ops) ? d.ops : [];
    d.machine = { name: 'Desktop VMC (GRBL)', maxRpm: 24000, rapid: 5000, safeZ: 5, toolChange: 15, ...(d.machine || {}) };
    if (!MATERIALS[d.stock.material]) d.stock.material = 'alu';
    pushUndo(snap()); load(d, { keepUndo: true }); toast(`Opened “${d.name || 'part'}”`);
  } catch { toast('Not a CAD/CAM Studio project file'); }
};
let saveT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(STORE, snap()); } catch { /* storage unavailable */ } }, 400); }

function load(doc, { keepView = false, keepUndo = false } = {}) {
  state.doc = syncOps(doc);
  if (!keepUndo) { undoStack.length = 0; redoStack.length = 0; }
  if (state.sel.kind === 'feature' && !doc.features.some((f) => f.id === state.sel.id)) state.sel = { kind: 'stock' };
  stockKey = '';
  rebuildCAD(); rebuildCAM();
  if (!keepView) setView('iso');
  setMode(state.mode);
  syncUndo(); save();
}

// ── Keyboard ───────────────────────────────────────────────────────────────
addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod) return;
  if (k === ' ' && state.mode === 'manufacture') { e.preventDefault(); $('#sim-play').click(); }
  else if (k === '1') setView('iso'); else if (k === '2') setView('top'); else if (k === '3') setView('front'); else if (k === '4') setView('right');
  else if ((k === 'delete' || k === 'backspace') && state.sel.kind === 'feature') { e.preventDefault(); commit(() => { state.doc.features = state.doc.features.filter((x) => x.id !== state.sel.id); state.sel = { kind: 'stock' }; }); }
  else if (k === 'tab') { e.preventDefault(); setMode(state.mode === 'design' ? 'manufacture' : 'design'); }
});

// ── Loop ───────────────────────────────────────────────────────────────────
function resize() {
  const r = $('#view').getBoundingClientRect();
  if (!r.width || !r.height) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
const clock = new THREE.Clock();
let uiT = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.mode === 'manufacture' && sim) {
    if (simState.playing) {
      advance(Math.min(simState.total, simState.t + dt * simState.speed));
      if (simState.t >= simState.total) { simState.playing = false; syncPlay(); }
    }
    sim.update();
    chips.step(dt);
    const p = simState.cur;
    if (p) { toolHolder.position.set(p.x, p.y, p.z); }
    const tm = toolHolder.children[0];
    const seg = simState.segs[Math.min(simState.idx, simState.segs.length - 1)];
    if (tm && seg && !seg.dwell) tm.userData.spin.rotation.y -= dt * 40;
    uiT += dt;
    if (uiT > 0.1) { uiT = 0; updateSimUI(false); if (simState.playing) renderRightStatsLive(); }
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function renderRightStatsLive() {
  const dd = [...document.querySelectorAll('#right .stats dd')];
  const i = [...document.querySelectorAll('#right .stats dt')].findIndex((x) => x.textContent === 'Removed so far');
  if (i >= 0) dd[i].textContent = `${num(sim.removed / 1000, 1)} cm³`;
}

// ── Start ──────────────────────────────────────────────────────────────────
let initial = null;
try { initial = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { initial = null; }
resize();
try { load(initial && initial.stock && Array.isArray(initial.features) ? initial : sampleDoc('plate')); }
catch (e) { console.error(e); load(sampleDoc('plate')); }
requestAnimationFrame(frame);
setTimeout(() => $('#loader').classList.add('done'), 300);
window.__cadcam = { state, simState, seek, setMode, load, sampleDoc, advance, get sim() { return sim; } };
