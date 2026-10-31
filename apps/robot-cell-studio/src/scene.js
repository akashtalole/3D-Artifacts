/** three.js work cell: robot meshes posed from FK, cell equipment per task, effects. Robot frame is Z-up. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MOTORS, TOOLS, DIRS, fk, isLinear } from './robot.js';

const M = new Map();
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!M.has(k)) M.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.2, ...o })); return M.get(k); };
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UP = new THREE.Vector3(0, 1, 0);
function alignY(obj, from, to) {   // place a Y-axis mesh between two points
  const a = V(from), b = V(to), d = b.clone().sub(a), L = d.length();
  obj.position.copy(a).addScaledVector(d, 0.5);
  if (L > 1e-6) obj.quaternion.setFromUnitVectors(UP, d.normalize());
  return L;
}
const mat3to4 = (R, p) => new THREE.Matrix4().set(R[0], R[1], R[2], p[0], R[3], R[4], R[5], p[1], R[6], R[7], R[8], p[2], 0, 0, 0, 1);

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#1b2129');
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 200);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = 0.1; controls.maxPolarAngle = Math.PI * 0.495;
  scene.add(new THREE.HemisphereLight('#eef4ff', '#3a3530', 0.8));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2); sun.position.set(4, 9, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const world = new THREE.Group(); world.rotation.x = -Math.PI / 2; scene.add(world);   // children use robot coordinates (Z up)
  // floor
  const floorTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#8b9096'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); } g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; for (let i = 0; i <= 512; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 })); floor.receiveShadow = true; world.add(floor);

  const robotG = new THREE.Group(); world.add(robotG);
  const cellG = new THREE.Group(); world.add(cellG);
  const fxG = new THREE.Group(); world.add(fxG);
  const envelope = new THREE.Group(); world.add(envelope);
  const framesG = new THREE.Group(); world.add(framesG); framesG.visible = false;

  // TCP target for drag-jogging
  const target = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshBasicMaterial({ color: '#41b6ff', depthTest: false, transparent: true, opacity: 0.9 }));
  target.renderOrder = 10; world.add(target); target.visible = false;
  const tc = new TransformControls(camera, canvas); tc.setSize(0.8); tc.attach(target); tc.enabled = false;
  const tcHelper = tc.getHelper ? tc.getHelper() : tc; scene.add(tcHelper); tcHelper.visible = false;
  tc.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; });

  let R = null;   // robot visuals
  const S = { robot: null, parts: [], attached: null, sparks: null, bead: null, beadPts: [], light: null, fence: null, layout: null };

  function buildRobot(robot) {
    robotG.clear(); framesG.clear();
    const col = robot.color, dark = new THREE.Color(col).multiplyScalar(0.55).getStyle();
    const m1 = mat(col, { roughness: 0.38, metalness: 0.15 }), m2 = mat('#2b3038', { roughness: 0.5, metalness: 0.5 }), m3 = mat(dark);
    const v = { joints: [], links: [], rails: [], tool: null, robot };
    const gantry = robot.modules[0]?.joint === 'slide' && robot.base > 1;
    if (gantry) {
      const ax = robot.modules[0], bx = robot.modules[1] || ax;
      const xr = [ax.min - 0.2, ax.max + 0.2], yr = [bx.min - 0.25, bx.max + 0.25], h = robot.base + 0.15;
      for (const x of xr) for (const y of yr) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, h), m3); p.position.set(x, y, h / 2); p.castShadow = true; robotG.add(p); }
      for (const y of yr) { const b = new THREE.Mesh(new THREE.BoxGeometry(xr[1] - xr[0] + 0.12, 0.14, 0.16), m1); b.position.set((xr[0] + xr[1]) / 2, y, h); b.castShadow = true; robotG.add(b); }
    } else {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, Math.max(0.02, robot.base), 32), m2); ped.rotation.x = Math.PI / 2; ped.position.z = robot.base / 2; ped.castShadow = ped.receiveShadow = true; robotG.add(ped);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.03), m2); plate.position.z = 0.015; plate.receiveShadow = true; robotG.add(plate);
    }
    robot.modules.forEach((mod, i) => {
      const mo = MOTORS[mod.size];
      const g = new THREE.Group(); robotG.add(g);
      let housing;
      if (isLinear(mod)) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(mo.r * 1.1, 1, mo.r * 0.8), m3); rail.castShadow = true; robotG.add(rail); v.rails.push(rail);
        housing = new THREE.Mesh(new THREE.BoxGeometry(mo.r * 2.2, mo.r * 1.6, mo.r * 2.2), m1);
      } else {
        v.rails.push(null);
        housing = new THREE.Mesh(new THREE.CylinderGeometry(mo.r, mo.r, mo.r * 2.1, 32), m1);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(mo.r * 0.55, mo.r * 0.55, mo.r * 2.18, 24), m2); housing.add(cap);
      }
      housing.castShadow = true; g.add(housing);
      const link = new THREE.Mesh(new THREE.CylinderGeometry(mo.r * 0.72, mo.r * 0.8, 1, 24), m1); link.castShadow = true; robotG.add(link);
      v.joints.push({ g, housing }); v.links.push(link);
      const ax = new THREE.AxesHelper(0.18); ax.material.depthTest = false; ax.renderOrder = 9; framesG.add(ax);
    });
    // tool
    const tool = new THREE.Group(); robotG.add(tool); v.tool = tool;
    const tdef = TOOLS[robot.tool], inner = new THREE.Group(); tool.add(inner); v.toolInner = inner;
    const tm = mat('#3a4049', { metalness: 0.6 }), steel = mat('#c9ced6', { metalness: 0.8, roughness: 0.3 });
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 24), steel); flange.position.y = 0.0125; inner.add(flange);
    if (robot.tool === 'gripper') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.06), tm); body.position.y = 0.06; inner.add(body);
      v.fingers = [-1, 1].map((sd) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.075, 0.04), steel); f.position.set(sd * 0.04, tdef.len - 0.035, 0); inner.add(f); return f; });
    } else if (robot.tool === 'vacuum') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 20), tm); body.position.y = 0.065; inner.add(body);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.022, 0.03, 24), mat('#1d1f22', { roughness: 0.9 })); cup.position.y = tdef.len - 0.015; inner.add(cup);
    } else if (robot.tool === 'torch') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.12, 20), tm); body.position.y = 0.07; inner.add(body);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, tdef.len - 0.13, 16), steel); neck.position.y = 0.13 + (tdef.len - 0.13) / 2; inner.add(neck);
      const cable = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 24, Math.PI), mat('#111')); cable.position.set(0.08, 0.06, 0); inner.add(cable);
    } else {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.15, 20), mat('#2f6fd6')); body.position.y = 0.09; inner.add(body);
      v.bit = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, tdef.len - 0.165, 8), steel); v.bit.position.y = 0.165 + (tdef.len - 0.165) / 2; inner.add(v.bit);
    }
    tool.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    R = v; S.robot = robot;
  }

  function pose(robot, q, toolState) {
    if (!R) return null;
    const F = fk(robot, q);
    robot.modules.forEach((mod, i) => {
      const j = F.joints[i], vis = R.joints[i];
      if (isLinear(mod)) {
        const rail = R.rails[i], a = j.axis;
        const p0 = [j.origin[0] + a[0] * mod.min, j.origin[1] + a[1] * mod.min, j.origin[2] + a[2] * mod.min], p1 = [j.origin[0] + a[0] * mod.max, j.origin[1] + a[1] * mod.max, j.origin[2] + a[2] * mod.max];
        const L = alignY(rail, p0, p1); rail.scale.y = Math.max(0.01, L + 0.15);
        vis.g.position.copy(V(j.start)); vis.g.quaternion.setFromUnitVectors(UP, V(a).normalize());
      } else {
        vis.g.position.copy(V(j.origin)); vis.g.quaternion.setFromUnitVectors(UP, V(j.axis).normalize());
      }
      const link = R.links[i];
      const L = alignY(link, j.start, j.end); link.scale.y = Math.max(0.001, L); link.visible = L > 0.01;
      const ax = framesG.children[i]; if (ax) { ax.matrix.copy(mat3to4(j.frame.R, j.frame.p)); ax.matrixAutoUpdate = false; }
    });
    // tool: flange frame, then rotate local Y onto the tool direction
    const fl = F.flange, tdir = DIRS[robot.modules.at(-1).dir];
    R.tool.matrixAutoUpdate = false; R.tool.matrix.copy(mat3to4(fl.R, fl.p));
    R.toolInner.quaternion.setFromUnitVectors(UP, V(tdir));
    if (R.fingers) { const open = toolState?.closed ? 0.022 : 0.045; R.fingers.forEach((f, k) => { f.position.x += ((k ? 1 : -1) * open - f.position.x) * 0.3; }); }
    if (R.bit && toolState?.spin) R.bit.rotation.y += 0.6;
    return F;
  }

  // ── cell ──
  function buildCell(layout, robot, spec) {
    cellG.clear(); S.parts = []; S.attached = null; S.layout = layout; clearBead();
    const reach = spec.reachH || 1.4;
    // safety fence
    const half = Math.max(1.6, reach + 0.75), fh = 1.8;
    const fenceM = new THREE.MeshStandardMaterial({ color: '#f2c94c', roughness: 0.5, metalness: 0.3 });
    const meshM = new THREE.MeshStandardMaterial({ color: '#3b4048', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const fence = new THREE.Group(); cellG.add(fence); S.fence = fence;
    const side = (x0, y0, x1, y1, gate) => {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L / 1.2);
      for (let k = 0; k <= n; k++) { const t = k / n, p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, fh), fenceM); p.position.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, fh / 2); p.castShadow = true; fence.add(p); }
      for (let k = 0; k < n; k++) { if (gate && k === Math.floor(n / 2)) continue; const t = (k + 0.5) / n; const pnl = new THREE.Mesh(new THREE.PlaneGeometry(L / n - 0.06, fh - 0.25), meshM); pnl.position.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, fh / 2 + 0.05); pnl.rotation.x = Math.PI / 2; pnl.rotation.y = Math.atan2(y1 - y0, x1 - x0); fence.add(pnl); }
    };
    side(-half, -half, half, -half); side(half, -half, half, half); side(half, half, -half, half); side(-half, half, -half, -half, true);
    // safety zone stripe
    const ring = new THREE.Mesh(new THREE.RingGeometry(reach + 0.18, reach + 0.26, 96), new THREE.MeshBasicMaterial({ color: '#e8b923', transparent: true, opacity: 0.85 })); ring.position.z = 0.003; cellG.add(ring);
    // controller cabinet, light tower, operator outside
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.6), mat('#d9dde2')); cab.position.set(-half - 0.6, -half * 0.4, 0.8); cab.castShadow = true; cellG.add(cab);
    const tower = new THREE.Group(); tower.position.set(half - 0.1, half - 0.1, fh); cellG.add(tower);
    S.light = ['#ff3b30', '#ffcc00', '#34c759'].map((c, k) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.1 })); l.rotation.x = Math.PI / 2; l.position.z = 0.3 - k * 0.09; tower.add(l); return l; });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), mat('#555')); pole.rotation.x = Math.PI / 2; pole.position.z = 0.05; tower.add(pole);
    const op = person(); op.position.set(-half - 0.7, half * 0.3, 0); op.rotation.z = -Math.PI / 2; cellG.add(op);
    const pend = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.28), mat('#2b2f36')); pend.position.set(-half - 0.45, half * 0.3, 1.1); cellG.add(pend);
    if (layout.kind === 'palletize') buildPalletize(layout);
    if (layout.kind === 'weld') buildTable(layout, 'weld');
    if (layout.kind === 'screw') buildTable(layout, 'screw');
    cellG.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow || false; o.receiveShadow = true; } });
  }
  function buildPalletize(L) {
    const { pick, place, box, s } = L;
    const az = (pick.az * Math.PI) / 180, dirT = [-Math.sin(az), Math.cos(az), 0];   // conveyor runs tangentially
    const len = 2.2 * s + 0.6, w = box.d + 0.12;
    const end = [pick.p[0] + dirT[0] * box.d * 0.2, pick.p[1] + dirT[1] * box.d * 0.2];
    const g = new THREE.Group(); g.position.set(end[0] - dirT[0] * len / 2, end[1] - dirT[1] * len / 2, 0); g.rotation.z = Math.atan2(dirT[1], dirT[0]); cellG.add(g);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(len, w, 0.05), mat('#22262b', { roughness: 0.9 })); belt.position.z = pick.top - 0.025; belt.receiveShadow = true; g.add(belt);
    for (const sy of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.09), mat('#8a96a3', { metalness: 0.6 })); rail.position.set(0, sy * (w / 2 + 0.02), pick.top - 0.02); rail.castShadow = true; g.add(rail); }
    for (const x of [-len / 2 + 0.1, len / 2 - 0.1]) for (const sy of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, pick.top - 0.05), mat('#5d6b78')); leg.position.set(x, sy * w / 2, (pick.top - 0.05) / 2); g.add(leg); }
    const stop = new THREE.Mesh(new THREE.BoxGeometry(0.03, w, 0.06), mat('#e0262b')); stop.position.set(len / 2 + 0.015, 0, pick.top + 0.03); g.add(stop);
    L.conv = { g, len, dirT, start: [end[0] - dirT[0] * len, end[1] - dirT[1] * len], end };
    // pallet on a stand
    const c = place.c, st = place.stand;
    if (st > 0.05) { const stand = new THREE.Mesh(new THREE.BoxGeometry(box.w * 2 + 0.3, box.d * 2 + 0.3, st), mat('#5d6b78', { metalness: 0.4 })); stand.position.set(c[0], c[1], st / 2); stand.castShadow = true; cellG.add(stand); }
    const pal = palletMesh(box.w * 2 + 0.16, box.d * 2 + 0.16); pal.position.set(c[0], c[1], st); cellG.add(pal);
    spawnPart(L, 0);
  }
  function spawnPart(L, delay) {
    const { box, pick } = L;
    const m = new THREE.Mesh(new THREE.BoxGeometry(box.w * 0.92, box.d * 0.92, box.h), boxMat());
    m.castShadow = true;
    const az = (pick.az * Math.PI) / 180;
    m.rotation.z = az + Math.PI / 2;
    const p = { mesh: m, state: 'arriving', t: -delay, from: L.conv.start, to: L.conv.end, z: pick.top + box.h / 2 };
    m.position.set(p.from[0], p.from[1], p.z); cellG.add(m); S.parts.push(p);
    return p;
  }
  function buildTable(L, kind) {
    const th = L.table, size = kind === 'weld' ? [L.a + 0.3, L.b + 0.3] : [L.a + 0.3, L.a / 2 + 0.3];
    const top = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], 0.05), mat('#4b5563', { metalness: 0.5 })); top.position.set(L.c[0], L.c[1], th - 0.025); top.receiveShadow = true; top.castShadow = true; cellG.add(top);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, th - 0.05), mat('#2f3540')); leg.position.set(L.c[0] + sx * (size[0] / 2 - 0.06), L.c[1] + sy * (size[1] / 2 - 0.06), (th - 0.05) / 2); cellG.add(leg); }
    if (kind === 'weld') {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(L.a + 0.06, L.b + 0.06, 0.012), mat('#9aa3ad', { metalness: 0.7 })); plate.position.set(L.c[0], L.c[1], th + 0.006); cellG.add(plate);
      const top2 = new THREE.Mesh(new THREE.BoxGeometry(L.a - 0.01, L.b - 0.01, 0.01), mat('#b8c0c8', { metalness: 0.7 })); top2.position.set(L.c[0], L.c[1], th + 0.017); cellG.add(top2);
      for (const sx of [-1, 1]) { const cl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.06), mat('#e0262b')); cl.position.set(L.c[0] + sx * (L.a / 2 + 0.08), L.c[1], th + 0.03); cellG.add(cl); }
    } else {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(L.a, L.a / 2, 0.02), mat('#2f80ed', { metalness: 0.3 })); plate.position.set(L.c[0], L.c[1], th + 0.01); cellG.add(plate);
      L.screwMeshes = L.holes.map((h) => { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 16), mat('#c9ced6', { metalness: 0.9 })); sc.rotation.x = Math.PI / 2; sc.position.set(h[0], h[1], h[2] + 0.003); sc.visible = false; cellG.add(sc); const hole = new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), mat('#111')); hole.position.set(h[0], h[1], h[2] + 0.0005); cellG.add(hole); return sc; });
    }
  }
  function palletMesh(w, d) {
    const g = new THREE.Group(), wood = mat('#b8915a', { roughness: 0.9 });
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, d / 7, 0.022), wood); b.position.set(0, -d / 2 + d / 14 + k * (d - d / 7) / 4, 0.133); b.castShadow = true; g.add(b); }
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.1), wood); b.position.set(0, -d / 2 + 0.05 + k * (d - 0.1) / 2, 0.06); g.add(b); }
    return g;
  }
  let BOXTEX = null;
  function boxMat() {
    if (!BOXTEX) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#c59b6d'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#a8794a'; g.fillRect(0, 56, 128, 16); g.fillStyle = 'rgba(40,30,20,.6)'; g.font = '700 18px Inter, Arial'; g.fillText('THIS SIDE UP', 6, 30); BOXTEX = new THREE.CanvasTexture(c); BOXTEX.colorSpace = THREE.SRGBColorSpace; }
    return new THREE.MeshStandardMaterial({ map: BOXTEX, roughness: 0.85 });
  }
  function person() {
    const g = new THREE.Group();
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.7, 4, 10), mat('#2d3440')); legs.rotation.x = Math.PI / 2; legs.position.z = 0.48; g.add(legs);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 10), mat('#2f6fd6')); body.rotation.x = Math.PI / 2; body.position.z = 1.2; g.add(body);
    const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.25, 4, 10), mat('#d6ff3a')); vest.rotation.x = Math.PI / 2; vest.position.z = 1.25; g.add(vest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat('#b07850')); head.position.z = 1.66; g.add(head);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ffd23f')); helmet.rotation.x = Math.PI / 2; helmet.position.z = 1.7; g.add(helmet);
    g.traverse((o) => { o.castShadow = true; });
    return g;
  }

  // ── effects ──
  const sparkGeo = new THREE.BufferGeometry(); const NS = 160; const sparkPos = new Float32Array(NS * 3), sparkVel = new Float32Array(NS * 3), sparkLife = new Float32Array(NS);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: '#ffd27a', size: 0.012, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  fxG.add(sparks);
  const arcLight = new THREE.PointLight('#9fd3ff', 0, 2.5); fxG.add(arcLight);
  const arcGlow = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshBasicMaterial({ color: '#e8f6ff' })); arcGlow.visible = false; fxG.add(arcGlow);
  const beadMat = new THREE.MeshStandardMaterial({ color: '#d9a066', emissive: '#ff6a00', emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.4 });
  let beadMesh = null;
  function clearBead() { S.beadPts = []; if (beadMesh) { fxG.remove(beadMesh); beadMesh.geometry.dispose(); beadMesh = null; } }
  function effects(F, toolState, dt) {
    const arc = toolState?.arc;
    arcLight.intensity = arc ? 6 + Math.random() * 4 : 0; arcGlow.visible = !!arc;
    if (arc) { arcLight.position.copy(V(F.tcp)); arcGlow.position.copy(V(F.tcp)); }
    for (let i = 0; i < NS; i++) {
      if (sparkLife[i] <= 0 && arc && Math.random() < 0.5) { sparkLife[i] = 0.25 + Math.random() * 0.4; sparkPos.set(F.tcp, i * 3); sparkVel.set([(Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, Math.random() * 1.4], i * 3); }
      if (sparkLife[i] > 0) { sparkLife[i] -= dt; sparkVel[i * 3 + 2] -= 9.8 * dt; for (let k = 0; k < 3; k++) sparkPos[i * 3 + k] += sparkVel[i * 3 + k] * dt; if (sparkPos[i * 3 + 2] < 0) sparkLife[i] = 0; }
      if (sparkLife[i] <= 0) sparkPos[i * 3 + 2] = -10;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    if (arc) {
      const p = V(F.tcp); const last = S.beadPts.at(-1);
      if (!last || last.distanceTo(p) > 0.004) {
        S.beadPts.push(p);
        if (S.beadPts.length > 1 && S.beadPts.length % 3 === 0) { if (beadMesh) { fxG.remove(beadMesh); beadMesh.geometry.dispose(); } beadMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(S.beadPts), Math.min(400, S.beadPts.length * 2), 0.006, 6, false), beadMat); fxG.add(beadMesh); }
      }
    }
    beadMat.emissiveIntensity = Math.max(0.05, beadMat.emissiveIntensity * 0.995 + (arc ? 0.02 : 0));
  }
  function setEnvelope(pts, on) {
    envelope.clear(); if (!on || !pts?.length) return;
    const g = new THREE.BufferGeometry(), pos = new Float32Array(pts.length * 3), col = new Float32Array(pts.length * 3), c = new THREE.Color();
    let zmax = 0.01; for (const p of pts) zmax = Math.max(zmax, p[2]);
    pts.forEach((p, i) => { pos.set(p, i * 3); c.setHSL(0.6 - (p[2] / zmax) * 0.6, 0.9, 0.55); col.set([c.r, c.g, c.b], i * 3); });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    envelope.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false })));
  }
  function setLight(state) { if (!S.light) return; S.light.forEach((l, k) => { l.material.emissiveIntensity = (state === 'error' && k === 0) || (state === 'paused' && k === 1) || (state === 'running' && k === 2) ? 2.2 : 0.08; }); }

  // camera
  let fly = null;
  function view(name, reach = 1.4, instant = false) {
    const r = Math.max(3.4, reach * 2.7 + 1.6), T = new THREE.Vector3(0, Math.max(0.6, reach * 0.4), 0);
    const P = { iso: [r * 0.78, r * 0.62, r * 0.9], front: [r * 1.35, r * 0.35, 0.001], side: [0.001, r * 0.35, r * 1.35], top: [0.001, r * 1.7, 0.002] }[name] || [r, r * 0.7, r];
    const to = { t: T, p: new THREE.Vector3(...P) };
    if (instant) { controls.target.copy(to.t); camera.position.copy(to.p); controls.update(); return; }
    fly = { k: 0, ft: controls.target.clone(), fp: camera.position.clone(), ...to };
  }
  function frame(dt) {
    if (fly) { fly.k = Math.min(1, fly.k + dt * 2); const e = 1 - (1 - fly.k) ** 3; controls.target.lerpVectors(fly.ft, fly.t, e); camera.position.lerpVectors(fly.fp, fly.p, e); if (fly.k >= 1) fly = null; }
    controls.update(); renderer.render(scene, camera);
  }
  function resize() { const r = canvas.parentElement.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
  return {
    scene, camera, renderer, controls, world, target, tc, tcHelper, S, cellG,
    buildRobot, pose, buildCell, spawnPart, effects, setEnvelope, setLight, view, frame, resize, clearBead,
    showFrames: (v) => { framesG.visible = v; }, showFence: (v) => { if (S.fence) S.fence.visible = v; },
  };
}
