/** Trains, ST buses and road traffic: models and placement on a route. Liveries are approximate. */
import * as THREE from 'three';
import { offset, at } from './route.js';
import { mat } from './world.js';

export const RAIL_TOP = 0.42;
export const TRAINS = {
  vb: { name: 'Vande Bharat Express', vmax: 130, acc: 0.7, dec: 0.75, dwell: 60, skip: ['Karjat', 'Khandala'], desc: 'Semi-high-speed train set: distributed traction, no locomotive, aerodynamic driving cars.' },
  express: { name: 'Express — WAP-7 + LHB coaches', vmax: 110, acc: 0.32, dec: 0.55, dwell: 90, desc: 'A 6,000 hp WAP-7 electric locomotive hauling 18 LHB coaches: sleeper, AC 3-tier, 2-tier, first AC and pantry.' },
  local: { name: 'Mumbai suburban local — 12-car EMU', vmax: 100, acc: 0.85, dec: 0.9, dwell: 25, desc: 'The lifeline of Mumbai: a 12-car EMU with open doors and passengers hanging on in the rush.' },
  freight: { name: 'Freight — WAG-9 + covered wagons', vmax: 75, acc: 0.16, dec: 0.32, dwell: 0, noStops: true, desc: 'A 6,000 hp WAG-9 heavy-haul locomotive with 30 BCN covered wagons. It runs through without stopping.' },
};
export const BUSES = {
  lalpari: { name: 'Lalpari — ordinary', vmax: 70, acc: 0.9, dec: 1.2, dwell: 45, body: '#c8202a', band: '#f2c230', roof: '#c8202a', rack: true, glass: '#1b2a34', board: 'paint', desc: 'The red "Lalpari", the classic MSRTC ordinary service that reaches almost every village in Maharashtra.' },
  hirkani: { name: 'Hirkani — semi-luxury', vmax: 75, acc: 0.95, dec: 1.2, dwell: 40, body: '#2e8b57', band: '#f4f4ee', roof: '#e8e8e2', glass: '#1b2a34', board: 'paint', desc: 'Semi-luxury intercity coach with push-back seats.' },
  shivshahi: { name: 'Shivshahi — AC seater', vmax: 80, acc: 1.0, dec: 1.25, dwell: 40, body: '#f4f4f0', band: '#e2711d', roof: '#f4f4f0', glass: '#22303c', board: 'led', desc: 'Air-conditioned seater for medium and long distances.' },
  shivneri: { name: 'Shivneri — premium AC', vmax: 85, acc: 1.05, dec: 1.3, dwell: 35, body: '#f6f7f9', band: '#2a4d8f', roof: '#f6f7f9', glass: '#1a2733', board: 'led', tall: true, desc: 'Premium multi-axle AC coach, famous on the Mumbai–Pune run.' },
  eshivai: { name: 'e-Shivai — electric', vmax: 80, acc: 1.2, dec: 1.4, dwell: 35, body: '#f4f6f4', band: '#2f9e58', roof: '#dfe7df', glass: '#1b2a34', board: 'led', electric: true, desc: 'Battery-electric AC bus: quiet, zero tailpipe emissions.' },
};

function canvasPair(w, h, draw) {
  const a = document.createElement('canvas'), b = document.createElement('canvas'); a.width = b.width = w; a.height = b.height = h;
  draw(a.getContext('2d'), b.getContext('2d'), w, h);
  const ta = new THREE.CanvasTexture(a), tb = new THREE.CanvasTexture(b); ta.colorSpace = tb.colorSpace = THREE.SRGBColorSpace; ta.anisotropy = 8;
  return [ta, tb];
}
const SIDE_CACHE = new Map();
function sideMaterial(key, draw) {
  if (!SIDE_CACHE.has(key)) {
    const [map, emissiveMap] = canvasPair(1024, 160, draw);
    SIDE_CACHE.set(key, new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: '#ffd890', emissiveIntensity: 0, roughness: 0.45, metalness: 0.1, transparent: false }));
  }
  return SIDE_CACHE.get(key);
}
export function setNight(on) { for (const m of SIDE_CACHE.values()) m.emissiveIntensity = on ? 1.2 : 0; }

// ── train cars ──
function coachSide(kind, code, L) {
  return sideMaterial(`${kind}|${code}|${L}`, (g, e, w, h) => {
    const px = w / L; e.fillStyle = '#000'; e.fillRect(0, 0, w, h);
    const win = (x, y, ww, hh, col = '#1d2a34') => { g.fillStyle = col; g.fillRect(x, y, ww, hh); e.fillStyle = '#ffd890'; e.fillRect(x + 2, y + 2, ww - 4, hh - 4); };
    if (kind === 'vb') {
      g.fillStyle = '#f5f6f8'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f4fa3'; g.fillRect(0, 110, w, 22); g.fillStyle = '#20262d'; g.fillRect(0, 44, w, 40);
      e.fillStyle = '#ffd890'; e.fillRect(0, 48, w, 32);
      g.fillStyle = '#c9ced6'; for (const x of [1.2, L - 2.4]) g.fillRect(x * px, 30, 1.2 * px, 112);
      g.fillStyle = '#1f4fa3'; g.font = '700 30px Inter, Arial'; g.fillText(code, w * 0.45, 106);
    } else if (kind === 'lhb') {
      const ac = /^[ABHM]/.test(code);
      g.fillStyle = ac ? '#d9dee6' : '#c8cfd8'; g.fillRect(0, 0, w, h); g.fillStyle = '#b8322a'; g.fillRect(0, 34, w, 10); g.fillRect(0, 100, w, 8);
      g.fillStyle = '#5b6470'; g.fillRect(0, 130, w, 30);
      const n = ac ? 9 : 12; for (let k = 0; k < n; k++) { const x = (2.8 + k * ((L - 5.6) / n)) * px; if (ac) win(x, 52, 1.5 * px, 40); else { win(x, 52, 1.1 * px, 40); g.strokeStyle = '#888'; for (let b = 0; b < 4; b++) { g.beginPath(); g.moveTo(x, 58 + b * 9); g.lineTo(x + 1.1 * px, 58 + b * 9); g.stroke(); } } }
      g.fillStyle = '#9aa3ad'; for (const x of [0.5, L - 1.4]) g.fillRect(x * px, 40, 0.9 * px, 92);
      g.fillStyle = '#1b2a4a'; g.font = '700 26px Inter, Arial'; g.fillText(code, w * 0.47, 124);
    } else if (kind === 'emu') {
      g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#6a2c70'; g.fillRect(0, 102, w, 16); g.fillStyle = '#f2c230'; g.fillRect(0, 118, w, 6);
      for (const dx of [0.18, 0.5, 0.82]) { g.fillStyle = '#1c1c1c'; g.fillRect(dx * w - 0.65 * px, 28, 1.3 * px, 120); e.fillStyle = '#ffd890'; e.fillRect(dx * w - 0.65 * px + 3, 32, 1.3 * px - 6, 60); }
      for (let k = 0; k < 8; k++) { const x = (1.6 + k * 2.3) * px; if ([0.18, 0.5, 0.82].some((dx) => Math.abs(x - dx * w) < 1.3 * px)) continue; win(x, 46, 1.3 * px, 40); }
      g.fillStyle = '#6a2c70'; g.font = '700 22px Inter, Arial'; g.fillText(code, 20, 140);
    } else if (kind === 'loco') {
      const [base, band] = code === 'wag9' ? ['#2f4f7f', '#f2c230'] : ['#c8202a', '#f4f4ee'];
      g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = band; g.fillRect(0, 96, w, 14);
      win(0.6 * px, 30, 1.6 * px, 40); win(w - 2.2 * px, 30, 1.6 * px, 40);
      g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 6; k++) g.fillRect((4 + k * 2.2) * px, 34, 1.6 * px, 46);
      g.fillStyle = '#fff'; g.font = '700 28px Inter, Arial'; g.fillText(code === 'wag9' ? 'WAG-9 · 31xxx' : 'WAP-7 · 30xxx', w * 0.36, 146);
    } else {   // BCN wagon
      g.fillStyle = '#7a3b22'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; for (let x = 0; x < w; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.fillStyle = '#5d2c19'; g.fillRect(w * 0.42, 20, w * 0.16, 130); g.fillStyle = '#f2f2ee'; g.font = '700 24px Inter, Arial'; g.fillText('BCN', 30, 40);
    }
  });
}
function bogies(grp, L, gauge = 1.676) {
  const fm = mat('#222428', { metalness: 0.5 }), wm = mat('#3a3a3a', { metalness: 0.7, roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const bx = sx * (L / 2 - 3.2);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3, 0.45, 2.4), fm); frame.position.set(bx, 0.62, 0); grp.add(frame);
    for (const ax of [-0.95, 0.95]) for (const side of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.12, 16), wm); w.rotation.x = Math.PI / 2; w.position.set(bx + ax, 0.46, side * gauge / 2); grp.add(w); }
  }
  const uf = new THREE.Mesh(new THREE.BoxGeometry(L - 1, 0.55, 2.6), fm); uf.position.y = 1.05; grp.add(uf);
}
function boxCar(kind, code, L, W = 3.2, H0 = 1.25, H1 = 4.05, roofCol = '#8f969e') {
  const grp = new THREE.Group();
  const side = coachSide(kind, code, L), plain = mat(roofCol, { roughness: 0.5, metalness: 0.2 });
  const endM = kind === 'lhb' || kind === 'emu' || kind === 'vb' ? mat('#9aa3ad') : side;
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, H1 - H0 - 0.35, W), [endM, endM, plain, plain, side, side]); body.position.y = (H0 + H1 - 0.35) / 2; grp.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(W / 2, W / 2, L, 24, 1, false, 0, Math.PI), plain); roof.rotation.z = Math.PI / 2; roof.scale.set(0.22, 1, 1); roof.position.y = H1 - 0.35; grp.add(roof);
  bogies(grp, L);
  return grp;
}
function pantograph(grp, x, roofY) {
  const pm = mat('#2b2b2b', { metalness: 0.6 }), top = 5.9 - RAIL_TOP - roofY;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 1.4), pm); base.position.set(x, roofY + 0.1, 0); grp.add(base);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1), pm), upper = lower.clone();
  const l1 = Math.hypot(1.0, top * 0.5);
  lower.geometry = new THREE.BoxGeometry(l1, 0.07, 0.07); lower.position.set(x - 0.5, roofY + 0.2 + top * 0.25, 0); lower.rotation.z = Math.atan2(top * 0.5, 1.0); grp.add(lower);
  upper.geometry = new THREE.BoxGeometry(l1, 0.06, 0.06); upper.position.set(x - 0.5, roofY + 0.2 + top * 0.75, 0); upper.rotation.z = -Math.atan2(top * 0.5, 1.0); grp.add(upper);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 1.9), mat('#c9ced6', { metalness: 0.8 })); head.position.set(x, roofY + top + 0.15, 0); grp.add(head);
}
function headlight(grp, x, y) {
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff6d8', emissiveIntensity: 2 })); lamp.position.set(x, y, 0); lamp.rotation.y = Math.PI / 2; grp.add(lamp);
  const spot = new THREE.SpotLight('#fff3d0', 0, 260, 0.32, 0.5, 1.2); spot.position.set(x, y, 0); const tgt = new THREE.Object3D(); tgt.position.set(x + 50, -1, 0); grp.add(spot, tgt); spot.target = tgt;
  grp.userData.lights = (grp.userData.lights || []).concat(spot);
}
function loco(code) {
  const L = 20.5, grp = boxCar('loco', code, L, 3.1, 1.25, 4.25, '#6e7780');
  for (const sx of [-1, 1]) {   // cab ends with windscreens
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 2.6), new THREE.MeshStandardMaterial({ map: locoFace(code), roughness: 0.4 }));
    face.position.set(sx * (L / 2 + 0.01), 2.6, 0); face.rotation.y = sx * Math.PI / 2; grp.add(face);
  }
  for (const x of [-3, 3]) { const box = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1.6), mat('#4b535b', { metalness: 0.5 })); box.position.set(x, 4.25, 0); grp.add(box); }
  pantograph(grp, 6.5, 4.05);
  headlight(grp, L / 2 + 0.05, 3.7);
  return { mesh: grp, L };
}
let FACES = {};
function locoFace(code) {
  if (FACES[code]) return FACES[code];
  const c = document.createElement('canvas'); c.width = 256; c.height = 220; const g = c.getContext('2d');
  g.fillStyle = code === 'wag9' ? '#2f4f7f' : '#c8202a'; g.fillRect(0, 0, 256, 220);
  g.fillStyle = '#1b2530'; g.fillRect(24, 26, 96, 70); g.fillRect(136, 26, 96, 70);
  g.fillStyle = code === 'wag9' ? '#f2c230' : '#f4f4ee'; g.fillRect(0, 120, 256, 22);
  g.fillStyle = '#fff6d8'; for (const x of [40, 216]) { g.beginPath(); g.arc(x, 170, 12, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (FACES[code] = t);
}
function vbCar(code, cab) {
  const L = cab ? 25 : 24;
  if (!cab) { const g = boxCar('vb', code, L, 3.25, 1.2, 4.05, '#e8ebef'); if (code === 'C2' || code === 'C5') pantograph(g, 4, 3.95); return { mesh: g, L }; }
  // driving car: aerodynamic nose from an extruded side profile
  const grp = new THREE.Group();
  const shape = new THREE.Shape(); const H0 = 1.2, H1 = 4.05, N = 5.8;
  shape.moveTo(-L / 2, H0); shape.lineTo(L / 2 - N, H0); shape.lineTo(L / 2 - 0.2, H0 + 0.1); shape.quadraticCurveTo(L / 2 + 0.25, H0 + 0.55, L / 2 - 0.4, 1.95);
  shape.quadraticCurveTo(L / 2 - 2.2, H1 - 0.2, L / 2 - N, H1); shape.lineTo(-L / 2, H1); shape.lineTo(-L / 2, H0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.75, bevelEnabled: true, bevelThickness: 0.24, bevelSize: 0.24, bevelSegments: 4, curveSegments: 14 });
  geo.translate(0, 0, -1.375);
  const body = new THREE.Mesh(geo, mat('#f5f6f8', { roughness: 0.3, metalness: 0.15 })); grp.add(body);
  const side = coachSide('vb', code, L - N);
  for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(L - N, H1 - H0 - 0.2), side); p.position.set(-N / 2, (H0 + H1) / 2 - 0.05, sz * 1.62); if (sz < 0) p.rotation.y = Math.PI; grp.add(p); }
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.3), new THREE.MeshStandardMaterial({ color: '#11181f', roughness: 0.1, metalness: 0.6 })); shield.position.set(L / 2 - 2.05, 3.05, 0); shield.rotation.y = Math.PI / 2; shield.rotation.x = 0; shield.rotation.z = 0; shield.rotateOnAxis(new THREE.Vector3(0, 0, 1), -0.95); grp.add(shield);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(N - 0.6, 0.25, 3.3), mat('#1f4fa3')); stripe.position.set(L / 2 - N / 2 - 0.3, 1.55, 0); grp.add(stripe);
  bogies(grp, L);
  headlight(grp, L / 2 + 0.1, 1.75);
  return { mesh: grp, L };
}
function emuCar(code, cab) {
  const L = 20.6, g = boxCar('emu', code, L, 3.66, 1.2, 4.0, '#d0d4d8');
  if (cab) { const face = new THREE.Mesh(new THREE.PlaneGeometry(3.66, 2.8), new THREE.MeshStandardMaterial({ map: emuFace(), roughness: 0.4 })); face.position.set(L / 2 + 0.01, 2.5, 0); face.rotation.y = Math.PI / 2; g.add(face); headlight(g, L / 2 + 0.05, 3.6); }
  if (code === 'M2' || code === 'M5' || code === 'M8' || code === 'M11') pantograph(g, 3, 3.9);
  // door-standers
  const people = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.9, 3, 6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 12); const d = new THREE.Object3D(); let n = 0;
  const cols = ['#c0392b', '#2f6fd6', '#f2c230', '#ecf0f1', '#27ae60', '#e67e22'];
  for (const dx of [0.18, 0.5, 0.82]) for (const sz of [-1, 1]) if (Math.random() < 0.8) { d.position.set((dx - 0.5) * L + (Math.random() - 0.5) * 0.6, 2.2, sz * 1.8); d.rotation.z = sz * 0.1; d.updateMatrix(); people.setMatrixAt(n, d.matrix); people.setColorAt(n, new THREE.Color(cols[n % cols.length])); n++; }
  people.count = n; g.add(people);
  return { mesh: g, L };
}
let EMUF = null;
function emuFace() { if (EMUF) return EMUF; const c = document.createElement('canvas'); c.width = 256; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, 256, 200); g.fillStyle = '#1b2530'; g.fillRect(20, 30, 216, 70); g.fillStyle = '#111'; g.fillRect(70, 4, 116, 22); g.fillStyle = '#ff9f1a'; g.font = '700 16px Inter, Arial'; g.textAlign = 'center'; g.fillText('PUNE  SLOW', 128, 21); g.fillStyle = '#6a2c70'; g.fillRect(0, 130, 256, 22); g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(128, 172, 12, 0, 7); g.fill(); EMUF = new THREE.CanvasTexture(c); EMUF.colorSpace = THREE.SRGBColorSpace; return EMUF; }

export function buildTrain(type) {
  const cars = [];
  if (type === 'vb') { cars.push(vbCar('C1', true)); for (let i = 2; i <= 7; i++) cars.push(vbCar(`C${i}`, false)); const last = vbCar('C8', true); last.mesh.rotation.y = Math.PI; last.flip = true; cars.push(last); }
  else if (type === 'express') { cars.push(loco('wap7')); for (const code of ['EOG', 'GS', 'GS', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'B1', 'B2', 'B3', 'B4', 'A1', 'A2', 'H1', 'PC', 'EOG']) cars.push({ mesh: boxCar('lhb', code, 23.5), L: 23.5 }); }
  else if (type === 'local') { for (let i = 1; i <= 12; i++) { const c = emuCar(`M${i}`, i === 1 || i === 12); if (i === 12) { c.mesh.rotation.y = Math.PI; c.flip = true; } cars.push(c); } }
  else { cars.push(loco('wag9')); for (let i = 0; i < 30; i++) cars.push({ mesh: boxCar('bcn', 'BCN', 15.4, 3.15, 1.15, 3.9, '#5d2c19'), L: 15.4 }); }
  const group = new THREE.Group();
  for (const c of cars) { const holder = new THREE.Group(); holder.rotation.order = 'YZX'; holder.add(c.mesh); c.holder = holder; group.add(holder); c.mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
  const length = cars.reduce((s, c) => s + c.L + 0.9, 0);
  return { group, cars, length, type, lights: cars.flatMap((c) => c.mesh.userData.lights || []) };
}
/** Place a consist with its front at sFront on the track at lateral offset d. dir = +1 runs towards +s. */
export function placeTrain(R, T, sFront, d, dir = 1) {
  let off = 0;
  for (const c of T.cars) {
    const sc = sFront - dir * (off + c.L / 2);
    const a = offset(R, sc + dir * c.L * 0.36, d, RAIL_TOP), b = offset(R, sc - dir * c.L * 0.36, d, RAIL_TOP);
    const h = c.holder; h.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    const yaw = Math.atan2(a.z - b.z, a.x - b.x); h.rotation.y = -yaw; h.rotation.z = Math.atan2(a.y - b.y, Math.hypot(a.x - b.x, a.z - b.z));
    off += c.L + 0.9;
  }
}

// ── buses ──
const BUS_SIDE = new Map();
function busSide(type, L, Hh) {
  const B = BUSES[type];
  return sideMaterial(`bus|${type}`, (g, e, w, h) => {
    const px = w / L;
    g.fillStyle = B.body; g.fillRect(0, 0, w, h); e.fillStyle = '#000'; e.fillRect(0, 0, w, h);
    if (type === 'lalpari') { g.fillStyle = B.band; g.fillRect(0, 92, w, 12); g.fillRect(0, 138, w, 8); g.fillStyle = '#9a1820'; g.fillRect(0, 104, w, 34); }
    else if (type === 'hirkani') { g.fillStyle = B.band; g.fillRect(0, 0, w, 30); g.fillRect(0, 96, w, 10); }
    else { g.fillStyle = B.band; g.beginPath(); g.moveTo(0, 110); g.lineTo(w * 0.55, 92); g.lineTo(w, 70); g.lineTo(w, 96); g.lineTo(w * 0.55, 116); g.lineTo(0, 132); g.fill(); }
    const winTop = type === 'shivneri' ? 22 : 30, winH = type === 'lalpari' ? 52 : 58;
    if (type === 'lalpari' || type === 'hirkani') { for (let k = 0; k < 9; k++) { const x = (1.8 + k * 1.05) * px; g.fillStyle = B.glass; g.fillRect(x, winTop, 0.9 * px, winH); e.fillStyle = '#ffd890'; e.fillRect(x + 2, winTop + 2, 0.9 * px - 4, winH - 4); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, winTop + winH / 2, 0.9 * px, 2); } }
    else { g.fillStyle = B.glass; g.fillRect(1.7 * px, winTop, (L - 2.2) * px, winH); e.fillStyle = '#ffd890'; e.fillRect(1.8 * px, winTop + 3, (L - 2.4) * px, winH - 6); g.fillStyle = 'rgba(255,255,255,.12)'; for (let k = 1; k < 8; k++) g.fillRect((1.7 + k * (L - 2.2) / 8) * px, winTop, 3, winH); }
    g.fillStyle = '#20262c'; g.fillRect(0.4 * px, 26, 1.0 * px, 124);   // front door
    g.fillStyle = type === 'lalpari' ? '#fff' : B.band; g.font = '700 26px "Noto Sans Devanagari", Inter, Arial'; g.fillText(type === 'lalpari' ? 'महाराष्ट्र एस.टी.' : B.name.split(' — ')[0], w * 0.32, type === 'lalpari' ? 128 : 150);
    if (B.electric) { g.fillStyle = '#2f9e58'; g.font = '700 22px Inter, Arial'; g.fillText('⚡ ELECTRIC', w * 0.7, 150); }
  });
}
function busFront(type, dest) {
  const B = BUSES[type], c = document.createElement('canvas'); c.width = 256; c.height = 280; const g = c.getContext('2d');
  g.fillStyle = B.body; g.fillRect(0, 0, 256, 280);
  g.fillStyle = '#111'; g.fillRect(16, 10, 224, 42);
  g.fillStyle = B.board === 'led' ? '#ff9f1a' : '#f4f4ee'; g.font = '700 26px "Noto Sans Devanagari", Inter, Arial'; g.textAlign = 'center'; g.fillText(dest, 128, 41);
  g.fillStyle = '#1b2530'; g.fillRect(12, 60, 232, 110);
  g.fillStyle = B.band; g.fillRect(0, 190, 256, 16);
  g.fillStyle = '#fff6d8'; for (const x of [34, 222]) { g.beginPath(); g.arc(x, 235, 14, 0, 7); g.fill(); }
  g.fillStyle = '#ddd'; g.fillRect(90, 240, 76, 22); g.fillStyle = '#111'; g.font = '700 14px Inter, Arial'; g.fillText('MH 14 BT 2024', 128, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildBus(type, dest = 'पुणे · PUNE') {
  const B = BUSES[type], L = B.tall ? 13.5 : 12, W = 2.6, Hh = B.tall ? 3.55 : 3.2;
  const grp = new THREE.Group(), holder = new THREE.Group(); holder.add(grp);
  const shape = new THREE.Shape(); const r = 0.35; shape.moveTo(-L / 2 + r, 0.55); shape.lineTo(L / 2 - r, 0.55); shape.quadraticCurveTo(L / 2, 0.55, L / 2, 0.55 + r); shape.lineTo(L / 2, Hh - r); shape.quadraticCurveTo(L / 2, Hh, L / 2 - r * 1.6, Hh); shape.lineTo(-L / 2 + r, Hh); shape.quadraticCurveTo(-L / 2, Hh, -L / 2, Hh - r); shape.lineTo(-L / 2, 0.55 + r); shape.quadraticCurveTo(-L / 2, 0.55, -L / 2 + r, 0.55);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: W - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 }); geo.translate(0, 0, -(W - 0.1) / 2);
  grp.add(new THREE.Mesh(geo, mat(B.roof, { roughness: 0.45 })));
  const side = busSide(type, L, Hh);
  for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.5, Hh - 0.75), side); p.position.set(0, (Hh + 0.55) / 2 + 0.05, sz * (W / 2 + 0.01)); if (sz < 0) p.rotation.y = Math.PI; grp.add(p); }
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.15, Hh - 0.7), new THREE.MeshStandardMaterial({ map: busFront(type, dest), roughness: 0.4 })); front.position.set(L / 2 + 0.06, (Hh + 0.55) / 2 + 0.05, 0); front.rotation.y = Math.PI / 2; grp.add(front);
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.15, Hh - 0.7), mat(B.body)); rear.position.set(-L / 2 - 0.06, (Hh + 0.55) / 2, 0); rear.rotation.y = -Math.PI / 2; grp.add(rear);
  const wm = mat('#1a1a1a', { roughness: 0.8 }), hub = mat('#c9ced6', { metalness: 0.7 });
  for (const [x, dual] of [[L / 2 - 2.4, false], [-L / 2 + 3.2, true]].concat(B.tall ? [[-L / 2 + 4.6, true]] : [])) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, dual ? 0.55 : 0.3, 18), wm); w.rotation.x = Math.PI / 2; w.position.set(x, 0.5, sz * (W / 2 - (dual ? 0.3 : 0.18))); grp.add(w);
    const hcap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), hub); hcap.rotation.x = Math.PI / 2; hcap.position.set(x, 0.5, sz * (W / 2 + 0.02)); grp.add(hcap);
  }
  if (B.rack) {   // roof carrier with luggage
    const rack = new THREE.Mesh(new THREE.BoxGeometry(L * 0.55, 0.08, W - 0.3), mat('#5b5b5b', { metalness: 0.6 })); rack.position.set(-L * 0.1, Hh + 0.35, 0); grp.add(rack);
    const cols = ['#2f6fd6', '#e67e22', '#8e44ad', '#16a085', '#f2c230'];
    for (let k = 0; k < 5; k++) { const bag = new THREE.Mesh(new THREE.BoxGeometry(0.8 + Math.random() * 0.5, 0.5, 0.7 + Math.random() * 0.5), mat(cols[k])); bag.position.set(-L * 0.3 + k * 1.2, Hh + 0.62, (Math.random() - 0.5) * 0.9); grp.add(bag); }
  }
  if (!B.rack) { const ac = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 1.8), mat('#e3e6ea')); ac.position.set(-1, Hh + 0.17, 0); grp.add(ac); }
  for (const sz of [-1, 1]) { const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.25), mat('#111')); mirror.position.set(L / 2 + 0.3, Hh - 0.6, sz * (W / 2 + 0.25)); grp.add(mirror); }
  headlightBus(grp, L);
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: holder, body: grp, L, lights: grp.userData.lights || [] };
}
function headlightBus(grp, L) { const spot = new THREE.SpotLight('#fff3d0', 0, 120, 0.45, 0.5, 1.2); spot.position.set(L / 2 + 0.2, 1.1, 0); const t = new THREE.Object3D(); t.position.set(L / 2 + 30, -0.5, 0); grp.add(spot, t); spot.target = t; grp.userData.lights = [spot]; }
export function placeBus(R, B, s, d, roll = 0) {
  const a = offset(R, s + B.L * 0.3, d, 0), b = offset(R, s - B.L * 0.3, d, 0);
  const h = B.group; h.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  h.rotation.order = 'YZX'; h.rotation.y = -Math.atan2(a.z - b.z, a.x - b.x); h.rotation.z = Math.atan2(a.y - b.y, Math.hypot(a.x - b.x, a.z - b.z));
  B.body.rotation.x = roll;
}

// ── road traffic ──
export function buildTraffic(kind) {
  const g = new THREE.Group();
  if (kind === 'truck') {
    const cols = ['#e67e22', '#2f6fd6', '#c0392b', '#16a085', '#f2c230'], col = cols[Math.floor(Math.random() * cols.length)];
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.4, 2.4), mat(col)); cab.position.set(3.4, 1.7, 0); g.add(cab);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 2.45), mat(Math.random() < 0.5 ? '#c8a25a' : '#7a8a3a')); cargo.position.set(-0.6, 1.8, 0); g.add(cargo);
    const tarp = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.22, 6, 12, 1, false, 0, Math.PI), mat('#2e5f8a')); tarp.rotation.z = Math.PI / 2; tarp.position.set(-0.6, 2.9, 0); tarp.scale.set(0.5, 1, 1); g.add(tarp);
    for (const x of [3.2, -2.2, -3.2]) for (const z of [-1.05, 1.05]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 14), mat('#1a1a1a')); w.rotation.x = Math.PI / 2; w.position.set(x, 0.48, z); g.add(w); }
    g.userData.L = 8.5;
  } else if (kind === 'auto') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.35), mat('#1f6b2a')); body.position.y = 0.8; g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.35), mat('#f2c230')); top.position.set(-0.1, 1.75, 0); g.add(top);
    for (const [x, z] of [[1.1, 0], [-0.9, -0.6], [-0.9, 0.6]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12), mat('#111')); w.rotation.x = Math.PI / 2; w.position.set(x, 0.25, z); g.add(w); }
    g.userData.L = 2.7;
  } else {
    const cols = ['#f4f4f4', '#c9ced6', '#c0392b', '#2f6fd6', '#2b2b2b'], col = cols[Math.floor(Math.random() * cols.length)];
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 0.75, 1.7), mat(col, { metalness: 0.4, roughness: 0.35 })); body.position.y = 0.65; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 1.55), mat('#1b2530', { metalness: 0.5, roughness: 0.2 })); cabin.position.set(-0.2, 1.3, 0); g.add(cabin);
    for (const x of [1.3, -1.3]) for (const z of [-0.8, 0.8]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 12), mat('#111')); w.rotation.x = Math.PI / 2; w.position.set(x, 0.32, z); g.add(w); }
    g.userData.L = 4;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export { at };
