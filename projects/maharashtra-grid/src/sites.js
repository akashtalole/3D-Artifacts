/**
 * Close-up sites at 1 unit = 1 m, placed well away from the map:
 * a coal station (Koradi, 3 × 660 MW), Koyna dam, an MSKVY solar plant with its farm feeders,
 * a wind ridge, the Padghe 400 kV substation with the HVDC converter, and a Mahavitaran
 * distribution area (33/11 kV substation, feeders, transformers, homes, farm pumps).
 */
import * as THREE from 'three';

export const SITES = {
  coal: { name: 'Koradi coal station', at: [2000, 0, 0], cam: [[330, 200, 430], [-20, 40, -60]] },
  hydro: { name: 'Koyna dam', at: [2000, 0, 1600], cam: [[380, 200, 520], [0, 10, 40]] },
  solar: { name: 'MSKVY solar plant', at: [3600, 0, 0], cam: [[260, 150, 330], [0, 0, 0]] },
  wind: { name: 'Satara wind ridge', at: [3600, 0, 1600], cam: [[260, 150, 330], [-40, 70, 0]] },
  sub: { name: 'Padghe substation and HVDC', at: [5200, 0, 0], cam: [[330, 190, 330], [50, 10, -10]] },
  dist: { name: 'Mahavitaran distribution', at: [5200, 0, 1600], cam: [[200, 120, 240], [0, 0, 10]] },
};
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const M = {
  grey: std('#8a9097'), light: std('#cdd2d6'), white: std('#eef0f1'), dark: std('#2b3036'), steel: std('#a9b0b6', { metalness: 0.6, roughness: 0.35 }), coal: std('#1e1f22', { roughness: 1 }),
  conc: std('#b9b3a6', { roughness: 0.95 }), red: std('#c0392b'), tank: std('#6f8796'), ground: std('#8f8a6f', { roughness: 1 }), grass: std('#7c9a4a', { roughness: 1 }), field: std('#6f8f3a', { roughness: 1 }),
  soil: std('#8b6b45', { roughness: 1 }), road: std('#55585c', { roughness: 0.9 }), water: std('#3d79b8', { roughness: 0.15, metalness: 0.25 }), panel: std('#1d3768', { metalness: 0.55, roughness: 0.28 }),
  trans: std('#7b8a6a'), roof: std('#a2523a'), wall: std('#e6dccb'), yellow: std('#e2b100'), orange: std('#e8721a'), blue: std('#2f6fb3'), glass: std('#2b3a48', { metalness: 0.6, roughness: 0.2 }),
};
const mesh = (g, m, cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; };
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); return b; };
const cyl = (r, h, m, x = 0, y = 0, z = 0, seg = 16, r2 = r) => { const c = mesh(new THREE.CylinderGeometry(r, r2, h, seg), m); c.position.set(x, y + h / 2, z); return c; };
function tube(a, b, r, m, seg = 8) { const d = new THREE.Vector3().subVectors(b, a), t = mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), m); t.position.copy(a).addScaledVector(d, 0.5); t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return t; }
function ground(r, m, G) { const g = mesh(new THREE.CircleGeometry(r, 64), m, false); g.rotation.x = -Math.PI / 2; G.add(g); return g; }
function dot() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
const DOT = dot();
/** A plume of soft particles rising from a point. */
function plume(origin, n, colour, size, rise, spread) {
  const pos = new Float32Array(n * 3), seed = Float32Array.from({ length: n }, () => Math.random()), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size, map: DOT, color: colour, transparent: true, opacity: 0.6, depthWrite: false }), pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  return { pts, mat, update(t, k, wind = [1, 0]) { for (let i = 0; i < n; i++) { const u = (seed[i] + t * 0.08) % 1, a = seed[i] * 50; pos[i * 3] = origin.x + Math.cos(a) * spread * u + wind[0] * u * rise * 0.8; pos[i * 3 + 1] = origin.y + u * rise; pos[i * 3 + 2] = origin.z + Math.sin(a) * spread * u + wind[1] * u * rise * 0.8; } g.attributes.position.needsUpdate = true; mat.opacity = 0.65 * k; pts.visible = k > 0.02; } };
}
/** Lattice-ish transmission tower. */
function tower(h = 45, w = 10, m = M.steel) {
  const g = new THREE.Group(), legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [a, b] of legs) g.add(tube(new THREE.Vector3(a * w / 2, 0, b * w / 2), new THREE.Vector3(a * 1.2, h, b * 1.2), 0.25, m, 4));
  for (const y of [h * 0.55, h * 0.8, h]) { const arm = mesh(new THREE.BoxGeometry(w * 1.6, 0.5, 0.6), m); arm.position.y = y; g.add(arm); }
  for (const y of [h * 0.25, h * 0.5, h * 0.75]) { const s = (1 - y / h) * w / 2 + 1.2 * (y / h); for (const [a, b, c, d] of [[-1, -1, 1, -1], [-1, 1, 1, 1], [-1, -1, -1, 1], [1, -1, 1, 1]]) g.add(tube(new THREE.Vector3(a * s, y, b * s), new THREE.Vector3(c * s, y, d * s), 0.15, m, 4)); }
  return g;
}
/** Wires between two points with a sag, as a thin tube. */
function wire(a, b, sag, m, r = 0.12) { const mid = a.clone().lerp(b, 0.5); mid.y -= sag; const c = new THREE.QuadraticBezierCurve3(a, mid, b); return { mesh: mesh(new THREE.TubeGeometry(c, 16, r, 4), m, false), curve: c }; }
/** Particles running along curves to show power flow. */
function flowDots(curves, per, colour, size = 1.6) {
  const n = curves.length * per, im = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 8, 6), new THREE.MeshBasicMaterial({ color: colour }), n); im.frustumCulled = false;
  const ph = Float32Array.from({ length: n }, (_, i) => (i % per) / per), m4 = new THREE.Matrix4(), v = new THREE.Vector3();
  return { im, update(dt, speed, on = curves.map(() => true)) { let k = 0; curves.forEach((c, ci) => { for (let j = 0; j < per; j++, k++) { ph[k] = (ph[k] + dt * speed + 1) % 1; if (!on[ci] || speed === 0) { im.setMatrixAt(k, m4.makeScale(0, 0, 0)); continue; } c.getPointAt(ph[k], v); im.setMatrixAt(k, m4.makeTranslation(v.x, v.y, v.z)); } }); im.instanceMatrix.needsUpdate = true; } };
}

// ════════ coal: three 660 MW units ════════
function coalSite() {
  const G = new THREE.Group(), U = { units: [] };
  ground(560, M.ground, G);
  const yard = mesh(new THREE.PlaneGeometry(220, 200), std('#3a3631', { roughness: 1 }), false); yard.rotation.x = -Math.PI / 2; yard.position.set(-320, 0.1, -60); G.add(yard);
  for (const [x, z, r] of [[-370, -120, 34], [-290, -110, 30], [-340, 0, 36], [-270, 20, 26]]) { const c = mesh(new THREE.ConeGeometry(r, r * 0.55, 18), M.coal); c.position.set(x, r * 0.275, z); G.add(c); }
  const sr = new THREE.Group(); sr.position.set(-320, 0, -60); sr.add(box(8, 10, 8, M.yellow, 0, 0, 0)); const boom = box(60, 3, 3, M.yellow, 30, 10, 0); sr.add(boom); G.add(sr); U.sr = sr;
  const th = box(360, 32, 44, M.light, 0, 0, 70); G.add(th);
  for (let i = 0; i < 3; i++) {
    const x = -120 + i * 120, u = {};
    G.add(box(34, 78, 34, M.grey, x, 0, 0)); G.add(box(38, 4, 38, M.dark, x, 78, 0));
    for (let k = 1; k < 6; k++) G.add(box(35, 0.8, 35, M.dark, x, k * 13, 0));
    G.add(box(30, 26, 34, std('#9da3a8'), x, 0, -46));
    const ch = cyl(5, 150, std('#c9c2b6'), x, 0, -95, 20, 8); G.add(ch); for (const y of [128, 140]) G.add(cyl(5.3, 5, M.red, x, y, -95, 20));
    u.smoke = plume(new THREE.Vector3(x, 152, -95), 90, '#7d7d80', 22, 140, 26); G.add(u.smoke.pts);
    const prof = [0, 0.2, 0.4, 0.6, 0.75, 0.88, 1].map((y) => new THREE.Vector2(44 - 20 * Math.sin(y * Math.PI * 0.85) + (y > 0.85 ? 3 : 0), y * 120));
    const ct = mesh(new THREE.LatheGeometry(prof, 32), std('#d9d6cf', { side: THREE.DoubleSide })); ct.position.set(x * 1.25, 0, -235); G.add(ct);
    u.steam = plume(new THREE.Vector3(x * 1.25, 122, -235), 110, '#ffffff', 40, 120, 28); G.add(u.steam.pts);
    const gt = box(16, 12, 10, M.trans, x, 0, 104); G.add(gt); for (let b = -1; b <= 1; b++) G.add(cyl(0.8, 8, M.white, x + b * 5, 12, 104, 8));
    u.label = new THREE.Vector3(x, 95, 0).add(new THREE.Vector3(...SITES.coal.at)); U.units.push(u);
  }
  // conveyor gallery from the yard to the bunkers, with moving coal
  const conv = box(140, 6, 6, M.light, 0, 0, 0); conv.position.set(-215, 35, -30); conv.rotation.z = 0.42; G.add(conv);
  const top = box(260, 5, 6, M.light, -10, 82, -22); G.add(top);
  // railway and a coal train
  for (const dz of [-1.2, 1.2]) G.add(box(1000, 0.4, 0.3, M.steel, 0, 0.2, -370 + dz));
  const train = new THREE.Group(); train.add(box(18, 4.5, 3.2, M.blue, 0, 1, 0));
  for (let k = 1; k <= 22; k++) train.add(box(10.5, 3.6, 3.2, std('#5a3b2a'), -k * 11.5, 1, 0), box(10, 0.6, 2.9, M.coal, -k * 11.5, 4.6, 0));
  train.position.set(-500, 0, -370); G.add(train); U.train = train;
  G.add(box(40, 18, 24, M.light, -260, 0, -370));
  // ash pond and switchyard
  const ash = mesh(new THREE.PlaneGeometry(200, 140), std('#8f9a8b', { roughness: 0.3 }), false); ash.rotation.x = -Math.PI / 2; ash.position.set(330, 0.2, 230); G.add(ash);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { G.add(box(1.2, 26, 1.2, M.steel, 250 + i * 25, 0, -60 + j * 40)); }
  for (let j = 0; j < 3; j++) G.add(box(130, 1, 1, M.steel, 312, 26, -60 + j * 40));
  const lines = [];
  for (let k = 0; k < 3; k++) { const t1 = tower(50, 12); t1.position.set(420, 0, -60 + k * 40); G.add(t1); const t2 = tower(50, 12); t2.position.set(540, 0, -90 + k * 60); G.add(t2);
    const w = wire(new THREE.Vector3(312 + 65, 26, -60 + k * 40), new THREE.Vector3(420, 50, -60 + k * 40), 4, M.dark); G.add(w.mesh); lines.push(w.curve);
    const w2 = wire(new THREE.Vector3(420, 50, -60 + k * 40), new THREE.Vector3(540, 50, -90 + k * 60), 8, M.dark); G.add(w2.mesh); lines.push(w2.curve); }
  U.flow = flowDots(lines, 6, '#ffd166', 1.8); G.add(U.flow.im);
  return { G, U };
}

// ════════ Koyna dam ════════
function hydroSite() {
  const G = new THREE.Group(), U = {};
  const H = (x, z) => { const ax = Math.abs(x); const hill = 150 * (1 - Math.exp(-(((ax - 40) / 170) ** 2))) * (ax > 40 ? 1 : 0); const floor = z > 0 ? -48 - z * 0.04 : -30; return floor + hill + 6 * Math.sin(x * 0.03 + z * 0.02) * Math.cos(z * 0.025); };
  const tg = new THREE.PlaneGeometry(1100, 1100, 110, 110); tg.rotateX(-Math.PI / 2); const pa = tg.attributes.position, cols = [];
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i), y = H(x, z); pa.setY(i, y); const c = new THREE.Color(y > 40 ? '#4e7a35' : y > -10 ? '#5f8a3b' : '#7a7a52'); cols.push(c.r, c.g, c.b); }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); tg.computeVertexNormals();
  G.add(mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), false));
  const lake = mesh(new THREE.PlaneGeometry(1100, 545), M.water, false); lake.rotation.x = -Math.PI / 2; lake.position.set(0, 20, -273); G.add(lake); U.lake = lake;
  const sh = new THREE.Shape([new THREE.Vector2(-34, -50), new THREE.Vector2(36, -50), new THREE.Vector2(4, 45), new THREE.Vector2(-4, 45)]);
  const dam = mesh(new THREE.ExtrudeGeometry(sh, { depth: 420, bevelEnabled: false }), M.conc); dam.rotation.y = Math.PI / 2; dam.position.set(-210, 0, 0); G.add(dam);
  G.add(box(420, 2, 10, M.light, 0, 45, 0));
  U.gates = [];
  for (let k = 0; k < 6; k++) { const x = -50 + k * 20, p = new THREE.Group(); p.position.set(x, 44, -4); const gate = box(16, 12, 1.2, M.steel, 0, -12, 0); p.add(gate); G.add(p); U.gates.push(p); G.add(box(3, 18, 12, M.light, x + 10, 30, -2)); }
  U.spill = plume(new THREE.Vector3(0, 30, 12), 260, '#e8f4ff', 9, -1, 1); G.add(U.spill.pts);
  const intake = cyl(7, 60, M.light, 120, -20, -14); G.add(intake);
  U.pens = []; for (let k = 0; k < 3; k++) { const a = new THREE.Vector3(108 + k * 10, 10, 12), b = new THREE.Vector3(112 + k * 10, -40, 170); const p = tube(a, b, 3, M.steel, 12); G.add(p); }
  const ph = box(60, 24, 34, M.light, 125, -46, 185); G.add(ph); G.add(box(62, 3, 36, M.red, 125, -22, 185));
  const tail = mesh(new THREE.PlaneGeometry(40, 260), M.water, false); tail.rotation.x = -Math.PI / 2; tail.position.set(125, -47.5, 330); G.add(tail);
  U.foam = plume(new THREE.Vector3(125, -47, 210), 160, '#ffffff', 7, 4, 16); G.add(U.foam.pts);
  for (let k = 0; k < 2; k++) { const t = tower(40, 10); t.position.set(200 + k * 120, -40 + k * 20, 200 - k * 30); G.add(t); }
  const w = wire(new THREE.Vector3(150, -20, 185), new THREE.Vector3(200, 0, 200), 3, M.dark); G.add(w.mesh); const w2 = wire(new THREE.Vector3(200, 0, 200), new THREE.Vector3(320, 20, 170), 6, M.dark); G.add(w2.mesh);
  U.flow = flowDots([w.curve, w2.curve], 8, '#ffd166', 1.6); G.add(U.flow.im);
  U.H = H; return { G, U };
}

// ════════ MSKVY solar with farm feeders ════════
function solarSite() {
  const G = new THREE.Group(), U = { rows: [] };
  ground(520, M.soil, G);
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { if (Math.abs(i) < 2 && Math.abs(j) < 2) continue; const f = mesh(new THREE.PlaneGeometry(64, 64), (i + j) % 2 ? M.field : std('#9fae4e', { roughness: 1 }), false); f.rotation.x = -Math.PI / 2; f.position.set(i * 70, 0.15, j * 70); G.add(f); }
  const pg = new THREE.BoxGeometry(4.2, 0.12, 2.2);
  const n = 10 * 34, im = new THREE.InstancedMesh(pg, M.panel, n); im.castShadow = true; U.panels = im; U.slots = [];
  for (let r = 0; r < 10; r++) for (let k = 0; k < 34; k++) U.slots.push(new THREE.Vector3(-58 + r * 13, 2.4, -72 + k * 4.4));
  G.add(im);
  for (let r = 0; r < 10; r++) G.add(box(0.4, 0.4, 150, M.steel, -58 + r * 13, 2.2, 0));
  for (const z of [-40, 40]) G.add(box(6, 3, 3, M.white, 80, 0, z));
  // 33/11 kV substation at the corner
  G.add(box(40, 0.3, 30, M.conc, 120, 0, -110)); for (const x of [110, 128]) G.add(box(7, 6, 5, M.trans, x, 0, -110));
  G.add(box(10, 4, 8, M.wall, 135, 0, -96));
  // 11 kV farm feeders on poles to pump houses
  const feeders = [], pumps = [];
  for (let f = 0; f < 4; f++) {
    const ang = -0.6 + f * 0.75, dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)); let last = new THREE.Vector3(120, 9, -110);
    for (let k = 1; k <= 6; k++) { const p = new THREE.Vector3(120, 0, -110).addScaledVector(dir, k * 40 + 20); G.add(cyl(0.3, 9, M.conc, p.x, 0, p.z, 6)); const top = p.clone(); top.y = 9; const w = wire(last, top, 1, M.dark, 0.06); G.add(w.mesh); feeders.push(w.curve); last = top; }
    const ph = last.clone(); ph.y = 0; G.add(box(5, 3.5, 4, M.wall, ph.x + 4, 0, ph.z)); G.add(box(5.4, 0.5, 4.4, M.roof, ph.x + 4, 3.5, ph.z));
    const sp = plume(new THREE.Vector3(ph.x + 10, 1, ph.z + 4), 60, '#bfe6ff', 3, -1, 1); sp.home = ph.clone().add(new THREE.Vector3(10, 1, 4)); G.add(sp.pts); pumps.push(sp);
  }
  U.flow = flowDots(feeders, 3, '#ffd166', 0.8); G.add(U.flow.im); U.pumps = pumps;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(120, 32), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.0, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 3.2; G.add(shadow); U.shadow = shadow;
  return { G, U };
}

// ════════ wind ridge ════════
function windSite() {
  const G = new THREE.Group(), U = { turbines: [] };
  const H = (x, z) => 60 * Math.exp(-(((z + 0.15 * x) / 170) ** 2)) + 8 * Math.sin(x * 0.02) * Math.cos(z * 0.03);
  const tg = new THREE.PlaneGeometry(1200, 1100, 100, 90); tg.rotateX(-Math.PI / 2); const pa = tg.attributes.position;
  for (let i = 0; i < pa.count; i++) pa.setY(i, H(pa.getX(i), pa.getZ(i)));
  tg.computeVertexNormals(); G.add(mesh(tg, std('#9caa5c', { roughness: 1, flatShading: true }), false));
  for (let k = 0; k < 8; k++) {
    const x = -350 + k * 100, z = -0.15 * x + (k % 2 ? 30 : -30), y = H(x, z), t = new THREE.Group(); t.position.set(x, y, z);
    t.add(cyl(2.2, 80, M.white, 0, 0, 0, 16, 1.4));
    const yaw = new THREE.Group(); yaw.position.y = 80; t.add(yaw); yaw.add(box(4, 4, 10, M.white, 0, -2, -2));
    const rotor = new THREE.Group(); rotor.position.set(0, 0, 3.5); yaw.add(rotor); rotor.add(mesh(new THREE.SphereGeometry(2, 12, 8), M.white));
    for (let b = 0; b < 3; b++) { const p = new THREE.Group(); p.rotation.z = (b * 2 * Math.PI) / 3; const bl = mesh(new THREE.BoxGeometry(2.6, 42, 0.6), M.white); bl.position.y = 22; p.add(bl); rotor.add(p); }
    G.add(t); U.turbines.push({ t, yaw, rotor, base: new THREE.Vector3(x, y, z) });
  }
  G.add(box(36, 0.4, 24, M.conc, 120, H(120, 200), 200)); G.add(box(8, 6, 6, M.trans, 115, H(120, 200), 200));
  return { G, U };
}

// ════════ Padghe: 400 kV substation and HVDC converter ════════
function subSite() {
  const G = new THREE.Group(), U = {};
  ground(420, std('#9a9580', { roughness: 1 }), G);
  G.add(box(210, 0.3, 150, std('#b3ad9d'), -40, 0, 0));
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) G.add(box(1, 22, 1, M.steel, -130 + i * 26, 0, -60 + j * 40));
  for (let j = 0; j < 4; j++) { G.add(box(185, 0.8, 0.8, M.steel, -39, 22, -60 + j * 40)); for (const dz of [-3, 0, 3]) G.add(tube(new THREE.Vector3(-130, 16, -60 + j * 40 + dz), new THREE.Vector3(52, 16, -60 + j * 40 + dz), 0.35, M.steel, 6)); }
  for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) { G.add(cyl(0.6, 5, M.white, -125 + i * 26, 0, -40 + j * 40, 8)); G.add(box(2, 3, 2, M.dark, -125 + i * 26, 5, -40 + j * 40)); }
  for (let k = 0; k < 3; k++) { const x = -110 + k * 50; G.add(box(14, 10, 9, M.trans, x, 0, 70)); for (let r = -1; r <= 1; r++) G.add(cyl(0.7, 8, M.white, x + r * 4, 10, 70, 8)); for (let f = 0; f < 5; f++) G.add(box(0.4, 7, 6, M.dark, x - 7.5, 1.5, 66 + f * 2)); }
  G.add(box(30, 8, 16, M.wall, 60, 0, 70));
  // HVDC converter: valve hall, converter transformers, DC yard, bipole line
  G.add(box(80, 26, 42, M.white, 160, 0, -40)); G.add(box(82, 1.5, 44, M.light, 160, 26, -40));
  for (let k = 0; k < 6; k++) { G.add(box(10, 9, 8, M.trans, 128 + k * 13, 0, 0)); G.add(cyl(0.8, 9, M.white, 128 + k * 13, 9, 3, 8)); }
  for (let k = 0; k < 2; k++) G.add(cyl(4, 9, M.dark, 220, 0, -60 + k * 30, 20));
  const lines = [], ac = [];
  for (let k = 0; k < 2; k++) { const t = tower(55, 8); t.position.set(300, 0, -60 + k * 30); G.add(t); const w = wire(new THREE.Vector3(224, 9, -60 + k * 30), new THREE.Vector3(300, 55, -60 + k * 30), 4, M.dark, 0.3); G.add(w.mesh); lines.push(w.curve); const t2 = tower(55, 8); t2.position.set(400, 0, -90 + k * 30); G.add(t2); const w2 = wire(new THREE.Vector3(300, 55, -60 + k * 30), new THREE.Vector3(400, 55, -90 + k * 30), 9, M.dark, 0.3); G.add(w2.mesh); lines.push(w2.curve); }
  for (let k = 0; k < 4; k++) { const t = tower(48, 12); t.position.set(-240, 0, -60 + k * 40); G.add(t); const w = wire(new THREE.Vector3(-130, 22, -60 + k * 40), new THREE.Vector3(-240, 48, -60 + k * 40), 5, M.dark); G.add(w.mesh); ac.push(w.curve); }
  U.dc = flowDots(lines, 7, '#c9a2ff', 1.5); G.add(U.dc.im); U.ac = flowDots(ac, 6, '#ffd166', 1.5); G.add(U.ac.im);
  return { G, U };
}

// ════════ Mahavitaran distribution ════════
function distSite() {
  const G = new THREE.Group(), U = { houses: [], pumps: [] };
  ground(380, M.grass, G);
  G.add(box(380, 0.3, 10, M.road, 0, 0, 30)); G.add(box(10, 0.3, 300, M.road, -40, 0, 0));
  // 33/11 kV substation
  G.add(box(50, 0.3, 36, M.conc, -110, 0, -80)); for (const x of [-122, -100]) { G.add(box(8, 7, 6, M.trans, x, 0, -86)); G.add(cyl(0.5, 5, M.white, x, 7, -86, 8)); }
  G.add(box(16, 5, 10, M.wall, -110, 0, -66));
  const feeders = [], on = [];
  const run = (pts) => { const curves = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; G.add(cyl(0.25, 10, M.conc, b.x, 0, b.z, 6)); const w = wire(a.clone().setY(10), b.clone().setY(10), 0.8, M.dark, 0.05); G.add(w.mesh); curves.push(w.curve); } return curves; };
  // town feeder
  const town = run([new THREE.Vector3(-100, 0, -70), new THREE.Vector3(-70, 0, -40), new THREE.Vector3(-30, 0, 20), new THREE.Vector3(30, 0, 20), new THREE.Vector3(90, 0, 20), new THREE.Vector3(150, 0, 20)]);
  for (let k = 0; k < 22; k++) {
    const x = -20 + (k % 11) * 16, z = k < 11 ? 4 : 44, h = 6 + (k % 3) * 3.5, house = new THREE.Group(); house.position.set(x, 0, z);
    const wm = new THREE.MeshStandardMaterial({ color: '#e6dccb', emissive: '#ffcf7a', emissiveIntensity: 0, roughness: 0.7 }); house.add(box(10, h, 9, wm)); house.add(box(10.6, 0.6, 9.6, k % 4 === 0 ? M.panel : M.roof, 0, h, 0));
    G.add(house); U.houses.push(wm);
  }
  G.add(box(6, 3, 3, M.blue, 160, 0, 40)); G.add(box(1, 3, 1, M.yellow, 156, 0, 40));
  for (const x of [20, 100]) { G.add(cyl(0.3, 9, M.conc, x, 0, 25, 6)); G.add(box(3.4, 3.4, 2.4, M.trans, x, 7, 25)); }
  // farm feeder
  const fields = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const f = mesh(new THREE.PlaneGeometry(70, 60), (i + j) % 2 ? M.field : std('#a7b552', { roughness: 1 }), false); f.rotation.x = -Math.PI / 2; f.position.set(-210 + i * 75, 0.2, 90 + j * 65); G.add(f); fields.push(f); }
  const ag = run([new THREE.Vector3(-120, 0, -70), new THREE.Vector3(-150, 0, -20), new THREE.Vector3(-170, 0, 40), new THREE.Vector3(-190, 0, 100), new THREE.Vector3(-200, 0, 160)]);
  for (let k = 0; k < 5; k++) { const x = -235 + (k % 3) * 75, z = 80 + Math.floor(k / 3) * 65; G.add(box(5, 3.5, 4, M.wall, x, 0, z)); const sp = plume(new THREE.Vector3(x + 8, 1, z + 6), 50, '#bfe6ff', 3, -1, 1); G.add(sp.pts); U.pumps.push(sp); }
  U.town = flowDots(town, 3, '#ffd166', 0.6); U.ag = flowDots(ag, 3, '#9dff9d', 0.6); G.add(U.town.im, U.ag.im);
  U.lamps = []; for (let k = 0; k < 8; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: '#333' })); l.position.set(-30 + k * 25, 9, 33); G.add(l, cyl(0.2, 9, M.dark, -30 + k * 25, 0, 34, 6)); U.lamps.push(l); }
  return { G, U };
}

export function buildSites() {
  const out = {};
  for (const [k, fn] of Object.entries({ coal: coalSite, hydro: hydroSite, solar: solarSite, wind: windSite, sub: subSite, dist: distSite })) { const s = fn(); s.G.position.set(...SITES[k].at); out[k] = s; }
  return out;
}

/** Drive each site from the dispatch block r and the clock. */
export function animateSites(S, r, ctx, dt) {
  const t = ctx.clock;
  if (S.coal.G.visible) {
    const U = S.coal.U, kor = r.gen.koradi || 0, per = kor / 3;
    U.units.forEach((u, i) => { const tripped = ctx.trip && ctx.trip.id === 'koradi' && i === 1, mw = tripped ? 0 : Math.min(660, ctx.trip && ctx.trip.id === 'koradi' ? kor / 2 : per); u.mw = mw; u.tripped = tripped; u.smoke.update(t, mw / 660, [0.6, -0.2]); u.steam.update(t * 0.8, 0.3 + 0.7 * mw / 660, [0.5, -0.2]); });
    U.sr.rotation.y = Math.sin(t * 0.1) * 0.8; U.train.position.x = -520 + ((t * 18) % 1100); U.flow.update(dt, 0.15 + 0.25 * kor / 1980);
  }
  if (S.hydro.G.visible) {
    const U = S.hydro.U, g = r.gen.koyna || 0, monsoon = ctx.season === 'monsoon', level = monsoon ? 40 : ctx.season === 'winter' ? 30 : 12;
    U.lake.position.y = level; const open = monsoon ? 0.6 : 0; U.gates.forEach((p) => { p.rotation.x = -open; });
    U.spill.update(t * 3, open, [0, 1]); if (open) { const pos = U.spill.pts.geometry.attributes.position.array; for (let i = 0; i < pos.length; i += 3) { const u = ((i / 3) * 0.618 + t * 0.4) % 1; pos[i] = -50 + ((i / 3) % 6) * 20 + Math.sin(i) * 4; pos[i + 1] = 40 - u * 80; pos[i + 2] = 6 + u * 70; } U.spill.pts.geometry.attributes.position.needsUpdate = true; }
    U.foam.update(t * 2, Math.min(1, g / 900)); U.flow.update(dt, g > 10 ? 0.2 + 0.4 * g / 1956 : 0);
  }
  if (S.solar.G.visible) {
    const U = S.solar.U, cf = ctx.solarCF, ang = ctx.sunU > 0 && ctx.sunU < 1 ? (ctx.sunU - 0.5) * 1.6 : 0.6;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -ang), s = new THREE.Vector3(1, 1, 1);
    U.slots.forEach((p, i) => U.panels.setMatrixAt(i, m4.compose(p, q, s))); U.panels.instanceMatrix.needsUpdate = true;
    const agOn = ctx.agOn; U.pumps.forEach((p) => { p.update(t * 4, agOn ? 1 : 0); if (agOn) { const a = p.pts.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const u = ((i / 3) * 0.37 + t * 0.9) % 1; a[i] = p.home.x + u * 14; a[i + 1] = p.home.y + 5 * Math.sin(u * Math.PI); a[i + 2] = p.home.z + Math.sin(i) * 3 * u; } p.pts.geometry.attributes.position.needsUpdate = true; } });
    U.flow.update(dt, agOn ? 0.5 : 0); U.shadow.material.opacity = ctx.clouds ? 0.35 : 0; U.shadow.position.x = -200 + ((t * 25) % 400);
  }
  if (S.wind.G.visible) { const U = S.wind.U; U.turbines.forEach((tb, i) => { tb.yaw.rotation.y = ctx.season === 'monsoon' ? -0.8 : 0.4; tb.rotor.rotation.z -= dt * (0.4 + 3.2 * ctx.windCF) * (1 + 0.05 * i); }); }
  if (S.sub.G.visible) { const U = S.sub.U; U.dc.update(dt, r.hvdc > 0 ? 0.35 : 0); U.ac.update(dt, 0.3); }
  if (S.dist.G.visible) {
    const U = S.dist.U; U.houses.forEach((m, i) => { m.emissiveIntensity = ctx.night * (0.5 + 0.5 * ((i * 7) % 3 === 0 ? 1 : 0.6)); });
    U.lamps.forEach((l) => l.material.color.set(ctx.night > 0.3 ? '#ffe39a' : '#333'));
    U.pumps.forEach((p) => { p.update(t * 4, ctx.agOn ? 1 : 0); if (ctx.agOn) { const a = p.pts.geometry.attributes.position.array; const o = p.pts.geometry.boundingSphere; for (let i = 0; i < a.length; i += 3) { const u = ((i / 3) * 0.37 + t * 0.9) % 1; a[i + 1] = 1 + 5 * Math.sin(u * Math.PI); } } });
    U.town.update(dt, 0.3 + 0.3 * ctx.night); U.ag.update(dt, ctx.agOn ? 0.4 : 0);
  }
}
