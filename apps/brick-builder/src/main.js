import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, PH, STUD_R, STUD_H, PARTS, PART, CATS, partGeometry, studdedRow } from './parts.js';
import { COLORS, C } from './colors.js';
import { SAMPLES } from './samples.js';

const $ = (s) => document.querySelector(s);
const STORE = 'brick-builder:v1';
const MAX_LEVEL = 240;          // plates (≈ 77 cm)

// ── Renderer & scene ───────────────────────────────────────────────────────
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 1, 8000);
camera.position.set(250, 270, 360);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 20, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 40;
controls.maxDistance = 1800;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

const sun = new THREE.DirectionalLight('#fff6ea', 2.3);
sun.position.set(220, 420, 160);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.4;
scene.add(sun);
scene.add(new THREE.HemisphereLight('#dfe9ff', '#3a3226', 0.55));
const fill = new THREE.DirectionalLight('#bcd2ff', 0.5); fill.position.set(-300, 160, -200); scene.add(fill);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.28 }));
floor.position.y = -PH; floor.receiveShadow = true; scene.add(floor);

// ── Materials ──────────────────────────────────────────────────────────────
const mats = COLORS.map((c) => (c.trans
  ? new THREE.MeshPhysicalMaterial({ color: c.hex, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.5, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false })
  : new THREE.MeshPhysicalMaterial({ color: c.hex, roughness: 0.3, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.18 })));

// ── State ──────────────────────────────────────────────────────────────────
const state = { tool: 'build', part: 'brick-4x2', color: C.Red, rot: 0, base: 32, baseColor: C.Green, sound: true, replaying: false };
const bricks = new Map();     // id → { id, part, color, x, y, z, rot, mesh }
let nextId = 1;
const group = new THREE.Group(); scene.add(group);

const fp = (part, rot) => (rot % 2 ? [PART[part].d, PART[part].w] : [PART[part].w, PART[part].d]);
/** World cells covered by a brick, with whether each cell is studded on top. */
function cells(b) {
  const p = PART[b.part], [fw, fd] = fp(b.part, b.rot);
  const cx = b.x + fw / 2, cz = b.z + fd / 2, a = (b.rot * Math.PI) / 2, cs = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a));
  const out = [];
  for (let i = 0; i < p.w; i++) for (let j = 0; j < p.d; j++) {
    const lx = i + 0.5 - p.w / 2, lz = j + 0.5 - p.d / 2;
    const wx = lx * cs + lz * sn, wz = -lx * sn + lz * cs;
    out.push({ x: Math.round(cx + wx - 0.5), z: Math.round(cz + wz - 0.5), stud: studdedRow(p, j) });
  }
  return out;
}

// Heightmap of the top of each stud column
let top = new Int16Array(32 * 32), studTop = new Uint8Array(32 * 32);
function rebuildHeights() {
  const N = state.base;
  top = new Int16Array(N * N); studTop = new Uint8Array(N * N).fill(1);
  for (const b of bricks.values()) {
    const t = b.y + PART[b.part].h;
    for (const c of cells(b)) {
      const k = c.z * N + c.x;
      if (c.x < 0 || c.z < 0 || c.x >= N || c.z >= N) continue;
      if (t > top[k]) { top[k] = t; studTop[k] = c.stud ? 1 : 0; }
    }
  }
}

function placeMesh(b) {
  const [fw, fd] = fp(b.part, b.rot);
  const N = state.base;
  b.mesh.position.set((b.x + fw / 2 - N / 2) * P, b.y * PH, (b.z + fd / 2 - N / 2) * P);
  b.mesh.rotation.y = (b.rot * Math.PI) / 2;
}
function addBrick(data, { animate = true, id } = {}) {
  const b = { id: id ?? nextId++, part: data.part, color: data.color, x: data.x, y: data.y, z: data.z, rot: data.rot || 0 };
  nextId = Math.max(nextId, b.id + 1);
  b.mesh = new THREE.Mesh(partGeometry(b.part), mats[b.color]);
  b.mesh.castShadow = !COLORS[b.color].trans; b.mesh.receiveShadow = true;
  b.mesh.userData.id = b.id;
  placeMesh(b);
  if (animate) b.mesh.userData.drop = 1;
  group.add(b.mesh);
  bricks.set(b.id, b);
  return b;
}
function removeBrick(id) {
  const b = bricks.get(id); if (!b) return null;
  group.remove(b.mesh);
  bricks.delete(id);
  return b;
}
const snap = (b) => ({ id: b.id, part: b.part, color: b.color, x: b.x, y: b.y, z: b.z, rot: b.rot });

// ── Undo / redo ────────────────────────────────────────────────────────────
const undoStack = [], redoStack = [];
function apply(ops, dir) {
  const list = dir > 0 ? ops : [...ops].reverse();
  for (const o of list) {
    const kind = dir > 0 ? o.op : { add: 'remove', remove: 'add', paint: 'paint' }[o.op];
    if (kind === 'add') addBrick(o.b, { id: o.b.id, animate: dir > 0 && ops.length < 8 });
    else if (kind === 'remove') removeBrick(o.b.id);
    else if (kind === 'paint') { const b = bricks.get(o.id); if (b) { b.color = dir > 0 ? o.to : o.from; b.mesh.material = mats[b.color]; b.mesh.castShadow = !COLORS[b.color].trans; } }
  }
  changed();
}
function commit(ops) { if (!ops.length) return; undoStack.push(ops); if (undoStack.length > 300) undoStack.shift(); redoStack.length = 0; apply(ops, 1); }
function undo() { const o = undoStack.pop(); if (o) { redoStack.push(o); apply(o, -1); } }
function redo() { const o = redoStack.pop(); if (o) { undoStack.push(o); apply(o, 1); } }

// ── Baseplate ──────────────────────────────────────────────────────────────
let baseplate = null, baseStuds = null;
function buildBase() {
  if (baseplate) { scene.remove(baseplate, baseStuds); baseplate.geometry.dispose(); baseStuds.dispose(); }
  const N = state.base;
  const m = mats[state.baseColor];
  baseplate = new THREE.Mesh(new RoundedBoxGeometry(N * P - 0.2, PH, N * P - 0.2, 2, 0.6).translate(0, -PH / 2, 0), m);
  baseplate.receiveShadow = true; baseplate.castShadow = true;
  baseStuds = new THREE.InstancedMesh(new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 20).translate(0, STUD_H / 2, 0), m, N * N);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { m4.makeTranslation((i + 0.5 - N / 2) * P, 0, (j + 0.5 - N / 2) * P); baseStuds.setMatrixAt(i * N + j, m4); }
  baseStuds.castShadow = true; baseStuds.receiveShadow = true;
  scene.add(baseplate, baseStuds);
  const s = N * P * 0.75;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 50, far: 1600 });
  sun.shadow.camera.updateProjectionMatrix();
  $('#base-color').style.background = COLORS[state.baseColor].hex;
  document.querySelectorAll('#base-size button').forEach((b) => b.classList.toggle('active', +b.dataset.n === N));
}

// ── Ghost & hover ──────────────────────────────────────────────────────────
const ghostMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.4 });
const ghost = new THREE.Mesh(partGeometry(state.part), ghostMat);
ghost.renderOrder = 10; ghost.visible = false; scene.add(ghost);
const hoverBox = new THREE.Box3Helper(new THREE.Box3(), 0xffffff); hoverBox.visible = false; scene.add(hoverBox);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let hover = null;      // { brickId, cellX, cellZ }
let target = null;     // ghost placement { x, y, z, valid }

function pickAt(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...group.children, baseplate, baseStuds], false);
  if (!hits.length) return null;
  const h = hits[0];
  const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
  const probe = h.point.clone().addScaledVector(n, P * 0.3);
  const N = state.base;
  return { brickId: h.object.userData.id ?? null, cellX: Math.floor(probe.x / P + N / 2), cellZ: Math.floor(probe.z / P + N / 2) };
}
function computeTarget() {
  if (!hover) return null;
  const N = state.base, [fw, fd] = fp(state.part, state.rot);
  const x = THREE.MathUtils.clamp(hover.cellX - Math.floor((fw - 1) / 2), 0, N - fw);
  const z = THREE.MathUtils.clamp(hover.cellZ - Math.floor((fd - 1) / 2), 0, N - fd);
  let y = 0;
  for (let i = 0; i < fw; i++) for (let j = 0; j < fd; j++) y = Math.max(y, top[(z + j) * N + x + i]);
  let valid = y + PART[state.part].h <= MAX_LEVEL;
  if (y > 0) for (let i = 0; i < fw; i++) for (let j = 0; j < fd; j++) { const k = (z + j) * N + x + i; if (top[k] === y && !studTop[k]) valid = false; }
  return { x, y, z, valid };
}
function refreshGhost() {
  const building = state.tool === 'build' && !state.replaying;
  target = building ? computeTarget() : null;
  ghost.visible = !!target;
  if (target) {
    ghost.geometry = partGeometry(state.part);
    const [fw, fd] = fp(state.part, state.rot), N = state.base;
    ghost.position.set((target.x + fw / 2 - N / 2) * P, target.y * PH + 0.05, (target.z + fd / 2 - N / 2) * P);
    ghost.rotation.y = (state.rot * Math.PI) / 2;
    ghostMat.color.set(target.valid ? COLORS[state.color].hex : '#ff3b30');
    ghostMat.emissive.set(target.valid ? '#000000' : '#5a0000');
  }
  const hb = !building && hover?.brickId != null && !state.replaying ? bricks.get(hover.brickId) : null;
  hoverBox.visible = !!hb;
  if (hb) { hoverBox.box.setFromObject(hb.mesh).expandByScalar(0.4); hoverBox.material.color.set(state.tool === 'erase' ? '#ff5a4a' : state.tool === 'paint' ? COLORS[state.color].hex : '#ffcf3f'); }
}

// ── Pointer ────────────────────────────────────────────────────────────────
let down = null;
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' && down) return;
  hover = pickAt(e.clientX, e.clientY);
  refreshGhost();
});
canvas.addEventListener('pointerleave', () => { hover = null; refreshGhost(); });
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), b: e.button }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const was = down; down = null;
  if (moved > 6 || was.b !== 0 || performance.now() - was.t > 600 || state.replaying) return;
  hover = pickAt(e.clientX, e.clientY);
  const tool = e.shiftKey ? 'erase' : e.altKey ? 'pick' : state.tool;
  act(tool);
  refreshGhost();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function act(tool) {
  if (!hover) return;
  if (tool === 'build') {
    const t = computeTarget();
    if (!t) return;
    if (!t.valid) { sfx('nope'); toast(t.y + PART[state.part].h > MAX_LEVEL ? 'That’s as high as it goes' : 'Can’t press onto a smooth surface'); return; }
    commit([{ op: 'add', b: { id: nextId++, part: state.part, color: state.color, x: t.x, y: t.y, z: t.z, rot: state.rot } }]);
    sfx('click');
    return;
  }
  const b = hover.brickId != null ? bricks.get(hover.brickId) : null;
  if (!b) return;
  if (tool === 'erase') { commit([{ op: 'remove', b: snap(b) }]); sfx('pop'); }
  else if (tool === 'paint' && b.color !== state.color) { commit([{ op: 'paint', id: b.id, from: b.color, to: state.color }]); sfx('click'); }
  else if (tool === 'pick') { state.part = b.part; state.color = b.color; state.rot = b.rot; setTool('build'); syncUI(); renderThumbs(); toast(`Picked ${PART[b.part].name} · ${COLORS[b.color].name}`); }
}

// ── Sound (tiny synthesized clicks) ────────────────────────────────────────
let actx = null;
function sfx(kind) {
  if (!state.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    const [f0, f1, dur, vol] = { click: [2400, 700, 0.05, 0.18], pop: [500, 160, 0.09, 0.2], nope: [180, 120, 0.12, 0.15] }[kind];
    o.type = kind === 'nope' ? 'square' : 'triangle';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* audio unavailable */ }
}

// ── UI ─────────────────────────────────────────────────────────────────────
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
function setTool(t) { state.tool = t; document.querySelectorAll('#tools button').forEach((b) => b.classList.toggle('active', b.dataset.tool === t)); refreshGhost(); }
document.querySelectorAll('#tools button').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('#rotate').addEventListener('click', () => rotate(1));
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
function rotate(d) { state.rot = (state.rot + d + 4) % 4; refreshGhost(); }

let cat = 'Bricks';
$('#cats').innerHTML = CATS.map((c) => `<button data-c="${c}">${c}</button>`).join('');
$('#cats').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { cat = b.dataset.c; renderGrid(); } });
function renderGrid() {
  document.querySelectorAll('#cats button').forEach((b) => b.classList.toggle('active', b.dataset.c === cat));
  $('#grid').innerHTML = PARTS.filter((p) => p.cat === cat).map((p) => `<button class="part${p.id === state.part ? ' active' : ''}" data-id="${p.id}" title="${p.name}"><img alt="" src="${thumbs[p.id] || ''}" /><span>${p.name.replace(/^(Brick|Plate|Tile|Slope 45°|Round brick|Round plate|Cone) /, '')}</span></button>`).join('');
}
$('#grid').addEventListener('click', (e) => {
  const b = e.target.closest('.part'); if (!b) return;
  state.part = b.dataset.id; setTool('build'); syncUI();
});
$('#swatches').innerHTML = COLORS.map((c, i) => `<button class="sw${c.trans ? ' trans' : ''}" data-i="${i}" title="${c.name}" style="background-color:${c.hex}"></button>`).join('');
$('#swatches').addEventListener('click', (e) => { const b = e.target.closest('.sw'); if (b) setColor(+b.dataset.i); });
function setColor(i) { state.color = (i + COLORS.length) % COLORS.length; syncUI(); renderThumbs(); }
function syncUI() {
  document.querySelectorAll('.sw').forEach((s) => s.classList.toggle('active', +s.dataset.i === state.color));
  document.querySelectorAll('.part').forEach((p) => p.classList.toggle('active', p.dataset.id === state.part));
  if (PART[state.part].cat !== cat) { cat = PART[state.part].cat; renderGrid(); }
  $('#cur-swatch').style.background = COLORS[state.color].hex;
  $('#cur-part').textContent = PART[state.part].name;
  $('#cur-color').textContent = COLORS[state.color].name;
  refreshGhost();
}

// Part thumbnails, rendered in the current colour
const thumbs = {};
const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
tr.setSize(128, 128); tr.toneMapping = THREE.ACESFilmicToneMapping;
const tScene = new THREE.Scene(); tScene.environment = new THREE.PMREMGenerator(tr).fromScene(new RoomEnvironment(), 0.04).texture; tScene.environmentIntensity = 0.6;
const tl = new THREE.DirectionalLight('#ffffff', 2.4); tl.position.set(2, 4, 3); tScene.add(tl, new THREE.HemisphereLight('#ffffff', '#444444', 0.6));
const tCam = new THREE.PerspectiveCamera(30, 1, 1, 1000);
const tMesh = new THREE.Mesh(undefined, mats[0]); tScene.add(tMesh);
let thumbTimer = 0;
function renderThumbs() {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    tMesh.material = COLORS[state.color].trans ? mats[C['Light Bluish Gray']] : mats[state.color];
    for (const p of PARTS) {
      tMesh.geometry = partGeometry(p.id);
      const s = tMesh.geometry.boundingSphere;
      tMesh.position.set(-s.center.x, -s.center.y, -s.center.z);
      tCam.position.set(1, 0.95, 1.35).normalize().multiplyScalar(s.radius / Math.sin((tCam.fov * Math.PI) / 360) * 1.02);
      tCam.lookAt(0, 0, 0);
      tr.render(tScene, tCam);
      thumbs[p.id] = tr.domElement.toDataURL('image/png');
    }
    renderGrid();
  }, 60);
}

// Stats & parts list
function changed() {
  rebuildHeights();
  let h = 0; const bom = new Map();
  for (const b of bricks.values()) {
    h = Math.max(h, b.y + PART[b.part].h);
    const k = `${b.part}|${b.color}`; bom.set(k, (bom.get(k) || 0) + 1);
  }
  $('#s-count').textContent = bricks.size;
  $('#s-height').textContent = ((h * PH) / 10).toFixed(1);
  $('#s-kinds').textContent = bom.size;
  const rows = [...bom.entries()].sort((a, b) => b[1] - a[1]);
  $('#bom').innerHTML = rows.length ? rows.map(([k, n]) => { const [p, c] = k.split('|'); return `<li><b>${n}×</b><i style="background:${COLORS[c].hex}"></i><span>${PART[p].name} · ${COLORS[c].name}</span></li>`; }).join('') : '<li class="empty">Nothing built yet — click the baseplate.</li>';
  $('#undo').disabled = !undoStack.length; $('#redo').disabled = !redoStack.length;
  refreshGhost();
  save();
}

// ── Save / load / samples / export ─────────────────────────────────────────
const serialize = () => ({ v: 1, base: state.base, baseColor: state.baseColor, bricks: [...bricks.values()].sort((a, b) => a.id - b.id).map((b) => [b.part, b.color, b.x, b.y, b.z, b.rot]) });
let saveT = 0;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(serialize())); } catch { /* storage unavailable */ } }, 300); }
function load(data, { undoable = true } = {}) {
  if (!data || !Array.isArray(data.bricks)) return false;
  const valid = data.bricks.filter((r) => Array.isArray(r) && PART[r[0]] && COLORS[r[1]] && Number.isInteger(r[2]) && Number.isInteger(r[3]) && Number.isInteger(r[4]));
  const N = [16, 32, 48].includes(data.base) ? data.base : 32;
  const ops = [...bricks.values()].map((b) => ({ op: 'remove', b: snap(b) }));
  if (N !== state.base) { for (const b of [...bricks.values()]) removeBrick(b.id); ops.length = 0; state.base = N; buildBase(); undoStack.length = redoStack.length = 0; }
  if (COLORS[data.baseColor]) { state.baseColor = data.baseColor; buildBase(); }
  for (const r of valid) ops.push({ op: 'add', b: { id: nextId++, part: r[0], color: r[1], x: r[2], y: r[3], z: r[4], rot: (r[5] | 0) % 4 } });
  if (undoable) commit(ops);
  else { apply(ops, 1); }
  return true;
}
for (const s of SAMPLES) $('#samples').insertAdjacentHTML('beforeend', `<option value="${s.id}">${s.name}</option>`);
$('#samples').addEventListener('change', (e) => {
  const s = SAMPLES.find((x) => x.id === e.target.value); e.target.value = '';
  if (!s) return;
  load({ base: 32, bricks: s.build() });
  toast(`Loaded “${s.name}” — Ctrl+Z to undo`);
  frameBuild();
});
$('#clear').addEventListener('click', () => {
  if (!bricks.size) return;
  commit([...bricks.values()].map((b) => ({ op: 'remove', b: snap(b) })));
  toast('Cleared — Ctrl+Z to undo'); sfx('pop');
});
function download(name, url) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
$('#export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(serialize())], { type: 'application/json' }));
  download('my-build.bricks.json', url); setTimeout(() => URL.revokeObjectURL(url), 2000);
});
$('#import').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { if (load(JSON.parse(await f.text()))) { toast(`Imported ${bricks.size} bricks`); frameBuild(); } else toast('Not a brick build file'); }
  catch { toast('Could not read that file'); }
});
$('#shot').addEventListener('click', () => {
  const g = ghost.visible, hb = hoverBox.visible;
  ghost.visible = hoverBox.visible = false;
  renderer.render(scene, camera);
  download('brick-build.png', canvas.toDataURL('image/png'));
  ghost.visible = g; hoverBox.visible = hb;
});
$('#sound').addEventListener('click', (e) => { state.sound = !state.sound; e.currentTarget.classList.toggle('on', state.sound); });
document.querySelectorAll('#base-size button').forEach((btn) => btn.addEventListener('click', () => {
  const N = +btn.dataset.n; if (N === state.base) return;
  const shift = (N - state.base) / 2;
  const outside = [...bricks.values()].some((b) => cells(b).some((c) => c.x + shift < 0 || c.z + shift < 0 || c.x + shift >= N || c.z + shift >= N));
  if (outside) { toast(`Some bricks don’t fit on ${N}×${N}`); return; }
  for (const b of bricks.values()) { b.x += shift; b.z += shift; }
  state.base = N; buildBase();
  for (const b of bricks.values()) placeMesh(b);
  undoStack.length = redoStack.length = 0;
  changed(); frameBuild();
}));
const BASE_COLORS = [C.Green, C['Light Bluish Gray'], C.Tan, C.Blue, C.White, C['Dark Bluish Gray']];
$('#base-color').addEventListener('click', () => {
  state.baseColor = BASE_COLORS[(BASE_COLORS.indexOf(state.baseColor) + 1) % BASE_COLORS.length];
  buildBase(); save();
});

// Replay the build brick by brick (bottom-up)
$('#replay').addEventListener('click', () => {
  if (state.replaying || !bricks.size) return;
  const list = [...bricks.values()].sort((a, b) => a.y - b.y || a.id - b.id);
  list.forEach((b) => { b.mesh.visible = false; });
  state.replaying = true; refreshGhost();
  const step = THREE.MathUtils.clamp(12000 / list.length, 25, 260);
  let i = 0;
  const tick = () => {
    if (i >= list.length) { state.replaying = false; refreshGhost(); return; }
    const b = list[i++]; b.mesh.visible = true; b.mesh.userData.drop = 1;
    if (i % Math.max(1, Math.round(60 / step)) === 0) sfx('click');
    setTimeout(tick, step);
  };
  tick();
});

function frameBuild() {
  const box = new THREE.Box3();
  for (const b of bricks.values()) box.expandByObject(b.mesh);
  if (box.isEmpty()) box.setFromObject(baseplate);
  const c = box.getCenter(new THREE.Vector3()), r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 60);
  const dir = camera.position.clone().sub(controls.target).normalize();
  flyTo(c, c.clone().addScaledVector(dir, r / Math.sin((camera.fov * Math.PI) / 360) * 1.05));
}
let fly = null;
function flyTo(tgt, pos) { fly = { t0: performance.now(), dur: 900, ft: controls.target.clone(), fp: camera.position.clone(), tgt, pos }; }

// Keyboard
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod) return;
  if (k === 'r') rotate(e.shiftKey ? -1 : 1);
  else if (k === 'b') setTool('build');
  else if (k === 'p') setTool('paint');
  else if (k === 'e') setTool('erase');
  else if (k === 'i') setTool('pick');
  else if (k === 'escape') setTool('build');
  else if (k === '[') setColor(state.color - 1);
  else if (k === ']') setColor(state.color + 1);
  else if (k === 'f') frameBuild();
  else if ((k === 'delete' || k === 'backspace') && hover?.brickId != null) act('erase');
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Loop ───────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const b of bricks.values()) {
    const d = b.mesh.userData.drop;
    if (d > 0) {
      const nd = Math.max(0, d - dt / 0.16);
      b.mesh.userData.drop = nd;
      b.mesh.position.y = b.y * PH + nd * nd * 14;
    }
  }
  if (fly) {
    const k = Math.min(1, (performance.now() - fly.t0) / fly.dur), e = 1 - Math.pow(1 - k, 3);
    controls.target.lerpVectors(fly.ft, fly.tgt, e); camera.position.lerpVectors(fly.fp, fly.pos, e);
    if (k >= 1) fly = null;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ── Start ──────────────────────────────────────────────────────────────────
buildBase();
let restored = false;
try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s && s.bricks?.length) restored = load(s, { undoable: false }); } catch { /* ignore */ }
if (!restored) load({ base: 32, bricks: SAMPLES[0].build() }, { undoable: false });
for (const b of bricks.values()) b.mesh.userData.drop = 0;
undoStack.length = 0; changed();
renderGrid(); syncUI(); renderThumbs();
window.__bricks = { state, bricks, camera, controls, load, SAMPLES, act, pickAt, setTool, frameBuild };
requestAnimationFrame(frame);
setTimeout(() => $('#loader').classList.add('done'), 400);
