/**
 * A generic utility tractor, built in code. Rear axle at x = 0, facing +x, ground at y = 0.
 * Three-point linkage: lower links, lift arms with lift rods, top link; PTO and drawbar.
 */
import * as THREE from 'three';
import { M, mesh, rbox, box, cyl, extrude, wheel, rollWheel, lamp } from './kit.js';

const Y = new THREE.Vector3(0, 1, 0);
/** stretch a unit-height cylinder (axis y) between two points */
export function between(m, a, b) { const d = b.clone().sub(a), L = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y, d.normalize()); m.scale.set(1, L, 1); }
export function rod(r, mat) { const g = new THREE.CylinderGeometry(r, r, 1, 10); return mesh(g, mat); }
function fender(R, W, a0, a1, mat, t = 0.035) {
  const pts = []; for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * (i / 16); pts.push([Math.cos(a) * (R + 0.08), Math.sin(a) * (R + 0.08)]); }
  for (let i = 16; i >= 0; i--) { const a = a0 + (a1 - a0) * (i / 16); pts.push([Math.cos(a) * (R + 0.08 + t), Math.sin(a) * (R + 0.08 + t)]); }
  return extrude(pts, W, mat, 0.01);
}

export function buildTractor(spec, paintHex) {
  const s = spec.s, root = new THREE.Group(), b = new THREE.Group(); b.scale.setScalar(s); root.add(b);
  const paint = new THREE.MeshPhysicalMaterial({ color: paintHex, roughness: 0.35, metalness: 0.15, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  const cream = new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.45, metalness: 0.2 });
  const iron = new THREE.MeshStandardMaterial({ color: '#3b3f44', roughness: 0.55, metalness: 0.5 });
  const rearR = 0.7, fR = spec.wd === 4 ? 0.52 : 0.38, fW = spec.wd === 4 ? 0.28 : 0.15, wb = spec.wd === 4 ? 2.1 : 1.95;
  // wheels
  const wheels = [], steer = [];
  for (const z of [0.74, -0.74]) { const w = wheel(rearR, 0.36, { rimR: rearR * 0.56, rim: cream }); w.position.set(0, rearR, z); if (z < 0) w.rotation.y = Math.PI; b.add(w); wheels.push(w); }
  for (const z of [0.66, -0.66]) { const g = new THREE.Group(); g.position.set(wb, fR, z); b.add(g); const w = wheel(fR, fW, { rimR: fR * 0.6, rim: cream }); if (z < 0) w.rotation.y = Math.PI; g.add(w); wheels.push(w); steer.push(g); }
  // axles, transmission, engine
  const ax = cyl(0.09, 1.25, iron); ax.position.set(0, rearR, 0); b.add(ax);
  const trans = rbox(0.95, 0.62, 0.66, paint, 0.08); trans.position.set(0.1, 0.78, 0); b.add(trans);
  const clutch = rbox(0.55, 0.48, 0.5, iron, 0.06); clutch.position.set(0.78, 0.82, 0); b.add(clutch);
  const engine = rbox(0.95, 0.5, 0.46, iron, 0.05); engine.position.set(1.55, 0.78, 0); b.add(engine);
  const sump = rbox(0.8, 0.14, 0.36, iron, 0.03); sump.position.set(1.55, 0.5, 0); b.add(sump);
  const fax = box(0.16, 0.12, 1.25, iron); fax.position.set(wb, fR, 0); b.add(fax);
  const fpivot = rbox(0.4, 0.22, 0.3, iron, 0.04); fpivot.position.set(wb, fR + 0.14, 0); b.add(fpivot);
  // hood and grille
  const hood = extrude([[0, 0], [1.72, 0], [1.8, 0.1], [1.76, 0.42], [1.55, 0.5], [0.1, 0.56], [0, 0.5]], 0.7, paint, 0.06); hood.position.set(0.82, 1.0, 0); b.add(hood);
  const stripe = box(1.5, 0.05, 0.72, cream); stripe.position.set(1.62, 1.29, 0); b.add(stripe);
  const grille = box(0.04, 0.4, 0.58, iron); grille.position.set(2.63, 1.22, 0); b.add(grille);
  for (let i = 0; i < 6; i++) { const g = box(0.05, 0.02, 0.56, M.black); g.position.set(2.65, 1.06 + i * 0.065, 0); b.add(g); }
  for (const z of [0.22, -0.22]) { const l = lamp(0.06); l.position.set(2.62, 1.3, z); b.add(l); }
  const bump = box(0.18, 0.22, 0.86, iron); bump.position.set(2.68, 0.66, 0); b.add(bump);
  const weights = new THREE.Group(); for (let i = 0; i < 5; i++) { const wt = rbox(0.1, 0.36, 0.7, iron, 0.03); wt.position.set(2.82 + i * 0.105, 0.68, 0); weights.add(wt); } b.add(weights);
  // fenders, platform, seat, steering
  for (const z of [0.74, -0.74]) {
    const f = fender(rearR, 0.46, 0.15, Math.PI - 0.25, paint); f.position.set(0, rearR, z); b.add(f);
    const top = box(0.75, 0.04, 0.42, paint); top.position.set(-0.1, rearR + 0.82, z * 1.0); b.add(top);
    const fl = lamp(0.05); fl.position.set(0.2, rearR + 0.9, z); b.add(fl);
  }
  const plat = box(0.9, 0.05, 1.02, iron); plat.position.set(0.45, 0.88, 0); b.add(plat);
  for (const z of [0.6, -0.6]) { const st = box(0.35, 0.04, 0.22, iron); st.position.set(0.55, 0.58, z); b.add(st); }
  const seat = rbox(0.42, 0.1, 0.46, M.seat, 0.04); seat.position.set(-0.12, 1.32, 0); b.add(seat);
  const back = rbox(0.08, 0.38, 0.44, M.seat, 0.04); back.position.set(-0.33, 1.52, 0); back.rotation.z = -0.15; b.add(back);
  const post = cyl(0.05, 0.45, iron, 'y'); post.position.set(-0.12, 1.08, 0); b.add(post);
  const col = cyl(0.04, 0.85, M.black, 'y'); col.position.set(0.5, 1.4, 0); col.rotation.z = 0.55; b.add(col);
  const dash = rbox(0.28, 0.32, 0.5, iron, 0.05); dash.position.set(0.68, 1.18, 0); b.add(dash);
  const sw = new THREE.Group(); sw.position.set(0.28, 1.76, 0); sw.rotation.z = 0.55; b.add(sw);
  const swr = mesh(new THREE.TorusGeometry(0.2, 0.022, 8, 28), M.black); swr.rotation.x = Math.PI / 2; sw.add(swr);
  for (const a of [0, 2.1, 4.2]) { const sp = box(0.18, 0.015, 0.02, M.black); sp.position.set(Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09); sp.rotation.y = -a; sw.add(sp); }
  for (const z of [0.12, -0.12]) { const lv = cyl(0.012, 0.35, M.black, 'y', 6); lv.position.set(0.05, 1.45, z + 0.32 * Math.sign(z)); lv.rotation.z = -0.3; b.add(lv); }
  const ex = new THREE.Group(); ex.position.set(1.75, 1.5, 0.25); b.add(ex);
  const pipe = cyl(0.04, 0.8, M.dark, 'y', 10); pipe.position.y = 0.4; ex.add(pipe); const muff = cyl(0.07, 0.3, M.dark, 'y', 12); muff.position.y = 0.3; ex.add(muff);
  const air = cyl(0.07, 0.35, M.black, 'y', 12); air.position.set(1.45, 1.68, -0.24); b.add(air);
  // driver, canopy or cab
  const drv = new THREE.Group(); drv.position.set(-0.1, 1.37, 0); b.add(drv);
  { const t = rbox(0.24, 0.5, 0.38, new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.8 }), 0.1); t.position.set(-0.04, 0.3, 0); drv.add(t);
    const h = mesh(new THREE.SphereGeometry(0.1, 14, 10), M.skin); h.position.set(-0.02, 0.66, 0); drv.add(h);
    const pg = mesh(new THREE.SphereGeometry(0.115, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e5a823', roughness: 0.8 })); pg.scale.y = 0.7; pg.position.set(-0.02, 0.7, 0); drv.add(pg);
    const legs = rbox(0.42, 0.14, 0.3, new THREE.MeshStandardMaterial({ color: '#6b5a44', roughness: 0.9 }), 0.06); legs.position.set(0.2, 0.05, 0); drv.add(legs); }
  if (spec.cab) {
    const glass = M.glass;
    for (const [x, z] of [[0.55, 0.62], [0.55, -0.62], [-0.55, 0.62], [-0.55, -0.62]]) { const p = box(0.06, 1.25, 0.06, M.black); p.position.set(x, 1.95, z); b.add(p); }
    const roof = rbox(1.3, 0.1, 1.4, paint, 0.05); roof.position.set(0, 2.62, 0); b.add(roof);
    for (const z of [0.62, -0.62]) { const g = box(1.08, 1.15, 0.02, glass); g.position.set(0, 1.95, z); b.add(g); }
    for (const x of [0.55, -0.55]) { const g = box(0.02, 1.15, 1.2, glass); g.position.set(x, 1.95, 0); b.add(g); }
    for (const z of [0.4, -0.4]) { const l = lamp(0.05); l.position.set(0.62, 2.55, z); b.add(l); }
  } else {
    for (const z of [0.6, -0.6]) { const p = cyl(0.035, 1.25, M.black, 'y', 8); p.position.set(-0.45, 1.95, z); b.add(p); }
    const bar = cyl(0.035, 1.2, M.black, 'z', 8); bar.position.set(-0.45, 2.55, 0); b.add(bar);
    const roof = rbox(1.2, 0.06, 1.35, paint, 0.03); roof.position.set(-0.05, 2.6, 0); b.add(roof);
    for (const x of [0.5]) for (const z of [0.6, -0.6]) { const st = cyl(0.02, 0.7, M.black, 'y', 6); st.position.set(x, 2.3, z); st.rotation.z = 0.35; b.add(st); }
  }
  // three-point linkage (body coordinates)
  const LL = 0.85, LP = new THREE.Vector3(-0.35, 0.42, 0), AP = new THREE.Vector3(-0.12, 1.12, 0), TA = new THREE.Vector3(-0.45, 1.0, 0);
  const lower = [], arms = [], rods = [];
  for (const z of [0.36, -0.36]) {
    const g = new THREE.Group(); g.position.set(LP.x, LP.y, z); b.add(g);
    const l = box(LL, 0.06, 0.04, iron); l.position.x = -LL / 2; g.add(l);
    const ball = mesh(new THREE.SphereGeometry(0.045, 10, 8), M.steel); ball.position.x = -LL; g.add(ball); lower.push(g);
    const a = new THREE.Group(); a.position.set(AP.x, AP.y, z * 0.85); b.add(a);
    const arm = box(0.45, 0.07, 0.05, iron); arm.position.x = -0.22; a.add(arm); arms.push(a);
    const r = rod(0.02, M.steel); b.add(r); rods.push(r);
  }
  const housing = rbox(0.32, 0.22, 0.5, iron, 0.04); housing.position.set(-0.12, 1.12, 0); b.add(housing);
  const top = rod(0.03, M.steel); b.add(top); const topBase = mesh(new THREE.SphereGeometry(0.05, 10, 8), iron); topBase.position.copy(TA); b.add(topBase);
  const ptoStub = cyl(0.035, 0.12, M.steel, 'x', 8); ptoStub.position.set(-0.47, 0.62, 0); b.add(ptoStub);
  const ptoGuard = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 14, 1, true, 0, Math.PI), iron); ptoGuard.rotation.z = Math.PI / 2; ptoGuard.position.set(-0.47, 0.62, 0); b.add(ptoGuard);
  const db = box(0.4, 0.04, 0.12, iron); db.position.set(-0.55, 0.42, 0); b.add(db);
  const shaft = new THREE.Group(); b.add(shaft); const sh = rod(0.03, M.steel); shaft.add(sh); const shG = rod(0.06, new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.5, transparent: true, opacity: 0.85 })); shaft.add(shG); shaft.visible = false;
  // mounts (root coordinates)
  const mount = new THREE.Group(); root.add(mount);
  const front = new THREE.Group(); front.position.set((wb + 0.95) * s, 0, 0); root.add(front);
  const toRoot = (v) => v.clone().multiplyScalar(s), toBody = (v) => v.clone().multiplyScalar(1 / s);
  let h = 0, imp = null;
  const linkEnd = (hh) => { const a = THREE.MathUtils.lerp(-9, 22, hh) * Math.PI / 180; return { a, p: new THREE.Vector3(LP.x - Math.cos(a) * LL, LP.y + Math.sin(a) * LL, 0) }; };
  const T = {
    root, paint, s, wheels, steer, mount, front, rearR: rearR * s, wb: wb * s,
    hitchH0: toRoot(linkEnd(0).p).y,
    drawbar: toRoot(new THREE.Vector3(-0.72, 0.42, 0)),
    pto: toRoot(new THREE.Vector3(-0.53, 0.62, 0)),
    attach(i) { imp = i; mount.clear(); front.clear(); weights.visible = !(i && i.hitch === 'front'); if (!i) return; if (i.hitch === 'front') front.add(i.root); else if (i.hitch === '3pt' || i.hitch === 'pto') mount.add(i.root); this.setHitch(h); },
    setHitch(v) {
      h = v; const { a, p } = linkEnd(h);
      lower.forEach((g) => { g.rotation.z = -a; });
      const ab = THREE.MathUtils.lerp(-28, 12, h) * Math.PI / 180; arms.forEach((g) => { g.rotation.z = -ab; });
      rods.forEach((r, i) => { const z = i ? -0.36 : 0.36, ae = new THREE.Vector3(AP.x - Math.cos(ab) * 0.42, AP.y + Math.sin(ab) * 0.42, z * 0.85), le = new THREE.Vector3(LP.x - Math.cos(a) * LL * 0.55, LP.y + Math.sin(a) * LL * 0.55, z); between(r, ae, le); });
      mount.position.copy(toRoot(p));
      top.visible = !!(imp && imp.mastTop && (imp.hitch === '3pt' || imp.hitch === 'pto'));
      if (top.visible) between(top, TA, toBody(mount.position.clone().add(imp.mastTop)));
      shaft.visible = !!(imp && imp.ptoIn);
      if (shaft.visible) { const a1 = new THREE.Vector3(-0.53, 0.62, 0), a2 = toBody((imp.hitch === 'stationary' ? new THREE.Vector3() : mount.position).clone().add(imp.ptoIn)); between(sh, a1, a2); between(shG, a1.clone().lerp(a2, 0.15), a1.clone().lerp(a2, 0.85)); }
    },
    get h() { return h; },
    update(dt, ds, steerA = 0, pto = false) {
      for (const w of wheels) rollWheel(w, ds / s * (w.userData.R ? 1 : 1));
      for (const g of steer) g.rotation.y = steerA;
      if (pto) { ptoStub.rotation.x += dt * 30; }
      if (imp?.ptoIn) this.setHitch(h);
    },
  };
  T.setHitch(0.6);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return T;
}
