/**
 * Close-up sites (1 unit = 5 m), each following one project through the timeline:
 * an iron-ore mine in Gadchiroli, a highway through the Pench corridor, a dam in Melghat and a
 * port on the Palghar mangroves. They are placed far from the map and shown one at a time.
 */
import * as THREE from 'three';

export const SITES = {
  mine: { name: 'Iron-ore mine, Gadchiroli', project: 'ore2', at: [3000, 0, 0], cam: [[420, 300, 520], [40, 0, 20]] },
  road: { name: 'Highway through the Pench corridor', project: 'nh44', at: [4400, 0, 0], cam: [[300, 160, 330], [0, 0, 0]] },
  dam: { name: 'Dam in a Melghat valley', project: 'dam-mel', at: [3000, 0, 1600], cam: [[240, 330, 560], [0, 10, -230]] },
  port: { name: 'Port on the Palghar mangroves', project: 'port', at: [4400, 0, 1600], cam: [[380, 230, 420], [0, 0, 0]] },
};
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const mesh = (g, m, cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; };
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); return b; };
const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const M = { trunk: std('#5b4330'), grey: std('#9aa3aa'), dark: std('#2b3036'), white: std('#eef0f1'), yellow: std('#e2b100'), road: std('#3c3f44', { roughness: 0.9 }), water: std('#2a6491', { roughness: 0.45, metalness: 0 }), mud: std('#6f6250', { roughness: 1 }), rock: std('#9c5b2e', { roughness: 1 }), rock2: std('#b5713c', { roughness: 1 }), orange: std('#e8721a'), conc: std('#bdb6a7') };

function terrain(size, seg, H, colour) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i)));
  g.computeVertexNormals(); return mesh(g, std(colour, { roughness: 1, flatShading: true }), false);
}
/** A stand of trees. place(i) → [x, z] or null; returns the instanced mesh and the tree list. */
function forest(n, place, H, palette = ['#1d4a1e', '#2f6b2a', '#3b7a33'], shape = 'cone', scale = 1) {
  const geo = shape === 'cone' ? new THREE.ConeGeometry(4.5, 15, 6) : new THREE.IcosahedronGeometry(4, 0); geo.translate(0, shape === 'cone' ? 9.5 : 3, 0);
  const crown = new THREE.InstancedMesh(geo, std('#ffffff', { flatShading: true }), n), list = [], c = new THREE.Color();
  for (let i = 0, k = 0; k < n && i < n * 4; i++) { const p = place(i); if (!p) continue; list.push({ x: p[0], z: p[1], y: H(p[0], p[1]), s: (0.75 + 0.5 * hash(i)) * scale, h: hash(i + 99), cur: 1 }); crown.setColorAt(k, c.set(palette[k % palette.length])); k++; }
  crown.count = list.length; crown.castShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sv = new THREE.Vector3();
  function set(fn, dt = 1) { let dirty = false; list.forEach((t, i) => { const want = fn(t); if (Math.abs(want - t.cur) < 0.005 && t.done) return; t.cur += (want - t.cur) * Math.min(1, dt * 3); t.done = Math.abs(want - t.cur) < 0.005; const s = t.cur * t.s; crown.setMatrixAt(i, m4.compose(v.set(t.x, t.y, t.z), q, sv.set(s, s, s))); dirty = true; }); if (dirty) crown.instanceMatrix.needsUpdate = true; }
  return { crown, list, set };
}

// ── iron-ore mine ──
function mineSite() {
  const G = new THREE.Group(), U = {};
  const H = (x, z) => 26 * Math.exp(-((x * x + z * z) / 90000)) + 8 * Math.sin(x * 0.012) * Math.cos(z * 0.015);
  U.ground = terrain(1400, 140, H, '#ffffff'); U.ground.material.vertexColors = true; G.add(U.ground);
  { const p = U.ground.geometry.attributes.position, col = new Float32Array(p.count * 3); U.orig = Float32Array.from({ length: p.count }, (_, i) => p.getY(i)); U.ground.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); U.R = -1; }
  U.trees = forest(2600, (i) => { const a = hash(i) * Math.PI * 2, r = Math.sqrt(hash(i + 7)) * 640; const x = Math.cos(a) * r, z = Math.sin(a) * r; return x > 230 && x < 420 && Math.abs(z) < 160 ? null : [x, z]; }, H);
  G.add(U.trees.crown);
  // the pit: terraces scaled with its radius
  U.pit = new THREE.Group(); for (let i = 0; i < 6; i++) { const r = 1 - i * 0.15, t = mesh(new THREE.CylinderGeometry(r, r, 0.08, 40, 1, true), i % 2 ? M.rock : M.rock2, false); t.position.y = -i * 0.08; U.pit.add(t); const f = mesh(new THREE.RingGeometry(r - 0.15, r, 40), i % 2 ? M.rock2 : M.rock, false); f.rotation.x = -Math.PI / 2; f.position.y = -i * 0.08 - 0.04; U.pit.add(f); }
  const floor = mesh(new THREE.CircleGeometry(0.15, 30), M.rock, false); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.5; U.pit.add(floor);
  U.pit.position.y = 30; G.add(U.pit);
  U.dump = mesh(new THREE.ConeGeometry(1, 0.35, 16), std('#8a7a68', { flatShading: true })); U.dump.position.set(-260, 15, 120); G.add(U.dump);
  U.dump2 = mesh(new THREE.ConeGeometry(1, 0.35, 16), std('#8a7a68', { flatShading: true })); U.dump2.position.set(-120, 15, -260); G.add(U.dump2);
  U.trucks = []; for (let i = 0; i < 5; i++) { const t = new THREE.Group(); t.add(box(8, 5, 5, M.yellow, 0, 0, 0), box(3, 4, 5, M.dark, 5, 0, 0)); G.add(t); U.trucks.push(t); }
  U.plant = new THREE.Group(); U.plant.add(box(40, 18, 30, M.grey, 0, 0, 0), box(70, 6, 6, M.grey, -50, 14, 0)); U.plant.position.set(-330, H(-330, -40), -40); G.add(U.plant);
  // compensatory plantation in rows beside the lease
  const rows = []; for (let i = 0; i < 12; i++) for (let j = 0; j < 26; j++) rows.push([250 + i * 14, -150 + j * 12]);
  U.ca = forest(rows.length, (i) => rows[i], H, ['#86b34a', '#9cc24a'], 'ico', 0.9); G.add(U.ca.crown);
  U.H = H; carve(U, 0); return { G, U };
}
// ── highway through a corridor ──
function roadSite() {
  const G = new THREE.Group(), U = {};
  const H = (x, z) => 6 * Math.sin(x * 0.01) * Math.cos(z * 0.012) + 3 * Math.sin(z * 0.03);
  G.add(terrain(1200, 90, H, '#53713a'));
  U.trees = forest(2400, (i) => { const x = (hash(i) - 0.5) * 1150, z = (hash(i + 3) - 0.5) * 1150; return [x, z]; }, H); G.add(U.trees.crown);
  U.road = new THREE.Group();
  const deck = box(26, 1, 1200, M.road, 0, 0, 0); U.road.add(deck); for (const dx of [-0.3, 0.3]) U.road.add(box(0.6, 0.1, 1200, M.white, dx * 20, 1, 0));
  U.road.position.y = 1; G.add(U.road);
  U.bridges = []; for (const z of [-300, 0, 300]) { const b = new THREE.Group(); b.add(box(30, 2, 90, M.conc, 0, 9, 0)); for (const dz of [-40, 0, 40]) for (const dx of [-10, 10]) b.add(box(2.5, 9, 2.5, M.conc, dx, 0, dz)); b.position.set(0, 0, z); G.add(b); U.bridges.push(b); }
  U.cars = []; for (let i = 0; i < 16; i++) { const c = box(4.5, 3, 9, std(['#c0392b', '#2f6fb3', '#e8e8e8', '#e2b100'][i % 4]), 0, 0, 0); G.add(c); U.cars.push(c); }
  U.deer = []; for (let i = 0; i < 8; i++) { const d = new THREE.Group(); d.add(box(5, 3, 2, std('#a0692f'), 0, 3, 0), box(1.6, 3, 1.6, std('#a0692f'), 2.8, 5, 0)); for (const [a, b] of [[-2, -0.7], [-2, 0.7], [2, -0.7], [2, 0.7]]) d.add(box(0.5, 3, 0.5, std('#7a4f22'), a, 0, b)); G.add(d); U.deer.push(d); }
  U.H = H; return { G, U };
}
// ── dam in a valley ──
function damSite() {
  const G = new THREE.Group(), U = {};
  const H = (x, z) => { const ax = Math.abs(x); return -40 + 150 * (1 - Math.exp(-((ax / 210) ** 2))) + 0.03 * z + 8 * Math.sin(x * 0.02) * Math.cos(z * 0.02); };
  G.add(terrain(1400, 120, H, '#4f6e36'));
  U.trees = forest(3000, (i) => { const x = (hash(i) - 0.5) * 1300, z = (hash(i + 5) - 0.5) * 1300; return [x, z]; }, H); G.add(U.trees.crown);
  U.wall = new THREE.Group(); const sh = new THREE.Shape([new THREE.Vector2(-30, 0), new THREE.Vector2(30, 0), new THREE.Vector2(4, 110), new THREE.Vector2(-4, 110)]);
  const w = mesh(new THREE.ExtrudeGeometry(sh, { depth: 520, bevelEnabled: false }), M.conc); w.rotation.y = Math.PI / 2; w.position.set(-260, -45, 0); U.wall.add(w); G.add(U.wall);
  U.lake = mesh(new THREE.PlaneGeometry(1400, 700), M.water, false); U.lake.rotation.x = -Math.PI / 2; U.lake.position.set(0, -60, -350); G.add(U.lake);
  U.H = H; return { G, U };
}
// ── port on mangroves ──
function portSite() {
  const G = new THREE.Group(), U = {};
  const H = (x, z) => (x < -150 ? -6 : x < 0 ? -1.5 + x * 0.003 : 0.5 + x * 0.01) + Math.sin(z * 0.02) * 0.6;
  G.add(terrain(1300, 100, H, '#6f6250'));
  const sea = mesh(new THREE.PlaneGeometry(1300, 1300), std('#2c5d86', { roughness: 0.2, metalness: 0.2 }), false); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6; G.add(sea);
  U.trees = forest(3200, (i) => { const x = -140 + hash(i) * 260, z = (hash(i + 2) - 0.5) * 1200; return Math.abs(z - 80 * Math.sin(x * 0.02)) < 16 ? null : [x, z]; }, (x, z) => Math.max(-0.3, H(x, z)), ['#2f6b2a', '#3d7d32', '#24572a'], 'ico', 0.55);
  G.add(U.trees.crown);
  U.fill = mesh(new THREE.BoxGeometry(1, 6, 1), std('#a59d8e', { roughness: 1 })); U.fill.position.set(-20, -2, 0); G.add(U.fill);
  U.yard = new THREE.Group(); for (let i = 0; i < 40; i++) U.yard.add(box(12, 5, 5, std(['#2f6fb3', '#c0392b', '#2f8f4e', '#e2b100'][i % 4]), -160 + (i % 8) * 18, 4, -150 + Math.floor(i / 8) * 40));
  for (let i = 0; i < 4; i++) { const c = new THREE.Group(); c.add(box(4, 60, 4, M.orange, 0, 0, 0), box(4, 4, 60, M.orange, 0, 58, -20)); c.position.set(-230, 0, -150 + i * 80); U.yard.add(c); }
  G.add(U.yard); U.ship = new THREE.Group(); U.ship.add(box(40, 12, 180, std('#3a3f45'), 0, -4, 0), box(36, 8, 20, M.white, 0, 8, 70)); U.ship.position.set(-290, 0, 0); G.add(U.ship);
  U.H = H; return { G, U };
}

const cGrass = new THREE.Color('#4d6b33'), cBench = new THREE.Color('#b5713c'), cFace = new THREE.Color('#8a4d24'), cFloorP = new THREE.Color('#6b4a33'), cHaul = new THREE.Color('#9c8a74');
/** Dig the open pit into the ground: six benches down to the floor, rock-coloured, plus the cleared rim. */
function carve(U, R) {
  const g = U.ground.geometry, p = g.attributes.position, col = g.attributes.color.array, c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z), y0 = U.orig[i];
    if (R > 2 && d < R) { const u = 1 - d / R, step = Math.floor(u * 7) / 7, bench = (u * 7) % 1 < 0.75; p.setY(i, y0 - 95 * Math.min(1, step * 1.1)); c.copy(step >= 6 / 7 ? cFloorP : bench ? cBench : cFace); }
    else if (R > 2 && d < R + 22) { p.setY(i, y0); c.copy(cHaul); }
    else { p.setY(i, y0); c.copy(cGrass); }
    col.set([c.r, c.g, c.b], i * 3);
  }
  p.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeVertexNormals();
}
export function buildSites() { const out = {}; for (const [k, fn] of Object.entries({ mine: mineSite, road: roadSite, dam: damSite, port: portSite })) { const s = fn(); s.G.position.set(...SITES[k].at); out[k] = s; } return out; }

/**
 * Drive a site from the year. P = the scenario's project (with status, year, haUsed); sc = scenario.
 * Returns a short status line for the label.
 */
export function updateSite(key, S, year, P, sc, dt, clock, extra = {}) {
  const U = S.U, built = P && P.status === 'built', t = built ? year - P.year : -1, size = P ? P.haUsed / P.ha : 0;
  if (key === 'mine') {
    const R = t < 0 ? 0 : 175 * Math.sqrt(Math.min(1, t / 12)) * Math.sqrt(size) * (extra.phase2 && year >= extra.phase2 ? 1 + 0.35 * clamp01((year - extra.phase2) / 8) : 1);
    U.pit.visible = false;
    if (Math.abs(R - U.R) > 1) { U.R = R; carve(U, R); }
    const d1 = R > 2 ? Math.sqrt(Math.min(1, t / 10)) : 0; U.dump.scale.set(90 * d1, 140 * d1 + 0.01, 90 * d1); U.dump2.scale.set(70 * d1, 110 * d1 + 0.01, 70 * d1); U.plant.visible = t >= 1;
    const thin = t < 0 ? 0 : Math.min(sc === 'avoid' ? 0.08 : 0.35, 0.04 * t);
    U.trees.set((tr) => { const d = Math.hypot(tr.x, tr.z); if (R > 0 && d < R + 20) return 0; if (t >= 0 && (Math.abs(tr.z - 0.35 * tr.x) < 9 && tr.x < 0)) return 0; return d < R + 260 && tr.h < thin ? 0 : 1; }, dt);
    const lag = extra.lag ?? 4, age = t - lag, surv = extra.survival ?? 0.6;
    U.ca.set((tr) => (age < 0 ? 0 : tr.h > surv ? 0.08 : clamp01(0.2 + age / 15)), dt);
    U.trucks.forEach((tr, i) => { tr.visible = R > 10; const u = (clock * 0.05 + i / 5) % 1, a = u * Math.PI * 2; const rr = R * (0.35 + 0.6 * Math.abs(Math.sin(u * Math.PI))); tr.position.set(Math.cos(a) * rr, U.H(Math.cos(a) * rr, Math.sin(a) * rr) - 95 * Math.floor((1 - rr / R) * 7) / 7 * 1.1 + 1, Math.sin(a) * rr); tr.rotation.y = -a; });
    return !P ? 'Not in this scenario' : P.status !== 'built' ? 'Proposal dropped: the forest stays' : t < 0 ? `Forest intact; mining starts ${P.year}` : `Pit ${Math.round(R * 5 * 2 / 1000 * 10) / 10} km across · year ${Math.floor(t) + 1} of mining`;
  }
  if (key === 'road') {
    const on = t >= 0, cross = sc === 'avoid';
    U.road.visible = on; U.bridges.forEach((b) => { b.visible = on && cross; });
    U.trees.set((tr) => { if (!on) return 1; const inBridge = cross && [-300, 0, 300].some((z) => Math.abs(tr.z - z) < 40); if (Math.abs(tr.x) < 22 && !inBridge) return 0; if (Math.abs(tr.x) < 22 && inBridge) return 0.6; return !cross && Math.abs(tr.x) < 70 && tr.h < Math.min(0.35, 0.05 * t) ? 0 : 1; }, dt);
    U.cars.forEach((c, i) => { c.visible = on; const dir = i % 2 ? 1 : -1, z = (((clock * 60 * (1 + (i % 3) * 0.2) + i * 77) % 1200) - 600) * dir; c.position.set(dir * 7, 2, z); });
    U.deer.forEach((d, i) => {
      const lane = [-300, 0, 300][i % 3], ph = (clock * 0.04 + i * 0.13) % 1;
      if (!on || cross) { const x = -120 + ph * 240; d.position.set(x, U.H(x, lane) + (on && Math.abs(x) < 15 ? 0 : 0), lane + (i % 2 ? 12 : -12)); d.rotation.y = 0; }
      else { const x = -40 - 60 * Math.abs(Math.sin(ph * Math.PI)); d.position.set(i % 2 ? -x : x, U.H(x, lane), lane + i * 6); d.rotation.y = Math.sin(ph * Math.PI * 2) > 0 ? 0 : Math.PI; }
    });
    return !on ? `Forest corridor; widening starts ${P.year}` : cross ? 'Four-lane highway with three wildlife underpasses' : 'Four-lane highway with no crossings: animals turn back at the edge';
  }
  if (key === 'dam') {
    const build = t < 0 ? 0 : clamp01(t / 3), fill = t < 2 ? 0 : clamp01((t - 2) / 4), level = -60 + 120 * fill * size;
    U.wall.visible = t >= 0; U.wall.scale.y = Math.max(0.01, build); U.lake.position.y = level; U.lake.visible = fill > 0;
    U.trees.set((tr) => (fill > 0 && tr.z < 0 && tr.y + 10 < level ? 0 : 1), dt);
    return !P ? 'Not in this scenario' : P.status !== 'built' ? 'Proposal dropped: the valley stays forested' : t < 0 ? `Forested valley; the dam starts ${P.year}` : fill < 1 ? `Reservoir filling: ${Math.round(fill * 100)}%` : 'Reservoir full; the valley forest is under water';
  }
  if (key === 'port') {
    const r = t < 0 ? 0 : clamp01(t / 5) * Math.sqrt(size), L = 600 * r;
    U.fill.visible = r > 0.01; U.fill.scale.set(260, 1, Math.max(1, L)); U.fill.position.set(-20, 1, -150 + L / 2 - 50);
    U.yard.visible = t >= 3; U.yard.scale.setScalar(clamp01((t - 3) / 3)); U.ship.visible = t >= 5; U.ship.position.z = Math.sin(clock * 0.05) * 30;
    U.trees.set((tr) => (r > 0 && tr.z > -200 && tr.z < -200 + L + 10 ? 0 : t >= 0 && tr.h < Math.min(0.3, 0.04 * t) && Math.abs(tr.z - (-200 + L / 2)) < L / 2 + 120 ? 0 : 1), dt);
    return t < 0 ? `Mangrove creek; reclamation starts ${P.year}` : `Reclaimed: ${Math.round(L * 260 * 25 / 10000)} ha of mangrove and mudflat`;
  }
  return '';
}
