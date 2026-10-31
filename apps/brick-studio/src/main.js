import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { PARTS, PART, CATS, COLORS, COLOR, dims } from './catalog.js';
import { Build } from './model.js';
import { partGeometry, baseplateGeometry, PLATE } from './geometry.js';
import { SHAPES, SCHEMES, packBricks, textBuild, mosaic } from './generators.js';
import { SAMPLES } from './samples.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastT; function toast(m, ms = 2600) { const t = $('#toast'); t.innerHTML = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
const q = new URLSearchParams(location.hash.slice(1));

// ── renderer ──
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#dfe5ec');
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7;
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
const sun = new THREE.DirectionalLight('#ffffff', 1.3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target, new THREE.HemisphereLight('#ffffff', '#8a8f96', 0.5));
const table = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: '#c9ced4', roughness: 0.9 })); table.rotation.x = -Math.PI / 2; table.position.y = -0.26; table.receiveShadow = true; scene.add(table);

// ── materials ──
const matCache = new Map();
function material(colorId, kind = 'body') {
  const k = `${colorId}|${kind}|${view.mode}`; if (matCache.has(k)) return matCache.get(k);
  const c = COLOR[colorId]; let m;
  if (kind === 'glass') m = new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.35, depthWrite: false });
  else if (kind === 'dark') m = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6 });
  else if (view.mode === 'xray') m = new THREE.MeshStandardMaterial({ color: c.hex, transparent: true, opacity: 0.28, depthWrite: false, roughness: 0.5 });
  else if (view.mode === 'flat') m = new THREE.MeshLambertMaterial({ color: c.hex });
  else m = new THREE.MeshPhysicalMaterial({ color: c.hex, roughness: c.trans ? 0.08 : 0.32, metalness: ['gold', 'silver'].includes(colorId) ? 0.7 : 0, clearcoat: c.trans ? 0 : 0.35, clearcoatRoughness: 0.25, transparent: c.trans, opacity: c.trans ? 0.55 : 1, depthWrite: !c.trans });
  matCache.set(k, m); return m;
}

// ── state ──
const B = new Build(+(q.get('size') || 32));
const view = { mode: 'real', explode: 0, analysis: false, step: -1 };
const S = { tool: 'build', part: 'brick-2x4', color: 'red', r: 0, free: false, lift: 0, sel: new Set(), clip: null, cat: 'Bricks' };
const world = new THREE.Group(); scene.add(world);
let groups = new Map();   // "part|color" → { mesh, extras, uids }
let base = null;
const off = () => -B.size / 2;

/** Matrix for a placed part: rotate about +y by −r·90°, then shift so the footprint starts at (x, z). */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _Y = new THREE.Vector3(0, 1, 0);
function partMatrix(pp, out = _m, dy = 0) {
  const P = PART[pp.part], r = pp.r & 3, o = [[0, 0], [P.d, 0], [P.w, P.d], [0, P.w]][r];
  _q.setFromAxisAngle(_Y, -r * Math.PI / 2); _p.set(off() + pp.x + o[0], pp.y * PLATE + dy, off() + pp.z + o[1]);
  return out.compose(_p, _q, _s);
}
function buildBase() {
  if (base) { world.remove(base); base.traverse((o) => o.geometry?.dispose()); }
  base = new THREE.Group();
  const { plate, stud } = baseplateGeometry(B.size), m = material(B.base);
  const pm = new THREE.Mesh(plate, m); pm.position.set(off(), 0, off()); pm.receiveShadow = true; pm.userData.base = true; base.add(pm);
  const sm = new THREE.InstancedMesh(stud, m, B.size * B.size); let k = 0;
  for (let i = 0; i < B.size; i++) for (let j = 0; j < B.size; j++) { _m.makeTranslation(off() + i + 0.5, 0, off() + j + 0.5); sm.setMatrixAt(k++, _m); }
  sm.receiveShadow = true; sm.userData.base = true; base.add(sm);
  world.add(base);
  const R = B.size * 0.9; Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: R * 6 }); sun.shadow.camera.updateProjectionMatrix();
  sun.position.set(R * 0.8, R * 2, R * 1.1);
}
/** Rebuild the instanced meshes (optionally only parts in `only`). */
function rebuild() {
  for (const g of groups.values()) { world.remove(g.mesh); for (const e of g.extras) world.remove(e); }
  groups = new Map();
  const visible = view.step >= 0 ? new Set(steps.slice(0, view.step + 1).flat()) : null;
  const by = new Map();
  for (const pp of B.parts) { if (visible && !visible.has(pp.uid)) continue; const k = `${pp.part}|${pp.color}`; if (!by.has(k)) by.set(k, []); by.get(k).push(pp); }
  for (const [k, list] of by) {
    const [pid, cid] = k.split('|'), geo = partGeometry(PART[pid]);
    const mesh = new THREE.InstancedMesh(geo.body, material(cid), list.length); mesh.castShadow = mesh.receiveShadow = view.mode !== 'xray';
    const extras = geo.extras.map((e) => { const em = new THREE.InstancedMesh(e.geo, material(cid, e.mat), list.length); em.castShadow = false; return em; });
    list.forEach((pp, i) => { const dy = view.explode * pp.y * PLATE * 1.6; partMatrix(pp, _m, dy); mesh.setMatrixAt(i, _m); for (const em of extras) em.setMatrixAt(i, _m); });
    mesh.userData.uids = list.map((p) => p.uid);
    world.add(mesh); for (const e of extras) world.add(e);
    groups.set(k, { mesh, extras, uids: mesh.userData.uids });
  }
  overlays();
  stats();
}
// highlighted overlays: selection (blue), floating (red), weak (amber), current instruction step (magenta)
const overlayGroup = new THREE.Group(); world.add(overlayGroup);
const OV = { sel: new THREE.MeshBasicMaterial({ color: '#2f7cff', transparent: true, opacity: 0.35, depthWrite: false }), float: new THREE.MeshBasicMaterial({ color: '#ff2d2d', transparent: true, opacity: 0.5, depthWrite: false }), weak: new THREE.MeshBasicMaterial({ color: '#ffb020', transparent: true, opacity: 0.45, depthWrite: false }), step: new THREE.MeshBasicMaterial({ color: '#ff2bd6', transparent: true, opacity: 0.4, depthWrite: false }) };
let analysis = null;
function overlays() {
  for (const c of [...overlayGroup.children]) overlayGroup.remove(c);
  const add = (uids, mat) => {
    const by = new Map(); for (const u of uids) { const pp = B.byUid(u); if (!pp) continue; if (!by.has(pp.part)) by.set(pp.part, []); by.get(pp.part).push(pp); }
    for (const [pid, list] of by) { const m = new THREE.InstancedMesh(partGeometry(PART[pid]).body, mat, list.length); list.forEach((pp, i) => { partMatrix(pp, _m, view.explode * pp.y * PLATE * 1.6); _m.scale(new THREE.Vector3(1.01, 1.01, 1.01)); m.setMatrixAt(i, _m); }); m.renderOrder = 5; overlayGroup.add(m); }
  };
  if (S.sel.size) add(S.sel, OV.sel);
  if (view.analysis) { analysis = B.stability(); add(analysis.weak, OV.weak); add(analysis.floating, OV.float); }
  if (view.step >= 0 && steps[view.step]) add(steps[view.step], OV.step);
}

// ── ghost (placement preview) ──
const ghostMat = new THREE.MeshBasicMaterial({ color: '#33dd77', transparent: true, opacity: 0.45, depthWrite: false });
let ghost = null, ghostPP = null;
function setGhost(pp, ok) {
  if (!pp) { if (ghost) ghost.visible = false; ghostPP = null; return; }
  if (!ghost || ghost.userData.part !== pp.part) { if (ghost) world.remove(ghost); ghost = new THREE.Mesh(partGeometry(PART[pp.part]).body, ghostMat); ghost.userData.part = pp.part; ghost.renderOrder = 6; world.add(ghost); }
  ghost.visible = true; partMatrix(pp, ghost.matrix); ghost.matrixAutoUpdate = false;
  ghostMat.color.set(ok ? COLOR[S.color].hex : '#ff3030'); ghostMat.opacity = ok ? 0.55 : 0.4;
  ghostPP = ok ? pp : null;
}

// ── picking ──
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const _n3 = new THREE.Matrix3(), _im = new THREE.Matrix4();
function pick(ev) {
  const r = canvas.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const targets = [...[...groups.values()].map((g) => g.mesh), ...base.children];
  const hits = ray.intersectObjects(targets, false);
  for (const h of hits) {
    if (h.object.userData.base) return { base: true, point: h.point, normal: new THREE.Vector3(0, 1, 0) };
    const uid = h.object.userData.uids?.[h.instanceId]; if (!uid) continue;
    h.object.getMatrixAt(h.instanceId, _im); const n = h.face.normal.clone().applyMatrix3(_n3.getNormalMatrix(_im)).normalize();
    return { uid, point: h.point, normal: n };
  }
  // empty table: project onto y = 0
  const t = -ray.ray.origin.y / ray.ray.direction.y; if (t > 0) return { base: true, point: ray.ray.origin.clone().addScaledVector(ray.ray.direction, t), normal: new THREE.Vector3(0, 1, 0), off: true };
  return null;
}
/** Find where the current part would go for a pick. */
function candidate(hit) {
  const P = PART[S.part], [fw, fd] = dims(P, S.r);
  const gx = (v) => Math.floor(v - off()), n = hit.normal;
  let cx, cz, y;
  if (hit.base) { cx = gx(hit.point.x); cz = gx(hit.point.z); y = 0; }
  else {
    const hp = B.byUid(hit.uid), HP = PART[hp.part];
    if (n.y > 0.5) { cx = gx(hit.point.x - n.x * 0.01); cz = gx(hit.point.z - n.z * 0.01); y = Math.floor(hit.point.y / PLATE + 0.02); y = Math.min(y, hp.y + HP.h); }
    else if (n.y < -0.5) { cx = gx(hit.point.x); cz = gx(hit.point.z); y = hp.y - P.h; }
    else { cx = gx(hit.point.x + n.x * 0.5); cz = gx(hit.point.z + n.z * 0.5); y = hp.y; }
  }
  const pp = { part: S.part, color: S.color, r: S.r, x: cx - Math.floor((fw - 1) / 2), z: cz - Math.floor((fd - 1) / 2), y: Math.max(0, y + S.lift) };
  if (B.canPlace(pp, { free: S.free })) return { pp, ok: true };
  if (!hit.base && Math.abs(n.y) < 0.5 && !S.lift) {   // beside a part: slide down until it connects (like dropping it in)
    for (let yy = pp.y - 1; yy >= 0; yy--) { const c = { ...pp, y: yy }; if (B.collides(c)) break; if (B.canPlace(c, { free: S.free })) return { pp: c, ok: true }; }
  }
  return { pp, ok: false };
}

// ── input ──
let down = null, boxEl = $('#selbox');
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointermove', (e) => {
  if (down && S.tool === 'select' && e.buttons === 1) { const x0 = Math.min(down.x, e.clientX), y0 = Math.min(down.y, e.clientY); const r = canvas.getBoundingClientRect(); Object.assign(boxEl.style, { display: 'block', left: `${x0 - r.left}px`, top: `${y0 - r.top}px`, width: `${Math.abs(e.clientX - down.x)}px`, height: `${Math.abs(e.clientY - down.y)}px` }); return; }
  if (e.buttons & 2 || view.step >= 0) return;
  const hit = pick(e);
  if (S.tool === 'build' && hit) { const c = candidate(hit); setGhost(c.pp, c.ok); } else setGhost(null);
  hover = hit && hit.uid;
});
let hover = null;
canvas.addEventListener('pointerdown', (e) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (e.button !== 0 || !down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5, start = down; down = null; boxEl.style.display = 'none';
  if (view.step >= 0) return;
  if (S.tool === 'select' && moved) return boxSelect(start, e, e.shiftKey);
  if (moved) return;
  const hit = pick(e);
  const tool = e.shiftKey && S.tool === 'build' ? 'erase' : e.altKey ? 'pickc' : S.tool;
  if (tool === 'build') { if (hit) { const c = candidate(hit); if (c.ok) { B.addPart(c.pp); sfx(); } else toast(B.collides(c.pp) ? 'Something is in the way' : !B.inBounds(c.pp) ? 'Off the baseplate' : 'No studs to connect to here — turn on Free placement to place it anyway'); } }
  else if (tool === 'erase') { if (hit?.uid) B.remove([hit.uid]); }
  else if (tool === 'paint') { if (hit?.uid) B.paint([hit.uid], S.color); }
  else if (tool === 'pickc') { if (hit?.uid) { const pp = B.byUid(hit.uid); S.color = pp.color; S.part = pp.part; S.r = pp.r; renderPalette(); renderParts(); } }
  else if (tool === 'select') { if (hit?.uid) { if (e.shiftKey) { S.sel.has(hit.uid) ? S.sel.delete(hit.uid) : S.sel.add(hit.uid); } else { S.sel = new Set([hit.uid]); } } else if (!e.shiftKey) S.sel.clear(); overlays(); inspector(); }
});
function boxSelect(a, b, add) {
  const r = canvas.getBoundingClientRect(), x0 = Math.min(a.x, b.clientX) - r.left, x1 = Math.max(a.x, b.clientX) - r.left, y0 = Math.min(a.y, b.clientY) - r.top, y1 = Math.max(a.y, b.clientY) - r.top;
  if (!add) S.sel.clear();
  const v = new THREE.Vector3();
  for (const pp of B.parts) { const P = PART[pp.part], [fw, fd] = dims(P, pp.r); v.set(off() + pp.x + fw / 2, (pp.y + P.h / 2) * PLATE, off() + pp.z + fd / 2).project(camera); const sx = (v.x * 0.5 + 0.5) * r.width, sy = (-v.y * 0.5 + 0.5) * r.height; if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1 && v.z < 1) S.sel.add(pp.uid); }
  overlays(); inspector(); toast(`${S.sel.size} parts selected`);
}
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? B.doRedo() : B.doUndo(); return; }
  if (mod && k === 'y') { e.preventDefault(); B.doRedo(); return; }
  if (mod && k === 'a') { e.preventDefault(); S.sel = new Set(B.parts.map((p) => p.uid)); setTool('select'); overlays(); inspector(); return; }
  if (mod && k === 'c') { copySel(); return; }
  if (mod && k === 'v') { paste(); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return; }
  if (k === 'r') { if (S.tool === 'select' && S.sel.size) rotSel(e.shiftKey ? -1 : 1); else { S.r = (S.r + (e.shiftKey ? 3 : 1)) & 3; refreshGhost(); } }
  if (k === 'b') setTool('build'); if (k === 's' && !mod) setTool('select'); if (k === 'p') setTool('paint'); if (k === 'e') setTool('erase'); if (k === 'i') setTool('pickc');
  if (k === 'f') frame();
  if (k === 'm' && S.sel.size) mirrorSel('x');
  if (k === 'delete' || k === 'backspace') { if (S.sel.size) { B.remove([...S.sel]); S.sel.clear(); } else if (hover) B.remove([hover]); }
  if (k === 'escape') { S.sel.clear(); overlays(); inspector(); }
  if (k === '[' || k === ']') { const i = COLORS.findIndex((c) => c.id === S.color); S.color = COLORS[(i + (k === ']' ? 1 : COLORS.length - 1)) % COLORS.length].id; renderPalette(); refreshGhost(); }
  const mv = { arrowleft: [-1, 0, 0], arrowright: [1, 0, 0], arrowup: [0, 0, -1], arrowdown: [0, 0, 1], pageup: [0, 1, 0], pagedown: [0, -1, 0] }[k];
  if (mv) { e.preventDefault(); if (S.sel.size) { const step = k.startsWith('page') ? (e.shiftKey ? 3 : 1) : 1; if (!B.transformSel([...S.sel], { dx: mv[0], dy: mv[1] * step, dz: mv[2] }, { free: true })) toast('Blocked'); } else if (k.startsWith('page')) { S.lift += mv[1]; toast(`Height offset ${S.lift} plates (free placement)`); if (S.lift) S.free = true; $('#free').checked = S.free; } }
});
function refreshGhost() { setGhost(null); }
function setTool(t) { S.tool = t; document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t)); controls.mouseButtons.LEFT = null; setGhost(null); canvas.style.cursor = t === 'build' ? 'crosshair' : t === 'select' ? 'default' : 'pointer'; }
document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
function rotSel(d) { if (!B.transformSel([...S.sel], { rot: d })) toast('Can\'t rotate here — something is in the way'); }
function mirrorSel(ax) { if (!B.transformSel([...S.sel], { mirror: ax })) toast('Can\'t mirror here'); }
function copySel() { if (!S.sel.size) return; S.clip = B.parts.filter((p) => S.sel.has(p.uid)).map((p) => ({ ...p })); toast(`Copied ${S.clip.length} parts`); }
function paste() {
  if (!S.clip) return;
  const minY = Math.min(...S.clip.map((p) => p.y)), maxTop = Math.max(...B.parts.map((p) => p.y + PART[p.part].h), 0);
  for (const dy of [maxTop - minY, maxTop - minY + 3]) { const list = S.clip.map((p) => ({ ...p, y: p.y + dy })); if (list.every((m) => B.inBounds(m) && !B.collides(m))) { const ids = B.addMany(list, 'paste').map((p) => p.uid); S.sel = new Set(ids); setTool('select'); overlays(); toast('Pasted on top — move it with the arrow keys and PageUp/PageDown'); return; } }
  toast('No room to paste');
}
function duplicateSel() { if (!S.sel.size) return; const sel = B.parts.filter((p) => S.sel.has(p.uid)); const w = Math.max(...sel.map((p) => p.x + dims(PART[p.part], p.r)[0])) - Math.min(...sel.map((p) => p.x)); for (const [dx, dz] of [[w, 0], [-w, 0], [0, w], [0, -w]]) { const ids = B.duplicate([...S.sel], dx, 0, dz); if (ids) { S.sel = new Set(ids); overlays(); toast('Duplicated'); return; } } toast('No room beside the selection'); }

// ── change handling ──
let steps = [];
B.on((what) => { if (view.step >= 0 && what !== 'step') exitSteps(); for (const u of [...S.sel]) if (!B.byUid(u)) S.sel.delete(u); rebuild(); inspector(); if (activeTab === 'bom') renderBOM(); if (activeTab === 'check') renderCheck(); save(); });
function save() { try { localStorage.setItem('brick-studio', JSON.stringify(B.toJSON())); } catch { /* storage unavailable */ } }

// ── stats / inspector ──
function stats() {
  const { tot } = B.bom(), st = B.stability();
  $('#stats').innerHTML = `<span><b>${tot.parts.toLocaleString()}</b> parts</span><span><b>${tot.kinds}</b> kinds</span><span><b>${(tot.grams / 1000 >= 1 ? (tot.grams / 1000).toFixed(2) + ' kg' : Math.round(tot.grams) + ' g')}</b></span><span><b>${(st.height * 0.32).toFixed(1)}</b> cm tall</span><span><b>₹${Math.round(tot.price).toLocaleString('en-IN')}</b> est.</span>${st.floating.length ? `<span class="bad">${st.floating.length} floating</span>` : ''}`;
  $('#undo').disabled = !B.undo.length; $('#redo').disabled = !B.redo.length;
}
function inspector() {
  const el = $('#inspector');
  if (!S.sel.size) { el.innerHTML = `<p class="muted">Select parts with the Select tool (<kbd>S</kbd>): click, Shift-click to add, or drag a box. <kbd>Ctrl</kbd>+<kbd>A</kbd> selects everything.</p>`; return; }
  const sel = B.parts.filter((p) => S.sel.has(p.uid)), counts = {};
  for (const p of sel) counts[p.part] = (counts[p.part] || 0) + 1;
  el.innerHTML = `<p><b>${sel.length}</b> selected · ${Object.entries(counts).slice(0, 4).map(([k, n]) => `${n}× ${esc(PART[k].name)}`).join(', ')}${Object.keys(counts).length > 4 ? '…' : ''}</p>
    <div class="grid3"><button data-act="rotl">⟲ Rotate</button><button data-act="rotr">⟳ Rotate</button><button data-act="mirx">⇋ Mirror</button><button data-act="mirz">⇵ Mirror</button><button data-act="dup">⧉ Duplicate</button><button data-act="copy">Copy</button><button data-act="paint">🖌 Paint</button><button data-act="del" class="danger">Delete</button><button data-act="none">Deselect</button></div>
    <p class="muted">Move with the arrow keys, raise or lower with PageUp / PageDown.</p>`;
}
$('#inspector').addEventListener('click', (e) => { const a = e.target.closest('[data-act]')?.dataset.act; if (!a) return; ({ rotl: () => rotSel(-1), rotr: () => rotSel(1), mirx: () => mirrorSel('x'), mirz: () => mirrorSel('z'), dup: duplicateSel, copy: copySel, paint: () => B.paint([...S.sel], S.color), del: () => { B.remove([...S.sel]); S.sel.clear(); }, none: () => { S.sel.clear(); overlays(); inspector(); } })[a](); });

// colour replace
const colOpts = COLORS.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
$('#rfrom').innerHTML = colOpts; $('#rto').innerHTML = colOpts; $('#rto').value = 'blue';
$('#rgo').addEventListener('click', () => { const n = B.replaceColor($('#rfrom').value, $('#rto').value); toast(`${n} parts recoloured`); });

// ── thumbnails ──
const thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); thumbR.setSize(96, 96); thumbR.setPixelRatio(1); thumbR.toneMapping = THREE.ACESFilmicToneMapping;
const thumbScene = new THREE.Scene(); thumbScene.environment = scene.environment; thumbScene.add(new THREE.DirectionalLight('#fff', 2).translateX(2).translateY(4).translateZ(3), new THREE.AmbientLight('#fff', 0.6));
const thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const thumbCache = new Map();
function thumb(pid, cid) {
  const k = `${pid}|${cid}`; if (thumbCache.has(k)) return thumbCache.get(k);
  const P = PART[pid], g = partGeometry(P), m = new THREE.Mesh(g.body, material(cid)); const ex = g.extras.map((e) => new THREE.Mesh(e.geo, material(cid, e.mat)));
  const grp = new THREE.Group(); grp.add(m, ...ex); grp.position.set(-P.w / 2, -P.h * PLATE / 2, -P.d / 2); thumbScene.add(grp);
  const R = Math.max(P.w, P.d, P.h * PLATE) * 1.05 + 0.6; thumbCam.position.set(R * 1.6, R * 1.3, R * 2.0); thumbCam.lookAt(0, 0, 0);
  thumbR.render(thumbScene, thumbCam); const url = thumbR.domElement.toDataURL(); thumbScene.remove(grp);
  thumbCache.set(k, url); return url;
}

// ── parts & palette panels ──
function renderParts() {
  $('#cats').innerHTML = CATS.map((c) => `<button data-cat="${esc(c)}" class="${c === S.cat ? 'active' : ''}">${esc(c)}</button>`).join('');
  const list = PARTS.filter((p) => p.cat === S.cat), f = $('#psearch').value.trim().toLowerCase();
  const shown = f ? PARTS.filter((p) => (p.name + ' ' + p.ldraw).toLowerCase().includes(f)) : list;
  $('#parts').innerHTML = shown.map((p) => `<button data-part="${p.id}" class="${p.id === S.part ? 'active' : ''}" title="${esc(p.name)} · ${p.ldraw}"><img src="${thumb(p.id, S.color === 'tclear' ? 'lbg' : S.color)}" alt=""><span>${esc(p.name)}</span></button>`).join('');
}
$('#cats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; S.cat = b.dataset.cat; $('#psearch').value = ''; renderParts(); });
$('#parts').addEventListener('click', (e) => { const b = e.target.closest('[data-part]'); if (!b) return; S.part = b.dataset.part; setTool('build'); renderParts(); });
$('#psearch').addEventListener('input', renderParts);
function renderPalette() {
  $('#palette').innerHTML = COLORS.map((c) => `<button data-color="${c.id}" class="${c.id === S.color ? 'active' : ''} ${c.trans ? 'trans' : ''}" style="--c:${c.hex}" title="${esc(c.name)} · LDraw ${c.ldraw} · BrickLink ${c.bl}"></button>`).join('');
  $('#cname').textContent = COLOR[S.color].name;
  clearTimeout(renderPalette.t); renderPalette.t = setTimeout(renderParts, 60);
}
$('#palette').addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (!b) return; S.color = b.dataset.color; renderPalette(); });
$('#free').addEventListener('change', (e) => { S.free = e.target.checked; if (!S.free) S.lift = 0; });
$('#undo').addEventListener('click', () => B.doUndo()); $('#redo').addEventListener('click', () => B.doRedo());
$('#rot').addEventListener('click', () => { S.r = (S.r + 1) & 3; });

// ── right-hand tabs ──
let activeTab = 'edit';
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { activeTab = b.dataset.tab; document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b)); document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('show', t.id === `tab-${activeTab}`)); if (activeTab === 'bom') renderBOM(); if (activeTab === 'check') { view.analysis = true; overlays(); renderCheck(); } else if (view.analysis) { view.analysis = false; overlays(); } if (activeTab === 'steps') enterSteps(); else if (view.step >= 0) exitSteps(); }));

// parts list
function renderBOM() {
  const { rows, tot } = B.bom();
  $('#bom').innerHTML = rows.length ? `<table><tr><th></th><th>Part</th><th>No.</th><th>Colour</th><th>Qty</th></tr>${rows.map((r) => `<tr><td><img src="${thumb(r.part.id, r.color.id)}"></td><td>${esc(r.part.name)}</td><td>${r.part.ldraw}</td><td><i style="background:${r.color.hex}"></i>${esc(r.color.name)}</td><td><b>${r.n}</b></td></tr>`).join('')}</table>` : '<p class="muted">Nothing built yet.</p>';
  $('#bomtot').innerHTML = `<b>${tot.parts}</b> parts in <b>${tot.kinds}</b> part/colour combinations · ${tot.studs.toLocaleString()} studs · ≈ ${Math.round(tot.grams)} g · ≈ ₹${Math.round(tot.price).toLocaleString('en-IN')} (illustrative)`;
}
// stability check
function renderCheck() {
  const st = analysis || B.stability();
  const [cx, cz] = st.com, inside = cx > 0 && cx < B.size && cz > 0 && cz < B.size;
  $('#check').innerHTML = `<ul class="checks">
    <li class="${st.floating.length ? 'bad' : 'ok'}"><b>${st.floating.length ? `${st.floating.length} floating part${st.floating.length > 1 ? 's' : ''}` : 'Every part is connected'}</b><span>${st.floating.length ? 'Shown in red: not connected to the baseplate through studs. In real life they would fall.' : 'Every part connects to the baseplate through studs.'}</span></li>
    <li class="${st.weak.length ? 'warn' : 'ok'}"><b>${st.weak.length} weak joint${st.weak.length === 1 ? '' : 's'}</b><span>Shown in amber: parts held by a single stud. They twist and snap off easily; overlap them with a bigger part.</span></li>
    <li class="${inside ? 'ok' : 'warn'}"><b>Centre of mass</b><span>${(cx).toFixed(1)}, ${(cz).toFixed(1)} studs from the corner · total ≈ ${Math.round(st.mass)} g · ${(st.height * 0.32).toFixed(1)} cm tall</span></li></ul>
    ${st.floating.length ? '<button class="btn primary" id="drop">▼ Drop test: let the floating parts fall</button>' : ''}`;
  $('#drop')?.addEventListener('click', dropTest);
}
function dropTest() {
  const plan = B.dropPlan(); if (!plan.length) return;
  const t0 = performance.now(), anims = plan.map((p) => ({ ...p, meshes: [] }));
  // animate by moving matrices of the affected instances, then commit
  const g = 9.81 / 0.008 * 0.15;   // studs/s² (scaled down so the fall is visible)
  const tick = () => {
    const t = (performance.now() - t0) / 1000; let done = true;
    for (const a of anims) { const dist = Math.min(a.dy * PLATE, 0.5 * g * t * t); if (dist < a.dy * PLATE) done = false; for (const u of a.uids) moveInstance(u, -dist); }
    if (!done) requestAnimationFrame(tick); else { B.applyDrop(plan); toast(`${plan.reduce((s, p) => s + p.uids.length, 0)} parts fell and landed`); }
  };
  tick();
}
function moveInstance(uid, dy) { const pp = B.byUid(uid), g = groups.get(`${pp.part}|${pp.color}`); if (!g) return; const i = g.uids.indexOf(uid); partMatrix(pp, _m, dy); g.mesh.setMatrixAt(i, _m); g.mesh.instanceMatrix.needsUpdate = true; for (const e of g.extras) { e.setMatrixAt(i, _m); e.instanceMatrix.needsUpdate = true; } }

// instructions
function enterSteps() { steps = B.instructions(+$('#perstep').value); view.step = steps.length ? 0 : -1; S.sel.clear(); setGhost(null); rebuild(); renderStep(); }
function exitSteps() { view.step = -1; rebuild(); $('#stepview').innerHTML = ''; }
function renderStep() {
  if (view.step < 0) { $('#stepview').innerHTML = '<p class="muted">Build something first.</p>'; return; }
  const s = steps[view.step], counts = new Map();
  for (const u of s) { const p = B.byUid(u), k = `${p.part}|${p.color}`; counts.set(k, (counts.get(k) || 0) + 1); }
  $('#stepview').innerHTML = `<div class="stephead"><button id="sprev" class="btn">◀</button><b>Step ${view.step + 1} / ${steps.length}</b><button id="snext" class="btn">▶</button><button id="splay" class="btn">▶ Play</button></div>
    <div class="callout">${[...counts].map(([k, n]) => { const [pid, cid] = k.split('|'); return `<div><img src="${thumb(pid, cid)}"><b>${n}×</b><small>${esc(PART[pid].name)}</small></div>`; }).join('')}</div>`;
  $('#sprev').onclick = () => { if (view.step > 0) { view.step--; rebuild(); renderStep(); } };
  $('#snext').onclick = () => { if (view.step < steps.length - 1) { view.step++; rebuild(); renderStep(); } };
  $('#splay').onclick = () => { view.step = 0; rebuild(); renderStep(); const iv = setInterval(() => { if (view.step < 0 || view.step >= steps.length - 1) return clearInterval(iv); view.step++; rebuild(); renderStep(); }, 700); };
}
$('#perstep').addEventListener('change', () => { if (activeTab === 'steps') enterSteps(); });
$('#booklet').addEventListener('click', async () => {
  if (!steps.length) return;
  toast('Rendering the instruction booklet…');
  const pages = []; const keep = view.step;
  for (let i = 0; i < steps.length; i++) { view.step = i; rebuild(); renderer.render(scene, camera); const img = canvas.toDataURL('image/jpeg', 0.85); const counts = new Map(); for (const u of steps[i]) { const p = B.byUid(u), k = `${p.part}|${p.color}`; counts.set(k, (counts.get(k) || 0) + 1); } pages.push({ img, counts }); await new Promise((r) => setTimeout(r, 0)); }
  view.step = keep; rebuild();
  const html = `<!doctype html><meta charset="utf-8"><title>Building instructions</title><style>body{font:14px Inter,system-ui,sans-serif;margin:0}.p{page-break-after:always;padding:18px;display:grid;grid-template-columns:200px 1fr;gap:14px;align-items:start;border-bottom:1px solid #ddd}.n{font-size:40px;font-weight:800}.c div{display:flex;align-items:center;gap:8px;margin:4px 0}.c img{width:56px;height:56px}img.s{width:100%;border-radius:8px}</style>
    <h1 style="padding:18px">Building instructions · ${steps.length} steps · ${B.parts.length} parts</h1>${pages.map((p, i) => `<div class="p"><div><div class="n">${i + 1}</div><div class="c">${[...p.counts].map(([k, n]) => { const [pid, cid] = k.split('|'); return `<div><img src="${thumb(pid, cid)}"><b>${n}×</b> ${esc(PART[pid].name)}<br><small>${esc(COLOR[cid].name)}</small></div>`; }).join('')}</div></div><img class="s" src="${p.img}"></div>`).join('')}`;
  const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } else download(new Blob([html], { type: 'text/html' }), 'instructions.html');
});

// generators
$('#gshape').innerHTML = Object.entries(SHAPES).map(([k, s]) => `<option value="${k}">${esc(s.name)}</option>`).join('');
function renderGenParams() { const s = SHAPES[$('#gshape').value]; $('#gparams').innerHTML = Object.entries(s.params).map(([n, [a, b, v]]) => `<label class="slider"><span>${n} <b id="gv-${n}">${v}</b></span><input type="range" data-gp="${n}" min="${a}" max="${b}" value="${v}"></label>`).join(''); }
$('#gshape').addEventListener('change', renderGenParams);
$('#gparams').addEventListener('input', (e) => { const n = e.target.dataset.gp; if (n) $(`#gv-${n}`).textContent = e.target.value; });
function scheme() { const s = $('#gscheme').value; return s === 'solid' ? SCHEMES.solid(S.color) : s === 'stripes' ? SCHEMES.stripes(S.color, 'white') : SCHEMES[s](); }
/** Add generated parts, dropping anything that would collide and anything left unsupported. */
function addGenerated(list, label) {
  const T = new Build(B.size); T.parts = B.parts.map((p) => ({ ...p })); T.nextUid = B.nextUid; T.reindex();
  const added = []; for (const pp of list) if (T.inBounds(pp) && !T.collides(pp)) added.push(T.addPart(pp, false));
  const st = T.stability(), fl = new Set(st.floating), keep = added.filter((p) => !fl.has(p.uid)).map(({ uid, ...p }) => p);
  B.addMany(keep, label); toast(`Added ${keep.length} parts${added.length - keep.length ? ` (${added.length - keep.length} unsupported left out)` : ''}`);
}
$('#ggo').addEventListener('click', () => {
  const s = SHAPES[$('#gshape').value], params = {}; document.querySelectorAll('[data-gp]').forEach((i) => (params[i.dataset.gp] = +i.value));
  addGenerated(packBricks(s.make(params, B.size, scheme())), 'generate'); frame();
});
$('#tgo').addEventListener('click', () => { const t = $('#gtext').value || 'HELLO'; addGenerated(packBricks(textBuild(t, B.size, scheme())), 'text'); frame(); });
$('#mfile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  const img = await createImageBitmap(f), n = Math.min(+$('#msize').value, B.size);
  const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
  const s = Math.min(img.width, img.height); g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, n, n);
  const data = g.getImageData(0, 0, n, n).data;
  const pal = $('#mpal').value === 'grey' ? COLORS.filter((c) => ['white', 'lbg', 'dbg', 'black'].includes(c.id)) : $('#mpal').value === 'warm' ? COLORS.filter((c) => ['white', 'tan', 'dtan', 'rbrown', 'yellow', 'orange', 'red', 'dred', 'black', 'blorange'].includes(c.id)) : undefined;
  const x0 = Math.floor((B.size - n) / 2), z0 = x0;
  const res = mosaic(data, n, { palette: pal, dither: $('#mdither').checked, style: $('#mstyle').value, x0, z0 });
  B.addMany(res.parts.filter((p) => B.inBounds(p) && !B.collides(p)), 'mosaic'); toast(`Mosaic: ${res.parts.length} parts in ${res.colors} colours`); e.target.value = '';
  camera.position.set(0, B.size * 1.6, B.size * 0.3); controls.target.set(0, 0, 0);
});

// files
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
$('#exjson').addEventListener('click', () => download(new Blob([JSON.stringify(B.toJSON())], { type: 'application/json' }), 'build.brick.json'));
$('#exldr').addEventListener('click', () => download(new Blob([B.toLDraw()], { type: 'text/plain' }), 'build.ldr'));
$('#exbl').addEventListener('click', () => { download(new Blob([B.toBrickLinkXML()], { type: 'text/xml' }), 'bricklink-wanted-list.xml'); toast('Upload it at BrickLink → Wanted → Upload'); });
$('#excsv').addEventListener('click', () => download(new Blob([B.toCSV()], { type: 'text/csv' }), 'parts-list.csv'));
$('#bomcsv').addEventListener('click', () => $('#excsv').click()); $('#bombl').addEventListener('click', () => $('#exbl').click());
$('#expng').addEventListener('click', () => { setGhost(null); renderer.render(scene, camera); canvas.toBlob((b) => download(b, 'build.png')); });
$('#exglb').addEventListener('click', () => { new GLTFExporter().parse(world, (glb) => download(new Blob([glb], { type: 'model/gltf-binary' }), 'build.glb'), (e) => toast(`GLB export failed: ${e}`), { binary: true }); });
$('#open').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return; const text = await f.text();
  if (/\.(ldr|mpd|dat)$/i.test(f.name)) { const r = B.fromLDraw(text); B.load({ size: B.size, base: B.base, parts: r.parts }, 'open'); toast(`Imported ${r.parts.length} parts${r.skipped ? `, ${r.skipped} unknown parts skipped` : ''}`); }
  else { try { B.load(JSON.parse(text)); buildBase(); toast('Opened'); } catch { toast('Not a Brick Studio file'); } }
  frame(); e.target.value = '';
});
$('#new').addEventListener('click', () => { B.size = +$('#nsize').value; B.base = $('#nbase').value; B.clear(); buildBase(); rebuild(); frame(); });
$('#nbase').innerHTML = ['green', 'lbg', 'dbg', 'blue', 'tan', 'white', 'black'].map((c) => `<option value="${c}">${COLOR[c].name}</option>`).join('');
$('#samples').innerHTML = Object.entries(SAMPLES).map(([k, s]) => `<button class="btn" data-sample="${k}">${esc(s.name)}</button>`).join('');
$('#samples').addEventListener('click', (e) => { const b = e.target.closest('[data-sample]'); if (!b) return; loadSample(b.dataset.sample); });
function loadSample(k) { const s = SAMPLES[k]; B.load(s.make(), 'sample'); buildBase(); frame(); toast(`${s.name}: ${B.parts.length} parts`); }

// view options
document.querySelectorAll('[data-vmode]').forEach((b) => b.addEventListener('click', () => { view.mode = b.dataset.vmode; document.querySelectorAll('[data-vmode]').forEach((x) => x.classList.toggle('active', x === b)); buildBase(); rebuild(); }));
$('#explode').addEventListener('input', (e) => { view.explode = +e.target.value; rebuild(); });
$('#frame').addEventListener('click', frame);
document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => { const R = Math.max(12, B.size * 0.9); const c = b.dataset.cam; const t = controls.target; if (c === 'top') camera.position.set(t.x, R * 2, t.z + 0.01); if (c === 'front') camera.position.set(t.x, R * 0.35, t.z + R * 1.6); if (c === 'iso') camera.position.set(t.x + R, R * 0.9, t.z + R * 1.2); }));
function frame() {
  let x0 = Infinity, x1 = -Infinity, y1 = 0, z0 = Infinity, z1 = -Infinity;
  for (const p of B.parts) { const P = PART[p.part], [fw, fd] = dims(P, p.r); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x + fw); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z + fd); y1 = Math.max(y1, (p.y + P.h) * PLATE); }
  if (!B.parts.length) { x0 = z0 = 0; x1 = z1 = B.size; }
  y1 *= 1 + view.explode * 1.6;
  // fit the bounding sphere of the build into the narrower field of view
  const cx = off() + (x0 + x1) / 2, cz = off() + (z0 + z1) / 2, cy = y1 / 2;
  const R = Math.max(Math.hypot(x1 - x0, y1, z1 - z0) / 2, 4);
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
  const dist = (R / Math.sin(Math.min(vf, hf))) * 1.08, dir = new THREE.Vector3(1.2, 1.05, 1.55).normalize();
  controls.target.set(cx, cy, cz); camera.position.set(cx + dir.x * dist, cy + dir.y * dist, cz + dir.z * dist);
}

// sound
let AC = null; function sfx() { if (!$('#snd').checked) return; AC ||= new AudioContext(); const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.03); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + 0.06); }

// ── loop ──
function resize() { const r = canvas.parentElement.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(canvas.parentElement);
function loop() { controls.update(); if (ghost?.visible) ghostMat.opacity = ghostPP ? 0.45 + Math.sin(performance.now() / 200) * 0.1 : 0.4; renderer.render(scene, camera); requestAnimationFrame(loop); }

// ── boot ──
let restored = false;
try { const s = localStorage.getItem('brick-studio'); if (s && !q.get('sample')) { B.load(JSON.parse(s), 'restore'); B.undo = []; restored = true; } } catch { /* ignore */ }
if (q.get('sample') && SAMPLES[q.get('sample')]) { B.load(SAMPLES[q.get('sample')].make(), 'sample'); B.undo = []; } else if (!restored) { B.load(SAMPLES.cottage.make(), 'sample'); B.undo = []; }
buildBase(); renderPalette(); renderParts(); renderGenParams(); setTool('build'); rebuild(); inspector(); resize(); frame();
if (q.get('tab')) document.querySelector(`[data-tab="${q.get('tab')}"]`)?.click();
loop();
setTimeout(() => $('#loader').classList.add('done'), 300);
window.__bs = { B, S, view, camera, controls, frame, loadSample, rebuild, overlays, inspector, steps: () => steps, addGenerated, SHAPES, packBricks, scheme, setTool };   // handle for automated browser tests
