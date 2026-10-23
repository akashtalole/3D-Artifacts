/**
 * The road and its construction, driven by one timeline T (seconds of playback).
 * Road along +x from Ch 0+000 to 0+180, centre line z = 0, finished surface y = 0.
 *   fill  −1.6 … −1.1   embankment (exists at the start)
 *   sub   −1.1 … −0.6   subgrade, 500 mm
 *   gsb   −0.6 … −0.45  granular sub-base, 150 mm
 *   dlc   −0.45 … −0.30 dry lean concrete, 150 mm
 *   pqc   −0.30 … 0.00  pavement quality concrete, 300 mm
 */
import * as THREE from 'three';
import { BUILDERS } from './earthmovers.js';
import { M, mesh, box, cyl } from './kit.js';
import { slipformPaver, placerSpreader, textureCuring, concreteSaw, vibRoller, tandemRoller, dlcPaver, tipper, tanker, batchingPlant, worker, car, P } from './rigs.js';
import { ROAD, STAGES } from './data.js';

const L = ROAD.L, HW = ROAD.width / 2, JS = ROAD.jointSpacing;
export const JOINTS = []; for (let x = JS; x < L - 0.01; x += JS) JOINTS.push(+x.toFixed(2));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// stage timing
let acc = 0; export const T0 = {}; for (const s of STAGES) { T0[s.id] = acc; acc += s.dur; } export const T_END = acc;
export function stageAt(T) { let s = STAGES[0]; for (const st of STAGES) if (T >= T0[st.id]) s = st; return s; }
const prog = (T, id) => clamp((T - T0[id]) / STAGES.find((s) => s.id === id).dur, 0, 1);

/** a cross-section (points [z, y]) extruded along +x over unit length, stretched with scale.x */
function strip(section, mat) {
  const s = new THREE.Shape(section.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = true; m.visible = false; return m;
}
function setStrip(m, x0, x1) { const len = x1 - x0; m.visible = len > 0.02; if (m.visible) { m.position.x = x0; m.scale.x = len; } }
function canvasTex(w, h, draw, rx = 1) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.repeat.set(rx, 1); return t; }

export function buildRoad() {
  const G = new THREE.Group(), labels = [], stats = {};
  const mat = (c, r = 0.95, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
  const MAT = {
    ground: new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#7f8a55'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { const v = Math.random(); g.fillStyle = v < 0.5 ? `rgba(70,90,40,${Math.random() * 0.4})` : `rgba(150,140,90,${Math.random() * 0.3})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }), roughness: 1 }),
    fill: mat('#8d7558'), subL: mat('#a58763'), sub: mat('#8f7253'), gsbL: mat('#a39a8c'), gsb: mat('#8b8478'),
    dlc: mat('#b9b6ad', 0.9), mem: new THREE.MeshStandardMaterial({ color: '#e8f0f4', roughness: 0.3, transparent: true, opacity: 0.55 }),
    fresh: new THREE.MeshPhysicalMaterial({ color: '#7c7b77', roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    shoulder: mat('#8c8172'), steel: new THREE.MeshStandardMaterial({ color: '#8d4a2a', roughness: 0.5, metalness: 0.6 }), dowel: new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: 0.3, metalness: 0.9 }),
    joint: mat('#2a2a2a', 0.9), seal: mat('#0e0e0e', 0.6), paint: mat('#f4f4f0', 0.6), yellow: mat('#f2c230', 0.6),
  };
  const tineTex = canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#d8d6cf'; g.fillRect(0, 0, w, h); let x = 0; while (x < w) { g.fillStyle = 'rgba(90,88,82,.55)'; g.fillRect(x, 0, 2, h); x += 4 + Math.random() * 5; } });
  MAT.cured = new THREE.MeshStandardMaterial({ map: tineTex, roughness: 0.85 });
  const hesTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#9c7b4c'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,40,20,.35)'; for (let i = 0; i < w; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } });
  MAT.hessian = new THREE.MeshStandardMaterial({ map: hesTex, roughness: 1 });
  MAT.hessianWet = MAT.hessian;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 400), MAT.ground); ground.rotation.x = -Math.PI / 2; ground.position.set(90, -1.6, 0); ground.receiveShadow = true; G.add(ground);
  const haul = new THREE.Mesh(new THREE.PlaneGeometry(300, 6), mat('#9c8a6c', 1)); haul.rotation.x = -Math.PI / 2; haul.position.set(110, -1.59, 14); haul.receiveShadow = true; G.add(haul);
  // layers
  const fill = strip([[-8, -1.6], [8, -1.6], [7, -1.1], [-7, -1.1]], MAT.fill); setStrip(fill, -0.01, L); G.add(fill);
  const lay = {
    subL: strip([[-7, -1.1], [7, -1.1], [6, -0.56], [-6, -0.56]], MAT.subL), sub: strip([[-7, -1.1], [7, -1.1], [6, -0.6], [-6, -0.6]], MAT.sub),
    gsbL: strip([[-6, -0.6], [6, -0.6], [5.25, -0.42], [-5.25, -0.42]], MAT.gsbL), gsb: strip([[-6, -0.6], [6, -0.6], [5.25, -0.45], [-5.25, -0.45]], MAT.gsb),
    dlc: strip([[-5.0, -0.45], [5.0, -0.45], [4.75, -0.30], [-4.75, -0.30]], MAT.dlc),
    mem: strip([[-3.95, -0.30], [3.95, -0.30], [3.95, -0.296], [-3.95, -0.296]], MAT.mem),
    fresh: strip([[-HW, -0.30], [HW, -0.30], [HW, 0], [-HW, 0]], MAT.fresh),
    shR: strip([[HW, 0], [HW, -0.62], [6.7, -0.62], [5.6, -0.03]], MAT.shoulder), shL: strip([[-HW, 0], [-5.6, -0.03], [-6.7, -0.62], [-HW, -0.62]], MAT.shoulder),
  };
  for (const m of Object.values(lay)) G.add(m);
  lay.mem.castShadow = false;
  // top surfaces drawn as planes so their textures tile with length
  const topPlane = (m, y) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1, ROAD.width), m); p.rotation.x = -Math.PI / 2; p.position.y = y; p.receiveShadow = true; p.visible = false; G.add(p); return p; };
  const curedTop = topPlane(MAT.cured, 0.003), hesTop = topPlane(MAT.hessian, 0.012);
  const setTop = (p, x0, x1, tex, per) => { const len = x1 - x0; p.visible = len > 0.05; if (p.visible) { p.scale.x = len; p.position.x = (x0 + x1) / 2; if (tex) tex.repeat.set(len / per, 1); } };
  // joints, sealant, dowels, tie bars
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const jT = new THREE.InstancedMesh(unit, MAT.joint, JOINTS.length); jT.count = 0; G.add(jT);
  const jS = new THREE.InstancedMesh(unit, MAT.seal, JOINTS.length); jS.count = 0; G.add(jS);
  const jL = new THREE.Mesh(unit, MAT.joint); jL.visible = false; G.add(jL);
  const jLs = new THREE.Mesh(unit, MAT.seal); jLs.visible = false; G.add(jLs);
  const nD = Math.round(ROAD.width / ROAD.dowelSpacing);
  const dG = new THREE.CylinderGeometry(0.019, 0.019, 0.5, 10); dG.rotateZ(Math.PI / 2);
  const dowels = new THREE.InstancedMesh(dG, MAT.dowel, JOINTS.length * nD); dowels.count = 0; G.add(dowels);
  { const m = new THREE.Matrix4(); let k = 0; for (const x of JOINTS) for (let i = 0; i < nD; i++) { m.makeTranslation(x, -0.15, -HW + ROAD.dowelSpacing / 2 + i * ROAD.dowelSpacing); dowels.setMatrixAt(k++, m); } }
  const nT = Math.floor(L / ROAD.tieSpacing);
  const tG = new THREE.CylinderGeometry(0.008, 0.008, 0.64, 8); tG.rotateX(Math.PI / 2);
  const ties = new THREE.InstancedMesh(tG, MAT.steel, nT); ties.count = 0; G.add(ties);
  { const m = new THREE.Matrix4(); for (let i = 0; i < nT; i++) { m.makeTranslation(0.3 + i * ROAD.tieSpacing, -0.15, 0); ties.setMatrixAt(i, m); } }
  const steelVisible = (v) => { dowels.visible = ties.visible = v; };
  // stringlines
  const stakes = new THREE.Group(); G.add(stakes); const nStake = Math.floor(L / 5) + 3;
  const stakeG = new THREE.CylinderGeometry(0.014, 0.014, 1.3, 6);
  const stakeMs = []; for (let i = 0; i < nStake; i++) for (const z of [5.3, -5.3]) { const s = new THREE.Mesh(stakeG, M.dark); s.position.set(-5 + i * 5, 0.2, z); s.visible = false; stakes.add(s); stakeMs.push(s); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.35), M.dark); arm.position.set(0, 0.42, -Math.sign(z) * 0.15); s.add(arm); }
  const strMat = new THREE.LineBasicMaterial({ color: '#ffef5a' });
  const strLines = [5.15, -5.15].map((z) => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5, 0.62, z), new THREE.Vector3(-5, 0.62, z)]); const l = new THREE.Line(g, strMat); l.visible = false; G.add(l); return l; });
  const setString = (x1) => { for (const l of strLines) { const p = l.geometry.attributes.position; p.setX(1, x1); p.needsUpdate = true; l.geometry.computeBoundingSphere(); l.visible = x1 > -4.9; } };
  // markings
  const edgeL = [HW - 0.25, -HW + 0.25].map((z) => { const m = new THREE.Mesh(unit, MAT.paint); m.scale.set(1, 0.006, 0.15); m.position.set(0, 0.006, z); m.visible = false; G.add(m); return m; });
  const nDash = Math.floor(L / 4.5);
  const dash = new THREE.InstancedMesh(unit, MAT.paint, nDash); dash.count = 0; G.add(dash);
  { const m = new THREE.Matrix4(); for (let i = 0; i < nDash; i++) { m.compose(new THREE.Vector3(i * 4.5 + 1.5, 0.006, 0), new THREE.Quaternion(), new THREE.Vector3(3, 0.006, 0.15)); dash.setMatrixAt(i, m); } }
  // aggregate piles for the GSB
  const piles = []; for (let x = 6; x < L; x += 9) { const p = mesh(new THREE.ConeGeometry(1.4, 0.9, 14), MAT.gsbL); p.position.set(x, -0.15, (piles.length % 2 ? 1 : -1) * 1.6); p.visible = false; G.add(p); piles.push(p); }
  // concrete heap in front of the spreader
  const heap = mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), P.concrete); heap.scale.set(1.6, 0.6, 2.4); heap.visible = false; G.add(heap);
  // membrane roll
  const roll = cyl(0.18, 4.0, MAT.mem, 'z', 14); roll.visible = false; G.add(roll);

  // ── machines ──
  const act = {};
  const addRig = (id, name, rig, y = 0) => { G.add(rig.root); rig.root.position.y = y; rig.root.visible = false; act[id] = { id, name, rig, y, x: 0 }; labels.push(act[id]); return act[id]; };
  const em = (b) => { const m = b(); return { root: m.root, m, update(dt, ds) { m.roll(ds); m.update(dt); } }; };
  addRig('grader', 'Motor grader', em(BUILDERS.grader));
  addRig('roller', 'Vibratory roller', vibRoller());
  addRig('tipA', 'Tipper', tipper({ concrete: false }));
  addRig('dlcp', 'DLC paver', dlcPaver());
  addRig('tandem', 'Tandem roller', tandemRoller());
  addRig('spreader', 'Placer-spreader', placerSpreader());
  addRig('paver', 'Slip-form paver (DBI + TBI)', slipformPaver());
  addRig('tcm', 'Texture-curing machine', textureCuring());
  addRig('dump1', 'Dumper', tipper());
  addRig('dump2', 'Dumper', tipper());
  addRig('saw1', 'Concrete saw: transverse joints', concreteSaw());
  addRig('saw2', 'Concrete saw: longitudinal joint', concreteSaw());
  addRig('tanker', 'Water tanker', tanker());
  addRig('shp', 'Shoulder paver', dlcPaver());
  const crew = []; for (let i = 0; i < 4; i++) { const w = worker(i % 2 ? P.vest : P.vestG, i === 3 ? 'bend' : 'stand'); w.visible = false; G.add(w); crew.push(w); }
  const crewLabel = { id: 'crew', name: 'Crew', rig: { root: crew[0] } }; labels.push(crewLabel);
  const plant = batchingPlant(); plant.position.set(L + 45, -1.6, 30); plant.rotation.y = -Math.PI / 2; G.add(plant);
  labels.push({ id: 'plant', name: 'Batching plant', rig: { root: plant }, fixed: true });
  const straight = box(3, 0.05, 0.1, M.steel); straight.visible = false; G.add(straight);
  const corer = new THREE.Group(); { const b = box(0.6, 0.4, 0.6, P.orange); b.position.y = 0.2; corer.add(b); const c = cyl(0.025, 1.4, M.dark, 'y', 6); c.position.set(0.15, 1.0, 0); corer.add(c); const d = cyl(0.08, 0.3, M.steel, 'y', 12); d.position.set(0.15, 0.3, 0); corer.add(d); } corer.visible = false; G.add(corer);
  const cars = ['#c62828', '#1565c0', '#eceff1', '#2e7d32'].map((c) => { const r = car(c); r.root.visible = false; G.add(r.root); return r; });

  const show = (...ids) => { for (const a of Object.values(act)) a.rig.root.visible = ids.includes(a.id); };
  const place = (id, x, y, z = 0, h = 0, dt = 0, extra) => {
    const a = act[id], r = a.rig.root, px = r.position.x, pz = r.position.z;
    r.position.set(x, y, z); r.rotation.y = h; const d = Math.hypot(x - px, z - pz), fwd = Math.cos(h) * (x - px) - Math.sin(h) * (z - pz);
    a.rig.update?.(dt, d < 3 ? Math.sign(fwd) * d : 0, extra);
  };

  // ── timeline ──
  function update(T, dt) {
    const pS = prog(T, 'sub'), pG = prog(T, 'gsb'), pD = prog(T, 'dlc'), pM = prog(T, 'mem'), pR = prog(T, 'str'), pP = prog(T, 'pav'), pW = prog(T, 'saw'), pC = prog(T, 'cur'), pJ = prog(T, 'seal'), pO = prog(T, 'open');
    const st = stageAt(T).id;
    // subgrade
    const xg1 = lerp(-12, L + 26, pS), xr1 = xg1 - 24;
    setStrip(lay.sub, 0, clamp(xr1 + 1, 0, L)); setStrip(lay.subL, clamp(xr1 + 1, 0, L), clamp(xg1 + 1, 0, L));
    if (pS >= 1) setStrip(lay.subL, 0, 0);
    // GSB
    const xg2 = lerp(-12, L + 26, pG), xr2 = xg2 - 24;
    setStrip(lay.gsb, 0, clamp(xr2 + 1, 0, L)); setStrip(lay.gsbL, clamp(xr2 + 1, 0, L), clamp(xg2 + 1, 0, L)); if (pG >= 1) setStrip(lay.gsbL, 0, 0);
    for (const p of piles) p.visible = st === 'gsb' && p.position.x > xg2 + 1.5 && p.position.x < xg2 + 60;
    // DLC
    const xd = lerp(-2, L + 4, pD); setStrip(lay.dlc, 0, clamp(xd - 2.4, 0, L));
    // membrane and stringlines
    const xm = lerp(0, L, pM); setStrip(lay.mem, 0, xm);
    const nS = Math.floor(pR * (nStake + 1)); stakeMs.forEach((s, i) => { s.visible = T >= T0.str && Math.floor(i / 2) < nS && (T < T0.saw); });
    setString(T >= T0.str && T < T0.saw ? Math.min(-5 + (nS - 1) * 5, L + 10) : -5);
    // paving
    const xf = lerp(0, L + 30, pP), xpav = Math.min(xf, L + 3), xt = xf - 22;
    setStrip(lay.fresh, 0, clamp(xpav - 1.7, 0, L));
    const xCured = clamp(xt - 0.55, 0, L); setTop(curedTop, 0, xCured, MAT.cured.map, 0.6);
    const nJd = JOINTS.filter((x) => x < xpav - 2.4).length; dowels.count = nJd * nD; ties.count = Math.floor(clamp(xpav - 0.9, 0, L) / ROAD.tieSpacing);
    // saw cutting
    const sawPos = pW * JOINTS.length, nSawn = Math.floor(sawPos), frac = sawPos - nSawn;
    const m4 = new THREE.Matrix4(); jT.count = Math.min(JOINTS.length, nSawn + (frac > 0 && nSawn < JOINTS.length ? 1 : 0));
    for (let i = 0; i < jT.count; i++) { const len = i < nSawn ? ROAD.width : ROAD.width * frac; m4.compose(new THREE.Vector3(JOINTS[i], 0.002, -HW + len / 2), new THREE.Quaternion(), new THREE.Vector3(0.012, 0.006, len)); jT.setMatrixAt(i, m4); }
    jT.instanceMatrix.needsUpdate = true;
    const xl = pW * L; jL.visible = xl > 0.05; jL.scale.set(xl, 0.006, 0.012); jL.position.set(xl / 2, 0.002, 0);
    // wet curing, sealing
    setTop(hesTop, 0, pC < 1 ? pC * L : 0, MAT.hessian.map, 2);
    const sealPos = pJ * JOINTS.length, nSeal = Math.floor(sealPos); jS.count = nSeal;
    for (let i = 0; i < nSeal; i++) { m4.compose(new THREE.Vector3(JOINTS[i], 0.003, 0), new THREE.Quaternion(), new THREE.Vector3(0.022, 0.006, ROAD.width)); jS.setMatrixAt(i, m4); } jS.instanceMatrix.needsUpdate = true;
    jLs.visible = pJ > 0; jLs.scale.set(pJ * L, 0.006, 0.022); jLs.position.set(pJ * L / 2, 0.003, 0);
    // shoulders and markings
    const xsh = lerp(0, L, clamp(pO / 0.35, 0, 1)); setStrip(lay.shR, 0, xsh); setStrip(lay.shL, 0, xsh);
    const pMk = clamp((pO - 0.35) / 0.2, 0, 1); for (const e of edgeL) { e.visible = pMk > 0; e.scale.x = pMk * L; e.position.x = pMk * L / 2; } dash.count = Math.floor(pMk * nDash);

    // ── machines for the current stage ──
    for (const w of crew) w.visible = false; heap.visible = false; roll.visible = false; straight.visible = false; corer.visible = false; for (const c of cars) c.root.visible = false;
    if (st === 'sub' || st === 'gsb') {
      const xg = st === 'sub' ? xg1 : xg2, xr = st === 'sub' ? xr1 : xr2, y = st === 'sub' ? -0.6 : -0.45;
      show('grader', 'roller', ...(st === 'gsb' ? ['tipA'] : []));
      place('grader', xg, y, 0, 0, dt); act.grader.rig.m.pose({ lift: -0.05, circle: 32 });
      const osc = Math.sin(T * 0.9) * 3; place('roller', xr + osc, y, Math.sin(T * 0.3) * 1.2, 0, dt);
      if (st === 'gsb') { const k = (T * 0.25) % 1, tx = Math.min(xg + 40, L - 4); place('tipA', tx + 8 - 6 * ease(Math.min(1, k * 2)), y, 1.6, 0, dt); act.tipA.rig.set(k > 0.5 ? Math.sin((k - 0.5) * 2 * Math.PI) : 0, k > 0.75 ? 0.2 : 1); }
    } else if (st === 'dlc') {
      show('dlcp', 'tandem', 'tipA'); place('dlcp', xd, -0.45, 0, 0, dt);
      place('tandem', clamp(xd - 9 + Math.sin(T * 0.8) * 4, 0, L), -0.30, Math.sin(T * 0.25) * 2, 0, dt);
      const k = (T * 0.2) % 1; place('tipA', xd + 4.8 + (1 - ease(Math.min(1, k * 3))) * 6, -0.45, 0, 0, dt); act.tipA.rig.set(k > 0.33 && k < 0.85 ? 0.55 : 0, 1 - clamp((k - 0.33) / 0.5, 0, 1));
    } else if (st === 'mem') {
      show(); roll.visible = true; roll.position.set(xm, -0.12, 0);
      [[xm + 0.4, -2], [xm + 0.4, 2], [xm - 3, 3.4], [xm - 6, -3.4]].forEach(([x, z], i) => { crew[i].visible = true; crew[i].position.set(x, -0.30, z); crew[i].rotation.y = i < 2 ? Math.PI : 0; });
    } else if (st === 'str') {
      show(); const xs = -5 + (nS - 1) * 5; crew[3].visible = true; crew[3].position.set(xs - 0.6, -0.45, 5.3); crew[0].visible = true; crew[0].position.set(xs - 8, -0.45, -5.6);
    } else if (st === 'pav') {
      show('paver', 'spreader', 'tcm', 'dump1', 'dump2');
      const inserting = JOINTS.some((x) => Math.abs(xpav - 2.4 - x) < 0.35);
      place('paver', xpav, -0.30, 0, 0, dt, inserting ? 1 : 0);
      place('spreader', Math.min(xf + 6.5, L + 9.5), -0.30, 0, 0, dt);
      place('tcm', clamp(xt, -3, L + 2), -0.30, 0, 0, dt, xt > 0 && xt < L + 1);
      // dumpers reverse in on the DLC, tip in front of the spreader and drive out
      const front = Math.min(xf + 11.5, L + 14.5);
      for (const [id, off] of [['dump1', 0], ['dump2', 0.5]]) {
        const k = ((T - T0.pav) / 16 + off) % 1, far = Math.max(front + 45, L + 40);
        let x, tip = 0, load = 1;
        if (k < 0.38) x = lerp(far, front, ease(k / 0.38)); else if (k < 0.62) { x = front; tip = Math.sin(((k - 0.38) / 0.24) * Math.PI); load = 1 - clamp((k - 0.42) / 0.16, 0, 1); } else { x = lerp(front, far, ease((k - 0.62) / 0.38)); load = 0; }
        place(id, x, x > L ? -0.45 : -0.30, off ? 1.2 : -1.2, 0, dt); act[id].rig.set(tip, load);
        if (tip > 0.3) { heap.visible = true; heap.position.set(front - 3.6, -0.30, off ? 1.2 : -1.2); heap.scale.set(1.5, 0.3 + tip * 0.4, 2.0); }
      }
      if (!heap.visible && xf < L) { heap.visible = true; heap.position.set(Math.min(xf + 9.5, L), -0.30, 0); heap.scale.set(1.2, 0.35, 2.6); }
      crew[0].visible = true; crew[0].position.set(xpav - 5, -0.30, 4.3); crew[1].visible = true; crew[1].position.set(xpav - 5.5, -0.30, -4.3); crew[1].rotation.y = Math.PI;
    } else if (st === 'saw') {
      show('saw1', 'saw2'); steelVisible(state.xray);
      if (nSawn < JOINTS.length) { const x = JOINTS[nSawn]; place('saw1', x - 0.35, 0, -HW - 0.4 + frac * (ROAD.width + 0.2), -Math.PI / 2, dt); }
      place('saw2', clamp(xl, 0, L), 0, -0.33, 0, dt);
    } else if (st === 'cur') {
      show('tanker'); const xc = pC * L; place('tanker', clamp(xc - 2, -4, L), -1.6, 10.2, 0, dt); act.tanker.rig.spray.visible = true; act.tanker.rig.spray.rotation.set(Math.PI / 2, 0, 0); act.tanker.rig.spray.position.set(0, 1.0, -4.0); act.tanker.rig.spray.scale.set(1.0, 6.0, 0.5);
      [[xc + 0.3, -2.2], [xc + 0.3, 2.2], [xc - 6, 4.2]].forEach(([x, z], i) => { crew[i].visible = true; crew[i].position.set(x, 0, z); crew[i].rotation.y = Math.PI; });
    } else if (st === 'seal') {
      show(); if (nSeal < JOINTS.length) { const x = JOINTS[Math.min(nSeal, JOINTS.length - 1)]; const z = -HW + (sealPos - nSeal) * ROAD.width; crew[3].visible = true; crew[3].position.set(x - 0.6, 0, z); crew[0].visible = true; crew[0].position.set(x + 4.5, 0, -2); crew[0].rotation.y = -Math.PI / 2; }
    } else if (st === 'open') {
      show(...(pO < 0.36 ? ['shp'] : [])); if (pO < 0.36) { place('shp', xsh + 2, -0.62, 5.6, 0, dt); }
      if (pO > 0.55 && pO < 0.8) { straight.visible = true; straight.position.set(60, 0.03, 1.6); crew[0].visible = true; crew[0].position.set(61.8, 0, 2.2); crew[3].visible = true; crew[3].position.set(58.6, 0, 2.2); corer.visible = true; corer.position.set(100, 0, -1.8); crew[1].visible = true; crew[1].position.set(100.8, 0, -2.6); }
      if (pO > 0.78) cars.forEach((c, i) => { c.root.visible = true; const dir = i % 2 ? -1 : 1, u = ((T - T0.open) * 0.09 + i * 0.27) % 1, x = dir > 0 ? lerp(8, L - 8, u) : lerp(L - 8, 8, u); const px = c.root.position.x; c.root.position.set(x, 0, dir * 1.9); c.root.rotation.y = dir > 0 ? 0 : Math.PI; c.update(dt, Math.abs(x - px) < 3 ? Math.abs(x - px) : 0); });
    } else show();
    steelVisible(state.xray || st === 'pav' && state.xray);
    MAT.fresh.transparent = MAT.cured.transparent = state.xray; MAT.fresh.opacity = MAT.cured.opacity = state.xray ? 0.35 : 1; MAT.fresh.depthWrite = MAT.cured.depthWrite = !state.xray;
    hesTop.material.transparent = state.xray; hesTop.material.opacity = state.xray ? 0.3 : 1;

    // stats
    const paved = clamp(xpav - 1.7, 0, L);
    Object.assign(stats, { qcAt: pO < 0.36 ? xsh : pO < 0.55 ? clamp(pMk * L, 20, L - 20) : pO < 0.8 ? 72 : 60, st, xf, xpav, paved, conc: paved * ROAD.width * ROAD.pqc, dowels: dowels.count, ties: ties.count, sawn: Math.min(nSawn, JOINTS.length), sealed: Math.min(nSeal, JOINTS.length), front: frontOf(st, { xg1, xg2, xd, xm, nS, xpav, xl, pC, nSeal, xsh, pO }) });
  }
  function frontOf(st, v) {
    return { sub: v.xg1, gsb: v.xg2, dlc: v.xd, mem: v.xm, str: -5 + (v.nS - 1) * 5, pav: v.xpav, saw: v.xl, cur: v.pC * L, seal: JOINTS[Math.min(v.nSeal, JOINTS.length - 1)], open: v.pO < 0.36 ? v.xsh : 70 }[st];
  }
  const state = { xray: false };
  return { group: G, update, labels, stats, state, act };
}
