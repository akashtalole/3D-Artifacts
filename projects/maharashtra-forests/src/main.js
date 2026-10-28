/**
 * Van Maharashtra: forest cover from 2021 to 2050 as industrial projects take forest land,
 * under three scenarios.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PROJECTS, KINDS, SCENARIOS, RESERVES, CORRIDORS, DIVISIONS, NEIGHBOURS, FSI2021, AREA_KM2, XY, fmtKm } from './data.js';
import { run, Y0, Y1, CELL_KM2 } from './forest.js';
import { buildMap, paintMap, animateTrees, projectModel, pathModel, at, height } from './map.js';
import { buildSites, updateSite, SITES } from './sites.js';
import { lineChart, stackChart } from './charts.js';
import { labeller } from './labels.js';

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const q = new URLSearchParams(location.hash.slice(1));
const state = {
  sc: SCENARIOS[q.get('sc')] ? q.get('sc') : 'bau', year: q.get('year') ? Math.max(Y0, Math.min(Y1, +q.get('year'))) : Y0, playing: q.get('play') !== '0', rate: 1,
  view: q.get('view') || 'state', tab: q.get('tab') || 'over', layers: { trees: true, change: true, projects: true, wildlife: true, labels: true },
};
const RUNS = {}; const runOf = (sc) => (RUNS[sc] ||= run(sc));

// ── scene ──
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#a9c8e6'); scene.fog = new THREE.Fog('#a9c8e6', 500, 1700);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 6000);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.47;
const sun = new THREE.DirectionalLight('#fff3df', 1.9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target, new THREE.HemisphereLight('#eef4ff', '#6f6a48', 0.65));
const map = buildMap(); scene.add(map.group);
const sites = buildSites(); for (const s of Object.values(sites)) scene.add(s.G);
const labels = labeller($('#labels'), camera);

// project models on the map (one set per pipeline entry, built lazily per scenario)
const projGroup = new THREE.Group(); map.group.add(projGroup);
let models = [];
function buildProjects() {
  projGroup.clear(); models = [];
  for (const p of runOf(state.sc).projects) {
    const base = p.path ? null : at(p.lat, p.lon), g = new THREE.Group();
    if (p.path) g.add(pathModel(p)); else { const m = projectModel(p); m.position.copy(base); g.add(m); if (p.phase2) m.position.add(new THREE.Vector3(5, 0, 4)); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.5, 5.3, 40), new THREE.MeshBasicMaterial({ color: KINDS[p.kind].colour, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    const anchor = p.path ? at(...p.path[Math.floor(p.path.length / 2)], 0.6) : base.clone().add(new THREE.Vector3(0, 0.6, 0)); ring.position.copy(anchor); ring.rotation.x = -Math.PI / 2; g.add(ring);
    projGroup.add(g); models.push({ p, g, ring, anchor, grow: 0 });
  }
}

// ── views ──
const C = (lat, lon) => XY(lat, lon);
const MAPV = { state: ['Maharashtra', [-10, 560, 400], [-6, 0, 6]], vidarbha: ['Vidarbha forests', null, C(20.2, 79.6), 170], sahyadri: ['Sahyadri', null, C(17.8, 73.8), 150], konkan: ['Thane–Palghar', null, C(19.6, 73.1), 90], melghat: ['Melghat–Satpura', null, C(21.35, 77.2), 110] };
function pose(v) {
  if (SITES[v]) { const [p, t] = SITES[v].cam, o = SITES[v].at; return [new THREE.Vector3(p[0] + o[0], p[1] + o[1], p[2] + o[2]), new THREE.Vector3(t[0] + o[0], t[1] + o[1], t[2] + o[2])]; }
  const m = MAPV[v] || MAPV.state; if (m[1]) return [new THREE.Vector3(...m[1]), new THREE.Vector3(...m[2])];
  const [x, z] = m[2], d = m[3]; return [new THREE.Vector3(x + d * 0.2, d * 0.8, z + d * 0.95), new THREE.Vector3(x, 2, z)];
}
let camAnim = null;
function setView(v, instant = false) {
  if (!SITES[v] && !MAPV[v]) v = 'state'; state.view = v;
  const site = !!SITES[v]; map.group.visible = !site; for (const [k, s] of Object.entries(sites)) s.G.visible = k === v;
  $$('#views button, #sitesBar button').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  const [p, t] = pose(v); controls.maxDistance = site ? 1600 : 760; controls.minDistance = site ? 40 : 15;
  if (instant) { camera.position.copy(p); controls.target.copy(t); camAnim = null; } else camAnim = { u: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: p, t1: t };
  const [, tgt] = pose(v), R = site ? 800 : 360; sun.target.position.copy(tgt); sun.position.copy(tgt).add(new THREE.Vector3(0.45, 1, 0.35).normalize().multiplyScalar(R));
  const sc = sun.shadow.camera; sc.left = sc.bottom = site ? -700 : -260; sc.right = sc.top = site ? 700 : 260; sc.far = R * 2.5; sc.updateProjectionMatrix();
  labels.clear(); renderSiteCard();
}

// ── time ──
const snapAt = (y) => runOf(state.sc).years[Math.max(0, Math.min(Y1 - Y0, Math.floor(y) - Y0))];
let shownYear = -1;
function refreshYear(force = false) {
  const Y = Math.floor(state.year); if (Y === shownYear && !force) return; shownYear = Y;
  paintMap(map.U, snapAt(Y), snapAt(Y0), state.layers.change); $('#yearIn').value = state.year; $('#yearLbl').textContent = Y;
  const s = snapAt(Y), base = snapAt(Y0);
  map.U.corridors.forEach((c, i) => { const r = s.corr[i].score / Math.max(0.01, base.corr[i].score); c.m.color.set(r > 0.9 ? '#5dffa0' : r > 0.75 ? '#ffd166' : '#ff5a5a'); c.r = r; });
  uiTick(true);
}

// ── left panel ──
function renderLeft() {
  $('#scs').innerHTML = Object.entries(SCENARIOS).map(([k, s]) => `<button data-s="${k}" class="${state.sc === k ? 'active' : ''}">${esc(s.short)}</button>`).join('');
  $$('#scs button').forEach((b) => b.addEventListener('click', () => { state.sc = b.dataset.s; renderLeft(); buildProjects(); refreshYear(true); buildTabs(); }));
  $('#scNote').textContent = SCENARIOS[state.sc].what;
}

// ── panels ──
const tile = (n, v, u, sub = '', cls = '') => `<div class="tile"><span>${n}</span><b>${v}<small>${u}</small></b>${sub ? `<em class="${cls || 'na'}">${sub}</em>` : ''}</div>`;
const sgn = (v, d = 0) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: d })}`;
let charts = {};
const YT = [2021, 2030, 2040, 2050];
function buildTabs() {
  $('#tab-over').innerHTML = `<div class="tiles" id="ovTiles"></div><div id="chChange"></div><div id="chStack"></div><div id="chCmp"></div><p class="legendnote">Total forest cover can hold up while very dense forest is lost: thinning moves land down a class, and plantations count as open forest only once their canopy closes.</p>`;
  charts.change = lineChart($('#chChange'), { title: 'Change since 2021 by density class', unit: 'km²', series: [{ name: 'Very dense', key: 'v', color: '#2f8f4e' }, { name: 'Moderately dense', key: 'm', color: '#3987e5' }, { name: 'Open', key: 'o', color: '#c98500' }, { name: 'Plantations', key: 'p', color: '#9085e9' }], ticks: YT, xfmt: (y) => String(Math.round(y)), h: 140 });
  charts.stack = stackChart($('#chStack'), { title: 'Forest cover by class, km²', unit: 'km²', series: [['v', 'Very dense', '#1d6b34'], ['m', 'Moderately dense', '#3d9a4a'], ['o', 'Open', '#9bbb59'], ['p', 'Plantations', '#c6e07a']].map(([key, name, color]) => ({ key, name, color })), x0: Y0, x1: Y1, ticks: YT, xfmt: (y) => String(Math.round(y)), h: 150 });
  charts.cmp = lineChart($('#chCmp'), { title: 'Total forest cover in each scenario', unit: 'km²', series: Object.entries(SCENARIOS).map(([k, s], i) => ({ name: s.short, key: k, color: ['#d95926', '#199e70', '#d55181'][i] })), ticks: YT, xfmt: (y) => String(Math.round(y)), h: 140 });
  $('#tab-proj').innerHTML = `<div class="tiles" id="pjTiles"></div><h4>Pipeline</h4><div id="pjList"></div>`;
  $('#tab-reg').innerHTML = `<p class="lead">Forest by revenue division, against 2021. Most of the state's forest is in the Nagpur division (Gadchiroli, Chandrapur, Gondia, Bhandara), where the mining and coal projects also sit.</p><div id="rgList"></div>`;
  $('#tab-wild').innerHTML = `<p class="lead">Tigers and other wide-ranging animals move between reserves along forest corridors. A corridor scores 100 when it is as forested and unbroken as in 2021; roads, rails and mines near it lower the score.</p><div id="wlList"></div><h4>Tiger reserves</h4><div id="rsList"></div>`;
  updateTabs();
}
function updateTabs() {
  const s = snapAt(state.year), b = snapAt(Y0), R = runOf(state.sc), Y = Math.floor(state.year);
  if (state.tab === 'over' && $('#ovTiles')) {
    const d = s.tot.cover - b.tot.cover, dv = s.tot.v - b.tot.v;
    $('#ovTiles').innerHTML = tile('Forest cover', Math.round(s.tot.cover).toLocaleString('en-IN'), 'km²', `${s.tot.pct.toFixed(2)}% of the state · ${sgn(d)} km² since 2021`, d < 0 ? 'hi' : 'ok')
      + tile('Very dense forest', Math.round(s.tot.v).toLocaleString('en-IN'), 'km²', `${sgn((dv / b.tot.v) * 100, 1)}% since 2021`, dv < 0 ? 'hi' : 'ok') + tile('Cleared for projects', Math.round(s.cumDiv).toLocaleString('en-IN'), 'km²', `${s.built} projects built`)
      + tile('Thinned around projects', Math.round(s.cumDeg).toLocaleString('en-IN'), 'km²', `plus ${Math.round(s.cumLost)} km² lost to access and settlement`) + tile('Forest carbon', s.carbon.toFixed(0), 'Mt C', `${sgn(s.carbon - b.carbon)} Mt since 2021`, s.carbon < b.carbon ? 'hi' : 'ok')
      + tile('Plantations counted', Math.round(s.tot.pl).toLocaleString('en-IN'), 'km²', `${Math.round(s.pYoung)} km² of saplings not yet counted`);
    const ys = R.years, t = ys.map((x) => x.Y);
    charts.change.update({ t, v: ys.map((x) => x.tot.v - b.tot.v), m: ys.map((x) => x.tot.m - b.tot.m), o: ys.map((x) => x.tot.o - b.tot.o), p: ys.map((x) => x.tot.pl) });
    charts.stack.update({ t, v: ys.map((x) => x.tot.v), m: ys.map((x) => x.tot.m), o: ys.map((x) => x.tot.o), p: ys.map((x) => x.tot.pl) }, state.year);
    const cmp = { t }; for (const k of Object.keys(SCENARIOS)) cmp[k] = runOf(k).years.map((x) => x.tot.cover); charts.cmp.update(cmp);
  }
  if (state.tab === 'proj' && $('#pjTiles')) {
    const P = R.projects, built = P.filter((p) => p.status === 'built' && p.year <= Y), ha = built.reduce((a, p) => a + p.haUsed, 0);
    $('#pjTiles').innerHTML = tile('Projects built', built.length, ` of ${P.filter((p) => p.status === 'built').length}`, `${P.filter((p) => p.status === 'dropped').length} dropped in this scenario`) + tile('Forest land sought', Math.round(ha).toLocaleString('en-IN'), 'ha', `${(ha / 100).toFixed(0)} km² by ${Y}`)
      + tile('Compensatory planting due', Math.round(ha).toLocaleString('en-IN'), 'ha', `${SCENARIOS[state.sc].lag}-year lag, ${Math.round(SCENARIOS[state.sc].survival * 100)}% survival`) + tile('Share of 2021 cover', ((s.cumDiv / b.tot.cover) * 100).toFixed(2), '%', 'cleared directly');
    $('#pjList').innerHTML = [...P].sort((a, b2) => a.year - b2.year).map((p) => { const st = p.status === 'dropped' ? 'dropped' : p.year > Y ? 'planned' : 'built'; const took = R.diverted.get(p.id);
      return `<button class="prow ${st}" data-id="${p.id}"><span><b><i class="sw" style="background:${KINDS[p.kind].colour}"></i>${esc(p.name)}</b><small>${p.year} · ${KINDS[p.kind].name}${p.note ? ` · ${esc(p.note)}` : ''}</small></span><em>${st === 'dropped' ? 'dropped' : `${Math.round(p.haUsed).toLocaleString('en-IN')} ha`}<small>${st === 'built' && took !== undefined ? ` · ${(took).toFixed(1)} km² forest` : st === 'planned' ? ' · planned' : ''}</small></em></button>`; }).join('');
    $$('#pjList .prow').forEach((el) => el.addEventListener('click', () => flyTo(el.dataset.id)));
  }
  if (state.tab === 'reg' && $('#rgList')) {
    $('#rgList').innerHTML = DIVISIONS.map((d, i) => { const n = s.div[i], o = b.div[i], now = n.v + n.m + n.o + n.pl, was = o.v + o.m + o.o, ch = now - was, dense = n.v + n.m - (o.v + o.m);
      return `<div class="prow"><span><b>${esc(d.name)} division</b><small>very dense ${Math.round(n.v).toLocaleString('en-IN')} · moderately dense ${Math.round(n.m).toLocaleString('en-IN')} · open ${Math.round(n.o + n.pl).toLocaleString('en-IN')} km² · dense forest ${sgn(dense)} km²</small></span><em>${Math.round(now).toLocaleString('en-IN')}<small> km² (${sgn(ch)})</small></em><i class="pbar seg"><i style="width:${(n.v / was) * 100}%;background:#1d6b34"></i><i style="width:${(n.m / was) * 100}%;background:#3d9a4a"></i><i style="width:${((n.o + n.pl) / was) * 100}%;background:#9bbb59"></i></i></div>`; }).join('');
  }
  if (state.tab === 'wild' && $('#wlList')) {
    $('#wlList').innerHTML = CORRIDORS.map((c, i) => { const r = s.corr[i].score / Math.max(0.01, b.corr[i].score), col = r > 0.9 ? '#5dffa0' : r > 0.75 ? '#ffd166' : '#ff5a5a';
      return `<div class="prow"><span><b>${esc(c.name)}</b><small>${r > 0.9 ? 'holding' : r > 0.75 ? 'weakened' : 'broken in places'}</small></span><em>${Math.round(r * 100)}<small> / 100</small></em><i class="pbar"><i style="width:${Math.min(100, r * 100)}%;background:${col}"></i></i></div>`; }).join('');
    $('#rsList').innerHTML = RESERVES.map((r) => { const near = R.projects.filter((p) => p.status === 'built' && p.year <= Y && dist(p, r) < r.r + 25); return `<div class="prow"><span><b>${esc(r.name)}</b><small>${near.length ? `Within 25 km of the edge: ${near.map((p) => esc(p.name)).join('; ')}` : 'No project within 25 km of the edge'}</small></span><em>${near.length}<small> nearby</small></em></div>`; }).join('');
  }
}
function dist(p, r) { const [x1, z1] = XY(r.lat, r.lon); const pts = p.path || [[p.lat, p.lon]]; return Math.min(...pts.map(([la, lo]) => { const [x, z] = XY(la, lo); return Math.hypot(x - x1, z - z1) * 2; })); }
function flyTo(id) {
  const m = models.find((x) => x.p.id === id); if (!m) return;
  const site = Object.entries(SITES).find(([, s]) => s.project === id.replace(/-2$/, '')); if (site) { setView(site[0]); return; }
  state.view = 'proj'; map.group.visible = true; for (const s of Object.values(sites)) s.G.visible = false; $$('#views button, #sitesBar button').forEach((b) => b.classList.remove('active'));
  camAnim = { u: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: m.anchor.clone().add(new THREE.Vector3(18, 45, 55)), t1: m.anchor.clone() };
}
function renderSiteCard() {
  const v = state.view, info = {
    mine: 'Open-cast mining strips the forest, the soil and the hill. Waste dumps grow beside the pit and haul roads open the forest to further cutting. Compensatory planting is done on other land; young plantations take decades to become forest, and not all survive.',
    road: 'Widening a highway through a forest corridor removes a strip of trees and adds a barrier of traffic. Underpasses and overpasses under the road let animals keep moving between the forest blocks on either side.',
    dam: 'A reservoir drowns the valley floor, which is often the richest part of the forest, and changes the river downstream.',
    port: 'Mangroves protect the coast from storms and are nurseries for fish. Reclaiming the creek for a port removes them; nearby mangroves suffer from changed tides and silt.',
  }[v];
  $('#siteCard').innerHTML = info ? `<div class="card2"><h5>${esc(SITES[v].name)}</h5><p>${info}</p></div>` : `<div class="card2"><h5>Reading the map</h5><p>Each tile is 6 × 6 km, shaded by its forest: dark green dense, olive open, lime young plantation, grey-brown industrial land. Trees thin and fall as cover drops. Dashed yellow circles are tiger reserves; corridors turn from green to amber to red as they break.</p></div>`;
}

// ── HUD ──
function hud() {
  const s = snapAt(state.year), b = snapAt(Y0), d = s.tot.cover - b.tot.cover;
  $('#hud').innerHTML = `<div class="hcard"><div class="day"><b>${Math.floor(state.year)}</b><span>${esc(SCENARIOS[state.sc].name)}</span></div><span class="muted">Forest cover ${fmtKm(s.tot.cover)} · ${s.tot.pct.toFixed(2)}% of Maharashtra</span></div>
    <div class="kv"><span class="${d < 0 ? 'hi' : 'ok'}">Since 2021 <b>${sgn(d)} km²</b></span><span class="${s.tot.v < b.tot.v ? 'hi' : 'ok'}">Very dense <b>${sgn(((s.tot.v - b.tot.v) / b.tot.v) * 100, 1)}%</b></span><span>Cleared <b>${Math.round(s.cumDiv)} km²</b></span><span>Projects <b>${s.built}</b></span></div>`;
}
function mapLabels() {
  if (!state.layers.labels) return;
  if (SITES[state.view]) { const k = state.view, S = SITES[k], P = runOf(state.sc).projects.find((p) => p.id === S.project); labels.set(`site-${k}`, new THREE.Vector3(...S.at).add(new THREE.Vector3(0, 120, 0)), `${esc(S.name)} · <b>${esc(sites[k].status || '')}</b>`, 'node'); return; }
  const Y = Math.floor(state.year), far = state.view === 'state';
  if (state.layers.projects) for (const m of models) { if (m.p.status !== 'built' || m.p.year > Y || m.grow < 0.5) continue; if (far && (m.p.haUsed < 2500 || m.p.path)) continue; labels.set(m.p.id, m.anchor.clone().add(new THREE.Vector3(0, 6, 0)), `${esc(m.p.name)} <b>${Math.round(m.p.haUsed).toLocaleString('en-IN')} ha</b>`, `node ${Y - m.p.year < 2 ? 'alarm' : ''}`); }
  if (state.layers.wildlife) { for (const r of map.U.reserves) labels.set(r.r.id, r.c.clone().add(new THREE.Vector3(0, 6, 0)), esc(r.r.name), 'tr'); if (!far) map.U.corridors.forEach((c) => labels.set(c.c.id, c.curve.getPointAt(0.5).add(new THREE.Vector3(0, 3, 0)), `${esc(c.c.name)} <b>${Math.round((c.r ?? 1) * 100)}</b>`, 'node')); }
  for (const [n, la, lo] of NEIGHBOURS) labels.set(`n${n}`, at(la, lo, 2), esc(n), 'state');
}

// ── wiring ──
$$('.tabs button').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; $$('.tabs button').forEach((x) => x.classList.toggle('active', x === b)); $$('.tab').forEach((t) => t.classList.toggle('show', t.id === `tab-${state.tab}`)); updateTabs(); }));
$('#play').onclick = () => { if (!state.playing && state.year >= Y1) state.year = Y0; state.playing = !state.playing; $('#play').textContent = state.playing ? '❚❚' : '▶'; };
$$('#rates button').forEach((b) => b.addEventListener('click', () => { state.rate = +b.dataset.r; $$('#rates button').forEach((x) => x.classList.toggle('active', x === b)); }));
$('#yearIn').min = Y0; $('#yearIn').max = Y1; $('#yearIn').addEventListener('input', (e) => { state.year = +e.target.value; state.playing = false; $('#play').textContent = '▶'; refreshYear(); });
$('#views').innerHTML = Object.entries(MAPV).map(([k, [n]]) => `<button data-v="${k}">${n}</button>`).join('');
$('#sitesBar').innerHTML = Object.entries(SITES).map(([k]) => `<button data-v="${k}">${{ mine: '⛏️ Mine', road: '🛣️ Highway', dam: '🌊 Dam', port: '⚓ Mangroves' }[k]}</button>`).join('');
$$('#views button, #sitesBar button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.v)));
$$('#layers button').forEach((b) => b.addEventListener('click', () => { const l = b.dataset.l; state.layers[l] = !state.layers[l]; b.classList.toggle('active', state.layers[l]); applyLayers(); }));
function applyLayers() { refreshYear(true); map.U.trees.visible = state.layers.trees; projGroup.visible = state.layers.projects; map.U.reserves.forEach((r) => { r.l.visible = state.layers.wildlife; }); map.U.corridors.forEach((c) => { c.t.visible = state.layers.wildlife; }); }
function uiTick(force) { hud(); updateTabs(); }

// ── loop ──
function resize() { const v = $('.view'), w = v.clientWidth, h = v.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); $('#hud').style.top = `${$('.bar').offsetHeight + 18}px`; }
new ResizeObserver(resize).observe($('.view'));
const clock = new THREE.Clock(); let uiT = 0, t = 0;
function loop() {
  const dt = Math.min(0.05, clock.getDelta()); t += dt;
  if (state.playing) { state.year = Math.min(Y1, state.year + dt * state.rate * 0.8); if (state.year >= Y1) { state.playing = false; $('#play').textContent = '▶'; } $('#yearIn').value = state.year; refreshYear(); }
  if (map.group.visible) {
    animateTrees(map.U, dt);
    for (const m of models) { const on = m.p.status === 'built' && state.year >= m.p.year; m.grow += ((on ? 1 : 0) - m.grow) * Math.min(1, dt * 2); m.g.visible = m.grow > 0.02; m.g.children[0].scale.setScalar(m.p.path ? 1 : Math.max(0.01, m.grow)); if (m.p.path) m.g.children[0].scale.set(1, Math.max(0.01, m.grow), 1);
      const age = state.year - m.p.year; m.ring.material.opacity = on && age < 1.5 ? 0.85 * (1 - age / 1.5) : 0; m.ring.scale.setScalar(1 + age * 1.5); }
  }
  for (const [k, s] of Object.entries(sites)) if (s.G.visible) { const S = SITES[k], R = runOf(state.sc), P = R.projects.find((p) => p.id === S.project), p2 = R.projects.find((p) => p.id === `${S.project}-2`); s.status = updateSite(k, s, state.year, P, state.sc, dt, t, { lag: SCENARIOS[state.sc].lag, survival: SCENARIOS[state.sc].survival, phase2: p2 && p2.status === 'built' ? p2.year : null }); }
  if (camAnim) { camAnim.u = Math.min(1, camAnim.u + dt * 1.2); const e = camAnim.u * camAnim.u * (3 - 2 * camAnim.u); camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (camAnim.u >= 1) camAnim = null; }
  uiT += dt; if (uiT > 0.5) { uiT = 0; hud(); }
  controls.update(); renderer.render(scene, camera);
  mapLabels(); const v = $('.view'); labels.frame(v.clientWidth, v.clientHeight, state.layers.labels);
  requestAnimationFrame(loop);
}

// ── start ──
resize(); renderLeft(); buildProjects(); buildTabs(); setView(state.view, true); refreshYear(true); animateTrees(map.U, 0, true); applyLayers();
for (const m of models) m.grow = m.p.status === 'built' && state.year >= m.p.year ? 1 : 0;
$$('.tabs button').find((b) => b.dataset.tab === state.tab)?.click();
$('#play').textContent = state.playing ? '❚❚' : '▶';
loop();
setTimeout(() => $('#loader').classList.add('done'), 300);
window.__vm = {   // handle for automated browser tests
  state, sites, setView, runOf, setYear: (y) => { state.year = y; state.playing = false; refreshYear(true); animateTrees(map.U, 0, true); for (const m of models) m.grow = m.p.status === 'built' && y >= m.p.year ? 1 : 0; for (const [k, s] of Object.entries(sites)) if (s.G.visible) for (let i = 0; i < 30; i++) updateSite(k, s, y, runOf(state.sc).projects.find((p) => p.id === SITES[k].project), state.sc, 0.5, i, { lag: SCENARIOS[state.sc].lag, survival: SCENARIOS[state.sc].survival }); },
  setSc: (sc) => { state.sc = sc; renderLeft(); buildProjects(); refreshYear(true); buildTabs(); }, camera, controls, snap: () => { if (camAnim) camAnim.u = 0.999; },
};
