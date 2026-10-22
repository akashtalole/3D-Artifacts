/**
 * The machines. Each builder returns a Machine: a 3D group with named joints,
 * hydraulic rams that follow the joints, wheels or tracks, hotspots, attachments
 * and a demo cycle. Dimensions follow typical machines of each class (metres).
 */
import * as THREE from 'three';
import { M, mesh, rbox, box, cyl, extrude, beam, pin, wheel, rollWheel, track, cab, lamp, beacon, exhaust, Ram, anchor, bucket, breaker, forks, auger, sweeper, hazardMaterial } from './kit.js';

const D2R = Math.PI / 180;
/** a loader bucket: the same shell, hung so its pin sits at the back and the floor lies forward */
function loaderBucket(w, L, depth, opt) {
  const g = new THREE.Group(), b = bucket(w, L, depth, opt), rx = depth, th = -Math.atan2(0.31 * L, 0.93 * rx);   // floor level
  const rot = (x, y) => [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)];
  const back = rot(-rx, -0.5 * L), bottom = rot(0, -L), pin = [back[0] + 0.18, bottom[1] + 0.42];
  b.rotation.z = th; b.position.set(-pin[0], -pin[1], 0); g.add(b); g.userData = b.userData; return g;
}
const ease = (t) => t * t * (3 - 2 * t);

export class Machine {
  constructor(id) {
    this.id = id; this.root = new THREE.Group(); this.root.name = id;
    this.joints = {}; this.order = []; this.rams = []; this.wheels = []; this.steerWheels = []; this.tracks = [];
    this.hotspots = []; this.tools = {}; this.toolId = null; this.mount = null; this.demo = []; this.lamps = []; this.beacons = [];
    this.drive = { kind: 'wheels', speed: 0, steer: 0, maxSpeed: 6, turn: 0.5 }; this.load = 0; this.loadMesh = null;
  }
  /** a joint driven by apply(v); rotation joints in degrees, linear ones in metres */
  joint(name, { label = name, min, max, value = 0, unit = '°', apply, keys }) {
    this.joints[name] = { name, label, min, max, value, unit, apply, keys }; this.order.push(name); apply(value); return this.joints[name];
  }
  rot(name, obj, opt) { const axis = opt.axis || 'z', base = obj.rotation[axis], s = opt.sign || 1, objs = opt.also || []; const bases = objs.map(([o]) => o.rotation[axis]); return this.joint(name, { ...opt, apply: (v) => { obj.rotation[axis] = base + s * v * D2R; objs.forEach(([o, k], i) => { o.rotation[axis] = bases[i] + k * v * D2R; }); } }); }
  lin(name, obj, opt) { const axis = opt.axis || 'x', base = obj.position[axis], s = opt.sign || 1; return this.joint(name, { unit: 'm', ...opt, apply: (v) => { obj.position[axis] = base + s * v; } }); }
  set(name, v) { const j = this.joints[name]; if (!j) return; j.value = Math.max(j.min, Math.min(j.max, v)); j.apply(j.value); }
  get(name) { return this.joints[name]?.value ?? 0; }
  ram(parent, a, b, deps, rb, rr) { const r = new Ram(parent, a, b, rb, rr); r.deps = deps; this.rams.push(r); return r; }
  calibrate() {
    for (const r of this.rams) {
      const saved = r.deps.map((d) => this.get(d)); let lo = Infinity, hi = 0;
      const vals = r.deps.map((d) => { const j = this.joints[d]; return [j.min, (j.min + j.max) / 2, j.max]; });
      const rec = (i) => { if (i === r.deps.length) { const d = r.dist(); lo = Math.min(lo, d); hi = Math.max(hi, d); return; } for (const v of vals[i]) { this.set(r.deps[i], v); rec(i + 1); } };
      rec(0); r.deps.forEach((d, i) => this.set(d, saved[i])); r.calibrate(lo, hi);
    }
    this.update(0);
  }
  update(dt) { if (this.onUpdate) this.onUpdate(dt); this.root.updateWorldMatrix(true, true); for (const r of this.rams) r.update(false); }
  addHotspot(name, obj, text, at = [0, 0, 0]) { const a = anchor(obj, ...at); this.hotspots.push({ name, obj: a, text }); }
  setTool(id) {
    if (!this.tools[id] || !this.mount) return;
    if (this.tool) this.mount.remove(this.tool);
    this.toolId = id; this.tool = this.tools[id].make(); this.mount.add(this.tool);
    this.load = 0;
    this.tool.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (this.onTool) this.onTool(this.tool);
    if (this.toolRams) this.toolRams();
    this.calibrate();
  }
  tip(v = new THREE.Vector3()) { if (!this.tool?.userData.tip) return null; this.root.updateWorldMatrix(true, true); return this.tool.userData.tip.getWorldPosition(v); }
  /** roll wheels and tracks for a distance travelled */
  roll(ds, turn = 0) {
    ds /= this.root.scale.x;
    for (const w of this.wheels) rollWheel(w, ds * (w.userData.side ? 1 + turn * w.userData.side : 1));
    for (const t of this.tracks) t.userData.advance(ds * (1 + turn * (t.userData.side || 0)));
  }
  /** keyframed demo: [[time, {joint: value}], …] played on a loop */
  playDemo(t) {
    if (!this.demo.length) return; const T = this.demo[this.demo.length - 1][0]; t %= T;
    let i = 0; while (i < this.demo.length - 1 && this.demo[i + 1][0] <= t) i++;
    const [t0, a] = this.demo[i], [t1, b] = this.demo[Math.min(i + 1, this.demo.length - 1)];
    const u = t1 > t0 ? ease((t - t0) / (t1 - t0)) : 0;
    for (const k of Object.keys(b)) { const va = a[k] ?? b[k]; this.set(k, va + (b[k] - va) * u); }
  }
  pose(p) { for (const [k, v] of Object.entries(p)) this.set(k, v); }
}

function wheelAt(m, parent, R, W, x, y, z, opt = {}) {
  const w = wheel(R, W, opt); w.position.set(x, y, z); if (z < 0) w.rotation.y = Math.PI; w.userData.side = z > 0 ? 1 : -1;
  parent.add(w); m.wheels.push(w); return w;
}
function steerable(m, parent, R, W, x, y, z, opt) { const s = new THREE.Group(); s.position.set(x, y, z); parent.add(s); const w = wheelAt(m, s, R, W, 0, 0, 0, opt); w.userData.side = z > 0 ? 1 : -1; if (z < 0) w.rotation.y = Math.PI; m.steerWheels.push(s); return s; }
function fender(R, W, a0 = 0.15, a1 = Math.PI - 0.15, t = 0.05) {
  const pts = []; for (let i = 0; i <= 14; i++) { const a = a0 + (a1 - a0) * (i / 14); pts.push([Math.cos(a) * (R + 0.1), Math.sin(a) * (R + 0.1)]); }
  for (let i = 14; i >= 0; i--) { const a = a0 + (a1 - a0) * (i / 14); pts.push([Math.cos(a) * (R + 0.1 + t), Math.sin(a) * (R + 0.1 + t)]); }
  return extrude(pts, W, M.paint, 0.01);
}
function handrail(points, h = 0.9) {
  const g = new THREE.Group(); const v = points.map(([x, z, y = 0]) => new THREE.Vector3(x, y + h, z));
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v, false, 'catmullrom', 0), points.length * 8, 0.022, 6), M.paint));
  for (const p of v) { const post = cyl(0.02, h, M.paint, 'y', 6); post.position.set(p.x, p.y - h / 2, p.z); g.add(post); }
  return g;
}
function grille(w, h, d = 0.04) { const g = new THREE.Group(); g.add(box(d, h, w, M.black)); for (let i = 1; i < 8; i++) { const s = box(d + 0.02, 0.02, w * 0.96, M.dark); s.position.y = -h / 2 + (h * i) / 8; g.add(s); } return g; }
function ladder(h, w = 0.45, steps = 4) { const g = new THREE.Group(); for (const z of [w / 2, -w / 2]) { const r = box(0.04, h, 0.04, M.black); r.position.set(0, h / 2, z); g.add(r); } for (let i = 0; i < steps; i++) { const s = box(0.12, 0.03, w, M.steel); s.position.y = 0.15 + (i * (h - 0.25)) / Math.max(1, steps - 1); g.add(s); } return g; }

// ──────────────────────────────────────────────────────────── hydraulic excavator (≈20 t)
function excavator() {
  const m = new Machine('excavator'), R = m.root;
  m.drive = { kind: 'tracks', speed: 0, steer: 0, maxSpeed: 1.5, turn: 0.45 };
  const L = 3.65, r = 0.42, W = 0.6, G = 2.38;
  for (const z of [G / 2, -G / 2]) { const t = track(L, r, W, { pitch: 0.19 }); t.position.set(0, r + 0.035, z); t.userData.side = z > 0 ? 1 : -1; R.add(t); m.tracks.push(t); }
  const cb = rbox(1.9, 0.5, G - 0.5, M.paint, 0.06); cb.position.y = 0.78; R.add(cb);
  const xf = rbox(0.9, 0.42, G - 0.3, M.dark, 0.05); xf.position.y = 0.7; R.add(xf);
  const ring = cyl(1.0, 0.16, M.black, 'y', 40); ring.position.y = 1.08; R.add(ring);
  const up = new THREE.Group(); up.position.y = 1.16; R.add(up);
  const deck = rbox(3.9, 0.22, 2.5, M.paint, 0.04); deck.position.set(-0.6, 0.11, 0); up.add(deck);
  // counterweight: a slice of a 2.75 m radius ring in plan
  const cw = []; for (let i = 0; i <= 16; i++) { const a = Math.PI - 0.47 + (i / 16) * 0.94; cw.push([Math.cos(a) * 2.75, Math.sin(a) * 2.75]); } cw.push([-1.95, -1.25], [-1.95, 1.25]);
  const cwm = extrude(cw, 0.95, M.paint, 0.05); cwm.rotation.x = -Math.PI / 2; cwm.position.y = 0.22 + 0.475; up.add(cwm);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.77, 2.77, 0.12, 24, 1, true, -Math.PI / 2 - 0.42, 0.84), hazardMaterial()); stripe.position.y = 0.95; up.add(stripe);
  const hood = rbox(1.25, 0.72, 2.45, M.paint, 0.08); hood.position.set(-1.25, 0.58, 0); up.add(hood);
  for (const z of [0.55, -0.15]) { const gr = box(0.9, 0.02, 0.5, M.black); gr.position.set(-1.25, 0.95, z); up.add(gr); }
  const tank = rbox(1.0, 0.8, 0.85, M.paint, 0.06); tank.position.set(0.35, 0.62, 0.8); up.add(tank);
  const ex = exhaust(0.45, 0.06); ex.position.set(-1.0, 0.92, 0.85); up.add(ex);
  const c = cab(1.0, 1.65, 0.95); c.position.set(0.42, 0.22, -0.72); up.add(c);
  const bc = beacon(); bc.position.set(0.3, 1.97, -0.72); c.parent.add(bc); m.beacons.push(bc);
  for (const z of [-0.95, -0.5]) { const l = lamp(); l.position.set(0.95, 1.86, z); up.add(l); m.lamps.push(l); }
  up.add(handrail([[0.9, 0.45, 0.85], [-0.05, 0.45, 0.85], [-0.6, 1.2, 0.95]], 0.5));
  m.rot('swing', up, { axis: 'y', label: 'Swing', min: -180, max: 180, value: 0 });
  // boom
  const bp = new THREE.Group(); bp.position.set(0.72, 0.55, 0.12); up.add(bp);
  bp.add(pin(0.13, 0.62));
  const boomPts = [[0, 0], [1.1, 0.95], [2.55, 1.6], [3.9, 1.2], [5.6, 0.1]];
  bp.add(beam(boomPts, [0.5, 0.64, 0.68, 0.55, 0.36], 0.46, M.paint));
  const bl = lamp(); bl.position.set(1.2, 1.35, -0.28); bl.rotation.z = -0.3; bp.add(bl); m.lamps.push(bl);
  m.rot('boom', bp, { label: 'Boom', min: -38, max: 62, value: 22 });
  m.keymap = { swing: ['a', 'd'], stick: ['w', 's'], boom: ['k', 'i'], bucket: ['j', 'l'] };
  // stick
  const sk = new THREE.Group(); sk.position.set(5.6, 0.1, 0); bp.add(sk); sk.add(pin(0.1, 0.5));
  sk.add(beam([[-0.62, 0.3], [0, 0], [0.12, -1.2], [0.06, -2.9]], [0.42, 0.52, 0.42, 0.3], 0.36, M.paint));
  m.rot('stick', sk, { label: 'Stick', min: -55, max: 48, value: -28 });
  // bucket
  const bk = new THREE.Group(); bk.position.set(0.06, -2.9, 0); sk.add(bk); m.mount = bk;
  m.rot('bucket', bk, { label: 'Bucket', min: -140, max: 115, value: 30 });
  // rams
  for (const z of [0.36, -0.36]) m.ram(up, anchor(up, 1.25, 0.22, z), anchor(bp, 2.0, 0.78, z), ['boom'], 0.1, 0.06);
  m.ram(up, anchor(bp, 2.4, 2.05, 0), anchor(sk, -0.62, 0.3, 0), ['boom', 'stick'], 0.095, 0.055);
  const bra = anchor(sk, -0.32, -0.35, 0);
  m.toolRams = () => { m.rams = m.rams.filter((x) => { if (x.tool) { up.remove(x.g); return false; } return true; }); const lug = m.tool.userData.lug || anchor(m.tool, -0.32, 0.12, 0); const t = m.ram(up, bra, lug, ['boom', 'stick', 'bucket'], 0.085, 0.05); t.tool = true; };
  m.tools = {
    gp: { name: 'General-purpose bucket, 1.0 m³', price: 0, cap: 1.0, make: () => bucket(1.25, 1.45, 0.85, { teeth: 5 }) },
    rock: { name: 'Heavy-duty rock bucket, 1.2 m³', price: 3.2, cap: 1.2, make: () => bucket(1.35, 1.55, 0.9, { teeth: 5, heavy: true }) },
    ditch: { name: 'Ditch-cleaning bucket, 2.0 m', price: 2.1, cap: 0.9, make: () => bucket(2.0, 1.1, 0.6, { teeth: 0 }) },
    breaker: { name: 'Hydraulic breaker, 2,000 J class', price: 9.5, cap: 0, make: () => breaker(1.8, 0.17) },
  };
  m.setTool('gp');
  m.addHotspot('Cab', c, 'ROPS/FOPS-certified cab with joystick (ISO pattern) controls, climate control and a 7" monitor with rear and side cameras.', [0, 1.2, 0]);
  m.addHotspot('Engine', hood, 'Six-cylinder diesel, ≈110 kW, meeting Stage V / CEV-V emission rules with DOC, DPF and SCR after-treatment.', [0, 0.4, 0]);
  m.addHotspot('Counterweight', up, '≈3.8 t cast counterweight. Tail swing radius ≈2.8 m.', [-2.55, 0.7, 0]);
  m.addHotspot('Boom', bp, '5.7 m mono boom, box-section high-tensile steel, with two boom cylinders.', [2.6, 1.6, 0]);
  m.addHotspot('Stick', sk, '2.9 m stick. A longer stick trades breakout force for reach and depth.', [0.1, -1.4, 0]);
  m.addHotspot('Tracks', R, '600 mm triple-grouser shoes on sealed and lubricated track chain; 46 links per side.', [1.6, 0.9, 1.19]);
  m.addHotspot('Swing drive', R, 'Swing motor and planetary drive turn the upper structure on a slewing ring at ≈11 rpm.', [0, 1.1, 0.9]);
  m.demo = [[0, { swing: 0, boom: 22, stick: -28, bucket: 30 }], [1.5, { boom: 14, stick: 2, bucket: -50 }], [3.5, { boom: 3, stick: -50, bucket: 107 }], [4.8, { boom: 45, stick: -24, bucket: 39 }], [6.4, { swing: 90, boom: 53, stick: -5, bucket: 12 }], [7.4, { bucket: -140, stick: 10 }], [9, { swing: 0, boom: 22, stick: -28, bucket: 30 }]];
  m.calibrate();
  return m;
}

// ──────────────────────────────────────────────────────────── backhoe loader (≈8 t)
function backhoe() {
  const m = new Machine('backhoe'), R = m.root;
  m.drive = { kind: 'wheels', speed: 0, steer: 0, maxSpeed: 8, turn: 0.55 };
  const fr = 0.53, rr = 0.78;
  const ch = rbox(4.3, 0.5, 0.95, M.dark, 0.05); ch.position.set(-0.2, 0.85, 0); R.add(ch);
  for (const z of [0.95, -0.95]) steerable(m, R, fr, 0.42, 1.45, fr, z);
  for (const z of [0.98, -0.98]) wheelAt(m, R, rr, 0.5, -0.75, rr, z);
  const axle = cyl(0.09, 1.6, M.black); axle.position.set(-0.75, rr, 0); R.add(axle);
  const bonnet = extrude([[0, 0], [1.6, 0], [1.75, 0.2], [1.72, 0.78], [0.2, 0.95], [0, 0.95]], 1.0, M.paint, 0.06); bonnet.position.set(0.85, 1.05, 0); R.add(bonnet);
  const gr = grille(0.8, 0.5); gr.position.set(2.58, 1.45, 0); R.add(gr);
  for (const z of [0.42, -0.42]) { const l = lamp(0.08); l.position.set(2.55, 1.85, z); R.add(l); m.lamps.push(l); }
  for (const z of [0.98, -0.98]) { const f = fender(rr, 0.55, 0.15, Math.PI - 0.05); f.position.set(-0.75, rr, z); R.add(f); }
  for (const [i, z] of [[0, 0.95], [1, -0.95]]) { const f = fender(fr, 0.45, 0.3, Math.PI - 0.6); m.steerWheels[i].add(f); }
  const plat = rbox(2.0, 0.12, 1.95, M.dark, 0.03); plat.position.set(-0.4, 1.3, 0); R.add(plat);
  const c = cab(1.55, 1.6, 1.7, { slope: 0.05 }); c.position.set(-0.35, 1.36, 0); R.add(c);
  const bc = beacon(); bc.position.set(-0.6, 3.05, 0.6); R.add(bc); m.beacons.push(bc);
  for (const z of [0.75, -0.75]) { const l = lamp(0.06); l.position.set(-1.2, 2.95, z); l.rotation.y = Math.PI; R.add(l); m.lamps.push(l); }
  const ex = exhaust(0.6, 0.05); ex.position.set(1.0, 2.0, -0.35); R.add(ex);
  const tank = rbox(0.6, 0.55, 0.45, M.black, 0.05); tank.position.set(-1.45, 1.05, -0.75); R.add(tank);
  // front loader
  const la = new THREE.Group(); la.position.set(0.35, 2.0, 0); R.add(la);
  for (const z of [0.78, -0.78]) { const a = beam([[0, 0], [0.85, -0.12], [1.8, -0.72], [2.45, -1.45]], [0.2, 0.3, 0.26, 0.2], 0.12, M.paint); a.position.z = z; la.add(a); const p = pin(0.08, 0.2); p.position.z = z; la.add(p); }
  const xt = cyl(0.07, 1.56, M.paint); xt.position.set(1.8, -0.72, 0); la.add(xt);
  m.rot('lift', la, { label: 'Loader arms', min: -8, max: 52, value: 0 });
  const lb = new THREE.Group(); lb.position.set(2.45, -1.45, 0); la.add(lb);
  const lbk = loaderBucket(2.25, 1.0, 0.75, { teeth: 0 }); lb.add(lbk);
  m.rot('curl', lb, { label: 'Loader bucket', min: -80, max: 45, value: 10 });
  for (const z of [0.78, -0.78]) m.ram(R, anchor(R, 1.05, 1.05, z), anchor(la, 1.2, -0.42, z), ['lift'], 0.07, 0.04);
  m.ram(R, anchor(la, 1.0, 0.05, 0), anchor(lb, -0.2, 0.25, 0), ['lift', 'curl'], 0.065, 0.04);
  // rear backhoe
  const kp = new THREE.Group(); kp.position.set(-2.4, 1.05, 0); R.add(kp);
  kp.add(rbox(0.45, 0.7, 0.55, M.paint, 0.05));
  m.rot('swing', kp, { axis: 'y', label: 'Backhoe swing', min: -85, max: 85, value: 0 });
  const bm = new THREE.Group(); bm.position.set(-0.15, 0.15, 0); kp.add(bm); bm.add(pin(0.09, 0.4));
  bm.add(beam([[0, 0], [-0.45, 0.9], [-1.3, 1.65], [-2.4, 1.85], [-3.0, 1.6]], [0.32, 0.42, 0.4, 0.34, 0.26], 0.3, M.paint));
  m.rot('boom', bm, { label: 'Boom', min: -80, max: 45, value: -42 });
  m.keymap = { swing: ['a', 'd'], dipper: ['w', 's'], boom: ['k', 'i'], bucket: ['j', 'l'], extend: ['u', 'o'], lift: ['t', 'g'], curl: ['y', 'h'], stabs: ['r', 'f'] };
  const dp = new THREE.Group(); dp.position.set(-3.0, 1.6, 0); bm.add(dp); dp.add(pin(0.08, 0.32));
  dp.add(beam([[0.25, 0.35], [0, 0], [-0.05, -1.4]], [0.3, 0.32, 0.26], 0.24, M.paint));
  const ext = new THREE.Group(); dp.add(ext);
  { const inner = rbox(0.18, 1.3, 0.18, M.paint, 0.03); inner.position.set(-0.05, -1.45, 0); ext.add(inner); }
  m.rot('dipper', dp, { label: 'Dipper', min: -60, max: 70, value: 60 });
  m.lin('extend', ext, { axis: 'y', sign: -1, label: 'Extendahoe', min: 0, max: 1.0, value: 0 });
  const bb = new THREE.Group(); bb.position.set(-0.05, -2.1, 0); ext.add(bb);
  const flip = new THREE.Group(); flip.rotation.y = Math.PI; bb.add(flip); m.mount = flip;
  m.rot('bucket', bb, { label: 'Bucket', min: -170, max: 120, value: 10, sign: -1 });
  m.ram(kp, anchor(kp, 0.1, -0.15, 0), anchor(bm, -1.2, 1.25, 0), ['boom'], 0.08, 0.05);
  m.ram(kp, anchor(bm, -1.5, 2.0, 0), anchor(dp, 0.25, 0.35, 0), ['boom', 'dipper'], 0.07, 0.045);
  const dra = anchor(dp, 0.15, 0.1, 0);
  m.toolRams = () => { m.rams = m.rams.filter((x) => { if (x.tool) { kp.remove(x.g); return false; } return true; }); const t = m.ram(kp, dra, anchor(bb, 0.3, 0.12, 0), ['boom', 'dipper', 'extend', 'bucket'], 0.065, 0.04); t.tool = true; };
  // stabilisers
  const legs = [];
  for (const z of [1.0, -1.0]) {
    const leg = new THREE.Group(); leg.position.set(-2.15, 1.25, z * 0.85); R.add(leg); leg.add(pin(0.07, 0.25));
    const arm = beam([[0, 0], [0, -0.7], [0, -1.22]], [0.2, 0.18, 0.16], 0.16, M.paint); arm.rotation.y = Math.PI / 2; leg.add(arm);
    const foot = rbox(0.35, 0.06, 0.45, M.dark, 0.02); foot.position.set(0, -1.3, 0); leg.add(foot);
    legs.push([leg, z]);
  }
  const lg = legs[0][0], lg2 = legs[1][0];
  m.joint('stabs', { label: 'Stabilisers', min: 0, max: 1, value: 0, unit: '', apply: (v) => { const a = Math.PI - (Math.PI - 0.3) * v; lg.rotation.x = -a; lg2.rotation.x = a; } });
  m.tools = {
    std: { name: 'Standard digging bucket, 600 mm', price: 0, cap: 0.2, make: () => bucket(0.6, 0.85, 0.55, { teeth: 3 }) },
    wide: { name: 'Wide bucket, 900 mm', price: 0.7, cap: 0.28, make: () => bucket(0.9, 0.85, 0.55, { teeth: 4 }) },
    breaker: { name: 'Hydraulic breaker, 500 J class', price: 3.2, cap: 0, make: () => breaker(1.1, 0.11) },
    auger: { name: 'Earth auger, 300 mm', price: 2.4, cap: 0, make: () => auger(1.3, 0.16) },
  };
  m.setTool('std');
  m.addHotspot('Loader', la, 'Front shovel: 1.0 m³ bucket, ≈3.2 t lift capacity to full height, with return-to-dig.', [2.2, -0.6, 0.8]);
  m.addHotspot('Backhoe', bm, 'Rear excavator end with side swing of 180°. Dig depth ≈4.4 m, or ≈5.9 m with the extending dipper.', [-1.6, 1.8, 0]);
  m.addHotspot('Cab', c, 'Swivel seat for both ends, servo levers for the backhoe and a loader joystick. ROPS/FOPS.', [0, 1.2, 0]);
  m.addHotspot('Stabilisers', lg, 'Two hydraulic stabilisers lift the rear wheels off the ground for a solid digging base.', [0, -1, 0]);
  m.addHotspot('Engine', bonnet, 'Four-cylinder diesel, ≈55 kW (74 hp), with a 4-speed powershift or manual gearbox.', [0.9, 0.7, 0]);
  m.demo = [[0, { stabs: 0, swing: 0, boom: -42, dipper: 60, bucket: 10, extend: 0, lift: 0, curl: 10 }], [1.5, { stabs: 1 }], [3, { boom: -10, dipper: -11, bucket: 100, extend: 0.5 }], [4.6, { boom: -12, dipper: 25, bucket: 60 }], [5.8, { boom: -62, dipper: 22, bucket: 7 }], [7, { swing: 70 }], [8, { bucket: -160, dipper: -5 }], [9.5, { swing: 0, boom: -42, dipper: 60, bucket: 10, extend: 0 }], [10.5, { stabs: 0, lift: 30, curl: -20 }], [12, { lift: 0, curl: 10 }]];
  m.calibrate();
  return m;
}

// ──────────────────────────────────────────────────────────── wheel loader (≈19 t)
function wheelLoader() {
  const m = new Machine('loader'), R = m.root;
  m.drive = { kind: 'artic', speed: 0, steer: 0, maxSpeed: 8, turn: 0.5, wheelbase: 3.3 };
  const wr = 0.8, ww = 0.62, tz = 1.1;
  const front = new THREE.Group(); R.add(front);
  for (const z of [tz, -tz]) wheelAt(m, front, wr, ww, 1.65, wr, z);
  for (const z of [tz, -tz]) wheelAt(m, R, wr, ww, -1.65, wr, z);
  const ff = rbox(1.9, 0.75, 1.15, M.paint, 0.06); ff.position.set(1.3, 1.05, 0); front.add(ff);
  const tower = extrude([[0, 0], [0.9, 0], [0.55, 1.15], [0.05, 1.15]], 1.25, M.paint, 0.04); tower.position.set(0.55, 1.2, 0); front.add(tower);
  for (const z of [tz, -tz]) { const f = fender(wr, ww + 0.1, 0.25, Math.PI - 0.35); f.position.set(1.65, wr, z); front.add(f); }
  const hinge = cyl(0.18, 0.9, M.dark, 'y', 16); hinge.position.set(0, 1.0, 0); R.add(hinge);
  m.rot('steer', front, { axis: 'y', label: 'Articulation', min: -40, max: 40, value: 0 });
  // rear frame
  const rf = rbox(3.1, 0.75, 1.25, M.paint, 0.06); rf.position.set(-1.75, 1.05, 0); R.add(rf);
  for (const z of [tz, -tz]) { const f = fender(wr, ww + 0.15, 0.1, Math.PI - 0.15); f.position.set(-1.65, wr, z); R.add(f); }
  const plat = rbox(2.1, 0.1, 2.5, M.dark, 0.03); plat.position.set(-1.0, 1.48, 0); R.add(plat);
  const c = cab(1.45, 1.75, 1.45, { slope: 0.06 }); c.position.set(-0.55, 1.53, 0); R.add(c);
  const bc = beacon(); bc.position.set(-0.85, 3.4, 0.4); R.add(bc); m.beacons.push(bc);
  const hood = extrude([[0, 0], [2.0, 0], [2.0, 1.05], [0.25, 1.0], [0, 0.85]], 1.45, M.paint, 0.08); hood.rotation.y = Math.PI; hood.position.set(-1.35, 1.45, 0); R.add(hood);
  for (const z of [0.4, -0.4]) { const g = box(1.3, 0.02, 0.45, M.black); g.position.set(-2.45, 2.47, z); R.add(g); }
  const cw = rbox(0.55, 1.15, 2.3, M.paint, 0.12); cw.position.set(-3.5, 1.35, 0); R.add(cw);
  const gr = grille(1.6, 0.8); gr.position.set(-3.79, 1.4, 0); R.add(gr);
  const ex = exhaust(0.45, 0.07); ex.position.set(-1.8, 2.45, -0.45); R.add(ex);
  const air = cyl(0.12, 0.45, M.black, 'y'); air.position.set(-1.55, 2.68, 0.45); R.add(air);
  for (const z of [0.6, -0.6]) { const l = lamp(0.08); l.position.set(-0.15, 3.2, z); R.add(l); m.lamps.push(l); const l2 = lamp(0.09); l2.position.set(-3.8, 2.2, z); l2.rotation.y = Math.PI; R.add(l2); m.lamps.push(l2); }
  const lad = ladder(1.35, 0.42, 4); lad.position.set(-1.0, 0.15, -1.45); R.add(lad);
  R.add(handrail([[-0.2, -1.25, 1.53], [-1.8, -1.25, 1.53]], 0.9));
  // lift arms (Z-bar)
  const arms = new THREE.Group(); arms.position.set(0.95, 2.2, 0); front.add(arms);
  for (const z of [0.72, -0.72]) { const a = beam([[0, 0], [1.4, -0.32], [2.65, -1.35], [3.05, -1.62]], [0.36, 0.46, 0.38, 0.28], 0.14, M.paint); a.position.z = z; arms.add(a); const p = pin(0.1, 0.24); p.position.z = z; arms.add(p); }
  const xt = cyl(0.12, 1.5, M.paint); xt.position.set(1.55, -0.45, 0); arms.add(xt);
  const crank = beam([[0, 0.55], [0, 0], [0.12, -0.45]], [0.22, 0.26, 0.2], 0.16, M.paint); crank.position.set(1.55, -0.45, 0); arms.add(crank);
  m.rot('lift', arms, { label: 'Lift arms', min: -10, max: 46, value: -6 });
  const bk = new THREE.Group(); bk.position.set(3.05, -1.62, 0); arms.add(bk); m.mount = bk;
  m.rot('tilt', bk, { label: 'Bucket tilt', min: -80, max: 45, value: 8 });
  for (const z of [0.55, -0.55]) m.ram(front, anchor(front, 1.75, 0.85, z), anchor(arms, 1.15, -0.62, z), ['lift'], 0.11, 0.065);
  m.ram(front, anchor(front, 1.0, 1.95, 0), anchor(arms, 1.55, 0.1, 0), ['lift'], 0.11, 0.065);
  m.toolRams = () => { m.rams = m.rams.filter((x) => { if (x.tool) { front.remove(x.g); return false; } return true; }); const t = m.ram(arms, anchor(arms, 1.67, -0.9, 0), anchor(m.tool, -0.25, 0.5, 0), ['lift', 'tilt'], 0.07, 0.05); t.tool = true; };
  m.tools = {
    gp: { name: 'General-purpose bucket, 3.1 m³', price: 0, cap: 3.1, make: () => loaderBucket(2.9, 1.25, 1.05, { teeth: 7 }) },
    rock: { name: 'Rock bucket, 2.8 m³, teeth and segments', price: 4.5, cap: 2.8, make: () => loaderBucket(2.95, 1.2, 1.0, { teeth: 7, heavy: true }) },
    light: { name: 'Light-material bucket, 4.2 m³', price: 3.0, cap: 4.2, make: () => loaderBucket(3.1, 1.4, 1.25, { teeth: 0 }) },
    forks: { name: 'Pallet forks, 1.5 m tines', price: 2.2, cap: 0, make: () => forks(1.6, 1.5, { h: 1.1 }) },
  };
  m.setTool('gp');
  m.addHotspot('Z-bar linkage', arms, 'Z-bar linkage gives high breakout force (≈155 kN) and keeps the bucket angle steady while lifting.', [1.55, 0.2, 0]);
  m.addHotspot('Articulation', R, 'Centre-pivot articulated steering, ±40°. Rear wheels follow the front ones, so the loader turns tightly without scrubbing tyres.', [0, 1.4, 0]);
  m.addHotspot('Cab', c, 'Centre-mounted cab with joystick steering option, ride control and a load-weighing payload system.', [0, 1.3, 0]);
  m.addHotspot('Engine', hood, '≈140 kW six-cylinder diesel at the rear, which also serves as counterweight.', [1, 0.8, 0]);
  m.addHotspot('Tyres', R, '23.5R25 L3 radial tyres. Rock-service L5 tyres are an option for quarries.', [1.65, 0.8, 1.45]);
  m.demo = [[0, { lift: -6, tilt: 8, steer: 0 }], [1.5, { tilt: -2 }], [3, { tilt: 40, lift: 0 }], [5, { lift: 44, steer: 18 }], [6.5, { tilt: -75 }], [8, { tilt: 40 }], [9.5, { lift: -6, tilt: 8, steer: 0 }]];
  m.calibrate();
  return m;
}

// ──────────────────────────────────────────────────────────── crawler dozer (≈20 t)
function dozer() {
  const m = new Machine('dozer'), R = m.root;
  m.drive = { kind: 'tracks', speed: 0, steer: 0, maxSpeed: 2.5, turn: 0.5 };
  const L = 2.75, r = 0.42, W = 0.56, G = 1.88;
  for (const z of [G / 2, -G / 2]) { const t = track(L, r, W, { pitch: 0.2, rollers: 6 }); t.position.set(0, r + 0.035, z); t.userData.side = z > 0 ? 1 : -1; R.add(t); m.tracks.push(t); }
  const main = rbox(3.6, 0.6, 1.25, M.paint, 0.06); main.position.set(0.1, 1.05, 0); R.add(main);
  for (const z of [G / 2, -G / 2]) { const f = rbox(3.3, 0.06, 0.62, M.paint, 0.02); f.position.set(0, 1.0, z); R.add(f); }
  const hood = extrude([[0, 0], [1.75, 0], [1.75, 0.85], [0.1, 0.95], [0, 0.9]], 1.15, M.paint, 0.07); hood.position.set(-0.05, 1.35, 0); R.add(hood);
  const gr = grille(1.05, 0.75); gr.position.set(1.72, 1.75, 0); R.add(gr);
  const ex = exhaust(0.55, 0.07); ex.position.set(0.8, 2.25, 0.35); R.add(ex);
  const pre = cyl(0.13, 0.35, M.black, 'y'); pre.position.set(0.5, 2.4, -0.35); R.add(pre);
  const c = cab(1.35, 1.65, 1.55, { slope: 0.04 }); c.position.set(-0.8, 1.35, 0); R.add(c);
  const tank = rbox(0.55, 0.85, 1.6, M.paint, 0.06); tank.position.set(-1.75, 1.6, 0); R.add(tank);
  const bc = beacon(); bc.position.set(-1.0, 3.12, 0.5); R.add(bc); m.beacons.push(bc);
  for (const z of [0.55, -0.55]) { const l = lamp(0.08); l.position.set(-0.1, 3.05, z); R.add(l); m.lamps.push(l); const l2 = lamp(0.08); l2.position.set(-1.5, 3.05, z); l2.rotation.y = Math.PI; R.add(l2); m.lamps.push(l2); }
  // blade on push arms
  const bl = new THREE.Group(); bl.position.set(-0.15, 0.5, 0); R.add(bl);
  for (const z of [1.25, -1.25]) { const a = beam([[0, 0], [1.2, 0.02], [2.2, 0.1]], [0.22, 0.26, 0.24], 0.16, M.paint); a.position.z = z; bl.add(a); const p = pin(0.1, 0.22); p.position.z = z; bl.add(p); }
  const mb = new THREE.Group(); mb.position.set(2.35, -0.48, 0); bl.add(mb);
  const prof = []; for (let i = 0; i <= 16; i++) { const a = (235 - (i / 16) * 112) * D2R; prof.push([0.6 + Math.cos(a) * 0.72, 0.68 + Math.sin(a) * 0.72]); }
  const back = prof.slice().reverse().map(([x, y]) => [x - 0.1, y]);
  const moldboard = extrude([...prof, ...back], 3.4, M.paint, 0.02); mb.add(moldboard);
  for (const z of [1.65, -1.65]) { const s = extrude([[-0.15, 0.1], [0.12, 0.1], [0.05, 1.2], [-0.15, 1.25]], 0.05, M.paint, 0.01); s.position.z = z; mb.add(s); }
  const edge = box(0.06, 0.12, 3.4, M.worn); edge.position.set(0.15, 0.08, 0); mb.add(edge);
  for (const z of [1.1, -1.1]) { const rib = box(0.12, 0.9, 0.08, M.paint); rib.position.set(-0.08, 0.7, z); mb.add(rib); }
  m.rot('blade', bl, { label: 'Blade lift', min: -6, max: 22, value: 3 });
  m.rot('pitch', mb, { label: 'Blade pitch', min: -12, max: 12, value: 0 });
  m.rot('tilt', mb, { axis: 'x', label: 'Blade tilt', min: -8, max: 8, value: 0 });
  for (const z of [0.72, -0.72]) m.ram(R, anchor(R, 1.25, 2.15, z), anchor(mb, -0.12, 1.05, z), ['blade', 'pitch'], 0.09, 0.055);
  m.mount = mb; m.tools = { su: { name: 'Semi-U blade, 5.6 m³', price: 0, cap: 5.6, make: () => { const g = new THREE.Group(); g.userData = { kind: 'blade', tip: anchor(g, 0.2, 0.05) }; return g; } } };
  // ripper
  const rp = new THREE.Group(); rp.position.set(-2.05, 0.95, 0); R.add(rp);
  const rbeam = rbox(0.3, 0.25, 1.7, M.paint, 0.04); rbeam.position.set(-0.6, -0.1, 0); rp.add(rbeam);
  for (const z of [0.6, -0.6]) { const a = beam([[0, 0], [-0.6, -0.1]], [0.18, 0.16], 0.1, M.paint); a.position.z = z; rp.add(a); }
  for (const z of [0.55, 0, -0.55]) { const sh = extrude([[-0.08, 0.1], [0.08, 0.1], [0.12, -0.7], [0.3, -0.95], [0.05, -0.9], [-0.08, -0.6]], 0.07, M.worn, 0.01); sh.position.set(-0.6, -0.1, z); rp.add(sh); }
  m.rot('ripper', rp, { label: 'Ripper', min: -14, max: 16, value: 14 });
  for (const z of [0.4, -0.4]) m.ram(R, anchor(R, -1.8, 1.55, z), anchor(rp, -0.55, 0.05, z), ['ripper'], 0.08, 0.05);
  m.setTool('su');
  m.addHotspot('Blade', mb, 'Semi-U blade, 3.4 m wide, 5.6 m³ capacity. Hydraulic tilt for ditching and crowning.', [0.1, 1.0, 0]);
  m.addHotspot('Ripper', rp, 'Multi-shank parallelogram ripper for breaking hardpan and soft rock ahead of the blade.', [-0.6, -0.2, 0]);
  m.addHotspot('Undercarriage', R, 'Six track rollers per side, 560 mm shoes; ≈0.6 kg/cm² ground pressure.', [1.2, 0.5, 0.94]);
  m.addHotspot('Powertrain', hood, '≈160 kW diesel with an electronic powershift or a hydrostatic drive.', [1, 0.6, 0]);
  m.addHotspot('Cab', c, 'Sealed, pressurised cab over the rear, with a low hood line for a clear view of the blade corners.', [0, 1.2, 0]);
  m.demo = [[0, { blade: 3, ripper: 14, pitch: 0, tilt: 0 }], [1.5, { blade: -5 }], [3.5, { blade: -2, pitch: 6 }], [5, { blade: 18, pitch: -6 }], [6.5, { tilt: 7 }], [7.5, { tilt: -7 }], [8.5, { tilt: 0, blade: 3, pitch: 0 }], [9.5, { ripper: -12 }], [11.5, { ripper: 14 }]];
  m.calibrate();
  return m;
}

// ──────────────────────────────────────────────────────────── rigid haul truck (≈90 t payload)
function haulTruck() {
  const m = new Machine('truck'), R = m.root;
  m.drive = { kind: 'wheels', speed: 0, steer: 0, maxSpeed: 15, turn: 0.3 };
  const wr = 1.33, ww = 0.85;
  for (const z of [2.05, -2.05]) steerable(m, R, wr, ww, 2.6, wr, z);
  for (const z of [2.45, -2.45]) { const w = wheelAt(m, R, wr, ww, -1.75, wr, z, { dual: true }); w.userData.side = z > 0 ? 1 : -1; }
  const axle = cyl(0.35, 2.6, M.dark); axle.position.set(-1.75, wr, 0); R.add(axle);
  const diff = mesh(new THREE.SphereGeometry(0.62, 18, 12), M.dark); diff.position.set(-1.75, wr, 0); R.add(diff);
  for (const z of [0.62, -0.62]) { const rail = rbox(7.4, 0.55, 0.32, M.paint, 0.05); rail.position.set(0.2, 1.65, z); R.add(rail); }
  const eng = rbox(2.2, 1.6, 1.6, M.paint, 0.08); eng.position.set(3.0, 2.35, 0); R.add(eng);
  const rad = grille(1.7, 1.5, 0.08); rad.position.set(4.14, 2.35, 0); R.add(rad);
  const bump = rbox(0.6, 0.6, 5.2, M.paint, 0.06); bump.position.set(4.2, 1.3, 0); R.add(bump);
  const deck = rbox(2.4, 0.12, 5.7, M.paint, 0.03); deck.position.set(3.15, 3.2, 0); R.add(deck);
  R.add(handrail([[4.3, 2.8], [4.3, -2.8], [2.0, -2.8]].map(([x, z]) => [x, z, 3.26]), 0.95));
  for (const z of [2.3, -2.3]) { const f = fender(wr, ww + 0.25, 0.35, Math.PI - 0.6, 0.06); f.position.set(2.6, wr, z); R.add(f); }
  const c = cab(1.8, 1.8, 1.75, { slope: 0.05 }); c.position.set(3.15, 3.26, -1.75); R.add(c);
  const lad = ladder(2.8, 0.55, 8); lad.position.set(4.45, 0.4, 1.4); lad.rotation.z = 0.32; R.add(lad);
  for (const z of [1.6, 0.9, -0.9, -1.6]) { const l = lamp(0.11); l.position.set(4.52, 1.3, z); R.add(l); m.lamps.push(l); }
  const tank = rbox(1.2, 1.0, 0.8, M.black, 0.08); tank.position.set(0.8, 1.75, 1.35); R.add(tank);
  const ex = exhaust(0.8, 0.12); ex.position.set(2.2, 3.2, 1.6); R.add(ex);
  const bc = beacon(); bc.position.set(3.0, 5.12, -1.4); R.add(bc); m.beacons.push(bc);
  // dump body
  const bd = new THREE.Group(); bd.position.set(-3.75, 2.25, 0); R.add(bd);
  const sideProf = [[-0.55, 0.85], [0, 0], [6.9, 0.35], [6.9, 2.7], [8.55, 2.95], [8.55, 3.12], [6.6, 3.12], [6.2, 2.55], [0.6, 2.35], [-0.7, 1.35]];
  for (const z of [2.75, -2.75]) { const s = extrude(sideProf, 0.12, M.paint, 0.02); s.position.z = z; bd.add(s); }
  const flo = box(7.0, 0.12, 5.5, M.paint); flo.position.set(3.45, 0.2, 0); flo.rotation.z = Math.atan2(0.35, 6.9); bd.add(flo);
  const tail = box(1.0, 0.12, 5.5, M.paint); tail.position.set(-0.3, 0.45, 0); tail.rotation.z = -1.0; bd.add(tail);
  const fw = box(0.14, 2.5, 5.5, M.paint); fw.position.set(6.9, 1.55, 0); bd.add(fw);
  const canopy = box(1.75, 0.12, 5.6, M.paint); canopy.position.set(7.72, 3.02, 0); canopy.rotation.z = 0.15; bd.add(canopy);
  for (let i = 0; i < 5; i++) { const rib = box(0.16, 2.3, 0.14, M.paint); rib.position.set(1 + i * 1.3, 1.4, 2.85); bd.add(rib); const rib2 = rib.clone(); rib2.position.z = -2.85; bd.add(rib2); }
  const hz = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 5.4), hazardMaterial()); hz.position.set(-0.72, 1.25, 0); bd.add(hz);
  // load heap
  const heapG = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2); heapG.scale(3.2, 1, 2.55);
  const heap = mesh(heapG, M.soil); heap.position.set(3.5, 0.6, 0); heap.visible = false; bd.add(heap); m.loadMesh = heap;
  m.setLoad = (f) => { m.load = Math.max(0, Math.min(1, f)); heap.visible = m.load > 0.01; heap.scale.set(0.5 + 0.5 * m.load, 0.15 + 2.0 * m.load, 0.6 + 0.4 * m.load); heap.position.y = 0.4 + 0.3 * m.load; };
  m.rot('body', bd, { label: 'Body raise', min: 0, max: 48, value: 0 });
  for (const z of [1.0, -1.0]) m.ram(R, anchor(R, -0.2, 1.45, z), anchor(bd, 3.0, 0.15, z), ['body'], 0.17, 0.11);
  m.addHotspot('Dump body', bd, '≈60 m³ heaped body for ≈90 t payloads; exhaust-heated floor stops sticky material freezing in.', [3.5, 2.6, 0]);
  m.addHotspot('Cab', c, 'Upper-deck cab with payload monitoring, retarder control and blind-spot cameras.', [0, 1.2, 0]);
  m.addHotspot('Engine', eng, '≈760 kW (1,020 hp) V12 diesel driving a 7-speed powershift and a mechanical drive.', [0.6, 0.6, 0]);
  m.addHotspot('Tyres', R, '27.00R49 radials, ≈2.7 m tall. Rear duals carry about two-thirds of the loaded weight.', [-1.75, 2.6, 2.9]);
  m.addHotspot('Hoist', R, 'Two-stage hoist cylinders raise the body in ≈13 s and lower it in ≈11 s.', [-0.2, 2.0, 1.0]);
  m.demo = [[0, { body: 0, '_load': 1 }], [2, { body: 0 }], [6, { body: 48 }], [8, { body: 48 }], [11, { body: 0 }]];
  m.joint('_load', { label: 'Load', min: 0, max: 1, value: 0, unit: '', apply: (v) => m.setLoad?.(v) });
  m.onUpdate = () => { if (m.get('body') > 20 && m.load > 0) m.setLoad(m.load - 0.012 * (m.get('body') - 20) / 28); };
  m.calibrate();
  return m;
}

// ──────────────────────────────────────────────────────────── motor grader (≈16 t)
function grader() {
  const m = new Machine('grader'), R = m.root;
  m.drive = { kind: 'wheels', speed: 0, steer: 0, maxSpeed: 10, turn: 0.35 };
  const wr = 0.66, ww = 0.42;
  for (const z of [1.05, -1.05]) steerable(m, R, wr, ww, 4.6, wr, z);
  for (const x of [-1.25, -2.85]) for (const z of [1.05, -1.05]) wheelAt(m, R, wr, ww, x, wr, z);
  for (const z of [0.82, -0.82]) { const tb = rbox(2.2, 0.38, 0.2, M.paint, 0.05); tb.position.set(-2.05, wr, z); R.add(tb); }
  const fax = cyl(0.08, 2.0, M.dark); fax.position.set(4.6, wr, 0); R.add(fax);
  const frame = beam([[-0.6, 1.55], [1.2, 1.95], [3.4, 1.85], [4.65, 1.15]], [0.48, 0.5, 0.45, 0.4], 0.36, M.paint); R.add(frame);
  const push = rbox(0.18, 0.5, 1.8, M.paint, 0.04); push.position.set(5.25, 0.9, 0); R.add(push);
  const pushArm = beam([[4.65, 1.15], [5.2, 0.95]], [0.25, 0.25], 0.3, M.paint); R.add(pushArm);
  const plat = rbox(2.2, 0.12, 2.3, M.dark, 0.03); plat.position.set(-0.6, 1.5, 0); R.add(plat);
  const c = cab(1.45, 1.8, 1.55, { slope: 0.05 }); c.position.set(-0.45, 1.56, 0); R.add(c);
  const eng = extrude([[0, 0], [2.4, 0], [2.4, 0.95], [0.2, 1.1], [0, 1.05]], 1.6, M.paint, 0.07); eng.rotation.y = Math.PI; eng.position.set(-1.35, 1.25, 0); R.add(eng);
  const gr = grille(1.3, 0.75); gr.position.set(-3.77, 1.75, 0); R.add(gr);
  const ex = exhaust(0.5, 0.06); ex.position.set(-2.0, 2.3, 0.45); R.add(ex);
  const bc = beacon(); bc.position.set(-0.7, 3.47, 0.5); R.add(bc); m.beacons.push(bc);
  for (const z of [0.6, -0.6]) { const l = lamp(0.08); l.position.set(0.3, 3.3, z); R.add(l); m.lamps.push(l); }
  // drawbar, circle, moldboard
  const dw = new THREE.Group(); R.add(dw);
  const drawbar = beam([[4.45, 1.0], [2.5, 0.75], [1.35, 0.62]], [0.24, 0.22, 0.2], 0.9, M.paint); dw.add(drawbar);
  const ci = new THREE.Group(); ci.position.set(1.35, 0.55, 0); dw.add(ci);
  const ringG = new THREE.TorusGeometry(0.85, 0.07, 8, 40); ringG.rotateX(Math.PI / 2); ci.add(mesh(ringG, M.dark));
  for (const z of [0.95, -0.95]) { const hang = box(0.18, 0.5, 0.12, M.paint); hang.position.set(-0.1, -0.2, z); ci.add(hang); }
  const sh = new THREE.Group(); sh.position.set(-0.3, -0.38, 0); ci.add(sh);
  const prof = []; for (let i = 0; i <= 14; i++) { const a = (235 - (i / 14) * 112) * D2R; prof.push([0.38 + Math.cos(a) * 0.46, 0.33 + Math.sin(a) * 0.46]); }
  const backP = prof.slice().reverse().map(([x, y]) => [x - 0.06, y]);
  const mold = extrude([...prof, ...backP], 3.7, M.paint, 0.015); mold.position.y = -0.18; sh.add(mold);
  const edge = box(0.05, 0.12, 3.7, M.worn); edge.position.set(0.12, -0.13, 0); sh.add(edge);
  m.rot('circle', ci, { axis: 'y', label: 'Circle (blade angle)', min: -60, max: 60, value: 30 });
  m.lin('lift', dw, { axis: 'y', label: 'Blade lift', min: -0.08, max: 0.35, value: 0.15 });
  m.lin('shift', sh, { axis: 'z', label: 'Side shift', min: -0.6, max: 0.6, value: 0 });
  for (const z of [0.6, -0.6]) m.ram(R, anchor(R, 1.6, 2.15, z), anchor(dw, 1.6, 0.75, z), ['lift'], 0.08, 0.05);
  m.mount = sh; m.tools = { blade: { name: 'Moldboard, 3.7 m', price: 0, cap: 0, make: () => { const g = new THREE.Group(); g.userData = { kind: 'blade', tip: anchor(g, 0.15, -0.2, 1.6) }; return g; } } };
  m.setTool('blade');
  m.addHotspot('Moldboard', sh, '3.7 m moldboard on a 360° circle, with side shift and lift. Grade control (GNSS or laser) holds the edge to ±15 mm.', [0.2, 0.3, 0]);
  m.addHotspot('Circle', ci, 'The circle sets the blade angle so material rolls off the trailing end as a windrow.', [0.6, 0, 0.6]);
  m.addHotspot('Tandems', R, 'Tandem rear drive with oscillating bogies keeps all four rear tyres on the ground.', [-2.05, 1.1, 1.3]);
  m.addHotspot('Cab', c, 'High-visibility cab with sloped front glass to see the blade heel and toe.', [0, 1.3, 0]);
  m.addHotspot('Engine', eng, '≈140 kW six-cylinder diesel at the rear, with variable horsepower by gear.', [1.2, 0.8, 0]);
  m.demo = [[0, { circle: 30, lift: 0.15, shift: 0 }], [2, { lift: -0.05 }], [4, { circle: -30, shift: 0.5 }], [6, { shift: -0.5 }], [8, { circle: 30, lift: 0.15, shift: 0 }]];
  m.calibrate();
  return m;
}

// ──────────────────────────────────────────────────────────── telescopic handler (≈3.5 t / 9.5 m)
function telehandler() {
  const m = new Machine('telehandler'), R = m.root;
  m.drive = { kind: 'wheels', speed: 0, steer: 0, maxSpeed: 8, turn: 0.5 };
  const wr = 0.62, ww = 0.5;
  for (const z of [0.95, -0.95]) steerable(m, R, wr, ww, 1.45, wr, z);
  for (const z of [0.95, -0.95]) steerable(m, R, wr, ww, -1.45, wr, z);
  const ch = rbox(4.3, 0.55, 1.25, M.paint, 0.06); ch.position.set(0, 0.85, 0); R.add(ch);
  for (const x of [1.45, -1.45]) for (const z of [0.95, -0.95]) { const f = fender(wr, ww + 0.1, 0.3, Math.PI - 0.3); f.position.set(x, wr, z); R.add(f); }
  const c = cab(1.85, 1.75, 0.95, { slope: 0.08 }); c.position.set(-0.05, 1.05, -0.62); R.add(c);
  const pod = extrude([[0, 0], [2.1, 0], [2.1, 0.65], [0.3, 0.85], [0, 0.85]], 0.75, M.paint, 0.07); pod.rotation.y = Math.PI; pod.position.set(0.4, 1.1, 0.62); R.add(pod);
  const cw = rbox(0.45, 0.85, 2.0, M.paint, 0.1); cw.position.set(-2.25, 1.1, 0); R.add(cw);
  const ex = exhaust(0.35, 0.05); ex.position.set(-0.9, 1.95, 0.85); R.add(ex);
  const bc = beacon(); bc.position.set(-0.4, 2.9, -0.62); R.add(bc); m.beacons.push(bc);
  for (const z of [0.6, -0.6]) { const l = lamp(0.07); l.position.set(-2.48, 1.4, z); l.rotation.y = Math.PI; R.add(l); m.lamps.push(l); }
  // boom: outer, middle and inner sections
  const bm = new THREE.Group(); bm.position.set(-1.9, 1.75, 0.18); R.add(bm); bm.add(pin(0.12, 0.62));
  const outer = rbox(4.4, 0.5, 0.48, M.paint, 0.04); outer.position.set(1.9, 0, 0); bm.add(outer);
  const s2 = new THREE.Group(); bm.add(s2); const mid = rbox(4.0, 0.4, 0.38, M.paint, 0.03); mid.position.set(2.3, 0, 0); s2.add(mid);
  const s3 = new THREE.Group(); s2.add(s3); const inn = rbox(3.8, 0.32, 0.3, M.paint, 0.03); inn.position.set(2.6, 0, 0); s3.add(inn);
  const headG = rbox(0.4, 0.45, 0.4, M.paint, 0.04); headG.position.set(4.55, -0.05, 0); s3.add(headG);
  const carr = new THREE.Group(); carr.position.set(4.7, -0.12, 0); s3.add(carr); m.mount = carr;
  m.rot('boom', bm, { label: 'Boom angle', min: -3, max: 68, value: 0 });
  m.joint('extend', { label: 'Telescope', min: 0, max: 3.6, value: 0, unit: 'm', apply: (v) => { s2.position.x = v / 2; s3.position.x = v / 2; } });
  m.joint('tilt', { label: 'Carriage tilt', min: -80, max: 40, value: 0, apply: () => {} });
  m.onUpdate = () => { carr.rotation.z = -bm.rotation.z + m.get('tilt') * D2R; };   // automatic fork levelling
  m.ram(R, anchor(R, 0.35, 0.95, 0.18), anchor(bm, 1.75, -0.28, 0), ['boom'], 0.11, 0.065);
  // front stabilisers
  const st = new THREE.Group(); st.position.set(2.15, 0.8, 0); R.add(st);
  const legs = []; for (const z of [0.55, -0.55]) { const leg = new THREE.Group(); leg.position.z = z; st.add(leg); const a = rbox(0.14, 0.75, 0.14, M.paint, 0.02); a.position.y = -0.3; leg.add(a); const f = rbox(0.4, 0.05, 0.3, M.dark, 0.02); f.position.y = -0.68; leg.add(f); legs.push(leg); }
  m.joint('stabs', { label: 'Stabilisers', min: 0, max: 1, value: 0, unit: '', apply: (v) => { legs[0].rotation.x = -(1 - v) * 1.2; legs[1].rotation.x = (1 - v) * 1.2; } });
  m.tools = {
    forks: { name: 'Pallet forks, 1.2 m', price: 0, cap: 0, make: () => forks(1.0, 1.2, { h: 0.95 }) },
    bucket: { name: 'Bulk bucket, 1.5 m³', price: 1.4, cap: 1.5, make: () => loaderBucket(2.2, 1.0, 0.85, { teeth: 0 }) },
    hook: { name: 'Lifting hook and jib', price: 1.8, cap: 0, make: () => { const g = new THREE.Group(); const j = rbox(1.6, 0.18, 0.18, M.paint, 0.02); j.position.set(0.8, -0.1, 0); g.add(j); const rope = cyl(0.01, 1.2, M.black, 'y', 6); rope.position.set(1.55, -0.75, 0); g.add(rope); const hk = mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 16, Math.PI * 1.5), M.red); hk.position.set(1.55, -1.42, 0); g.add(hk); g.userData = { kind: 'hook', tip: anchor(g, 1.55, -1.45) }; return g; } },
  };
  m.setTool('forks');
  m.addHotspot('Boom', bm, 'Three-section telescopic boom: ≈9.5 m lift height, ≈6.5 m forward reach. Load charts limit capacity at reach.', [2.5, 0.35, 0]);
  m.addHotspot('Carriage', carr, 'Automatic fork levelling keeps the load flat as the boom rises; quick-hitch for buckets, jibs and platforms.', [0.3, -0.3, 0]);
  m.addHotspot('Stabilisers', st, 'Front stabilisers must be down for maximum reach; a load moment indicator cuts unsafe movements.', [0, -0.3, 0]);
  m.addHotspot('Cab', c, 'Side-mounted cab with a single joystick for boom, telescope and tilt; three steering modes.', [0, 1.2, 0]);
  m.addHotspot('Engine', pod, '≈81 kW four-cylinder diesel in a side pod, with a hydrostatic or powershift drive.', [1, 0.5, 0]);
  m.demo = [[0, { boom: 0, extend: 0, tilt: 0, stabs: 0 }], [1.5, { stabs: 1 }], [5, { boom: 55, extend: 2.5 }], [6.5, { extend: 3.6, tilt: 8 }], [8, { tilt: 0 }], [11, { boom: 0, extend: 0 }], [12, { stabs: 0 }]];
  m.calibrate();
  return m;
}

// ──────────────────────────────────────────────────────────── skid steer (≈3 t)
function skidSteer() {
  const m = new Machine('skid'), R = m.root;
  m.drive = { kind: 'tracks', speed: 0, steer: 0, maxSpeed: 3.3, turn: 0.9 };
  const wr = 0.4, ww = 0.32;
  for (const x of [0.55, -0.55]) for (const z of [0.82, -0.82]) wheelAt(m, R, wr, ww, x, wr, z);
  const body = extrude([[-1.2, 0.35], [0.85, 0.35], [0.95, 0.6], [0.95, 1.15], [-0.65, 1.15], [-1.2, 1.4], [-1.25, 0.35]], 1.25, M.paint, 0.06); R.add(body);
  const c = cab(1.0, 1.15, 0.9, { slope: 0.1 }); c.position.set(0.2, 1.05, 0); R.add(c);
  for (const z of [0.47, -0.47]) for (let i = 0; i < 4; i++) { const bar = box(0.6, 0.025, 0.025, M.black); bar.position.set(0.2, 1.4 + i * 0.22, z); R.add(bar); }
  const towers = []; for (const z of [0.72, -0.72]) { const t = extrude([[-0.15, 0], [0.25, 0], [0.12, 0.85], [-0.12, 0.85]], 0.12, M.paint, 0.02); t.position.set(-0.95, 1.05, z); R.add(t); towers.push(t); }
  const grl = grille(0.9, 0.6); grl.position.set(-1.27, 0.85, 0); grl.rotation.y = Math.PI; R.add(grl);
  for (const z of [0.4, -0.4]) { const l = lamp(0.06); l.position.set(0.68, 2.05, z); R.add(l); m.lamps.push(l); }
  const bc = beacon(); bc.position.set(0.1, 2.25, 0.3); R.add(bc); m.beacons.push(bc);
  const ex = exhaust(0.3, 0.04); ex.position.set(-0.95, 1.4, 0.3); R.add(ex);
  const arms = new THREE.Group(); arms.position.set(-0.92, 1.88, 0); R.add(arms);
  for (const z of [0.78, -0.78]) { const a = beam([[0, 0], [1.1, -0.15], [1.95, -0.85], [2.15, -1.4]], [0.22, 0.24, 0.2, 0.16], 0.1, M.paint); a.position.z = z; arms.add(a); const p = pin(0.07, 0.14); p.position.z = z; arms.add(p); }
  const xt = cyl(0.06, 1.56, M.paint); xt.position.set(1.95, -0.85, 0); arms.add(xt);
  m.rot('lift', arms, { label: 'Lift arms', min: -3, max: 58, value: 0 });
  const qa = new THREE.Group(); qa.position.set(2.15, -1.4, 0); arms.add(qa); m.mount = qa;
  m.rot('tilt', qa, { label: 'Tilt', min: -80, max: 40, value: 8 });
  for (const z of [0.78, -0.78]) m.ram(R, anchor(R, -0.75, 0.75, z), anchor(arms, 1.0, -0.3, z), ['lift'], 0.065, 0.04);
  m.toolRams = () => { m.rams = m.rams.filter((x) => { if (x.tool) { arms.remove(x.g); return false; } return true; }); for (const z of [0.5, -0.5]) { const t = m.ram(arms, anchor(arms, 1.8, -0.55, z), anchor(m.tool, -0.05, 0.45, z), ['lift', 'tilt'], 0.055, 0.035); t.tool = true; } };
  
  m.tools = {
    bucket: { name: 'Dirt bucket, 0.45 m³', price: 0, cap: 0.45, make: () => loaderBucket(1.8, 0.7, 0.6, { teeth: 0 }) },
    forks: { name: 'Pallet forks', price: 0.6, cap: 0, make: () => forks(1.2, 1.1, { h: 0.85 }) },
    auger: { name: 'Auger, 450 mm', price: 1.6, cap: 0, make: () => auger(1.2, 0.22) },
    sweeper: { name: 'Pick-up sweeper', price: 1.9, cap: 0, make: () => sweeper(1.8) },
  };
  m.setTool('bucket');
  m.addHotspot('Lift arms', arms, 'Radial lift path: 900 kg rated operating capacity, 3.0 m hinge-pin height.', [1.2, 0.1, 0.8]);
  m.addHotspot('Quick coupler', qa, 'Universal quick-attach plate with auxiliary hydraulics for 70+ attachments.', [0, 0.2, 0]);
  m.addHotspot('Drive', R, 'Skid steering: each side drives through chains, so the machine turns on the spot.', [0, 0.5, 0.95]);
  m.addHotspot('Cab', c, 'Enclosed ROPS/FOPS cab with a seat-bar interlock and pilot joysticks.', [0, 1.0, 0]);
  m.demo = [[0, { lift: 0, tilt: 8 }], [1.5, { tilt: -6 }], [3, { tilt: 35 }], [5, { lift: 55 }], [6.5, { tilt: -78 }], [8, { tilt: 8 }], [10, { lift: 0 }]];
  m.calibrate();
  return m;
}

export const BUILDERS = { excavator, backhoe, loader: wheelLoader, dozer, truck: haulTruck, grader, telehandler, skid: skidSteer };
