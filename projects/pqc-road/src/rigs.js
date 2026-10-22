/**
 * Concrete-road equipment, built in code. Every rig faces +x and returns
 * { root, update(dt, ds) } plus any parts the animation drives.
 * Local y = 0 is the surface the rig stands on.
 */
import * as THREE from 'three';
import { M, mesh, rbox, box, cyl, extrude, wheel, rollWheel, track, cab, lamp, beacon, exhaust } from './kit.js';

export const P = {
  white: new THREE.MeshPhysicalMaterial({ color: '#e9e7e0', roughness: 0.45, metalness: 0.1, clearcoat: 0.3 }),
  orange: new THREE.MeshPhysicalMaterial({ color: '#e8681a', roughness: 0.45, metalness: 0.1, clearcoat: 0.3 }),
  belt: new THREE.MeshStandardMaterial({ color: '#202225', roughness: 0.9 }),
  burlap: new THREE.MeshStandardMaterial({ color: '#a88a5a', roughness: 1, side: THREE.DoubleSide }),
  tank: new THREE.MeshStandardMaterial({ color: '#cfd5da', roughness: 0.3, metalness: 0.7 }),
  concrete: new THREE.MeshStandardMaterial({ color: '#8e8c86', roughness: 0.85 }),
  mist: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }),
  water: new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.35, depthWrite: false }),
  vest: new THREE.MeshStandardMaterial({ color: '#ff7a00', roughness: 0.7 }),
  vestG: new THREE.MeshStandardMaterial({ color: '#c8e632', roughness: 0.7 }),
};
const shade = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

export function worker(vest = P.vest, pose = 'stand') {
  const p = new THREE.Group();
  const legs = rbox(0.22, 0.85, 0.3, M.dark, 0.08); legs.position.y = 0.43; p.add(legs);
  const t = rbox(0.26, 0.6, 0.42, vest, 0.1); t.position.y = 1.15; p.add(t);
  const h = mesh(new THREE.SphereGeometry(0.11, 12, 10), M.skin); h.position.y = 1.58; p.add(h);
  const hat = mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.hat); hat.position.y = 1.6; p.add(hat);
  if (pose === 'bend') { t.rotation.z = -0.6; t.position.set(0.15, 1.05, 0); h.position.set(0.38, 1.38, 0); hat.position.set(0.38, 1.4, 0); }
  return shade(p);
}

/** a four-track paving frame: shared by the slip-form paver and the placer-spreader */
function pavingFrame(g, { span = 9.2, len = 3.2, h = 2.2, legX = 1.5, mat = P.white }) {
  const tracks = [];
  for (const x of [legX, -legX]) for (const z of [span / 2, -span / 2]) {
    const t = track(1.5, 0.26, 0.42, { pitch: 0.16, rollers: 4 }); t.position.set(x, 0.3, z); g.add(t); tracks.push(t);
    const leg = rbox(0.34, h - 0.55, 0.34, mat, 0.04); leg.position.set(x, 0.55 + (h - 0.55) / 2, z); g.add(leg);
    const ram = cyl(0.07, 0.8, M.chrome, 'y', 10); ram.position.set(x + 0.22, 1.0, z); g.add(ram);
  }
  const frame = rbox(len, 0.5, span - 0.6, mat, 0.06); frame.position.set(0, h, 0); g.add(frame);
  for (const x of [len / 2 - 0.1, -len / 2 + 0.1]) { const rail = box(0.08, 0.06, span - 0.8, P.orange); rail.position.set(x, h + 0.28, 0); g.add(rail); }
  return tracks;
}

export function slipformPaver() {
  const g = new THREE.Group();
  const tracks = pavingFrame(g, { span: 9.3, len: 3.4 });
  // mould: side forms, profile pan, vibrators, tamper, auger, correcting beam, super smoother
  for (const z of [3.82, -3.82]) { const sf = box(3.3, 0.36, 0.08, M.steel); sf.position.set(0, 0.18, z); g.add(sf); const st = box(3.3, 1.7, 0.1, P.white); st.position.set(0, 1.1, z * 1.03); g.add(st); }
  const pan = box(2.2, 0.06, 7.56, M.steel); pan.position.set(-0.4, 0.33, 0); g.add(pan);
  const hopper = extrude([[0, 0], [0.9, 0.9], [0.9, 1.6], [0.2, 1.6], [-0.2, 0.4]], 7.6, P.white, 0.02); hopper.position.set(1.0, 0.35, 0); g.add(hopper);
  const auger = new THREE.Group(); auger.position.set(1.85, 0.55, 0); g.add(auger);
  auger.add(cyl(0.06, 7.4, M.steel, 'z', 10));
  { const pts = []; for (let i = 0; i <= 200; i++) { const t = i / 200, a = t * Math.PI * 2 * 18; pts.push(new THREE.Vector3(Math.cos(a) * 0.22, Math.sin(a) * 0.22, -3.7 + t * 7.4)); } auger.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 600, 0.025, 5), M.steel)); }
  for (let i = 0; i < 22; i++) { const v = cyl(0.03, 0.75, M.dark, 'y', 6); v.position.set(1.25, 0.45, -3.5 + (i * 7) / 21); v.rotation.z = 0.5; g.add(v); }
  const tamper = box(0.14, 0.12, 7.5, M.worn); tamper.position.set(0.85, 0.38, 0); g.add(tamper);
  const ocb = box(0.4, 0.16, 7.56, M.steel); ocb.position.set(-1.6, 0.36, 0); g.add(ocb);
  const smoother = new THREE.Group(); smoother.position.set(-3.6, 0, 0); g.add(smoother);
  const sm = box(0.9, 0.06, 3.0, M.steel); sm.position.y = 0.33; smoother.add(sm);
  const smArm = box(1.6, 0.08, 0.08, P.orange); smArm.position.set(0.8, 1.2, 0); smArm.rotation.z = -0.55; smoother.add(smArm);
  // dowel-bar inserter: a gantry of forks behind the mould, and a tie-bar inserter on the centre line
  const dbi = new THREE.Group(); dbi.position.set(-2.4, 0, 0); g.add(dbi);
  for (const z of [4.3, -4.3]) { const p = rbox(0.3, 2.0, 0.3, P.orange, 0.03); p.position.set(0, 1.25, z); dbi.add(p); }
  const gantry = rbox(0.45, 0.4, 8.9, P.orange, 0.04); gantry.position.set(0, 2.2, 0); dbi.add(gantry);
  const hopperD = rbox(0.6, 0.45, 7.6, M.dark, 0.04); hopperD.position.set(0.1, 2.6, 0); dbi.add(hopperD);
  const forks = new THREE.Group(); dbi.add(forks);
  for (let i = 0; i < 25; i++) { const f = cyl(0.025, 1.6, M.steel, 'y', 6); f.position.set(0, 1.25, -3.6 + i * 0.3); forks.add(f); }
  const beamF = box(0.12, 0.1, 7.6, M.dark); beamF.position.set(0, 2.0, 0); forks.add(beamF);
  const tbi = new THREE.Group(); tbi.position.set(-0.9, 0, 0); g.add(tbi);
  const tb = rbox(0.4, 0.9, 0.35, P.orange, 0.04); tb.position.set(0, 0.95, 0); tbi.add(tb); const tbr = cyl(0.03, 0.8, M.steel, 'y', 6); tbr.position.set(0, 0.5, 0); tbi.add(tbr);
  // operator station, engine, sensors, lights
  const plat = rbox(1.6, 0.08, 2.4, M.dark, 0.02); plat.position.set(-0.3, 2.5, -2.9); g.add(plat);
  const console_ = rbox(0.5, 0.9, 0.9, M.black, 0.04); console_.position.set(0.15, 2.95, -2.9); g.add(console_);
  const op = worker(P.vest); op.position.set(-0.4, 2.54, -2.9); g.add(op);
  for (const [x, z] of [[0.5, -2.0], [0.5, -3.8], [-1.1, -2.0], [-1.1, -3.8]]) { const post = box(0.05, 1.9, 0.05, M.black); post.position.set(x, 3.45, z); g.add(post); }
  const canopy = rbox(1.9, 0.08, 2.2, P.orange, 0.03); canopy.position.set(-0.3, 4.42, -2.9); g.add(canopy);
  const eng = rbox(1.6, 1.1, 2.0, P.white, 0.08); eng.position.set(0, 3.0, 2.5); g.add(eng);
  for (const z of [2.1, 2.9]) { const gr = box(1.2, 0.02, 0.3, M.black); gr.position.set(0, 3.56, z); g.add(gr); }
  const ex = exhaust(0.5, 0.06); ex.position.set(-0.4, 3.55, 3.1); g.add(ex);
  const bc = beacon(); bc.position.set(-0.3, 4.48, -2.4); g.add(bc);
  for (const z of [3.6, -3.6]) { const l = lamp(0.08); l.position.set(1.75, 2.5, z); g.add(l); }
  for (const x of [1.4, -1.4]) for (const z of [1, -1]) { const arm = box(0.04, 0.04, 0.75, M.dark); arm.position.set(x, 0.95, z * 4.85); g.add(arm); const wand = box(0.02, 0.25, 0.02, M.red); wand.position.set(x, 0.85, z * 5.2); g.add(wand); }
  shade(g);
  let ins = 0;
  return {
    root: g, dbiForks: forks,
    update(dt, ds, insert = 0) { for (const t of tracks) t.userData.advance(ds); auger.rotation.z += dt * 6; ins += (insert - ins) * Math.min(1, dt * 8); forks.position.y = -ins * 0.9; smoother.position.z = Math.sin(performance.now() / 600) * 2; },
  };
}

export function placerSpreader() {
  const g = new THREE.Group();
  const tracks = pavingFrame(g, { span: 9.3, len: 2.6, h: 2.0, legX: 1.2 });
  const plow = new THREE.Group(); plow.position.set(0.9, 0, 0); g.add(plow);
  const blade = extrude([[0, 0], [0.12, 0], [0.35, 0.55], [0.22, 0.6]], 1.6, M.steel, 0.01); blade.position.y = 0.3; plow.add(blade);
  plow.add(Object.assign(box(0.12, 0.8, 0.12, P.orange), {})); plow.children[1].position.set(0.2, 1.2, 0);
  const strike = box(0.2, 0.3, 7.6, M.steel); strike.position.set(-0.6, 0.6, 0); g.add(strike);
  // side belt conveyor: receives concrete beside the road and drops it on the DLC
  const belt = new THREE.Group(); belt.position.set(0.3, 0, 5.4); g.add(belt);
  const bframe = box(0.9, 0.14, 4.2, P.white); bframe.position.set(0, 1.45, -1.2); bframe.rotation.x = 0.32; belt.add(bframe);
  const band = box(0.7, 0.04, 4.1, P.belt); band.position.set(0, 1.54, -1.2); band.rotation.x = 0.32; belt.add(band);
  const recv = extrude([[-0.6, 0], [0.6, 0], [0.9, 0.8], [-0.9, 0.8]], 1.2, P.orange, 0.02); recv.position.set(0, 0.55, 0.9); belt.add(recv);
  const op = worker(P.vestG); op.position.set(0, 2.25, -3.9); g.add(op);
  const eng = rbox(1.3, 0.9, 1.6, P.white, 0.08); eng.position.set(-0.2, 2.7, 2.6); g.add(eng);
  const bc = beacon(); bc.position.set(-0.2, 3.2, 2.6); g.add(bc);
  shade(g);
  return { root: g, update(dt, ds) { for (const t of tracks) t.userData.advance(ds); plow.position.z = Math.sin(performance.now() / 900) * 3.2; } };
}

export function textureCuring() {
  const g = new THREE.Group(), wheels = [];
  for (const x of [0.9, -0.9]) for (const z of [4.6, -4.6]) { const w = wheel(0.32, 0.18, { rim: M.steel }); w.position.set(x, 0.32, z); g.add(w); wheels.push(w); }
  for (const z of [4.6, -4.6]) { const side = rbox(2.4, 0.3, 0.3, P.white, 0.04); side.position.set(0, 0.75, z); g.add(side); const leg = rbox(0.25, 1.1, 0.25, P.white, 0.03); leg.position.set(0, 1.4, z); g.add(leg); }
  const truss = rbox(0.5, 0.45, 9.4, P.white, 0.05); truss.position.set(0, 2.0, 0); g.add(truss);
  const truss2 = rbox(0.12, 0.12, 9.2, P.orange, 0.02); truss2.position.set(0.4, 1.75, 0); g.add(truss2);
  const carriage = new THREE.Group(); carriage.position.set(0, 0, 0); g.add(carriage);
  const tank = cyl(0.35, 1.0, P.tank, 'z', 16); tank.position.set(-0.3, 2.55, 3.4); g.add(tank);
  // tining comb and spray bar travel across the slab together
  const comb = new THREE.Group(); comb.position.set(0.5, 0, 0); carriage.add(comb);
  const cb = box(0.08, 0.08, 1.4, M.dark); cb.position.y = 0.55; comb.add(cb);
  for (let i = 0; i < 40; i++) { const tooth = box(0.012, 0.24, 0.006, M.steel); tooth.position.set(0.04, 0.42, -0.68 + i * 0.035); tooth.rotation.z = 0.35; comb.add(tooth); }
  const bar = box(0.08, 0.08, 7.6, M.dark); bar.position.set(-0.55, 0.85, 0); g.add(bar);
  const nozzles = []; for (let i = 0; i < 9; i++) { const n = cyl(0.02, 0.1, M.black, 'y', 6); n.position.set(-0.55, 0.78, -3.6 + i * 0.9); g.add(n); const m = mesh(new THREE.ConeGeometry(0.42, 0.45, 12, 1, true), P.mist); m.position.set(-0.55, 0.52, -3.6 + i * 0.9); m.castShadow = false; g.add(m); nozzles.push(m); }
  const burlap = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 7.5), P.burlap); burlap.rotation.x = -Math.PI / 2; burlap.position.set(1.7, 0.312, 0); g.add(burlap);
  const drag = box(0.06, 0.06, 7.6, M.dark); drag.position.set(1.0, 0.36, 0); g.add(drag);
  const op = worker(P.vestG); op.position.set(0, 0.9, -4.6); g.add(op);
  shade(g); for (const n of nozzles) n.castShadow = false;
  return { root: g, update(dt, ds, spraying = true) { for (const w of wheels) rollWheel(w, ds); comb.position.z = Math.sin(performance.now() / 700) * 3.0; for (const n of nozzles) n.visible = spraying; } };
}

/** walk-behind concrete saw: travels along its own +x */
export function concreteSaw() {
  const g = new THREE.Group();
  const body = rbox(0.9, 0.35, 0.55, P.orange, 0.05); body.position.y = 0.45; g.add(body);
  const engine = rbox(0.5, 0.35, 0.45, M.dark, 0.05); engine.position.set(-0.15, 0.78, 0); g.add(engine);
  const guard = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 24, 1, false, 0, Math.PI), M.steel); guard.rotation.x = Math.PI / 2; guard.position.set(0.35, 0.3, 0.33); g.add(guard);
  const blade = cyl(0.36, 0.008, M.chrome, 'z', 32); blade.position.set(0.35, 0.22, 0.33); g.add(blade);
  for (const [x, z] of [[0.35, 0.22], [0.35, -0.22], [-0.35, 0.22], [-0.35, -0.22]]) { const w = cyl(0.1, 0.06, M.rubber, 'z', 12); w.position.set(x, 0.1, z); g.add(w); }
  const handle = box(0.8, 0.04, 0.04, M.black); handle.position.set(-0.75, 0.95, 0); handle.rotation.z = -0.5; g.add(handle);
  const cross = box(0.04, 0.04, 0.5, M.black); cross.position.set(-1.1, 1.15, 0); g.add(cross);
  const tank = cyl(0.14, 0.4, P.tank, 'y', 10); tank.position.set(0.1, 0.9, -0.15); g.add(tank);
  const op = worker(P.vest); op.position.set(-1.45, 0, 0); g.add(op);
  const slurry = mesh(new THREE.ConeGeometry(0.25, 0.3, 10, 1, true), P.water); slurry.position.set(0.35, 0.08, 0.33); slurry.rotation.z = Math.PI; g.add(slurry);
  shade(g); slurry.castShadow = false;
  return { root: g, update(dt) { blade.rotation.z -= dt * 40; } };
}

export function vibRoller() {
  const g = new THREE.Group(), front = new THREE.Group(); front.position.x = 0.4; g.add(front);
  const drum = cyl(0.75, 2.1, M.steel, 'z', 32); drum.position.set(1.0, 0.75, 0); front.add(drum);
  for (const z of [1.15, -1.15]) { const y = rbox(1.4, 1.2, 0.12, M.paint, 0.04); y.position.set(1.0, 0.95, z); front.add(y); }
  const top = rbox(1.6, 0.18, 2.4, M.paint, 0.04); top.position.set(1.0, 1.6, 0); front.add(top);
  const wheels = []; for (const z of [0.9, -0.9]) { const w = wheel(0.75, 0.55); w.position.set(-1.5, 0.75, z); if (z < 0) w.rotation.y = Math.PI; g.add(w); wheels.push(w); }
  const body = rbox(2.3, 1.0, 1.5, M.paint, 0.08); body.position.set(-1.3, 1.35, 0); g.add(body);
  const c = cab(1.2, 1.5, 1.3, { canopy: true }); c.position.set(-0.5, 1.85, 0); g.add(c);
  const bc = beacon(); bc.position.set(-0.5, 3.45, 0.4); g.add(bc);
  shade(g);
  return { root: g, update(dt, ds) { drum.rotation.z -= ds / 0.75; for (const w of wheels) rollWheel(w, ds); front.position.y = Math.sin(performance.now() / 18) * 0.008; } };
}
export function tandemRoller() {
  const g = new THREE.Group(), drums = [];
  for (const x of [1.25, -1.25]) { const d = cyl(0.55, 1.7, M.steel, 'z', 28); d.position.set(x, 0.55, 0); g.add(d); drums.push(d); for (const z of [0.92, -0.92]) { const y = rbox(1.2, 0.9, 0.1, M.paint, 0.03); y.position.set(x, 0.75, z); g.add(y); } }
  const body = rbox(1.6, 0.9, 1.5, M.paint, 0.08); body.position.set(0, 1.25, 0); g.add(body);
  const c = cab(1.1, 1.4, 1.2, { canopy: true }); c.position.set(0, 1.7, 0); g.add(c);
  const tank = rbox(0.8, 0.4, 1.4, M.paint, 0.06); tank.position.set(1.0, 1.55, 0); g.add(tank);
  const bc = beacon(); bc.position.set(0, 3.2, 0.4); g.add(bc);
  shade(g);
  return { root: g, update(dt, ds) { for (const d of drums) d.rotation.z -= ds / 0.55; } };
}
export function dlcPaver() {
  const g = new THREE.Group(), tracks = [];
  for (const z of [1.05, -1.05]) { const t = track(2.3, 0.3, 0.38, { pitch: 0.16, rollers: 5 }); t.position.set(0.2, 0.34, z); g.add(t); tracks.push(t); }
  const body = rbox(3.2, 1.1, 2.5, M.paint, 0.08); body.position.set(0, 1.25, 0); g.add(body);
  const hopper = new THREE.Group(); hopper.position.set(2.0, 0, 0); g.add(hopper);
  for (const z of [1.5, -1.5]) { const w = extrude([[-0.4, 0.4], [1.0, 0.4], [1.2, 1.3], [-0.4, 1.3]], 0.06, M.paint, 0.01); w.position.z = z; hopper.add(w); }
  const hb = box(1.4, 0.06, 3.0, M.dark); hb.position.set(0.3, 0.45, 0); hopper.add(hb);
  const fill = mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#a7a49c', roughness: 0.95 })); fill.scale.set(0.6, 0.4, 1.3); fill.position.set(0.3, 0.48, 0); hopper.add(fill);
  const screed = rbox(0.6, 0.35, 9.5, M.paint, 0.04); screed.position.set(-2.1, 0.22, 0); g.add(screed);
  for (const z of [4.8, -4.8]) { const ep = box(0.7, 0.4, 0.04, M.dark); ep.position.set(-2.1, 0.2, z); g.add(ep); }
  const auger = cyl(0.12, 9.0, M.steel, 'z', 10); auger.position.set(-1.5, 0.2, 0); g.add(auger);
  const plat = rbox(1.0, 0.08, 2.5, M.dark, 0.02); plat.position.set(-1.0, 1.85, 0); g.add(plat);
  const op = worker(P.vest); op.position.set(-1.0, 1.9, -0.6); g.add(op);
  for (const [x, z] of [[-0.6, 1.1], [-0.6, -1.1], [-1.4, 1.1], [-1.4, -1.1]]) { const post = box(0.05, 1.7, 0.05, M.black); post.position.set(x, 2.7, z); g.add(post); }
  const can = rbox(1.2, 0.07, 2.6, M.paint, 0.03); can.position.set(-1.0, 3.55, 0); g.add(can);
  const ex = exhaust(0.5, 0.06); ex.position.set(0.6, 1.8, 0.6); g.add(ex);
  shade(g);
  return { root: g, update(dt, ds) { for (const t of tracks) t.userData.advance(ds); auger.rotation.z += dt * 5; } };
}
/** a road tipper / dumper: body tips about the rear axle; load 0..1 */
export function tipper({ color = '#d9dcd8', concrete = true } = {}) {
  const g = new THREE.Group(), wheels = [];
  const cabM = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.3 });
  for (const x of [2.6, -0.9, -2.2]) for (const z of [0.95, -0.95]) { const w = wheel(0.5, 0.36, { rim: M.steel, dual: x < 0 }); w.position.set(x, 0.5, z * (x < 0 ? 1.05 : 1)); if (z < 0) w.rotation.y = Math.PI; g.add(w); wheels.push(w); }
  for (const z of [0.42, -0.42]) { const rail = box(6.6, 0.25, 0.14, M.dark); rail.position.set(0, 0.82, z); g.add(rail); }
  const cabin = rbox(1.6, 1.6, 2.3, cabM, 0.12); cabin.position.set(2.75, 1.9, 0); g.add(cabin);
  const glass = box(0.04, 0.7, 2.0, M.glass); glass.position.set(3.56, 2.25, 0); g.add(glass);
  for (const z of [1.16, -1.16]) { const sg = box(0.9, 0.6, 0.02, M.glass); sg.position.set(2.95, 2.25, z); g.add(sg); }
  const bump = box(0.2, 0.35, 2.3, M.black); bump.position.set(3.6, 0.75, 0); g.add(bump);
  for (const z of [0.75, -0.75]) { const l = lamp(0.08); l.position.set(3.62, 1.05, z); g.add(l); }
  const bodyG = new THREE.Group(); bodyG.position.set(-2.9, 1.05, 0); g.add(bodyG);
  const sides = new THREE.MeshPhysicalMaterial({ color: '#6b7177', roughness: 0.5, metalness: 0.4 });
  const floor = box(4.8, 0.1, 2.3, sides); floor.position.set(2.4, 0.05, 0); bodyG.add(floor);
  for (const z of [1.13, -1.13]) { const s = box(4.8, 1.0, 0.06, sides); s.position.set(2.4, 0.55, z); bodyG.add(s); }
  const fw = box(0.08, 1.3, 2.3, sides); fw.position.set(4.8, 0.7, 0); bodyG.add(fw);
  const tail = box(0.06, 0.9, 2.3, sides); tail.position.set(0.02, 0.5, 0); bodyG.add(tail);
  const heapM = new THREE.MeshStandardMaterial({ color: concrete ? '#9d9a92' : '#8f8170', roughness: 0.95 });
  const heap = mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), heapM); heap.scale.set(2.1, 0.6, 1.0); heap.position.set(2.4, 0.6, 0); bodyG.add(heap);
  const ramG = cyl(0.09, 1, M.chrome, 'y', 10); g.add(ramG);
  shade(g);
  let load = 1, tip = 0;
  return {
    root: g, wheels,
    set(t, l) { tip = t; load = l; bodyG.rotation.z = -tip * 0.85; heap.visible = load > 0.02; heap.scale.y = 0.15 + 0.5 * load; heap.position.y = 0.3 + 0.3 * load; tail.rotation.z = tip * 0.6; const a = new THREE.Vector3(-0.2, 0.9, 0), b = new THREE.Vector3(1.6, 0.05, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), bodyG.rotation.z).add(bodyG.position); ramG.position.copy(a).add(b).multiplyScalar(0.5); ramG.scale.y = a.distanceTo(b); ramG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); },
    update(dt, ds) { for (const w of wheels) rollWheel(w, ds); },
  };
}
export function tanker() {
  const g = new THREE.Group(), wheels = [];
  for (const x of [2.4, -1.2, -2.3]) for (const z of [0.95, -0.95]) { const w = wheel(0.48, 0.34, { rim: M.steel }); w.position.set(x, 0.48, z); if (z < 0) w.rotation.y = Math.PI; g.add(w); wheels.push(w); }
  const ch = box(6.2, 0.25, 0.9, M.dark); ch.position.set(0, 0.8, 0); g.add(ch);
  const cabin = rbox(1.5, 1.5, 2.2, new THREE.MeshPhysicalMaterial({ color: '#2a62b8', roughness: 0.4, clearcoat: 0.3 }), 0.12); cabin.position.set(2.6, 1.8, 0); g.add(cabin);
  const glass = box(0.04, 0.65, 1.9, M.glass); glass.position.set(3.36, 2.15, 0); g.add(glass);
  const tank = cyl(0.85, 4.2, P.tank, 'x', 24); tank.position.set(-0.7, 1.85, 0); g.add(tank);
  for (const x of [-2.8, 1.4]) { const cap = mesh(new THREE.SphereGeometry(0.85, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), P.tank); cap.rotation.z = x < 0 ? Math.PI / 2 : -Math.PI / 2; cap.scale.y = 0.25; cap.position.set(x, 1.85, 0); g.add(cap); }
  const bar = box(0.08, 0.08, 2.6, M.dark); bar.position.set(-3.1, 0.7, 0); g.add(bar);
  const spray = mesh(new THREE.ConeGeometry(1.4, 0.8, 16, 1, true), P.water); spray.position.set(-3.5, 0.35, 0); spray.rotation.z = -0.6; g.add(spray);
  shade(g); spray.castShadow = false;
  return { root: g, spray, update(dt, ds) { for (const w of wheels) rollWheel(w, ds); } };
}
export function batchingPlant() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ced3', roughness: 0.4, metalness: 0.6 });
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Group(); s.position.set(-4 + i * 3.2, 0, 7);
    const body = cyl(1.3, 9, steel, 'y', 20); body.position.y = 9.5; s.add(body);
    const cone = mesh(new THREE.ConeGeometry(1.3, 2, 20), steel); cone.rotation.x = Math.PI; cone.position.y = 4; s.add(cone);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const l = cyl(0.08, 5, M.dark, 'y', 6); l.position.set(x * 0.9, 2.5, z * 0.9); s.add(l); }
    g.add(s);
  }
  const tower = rbox(4, 6, 4, P.white, 0.05); tower.position.set(0, 5, 0); g.add(tower);
  const mixer = rbox(3, 1.6, 2.4, P.orange, 0.06); mixer.position.set(0, 3.0, 0); g.add(mixer);
  for (let i = 0; i < 4; i++) { const bin = extrude([[0, 0], [2.6, 0], [2.6, 2.6], [0, 1.5]], 2.6, P.orange, 0.03); bin.position.set(-14 + i * 2.8, 0, -4); g.add(bin); }
  const belt = box(14, 0.15, 0.8, P.belt); belt.position.set(-6, 3.2, -2.2); belt.rotation.z = 0.32; belt.rotation.y = -0.3; g.add(belt);
  const cabin = rbox(3, 2.6, 2.4, P.white, 0.05); cabin.position.set(5, 1.3, -3); g.add(cabin);
  for (let i = 0; i < 3; i++) { const w = box(0.7, 0.6, 0.02, M.glass); w.position.set(4 + i * 0.9, 1.7, -1.79); g.add(w); }
  const wt = cyl(1.4, 3, steel, 'y', 16); wt.position.set(6, 1.5, 4); g.add(wt);
  const stair = box(0.8, 6, 0.08, M.dark); stair.position.set(2.4, 3, 2.1); stair.rotation.x = 0.35; g.add(stair);
  for (const [x, z, c] of [[-14, -9, '#9b9387'], [-10, -10, '#b3ab9f'], [-6, -9.5, '#c2b59b']]) { const p = mesh(new THREE.ConeGeometry(3.4, 3, 20), new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })); p.position.set(x, 1.5, z); g.add(p); }
  return shade(g);
}
export function car(color) {
  const g = new THREE.Group(), m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.8, metalness: 0.3 });
  const body = rbox(4.2, 0.65, 1.75, m, 0.2); body.position.y = 0.6; g.add(body);
  const top = rbox(2.2, 0.55, 1.55, m, 0.2); top.position.set(-0.2, 1.15, 0); g.add(top);
  const gl = rbox(2.25, 0.4, 1.58, M.glass, 0.15); gl.position.set(-0.2, 1.18, 0); g.add(gl);
  const ws = []; for (const x of [1.35, -1.35]) for (const z of [0.82, -0.82]) { const w = cyl(0.32, 0.22, M.rubber, 'z', 16); w.position.set(x, 0.32, z); g.add(w); ws.push(w); }
  return { root: shade(g), update(dt, ds) { for (const w of ws) w.rotation.z -= ds / 0.32; } };
}
