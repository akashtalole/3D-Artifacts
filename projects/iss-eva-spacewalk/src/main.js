import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createMaterials } from './model/materials.js';
import { buildISS } from './model/iss.js';
import { buildAstronaut } from './model/astronaut.js';
import { buildIROSAPackage } from './model/solar.js';
import { buildCargoDragon } from './model/vehicles.js';
import { buildAntennaORU, buildDextreBody } from './model/antenna.js';
import { RoboticArm } from './model/arm.js';
import { box, tag } from './model/geom.js';
import { createEarth, createSky, createEnvironment } from './scene/earth.js';
import { Orbit, gmst } from './sim/orbit.js';
import { MissionPlayer } from './sim/timeline.js';
import { MISSIONS } from './data/missions.js';
import { COMPONENTS } from './data/components.js';
import { UI, GroundTrack } from './ui/ui.js';

const deg = THREE.MathUtils.degToRad;
const smooth = THREE.MathUtils.smoothstep;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const BELLY_DOWN = [0, -1, 0];
const OVERVIEW = { pos: new THREE.Vector3(64, 30, 86), target: new THREE.Vector3(-8, -1, 0) };
const TETHER_ANCHORS = { quest: [-7.35, 0.65, 7.95], poisk: [-26.35, 4.1, 1.4] };

// ── Renderer, scenes, cameras ────────────────────────────────────────────────
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();            // station — metres, near camera range
const far = new THREE.Scene();              // Earth, stars, Sun — same units, far camera range
far.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 4000);
const farCam = new THREE.PerspectiveCamera(45, 1, 2e4, 1.2e8);
camera.position.copy(OVERVIEW.pos);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.5;
controls.maxDistance = 700;
controls.target.copy(OVERVIEW.target);

const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });

const composer = new EffectComposer(renderer);
const farPass = new RenderPass(far, farCam);
const nearPass = new RenderPass(scene, camera);
nearPass.clear = false;
nearPass.clearDepth = true;
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.55, 3.2);
composer.addPass(farPass);
composer.addPass(nearPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ── World ────────────────────────────────────────────────────────────────────
const mats = createMaterials();
mats.glass.transparent = true;
mats.glass.opacity = 0.32;
mats.glass.side = THREE.DoubleSide;
mats.glass.depthWrite = false;
const iss = buildISS(mats);
scene.add(iss.group);
scene.environment = createEnvironment(renderer);

const sunLight = new THREE.DirectionalLight(0xfff4e6, 3.2);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(4096, 4096);
Object.assign(sunLight.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 460 });
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.05;
sunLight.target.position.set(-8, 0, 0);
scene.add(sunLight, sunLight.target);
const earthLight = new THREE.DirectionalLight(0x86a8ff, 0.6);
earthLight.position.set(0, -100, 0);
scene.add(earthLight);
const ambient = new THREE.AmbientLight(0x8a97b8, 0.05);
scene.add(ambient);

const earth = createEarth();
far.add(earth.group);
const sky = createSky();
far.add(sky.stars, sky.sun);

const selHelper = new THREE.Box3Helper(new THREE.Box3(), 0x5ce1e6);
selHelper.visible = false;
scene.add(selHelper);

// ── App state ────────────────────────────────────────────────────────────────
const state = {
  t: 0, orbitT: 0, playing: true, speed: 60, view: 'orbit',
  labels: true, tethers: true, quality: true, snap: true,
  selected: null, look: { yaw: 0, pitch: 0 },
  alpha: 0, beta: 0, rad: deg(18), helmetPitch: 0,
};
let mission, player, orbit;
const actors = {};       // crew id → { suit, smp, label, outside }
const payloadObjs = {};  // payload id → Object3D
const tethers = {};      // crew id → { anchors, line, last }
const live = {};         // per-frame positions of carriers (arm, era, crew, payloads)
const labelObjs = [];
const tmpSample = {};
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3();

const ui = new UI({
  missions: MISSIONS,
  onMission: (id) => loadMission(id),
  onTogglePlay: () => setPlaying(!state.playing),
  onSeek: (t) => seek(t),
  onSpeed: (s) => setSpeed(s),
  onView: (v) => setView(v),
  onToggle: (k) => toggle(k),
  onSelect: (cid) => select(cid),
  onFocusSelected: () => focusSelected(),
});
const groundTrack = new GroundTrack(document.getElementById('groundtrack'));

// ── Labels ───────────────────────────────────────────────────────────────────
function makeLabel(text, cls = '', cid = null) {
  const el = document.createElement('div');
  el.className = `lbl ${cls}`;
  el.textContent = text;
  if (cid) el.addEventListener('pointerdown', (e) => { e.stopPropagation(); select(cid, findByCid(cid)); });
  return new CSS2DObject(el);
}
for (const l of iss.labels) {
  const obj = makeLabel(l.text, '', l.cid);
  if (l.pos) obj.position.copy(l.pos);
  scene.add(obj);
  labelObjs.push({ def: l, obj });
}

function findByCid(cid) {
  let found = null;
  scene.traverse((o) => { if (!found && o.isMesh && o.userData.cid === cid && visibleChain(o)) found = o; });
  return found;
}
function visibleChain(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

// ── Visiting vehicles: approach zones & thruster glow ───────────────────────
let vehicle = null; // { group, plumes, def, prev, rate }
const zones = new THREE.Group();
{
  const kos = new THREE.Mesh(
    new THREE.SphereGeometry(200, 24, 12),
    new THREE.MeshBasicMaterial({ color: 0x5ce1e6, wireframe: true, transparent: true, opacity: 0.035, depthWrite: false }),
  );
  kos.position.set(-4, 0, 0);
  const corridor = new THREE.Mesh(
    new THREE.ConeGeometry(225 * Math.tan(THREE.MathUtils.degToRad(10)), 225, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb547, wireframe: true, transparent: true, opacity: 0.09, depthWrite: false }),
  );
  corridor.userData.isCorridor = true;
  zones.add(kos, corridor);
  zones.visible = false;
  scene.add(zones);
}
const plumeTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(190,215,255,0.6)');
  grd.addColorStop(1, 'rgba(120,160,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

function followPos(v) {
  if (mission?.follow?.[v]) return live[mission.follow[v]] || null;
  if (mission?.vehicle && v === 'ev1') return vehicle?.group.position || null;
  return actors[v]?.suit.root.position || null;
}
const followOffset = () => (mission?.vehicle ? new THREE.Vector3(16, 8, 18) : mission?.robotics ? new THREE.Vector3(9, 5, 11) : new THREE.Vector3(5.5, 3, 6.5));

// ── Mission loading ──────────────────────────────────────────────────────────
let firstLoad = true;
function loadMission(id) {
  mission = MISSIONS.find((m) => m.id === id) || MISSIONS[0];
  player = new MissionPlayer(mission);
  orbit = new Orbit({ epoch: new Date(mission.epoch), raanDeg: mission.raan, daylightAt: mission.daylightAt != null ? mission.daylightAt * 60 : null });
  iss.setConfig(mission.config);

  // Static parts a mission replaces with animated copies
  iss.dextre.visible = !(mission.hide || []).includes('dextre');
  iss.sgant.visible = !(mission.hide || []).includes('sgant');
  for (const { def } of labelObjs) if (def.cid === 'sgant') def.hidden = !iss.sgant.visible;

  // Restore static batteries, then hide the one this mission swaps
  for (const side of [1, -1]) iss.iea4[side]?.userData.batteries?.forEach((b) => { b.visible = true; });
  if (mission.hideBattery) {
    const b = iss.iea4[mission.hideBattery.side]?.userData.batteries?.[mission.hideBattery.index];
    if (b) b.visible = false;
  }

  // Crew
  for (const a of Object.values(actors)) { scene.remove(a.suit.root); }
  for (const k of Object.keys(actors)) delete actors[k];
  for (const t of Object.values(tethers)) scene.remove(t.line);
  for (const k of Object.keys(tethers)) delete tethers[k];
  for (const c of mission.crew) {
    const suit = buildAstronaut(mats, { suit: c.suit, stripes: c.stripes, label: c.role });
    const label = makeLabel(c.role, `crew ${c.id}`, c.suit === 'emu' ? 'emu' : 'orlan');
    label.position.set(0, 1.35, 0);
    suit.root.add(label);
    scene.add(suit.root);
    actors[c.id] = { def: c, suit, smp: {}, label, outside: false, hr: 80 };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 3), 3));
    const line = new THREE.Line(geo, mats.tether);
    line.frustumCulled = false;
    scene.add(line);
    tethers[c.id] = { anchors: [], line, last: new THREE.Vector3() };
  }

  // Payloads
  for (const o of Object.values(payloadObjs)) {
    scene.remove(o);
    o.userData.arms?.forEach(({ arm }) => scene.remove(arm.group));
  }
  for (const k of Object.keys(payloadObjs)) delete payloadObjs[k];
  for (const p of player.payloads) {
    let obj;
    if (p.kind === 'irosaPackage') obj = buildIROSAPackage(mats);
    else if (p.kind === 'battery') obj = tag(box(mats.battery, 0.9, 0.42, 1.0), 'iea');
    else if (p.kind === 'batteryOld') obj = tag(box(mats.batteryOld, 0.9, 0.42, 1.0), 'iea');
    else if (p.kind === 'antenna' || p.kind === 'antennaOld') obj = buildAntennaORU(mats, { aged: p.kind === 'antennaOld' });
    else if (p.kind === 'hand') obj = new THREE.Object3D();
    else if (p.kind === 'dextre') {
      obj = buildDextreBody(mats);
      // Dextre's two arms, solved each frame toward the hand markers
      obj.userData.arms = [-1, 1].map((sgn) => {
        const a = new RoboticArm(mats, { L1: 1.6, L2: 1.6, wrist: 0.4, boomR: 0.1, pole: [sgn, 0.6, 0.4], tipDir: [0, -1, 0], cid: 'dextre', baseLen: 0.3 });
        a.lee.scale.setScalar(0.6);
        [a.jShoulder, a.jElbow, a.jWrist].forEach((j) => j.scale.setScalar(0.45));
        a.base.scale.x = a.base.scale.z = 0.6;
        scene.add(a.group);
        return { arm: a, sgn };
      });
    }
    else obj = tag(box(mats.boxGray, 0.6, 0.4, 0.25), 'era');
    if (p.label) {
      const label = makeLabel(p.label, 'payload');
      label.position.set(0, p.kind === 'dextre' ? 2.3 : 0.9, 0);
      obj.add(label);
    }
    scene.add(obj);
    payloadObjs[p.id] = obj;
  }

  // Visiting vehicle
  if (vehicle) scene.remove(vehicle.group);
  vehicle = null;
  zones.visible = false;
  if (mission.vehicle) {
    const vd = mission.vehicle;
    const built = buildCargoDragon(mats);
    const plumes = built.thrusters.map((p) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: plumeTex, color: new THREE.Color(2.5, 2.6, 3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.position.copy(p);
      sp.scale.setScalar(0.9);
      sp.visible = false;
      built.group.add(sp);
      return sp;
    });
    const label = makeLabel(vd.label, 'vehicle', 'dragonCargo');
    label.position.set(-1.2, 2.6, 0);
    built.group.add(label);
    scene.add(built.group);
    vehicle = { group: built.group, plumes, def: vd, prev: null, rate: 0, port: new THREE.Vector3(...vd.port), axis: new THREE.Vector3(...vd.axis).normalize() };
    const corridor = zones.children.find((c) => c.userData.isCorridor);
    corridor.position.copy(vehicle.port).addScaledVector(vehicle.axis, 112.5);
    corridor.quaternion.setFromUnitVectors(Y, vehicle.axis.clone().negate());
    zones.visible = state.tethers;
  }

  // Overview camera on the sunlit side of the station
  const sun0 = orbit.state(0).sun;
  OVERVIEW.pos.set(sun0.x * 0.9 + 0.35, 0.3, Math.sign(sun0.z || 1) * 0.75)
    .normalize().multiplyScalar(118).add(OVERVIEW.target);
  if (state.view === 'orbit') flyTo(OVERVIEW.pos, OVERVIEW.target, firstLoad ? 0.01 : 1.6);
  firstLoad = false;

  ui.setMission(mission, player);
  if (mission.startView) setView(mission.startView);
  else if (['ev1', 'ev2', 'helmet'].includes(state.view) && !followPos(state.view)) setView('orbit');
  ui.toast(mission.title, mission.subtitle + '.');
  select(null);
  seek(0);
}

function seek(t) {
  state.t = THREE.MathUtils.clamp(t, 0, player.duration);
  state.orbitT = state.t;
  state.snap = true;
  rebuildTethers(state.t);
}

function setPlaying(p) {
  if (p && state.t >= player.duration && !mission.loop) seek(0);
  state.playing = p;
  ui.setPlaying(p);
}

const SPEEDS = [1, 10, 60, 300];
function setSpeed(s) { state.speed = s; ui.setSpeed(s); }

function toggle(k) {
  state[k] = !state[k];
  ui.setToggle(k, state[k]);
  if (k === 'labels') document.getElementById('labels').classList.toggle('off', !state.labels);
  if (k === 'quality') applyQuality();
}

function applyQuality() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, state.quality ? 2 : 1));
  renderer.shadowMap.enabled = state.quality;
  bloom.enabled = state.quality;
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  resize();
}

// ── Safety tethers ───────────────────────────────────────────────────────────
// The 85-ft reel is hooked near the hatch; crews re-route it along handrails as they
// translate. Here a new routing point is added every ~16 m and removed on the way back.
function tetherStep(T, pos, attachedTo) {
  if (attachedTo) {
    T.anchors = [live[attachedTo] ? live[attachedTo].clone() : pos.clone()];
    T.anchors[0].armed = true;
    T.riding = true;
    T.last.copy(pos);
    return;
  }
  if (T.riding) { T.riding = false; T.anchors = [pos.clone()]; }
  const top = T.anchors[T.anchors.length - 1];
  const d = pos.distanceTo(top);
  if (d > 3) top.armed = true;
  if (d > 16) {
    const a = T.last.clone();
    T.anchors.push(a);
  } else if (T.anchors.length > 1 && top.armed && d < 1.2) {
    T.anchors.pop();
  }
  T.last.copy(pos);
}

function rebuildTethers(t) {
  if (!mission?.airlock) return;
  for (const c of mission.crew) {
    const T = tethers[c.id];
    const start = new THREE.Vector3(...TETHER_ANCHORS[mission.airlock]);
    T.anchors = [start];
    T.riding = false;
    T.last.copy(start);
    for (let tau = 0; tau <= t; tau += 6) {
      const att = player.attachmentOf(c.id, tau);
      const p = player.positionAt(c.id, tau, tmpSample);
      if (att) live[att.to] = player.positionAt(att.to, tau, tmpSample);
      tetherStep(T, p, att?.to);
    }
  }
}

function drawTether(T, waist, visible) {
  T.line.visible = visible;
  if (!visible) return;
  const pts = [...T.anchors, waist];
  const arr = T.line.geometry.attributes.position.array;
  let n = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < pts.length - 1 && n < 390; i++) {
    a.copy(pts[i]); b.copy(pts[i + 1]);
    const len = a.distanceTo(b);
    c.addVectors(a, b).multiplyScalar(0.5);
    _v.subVectors(b, a).cross(Y);
    if (_v.lengthSq() < 1e-6) _v.set(1, 0, 0);
    c.addScaledVector(_v.normalize(), len * 0.06).addScaledVector(Y, -len * 0.04);
    const seg = Math.min(24, Math.max(4, Math.ceil(len * 2)));
    for (let k = i === 0 ? 0 : 1; k <= seg; k++) {
      const s = k / seg;
      p.set(0, 0, 0).addScaledVector(a, (1 - s) * (1 - s)).addScaledVector(c, 2 * s * (1 - s)).addScaledVector(b, s * s);
      arr[n * 3] = p.x; arr[n * 3 + 1] = p.y; arr[n * 3 + 2] = p.z;
      n++;
    }
  }
  T.line.geometry.setDrawRange(0, n);
  T.line.geometry.attributes.position.needsUpdate = true;
}

// ── Cameras ──────────────────────────────────────────────────────────────────
let tween = null;
function flyTo(pos, target, dur = 1.4) {
  tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), start: performance.now(), dur: dur * 1000 };
}

function setView(v) {
  if ((v === 'ev1' || v === 'ev2') && !followPos(v)) return;
  if (v === 'helmet' && !actors.ev1 && !mission.vehicle && !mission.robotics) return;
  const prev = state.view;
  state.view = v;
  state.look.yaw = state.look.pitch = 0;
  ui.setView(v);
  const firstPerson = v === 'helmet' || v === 'cupola';
  controls.enabled = !firstPerson;
  camera.fov = firstPerson ? 72 : 45;
  camera.updateProjectionMatrix();
  if (firstPerson) { tween = null; return; }
  if (prev === 'helmet' || prev === 'cupola') { camera.position.copy(OVERVIEW.pos); controls.target.copy(OVERVIEW.target); }
  if (v === 'orbit') flyTo(OVERVIEW.pos, OVERVIEW.target);
  else if (v === 'worksite') {
    const t = new THREE.Vector3(...mission.worksite.target);
    flyTo(t.clone().add(new THREE.Vector3(...mission.worksite.offset)), t);
  } else if (followPos(v)) {
    const p = followPos(v);
    flyTo(p.clone().add(followOffset()), p.clone());
  }
}

function updateCamera(dt) {
  const v = state.view;
  if (v === 'helmet' && mission.robotics) {
    // Camera on Canadarm2's wrist, looking down past the Latching End Effector
    const arm = iss.canadarm;
    _v.subVectors(arm.wrist, arm.elbow).normalize();
    camera.position.copy(arm.wrist).addScaledVector(_v, 0.6).add(new THREE.Vector3(0.6, 0.2, 0.6));
    _m.lookAt(camera.position, arm.tip.clone().addScaledVector(arm.tipDir, 2.5), _v.clone().negate());
    camera.quaternion.setFromRotationMatrix(_m).multiply(lookOffset());
    return;
  }
  if (v === 'helmet' && mission.vehicle && vehicle) {
    // Centerline camera on the docking adapter, looking out along the approach axis
    camera.position.copy(vehicle.port).addScaledVector(vehicle.axis, 0.4).add(new THREE.Vector3(0, 0, 1.0));
    _m.lookAt(camera.position, _v.copy(camera.position).addScaledVector(vehicle.axis, 10), X);
    camera.quaternion.setFromRotationMatrix(_m).multiply(lookOffset());
    return;
  }
  if (v === 'helmet' && actors.ev1) {
    const suit = actors.ev1.suit;
    suit.helmetCam.getWorldPosition(camera.position);
    // Look out of the visor: ahead along the route while translating, slightly down at a worksite
    const pitchTarget = actors.ev1.mode === 'translate' ? 1.05 : -0.2;
    state.helmetPitch += (pitchTarget - state.helmetPitch) * Math.min(1, dt * 3);
    _q.copy(suit.root.quaternion)
      .multiply(new THREE.Quaternion().setFromAxisAngle(Y, Math.PI))
      .multiply(new THREE.Quaternion().setFromAxisAngle(X, state.helmetPitch));
    camera.quaternion.copy(_q).multiply(lookOffset());
    return;
  }
  if (v === 'cupola') {
    const eye = iss.cupolaEye;
    camera.position.copy(eye);
    _m.lookAt(eye, _v.copy(eye).add(new THREE.Vector3(0.25, -1, 0)), X);
    camera.quaternion.setFromRotationMatrix(_m).multiply(lookOffset());
    return;
  }
  if (tween) {
    const k = Math.min(1, (performance.now() - tween.start) / tween.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const fp = followPos(v);
    if (fp) {                  // track a moving target while flying in
      tween.p1.copy(fp).add(followOffset());
      tween.t1.copy(fp);
    }
    camera.position.lerpVectors(tween.p0, tween.p1, e);
    controls.target.lerpVectors(tween.t0, tween.t1, e);
    if (k >= 1) tween = null;
  } else if (followPos(v)) {
    const p = followPos(v);
    _v.subVectors(p, controls.target);
    controls.target.add(_v);
    camera.position.add(_v);
  }
  controls.update(dt);
}

function lookOffset() {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(state.look.pitch, state.look.yaw, 0, 'YXZ'));
}

// ── Picking ──────────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;
function pickAt(x, y) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    const cid = h.object.userData.cid;
    if (cid && h.object.isMesh && visibleChain(h.object)) return { cid, object: h.object };
  }
  return null;
}

function select(cid, object = null) {
  state.selected = cid ? { cid, object: object || findByCid(cid) } : null;
  ui.showInspector(cid);
  updateSelectionBox(true);
}

function selectionRoot() {
  const s = state.selected;
  if (!s?.object) return null;
  let o = s.object;
  while (o.parent && o.parent.userData.cid === s.cid && o.parent !== iss.group) o = o.parent;
  return o;
}

let selFrame = 0;
function updateSelectionBox(force) {
  const root = selectionRoot();
  selHelper.visible = !!root;
  if (!root) return;
  if (force || ++selFrame % 6 === 0) selHelper.box.setFromObject(root);
}

function focusSelected() {
  const root = selectionRoot();
  if (!root) return;
  if (state.view !== 'orbit' && state.view !== 'worksite') setView('orbit');
  const b = new THREE.Box3().setFromObject(root);
  const c = b.getCenter(new THREE.Vector3());
  const size = Math.max(4, b.getSize(new THREE.Vector3()).length());
  const dir = camera.position.clone().sub(controls.target).normalize();
  state.view = 'free';
  ui.setView('');
  flyTo(c.clone().addScaledVector(dir, size * 1.25), c);
}

canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, yaw: state.look.yaw, pitch: state.look.pitch }; });
canvas.addEventListener('pointermove', (e) => {
  if (downAt && (state.view === 'helmet' || state.view === 'cupola') && e.buttons) {
    state.look.yaw = downAt.yaw + (e.clientX - downAt.x) * 0.004;
    state.look.pitch = THREE.MathUtils.clamp(downAt.pitch + (e.clientY - downAt.y) * 0.004, -1.2, 1.2);
    return;
  }
  if (e.buttons) return;
  hoverQueued = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 5) return;
  const hit = pickAt(e.clientX, e.clientY);
  select(hit?.cid || null, hit?.object || null);
});
canvas.addEventListener('pointerleave', () => ui.tooltip(null));
controls.addEventListener('start', () => {
  tween = null;
  if (state.view === 'orbit' || state.view === 'worksite') { state.view = 'free'; ui.setView(''); }
});
let hoverQueued = null;
let lastHover = 0;
function processHover(now) {
  if (!hoverQueued || now - lastHover < 70) return;
  lastHover = now;
  const { x, y } = hoverQueued;
  hoverQueued = null;
  const hit = pickAt(x, y);
  canvas.style.cursor = hit ? 'pointer' : 'default';
  ui.tooltip(hit ? COMPONENTS[hit.cid]?.name || hit.cid : null, x, y);
}

// ── Keyboard ─────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
  const k = e.key;
  if (k === ' ') { e.preventDefault(); setPlaying(!state.playing); }
  else if (k === 'ArrowRight') seek(state.t + 60);
  else if (k === 'ArrowLeft') seek(state.t - 60);
  else if (k >= '1' && k <= '6') setView(['orbit', 'ev1', 'ev2', 'helmet', 'worksite', 'cupola'][+k - 1]);
  else if (k === 'l' || k === 'L') toggle('labels');
  else if (k === 't' || k === 'T') toggle('tethers');
  else if (k === 'q' || k === 'Q') toggle('quality');
  else if (k === 'h' || k === 'H') document.getElementById('app').classList.toggle('ui-hidden');
  else if (k === 'f' || k === 'F') ui.toggleFullscreen();
  else if (k === '?') ui.toggleHelp();
  else if (k === 'Escape') { ui.toggleHelp(false); select(null); }
  else if (k === '[' || k === ']') {
    const i = SPEEDS.indexOf(state.speed);
    setSpeed(SPEEDS[THREE.MathUtils.clamp(i + (k === ']' ? 1 : -1), 0, SPEEDS.length - 1)]);
  }
});

// ── Simulation update ────────────────────────────────────────────────────────
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function approachAngle(cur, target, maxStep) {
  const d = wrapPi(target - cur);
  return cur + THREE.MathUtils.clamp(d, -maxStep, maxStep);
}

function orient(obj, up, face, k) {
  _by.copy(up).normalize();
  _bz.copy(face).addScaledVector(_by, -_bz.copy(face).dot(_by));
  if (_bz.lengthSq() < 1e-4) {
    _bz.set(1, 0, 0).addScaledVector(_by, -_by.x);
    if (_bz.lengthSq() < 1e-4) _bz.set(0, 0, 1).addScaledVector(_by, -_by.z);
  }
  _bz.normalize();
  _bx.crossVectors(_by, _bz);
  _m.makeBasis(_bx, _by, _bz);
  _q.setFromRotationMatrix(_m);
  obj.quaternion.slerp(_q, k);
}

const v3 = (a) => (a ? _v.set(a[0], a[1], a[2]) : null);
const faceTmp = new THREE.Vector3();
const upTmp = new THREE.Vector3();
let sunFactor = 1;

function update(dtReal, now) {
  const dtSim = state.playing ? dtReal * state.speed : 0;
  if (state.playing) {
    state.t += dtSim;
    state.orbitT += dtSim;
    if (state.t >= player.duration) {
      if (mission.loop) state.t -= player.duration;
      else { state.t = player.duration; setPlaying(false); }
    }
  }
  const t = state.t;
  const snap = state.snap;

  // Orbit, Sun, Earth
  const s = orbit.state(state.orbitT);
  const sun = s.sun;
  sunFactor = smooth(s.sunElevation, -0.35, 1.4);
  sunLight.intensity = 3.2 * sunFactor;
  sunLight.color.setRGB(1, 0.62 + 0.34 * sunFactor, 0.42 + 0.5 * sunFactor);
  sunLight.position.copy(sunLight.target.position).addScaledVector(sun, 220);
  sunLight.castShadow = state.quality;
  earthLight.intensity = 0.04 + 0.7 * smooth(sun.y, -0.2, 0.8);
  ambient.intensity = 0.05 + 0.04 * sunFactor;
  scene.environmentIntensity = 0.12 + 0.6 * sunFactor;

  earth.group.position.set(0, -orbit.a * 1000, 0);
  earth.group.quaternion.setFromRotationMatrix(s.earthRot);
  earth.uniforms.sunDir.value.copy(sun);
  earth.uniforms.cloudShift.value = (state.orbitT / 86400) * 0.03;
  sky.stars.quaternion.setFromRotationMatrix(s.L);
  sky.sun.position.copy(sun).multiplyScalar(4e7);

  // Arrays: sun-tracking in free orbit, parked/locked for EVA work
  let aT = 0, bT = 0, rT = deg(18);
  if (mission.sunTracking) {
    aT = Math.atan2(-sun.x, sun.y);
    bT = Math.asin(THREE.MathUtils.clamp(sun.z, -1, 1));
    rT = THREE.MathUtils.clamp(Math.atan(sun.y / (Math.abs(sun.x) > 1e-3 ? sun.x : 1e-3)), deg(-25), deg(75));
  }
  const step = snap ? Math.PI * 2 : deg(14 / 60) * dtSim + 1e-4;
  state.alpha = approachAngle(state.alpha, aT, step);
  state.beta = approachAngle(state.beta, bT, step);
  state.rad = approachAngle(state.rad, rT, step * 0.6);
  iss.setArrays(state.alpha, state.beta);
  iss.setRadiators(state.rad);

  // Robotics & hatches
  iss.setMBS(player.scalar('mbs', t, 0));
  if (!player.tracks.arm?.empty) iss.canadarm.solve(player.tracks.arm.sample(t, tmpSample).pos);
  live.arm = iss.canadarm.tip;
  if (player.tracks.era && mission.config.nauka) iss.era.solve(player.tracks.era.sample(t, tmpSample).pos);
  else if (mission.config.nauka) iss.era.solve(new THREE.Vector3(-23.4, -18.5, 0));
  live.era = iss.era.tip;
  const h = player.scalar('hatch', t, 0);
  iss.hatches.quest.rotation.x = mission.airlock === 'quest' ? -h * deg(110) : 0;
  iss.hatches.poisk.rotation.y = mission.airlock === 'poisk' ? h * deg(110) : 0;
  if (mission.irosaTarget) {
    const ir = iss.irosa[mission.irosaTarget];
    ir.root.visible = player.scalar(`irosa${mission.irosaTarget}`, t, 0) > 0.5;
    ir.setDeploy(player.scalar(`deploy${mission.irosaTarget}`, t, 0));
  }

  // Crew
  const slerpK = snap ? 1 : 1 - Math.exp(-dtReal * 5);
  for (const [id, A] of Object.entries(actors)) {
    const root = A.suit.root;
    const prev = _v.copy(root.position);
    const px = prev.x, py = prev.y, pz = prev.z;
    const att = player.attachmentOf(id, t);
    let mode;
    if (att) {
      root.position.copy(live[att.to]).add(att.offV);
      mode = att.mode || 'work';
      upTmp.set(...(att.up || [0, 1, 0]));
      faceTmp.set(...(att.face || [1, 0, 0]));
      A.outside = true;
    } else {
      const smp = player.tracks[id].sample(t, A.smp);
      root.position.copy(smp.pos);
      if (smp.moving) {
        mode = 'translate';
        upTmp.copy(smp.tangent);
        faceTmp.set(...(smp.key.belly || BELLY_DOWN));
        A.outside = true;
      } else {
        const k = smp.key || {};
        mode = k.lock ? 'idle' : 'work';
        upTmp.set(...(k.up || [0, 1, 0]));
        faceTmp.set(...(k.face || [1, 0, 0]));
        A.outside = !k.lock;
      }
    }
    orient(root, upTmp, faceTmp, slerpK);
    const moved = Math.hypot(root.position.x - px, root.position.y - py, root.position.z - pz);
    A.suit.animate(mode, Math.min(moved, 0.05), now / 1000);
    A.suit.setLights(sunFactor < 0.25 && A.outside);
    A.label.element.classList.toggle('hidden', !A.outside);
    A.mode = mode;
    live[id] = root.position;

    const T = tethers[id];
    if (mission.airlock && dtSim > 0) tetherStep(T, root.position, att?.to);
    const waist = root.localToWorld(new THREE.Vector3(0.3, 0, 0));
    drawTether(T, waist, state.tethers && A.outside && !!mission.airlock);
  }

  // Payloads
  for (const p of player.payloads) {
    const obj = payloadObjs[p.id];
    obj.visible = t >= p.show[0] && t <= p.show[1];
    const att = player.attachmentOf(p.id, t);
    if (att) obj.position.copy(live[att.to]).add(att.offV);
    else obj.position.copy(p.track.sample(t, tmpSample).pos);
    live[p.id] = obj.position;
  }

  // Dextre arms follow their hand markers
  const dex = payloadObjs.dextre;
  if (dex?.userData.arms) {
    for (const { arm, sgn } of dex.userData.arms) {
      arm.setBase(dex.position.clone().add(new THREE.Vector3(sgn * 1.1, 0.9, 0)), [sgn, 0, 0]);
      const hand = live[sgn < 0 ? 'dexL' : 'dexR'];
      if (hand) arm.solve(hand);
    }
  }
  if (mission.robotics) {
    const arm = iss.canadarm;
    const tip = arm.tip;
    if (state.prevTip && dtSim > 0) state.tipSpeed += ((tip.distanceTo(state.prevTip) / dtSim) - state.tipSpeed) * 0.2;
    if (snap || !state.prevTip) state.tipSpeed = 0;
    state.prevTip = (state.prevTip || new THREE.Vector3()).copy(tip);
    const ph = player.phases[player.phaseIndex(t)];
    state.robotics = {
      mbs: iss.mbs.position.z,
      reach: arm.wrist.distanceTo(arm.shoulder) / (arm.L1 + arm.L2),
      speed: state.tipSpeed,
      carrying: player.attachmentOf('dextre', t) ? (player.attachmentOf('oruNew', t) || player.attachmentOf('oruOld', t) ? 'Dextre + antenna ORU' : 'Dextre') : '—',
      status: ph?.title || '',
    };
  }

  // Visiting vehicle: approach, attitude, RCS pulses
  if (vehicle && player.tracks.vehicle) {
    const smp = player.tracks.vehicle.sample(t, tmpSample);
    const g = vehicle.group;
    g.position.copy(smp.pos);
    const toPort = _v.subVectors(vehicle.port, g.position);
    const dist = toPort.length();
    const alignT = (vehicle.def.noseAlignBy ?? 0) * 60;
    const k = smooth(t, alignT - 480, alignT);
    const nose = new THREE.Vector3().copy(dist > 1e-3 ? toPort.normalize() : vehicle.axis.clone().negate())
      .lerp(vehicle.axis.clone().negate(), k).normalize();
    _q.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), nose);
    g.quaternion.slerp(_q, snap ? 1 : 1 - Math.exp(-dtReal * 3));
    const range = g.position.distanceTo(vehicle.port);
    if (vehicle.prev != null && dtSim > 0) vehicle.rate += (((vehicle.prev - range) / dtSim) - vehicle.rate) * 0.2;
    if (snap) vehicle.rate = smp.moving ? smp.speed : 0;
    vehicle.prev = range;
    const firing = smp.moving && state.playing && Math.random() < (range < 40 ? 0.45 : 0.25);
    vehicle.plumes.forEach((p) => { p.visible = firing && Math.random() < 0.6; p.scale.setScalar(0.6 + Math.random() * 0.7); });
    const rel = new THREE.Vector3().subVectors(g.position, vehicle.port);
    const along = rel.dot(vehicle.axis);
    const off = rel.addScaledVector(vehicle.axis, -along).length();
    const att = THREE.MathUtils.radToDeg(new THREE.Vector3(-1, 0, 0).applyQuaternion(g.quaternion).angleTo(vehicle.axis.clone().negate()));
    const docked = range < 0.05;
    const ph = player.phases[player.phaseIndex(t)];
    state.approach = { range, rate: docked ? 0 : vehicle.rate, off, att, docked, hold: !smp.moving && !docked, status: (!smp.moving && !docked ? 'Hold · ' : '') + (ph?.title || '') };
    live.vehicle = g.position;
  }
  zones.visible = !!vehicle && state.tethers;

  // Labels that follow moving parts
  for (const { def, obj } of labelObjs) {
    if (def.dynamic) obj.position.copy(def.dynamic());
    const tooFar = def.minor && obj.position.distanceTo(camera.position) > 42;
    obj.element.classList.toggle('hidden', !!def.hidden || tooFar);
  }

  updateSelectionBox(false);
  state.snap = false;
  return s;
}

// ── HUD telemetry (≈ 8 Hz) ───────────────────────────────────────────────────
let lastHud = 0, lastMap = 0;
function updateHud(now, s) {
  ui.setTime(state.t, player);
  if (now - lastHud < 120) return;
  lastHud = now;
  if (vehicle && state.approach) ui.setApproach(state.approach);
  if (mission.robotics && state.robotics) ui.setRobotics(state.robotics);
  ui.setOrbit(s, orbit, { alphaDeg: ((THREE.MathUtils.radToDeg(state.alpha) % 360) + 360) % 360, betaDeg: THREE.MathUtils.radToDeg(state.beta), parked: !mission.sunTracking });
  const hours = state.t / 3600;
  for (const [id, A] of Object.entries(actors)) {
    const emu = A.def.suit === 'emu';
    const act = A.mode === 'translate' ? 1 : A.mode === 'work' || A.mode === 'ride' ? 0.55 : 0.1;
    A.hr += ((76 + act * 34 + Math.sin(state.t / 23 + id.length) * 4) - A.hr) * 0.15;
    ui.setSuit(id, {
      hr: A.hr,
      o2: Math.max(8, 100 - hours * (emu ? 9.2 : 10.5) - act * 1.5),
      batt: Math.max(5, 100 - hours * (emu ? 11 : 12.5)),
      co2: 0.9 + act * 2.1 + 0.25 * Math.sin(state.t / 41),
      p: (emu ? 4.3 : 5.8) + Math.sin(state.t / 53) * 0.02,
    });
    ui.setCrewStatus(id, A.outside);
  }
  if (now - lastMap > 250) {
    lastMap = now;
    if (!groundTrack.img && earth.uniforms.hasTex.value) groundTrack.setImage(earth.uniforms.dayMap.value.image);
    const sunE = s.sunEci.clone();
    const g = gmst(s.date);
    groundTrack.draw(orbit, s, sunE, g);
  }
}

// ── Resize & loop ────────────────────────────────────────────────────────────
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
  for (const c of [camera, farCam]) { c.aspect = w / h; c.updateProjectionMatrix(); }
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
let firstFrame = true;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const now = performance.now();
  const s = update(dt, now);
  updateCamera(dt);
  farCam.position.copy(camera.position);
  farCam.quaternion.copy(camera.quaternion);
  farCam.fov = camera.fov;
  farCam.updateProjectionMatrix();
  processHover(now);
  composer.render();
  labelRenderer.render(scene, camera);
  updateHud(now, s);
  if (firstFrame) { firstFrame = false; setTimeout(() => ui.doneLoading(), 250); }
  requestAnimationFrame(frame);
}

// ── Boot ─────────────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const DEFAULT_MISSION = 'crs35'; // latest mission first
ui.setMissions(MISSIONS, params.get('mission') || DEFAULT_MISSION);
applyQuality();
loadMission(params.get('mission') || DEFAULT_MISSION);
if (params.has('t')) seek(+params.get('t') * 60);
if (params.has('speed')) setSpeed(+params.get('speed'));
if (params.get('paused') === '1') setPlaying(false); else setPlaying(true);
if (params.has('view')) { setView(params.get('view')); tween && (tween.dur = 1); }
window.__iss = { state, iss, scene, far, farCam, earth, sky, camera, controls, seek, setView, loadMission, setPlaying, renderer }; // debugging hook
requestAnimationFrame(frame);
