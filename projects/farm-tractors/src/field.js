/**
 * The farm: a 40 m × 24 m plot whose surface is a painted canvas, a wheat crop as
 * instances, the farmyard around it, and the job runner that drives a tractor and
 * implement over the plot pass by pass.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, mesh, rbox, box, cyl, extrude } from './kit.js';

export const FL = 40, FW = 24, K = 25.6;   // field length (x), width (z), canvas px per metre
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

function tile(base, draw) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 64, 64); draw?.(g); return c; }
const speck = (g, n, cols, s = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(rnd() * 64, rnd() * 64, s + rnd() * s, s * 0.7 + rnd() * s); } };
const TILES = {
  stubble: tile('#b39a62', (g) => { speck(g, 140, ['#8d7744', '#cdb67a']); for (let y = 2; y < 64; y += 5) for (let x = 1; x < 64; x += 6) { g.fillStyle = '#e1cd8f'; g.fillRect(x, y, 2, 2); } }),
  ploughed: tile('#5a3b22', (g) => { for (let y = 0; y < 64; y += 8) { g.fillStyle = '#6f4a2b'; g.fillRect(0, y, 64, 4); g.fillStyle = '#3f2814'; g.fillRect(0, y + 6, 64, 2); } speck(g, 90, ['#7d5634', '#46301c'], 3); }),
  harrowed: tile('#6a482c', (g) => speck(g, 260, ['#7a5636', '#523620', '#86603c'], 2)),
  cultivated: tile('#6f4d30', (g) => { for (let y = 0; y < 64; y += 6) { g.fillStyle = '#5a3c24'; g.fillRect(0, y, 64, 2); } speck(g, 120, ['#7f5a38', '#5e4028'], 2); }),
  levelled: tile('#7b5939', (g) => speck(g, 80, ['#83603e', '#71512f'], 1.5)),
  tilled: tile('#5d3f27', (g) => speck(g, 380, ['#6b4a2e', '#4d331f', '#77543a'], 1.2)),
  sown: tile('#7b5939', (g) => { speck(g, 60, ['#83603e', '#71512f'], 1.5); for (let y = 2; y < 64; y += 5.12) { g.fillStyle = '#5e4229'; g.fillRect(0, Math.round(y), 64, 1.4); } }),
};

export function buildFarm() {
  const G = new THREE.Group();
  // land
  const grassC = document.createElement('canvas'); grassC.width = grassC.height = 256; { const g = grassC.getContext('2d'); g.fillStyle = '#7d8c4a'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 5000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(60,85,35,.35)' : 'rgba(160,150,90,.3)'; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); } }
  const grassT = new THREE.CanvasTexture(grassC); grassT.wrapS = grassT.wrapT = THREE.RepeatWrapping; grassT.repeat.set(40, 40); grassT.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ map: grassT, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(FL / 2, -0.02, FW / 2); ground.receiveShadow = true; G.add(ground);
  // field canvas
  const cv = document.createElement('canvas'); cv.width = Math.round(FL * K); cv.height = Math.round(FW * K);
  const ctx = cv.getContext('2d'); const pats = Object.fromEntries(Object.entries(TILES).map(([k, c]) => [k, ctx.createPattern(c, 'repeat')]));
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const fieldM = new THREE.Mesh(new THREE.PlaneGeometry(FL, FW), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); fieldM.rotation.x = -Math.PI / 2; fieldM.position.set(FL / 2, 0.005, FW / 2); fieldM.receiveShadow = true; G.add(fieldM);
  const paint = (state, x0, x1, z0, z1) => { if (!pats[state]) return; const a = Math.max(0, Math.min(x0, x1)), b = Math.min(FL, Math.max(x0, x1)), c = Math.max(0, Math.min(z0, z1)), d = Math.min(FW, Math.max(z0, z1)); if (b <= a || d <= c) return; ctx.fillStyle = pats[state]; ctx.fillRect(a * K, c * K, (b - a) * K + 0.5, (d - c) * K + 0.5); tex.needsUpdate = true; };
  const wet = (x1) => { ctx.fillStyle = 'rgba(35,45,60,0.04)'; ctx.fillRect(0, 0, x1 * K, FW * K); tex.needsUpdate = true; };
  const reset = (state = 'stubble') => { ctx.fillStyle = pats[state]; ctx.fillRect(0, 0, cv.width, cv.height); tex.needsUpdate = true; };
  reset();
  // bunds
  const bundM = new THREE.MeshStandardMaterial({ color: '#8a7350', roughness: 1 });
  for (const [x, z, w, d] of [[FL / 2, -0.35, FL + 1.4, 0.6], [FL / 2, FW + 0.35, FL + 1.4, 0.6], [-0.35, FW / 2, 0.6, FW], [FL + 0.35, FW / 2, 0.6, FW]]) { const b = rbox(w, 0.28, d, bundM, 0.12); b.position.set(x, 0.1, z); G.add(b); }
  // water channel along the south bund, tubewell and pump house
  const water = new THREE.MeshStandardMaterial({ color: '#4f7ea6', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
  const chan = box(FL + 6, 0.05, 0.6, water); chan.position.set(FL / 2 - 3, 0.02, -1.25); G.add(chan);
  const pump = new THREE.Group(); pump.position.set(-4.5, 0, -2.5); G.add(pump);
  const brick = new THREE.MeshStandardMaterial({ color: '#b8664a', roughness: 0.9 });
  const ph = rbox(2.4, 2.0, 2.0, brick, 0.04); ph.position.y = 1.0; pump.add(ph); const roofP = box(2.8, 0.08, 2.4, M.steel); roofP.position.y = 2.06; roofP.rotation.z = 0.08; pump.add(roofP);
  const spoutP = cyl(0.1, 0.8, M.dark, 'x', 10); spoutP.position.set(1.5, 0.5, 1.2); pump.add(spoutP);
  const tank = rbox(1.2, 0.5, 1.2, new THREE.MeshStandardMaterial({ color: '#9aa3a8', roughness: 0.6 }), 0.04); tank.position.set(1.9, 0.25, 1.5); pump.add(tank);
  const flow = new THREE.Mesh(new THREE.PlaneGeometry(1, FW), new THREE.MeshStandardMaterial({ color: '#5b8db5', roughness: 0.1, transparent: true, opacity: 0.55 })); flow.rotation.x = -Math.PI / 2; flow.position.set(0, 0.03, FW / 2); flow.visible = false; G.add(flow);
  // farmhouse, haystack, trees, threshing floor, village road
  const fh = new THREE.Group(); fh.position.set(-14, 0, 10); G.add(fh);
  const plaster = new THREE.MeshStandardMaterial({ color: '#e9dcc4', roughness: 0.9 });
  const h1 = rbox(6, 3, 5, plaster, 0.05); h1.position.y = 1.5; fh.add(h1);
  const roof = extrude([[-3.4, 0], [3.4, 0], [0, 1.6]], 5.6, new THREE.MeshStandardMaterial({ color: '#8c3b26', roughness: 0.8 }), 0.02); roof.position.y = 3.0; fh.add(roof);
  const door = box(0.05, 1.9, 1.0, new THREE.MeshStandardMaterial({ color: '#3d5a80', roughness: 0.6 })); door.position.set(3.02, 0.95, 0); fh.add(door);
  for (const z of [-1.6, 1.6]) { const w = box(0.05, 0.8, 0.8, M.glass); w.position.set(3.02, 1.8, z); fh.add(w); }
  const shed = new THREE.Group(); shed.position.set(-14, 0, 22); G.add(shed);
  for (const [x, z] of [[-3, -2.5], [3, -2.5], [-3, 2.5], [3, 2.5]]) { const p = cyl(0.08, 3, M.dark, 'y', 6); p.position.set(x, 1.5, z); shed.add(p); }
  const sr = box(6.8, 0.06, 5.8, M.steel); sr.position.y = 3.0; sr.rotation.x = 0.06; shed.add(sr);
  const hay = mesh(new THREE.SphereGeometry(2.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d8c07a', roughness: 1 })); hay.scale.y = 1.3; hay.position.set(-21, 0, 16); G.add(hay);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshStandardMaterial({ color: '#b9a580', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.set(-8, 0.01, FW + 9); floor.receiveShadow = true; G.add(floor);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(260, 5), new THREE.MeshStandardMaterial({ color: '#a8916a', roughness: 1 })); road.rotation.x = -Math.PI / 2; road.position.set(60, 0.008, FW + 17); road.receiveShadow = true; G.add(road);
  const leaf = new THREE.MeshStandardMaterial({ color: '#3f6a2e', roughness: 0.9, flatShading: true }), leaf2 = new THREE.MeshStandardMaterial({ color: '#56803a', roughness: 0.9, flatShading: true }), bark = new THREE.MeshStandardMaterial({ color: '#5a4630', roughness: 0.9 });
  const tree = (x, z, s = 1) => { const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); const tk = cyl(0.25, 3, bark, 'y', 7); tk.position.y = 1.5; t.add(tk); for (let i = 0; i < 3; i++) { const c = mesh(new THREE.IcosahedronGeometry(1.8 - i * 0.2, 1), i % 2 ? leaf : leaf2); c.position.set((rnd() - 0.5) * 1.6, 3.8 + i * 0.7, (rnd() - 0.5) * 1.6); t.add(c); } G.add(t); };
  for (let i = 0; i < 9; i++) tree(-6 + i * 6.5, -6.5 - (i % 2) * 2, 0.9 + rnd() * 0.4);
  for (let i = 0; i < 6; i++) tree(FL + 6 + (i % 2) * 3, -2 + i * 5.5, 0.9 + rnd() * 0.3);
  for (const [x, z] of [[-20, 4], [-19, 27], [-9, -3], [12, FW + 24], [34, FW + 23], [58, FW + 24]]) tree(x, z, 1.1);
  // neighbouring fields
  for (const [x, z, c] of [[FL / 2, -16, '#9cae5c'], [FL + 24, FW / 2, '#c7b06a'], [FL / 2, FW + 32, '#87a24f']]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(36, 18), new THREE.MeshStandardMaterial({ color: c, roughness: 1 })); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.004, z); f.receiveShadow = true; G.add(f); }
  // laser transmitter on a tripod
  const laser = new THREE.Group(); laser.position.set(-2.2, 0, -2.2); G.add(laser);
  for (let i = 0; i < 3; i++) { const l = cyl(0.025, 2.3, M.black, 'y', 6); l.position.set(Math.cos(i * 2.1) * 0.35, 1.05, Math.sin(i * 2.1) * 0.35); l.rotation.set(Math.sin(i * 2.1) * 0.3, 0, -Math.cos(i * 2.1) * 0.3); laser.add(l); }
  const head = new THREE.Group(); head.position.y = 2.25; laser.add(head); const hb = cyl(0.12, 0.25, new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.4 }), 'y', 16); head.add(hb);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(60, 0.015, 0.015), new THREE.MeshBasicMaterial({ color: '#ff3030', transparent: true, opacity: 0.7 })); beam.position.x = 30; head.add(beam);
  laser.visible = false;
  // wheat crop: rows along x every 0.2 m, a tuft every 0.3 m
  const blades = []; for (let i = 0; i < 3; i++) { const b = new THREE.ConeGeometry(0.035, 1, 3); b.translate(0, 0.5, 0); b.rotateZ((i - 1) * 0.28); b.rotateY(i * 2.1); blades.push(b.toNonIndexed()); }
  const ear = new THREE.CapsuleGeometry(0.02, 0.09, 2, 4); ear.translate(0, 1.04, 0); blades.push(ear.toNonIndexed());
  const plantG = mergeGeometries(blades);
  const rows = Math.round(FW / 0.2), per = Math.round(FL / 0.45), N = rows * per;
  const crop = new THREE.InstancedMesh(plantG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), N); crop.castShadow = false; crop.receiveShadow = true;
  const st = new Uint8Array(N);   // 0 none, 1 growing, 2 cut
  const jit = new Float32Array(N * 3); for (let i = 0; i < N; i++) { jit[i * 3] = (rnd() - 0.5) * 0.12; jit[i * 3 + 1] = 0.8 + rnd() * 0.4; jit[i * 3 + 2] = rnd() * 6.28; }
  G.add(crop);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  let growth = 0;
  const C_YOUNG = new THREE.Color('#6fae3c'), C_MID = new THREE.Color('#4f8a2e'), C_RIPE = new THREE.Color('#d6b04c'), C_STUB = new THREE.Color('#c9b277');
  const setPlant = (i) => {
    const r = Math.floor(i / per), c = i % per, x = 0.2 + c * 0.45 + jit[i * 3], z = 0.1 + r * 0.2;
    let h = 0; if (st[i] === 1) h = (0.05 + 0.95 * Math.min(1, growth)) * jit[i * 3 + 1] * 0.95; else if (st[i] === 2) h = 0.12;
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, jit[i * 3 + 2]); v3.set(x, 0, z); sc.set(h > 0 ? 1 : 0, h || 0.0001, h > 0 ? 1 : 0); m4.compose(v3, q, sc); crop.setMatrixAt(i, m4);
    if (st[i] === 2) col.copy(C_STUB); else if (growth < 0.6) col.copy(C_YOUNG).lerp(C_MID, growth / 0.6); else col.copy(C_MID).lerp(C_RIPE, Math.min(1, (growth - 0.6) / 0.35));
    crop.setColorAt(i, col);
  };
  const touch = (x0, x1, z0, z1, to) => {   // set plants in a rectangle to state `to`
    const r0 = Math.max(0, Math.floor((Math.min(z0, z1) - 0.1) / 0.2)), r1 = Math.min(rows - 1, Math.ceil((Math.max(z0, z1) - 0.1) / 0.2) - 1);
    const c0 = Math.max(0, Math.floor((Math.min(x0, x1) - 0.2) / 0.45)), c1 = Math.min(per - 1, Math.floor((Math.max(x0, x1) - 0.2) / 0.45));
    let ch = false; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const i = r * per + c; if (to === 2 && st[i] !== 1) continue; if (st[i] !== to) { st[i] = to; setPlant(i); ch = true; } }
    if (ch) { crop.instanceMatrix.needsUpdate = true; crop.instanceColor.needsUpdate = true; }
  };
  const setGrowth = (g) => { growth = g; for (let i = 0; i < N; i++) if (st[i] === 1) setPlant(i); crop.instanceMatrix.needsUpdate = true; crop.instanceColor.needsUpdate = true; };
  const clearCrop = (to = 0, g = 0) => { growth = g; st.fill(to); for (let i = 0; i < N; i++) setPlant(i); crop.instanceMatrix.needsUpdate = true; crop.instanceColor.needsUpdate = true; };
  clearCrop();
  return { group: G, paint, wet, reset, laser, laserHead: head, flow, touch, setGrowth, clearCrop, get growth() { return growth; }, threshing: new THREE.Vector3(-8, 0, FW + 9), road: FW + 17 };
}

/** straight passes along x, then headland passes along z at both ends; returns segments */
export function planPasses(w) {
  const segs = [], m = Math.max(4.5, Math.ceil(5 / w) * w), n = Math.max(1, Math.round(FW / w));
  for (let k = 0; k < n; k++) { const z = Math.min(FW - w / 2, w / 2 + k * w); const a = [m, z], b = [FL - m, z]; segs.push(k % 2 ? { a: b, b: a, down: true } : { a, b, down: true }); }
  const nh = Math.ceil(m / w); let flip = n % 2 === 1;
  for (const end of [FL, 0]) for (let j = 0; j < nh; j++) { const x = end === FL ? FL - w / 2 - j * w : w / 2 + j * w; const a = [x, 0.4], b = [x, FW - 0.4]; segs.push(flip ? { a: b, b: a, down: true } : { a, b, down: true }); flip = !flip; }
  return segs;
}
/** a polyline through the segments with Bézier turns between them; points carry `down` */
export function buildPath(segs, start, end, R = 3.6) {
  const pts = []; const push = (x, z, down) => { const p = pts[pts.length - 1]; if (p && Math.hypot(p.x - x, p.z - z) < 0.05) return; pts.push({ x, z, down }); };
  const bez = (p0, p1, p2, p3, n) => { for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; push(u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1], false); } };
  const dir = (s) => { const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L]; };
  let prev = start ? { b: start, d: [1, 0] } : null;
  for (const s of segs) {
    const d = dir(s);
    if (prev) { const k = Math.max(R * 1.4, Math.hypot(s.a[0] - prev.b[0], s.a[1] - prev.b[1]) * 0.5); bez(prev.b, [prev.b[0] + prev.d[0] * k, prev.b[1] + prev.d[1] * k], [s.a[0] - d[0] * k, s.a[1] - d[1] * k], s.a, 22); }
    else push(s.a[0], s.a[1], true);
    const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), n = Math.max(1, Math.ceil(L / 0.5));
    for (let i = 0; i <= n; i++) push(s.a[0] + (s.b[0] - s.a[0]) * (i / n), s.a[1] + (s.b[1] - s.a[1]) * (i / n), true);
    prev = { b: s.b, d };
  }
  if (end && prev) { const k = R * 1.6; bez(prev.b, [prev.b[0] + prev.d[0] * k, prev.b[1] + prev.d[1] * k], [end[0] + 4, end[1]], end, 24); }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, cum, L: cum[cum.length - 1] };
}
export function samplePath(path, d) {
  const { pts, cum } = path; d = Math.max(0, Math.min(path.L, d));
  let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
  const a = pts[lo], b = pts[hi], t = (d - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, h: Math.atan2(-(b.z - a.z), b.x - a.x), down: a.down && b.down };
}
