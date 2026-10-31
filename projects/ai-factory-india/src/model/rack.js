/**
 * Vera Rubin NVL72 rack (third-generation MGX rack, approximate dimensions).
 *
 * Bottom → top: 2 power shelves, 8 compute trays, 9 NVLink 6 switch trays,
 * 10 compute trays, 2 power shelves, management switches. Every tray is 1U and
 * fanless (direct-to-chip liquid cooling). Rear: NVLink copper spine (4 cartridges),
 * coolant manifolds with quick disconnects, and a DC busbar.
 */
import * as THREE from 'three';
import { mat, glow, box, cyl, canvasTex, flowTube, label } from './kit.js';

export const RACK = { w: 0.6, d: 1.068, h: 2.236 };
export const U = 0.04445;
const BASE = 0.1;                    // plinth / casters
const FACE_W = 0.482;                // 19-inch panel width
const TRAY_W = 0.44, TRAY_D = 0.9;

/** Slot list: { kind, u (bottom), n (height in U), index } */
export const LAYOUT = (() => {
  const s = [];
  let u = 0;
  const add = (kind, n = 1) => { s.push({ kind, u, n }); u += n; };
  add('power', 2); add('power', 2);
  for (let i = 0; i < 8; i++) add('compute');
  for (let i = 0; i < 9; i++) add('switch');
  for (let i = 0; i < 10; i++) add('compute');
  add('power', 2); add('power', 2);
  u += 1; add('mgmt'); add('mgmt');
  // number compute trays 1–18 from the top
  s.filter((x) => x.kind === 'compute').reverse().forEach((x, i) => { x.index = i + 1; });
  s.filter((x) => x.kind === 'switch').reverse().forEach((x, i) => { x.index = i + 1; });
  return s;
})();
export const slotY = (slot) => BASE + slot.u * U;   // bottom of the slot

// ── Face artwork (shared by the instanced racks and the detailed rack) ───────
function face(g, kind, x, y, w, h, leds) {
  const px = w / FACE_W;   // pixels per metre
  const r = (fx, fy, fw, fh, c) => { g.fillStyle = c; g.fillRect(x + fx * px, y + fy * h, fw * px, fh * h); };
  if (!leds) r(0, 0.04, FACE_W, 0.92, kind === 'switch' ? '#1c1f24' : kind === 'power' ? '#2f3237' : '#262a30');
  if (kind === 'compute') {
    if (!leds) {
      r(0.006, 0.15, 0.012, 0.7, '#5b616b'); r(FACE_W - 0.018, 0.15, 0.012, 0.7, '#5b616b');          // handles
      for (let i = 0; i < 4; i++) { r(0.04 + i * 0.02, 0.2, 0.016, 0.6, '#9aa1aa'); r(FACE_W - 0.12 + i * 0.02, 0.2, 0.016, 0.6, '#9aa1aa'); } // OSFP (ConnectX-9)
      for (let i = 0; i < 8; i++) r(0.15 + i * 0.022, 0.18, 0.018, 0.64, '#121417');                   // E1.S bays
      r(0.34, 0.25, 0.012, 0.5, '#8d949d'); r(0.355, 0.25, 0.012, 0.5, '#8d949d');                     // BlueField-4
    } else {
      r(0.024, 0.4, 0.005, 0.25, '#4dff88');
      for (let i = 0; i < 8; i++) r(0.153 + i * 0.022, 0.26, 0.004, 0.14, '#33d6ff');
    }
  } else if (kind === 'switch') {
    if (!leds) {
      r(0.006, 0.15, 0.012, 0.7, '#4d535c'); r(FACE_W - 0.018, 0.15, 0.012, 0.7, '#4d535c');
      r(0.2, 0.3, 0.08, 0.4, '#30353c'); r(0.06, 0.25, 0.02, 0.5, '#9aa1aa'); r(0.09, 0.25, 0.02, 0.5, '#9aa1aa');
    } else {
      r(0.03, 0.4, 0.005, 0.25, '#4d9dff'); r(0.42, 0.4, 0.03, 0.18, '#76b900');
    }
  } else if (kind === 'power') {
    if (!leds) for (let i = 0; i < 6; i++) { r(0.012 + i * 0.077, 0.1, 0.07, 0.8, '#3d4147'); r(0.02 + i * 0.077, 0.2, 0.012, 0.6, '#666c75'); }
    else for (let i = 0; i < 6; i++) r(0.07 + i * 0.077, 0.45, 0.004, 0.12, '#4dff88');
  } else if (kind === 'mgmt') {
    if (!leds) for (let i = 0; i < 24; i++) r(0.05 + i * 0.016, 0.3, 0.012, 0.4, '#101214');
    else for (let i = 0; i < 24; i += 2) r(0.052 + i * 0.016, 0.22, 0.004, 0.06, '#ffb84d');
  }
}

function rackFaceCanvas(leds) {
  return canvasTex(256, 960, (g, W, H) => {
    g.fillStyle = leds ? '#000' : '#15171b'; g.fillRect(0, 0, W, H);
    const pxm = H / RACK.h;
    const x0 = ((RACK.w - FACE_W) / 2) * (W / RACK.w), fw = FACE_W * (W / RACK.w);
    for (const s of LAYOUT) {
      const y = H - (slotY(s) + s.n * U) * pxm;
      face(g, s.kind, x0, y, fw, s.n * U * pxm, leds);
    }
    if (!leds) { g.fillStyle = '#0c0d10'; g.fillRect(0, 0, x0 - 4, H); g.fillRect(W - x0 + 4, 0, x0, H); }
  }, !leds);
}
function rackBackCanvas(leds) {
  return canvasTex(256, 960, (g, W, H) => {
    g.fillStyle = leds ? '#000' : '#16181c'; g.fillRect(0, 0, W, H);
    const pxm = H / RACK.h, sx = W / RACK.w;
    const top = H - (slotY(LAYOUT.find((s) => s.kind === 'mgmt'))) * pxm, bot = H - BASE * pxm;
    if (!leds) {
      // seen from behind, the supply manifold (−x) is on the viewer's right
      g.fillStyle = '#d8402f'; g.fillRect(0.02 * sx, top, 0.04 * sx, bot - top);
      g.fillStyle = '#2f62d8'; g.fillRect(RACK.w * sx - 0.06 * sx, top, 0.04 * sx, bot - top);
      g.fillStyle = '#b87333'; g.fillRect(RACK.w * sx - 0.14 * sx, top, 0.03 * sx, bot - top);
      for (let c = 0; c < 4; c++) { g.fillStyle = '#2b2622'; g.fillRect((0.17 + c * 0.085) * sx, top + 40, 0.07 * sx, bot - top - 120); }
    } else {
      for (const s of LAYOUT) if (s.kind === 'compute') { g.fillStyle = '#3cff8a'; g.fillRect(0.5 * sx, H - (slotY(s) + 0.5 * U) * pxm, 2, 2); }
    }
  }, !leds);
}

let rackMats;
/** Materials for a BoxGeometry rack: [+x, −x, +y, −y, +z front, −z back]. */
export function rackMaterials() {
  if (rackMats) return rackMats;
  const side = mat('#1b1d21', 0.55, 0.4);
  const front = new THREE.MeshStandardMaterial({ map: rackFaceCanvas(false), emissiveMap: rackFaceCanvas(true), emissive: '#ffffff', emissiveIntensity: 1.6, roughness: 0.6, metalness: 0.3 });
  const back = new THREE.MeshStandardMaterial({ map: rackBackCanvas(false), emissiveMap: rackBackCanvas(true), emissive: '#ffffff', emissiveIntensity: 1.2, roughness: 0.6, metalness: 0.3 });
  rackMats = [side, side, mat('#202227', 0.7, 0.3), side, front, back];
  return rackMats;
}

function faceTexture(kind, n = 1) {
  const h = Math.round(24 * n);
  return [false, true].map((leds) => canvasTex(256, h, (g, W, H) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); face(g, kind, 0, 0, W, H, leds); }, !leds));
}
const FACES = {};
function faceMat(kind, n) {
  const k = kind + n;
  if (!FACES[k]) {
    const [map, em] = faceTexture(kind, n);
    FACES[k] = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: '#ffffff', emissiveIntensity: 1.6, roughness: 0.55, metalness: 0.35 });
  }
  return FACES[k];
}

// ── Silicon artwork ─────────────────────────────────────────────────────────
const DIE = canvasTex(128, 160, (g, W, H) => {
  g.fillStyle = '#20242c'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${120 + Math.random() * 80},${110 + Math.random() * 60},${160 + Math.random() * 80},${0.08 + Math.random() * 0.12})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 14, 2 + Math.random() * 10);
  }
  g.strokeStyle = 'rgba(200,190,255,0.15)';
  for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
});
const M = {
  pan: mat('#3a3e45', 0.45, 0.7), pcb: mat('#173826', 0.55, 0.1), pcbDark: mat('#122a1d', 0.6, 0.1),
  substrate: mat('#3b3326', 0.5, 0.2), die: new THREE.MeshStandardMaterial({ map: DIE, roughness: 0.18, metalness: 0.6 }),
  io: mat('#2a2e36', 0.25, 0.6), hbm: mat('#5d6068', 0.3, 0.7), steel: mat('#a9afb8', 0.35, 0.85),
  plate: mat('#c9a27a', 0.28, 0.95), plateNi: mat('#c7ccd3', 0.25, 0.95), conn: mat('#0e0f11', 0.6, 0.2),
  socamm: mat('#1e4a33', 0.5, 0.1), chipBlack: mat('#121316', 0.4, 0.3), copper: mat('#b87333', 0.35, 0.95),
  blue: mat('#2c6bff', 0.35, 0.3), red: mat('#ff4a3d', 0.35, 0.3), frame: mat('#17191d', 0.5, 0.5),
};

/** Rubin GPU package: 2 compute dies, 2 I/O dies, 8 HBM4 stacks (12 chips). */
function rubin(parent, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  box(0.095, 0.003, 0.095, M.substrate, 0, 0.0031, 0, g);
  const y = 0.0046 + 0.002;
  for (const s of [-1, 1]) box(0.026, 0.004, 0.033, M.die, s * 0.0145, y, 0, g);
  for (const s of [-1, 1]) box(0.008, 0.004, 0.033, M.io, s * 0.0345, y, 0, g);
  for (const sz of [-1, 1]) for (const hx of [-0.021, -0.008, 0.008, 0.021]) box(0.011, 0.005, 0.013, M.hbm, hx, y + 0.0005, sz * 0.025, g);
  for (const s of [-1, 1]) { box(0.092, 0.002, 0.004, M.steel, 0, 0.0056, s * 0.044, g); box(0.004, 0.002, 0.092, M.steel, s * 0.044, 0.0056, 0, g); }
  return g;
}
function vera(parent, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  box(0.07, 0.003, 0.07, M.substrate, 0, 0.0031, 0, g);
  box(0.042, 0.004, 0.038, M.die, 0, 0.0066, 0, g);
  for (const s of [-1, 1]) for (const k of [-1, 1]) box(0.014, 0.004, 0.09, M.socamm, s * (0.046 + (k > 0 ? 0.018 : 0)), 0.004, 0, g);
  return g;
}

/**
 * Detailed compute tray. Local origin: tray centre at floor of the tray; front at +z.
 * Returns { group, setExplode(e) }.
 */
export function computeTray(tags) {
  const tray = new THREE.Group();
  box(TRAY_W, 0.002, TRAY_D, M.pan, 0, 0.001, 0, tray);
  for (const s of [-1, 1]) box(0.002, 0.04, TRAY_D, M.pan, s * TRAY_W / 2, 0.02, 0, tray);
  box(TRAY_W, 0.04, 0.002, M.pan, 0, 0.02, -TRAY_D / 2, tray);
  const front = box(FACE_W, U - 0.002, 0.004, faceMat('compute', 1), 0, U / 2, TRAY_D / 2 + 0.002, tray);
  front.material = [M.frame, M.frame, M.frame, M.frame, faceMat('compute', 1), M.frame];

  const boards = new THREE.Group(); boards.position.y = 0.002; tray.add(boards);
  // Two superchip boards: each one Vera CPU + two Rubin GPUs
  for (const s of [-1, 1]) {
    box(0.205, 0.0016, 0.6, M.pcb, s * 0.108, 0.0008, -0.1, boards);
    rubin(boards, s * 0.16, -0.21); rubin(boards, s * 0.055, -0.21);
    vera(boards, s * 0.108, 0.07);
    box(0.06, 0.012, 0.012, M.conn, s * 0.108, 0.006, -0.425, boards);        // NVLink 6 spine connectors
    box(0.06, 0.012, 0.012, M.conn, s * 0.05, 0.006, -0.425, boards);
  }
  // Front I/O: two ConnectX-9 cards, BlueField-4, E1.S drives
  for (const s of [-1, 1]) {
    box(0.1, 0.0016, 0.14, M.pcbDark, s * 0.15, 0.003, 0.34, boards);
    box(0.03, 0.003, 0.03, M.chipBlack, s * 0.15, 0.0055, 0.32, boards);
    for (let i = 0; i < 4; i++) box(0.017, 0.013, 0.06, M.steel, s * (0.115 + i * 0.02), 0.009, 0.415, boards);
  }
  box(0.12, 0.0016, 0.13, M.pcbDark, 0, 0.003, 0.28, boards);
  box(0.035, 0.003, 0.035, M.chipBlack, 0, 0.0055, 0.27, boards);
  for (let i = 0; i < 8; i++) box(0.016, 0.03, 0.09, M.chipBlack, -0.077 + i * 0.022, 0.017, 0.4, boards);
  box(0.05, 0.02, 0.03, M.copper, 0, 0.012, -0.44, boards);                   // busbar clip

  // Cold-plate assembly (lifts as one piece when exploded)
  const plates = new THREE.Group(); tray.add(plates);
  const plateY = 0.002 + 0.0105 + 0.006;
  const barbs = {};
  for (const s of [-1, 1]) {
    for (const gx of [0.16, 0.055]) {
      box(0.09, 0.012, 0.09, M.plateNi, s * gx, plateY, -0.21, plates);
      box(0.06, 0.004, 0.06, M.plate, s * gx, plateY + 0.008, -0.21, plates);
      barbs[`${s}g${gx}`] = [s * gx, plateY + 0.012, -0.21];
    }
    box(0.064, 0.01, 0.064, M.plateNi, s * 0.108, plateY - 0.001, 0.07, plates);
    box(0.034, 0.008, 0.034, M.plateNi, s * 0.15, plateY - 0.006, 0.32, plates);
    for (const q of [-1, 1]) cyl(0.008, 0.03, q < 0 ? M.blue : M.red, s * (0.19 + q * 0.012), 0.016, -0.44, plates, 12).rotation.x = Math.PI / 2;
  }
  box(0.04, 0.008, 0.04, M.plateNi, 0, plateY - 0.006, 0.27, plates);
  // Hoses: supply (blue) → GPU → GPU → CPU → return (red), per superchip
  for (const s of [-1, 1]) {
    const qdS = [s * 0.178, 0.02, -0.43], qdR = [s * 0.202, 0.02, -0.43];
    const g1 = barbs[`${s}g0.16`], g2 = barbs[`${s}g0.055`], cpu = [s * 0.108, plateY + 0.006, 0.07];
    const lift = (p, dy = 0.012) => [p[0], p[1] + dy, p[2]];
    plates.add(flowTube([qdS, [s * 0.178, 0.03, -0.33], lift(g1, 0.01), g1], { radius: 0.0035, color: '#3d8bff', dash: 0.05, kind: 'coolant' }));
    plates.add(flowTube([g1, lift(g1, 0.015), lift(g2, 0.015), g2], { radius: 0.0035, color: '#7d6bff', dash: 0.05, kind: 'coolant' }));
    plates.add(flowTube([g2, lift(g2, 0.014), [s * 0.08, plateY + 0.02, -0.07], lift(cpu, 0.01), cpu], { radius: 0.0035, color: '#d05bd8', dash: 0.05, kind: 'coolant' }));
    plates.add(flowTube([cpu, lift(cpu, 0.016), [s * 0.205, plateY + 0.02, -0.05], [s * 0.205, 0.03, -0.33], qdR], { radius: 0.0035, color: '#ff5a3d', dash: 0.05, kind: 'coolant' }));
  }
  const lidMat = new THREE.MeshStandardMaterial({ color: '#30343a', roughness: 0.45, metalness: 0.7, transparent: true });
  const lid = box(TRAY_W, 0.002, TRAY_D, lidMat, 0, 0.042, 0, tray);

  // Labels (shown only on the tray stop)
  const L = (t, p, c) => label(t, tray, new THREE.Vector3(...p), tags, c);
  L('<b>Rubin GPU</b><span>2 compute dies · 2 I/O dies · 8 HBM4 · 288 GB</span>', [-0.16, 0.02, -0.21]);
  L('<b>Rubin GPU</b><span>50 PFLOPS NVFP4</span>', [0.055, 0.02, -0.21]);
  L('<b>Vera CPU</b><span>88 Olympus cores · LPDDR5X SOCAMM</span>', [-0.108, 0.02, 0.07]);
  L('<b>HBM4 stack</b>', [0.16 + 0.021, 0.012, -0.21 - 0.025], 'small');
  L('<b>ConnectX-9</b><span>scale-out I/O</span>', [0.15, 0.02, 0.34]);
  L('<b>BlueField-4</b><span>storage · security</span>', [0, 0.02, 0.27]);
  L('<b>NVLink 6 connectors</b><span>to the spine · 3 TB/s per GPU</span>', [0.11, 0.02, -0.43], 'small');
  L('<b>Cold plates</b><span>45 °C max inlet</span>', [-0.16, 0.14, -0.21]);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return {
    group: tray,
    setExplode(e) {
      tray.userData.slide = 0.78 * ss(0, 0.35, e);
      const l = ss(0.35, 0.6, e);
      lid.position.y = 0.042 + 0.28 * l; lidMat.opacity = 1 - l; lid.visible = l < 0.99;
      plates.position.y = 0.11 * ss(0.6, 0.9, e);
    },
  };
}

/** Detailed rack with sliding trays, rear spine and manifolds. */
export function detailedRack(tags) {
  const rack = new THREE.Group();
  const { w, d, h } = RACK;
  // Frame: posts, top/bottom, side panels (semi-open so trays read)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, h - BASE, 0.04, M.frame, sx * (w / 2 - 0.02), BASE + (h - BASE) / 2, sz * (d / 2 - 0.02), rack);
  box(w, 0.04, d, M.frame, 0, h - 0.02, 0, rack);
  box(w, BASE, d, mat('#101114', 0.7, 0.3), 0, BASE / 2, 0, rack);
  for (const sx of [-1, 1]) box(0.004, h - BASE - 0.04, d - 0.08, mat('#1c1e22', 0.5, 0.45), sx * (w / 2 - 0.002), BASE + (h - BASE) / 2, 0, rack);
  for (const sx of [-1, 1]) box(0.012, LAYOUT.at(-1).u * U + U, 0.012, M.steel, sx * 0.247, BASE + (LAYOUT.at(-1).u * U + U) / 2, d / 2 - 0.07, rack);

  let tray = null;
  const trays = [];
  for (const s of LAYOUT) {
    const y = slotY(s);
    if (s.kind === 'compute' && s.index === 3) {
      tray = computeTray(tags);
      tray.group.position.set(0, y, d / 2 - 0.08 - TRAY_D / 2 + 0.004);
      tray.baseZ = tray.group.position.z;
      rack.add(tray.group);
      continue;
    }
    const g = new THREE.Group(); g.position.set(0, y, 0); rack.add(g);
    const fm = faceMat(s.kind, s.n);
    const f = box(FACE_W, s.n * U - 0.0015, 0.006, [M.frame, M.frame, M.frame, M.frame, fm, M.frame], 0, (s.n * U) / 2, d / 2 - 0.075, g);
    f.material = [M.frame, M.frame, M.frame, M.frame, fm, M.frame];
    box(TRAY_W, s.n * U - 0.004, TRAY_D - 0.02, mat('#24272c', 0.5, 0.6), 0, (s.n * U) / 2, d / 2 - 0.08 - TRAY_D / 2, g);
    trays.push(g);
  }

  // Rear: coolant manifolds, busbar, NVLink spine cartridges
  const zr = -d / 2 + 0.05;
  const top = slotY(LAYOUT.find((s) => s.kind === 'mgmt')), bot = BASE + 0.05;
  const mh = top - bot;
  cyl(0.024, mh, M.blue, -0.255, bot + mh / 2, zr, rack);
  cyl(0.024, mh, M.red, 0.255, bot + mh / 2, zr, rack);
  rack.add(flowTube([[-0.255, bot, zr - 0.03], [-0.255, top, zr - 0.03]], { radius: 0.012, color: '#4d94ff', dash: 0.25, kind: 'coolant', opacity: 0.7 }));
  rack.add(flowTube([[0.255, top, zr - 0.03], [0.255, bot, zr - 0.03]], { radius: 0.012, color: '#ff6a4d', dash: 0.25, kind: 'coolant', opacity: 0.7 }));
  for (const s of LAYOUT) if (s.kind === 'compute' || s.kind === 'switch') {
    const y = slotY(s) + U / 2;
    for (const sx of [-1, 1]) {
      const hose = cyl(0.007, 0.07, sx < 0 ? M.blue : M.red, sx * 0.22, y, zr + 0.02, rack, 8);
      hose.rotation.z = Math.PI / 2;
    }
  }
  box(0.03, mh, 0.012, M.copper, -0.19, bot + mh / 2, zr + 0.01, rack);

  const spine = new THREE.Group(); rack.add(spine);
  const cY0 = slotY(LAYOUT.find((s) => s.kind === 'compute')), cY1 = slotY(LAYOUT.filter((s) => s.kind === 'compute').at(-1)) + U;
  const cartMat = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.4, metalness: 0.5, transparent: true, opacity: 0.35 });
  const cartX = [-0.12, -0.04, 0.04, 0.12];
  for (const cx of cartX) box(0.07, cY1 - cY0, 0.05, cartMat, cx, (cY0 + cY1) / 2, zr + 0.005, spine);
  // copper twinax: every compute tray to every switch tray (sampled for clarity)
  const swY = LAYOUT.filter((s) => s.kind === 'switch').map((s) => slotY(s) + U / 2);
  const cpY = LAYOUT.filter((s) => s.kind === 'compute').map((s) => slotY(s) + U / 2);
  const curves = [];
  const pos = [];
  for (const cx of cartX) for (const a of cpY) for (let k = 0; k < 3; k++) {
    const b = swY[(Math.round(a * 997) + k * 3 + Math.round(cx * 50)) % swY.length];
    const off = (k - 1) * 0.012 + (Math.random() - 0.5) * 0.01;
    const c = new THREE.CubicBezierCurve3(
      new THREE.Vector3(cx + off, a, zr + 0.03), new THREE.Vector3(cx + off * 2, a, zr - 0.02 - Math.abs(a - b) * 0.08),
      new THREE.Vector3(cx + off * 2, b, zr - 0.02 - Math.abs(a - b) * 0.08), new THREE.Vector3(cx + off, b, zr + 0.03));
    curves.push(c);
    const pts = c.getPoints(14);
    for (let i = 0; i < pts.length - 1; i++) pos.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  spine.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#c8834a', transparent: true, opacity: 0.55 })));
  // data pulses along the cables
  const NP = 600, pp = new Float32Array(NP * 3), pState = [];
  for (let i = 0; i < NP; i++) pState.push({ c: curves[i % curves.length], t: Math.random(), v: 0.4 + Math.random() * 0.8, dir: Math.random() < 0.5 ? 1 : -1 });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pulses = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#7dffb0', size: 3, sizeAttenuation: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  pulses.frustumCulled = false;
  spine.add(pulses);
  const tmp = new THREE.Vector3();
  function updatePulses(dt, rate) {
    for (let i = 0; i < NP; i++) {
      const s = pState[i];
      s.t = (s.t + dt * s.v * rate * s.dir + 1) % 1;
      s.c.getPoint(s.t, tmp);
      pp[i * 3] = tmp.x; pp[i * 3 + 1] = tmp.y; pp[i * 3 + 2] = tmp.z - 0.004;
    }
    pg.attributes.position.needsUpdate = true;
  }

  // Labels
  const L = (t, p, tg, c) => label(t, rack, new THREE.Vector3(...p), tg, c);
  const cTop = LAYOUT.filter((s) => s.kind === 'compute').at(-1), sw = LAYOUT.filter((s) => s.kind === 'switch');
  L('<b>10 compute trays</b><span>40 Rubin GPUs · 20 Vera CPUs</span>', [0.33, (slotY(cTop) + slotY(LAYOUT.find((s) => s.kind === 'compute' && s.index === 10))) / 2, d / 2], 'rack');
  L('<b>9 NVLink 6 switch trays</b><span>216 TB/s scale-up fabric</span>', [0.33, (slotY(sw[0]) + slotY(sw.at(-1)) + U) / 2, d / 2], 'rack');
  L('<b>8 compute trays</b><span>32 Rubin GPUs · 16 Vera CPUs</span>', [0.33, slotY(LAYOUT.find((s) => s.kind === 'compute' && s.index === 18)) + 4 * U, d / 2], 'rack');
  L('<b>Power shelves</b><span>4 × shelves → DC busbar</span>', [0.33, BASE + 2 * U, d / 2], 'rack');
  L('<b>Management switches</b>', [0.33, top + U, d / 2], 'rack', 'small');
  L('<b>NVLink 6 spine</b><span>copper cable cartridges · no optics</span>', [0.05, (cY0 + cY1) / 2 + 0.25, zr - 0.08], 'spine');
  L('<b>Supply manifold</b><span>coolant in · ≤ 45 °C</span>', [-0.255, 1.0, zr - 0.05], 'spine');
  L('<b>Return manifold</b><span>≈ +10 K at full load</span>', [0.255, 0.75, zr - 0.05], 'spine');
  L('<b>DC busbar</b>', [-0.19, 0.5, zr - 0.03], 'spine', 'small');
  return { group: rack, tray, trays, spine, updatePulses };
}
