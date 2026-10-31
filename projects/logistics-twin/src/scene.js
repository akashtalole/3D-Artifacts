/** three.js rendering of the fulfilment centre. Reads simulation state every frame. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { W, D, H, OUT_DOORS, IN_DOORS, CONVEYOR, PACK, PICK_ROWS, PICK_BLOCKS, PICK_BAY, PICK_DEPTH, PICK_LEVELS, SHELF_H, RES, resRowX, CHARGERS, OFFICE, ZONES, LANE, STAGE_Y } from './layout.js';
import { CATS, DESTS } from './config.js';
import { TRAILER, FACE_MAX } from './sim.js';

const toV = (x, y, z = 0) => new THREE.Vector3(x - W / 2, z, y - D / 2);
const M = new Map();
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!M.has(k)) M.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.1, ...o })); return M.get(k); };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

export const AMR_COLORS = { idle: '#7f8c99', travel: '#3fd0a0', pick: '#ffd23f', toPack: '#41b6ff', drop: '#41b6ff', toCharge: '#ff9f43', charging: '#ff9f43', park: '#556070' };

export function createScene(canvas, labelsEl) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const css = new CSS2DRenderer({ element: labelsEl });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a9c4dc');
  scene.fog = new THREE.Fog('#a9c4dc', 380, 900);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 3000);
  camera.position.set(-40, 120, 140);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.1; controls.maxPolarAngle = Math.PI * 0.48; controls.minDistance = 6; controls.maxDistance = 520;
  scene.add(new THREE.HemisphereLight('#eaf3ff', '#5b5246', 0.95));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.0);
  sun.position.set(-90, 140, 70); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 110, bottom: -110, near: 10, far: 450 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  const world = new THREE.Group(); scene.add(world);
  buildSite(world);
  const floor = buildFloor(world);
  buildBuilding(world);
  const doors = buildDocks(world);
  buildPickRacks(world);
  buildReserveRacks(world);
  buildConveyorAndPack(world);
  buildChargers(world);
  const roof = buildRoof(world);

  // ── dynamic instanced sets ──
  const dummy = new THREE.Object3D();
  const cartonGeo = box(0.42, 0.34, 0.48);
  const faceSlots = 12;
  const nFaces = PICK_BLOCKS.reduce((s, b) => s + b.n, 0) * PICK_ROWS.length * 2;
  const cartons = new THREE.InstancedMesh(cartonGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), nFaces * faceSlots);
  cartons.castShadow = true; cartons.frustumCulled = false; world.add(cartons);
  const palletGeo = box(1.2, 0.14, 1.0), loadGeo = box(1.1, 1.15, 0.95);
  const nRes = RES.rows * 2 * RES.bays * RES.levels;
  const pallets = new THREE.InstancedMesh(palletGeo, mat('#b8915a'), nRes + 200); pallets.castShadow = true; pallets.frustumCulled = false; world.add(pallets);
  const loads = new THREE.InstancedMesh(loadGeo, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }), nRes + 200); loads.castShadow = true; loads.frustumCulled = false; world.add(loads);
  const parcelGeo = box(0.5, 0.32, 0.4);
  const parcels = new THREE.InstancedMesh(parcelGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), 4000); parcels.castShadow = true; parcels.frustumCulled = false; world.add(parcels);
  const tmpC = new THREE.Color();

  // vehicles
  const amrs = [], forks = [], trucks = new Map(), people = [];
  const amrGroup = new THREE.Group(), forkGroup = new THREE.Group(), truckGroup = new THREE.Group(), peopleGroup = new THREE.Group();
  world.add(amrGroup, forkGroup, truckGroup, peopleGroup);
  const packers = PACK.map((p) => { const m = person('#2f6fd6'); m.position.copy(toV(p.x, p.packer.y)); m.rotation.y = Math.PI; peopleGroup.add(m); return m; });
  const packBoxes = PACK.map((p) => { const m = new THREE.Mesh(box(0.55, 0.35, 0.42), mat('#c59b6d')); m.position.copy(toV(p.x, (p.table.y0 + p.table.y1) / 2, 0.95)); m.visible = false; world.add(m); return m; });

  // heatmap
  const heatCanvas = document.createElement('canvas'); heatCanvas.width = W; heatCanvas.height = D;
  const heatTex = new THREE.CanvasTexture(heatCanvas); heatTex.magFilter = THREE.LinearFilter;
  const heatMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ map: heatTex, transparent: true, depthWrite: false, opacity: 0.85 }));
  heatMesh.rotation.x = -Math.PI / 2; heatMesh.position.y = 0.06; heatMesh.visible = false; heatMesh.renderOrder = 2; world.add(heatMesh);

  // selection
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.35, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthTest: false }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 5; world.add(ring);
  const pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.8, gapSize: 0.5, depthTest: false }));
  pathLine.renderOrder = 5; pathLine.visible = false; world.add(pathLine);

  // zone labels
  const labels = new THREE.Group(); world.add(labels);
  for (const z of ZONES) { const d = document.createElement('div'); d.className = 'zlabel'; d.textContent = z.name; const o = new CSS2DObject(d); o.position.copy(toV(z.x, z.y, 4)); labels.add(o); }
  for (const [i, d] of OUT_DOORS.entries()) { const e = document.createElement('div'); e.className = 'zlabel dest'; e.innerHTML = `<i style="background:${DESTS[i].color}"></i>${DESTS[i].name}`; const o = new CSS2DObject(e); o.position.copy(toV(d.x, LANE.y1 + 0.5, 2.6)); labels.add(o); }

  const state = { faceQty: new Int16Array(nFaces).fill(-1), resSig: '', sel: null, heatOn: false, follow: null, frame: 0 };

  function update(sim, dt, t) {
    state.frame++;
    // pick-face cartons (only when quantities change)
    let changed = false;
    for (const f of sim.faces) {
      if (state.faceQty[f.id] === f.qty) continue;
      state.faceQty[f.id] = f.qty; changed = true;
      const n = Math.ceil((f.qty / FACE_MAX) * faceSlots);
      const col = CATS[sim.skus[f.sku].cat].color;
      for (let k = 0; k < faceSlots; k++) {
        const lvl = Math.floor(k / 3), j = k % 3;
        if (k < n) { dummy.position.copy(toV(f.x - 0.52 + j * 0.52, f.side === 'N' ? f.y + 0.3 : f.y - 0.3, 0.22 + lvl * SHELF_H)); dummy.scale.set(1, 1, 1); }
        else dummy.scale.set(0, 0, 0);
        dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); cartons.setMatrixAt(f.id * faceSlots + k, dummy.matrix);
        cartons.setColorAt(f.id * faceSlots + k, tmpC.set(col).offsetHSL(0, -0.1, (j - 1) * 0.04));
      }
    }
    if (changed) { cartons.instanceMatrix.needsUpdate = true; if (cartons.instanceColor) cartons.instanceColor.needsUpdate = true; }
    // reserve pallets + staged pallets
    if (state.frame % 6 === 1) {
      let i = 0;
      for (const r of sim.res) {
        if (r.pallet) { place(pallets, i, toV(r.x, r.y, r.z + 0.07 + (r.z ? 0.12 : 0)), 0); place(loads, i, toV(r.x, r.y, r.z + 0.72 + (r.z ? 0.12 : 0)), 0); loads.setColorAt(i, tmpC.set(CATS[sim.skus[r.pallet.sku].cat].color).lerp(new THREE.Color('#e8e4da'), 0.35)); i++; }
      }
      for (const d of sim.inDoors) for (const p of d.staged) {
        const sx = d.x + (p.slot % 2 ? 1.4 : -1.4), sy = STAGE_Y + Math.floor(p.slot / 2) * 1.25 - 0.6;
        place(pallets, i, toV(sx, sy, 0.07), 0); place(loads, i, toV(sx, sy, 0.72), 0); loads.setColorAt(i, tmpC.set(CATS[sim.skus[p.sku].cat].color).lerp(new THREE.Color('#e8e4da'), 0.35)); i++;
      }
      pallets.count = loads.count = i;
      pallets.instanceMatrix.needsUpdate = loads.instanceMatrix.needsUpdate = true; if (loads.instanceColor) loads.instanceColor.needsUpdate = true;
    }
    // parcels: conveyor + lanes
    let pi = 0;
    for (const p of sim.parcels) { if (pi >= 3990) break; place(parcels, pi, toV(p.x, p.y, 0.95), 0); parcels.setColorAt(pi, tmpC.set('#c59b6d')); pi++; }
    for (const ln of sim.lanes) {
      const n = Math.min(ln.orders.length, 360), x0 = ln.door.x;
      for (let k = 0; k < n && pi < 3990; k++) { const layer = Math.floor(k / 60), r = k % 60, cx = r % 6, cy = Math.floor(r / 6); place(parcels, pi, toV(x0 - 1.4 + cx * 0.56, LANE.y1 - 0.4 - cy * 0.45, 0.16 + layer * 0.33), 0); parcels.setColorAt(pi, tmpC.set('#c59b6d').lerp(new THREE.Color(DESTS[ln.id].color), 0.18)); pi++; }
    }
    // parcels inside docked outbound trailers (visible through the open door)
    parcels.count = pi; parcels.instanceMatrix.needsUpdate = true; if (parcels.instanceColor) parcels.instanceColor.needsUpdate = true;

    // AMRs
    while (amrs.length < sim.amrs.length) { const m = amrMesh(); amrGroup.add(m); amrs.push(m); const ps = person('#e85d3a'); ps.visible = false; peopleGroup.add(ps); people.push(ps); }
    sim.amrs.forEach((a, i) => {
      const m = amrs[i]; m.visible = !(a.retired && a.parked);
      m.position.copy(toV(a.x, a.y, 0)); m.rotation.y = -a.h;
      m.userData.light.material = lightMat(AMR_COLORS[a.state] || '#7f8c99');
      m.userData.tote.visible = a.orders.length > 0;
      m.userData.tote.scale.y = 0.4 + Math.min(1, a.carry / 6) * 0.6;
      const ps = people[i];
      if (a.state === 'pick') { const s = a.stops[a.si]; if (s) { ps.visible = true; ps.position.copy(toV(a.x + 0.75, s.face.side === 'N' ? s.face.y - 0.55 : s.face.y + 0.55)); } }
      else ps.visible = false;
    });
    // forklifts
    while (forks.length < sim.forks.length) { const m = forkMesh(); forkGroup.add(m); forks.push(m); }
    sim.forks.forEach((f, i) => {
      const m = forks[i]; m.visible = !f.retired || !!f.task;
      m.position.copy(toV(f.x, f.y, 0)); m.rotation.y = -f.h;
      m.userData.carriage.position.y = 0.15 + (f.lift || 0) + (f.load ? 0.0 : 0);
      m.userData.pallet.visible = !!f.load;
      if (f.load) m.userData.load.material = mat(CATS[sim.skus[f.load.sku].cat].color);
    });
    // trucks
    const seen = new Set();
    for (const tr of sim.trucks) {
      if (tr.phase === 'scheduled') continue;
      seen.add(tr.id);
      let m = trucks.get(tr.id);
      if (!m) { m = truckMesh(tr); truckGroup.add(m); trucks.set(tr.id, m); }
      m.position.copy(toV(tr.x, tr.y, 0)); m.rotation.y = -tr.h;
      m.userData.sim = tr;
      if (tr.kind === 'out') m.userData.fill.scale.x = Math.max(0.001, tr.load / tr.cap);
      else m.userData.fill.scale.x = Math.max(0.001, (tr.cargo?.length || 0) / Math.max(1, tr.pallets));
    }
    for (const [id, m] of trucks) if (!seen.has(id)) { truckGroup.remove(m); trucks.delete(id); }
    // docks
    sim.inDoors.forEach((d, i) => { const docked = d.truck && d.truck.phase === 'docked'; doors.in[i].panel.position.y = docked ? 4.6 : 2.0; doors.in[i].light.material = lightMat(!d.open ? '#444' : docked ? '#ff4d3d' : '#3fd07a'); });
    sim.outDoors.forEach((d, i) => { const docked = d.truck && d.truck.phase === 'docked'; doors.out[i].panel.position.y = docked ? 4.6 : 2.0; doors.out[i].light.material = lightMat(docked ? '#ff4d3d' : '#3fd07a'); });
    // pack stations
    sim.packs.forEach((s, i) => { packers[i].visible = s.open || !!s.cur; packBoxes[i].visible = !!s.cur; if (s.cur) packers[i].children[1].position.x = Math.sin(t * 6 + i) * 0.08; });
    // heatmap
    state.sim = sim;
    if (state.heatOn && state.frame % 10 === 0) drawHeat();
    // selection
    updateSelection(sim);
    if (state.follow) { const s = selectedObj(sim); if (s) { const p = toV(s.x, s.y, 0); const d = p.clone().sub(controls.target); controls.target.add(d); camera.position.add(d); } }
    controls.update();
    renderer.render(scene, camera); css.render(scene, camera);
  }
  function place(im, i, p, ry) { dummy.position.copy(p); dummy.rotation.set(0, ry, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); }
  function drawHeat() {
    const heat = state.sim?.heat; if (!heat) return;
    const g = heatCanvas.getContext('2d'); const img = g.createImageData(W, D);
    let mx = 1; for (let i = 0; i < heat.length; i++) mx = Math.max(mx, heat[i]);
    for (let i = 0; i < heat.length; i++) {
      const v = Math.pow(heat[i] / mx, 0.45); if (v < 0.02) continue;
      const [r, gg, b] = ramp(v); img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = Math.min(255, 110 + v * 160);
    }
    g.putImageData(img, 0, 0); heatTex.needsUpdate = true;
  }
  function selectedObj(sim) {
    const s = state.sel; if (!s) return null;
    if (s.kind === 'amr') return sim.amrs[s.id];
    if (s.kind === 'fork') return sim.forks[s.id];
    if (s.kind === 'truck') return sim.trucks.find((t) => t.id === s.id) || null;
    return null;
  }
  function updateSelection(sim) {
    const o = selectedObj(sim);
    if (!o) { ring.visible = false; pathLine.visible = false; return; }
    ring.visible = true; ring.position.copy(toV(o.x, o.y, 0.08)); ring.scale.setScalar(state.sel.kind === 'truck' ? 4 : 1);
    if (o.path && state.sel.kind !== 'truck') {
      const pts = [toV(o.x, o.y, 0.15), ...o.path.slice(o.pi).map(([x, y]) => toV(x, y, 0.15))];
      pathLine.geometry.dispose(); pathLine.geometry = new THREE.BufferGeometry().setFromPoints(pts); pathLine.computeLineDistances(); pathLine.visible = true;
    } else pathLine.visible = false;
  }

  // picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(ev, sim) {
    const r = canvas.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([amrGroup, forkGroup, truckGroup], true);
    for (const h of hits) {
      let o = h.object; while (o && !o.userData.kind) o = o.parent;
      if (!o) continue;
      if (o.userData.kind === 'amr') return { kind: 'amr', id: amrs.indexOf(o) };
      if (o.userData.kind === 'fork') return { kind: 'fork', id: forks.indexOf(o) };
      if (o.userData.kind === 'truck') return { kind: 'truck', id: o.userData.sim.id };
    }
    // floor hit → zone / rack info
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) { const x = p.x + W / 2, y = p.z + D / 2; if (x >= 0 && x <= W && y >= 0 && y <= D) return { kind: 'floor', x, y }; }
    return null;
  }
  // camera views
  let fly = null;
  const VIEWS = {
    overview: [[-4, 0, 6], [-62, 108, 104]], pick: [[-30, 0, 4], [-38, 20, 30]], reserve: [[40, 2, 6], [20, 22, 40]],
    inbound: [[34, 0, 50], [6, 40, 104]], outbound: [[24, 0, -28], [-4, 36, -86]], pack: [[-36, 0, -24], [-44, 12, -2]],
  };
  function view(name, instant) {
    const v = VIEWS[name]; if (!v) return;
    state.follow = null;
    const to = { t: new THREE.Vector3(...v[0]), p: new THREE.Vector3(...v[1]) };
    if (instant) { controls.target.copy(to.t); camera.position.copy(to.p); controls.update(); return; }
    fly = { k: 0, ft: controls.target.clone(), fp: camera.position.clone(), ...to };
  }
  function animateCamera(dt) { if (!fly) return; fly.k = Math.min(1, fly.k + dt * 1.4); const e = 1 - (1 - fly.k) ** 3; controls.target.lerpVectors(fly.ft, fly.t, e); camera.position.lerpVectors(fly.fp, fly.p, e); if (fly.k >= 1) fly = null; }
  function resize() { const r = canvas.parentElement.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); css.setSize(r.width, r.height); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
  function focus(x, y, dist = 26) { state.follow = null; const t = toV(x, y, 0); const dir = camera.position.clone().sub(controls.target).normalize(); fly = { k: 0, ft: controls.target.clone(), fp: camera.position.clone(), t, p: t.clone().add(dir.multiplyScalar(dist)) }; }
  return {
    update, pick, view, resize, animateCamera, focus, state, camera, controls, renderer,
    setRoof: (v) => { roof.visible = v; }, setLabels: (v) => { labels.visible = v; labelsEl.style.display = v ? '' : 'none'; },
    setHeat: (v) => { state.heatOn = v; heatMesh.visible = v; if (v) drawHeat(); },
    select: (s) => { state.sel = s; }, follow: (v) => { state.follow = v; },
    clearHeat: () => {},
  };
}

const LIGHT = new Map();
function lightMat(c) { if (!LIGHT.has(c)) LIGHT.set(c, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6 })); return LIGHT.get(c); }
function ramp(v) { const stops = [[0, [40, 60, 200]], [0.35, [40, 200, 200]], [0.6, [250, 220, 40]], [0.85, [255, 120, 30]], [1, [230, 30, 40]]]; for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const t = (v - a) / (b - a); return ca.map((c, k) => Math.round(c + (cb[k] - c) * t)); } return [230, 30, 40]; }

// ── static content ─────────────────────────────────────────────────────────
function buildSite(world) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1000), new THREE.MeshStandardMaterial({ color: '#7d8f63', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; world.add(ground);
  const asphalt = tex(512, 512, (g) => { g.fillStyle = '#4a4d52'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); } });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.repeat.set(20, 10);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(380, 190), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 }));
  yard.rotation.x = -Math.PI / 2; yard.position.set(55, -0.02, 0); yard.receiveShadow = true; world.add(yard);
  // road markings & yard stalls
  const lines = new THREE.Group(); world.add(lines);
  const stripe = (x, y, w, d, c = '#f2f2f2') => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: c })); m.rotation.x = -Math.PI / 2; m.position.copy(toV(x, y, 0.01)); lines.add(m); };
  for (let x = -120; x < 240; x += 8) { stripe(x, 118, 4, 0.25); stripe(x, -34, 4, 0.25); }
  for (let i = 0; i < 7; i++) stripe(147 + i * 6, 102, 0.2, 14, '#ffd23f');
  for (const d of IN_DOORS) { stripe(d.x - 1.9, 92, 0.2, 16, '#ffd23f'); stripe(d.x + 1.9, 92, 0.2, 16, '#ffd23f'); }
  for (const d of OUT_DOORS) { stripe(d.x - 1.9, -8, 0.2, 16, '#ffd23f'); stripe(d.x + 1.9, -8, 0.2, 16, '#ffd23f'); }
  // trees and a guard house for context
  const trunkM = mat('#6b4a2b'), leafM = mat('#3f6b35');
  for (let i = 0; i < 46; i++) {
    const a = i / 46 * Math.PI * 2, rx = 210 + Math.sin(i * 7.1) * 12, rz = 140 + Math.cos(i * 3.7) * 10;
    const t = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 6), trunkM); tr.position.y = 1.5; const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6 + (i % 3) * 0.5, 0), leafM); lf.position.y = 4.4; t.add(tr, lf);
    t.position.set(55 + Math.cos(a) * rx, 0, Math.sin(a) * rz); t.traverse((o) => { o.castShadow = true; }); world.add(t);
  }
  const gh = new THREE.Mesh(box(6, 3.2, 5), mat('#d9d4c7')); gh.position.copy(toV(232, 108, 1.6)); gh.castShadow = true; world.add(gh);
}
function buildFloor(world) {
  const S = 8;
  const t = tex(W * S, D * S, (g, w, h) => {
    g.fillStyle = '#b9bcbf'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1; for (let x = 0; x <= W; x += 6) { g.beginPath(); g.moveTo(x * S, 0); g.lineTo(x * S, h); g.stroke(); } for (let y = 0; y <= D; y += 6) { g.beginPath(); g.moveTo(0, y * S); g.lineTo(w, y * S); g.stroke(); }
    const R = (x0, y0, x1, y1, c) => { g.fillStyle = c; g.fillRect(x0 * S, y0 * S, (x1 - x0) * S, (y1 - y0) * S); };
    const L = (x0, y0, x1, y1, c = '#e8c22c', lw = 0.12) => { g.strokeStyle = c; g.lineWidth = lw * S; g.beginPath(); g.moveTo(x0 * S, y0 * S); g.lineTo(x1 * S, y1 * S); g.stroke(); };
    R(4, 22.4, 80, 29.2, 'rgba(63,208,160,.10)'); // AMR highway
    R(84, 22.4, 128, 31.2, 'rgba(255,159,67,.08)'); R(84, 68, 128, 72, 'rgba(255,159,67,.08)');
    for (const d of OUT_DOORS) { R(d.x - 1.8, LANE.y0, d.x + 1.8, LANE.y1, 'rgba(255,255,255,.35)'); L(d.x - 1.8, LANE.y0, d.x - 1.8, LANE.y1); L(d.x + 1.8, LANE.y0, d.x + 1.8, LANE.y1); }
    for (const d of IN_DOORS) { R(d.x - 2.4, 76, d.x + 2.4, 83, 'rgba(255,210,63,.18)'); L(d.x - 2.4, 76, d.x - 2.4, 83); L(d.x + 2.4, 76, d.x + 2.4, 83); }
    L(4, 22.4, 128, 22.4); L(4, 29.2, 80, 29.2, '#3fd0a0'); L(84, 72, 128, 72); L(2, 62, 80, 62);
    // pedestrian walkway
    for (let x = 24; x < 82; x += 1.2) R(x, 63, x + 0.6, 64.4, 'rgba(255,255,255,.55)');
    R(OFFICE.x1, 63, 24, 64.4, 'rgba(46,140,80,.6)');
    g.fillStyle = 'rgba(40,46,52,.35)'; g.font = `700 ${S * 2.6}px Inter, Arial`; g.textAlign = 'center';
    g.fillText('RETURNS & VALUE-ADDED SERVICES', 50 * S, 72 * S); g.fillText('RECEIVING', 92 * S, 74.5 * S);
    g.font = `700 ${S * 1.2}px Inter, Arial`;
    IN_DOORS.forEach((d, i) => g.fillText(`I${i + 1}`, d.x * S, 82.5 * S)); OUT_DOORS.forEach((d, i) => g.fillText(`O${i + 1}`, d.x * S, 2.2 * S));
    PACK.forEach((p, i) => g.fillText(`P${i + 1}`, p.x * S, 22 * S));
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, transparent: true }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.receiveShadow = true; world.add(m);
  return m;
}
function buildBuilding(world) {
  const wallM = new THREE.MeshStandardMaterial({ color: '#dfe3e6', roughness: 0.8, transparent: true, opacity: 0.95 });
  const wallH = 1.6, t = 0.3;
  const seg = (x0, y0, x1, y1, h = wallH) => { const len = Math.hypot(x1 - x0, y1 - y0); const m = new THREE.Mesh(box(len, h, t), wallM); m.position.copy(toV((x0 + x1) / 2, (y0 + y1) / 2, h / 2)); m.rotation.y = -Math.atan2(y1 - y0, x1 - x0); m.castShadow = m.receiveShadow = true; world.add(m); };
  const withDoors = (y, doors) => { let x = 0; for (const d of doors) { seg(x, y, d.x - 1.9, y); x = d.x + 1.9; } seg(x, y, W, y); };
  withDoors(0, OUT_DOORS); withDoors(D, IN_DOORS); seg(0, 0, 0, D); seg(W, 0, W, D);
  // steel columns
  const colGeo = box(0.32, H, 0.32), colM = mat('#9aa7b4', { metalness: 0.4 });
  const cols = []; for (let x = 12; x < W; x += 12) for (let y = 12; y < D; y += 12) { const inRack = (x > 86 && x < 127 && y > 31 && y < 68) || (y > 29 && y < 57 && x > 5 && x < 75); if (!inRack) cols.push([x, y]); }
  const im = new THREE.InstancedMesh(colGeo, colM, cols.length); const d = new THREE.Object3D();
  cols.forEach(([x, y], i) => { d.position.copy(toV(x, y, H / 2)); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }); im.castShadow = true; world.add(im);
  // office
  const off = new THREE.Mesh(box(OFFICE.x1 - OFFICE.x0, 4, OFFICE.y1 - OFFICE.y0), [mat('#cfd6dc'), mat('#cfd6dc'), mat('#9aa6b0'), mat('#cfd6dc'), glassTex(), mat('#cfd6dc')]);
  off.position.copy(toV((OFFICE.x0 + OFFICE.x1) / 2, (OFFICE.y0 + OFFICE.y1) / 2, 2)); off.castShadow = off.receiveShadow = true; world.add(off);
}
function glassTex() { return new THREE.MeshStandardMaterial({ map: tex(256, 64, (g) => { g.fillStyle = '#cfd6dc'; g.fillRect(0, 0, 256, 64); for (let i = 0; i < 8; i++) { g.fillStyle = '#5c7f9a'; g.fillRect(8 + i * 31, 18, 24, 26); } }), roughness: 0.4 }); }
function buildRoof(world) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(box(W, 0.4, D), new THREE.MeshStandardMaterial({ color: '#e4e7ea', roughness: 0.6 }));
  m.position.copy(toV(W / 2, D / 2, H + 0.2)); m.castShadow = true; g.add(m);
  const walls = new THREE.MeshStandardMaterial({ color: '#d6dbe0' });
  for (const [x, y, w, d] of [[W / 2, 0, W, 0.3], [W / 2, D, W, 0.3], [0, D / 2, 0.3, D], [W, D / 2, 0.3, D]]) { const s = new THREE.Mesh(box(w, H - 1.6, d), walls); s.position.copy(toV(x, y, 1.6 + (H - 1.6) / 2)); s.castShadow = true; g.add(s); }
  g.visible = false; world.add(g); return g;
}
function buildDocks(world) {
  const res = { in: [], out: [] };
  const make = (d, y, dir) => {
    const g = new THREE.Group(); g.position.copy(toV(d.x, y)); world.add(g);
    const frame = mat('#3d4650');
    for (const s of [-1, 1]) { const p = new THREE.Mesh(box(0.3, 4.8, 0.5), frame); p.position.set(s * 1.95, 2.4, 0); g.add(p); }
    const top = new THREE.Mesh(box(4.2, 0.6, 0.5), frame); top.position.y = 5; g.add(top);
    const panel = new THREE.Mesh(box(3.6, 3.6, 0.12), new THREE.MeshStandardMaterial({ color: '#c9cfd5', roughness: 0.5, metalness: 0.4 })); panel.position.y = 2; g.add(panel);
    const leveler = new THREE.Mesh(box(2.4, 0.2, 2.0), mat('#5a6168', { metalness: 0.6 })); leveler.position.set(0, 0.1, -dir * 1.0); g.add(leveler);
    const bumpers = new THREE.Mesh(box(3.2, 0.5, 0.25), mat('#1d1d1f')); bumpers.position.set(0, 1.2, dir * 0.3); g.add(bumpers);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), lightMat('#3fd07a')); light.position.set(2.5, 3.2, -dir * 0.3); g.add(light);
    g.traverse((o) => { o.castShadow = true; });
    return { panel, light };
  };
  for (const d of IN_DOORS) res.in.push(make(d, D, 1));
  for (const d of OUT_DOORS) res.out.push(make(d, 0, -1));
  return res;
}
function buildPickRacks(world) {
  const nBays = PICK_BLOCKS.reduce((s, b) => s + b.n, 0) * PICK_ROWS.length;
  const hgt = PICK_LEVELS * SHELF_H + 0.2;
  const up = new THREE.InstancedMesh(box(0.06, hgt, 0.06), mat('#2e5f9e', { metalness: 0.5 }), (nBays + PICK_BLOCKS.length * PICK_ROWS.length) * 2);
  const shelf = new THREE.InstancedMesh(box(PICK_BAY - 0.04, 0.03, PICK_DEPTH), mat('#cdd3d8', { metalness: 0.4 }), nBays * (PICK_LEVELS + 1));
  const d = new THREE.Object3D(); let iu = 0, is = 0;
  for (const b of PICK_BLOCKS) for (const y of PICK_ROWS) {
    for (let k = 0; k <= b.n; k++) for (const yy of [y, y + PICK_DEPTH]) { d.position.copy(toV(b.x0 + k * PICK_BAY, yy, hgt / 2)); d.updateMatrix(); up.setMatrixAt(iu++, d.matrix); }
    for (let k = 0; k < b.n; k++) for (let l = 0; l <= PICK_LEVELS; l++) { d.position.copy(toV(b.x0 + (k + 0.5) * PICK_BAY, y + PICK_DEPTH / 2, 0.05 + l * SHELF_H)); d.updateMatrix(); shelf.setMatrixAt(is++, d.matrix); }
    // row end sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshBasicMaterial({ map: tex(128, 64, (g) => { g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#111'; g.font = '700 34px Inter, Arial'; g.textAlign = 'center'; g.fillText(`${'AB'[PICK_BLOCKS.indexOf(b)]}${PICK_ROWS.indexOf(y) + 1}`, 64, 46); }) }));
    sign.position.copy(toV(b.x0 - 0.05, y + PICK_DEPTH / 2, hgt + 0.3)); sign.rotation.y = -Math.PI / 2; world.add(sign);
  }
  up.count = iu; shelf.count = is; up.castShadow = shelf.castShadow = true; shelf.receiveShadow = true; world.add(up, shelf);
}
function buildReserveRacks(world) {
  const hgt = RES.levels * RES.levelH + 0.4;
  const nUp = RES.rows * (RES.bays + 1) * 4, nBeam = RES.rows * 2 * RES.bays * (RES.levels - 1) * 2;
  const up = new THREE.InstancedMesh(box(0.1, hgt, 0.1), mat('#2b62b8', { metalness: 0.5, roughness: 0.5 }), nUp);
  const beam = new THREE.InstancedMesh(box(0.12, 0.14, RES.bay - 0.1), mat('#f07a1a', { metalness: 0.4, roughness: 0.5 }), nBeam);
  const d = new THREE.Object3D(); let iu = 0, ib = 0;
  for (let r = 0; r < RES.rows; r++) {
    const xr = resRowX(r);
    for (let b = 0; b <= RES.bays; b++) for (const xx of [xr, xr + RES.depth - 0.05, xr + RES.depth + 0.05, xr + 2 * RES.depth]) { d.position.copy(toV(xx, RES.y0 + b * RES.bay, hgt / 2)); d.updateMatrix(); up.setMatrixAt(iu++, d.matrix); }
    for (let b = 0; b < RES.bays; b++) for (let l = 1; l < RES.levels; l++) for (const xx of [xr, xr + RES.depth - 0.05, xr + RES.depth + 0.05, xr + 2 * RES.depth]) { if (ib >= nBeam) break; d.position.copy(toV(xx, RES.y0 + (b + 0.5) * RES.bay, l * RES.levelH)); d.updateMatrix(); beam.setMatrixAt(ib++, d.matrix); }
  }
  up.count = iu; beam.count = ib; up.castShadow = beam.castShadow = true; world.add(up, beam);
}
function buildConveyorAndPack(world) {
  const len = CONVEYOR.x1 - CONVEYOR.x0;
  const belt = new THREE.Mesh(box(len, 0.12, CONVEYOR.w), mat('#2b2f33', { roughness: 0.9 })); belt.position.copy(toV(CONVEYOR.x0 + len / 2, CONVEYOR.y, 0.74)); belt.receiveShadow = true; world.add(belt);
  const rails = new THREE.Mesh(box(len, 0.2, CONVEYOR.w + 0.2), mat('#8a96a3', { metalness: 0.6 })); rails.position.copy(toV(CONVEYOR.x0 + len / 2, CONVEYOR.y, 0.6)); rails.castShadow = true; world.add(rails);
  const legs = new THREE.InstancedMesh(box(0.08, 0.6, CONVEYOR.w), mat('#5d6b78'), Math.ceil(len / 2) + 1); const d = new THREE.Object3D();
  for (let i = 0; i <= len / 2; i++) { d.position.copy(toV(CONVEYOR.x0 + i * 2, CONVEYOR.y, 0.3)); d.updateMatrix(); legs.setMatrixAt(i, d.matrix); } world.add(legs);
  for (const o of OUT_DOORS) { const ch = new THREE.Mesh(box(1.0, 0.1, CONVEYOR.y - LANE.y1), mat('#8a96a3', { metalness: 0.6 })); ch.position.copy(toV(o.x, (CONVEYOR.y + LANE.y1) / 2, 0.55)); ch.rotation.x = -0.12; world.add(ch); }
  for (const p of PACK) {
    const t = new THREE.Mesh(box(p.table.w, 0.08, p.table.y1 - p.table.y0), mat('#d8c7a6')); t.position.copy(toV(p.x, (p.table.y0 + p.table.y1) / 2, 0.88)); t.castShadow = t.receiveShadow = true; world.add(t);
    const frame = new THREE.Mesh(box(p.table.w - 0.1, 0.84, p.table.y1 - p.table.y0 - 0.1), mat('#6d7a86', { metalness: 0.4 })); frame.position.copy(toV(p.x, (p.table.y0 + p.table.y1) / 2, 0.42)); world.add(frame);
    const mon = new THREE.Mesh(box(0.55, 0.36, 0.04), new THREE.MeshStandardMaterial({ color: '#1a2330', emissive: '#2f6fd6', emissiveIntensity: 0.6 })); mon.position.copy(toV(p.x + 1, p.table.y0 + 0.2, 1.35)); world.add(mon);
    const shelf = new THREE.Mesh(box(p.table.w, 0.04, 0.5), mat('#cdd3d8')); shelf.position.copy(toV(p.x, p.table.y1 - 0.25, 1.75)); world.add(shelf);
  }
}
function buildChargers(world) {
  for (const c of CHARGERS) { const m = new THREE.Mesh(box(0.7, 1.1, 0.9), mat('#3a434c', { metalness: 0.4 })); m.position.copy(toV(c.x, c.y, 0.55)); m.castShadow = true; world.add(m); const s = new THREE.Mesh(box(0.05, 0.3, 0.5), lightMat('#3fd0a0')); s.position.copy(toV(c.x + 0.36, c.y, 0.8)); world.add(s); }
}

// ── vehicles & people ──────────────────────────────────────────────────────
function amrMesh() {
  const g = new THREE.Group(); g.userData.kind = 'amr';
  const base = new THREE.Mesh(box(0.95, 0.32, 0.7), mat('#f4f6f8', { roughness: 0.4 })); base.position.y = 0.22; g.add(base);
  const skirt = new THREE.Mesh(box(0.97, 0.08, 0.72), mat('#1f2428')); skirt.position.y = 0.06; g.add(skirt);
  const mast = new THREE.Mesh(box(0.08, 0.9, 0.08), mat('#9aa4ad', { metalness: 0.6 })); mast.position.set(-0.36, 0.83, 0); g.add(mast);
  const screen = new THREE.Mesh(box(0.05, 0.3, 0.42), new THREE.MeshStandardMaterial({ color: '#111820', emissive: '#2f8fd6', emissiveIntensity: 0.7 })); screen.position.set(-0.36, 1.32, 0); screen.rotation.z = 0.35; g.add(screen);
  const tote = new THREE.Mesh(box(0.6, 0.32, 0.45), mat('#e8792b')); tote.geometry.translate(0, 0.16, 0); tote.position.set(0.1, 0.4, 0); g.add(tote);
  const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 12), mat('#1f2428')); lidar.position.set(0.4, 0.42, 0); g.add(lidar);
  const light = new THREE.Mesh(box(0.3, 0.04, 0.72), lightMat('#3fd0a0')); light.position.set(0.05, 0.39, 0); g.add(light);
  g.userData.light = light; g.userData.tote = tote;
  g.traverse((o) => { o.castShadow = true; }); return g;
}
function forkMesh() {
  const g = new THREE.Group(); g.userData.kind = 'fork';
  const body = new THREE.Mesh(box(1.5, 1.1, 1.15), mat('#f2b632', { roughness: 0.5 })); body.position.set(-0.6, 0.65, 0); g.add(body);
  const guard = new THREE.Mesh(box(1.0, 0.06, 1.0), mat('#2a2f34')); guard.position.set(-0.7, 2.2, 0); g.add(guard);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(box(0.06, 1.0, 0.06), mat('#2a2f34')); p.position.set(-0.3, 1.7, s * 0.45); g.add(p); const p2 = p.clone(); p2.position.x = -1.15; g.add(p2); }
  const seat = new THREE.Mesh(box(0.4, 0.5, 0.45), mat('#1f2428')); seat.position.set(-0.75, 1.4, 0); g.add(seat);
  const driver = person('#ff9f43'); driver.scale.setScalar(0.75); driver.position.set(-0.75, 0.6, 0); g.add(driver);
  const mastH = 3.1; for (const s of [-1, 1]) { const m = new THREE.Mesh(box(0.1, mastH, 0.1), mat('#3a434c', { metalness: 0.5 })); m.position.set(0.25, mastH / 2, s * 0.42); g.add(m); }
  const carriage = new THREE.Group(); carriage.position.set(0.32, 0.15, 0); g.add(carriage);
  const plate = new THREE.Mesh(box(0.06, 0.6, 0.95), mat('#3a434c')); plate.position.set(0, 0.3, 0); carriage.add(plate);
  for (const s of [-1, 1]) { const f = new THREE.Mesh(box(1.15, 0.05, 0.12), mat('#8a96a3', { metalness: 0.7 })); f.position.set(0.6, 0.03, s * 0.3); carriage.add(f); }
  const pallet = new THREE.Group(); pallet.position.set(0.68, 0.12, 0); carriage.add(pallet);
  const pb = new THREE.Mesh(box(1.2, 0.14, 1.0), mat('#b8915a')); pb.position.y = 0.07; pallet.add(pb);
  const load = new THREE.Mesh(box(1.1, 1.15, 0.95), mat('#c59b6d')); load.position.y = 0.72; pallet.add(load);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 14), mat('#1a1a1a')); w.rotation.x = Math.PI / 2; w.position.set(-1.1, 0.2, s * 0.5); g.add(w); }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 6), lightMat('#ff9f43')); beacon.position.set(-0.7, 2.3, 0); g.add(beacon);
  g.userData.carriage = carriage; g.userData.pallet = pallet; g.userData.load = load;
  g.traverse((o) => { o.castShadow = true; }); return g;
}
const CAB_COLORS = ['#c83a2e', '#2f6fd6', '#2e8b57', '#e8b923', '#6b4fbf', '#d96b1a'];
const TRAILER_TEX = new Map();
function trailerTex(name) {
  if (!TRAILER_TEX.has(name)) TRAILER_TEX.set(name, tex(512, 128, (g) => { g.fillStyle = '#f2f2ef'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#c8ccd0'; for (let x = 0; x < 512; x += 32) g.fillRect(x, 0, 2, 128); g.fillStyle = '#1f3b63'; g.font = '700 40px Inter, Arial'; g.textAlign = 'center'; g.fillText(name, 256, 76); }));
  return TRAILER_TEX.get(name);
}
function truckMesh(tr) {
  const g = new THREE.Group(); g.userData.kind = 'truck';
  const ci = Math.abs(tr.carrier.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7)) % CAB_COLORS.length;
  const sideM = new THREE.MeshStandardMaterial({ map: trailerTex(tr.carrier), roughness: 0.6 });
  const plain = mat('#ecebe7');
  const trailer = new THREE.Mesh(box(TRAILER, 2.7, 2.5), [plain, plain, plain, plain, sideM, sideM]);
  trailer.position.set(TRAILER / 2, 1.35 + 1.0, 0); g.add(trailer);
  const chassis = new THREE.Mesh(box(TRAILER + 2, 0.3, 1.2), mat('#2a2d31')); chassis.position.set(TRAILER / 2 + 1, 0.85, 0); g.add(chassis);
  const fill = new THREE.Mesh(box(1, 0.14, 2.52), mat(tr.kind === 'out' ? '#3fd0a0' : '#ffb020')); fill.geometry.translate(0.5, 0, 0); fill.position.set(0, 3.75, 0); fill.scale.x = 0.001; g.add(fill);
  const cab = new THREE.Mesh(box(2.4, 2.6, 2.4), mat(CAB_COLORS[ci], { roughness: 0.35, metalness: 0.3 })); cab.position.set(TRAILER + 2.4, 1.9, 0); g.add(cab);
  const glass = new THREE.Mesh(box(0.05, 0.9, 2.0), new THREE.MeshStandardMaterial({ color: '#1d2a36', roughness: 0.1, metalness: 0.6 })); glass.position.set(TRAILER + 3.62, 2.5, 0); g.add(glass);
  for (const [x, s] of [[TRAILER + 3, 1], [TRAILER + 3, -1], [TRAILER + 0.8, 1], [TRAILER + 0.8, -1], [1.2, 1], [1.2, -1], [2.6, 1], [2.6, -1]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16), mat('#16171a')); w.rotation.x = Math.PI / 2; w.position.set(x, 0.5, s * 1.1); g.add(w); }
  g.userData.fill = fill;
  g.traverse((o) => { o.castShadow = true; });
  return g;
}
export function person(shirt) {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.6, 4, 8), mat('#2d3440')); legs.position.y = 0.45; g.add(legs);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 4, 8), mat(shirt)); body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), mat('#b07850')); head.position.y = 1.62; g.add(head);
  const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.2, 4, 8), mat('#d6ff3a', { emissive: '#3a4a00' })); vest.position.y = 1.2; g.add(vest);
  g.traverse((o) => { o.castShadow = true; });
  return g;
}
