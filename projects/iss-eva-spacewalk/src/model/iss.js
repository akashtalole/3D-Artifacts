import * as THREE from 'three';
import { TRUSS, PV, WINGS, MODULES, QUEST, MSS, IEA_TOP, TRUSS_TOP } from './layout.js';
import { StrutBatch, latticeAlongZ, moduleMesh, panel, box, shadowed, tag, placeBetween, v3 } from './geom.js';
import { withRepeat } from './materials.js';
import { buildSolarWing, buildIROSA, buildPVR } from './solar.js';
import { RoboticArm } from './arm.js';
import { buildCrewDragon, buildSoyuz, buildProgress, solarWings, buildCargoDragon, buildCygnus } from './vehicles.js';
import { buildZ1, buildAntennaORU, SGANT_MOUNT } from './antenna.js';

const deg = THREE.MathUtils.degToRad;

// Labels always shown; everything else appears when the camera gets close.
const MAJOR = new Set(['sgant', 'destiny', 'harmony', 'unity', 'columbus', 'kibo', 'tranquility', 'quest', 'cupola', 'zarya', 'zvezda', 'poisk', 'nauka', 'dragon', 'soyuz', 'progress', 'ams', 'canadarm2']);

/** Lathe solid of revolution around local +x. Profile points are [radius, x]. */
function latheX(mat, pts, seg = 48) {
  const geo = new THREE.LatheGeometry(pts.map(([r, x]) => new THREE.Vector2(r, x)), seg);
  geo.rotateZ(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Orient an object built along local +x so that it points along `dir` ('+x','-x','+y','-y','+z','-z'). */
function pointAlong(obj, dir) {
  const r = { '+x': [0, 0, 0], '-x': [0, Math.PI, 0], '+y': [0, 0, Math.PI / 2], '-y': [0, 0, -Math.PI / 2], '+z': [0, -Math.PI / 2, 0], '-z': [0, Math.PI / 2, 0] }[dir];
  obj.rotation.set(...r);
  return obj;
}

function connector(mats, a, b, r = 0.95) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 32, 1, true), mats.ring);
  placeBetween(m, v3(a), v3(b));
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function buildISS(mats) {
  const iss = new THREE.Group();
  iss.name = 'ISS';
  const labels = [];
  const add = (obj, cid, label, labelPos) => {
    if (cid) tag(obj, cid);
    iss.add(obj);
    if (label) labels.push({ cid, text: label, pos: new THREE.Vector3(...labelPos), minor: !MAJOR.has(cid) });
    return obj;
  };
  const place = (obj, c) => { obj.position.set(...c); return obj; };

  // ── US pressurised modules ───────────────────────────────────────────────
  const mod = (key, opts = {}) => {
    const d = MODULES[key];
    return place(moduleMesh(mats, { L: d.L, r: d.r, axis: d.axis, ...opts }), d.c);
  };
  add(mod('destiny'), 'destiny', 'Destiny', [0, 2.6, -1]);
  add(mod('harmony'), 'harmony', 'Harmony', [8.4, -2.8, 0]);
  add(mod('unity'), 'unity', 'Unity', [-7.35, -2.8, 0]);
  add(mod('columbus'), 'columbus', 'Columbus', [8.4, 2.6, 6.5]);
  add(mod('kibo'), 'kibo', 'Kibo', [8.4, -2.7, -9]);
  add(mod('kiboELM'), 'kiboELM', null);
  add(mod('tranquility'), 'tranquility', 'Tranquility', [-7.35, 2.7, -7]);
  add(mod('leonardo'), 'leonardo', 'Leonardo', [-1.8, -2.7, -5.65]);
  iss.add(connector(mats, [4.25, 0, 0], [4.8, 0, 0]));
  iss.add(connector(mats, [-4.25, 0, 0], [-4.6, 0, 0]));

  // Columbus external payloads (CEPF) on the outboard end cone
  for (const [dx, dy] of [[1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2]]) {
    add(box(mats.boxGray, 0.9, 0.9, 0.7, [8.4 + dx, dy, 9.4]), 'columbus');
  }

  // Kibo Exposed Facility + JEM-RMS
  const ef = new THREE.Group();
  ef.add(box(mats.white, 5.0, 0.9, 5.6, [0, 0, 0]));
  const efBoxes = [[-1.6, -1.6], [0, -1.6], [1.6, -1.6], [-1.6, 0.4], [1.2, 0.6], [-0.4, 2.0], [1.6, 2.0]];
  efBoxes.forEach(([x, z], i) => ef.add(box(i % 2 ? mats.boxGray : mats.kapton, 1.3, 0.8 + (i % 3) * 0.2, 1.2, [x, 0.9, z])));
  add(place(ef, [8.4, -0.4, -16.4]), 'kiboEF', 'JEM-EF', [8.4, 1.8, -16.4]);
  const jem = new THREE.Group();
  const jemPts = [v3([8.4, 2.3, -11.8]), v3([7.6, 6.4, -14.4]), v3([8.0, 2.9, -18.2])];
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1, 14), mats.canadarm);
    placeBetween(b, jemPts[i], jemPts[i + 1]);
    jem.add(b);
  }
  jemPts.forEach((p) => jem.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), mats.darkMetal), p.toArray())));
  add(shadowed(jem), 'jemrms');

  // Quest airlock: equipment lock + crew lock with the EVA hatch, O2/N2 tanks
  const quest = new THREE.Group();
  const eq = moduleMesh(mats, { L: QUEST.equip.z1 - QUEST.equip.z0, r: QUEST.equip.r, axis: 'z', handrails: false });
  eq.position.set(QUEST.x, 0, (QUEST.equip.z0 + QUEST.equip.z1) / 2);
  const cl = moduleMesh(mats, { L: QUEST.crew.z1 - QUEST.crew.z0, r: QUEST.crew.r, axis: 'z', endCaps: false });
  cl.position.set(QUEST.x, 0, (QUEST.crew.z0 + QUEST.crew.z1) / 2);
  quest.add(eq, cl);
  const hatchRim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 10, 32), mats.ring);
  hatchRim.position.set(QUEST.x, 0, QUEST.crew.z1 + 0.02);
  quest.add(hatchRim);
  const cap = new THREE.Mesh(new THREE.RingGeometry(0.5, QUEST.crew.r, 40), mats.mli);
  cap.position.set(QUEST.x, 0, QUEST.crew.z1);
  quest.add(cap);
  const questHatch = new THREE.Group();
  questHatch.position.set(QUEST.x, 0.5, QUEST.crew.z1 + 0.05);
  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 32), mats.ring);
  door.rotation.x = Math.PI / 2;
  door.position.y = -0.5;
  questHatch.add(door);
  quest.add(questHatch);
  for (const [dx, dy, z] of [[1.75, -1.4, 3.1], [-1.75, -1.4, 3.1], [1.75, -1.4, 4.3], [-1.75, -1.4, 4.3]]) {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 14), mats.white);
    tank.position.set(QUEST.x + dx, dy, z);
    quest.add(tank);
  }
  // handrails along the crew route over the airlock
  for (let i = 0; i < 6; i++) quest.add(box(mats.handrail, 0.05, 0.05, 0.6, [QUEST.x + 0.35, 1.05 + (i > 2 ? 1.0 : 0), 7.3 - i * 1.0]));
  add(shadowed(quest), 'quest', 'Quest airlock', [QUEST.x, 2.4, 6.5]);

  // Cupola (nadir of Tranquility)
  const cupola = new THREE.Group();
  const cupBase = new THREE.Mesh(new THREE.CylinderGeometry(1.475, 1.475, 0.5, 40), mats.mli);
  cupBase.position.y = -0.25;
  const cupWin = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 0.75, 0.85, 6, 1, true), mats.glass);
  cupWin.position.y = -0.5 - 0.425;
  const cupTop = new THREE.Mesh(new THREE.RingGeometry(0.41, 0.78, 6, 1, Math.PI / 6), new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.4, metalness: 0.8, side: THREE.DoubleSide }));
  cupTop.rotation.x = Math.PI / 2;
  cupTop.position.y = -1.36;
  const topWin = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), mats.glass);
  topWin.rotation.x = Math.PI / 2;
  topWin.position.y = -1.39;
  cupola.add(cupBase, cupWin, cupTop, topWin);
  const fb = new StrutBatch();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    fb.add(new THREE.Vector3(Math.sin(a) * 1.42, -0.5, Math.cos(a) * 1.42), new THREE.Vector3(Math.sin(a) * 0.75, -1.35, Math.cos(a) * 0.75), 0.05);
  }
  cupola.add(fb.build(mats.metal, 6));
  cupola.position.set(-7.35, -2.2, -5.65);
  add(shadowed(cupola), 'cupola', 'Cupola', [-7.35, -4.4, -5.65]);
  const cupolaEye = new THREE.Vector3(-7.35, -2.85, -5.65);

  // PMA-2 + IDA-2 (forward), PMA-3 + IDA-3 (Harmony zenith), PMA-1
  const pma = (len = 2.4) => {
    const g = new THREE.Group();
    g.add(latheX(mats.mli, [[0.01, 0], [1.2, 0], [1.1, 0.5], [0.95, len - 0.3], [0.9, len]]));
    g.add(latheX(mats.metal, [[0.9, len], [0.85, len + 0.5], [0.01, len + 0.5]]));
    return g;
  };
  add(place(pma(), [12.0, 0, 0]), 'pma', 'PMA-2 / IDA-2', [13.5, 1.6, 0]);
  add(place(pointAlong(pma(), '+y'), [8.4, 2.2, 0]), 'pma');
  add(place(pointAlong(latheX(mats.mli, [[0.01, 0], [1.2, 0], [0.95, 2.0], [0.9, 2.4], [0.01, 2.4]]), '-x'), [-10.1, 0, 0]), 'pma');

  // BEAM (Tranquility aft) and Bishop (Tranquility port end — added Dec 2020)
  add(place(pointAlong(latheX(mats.beam, [[0.01, 0], [0.9, 0], [1.5, 0.4], [1.6, 1.2], [1.6, 3.0], [1.3, 3.7], [0.6, 4.0], [0.01, 4.0]]), '-x'), [-9.6, 0, -5.65]), 'beam', 'BEAM', [-11.6, 2.0, -5.65]);
  const bishop = add(place(pointAlong(latheX(mats.mli, [[0.01, 0], [0.9, 0], [0.9, 0.4], [1.2, 1.0], [1.4, 1.8], [1.3, 2.1], [0.01, 2.1]]), '-z'), [-7.35, 0, -9.0]), 'bishop');

  // ── Russian segment ───────────────────────────────────────────────────────
  add(place(pointAlong(latheX(mats.mliRu, [[0.01, 0], [0.7, 0], [1.3, 0.5], [1.35, 1.6], [1.0, 2.0], [2.05, 2.6], [2.05, 11.2], [1.5, 12.0], [1.0, 12.6], [0.01, 12.6]]), '-x'), [-12.5, 0, 0]), 'zarya', 'Zarya', [-19, 2.7, 0]);
  const zvezda = new THREE.Group();
  zvezda.add(latheX(mats.mliRu, [[0.01, 0], [1.0, 0], [1.27, 0.4], [1.27, 2.1], [1.0, 2.5], [1.45, 2.6], [1.45, 6.1], [2.07, 6.6], [2.07, 10.9], [1.45, 11.3], [1.0, 11.5], [1.0, 13.0], [0.01, 13.1]]));
  zvezda.add(solarWings(mats, { x: 9.0, span: 12.4, chord: 3.3, from: 2.4, sections: 6 }));
  for (let i = 0; i < 3; i++) zvezda.add(box(mats.gold, 0.6, 0.3, 0.3, [7 + i * 1.3, 2.1, 0])); // equipment / antennas
  add(place(pointAlong(zvezda, '-x'), [-25.1, 0, 0]), 'zvezda', 'Zvezda', [-31.6, 2.8, 0]);
  add(place(pointAlong(moduleMesh(mats, { L: MODULES.rassvet.L, r: MODULES.rassvet.r, axis: 'x', material: mats.mliRu }), '-y'), MODULES.rassvet.c), 'rassvet', 'Rassvet', [-11.8, -4.2, 0]);

  // Poisk with its side EVA hatch (+z)
  const poisk = moduleMesh(mats, { L: MODULES.poisk.L, r: MODULES.poisk.r, axis: 'y', material: mats.mliRu });
  poisk.position.set(...MODULES.poisk.c);
  const poiskHatch = new THREE.Group();
  poiskHatch.position.set(0.5, 3.6 - MODULES.poisk.c[1], MODULES.poisk.r + 0.04);
  const pDoor = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 32), mats.ring);
  pDoor.rotation.x = Math.PI / 2;
  pDoor.position.x = -0.5;
  poiskHatch.add(pDoor);
  poisk.add(poiskHatch);
  add(poisk, 'poisk', 'Poisk', [-26.35, 5.8, 1.6]);

  // Nauka + Prichal (2021 →) or Pirs (→ 2021)
  const nauka = new THREE.Group();
  nauka.add(latheX(mats.mliRu, [[0.01, 0], [1.2, 0], [1.3, 0.4], [1.3, 1.8], [2.125, 2.4], [2.125, 12.2], [1.6, 12.9], [0.9, 13.1], [0.01, 13.1]]));
  nauka.add(solarWings(mats, { x: 10.5, span: 4.6, chord: 2.0, from: 2.3, sections: 3 }));
  nauka.add(box(mats.radiator, 3.4, 0.12, 2.4, [6.5, 0, -2.4]));
  pointAlong(nauka, '-y');
  nauka.position.set(-26.35, -1.25, 0);
  add(nauka, 'nauka', 'Nauka', [-23.6, -9, 0]);
  const prichal = new THREE.Group();
  prichal.add(new THREE.Mesh(new THREE.SphereGeometry(1.65, 32, 20), mats.mliRu));
  for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.35, 24), mats.ring);
    ring.position.set(d[0] * 1.6, d[1] * 1.6, d[2] * 1.6);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d));
    prichal.add(ring);
  }
  prichal.position.set(-26.35, -16.0, 0);
  add(shadowed(prichal), 'prichal', 'Prichal', [-24.0, -16.0, 0]);
  const pirs = moduleMesh(mats, { L: MODULES.pirs.L, r: MODULES.pirs.r, axis: 'y', material: mats.mliRu });
  pirs.position.set(...MODULES.pirs.c);
  add(pirs, 'pirs', 'Pirs', [-24.4, -3.7, 0]);

  // ERA on Nauka
  const era = new RoboticArm(mats, { L1: 5.0, L2: 5.0, wrist: 0.9, boomR: 0.13, pole: [1, 0.3, 0], tipDir: [0, 0, 1], cid: 'era', baseLen: 0.7 });
  era.setBase(new THREE.Vector3(-24.2, -9.5, 0), [1, 0, 0]);
  era.solve(new THREE.Vector3(-23.4, -18.5, 0.0));
  nauka.userData.eraGroup = era.group;
  iss.add(era.group);

  // ── Z1 truss (Unity zenith) with the Ku-band antenna ─────────────────────
  add(buildZ1(mats), 'z1', 'Z1 truss', [-9.2, 5.6, 0]);
  const sgant = add(place(buildAntennaORU(mats), SGANT_MOUNT), 'sgant', 'Ku-band antenna', [-6.6, 9.9, 0]);

  // ── Truss ────────────────────────────────────────────────────────────────
  const fixedTruss = new StrutBatch();
  const sarjFrames = {};
  for (const side of [1, -1]) {
    const sarjGroup = new THREE.Group();
    sarjGroup.position.set(0, TRUSS.y, side * (TRUSS.sarj.z0 + TRUSS.sarj.z1) / 2);
    const inner = new THREE.Group();
    inner.position.copy(sarjGroup.position).negate();
    sarjGroup.add(inner);
    sarjFrames[side] = { group: sarjGroup, inner, batch: new StrutBatch() };
    iss.add(sarjGroup);
  }

  for (const seg of TRUSS.segments) {
    for (const side of seg.id === 'S0' ? [1] : [1, -1]) {
      const z0 = side * seg.z0, z1 = side * seg.z1;
      const outboard = Math.abs(seg.z0) >= TRUSS.sarj.z1 - 0.01;
      const batch = outboard ? sarjFrames[side].batch : fixedTruss;
      latticeAlongZ(batch, { cx: 0, cy: TRUSS.y, hx: seg.half, hy: seg.half, z0, z1, bay: 2.25, r: 0.075 });
    }
  }
  const trussMesh = fixedTruss.build(mats.truss, 6);
  add(trussMesh, 'truss', 'S0 truss', [0, TRUSS_TOP + 1.0, -3]);
  labels.push({ cid: 'truss', text: 'S1', pos: new THREE.Vector3(0, TRUSS_TOP + 0.8, 13.5), minor: true });
  labels.push({ cid: 'truss', text: 'P1', pos: new THREE.Vector3(0, TRUSS_TOP + 0.8, -13.5), minor: true });

  // S0 avionics boxes, MT rails, equipment on S1/P1/S3/P3
  for (let z = -5.5; z <= 5.5; z += 2.2) add(box(mats.boxGray, 2.6, 1.2, 1.4, [0, TRUSS.y - 0.4, z]), 'truss');
  for (const y of [TRUSS.y - 1.25, TRUSS.y + 1.25]) add(box(mats.metal, 0.12, 0.12, 56, [TRUSS.half + 0.12, y, 0]), 'truss');
  for (const side of [1, -1]) {
    for (let z = 8; z < 28; z += 3.1) add(box(z % 2 > 1 ? mats.white : mats.boxGray, 1.6, 1.0, 1.8, [-0.4, TRUSS.y - 0.6, side * z]), 'truss');
  }

  // SARJ rings
  for (const side of [1, -1]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(TRUSS.sarj.radius, TRUSS.sarj.radius, 0.6, 40), mats.metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, TRUSS.y, side * (TRUSS.sarj.z0 + TRUSS.sarj.z1) / 2);
    add(shadowed(ring), 'sarj', side > 0 ? 'S-SARJ' : 'P-SARJ', [0, TRUSS.y + 2.6, side * 29.3]);
  }

  // AMS-02 + ELCs on the zenith/nadir faces of S3 and P3
  const ams = new THREE.Group();
  const magnet = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 1.6, 32), mats.metal);
  magnet.position.y = 1.4;
  ams.add(magnet, box(mats.gold, 3.6, 0.8, 3.6, [0, 0.4, 0]), box(mats.white, 2.6, 0.7, 2.6, [0, 2.6, 0]));
  ams.add(box(mats.radiator, 3.8, 0.1, 1.6, [0, 2.95, 1.0]));
  add(place(shadowed(ams), [0, TRUSS_TOP, 23.0]), 'ams', 'AMS-02', [0, TRUSS_TOP + 4.0, 23]);
  const elc = (y, z, flip) => {
    const g = new THREE.Group();
    g.add(box(mats.metal, 4.3, 0.25, 2.8, [0, 0, 0]));
    [[-1.3, -0.6], [0.3, -0.7], [1.4, 0.5], [-0.6, 0.6]].forEach(([x, zz], i) => g.add(box(i % 2 ? mats.white : mats.boxGray, 1.0, 0.8 + i * 0.12, 1.0, [x, 0.55 + i * 0.06, zz])));
    if (flip) g.rotation.z = Math.PI;
    g.position.set(0, y, z);
    return shadowed(g);
  };
  add(elc(TRUSS_TOP + 0.15, 27.2, false), 'elc', 'ELC-2', [0, TRUSS_TOP + 2.2, 27.2]);
  add(elc(TRUSS_TOP + 0.15, -26.3, false), 'elc', 'ELC-3', [0, TRUSS_TOP + 2.2, -26.3]);
  add(elc(TRUSS.y - TRUSS.half - 0.15, 24.5, true), 'elc');
  add(elc(TRUSS.y - TRUSS.half - 0.15, -24.5, true), 'elc');

  // Main radiators on S1/P1 (three each) on the Thermal Radiator Rotary Joints
  const radiators = {};
  for (const side of [1, -1]) {
    const trrj = new THREE.Group();
    trrj.position.set(-TRUSS.half, TRUSS.y, 0);
    const radMat = withRepeat(mats.radiator, 1, 6);
    for (const zc of [10.0, 14.0, 18.0]) {
      const r = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const p = panel(radMat, radMat, 23.3 / 8 - 0.06, 3.4, 0.06);
        p.position.set(-(i + 0.5) * (23.3 / 8) - 0.2, 0, 0);
        r.add(p);
      }
      r.add(box(mats.metal, 23.4, 0.14, 0.14, [-11.9, 0, 0]));
      r.position.z = side * zc;
      trrj.add(r);
    }
    trrj.rotation.z = deg(18);
    add(shadowed(trrj), 'radiator', side > 0 ? 'S1 radiators' : null, [-12, 3.0, side * 14]);
    radiators[side] = trrj;
  }
  labels.push({ cid: 'radiator', text: 'P1 radiators', pos: new THREE.Vector3(-12, 3.0, -14), minor: true });

  // ── Power modules on the rotating (outboard) truss ───────────────────────
  const wings = {};
  const irosa = {};
  for (const side of [1, -1]) {
    const { group, inner, batch } = sarjFrames[side];
    inner.add(batch.build(mats.truss, 6));
    tag(inner, 'truss');
    for (const iea of [PV.iea4, PV.iea6]) {
      const zc = side * (iea.z0 + iea.z1) / 2;
      const len = iea.z1 - iea.z0;
      const g = new THREE.Group();
      g.add(box(mats.white, PV.ieaHalf * 2, PV.ieaHalf * 2, len, [0, 0, 0]));
      // Battery ORUs on the zenith face
      for (const bz of [-1.0, 0.9]) g.add(box(mats.batteryOld, 0.9, 0.42, 1.0, [0, PV.ieaHalf + 0.31, bz * side]));
      g.add(box(mats.boxGray, 1.2, 0.9, len * 0.8, [PV.ieaHalf + 0.3, -0.6, 0]));
      g.position.set(0, TRUSS.y, zc);
      g.userData.batteries = g.children.slice(1, 3);
      inner.add(tag(shadowed(g), 'iea'));
      const pvr = buildPVR(mats);
      pvr.position.set(0, TRUSS.y - PV.ieaHalf, zc);
      inner.add(pvr);
      if (iea === PV.iea4) inner.userData[`iea4`] = g;
    }
    for (const w of WINGS.filter((x) => x.side === side)) {
      const wing = buildSolarWing(mats, w.id);
      const zc = side * (w.module === 4 ? PV.zc4 : PV.zc6);
      wing.root.position.set(w.dir * PV.baseX, TRUSS.y, zc);
      if (w.dir < 0) wing.root.rotation.y = Math.PI;
      inner.add(wing.root);
      wings[w.id] = { ...wing, def: w };
      const ir = buildIROSA(mats);
      wing.beta.add(ir.root);
      ir.root.visible = false;
      irosa[w.id] = ir;
      labels.push({ cid: 'saw', text: `Wing ${w.id}`, pos: new THREE.Vector3(w.dir * 20, TRUSS.y + 1.2, zc), minor: true });
    }
    labels.push({ cid: 'iea', text: side > 0 ? 'S4 / S6' : 'P4 / P6', pos: new THREE.Vector3(0, TRUSS.y + 3.4, side * 42) });
  }

  // ── Mobile Servicing System: MBS, Canadarm2, Dextre ──────────────────────
  const mbs = new THREE.Group();
  mbs.add(box(mats.white, 2.2, 3.6, 4.5, [0, 0, 0]));
  mbs.add(box(mats.metal, 2.4, 0.4, 4.7, [0, 1.6, 0]));
  mbs.add(box(mats.darkMetal, 0.5, 0.5, 0.5, [0.2, 1.95, 0]));
  // Dextre parked on the MBS
  const dextre = new THREE.Group();
  dextre.add(box(mats.white, 0.9, 3.0, 0.9, [0, 0, 0]), box(mats.metal, 1.6, 0.6, 1.0, [0, 0.9, 0]));
  for (const s of [-1, 1]) {
    const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 10), mats.canadarm);
    placeBetween(a1, new THREE.Vector3(s * 0.8, 0.9, 0), new THREE.Vector3(s * 1.6, -0.6, 0.6));
    const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 10), mats.canadarm);
    placeBetween(a2, new THREE.Vector3(s * 1.6, -0.6, 0.6), new THREE.Vector3(s * 0.9, -1.8, 1.0));
    dextre.add(a1, a2);
  }
  dextre.position.set(0.3, -0.4, -3.1);
  mbs.add(tag(shadowed(dextre), 'dextre'));
  tag(shadowed(mbs), 'mbs');
  mbs.children.slice(0, 3).forEach((c) => tag(c, 'mbs'));
  mbs.position.set(MSS.mbsX, TRUSS.y, 0);
  iss.add(mbs);
  const canadarm = new RoboticArm(mats, { L1: MSS.boom, L2: MSS.boom, wrist: MSS.wrist, cid: 'canadarm2', baseLen: 1.0 });
  iss.add(canadarm.group);
  labels.push({ cid: 'canadarm2', text: 'Canadarm2', dynamic: () => canadarm.elbow.clone().add(new THREE.Vector3(0, 0.9, 0)) });
  labels.push({ cid: 'era', text: 'ERA', minor: true, dynamic: () => era.elbow.clone().add(new THREE.Vector3(0.6, 0, 0)) });

  function setMBS(z) {
    mbs.position.z = z;
    canadarm.setBase(new THREE.Vector3(MSS.mbsX + MSS.shoulderOffset[0], TRUSS.y + 1.8, z), [0, 1, 0]);
  }
  setMBS(0);
  canadarm.solve(new THREE.Vector3(5.5, 9.5, 7.5));

  // ── Visiting vehicles ────────────────────────────────────────────────────
  const dragon = add(place(buildCrewDragon(mats), [14.9, 0, 0]), 'dragon', 'Crew Dragon', [18, 2.6, 0]);
  const soyuz = add(place(pointAlong(buildSoyuz(mats), '-y'), [-13.6, -7.2, 0]), 'soyuz', 'Soyuz MS', [-11.8, -11.5, 0]);
  const progress = add(place(pointAlong(buildProgress(mats), '-x'), [-38.2, 0, 0]), 'progress', 'Progress MS', [-42, 2.0, 0]);
  // Cargo Dragon parked on Harmony zenith (IDA-3) and Cygnus berthed on Unity nadir — date dependent
  const cargoDragon = add(place(pointAlong(buildCargoDragon(mats).group, '+y'), [8.4, 5.1, 0]), 'dragonCargo', 'Cargo Dragon', [10.8, 10.5, 0]);
  const cygnus = add(place(pointAlong(buildCygnus(mats).group, '-y'), [-7.35, -2.28, 0]), 'cygnus', 'Cygnus XL', [-5.0, -6.5, 0]);

  // Names that the UI can toggle for date-accurate configurations
  const optional = { nauka, prichal, pirs, bishop, dragon, soyuz, progress, era: era.group };

  function setConfig(cfg) {
    nauka.visible = !!cfg.nauka;
    era.group.visible = !!cfg.nauka;
    prichal.visible = !!cfg.prichal;
    pirs.visible = !!cfg.pirs;
    bishop.visible = !!cfg.bishop;
    for (const id of Object.keys(irosa)) {
      const on = (cfg.irosa || []).includes(id);
      irosa[id].root.visible = on;
      irosa[id].setDeploy(on ? 1 : 0);
    }
    const veh = cfg.vehicles || [];
    dragon.visible = veh.includes('dragon');
    soyuz.visible = veh.includes('soyuz');
    progress.visible = veh.includes('progress');
    cargoDragon.visible = veh.includes('cargoDragon');
    cygnus.visible = veh.includes('cygnus');
    for (const l of labels) {
      if (['nauka', 'era'].includes(l.cid)) l.hidden = !cfg.nauka;
      if (l.cid === 'prichal') l.hidden = !cfg.prichal;
      if (l.cid === 'pirs') l.hidden = !cfg.pirs;
      if (l.cid === 'dragon') l.hidden = !dragon.visible;
      if (l.cid === 'soyuz') l.hidden = !soyuz.visible;
      if (l.cid === 'progress') l.hidden = !progress.visible;
      if (l.cid === 'dragonCargo') l.hidden = !cargoDragon.visible;
      if (l.cid === 'cygnus') l.hidden = !cygnus.visible;
    }
  }

  /** Point every wing and both SARJs. alpha: SARJ angle, beta: per-wing beta (same for all). */
  function setArrays(alpha, beta) {
    sarjFrames[1].group.rotation.z = alpha;
    sarjFrames[-1].group.rotation.z = alpha;
    for (const w of Object.values(wings)) w.beta.rotation.x = w.def.dir * beta;
  }

  function setRadiators(angle) {
    radiators[1].rotation.z = angle;
    radiators[-1].rotation.z = angle;
  }

  shadowed(iss);
  return {
    group: iss,
    labels,
    wings,
    irosa,
    canadarm,
    era,
    mbs,
    setMBS,
    setConfig,
    setArrays,
    setRadiators,
    optional,
    hatches: { quest: questHatch, poisk: poiskHatch },
    cupolaEye,
    dextre,
    sgant,
    iea4: { 1: sarjFrames[1].inner.userData.iea4, [-1]: sarjFrames[-1].inner.userData.iea4 },
  };
}
