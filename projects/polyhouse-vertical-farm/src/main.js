/**
 * Harit Ghar: a polyhouse and a vertical farm run by IoT sensors and AI.
 * Both facilities simulate continuously on one clock; the view shows one at a time.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PH, VF, SEASONS, PH_CROPS, VF_CROPS, FAULTS, TARIFF, WATER_COST, fmtL, inr } from './data.js';
import {
  clamp, weather, rhOf, vpdOf, phInit, phStep, phRates, phSense, fuse, phRules, phAI, phWatch, phWater, phCostTotal, P_VALUE,
  vfInit, vfStep, vfRates, vfHarvest, vfRules, vfAI, vfWatch, vfBestWindow, vfWindowCost, vfDLI, runDay,
} from './sim.js';
import { buildPolyhouse, buildCrop, buildRover, roverRoute, animatePH, MAT, W2, L2, BEDX } from './polyhouse.js';
import { buildVFarm, agvRoute, animateVF, RACKX, TIERY, Z0 } from './vfarm.js';
import { buildNet, labeller } from './iot.js';
import { lineChart, SERIES } from './charts.js';

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const q = new URLSearchParams(location.hash.slice(1));
const hhmm = (t) => { const h = ((t % 24) + 24) % 24; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60 + 1e-6)).padStart(2, '0')}`; };
const dayOf = (t) => Math.floor(t / 24) + 1;
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

// ── state ──
const state = {
  fac: q.get('fac') === 'vf' ? 'vf' : 'ph', season: SEASONS[q.get('season')] ? q.get('season') : 'summer',
  phCrop: PH_CROPS[q.get('crop')] ? q.get('crop') : 'capsicum', vfCrop: VF_CROPS[q.get('crop')] ? q.get('crop') : 'lettuce',
  mode: ['manual', 'rules', 'ai'].includes(q.get('mode')) ? q.get('mode') : 'ai', speed: [60, 600, 3600].includes(+q.get('speed')) ? +q.get('speed') : 600,
  playing: true, t: 0, cam: q.get('cam') || 'over', layers: { iot: q.get('iot') !== '0', cover: true }, tab: 'dash',
  manual: { ph: { vent: 0.5, shade: 0, fans: 0, pad: false, fog: 0, irrigate: 0 }, vf: { light: 1, dim: 1, set: 22, co2: 1000, dehum: false } },
};
const crop = () => PH_CROPS[state.phCrop], vcrop = () => VF_CROPS[state.vfCrop];
const START = q.get('t') !== null ? +q.get('t') : 11;

// ── renderer and scene ──
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#bcd6ec'); scene.fog = new THREE.Fog('#bcd6ec', 110, 320);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495;
const sun = new THREE.DirectionalLight('#fff3df', 1.8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
const sc = sun.shadow.camera; sc.left = sc.bottom = -36; sc.right = sc.top = 36; sc.near = 1; sc.far = 260;
const hemi = new THREE.HemisphereLight('#eef4ff', '#6f6a48', 0.6);
scene.add(sun, sun.target, hemi);
const vfLights = [-2.4, 0, 2.4].map((x) => { const l = new THREE.PointLight('#ff9ae6', 0, 14, 1.6); l.position.set(x, 2.2, -1); scene.add(l); return l; });
const roomLight = new THREE.DirectionalLight('#ffffff', 0); roomLight.position.set(6, 12, 8); scene.add(roomLight);

// ── facilities ──
const ph = buildPolyhouse(); scene.add(ph.group);
let phCropObj = null, neigh = [];
function mountCrop() {
  if (phCropObj) ph.group.remove(phCropObj.group);
  phCropObj = buildCrop(state.phCrop, crop()); ph.group.add(phCropObj.group);
  const P = phCropObj.plants, n = P.length / (PH.beds * 2);
  neigh = P.map((_, i) => { const bed = Math.floor(i / (2 * n)), row = Math.floor((i % (2 * n)) / n), k = i % n, o = bed * 2 * n, out = [];
    for (const d of [-1, 1]) if (k + d >= 0 && k + d < n) out.push(o + row * n + k + d);
    for (const kk of row ? [k, k + 1] : [k - 1, k]) if (kk >= 0 && kk < n) out.push(o + (1 - row) * n + kk);   // row 1 sits half a spacing further along
    return out; });
}
mountCrop();
const rover = buildRover(); ph.group.add(rover.g); const route = roverRoute(); let roverD = 0;
let vfObj = buildVFarm(state.vfCrop, vcrop()); vfObj.group.position.set(0, 0, 0); scene.add(vfObj.group);
const agv = agvRoute(); let agvD = 0;

// ── IoT networks ──
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpV = new THREE.Vector3();
const phNet = buildNet([
  ...[-15, -5, 5, 15].map((z, i) => ({ id: `TH-${i + 1}`, kind: 'climate', pos: V3(0, 2.0, z), rssi: -78 - i * 4 })),
  ...BEDX.map((x, i) => ({ id: `SM-${i + 1}`, kind: 'soil', pos: V3(x + 0.12, 0.52, -6 + (i % 3) * 6) })),
  { id: 'FERT', kind: 'box', pos: V3(-W2 - 3.5, 1.9, -L2 + 6.2), rssi: -96 }, { id: 'PAD', kind: 'box', pos: V3(-13.5, 1.05, -L2 - 1.2), rssi: -101 },
  { id: 'WS', kind: 'box', pos: V3(W2 + 7, 2.2, -L2 - 3.8), rssi: -104 },
  { id: 'CAM', kind: 'cam', at: (o) => o.copy(rover.g.position).add(V3(0, 1.9, 0)), rssi: -88 },
], { pos: V3(W2 + 5, 0, L2 + 5), pole: 7 });
ph.group.add(phNet.group);
const vfNet = buildNet([
  ...RACKX.map((x, i) => ({ id: `RK-${i + 1}`, kind: 'climate', pos: V3(x + 0.7, 1.6, -1), rssi: -55 - i * 3 })),
  { id: 'NUT', kind: 'box', pos: V3(-6.8, 1.6, -4.1), rssi: -62 },
  ...RACKX.map((x, i) => ({ id: `FLOW-${i + 1}`, kind: 'box', pos: V3(x + 0.5, 0.4, Z0 + VF.len + 0.3), rssi: -60 })),
  { id: 'HVAC', kind: 'box', pos: V3(1.6, 2.9, -9.0), rssi: -58 },
  { id: 'CAM', kind: 'cam', at: (o) => o.copy(vfObj.U.agv.position).add(V3(0, 3.1, 0)), rssi: -57 },
], { pos: V3(-6.85, 3.2, 2), pole: 0 });
vfObj.group.add(vfNet.group);
const labels = labeller($('#labels'), camera);

// ── simulation state ──
let PHS, VFS, phA, vfA, phMem, phW, vfMem, vfW, phF, vfF, phMeas, phFused, lastPlan, phR, vfR, hist, vhist, alerts, feed, detections, vlog, disease, edgeLogged;
const phDefaultA = () => ({ vent: 0.2, shade: 0, fans: 0, pad: false, fog: 0, co2: false, drip: Array(PH.beds).fill(false) });
function resetSim() {
  PHS = phInit(crop()); VFS = vfInit(vcrop()); phA = phDefaultA(); vfA = vfRules({ RH: 65, C: 900 }, weather(state.season, 0), vcrop(), 0);
  phMem = {}; phW = { season: state.season }; vfMem = { start: vfBestWindow(state.season, vcrop()).st }; vfW = {}; phF = {}; vfF = {};
  hist = []; vhist = []; alerts = { ph: [], vf: [] }; feed = { ph: [], vf: [] }; detections = []; vlog = []; disease = { onset: null, found: null, treated: 0 }; edgeLogged = false; lastPlan = null;
  phCropObj.plants.forEach((p) => Object.assign(p, { inf: 0, treated: false, det: false }));
  phR = phRates(PHS, phA, weather(state.season, 0), crop()); vfR = vfRates(VFS, vfA, weather(state.season, 0), vcrop());
  const t0 = START - 24; state.t = t0;
  warm = true; for (let k = 0; k < 24 * 60; k++) tick(); warm = false;
  PHS.acc = { ...PHS.acc, ...zeroAcc(PHS.acc) }; VFS.acc = { ...VFS.acc, ...zeroAcc(VFS.acc) }; dayStart = state.t;
  alerts.ph.length = 0; alerts.vf.length = 0; vlog.length = 0;
}
const zeroAcc = (A) => Object.fromEntries(Object.keys(A).map((k) => [k, 0]));
let warm = false, dayStart = 0, roll = [];

// one simulated minute for both facilities
function tick() {
  state.t += 1 / 60;
  const t = state.t, k = Math.round(t * 60), C = crop(), VC = vcrop();
  // ── polyhouse ──
  const w = weather(state.season, t);
  phMeas = phSense(PHS, phA, t, phF); phFused = fuse(phMeas, phMem.exclude || {});
  if (k % 10 === 0) decidePH(w, t);
  else if (state.mode === 'ai' && !phF.gateway) { for (let i = 0; i < PH.beds; i++) { if (phMem.drip?.[i] > 0) phMem.drip[i] -= 60; phA.drip[i] = phMem.drip?.[i] > 0; } }
  else if (state.mode === 'manual') { state.manual.ph.irrigate = Math.max(0, state.manual.ph.irrigate - 1); phA.drip = Array(PH.beds).fill(state.manual.ph.irrigate > 0); }
  else phA.drip = phRules({ ...phMeas, ...phFused }, w, C, phA, t).drip;
  phF.ecHold = state.mode === 'ai' && !!phMem.watch?.seen?.ec;
  phR = phStep(PHS, phA, w, C, 60, phF, t);
  roll.push([phR.P, phR.Ppot]); if (roll.length > 1440) roll.shift();
  if (k % 5 === 0) {
    const rh = rhOf(PHS.T, PHS.x), th = phMeas.theta;
    hist.push({ t, Tin: phFused.T, Tout: w.T, RH: phFused.RH, VPD: vpdOf(phFused.T, phFused.RH), CO2: phMeas.C, PAR: phR.Rin * 2.05, thMin: Math.min(...th), thAvg: th.reduce((a, b) => a + b) / th.length, thMax: Math.max(...th), ec: phMeas.ec, rhTrue: rh });
    if (hist.length > 289) hist.shift();
    phMem.watch = phMem.watch || { season: state.season }; phMem.watch.season = state.season;
    for (const e of phWatch(phMem.watch, phMeas, PHS, phA, t, C, phF, state.mode === 'ai')) pushAlert('ph', e);
    phMem.exclude = phMem.watch.exclude;
  }
  if (!warm) sendAll(state.fac, k);
  if (!warm && k % 1440 === 0) { PHS.acc = { ...PHS.acc, ...zeroAcc(PHS.acc) }; VFS.acc = { ...VFS.acc, ...zeroAcc(VFS.acc) }; dayStart = t; }
  if (k % 10 === 0) stepDisease(t, 10 / 60);
  // ── vertical farm ──
  const wv = w, m = { RH: rhOf(VFS.T, VFS.x), C: VFS.C };
  if (Math.abs(((t % 24) + 24) % 24) < 1 / 120 && state.mode === 'ai') vfMem.start = vfBestWindow(state.season, VC, dayOf(t) - 1).st;
  if (state.mode === 'ai') vfA = vfAI(m, wv, VC, t, vfMem);
  else if (state.mode === 'rules') vfA = vfRules(m, wv, VC, t);
  else { const M = state.manual.vf; vfA = { light: M.light, dim: M.dim, set: M.set, co2: M.light ? M.co2 : 0, dehum: M.dehum, rackFans: true, start: null }; }
  vfR = vfStep(VFS, vfA, wv, VC, 60, vfF, t);
  if (k % 5 === 0) {
    vhist.push({ t, T: VFS.T, RH: vfR.rh, CO2: VFS.C, kw: vfR.kw, led: vfR.Qled, hvac: vfR.hvacKW, ec: VFS.ecRead, ppfd: vfR.ppfd }); if (vhist.length > 289) vhist.shift();
    for (const e of vfWatch(vfW, VFS, vfR, vfA, t, VC, vfF, state.mode === 'ai')) pushAlert('vf', e);
    if (state.mode === 'ai' && vfW.seen?.hvac) vfMem.dim = 0.4; else if (state.mode === 'ai') vfMem.dim = undefined;
  }
  if (k % 10 === 0) {
    for (const h of vfHarvest(VFS, VC)) {
      if (!warm) { const r = Math.floor(h.i / VF.tiers), tier = h.i % VF.tiers, L = vfObj.U.lifts[r]; if (L && !L.job) L.job = { t: 0, y: TIERY(tier) + 0.05 }; }
      vlog.unshift({ t, rack: Math.floor(h.i / VF.tiers) + 1, tier: (h.i % VF.tiers) + 1, kg: h.kg, tip: h.tip }); if (vlog.length > 30) vlog.pop();
    }
  }
}

function decidePH(w, t) {
  const C = crop();
  if (state.mode === 'ai' && !phF.gateway) {
    edgeLogged = false;
    const known = { pad: !!phMem.watch?.seen?.pad };
    const r = phAI(PHS, { ...phMeas, T: phFused.T, RH: phFused.RH }, t, state.season, C, phA, phMem, known);
    if (known.pad) r.a.shade = Math.max(r.a.shade, 0.5);
    phA = r.a; lastPlan = { ...r.plan, t };
  } else if (state.mode === 'manual') {
    const M = state.manual.ph; phA = { vent: M.vent, shade: M.shade, fans: M.fans, pad: M.pad && M.fans > 0, fog: M.fog, co2: false, drip: Array(PH.beds).fill(M.irrigate > 0) };
  } else {
    if (state.mode === 'ai' && !edgeLogged) { edgeLogged = true; }
    phA = phRules({ ...phMeas, ...phFused }, w, C, phA, t);
  }
}

function pushAlert(fac, e) {
  const list = alerts[fac];
  if (e.resolved) { const a = list.find((x) => x.k === e.k && !x.done); if (a) { a.done = e.t; } return; }
  list.unshift({ ...e }); if (list.length > 40) list.pop();
}

// ── IoT messages ──
function sendAll(fac, k) {   // every node reports every 5 minutes, staggered across the cycle
  const net = fac === 'ph' ? phNet : vfNet; let i = 0;
  const thin = state.speed >= 3600 ? 0.35 : 1;
  for (const [id, n] of net.nodes) {
    i++; if ((k + i) % 5 !== 0) continue;
    n.last = state.t; const msg = payload(fac, id);
    if (rnd() < thin) net.send(id, msg.alarm);
    const off = fac === 'ph' && phF.gateway;
    feed[fac].unshift({ t: state.t, topic: `haritghar/${fac}/${id}`, body: msg.body, buf: off }); if (feed[fac].length > 40) feed[fac].pop();
  }
  net.setOffline(fac === 'ph' && !!phF.gateway);
}
function payload(fac, id) {
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  if (fac === 'ph') {
    const w = weather(state.season, state.t);
    if (id.startsWith('TH')) { const i = +id.slice(3) - 1; return { body: { t: r1(phMeas.T[i]), rh: Math.round(phMeas.RH[i]), ...(i % 2 ? { par: Math.round(phR.Rin * 2.05) } : { co2: Math.round(phMeas.C) }) }, alarm: phMem.exclude?.[i] }; }
    if (id.startsWith('SM')) { const i = +id.slice(3) - 1; return { body: { vwc: r1(phMeas.theta[i]), st: r1(PHS.T - 4) }, alarm: phMeas.theta[i] < C0().theta[0] - 4 }; }
    if (id === 'FERT') return { body: { ec: r2(phMeas.ec), ph: r2(phMeas.ph), q: phA.drip.filter(Boolean).length * 0.9 } };
    if (id === 'PAD') return { body: { pump: phA.pad && phA.fans > 0 ? 1 : 0, amp: phA.pad && phA.fans > 0 && !phF.pad ? 2.1 : 0, lvl: 0.82 } };
    if (id === 'WS') return { body: { t: r1(w.T), rh: Math.round(w.RH), sr: Math.round(w.G), ws: r1(w.wind) } };
    if (id === 'CAM') return { body: { frames: 6, det: detections.filter((d) => !d.treated).length } };
  } else {
    if (id.startsWith('RK')) { const i = +id.slice(3) - 1; return { body: { t: r1(VFS.T + (i - 1.5) * 0.15), rh: Math.round(vfR.rh), co2: Math.round(VFS.C), par: Math.round(vfR.ppfd), air: vfF.airflow && i === 2 ? 0.05 : 0.4 }, alarm: vfF.airflow && i === 2 }; }
    if (id === 'NUT') return { body: { ec: r2(VFS.ecRead), ph: r2(VFS.ph), do: 8.1, wt: 20.2 } };
    if (id.startsWith('FLOW')) { const i = +id.slice(5) - 1; const dead = vfF.pump && !vfF.pumpFixed && i === 1; return { body: { lpm: dead ? 0 : 12.4 }, alarm: dead }; }
    if (id === 'HVAC') return { body: { kw: r1(vfR.hvacKW), cool: r1(vfR.Q), sup: vfF.hvac ? r1(VFS.T) : 14.5 }, alarm: !!vfF.hvac };
    if (id === 'CAM') return { body: { frames: 12, det: vlog.filter((d) => d.tip > 0.15).length } };
  }
  return { body: {} };
}
const C0 = () => crop();

// ── disease and vision ──
function stepDisease(t, dth) {
  const P = phCropObj.plants, rhIn = rhOf(PHS.T, PHS.x), hum = rhIn > 85 ? 2.2 : rhIn > 75 ? 1.3 : 0.7;
  if (!disease.onset && PHS.wet > 5 && rnd() < 0.01 * dth * 6) seedDisease(t, 3);
  let any = false;
  for (let i = 0; i < P.length; i++) {
    const p = P[i]; if (p.inf <= 0) continue; any = true;
    if (p.treated) { p.inf = Math.max(0.12, p.inf - 0.012 * dth); continue; }
    p.inf = Math.min(1, p.inf + 0.03 * hum * dth);
    if (p.inf > 0.25) for (const j of neigh[i]) if (P[j].inf === 0 && !P[j].treated && rnd() < 0.06 * hum * dth) P[j].inf = 0.02;
  }
  // AI: treat 2 h after detection; rules: daily scouting by eye at 09:00 finds visible symptoms only
  for (const d of detections) if (!d.treated && t - d.t > 2) { d.treated = t; treatAround(d.i); }
  if (state.mode !== 'ai' && any && Math.abs((((t % 24) + 24) % 24) - 9) < 1e-3) {
    const found = P.map((p, i) => [p, i]).filter(([p]) => p.inf > 0.45 && !p.treated);
    if (found.length) { if (!disease.found) disease.found = t; found.forEach(([, i]) => treatAround(i)); pushAlert('ph', { k: `scout${t}`, t, sev: 'warn', node: 'Scout (worker)', msg: `${found.length} plants with visible ${crop().disease.toLowerCase()} found on the morning round.`, act: 'Spot spray' }); }
  }
}
function seedDisease(t, n = 6) {
  const P = phCropObj.plants, per = P.length / (PH.beds * 2), start = Math.floor(rnd() * 3) * 2 * per + Math.floor(rnd() * (per - n));
  for (let k = 0; k < n; k++) P[start + k].inf = 0.04 + k * 0.01;
  disease.onset = t;
}
function treatAround(i) {   // spot spray: the plant and everything within 2 m of it on the same bed
  const P = phCropObj.plants, c = P[i]; for (const p of P) if (p.bed === c.bed && Math.abs(p.z - c.z) < 2) p.treated = true; disease.treated++;
}
function scan(dt) {
  if (state.mode !== 'ai') { const p = { x: 10, z: -19.3 }; rover.g.position.set(p.x, 0, p.z); rover.g.rotation.y = 0; return; }
  const v = state.speed >= 3600 ? 6 : state.speed >= 600 ? 3 : 1.2; roverD += v * dt;
  const p = route.at(roverD); rover.g.position.set(p.x, 0, p.z); rover.g.rotation.y = p.h;
  rover.beacon.material.color.set(Math.sin(performance.now() / 150) > 0 ? '#3fcf8e' : '#0f3a22');
  const P = phCropObj.plants;
  for (let i = 0; i < P.length; i++) {
    const pl = P[i]; if (pl.inf < 0.08 || pl.det) continue;
    if (Math.abs(pl.z - p.z) < 0.5 && Math.abs(pl.x - p.x) < 1.4) {
      pl.det = true; const conf = Math.min(0.98, 0.62 + 0.9 * pl.inf + 0.04 * Math.sin(i));
      detections.unshift({ i, t: state.t, conf, bed: pl.bed + 1, z: pl.z, treated: false });
      if (detections.length > 60) detections.pop();
      if (!disease.found) disease.found = state.t;
    }
  }
}
let detBoxes = null;
function drawDetections() {
  if (detBoxes) { ph.group.remove(detBoxes); detBoxes.geometry.dispose(); }
  const pos = [], P = phCropObj.plants, live = detections.filter((d) => !d.treated || state.t - d.treated < 6).slice(0, 40);
  for (const d of live) { const p = P[d.i], h = p.h + 0.3, x0 = p.x - 0.22, x1 = p.x + 0.22, z0 = p.z - 0.22, z1 = p.z + 0.22, y0 = 0.26, y1 = 0.26 + h;
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) pos.push(...c[a], ...c[b]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  detBoxes = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#ff5a5a' })); ph.group.add(detBoxes);
}

// ── cameras ──
const CAMS = {
  ph: { over: ['Overview', [36, 26, 44], [0, 2, 0]], inside: ['Inside', [0.6, 1.7, -17.5], [0, 2.2, 2]], pad: ['Pad wall', [7, 2.3, -18.9], [-3, 1.3, -20]], fans: ['Fan wall', [9, 3.5, 31], [0, 1.6, 20]], scout: ['Robot', null, null], iot: ['Network', [8, 62, 36], [0, 0, 4]] },
  vf: { over: ['Overview', [12.5, 10, 17], [0, 1.2, -1]], aisle: ['Aisle', [0, 1.65, 9.2], [0, 1.3, -6]], tier: ['Rack', [-2.4, 1.55, 5.8], [-1.75, 1.0, 0]], nutrient: ['Nutrients', [-4.6, 2.8, 3.2], [-6.3, 0.9, -5.2]], scout: ['Robot', null, null], iot: ['Network', [2, 24, 9], [0, 0, -0.5]] },
};
let camAnim = null, snap = false;
function setCam(c, instant = false) {
  if (!CAMS[state.fac][c]) c = 'over'; state.cam = c;
  $$('#cams button').forEach((b) => b.classList.toggle('active', b.dataset.cam === c));
  const [, p, t] = CAMS[state.fac][c]; if (!p) return;
  if (instant) { camera.position.set(...p); controls.target.set(...t); camAnim = null; return; }
  camAnim = { u: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: V3(...p), t1: V3(...t) };
}
function follow(dt) {
  if (state.cam !== 'scout') return;
  const g = state.fac === 'ph' ? rover.g : vfObj.U.agv, h = g.rotation.y, ahead = 2.8;   // ahead of the robot, looking back at it, so the camera stays inside
  const want = V3(g.position.x + Math.sin(h) * ahead, state.fac === 'ph' ? 3.6 : 3.4, g.position.z + Math.cos(h) * ahead);
  const k = snap ? 1 : Math.min(1, dt * 2.5); camera.position.lerp(want, k); controls.target.lerp(V3(g.position.x, 0.9, g.position.z), k);
}

// ── facility switching and sky ──
function applyFacility() {
  const isPH = state.fac === 'ph';
  ph.group.visible = isPH; vfObj.group.visible = !isPH;
  $('#seasonBox').style.display = ''; $('#coverBtn').textContent = isPH ? 'Cover' : 'Walls';
  $('#cams').innerHTML = Object.entries(CAMS[state.fac]).map(([k, [n]]) => `<button data-cam="${k}">${n}</button>`).join('');
  $$('#cams button').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));
  setCam(CAMS[state.fac][state.cam] ? state.cam : 'over', true);
  labels.clear(); renderLeft(); buildDash(); buildCtrl(); buildAI(); renderCrop(); buildEco();
}
const skyDay = new THREE.Color('#bcd6ec'), skyCloud = new THREE.Color('#9eabb6'), skyDusk = new THREE.Color('#e8a876'), skyNight = new THREE.Color('#0d1524');
function sky() {
  const w = weather(state.season, state.t);
  if (state.fac === 'vf') {
    scene.background.set('#16191d'); scene.fog.color.set('#16191d'); scene.fog.near = 60; scene.fog.far = 200;
    sun.intensity = 0; hemi.intensity = 0.35; hemi.color.set('#f0f4ff'); roomLight.intensity = 0.9; scene.environmentIntensity = 0.55;
    const lit = vfA.light * vfA.dim; vfLights.forEach((l) => { l.intensity = 9 * lit; l.color.set(vfObj.U.leds[0].emissive); });
    return;
  }
  roomLight.intensity = 0; vfLights.forEach((l) => { l.intensity = 0; });
  const e = w.elev, S = SEASONS[state.season], h = w.h;
  const c = skyNight.clone();
  if (e > 0) { c.copy(skyDusk).lerp(skyDay, Math.min(1, e * 2.2)).lerp(skyCloud, w.cloud * 0.8); }
  else { const dusk = Math.max(0, 1 - Math.min(Math.abs(h - S.set), Math.abs(h - S.rise)) / 0.8); c.lerp(skyDusk, dusk * 0.6); }
  scene.background.copy(c); scene.fog.color.copy(c); scene.fog.near = 110; scene.fog.far = 320;
  const u = clamp(w.u, 0, 1), ang = Math.PI * u;
  sun.position.set(Math.cos(ang) * 90, 12 + Math.sin(ang) * 85, -45); sun.target.position.set(0, 0, 0);
  sun.intensity = e > 0 ? 0.25 + 1.75 * Math.pow(e, 0.6) * (1 - 0.6 * w.cloud) : 0.12; sun.color.set(e > 0.25 ? '#fff3df' : e > 0 ? '#ffc58a' : '#8fa6d6');
  if (e <= 0) sun.position.set(-40, 70, 30);
  hemi.intensity = 0.15 + 0.5 * Math.max(e, 0) + (e <= 0 ? 0.08 : 0); hemi.color.set('#eef4ff'); scene.environmentIntensity = 0.12 + 0.35 * Math.max(0, e);
}
// rain
const RAIN = 2400, rainPos = new Float32Array(RAIN * 6);
for (let i = 0; i < RAIN; i++) { const x = (Math.random() - 0.5) * 90, z = (Math.random() - 0.5) * 90, y = Math.random() * 30; rainPos.set([x, y, z, x + 0.1, y + 0.7, z], i * 6); }
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#cfe3f2', transparent: true, opacity: 0.45 })); rain.frustumCulled = false; ph.group.add(rain);

// ── left panel ──
function renderLeft() {
  $('#facs').innerHTML = [['ph', '🏡', 'Polyhouse', `${PH.area} m² NVPH, 3 bays, fan-and-pad, fogging, drip fertigation`], ['vf', '🏢', 'Vertical farm', `${Math.round(VF.area)} m² of growing area: 4 racks × 6 NFT tiers under LEDs`]]
    .map(([k, i, n, d]) => `<button class="fac ${state.fac === k ? 'active' : ''}" data-fac="${k}"><i>${i}</i><span><b>${n}</b><small>${d}</small></span></button>`).join('');
  $$('.fac').forEach((b) => b.addEventListener('click', () => { if (state.fac === b.dataset.fac) return; state.fac = b.dataset.fac; applyFacility(); }));
  $('#seasons').innerHTML = Object.entries(SEASONS).map(([k, s]) => `<button data-season="${k}" class="${state.season === k ? 'active' : ''}">${s.icon} ${s.name.split(' ')[0]}</button>`).join('');
  $$('#seasons button').forEach((b) => b.addEventListener('click', () => { state.season = b.dataset.season; cmpCache = {}; resetSim(); renderLeft(); buildAI(); }));
  const crops = state.fac === 'ph' ? PH_CROPS : VF_CROPS, cur = state.fac === 'ph' ? state.phCrop : state.vfCrop;
  $('#crops').innerHTML = Object.entries(crops).map(([k, c]) => `<button data-crop="${k}" class="${cur === k ? 'active' : ''}">${esc(c.name)}</button>`).join('');
  $$('#crops button').forEach((b) => b.addEventListener('click', () => {
    if (state.fac === 'ph') { state.phCrop = b.dataset.crop; mountCrop(); }
    else { state.vfCrop = b.dataset.crop; scene.remove(vfObj.group); vfObj = buildVFarm(state.vfCrop, vcrop()); scene.add(vfObj.group); vfObj.group.add(vfNet.group); }
    cmpCache = {}; resetSim(); applyFacility();
  }));
  $$('#modes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.mode));
  $('#modeNote').textContent = { manual: 'You set every actuator yourself from the Control tab.', rules: 'Fixed thresholds with hysteresis and timer irrigation, as on a typical controller. Only plain alarms.', ai: state.fac === 'ph' ? 'Model-predictive control: tests 51 plans an hour ahead every 10 minutes. Sensor-based irrigation, anomaly detection and a camera robot.' : 'Moves the photoperiod to the cheapest tariff hours, sets back at night, and watches every sensor for faults.' }[state.mode];
  renderFaults();
}
function renderFaults() {
  const list = FAULTS[state.fac], F = state.fac === 'ph' ? phF : vfF;
  $('#faults').innerHTML = list.map((f) => { const on = state.fac === 'ph' && f.id === 'disease' ? !!disease.onset : F[f.id] !== undefined && F[f.id] !== false; return `<button data-f="${f.id}" class="${on ? 'on' : ''}"><b>${esc(f.name)}</b><em>${on ? 'active' : 'inject'}</em><small>${esc(f.what)}</small></button>`; }).join('');
  $$('#faults button').forEach((b) => b.addEventListener('click', () => toggleFault(b.dataset.f)));
}
function toggleFault(id) {
  const t = Math.max(0.001, state.t);
  if (state.fac === 'ph') {
    if (id === 'disease') { if (disease.onset) { phCropObj.plants.forEach((p) => Object.assign(p, { inf: 0, treated: false, det: false })); detections.length = 0; disease = { onset: null, found: null, treated: 0 }; } else seedDisease(t, 6); }
    else if (phF[id]) { delete phF[id]; } else phF[id] = id === 'drift' ? t : true;
  } else {
    if (vfF[id] !== undefined) { delete vfF[id]; if (id === 'pump') delete vfF.pumpFixed; if (id === 'ec') delete vfF.ecFixed; }
    else vfF[id] = t;
  }
  renderFaults();
}
$$('#modes button').forEach((b) => b.addEventListener('click', () => { state.mode = b.dataset.mode; if (state.mode === 'ai') vfMem.start = vfBestWindow(state.season, vcrop(), dayOf(state.t) - 1).st; renderLeft(); buildCtrl(); buildAI(); }));

// ── dashboard ──
let charts = [];
const status = (v, lo, hi) => (v < lo ? ['lo', '▼ Low'] : v > hi ? ['hi', '▲ High'] : ['ok', '✓ In band']);
function buildDash() {
  const el = $('#tab-dash');
  el.innerHTML = `<div class="tiles" id="tiles"></div><div id="charts"></div><h4>Sensor network</h4><table class="net" id="netTable"></table><h4>MQTT feed</h4><ul class="feed" id="feed"></ul>`;
  const host = $('#charts'); charts = [];
  const mk = (o) => { const d = document.createElement('div'); host.appendChild(d); const c = lineChart(d, o); charts.push(c); return c; };
  if (state.fac === 'ph') {
    const C = crop();
    mk({ title: 'Air temperature, last 24 h', unit: '°C', series: [{ name: 'Inside', key: 'Tin' }, { name: 'Outside', key: 'Tout' }], band: C.day, bandName: 'Day target' }).key = 'ph';
    mk({ title: 'Vapour pressure deficit', unit: 'kPa', series: [{ name: 'VPD', key: 'VPD' }], band: C.vpd, yMin: 0 }).key = 'ph';
    mk({ title: 'Substrate moisture, 12 beds', unit: '%', series: [{ name: 'Driest bed', key: 'thMin' }, { name: 'Average', key: 'thAvg' }, { name: 'Wettest bed', key: 'thMax' }], band: C.theta }).key = 'ph';
    mk({ title: 'CO₂', unit: 'ppm', series: [{ name: 'CO₂', key: 'CO2' }], yMin: 300 }).key = 'ph';
  } else {
    const C = vcrop();
    mk({ title: 'Room temperature, last 24 h', unit: '°C', series: [{ name: 'Room', key: 'T' }], band: C.temp }).key = 'vf';
    mk({ title: 'Relative humidity', unit: '%', series: [{ name: 'RH', key: 'RH' }], band: C.rh }).key = 'vf';
    mk({ title: 'Electrical load', unit: 'kW', series: [{ name: 'LEDs', key: 'led' }, { name: 'HVAC', key: 'hvac' }, { name: 'Total', key: 'kw' }], yMin: 0 }).key = 'vf';
    mk({ title: 'CO₂', unit: 'ppm', series: [{ name: 'CO₂', key: 'CO2' }], band: [C.co2 - 100, C.co2 + 100], yMin: 400 }).key = 'vf';
  }
  updateDash();
}
function seriesOf(h) { const d = { t: h.map((r) => r.t) }; for (const k of Object.keys(h[0] || {})) if (k !== 't') d[k] = h.map((r) => r[k]); return d; }
function updateDash() {
  if (!$('#tiles')) return;
  const tile = (n, v, u, st, extra = '') => `<div class="tile"><span>${n}</span><b>${v}<small>${u}</small></b>${st ? `<em class="${st[0]}">${st[1]}</em>` : ''}${extra}</div>`;
  if (state.fac === 'ph') {
    const C = crop(), w = weather(state.season, state.t), day = w.G > 30, band = day ? C.day : C.night, T = phFused.T, RH = phFused.RH, V = vpdOf(T, RH), th = phMeas.theta;
    const thAvg = th.reduce((a, b) => a + b) / th.length;
    $('#tiles').innerHTML = tile('Air temperature', T.toFixed(1), '°C', status(T, band[0], band[1])) + tile('Relative humidity', Math.round(RH), '%', RH > 90 ? ['hi', '▲ Disease risk'] : ['ok', `${day ? 'Day' : 'Night'}`])
      + tile('VPD', V.toFixed(2), 'kPa', status(V, C.vpd[0], C.vpd[1])) + tile('CO₂', Math.round(phMeas.C), 'ppm', phMeas.C < 340 ? ['lo', '▼ Depleted'] : ['ok', '✓ OK'])
      + tile('PAR inside', Math.round(phR.Rin * 2.05), 'µmol/m²/s', ['na', `${Math.round((1 - phR.Rin / Math.max(1, w.G)) * 100)}% cut by cover + screen`]) + tile('Substrate moisture', thAvg.toFixed(1), '%', status(Math.min(...th), C.theta[0] - 3, C.theta[1] + 4), `<em class="na">driest bed ${Math.min(...th).toFixed(0)}%</em>`)
      + tile('Feed EC · pH', `${phMeas.ec.toFixed(2)} · ${phMeas.ph.toFixed(1)}`, 'mS/cm', status(phMeas.ec, C.ec - 0.4, C.ec + 0.5)) + tile('Outside', `${w.T.toFixed(1)}°C · ${Math.round(w.RH)}%`, '', ['na', `${Math.round(w.G)} W/m² · wind ${w.wind.toFixed(1)} m/s`])
      + tile('Water today', Math.round(phWater(PHS.acc)).toLocaleString('en-IN'), 'L', ['na', `drip ${Math.round(PHS.acc.drip)} · cooling ${Math.round(PHS.acc.pad + PHS.acc.fog)}`]) + tile('Energy today', PHS.acc.kwh.toFixed(0), 'kWh', ['na', `${inr(phCostTotal(PHS.acc))} with water`]);
    charts.forEach((c) => c.update(seriesOf(hist)));
  } else {
    const C = vcrop(), V = vpdOf(VFS.T, vfR.rh), dli = vfDLI(C, vfA.dim);
    $('#tiles').innerHTML = tile('Room temperature', VFS.T.toFixed(1), '°C', status(VFS.T, C.temp[0] - 1, C.temp[1] + 1)) + tile('Relative humidity', Math.round(vfR.rh), '%', status(vfR.rh, C.rh[0], C.rh[1]))
      + tile('VPD', V.toFixed(2), 'kPa', status(V, 0.6, 1.2)) + tile('CO₂', Math.round(VFS.C), 'ppm', status(VFS.C, vfA.light ? C.co2 - 150 : 300, C.co2 + 200))
      + tile('PPFD', Math.round(vfR.ppfd), 'µmol/m²/s', ['na', vfA.light ? `DLI ${dli.toFixed(1)} mol/m²/d` : 'Lights off (night)']) + tile('Nutrient EC · pH', `${VFS.ecRead.toFixed(2)} · ${VFS.ph.toFixed(1)}`, 'mS/cm', status(VFS.ecRead, C.ec - 0.3, C.ec + 0.3))
      + tile('Power now', vfR.kw.toFixed(1), 'kW', ['na', `LED ${vfR.Qled.toFixed(0)} · HVAC ${vfR.hvacKW.toFixed(1)} · COP ${vfR.cop.toFixed(1)}`]) + tile('Tariff now', TARIFF(((state.t % 24) + 24) % 24).toFixed(1), '₹/kWh', ['na', ((state.t % 24) + 24) % 24 >= 22 || ((state.t % 24) + 24) % 24 < 6 ? 'Off-peak' : 'Day rate'])
      + tile('Energy today', VFS.acc.kwh.toFixed(0), 'kWh', ['na', `${inr(VFS.acc.cost)} incl. CO₂`]) + tile('Harvested today', VFS.acc.kg.toFixed(1), 'kg', ['na', `${(VFS.acc.kwh / Math.max(0.1, VFS.acc.growth)).toFixed(1)} kWh per kg grown`]);
    charts.forEach((c) => c.update(seriesOf(vhist)));
  }
  const net = state.fac === 'ph' ? phNet : vfNet;
  $('#netTable').innerHTML = `<tr><th>Node</th><th>Battery</th><th>RSSI</th><th>Link</th><th>Last seen</th></tr>` + [...net.nodes.values()].map((n) => {
    const ago = n.last < 0 ? '—' : `${Math.max(0, Math.round((state.t - n.last) * 60))} min`;
    const link = state.fac === 'ph' ? `LoRa SF${n.rssi > -85 ? 7 : n.rssi > -95 ? 9 : 10}` : 'Wi-Fi';
    return `<tr><td>${esc(n.id)}</td><td>${n.kind === 'cam' ? 'mains' : `${n.bat.toFixed(2)} V`}</td><td>${n.rssi} dBm</td><td>${link}</td><td>${ago}</td></tr>`;
  }).join('');
  $('#feed').innerHTML = feed[state.fac].slice(0, 18).map((f) => `<li class="${f.buf ? 'buf' : ''}"><em>${hhmm(f.t)}</em> <b>${esc(f.topic)}</b> ${esc(JSON.stringify(f.body))}${f.buf ? ' ⏸ buffered' : ''}</li>`).join('');
}

// ── control ──
function buildCtrl() {
  const el = $('#tab-ctrl'), man = state.mode === 'manual', dis = man ? '' : 'disabled';
  const note = man ? '<p class="muted">Manual mode: your settings apply at the next 10-minute control step.</p>' : `<p class="muted">The ${state.mode === 'ai' ? 'AI' : 'rule-based'} controller is driving. Switch to Manual on the left to take over.</p>`;
  if (state.fac === 'ph') {
    const M = state.manual.ph, C = crop();
    el.innerHTML = `<h3>Actuators</h3>${note}
      ${slider('vent', 'Vents', M.vent, 0, 1, 0.05, dis)}${slider('shade', 'Shade screen', M.shade, 0, 1, 0.5, dis)}${slider('fans', 'Exhaust fans', M.fans, 0, 6, 1, dis)}
      <div class="sl"><span>Pad pump</span><label><input type="checkbox" id="m-pad" ${M.pad ? 'checked' : ''} ${dis}/> wet the pads when fans run</label><b id="v-pad"></b></div>
      ${slider('fog', 'Fogging', M.fog, 0, 1, 0.5, dis)}
      <div class="sl"><span>Drip</span><button class="btn" id="m-irr" ${dis}>Irrigate all beds 10 min</button><b id="v-irr"></b></div>
      <h4>Drip valves and bed moisture</h4><div class="valves" id="valves"></div>
      <h4>Setpoints for ${esc(C.name.toLowerCase())}</h4>
      <table class="spec"><tr><td>Day air temperature</td><td>${C.day[0]}–${C.day[1]} °C</td></tr><tr><td>Night air temperature</td><td>${C.night[0]}–${C.night[1]} °C</td></tr><tr><td>VPD</td><td>${C.vpd[0]}–${C.vpd[1]} kPa</td></tr><tr><td>Substrate moisture</td><td>${C.theta[0]}–${C.theta[1]}% vol</td></tr><tr><td>Drip feed EC · pH</td><td>${C.ec} mS/cm · ${C.ph}</td></tr></table>
      <h4>Kit</h4><table class="spec"><tr><td>Cover</td><td>${PH.cover}</td></tr><tr><td>Vents</td><td>Roll-up sides + ridge flaps, ${PH.net}</td></tr><tr><td>Screen</td><td>${PH.screen}</td></tr><tr><td>Fan-and-pad</td><td>${PH.fans} × 1.27 m fans, ${(PH.fans * PH.fanFlow / 1000).toFixed(0)}k m³/h; 23 m × 2.1 m pad</td></tr><tr><td>Fogging</td><td>${PH.bays * 2} lines, ≈0.12 L/m²/h</td></tr></table>`;
    ['vent', 'shade', 'fans', 'fog'].forEach((k) => { $(`#m-${k}`).oninput = (e) => { M[k] = +e.target.value; }; });
    $('#m-pad').onchange = (e) => { M.pad = e.target.checked; };
    $('#m-irr').onclick = () => { M.irrigate = 10; };
  } else {
    const M = state.manual.vf, C = vcrop();
    el.innerHTML = `<h3>Actuators</h3>${note}
      <div class="sl"><span>LEDs</span><label><input type="checkbox" id="m-light" ${M.light ? 'checked' : ''} ${dis}/> lights on</label><b></b></div>
      ${slider('dim', 'LED dimming', M.dim, 0.3, 1, 0.05, dis)}${slider('set', 'HVAC setpoint', M.set, 16, 28, 0.5, dis, '°C')}${slider('co2', 'CO₂ setpoint', M.co2, 400, 1400, 50, dis, 'ppm')}
      <div class="sl"><span>Dehumidifier</span><label><input type="checkbox" id="m-dehum" ${M.dehum ? 'checked' : ''} ${dis}/> on</label><b></b></div>
      <h4>Recipe for ${esc(C.name.toLowerCase())}</h4>
      <table class="spec"><tr><td>PPFD × photoperiod</td><td>${C.ppfd} µmol/m²/s × ${C.photo} h</td></tr><tr><td>DLI</td><td>${vfDLI(C).toFixed(1)} mol/m²/day</td></tr><tr><td>Air</td><td>${C.temp[0]}–${C.temp[1]} °C, RH ${C.rh[0]}–${C.rh[1]}%</td></tr><tr><td>CO₂ (lights on)</td><td>${C.co2} ppm</td></tr><tr><td>Nutrient EC · pH</td><td>${C.ec} mS/cm · ${C.ph}</td></tr><tr><td>Transplant → harvest</td><td>${C.days} days, ${C.g} g a plant</td></tr></table>
      <h4>Kit</h4><table class="spec"><tr><td>Racks</td><td>${VF.racks} × ${VF.tiers} tiers × ${VF.len} m, ${VF.channels} NFT channels a tier</td></tr><tr><td>Plants</td><td>${(VF.racks * VF.tiers * VF.channels * VF.holes).toLocaleString('en-IN')} sites, ${Math.round(VF.area)} m²</td></tr><tr><td>LEDs</td><td>${VF.efficacy} µmol/J</td></tr><tr><td>HVAC</td><td>${VF.hvacKW} kW cooling, COP falls as it gets hotter outside</td></tr></table>`;
    ['dim', 'set', 'co2'].forEach((k) => { $(`#m-${k}`).oninput = (e) => { M[k] = +e.target.value; }; });
    $('#m-light').onchange = (e) => { M.light = e.target.checked ? 1 : 0; }; $('#m-dehum').onchange = (e) => { M.dehum = e.target.checked; };
  }
  updateCtrl();
}
const slider = (k, n, v, a, b, s, dis, u = '') => `<div class="sl"><span>${n}</span><input type="range" id="m-${k}" min="${a}" max="${b}" step="${s}" value="${v}" ${dis}/><b id="v-${k}"></b></div>`;
function updateCtrl() {
  if (state.fac === 'ph') {
    const a = phA, set = (k, v) => { const e = $(`#v-${k}`); if (e) e.textContent = v; };
    set('vent', `${Math.round(a.vent * 100)}%`); set('shade', `${Math.round(a.shade * 100)}%`); set('fans', `${a.fans}/6`); set('pad', a.pad && a.fans ? 'wet' : 'dry'); set('fog', `${Math.round(a.fog * 100)}%`); set('irr', `${a.drip.filter(Boolean).length}/12`);
    if (state.mode !== 'manual') for (const k of ['vent', 'shade', 'fans', 'fog']) { const e = $(`#m-${k}`); if (e) e.value = a[k]; }
    const C = crop(), v = $('#valves'); if (v) v.innerHTML = phMeas.theta.map((th, i) => `<div class="${a.drip[i] ? 'open' : ''} ${th < C.theta[0] - 2 ? 'dry' : th > C.theta[1] + 3 ? 'wet' : ''}">Bed ${i + 1}<b>${th.toFixed(0)}%</b>${a.drip[i] ? 'open' : 'shut'}</div>`).join('');
  } else {
    const set = (k, v) => { const e = $(`#v-${k}`); if (e) e.textContent = v; };
    set('dim', `${Math.round(vfA.dim * 100)}%`); set('set', `${vfA.set.toFixed(1)}°`); set('co2', vfA.co2 ? `${vfA.co2}` : 'off');
  }
}

// ── AI tab ──
let cmpCache = {};
function buildAI() { $('#tab-ai').innerHTML = `<div id="aiTop"></div><h4>Alerts and detections</h4><ul class="alerts" id="alerts"></ul><h4>24-hour comparison</h4><div id="cmp"></div>`; renderCmp(); updateAI(); }
function updateAI() {
  if (!$('#aiTop')) return;
  const ai = state.mode === 'ai';
  if (state.fac === 'ph') {
    const C = crop(), P = phCropObj.plants, inf = P.filter((p) => p.inf > 0).length, sum = roll.reduce((a, r) => [a[0] + r[0], a[1] + r[1]], [0, 0]), idx = sum[1] ? sum[0] / sum[1] : 0.8;
    const loss = P.reduce((a, p) => a + p.inf, 0) / P.length, fc = C.yield * clamp(idx / 0.85, 0.5, 1.2) * (1 - 0.5 * loss);
    let top = '';
    if (!ai) top = `<div class="card2"><h5>AI is off</h5><p>The ${state.mode === 'rules' ? 'rule-based controller' : 'manual settings'} run the house. Switch to AI on the left to see model-predictive control, anomaly detection and the camera robot at work.</p></div>`;
    else if (phF.gateway) top = `<div class="card2"><h5>⚠ Edge fallback</h5><p>The gateway has lost its uplink, so the cloud model cannot reach the site. The edge controller runs local rules and buffers sensor data until the link returns.</p></div>`;
    else if (lastPlan) {
      const b = lastPlan.best, a = b.a, last = b.path[b.path.length - 1], s = b.sum;
      const name = { fans: 'Fans and pad', shade: 'Shade screen', vent: 'Vents', fog: 'Fogging' }, desc = (k, x) => (k === 'fans' ? (x.fans ? `${x.fans} fans${x.pad ? ' + pad' : ', pad dry'}` : 'fans off') : `${Math.round(x[k] * 100)}%`);
      top = `<div class="card2"><h5>Climate plan · decided ${hhmm(lastPlan.t)}</h5>
        <div class="acts"><span>Vents <b>${Math.round(a.vent * 100)}%</b></span><span>Shade <b>${Math.round(a.shade * 100)}%</b></span><span>Fans <b>${a.fans}${a.pad ? ' + pad' : ''}</b></span><span>Fog <b>${Math.round(a.fog * 100)}%</b></span></div>
        <p>Predicted in one hour: <b>${last.T.toFixed(1)} °C</b>, VPD <b>${last.V.toFixed(2)} kPa</b>. Running cost ${inr(s.power + s.water)} for the hour; photosynthesis worth ${inr(-s.growth)}.</p>
        <p class="muted">Why this plan, against the best plan that changes one thing:</p>
        <ul class="why">${lastPlan.why.slice(0, 3).map((y) => `<li><span>${name[y.k]} ${desc(y.k, a)} rather than ${desc(y.k, y.alt)}</span><b>−${Math.round(y.gain)} pts</b></li>`).join('')}</ul>
        <p class="legendnote">${lastPlan.res.length} candidate plans simulated 60 minutes ahead on the house model and the weather forecast. Score, in ₹-equivalent points: heat and VPD stress + leaf wetness + power and water − value of photosynthesis. Lower is better.</p></div>`;
    }
    const irr = ai ? `<div class="card2"><h5>Sensor-based irrigation</h5><p>Each bed's valve opens on its own probe: below ${C.theta[0] + 1}% moisture, or after 0.5 MJ/m² of light since its last pulse while under ${(C.theta[0] + C.theta[1]) / 2}%. Drip water today: <b>${Math.round(PHS.acc.drip).toLocaleString('en-IN')} L</b>; drained: <b>${Math.round(PHS.acc.drain)} L</b>.</p></div>` : '';
    const vis = `<div class="card2"><h5>Plant-health vision ${ai ? '' : '(off)'}</h5><p>${ai ? `The camera robot scans both rows of every path; a detector flags ${esc(C.disease.toLowerCase())} before it is obvious to the eye. Detections are simulated.` : 'Without the robot, a worker scouts by eye at 09:00 each morning and finds only visible symptoms.'}</p>
      <p>Infected plants: <b>${inf}</b> · detected: <b>${detections.length}</b> · treated spots: <b>${disease.treated}</b>${disease.onset !== null ? ` · onset ${hhmm(disease.onset)} day ${dayOf(disease.onset)}${disease.found ? `, found after ${(disease.found - disease.onset).toFixed(1)} h` : ', not yet found'}` : ''}</p></div>`;
    const yf = `<div class="card2"><h5>Yield forecast</h5><p><b>${fc.toFixed(1)} kg/m²/yr</b> (range ${(fc * 0.88).toFixed(1)}–${(fc * 1.12).toFixed(1)}) against a typical ${C.yield} for ${esc(C.name.toLowerCase())}. Climate index over 24 h: <b>${Math.round(idx * 100)}%</b> of the light-limited potential${loss > 0.002 ? `; disease cuts ${(loss * 50).toFixed(1)}%` : ''}.</p></div>`;
    $('#aiTop').innerHTML = top + irr + vis + yf;
  } else {
    const C = vcrop(), best = vfBestWindow(state.season, C, dayOf(state.t) - 1), base = vfWindowCost(state.season, C, 6, dayOf(state.t) - 1);
    const st = ai ? vfMem.start : 6;
    const k = Math.log((C.g * 1.05 / 5 - 1) / 0.0526) / C.days, tAt = (fw) => Math.log((C.g * 1.05 / 5 - 1) / Math.max(1e-3, C.g * 1.05 / Math.min(fw, C.g * 1.04) - 1)) / k;
    const days = Array(7).fill(0); VFS.tiers.forEach((ti) => { const d = Math.max(0, tAt(C.g) - tAt(ti.fw)); if (d < 7) days[Math.floor(d)] += (C.g * VF.channels * VF.holes) / 1000 * ti.health * (1 - 0.5 * ti.tip); });
    const mx = Math.max(...days, 1);
    $('#aiTop').innerHTML = `${ai ? `<div class="card2"><h5>Photoperiod optimiser</h5><p>Lights on <b>${hhmm(st)}–${hhmm(st + C.photo)}</b>. Against a fixed 06:00 start this saves <b>${inr(base - best.c)}</b> a day (${Math.round((1 - best.c / base) * 100)}%) by using off-peak power and cooler night air, which raises the HVAC's COP.</p><p class="legendnote">Searches all 24 start hours on the tariff and the outdoor-temperature forecast. Night set-back to ${C.temp[0] - 0.5} °C; CO₂ dosing only while lit.${vfMem.dim ? ` <b>LEDs dimmed to ${Math.round(vfMem.dim * 100)}% to protect the crop.</b>` : ''}</p></div>` : `<div class="card2"><h5>AI is off</h5><p>Lights run 06:00–${hhmm(6 + C.photo)} every day at full power and the setpoints are fixed. Only plain alarms.</p></div>`}
      <div class="card2"><h5>Harvest forecast, next 7 days</h5><div class="bars">${days.map((v, i) => `<div style="height:100%"><i style="height:${(v / mx) * 100}%"></i><span>${v ? v.toFixed(0) : ''}</span><em>${i === 0 ? 'Today' : `+${i}`}</em></div>`).join('')}</div><p class="legendnote" style="margin-top:20px">kg a day from each tier's growth curve, its health and any tipburn.</p></div>
      <div class="card2"><h5>Vision: tipburn and wilting</h5><p>${ai ? 'The camera robot photographs every tier as it drives the aisles. Detections are simulated.' : 'Off without AI.'} Tiers flagged: <b>${VFS.tiers.filter((t2) => t2.tip > 0.12 || t2.health < 0.85).length}</b>.</p></div>`;
  }
  const list = alerts[state.fac], fac = state.fac;
  const det = fac === 'ph' ? detections.slice(0, 6).map((d) => ({ t: d.t, sev: 'det', node: 'CAM', msg: `${crop().disease} on bed ${d.bed} at ${(d.z + 20).toFixed(1)} m from the pad wall, confidence ${d.conf.toFixed(2)}.`, act: d.treated ? 'Spot sprayed' : 'Spot spray scheduled within 2 h' }))
    : VFS.tiers.map((ti, i) => ({ ti, i })).filter(({ ti }) => ti.tip > 0.12).slice(0, 4).map(({ ti, i }) => ({ t: state.t, sev: 'det', node: 'CAM', msg: `${vcrop().disorder} on rack ${Math.floor(i / VF.tiers) + 1}, tier ${(i % VF.tiers) + 1}: ${Math.round(ti.tip * 100)}% of heads, confidence ${(0.7 + ti.tip * 0.25).toFixed(2)}.`, act: 'Raise airflow; harvest early' }));
  const all = [...det, ...list].sort((a, b) => b.t - a.t).slice(0, 14);
  $('#alerts').innerHTML = all.length ? all.map((a) => `<li class="${a.done ? 'ok' : a.sev}"><div class="h"><span><span class="sev">${a.done ? '✓ resolved' : a.sev === 'crit' ? '⛔ critical' : a.sev === 'det' ? '◎ detection' : '⚠ warning'}</span> <b>${esc(a.node)}</b></span><em>${hhmm(a.t)} · day ${dayOf(a.t)}</em></div><div>${esc(a.msg)}</div>${a.act ? `<div class="act">→ ${esc(a.act)}</div>` : ''}</li>`).join('') : '<li class="ok"><div>No alerts. Inject a fault on the left to watch detection at work.</div></li>';
}
function renderCmp() {
  const el = $('#cmp'); if (!el) return;
  const key = `${state.fac}|${state.season}|${state.fac === 'ph' ? state.phCrop : state.vfCrop}`, r = cmpCache[key];
  if (!r) { el.innerHTML = `<p class="muted">Run the same day twice on the model, once under the rules and once under the AI, with no faults.</p><button class="btn" id="runCmp">▶ Run 24 h: rules vs AI</button>`; $('#runCmp').onclick = () => { el.innerHTML = '<p class="muted">Simulating…</p>'; setTimeout(() => { compute(key); renderCmp(); buildEco(); }, 30); }; return; }
  const rows = state.fac === 'ph'
    ? [['Day/night temperature in band', (x) => `${Math.round(x.inT * 100)}%`, 'inT', 1], ['VPD in band', (x) => `${Math.round(x.inV * 100)}%`, 'inV', 1], ['Hours over 3 °C too hot', (x) => x.hot.toFixed(1), 'hot', -1], ['Leaf-wet hours', (x) => x.wetH.toFixed(1), 'wetH', -1], ['Photosynthesis vs potential', (x) => `${Math.round(x.P * 100)}%`, 'P', 1], ['Drip water', (x) => `${Math.round(x.drip).toLocaleString('en-IN')} L`, 'drip', -1], ['Cooling water (pad + fog)', (x) => `${Math.round(x.cool).toLocaleString('en-IN')} L`, 'cool', -1], ['Electricity', (x) => `${x.kwh.toFixed(0)} kWh`, 'kwh', -1], ['Running cost', (x) => inr(x.cost), 'cost', -1], ['Crop value of photosynthesis', (x) => inr(x.value), 'value', 1], ['Net (value − cost)', (x) => inr(x.net), 'net', 1]]
    : [['Temperature in band', (x) => `${Math.round(x.inT * 100)}%`, 'inT', 1], ['Humidity in band', (x) => `${Math.round(x.inRH * 100)}%`, 'inRH', 1], ['Growth', (x) => `${x.growth.toFixed(1)} kg`, 'growth', 1], ['Electricity', (x) => `${x.kwh.toFixed(0)} kWh`, 'kwh', -1], ['kWh per kg', (x) => x.kwhkg.toFixed(1), 'kwhkg', -1], ['CO₂ used', (x) => `${x.co2.toFixed(1)} kg`, 'co2', -1], ['Cost (power + CO₂)', (x) => inr(x.cost), 'cost', -1]];
  el.innerHTML = `<table class="cmp"><tr><th></th><th>Rules</th><th>AI</th></tr>${rows.map(([n, f, k, dir]) => { const a = r.rules[k], b = r.ai[k], better = Math.abs(a - b) < 1e-6 ? 0 : (b - a) * dir > 0 ? 2 : 1; return `<tr><td>${n}</td><td class="${better === 1 ? 'best' : ''}">${f(r.rules)}</td><td class="${better === 2 ? 'best' : ''}">${f(r.ai)}</td></tr>`; }).join('')}</table>
    <p class="legendnote">${esc(SEASONS[state.season].name)}, ${esc((state.fac === 'ph' ? crop() : vcrop()).name.toLowerCase())}, midnight to midnight on the same weather. Green marks the better of the two. ${state.fac === 'ph' ? 'The AI can spend more on power and pad water when the crop value it protects is larger.' : 'Growth is the same by design; the saving comes from when and how power is used.'}</p>`;
}
function compute(key) { const [fac, season, ck] = key.split('|'); const C = fac === 'ph' ? PH_CROPS[ck] : VF_CROPS[ck]; cmpCache[key] = { rules: runDay(fac, 'rules', season, C), ai: runDay(fac, 'ai', season, C) }; }

// ── crop tab ──
function renderCrop() {
  const el = $('#tab-crop');
  if (state.fac === 'ph') {
    const C = crop(), P = phCropObj.plants, inf = P.filter((p) => p.inf > 0.02).length;
    const et = PHS.acc.n ? (PHS.acc.drip / PH.area) : 0;
    el.innerHTML = `<h3>${esc(C.name)}</h3><p class="lead">${P.length.toLocaleString('en-IN')} plants on ${PH.beds} raised beds, two rows a bed at ${C.spacing * 100} cm, trained up strings to the crop wire. Crop duration ${esc(C.dur)}.</p>
      <table class="spec"><tr><td>Typical yield</td><td>${C.yield} kg/m²/yr (${(C.yield * PH.area / 1000).toFixed(1)} t for this house)</td></tr><tr><td>Farm-gate price (illustrative)</td><td>₹${C.price}/kg</td></tr><tr><td>Plant height</td><td>≈${C.h} m</td></tr><tr><td>Drip today</td><td>${et.toFixed(1)} L/m² of floor</td></tr><tr><td>Main disease threat</td><td>${esc(C.disease)}</td></tr><tr><td>Plants infected</td><td class="${inf ? 'warn' : 'ok'}">${inf}</td></tr></table>
      <h4>Beds</h4><div class="valves">${phMeas.theta.map((th, i) => `<div class="${phA.drip[i] ? 'open' : ''} ${th < C.theta[0] - 2 ? 'dry' : th > C.theta[1] + 3 ? 'wet' : ''}">Bed ${i + 1}<b>${th.toFixed(0)}%</b>${P.filter((p) => p.bed === i && p.inf > 0.02).length || ''}${P.filter((p) => p.bed === i && p.inf > 0.02).length ? ' sick' : ''}</div>`).join('')}</div>
      <h4>Good practice</h4><ul class="checks"><li>Keep VPD in ${C.vpd[0]}–${C.vpd[1]} kPa: too low invites fungal disease, too high closes the stomata.</li><li>Avoid long spells above ${C.day[1] + 3} °C, which cause flower and fruit drop.</li><li>Irrigate little and often from the drip, matched to light; aim for 10–20% drainage.</li><li>Double doors, a foot bath and 40-mesh insect nets keep pests out.</li></ul>`;
  } else {
    const C = vcrop(), k = Math.log((C.g * 1.05 / 5 - 1) / 0.0526) / C.days, tAt = (fw) => Math.log((C.g * 1.05 / 5 - 1) / Math.max(1e-3, C.g * 1.05 / Math.min(fw, C.g * 1.04) - 1)) / k;
    let grid = '<div class="hd"></div>' + RACKX.map((_, r) => `<div class="hd">Rack ${r + 1}</div>`).join('');
    for (let tier = VF.tiers - 1; tier >= 0; tier--) { grid += `<div class="hd">T${tier + 1}</div>`; for (let r = 0; r < VF.racks; r++) { const ti = VFS.tiers[r * VF.tiers + tier], bad = ti.health < 0.85 || ti.tip > 0.12 || (vfF.led && r === 3 && tier === 2); grid += `<div class="${bad ? 'bad' : ''}" style="background:rgba(63,207,142,${(0.08 + 0.4 * ti.fw / C.g).toFixed(2)})"><b>${Math.round(ti.fw)} g</b><small>${Math.max(0, tAt(C.g) - tAt(ti.fw)).toFixed(1)} d</small></div>`; } }
    el.innerHTML = `<h3>${esc(C.name)}</h3><p class="lead">${(VF.channels * VF.holes).toLocaleString('en-IN')} plants a tier; tiers are planted in turn so one is ready almost every day. Each cell shows head weight and days to harvest.</p>
      <div class="tgrid">${grid}</div>
      <table class="spec" style="margin-top:10px"><tr><td>Harvest weight</td><td>${C.g} g a plant after ${C.days} days</td></tr><tr><td>Yield at full rotation</td><td>${((VF.channels * VF.holes * C.g / 1000) * (365 / C.days) / (VF.len * VF.width)).toFixed(0)} kg/m²/yr a tier</td></tr><tr><td>Price (illustrative)</td><td>₹${C.price}/kg</td></tr><tr><td>Main disorder</td><td>${esc(C.disorder)}</td></tr></table>
      <h4>Harvest log</h4><ul class="log">${vlog.slice(0, 8).map((h) => `<li><em>${hhmm(h.t)} d${dayOf(h.t)}</em><span>Rack ${h.rack}, tier ${h.tier}: <b>${h.kg.toFixed(1)} kg</b>${h.tip > 0.1 ? ` <span class="warn">(${Math.round(h.tip * 100)}% tipburn)</span>` : ''}</span></li>`).join('') || '<li><em>—</em><span>No harvest yet today.</span></li>'}</ul>`;
  }
}

// ── economics ──
const eco = { ph: { area: 1000, struct: 1465, drip: 150, iot: 3.5, sub: 50, labour: 160, inputs: 260, film: 45 }, vf: { cap: 45000, labour: 30, inputs: 35, rent: 0 } };
function buildEco() {
  const el = $('#tab-eco'), E = eco[state.fac];
  const inp = (k, n, u, step = 1) => `<label class="field">${n}<input type="number" data-k="${k}" value="${E[k]}" step="${step}"/><small class="muted">${u}</small></label>`;
  el.innerHTML = state.fac === 'ph'
    ? `<h3>Polyhouse economics</h3><p class="muted">Illustrative figures. Unit costs, subsidy and prices vary by state and year; check current MIDH/NHM and state scheme norms.</p><div class="grid2">${inp('area', 'Area', 'm²', 100)}${inp('struct', 'Structure', '₹/m², NVPH + fan-and-pad', 5)}${inp('drip', 'Drip + fertigation', '₹/m²', 5)}${inp('iot', 'IoT + AI kit', '₹ lakh', 0.5)}${inp('sub', 'Subsidy on structure', '%', 5)}${inp('labour', 'Labour', '₹/m²/yr', 10)}${inp('inputs', 'Seed, fertiliser, crop care', '₹/m²/yr', 10)}${inp('film', 'Film renewal', '₹/m²/yr', 5)}</div><div id="ecoOut"></div>`
    : `<h3>Vertical-farm economics</h3><p class="muted">Illustrative figures. Energy per kg comes from the model; other costs are inputs.</p><div class="grid2">${inp('cap', 'Capex', '₹ per m² of growing area', 1000)}${inp('labour', 'Labour', '₹/kg', 1)}${inp('inputs', 'Seed, nutrients, packing', '₹/kg', 1)}${inp('rent', 'Rent', '₹ lakh/yr', 0.5)}</div><div id="ecoOut"></div>`;
  $$('#tab-eco input').forEach((i) => i.addEventListener('input', () => { E[i.dataset.k] = +i.value || 0; updateEco(); }));
  updateEco();
}
function updateEco() {
  const out = $('#ecoOut'); if (!out) return;
  const key = `${state.fac}|${state.season}|${state.fac === 'ph' ? state.phCrop : state.vfCrop}`, r = cmpCache[key];
  if (state.fac === 'ph') {
    const E = eco.ph, C = crop(), A = E.area, capex = A * (E.struct + E.drip) + E.iot * 1e5, sub = Math.min(A, 4000) * E.struct * E.sub / 100, net = capex - sub;
    const yieldKg = C.yield * A, rev = yieldKg * C.price, dayRun = r ? r.ai.cost : phCostTotal(PHS.acc) * (24 * 3600 / Math.max(3600, PHS.acc.n)), runYr = dayRun * 365 * (A / PH.area);
    const opex = A * (E.labour + E.inputs + E.film) + runYr, margin = rev - opex;
    const uplift = r ? (r.ai.net - r.rules.net) * 365 * (A / PH.area) : null;
    out.innerHTML = `<div class="kpis" style="margin-top:10px"><div><b>${fmtL(capex / 1e5)}</b><span>Capex</span></div><div><b>${fmtL(sub / 1e5)}</b><span>Subsidy</span></div><div><b>${fmtL(rev / 1e5)}</b><span>Revenue a year (${(yieldKg / 1000).toFixed(1)} t at ₹${C.price})</span></div><div><b>${fmtL(opex / 1e5)}</b><span>Operating cost a year</span></div><div class="big"><b>${fmtL(margin / 1e5)}</b><span>Margin a year · simple payback ${margin > 0 ? (net / margin).toFixed(1) : '—'} years on ${fmtL(net / 1e5)} net capex</span></div></div>
      <h4>Value of IoT + AI</h4>${uplift === null ? '<p class="muted">Run the 24-hour comparison on the AI tab to estimate it for this season and crop.</p><button class="btn" id="ecoRun">▶ Run comparison</button>' : `<p class="lead">On this season's weather the AI adds <b>${inr(uplift / 365)}</b> a day of net value (crop value of photosynthesis minus power and water) over the rules: about <b>${fmtL(uplift / 1e5)}</b> a year for ${A.toLocaleString('en-IN')} m². The ${fmtL(E.iot)} kit pays back in <b>${uplift > 0 ? (E.iot * 1e5 / uplift * 12).toFixed(1) : '—'} months</b> if every day were like this one.</p>`}`;
    const b = $('#ecoRun'); if (b) b.onclick = () => { out.innerHTML = '<p class="muted">Simulating…</p>'; setTimeout(() => { compute(key); updateEco(); renderCmp(); }, 30); };
  } else {
    const E = eco.vf, C = vcrop(), kgDay = (VF.channels * VF.holes * C.g / 1000) * (VF.racks * VF.tiers) / C.days, kgYr = kgDay * 365;
    const kwhkg = r ? r.ai.kwhkg : VFS.acc.kwh / Math.max(0.1, VFS.acc.growth), costDay = r ? r.ai.cost : VFS.acc.cost * (86400 / Math.max(3600, VFS.acc.n));
    const energyKg = costDay / Math.max(1, kgDay), perKg = energyKg + E.labour + E.inputs + (E.rent * 1e5) / kgYr, capex = E.cap * VF.area, margin = (C.price - perKg) * kgYr;
    out.innerHTML = `<div class="kpis" style="margin-top:10px"><div><b>${(kgYr / 1000).toFixed(1)} t</b><span>Yield a year</span></div><div><b>${kwhkg.toFixed(1)} kWh</b><span>per kg</span></div><div><b>₹${energyKg.toFixed(0)}</b><span>Energy + CO₂ per kg</span></div><div><b>₹${perKg.toFixed(0)}</b><span>Cash cost per kg</span></div><div><b>${fmtL(capex / 1e5)}</b><span>Capex for ${Math.round(VF.area)} m²</span></div><div><b>₹${C.price}</b><span>Price per kg</span></div><div class="big"><b>${fmtL(margin / 1e5)}</b><span>Margin a year · simple payback ${margin > 0 ? (capex / margin).toFixed(1) : '—'} years</span></div></div>
      <p class="legendnote">Water: about ${(Math.max(0, VFS.acc.water - VFS.acc.recov) / Math.max(0.1, VFS.acc.growth)).toFixed(1)} L per kg net today; the HVAC coil and dehumidifier recover transpired water back to the tank.</p>`;
  }
}

// ── HUD and strip ──
function hud() {
  const w = weather(state.season, state.t), S = SEASONS[state.season];
  if (state.fac === 'ph') {
    const C = crop(), band = w.G > 30 ? C.day : C.night, T = phFused.T, RH = phFused.RH, V = vpdOf(T, RH), cls = (v, a, b) => (v < a ? 'lo' : v > b ? 'hi' : 'ok');
    $('#hud').innerHTML = `<div class="hcard"><div class="day"><b>${hhmm(state.t)}</b><span>Day ${dayOf(state.t)} · ${S.icon} ${esc(S.name)}</span></div><span class="muted">Outside ${w.T.toFixed(1)} °C · RH ${Math.round(w.RH)}% · ${Math.round(w.G)} W/m² · wind ${w.wind.toFixed(1)} m/s${w.rain ? ' · rain' : ''}</span></div>
      <div class="kv"><span class="${cls(T, band[0], band[1])}">Inside <b>${T.toFixed(1)} °C</b></span><span>RH <b>${Math.round(RH)}%</b></span><span class="${cls(V, C.vpd[0], C.vpd[1])}">VPD <b>${V.toFixed(2)}</b></span><span>CO₂ <b>${Math.round(phMeas.C)}</b></span></div>`;
    const a = phA, m = state.mode === 'ai' && phF.gateway ? ['edge', 'Edge fallback · rules'] : [state.mode, { ai: 'AI · MPC', rules: 'Rules', manual: 'Manual' }[state.mode]];
    const why = state.mode === 'ai' && !phF.gateway && lastPlan ? lastPlan.why[0] : null;
    $('#strip').innerHTML = `<span class="mode ${m[0] === 'edge' ? 'edge' : ''}">${m[1]}</span><span class="${a.vent > 0.05 ? 'on' : ''}">Vents <b>${Math.round(a.vent * 100)}%</b></span><span class="${a.shade ? 'on' : ''}">Shade <b>${Math.round(a.shade * 100)}%</b></span><span class="${a.fans ? 'on' : ''}">Fans <b>${a.fans}/6</b></span><span class="${a.pad && a.fans ? 'on' : ''}">Pad <b>${a.pad && a.fans ? (phF.pad ? 'dry!' : 'wet') : 'off'}</b></span><span class="${a.fog ? 'on' : ''}">Fog <b>${Math.round(a.fog * 100)}%</b></span><span class="${a.drip.some(Boolean) ? 'on' : ''}">Drip <b>${a.drip.filter(Boolean).length}/12</b></span>${why ? `<span class="why">AI: ${esc({ fans: 'fans and pad', shade: 'shade screen', vent: 'vents', fog: 'fogging' }[why.k])} as set scores ${Math.round(why.gain)} points better over the next hour than the best plan that changes only that.</span>` : ''}`;
  } else {
    const C = vcrop(), cls = (v, a, b) => (v < a ? 'lo' : v > b ? 'hi' : 'ok');
    $('#hud').innerHTML = `<div class="hcard"><div class="day"><b>${hhmm(state.t)}</b><span>Day ${dayOf(state.t)} · ${vfA.light ? '💡 Lights on' : '🌙 Lights off'}</span></div><span class="muted">Outside ${w.T.toFixed(1)} °C · tariff ₹${TARIFF(((state.t % 24) + 24) % 24).toFixed(1)}/kWh · HVAC COP ${vfR.cop.toFixed(1)}</span></div>
      <div class="kv"><span class="${cls(VFS.T, C.temp[0] - 1, C.temp[1] + 1)}">Room <b>${VFS.T.toFixed(1)} °C</b></span><span class="${cls(vfR.rh, C.rh[0], C.rh[1])}">RH <b>${Math.round(vfR.rh)}%</b></span><span>CO₂ <b>${Math.round(VFS.C)}</b></span><span>Power <b>${vfR.kw.toFixed(0)} kW</b></span></div>`;
    const m = { ai: 'AI', rules: 'Rules', manual: 'Manual' }[state.mode];
    $('#strip').innerHTML = `<span class="mode">${m}</span><span class="${vfA.light ? 'on' : ''}">LEDs <b>${vfA.light ? `${Math.round(vfA.dim * 100)}%` : 'off'}</b></span><span>Window <b>${vfA.start !== null && vfA.start !== undefined ? `${hhmm(vfA.start)}–${hhmm(vfA.start + C.photo)}` : 'manual'}</b></span><span class="${vfR.Q > 1 ? 'on' : ''}">HVAC <b>${vfF.hvac ? 'tripped' : `${vfR.Q.toFixed(0)} kW cool`}</b></span><span class="${vfA.co2 ? 'on' : ''}">CO₂ <b>${vfA.co2 ? 'dosing' : 'off'}</b></span><span class="${vfA.dehum ? 'on' : ''}">Dehum <b>${vfA.dehum ? 'on' : 'off'}</b></span><span>Setpoint <b>${vfA.set.toFixed(1)} °C</b></span>`;
  }
}
function nodeLabels() {
  const show = state.layers.iot, net = state.fac === 'ph' ? phNet : vfNet;
  if (!show) return;
  for (const [id, n] of net.nodes) {
    if (state.fac === 'ph' && id.startsWith('SM') && state.cam !== 'iot' && state.cam !== 'inside') continue;
    net.posOf(n, tmpV); const p = tmpV.clone(); p.y += 0.35;
    let v = '';
    if (state.fac === 'ph') {
      if (id.startsWith('TH')) { const i = +id.slice(3) - 1; v = `${phMeas.T[i].toFixed(1)}° ${Math.round(phMeas.RH[i])}%`; }
      else if (id.startsWith('SM')) v = `${phMeas.theta[+id.slice(3) - 1].toFixed(0)}%`;
      else if (id === 'FERT') v = `EC ${phMeas.ec.toFixed(1)}`; else if (id === 'WS') v = `${weather(state.season, state.t).T.toFixed(1)}°`;
    } else if (id.startsWith('RK')) v = `${VFS.T.toFixed(1)}° ${Math.round(vfR.rh)}%`; else if (id === 'NUT') v = `EC ${VFS.ecRead.toFixed(2)}`; else if (id === 'HVAC') v = vfF.hvac ? 'TRIP' : `${vfR.Q.toFixed(0)} kW`;
    const alarm = (state.fac === 'ph' && id.startsWith('TH') && phMem.exclude?.[+id.slice(3) - 1]) || (state.fac === 'vf' && id === 'HVAC' && vfF.hvac);
    labels.set(`${state.fac}${id}`, p, `${esc(id)}${v ? ` <b>${v}</b>` : ''}`, `node ${id.startsWith('SM') ? 'sm' : ''} ${alarm ? 'alarm' : ''}`);
  }
  const g = net.gwTop.clone(); if (state.fac === 'ph') g.add(ph.group.position); g.y += 0.5;
  labels.set(`${state.fac}GW`, g, state.fac === 'ph' ? `Gateway <b>${phF.gateway ? 'offline' : 'LoRaWAN'}</b>` : 'Edge gateway <b>MQTT</b>', `node ${phF.gateway && state.fac === 'ph' ? 'alarm' : ''}`);
  if (state.fac === 'ph') detections.filter((d) => !d.treated).slice(0, 3).forEach((d, k) => { const p = phCropObj.plants[d.i]; labels.set(`det${k}`, V3(p.x, p.h + 0.75, p.z), `${esc(crop().disease)} <b>${d.conf.toFixed(2)}</b>`, 'det'); });
}

// ── UI wiring ──
$$('.tabs button').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; $$('.tabs button').forEach((x) => x.classList.toggle('active', x === b)); $$('.tab').forEach((t) => t.classList.toggle('show', t.id === `tab-${state.tab}`)); uiTick(true); }));
$('#play').onclick = () => { state.playing = !state.playing; $('#play').textContent = state.playing ? '❚❚' : '▶'; };
$$('#speeds button').forEach((b) => b.addEventListener('click', () => { state.speed = +b.dataset.s; $$('#speeds button').forEach((x) => x.classList.toggle('active', x === b)); }));
$$('#speeds button').forEach((x) => x.classList.toggle('active', +x.dataset.s === state.speed));
$$('#layers button').forEach((b) => b.addEventListener('click', () => { const l = b.dataset.l; state.layers[l] = !state.layers[l]; b.classList.toggle('active', state.layers[l]); applyLayers(); }));
function applyLayers() {
  phNet.group.visible = vfNet.group.visible = state.layers.iot;
  MAT.film.opacity = state.layers.cover ? 0.17 : 0.03; MAT.curtain.opacity = state.layers.cover ? 0.42 : 0.06;
  vfObj.group.children.slice(0, 3).forEach((m, i) => { if (i) m.visible = state.layers.cover; });
  $$('#layers button').forEach((b) => b.classList.toggle('active', !!state.layers[b.dataset.l]));
}

let uiT = 0, slowT = 0;
function uiTick(force = false) {
  hud();
  if (state.tab === 'dash') updateDash(); else if (state.tab === 'ctrl') updateCtrl(); else if (state.tab === 'ai') updateAI(); else if (state.tab === 'crop') renderCrop(); else if (state.tab === 'eco') updateEco();
  if (force) renderFaults();
}

// ── loop ──
function resize() { const v = $('.view'), w = v.clientWidth, h = v.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); $('#hud').style.top = `${$('.bar').offsetHeight + 18}px`; }
new ResizeObserver(resize).observe($('.view'));
const clock = new THREE.Clock(); let acc = 0, visT = 0, headT = 0;
const vis = {};
function loop() {
  const dt = Math.min(0.05, clock.getDelta());
  if (state.playing) { acc += dt * state.speed; let n = 0; while (acc >= 60 && n < 240) { tick(); acc -= 60; n++; } if (n >= 240) acc = 0; }
  const w = weather(state.season, state.t);
  if (state.fac === 'ph') {
    animatePH(ph.U, phA, w, dt, state.speed, vis, phF); scan(state.playing ? dt : 0);
    rain.visible = !!w.rain; if (rain.visible) { const p = rainGeo.attributes.position.array; for (let i = 0; i < p.length; i += 6) { p[i + 1] -= dt * 22; p[i + 4] -= dt * 22; if (p[i + 1] < 0) { p[i + 1] += 30; p[i + 4] += 30; } } rainGeo.attributes.position.needsUpdate = true; }
    phNet.update(dt);
  } else {
    animateVF(vfObj.U, { ...vfA, q: vfR.Q }, VFS, vcrop(), dt, vfF, state.speed);
    agvD += (state.mode === 'ai' ? 1.4 : 0) * dt * (state.speed >= 3600 ? 3 : 1); const p = agv.at(agvD); vfObj.U.agv.position.set(p.x, 0, p.z); vfObj.U.agv.rotation.y = p.h;
    vfNet.update(dt);
  }
  visT += dt; if (visT > 0.5) { visT = 0; if (state.fac === 'ph') { phCropObj.paint(PHS.theta); drawDetections(); } else vfObj.U.setHeads(VFS.tiers); sky(); }
  if (camAnim) { camAnim.u = Math.min(1, camAnim.u + dt * 1.3); const e = camAnim.u * camAnim.u * (3 - 2 * camAnim.u); camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (camAnim.u >= 1) camAnim = null; }
  else follow(dt);
  snap = false;
  uiT += dt; if (uiT > 0.4) { uiT = 0; uiTick(); }
  controls.update(); renderer.render(scene, camera);
  nodeLabels(); const v = $('.view'); labels.frame(v.clientWidth, v.clientHeight, state.layers.iot);
  requestAnimationFrame(loop);
}

// ── start ──
resize(); resetSim();
const tab0 = q.get('tab'); if (tab0) state.tab = tab0;
applyFacility(); applyLayers(); sky();
if (state.fac === 'ph') { phCropObj.paint(PHS.theta); } vfObj.U.setHeads(VFS.tiers);
const fq = (q.get('fault') || '').split(',').filter(Boolean); for (const f of fq) toggleFault(f);
if (q.get('cam')) setCam(q.get('cam'), true);
$$('.tabs button').find((b) => b.dataset.tab === state.tab)?.click();
loop();
setTimeout(() => $('#loader').classList.add('done'), 300);
window.__hg = {   // handle for automated browser tests
  state, tick, snap: () => { snap = true; if (camAnim) camAnim.u = 0.999; uiTick(true); },
  run: (min) => { for (let i = 0; i < min; i++) tick(); uiTick(true); }, toggleFault, setCam, compute: () => { const key = `${state.fac}|${state.season}|${state.fac === 'ph' ? state.phCrop : state.vfCrop}`; compute(key); renderCmp(); updateEco(); return cmpCache[key]; },
  get PHS() { return PHS; }, get VFS() { return VFS; }, get phA() { return phA; }, get vfA() { return vfA; }, get alerts() { return alerts; }, get detections() { return detections; }, get plan() { return lastPlan; }, get disease() { return disease; },
  scan: (dt) => scan(dt), phCrop: () => phCropObj, camera, controls, setFac: (f) => { state.fac = f; applyFacility(); }, setMode: (m) => { state.mode = m; renderLeft(); buildCtrl(); buildAI(); },
};
