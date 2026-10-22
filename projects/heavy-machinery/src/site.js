/**
 * The job site: every machine at work on a scripted, looping cycle.
 * Each actor follows keyframes for position, heading and joints; the two haul
 * trucks run a closed haul road and take turns at the excavator.
 */
import * as THREE from 'three';
import { BUILDERS } from './machines.js';
import { M, box, rbox, cyl, mesh } from './kit.js';
import { MACHINES } from './data.js';

const ease = (t) => t * t * (3 - 2 * t);
export const TRUCK_SCALE = 0.65, TRUCK_M3 = 60 * TRUCK_SCALE ** 3, TRUCK_T = Math.round(TRUCK_M3 * 1.8);
const lerp = (a, b, t) => a + (b - a) * t;

/** interpolate keyframes [[t, {x, z, h, ...joints}], …] at time t (looping) */
function sample(keys, t) {
  const T = keys[keys.length - 1][0]; t = ((t % T) + T) % T;
  let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= t) i++;
  const [t0, a] = keys[i], [t1, b] = keys[i + 1], u = ease(Math.min(1, (t - t0) / Math.max(1e-6, t1 - t0)));
  const out = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = lerp(a[k] ?? b[k], b[k] ?? a[k], u);
  return out;
}
/** fill missing keys so every keyframe carries the full state (keeps interpolation clean) */
function complete(keys) { let prev = {}; return keys.map(([t, k]) => { prev = { ...prev, ...k }; return [t, { ...prev }]; }); }

function dirtTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#a88e68'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { const v = 120 + Math.random() * 60; g.fillStyle = `rgba(${v + 20},${v},${v - 30},${Math.random() * 0.35})`; const s = Math.random() * 3 + 1; g.fillRect(Math.random() * 256, Math.random() * 256, s, s); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function person(color = M.person) {
  const p = new THREE.Group();
  const legs = rbox(0.22, 0.85, 0.3, M.dark, 0.08); legs.position.y = 0.43; p.add(legs);
  const t = rbox(0.26, 0.6, 0.42, color, 0.1); t.position.y = 1.15; p.add(t);
  const h = mesh(new THREE.SphereGeometry(0.11, 12, 10), M.skin); h.position.y = 1.58; p.add(h);
  const hat = mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.hat); hat.position.y = 1.6; p.add(hat);
  return p;
}
function pallet() {
  const g = new THREE.Group(); const base = box(1.1, 0.14, 1.0, new THREE.MeshStandardMaterial({ color: '#b58a52', roughness: 0.9 })); base.position.y = 0.07; g.add(base);
  const blocks = box(1.0, 0.7, 0.92, new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.85 })); blocks.position.y = 0.5; g.add(blocks);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildSite(paint) {
  const G = new THREE.Group(); const actors = []; const stats = { loads: 0, tonnes: 0, pallets: 0, trench: 0, hopper: 0, fuel: 0 };
  // ground, haul road, terrain features
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 0.97 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; G.add(ground);
  const road = new THREE.CatmullRomCurve3([[-30.7, -3.5], [-10, -6.5], [12, -10], [33, -14.5], [46, -24], [36, -34], [8, -33], [-22, -28], [-44, -18], [-46, -7]].map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  { const N = 260, pos = [], idx = []; for (let i = 0; i <= N; i++) { const u = i / N, p = road.getPointAt(u % 1), t = road.getTangentAt(u % 1), nx = -t.z, nz = t.x; for (const s of [-4.2, 4.2]) pos.push(p.x + nx * s, 0.02, p.z + nz * s); if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const r = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#6f675d', roughness: 1, side: THREE.DoubleSide })); r.receiveShadow = true; G.add(r); }
  const access = new THREE.Mesh(new THREE.PlaneGeometry(76, 7), new THREE.MeshStandardMaterial({ color: '#7d7466', roughness: 1 })); access.rotation.x = -Math.PI / 2; access.position.set(0, 0.025, -46); access.receiveShadow = true; G.add(access);
  const dirt = new THREE.MeshStandardMaterial({ color: '#8c6a44', roughness: 0.98, flatShading: true });
  const moundG = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2); { const p = moundG.attributes.position; for (let i = 0; i < p.count; i++) { const n = 1 + 0.08 * Math.sin(p.getX(i) * 9) * Math.cos(p.getZ(i) * 7); p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * n); } moundG.computeVertexNormals(); }
  const face = mesh(moundG, dirt); face.scale.set(10, 5, 11); face.position.set(-44, 0, 4); G.add(face);
  const pile = (x, z, r, h, color = '#9b7b55') => { const m = mesh(new THREE.ConeGeometry(r, h, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.98, flatShading: true })); m.position.set(x, h / 2, z); G.add(m); return m; };
  const dumpPile = pile(30, -18.5, 6, 3); dumpPile.userData.base = [6, 3];
  const aggPile = pile(3.5, 22, 4.6, 3.4, '#a6a198');
  const spoil = pile(-12, 11, 1.6, 0.9);
  // crusher feed hopper
  const hopper = new THREE.Group(); hopper.position.set(15.5, 0, 13.6); G.add(hopper);
  const hm = new THREE.MeshStandardMaterial({ color: '#4f6e8c', roughness: 0.6, metalness: 0.4 });
  for (const [x, z] of [[-1.6, -1.4], [1.6, -1.4], [-1.6, 1.4], [1.6, 1.4]]) { const l = cyl(0.12, 2.2, M.dark, 'y', 8); l.position.set(x, 1.1, z); hopper.add(l); }
  const hb = mesh(new THREE.CylinderGeometry(2.4, 1.1, 1.6, 4, 1, true), hm); hb.rotation.y = Math.PI / 4; hb.position.y = 2.9; hb.material.side = THREE.DoubleSide; hopper.add(hb);
  const conv = box(9, 0.3, 1.0, M.dark); conv.position.set(5, 1.3, -1); conv.rotation.z = 0.18; hopper.add(conv);
  // building under construction
  const bld = new THREE.Group(); bld.position.set(-26, 0, 31); G.add(bld);
  const conc = new THREE.MeshStandardMaterial({ color: '#b9b8b2', roughness: 0.9 });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const c = box(0.45, 7.2, 0.45, conc); c.position.set(-6 + i * 4, 3.6, -3 + j * 3.5); bld.add(c); }
  for (const y of [3.5, 7.0]) { const s = box(12.8, 0.25, 7.8, conc); s.position.set(0, y, 0.5); bld.add(s); }
  for (let i = 0; i < 4; i++) { const c = box(0.45, 2.2, 0.45, conc); c.position.set(-6 + i * 4, 8.2, 4); bld.add(c); const rb = cyl(0.02, 1.4, M.red, 'y', 4); rb.position.set(-6 + i * 4, 10, 4); bld.add(rb); }
  bld.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const pstack = new THREE.Group(); pstack.position.set(-31, 0, 22); G.add(pstack); for (let i = 0; i < 3; i++) { const p = pallet(); p.position.set(0, i * 0.85, 0); pstack.add(p); }
  // site office, fence, cones, light towers, trees
  const off = new THREE.Group(); off.position.set(32, 0, 34); G.add(off);
  const cont = new THREE.MeshStandardMaterial({ color: '#e7e3d7', roughness: 0.7 });
  for (const [x, y] of [[0, 1.3], [0, 3.9], [6.4, 1.3]]) { const c = rbox(6.1, 2.5, 2.45, cont, 0.04); c.position.set(x, y, 0); off.add(c); for (let w = -2; w <= 2; w += 2) { const win = box(0.9, 0.7, 0.02, M.glass); win.position.set(x + w, y + 0.2, 1.24); off.add(win); } }
  const stair = box(0.9, 2.6, 0.08, M.dark); stair.position.set(3.4, 1.3, 1.6); stair.rotation.x = 0.4; off.add(stair);
  off.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const fenceM = new THREE.MeshStandardMaterial({ color: '#a7b0b8', roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.55 });
  for (const [x0, z0, x1, z1] of [[-62, -58, 62, -58], [62, -58, 62, 52], [62, 52, -62, 52], [-62, 52, -62, -58]]) { const L = Math.hypot(x1 - x0, z1 - z0); const f = box(L, 2, 0.05, fenceM); f.position.set((x0 + x1) / 2, 1, (z0 + z1) / 2); f.rotation.y = -Math.atan2(z1 - z0, x1 - x0); G.add(f); }
  const coneM = new THREE.MeshStandardMaterial({ color: '#ff6a00', roughness: 0.5 });
  for (let i = 0; i < 26; i++) { const u = i / 26, p = road.getPointAt(u), t = road.getTangentAt(u); const c = mesh(new THREE.ConeGeometry(0.22, 0.7, 12), coneM); c.position.set(p.x - t.z * 5, 0.35, p.z + t.x * 5); G.add(c); }
  for (const [x, z] of [[-36, 12], [24, 8], [-14, -40], [40, -40], [-30, 40]]) { const tw = new THREE.Group(); tw.position.set(x, 0, z); const mast = cyl(0.08, 8, M.dark, 'y', 8); mast.position.y = 4; tw.add(mast); const tr = rbox(2, 1.2, 1.4, M.paint, 0.05); tr.position.y = 0.7; tw.add(tr); for (let k = 0; k < 4; k++) { const l = box(0.5, 0.35, 0.12, M.lamp); l.position.set(-0.75 + k * 0.5, 8.1, 0); tw.add(l); } G.add(tw); }
  const leaf = new THREE.MeshStandardMaterial({ color: '#4e6b3a', roughness: 0.9, flatShading: true }), bark = new THREE.MeshStandardMaterial({ color: '#5a4630', roughness: 0.9 });
  for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2, r = 82 + (i % 5) * 4; const t = new THREE.Group(); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.85); const tk = cyl(0.25, 3, bark, 'y', 6); tk.position.y = 1.5; t.add(tk); const cn = mesh(new THREE.IcosahedronGeometry(2.4 + (i % 3) * 0.6, 0), leaf); cn.position.y = 4.2; t.add(cn); G.add(t); }
  for (const [x, z, r] of [[-11, 6.5, 0.8], [-5, 8, -2.4], [-20, 25, 2.2], [24, -9, 1.0], [12, 27, -1.5]]) { const p = person(); p.position.set(x, 0, z); p.rotation.y = r; G.add(p); }
  // trench behind the backhoe
  const trench = box(0.7, 0.03, 9, new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 1 })); trench.position.set(-8, 0.02, 9); G.add(trench);
  pile(14.6, 33, 1.3, 0.8);

  const add = (id, name, x, z, h, keys, extra = {}) => {
    const m = BUILDERS[id](); m.root.position.set(x, 0, z); m.root.rotation.y = h; G.add(m.root);
    const a = { id, name, m, keys: keys ? complete(keys) : null, last: null, status: '', ...extra }; actors.push(a); return a;
  };

  // excavator at the face; two trucks take turns
  const EX_PASS = 6, T_LOAD = 4 * EX_PASS, T_CYCLE = 72;
  const ex = add('excavator', 'Excavator', -31, 3.2, Math.PI, null);
  const pass = (S) => [[0, { swing: 0, boom: 14, stick: 2, bucket: -50 }], [1.5, { boom: 3, stick: -50, bucket: 107 }], [2.5, { boom: 45, stick: -24, bucket: 39 }], [3.7, { swing: S, boom: 53, stick: -5, bucket: 12 }], [4.5, { bucket: -140, stick: 10 }], [6, { swing: 0, boom: 14, stick: 2, bucket: -50 }]];
  const truckPass = complete(pass(-90)), sidePass = complete(pass(62));
  const trucks = [add('truck', 'Dump truck 1', 0, 0, 0, null, { off: 0 }), add('truck', 'Dump truck 2', 0, 0, 0, null, { off: T_CYCLE / 2 })];
  for (const tr of trucks) tr.m.root.scale.setScalar(TRUCK_SCALE);   // a ≈30 t dump truck, matched to a 20 t excavator
  const U_DUMP = 0.31;
  const truckU = (t) => {   // position along the road (0 = load spot) for time in cycle
    if (t < T_LOAD) return [0, 'Loading'];
    if (t < T_LOAD + 16) return [U_DUMP * ease((t - T_LOAD) / 16), 'Hauling'];
    if (t < T_LOAD + 28) return [U_DUMP, 'Dumping'];
    return [U_DUMP + (1 - U_DUMP) * ease((t - T_LOAD - 28) / (T_CYCLE - T_LOAD - 28)), 'Returning'];
  };
  const dumpPos = road.getPointAt(U_DUMP), dumpTan = road.getTangentAt(U_DUMP);
  dumpPile.position.set(dumpPos.x - dumpTan.x * 9, 1.5, dumpPos.z - dumpTan.z * 9);
  // the dozer spreads the dump; the loader feeds the hopper; the grader trims the access road
  const dz = add('dozer', 'Dozer', 0, 0, 0, null);
  { const px = dumpPile.position.x, pz = dumpPile.position.z; dz.m.root.position.set(px - 12, 0, pz - 7); dz.keys = complete([[0, { x: px - 12, z: pz - 7, blade: -3 }], [9, { x: px + 1 }], [10, { blade: 16 }], [17, { x: px - 12 }], [18, { blade: -3 }]]); }
  const ldr = add('loader', 'Wheel loader', 11.5, 22, Math.PI, [
    [0, { x: 11.5, z: 22, h: Math.PI, lift: -6, tilt: 0, steer: 0 }], [3, { x: 8.6, tilt: -4 }], [4.6, { lift: 4, tilt: 42 }],
    [8, { x: 14, z: 24.6, h: Math.PI + 0.75, steer: 18, lift: 10 }], [11.5, { x: 15.5, z: 18.2, h: Math.PI / 2 + 0.05, steer: -10, lift: 44, tilt: 30 }],
    [13, { tilt: -75, steer: 0 }], [14.2, { tilt: 30 }], [17.5, { x: 14, z: 24.6, h: Math.PI + 0.75, steer: 18, lift: 4 }], [21, { x: 11.5, z: 22, h: Math.PI, lift: -6, tilt: 0, steer: 0 }]]);
  ldr.events = [[13, () => { stats.hopper += 3.1 * 1.8; }]];
  add('grader', 'Motor grader', -30, -46, 0, [[0, { x: -30, lift: -0.05, circle: 30 }], [26, { x: 28 }], [27, { lift: 0.3 }], [44, { x: -30 }], [45, { lift: -0.05 }]]);
  const bh = add('backhoe', 'Backhoe loader', -8, 17, -Math.PI / 2, [
    [0, { stabs: 1, swing: 0, boom: -10, dipper: -11, bucket: 100, extend: 0.5 }], [1.8, { boom: -12, dipper: 25, bucket: 60 }], [3, { boom: -62, dipper: 22, bucket: 7 }],
    [4.4, { swing: -65 }], [5.4, { bucket: -160, dipper: -5 }], [7, { swing: 0, boom: -10, dipper: -11, bucket: 100 }]]);
  bh.events = [[5.4, () => { stats.trench += 0.4; }]];
  const th = add('telehandler', 'Telehandler', -24, 21.5, -Math.PI / 2, [
    [0, { boom: 0, extend: 0, tilt: 0, stabs: 0 }], [2, { stabs: 1 }], [9, { boom: 27.5, extend: 2.2, tilt: 4 }], [11, { boom: 25.5, tilt: 0 }], [12, { boom: 25.5 }], [15, { boom: 6, extend: 0 }], [17, { stabs: 0 }], [24, {}]]);
  const carried = pallet(); th.carried = carried;
  th.events = [[0.01, () => { th.m.mount.add(carried); carried.visible = true; }], [11.6, () => { const p = pallet(); th.m.root.updateWorldMatrix(true, true); const w = new THREE.Vector3(); th.m.tip(w); p.position.set(w.x, 3.63, w.z - 0.62); G.add(p); th.placed.push(p); if (th.placed.length > 10) G.remove(th.placed.shift()); carried.visible = false; stats.pallets++; }]];
  th.placed = [];
  carried.position.set(0.74, -0.76, 0); carried.rotation.y = Math.PI / 2;
  add('skid', 'Skid steer', 3, 33, 0, [[0, { x: 3, h: 0, lift: 0, tilt: -6 }], [4, { x: 11 }], [5, { tilt: 30 }], [7, { lift: 48 }], [8.5, { tilt: -75 }], [9.5, { tilt: 30 }], [11, { lift: 0 }], [15, { x: 3, tilt: -6 }]]);
  for (const a of actors) { a.m.update(0); if (a.keys) apply(a, sample(a.keys, 0), 0); }

  function apply(a, s, dt) {
    const r = a.m.root, px = r.position.x, pz = r.position.z;
    if (s.x !== undefined) r.position.x = s.x; if (s.z !== undefined) r.position.z = s.z; if (s.h !== undefined) r.rotation.y = s.h;
    for (const [k, v] of Object.entries(s)) if (a.m.joints[k]) a.m.set(k, v);
    const d = Math.hypot(r.position.x - px, r.position.z - pz);
    if (d > 0 && dt > 0) { const fwd = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), r.rotation.y); const sign = Math.sign(fwd.x * (r.position.x - px) + fwd.z * (r.position.z - pz)) || 1; a.m.roll(d * sign); a.moving = true; } else a.moving = false;
  }
  let lastT = 0;
  function update(t, dt) {
    // trucks and the excavator
    const exT = t % T_CYCLE;
    for (const tr of trucks) {
      const tt = (t + tr.off) % T_CYCLE, [u, st] = truckU(tt), p = road.getPointAt(u), tan = road.getTangentAt(u);
      const r = tr.m.root, px = r.position.x, pz = r.position.z;
      r.position.set(p.x, 0, p.z); const h = Math.atan2(-tan.z, tan.x);
      const dh = ((h - r.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; r.rotation.y = h;
      const d = Math.hypot(p.x - px, p.z - pz); if (d < 5) tr.m.roll(d);
      for (const sw of tr.m.steerWheels) sw.rotation.y = THREE.MathUtils.clamp(dh * 30, -0.5, 0.5);
      tr.status = st;
      if (st === 'Dumping') { const k = (tt - T_LOAD - 16) / 12; const b = k < 0.45 ? ease(k / 0.45) * 48 : k < 0.6 ? 48 : 48 * (1 - ease((k - 0.6) / 0.4)); tr.m.set('body', b); if (k > 0.25 && k < 0.6) tr.m.setLoad(1 - (k - 0.25) / 0.35); if (!tr.dumped && k > 0.55) { tr.dumped = true; stats.loads++; stats.tonnes += TRUCK_T; const s = Math.min(1.8, 1 + stats.loads * 0.02); dumpPile.scale.set(s, s, s); } }
      else { tr.m.set('body', 0); if (st !== 'Loading') tr.dumped = false; }
      if (st === 'Loading' && tt < 0.2) tr.m.setLoad(0);
      tr.m.update(dt);
    }
    // excavator: passes into whichever truck is at the spot, otherwise onto the face pile
    const which = trucks.find((tr) => ((t + tr.off) % T_CYCLE) < T_LOAD);
    const pt = exT % EX_PASS; const keys = which ? truckPass : sidePass;
    for (const [k, v] of Object.entries(sample(keys, pt))) ex.m.set(k, v);
    if (which) { const tt = (t + which.off) % T_CYCLE, n = Math.floor(tt / EX_PASS), frac = (tt % EX_PASS); if (frac > 4.5) which.m.setLoad(Math.min(1, (n + 1) / 4)); else which.m.setLoad(Math.min(1, n / 4)); }
    ex.status = which ? `Loading ${which.name.toLowerCase()}` : 'Trimming the face';
    ex.m.update(dt);
    // the rest follow their keyframes
    for (const a of actors) {
      if (!a.keys) continue;
      const T = a.keys[a.keys.length - 1][0], lt = t % T, plt = lastT % T;
      apply(a, sample(a.keys, t), dt);
      for (const [et, f] of a.events || []) if ((plt < et && lt >= et) || (plt > lt && lt >= et)) f();
      a.status = a.moving ? 'Travelling' : 'Working';
      a.m.update(dt);
    }
    // beacons
    for (const a of actors) for (const b of a.m.beacons) b.userData.beacon.material.emissiveIntensity = 0.4 + 0.6 * Math.max(0, Math.sin(t * 6));
    stats.fuel += actors.reduce((s, a) => s + (MACHINES[a.id].fuelLph || 0), 0) * dt / 3600;
    lastT = t;
  }
  return { group: G, actors, stats, update, road, dumpPos };
}
