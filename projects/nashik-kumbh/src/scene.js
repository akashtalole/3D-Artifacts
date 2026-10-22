import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RIVER_PTS, KAPILA_PTS, RIVER_W, KAPILA_W, NODES, GHATS, HUBS, ghatPos, riverDist, SADHUGRAM, PROCESSION, rng } from './data.js';

const cache = new Map();
export function mat(color, o = {}) { const k = color + JSON.stringify(o); if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o })); return cache.get(k); }
function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };

export const PALETTE = ['#ff8f1f', '#ffb347', '#f4f1e8', '#f4f1e8', '#e8443a', '#ffd23f', '#e85d9a', '#3fa66b', '#4f7fd9', '#f06a2a', '#ffffff', '#c9302c', '#ffcf6b', '#8f5bd6'];

/** Ribbon along a list of [x,z] points at height y with the given width. */
function ribbon(pts, width, y, material, uvScale = 20) {
  const pos = [], uv = [], idx = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1, nx = -tz / L, nz = tx / L;
    if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const w = typeof width === 'function' ? width(i) : width;
    pos.push(pts[i][0] + nx * w / 2, y, pts[i][1] + nz * w / 2, pts[i][0] - nx * w / 2, y, pts[i][1] - nz * w / 2);
    uv.push(0, s / uvScale, 1, s / uvScale);
    if (i) { const o = (i - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.receiveShadow = true; return m;
}
function instanced(geo, material, list, shadow = true) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, list.length)); const o = new THREE.Object3D();
  list.forEach((t, i) => { o.position.set(t.x, t.y || 0, t.z); o.rotation.set(0, t.ry || 0, 0); o.scale.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (t.c) m.setColorAt(i, new THREE.Color(t.c)); });
  m.count = list.length; m.castShadow = shadow; m.receiveShadow = true; return m;
}

export class City {
  constructor(scene) {
    this.scene = scene; this.root = new THREE.Group(); scene.add(this.root);
    this.dyn = new THREE.Group(); scene.add(this.dyn);
    this.R = rng(5);
    this.ground(); this.water(); this.hills(); this.landmarks(); this.sadhugram();
    this.people = this.makePeople(70000); this.buses = this.makeBuses(1800); this.cars = this.makeCars(9000);
    this.diyas = this.makeDiyas(700); this.procession = this.makeProcession();
  }
  // ── static world ──
  ground() {
    const tex = canvasTex(2048, 2048, (g, w, h) => {
      g.fillStyle = '#8c9a5a'; g.fillRect(0, 0, w, h);
      const R = rng(3);
      for (let i = 0; i < 1600; i++) {   // farm plots: grapes, onion, sugarcane, fallow
        const x = R() * w, y = R() * h, s = 18 + R() * 46;
        g.fillStyle = ['#7f9548', '#a5a466', '#6f8a3e', '#b4a575', '#93a057', '#8a7d55'][Math.floor(R() * 6)];
        g.save(); g.translate(x, y); g.rotate(R() * 0.6 - 0.3); g.fillRect(-s / 2, -s / 2, s, s * (0.6 + R() * 0.8)); g.restore();
      }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 6);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.root.add(ground);
    // urban fabric: paved city areas under the buildings
    const urban = canvasTex(256, 256, (g) => { g.fillStyle = '#b9ae9c'; g.fillRect(0, 0, 256, 256); const R = rng(9); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${90 + R() * 60},${80 + R() * 50},${70 + R() * 40},.25)`; g.fillRect(R() * 256, R() * 256, 2 + R() * 6, 2 + R() * 6); } }, true);
    urban.repeat.set(60, 60);
    this.urbanMat = new THREE.MeshStandardMaterial({ map: urban, roughness: 1 });
    for (const z of URBAN) { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), this.urbanMat); m.rotation.x = -Math.PI / 2; m.scale.set(z.rx, z.rz, 1); m.position.set(z.x, 0.05, z.z); m.receiveShadow = true; this.root.add(m); }
  }
  water() {
    const pts = RIVER_PTS.map((p) => [p.x, p.z]);
    this.waterTex = canvasTex(256, 256, (g) => { g.fillStyle = '#7c8d78'; g.fillRect(0, 0, 256, 256); const R = rng(4); for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(255,255,255,${0.05 + R() * 0.1})`; g.lineWidth = 1 + R(); const x = R() * 256, y = R() * 256; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 3, x + 18, y); g.stroke(); } }, true);
    this.waterMat = new THREE.MeshStandardMaterial({ map: this.waterTex, color: '#6f8d86', roughness: 0.25, metalness: 0.15 });
    const bankMat = mat('#8b7a5c');
    this.root.add(ribbon(pts, RIVER_W + 26, 0.08, bankMat, 40));
    this.root.add(ribbon(pts, RIVER_W, 0.25, this.waterMat, 30));
    const kp = KAPILA_PTS.map((p) => [p.x, p.z]);
    this.root.add(ribbon(kp, KAPILA_W + 14, 0.08, bankMat, 40));
    this.root.add(ribbon(kp, KAPILA_W, 0.24, this.waterMat, 30));
  }
  hills() {
    const R = rng(8), list = [];
    for (const [x, z, r, h] of [[-3900, 3400, 900, 160], [-4800, 1800, 600, 90], [6200, -2600, 1100, 140], [-1500, -4600, 900, 110], [2800, -4400, 800, 100], [7200, 1000, 700, 80], [-5600, -3200, 1200, 220], [700, 6000, 1300, 150]]) list.push({ x, z, sx: r, sy: h, sz: r * (0.7 + R() * 0.5), ry: R() * 3 });
    const geo = new THREE.ConeGeometry(1, 1, 9, 3); geo.translate(0, 0.5, 0);
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.05 && y < 0.95) { p.setX(i, p.getX(i) * (0.85 + Math.random() * 0.3)); p.setZ(i, p.getZ(i) * (0.85 + Math.random() * 0.3)); } } geo.computeVertexNormals();
    this.root.add(instanced(geo, mat('#7d8550', { flatShading: true }), list, false));
  }
  /** City blocks, trees and roads (needs the network geometry from the sim). */
  build(sim) {
    if (this.net) { this.root.remove(this.net); this.net.traverse((o) => o.geometry?.dispose()); }
    this.net = new THREE.Group(); this.root.add(this.net);
    const segs = [];
    // bus roads
    const roadMat = mat('#4a4a4c', { roughness: 0.95 }), seen = new Set();
    for (const a in sim.roadAdj) for (const e of sim.roadAdj[a]) {
      const k = [a, e.to].sort().join('|'); if (seen.has(k)) continue; seen.add(k);
      const A = sim.roadPts[a], B = sim.roadPts[e.to];
      this.net.add(ribbon([A, B], 16, 0.12, roadMat, 30)); segs.push([A[0], A[1], B[0], B[1], 14]);
    }
    // pedestrian corridors
    this.linkMeshes = [];
    const pave = canvasTex(64, 64, (g) => { g.fillStyle = '#cfc6b4'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 64; i += 16) { g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); } }, true);
    for (const l of sim.links) {
      const A = sim.nodes[l.a], B = sim.nodes[l.b], w = Math.max(6, l.W * 0.5);
      const m = new THREE.MeshStandardMaterial({ map: pave, color: '#ffffff', roughness: 0.9 });
      const bridge = l.ex.bridge, y = bridge && l.ex.bridge !== 'kapila' ? 0.2 : 0.16;
      const mesh = ribbon([[A.x, A.z], [B.x, B.z]], w, y, m, 8);
      this.net.add(mesh); this.linkMeshes[l.id] = { mesh, m, w };
      segs.push([A.x, A.z, B.x, B.z, w]);
      if (bridge) this.bridge(l, A, B, w);
    }
    // ghats (rebuilt from the plan's frontage)
    this.ghatGroup = new THREE.Group(); this.net.add(this.ghatGroup);
    for (const id in sim.ghats) this.ghat(sim.ghats[id]);
    // hubs and stations
    for (const id in sim.hubs) this.hub(sim.hubs[id], sim);
    for (const tp of sim.tps) this.transfer(sim.nodes[tp], sim.P);
    this.services(sim);
    // buildings and trees, kept off the river, roads and corridors
    this.blocks(segs);
    this.sim = sim;
  }
  bridge(l, A, B, w) {
    const L = Math.hypot(B.x - A.x, B.z - A.z), mid = [(A.x + B.x) / 2, (A.z + B.z) / 2], ang = Math.atan2(B.z - A.z, B.x - A.x);
    const g = new THREE.Group(); g.position.set(mid[0], 0, mid[1]); g.rotation.y = -ang; this.net.add(g);
    const pontoon = l.ex.pontoon;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(L, pontoon ? 0.5 : 1.0, w + 1), mat(pontoon ? '#6b6f74' : '#a39886')); deck.position.y = pontoon ? 0.5 : 2.2; deck.castShadow = deck.receiveShadow = true; g.add(deck);
    for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 0.25), mat(pontoon ? '#d9d4c8' : '#8d8273')); rail.position.set(0, (pontoon ? 0.5 : 2.2) + 0.9, s * (w / 2 + 0.4)); g.add(rail); }
    if (pontoon) { for (let x = -L / 2 + 4; x < L / 2; x += 6) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, w, 10), mat('#2d4a7a', { metalness: 0.4 })); d.rotation.x = Math.PI / 2; d.position.set(x, 0.1, 0); g.add(d); } }
    else for (let x = -L / 2 + 15; x < L / 2 - 5; x += 22) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, w + 1), mat('#9a8c78')); p.position.set(x, 1.0, 0); g.add(p); }
    // ramps down to street level at each end
    deck.scale.y = 1;
  }
  ghat(g) {
    const p = ghatPos(g), F = g.F;
    // local z points from the water's edge to the land, local x runs along the river
    const lx0 = p.x - p.bx, lz0 = p.z - p.bz, LL = Math.hypot(lx0, lz0) || 1, lx = lx0 / LL, lz = lz0 / LL;
    const grp = new THREE.Group(); grp.position.set(p.bx, 0, p.bz); grp.rotation.y = Math.atan2(lx, lz); this.ghatGroup.add(grp);
    const sgn = 1;
    const stone = mat(g.sacred ? '#b7a68b' : '#c2b8a4', { roughness: 0.95 });
    for (let k = 0; k < 6; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(F, 0.45, 2.4), stone); st.position.set(0, 0.2 + k * 0.42, sgn * (1.2 + k * 2.2)); st.receiveShadow = true; grp.add(st); }
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(F + 20, 0.3, 22), mat('#d6cdb8')); plaza.position.set(0, 2.5, sgn * (14 + 11)); plaza.receiveShadow = true; grp.add(plaza);
    // shrines and chhatris along the ghat; Ramkund gets the most
    const n = Math.max(1, Math.floor(F / (g.sacred ? 35 : 70)));
    for (let i = 0; i < n; i++) {
      const x = -F / 2 + (i + 0.5) * F / n;
      const c = new THREE.Group(); c.position.set(x, 2.6, sgn * 16);
      for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 3, 8), stone); col.position.set(dx, 1.5, dz); c.add(col); }
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(g.sacred ? '#e9dcc0' : '#ddd3bd')); dome.position.y = 3; c.add(dome);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), mat('#ff7a00', { side: THREE.DoubleSide, emissive: '#a03c00', emissiveIntensity: 0.2 })); fl.position.set(0.6, 6.0, 0); c.add(fl);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 4), mat('#6b5030')); pole.position.y = 5.2; c.add(pole);
      grp.add(c);
    }
    if (g.id === 'G_RAM') {   // the kund itself: a stepped tank in the river bed
      const tank = new THREE.Mesh(new THREE.BoxGeometry(34, 0.6, 16), mat('#8d7f69')); tank.position.set(0, 0.0, -sgn * 6); grp.add(tank);
      const tw = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), this.waterMat); tw.rotation.x = -Math.PI / 2; tw.position.set(0, 0.32, -sgn * 6); grp.add(tw);
    }
    g.mesh = grp; g.frame = { x: p.bx, z: p.bz, ax: lz, az: -lx, lx, lz };
  }
  landmarks() {
    // Kalaram temple: black stone shikhara in a walled compound
    const K = NODES.J_KAL, kal = new THREE.Group(); kal.position.set(K.x + 40, 0, K.z - 30); this.root.add(kal);
    const black = mat('#2f2c2a', { roughness: 0.7 }), wall = mat('#3a3633');
    const base = new THREE.Mesh(new THREE.BoxGeometry(34, 2.4, 52), black); base.position.y = 1.2; kal.add(base);
    kal.add(this.shikhara(9, 26, black, 0, 2.4, -10));
    const mandapa = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 20), black); mandapa.position.set(0, 5.9, 12); kal.add(mandapa);
    const mroof = new THREE.Mesh(new THREE.ConeGeometry(10, 6, 4), black); mroof.rotation.y = Math.PI / 4; mroof.position.set(0, 12.4, 12); kal.add(mroof);
    for (const [w, d, x, z] of [[90, 2, 0, -46], [90, 2, 0, 46], [2, 92, -45, 0], [2, 92, 45, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), wall); m.position.set(x, 3, z); kal.add(m); }
    const gate = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 6), wall); gate.position.set(0, 6, 46); kal.add(gate);
    this.flag(kal, 0, 2.4 + 26 + 4, -10, 3);
    this.flag(kal, 0, 12, 46, 2);
    // Kapaleshwar (white) and Naroshankar near Ramkund
    const kap = new THREE.Group(); kap.position.set(60, 0, -205); this.root.add(kap);
    const white = mat('#ece6d8');
    const kb = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 22), white); kb.position.y = 2; kap.add(kb);
    kap.add(this.shikhara(5, 14, white, 0, 4, -4)); this.flag(kap, 0, 4 + 14 + 3, -4, 1.6);
    const nar = new THREE.Group(); nar.position.set(-90, 0, 70); this.root.add(nar);
    const nb = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 14), mat('#9f8d72')); nb.position.y = 1.5; nar.add(nb); nar.add(this.shikhara(4.5, 11, mat('#9f8d72'), 0, 3, 0));
    // Sita Gufa
    const sg = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 10), mat('#d9cfb6')); sg.position.set(420, 2.5, -600); this.root.add(sg);
    // ICCC (integrated command and control centre) near Dwarka
    this.iccc = new THREE.Group(); this.iccc.position.set(1450, 0, 1250); this.root.add(this.iccc);
    const ib = new THREE.Mesh(new THREE.BoxGeometry(40, 18, 28), mat('#d4dde4', { metalness: 0.3, roughness: 0.4 })); ib.position.y = 9; this.iccc.add(ib);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(40.2, 4, 28.2), mat('#2b6ea6', { emissive: '#1e5d99', emissiveIntensity: 0.5 })); glass.position.y = 12; this.iccc.add(glass);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 22, 6), mat('#999')); mast.position.set(12, 29, 0); this.iccc.add(mast);
  }
  shikhara(r, h, material, x, y, z) {
    const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(r * (1 - Math.pow(t, 1.6)) * (1 + 0.05 * Math.sin(t * 40)) + 0.3, t * h)); }
    const g = new THREE.LatheGeometry(pts, 8); const m = new THREE.Mesh(g, material); m.position.set(x, y, z); m.castShadow = true;
    const kalash = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 10, 8), mat('#d4a017', { metalness: 0.6, roughness: 0.3 })); kalash.position.y = h + r * 0.1; m.add(kalash);
    return m;
  }
  flag(parent, x, y, z, s = 1) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 3 * s, 5), mat('#5b4026')); pole.position.set(x, y + 1.5 * s, z); parent.add(pole);
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(2 * s, 0.45 * s); shape.lineTo(0, 0.9 * s);
    const f = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat('#ff7400', { side: THREE.DoubleSide, emissive: '#b04000', emissiveIntensity: 0.25 })); f.position.set(x, y + 2.1 * s, z); parent.add(f);
    (this.flags ||= []).push(f);
  }
  sadhugram() {
    const S = SADHUGRAM, R = rng(12), tents = [], big = [];
    for (let x = S.x0; x < S.x1; x += 22) for (let z = S.z0; z < S.z1; z += 22) {
      const jx = x + (R() - 0.5) * 6, jz = z + (R() - 0.5) * 6;
      if (Math.abs(jx - 2650) < 40 || Math.abs(jz + 1050) < 30) continue;   // camp avenues
      if (riverDist(jx, jz) < 30) continue;
      if (segDist(jx, jz, NODES.J_TAP.x, NODES.J_TAP.z, NODES.TP_T.x, NODES.TP_T.z) < 30) continue;
      if (R() < 0.12) continue;
      tents.push({ x: jx, z: jz, ry: R() * 0.2, sx: 6 + R() * 4, sy: 3.5 + R(), sz: 8 + R() * 6, c: R() < 0.55 ? '#f3efe4' : R() < 0.7 ? '#f29a3a' : '#e8d6a8' });
    }
    const tg = new THREE.BoxGeometry(1, 1, 1); tg.translate(0, 0.5, 0);
    const roof = new THREE.ConeGeometry(0.75, 0.7, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 1.32, 0); roof.scale(1, 1, 1);
    const geo = mergeGeometries([tg, roof]);
    this.root.add(instanced(geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), tents));
    // akhara gates with tall dharma dhwaja flags
    for (const [i, [x, z]] of [[2300, -1400], [2650, -760], [3100, -1300]].entries()) {
      const ak = new THREE.Group(); ak.position.set(x, 0, z); this.root.add(ak);
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.5, 12, 2.5), mat('#f08a24')); p.position.set(s * 9, 6, 0); ak.add(p); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(22, 3, 3), mat('#c85a12')); top.position.y = 12.5; ak.add(top);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 34, 6), mat('#e7e0d0')); pole.position.set(0, 17, -30); ak.add(pole);
      this.flag(ak, 0, 31, -30, 4.5);
      big.push(i);
    }
  }
  /** Parking hub: a gravel field (vehicles drawn dynamically) or a railway station. */
  hub(h) {
    if (h.rail) {
      const g = new THREE.Group(); g.position.set(h.x, 0, h.z); this.net.add(g);
      const b = new THREE.Mesh(new THREE.BoxGeometry(140, 12, 26), mat('#e5d3b0')); b.position.set(0, 6, -40); b.castShadow = true; g.add(b);
      const r = new THREE.Mesh(new THREE.BoxGeometry(150, 2, 30), mat('#a33c2c')); r.position.set(0, 13, -40); g.add(r);
      for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(420, 1.0, 9), mat('#b9b2a5')); p.position.set(0, 0.5, -5 + k * 16); g.add(p); }
      for (let k = 0; k < 2; k++) for (let c = 0; c < 14; c++) { const car = new THREE.Mesh(new THREE.BoxGeometry(23, 3.8, 3.2), mat(k ? '#2f5d9a' : '#8a2b2b')); car.position.set(-170 + c * 24, 2.4, 3 + k * 16); car.castShadow = true; g.add(car); }
      return;
    }
    const f = new THREE.Mesh(new THREE.PlaneGeometry(420, 300), mat('#a99a7e')); f.rotation.x = -Math.PI / 2; f.position.set(h.x, 0.1, h.z); f.receiveShadow = true; this.net.add(f);
    h.field = { x: h.x, z: h.z, w: 400, d: 280 };
  }
  transfer(n, P) {
    const g = new THREE.Group(); g.position.set(n.x, 0, n.z); this.net.add(g);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(Math.sqrt(n.area / Math.PI), 40), mat('#d8cfbd')); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.11; pad.receiveShadow = true; g.add(pad);
    // bus bays and shelters (more pandals when holding areas are built)
    const shel = [], R = rng(n.x | 0), rad = Math.sqrt(n.area / Math.PI) * 0.85;
    const k = P.holding ? 26 : 8;
    for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2, r = rad * (0.55 + R() * 0.35); shel.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ry: -a, sx: 26, sy: 5, sz: 12, c: i % 3 ? '#f4f0e6' : '#f39c37' }); }
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    g.add(instanced(geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), shel));
  }
  services(sim) {
    const P = sim.P, R = rng(21), toilets = [], med = [];
    const spots = [...sim.tps.map((k) => sim.nodes[k]), ...Object.values(sim.ghats).map((g) => sim.nodes[g.id])];
    const nT = Math.min(260, Math.round(P.toilets / 120)), nM = Math.min(90, Math.round(P.medical / 2));
    for (let i = 0; i < nT; i++) { const s = spots[i % spots.length], a = R() * 6.28, r = 60 + R() * 90; toilets.push({ x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r, ry: a, sx: 12, sy: 2.6, sz: 2.4, c: '#2f6db5' }); }
    for (let i = 0; i < nM; i++) { const s = spots[(i * 3) % spots.length], a = R() * 6.28, r = 40 + R() * 60; med.push({ x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r, ry: a, sx: 6, sy: 3, sz: 6, c: '#ffffff' }); }
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    this.net.add(instanced(geo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), toilets));
    const mt = instanced(geo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), med); this.net.add(mt);
    const cross = canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#d42a2a'; g.fillRect(24, 8, 16, 48); g.fillRect(8, 24, 48, 16); });
    const crossList = med.map((m) => ({ x: m.x, y: 3.05, z: m.z, ry: m.ry, sx: 5, sy: 1, sz: 5 }));
    const cg = new THREE.PlaneGeometry(1, 1); cg.rotateX(-Math.PI / 2);
    this.net.add(instanced(cg, new THREE.MeshStandardMaterial({ map: cross }), crossList, false));
    this.iccc.visible = !!P.iccc;
  }
  blocks(segs) {
    const R = rng(31), list = [], trees = [];
    const ok = (x, z, pad) => {
      if (riverDist(x, z) < 34 + pad) return false;
      if (x > SADHUGRAM.x0 - 40 && x < SADHUGRAM.x1 + 40 && z > SADHUGRAM.z0 - 40 && z < SADHUGRAM.z1 + 40) return false;
      for (const [ax, az, bx, bz, w] of segs) if (segDist(x, z, ax, az, bx, bz) < w / 2 + 8 + pad) return false;
      for (const id in NODES) { const n = NODES[id]; if (Math.hypot(n.x - x, n.z - z) < (n.kind === 'tp' ? Math.sqrt(n.area / Math.PI) * 1.6 + 30 : n.kind === 'ghat' ? 90 : 40)) return false; }
      for (const id in HUBS) { const h = HUBS[id]; if (Math.abs(h.x - x) < 260 && Math.abs(h.z - z) < 200) return false; }
      if (Math.hypot(x - 1450, z - 1250) < 60 || Math.hypot(x - NODES.J_KAL.x - 40, z - NODES.J_KAL.z + 30) < 70) return false;
      return true;
    };
    for (const zn of URBAN) {
      const n = Math.round(zn.rx * zn.rz * zn.dens / 900);
      for (let i = 0; i < n; i++) {
        const a = R() * Math.PI * 2, r = Math.sqrt(R()), x = zn.x + Math.cos(a) * r * zn.rx, z = zn.z + Math.sin(a) * r * zn.rz;
        const w = zn.small ? 8 + R() * 8 : 12 + R() * 16, d = zn.small ? 8 + R() * 8 : 12 + R() * 14;
        if (!ok(x, z, w * 0.5)) continue;
        const h = zn.small ? 5 + R() * 9 : 7 + Math.pow(R(), 2) * zn.tall;
        list.push({ x, z, sx: w, sy: h, sz: d, ry: zn.ry + (R() < 0.8 ? 0 : R()), c: BUILD[Math.floor(R() * BUILD.length)] });
      }
    }
    for (let i = 0; i < 2600; i++) {   // trees: along the river and scattered in the fields
      const p = RIVER_PTS[Math.floor(R() * RIVER_PTS.length)], side = R() < 0.5 ? -1 : 1, off = RIVER_W / 2 + 18 + R() * 120;
      let x, z; if (i < 1200) { x = p.x + p.nx * off * side; z = p.z + p.nz * off * side; } else { x = (R() - 0.5) * 16000; z = (R() - 0.5) * 13000; }
      if (!ok(x, z, 3)) continue; trees.push({ x, z, s: 5 + R() * 6, c: ['#3f6b2f', '#4c7a35', '#5b8a3a', '#355d28'][Math.floor(R() * 4)] });
    }
    const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, 0.5, 0);
    const winTex = canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#9aa3a8'; for (let y = 8; y < 64; y += 16) for (let x = 6; x < 64; x += 14) g.fillRect(x, y, 7, 7); }, true);
    const emi = canvasTex(64, 64, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64); const R2 = rng(2); for (let y = 8; y < 64; y += 16) for (let x = 6; x < 64; x += 14) if (R2() < 0.55) { g.fillStyle = R2() < 0.5 ? '#ffd38a' : '#fff1c9'; g.fillRect(x, y, 7, 7); } }, true);
    this.buildMat = new THREE.MeshStandardMaterial({ map: winTex, emissiveMap: emi, emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.9 });
    this.roofMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
    const bm = instanced(bg, [this.buildMat, this.buildMat, this.roofMat, this.roofMat, this.buildMat, this.buildMat], list); this.net.add(bm);
    const trunk = new THREE.CylinderGeometry(0.25, 0.35, 3, 5); trunk.translate(0, 1.5, 0);
    const crown = new THREE.IcosahedronGeometry(2.4, 0); crown.translate(0, 4.6, 0);
    const tg = mergeGeometries([trunk.toNonIndexed(), crown.toNonIndexed()]);
    this.net.add(instanced(tg, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), trees.map((t) => ({ x: t.x, z: t.z, sx: t.s / 4, sy: t.s / 4, sz: t.s / 4, c: t.c }))));
    this.nBuildings = list.length;
  }
  // ── dynamic: people, buses, cars, diyas, procession ──
  makePeople(n) {
    const body = new THREE.CylinderGeometry(0.22, 0.3, 1.25, 6); body.translate(0, 0.62, 0);
    const head = new THREE.SphereGeometry(0.15, 6, 4); head.translate(0, 1.42, 0);
    const geo = mergeGeometries([body.toNonIndexed(), head.toNonIndexed()]);
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
    const c = new THREE.Color(); for (let i = 0; i < n; i++) { c.set(PALETTE[(i * 7919) % PALETTE.length]); m.setColorAt(i, c); }
    m.count = 0; m.frustumCulled = false; m.castShadow = false; this.dyn.add(m); return m;
  }
  makeBuses(n) {
    const geo = new THREE.BoxGeometry(12, 3.2, 2.6); geo.translate(0, 1.9, 0);
    const tex = canvasTex(128, 32, (g) => { g.fillStyle = '#f5f7f4'; g.fillRect(0, 0, 128, 32); g.fillStyle = '#1f2b33'; g.fillRect(8, 6, 112, 11); g.fillStyle = '#2f9e58'; g.fillRect(0, 22, 128, 5); });
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), n); m.count = 0; m.frustumCulled = false; this.dyn.add(m); return m;
  }
  makeCars(n) {
    const geo = new THREE.BoxGeometry(4.2, 1.5, 1.8); geo.translate(0, 0.75, 0);
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }), n);
    const c = new THREE.Color(), cols = ['#d8d8d8', '#f4f4f4', '#2b2b2b', '#a81f1f', '#30559c', '#8a8a8a', '#c9a227', '#f4f4f4'];
    for (let i = 0; i < n; i++) { c.set(cols[(i * 31) % cols.length]); m.setColorAt(i, c); }
    m.count = 0; m.frustumCulled = false; this.dyn.add(m); return m;
  }
  makeDiyas(n) {
    const geo = new THREE.SphereGeometry(0.35, 6, 4);
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff9a1f', emissiveIntensity: 3 }), n);
    m.count = 0; m.frustumCulled = false; this.dyn.add(m);
    const R = rng(77); this.diyaSeed = Array.from({ length: n }, () => ({ s: R(), off: (R() - 0.5) * RIVER_W * 0.8, t: R() }));
    return m;
  }
  makeProcession() {
    const g = new THREE.Group(); this.dyn.add(g);
    const raths = [];
    for (let i = 0; i < 9; i++) {   // decorated chariots and tractors carrying the mahants
      const r = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 3.4), mat(i % 3 === 0 ? '#c0392b' : i % 3 === 1 ? '#f39c12' : '#d4a017', { metalness: 0.3 })); b.position.y = 1.6; r.add(b);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 4), mat('#ffcf3f', { metalness: 0.5, roughness: 0.3 })); canopy.rotation.y = Math.PI / 4; canopy.position.y = 5.2; r.add(canopy);
      for (const [x, z] of [[-3.5, -1.5], [3.5, -1.5], [-3.5, 1.5], [3.5, 1.5]]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 5), mat('#ffd700')); col.position.set(x * 0.6, 3.5, z * 0.8); r.add(col); }
      this.flag(r, 0, 6.5, 0, 1.5);
      g.add(r); raths.push(r);
    }
    g.visible = false;
    return { g, raths };
  }
  /** Points along the procession route (Tapovan → Ramkund) for parameter u in 0..1. */
  procPath() {
    if (this._pp) return this._pp;
    const pts = [[(SADHUGRAM.x0 + SADHUGRAM.x1) / 2, -900], ...PROCESSION.nodes.map((k) => [NODES[k].x, NODES[k].z])];
    let L = 0; const seg = []; for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push({ a: pts[i], b: pts[i + 1], s: L, d }); L += d; }
    this._pp = { seg, L }; return this._pp;
  }
  procAt(s) { const P = this.procPath(); s = Math.max(0, Math.min(P.L, s)); for (const g of P.seg) if (s <= g.s + g.d) { const t = (s - g.s) / g.d; return { x: g.a[0] + (g.b[0] - g.a[0]) * t, z: g.a[1] + (g.b[1] - g.a[1]) * t, h: Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]) }; } const g = P.seg.at(-1); return { x: g.b[0], z: g.b[1], h: 0 }; }
}

const URBAN = [
  { x: -900, z: 700, rx: 1500, rz: 900, dens: 1.8, small: true, ry: 0.1, tall: 14 },      // old Nashik
  { x: 300, z: -1000, rx: 1100, rz: 850, dens: 1.4, small: true, ry: -0.2, tall: 12 },    // Panchavati
  { x: -2900, z: 900, rx: 1500, rz: 1300, dens: 0.9, ry: 0.3, tall: 40 },                // CIDCO / Satpur
  { x: -2400, z: -1700, rx: 1300, rz: 900, dens: 0.7, ry: -0.1, tall: 46 },              // Gangapur Road
  { x: 1400, z: 2200, rx: 1300, rz: 900, dens: 0.9, ry: 0.4, tall: 32 },                 // Dwarka / Mumbai Naka
  { x: 4300, z: 3300, rx: 1300, rz: 900, dens: 1.0, ry: 0.5, tall: 30 },                 // Nashik Road
  { x: 1200, z: -2600, rx: 900, rz: 700, dens: 0.6, ry: 0, tall: 20 },                   // Mhasrul
  { x: 4600, z: -300, rx: 900, rz: 700, dens: 0.5, ry: 0.2, tall: 18 },                  // Adgaon
];
const BUILD = ['#efe6d3', '#e8d9bd', '#f2efe8', '#e3c9a8', '#d7c4a3', '#f1e0c6', '#cfd6d8', '#e9d1b0', '#f4ead8', '#d9b99a'];
