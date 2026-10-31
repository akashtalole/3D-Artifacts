/**
 * The state map: relief (Konkan, Sahyadri, Deccan plateau, Satpura), rivers, plants with live
 * output columns, the EHV network with flow particles, border ties and cities.
 * 1 unit = 2 km.
 */
import * as THREE from 'three';
import { OUTLINE, RIVERS, PLANTS, BUSES, ZONES, HVDC, OWNERS, TYPES, XY } from './data.js';
import { NET } from './grid.js';

const POLY = OUTLINE.map(([la, lo]) => XY(la, lo));
export function inside(x, z, poly = POLY) {
  let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c;
}
const ghatsX = (z) => -150 + 0.06 * z + 6 * Math.sin(z / 40);   // Sahyadri crest, roughly lon 73.7
const noise = (x, z) => Math.sin(x * 0.11 + z * 0.07) * Math.cos(z * 0.13 - x * 0.05) + 0.5 * Math.sin(x * 0.31 + 1.3) * Math.sin(z * 0.27);
export function height(x, z) {
  const g = ghatsX(z), d = x - g;
  const konkan = d < -10 ? 0.4 + 0.2 * noise(x, z) : 0;
  const ridge = 5.5 * Math.exp(-(((d + 2) / 8) ** 2)) * (1 + 0.25 * noise(x * 2, z * 2));
  const plateau = d > -6 ? 1.7 - 0.0012 * (x + 150) + 0.35 * noise(x, z) : 0;
  const satpura = z < -120 ? 2.5 * Math.exp(-(((z + 160) / 14) ** 2)) * (1 + 0.4 * noise(x, z)) : 0;
  return Math.max(konkan, plateau) + ridge + satpura;
}
const cK = new THREE.Color('#4f8a3a'), cG = new THREE.Color('#3b6a2d'), cP = new THREE.Color('#a3a45e'), cM = new THREE.Color('#bba46b'), cV = new THREE.Color('#8c9a50');
function tint(x, z, y) {
  const d = x - ghatsX(z), c = new THREE.Color();
  if (d < -10) return c.copy(cK);
  if (d < 12) return c.copy(cG).lerp(cP, clamp01((d + 2) / 14));
  return c.copy(cP).lerp(cM, clamp01((x + 60) / 120) * clamp01((z + 40) / 80)).lerp(cV, clamp01((x - 60) / 100)).offsetHSL(0, 0, (y - 1.5) * 0.02);
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const mesh = (g, m, cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; };
export const at = (lat, lon, dy = 0) => { const [x, z] = XY(lat, lon); return new THREE.Vector3(x, height(x, z) + dy, z); };

function terrain() {
  const S = 3, x0 = -215, x1 = 215, z0 = -185, z1 = 185, nx = Math.round((x1 - x0) / S), nz = Math.round((z1 - z0) / S);
  const pos = [], col = [], idx = [], id = new Map();
  const vid = (i, j) => { const k = i * 1000 + j; if (id.has(k)) return id.get(k); const x = x0 + i * S, z = z0 + j * S, y = height(x, z); pos.push(x, y, z); const c = tint(x, z, y); col.push(c.r, c.g, c.b); id.set(k, pos.length / 3 - 1); return id.get(k); };
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const cx = x0 + (i + 0.5) * S, cz = z0 + (j + 0.5) * S; if (!inside(cx, cz)) continue;
    const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1); idx.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), false); return m;
}

function plantModel(p) {
  const g = new THREE.Group(), s = Math.min(1.6, 0.7 + Math.sqrt(p.cap) / 55);
  const add = (geo, mat, x, y, z) => { const m = mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  if (p.type === 'coal') {
    add(new THREE.BoxGeometry(2.4, 2.2, 1.6), std('#8a8f96'), 0, 1.1, 0); add(new THREE.BoxGeometry(3.2, 1.3, 1.2), std('#c9ced3'), 0, 0.65, 1.5);
    add(new THREE.CylinderGeometry(0.22, 0.35, 5, 10), std('#b9b2a8'), -1.6, 2.5, -0.6);
    const ct = new THREE.LatheGeometry([0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8].map((y, i) => new THREE.Vector2(1.05 - 0.45 * Math.sin((i / 6) * Math.PI * 0.85), y * 1.5)), 16);
    add(ct, std('#d9d6cf', { side: THREE.DoubleSide }), 2.2, 0, -0.8); add(ct, std('#d9d6cf', { side: THREE.DoubleSide }), 2.2, 0, 1.4);
    add(new THREE.ConeGeometry(1.2, 0.8, 8), std('#24272b'), -2.5, 0.4, 2.2);
  } else if (p.type === 'gas') { add(new THREE.BoxGeometry(2.4, 1.4, 1.4), std('#c9ced3'), 0, 0.7, 0); add(new THREE.CylinderGeometry(0.2, 0.25, 3, 10), std('#9aa3aa'), -1.3, 1.5, 0); }
  else if (p.type === 'nuclear') { for (const x of [-1.2, 1.2]) { add(new THREE.CylinderGeometry(0.9, 0.9, 1.2, 16), std('#e3e0d8'), x, 0.6, 0); add(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#e3e0d8'), x, 1.2, 0); } add(new THREE.CylinderGeometry(0.2, 0.25, 3, 10), std('#b9b2a8'), 0, 1.5, -1); }
  else if (p.type === 'hydro' || p.type === 'psp') {
    const wall = new THREE.TorusGeometry(2.6, 0.35, 6, 20, Math.PI * 0.7); const w = add(wall, std('#bdb6a7'), 0, 0.4, 0); w.rotation.x = Math.PI / 2; w.rotation.z = Math.PI * 0.15; w.scale.z = 3;
    const lake = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), std('#3d79b8', { roughness: 0.2, metalness: 0.2 })); lake.rotation.x = -Math.PI / 2; lake.position.set(0.4, 0.75, -2.4); g.add(lake);
    add(new THREE.BoxGeometry(1.2, 0.7, 0.9), std('#c9ced3'), 0.5, 0.35, 2.2);
  } else if (p.type === 'solar') {
    const n = p.rooftop ? 0 : 5; for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) { const pn = add(new THREE.BoxGeometry(1.1, 0.05, 0.6), std('#1f3c73', { metalness: 0.5, roughness: 0.3 }), -2.6 + i * 1.3, 0.35, -1.2 + j * 0.8); pn.rotation.x = -0.35; }
    if (p.rooftop) for (let i = 0; i < 5; i++) { add(new THREE.BoxGeometry(0.8, 0.8 + (i % 3) * 0.5, 0.8), std('#d8dde1'), -2 + i, 0.4 + (i % 3) * 0.25, 0); add(new THREE.BoxGeometry(0.7, 0.04, 0.7), std('#1f3c73'), -2 + i, 0.82 + (i % 3) * 0.5, 0); }
  } else if (p.type === 'wind') {
    g.userData.rotors = [];
    for (const [x, z] of [[-1.8, -0.8], [0, 0.6], [1.8, -0.6], [0.6, -2]]) {
      add(new THREE.CylinderGeometry(0.06, 0.1, 3.4, 6), std('#eef1f4'), x, 1.7, z);
      const r = new THREE.Group(); r.position.set(x, 3.45, z + 0.15);
      for (let k = 0; k < 3; k++) { const bl = mesh(new THREE.BoxGeometry(0.1, 1.4, 0.03), std('#f4f6f7')); bl.position.y = 0.7; const pv = new THREE.Group(); pv.rotation.z = (k * 2 * Math.PI) / 3; pv.add(bl); r.add(pv); }
      g.add(r); g.userData.rotors.push(r);
    }
  }
  g.scale.setScalar(s); return g;
}

export function buildMap() {
  const G = new THREE.Group(), U = { plants: {}, lines: [], cities: [] };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), std('#2c5d86', { roughness: 0.35, metalness: 0.1 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; sea.receiveShadow = true; G.add(sea);
  // neighbouring states: land east of the coast line, outside Maharashtra
  const land = new THREE.Shape([new THREE.Vector2(-260, -900), new THREE.Vector2(1200, -900), new THREE.Vector2(1200, 900), new THREE.Vector2(-160, 900), new THREE.Vector2(-150, 260), new THREE.Vector2(-200, 120), new THREE.Vector2(-232, -40), new THREE.Vector2(-232, -900)]);
  const lg = new THREE.ShapeGeometry(land); lg.rotateX(Math.PI / 2);
  const lm = mesh(lg, std('#c7c0a8', { roughness: 1 }), false); lm.position.y = -0.05; lm.material.side = THREE.DoubleSide; G.add(lm);
  G.add(terrain());
  const bp = POLY.map(([x, z]) => new THREE.Vector3(x, height(x, z) + 0.25, z));
  G.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(bp), new THREE.LineBasicMaterial({ color: '#fff4d6' })));
  for (const pts of Object.values(RIVERS)) { const v = pts.map(([la, lo]) => at(la, lo, 0.12)); const c = new THREE.CatmullRomCurve3(v); const t = mesh(new THREE.TubeGeometry(c, 60, 0.45, 4), std('#4a8fd0', { roughness: 0.3 }), false); G.add(t); }
  // buses
  for (const [k, b] of Object.entries(BUSES)) { if (b.ext) continue; const p = at(b.lat, b.lon); const s = mesh(new THREE.BoxGeometry(2.2, 0.6, 2.2), std(b.kv >= 765 ? '#e9e2d0' : '#d0d4d8')); s.position.copy(p).add(new THREE.Vector3(0, 0.3, 0)); G.add(s); U[`bus${k}`] = p; }
  // lines with towers and flow particles
  const kvCol = { 765: '#e66767', 400: '#f0b429', 220: '#d6a2ff' };
  const towerGeo = new THREE.ConeGeometry(0.35, 2.2, 4); towerGeo.translate(0, 1.1, 0);
  const towers = [];
  NET.forEach((l) => {
    const A = U[`bus${l.f}`].clone(), B = l.tie ? at(l.blat, l.blon) : U[`bus${l.t}`].clone();
    const off = new THREE.Vector3(B.z - A.z, 0, A.x - B.x).normalize().multiplyScalar(((l.i % 3) - 1) * 0.6);
    const pts = []; const n = 24;
    for (let k = 0; k <= n; k++) { const u = k / n, p = A.clone().lerp(B, u).add(off); p.y = Math.max(height(p.x, p.z), A.y + (B.y - A.y) * u) + 2.2 + Math.sin(Math.PI * u) * 0.6; pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const r = l.kv >= 765 ? 0.28 : l.kv >= 400 ? 0.2 : 0.16;
    const tube = mesh(new THREE.TubeGeometry(curve, 40, r, 5), new THREE.MeshStandardMaterial({ color: kvCol[l.kv], emissive: kvCol[l.kv], emissiveIntensity: 0.15, roughness: 0.5 }), false);
    tube.userData = { line: l.i }; G.add(tube);
    const len = curve.getLength(); for (let d = 6; d < len - 3; d += 9) { const p = curve.getPointAt(d / len); towers.push(new THREE.Vector3(p.x, height(p.x, p.z), p.z)); }
    if (l.tie) { const arrow = mesh(new THREE.ConeGeometry(1.4, 3, 8), std('#ffffff', { emissive: '#7fc8ff', emissiveIntensity: 0.4 })); const dir = B.clone().sub(A).normalize(); arrow.position.copy(B).add(new THREE.Vector3(0, 2.2, 0)); arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); G.add(arrow); U.lines.push({ l, curve, len, tube, arrow, dir }); }
    else U.lines.push({ l, curve, len, tube });
  });
  // HVDC
  { const A = U[`bus${HVDC.from}`], B = U[`bus${HVDC.to}`], pts = [];
    for (let k = 0; k <= 30; k++) { const u = k / 30, p = A.clone().lerp(B, u); p.z += Math.sin(Math.PI * u) * 22; p.y = height(p.x, p.z) + 3.4 + Math.sin(Math.PI * u) * 1.5; pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts), tube = mesh(new THREE.TubeGeometry(curve, 80, 0.32, 6), new THREE.MeshStandardMaterial({ color: '#9b6bff', emissive: '#9b6bff', emissiveIntensity: 0.25 }), false);
    G.add(tube); U.hvdc = { curve, len: curve.getLength(), tube };
    const len = U.hvdc.len; for (let d = 6; d < len - 3; d += 9) { const p = curve.getPointAt(d / len); towers.push(new THREE.Vector3(p.x, height(p.x, p.z), p.z)); } }
  const tIM = new THREE.InstancedMesh(towerGeo, std('#8a9198', { metalness: 0.5 }), towers.length); const m4 = new THREE.Matrix4();
  towers.forEach((p, i) => tIM.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z))); tIM.castShadow = true; G.add(tIM);
  // particles: 8 per line
  const PER = 8, NP = (U.lines.length + 1) * PER;
  const pIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), NP); pIM.frustumCulled = false; G.add(pIM);
  U.particles = { pIM, PER, ph: new Float32Array(NP).map(() => Math.random()) };
  // plants
  for (const p of PLANTS) {
    const pos = at(p.lat, p.lon), g = plantModel(p); g.position.copy(pos); G.add(g);
    const ring = mesh(new THREE.TorusGeometry(3.2, 0.25, 6, 28), new THREE.MeshBasicMaterial({ color: OWNERS[p.owner].colour })); ring.rotation.x = Math.PI / 2; ring.position.copy(pos).add(new THREE.Vector3(0, 0.25, 0)); G.add(ring);
    const colGeo = new THREE.CylinderGeometry(0.75, 0.75, 1, 12); colGeo.translate(0, 0.5, 0);
    const col = mesh(colGeo, new THREE.MeshStandardMaterial({ color: TYPES[p.type].colour, emissive: TYPES[p.type].colour, emissiveIntensity: 0.25, transparent: true, opacity: 0.88 }));
    col.position.copy(pos).add(new THREE.Vector3(4.2, 0, 0)); G.add(col);
    const capG = new THREE.CylinderGeometry(0.85, 0.85, 1, 12, 1, true); capG.translate(0, 0.5, 0);
    const capM = new THREE.Mesh(capG, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false })); capM.position.copy(col.position); capM.scale.y = p.cap / 100; G.add(capM);
    U.plants[p.id] = { g, col, pos, capM };
  }
  // cities
  const winMat = new THREE.MeshStandardMaterial({ color: '#d8dde1', emissive: '#ffcf7a', emissiveIntensity: 0, roughness: 0.6 });
  for (const z of ZONES) {
    const pos = at(z.lat, z.lon), g = new THREE.Group(), n = Math.round(4 + z.share * 70);
    for (let i = 0; i < n; i++) { const a = i * 2.4, r = 0.6 + Math.sqrt(i) * 0.9, h = 0.5 + (Math.sin(i * 7.1) * 0.5 + 0.5) * (1 + z.share * 22) * (1 - Math.sqrt(i) / Math.sqrt(n) * 0.7); const b = mesh(new THREE.BoxGeometry(0.8, h, 0.8), winMat); b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); g.add(b); }
    g.position.copy(pos); G.add(g);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(4 + z.share * 40, 32), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.copy(pos).add(new THREE.Vector3(0, 0.3, 0)); G.add(glow);
    U.cities.push({ z, g, glow, pos });
  }
  U.winMat = winMat;
  return { group: G, U };
}

const cOK = new THREE.Color('#5dffa0'), cHi = new THREE.Color('#ffd166'), cBad = new THREE.Color('#ff5a5a'), tmp = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
export const loadColour = (u) => (u < 0.6 ? cOK : u < 0.9 ? cHi : cBad);
/** Animate flows and plant columns. r = latest dispatch block; night = 0..1. */
export function animateMap(U, r, dt, night, out = {}) {
  const P = U.particles, m4 = new THREE.Matrix4(); let k = 0;
  const all = [...U.lines.map((L) => ({ L, f: r.flows[L.l.i], rating: L.l.rating, curve: L.curve, len: L.len, off: r.outL[L.l.i] })), { L: null, f: r.hvdc, rating: 1500, curve: U.hvdc.curve, len: U.hvdc.len, off: r.hvdc === 0 }];
  for (const a of all) {
    const u = Math.abs(a.f) / a.rating, show = !a.off && Math.abs(a.f) > 15, sp = (0.04 + 0.5 * Math.min(1.2, u)) * (a.f >= 0 ? 1 : -1) * (40 / a.len);
    if (a.L) { a.L.tube.material.opacity = a.off ? 0.25 : 1; a.L.tube.material.transparent = a.off; a.L.tube.material.emissiveIntensity = a.off ? 0 : 0.12 + 0.4 * Math.min(1, u); if (a.L.arrow) { a.L.arrow.visible = Math.abs(a.f) > 20; if (a.f < 0) a.L.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.L.dir.clone().negate()); else a.L.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.L.dir); } }
    else { U.hvdc.tube.material.opacity = a.off ? 0.25 : 1; U.hvdc.tube.material.transparent = a.off; }
    const col = loadColour(u);
    for (let j = 0; j < P.PER; j++, k++) {
      P.ph[k] = (P.ph[k] + dt * sp + 1) % 1;
      if (!show) { P.pIM.setMatrixAt(k, m4.makeScale(0, 0, 0)); continue; }
      a.curve.getPointAt(P.ph[k], tmp); tmp.y += 0.05; const s = 0.6 + Math.min(1.3, u);
      P.pIM.setMatrixAt(k, m4.compose(tmp, q, sc.set(s, s, s))); P.pIM.setColorAt(k, col);
    }
  }
  P.pIM.instanceMatrix.needsUpdate = true; if (P.pIM.instanceColor) P.pIM.instanceColor.needsUpdate = true;
  for (const p of PLANTS) {
    const o = U.plants[p.id], g = r.gen[p.id] || 0;
    o.col.scale.y = Math.max(0.02, Math.abs(g) / 100); o.col.material.color.set(g < 0 ? '#5fd4ff' : TYPES[p.type].colour);
    if (o.g.userData.rotors) o.g.userData.rotors.forEach((ro) => { ro.rotation.z -= dt * (0.6 + 6 * (g / p.cap)); });
    o.capM.scale.y = Math.max(0.02, (p.mskvy && !out.mskvy ? 0 : p.cap) / 100);
  }
  U.winMat.emissiveIntensity = night * 1.2;
  for (const c of U.cities) { const d = r.D.zones.find((z) => z.id === c.z.id).total; c.glow.material.opacity = night * 0.25 * Math.min(1.5, d / 2500 + 0.3); }
}
