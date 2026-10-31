/**
 * The vertical farm in 3D: an insulated room (14 × 20 m) with four 16 m racks of six NFT tiers
 * under LED bars, harvest lifts and a conveyor, a nutrient room, HVAC with ducted supply,
 * CO₂ cylinders, a germination shelf, a packing table and a camera robot.
 */
import * as THREE from 'three';
import { VF } from './data.js';
import { softDot } from './polyhouse.js';

export const RACKX = [-3.6, -1.2, 1.2, 3.6], Z0 = -9, TIERY = (k) => 0.42 + k * 0.4, AISLES = [-4.75, -2.4, 0, 2.4, 4.75];
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const mesh = (g, m, cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = true; return x; };
const boxM = (w, h, d, m) => mesh(new THREE.BoxGeometry(w, h, d), m);
const cylM = (r, h, m, seg = 16) => mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
const M = {
  wall: std('#e9edf0', { roughness: 0.8 }), floor: std('#5d7a70', { roughness: 0.55, metalness: 0.05 }), steel: std('#c3c9ce', { metalness: 0.6, roughness: 0.3 }),
  white: std('#f5f6f6', { roughness: 0.4 }), dark: std('#2c3238'), blue: std('#2f6fb3'), red: std('#c0392b'), green: std('#2f8f4e'), yellow: std('#e2b100'),
  ss: std('#cfd5da', { metalness: 0.8, roughness: 0.25 }), black: std('#1b1e22'), orange: std('#e8721a'), coat: std('#f4f6f8'), skin: std('#a97650'),
};
const RECIPE = { lettuce: '#ff9ae6', basil: '#ff63d2', spinach: '#ffd4f4' };

export function person(coat = M.coat) {
  const g = new THREE.Group();
  const legs = mesh(new THREE.CapsuleGeometry(0.15, 0.6, 4, 8), M.dark); legs.position.y = 0.45;
  const body = mesh(new THREE.CapsuleGeometry(0.2, 0.45, 4, 8), coat); body.position.y = 1.15;
  const head = mesh(new THREE.SphereGeometry(0.12, 12, 8), M.skin); head.position.y = 1.6;
  const cap = mesh(new THREE.SphereGeometry(0.13, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.white); cap.position.y = 1.63;
  g.add(legs, body, head, cap); return g;
}

export function buildVFarm(cropKey, crop) {
  const G = new THREE.Group(), U = {};
  const floor = mesh(new THREE.PlaneGeometry(14, 20), M.floor, false); floor.rotation.x = -Math.PI / 2; G.add(floor);
  const back = boxM(14, 4.5, 0.2, M.wall); back.position.set(0, 2.25, -10.1); G.add(back);
  const left = boxM(0.2, 4.5, 20.2, M.wall); left.position.set(-7.1, 2.25, 0); G.add(left);
  const kerbR = boxM(0.2, 0.5, 20.2, M.wall); kerbR.position.set(7.1, 0.25, 0); G.add(kerbR);
  const kerbF = boxM(14.4, 0.5, 0.2, M.wall); kerbF.position.set(0, 0.25, 10.1); G.add(kerbF);
  for (let i = 0; i < 6; i++) { const seam = boxM(0.02, 4.5, 0.02, std('#cfd6db')); seam.position.set(-6 + i * 2.4, 2.25, -9.99); G.add(seam); }
  const door = boxM(0.06, 2.3, 1.4, std('#9aa6b0')); door.position.set(-6.99, 1.15, 8); G.add(door);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), std('#3b4148', { roughness: 1 })); outside.rotation.x = -Math.PI / 2; outside.position.y = -0.03; outside.receiveShadow = true; G.add(outside);

  // racks
  const ups = []; for (const cx of RACKX) for (const s of [-1, 1]) for (let z = Z0; z <= Z0 + VF.len + 0.01; z += 2) ups.push([cx + s * 0.64, z]);
  const upIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 2.95, 0.05), M.steel, ups.length); const m4 = new THREE.Matrix4();
  ups.forEach(([x, z], i) => upIM.setMatrixAt(i, m4.makeTranslation(x, 1.475, z))); upIM.castShadow = true; G.add(upIM);
  const beams = [], chans = [];
  RACKX.forEach((cx) => { for (let k = 0; k < VF.tiers; k++) { for (const s of [-1, 1]) beams.push([cx + s * 0.64, TIERY(k) - 0.06]); for (let j = 0; j < VF.channels; j++) chans.push([cx - 0.5 + j * 0.2, TIERY(k)]); } for (const s of [-1, 1]) beams.push([cx + s * 0.64, 2.92]); });
  const bIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, VF.len), M.steel, beams.length);
  beams.forEach(([x, y], i) => bIM.setMatrixAt(i, m4.makeTranslation(x, y, Z0 + VF.len / 2))); G.add(bIM);
  const cIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.05, VF.len), M.white, chans.length); cIM.receiveShadow = true;
  chans.forEach(([x, y], i) => cIM.setMatrixAt(i, m4.makeTranslation(x, y - 0.025, Z0 + VF.len / 2))); G.add(cIM);
  // LEDs with a faint light volume under each bar
  U.leds = []; U.glow = [];
  RACKX.forEach((cx, r) => { for (let k = 0; k < VF.tiers; k++) {
    const y = k < VF.tiers - 1 ? TIERY(k + 1) - 0.1 : 2.86;
    const mat = new THREE.MeshStandardMaterial({ color: '#333', emissive: RECIPE[cropKey], emissiveIntensity: 1, roughness: 0.4 });
    for (const dx of [-0.38, 0, 0.38]) { const bar = mesh(new THREE.BoxGeometry(0.06, 0.025, VF.len - 0.2), mat, false); bar.position.set(cx + dx, y, Z0 + VF.len / 2); G.add(bar); }
    const gm = new THREE.MeshBasicMaterial({ color: RECIPE[cropKey], transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false });
    const vol = new THREE.Mesh(new THREE.BoxGeometry(1.2, y - TIERY(k) - 0.03, VF.len - 0.2), gm); vol.position.set(cx, (y + TIERY(k)) / 2, Z0 + VF.len / 2); G.add(vol);
    U.leds.push(mat); U.glow.push(gm);
  } });
  // heads
  const N = VF.racks * VF.tiers * VF.channels * VF.holes;
  const hg = new THREE.IcosahedronGeometry(1, 1), pa = hg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const n = 1 + 0.18 * Math.sin(pa.getX(i) * 9 + pa.getZ(i) * 7) * Math.cos(pa.getY(i) * 11); pa.setXYZ(i, pa.getX(i) * n, Math.max(-0.2, pa.getY(i)) * n, pa.getZ(i) * n); }
  const shape = { lettuce: [1, 0.6, 1], basil: [0.75, 1.35, 0.75], spinach: [1, 0.42, 1] }[cropKey];
  hg.scale(...shape); hg.translate(0, 0.2 * shape[1], 0); hg.computeVertexNormals();
  const heads = new THREE.InstancedMesh(hg, std('#ffffff', { roughness: 0.8, flatShading: true }), N); heads.castShadow = true;
  const rmax = { lettuce: 0.115, basil: 0.085, spinach: 0.085 }[cropKey];
  const slots = []; let n = 0;
  RACKX.forEach((cx, r) => { for (let k = 0; k < VF.tiers; k++) for (let j = 0; j < VF.channels; j++) for (let h = 0; h < VF.holes; h++) {
    slots.push({ x: cx - 0.5 + j * 0.2 + 0.02 * Math.sin(n * 3.1), y: TIERY(k) + 0.005, z: Z0 + 0.125 + h * 0.25 + 0.02 * Math.cos(n * 1.7), tier: r * VF.tiers + k, v: 0.8 + 0.4 * (Math.sin(n * 12.9898) * 0.5 + 0.5), a: n * 2.4 }); n++;
  } });
  const base = new THREE.Color(crop.colour);
  const c = new THREE.Color(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function setHeads(tiers) {
    slots.forEach((sl, i) => {
      const ti = tiers[sl.tier], r = Math.max(0.012, rmax * Math.sqrt(Math.min(1.1, ti.fw / crop.g))) * sl.v, wilt = 1 - 0.45 * (1 - ti.health);
      q.setFromAxisAngle(up, sl.a); heads.setMatrixAt(i, m4.compose(p.set(sl.x, sl.y, sl.z), q, s.set(r, r * wilt, r)));
      c.copy(base).offsetHSL(0, 0, (sl.v - 1) * 0.12).lerp(c2.set('#c4b450'), (1 - ti.health) * 0.8).lerp(c3.set('#6a4a22'), ti.tip * 0.75);
      heads.setColorAt(i, c);
    });
    heads.instanceMatrix.needsUpdate = true; heads.instanceColor.needsUpdate = true;
  }
  const c2 = new THREE.Color(), c3 = new THREE.Color();
  G.add(heads); U.setHeads = setHeads; U.slots = slots;

  // NFT supply and return at the rack ends
  RACKX.forEach((cx) => { const sp = cylM(0.03, 2.6, M.blue, 8); sp.position.set(cx - 0.5, 1.3, Z0 - 0.15); G.add(sp); const rt = cylM(0.045, 2.6, M.white, 8); rt.position.set(cx + 0.5, 1.3, Z0 + VF.len + 0.15); G.add(rt); });
  const man = cylM(0.05, 12, M.blue, 8); man.rotation.z = Math.PI / 2; man.position.set(-1, 0.12, Z0 - 0.4); G.add(man);

  // harvest lifts and conveyor
  U.lifts = RACKX.map((cx) => {
    const g = new THREE.Group(); g.position.set(cx, 0, Z0 + VF.len + 0.55);
    for (const s of [-1, 1]) { const post = boxM(0.08, 3.0, 0.08, M.yellow); post.position.set(s * 0.68, 1.5, 0); g.add(post); }
    const car = new THREE.Group(); const plat = boxM(1.3, 0.06, 0.7, M.dark); car.add(plat);
    const tray = boxM(1.1, 0.06, 0.55, M.white); tray.position.y = 0.07; tray.visible = false; car.add(tray);
    const crop2 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), std(crop.colour, { flatShading: true }), 12);
    for (let i = 0; i < 12; i++) crop2.setMatrixAt(i, m4.makeTranslation(-0.45 + (i % 6) * 0.18, 0.13, -0.12 + Math.floor(i / 6) * 0.24));
    crop2.visible = false; car.add(crop2); car.position.y = 0.8; g.add(car);
    G.add(g); return { g, car, tray, crop2, job: null };
  });
  const belt = boxM(11.5, 0.08, 0.6, M.black); belt.position.set(0.9, 0.78, Z0 + VF.len + 1.45); G.add(belt);
  const beltFrame = boxM(11.6, 0.6, 0.5, M.steel); beltFrame.position.set(0.9, 0.42, Z0 + VF.len + 1.45); G.add(beltFrame);
  U.belt = []; for (let i = 0; i < 4; i++) { const t = boxM(0.5, 0.12, 0.4, std(crop.colour)); t.visible = false; t.position.set(0, 0.88, Z0 + VF.len + 1.45); G.add(t); U.belt.push({ m: t, x: 0, live: false }); }

  // nutrient room
  const nut = new THREE.Group(); nut.position.set(-6.1, 0, -6);
  for (const [z, m] of [[-2.6, M.blue], [-1.2, M.white]]) { const t = cylM(0.5, 1.4, m, 24); t.position.set(0, 0.7, z); nut.add(t); }
  const board = boxM(0.06, 1.3, 2.2, M.white); board.position.set(-0.8, 1.6, 0.6); nut.add(board);
  [['A', M.blue], ['B', M.blue], ['Acid', M.red], ['Base', M.yellow]].forEach(([, m], i) => { const t = cylM(0.12, 0.45, m, 12); t.position.set(-0.55, 0.25, -0.2 + i * 0.35); nut.add(t); const pp = boxM(0.12, 0.14, 0.14, M.dark); pp.position.set(-0.7, 1.4, -0.2 + i * 0.35); nut.add(pp); });
  const uv = cylM(0.09, 0.9, M.ss, 12); uv.rotation.z = Math.PI / 2; uv.position.set(0.1, 1.1, 1.6); nut.add(uv);
  const chil = boxM(0.8, 0.9, 0.7, std('#d8dde1')); chil.position.set(0.1, 0.45, 2.6); nut.add(chil);
  const ctl = boxM(0.08, 0.6, 0.45, M.white); ctl.position.set(-0.75, 1.5, 1.9); nut.add(ctl);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.25), new THREE.MeshBasicMaterial({ color: '#2ad18a' })); scr.rotation.y = Math.PI / 2; scr.position.set(-0.7, 1.55, 1.9); nut.add(scr);
  G.add(nut);
  for (let i = 0; i < 3; i++) { const cyl = cylM(0.12, 1.5, M.green, 12); cyl.position.set(-6.7, 0.75, 4 + i * 0.32); G.add(cyl); }
  // HVAC: air handler on the back wall, ducts above the aisles, diffusers
  const ahu = boxM(4.2, 1.3, 0.9, std('#cfd6db')); ahu.position.set(0, 3.55, -9.5); G.add(ahu);
  const grille = boxM(3.6, 0.8, 0.02, M.dark); grille.position.set(0, 3.55, -9.03); G.add(grille);
  const diffusers = [];
  for (const x of [-2.4, 0, 2.4]) {
    const d = cylM(0.28, 15.5, std('#d4d9dd', { metalness: 0.4 }), 16); d.rotation.x = Math.PI / 2; d.position.set(x, 3.95, -1.3); G.add(d);
    for (let z = -8; z <= 6; z += 2.8) { const df = cylM(0.18, 0.06, M.dark, 12); df.position.set(x, 3.65, z); G.add(df); diffusers.push(new THREE.Vector3(x, 3.6, z)); }
  }
  const dehum = boxM(0.7, 1.1, 0.6, std('#dfe4e8')); dehum.position.set(6.4, 0.55, -1); G.add(dehum);
  // airflow particles: down from diffusers and along each rack
  const AN = 900, apos = new Float32Array(AN * 3), aseed = new Float32Array(AN);
  for (let i = 0; i < AN; i++) aseed[i] = Math.random();
  const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(apos, 3));
  const amat = new THREE.PointsMaterial({ size: 0.12, map: softDot(), color: '#9fd8ff', transparent: true, opacity: 0.35, depthWrite: false });
  const air = new THREE.Points(ag, amat); air.frustumCulled = false; G.add(air);
  U.air = { air, amat, apos, aseed, diffusers, t: 0 };
  // germination shelf and packing
  const germ = new THREE.Group(); germ.position.set(6.1, 0, -6);
  for (let k = 0; k < 4; k++) { const sh = boxM(1.2, 0.04, 3.2, M.steel); sh.position.y = 0.4 + k * 0.5; germ.add(sh); const tr = boxM(1.0, 0.05, 3.0, std('#5f8f3a', { roughness: 0.9 })); tr.position.y = 0.45 + k * 0.5; germ.add(tr); const l = boxM(0.9, 0.02, 3.0, new THREE.MeshStandardMaterial({ emissive: '#ffb0ee', color: '#222' })); l.position.y = 0.86 + k * 0.5; germ.add(l); }
  for (const [x, z] of [[-0.6, -1.6], [0.6, -1.6], [-0.6, 1.6], [0.6, 1.6]]) { const p2 = boxM(0.04, 2.3, 0.04, M.steel); p2.position.set(x, 1.15, z); germ.add(p2); }
  G.add(germ);
  const table = boxM(1.3, 0.05, 3.5, M.ss); table.position.set(6.1, 0.9, 3.2); G.add(table);
  for (const [x, z] of [[5.55, 1.6], [6.65, 1.6], [5.55, 4.8], [6.65, 4.8]]) { const lg = boxM(0.05, 0.9, 0.05, M.ss); lg.position.set(x, 0.45, z); G.add(lg); }
  for (let i = 0; i < 4; i++) { const cr = boxM(0.5, 0.25, 0.35, M.orange); cr.position.set(6.1, 1.05, 2 + i * 0.6); G.add(cr); }
  const w1 = person(); w1.position.set(5.2, 0, 3.4); w1.rotation.y = Math.PI / 2; G.add(w1);
  const w2 = person(); w2.position.set(-5.2, 0, -5); w2.rotation.y = -Math.PI / 2; G.add(w2);
  // camera robot: AGV with a six-camera mast, one camera per tier
  const agv = new THREE.Group(); const ab = boxM(0.7, 0.25, 0.5, M.orange); ab.position.y = 0.17; agv.add(ab);
  const mast = boxM(0.06, 2.8, 0.06, M.steel); mast.position.y = 1.65; agv.add(mast);
  for (let k = 0; k < VF.tiers; k++) for (const sd of [-1, 1]) { const cam = boxM(0.12, 0.08, 0.1, M.dark); cam.position.set(sd * 0.1, TIERY(k) + 0.2, 0); agv.add(cam); }
  const bc = cylM(0.04, 0.06, new THREE.MeshBasicMaterial({ color: '#3fcf8e' })); bc.position.y = 3.1; agv.add(bc);
  const fovMat = new THREE.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
  for (const sd of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.5, 0.6), fovMat); f.position.set(sd * 0.55, 1.5, 0); agv.add(f); }
  G.add(agv); U.agv = agv;
  return { group: G, U };
}

/** Serpentine route for the camera robot along the aisles. */
export function agvRoute() {
  const pts = []; AISLES.forEach((x, i) => { const z0 = i % 2 ? 7.6 : -9.6; pts.push([x, z0], [x, i % 2 ? -9.6 : 7.6]); });
  const seg = []; let L = 0;
  for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], l = Math.hypot(x1 - x0, z1 - z0); seg.push({ x0, z0, x1, z1, l, L }); L += l; }
  // the robot drives back along the same route rather than jumping
  const at = (d) => { d = ((d % (2 * L)) + 2 * L) % (2 * L); const back = d > L; if (back) d = 2 * L - d; const s = seg.find((q) => d <= q.L + q.l) || seg[seg.length - 1], u = (d - s.L) / s.l; const dx = s.x1 - s.x0, dz = s.z1 - s.z0; return { x: s.x0 + dx * u, z: s.z0 + dz * u, h: Math.atan2(back ? -dx : dx, back ? -dz : dz) }; };
  return { at, L };
}

export function animateVF(U, a, s, crop, dt, f = {}, speed = 600) {
  const lit = a.light * a.dim;
  U.leds.forEach((m, i) => { const dark = f.led && i === 3 * VF.tiers + 2; const v = dark ? 0 : lit; m.emissiveIntensity = 0.05 + v * 1.4; m.color.set(v > 0.05 ? '#555' : '#2a2a2a'); });
  U.glow.forEach((m, i) => { const dark = f.led && i === 3 * VF.tiers + 2; m.opacity = dark ? 0 : lit * 0.08; });
  const A = U.air; A.t += dt;
  const flow = a.q > 1 ? 1 : 0.3; A.amat.opacity = 0.18 + 0.2 * flow;
  const n = A.apos.length / 3, half = n / 2;
  for (let i = 0; i < n; i++) {
    const sd = A.aseed[i], ph = (sd * 7.3 + A.t * (0.25 + 0.2 * flow)) % 1;
    if (i < half) { const d = A.diffusers[i % A.diffusers.length], ang = sd * 50; A.apos[i * 3] = d.x + Math.cos(ang) * ph * 1.4; A.apos[i * 3 + 1] = d.y - ph * 1.0; A.apos[i * 3 + 2] = d.z + Math.sin(ang) * ph * 1.4; }
    else { const r = i % 4, k = (i >> 2) % VF.tiers, still = f.airflow && r === 2; A.apos[i * 3] = RACKX[r] - 0.5 + ((sd * 13) % 1); A.apos[i * 3 + 1] = still ? -5 : TIERY(k) + 0.2 + 0.08 * Math.sin(sd * 40); A.apos[i * 3 + 2] = Z0 + ((ph + sd) % 1) * VF.len; }
  }
  A.air.geometry.attributes.position.needsUpdate = true;
  // lifts and the belt
  U.lifts.forEach((L) => {
    const j = L.job; if (!j) { L.car.position.y += (0.8 - L.car.position.y) * Math.min(1, dt * 2); return; }
    j.t += dt; const up = Math.min(1, j.t / 1.4), down = Math.max(0, Math.min(1, (j.t - 2.0) / 1.4));
    L.car.position.y = 0.8 + (j.y - 0.8) * (up - down); L.tray.visible = L.crop2.visible = j.t > 1.3;
    if (j.t > 3.5) { L.job = null; L.tray.visible = L.crop2.visible = false; const b = U.belt.find((q) => !q.live); if (b) { b.live = true; b.x = L.g.position.x; b.m.visible = true; } }
  });
  U.belt.forEach((b) => { if (!b.live) return; b.x += dt * 1.6; b.m.position.x = b.x; if (b.x > 6.1) { b.live = false; b.m.visible = false; } });
}
