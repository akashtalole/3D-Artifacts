/**
 * The state map: relief tiles coloured by each 6 km cell's forest, plantations and industrial land,
 * trees that thin and fall as the years pass, project models, tiger reserves and corridors.
 * 1 unit = 2 km.
 */
import * as THREE from 'three';
import { RIVERS, RESERVES, CORRIDORS, KINDS, XY } from './data.js';
import { CELLS, cellXZ, S, ghatsX } from './forest.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const noise = (x, z) => Math.sin(x * 0.11 + z * 0.07) * Math.cos(z * 0.13 - x * 0.05) + 0.5 * Math.sin(x * 0.31 + 1.3) * Math.sin(z * 0.27);
export function height(x, z) {
  const d = x - ghatsX(z);
  const konkan = d < -10 ? 0.4 + 0.2 * noise(x, z) : 0, ridge = 5.5 * Math.exp(-(((d + 2) / 8) ** 2)) * (1 + 0.25 * noise(x * 2, z * 2));
  const plateau = d > -6 ? 1.7 - 0.0012 * (x + 150) + 0.35 * noise(x, z) : 0, satpura = z < -120 ? 2.5 * Math.exp(-(((z + 160) / 14) ** 2)) * (1 + 0.4 * noise(x, z)) : 0;
  const east = x > 120 ? 1.2 * Math.exp(-(((z - 20) / 60) ** 2)) * (0.6 + 0.4 * noise(x * 1.5, z)) : 0;   // Gadchiroli hills
  return Math.max(konkan, plateau) + ridge + satpura + east;
}
export const at = (lat, lon, dy = 0) => { const [x, z] = XY(lat, lon); return new THREE.Vector3(x, height(x, z) + dy, z); };
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const mesh = (g, m, cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; };

const cLoss = new THREE.Color('#d7263d'), cThin = new THREE.Color('#f28c28'), cFarm = new THREE.Color('#c4b47a'), cFarmW = new THREE.Color('#a9b56a'), cFloor = new THREE.Color('#355f2a'), cOpen = new THREE.Color('#7f9a47'), cInd = new THREE.Color('#7b6f66'), cYoung = new THREE.Color('#b8d85a');
export const TREE_COL = { v: new THREE.Color('#1d4a1e'), m: new THREE.Color('#2f6b2a'), o: new THREE.Color('#77994a'), p: new THREE.Color('#9cc24a') };

export function buildMap() {
  const G = new THREE.Group(), U = {};
  const sea = mesh(new THREE.PlaneGeometry(2400, 2400), std('#2c5d86', { roughness: 0.35 }), false); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; G.add(sea);
  const land = new THREE.Shape([new THREE.Vector2(-205, -900), new THREE.Vector2(1200, -900), new THREE.Vector2(1200, 900), new THREE.Vector2(-80, 900), new THREE.Vector2(-120, 260), new THREE.Vector2(-140, 175), new THREE.Vector2(-175, 40), new THREE.Vector2(-182, 0), new THREE.Vector2(-185, -70), new THREE.Vector2(-200, -200)]);
  const lg = new THREE.ShapeGeometry(land); lg.rotateX(Math.PI / 2); const lm = mesh(lg, std('#c9c2aa', { roughness: 1, side: THREE.DoubleSide }), false); lm.position.y = -0.05; G.add(lm);
  // one flat tile per cell
  const pos = new Float32Array(CELLS.length * 12), col = new Float32Array(CELLS.length * 12), idx = [];
  U.base = [];
  CELLS.forEach((k, i) => {
    const [cx, cz] = cellXZ(k), h = height(cx, cz), hs = S / 2;
    const corners = [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]];
    corners.forEach(([dx, dz], j) => { const x = cx + dx, z = cz + dz; pos.set([x, Math.max(h, height(x, z) * 0.5 + h * 0.5), z], (i * 4 + j) * 3); });
    idx.push(i * 4, i * 4 + 3, i * 4 + 1, i * 4 + 1, i * 4 + 3, i * 4 + 2);
    const d = cx - ghatsX(cz); U.base.push(cFarm.clone().lerp(cFarmW, clamp01(1 - (d + 10) / 60) * 0.7 + (cx > 60 ? 0.25 : 0)));
  });
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
  U.tiles = mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), false); G.add(U.tiles);
  for (const pts of Object.values(RIVERS)) { const v = pts.map(([la, lo]) => at(la, lo, 0.3)); G.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v), 60, 0.5, 4), std('#4a8fd0', { roughness: 0.3 }), false)); }
  // trees: three slots per cell
  const tree = new THREE.ConeGeometry(0.9, 2.6, 6); tree.translate(0, 1.3, 0);
  const TN = CELLS.length * 3, trees = new THREE.InstancedMesh(tree, std('#ffffff', { flatShading: true }), TN); trees.castShadow = true;
  U.slots = []; CELLS.forEach((k, i) => { const [cx, cz] = cellXZ(k); for (let j = 0; j < 3; j++) { const a = (i * 3 + j) * 2.39996, r = 0.55 + 0.35 * ((i * 7 + j * 3) % 5) / 5; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; U.slots.push({ x, z, y: height(cx, cz), cur: 0, want: 0, s: 0.75 + 0.5 * (((i + j) * 13) % 7) / 7 }); } });
  trees.count = TN; G.add(trees); U.trees = trees;
  // reserves and corridors
  U.reserves = RESERVES.map((r) => { const c = at(r.lat, r.lon), pts = []; for (let a = 0; a <= 64; a++) { const t = (a / 64) * Math.PI * 2, x = c.x + Math.cos(t) * r.r / 2, z = c.z + Math.sin(t) * r.r / 2; pts.push(new THREE.Vector3(x, height(x, z) + 2.8, z)); } const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: '#ffd166', dashSize: 2, gapSize: 1.5 })); l.computeLineDistances(); G.add(l); return { r, c, l }; });
  U.corridors = CORRIDORS.map((c) => { const pts = c.pts.map(([la, lo]) => at(la, lo, 3.2)); const curve = new THREE.CatmullRomCurve3(pts); const m = new THREE.MeshBasicMaterial({ color: '#5dffa0', transparent: true, opacity: 0.8 }); const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 50, 0.55, 5), m); G.add(t); return { c, curve, m, t }; });
  U.cols = new Float32Array(col.length); U.colAttr = tg.attributes.color;
  return { group: G, U };
}

/** Paint the tiles and set tree targets from a snapshot. young/p are plantations, ind is industrial land. */
export function paintMap(U, snap, base = null, change = true) {
  const c = new THREE.Color(), a = U.colAttr.array;
  CELLS.forEach((k, i) => {
    const v = snap.v[k], m = snap.m[k], o = snap.o[k], p = snap.p[k], y = snap.young[k], ind = snap.ind[k], f = v + m + o + p;
    c.copy(U.base[i]).lerp(cOpen, clamp01(o * 2.2)).lerp(cFloor, clamp01((v + m) * 1.25)).lerp(cYoung, clamp01((p + y) * 4)).lerp(cInd, clamp01(ind * 6));
    if (change && base) { const lost = base.v[k] + base.m[k] + base.o[k] - (v + m + o), thin = base.v[k] - v; c.lerp(cThin, clamp01(thin * 9)).lerp(cLoss, clamp01(lost * 7)); }
    for (let j = 0; j < 4; j++) a.set([c.r, c.g, c.b], (i * 4 + j) * 3);
    const n = f < 0.06 ? 0 : f < 0.3 ? 1 : f < 0.6 ? 2 : 3, dense = (v + m) / Math.max(f, 1e-6);
    for (let j = 0; j < 3; j++) { const sl = U.slots[i * 3 + j]; sl.want = j < n ? 1 : (j === 0 && y + p > 0.015 ? 0.5 : 0); sl.cls = j < n ? (v > m && v > o ? 'v' : dense > 0.5 ? 'm' : p > o ? 'p' : 'o') : 'p'; }
  });
  U.colAttr.needsUpdate = true;
}
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
export function animateTrees(U, dt, force = false) {
  let dirty = force;
  U.slots.forEach((sl, i) => {
    if (!force && Math.abs(sl.cur - sl.want) < 0.01) return;
    sl.cur += (sl.want - sl.cur) * Math.min(1, force ? 1 : dt * 2.5); dirty = true;
    const s = sl.cur * sl.s * (sl.cls === 'v' ? 1.2 : sl.cls === 'p' ? 0.65 : 1);
    U.trees.setMatrixAt(i, m4.compose(ps.set(sl.x, sl.y, sl.z), q, sc.set(s, s, s))); U.trees.setColorAt(i, TREE_COL[sl.cls] || TREE_COL.o);
  });
  if (dirty) { U.trees.instanceMatrix.needsUpdate = true; if (U.trees.instanceColor) U.trees.instanceColor.needsUpdate = true; }
}

/** Project models sized for the map: mine pits, coal pits, plants, estates, ports, dams, and roads or rails along their path. */
export function projectModel(p) {
  const g = new THREE.Group(), s = 0.8 + Math.sqrt(p.ha) / 45, k = p.kind;
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  if (k === 'mine' || k === 'coal') {
    const rock = std(k === 'coal' ? '#2f3236' : '#9c5b2e');
    for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(3.2 - i * 0.7, 3.2 - i * 0.7, 0.25, 20), i % 2 ? rock : std(k === 'coal' ? '#45494e' : '#b5713c'), 0, 0.3 - i * 0.12, 0);
    add(new THREE.ConeGeometry(1.4, 1.4, 8), std('#8a7a68'), 3.6, 0.7, 1.5); add(new THREE.BoxGeometry(0.5, 0.3, 0.3), std('#e2b100'), 1.2, 0.5, -1);
  } else if (k === 'plant') {
    add(new THREE.BoxGeometry(2.6, 1.6, 1.8), std('#8f98a3'), 0, 0.8, 0); add(new THREE.CylinderGeometry(0.22, 0.3, 4.2, 10), std('#bcb5aa'), -1.6, 2.1, -0.4); add(new THREE.BoxGeometry(1.6, 0.9, 1.4), std('#c9ced3'), 1.6, 0.45, 0.9);
  } else if (k === 'estate') {
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(1.1, 0.5 + (i % 3) * 0.35, 0.9), std(i % 2 ? '#d1d5d9' : '#d95926'), -1.5 + (i % 3) * 1.5, 0.3 + (i % 3) * 0.17, -0.7 + Math.floor(i / 3) * 1.4);
  } else if (k === 'port') {
    add(new THREE.BoxGeometry(4.5, 0.3, 2.8), std('#9aa3aa'), 0, 0.15, 0); for (let i = 0; i < 3; i++) { add(new THREE.BoxGeometry(0.2, 2.4, 0.2), std('#e8721a'), -1.5 + i * 1.5, 1.4, -1.1); add(new THREE.BoxGeometry(0.2, 0.2, 2), std('#e8721a'), -1.5 + i * 1.5, 2.5, -0.4); }
    for (let i = 0; i < 8; i++) add(new THREE.BoxGeometry(0.8, 0.35, 0.35), std(['#2f6fb3', '#c0392b', '#2f8f4e', '#e2b100'][i % 4]), -1.6 + (i % 4) * 1.1, 0.48, 0.3 + Math.floor(i / 4) * 0.5);
  } else if (k === 'dam') {
    const w = add(new THREE.TorusGeometry(2.6, 0.38, 6, 20, Math.PI * 0.7), std('#bdb6a7')); w.rotation.x = Math.PI / 2; w.rotation.z = Math.PI * 0.15; w.scale.z = 3;
    g.userData.lake = add(new THREE.CircleGeometry(3.6, 28), std('#3d79b8', { roughness: 0.2 })); g.userData.lake.rotation.x = -Math.PI / 2; g.userData.lake.position.set(0.4, 0.75, -2.6);
  }
  g.scale.setScalar(s); return g;
}
export function pathModel(p) {
  const pts = p.path.map(([la, lo]) => at(la, lo, 0.45)), curve = new THREE.CatmullRomCurve3(pts);
  return mesh(new THREE.TubeGeometry(curve, Math.max(20, pts.length * 14), p.kind === 'rail' ? 0.45 : 0.75, 4), std(KINDS[p.kind].colour, { emissive: KINDS[p.kind].colour, emissiveIntensity: 0.25 }), false);
}
