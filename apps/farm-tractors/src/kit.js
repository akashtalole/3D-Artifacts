// Shared with projects/heavy-machinery (Earthmovers).
/**
 * Building kit for the machines: materials, extruded profiles, beams, tyres,
 * crawler tracks, cabs, hydraulic rams and attachments.
 * Units are metres. A machine faces +x, y is up and +z is its right-hand side.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ── materials ──
export const M = {
  paint: new THREE.MeshPhysicalMaterial({ color: '#f2b705', roughness: 0.42, metalness: 0.15, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
  black: new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.65, metalness: 0.3 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2c3036', roughness: 0.55, metalness: 0.45 }),
  steel: new THREE.MeshStandardMaterial({ color: '#8b9198', roughness: 0.35, metalness: 0.85 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#e8ecef', roughness: 0.12, metalness: 1 }),
  worn: new THREE.MeshStandardMaterial({ color: '#5d5a55', roughness: 0.7, metalness: 0.6 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#151617', roughness: 0.92, metalness: 0 }),
  rim: new THREE.MeshStandardMaterial({ color: '#d9a404', roughness: 0.45, metalness: 0.3 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#9fc4d8', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
  seat: new THREE.MeshStandardMaterial({ color: '#30343a', roughness: 0.8 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4c0', emissiveIntensity: 0.15, roughness: 0.2 }),
  amber: new THREE.MeshStandardMaterial({ color: '#ff9a1a', emissive: '#ff7a00', emissiveIntensity: 0.4, roughness: 0.3 }),
  red: new THREE.MeshStandardMaterial({ color: '#c8211b', roughness: 0.5 }),
  soil: new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.95 }),
  person: new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.7 }),
  skin: new THREE.MeshStandardMaterial({ color: '#c58c62', roughness: 0.7 }),
  hat: new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.5 }),
};
/** stripes for counterweights and truck tails */
export function hazardMaterial() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d');
  g.fillStyle = '#f2b705'; g.fillRect(0, 0, 128, 32); g.fillStyle = '#16181a';
  for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
}

const shadow = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
export const mesh = (geo, mat) => shadow(new THREE.Mesh(geo, mat));

// ── primitives ──
export function rbox(w, h, d, mat, r = 0.04) {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01));
  return mesh(g, mat);
}
export function box(w, h, d, mat) { return mesh(new THREE.BoxGeometry(w, h, d), mat); }
/** cylinder with its axis along x, y or z */
export function cyl(r, len, mat, axis = 'z', seg = 20) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  if (axis === 'z') g.rotateX(Math.PI / 2); else if (axis === 'x') g.rotateZ(Math.PI / 2);
  return mesh(g, mat);
}
/** extrude a side profile drawn in the XY plane, centred on z */
export function extrude(points, depth, mat, bevel = 0.02) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -(depth - 2 * bevel) / 2); g.computeVertexNormals();
  return mesh(g, mat);
}
/** a beam outline along a polyline with a thickness at each point (booms, sticks, arms) */
export function beamShape(pts, thick) {
  const top = [], bot = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, t = thick[i] / 2;
    top.push([pts[i][0] + nx * t, pts[i][1] + ny * t]); bot.push([pts[i][0] - nx * t, pts[i][1] - ny * t]);
  }
  // round the ends with a few points
  const cap = (c, from, to, r) => { const out = []; for (let k = 1; k < 6; k++) { const a = from + (to - from) * (k / 6); out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); } return out; };
  const e0 = pts[0], e1 = pts[pts.length - 1];
  const ang = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]);
  const a1 = ang(pts[pts.length - 2], e1), a0 = ang(pts[1], e0);
  return [...top, ...cap(e1, a1 + Math.PI / 2, a1 - Math.PI / 2, thick[thick.length - 1] / 2), ...bot.reverse(), ...cap(e0, a0 + Math.PI / 2, a0 - Math.PI / 2, thick[0] / 2)];
}
export function beam(pts, thick, depth, mat) { return extrude(beamShape(pts, thick), depth, mat, 0.025); }
/** a pin boss at a joint */
export function pin(r, len, at = [0, 0], z = 0) { const g = new THREE.Group(); const p = cyl(r * 0.55, len + 0.06, M.steel); const b = cyl(r, len, M.dark); g.add(b, p); g.position.set(at[0], at[1], z); return g; }

// ── tyres ──
const tyreCache = new Map();
function tyreGeometry(R, W, rimR) {
  const k = `${R}|${W}|${rimR}`; if (tyreCache.has(k)) return tyreCache.get(k);
  const pts = [], hw = W / 2, sh = Math.min(R - rimR, W) * 0.32, inner = rimR * 1.02;
  pts.push(new THREE.Vector2(inner, -hw * 0.92));
  for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2); pts.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, -hw + sh + Math.sin(a) * sh)); }
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); pts.push(new THREE.Vector2(R - sh + Math.cos(a) * sh, hw - sh + Math.sin(a) * sh)); }
  pts.push(new THREE.Vector2(inner, hw * 0.92));
  const body = new THREE.LatheGeometry(pts, 40); body.rotateX(Math.PI / 2);   // axle along z
  // chevron lugs around the tread
  const lugs = []; const n = Math.round((2 * Math.PI * R) / (W * 0.42)), lw = W * 0.5, lt = Math.max(0.035, R * 0.05);
  for (let i = 0; i < n; i++) for (const side of [-1, 1]) {
    const g = new THREE.BoxGeometry(lt * 2.2, lt, lw * 0.95);
    g.rotateY(side * 0.45); g.translate(0, R + lt * 0.3, side * (W * 0.25) + (i % 2 ? 0.02 : -0.02));
    g.rotateZ((i / n) * Math.PI * 2 + (side > 0 ? Math.PI / n : 0)); lugs.push(g);
  }
  const lug = mergeGeometries(lugs.map((g) => g.toNonIndexed()));
  const out = { body, lug }; tyreCache.set(k, out); return out;
}
/** a wheel: tyre with lugs, rim and hub; spin = rotation.z */
export function wheel(R, W, { rimR = R * 0.58, rim = M.rim, dual = false } = {}) {
  const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  const { body, lug } = tyreGeometry(R, W, rimR);
  spin.add(mesh(body, M.rubber), mesh(lug, M.rubber));
  const rimG = new THREE.CylinderGeometry(rimR, rimR, W * 0.86, 28, 1, true); rimG.rotateX(Math.PI / 2);
  spin.add(mesh(rimG, rim));
  const disc = cyl(rimR * 0.98, 0.04, rim); spin.add(disc);
  const hub = cyl(rimR * 0.35, W * 0.5, M.dark); hub.position.z = W * 0.2; spin.add(hub);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, n = cyl(0.025 + R * 0.01, 0.06, M.steel); n.position.set(Math.cos(a) * rimR * 0.25, Math.sin(a) * rimR * 0.25, W * 0.45); spin.add(n); }
  if (dual) { const w2 = wheel(R, W, { rimR, rim }); w2.position.z = -W * 1.05; g.add(w2); g.userData.twin = w2; }
  g.userData = { ...g.userData, spin, R };
  return g;
}
export function rollWheel(w, dist) { w.userData.spin.rotation.z -= dist / w.userData.R; if (w.userData.twin) rollWheel(w.userData.twin, dist); }

// ── crawler tracks ──
/**
 * A crawler track: L = distance between idler and sprocket centres, r = their radius, W = shoe width.
 * The track loop is centred on its own origin; advance(ds) moves the shoes.
 */
export function track(L, r, W, { pitch = 0.19, sprocketFront = false, rollers = 7 } = {}) {
  const g = new THREE.Group(), P = 2 * L + 2 * Math.PI * r, n = Math.round(P / pitch), step = P / n, th = 0.07;
  const shoe = new THREE.BoxGeometry(step * 0.92, th, W);
  const grouser = new THREE.BoxGeometry(0.03, 0.045, W); grouser.translate(0, -th / 2 - 0.02, 0);
  const link = new THREE.BoxGeometry(step * 0.95, 0.1, 0.12); link.translate(0, th / 2 + 0.05, W * 0.18);
  const link2 = link.clone(); link2.translate(0, 0, -W * 0.36);
  const shoeG = mergeGeometries([shoe, grouser, link, link2].map((x) => x.toNonIndexed()));
  const shoes = new THREE.InstancedMesh(shoeG, M.worn, n); shoes.castShadow = true; shoes.receiveShadow = true; g.add(shoes);
  const R = r + th / 2;
  const place = (s, m) => {
    s = ((s % P) + P) % P; let x, y, a;
    if (s < L) { x = -L / 2 + s; y = -R; a = 0; }
    else if (s < L + Math.PI * r) { const t = -Math.PI / 2 + (s - L) / r; x = L / 2 + Math.cos(t) * R; y = Math.sin(t) * R; a = t + Math.PI / 2; }
    else if (s < 2 * L + Math.PI * r) { x = L / 2 - (s - L - Math.PI * r); y = R; a = Math.PI; }
    else { const t = Math.PI / 2 + (s - 2 * L - Math.PI * r) / r; x = -L / 2 + Math.cos(t) * R; y = Math.sin(t) * R; a = t + Math.PI / 2; }
    m.makeRotationZ(a); m.setPosition(x, y, 0);
  };
  const m = new THREE.Matrix4(); let off = 0;
  const update = () => { for (let i = 0; i < n; i++) { place(i * step + off, m); shoes.setMatrixAt(i, m); } shoes.instanceMatrix.needsUpdate = true; };
  update();
  // frame, idler, sprocket, rollers
  const frame = rbox(L * 0.92, r * 1.1, W * 0.55, M.paint, 0.06); g.add(frame);
  const spx = sprocketFront ? L / 2 : -L / 2, idx = -spx;
  const sprocket = new THREE.Group(); sprocket.position.x = spx; g.add(sprocket);
  sprocket.add(cyl(r * 0.92, W * 0.42, M.dark, 'z', 24));
  for (let i = 0; i < 21; i++) { const t = cyl(0.035, W * 0.12, M.steel, 'z', 6); const a = (i / 21) * Math.PI * 2; t.position.set(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, 0); sprocket.add(t); }
  sprocket.add(cyl(r * 0.5, W * 0.6, M.black));
  const idler = cyl(r * 0.9, W * 0.38, M.dark, 'z', 24); idler.position.x = idx; g.add(idler);
  for (let i = 0; i < rollers; i++) { const ro = cyl(r * 0.32, W * 0.4, M.dark, 'z', 12); ro.position.set(-L / 2 + ((i + 1) / (rollers + 1)) * L, -r + r * 0.33, 0); g.add(ro); }
  for (const x of [-L * 0.2, L * 0.2]) { const cr = cyl(r * 0.2, W * 0.3, M.dark, 'z', 10); cr.position.set(x, r - r * 0.18, 0); g.add(cr); }
  g.userData.advance = (ds) => { off -= ds; update(); sprocket.rotation.z -= ds / r; idler.rotation.z -= ds / r; };
  return g;
}

// ── cab ──
/** an operator cab: w × h × d footprint centred on x/z with its floor at y = 0 */
export function cab(w, h, d, { canopy = false, slope = 0.12, person = true } = {}) {
  const g = new THREE.Group(), post = 0.07;
  const pm = M.black;
  const roof = rbox(w + 0.12, 0.09, d + 0.12, M.paint, 0.04); roof.position.y = h; g.add(roof);
  for (const [x, z] of [[w / 2, d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]]) {
    const p = box(post, h, post, pm); p.position.set(x, h / 2, z); if (x > 0) { p.rotation.z = slope; p.position.x -= Math.sin(slope) * h / 2; } g.add(p);
  }
  if (!canopy) {
    const glassF = box(0.02, h * 0.92, d - post, M.glass); glassF.position.set(w / 2 - Math.sin(slope) * h / 2, h / 2, 0); glassF.rotation.z = slope; g.add(glassF);
    const glassB = box(0.02, h * 0.8, d - post, M.glass); glassB.position.set(-w / 2, h * 0.55, 0); g.add(glassB);
    for (const z of [d / 2, -d / 2]) { const s = box(w - post, h * 0.92, 0.02, M.glass); s.position.set(-0.04, h / 2, z); g.add(s); }
  }
  const floor = box(w, 0.06, d, M.dark); floor.position.y = 0.03; g.add(floor);
  const seat = new THREE.Group(); seat.position.set(-w * 0.08, 0, 0); g.add(seat);
  const sb = rbox(0.45, 0.12, 0.48, M.seat, 0.04); sb.position.y = 0.48; seat.add(sb);
  const sbk = rbox(0.1, 0.62, 0.46, M.seat, 0.04); sbk.position.set(-0.2, 0.82, 0); sbk.rotation.z = -0.15; seat.add(sbk);
  const ped = box(0.3, 0.4, 0.3, M.black); ped.position.y = 0.22; seat.add(ped);
  for (const z of [0.3, -0.3]) { const c = box(0.35, 0.12, 0.12, M.black); c.position.set(0.05, 0.62, z); seat.add(c); const j = cyl(0.018, 0.16, M.black, 'y', 8); j.position.set(0.15, 0.74, z); seat.add(j); }
  if (person) {
    const p = new THREE.Group(); p.position.set(-0.05, 0.55, 0);
    const torso = rbox(0.24, 0.5, 0.38, M.person, 0.1); torso.position.set(-0.04, 0.3, 0); p.add(torso);
    const head = mesh(new THREE.SphereGeometry(0.1, 14, 10), M.skin); head.position.set(-0.02, 0.66, 0); p.add(head);
    const hat = mesh(new THREE.SphereGeometry(0.115, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.hat); hat.position.set(-0.02, 0.68, 0); p.add(hat);
    const legs = rbox(0.42, 0.14, 0.32, M.dark, 0.06); legs.position.set(0.18, 0.05, 0); p.add(legs);
    seat.add(p);
  }
  return g;
}
export function lamp(r = 0.07) { const g = new THREE.Group(); const b = cyl(r, 0.08, M.black, 'x', 12); const l = cyl(r * 0.85, 0.02, M.lamp, 'x', 12); l.position.x = 0.045; g.add(b, l); g.userData.lamp = l; return g; }
export function beacon() { const g = new THREE.Group(); const b = cyl(0.06, 0.04, M.black, 'y', 10); const l = cyl(0.05, 0.1, M.amber, 'y', 12); l.position.y = 0.07; g.add(b, l); g.userData.beacon = l; return g; }
export function exhaust(h = 0.6, r = 0.05) { const g = new THREE.Group(); const p = cyl(r, h, M.dark, 'y', 12); p.position.y = h / 2; const c = cyl(r * 1.1, 0.04, M.black, 'y', 12); c.position.y = h; g.add(p, c); g.userData.top = new THREE.Vector3(0, h + 0.05, 0); return g; }

// ── hydraulic rams ──
/**
 * A hydraulic cylinder between two anchors (Object3Ds anywhere in the machine).
 * The barrel starts at `a`, the rod at `b`; both stretch along the line between them.
 * Lengths are fixed after calibrate() so the rod slides in and out of the barrel.
 */
export class Ram {
  constructor(root, a, b, rb = 0.08, rr = 0.045) {
    this.root = root; this.a = a; this.b = b; this.rb = rb; this.rr = rr; this.Lb = 1; this.Lr = 1;
    this.g = new THREE.Group(); root.add(this.g);
    this.barrel = cyl(rb, 1, M.paint, 'y', 16); this.barrel.geometry.translate(0, 0.5, 0);
    this.cap = cyl(rb * 1.15, 0.08, M.dark, 'y', 16); this.eyeA = cyl(rb * 0.9, rb * 2.2, M.dark, 'z', 12);
    this.rod = cyl(rr, 1, M.chrome, 'y', 12); this.rod.geometry.translate(0, 0.5, 0);
    this.eyeB = cyl(rr * 1.6, rb * 2, M.dark, 'z', 12);
    this.g.add(this.barrel, this.cap, this.eyeA, this.rod, this.eyeB);
    this.pa = new THREE.Vector3(); this.pb = new THREE.Vector3();
  }
  dist(full = true) { if (full) this.root.updateWorldMatrix(true, true); this.a.getWorldPosition(this.pa); this.b.getWorldPosition(this.pb); this.root.worldToLocal(this.pa); this.root.worldToLocal(this.pb); return this.pa.distanceTo(this.pb); }
  calibrate(dmin, dmax) { this.Lb = dmin * 0.94; this.Lr = Math.min(dmin * 0.94, Math.max(dmax - this.Lb + 0.1, dmin * 0.5)); }
  update(full = true) {
    const d = this.dist(full), dir = this.pb.clone().sub(this.pa).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.barrel.position.copy(this.pa); this.barrel.quaternion.copy(q); this.barrel.scale.set(1, this.Lb, 1);
    this.cap.position.copy(this.pa).addScaledVector(dir, this.Lb); this.cap.quaternion.copy(q);
    this.rod.position.copy(this.pb); this.rod.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)); this.rod.scale.set(1, this.Lr, 1);
    this.eyeA.position.copy(this.pa); this.eyeB.position.copy(this.pb);
    // eyes keep their pin axis along the root's z, which is how every ram in the portfolio is pinned
    this.extension = d;
  }
}
/** an anchor point on a part */
export function anchor(parent, x, y, z = 0) { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; }

// ── attachments ──
/**
 * A digging bucket hanging from its pivot at the origin, opening towards +x when the bucket is curled back.
 * w = width, L = pivot-to-tooth length, depth = how deep the shell is.
 */
export function bucket(w, L, depth, { teeth = 5, mat = M.paint, heavy = false } = {}) {
  const g = new THREE.Group();
  // side profile: from the pivot at the top, round the back and the bottom, up to the lip at the front
  const cy = -0.5 * L, rx = depth, ry = 0.5 * L, t = Math.min(0.06, depth * 0.08), N = 18, a0 = 100 * Math.PI / 180, a1 = 338 * Math.PI / 180;
  const outer = [], inner = [];
  for (let i = 0; i <= N; i++) { const a = a0 + (a1 - a0) * (i / N); outer.push([Math.cos(a) * rx, cy + Math.sin(a) * ry]); inner.push([Math.cos(a) * (rx - t), cy + Math.sin(a) * (ry - t)]); }
  const shell = extrude([...outer, ...inner.reverse()], w, mat, 0.012); g.add(shell);
  // side plates fill the C between the arc and the chord from the lip back to the pivot
  for (const z of [w / 2, -w / 2]) { const side = extrude([...outer, [0.05, 0.02]], 0.035, mat, 0.008); side.position.z = z - Math.sign(z) * 0.0175; g.add(side); }
  const lip = outer[N], prev = outer[N - 1], ang = Math.atan2(lip[1] - prev[1], lip[0] - prev[0]);
  const edge = box(0.12, 0.045, w * 1.01, M.worn); edge.position.set(lip[0], lip[1], 0); edge.rotation.z = ang; g.add(edge);
  for (let i = 0; i < teeth; i++) {
    const z = -w / 2 + (w * (i + 0.5)) / teeth, tl = heavy ? 0.24 : 0.18;
    const tooth = extrude([[0, -0.045], [tl, -0.01], [tl, 0.01], [0, 0.045]], heavy ? 0.12 : 0.09, M.worn, 0.008);
    tooth.position.set(lip[0], lip[1], z); tooth.rotation.z = ang; g.add(tooth);
  }
  // wear strips under the bottom
  for (const z of [w * 0.3, -w * 0.3]) { const ws = box(0.4, 0.03, 0.06, M.worn); ws.position.set(0, -L - 0.01, z); g.add(ws); }
  // pivot lugs and the link lug behind the pivot (the ram anchors to it)
  for (const z of [0.16, -0.16].map((v) => v * Math.min(1.6, w))) { const lug = extrude([[-0.38, 0.2], [0.12, 0.12], [0.12, -0.2], [-0.3, -0.22]], 0.04, M.dark, 0.008); lug.position.z = z; g.add(lug); }
  g.add(pin(0.06, Math.min(w, 0.55)));
  const lp = pin(0.05, Math.min(w, 0.55), [-0.3, 0.12]); g.add(lp);
  const tip = anchor(g, lip[0] + Math.cos(ang) * 0.18, lip[1] + Math.sin(ang) * 0.18);
  // soil carried in the bucket (scaled by the fill), and the outward normal of the opening
  const soilG = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const soil = mesh(soilG, M.soil); soil.scale.set(rx * 0.75, 0.01, w * 0.45); soil.position.set(lip[0] * 0.35, (lip[1]) * 0.55, 0); soil.rotation.z = Math.atan2(lip[0], -lip[1]) - Math.PI / 2; soil.visible = false; g.add(soil);
  const mouthN = new THREE.Vector3(-lip[1], lip[0], 0).normalize();
  g.userData = { kind: 'bucket', tip, lug: anchor(g, -0.3, 0.12), w, soil, mouthN };
  return g;
}
export function breaker(len = 1.6, r = 0.16) {
  const g = new THREE.Group();
  const bracket = rbox(0.4, 0.35, 0.42, M.paint, 0.04); bracket.position.y = -0.15; g.add(bracket);
  const body = cyl(r, len * 0.7, M.black, 'y', 18); body.position.y = -0.3 - len * 0.35; g.add(body);
  const ch = new THREE.CylinderGeometry(r * 0.35, 0.02, len * 0.35, 12); const chisel = mesh(ch, M.steel); chisel.position.y = -0.3 - len * 0.7 - len * 0.17; g.add(chisel);
  g.add(pin(0.06, 0.45));
  const tip = anchor(g, 0, -0.3 - len * 0.88);
  g.userData = { kind: 'breaker', tip, chisel };
  return g;
}
export function forks(w = 1.2, L = 1.2, { h = 0.9 } = {}) {
  const g = new THREE.Group();
  const plate = box(0.08, h, w, M.dark); plate.position.set(0.05, -h * 0.35, 0); g.add(plate);
  for (const y of [0.05, -h * 0.75]) { const b = box(0.1, 0.08, w, M.paint); b.position.set(0.08, y, 0); g.add(b); }
  for (const z of [w * 0.3, -w * 0.3]) {
    const v = box(0.06, h * 0.9, 0.12, M.black); v.position.set(0.14, -h * 0.4, z); g.add(v);
    const t = box(L, 0.05, 0.12, M.black); t.position.set(0.14 + L / 2, -h * 0.82, z); g.add(t);
  }
  g.add(pin(0.05, 0.4));
  const tip = anchor(g, 0.14 + L, -h * 0.82);
  g.userData = { kind: 'forks', tip };
  return g;
}
export function auger(len = 1.4, r = 0.2) {
  const g = new THREE.Group();
  const drive = cyl(0.14, 0.4, M.black, 'y', 14); drive.position.y = -0.35; g.add(drive);
  const shaft = cyl(0.05, len, M.steel, 'y', 10); shaft.position.y = -0.55 - len / 2; g.add(shaft);
  const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * Math.PI * 2 * 5; pts.push(new THREE.Vector3(Math.cos(a) * r, -0.6 - t * (len - 0.1), Math.sin(a) * r)); }
  const flight = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.025, 6), M.steel); g.add(flight);
  const spin = new THREE.Group(); spin.add(shaft, flight); g.add(spin);
  g.add(pin(0.05, 0.4)); const bracket = rbox(0.35, 0.25, 0.4, M.paint, 0.04); bracket.position.y = -0.12; g.add(bracket);
  const tip = anchor(g, 0, -0.6 - len);
  g.userData = { kind: 'auger', tip, spin };
  return g;
}
/** blade-like broom for the skid steer */
export function sweeper(w = 1.8) {
  const g = new THREE.Group();
  const hood = extrude([[-0.1, 0.2], [0.45, 0.2], [0.6, -0.1], [0.55, -0.35], [-0.1, -0.1]], w, M.paint, 0.02); g.add(hood);
  const br = cyl(0.26, w * 0.95, M.black, 'z', 18); br.position.set(0.25, -0.38, 0); g.add(br);
  g.add(pin(0.05, 0.4));
  const tip = anchor(g, 0.25, -0.62);
  g.userData = { kind: 'sweeper', tip, spin: br };
  return g;
}
