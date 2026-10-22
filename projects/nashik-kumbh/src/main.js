import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { SCENARIOS, PLAN_DEFAULT, PLAN_GOOD, GHATS, BUDGET, COST, planCost, AMRIT_DATES, PROCESSION, NODES, HUBS, RIVER_PTS, SADHUGRAM, DIP_RATE } from './data.js';
import { Sim, CRIT, PER_VEHICLE, fmt } from './sim.js';
import { City } from './scene.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastT; function toast(m, ms = 2800) { const t = $('#toast'); t.innerHTML = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
const clone = (o) => JSON.parse(JSON.stringify(o));
const hh = (t) => { const h = Math.floor(t / 3600) % 24, m = Math.floor((t % 3600) / 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
const hash = (i) => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

// ── state from the URL ──
const q = new URLSearchParams(location.hash.slice(1));
const S = { sc: SCENARIOS[q.get('sc')] ? q.get('sc') : 'amrit', crowd: null, plan: clone(PLAN_DEFAULT), speed: +(q.get('speed') || 300), playing: true, heat: q.get('heat') !== '0', labels: true, ended: false };
S.crowd = +(q.get('crowd') || SCENARIOS[S.sc].crowd);
try { if (q.get('p')) Object.assign(S.plan, JSON.parse(decodeURIComponent(escape(atob(q.get('p').replace(/-/g, '+').replace(/_/g, '/')))))); } catch { /* ignore a bad link */ }

// ── renderer ──
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#d9d2c2', 0.00011);
const camera = new THREE.PerspectiveCamera(50, 1, 4, 50000);
const controls = new MapControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = 1.38; controls.minDistance = 25; controls.maxDistance = 18000; controls.zoomToCursor = true;
const sky = new Sky(); sky.scale.setScalar(45000); scene.add(sky);
sky.material.uniforms.turbidity.value = 7; sky.material.uniforms.rayleigh.value = 1.4; sky.material.uniforms.mieCoefficient.value = 0.006; sky.material.uniforms.mieDirectionalG.value = 0.8;
const hemi = new THREE.HemisphereLight('#e8eefc', '#6b6250', 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3df', 2.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -500, right: 500, top: 500, bottom: -500, near: 10, far: 4000 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
const aarti = new THREE.PointLight('#ff9a3c', 0, 260, 1.4); aarti.position.set(0, 12, -60); scene.add(aarti);

const city = new City(scene);
let sim = null;

// ── camera views ──
const VIEWS = {
  city: { t: [500, 0, 300], p: [1900, 6200, 7600], name: 'Whole city' },
  ramkund: { t: [20, 0, -60], p: [330, 210, 330], name: 'Ramkund' },
  panchavati: { t: [150, 0, -500], p: [1300, 900, 900], name: 'Panchavati & Kalaram' },
  tapovan: { t: [2300, 0, -700], p: [3300, 900, 600], name: 'Tapovan & Sadhugram' },
  dasak: { t: [4300, 0, 2300], p: [5300, 1100, 3600], name: 'Dasak & Nashik Road' },
  hubs: { t: [-3500, 0, 1500], p: [-1200, 2600, 4600], name: 'Mumbai Naka parking' },
};
let fly = null, follow = false;
function setView(k, instant) {
  const v = VIEWS[k]; follow = k === 'procession';
  if (follow) { toast('Following the akhara procession'); return; }
  const to = { t: new THREE.Vector3(...v.t), p: new THREE.Vector3(...v.p) };
  if (instant) { controls.target.copy(to.t); camera.position.copy(to.p); controls.update(); return; }
  fly = { from: { t: controls.target.clone(), p: camera.position.clone() }, to, u: 0 };
}

// ── simulation lifecycle ──
function restart(msg) {
  sim = new Sim(S.sc, S.plan, { crowd: S.crowd });
  city.build(sim);
  S.ended = false; $('#report').classList.remove('show');
  renderPlan(); renderPlaces(); updateHash();
  if (msg) toast(msg);
}
function updateHash() {
  const diff = {}; for (const k in S.plan) if (JSON.stringify(S.plan[k]) !== JSON.stringify(PLAN_DEFAULT[k])) diff[k] = S.plan[k];
  const p = Object.keys(diff).length ? btoa(unescape(encodeURIComponent(JSON.stringify(diff)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '';
  const u = new URLSearchParams({ sc: S.sc, crowd: S.crowd }); if (p) u.set('p', p);
  history.replaceState(null, '', `#${u}`);
}

// ── plan panel ──
const TOGGLES = [
  ['Crowd control', [
    ['oneWay', 'One-way circulation', 'Separate in and out routes around the ghats, so flows never meet head on.'],
    ['holding', 'Holding areas', 'Large pandals at transfer points; the control room meters people in and pauses shuttles when they fill.'],
    ['iccc', 'ICCC & CCTV', 'Integrated command centre: sends pilgrims to the ghat with the shortest wait and moves idle buses to the busiest hubs.'],
    ['footbridge', 'Widen Ramkund footbridge', 'The narrowest link into Ramkund.'],
    ['kalaram', 'Widen Kalaram Road', 'Main approach to Ramkund from Panchavati.'],
    ['tapovanBridge', 'Tapovan pontoon bridge', 'A floating bridge and south-bank road linking Dwarka to the Kapila sangam.'],
  ]],
  ['Transport', [
    ['carFree', 'Vehicle-free core', 'Private vehicles stop at the outer hubs; shuttles run at about 20 km/h instead of 11.'],
    ['hubPeth', 'Peth Road parking hub', 'Extra parking for 12,000 vehicles.'],
    ['hubGangapur', 'Gangapur Road parking hub', 'Extra parking for 12,000 vehicles.'],
    ['deolali', 'Deolali special trains', 'Splits rail pilgrims between Nashik Road and Deolali.'],
  ]],
  ['River and services', [
    ['someshwar', 'Open Someshwar ghat site', 'Upstream site with its own access from Gangapur Road. Add frontage below.'],
    ['release', 'Gangapur dam release', 'Keeps the Godavari flowing so the water at Ramkund stays cleaner.'],
  ]],
];
function renderPlan() {
  const P = S.plan, cost = planCost(P), pct = Math.min(100, (cost / BUDGET) * 100), over = cost > BUDGET;
  $('#budget').innerHTML = `<div class="bar ${over ? 'over' : ''}"><i style="width:${pct}%"></i></div><span>₹${Math.round(cost)} cr of ₹${BUDGET} cr${over ? ' — over budget' : ''}</span>`;
  $('#crowd').value = S.crowd; $('#crowd-v').textContent = `${S.crowd} lakh`;
  $('#buses').value = P.buses; $('#buses-v').textContent = `${P.buses.toLocaleString('en-IN')} e-buses`;
  $('#toilets').value = P.toilets; $('#toilets-v').textContent = P.toilets.toLocaleString('en-IN');
  $('#medical').value = P.medical; $('#medical-v').textContent = `${P.medical} posts`;
  $('#ghat-list').innerHTML = GHATS.map((g) => {
    const avail = !g.cand || P[g.cand], F = g.F + (P.ghats[g.id] || 0);
    return `<div class="ghat ${avail ? '' : 'off'}"><div><b>${esc(g.name)}</b><small>${esc(g.mr)} · ${F} m · ${fmt(F * DIP_RATE)}/h</small></div>
      <div class="pm"><button data-g="${g.id}" data-d="-50" ${!avail || !(P.ghats[g.id] > 0) ? 'disabled' : ''}>−</button><button data-g="${g.id}" data-d="50" ${!avail || F >= g.F + g.max ? 'disabled' : ''}>+50 m</button></div></div>`;
  }).join('');
  $('#toggles').innerHTML = TOGGLES.map(([title, items]) => `<h4>${title}</h4>` + items.map(([k, name, desc]) => `<label class="tog"><input type="checkbox" data-k="${k}" ${P[k] ? 'checked' : ''}/><span><b>${esc(name)}</b><small>${esc(desc)}</small></span><em>${COST[k] ? `₹${COST[k]} cr` : ''}</em></label>`).join('')).join('');
  document.querySelectorAll('[data-sc]').forEach((b) => b.classList.toggle('active', b.dataset.sc === S.sc));
}
let planT;
function planChanged(msg = 'Plan updated — the day restarts from midnight') { clearTimeout(planT); renderPlan(); planT = setTimeout(() => restart(msg), 450); }
$('#ghat-list').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; const g = GHATS.find((x) => x.id === b.dataset.g); S.plan.ghats[g.id] = Math.max(0, Math.min(g.max, (S.plan.ghats[g.id] || 0) + +b.dataset.d)); planChanged(); });
$('#toggles').addEventListener('change', (e) => { const k = e.target.dataset.k; if (!k) return; S.plan[k] = e.target.checked; planChanged(); });
for (const [id, k] of [['buses', 'buses'], ['toilets', 'toilets'], ['medical', 'medical']]) $(`#${id}`).addEventListener('input', (e) => { S.plan[k] = +e.target.value; planChanged(); });
$('#crowd').addEventListener('input', (e) => { S.crowd = +e.target.value; planChanged('Crowd size changed — the day restarts'); });
document.querySelectorAll('[data-sc]').forEach((b) => b.addEventListener('click', () => { S.sc = b.dataset.sc; S.crowd = SCENARIOS[S.sc].crowd; restart(`${SCENARIOS[S.sc].name}: ${SCENARIOS[S.sc].desc}`); }));
$('#suggest').addEventListener('click', () => { S.plan = clone(PLAN_GOOD); restart('Loaded a strong plan for the Amrit Snan. Try switching single measures off to see what each one does.'); });
$('#minimal').addEventListener('click', () => { S.plan = clone(PLAN_DEFAULT); restart('Back to the minimal plan'); });

// ── tabs, views and controls ──
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b)); document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('show', t.id === `tab-${b.dataset.tab}`)); }));
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => { S.speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('active', x === b)); }));
$('#play').addEventListener('click', () => { S.playing = !S.playing; $('#play').textContent = S.playing ? '❚❚' : '▶'; });
$('#heat').addEventListener('click', (e) => { S.heat = !S.heat; e.currentTarget.classList.toggle('active', S.heat); });
$('#lbl').addEventListener('click', (e) => { S.labels = !S.labels; e.currentTarget.classList.toggle('active', S.labels); $('#labels').style.display = S.labels ? '' : 'none'; });
$('#restart').addEventListener('click', () => restart('Day restarted'));
$('#skip').addEventListener('click', skipToEnd);
$('#panel-toggle').addEventListener('click', () => $('#app').classList.toggle('collapsed'));
$('#report-close').addEventListener('click', () => $('#report').classList.remove('show'));
$('#report-plan').addEventListener('click', () => { $('#report').classList.remove('show'); document.querySelector('[data-tab="plan"]').click(); });
$('#places').addEventListener('click', (e) => { const b = e.target.closest('[data-fly]'); if (!b) return; const [x, z, d] = b.dataset.fly.split(',').map(Number); fly = { from: { t: controls.target.clone(), p: camera.position.clone() }, to: { t: new THREE.Vector3(x, 0, z), p: new THREE.Vector3(x + d * 0.6, d * 0.55, z + d) }, u: 0 }; });
window.addEventListener('keydown', (e) => { if (e.target.closest('input')) return; if (e.key === ' ') { e.preventDefault(); $('#play').click(); } const v = ['city', 'ramkund', 'panchavati', 'tapovan', 'dasak', 'hubs'][+e.key - 1]; if (v) setView(v); });

async function skipToEnd() {
  if (S.ended) return;
  $('#busy').classList.add('show');
  while (sim.t < sim.end) {
    const t0 = performance.now(); while (sim.t < sim.end && performance.now() - t0 < 60) sim.step();
    $('#busy-v').textContent = `Simulating… ${hh(sim.t)}`; await new Promise((r) => setTimeout(r, 0));
  }
  $('#busy').classList.remove('show');
}

// ── HUD, KPIs, places, charts ──
const densCol = (r) => (r >= CRIT ? '#ff4d4d' : r >= 2.5 ? '#ff9f43' : r >= 1.2 ? '#ffd23f' : '#3fcf8e');
function hud() {
  const K = sim.kpis(), sc = SCENARIOS[S.sc];
  $('#clock').innerHTML = `<b>${hh(sim.t)}</b><small>${esc(sc.name)}${sc.amrit ? ` · ${AMRIT_DATES[2]}` : ''}</small>`;
  const proc = sim.closureAt(sim.t);
  $('#status').innerHTML = proc ? `<span class="pill sac">🚩 Amrit Snan of the akharas — Ramkund reserved until 09:30</span>` : sim.t > 18.5 * 3600 && sim.t < 21.5 * 3600 ? `<span class="pill aarti">🪔 Godavari maha aarti at Ramkund</span>` : '';
  const tile = (label, val, sub, col) => `<div class="kpi"><small>${label}</small><b ${col ? `style="color:${col}"` : ''}>${val}</b><i>${sub}</i></div>`;
  $('#kpis').innerHTML = tile('In the mela area', fmt(K.present), `${fmt(K.arrived)} arrived today`)
    + tile('Holy dips', fmt(K.dips), K.arrived ? `${Math.round((K.dips / K.arrived) * 100)}% of arrivals` : '—')
    + tile('Peak density', `${K.maxRho.toFixed(1)}<span>/m²</span>`, `${Math.round(K.critMin)} critical min today`, densCol(K.maxRho))
    + tile('Wait for shuttle', `${Math.round(K.busWait)}<span> min</span>`, K.highway > 0 ? `${fmt(K.highway)} stuck on highways` : `${fmt(sim.convoys.reduce((a, c) => a + (c.tp ? c.k : 0), 0))} buses on the road`)
    + tile('Ghat queue', `${Math.round(K.ghatWait)}<span> min</span>`, `ghats bathe ${fmt(K.dipCap)}/h`)
    + tile('Satisfaction', `${Math.round(K.sat)}`, `water ${Math.round(K.water)}/100 · sanitation ${Math.round(K.sanitation * 100)}%`, K.sat >= 70 ? '#3fcf8e' : K.sat >= 50 ? '#ffd23f' : '#ff6b5b');
  $('#pos').style.width = `${(sim.t / sim.end) * 100}%`;
}
function renderPlaces() {
  if (!sim) return;
  const g = Object.values(sim.ghats).map((x) => `<button data-fly="${NODES[x.id].x},${NODES[x.id].z},${Math.max(220, x.F * 1.4)}"><b>${esc(x.name)}</b><span>${x.F} m · ${fmt(x.served)} bathed · queue ${Math.round((x.qPeople / x.cap) * 60)} min</span><i style="background:${densCol(x.rho)}"></i></button>`).join('');
  const t = sim.tps.map((k) => { const n = sim.nodes[k]; return `<button data-fly="${n.x},${n.z},420"><b>${esc(n.name)}</b><span>${fmt(n.wait || 0)} waiting · ${fmt(n.retPeople)} for the bus back</span><i style="background:${densCol(n.rho)}"></i></button>`; }).join('');
  const h = Object.values(sim.hubs).map((x) => `<button data-fly="${x.x},${x.z},900"><b>${esc(x.name)}</b><span>${x.rail ? 'station' : `parking ${Math.round((x.occ / (x.cap * PER_VEHICLE)) * 100)}%`} · ${x.buses} buses · queue ${fmt(x.qPeople)}${x.highwayPeople ? ` · ${fmt(x.highwayPeople)} on highway` : ''}</span><i style="background:${x.highwayPeople ? '#ff6b5b' : x.qPeople > 20000 ? '#ff9f43' : '#3fcf8e'}"></i></button>`).join('');
  $('#places').innerHTML = `<h4>Ghats</h4>${g}<h4>Transfer points</h4>${t}<h4>Parking hubs & stations</h4>${h}`;
}
function renderLive() {
  const ins = sim.insights();
  $('#insights').innerHTML = ins.map((i) => `<li class="${i.lvl}">${esc(i.txt)}</li>`).join('') || '<li>Advice appears as the day unfolds.</li>';
  $('#alerts').innerHTML = sim.alerts.slice(-40).reverse().map((a) => `<li><b>${hh(a.t)}</b> ${esc(a.name)} <em style="color:${densCol(a.rho)}">${a.rho.toFixed(1)}/m²</em></li>`).join('') || '<li class="muted">No critical crowding yet.</li>';
  drawChart();
}
function drawChart() {
  const c = $('#chart'), g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const hrs = sim.H.slice(0, 24), now = Math.floor(sim.t / 3600);
  const max = Math.max(1, ...hrs.map((h) => Math.max(h.arr, h.dips)));
  const pm = Math.max(1, ...hrs.map((h) => (h.samples ? h.present / h.samples : 0)));
  const bw = W / 24;
  g.strokeStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, H - 14 - i * (H - 24) / 4); g.lineTo(W, H - 14 - i * (H - 24) / 4); g.stroke(); }
  hrs.forEach((h, i) => { if (i > now) return; const y = (h.arr / max) * (H - 24); g.fillStyle = 'rgba(255,159,67,.75)'; g.fillRect(i * bw + 1, H - 14 - y, bw * 0.45, y); const y2 = (h.dips / max) * (H - 24); g.fillStyle = 'rgba(65,182,255,.85)'; g.fillRect(i * bw + bw * 0.48, H - 14 - y2, bw * 0.45, y2); });
  g.beginPath(); let st = false; hrs.forEach((h, i) => { if (i > now || !h.samples) return; const y = H - 14 - (h.present / h.samples / pm) * (H - 24); if (!st) { g.moveTo(i * bw + bw / 2, y); st = true; } else g.lineTo(i * bw + bw / 2, y); }); g.strokeStyle = '#e8e2d6'; g.lineWidth = 2; g.stroke(); g.lineWidth = 1;
  hrs.forEach((h, i) => { if (i <= now && h.crit > 0) { g.fillStyle = '#ff4d4d'; g.fillRect(i * bw + 2, H - 8, bw - 4, 4); } });
  g.fillStyle = '#9d958a'; g.font = '10px Inter, sans-serif'; for (let i = 0; i < 24; i += 3) g.fillText(String(i).padStart(2, '0'), i * bw + 2, H - 1);
  $('#chart-legend').innerHTML = `<span><i style="background:#ff9f43"></i>arrivals/h (max ${fmt(max)})</span><span><i style="background:#41b6ff"></i>holy dips/h</span><span><i style="background:#e8e2d6"></i>people in the mela area (max ${fmt(pm)})</span><span><i style="background:#ff4d4d"></i>critical crowding</span>`;
}
function report() {
  const K = sim.kpis(), cost = planCost(S.plan);
  const bathed = K.arrived ? K.dips / K.arrived : 0, safety = Math.max(0, 1 - K.critMin / 3000), budget = cost <= BUDGET ? 1 : Math.max(0, 1 - (cost - BUDGET) / BUDGET);
  const score = Math.round(100 * (0.4 * bathed + 0.3 * safety + 0.2 * (K.sat / 100) + 0.1 * budget));
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'E';
  $('#report-body').innerHTML = `<div class="grade g${grade}">${grade}<small>${score}/100</small></div>
    <div class="rk"><div><b>${fmt(K.dips)}</b><small>holy dips (${Math.round(bathed * 100)}% of ${fmt(K.arrived)})</small></div>
    <div><b style="color:${densCol(K.critMin > 60 ? 5 : K.critMin > 0 ? 3 : 0)}">${Math.round(K.critMin)} min</b><small>critical crowding (${sim.alerts.length} alerts)</small></div>
    <div><b>${Math.round(K.journey)} min</b><small>average visit, parking to parking</small></div>
    <div><b>${Math.round(K.sat)}</b><small>pilgrim satisfaction</small></div>
    <div><b>₹${Math.round(cost)} cr</b><small>plan cost (budget ₹${BUDGET} cr)</small></div>
    <div><b>${Math.round(K.health)}</b><small>cases at medical posts · response ${Math.round(K.medical)} min</small></div></div>
    <h4>What to improve</h4><ul class="ins">${sim.insights().map((i) => `<li class="${i.lvl}">${esc(i.txt)}</li>`).join('')}</ul>
    <p class="muted">Score = 40% pilgrims bathed, 30% safety (critical crowding), 20% satisfaction, 10% staying within budget.</p>`;
  $('#report').classList.add('show');
}

// ── labels ──
const LABELS = [];
function makeLabels() {
  const add = (key, x, z, y, cls, html, minD = 0, maxD = 4000) => { const el = document.createElement('div'); el.className = `lbl ${cls}`; el.innerHTML = html; $('#labels').appendChild(el); LABELS.push({ key, v: new THREE.Vector3(x, y, z), el, minD, maxD }); };
  for (const g of [...GHATS].sort((a, b) => (b.id === 'G_RAM') - (a.id === 'G_RAM'))) { const n = NODES[g.id]; add(g.id, n.x, n.z, 14, 'ghat', `<b>${esc(g.mr)}</b><span>${esc(g.name)}</span><em></em>`, 0, g.sacred ? 2600 : 5200); }
  for (const k of ['TP_W', 'TP_N', 'TP_T', 'TP_D', 'TP_R']) { const n = NODES[k]; add(k, n.x, n.z, 16, 'tp', `<b>${esc(n.name)}</b><em></em>`, 0, 7000); }
  for (const [k, h] of Object.entries(HUBS)) add(k, h.x, h.z, 18, 'hub', `<b>🅿 ${esc(h.name)}</b><span>${esc(h.sub)}</span><em></em>`, 0, 16000);
  add('kal', NODES.J_KAL.x + 40, NODES.J_KAL.z - 40, 40, 'lm', '<b>काळाराम मंदिर</b><span>Kalaram temple</span>', 0, 2600);
  add('sadhu', (SADHUGRAM.x0 + SADHUGRAM.x1) / 2 + 250, SADHUGRAM.z0 + 250, 30, 'lm', '<b>साधुग्राम</b><span>Sadhugram (akhara camps)</span>', 300, 9000);
  add('iccc', 1450, 1250, 34, 'lm', '<b>ICCC</b><span>Command & control</span>', 0, 5000);
  add('god', -2600, -700, 10, 'river', '<b>गोदावरी</b><span>Godavari</span>', 1500, 16000);
}
const _v = new THREE.Vector3();
function updateLabels() {
  if (!S.labels) return;
  const w = canvas.clientWidth, h = canvas.clientHeight, placed = [];
  for (const L of LABELS) {
    _v.copy(L.v).project(camera);
    const d = camera.position.distanceTo(L.v);
    const hub = sim.hubs[L.key], ghat = sim.ghats[L.key];
    const show = _v.z < 1 && d > L.minD && d < L.maxD && (L.key.startsWith('H_') ? !!hub : L.key.startsWith('G_') ? !!ghat : L.key === 'iccc' ? S.plan.iccc : true);
    const sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * h;
    // skip labels that would overlap one already placed (earlier labels have priority)
    const bw = (L.bw ||= L.el.offsetWidth || 160), bh = (L.bh ||= L.el.offsetHeight || 34);
    const box = [sx - bw / 2, sy - bh, sx + bw / 2, sy];
    const clash = show && placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
    L.el.style.display = show && !clash ? '' : 'none'; if (!show || clash) continue;
    placed.push(box);
    L.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
    const em = L.el.querySelector('em');
    if (em && ghat) em.innerHTML = sim.ghatClosed(L.key, sim.t) ? 'reserved for akharas' : `${Math.round(ghat.qPeople / ghat.cap * 60)} min queue · <i style="color:${densCol(ghat.rho)}">${ghat.rho.toFixed(1)}/m²</i>`;
    else if (em && hub) em.textContent = hub.rail ? `${fmt(hub.qPeople)} waiting for shuttles` : `${Math.round(hub.occ / (hub.cap * PER_VEHICLE) * 100)}% full${hub.qPeople ? ` · ${fmt(hub.qPeople)} queueing` : ''}`;
    else if (em && sim.nodes[L.key]) { const n = sim.nodes[L.key]; em.innerHTML = `${fmt((n.wait || 0) + n.retPeople)} waiting · <i style="color:${densCol(n.rho)}">${n.rho.toFixed(1)}/m²</i>`; }
  }
}

// ── crowds and vehicles ──
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
function put(mesh, i, x, y, z, yaw = 0, s = 1) { Q.setFromAxisAngle(UP, yaw); V.set(x, y, z); SC.set(s, s, s); M4.compose(V, Q, SC); mesh.setMatrixAt(i, M4); }
function spiral(j, r0, step) { const a = j * 2.39996, r = r0 + Math.sqrt(j) * step; return [Math.cos(a) * r, Math.sin(a) * r]; }
function drawCrowds() {
  const P = city.people, t = sim.t;
  // index waiting groups at gates and queues
  for (const k in sim.gates) sim.gates[k].list.forEach((G, j) => { G._slot = j; });
  for (const id in sim.ghats) sim.ghats[id].queue.forEach((G, j) => { G._slot = j; });
  sim.temple.queue.forEach((G, j) => { G._slot = j; });
  for (const tp of sim.tps) { let j = 0; for (const h in sim.nodes[tp].ret) for (const G of sim.nodes[tp].ret[h]) G._slot = j++; }
  for (const id in sim.hubs) sim.hubs[id].q.forEach((G, j) => { G._slot = j; });
  const vis = [];
  for (let i = 0; i < sim.next; i++) { const G = sim.groups[i]; if (G.state !== 'done' && G.state !== 'ride' && G.state !== 'rideback' && G.state !== 'highway' && G.state !== 'detour') vis.push(G); }
  const k = Math.max(1, Math.min(10, Math.floor(60000 / Math.max(1, vis.length)))) ;
  let n = 0;
  for (const G of vis) {
    for (let f = 0; f < k && n < P.instanceMatrix.count - 2500; f++) {
      const h1 = hash(G.id * 31 + f), h2 = hash(G.id * 57 + f * 7 + 3);
      let x, z, y = 0.15, yaw = h1 * 6.28;
      if (G.state === 'walk') {
        const s = G.path[G.pi], l = s.l, A = sim.nodes[s.dir === 1 ? l.a : l.b], B = sim.nodes[s.dir === 1 ? l.b : l.a];
        const lm = city.linkMeshes[l.id], w = lm ? lm.w : 8, gl = Math.min(l.L * 0.9, Math.max(6, G.people / (w * Math.max(0.7, l.rho))));
        const u = Math.max(0, Math.min(l.L, G.pos - (f / k) * gl - h2 * gl / k)) / l.L;
        const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz) || 1, lat = (h1 - 0.5) * w * 0.9;
        x = A.x + dx * u - (dz / L) * lat; z = A.z + dz * u + (dx / L) * lat; yaw = Math.atan2(dx, dz);
        if (lm?.deck) { const ua = A.id === lm.deck[2] ? u : 1 - u; if (ua >= lm.deck[0] && ua <= lm.deck[1]) y = l.ex.pontoon ? 0.8 : 2.75; }
      } else if (G.state === 'enter') {
        const nd = G.gate.node, [ox, oz] = spiral(G._slot || 0, nd.kind === 'tp' ? 30 : 10, nd.kind === 'tp' ? 7 : 4);
        x = nd.x + ox + (h1 - 0.5) * 6; z = nd.z + oz + (h2 - 0.5) * 6;
      } else if (G.state === 'ghatq' || G.state === 'dip') {
        const g = sim.ghats[G.ghat], fr = g.frame; if (!fr) continue;
        let ax, lz;
        if (G.state === 'dip') { ax = (hash(G.id) - 0.5) * g.F * 0.95 + (h1 - 0.5) * 6; lz = -1 - h2 * 5; y = -0.4; }
        else { const cols = Math.max(1, Math.floor(g.F / 14)), j = G._slot || 0, col = j % cols, row = Math.floor(j / cols); ax = -g.F / 2 + (col + h1) * g.F / cols; lz = 15 + row * 5 + h2 * 5; y = 2.6; }
        x = fr.x + fr.ax * ax + fr.lx * lz; z = fr.z + fr.az * ax + fr.lz * lz;
      } else if (G.state === 'templeq' || G.state === 'darshan') {
        const [ox, oz] = spiral(G._slot || 0, 20, 4); x = NODES.J_KAL.x + 40 + ox + (h1 - 0.5) * 5; z = NODES.J_KAL.z + 60 + oz + (h2 - 0.5) * 5;
        if (G.state === 'darshan') { x = NODES.J_KAL.x + 40 + (h1 - 0.5) * 70; z = NODES.J_KAL.z - 30 + (h2 - 0.5) * 70; }
      } else if (G.state === 'tpq') {
        const nd = sim.nodes[G.tp], [ox, oz] = spiral(G._slot || 0, 25, 6); x = nd.x - ox + (h1 - 0.5) * 6; z = nd.z - oz + (h2 - 0.5) * 6;
      } else if (G.state === 'hubq') {
        const H = sim.hubs[G.hub], j = G._slot || 0; x = H.x - 200 + (j % 40) * 10 + h1 * 8; z = H.z + 150 + Math.floor(j / 40) * 8 + h2 * 6;
      } else if (G.state === 'roadwalk' && G.rw) {
        const r = sim.routes[`${G.rw.from}>${G.rw.to}`]; if (!r) continue;
        const u = 1 - G.timer / G.rw.T, p = alongPoly(r.poly, u - f * 0.002); x = p.x + (h1 - 0.5) * 12; z = p.z + (h2 - 0.5) * 12; yaw = p.h;
      } else continue;
      put(P, n++, x, y, z, yaw);
    }
  }
  // the procession: sadhus marching with the chariots
  n = drawProcession(n);
  P.count = n; P.instanceMatrix.needsUpdate = true;
  // shuttle buses
  const B = city.buses; let b = 0;
  for (const c of sim.convoys) {
    if (!c.tp) continue; const r = sim.routes[`${c.hub}>${c.tp}`]; if (!r) continue;
    let u = (t - c.t0) / Math.max(1, c.t1 - c.t0); if (c.dir === -1) u = 1 - u;
    const L = polyLen(r.poly), nb = Math.min(c.k, 3);
    for (let i = 0; i < nb && b < 1800; i++) { const p = alongPoly(r.poly, u - (c.dir === 1 ? 1 : -1) * (i * 16) / L); const lane = c.dir === 1 ? -3.5 : 3.5; put(B, b++, p.x - Math.sin(p.h) * lane, 0.12, p.z + Math.cos(p.h) * lane, -p.h); }
  }
  B.count = b; B.instanceMatrix.needsUpdate = true;
  // parked vehicles and highway queues
  const C = city.cars; let c2 = 0;
  for (const id in sim.hubs) {
    const H = sim.hubs[id]; if (H.rail) continue;
    const fill = Math.min(1, H.occ / (H.cap * PER_VEHICLE)), nCars = Math.round(fill * 1100);
    for (let i = 0; i < nCars && c2 < 9000; i++) { const col = i % 50, row = Math.floor(i / 50); put(C, c2++, H.x - 190 + col * 7.6, 0.1, H.z - 130 + row * 6.2, Math.PI / 2); }
    const nq = Math.min(700, Math.round(H.highwayPeople / PER_VEHICLE / 6));
    if (nq) { const dx = H.x - 500, dz = H.z - 300, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L; for (let i = 0; i < nq && c2 < 9000; i++) { const lane = (i % 2) * 3.5 - 1.75, s = 240 + Math.floor(i / 2) * 7; put(C, c2++, H.x + ux * s - uz * lane, 0.12, H.z + uz * s + ux * lane, Math.atan2(ux, uz) + Math.PI / 2); } }
  }
  C.count = c2; C.instanceMatrix.needsUpdate = true;
}
function polyLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
function alongPoly(p, u) {
  const L = polyLen(p); let s = Math.max(0, Math.min(1, u)) * L;
  for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (s <= d || i === p.length - 1) { const t = Math.min(1, s / (d || 1)); const h = Math.atan2(p[i][1] - p[i - 1][1], p[i][0] - p[i - 1][0]); return { x: p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, z: p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t, h }; } s -= d; }
  return { x: p.at(-1)[0], z: p.at(-1)[1], h: 0 };
}
/** The three Vaishnav akharas process from Tapovan to Ramkund at dawn and bathe there. */
function drawProcession(n) {
  const P = city.people, pr = city.procession, hr = sim.t / 3600, sc = SCENARIOS[S.sc];
  const on = sc.amrit && hr >= PROCESSION.march && hr < 10.5;
  pr.g.visible = on; if (!on) return n;
  const path = city.procPath(), L = path.L;
  let head;   // distance of the procession's head along the route
  if (hr < PROCESSION.bath[0]) head = ((hr - PROCESSION.march) / (PROCESSION.bath[0] - PROCESSION.march)) * L;
  else if (hr < PROCESSION.bath[1]) head = L;
  else head = L - ((hr - PROCESSION.bath[1]) / (10.5 - PROCESSION.bath[1])) * L * 1.4;
  const bathing = hr >= PROCESSION.bath[0] && hr < PROCESSION.bath[1];
  pr.raths.forEach((r, i) => { const s = head - 60 - i * 70, p = city.procAt(s); r.visible = s > 0 && !bathing; r.position.set(p.x, 0.2, p.z); r.rotation.y = -p.h; });
  const g = sim.ghats.G_RAM;
  for (let i = 0; i < 2400 && n < P.instanceMatrix.count; i++) {
    const h1 = hash(i * 13 + 5), h2 = hash(i * 7 + 11);
    if (bathing && g?.frame) { const fr = g.frame, ax = (h1 - 0.5) * g.F * 1.1, lz = -2 + h2 * 30 - (i % 3 === 0 ? 8 : 0); put(P, n++, fr.x + fr.ax * ax + fr.lx * lz, lz < 0 ? -0.4 : 2.6, fr.z + fr.az * ax + fr.lz * lz, h1 * 6); continue; }
    const s = head - (i / 2400) * 700 - h2 * 6, p = city.procAt(s); if (s < 0) continue;
    const lat = ((i % 8) - 3.5) * 1.3; put(P, n++, p.x - Math.sin(p.h) * lat, 0.15, p.z + Math.cos(p.h) * lat, -p.h + Math.PI / 2);
  }
  return n;
}
const sIdxRamkund = (() => { let b = 0; RIVER_PTS.forEach((p, i) => { if (Math.hypot(p.x, p.z + 40) < Math.hypot(RIVER_PTS[b].x, RIVER_PTS[b].z + 40)) b = i; }); return b; })();
function drawDiyas() {
  const D = city.diyas, hr = sim.t / 3600, on = hr > 18.6 && hr < 22.5;
  if (!on) { D.count = 0; aarti.intensity = 0; return; }
  const age = (hr - 18.6) * 3600, k = Math.min(D.instanceMatrix.count, Math.floor(age / 8));
  let n = 0;
  for (let i = 0; i < k; i++) {
    const sd = city.diyaSeed[i], tLaunch = i * 8, travel = (age - tLaunch) * 0.35;   // drifting downstream at ~0.35 m/s
    const idx = Math.min(RIVER_PTS.length - 1, sIdxRamkund + Math.floor(travel / 10)); const p = RIVER_PTS[idx]; if (travel > 2400) continue;
    put(D, n++, p.x + p.nx * sd.off, 0.4, p.z + p.nz * sd.off);
  }
  D.count = n; D.instanceMatrix.needsUpdate = true;
  aarti.intensity = hr < 19.6 ? 900 : 300;
}
function updateLinks() {
  for (const l of sim.links) {
    const lm = city.linkMeshes[l.id]; if (!lm) continue;
    if (l.closed) lm.m.color.set('#8c8c8c'); else if (S.heat) lm.m.color.set(densCol(l.rho)); else lm.m.color.set('#ffffff');
  }
}

// ── sky and light by the clock ──
function updateSky() {
  const h = (sim.t / 3600) % 24, dayT = (h - 6.1) / 12.6;
  const elev = Math.sin(dayT * Math.PI) * 68, az = 90 + dayT * 180;
  const sv = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(az));
  sky.material.uniforms.sunPosition.value.copy(sv);
  const tgt = controls.target;
  sun.position.set(tgt.x + sv.x * 1500, Math.max(80, sv.y * 1500), tgt.z + sv.z * 1500); sun.target.position.copy(tgt);
  const span = Math.min(900, Math.max(150, camera.position.distanceTo(tgt) * 0.8)); Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span }); sun.shadow.camera.updateProjectionMatrix();
  const day = THREE.MathUtils.clamp((elev + 6) / 18, 0, 1);
  sun.intensity = day * 2.4; hemi.intensity = 0.25 + day * 0.7; hemi.color.set(day < 0.3 ? '#7f93c8' : '#e8eefc');
  sun.color.set(elev < 12 ? '#ffb27a' : '#fff3df');
  const fog = new THREE.Color('#d9d2c2').multiplyScalar(0.12 + 0.88 * day); if (elev < 10 && elev > -6) fog.lerp(new THREE.Color('#e7a76a'), 0.3 * day);
  scene.fog.color.copy(fog); scene.fog.density = (h > 4 && h < 8.5 ? 0.00016 : 0.0001) * Math.min(1, 2200 / Math.max(300, camera.position.distanceTo(controls.target)));   // dawn haze from wood fires and river mist; thinner from high up
  if (city.buildMat) city.buildMat.emissiveIntensity = day < 0.35 ? 0.9 * (1 - day) : 0;
  sky.position.copy(camera.position);
}

// ── loop ──
function resize() { const r = canvas.parentElement.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(canvas.parentElement);
let last = performance.now(), slow = 0, slowL = 0;
function frame(now) {
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  if (S.playing && !S.ended) {
    const steps = (S.speed * real) / sim.dt; sim._acc = (sim._acc || 0) + steps;
    const t0 = performance.now();
    while (sim._acc >= 1 && sim.t < sim.end && performance.now() - t0 < 30) { sim.step(); sim._acc--; }
    if (sim._acc > 50) sim._acc = 50;
  }
  if (!S.ended && sim.t >= sim.end) { S.ended = true; report(); }
  if (fly) { fly.u = Math.min(1, fly.u + real / 1.4); const e = fly.u < 0.5 ? 2 * fly.u * fly.u : 1 - Math.pow(-2 * fly.u + 2, 2) / 2; controls.target.lerpVectors(fly.from.t, fly.to.t, e); camera.position.lerpVectors(fly.from.p, fly.to.p, e); if (fly.u >= 1) fly = null; }
  if (follow && city.procession.g.visible) { const r = city.procession.raths[0]; const tgt = r.visible ? r.position : city.procAt(1e9); const p = new THREE.Vector3(tgt.x, 0, tgt.z); controls.target.lerp(p, 0.05); camera.position.lerp(new THREE.Vector3(p.x + 120, 90, p.z + 140), 0.03); }
  controls.update();
  { const d = camera.position.distanceTo(controls.target), nr = Math.min(80, Math.max(1, d * 0.012)); if (Math.abs(nr - camera.near) > camera.near * 0.2) { camera.near = nr; camera.updateProjectionMatrix(); } }
  drawCrowds(); drawDiyas(); updateSky();
  city.waterTex.offset.y -= real * 0.02;
  if (city.flags) for (const f of city.flags) f.rotation.y = Math.sin(now / 400 + f.id) * 0.25;
  slow += real; if (slow > 0.25) { slow = 0; hud(); updateLinks(); }
  slowL += real; if (slowL > 1.2) { slowL = 0; renderPlaces(); renderLive(); }
  updateLabels();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ── boot ──
document.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('active', +x.dataset.speed === S.speed));
$('#heat').classList.toggle('active', S.heat); $('#lbl').classList.add('active');
makeLabels(); restart(); setView(q.get('view') || 'city', true); resize();
if (q.has('t')) sim.run(+q.get('t') * 3600);
requestAnimationFrame(frame);
setTimeout(() => $('#loader').classList.add('done'), 300);
window.__kumbh = { S, sim: () => sim, camera, controls, setView, city, renderer, scene, drawCrowds, updateLabels, hud };   // handle for automated browser tests
