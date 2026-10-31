/**
 * Data hall: 60 m × 44 m single-storey building.
 * White space in the middle holds 139 NVL72 racks in 8 rows (4 back-to-back pairs)
 * with in-row CDUs; galleries around it hold power, cooling, network and UPS rooms.
 */
import * as THREE from 'three';
import { mat, glow, box, cyl, canvasTex, flowTube, label } from './kit.js';
import { RACK, rackMaterials, detailedRack } from './rack.js';

export const HALL = { w: 60, d: 44, h: 9 };
const PITCH = 0.6;
export const PAIR_Z = [-7.5, -2.5, 2.5, 7.5];
const ROW_OFF = 0.6 + RACK.d / 2;                     // hot aisle 1.2 m between backs
export const DETAIL = { row: 7, slot: 9 };

const wallTex = canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = '#d9d4ca'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) { g.fillStyle = x % 64 ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.12)'; g.fillRect(x, 0, 2, h); }
  g.fillStyle = '#8a8f96'; g.fillRect(0, 0, w, 6);
});
wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;

function rowRacks(row) {
  const pair = row >> 1, a = row % 2 === 0;
  const z = PAIR_Z[pair] + (a ? -ROW_OFF : ROW_OFF);
  const n = row === 0 ? 13 : 18;
  const slots = [];
  for (let j = 0; j < n; j++) slots.push({ x: (-8.5 + j) * PITCH, z, rot: a ? Math.PI : 0, j });
  return slots;
}

/** Build a hall. open = interior modelled (cutaway hall). Returns handles. */
export function buildHall({ open = false, name = 'A' } = {}) {
  const g = new THREE.Group();
  const { w, d, h } = HALL;
  const wm = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 });
  const wallMat = (len) => { const m = wm.clone(); m.map = wallTex.clone(); m.map.needsUpdate = true; m.map.repeat.set(len / 16, 1); return m; };
  const walls = new THREE.Group(); g.add(walls);
  const t = 0.4;
  const W = (len, x, z, rot) => { const m = box(len, h, t, wallMat(len), x, h / 2, z, walls); m.rotation.y = rot; m.castShadow = m.receiveShadow = true; return m; };
  W(w, 0, -d / 2, 0); W(w, 0, d / 2, 0); W(d, -w / 2, 0, Math.PI / 2); W(d, w / 2, 0, Math.PI / 2);
  // night-time light band and signage
  const bandMat = glow('#ffe9c2', 0).clone();
  for (const [bw, bd, bx, bz] of [[w, 0.06, 0, -d / 2 - 0.23], [w, 0.06, 0, d / 2 + 0.23], [0.06, d, -w / 2 - 0.23, 0], [0.06, d, w / 2 + 0.23, 0]]) box(bw, 0.25, bd, bandMat, bx, h - 0.6, bz, g);
  const band = { material: bandMat };
  const roof = new THREE.Group(); g.add(roof);
  const rs = box(w, 0.5, d, mat('#9a9ea4', 0.8, 0.1), 0, h + 0.25, 0, roof); rs.castShadow = rs.receiveShadow = true;
  for (let i = 0; i < 6; i++) box(3, 1.4, 2, mat('#c4c7cc', 0.6, 0.4), -20 + i * 8, h + 1.2, -12, roof).castShadow = true;
  const sign = canvasTex(512, 128, (c, W2, H2) => { c.fillStyle = '#20252c'; c.fillRect(0, 0, W2, H2); c.fillStyle = '#e8edf4'; c.font = 'bold 64px Inter, sans-serif'; c.fillText(`HALL ${name}`, 28, 86); c.fillStyle = '#5ce1e6'; c.fillRect(380, 30, 100, 68); });
  box(8, 2, 0.1, new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: '#ffffff', emissiveIntensity: 0.3 }), -w / 2 + 8, h - 2.5, d / 2 + 0.25, g);
  const out = { group: g, roof, band, rows: [], rack: null };
  if (!open) return out;

  // ── Interior ──
  box(w - 0.8, 0.05, d - 0.8, mat('#b9bcc0', 0.35, 0.05), 0, 0.025, 0, g).receiveShadow = true;
  const part = mat('#e6e2da', 0.9);
  const glass = new THREE.MeshStandardMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false });
  const P = (x0, z0, x1, z1, m = part, hh = 6) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m2 = box(len, hh, 0.2, m, (x0 + x1) / 2, hh / 2, (z0 + z1) / 2, g); m2.rotation.y = -Math.atan2(z1 - z0, x1 - x0); m2.receiveShadow = true;
  };
  // white space -8.5..8.5 × -10.5..13.5 with glass walls
  P(-8.5, -10.5, 8.5, -10.5, glass); P(-8.5, 13.5, 8.5, 13.5, glass); P(-8.5, -10.5, -8.5, 13.5, glass); P(8.5, -10.5, 8.5, 13.5, glass);
  // gallery walls
  P(-29.8, -12, 29.8, -12); P(-29.8, 15.5, 29.8, 15.5); P(-10.5, -12, -10.5, 15.5); P(10.5, -12, 10.5, 15.5);

  // Racks (one InstancedMesh per row so rows can be hidden for the spine view)
  const geo = new THREE.BoxGeometry(RACK.w, RACK.h, RACK.d).translate(0, RACK.h / 2, 0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const allSlots = [];
  for (let r = 0; r < 8; r++) {
    const slots = rowRacks(r).filter((s) => !(r === DETAIL.row && s.j === DETAIL.slot));
    const im = new THREE.InstancedMesh(geo, rackMaterials(), slots.length);
    slots.forEach((s, i) => { q.setFromAxisAngle(up, s.rot); m4.compose(new THREE.Vector3(s.x, 0.05, s.z), q, one); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true;
    g.add(im); out.rows.push(im);
    allSlots.push(...rowRacks(r));
  }
  const det = rowRacks(DETAIL.row).find((s) => s.j === DETAIL.slot);
  const rack = detailedRack(['tray']);
  rack.group.position.set(det.x, 0.05, det.z);
  rack.group.rotation.y = det.rot;
  g.add(rack.group);
  out.rack = rack;
  out.rackLocal = new THREE.Vector3(det.x, 0.05, det.z);

  // In-row CDUs at both ends of each row
  const cduTex = canvasTex(64, 128, (c, W2, H2) => { c.fillStyle = '#e9ebee'; c.fillRect(0, 0, W2, H2); c.fillStyle = '#1c2330'; c.fillRect(10, 14, 44, 26); c.fillStyle = '#5ce1e6'; c.fillRect(14, 18, 36, 6); c.fillStyle = '#c4c8ce'; for (let y = 50; y < 120; y += 6) c.fillRect(8, y, 48, 3); });
  const cduMat = new THREE.MeshStandardMaterial({ map: cduTex, roughness: 0.5, metalness: 0.2 });
  for (let r = 0; r < 8; r++) {
    const s = rowRacks(r)[0];
    for (const sx of [-1, 1]) {
      const x = sx * (9 * PITCH + 0.45);
      const c = box(0.8, 2.2, RACK.d, [mat('#dfe2e6', 0.5), mat('#dfe2e6', 0.5), mat('#dfe2e6', 0.5), mat('#dfe2e6', 0.5), cduMat, cduMat], x, 1.15, s.z, g);
      c.rotation.y = s.rot; c.castShadow = true;
    }
  }
  // Overhead: secondary-loop pipes over each hot aisle, busways over each row, fibre trays over cold aisles
  const blue = mat('#2c6bff', 0.35, 0.3), red = mat('#ff4a3d', 0.35, 0.3), bus = mat('#c9c2a8', 0.45, 0.6), tray = mat('#f2c230', 0.5, 0.2);
  for (const zc of PAIR_Z) {
    for (const [dz, m, col, rev] of [[-0.18, blue, '#4d94ff', false], [0.18, red, '#ff6a4d', true]]) {
      const p = cyl(0.07, 13, m, 0, 2.75, zc + dz, g, 12); p.rotation.z = Math.PI / 2;
      const pts = [[-6.4, 2.75, zc + dz], [6.4, 2.75, zc + dz]];
      g.add(flowTube(rev ? pts.reverse() : pts, { radius: 0.035, color: col, dash: 1.2, kind: 'coolant', opacity: 0.8 }));
    }
    for (const dz of [-ROW_OFF, ROW_OFF]) {
      box(11, 0.14, 0.16, bus, 0, 3.05, zc + dz, g);
      for (let j = 0; j < 18; j++) box(0.12, 0.16, 0.14, mat('#3a3d42', 0.6, 0.3), (-8.5 + j) * PITCH, 2.9, zc + dz, g);
    }
  }
  for (const z of [-10, -5, 0, 5, 11]) { box(16.5, 0.08, 0.6, tray, 0, 3.4, z, g); }
  box(0.6, 0.08, 25, tray, -8, 3.4, 0.5, g);
  // hoses from overhead pipes down to each rack's rear manifolds (instanced)
  const hose = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6), blue, allSlots.length * 2);
  let k = 0;
  for (const s of allSlots) for (const sx of [-1, 1]) {
    const back = s.z + (s.rot ? 1 : -1) * (RACK.d / 2 - 0.06);
    m4.makeTranslation(s.x + sx * 0.25, 2.5, back); hose.setMatrixAt(k++, m4);
  }
  g.add(hose);
  // ceiling light strips (hung; roof is cut away in this hall)
  for (const z of [-10, -5, 0, 5, 10]) box(14, 0.06, 0.25, glow('#f4f7ff', 1.6), 0, 4.6, z, g);

  // ── Galleries ──
  // North: power room — transformers, LV switchgear, busway
  for (let i = 0; i < 6; i++) {
    const x = -24 + i * 9.6;
    const tr = box(2.4, 2.6, 1.8, mat('#7f868f', 0.5, 0.5), x, 1.3, -18, g); tr.castShadow = true;
    for (let f = 0; f < 8; f++) box(0.04, 2.2, 0.3, mat('#6c727a', 0.5, 0.5), x - 1 + f * 0.28, 1.2, -16.95, g);
  }
  const swg = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 2.2, 0.8).translate(0, 1.1, 0), mat('#c9ccd1', 0.5, 0.3), 120);
  k = 0;
  for (const z of [-14.5, -21]) for (let i = 0; i < 60; i++) { m4.makeTranslation(-28 + i * 0.95, 0.05, z); swg.setMatrixAt(k++, m4); }
  swg.castShadow = true; g.add(swg);
  // South: cooling room — pumps, plate heat exchangers, headers
  for (let i = 0; i < 8; i++) {
    const x = -22 + i * 6.2;
    box(1.2, 2.6, 2.4, mat('#3157a8', 0.45, 0.4), x, 1.3, 19.5, g).castShadow = true;            // plate heat exchanger
    cyl(0.45, 1.0, mat('#2e6fff', 0.4, 0.5), x + 2, 0.55, 18, g, 18);                             // pump
    box(0.8, 0.6, 0.6, mat('#5d646d', 0.5, 0.6), x + 2, 1.35, 18, g);                             // motor
  }
  for (const [z, m, col, rev] of [[16.8, blue, '#4d94ff', true], [21.6, red, '#ff6a4d', false]]) {
    const p = cyl(0.3, 56, m, 0, 3.6, z, g, 16); p.rotation.z = Math.PI / 2;
    const pts = [[-28, 3.6, z], [28, 3.6, z]];
    g.add(flowTube(rev ? pts.reverse() : pts, { radius: 0.12, color: col, dash: 4, kind: 'coolant', opacity: 0.7 }));
  }
  // West: scale-out network room — Quantum-X800 InfiniBand and Spectrum-X Ethernet switch racks
  const netTex = canvasTex(64, 240, (c, W2, H2) => { c.fillStyle = '#121418'; c.fillRect(0, 0, W2, H2); for (let y = 8; y < H2 - 8; y += 9) { c.fillStyle = '#2a2f36'; c.fillRect(4, y, 56, 7); c.fillStyle = Math.random() < 0.5 ? '#38d39f' : '#4d9dff'; for (let x = 8; x < 56; x += 6) if (Math.random() < 0.7) c.fillRect(x, y + 2, 2, 2); } });
  const netMat = new THREE.MeshStandardMaterial({ map: netTex, emissiveMap: netTex, emissive: '#ffffff', emissiveIntensity: 0.8, roughness: 0.5 });
  const nr = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 2.2, 1.2).translate(0, 1.1, 0), [mat('#16181c'), mat('#16181c'), mat('#16181c'), mat('#16181c'), netMat, netMat], 48);
  k = 0;
  for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) { m4.makeTranslation(-27 + r * 4, 0.05, -9 + i * 0.62 + (i >= 6 ? 8 : 0)); nr.setMatrixAt(k++, m4); }
  g.add(nr);
  // East: UPS and battery rooms
  const ups = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 2.0, 0.9).translate(0, 1.0, 0), mat('#4b5058', 0.5, 0.3), 96);
  k = 0;
  for (let r = 0; r < 4; r++) for (let i = 0; i < 24; i++) { m4.makeTranslation(13 + r * 4.4, 0.05, -10 + i * 1.0); ups.setMatrixAt(k++, m4); }
  g.add(ups);

  // Labels
  const L = (t, p, c) => label(t, g, new THREE.Vector3(...p), 'hall', c);
  L('<b>White space</b><span>139 × Vera Rubin NVL72 · 8 rows · ≈ 10,000 GPUs</span>', [0, 4.2, -2.5]);
  L('<b>In-row CDUs</b><span>coolant distribution, 2 per row</span>', [6.2, 2.6, 7.5], 'small');
  L('<b>Power room</b><span>33 kV → 415 V transformers · switchgear</span>', [0, 3.2, -18]);
  L('<b>Cooling room</b><span>pumps · plate heat exchangers</span>', [0, 4.4, 19]);
  L('<b>Scale-out network</b><span>Quantum-X800 InfiniBand · Spectrum-X Ethernet</span>', [-21, 3, 0]);
  L('<b>UPS &amp; batteries</b>', [19.5, 2.8, 2]);
  return out;
}
