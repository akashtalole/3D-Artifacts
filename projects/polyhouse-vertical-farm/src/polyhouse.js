/**
 * The polyhouse in 3D: a three-bay gothic-arch NVPH (24 × 40 m) with roll-up side curtains,
 * roof vents, an internal shade screen, a fan wall and a pad wall, fogging lines, drip-irrigated
 * beds with the crop, a fertigation shed, a water tank, a weather station, IoT nodes, a LoRaWAN
 * gateway and a scouting robot.
 */
import * as THREE from 'three';
import { PH } from './data.js';

export const W2 = (PH.bays * PH.bay) / 2, L2 = PH.len / 2, GUT = PH.gutter, RISE = PH.ridge - PH.gutter;
export const archY = (u) => GUT + RISE * Math.pow(1 - Math.min(1, Math.abs(u)), 0.7);
export const BAYX = [-8, 0, 8];
export const BEDX = Array.from({ length: PH.beds }, (_, i) => -11 + 2 * i);
export const PATHX = Array.from({ length: PH.beds - 1 }, (_, i) => -10 + 2 * i);

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
export const MAT = {
  steel: std('#b4bcc3', { metalness: 0.65, roughness: 0.35 }),
  film: new THREE.MeshStandardMaterial({ color: '#eef6ff', transparent: true, opacity: 0.17, roughness: 0.15, side: THREE.DoubleSide, depthWrite: false }),
  curtain: new THREE.MeshStandardMaterial({ color: '#e9f2f8', transparent: true, opacity: 0.42, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  screen: new THREE.MeshStandardMaterial({ color: '#cfd4d8', metalness: 0.55, roughness: 0.35, transparent: true, opacity: 0.86, side: THREE.DoubleSide }),
  soil: std('#7a5a3c', { roughness: 0.95 }), path: std('#9b8f7c', { roughness: 1 }), mulch: std('#c9ced2', { metalness: 0.4, roughness: 0.45 }),
  black: std('#1d2024'), white: std('#f1f3f4', { roughness: 0.5 }), dark: std('#3b4148'), conc: std('#b9b4aa', { roughness: 0.95 }),
  blue: std('#2f6fb3'), red: std('#c0392b'), green: std('#2f8f4e'), orange: std('#e8721a'), yellow: std('#f0c419'),
  grass: std('#7f9f4c', { roughness: 1 }), gravel: std('#a59d8e', { roughness: 1 }), tank: std('#6f8796', { roughness: 0.8 }),
  led: new THREE.MeshBasicMaterial({ color: '#3fff7a' }), panel: std('#203a63', { metalness: 0.5, roughness: 0.3 }),
};

function netTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
  for (let i = 0; i <= 64; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function padTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#e0bf7a'; g.fillRect(0, 0, 256, 128); g.strokeStyle = 'rgba(110,80,30,0.55)'; g.lineWidth = 2;
  for (let i = -128; i < 256; i += 9) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function streakTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 128);
  for (let i = 0; i < 26; i++) { const x = Math.random() * 64, y = Math.random() * 128, l = 10 + Math.random() * 30; const gr = g.createLinearGradient(x, y, x, y + l); gr.addColorStop(0, 'rgba(200,230,255,0)'); gr.addColorStop(1, 'rgba(200,230,255,0.9)'); g.strokeStyle = gr; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + l); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 2); return t;
}
export function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

const mesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };
const boxM = (w, h, d, mat) => mesh(new THREE.BoxGeometry(w, h, d), mat);
const cylM = (r, h, mat, seg = 16) => mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
function tubeBetween(a, b, r, mat, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a), m = mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
}

/** A strip of the arch surface across u ∈ [u0, u1] on one side of a bay, running the full length. */
function archStrip(xc, side, u0, u1, z0, z1, nu = 10, dy = 0, origin = null) {
  const pos = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const u = u0 + ((u1 - u0) * i) / nu, x = xc + side * u * PH.bay / 2, y = archY(u) + dy;
    const ox = origin ? origin.x : 0, oy = origin ? origin.y : 0;
    pos.push(x - ox, y - oy, z0, x - ox, y - oy, z1);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function profilePoints(n = 18) {
  const p = [new THREE.Vector2(-W2, 0), new THREE.Vector2(-W2, GUT)];
  for (const xc of BAYX) for (let i = 1; i <= n; i++) { const x = xc - 4 + (8 * i) / n; p.push(new THREE.Vector2(x, archY((x - xc) / 4))); }
  p.push(new THREE.Vector2(W2, 0)); return p;
}

export function buildPolyhouse() {
  const G = new THREE.Group(), U = {};
  // ground
  const ground = mesh(new THREE.PlaneGeometry(260, 260), MAT.grass, false); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; G.add(ground);
  const apron = mesh(new THREE.PlaneGeometry(2 * W2 + 16, 2 * L2 + 18), MAT.gravel, false); apron.rotation.x = -Math.PI / 2; apron.position.y = -0.01; G.add(apron);
  const floor = mesh(new THREE.PlaneGeometry(2 * W2, 2 * L2), MAT.path, false); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.005; G.add(floor);
  const road = mesh(new THREE.PlaneGeometry(6, 260), std('#55585c', { roughness: 0.9 }), false); road.rotation.x = -Math.PI / 2; road.position.set(-34, 0, 0); G.add(road);

  // ── structure ──
  const colGeo = new THREE.CylinderGeometry(0.038, 0.038, GUT, 10); colGeo.translate(0, GUT / 2, 0);
  const cols = []; for (const x of [-12, -4, 4, 12]) for (let z = -L2; z <= L2 + 0.01; z += PH.span) cols.push([x, z]);
  const colIM = new THREE.InstancedMesh(colGeo, MAT.steel, cols.length); colIM.castShadow = true;
  const m4 = new THREE.Matrix4(); cols.forEach(([x, z], i) => colIM.setMatrixAt(i, m4.makeTranslation(x, 0, z))); G.add(colIM);
  for (const x of [-12, -4, 4, 12]) { const g = boxM(x === -12 || x === 12 ? 0.12 : 0.32, 0.16, 2 * L2, MAT.steel); g.position.set(x, GUT, 0); G.add(g); }
  // hoops every 2 m, purlins along the length
  const hoopPts = (xc) => { const p = []; for (let i = 0; i <= 24; i++) { const u = -1 + i / 12; p.push(new THREE.Vector3(xc + u * 4, archY(u), 0)); } return p; };
  for (const xc of BAYX) {
    const curve = new THREE.CatmullRomCurve3(hoopPts(xc)), hg = new THREE.TubeGeometry(curve, 30, 0.024, 6);
    const n = PH.len / 2 + 1, im = new THREE.InstancedMesh(hg, MAT.steel, n); im.castShadow = true;
    for (let i = 0; i < n; i++) im.setMatrixAt(i, m4.makeTranslation(0, 0, -L2 + i * 2)); G.add(im);
    for (const u of [-0.75, -0.4, 0, 0.4, 0.75]) { const p = tubeBetween(new THREE.Vector3(xc + u * 4, archY(u), -L2), new THREE.Vector3(xc + u * 4, archY(u), L2), 0.018, MAT.steel, 6); G.add(p); }
    // trusses at the columns
    for (let z = -L2; z <= L2 + 0.01; z += PH.span) { const t = tubeBetween(new THREE.Vector3(xc - 4, GUT - 0.05, z), new THREE.Vector3(xc + 4, GUT - 0.05, z), 0.02, MAT.steel, 6); G.add(t); }
  }
  // cover: west half full, east half with a ridge vent gap; the vent flap hinges at the ridge
  U.flaps = [];
  for (const xc of BAYX) {
    G.add(new THREE.Mesh(archStrip(xc, -1, 0, 1, -L2, L2, 14, 0.02), MAT.film));
    G.add(new THREE.Mesh(archStrip(xc, 1, 0.22, 1, -L2, L2, 12, 0.02), MAT.film));
    const hinge = new THREE.Group(); hinge.position.set(xc, PH.ridge + 0.02, 0);
    const flap = new THREE.Mesh(archStrip(xc, 1, 0, 0.26, -L2, L2, 4, 0.04, new THREE.Vector3(xc, PH.ridge + 0.02, 0)), MAT.curtain); hinge.add(flap);
    const arm = boxM(0.04, 0.04, 2 * L2, MAT.steel); arm.position.set(1.05, -0.33, 0); hinge.add(arm);
    G.add(hinge); U.flaps.push(hinge);
    const net = new THREE.Mesh(archStrip(xc, 1, 0, 0.23, -L2, L2, 4, -0.03), new THREE.MeshStandardMaterial({ color: '#8d969c', transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })); G.add(net);
  }
  // gable ends
  const prof = profilePoints();
  const padHole = new THREE.Path([new THREE.Vector2(-11.6, 0.35), new THREE.Vector2(11.6, 0.35), new THREE.Vector2(11.6, 2.45), new THREE.Vector2(-11.6, 2.45)]);
  const fanX = [-10, -6, -2, 2, 6, 10];
  const gable = (holes) => { const s = new THREE.Shape(prof); s.holes = holes; return new THREE.ShapeGeometry(s, 4); };
  const gS = new THREE.Mesh(gable([padHole]), MAT.film); gS.position.z = -L2; G.add(gS);
  const gN = new THREE.Mesh(gable(fanX.map((x) => new THREE.Path([new THREE.Vector2(x - 0.7, 0.3), new THREE.Vector2(x + 0.7, 0.3), new THREE.Vector2(x + 0.7, 1.7), new THREE.Vector2(x - 0.7, 1.7)]))), MAT.film); gN.position.z = L2; G.add(gN);
  for (const z of [-L2, L2]) for (const x of [-8, -4, 0, 4, 8]) { const p = boxM(0.06, archY(((x + 12) % 8 - 4) / 4) - 0.1, 0.06, MAT.steel); p.position.set(x, p.geometry.parameters.height / 2, z); G.add(p); }

  // pad wall (south)
  const padTex = padTexture(), padMat = std('#ffffff', { map: padTex, roughness: 0.95 });
  const pad = boxM(23.2, 2.1, 0.15, padMat); pad.position.set(0, 1.4, -L2); G.add(pad); U.padMat = padMat;
  const streak = streakTexture(), wetMat = new THREE.MeshBasicMaterial({ map: streak, transparent: true, opacity: 0, depthWrite: false });
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(23.2, 2.1), wetMat); wet.position.set(0, 1.4, -L2 - 0.085); wet.rotation.y = Math.PI; G.add(wet);
  const wet2 = wet.clone(); wet2.position.z = -L2 + 0.085; wet2.rotation.y = 0; G.add(wet2); U.wetMat = wetMat; U.streak = streak;
  const header = tubeBetween(new THREE.Vector3(-11.7, 2.55, -L2), new THREE.Vector3(11.7, 2.55, -L2), 0.05, MAT.blue); G.add(header);
  const trough = boxM(23.4, 0.18, 0.3, MAT.dark); trough.position.set(0, 0.26, -L2); G.add(trough);
  const sump = cylM(0.7, 1.0, MAT.tank); sump.position.set(-13.5, 0.5, -L2 - 1.2); G.add(sump);
  const pump = boxM(0.5, 0.35, 0.35, MAT.blue); pump.position.set(-12.5, 0.18, -L2 - 1.2); G.add(pump);
  // fan wall (north)
  U.fans = fanX.map((x) => {
    const g = new THREE.Group(); g.position.set(x, 1.0, L2);
    for (const [w, h, px, py] of [[1.5, 0.08, 0, 0.71], [1.5, 0.08, 0, -0.71], [0.08, 1.5, 0.71, 0], [0.08, 1.5, -0.71, 0]]) { const b = boxM(w, h, 0.45, MAT.steel); b.position.set(px, py, 0.1); g.add(b); }
    const blades = new THREE.Group(); blades.position.z = 0.05;
    for (let k = 0; k < 6; k++) { const b = boxM(0.12, 0.6, 0.015, MAT.steel); b.position.y = 0.3; const p = new THREE.Group(); p.rotation.z = (k * Math.PI) / 3; b.rotation.y = 0.35; p.add(b); blades.add(p); }
    const hub = cylM(0.08, 0.12, MAT.dark); hub.rotation.x = Math.PI / 2; blades.add(hub); g.add(blades);
    const motor = cylM(0.14, 0.3, MAT.dark); motor.rotation.x = Math.PI / 2; motor.position.z = -0.2; g.add(motor);
    const louvres = [];
    for (let k = 0; k < 7; k++) { const l = boxM(1.36, 0.19, 0.01, MAT.white); const p = new THREE.Group(); p.position.set(0, 0.6 - k * 0.2, 0.36); p.add(l); l.position.y = -0.09; g.add(p); louvres.push(p); }
    G.add(g); return { g, blades, louvres, spin: 0 };
  });
  // side walls: skirting, insect net, roll-up curtain
  const netMat = new THREE.MeshStandardMaterial({ color: '#7d878d', map: netTexture(), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  netMat.map.repeat.set(160, 16);
  U.curtains = [];
  for (const s of [-1, 1]) {
    const skirt = boxM(0.04, 0.6, 2 * L2, MAT.curtain); skirt.position.set(s * W2, 0.3, 0); G.add(skirt);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(2 * L2, 3.7), netMat); net.rotation.y = Math.PI / 2; net.position.set(s * W2, 0.6 + 1.85, 0); G.add(net);
    const cg = new THREE.PlaneGeometry(2 * L2, 1); cg.translate(0, -0.5, 0);
    const cur = new THREE.Mesh(cg, MAT.curtain); cur.rotation.y = Math.PI / 2; cur.position.set(s * (W2 + 0.03), 4.3, 0); G.add(cur);
    const roll = cylM(0.06, 2 * L2, MAT.white, 10); roll.rotation.x = Math.PI / 2; roll.position.set(s * (W2 + 0.08), 0.6, 0); G.add(roll);
    const crank = boxM(0.12, 0.5, 0.12, MAT.dark); crank.position.set(s * (W2 + 0.2), 1.0, L2 - 1); G.add(crank);
    U.curtains.push({ cur, roll, s });
  }
  // shade screen
  U.screens = BAYX.map((xc) => {
    const g = new THREE.PlaneGeometry(7.8, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0, 0.5);
    const m = new THREE.Mesh(g, MAT.screen); m.position.set(xc, 4.36, -L2); m.receiveShadow = true; m.castShadow = true; G.add(m);
    const bar = boxM(7.8, 0.06, 0.12, MAT.steel); bar.position.set(xc, 4.36, -L2); G.add(bar);
    return { m, bar };
  });
  // fogging lines
  const nozzles = [];
  for (const xc of BAYX) for (const dx of [-2, 2]) {
    G.add(tubeBetween(new THREE.Vector3(xc + dx, 3.9, -L2 + 0.5), new THREE.Vector3(xc + dx, 3.9, L2 - 0.5), 0.012, MAT.black, 5));
    for (let z = -L2 + 2; z < L2 - 1; z += 2.5) nozzles.push(new THREE.Vector3(xc + dx, 3.86, z));
  }
  const nzIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), MAT.dark, nozzles.length); nozzles.forEach((p, i) => nzIM.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z))); G.add(nzIM);
  const FOG_N = nozzles.length * 6, fogPos = new Float32Array(FOG_N * 3), fogSeed = new Float32Array(FOG_N);
  for (let i = 0; i < FOG_N; i++) { fogSeed[i] = Math.random(); }
  const fogGeo = new THREE.BufferGeometry(); fogGeo.setAttribute('position', new THREE.BufferAttribute(fogPos, 3));
  const fogMat = new THREE.PointsMaterial({ size: 1.1, map: softDot(), transparent: true, opacity: 0, depthWrite: false, color: '#f4f8ff' });
  const fog = new THREE.Points(fogGeo, fogMat); fog.frustumCulled = false; G.add(fog);
  U.fog = { fog, fogMat, fogPos, fogSeed, nozzles, t: 0 };

  // beds, mulch and drip laterals
  for (const x of BEDX) {
    const bed = boxM(1.0, 0.25, 36.4, MAT.soil); bed.position.set(x, 0.125, 0); bed.castShadow = false; G.add(bed);
    const mulch = boxM(1.04, 0.01, 36.5, MAT.mulch); mulch.position.set(x, 0.255, 0); mulch.castShadow = false; G.add(mulch);
    for (const dx of [-0.25, 0.25]) G.add(tubeBetween(new THREE.Vector3(x + dx, 0.27, -18.2), new THREE.Vector3(x + dx, 0.27, 18.2), 0.008, MAT.black, 4));
    for (const dx of [-0.25, 0.25]) { const w = tubeBetween(new THREE.Vector3(x + dx, 4.15, -L2 + 0.4), new THREE.Vector3(x + dx, 4.15, L2 - 0.4), 0.004, MAT.steel, 4); w.castShadow = false; G.add(w); }
  }
  G.add(tubeBetween(new THREE.Vector3(-11.6, 0.15, -18.6), new THREE.Vector3(11.6, 0.15, -18.6), 0.03, MAT.black, 8));
  U.valves = BEDX.map((x) => { const v = boxM(0.1, 0.14, 0.1, MAT.dark); v.position.set(x, 0.24, -18.6); const l = boxM(0.04, 0.04, 0.04, MAT.led.clone()); l.position.set(x, 0.33, -18.6); G.add(v, l); return l; });

  // anteroom with a double door
  const ante = boxM(3, 2.8, 4, std('#e6ecef', { roughness: 0.5 })); ante.position.set(W2 + 1.6, 1.4, -6); G.add(ante);
  const door = boxM(0.06, 2.1, 1.2, MAT.dark); door.position.set(W2 + 3.12, 1.05, -6); G.add(door);
  const bath = boxM(1.0, 0.08, 1.2, MAT.blue); bath.position.set(W2 + 3.8, 0.04, -6); G.add(bath);

  // fertigation shed: stock tanks A, B and acid, venturi manifold, filters, pump, controller
  const shed = new THREE.Group(); shed.position.set(-W2 - 6, 0, -L2 + 4);
  const slab = boxM(7, 0.15, 5, MAT.conc); slab.position.y = 0.075; shed.add(slab);
  const roof = boxM(7.4, 0.08, 5.4, std('#7f8a93', { metalness: 0.4 })); roof.position.y = 3.0; roof.rotation.z = 0.06; shed.add(roof);
  for (const [x, z] of [[-3.3, -2.3], [3.3, -2.3], [-3.3, 2.3], [3.3, 2.3]]) { const p = boxM(0.1, 3, 0.1, MAT.steel); p.position.set(x, 1.5, z); shed.add(p); }
  [['A', MAT.blue, -2.2], ['B', MAT.blue, -1.0], ['Acid', MAT.red, 0.2]].forEach(([, m, x]) => { const t = cylM(0.4, 1.1, m); t.position.set(x, 0.7, -1.6); shed.add(t); });
  const mix = cylM(0.7, 1.4, MAT.white); mix.position.set(2.2, 0.85, -1.2); shed.add(mix);
  const manifold = boxM(3.2, 0.06, 0.06, MAT.black); manifold.position.set(-1, 1.2, -0.6); shed.add(manifold);
  for (const x of [-2.2, -1.0, 0.2]) { const v = cylM(0.05, 0.3, MAT.dark, 8); v.position.set(x, 1.05, -0.6); shed.add(v); const tube = tubeBetween(new THREE.Vector3(x, 1.25, -1.6), new THREE.Vector3(x, 1.2, -0.6), 0.015, MAT.black, 4); shed.add(tube); }
  const sand = cylM(0.35, 1.2, std('#2a6fa8')); sand.position.set(-2.4, 0.75, 1.2); shed.add(sand);
  const disc = cylM(0.15, 0.6, MAT.red); disc.rotation.z = Math.PI / 2; disc.position.set(-1.2, 0.5, 1.2); shed.add(disc);
  const pmp = boxM(0.9, 0.5, 0.5, MAT.blue); pmp.position.set(0.3, 0.4, 1.4); shed.add(pmp);
  const ctl = boxM(0.7, 0.9, 0.2, MAT.white); ctl.position.set(2.5, 1.5, 2.2); shed.add(ctl);
  const scr = mesh(new THREE.PlaneGeometry(0.5, 0.32), new THREE.MeshBasicMaterial({ color: '#2ad18a' })); scr.position.set(2.5, 1.62, 2.09); scr.rotation.y = Math.PI; shed.add(scr);
  shed.add(tubeBetween(new THREE.Vector3(0.3, 0.2, 1.4), new THREE.Vector3(6.2, 0.2, 1.4), 0.05, MAT.black, 8));
  G.add(shed); U.shed = shed;
  const tank = cylM(2.6, 2.6, MAT.tank, 32); tank.position.set(-W2 - 8, 1.3, 6); G.add(tank);
  const tankTop = cylM(2.65, 0.12, MAT.dark, 32); tankTop.position.set(-W2 - 8, 2.65, 6); G.add(tankTop);
  for (const x of [-12, 12]) G.add(tubeBetween(new THREE.Vector3(x, GUT, L2 + 0.1), new THREE.Vector3(x, 0.1, L2 + 0.1), 0.06, MAT.steel, 8));

  // weather station
  const ws = new THREE.Group(); ws.position.set(W2 + 7, 0, -L2 - 4);
  const wsMast = cylM(0.04, 3.2, MAT.steel); wsMast.position.y = 1.6; ws.add(wsMast);
  const cups = new THREE.Group(); cups.position.y = 3.25;
  for (let k = 0; k < 3; k++) { const arm = boxM(0.32, 0.015, 0.015, MAT.steel); arm.position.x = 0.16; const cup = mesh(new THREE.SphereGeometry(0.05, 8, 6, 0, Math.PI), MAT.white); cup.position.x = 0.32; cup.rotation.y = Math.PI / 2; const p = new THREE.Group(); p.rotation.y = (k * 2 * Math.PI) / 3; p.add(arm, cup); cups.add(p); }
  ws.add(cups);
  const vane = new THREE.Group(); vane.position.set(0.5, 3.0, 0); const vtail = boxM(0.35, 0.18, 0.01, MAT.white); vtail.position.x = -0.15; vane.add(vtail); const varm = boxM(0.04, 0.3, 0.04, MAT.steel); varm.position.set(-0.5, -0.1, 0); ws.add(varm); ws.add(vane);
  const pyr = cylM(0.06, 0.05, MAT.white); pyr.position.set(-0.4, 3.05, 0); ws.add(pyr); const dome = mesh(new THREE.SphereGeometry(0.04, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.film); dome.position.set(-0.4, 3.08, 0); ws.add(dome);
  const gauge = cylM(0.1, 0.3, MAT.white); gauge.position.set(0.6, 1.0, 0.5); ws.add(gauge);
  const shield = new THREE.Group(); for (let k = 0; k < 6; k++) { const d = cylM(0.12 - k * 0.004, 0.025, MAT.white); d.position.y = k * 0.05; shield.add(d); } shield.position.set(0, 1.9, 0.2); ws.add(shield);
  const sp = boxM(0.6, 0.03, 0.45, MAT.panel); sp.position.set(0, 2.4, -0.3); sp.rotation.x = -0.6; ws.add(sp);
  G.add(ws); U.ws = { cups, vane };

  // trees around
  const trunk = std('#6b4a2f'), leaf = std('#4f7d36', { roughness: 0.9, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.3 * Math.sin(i * 3), r = 42 + 14 * Math.abs(Math.sin(i * 1.7));
    const x = Math.cos(a) * r * 1.1, z = Math.sin(a) * r; if (x < -30 && x > -38) continue;
    const t = new THREE.Group(); const tr = cylM(0.25, 2.6, trunk, 6); tr.position.y = 1.3; const c = mesh(new THREE.IcosahedronGeometry(2.2 + (i % 3) * 0.5, 0), leaf); c.position.y = 3.8; t.add(tr, c); t.position.set(x, 0, z); G.add(t);
  }
  return { group: G, U };
}

// ── crop ──
export function buildCrop(cropKey, crop) {
  const G = new THREE.Group(), plants = [];
  const sp = crop.spacing, n = Math.floor(35.2 / sp);
  BEDX.forEach((bx, bed) => { for (const dx of [-0.25, 0.25]) for (let i = 0; i < n; i++) plants.push({ x: bx + dx, z: -17.6 + i * sp + (dx > 0 ? sp / 2 : 0), bed, inf: 0, treated: false, det: false, seen: false }); });
  const N = plants.length, H = crop.h, LPP = 5, FPP = cropKey === 'tomato' ? 5 : 3;
  const stemGeo = new THREE.CylinderGeometry(0.012, 0.018, 1, 5); stemGeo.translate(0, 0.5, 0);
  const stems = new THREE.InstancedMesh(stemGeo, std('#4f7a2c'), N);
  const leafGeo = new THREE.IcosahedronGeometry(0.17, 0); leafGeo.scale(1.25, 0.55, 1.0);
  const leaves = new THREE.InstancedMesh(leafGeo, std('#ffffff', { roughness: 0.75, flatShading: true }), N * LPP); leaves.castShadow = true;
  let fruitGeo;
  if (cropKey === 'cucumber') { fruitGeo = new THREE.CapsuleGeometry(0.022, 0.2, 3, 8); fruitGeo.translate(0, -0.12, 0); }
  else if (cropKey === 'tomato') fruitGeo = new THREE.SphereGeometry(0.035, 8, 6);
  else { fruitGeo = new THREE.SphereGeometry(0.05, 8, 6); fruitGeo.scale(1, 1.15, 1); }
  const fruits = new THREE.InstancedMesh(fruitGeo, std('#ffffff', { roughness: 0.35 }), N * FPP); fruits.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const linePos = [];
  const base = new THREE.Color('#3f7f31');
  plants.forEach((pl, i) => {
    const r1 = Math.sin(i * 12.9898) * 0.5 + 0.5, r2 = Math.sin(i * 78.233) * 0.5 + 0.5, h = H * (0.86 + 0.2 * r1);
    pl.h = h; pl.leaf = []; pl.base = base.clone().offsetHSL((r2 - 0.5) * 0.04, 0, (r1 - 0.5) * 0.08);
    m.compose(p.set(pl.x, 0.26, pl.z), q.identity(), s.set(1, h, 1)); stems.setMatrixAt(i, m);
    for (let k = 0; k < LPP; k++) {
      const y = 0.26 + h * (0.25 + 0.75 * (k / (LPP - 1))) - 0.05, a = k * 2.4 + r1 * 6, rr = 0.11 + 0.05 * Math.sin(k + i);
      const sc = (cropKey === 'cucumber' ? 1.25 : cropKey === 'tomato' ? 1.05 : 0.95) * (1.1 - 0.35 * (k / LPP));
      q.setFromAxisAngle(p.set(0, 1, 0), a); m.compose(p.set(pl.x + Math.cos(a) * rr, y, pl.z + Math.sin(a) * rr), q, s.set(sc, sc, sc));
      leaves.setMatrixAt(i * LPP + k, m); leaves.setColorAt(i * LPP + k, pl.base); pl.leaf.push(i * LPP + k);
    }
    for (let k = 0; k < FPP; k++) {
      const y = 0.26 + h * (cropKey === 'tomato' ? 0.15 + 0.12 * k : 0.25 + 0.2 * k), a = k * 2.1 + r2 * 5, rr = 0.12;
      q.identity(); m.compose(p.set(pl.x + Math.cos(a) * rr, y, pl.z + Math.sin(a) * rr), q, s.set(1, 1, 1));
      fruits.setMatrixAt(i * FPP + k, m);
      const col = crop.fruit[(i + k) % 2]; c.set(cropKey === 'capsicum' ? crop.fruit[i % 2] : col);
      if (cropKey === 'tomato' && k > 2) c.set('#7fae3a');
      fruits.setColorAt(i * FPP + k, c);
    }
    linePos.push(pl.x, 0.26 + h, pl.z, pl.x, 4.15, pl.z);
  });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  const strings = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#d8d2c0', transparent: true, opacity: 0.55 }));
  G.add(stems, leaves, fruits, strings);
  for (const im of [stems, leaves, fruits]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  const DIS = { capsicum: '#e3e6da', tomato: '#4f3a22', cucumber: '#d6c24a' }[cropKey], dis = new THREE.Color(DIS), dry = new THREE.Color('#9a9a3a');
  function paint(theta) {
    plants.forEach((pl, i) => {
      const dr = clamp01((24 - theta[pl.bed]) / 8), inf = pl.inf;
      for (const li of pl.leaf) { c.copy(pl.base).lerp(dry, dr * 0.7).lerp(dis, Math.min(1, inf * 1.4)); leaves.setColorAt(li, c); }
    });
    leaves.instanceColor.needsUpdate = true;
  }
  return { group: G, plants, paint, leaves };
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Scouting robot: drives the paths and looks at both neighbouring rows. */
export function buildRover() {
  const g = new THREE.Group();
  const body = boxM(0.6, 0.22, 0.42, MAT.orange); body.position.y = 0.22; g.add(body);
  for (const [x, z] of [[0.22, 0.24], [-0.22, 0.24], [0.22, -0.24], [-0.22, -0.24]]) { const w = cylM(0.1, 0.06, MAT.black, 12); w.rotation.x = Math.PI / 2; w.position.set(x, 0.1, z); g.add(w); }
  const mast = cylM(0.025, 1.5, MAT.steel, 8); mast.position.y = 1.05; g.add(mast);
  for (const y of [0.7, 1.25, 1.75]) { const cam = boxM(0.12, 0.09, 0.3, MAT.dark); cam.position.set(0, y, 0); g.add(cam); for (const s of [-1, 1]) { const lens = cylM(0.03, 0.02, MAT.blue, 10); lens.rotation.x = Math.PI / 2; lens.position.set(0, y, s * 0.16); g.add(lens); } }
  const beacon = cylM(0.04, 0.06, new THREE.MeshBasicMaterial({ color: '#3fcf8e' })); beacon.position.y = 1.85; g.add(beacon);
  const fovMat = new THREE.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.9, 4, 1, true), fovMat); f.rotation.x = s * Math.PI / 2; f.rotation.y = Math.PI / 4; f.position.set(0, 1.2, s * 0.6); g.add(f); }
  g.rotation.order = 'YXZ';
  return { g, beacon };
}
/** Serpentine route along the paths. Returns a function d → {x, z, h}. */
export function roverRoute() {
  const pts = [];
  PATHX.forEach((x, i) => { const z0 = i % 2 ? 18.6 : -18.6; pts.push([x, z0], [x, -z0]); });
  const seg = []; let L = 0;
  for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], l = Math.hypot(x1 - x0, z1 - z0); seg.push({ x0, z0, x1, z1, l, L }); L += l; }
  const at = (d) => {
    d = ((d % L) + L) % L; const s = seg.find((q) => d <= q.L + q.l) || seg[seg.length - 1], u = (d - s.L) / s.l;
    return { x: s.x0 + (s.x1 - s.x0) * u, z: s.z0 + (s.z1 - s.z0) * u, h: Math.atan2(s.x1 - s.x0, s.z1 - s.z0) };
  };
  return { at, L };
}

/** Move the kit to match the actuators. vis holds the smoothed positions. */
export function animatePH(U, a, w, dt, speed, vis, fault = {}) {
  const ease = (k, v, rate = 1.5) => { vis[k] = (vis[k] ?? v) + (v - (vis[k] ?? v)) * Math.min(1, dt * rate); return vis[k]; };
  const vent = ease('vent', a.vent), shade = ease('shade', a.shade, 1.2), fog = ease('fog', a.fog, 2);
  U.flaps.forEach((h) => { h.rotation.z = vent * 0.62; });
  const rollY = 0.6 + vent * 3.6;
  U.curtains.forEach(({ cur, roll }) => { cur.scale.y = Math.max(0.01, 4.3 - rollY); roll.position.y = rollY; });
  U.screens.forEach(({ m, bar }) => { m.scale.z = Math.max(0.001, shade * PH.len); bar.position.z = -L2 + shade * PH.len; });
  const on = a.fans > 0;
  U.fans.forEach((f, i) => {
    const run = i < a.fans; f.spin = Math.min(1, Math.max(0, f.spin + (run ? dt : -dt * 0.4)));
    f.blades.rotation.z += f.spin * dt * 22; f.louvres.forEach((l) => { l.rotation.x = -f.spin * 1.15; });
  });
  const wet = ease('wet', on && a.pad && !fault.pad ? 1 : 0, 0.5);
  U.padMat.color.setRGB(1 - wet * 0.38, 1 - wet * 0.42, 1 - wet * 0.5);
  U.wetMat.opacity = wet * 0.55; U.streak.offset.y -= dt * 1.2 * wet;
  // fog: droplets drift down and spread from each nozzle
  const F = U.fog; F.t += dt; F.fogMat.opacity = fog * 0.32; F.fog.visible = fog > 0.02;
  if (F.fog.visible) {
    const n = F.nozzles.length, per = F.fogPos.length / 3 / n;
    for (let i = 0; i < F.fogPos.length / 3; i++) {
      const nz = F.nozzles[Math.floor(i / per)], ph = (F.fogSeed[i] + F.t * 0.18) % 1, r = 0.15 + ph * 1.1, a2 = F.fogSeed[i] * 40;
      F.fogPos[i * 3] = nz.x + Math.cos(a2) * r; F.fogPos[i * 3 + 1] = nz.y - ph * 1.6; F.fogPos[i * 3 + 2] = nz.z + Math.sin(a2) * r;
    }
    F.fog.geometry.attributes.position.needsUpdate = true;
  }
  U.valves.forEach((l, i) => l.material.color.set(a.drip?.[i] ? '#3fd0ff' : '#203038'));
  U.ws.cups.rotation.y += dt * w.wind * 2.2 * Math.min(1, 60 / Math.max(60, speed) * 10);
  U.ws.vane.rotation.y = 0.6 + 0.3 * Math.sin(w.h);
}
