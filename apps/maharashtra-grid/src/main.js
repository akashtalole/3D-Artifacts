/**
 * Urja Maharashtra: the state's power system from Mahagenco's plants through Mahapareshan's
 * EHV network to Mahavitaran's consumers, dispatched every 15 minutes.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PLANTS, BUSES, ZONES, SEASONS, SCENARIOS, OWNERS, TYPES, HVDC, IMPORTS, NEIGHBOURS, XY, fmtMW, inr, crore } from './data.js';
import { clamp, demand, dispatch, dayPlan, runDay, freqTrace, dsmRate, solarCF, windCF, marketPrice, NET, contingency } from './grid.js';
import { buildMap, animateMap, at, height, loadColour } from './map.js';
import { buildSites, animateSites, SITES } from './sites.js';
import { lineChart, stackChart } from './charts.js';
import { labeller } from './labels.js';

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const q = new URLSearchParams(location.hash.slice(1));
const hod = (t) => ((t % 24) + 24) % 24;
const hhmm = (t) => { const h = hod(t); return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60 + 1e-6)).padStart(2, '0')}`; };

// ── state ──
const sc0 = Object.fromEntries(SCENARIOS.map((s) => [s.id, !!s.on]));
for (const id of (q.get('scen') || '').split(',').filter(Boolean)) sc0[id] = true;
if (q.get('mskvy') === '0') sc0.mskvy = false;
const state = {
  season: SEASONS[q.get('season')] ? q.get('season') : 'summer', sc: sc0, t: q.get('t') !== null ? +q.get('t') : 11, speed: [60, 600, 3600].includes(+q.get('speed')) ? +q.get('speed') : 600,
  playing: true, view: q.get('view') || 'state', tab: q.get('tab') || 'over', labels: true,
};
let plan, block, prev, today, forecast, trip = null, event = null, dsm = 0, freq = 50, freqHist = [];

// ── scene ──
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#a9c8e6'); scene.fog = new THREE.Fog('#a9c8e6', 500, 1600);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 5000);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.47;
const sun = new THREE.DirectionalLight('#fff3df', 1.8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
const hemi = new THREE.HemisphereLight('#eef4ff', '#6f6a48', 0.6); scene.add(sun, sun.target, hemi);
const map = buildMap(); scene.add(map.group);
const sites = buildSites(); for (const s of Object.values(sites)) scene.add(s.G);
const labels = labeller($('#labels'), camera);

// ── views ──
const C = (lat, lon) => XY(lat, lon);
const MAPV = {
  state: ['Maharashtra', [-30, 480, 330], [-28, 0, 4]], vidarbha: ['Vidarbha', null, C(20.7, 79.0), 150], mumbai: ['Mumbai–Konkan', null, C(19.1, 73.1), 95],
  koyna: ['Pune–Koyna', null, C(18.0, 73.9), 120], marathwada: ['Marathwada', null, C(18.9, 76.2), 150],
};
function viewPose(v) {
  if (SITES[v]) { const [p, t] = SITES[v].cam, o = SITES[v].at; return [new THREE.Vector3(p[0] + o[0], p[1] + o[1], p[2] + o[2]), new THREE.Vector3(t[0] + o[0], t[1] + o[1], t[2] + o[2])]; }
  const m = MAPV[v] || MAPV.state; if (m[1]) return [new THREE.Vector3(...m[1]), new THREE.Vector3(...m[2])];
  const [x, z] = m[2], d = m[3]; return [new THREE.Vector3(x + d * 0.25, d * 0.85, z + d * 0.95), new THREE.Vector3(x, 2, z)];
}
let camAnim = null;
function setView(v, instant = false) {
  if (!SITES[v] && !MAPV[v]) v = 'state'; state.view = v;
  const isSite = !!SITES[v]; map.group.visible = !isSite;
  for (const [k, s] of Object.entries(sites)) s.G.visible = k === v;
  $$('#views button, #sitesBar button').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  const [p, t] = viewPose(v);
  controls.maxDistance = isSite ? 1400 : 700; controls.minDistance = isSite ? 30 : 15;
  if (instant) { camera.position.copy(p); controls.target.copy(t); camAnim = null; } else camAnim = { u: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: p, t1: t };
  scene.fog.near = isSite ? 700 : 500; scene.fog.far = isSite ? 2200 : 1600;
  labels.clear(); renderSiteCard();
}

// ── simulation ──
function replan() { plan = dayPlan(state.season, scen()); forecast = runDay(state.season, scen()); }
const scen = () => ({ ...state.sc, trip: undefined });
function step(t) {   // new 15-minute block
  block = dispatch(t, state.season, scen(), plan, prev, trip); prev = block;
  const b = block.b; today[b] = block;
  dsm += block.dev * 0.25 * 1000 * dsmRate(freq);   // any shortfall the block itself could not cover
}
let lastBlock = -1, lastDay = -1;
function advance(dtH) {
  state.t += dtH;
  const day = Math.floor(state.t / 24), b = Math.floor(hod(state.t) * 4);
  if (day !== lastDay) { lastDay = day; replan(); today = Array(96).fill(null); dsm = 0; }
  if (b !== lastBlock) { lastBlock = b; step(Math.floor(state.t * 4) / 4); }
  // frequency: small random walk, plus the dip after a trip
  const f0 = 50 + 0.018 * Math.sin(state.t * 31) + 0.012 * Math.sin(state.t * 77) - (block?.dev || 0) / 12000;
  if (event) { const s = (state.t - event.t) * 3600; const tr = event.trace, k = Math.min(tr.length - 1, Math.floor(s / 2)); freq = s < 300 ? tr[k][1] + (f0 - 50) : f0; }
  else freq = f0;
  freqHist.push([state.t, freq]); if (freqHist.length > 600) freqHist.shift();
}
function setScenario(id, on) {
  state.sc[id] = on;
  if (id === 'trip') {
    if (on && block) {
      // the unit's share of Koradi's output is lost at once; the grid covers it until the next block is re-dispatched
      const lost = Math.min(660, Math.round((block.gen.koradi * 660) / (2190 * 0.9))), left = 1 - ((hod(state.t) * 4) % 1);
      trip = { id: 'koradi', mw: 660, t: state.t }; event = { t: state.t, mw: lost, trace: freqTrace(lost) };
      block = { ...block, dev: block.dev + lost, gen: { ...block.gen, koradi: block.gen.koradi - lost } }; today[block.b] = block;
      dsm += lost * 0.25 * left * 1000 * dsmRate(49.95);
      renderLeft(); uiTick(true); return;
    }
    trip = null; event = null;
  }
  if (['heat', 'mskvy', 'coal', 'clouds'].includes(id)) { replan(); }
  lastBlock = -1; advance(0);
  renderLeft(); uiTick(true);
}

// ── sky and light ──
const sky = { day: new THREE.Color('#a9c8e6'), dusk: new THREE.Color('#e3a77a'), night: new THREE.Color('#0d1524'), cloud: new THREE.Color('#9aa7b2') };
function light() {
  const S = SEASONS[state.season], h = hod(state.t), u = (h - S.rise) / (S.set - S.rise), e = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
  const c = sky.night.clone(); if (e > 0) c.copy(sky.dusk).lerp(sky.day, Math.min(1, e * 2.5)).lerp(sky.cloud, S.cloud * 0.7); else { const dusk = Math.max(0, 1 - Math.min(Math.abs(h - S.set), Math.abs(h - S.rise)) / 0.8); c.lerp(sky.dusk, dusk * 0.6); }
  scene.background.copy(c); scene.fog.color.copy(c);
  const [, tgt] = viewPose(state.view), site = !!SITES[state.view], R = site ? 700 : 340;
  const ang = Math.PI * clamp(u, 0, 1), dir = new THREE.Vector3(Math.cos(ang), 0.25 + Math.sin(ang), -0.45).normalize();
  sun.target.position.copy(tgt); sun.position.copy(tgt).addScaledVector(e > 0 ? dir : new THREE.Vector3(-0.3, 1, 0.4).normalize(), R);
  const sc = sun.shadow.camera; sc.left = sc.bottom = site ? -520 : -250; sc.right = sc.top = site ? 520 : 250; sc.near = 1; sc.far = R * 2.5; sc.updateProjectionMatrix();
  sun.intensity = e > 0 ? 0.3 + 1.7 * Math.pow(e, 0.6) * (1 - 0.5 * S.cloud) : 0.15; sun.color.set(e > 0.25 ? '#fff3df' : e > 0 ? '#ffc58a' : '#8fa6d6');
  hemi.intensity = 0.18 + 0.5 * e + (e <= 0 ? 0.1 : 0); scene.environmentIntensity = 0.12 + 0.35 * e;
  return { e, u, night: e > 0.08 ? 0 : 1 - e / 0.08 };
}

// ── left panel ──
function renderLeft() {
  $('#seasons').innerHTML = Object.entries(SEASONS).map(([k, s]) => `<button data-season="${k}" class="${state.season === k ? 'active' : ''}">${s.icon} ${s.name.split(' ')[0]}</button>`).join('');
  $$('#seasons button').forEach((b) => b.addEventListener('click', () => { state.season = b.dataset.season; replan(); lastBlock = -1; advance(0); cmp = null; renderLeft(); uiTick(true); }));
  $('#scens').innerHTML = SCENARIOS.map((s) => `<button data-s="${s.id}" class="${state.sc[s.id] ? 'on' : ''}"><b>${esc(s.name)}</b><em>${state.sc[s.id] ? 'on' : 'off'}</em><small>${esc(s.what)}</small></button>`).join('');
  $$('#scens button').forEach((b) => b.addEventListener('click', () => setScenario(b.dataset.s, !state.sc[b.dataset.s])));
}

// ── panels ──
let charts = {}, cmp = null;
const GROUPS = [['coal', 'Coal', '#7d6e60'], ['nuclear', 'Nuclear', '#9085e9'], ['hydro', 'Hydro + pumped', '#3987e5'], ['gas', 'Gas', '#d95926'], ['wind', 'Wind', '#199e70'], ['solar', 'Solar', '#c98500'], ['imp', 'Central share + exchange', '#d55181']];
function seriesDay() {
  const rows = today.map((r, b) => r || forecast.blocks[b]), d = { t: rows.map((_, b) => b / 4) };
  d.coal = rows.map((r) => r.byType.coal || 0); d.nuclear = rows.map((r) => r.byType.nuclear || 0); d.hydro = rows.map((r) => (r.byType.hydro || 0) + Math.max(0, r.byType.psp || 0));
  d.gas = rows.map((r) => r.byType.gas || 0); d.wind = rows.map((r) => r.byType.wind || 0); d.solar = rows.map((r) => r.byType.solar || 0); d.imp = rows.map((r) => r.central + Math.max(0, r.market) + r.dev);
  d.demand = rows.map((r) => r.D.total + Math.max(0, -(r.byType.psp || 0))); d.price = rows.map((r) => r.price); d.netload = rows.map((r) => r.D.total - (r.byType.solar || 0) - (r.byType.wind || 0));
  return d;
}
const tile = (n, v, u, sub = '') => `<div class="tile"><span>${n}</span><b>${v}<small>${u}</small></b>${sub ? `<em class="na">${sub}</em>` : ''}</div>`;
function buildTabs() {
  $('#tab-over').innerHTML = `<div class="tiles" id="ovTiles"></div><div id="mixChart"></div><h4>Energy today</h4><table class="net" id="ovMix"></table><p class="legendnote">Today so far, then the forecast for the rest of the day. The white line is demand. A gap under it is drawn from the grid as a deviation.</p>`;
  charts.mix = stackChart($('#mixChart'), { title: 'Generation by source, MW', series: GROUPS.map(([key, name, color]) => ({ key, name, color })), line: { name: 'Demand', key: 'demand' } });
  $('#tab-gen').innerHTML = `<p class="lead">Mahagenco (Maharashtra State Power Generation Co.) owns the state's own coal, gas, hydro and solar stations. Private and central stations, renewable developers and the state's share of central stations elsewhere supply the rest. SLDC dispatches them all in merit order every 15 minutes.</p><div id="genList"></div>`;
  $('#tab-tx').innerHTML = `<p class="lead">Mahapareshan (Maharashtra State Electricity Transmission Co.) runs the 765, 400 and 220 kV network. Flows come from a DC load flow on this simplified network every block.</p><div class="tiles" id="txTiles"></div><h4>Busiest lines</h4><div id="txList"></div><h4>Ties with neighbouring states</h4><div id="tieList"></div>`;
  $('#tab-dist').innerHTML = `<p class="lead">Mahavitaran (Maharashtra State Electricity Distribution Co.) supplies every consumer outside Mumbai island, where BEST, Tata Power and Adani Electricity distribute.</p><div class="tiles" id="dTiles"></div><div id="catChart"></div><h4>Load by area</h4><div id="zoneList"></div><div id="mskvyNote"></div>`;
  charts.cat = stackChart($('#catChart'), { title: 'Demand by consumer type, MW', series: [['ind', 'Industry', '#3987e5'], ['res', 'Homes', '#d95926'], ['com', 'Commercial', '#9085e9'], ['ag', 'Farm pumps', '#199e70']].map(([key, name, color]) => ({ key, name, color })), h: 150 });
  $('#tab-sys').innerHTML = `<div class="tiles" id="sTiles"></div><div id="fChart"></div><div id="eventBox"></div><div id="pChart"></div><h4>Compare: solar agri feeders</h4><div id="cmpBox"></div><h4>Who does what</h4>
    <ul class="checks"><li><b>MSEB Holding Co.</b> owns the three companies formed when the Maharashtra State Electricity Board was split in 2005.</li><li><b>Mahagenco</b> generates; <b>Mahapareshan</b> transmits at 765/400/220/132 kV and runs the <b>SLDC</b> at Airoli, which schedules and dispatches every 15-minute block; <b>Mahavitaran</b> distributes and bills.</li><li><b>MERC</b> regulates tariffs. <b>WRLDC</b> and <b>Grid-India</b> run the western region and the national grid; deviations from schedule are settled under the DSM regulations.</li><li><b>Power exchanges</b> (day-ahead and real-time markets) let distribution companies buy or sell at market prices.</li></ul>`;
  charts.f = lineChart($('#fChart'), { title: 'Grid frequency (recent)', unit: 'Hz', series: [{ name: 'Frequency', key: 'f' }], band: [49.9, 50.05], bandName: 'IEGC band', endLabels: true });
  charts.p = lineChart($('#pChart'), { title: 'Exchange price today', unit: '₹/kWh', series: [{ name: 'Price', key: 'price' }], yMin: 0 });
  renderCmp(); renderSiteCard();
}
function updateTabs() {
  if (!block) return;
  const r = block, d = seriesDay(), done = today.filter(Boolean), E = (f) => done.reduce((a, x) => a + f(x), 0) / 4;
  if (state.tab === 'over') {
    const re = r.re / r.D.total, ins = r.D.total - r.central - Math.max(0, r.market) - r.dev, avg = E((x) => x.costR) / Math.max(1, E((x) => x.D.total)) / 1000;
    $('#ovTiles').innerHTML = tile('Demand now', Math.round(r.D.total).toLocaleString('en-IN'), 'MW', `peak today ${Math.round(Math.max(...d.demand)).toLocaleString('en-IN')} MW`) + tile('Generated in the state', Math.round(ins).toLocaleString('en-IN'), 'MW', `${Math.round((ins / r.D.total) * 100)}% of demand`)
      + tile('Bought from outside', Math.round(r.central + r.market + r.dev).toLocaleString('en-IN'), 'MW', `central ${Math.round(r.central)} · exchange ${Math.round(r.market)}${r.dev > 1 ? ` · deviation ${Math.round(r.dev)}` : ''}`) + tile('Renewable share', Math.round(re * 100), '%', `solar ${fmtMW(r.byType.solar || 0)} · wind ${fmtMW(r.byType.wind || 0)}`)
      + tile('Power cost now', (r.costR / 1000 / r.D.total).toFixed(2), '₹/kWh', `today so far ${avg.toFixed(2)} ₹/kWh`) + tile('CO₂ now', Math.round(r.co2).toLocaleString('en-IN'), 't/h', `${(r.co2 / r.D.total).toFixed(2)} t/MWh`)
      + tile('Frequency', freq.toFixed(3), 'Hz', freq < 49.9 ? '▼ below band' : '✓ in band') + tile('Exchange price', r.price.toFixed(2), '₹/kWh', r.market >= 0 ? `buying ${Math.round(r.market)} MW` : `selling ${Math.round(-r.market)} MW`);
    charts.mix.update(d, hod(state.t));
    const tot = (k) => d[k].reduce((a, v) => a + v, 0) / 4, all = GROUPS.reduce((a, [k]) => a + tot(k), 0);
    $('#ovMix').innerHTML = '<tr><th>Source</th><th>MWh</th><th>Share</th></tr>' + GROUPS.map(([k, n, c]) => `<tr><td><i class="sw" style="background:${c}"></i>${n}</td><td>${Math.round(tot(k)).toLocaleString('en-IN')}</td><td>${Math.round((tot(k) / all) * 100)}%</td></tr>`).join('');
  }
  if (state.tab === 'gen') {
    const groups = ['mahagenco', 'private', 'central', 're'];
    $('#genList').innerHTML = groups.map((o) => { const ps = PLANTS.filter((p) => p.owner === o && !(p.mskvy && !state.sc.mskvy)), tot = ps.reduce((a, p) => a + Math.max(0, r.gen[p.id] || 0), 0), cap = ps.reduce((a, p) => a + p.cap, 0);
      return `<h4><i class="sw" style="background:${OWNERS[o].colour}"></i>${esc(OWNERS[o].name)} · ${fmtMW(tot)} of ${fmtMW(cap)}</h4><div class="plist">${ps.map((p) => { const g = r.gen[p.id] || 0, u = Math.max(0, g) / p.cap, tr = trip && trip.id === p.id;
        const st = g < -1 ? 'pumping' : p.type === 'coal' ? (u > 0.85 ? 'near full' : u < 0.58 ? 'at minimum' : 'backing down') : p.type === 'solar' ? (g > 1 ? 'sun' : 'night') : p.type === 'hydro' ? (g > 1 ? 'peaking' : 'saving water') : '';
        return `<button class="prow" data-p="${p.id}"><span><b>${esc(p.name)}</b><small>${TYPES[p.type].name} · ₹${p.cost.toFixed(2)}/kWh${tr ? ' · <span class="bad">660 MW unit tripped</span>' : ''}${st ? ` · ${st}` : ''}</small></span><em>${Math.round(g).toLocaleString('en-IN')}<small> / ${p.cap.toLocaleString('en-IN')} MW</small></em><i class="pbar"><i style="width:${Math.min(100, u * 100)}%;background:${TYPES[p.type].colour}"></i></i></button>`; }).join('')}</div>`; }).join('')
      + `<h4>Bought from outside the state</h4><div class="plist"><div class="prow"><span><b>Central share (NTPC and others outside Maharashtra)</b><small>₹${IMPORTS.central.cost}/kWh · runs at ≥55%</small></span><em>${Math.round(r.central)}<small> / ${IMPORTS.central.cap} MW</small></em><i class="pbar"><i style="width:${(r.central / IMPORTS.central.cap) * 100}%;background:#2a78d6"></i></i></div>
      <div class="prow"><span><b>Power exchange</b><small>₹${r.price.toFixed(2)}/kWh now${r.market < 0 ? ' · selling surplus' : ''}</small></span><em>${Math.round(r.market)}<small> MW</small></em><i class="pbar"><i style="width:${(Math.abs(r.market) / IMPORTS.market.cap) * 100}%;background:#e87ba4"></i></i></div></div>
      <p class="legendnote">Koyna's daily water budget this season is ${(SEASONS[state.season].hydroMWh / 1000).toFixed(0)} GWh, spent on the highest net-load blocks. Ghatghar pumps in the solar trough and generates at the evening peak.</p>`;
    $$('.prow[data-p]').forEach((b) => b.addEventListener('click', () => flyTo(b.dataset.p)));
  }
  if (state.tab === 'tx') {
    const loads = NET.map((l, i) => ({ l, f: r.flows[i], u: Math.abs(r.flows[i]) / l.rating, off: r.outL[i] })).filter((x) => !x.l.tie);
    const n1 = contingency(r), over = loads.filter((x) => x.u > 1).length;
    $('#txTiles').innerHTML = tile('Busiest line', `${Math.round(Math.max(...loads.map((x) => x.u)) * 100)}`, '%', esc(loads.sort((a, b) => b.u - a.u)[0].l.id)) + tile('Lines over rating', over, '', over ? '▲ SLDC must act' : '✓ none')
      + tile('Worst N-1 case', `${Math.round(n1.u * 100)}`, '%', `losing a ${esc(n1.lost.id)} circuit loads ${esc(n1.hit.id)}`) + tile('HVDC Chandrapur–Padghe', state.sc.hvdc ? 'out' : Math.round(r.hvdc), state.sc.hvdc ? '' : 'MW', `${HVDC.kv}, ${HVDC.mw} MW link`);
    $('#txList').innerHTML = loads.slice(0, 12).map((x) => { const A = BUSES[x.l.f].name, B = BUSES[x.l.t].name, c = loadColour(x.u).getStyle(); return `<div class="prow"><span><b>${esc(A)} → ${esc(B)}</b><small>${x.l.kv} kV · ${x.l.n} circuit${x.l.n > 1 ? 's' : ''} · ${Math.round(x.l.len)} km${x.off ? ' · <span class="bad">tripped</span>' : ''}</small></span><em>${Math.round(Math.abs(x.f)).toLocaleString('en-IN')}<small> / ${x.l.rating.toLocaleString('en-IN')} MW</small></em><i class="pbar"><i style="width:${Math.min(100, x.u * 100)}%;background:${c}"></i></i></div>`; }).join('');
    const ties = NET.map((l, i) => ({ l, f: r.flows[i] })).filter((x) => x.l.tie), byState = {};
    for (const x of ties) byState[x.l.tie] = (byState[x.l.tie] || 0) - x.f;
    $('#tieList').innerHTML = Object.entries(byState).map(([s, f]) => `<div class="prow"><span><b>${esc(s)}</b><small>${f >= 0 ? 'into Maharashtra' : 'out of Maharashtra'}</small></span><em>${Math.round(Math.abs(f)).toLocaleString('en-IN')}<small> MW</small></em><i class="pbar"><i style="width:${Math.min(100, Math.abs(f) / 60)}%;background:${f >= 0 ? '#3987e5' : '#d95926'}"></i></i></div>`).join('') + '<p class="legendnote">Tie flows follow the network, not contracts: power bought from the central share and the exchange enters across every border at once.</p>';
  }
  if (state.tab === 'dist') {
    const Z = r.D.zones, sum = (k) => Z.reduce((a, z) => a + z[k], 0), msedcl = Z.filter((z, i) => ZONES[i].msedcl !== false).reduce((a, z) => a + z.total, 0);
    const roof = r.gen.rooftop || 0;
    $('#dTiles').innerHTML = tile('Mahavitaran load', Math.round(msedcl).toLocaleString('en-IN'), 'MW', `${Math.round((msedcl / r.D.total) * 100)}% of the state`) + tile('Farm pumps now', Math.round(sum('ag')).toLocaleString('en-IN'), 'MW', state.sc.mskvy ? 'daytime supply (MSKVY)' : 'day and night rotations')
      + tile('Rooftop solar now', Math.round(roof).toLocaleString('en-IN'), 'MW', 'net metered, seen as lower demand') + tile('Homes now', Math.round(sum('res')).toLocaleString('en-IN'), 'MW', state.sc.heat ? 'heatwave: air-conditioning' : '');
    const dd = { t: [] }; for (const k of ['ind', 'res', 'com', 'ag']) dd[k] = [];
    for (let b = 0; b < 96; b++) { const x = (today[b] || forecast.blocks[b]).D.zones; dd.t.push(b / 4); for (const k of ['ind', 'res', 'com', 'ag']) dd[k].push(x.reduce((a, z) => a + z[k], 0)); }
    charts.cat.update(dd, hod(state.t));
    $('#zoneList').innerHTML = Z.map((z, i) => { const Zi = ZONES[i]; return `<div class="prow"><span><b>${esc(Zi.name)}</b><small>${Zi.msedcl === false ? 'Mumbai licensees' : 'Mahavitaran'} · farm ${Math.round((z.ag / z.total) * 100)}% · homes ${Math.round((z.res / z.total) * 100)}% · industry ${Math.round((z.ind / z.total) * 100)}%</small></span><em>${Math.round(z.total).toLocaleString('en-IN')}<small> MW</small></em><i class="pbar seg"><i style="width:${(z.ind / z.total) * 100}%;background:#3987e5"></i><i style="width:${(z.res / z.total) * 100}%;background:#d95926"></i><i style="width:${(z.com / z.total) * 100}%;background:#9085e9"></i><i style="width:${(z.ag / z.total) * 100}%;background:#199e70"></i></i></div>`; }).join('');
    $('#mskvyNote').innerHTML = `<div class="card2"><h5>Solar agri feeders (MSKVY 2.0)</h5><p>${state.sc.mskvy ? 'On' : 'Off'}. Under the Mukhyamantri Saur Krushi Vahini Yojana 2.0, solar plants of a few MW are built next to 33/11 kV substations and feed the farm feeders directly, so farmers get power by day instead of in night rotations. Here 4,000 MW of it moves the pumping load into daylight. Compare the two on the System tab.</p></div>`;
  }
  if (state.tab === 'sys') {
    $('#sTiles').innerHTML = tile('Frequency', freq.toFixed(3), 'Hz', 'band 49.90–50.05 Hz') + tile('Deviation now', Math.round(r.dev), 'MW', r.dev > 1 ? 'overdrawing from the grid' : 'on schedule')
      + tile('DSM charges today', inr(dsm), '', 'for overdrawal') + tile('Power purchase today', crore(E((x) => x.costR)), '', `${Math.round(E((x) => x.D.total)).toLocaleString('en-IN')} MWh so far`);
    charts.f.update({ t: freqHist.map((x) => x[0]), f: freqHist.map((x) => x[1]) });
    charts.p.update({ t: d.t, price: d.price });
    $('#eventBox').innerHTML = event ? `<div class="card2"><h5>Unit trip at ${hhmm(event.t)}</h5><p>A 660 MW Koradi unit trips. Across the national grid the frequency falls to about <b>${Math.min(...event.trace.map((x) => x[1])).toFixed(3)} Hz</b> within seconds, primary response arrests it and AGC brings it back over a few minutes.</p><p>The unit was carrying ${event.mw} MW. Maharashtra overdraws that from the grid until SLDC re-dispatches in the next block: other stations ramp up, and the exchange and the central share make up the rest. DSM charges today: <b>${inr(dsm)}</b>.</p><div id="evChart"></div></div>` : '';
    if (event) { const c = lineChart($('#evChart'), { title: 'Frequency in the 5 minutes after the trip', unit: 'Hz', series: [{ name: 'Frequency', key: 'f' }], band: [49.9, 50.05], h: 110 }); const tr = event.trace; c.update({ t: tr.map((x) => x[0] / 3600), f: tr.map((x) => x[1]) }); }
  }
}
function renderCmp() {
  const el = $('#cmpBox'); if (!el) return;
  if (!cmp || cmp.season !== state.season) { el.innerHTML = `<p class="muted">Run this season's day twice: with farm pumps on night rotations, and with MSKVY 2.0 solar feeders moving them into daylight.</p><button class="btn" id="runCmp">▶ Run both days</button>`; $('#runCmp').onclick = () => { const base = { ...state.sc, trip: false }; cmp = { season: state.season, off: runDay(state.season, { ...base, mskvy: false }), on: runDay(state.season, { ...base, mskvy: true }) }; renderCmp(); }; return; }
  const rows = [['Power purchase cost', (x) => crore(x.cost), (x) => x.cost, -1], ['CO₂', (x) => `${Math.round(x.co2).toLocaleString('en-IN')} t`, (x) => x.co2, -1], ['Coal generation', (x) => `${Math.round(x.coal).toLocaleString('en-IN')} MWh`, (x) => x.coal, -1], ['Renewable energy', (x) => `${Math.round(x.re).toLocaleString('en-IN')} MWh`, (x) => x.re, 1], ['Coal swing over the day', (x) => fmtMW(x.coalSwing), (x) => x.coalSwing, -1], ['Peak demand', (x) => fmtMW(x.peak), (x) => x.peak, -1], ['Solar curtailed', (x) => `${Math.round(x.curtail)} MWh`, (x) => x.curtail, -1]];
  el.innerHTML = `<table class="cmp"><tr><th></th><th>Night rotation</th><th>MSKVY 2.0</th></tr>${rows.map(([n, f, v, dir]) => { const a = v(cmp.off), b = v(cmp.on), w = Math.abs(a - b) < 1e-6 ? 0 : (b - a) * dir > 0 ? 2 : 1; return `<tr><td>${n}</td><td class="${w === 1 ? 'best' : ''}">${f(cmp.off)}</td><td class="${w === 2 ? 'best' : ''}">${f(cmp.on)}</td></tr>`; }).join('')}</table><p class="legendnote">Same farm energy in both; only the timing and the solar plants change. Peak demand rises at noon with MSKVY, but the sun covers it.</p>`;
}
function renderSiteCard() {
  const el = $('#siteCard'); if (!el) return;
  const v = state.view, info = {
    coal: 'Coal comes by rail to the wagon tippler, goes to the yard and up the conveyor to the bunkers. Each 660 MW supercritical unit burns about 330 t of coal an hour; steam drives the turbine, and the cooling towers reject the heat. Output follows SLDC dispatch: units back down towards their 55% minimum when solar floods the grid at noon.',
    hydro: 'Koyna dam holds the Shivajisagar lake on the Koyna river. Its four stages (1,956 MW) send water west through tunnels in the Sahyadri to underground powerhouses and on to the sea, which is why the plant can run without returning water to the Krishna basin. Water is scarce outside the monsoon, so Koyna is saved for the peak hours; in the monsoon the spillway gates open.',
    solar: 'An MSKVY 2.0 plant beside a 33/11 kV substation. The panels track the sun on single axes. When farm feeders are moved to daytime, the pumps run while the panels produce.',
    wind: 'Wind farms on the Satara plateau catch the south-west monsoon: output in August is about three times that in May.',
    sub: 'Padghe near Kalyan: a 400 kV substation that feeds Mumbai and Thane, and the inverter end of the ±500 kV, 1,500 MW HVDC link from Chandrapur, which carries Vidarbha coal power 750 km west.',
    dist: 'A Mahavitaran 33/11 kV substation with a town feeder and a farm feeder. Pole-mounted distribution transformers step down to 415/240 V for homes; some roofs have net-metered solar. The farm feeder runs in its supply window.',
  }[v];
  el.innerHTML = info ? `<div class="card2"><h5>${esc(SITES[v].name)}</h5><p>${info}</p></div>` : `<div class="card2"><h5>The state map</h5><p>Columns show each station's output now; the faint sleeve is its capacity. Rings show the owner: <span style="color:${OWNERS.mahagenco.colour}">Mahagenco</span>, <span style="color:${OWNERS.private.colour}">private</span>, <span style="color:${OWNERS.central.colour}">central</span>, <span style="color:${OWNERS.re.colour}">renewable</span>. Dots run along each line in the direction of flow, coloured by loading.</p></div>`;
}
function flyTo(id) {
  const p = PLANTS.find((x) => x.id === id); if (!p) return;
  const [x, z] = XY(p.lat, p.lon); state.view = 'plant'; map.group.visible = true; for (const s of Object.values(sites)) s.G.visible = false;
  $$('#views button, #sitesBar button').forEach((b) => b.classList.remove('active'));
  camAnim = { u: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(x + 25, 45, z + 55), t1: new THREE.Vector3(x, 2, z) };
}

// ── HUD ──
function hud() {
  if (!block) return;
  const S = SEASONS[state.season], r = block, re = r.re / r.D.total;
  $('#hud').innerHTML = `<div class="hcard"><div class="day"><b>${hhmm(state.t)}</b><span>Day ${Math.floor(state.t / 24) + 1} · ${S.icon} ${esc(S.name)} · block ${r.b + 1}/96</span></div><span class="muted">Demand ${fmtMW(r.D.total)} · exchange ₹${r.price.toFixed(2)}/kWh</span></div>
    <div class="kv"><span class="${freq < 49.9 ? 'hi' : 'ok'}">f <b>${freq.toFixed(3)} Hz</b></span><span>Coal <b>${fmtMW(r.byType.coal)}</b></span><span>Solar <b>${fmtMW(r.byType.solar || 0)}</b></span><span>Wind <b>${fmtMW(r.byType.wind || 0)}</b></span><span>Import <b>${fmtMW(r.central + r.market + r.dev)}</b></span><span>RE <b>${Math.round(re * 100)}%</b></span></div>`;
}
function mapLabels() {
  if (!state.labels) return;
  const r = block; if (!r) return;
  if (SITES[state.view]) {
    const o = new THREE.Vector3(...SITES[state.view].at), U = sites[state.view].U;
    if (state.view === 'coal') U.units.forEach((u, i) => labels.set(`u${i}`, u.label, `Unit ${8 + i} <b>${u.tripped ? 'TRIPPED' : `${Math.round(u.mw)} MW`}</b>`, u.tripped ? 'alarm' : 'node'));
    if (state.view === 'hydro') { labels.set('koyna', o.clone().add(new THREE.Vector3(125, -10, 185)), `Powerhouse <b>${Math.round(r.gen.koyna)} MW</b>`, 'node'); labels.set('lake', o.clone().add(new THREE.Vector3(-150, 50, -220)), `Shivajisagar lake <b>${state.season === 'monsoon' ? 'full, spilling' : state.season === 'winter' ? '≈75% full' : '≈30% full'}</b>`, 'node'); }
    if (state.view === 'solar') labels.set('sol', o.clone().add(new THREE.Vector3(0, 20, 0)), `Solar <b>${Math.round(solarCF(hod(state.t), state.season, state.t) * 100)}% of capacity</b> · farm feeders <b>${agOn() ? 'on' : 'off'}</b>`, 'node');
    if (state.view === 'wind') labels.set('wind', o.clone().add(new THREE.Vector3(0, 160, 0)), `Wind <b>${Math.round(windCF(hod(state.t), state.season, state.t) * 100)}% of capacity</b>`, 'node');
    if (state.view === 'sub') { labels.set('hv', o.clone().add(new THREE.Vector3(160, 40, -40)), `HVDC valve hall <b>${state.sc.hvdc ? 'tripped' : `${Math.round(r.hvdc)} MW in`}</b>`, state.sc.hvdc ? 'alarm' : 'node'); labels.set('ac', o.clone().add(new THREE.Vector3(-40, 35, 0)), '400 kV yard', 'node'); }
    if (state.view === 'dist') { labels.set('town', o.clone().add(new THREE.Vector3(60, 25, 20)), `Town feeder <b>${state.t % 24 > 18 ? 'evening peak' : 'on'}</b>`, 'node'); labels.set('farm', o.clone().add(new THREE.Vector3(-180, 20, 120)), `Farm feeder <b>${agOn() ? 'on' : 'off'}</b>`, 'node'); }
    return;
  }
  const far = state.view === 'state';
  for (const p of PLANTS) { if (p.rooftop || (p.mskvy && !state.sc.mskvy)) continue; if (far && p.cap < 1200) continue; const o = map.U.plants[p.id], g = r.gen[p.id] || 0; const pos = o.pos.clone(); pos.y += Math.max(6, Math.abs(g) / 100) + 3; labels.set(p.id, pos, `${esc(p.name)} <b>${Math.round(g).toLocaleString('en-IN')}</b>`, `node ${trip && trip.id === p.id ? 'alarm' : ''}`); }
  for (const c of map.U.cities) { if (far && c.z.share < 0.07) continue; const d = r.D.zones.find((z) => z.id === c.z.id).total, pos = c.pos.clone(); pos.y += 8; labels.set(`z${c.z.id}`, pos, `${esc(c.z.name.split(' (')[0])} <b>${fmtMW(d)}</b>`, 'city'); }
  if (!far) for (const [k, b] of Object.entries(BUSES)) { if (b.ext) continue; labels.set(`b${k}`, at(b.lat, b.lon, 3), esc(b.name), 'bus'); }
  for (const [n, la, lo] of NEIGHBOURS) labels.set(`n${n}`, at(la, lo, 2), esc(n), 'state');
  const mid = map.U.hvdc.curve.getPointAt(0.5); labels.set('hvdc', mid.clone().add(new THREE.Vector3(0, 3, 0)), `HVDC <b>${state.sc.hvdc ? 'out' : `${Math.round(r.hvdc)} MW`}</b>`, `node ${state.sc.hvdc ? 'alarm' : ''}`);
}
const agOn = () => { const h = hod(state.t); return state.sc.mskvy ? h >= 8.5 && h < 16.5 : (h >= 9.5 && h < 17.5) || h >= 22 || h < 6; };

// ── wiring ──
$$('.tabs button').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; $$('.tabs button').forEach((x) => x.classList.toggle('active', x === b)); $$('.tab').forEach((t) => t.classList.toggle('show', t.id === `tab-${state.tab}`)); uiTick(true); }));
$('#play').onclick = () => { state.playing = !state.playing; $('#play').textContent = state.playing ? '❚❚' : '▶'; };
$$('#speeds button').forEach((b) => b.addEventListener('click', () => { state.speed = +b.dataset.s; $$('#speeds button').forEach((x) => x.classList.toggle('active', x === b)); }));
$$('#speeds button').forEach((x) => x.classList.toggle('active', +x.dataset.s === state.speed));
$('#views').innerHTML = Object.entries(MAPV).map(([k, [n]]) => `<button data-v="${k}">${n}</button>`).join('');
$('#sitesBar').innerHTML = Object.entries(SITES).map(([k, s]) => `<button data-v="${k}">${{ coal: '🏭 Coal', hydro: '🌊 Koyna', solar: '☀️ Solar', wind: '🌬️ Wind', sub: '⚡ Substation', dist: '🏘️ Distribution' }[k]}</button>`).join('');
$$('#views button, #sitesBar button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.v)));
$('#lblBtn').onclick = () => { state.labels = !state.labels; $('#lblBtn').classList.toggle('active', state.labels); };
function uiTick(force) { hud(); updateTabs(); if (force) renderSiteCard(); }

// ── loop ──
function resize() { const v = $('.view'), w = v.clientWidth, h = v.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); $('#hud').style.top = `${$('.bar').offsetHeight + 18}px`; }
new ResizeObserver(resize).observe($('.view'));
const clock = new THREE.Clock(); let uiT = 0, lightT = 0, L = { e: 1, u: 0.5, night: 0 }, simClock = 0;
function loop() {
  const dt = Math.min(0.05, clock.getDelta()); simClock += dt;
  if (state.playing) advance((dt * state.speed) / 3600);
  lightT += dt; if (lightT > 0.25) { lightT = 0; L = light(); }
  if (block) {
    if (map.group.visible) animateMap(map.U, block, dt, L.night, state.sc);
    animateSites(sites, block, { clock: simClock, season: state.season, trip, solarCF: solarCF(hod(state.t), state.season, state.t), windCF: windCF(hod(state.t), state.season, state.t), sunU: L.u, night: L.night, agOn: agOn(), clouds: state.sc.clouds || SEASONS[state.season].cloud > 0.3 }, dt);
  }
  if (camAnim) { camAnim.u = Math.min(1, camAnim.u + dt * 1.2); const e = camAnim.u * camAnim.u * (3 - 2 * camAnim.u); camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (camAnim.u >= 1) camAnim = null; }
  uiT += dt; if (uiT > 0.5) { uiT = 0; uiTick(); }
  controls.update(); renderer.render(scene, camera);
  mapLabels(); const v = $('.view'); labels.frame(v.clientWidth, v.clientHeight, state.labels);
  requestAnimationFrame(loop);
}

// ── start ──
resize(); renderLeft(); buildTabs();
lastDay = Math.floor(state.t / 24); replan(); today = Array(96).fill(null);
// fill today up to the start time
for (let b = 0; b <= Math.floor(hod(state.t) * 4); b++) { block = dispatch(Math.floor(state.t / 24) * 24 + b / 4, state.season, scen(), plan, prev, null); prev = block; today[b] = block; }
lastBlock = Math.floor(hod(state.t) * 4); advance(0);
for (const id of (q.get('scen') || '').split(',')) if (id === 'trip') setScenario('trip', true);
setView(state.view, true); L = light();
$$('.tabs button').find((b) => b.dataset.tab === state.tab)?.click();
loop();
setTimeout(() => $('#loader').classList.add('done'), 300);
window.__mg = {   // handle for automated browser tests
  state, setView, setScenario, advance, flyTo, get block() { return block; }, get today() { return today; }, camera, controls, runCmp: () => { $('#runCmp')?.click(); return cmp && { off: cmp.off.cost, on: cmp.on.cost }; },
  snap: () => { if (camAnim) camAnim.u = 0.999; uiTick(true); },
};
