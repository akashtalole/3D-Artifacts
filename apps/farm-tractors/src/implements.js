/**
 * Implements, built in code. Three-point implements hang from the lower-link ends
 * (local origin there, +x towards the tractor); with the linkage lowered the ground
 * is at y = −h0. Trailed implements start at the drawbar pin. Each builder returns
 * { hitch, root, w, mastTop?, ptoIn?, toolX, update(dt, ds, st) }.
 */
import * as THREE from 'three';
import { M, mesh, rbox, box, cyl, extrude, wheel, rollWheel } from './kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { between, rod } from './tractor.js';

const shade = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.3, metalness: 0.85 }),
  share: new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.25, metalness: 0.9, side: THREE.DoubleSide }),
  soil: new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 1 }),
  mist: new THREE.MeshBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.25, depthWrite: false }),
  belt: new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.9 }),
  grain: new THREE.MeshStandardMaterial({ color: '#d9b15a', roughness: 0.9 }),
  straw: new THREE.MeshStandardMaterial({ color: '#e8d08a', roughness: 1 }),
  bag: new THREE.MeshStandardMaterial({ color: '#d9cfb2', roughness: 0.95 }),
  tank: new THREE.MeshPhysicalMaterial({ color: '#f2f2ee', roughness: 0.4, transparent: true, opacity: 0.92 }),
};
export const impPaint = new THREE.MeshPhysicalMaterial({ color: '#e8721a', roughness: 0.4, metalness: 0.2, clearcoat: 0.3 });
const P = () => impPaint;

/** A-frame headstock: lower-hitch pins at the origin, top-link pin at the mast top */
function headstock(g, top = 0.62, wide = 0.36) {
  for (const z of [wide, -wide]) { const pl = box(0.06, 0.18, 0.05, P()); pl.position.set(0, 0.02, z); g.add(pl); const pinM = cyl(0.025, 0.14, MAT.steel); pinM.position.set(0, 0, z + Math.sign(z) * 0.05); g.add(pinM); }
  for (const z of [wide, -wide]) { const st = box(0.06, top + 0.05, 0.06, P()); st.position.set(-0.04, top / 2, z * 0.45); st.rotation.x = Math.sign(z) * 0.32; g.add(st); }
  const tp = cyl(0.03, 0.16, MAT.steel); tp.position.set(-0.02, top, 0); g.add(tp);
  return new THREE.Vector3(-0.02, top, 0);
}
/** a parametric surface (u, v) → Vector3 */
function surface(f, nu = 14, nv = 8, mat = MAT.share) {
  const g = new THREE.BufferGeometry(), pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = f(i / nu, j / nv); pos.push(p.x, p.y, p.z); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return mesh(g, mat);
}
function concaveDisc(r, depth = 0.06) {   // a dish of radius r facing +y
  const R = (r * r + depth * depth) / (2 * depth), th = Math.asin(r / R);
  const g = new THREE.SphereGeometry(R, 28, 4, 0, Math.PI * 2, 0, th); g.translate(0, -R + depth, 0);
  return mesh(g, new THREE.MeshStandardMaterial({ color: '#b9bdc2', roughness: 0.3, metalness: 0.85, side: THREE.DoubleSide }));
}

// 1 ─ mould-board plough, 2 bottoms
export function plough(h0) {
  const g = new THREE.Group(), mastTop = headstock(g);
  const bm = box(1.5, 0.1, 0.1, P()); bm.position.set(-0.75, 0.1, -0.12); bm.rotation.y = -0.22; g.add(bm);
  const clods = [];
  [[-0.55, 0.12], [-1.15, -0.18]].forEach(([x, z]) => {
    const yb = -h0 - 0.2, bot = new THREE.Group(); bot.position.set(x, 0, z); g.add(bot);
    const std = box(0.08, 0.1 - yb, 0.05, P()); std.position.set(0.05, (0.1 + yb) / 2, 0); bot.add(std);
    const mb = surface((u, v) => new THREE.Vector3(0.22 - 0.6 * u, yb + 0.03 + v * (0.3 + 0.08 * u), 0.04 + 0.3 * u ** 1.5 * (0.25 + 0.75 * v) + 0.06 * v)); bot.add(mb);
    const share = extrude([[0.32, 0], [0.0, 0], [-0.06, 0.03], [0.24, 0.03]], 0.3, MAT.share, 0.005); share.rotation.x = Math.PI / 2; share.position.set(0, yb + 0.02, 0.15); share.scale.set(1, 1, 0.3); bot.add(share);
    const shareT = box(0.34, 0.02, 0.3, MAT.share); shareT.position.set(0.08, yb + 0.01, 0.15); shareT.rotation.y = -0.35; bot.add(shareT);
    const land = box(0.55, 0.12, 0.02, MAT.steel); land.position.set(-0.1, yb + 0.07, 0.0); bot.add(land);
    const coulter = cyl(0.17, 0.015, MAT.steel, 'z', 20); coulter.position.set(0.42, -h0 + 0.02, 0.02); bot.add(coulter);
    const cArm = box(0.04, 0.3, 0.04, P()); cArm.position.set(0.42, -h0 + 0.2, 0.02); bot.add(cArm);
    for (let k = 0; k < 6; k++) { const c = rbox(0.09, 0.06, 0.09, MAT.soil, 0.02); c.visible = false; bot.add(c); clods.push({ c, k, yb }); }
  });
  const wheelD = wheel(0.25, 0.12, { rim: MAT.steel }); wheelD.position.set(-1.5, -h0 + 0.25, -0.45); g.add(wheelD);
  let t = 0;
  return { hitch: '3pt', root: shade(g), w: 0.6, mastTop, toolX: -0.9, update(dt, ds, st) {
    t += ds; rollWheel(wheelD, ds);
    for (const { c, k, yb } of clods) { c.visible = st.working && ds > 0; if (!c.visible) continue; const u = ((t * 1.2 + k / 6) % 1); c.position.set(0.22 - 0.6 * u, yb + 0.06 + u * 0.3, 0.08 + 0.36 * u ** 1.5); c.rotation.set(u * 3, u * 2, u * 4); }
  } };
}

// 2 ─ disc plough, 3 discs
export function discPlough(h0) {
  const g = new THREE.Group(), mastTop = headstock(g);
  const bm = box(1.6, 0.12, 0.12, P()); bm.position.set(-0.8, 0.12, -0.2); bm.rotation.y = -0.35; g.add(bm);
  const discs = [];
  for (let i = 0; i < 3; i++) {
    const hub = new THREE.Group(); hub.position.set(-0.45 - 0.48 * i, -h0 - 0.18 + 0.33, 0.15 - 0.3 * i); hub.rotation.set(-0.35, -0.75, 0); g.add(hub);
    const spin = new THREE.Group(); hub.add(spin); const d = concaveDisc(0.33, 0.07); d.rotation.x = Math.PI / 2; spin.add(d); discs.push(spin);
    const arm = box(0.07, 0.55, 0.07, P()); arm.position.set(-0.45 - 0.48 * i, 0.0, 0.05 - 0.3 * i); g.add(arm);
    const scr = box(0.25, 0.04, 0.02, MAT.steel); scr.position.set(0, 0.12, -0.1); scr.rotation.z = 0.4; hub.add(scr);
  }
  const fw = new THREE.Group(); fw.position.set(-1.75, -h0 + 0.05, -0.75); fw.rotation.set(0.3, 0.4, 0); g.add(fw); const fwd = cyl(0.26, 0.06, MAT.steel, 'z', 22); fwd.position.y = 0.22; fw.add(fwd);
  return { hitch: '3pt', root: shade(g), w: 0.75, mastTop, toolX: -0.9, update(dt, ds) { for (const d of discs) d.rotation.y += ds / 0.33; fwd.rotation.z -= ds / 0.26; } };
}

// 3 ─ tandem disc harrow, 14 discs
export function discHarrow(h0) {
  const g = new THREE.Group(), mastTop = headstock(g);
  for (const z of [0.95, -0.95]) { const r = box(1.3, 0.08, 0.08, P()); r.position.set(-0.75, 0.15, z); g.add(r); }
  for (const x of [-0.25, -0.8, -1.35]) { const r = box(0.08, 0.08, 1.98, P()); r.position.set(x, 0.15, 0); g.add(r); }
  const gangs = [];
  for (const [x, ang] of [[-0.5, 0.32], [-1.1, -0.32]]) {
    const gang = new THREE.Group(); gang.position.set(x, -h0 - 0.12 + 0.23, 0); gang.rotation.y = ang; g.add(gang);
    const spin = new THREE.Group(); gang.add(spin); const axle = cyl(0.025, 1.9, MAT.steel); spin.add(axle);
    for (let i = 0; i < 7; i++) { const d = concaveDisc(0.23, 0.05); d.rotation.x = ang > 0 ? -Math.PI / 2 : Math.PI / 2; d.position.z = -0.81 + i * 0.27; spin.add(d); }
    for (const z of [0.85, -0.85]) { const brg = box(0.1, 0.32, 0.06, P()); brg.position.set(0, 0.2, z); gang.add(brg); }
    gangs.push(spin);
  }
  return { hitch: '3pt', root: shade(g), w: 1.8, mastTop, toolX: -0.8, update(dt, ds) { for (const s of gangs) s.rotation.z -= ds / 0.23; } };
}

// 4 ─ tine cultivator, 9 spring tines
export function cultivator(h0) {
  const g = new THREE.Group(), mastTop = headstock(g);
  for (const x of [-0.3, -0.75]) { const bar = box(0.08, 0.08, 2.05, P()); bar.position.set(x, 0.12, 0); g.add(bar); }
  for (const z of [0.5, -0.5]) { const s = box(0.6, 0.06, 0.06, P()); s.position.set(-0.5, 0.12, z); g.add(s); }
  const tines = [];
  for (let i = 0; i < 9; i++) {
    const z = -0.9 + i * 0.225, x0 = i % 2 ? -0.3 : -0.75, tg = new THREE.Group(); tg.position.set(x0, 0.12, z); g.add(tg);
    const pts = []; for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI * 1.15; pts.push(new THREE.Vector3(-0.12 - Math.sin(a) * 0.16, -Math.cos(a) * 0.1 - k * 0.012, 0)); }
    pts.push(new THREE.Vector3(-0.15, -h0 - 0.12, 0), new THREE.Vector3(-0.05, -h0 - 0.2, 0));
    tg.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.018, 6), MAT.steel));
    const sh = box(0.14, 0.02, 0.06, MAT.share); sh.position.set(-0.02, -h0 - 0.21, 0); sh.rotation.z = -0.5; tg.add(sh);
    tines.push(tg);
  }
  const dws = []; for (const z of [1.1, -1.1]) { const w = wheel(0.22, 0.1, { rim: MAT.steel }); w.position.set(-0.1, -h0 + 0.22, z); if (z < 0) w.rotation.y = Math.PI; g.add(w); dws.push(w); }
  return { hitch: '3pt', root: shade(g), w: 2.0, mastTop, toolX: -0.6, update(dt, ds, st) { for (const w of dws) rollWheel(w, ds); tines.forEach((t, i) => { t.rotation.z = st.working && ds ? Math.sin(performance.now() / 60 + i) * 0.03 : 0; }); } };
}

// 5 ─ rotavator, PTO-driven
export function rotavator(h0) {
  const g = new THREE.Group(), mastTop = headstock(g, 0.7);
  const ry = -h0 + 0.12, rx = -0.6;
  const hood = []; for (let i = 0; i <= 14; i++) { const a = Math.PI * 0.05 + (i / 14) * Math.PI * 0.95; hood.push([Math.cos(a) * 0.36, Math.sin(a) * 0.36]); } for (let i = 14; i >= 0; i--) { const a = Math.PI * 0.05 + (i / 14) * Math.PI * 0.95; hood.push([Math.cos(a) * 0.33, Math.sin(a) * 0.33]); }
  const hd = extrude(hood, 1.95, P(), 0.01); hd.position.set(rx, ry, 0); hd.rotation.y = Math.PI; g.add(hd);
  const rotor = new THREE.Group(); rotor.position.set(rx, ry, 0); g.add(rotor);
  rotor.add(cyl(0.05, 1.86, MAT.steel, 'z', 12));
  const bladeG = new THREE.BoxGeometry(0.05, 0.22, 0.012); bladeG.translate(0, 0.13, 0); const tipG = new THREE.BoxGeometry(0.1, 0.012, 0.05); tipG.translate(0.04, 0.24, 0);
  for (let k = 0; k < 7; k++) {
    const z = -0.84 + k * 0.28; const fl = cyl(0.11, 0.015, MAT.steel, 'z', 14); fl.position.z = z; rotor.add(fl);
    for (let j = 0; j < 6; j++) { const b = new THREE.Group(); b.rotation.z = (j / 6) * Math.PI * 2 + k * 0.5; b.position.z = z + (j % 2 ? 0.04 : -0.04); b.add(mesh(bladeG, MAT.share), mesh(tipG, MAT.share)); rotor.add(b); }
  }
  const gbox = rbox(0.3, 0.25, 0.3, P(), 0.04); gbox.position.set(-0.32, 0.25, 0); g.add(gbox);
  const tube = cyl(0.06, 0.95, P(), 'z'); tube.position.set(-0.32, 0.22, 0.48); g.add(tube);
  const chain = rbox(0.28, ry > 0 ? 0.3 : 0.25 - ry + 0.15, 0.1, P(), 0.04); chain.position.set(-0.45, (0.25 + ry) / 2, 0.98); g.add(chain);
  const skidG = []; for (const z of [-1.0, 0.92]) { const s = box(0.5, 0.25, 0.03, P()); s.position.set(rx, ry - 0.0, z); g.add(s); skidG.push(s); }
  const board = new THREE.Group(); board.position.set(rx - 0.36, ry + 0.06, 0); g.add(board); const bd = box(0.02, 0.32, 1.9, P()); bd.position.set(-0.03, -0.14, 0); board.add(bd);
  const fr = box(0.08, 0.08, 1.2, P()); fr.position.set(-0.15, 0.2, 0); g.add(fr);
  return { hitch: 'pto', root: shade(g), w: 1.8, mastTop, ptoIn: new THREE.Vector3(-0.17, 0.25, 0), toolX: -0.7, update(dt, ds, st) {
    if (st.pto) rotor.rotation.z -= dt * 21; board.rotation.z = st.working ? 0.35 : 0.1;
  } };
}

// 6 ─ laser land leveller, trailed
export function leveller() {
  const g = new THREE.Group();
  const tongue = box(1.7, 0.1, 0.1, P()); tongue.position.set(-0.85, 0.42, 0); g.add(tongue);
  for (const z of [0.6, -0.6]) { const a = box(1.4, 0.08, 0.08, P()); a.position.set(-1.45, 0.42, z * 0.6); a.rotation.y = Math.sign(z) * 0.4; g.add(a); }
  const buck = new THREE.Group(); buck.position.set(-2.2, 0, 0); g.add(buck);
  const backP = box(0.05, 0.6, 2.4, P()); backP.position.set(-0.28, 0.32, 0); buck.add(backP);
  const bot = box(0.6, 0.04, 2.4, P()); bot.position.set(0, 0.03, 0); buck.add(bot);
  const edge = box(0.08, 0.04, 2.4, MAT.share); edge.position.set(0.32, 0.02, 0); buck.add(edge);
  for (const z of [1.2, -1.2]) { const sd = box(0.62, 0.6, 0.04, P()); sd.position.set(0, 0.32, z); buck.add(sd); }
  const soil = mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.3, 14, 1, false, 0, Math.PI), MAT.soil); soil.rotation.x = Math.PI / 2; soil.rotation.z = Math.PI / 2; soil.position.set(0.05, 0.05, 0); soil.scale.set(1, 1, 0.7); buck.add(soil);
  const mast = cyl(0.03, 2.2, MAT.steel, 'y', 8); mast.position.set(-0.28, 1.6, 0); buck.add(mast);
  const rcv = cyl(0.08, 0.3, new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.4 }), 'y', 16); rcv.position.set(-0.28, 2.75, 0); buck.add(rcv);
  const rear = new THREE.Group(); rear.position.set(-3.2, 0, 0); g.add(rear);
  const ws = []; for (const z of [0.95, -0.95]) { const w = wheel(0.38, 0.2, { rim: MAT.steel }); w.position.set(0, 0.38, z); if (z < 0) w.rotation.y = Math.PI; rear.add(w); ws.push(w); }
  const rax = cyl(0.05, 1.9, P()); rax.position.y = 0.38; rear.add(rax);
  const rf = box(1.1, 0.08, 0.08, P()); rf.position.set(0.5, 0.55, 0); rear.add(rf);
  const ram = rod(0.04, M.chrome); g.add(ram);
  return { hitch: 'drawbar', root: shade(g), w: 2.4, len: 3.2, toolX: -2.2, update(dt, ds, st) { for (const w of ws) rollWheel(w, ds); buck.position.y = st.working ? 0 : 0.15; soil.visible = st.working; between(ram, new THREE.Vector3(-1.9, 0.5, 0), new THREE.Vector3(-2.6, 0.7 + buck.position.y, 0)); } };
}

// 7 ─ seed-cum-fertiliser drill, 9 rows
export function seedDrill(h0) {
  const g = new THREE.Group(), mastTop = headstock(g, 0.75);
  const bar = box(0.1, 0.1, 1.95, P()); bar.position.set(-0.35, 0.12, 0); g.add(bar);
  const hop = extrude([[-0.25, 0], [0.25, 0], [0.4, 0.5], [-0.4, 0.5]], 1.9, P(), 0.02); hop.position.set(-0.55, 0.35, 0); g.add(hop);
  const div = box(0.02, 0.5, 1.88, P()); div.position.set(-0.55, 0.6, 0); g.add(div);
  const lid = box(0.82, 0.03, 1.9, new THREE.MeshStandardMaterial({ color: '#2e7d32', roughness: 0.5 })); lid.position.set(-0.55, 0.87, 0); g.add(lid);
  const seeds = [];
  for (let i = 0; i < 9; i++) {
    const z = -0.8 + i * 0.2;
    const tube = rod(0.018, new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.7, transparent: true, opacity: 0.85 })); between(tube, new THREE.Vector3(-0.55, 0.36, z), new THREE.Vector3(-0.72, -h0 + 0.02, z)); g.add(tube);
    const tine = box(0.05, 0.12 + h0, 0.03, P()); tine.position.set(-0.4, (0.12 - h0) / 2 - 0.02, z); tine.rotation.z = -0.25; g.add(tine);
    const shoe = box(0.16, 0.04, 0.04, MAT.share); shoe.position.set(-0.68, -h0 - 0.03, z); g.add(shoe);
    for (let k = 0; k < 3; k++) { const s = mesh(new THREE.SphereGeometry(0.012, 6, 4), MAT.grain); s.visible = false; g.add(s); seeds.push({ s, z, k }); }
  }
  const gw = wheel(0.3, 0.1, { rim: MAT.steel }); gw.position.set(-0.3, -h0 + 0.3, 1.1); g.add(gw);
  const chain = box(0.04, 0.6, 0.02, M.black); chain.position.set(-0.42, 0.1, 1.03); chain.rotation.z = 0.3; g.add(chain);
  let t = 0;
  return { hitch: '3pt', root: shade(g), w: 1.8, mastTop, toolX: -0.7, rows: 9, update(dt, ds, st) {
    rollWheel(gw, ds); t += dt;
    for (const { s, z, k } of seeds) { s.visible = st.working && ds > 0; if (!s.visible) continue; const u = (t * 2.2 + k / 3) % 1; s.position.set(-0.55 - 0.17 * u, 0.36 - u * (0.38 + h0), z); }
  } };
}

// 8 ─ boom sprayer, PTO pump
export function sprayer(h0) {
  const g = new THREE.Group(), mastTop = headstock(g, 0.8);
  const fr = rbox(0.9, 0.08, 0.9, P(), 0.02); fr.position.set(-0.45, 0.1, 0); g.add(fr);
  const tank = mesh(new THREE.SphereGeometry(0.5, 24, 16), MAT.tank); tank.scale.set(0.95, 0.85, 1.1); tank.position.set(-0.45, 0.55, 0); g.add(tank);
  const lidS = cyl(0.12, 0.06, M.black, 'y', 14); lidS.position.set(-0.45, 1.0, 0); g.add(lidS);
  const pump = rbox(0.2, 0.18, 0.2, M.dark, 0.03); pump.position.set(-0.1, 0.18, 0); g.add(pump);
  const mastB = box(0.08, 1.1, 0.08, P()); mastB.position.set(-0.98, 0.2, 0); g.add(mastB);
  const by = -h0 + 0.65, wings = [], nozzles = [];
  const center = box(0.08, 0.08, 0.9, P()); center.position.set(-1.02, by, 0); g.add(center);
  for (const s of [1, -1]) {
    const w = new THREE.Group(); w.position.set(-1.02, by, s * 0.45); g.add(w);
    const tr = box(0.06, 0.06, 4.55, P()); tr.position.z = s * 2.27; w.add(tr);
    const tr2 = box(0.03, 0.03, 4.4, P()); tr2.position.set(0, 0.22, s * 2.2); w.add(tr2);
    for (let k = 0; k < 9; k++) { const dg = box(0.02, 0.24, 0.02, P()); dg.position.set(0, 0.11, s * (0.25 + k * 0.5)); dg.rotation.x = s * 0.6; w.add(dg); }
    for (let k = 0; k < 9; k++) { const n = mesh(new THREE.ConeGeometry(0.28, 0.55, 12, 1, true), MAT.mist); n.position.set(0, -0.3, s * (0.5 + k * 0.5)); n.castShadow = false; w.add(n); nozzles.push(n); }
    wings.push([w, s]);
  }
  for (const z of [0.25, -0.25]) { const n = mesh(new THREE.ConeGeometry(0.28, 0.55, 12, 1, true), MAT.mist); n.position.set(-1.02, by - 0.3, z); g.add(n); nozzles.push(n); }
  let fold = 1;
  shade(g); nozzles.forEach((n) => { n.castShadow = false; });
  return { hitch: 'pto', root: g, w: 10, mastTop, ptoIn: new THREE.Vector3(-0.0, 0.2, 0), toolX: -1.0, update(dt, ds, st) {
    fold += ((st.working || st.open ? 0 : 1) - fold) * Math.min(1, dt * 1.5);
    for (const [w, s] of wings) w.rotation.x = s * fold * (Math.PI / 2 - 0.05);
    for (const n of nozzles) { n.visible = st.working && fold < 0.05; n.scale.y = 0.9 + Math.random() * 0.2; }
  } };
}

// 9 ─ front-mounted vertical-conveyor reaper
export function reaper() {
  const g = new THREE.Group();
  for (const z of [0.4, -0.4]) { const arm = box(0.9, 0.08, 0.08, P()); arm.position.set(0.1, 0.55, z); arm.rotation.z = -0.35; g.add(arm); }
  const frame = box(0.5, 0.1, 2.2, P()); frame.position.set(0.5, 0.3, 0); g.add(frame);
  const bar = box(0.12, 0.03, 2.2, MAT.steel); bar.position.set(0.85, 0.09, 0); g.add(bar);
  const knife = new THREE.Group(); knife.position.set(0.92, 0.1, 0); g.add(knife);
  for (let i = 0; i < 28; i++) { const s = extrude([[0, -0.035], [0.08, 0], [0, 0.035]], 0.008, MAT.share, 0.001); s.rotation.x = Math.PI / 2; s.position.z = -1.05 + i * 0.076; knife.add(s); }
  for (const z of [1.1, 0, -1.1]) { const d = extrude([[0, 0], [0.5, 0.03], [0, 0.18]], 0.06, P(), 0.01); d.position.set(0.85, 0.06, z); g.add(d); }
  const stars = []; for (let i = 0; i < 4; i++) { const sw = new THREE.Group(); sw.position.set(0.78, 0.2, -0.8 + i * 0.53); g.add(sw); for (let k = 0; k < 6; k++) { const p = box(0.2, 0.02, 0.03, MAT.steel); p.position.x = 0.1; const pk = new THREE.Group(); pk.rotation.y = (k / 6) * Math.PI * 2; pk.add(p); sw.add(pk); } stars.push(sw); }
  const lugs = [];
  for (const y of [0.25, 0.55]) { const belt = box(0.03, 0.05, 2.2, MAT.belt); belt.position.set(0.62, y, 0); g.add(belt); for (let i = 0; i < 14; i++) { const l = box(0.08, 0.04, 0.02, M.black); l.position.set(0.66, y, -1.1 + i * 0.157); g.add(l); lugs.push(l); } }
  const back = box(0.03, 0.55, 2.2, P()); back.position.set(0.55, 0.42, 0); g.add(back);
  const crop = []; for (let i = 0; i < 6; i++) { const c = box(0.35, 0.05, 0.05, MAT.straw); c.visible = false; g.add(c); crop.push(c); }
  let t = 0;
  return { hitch: 'front', root: shade(g), w: 2.1, toolX: 0.9, update(dt, ds, st) {
    t += dt; if (!st.pto) return; knife.position.z = Math.sin(t * 40) * 0.035; for (const s of stars) s.rotation.y += dt * 6;
    for (const l of lugs) { l.position.z += dt * 1.2; if (l.position.z > 1.1) l.position.z -= 2.2; }
    crop.forEach((c, i) => { c.visible = st.working && ds > 0; const u = ((t * 0.6 + i / 6) % 1); c.position.set(0.66, 0.4, -1.1 + u * 2.6); c.rotation.set(0, 0, u > 0.85 ? (u - 0.85) * 8 : 1.4); });
  } };
}

// 10 ─ multi-crop thresher, stationary, PTO-driven
export function thresher() {
  const g = new THREE.Group();
  const body = rbox(2.2, 1.2, 1.3, P(), 0.06); body.position.set(-1.6, 1.15, 0); g.add(body);
  const drum = cyl(0.55, 1.3, P(), 'z', 24); drum.position.set(-1.1, 1.75, 0); g.add(drum);
  const chute = extrude([[0, 0], [1.1, 0.35], [1.1, 0.55], [0, 0.25]], 0.7, new THREE.MeshStandardMaterial({ color: '#d1d4d8', metalness: 0.6, roughness: 0.4 }), 0.01); chute.position.set(-0.75, 1.55, 0.95); chute.rotation.y = -Math.PI / 2; g.add(chute);
  const blower = cyl(0.18, 2.4, P(), 'x', 16); blower.position.set(-3.6, 1.65, -0.2); blower.rotation.z = -0.12; g.add(blower);
  const fly = new THREE.Group(); fly.position.set(-0.75, 1.0, -0.72); g.add(fly); const fw = cyl(0.42, 0.08, M.dark, 'z', 24); fly.add(fw); for (let k = 0; k < 5; k++) { const sp = box(0.75, 0.04, 0.04, M.dark); sp.rotation.z = (k / 5) * Math.PI; fly.add(sp); }
  const spout = cyl(0.08, 0.5, P(), 'y', 10); spout.position.set(-2.2, 0.45, 0.75); spout.rotation.x = 0.6; g.add(spout);
  const ws = []; for (const z of [0.75, -0.75]) { const w = wheel(0.4, 0.18, { rim: MAT.steel }); w.position.set(-1.6, 0.4, z); if (z < 0) w.rotation.y = Math.PI; g.add(w); ws.push(w); }
  const tongue = box(0.75, 0.08, 0.08, P()); tongue.position.set(-0.35, 0.55, 0); g.add(tongue);
  const heap = mesh(new THREE.ConeGeometry(0.6, 0.4, 20), MAT.grain); heap.position.set(-2.3, 0.2, 1.3); g.add(heap);
  const bhusa = mesh(new THREE.ConeGeometry(1.6, 1.1, 24), MAT.straw); bhusa.position.set(-5.6, 0.55, -0.6); g.add(bhusa);
  const chaff = []; for (let i = 0; i < 24; i++) { const c = box(0.05, 0.01, 0.02, MAT.straw); g.add(c); chaff.push(c); }
  const bund = []; for (let i = 0; i < 5; i++) { const b = cyl(0.12, 0.7, MAT.straw, 'x', 8); b.position.set(-0.4 + i * 0.05, 0.12 + (i % 2) * 0.2, 2.0 + i * 0.25); g.add(b); bund.push(b); }
  let t = 0, fill = 0.4;
  return { hitch: 'stationary', root: shade(g), w: 0, ptoIn: new THREE.Vector3(-0.75, 1.0, -0.72), toolX: 0, setFill(v) { fill = v; }, update(dt, ds, st) {
    t += dt; if (!st.pto) { chaff.forEach((c) => { c.visible = false; }); return; }
    fly.rotation.z -= dt * 20; fill = Math.min(1.6, fill + dt * 0.01);
    heap.scale.setScalar(0.5 + fill * 0.5); heap.position.y = 0.2 * (0.5 + fill * 0.5);
    chaff.forEach((c, i) => { c.visible = true; const u = ((t * 0.8 + i / 24) % 1); c.position.set(-4.8 - u * 1.4, 1.5 - u * u * 1.2 + Math.sin(i) * 0.15, -0.3 + Math.cos(i * 1.7) * 0.4 * u); c.rotation.set(u * 9, i, u * 5); });
  } };
}

// 11 ─ tipping trolley, two axles
export function trolley() {
  const g = new THREE.Group();
  const tongue = box(1.2, 0.1, 0.1, P()); tongue.position.set(-0.6, 0.42, 0); g.add(tongue);
  const ch = box(4.0, 0.15, 0.9, M.dark); ch.position.set(-3.0, 0.75, 0); g.add(ch);
  const ws = []; for (const x of [-1.8, -3.9]) for (const z of [0.85, -0.85]) { const w = wheel(0.45, 0.24, { rim: MAT.steel }); w.position.set(x, 0.45, z); if (z < 0) w.rotation.y = Math.PI; g.add(w); ws.push(w); }
  const bodyG = new THREE.Group(); bodyG.position.set(-4.9, 0.9, 0); g.add(bodyG);
  const floor = box(3.9, 0.08, 2.0, P()); floor.position.set(1.95, 0.04, 0); bodyG.add(floor);
  for (const z of [1.0, -1.0]) { const s = box(3.9, 0.6, 0.05, P()); s.position.set(1.95, 0.34, z); bodyG.add(s); }
  const fw = box(0.05, 0.75, 2.0, P()); fw.position.set(3.88, 0.4, 0); bodyG.add(fw);
  const tail = box(0.05, 0.6, 2.0, P()); tail.position.set(0.02, 0.34, 0); bodyG.add(tail);
  const bags = new THREE.InstancedMesh(new RoundedBoxGeometry(0.72, 0.27, 0.42, 3, 0.11), MAT.bag, 40); const m4 = new THREE.Matrix4(); let k = 0;
  for (let l = 0; l < 2; l++) for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) { m4.makeRotationY(((i + j + l) % 2) * 0.1); m4.setPosition(0.45 + i * 0.75, 0.22 + l * 0.29, -0.7 + j * 0.47); bags.setMatrixAt(k++, m4); }
  bags.castShadow = true; bodyG.add(bags);
  const ram = rod(0.06, M.chrome); g.add(ram);
  let tip = 0;
  return { hitch: 'drawbar', root: shade(g), w: 0, len: 2.8, toolX: 0, bags, setTip(v) { tip = v; }, update(dt, ds) {
    for (const w of ws) rollWheel(w, ds); bodyG.rotation.z = -tip * 0.75; bags.visible = tip < 0.6;
    between(ram, new THREE.Vector3(-1.6, 0.8, 0), new THREE.Vector3(-1.6, 0.95, 0).sub(bodyG.position).applyAxisAngle(new THREE.Vector3(0, 0, 1), bodyG.rotation.z).add(bodyG.position));
  } };
}

export const BUILD = { plough, disc: discPlough, harrow: discHarrow, cultivator, rotavator, leveller, drill: seedDrill, sprayer, reaper, thresher, trolley };
