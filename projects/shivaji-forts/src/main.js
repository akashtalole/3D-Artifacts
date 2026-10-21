import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { FORTS, TIMELINE, CITIES, UNESCO_NOTE } from './forts.js';
import { FORT_DEM, MAP_DEM } from './terrain-meta.js';
import { buildFort, SEASONS } from './fortscene.js';
import { buildMap } from './mapscene.js';
import { sunPosition, sunDir, istToUtc } from './sky.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BY = Object.fromEntries(FORTS.map((f) => [f.id, { ...f, lat: FORT_DEM[f.id].lat, lon: FORT_DEM[f.id].lon }]));
const KIND = { hill: ['⛰', 'Hill fort'], 'hill-forest': ['⛰', 'Hill-forest fort'], 'hill-plateau': ['⛰', 'Hill-plateau fort'], island: ['🌊', 'Island fort'], coastal: ['⚓', 'Coastal fort'] };

// ── Renderer & scenes ──────────────────────────────────────────────────────
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const labelRenderer = new CSS2DRenderer({ element: $('#labels') });
labelRenderer.setSize(innerWidth, innerHeight);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 200000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.48;

// Map scene
const mapScene = new THREE.Scene();
mapScene.background = new THREE.Color('#0d1720');
mapScene.fog = new THREE.Fog('#0d1720', 500, 1400);
mapScene.add(new THREE.HemisphereLight('#dfe9ff', '#3a2a1a', 0.9));
const mapSun = new THREE.DirectionalLight('#fff2dc', 2.2); mapSun.position.set(-300, 400, -200); mapScene.add(mapSun);

// Fort scene
const fortScene = new THREE.Scene();
const sky = new Sky(); sky.scale.setScalar(150000); fortScene.add(sky);
const skyU = sky.material.uniforms;
skyU.turbidity.value = 6; skyU.rayleigh.value = 1.6; skyU.mieCoefficient.value = 0.006; skyU.mieDirectionalG.value = 0.85;
const sun = new THREE.DirectionalLight('#fff1dc', 3);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 1.5;
fortScene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cfe1ff', '#5a4630', 0.5); fortScene.add(hemi);
fortScene.fog = new THREE.FogExp2('#b9c6cf', 0.00012);

// ── State ──────────────────────────────────────────────────────────────────
const state = { view: 'map', fortId: null, season: 'monsoon', hour: 9, tour: false, labels: true, tl: 0, playing: false, activeFort: null };
let map = null, fort = null, loadingId = null;
const sunV = new THREE.Vector3();

// ── UI scaffolding ─────────────────────────────────────────────────────────
$('#fort').innerHTML = `<option value="">Choose a fort…</option>${FORTS.map((f) => `<option value="${f.id}">${f.mr} · ${f.name}</option>`).join('')}`;
$('#season').innerHTML = Object.entries(SEASONS).map(([k, s]) => `<button data-s="${k}">${s.label}</button>`).join('');
$('#list').innerHTML = `<h3>14 forts</h3>${FORTS.map((f) => `<button class="fcard" data-f="${f.id}"><span class="ic">${KIND[f.kind][0]}</span><span><b>${f.mr}</b><small>${f.name}${f.unesco ? '<span class="badge">UNESCO</span>' : ''}</small></span></button>`).join('')}`;
$('#list').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) openFort(b.dataset.f); });
$('#fort').addEventListener('change', (e) => { if (e.target.value) openFort(e.target.value); });
$('#home').addEventListener('click', () => openMap());
$('#season').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) setSeason(b.dataset.s); });
$('#hour').addEventListener('input', (e) => { state.hour = +e.target.value; syncHour(); updateHash(); });
$('#t-tour').addEventListener('click', () => { state.tour = !state.tour; $('#t-tour').classList.toggle('active', state.tour); controls.autoRotate = state.tour; controls.autoRotateSpeed = 0.6; });
$('#t-labels').addEventListener('click', () => { state.labels = !state.labels; $('#t-labels').classList.toggle('active', state.labels); $('#labels').classList.toggle('off', !state.labels); });
function syncHour() { const h = Math.floor(state.hour), m = Math.round((state.hour - h) * 60); $('#hour-l').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; $('#hour').value = state.hour; }
function setSeason(s) {
  state.season = s;
  document.querySelectorAll('#season button').forEach((b) => b.classList.toggle('active', b.dataset.s === s));
  fort?.setSeason(s);
  updateHash();
}
function updateHash() {
  const q = `season=${state.season}&hour=${state.hour}`;
  history.replaceState(null, '', state.view === 'map' ? `#/map?${q}` : `#/fort/${state.fortId}?${q}`);
}

// ── Panels ─────────────────────────────────────────────────────────────────
function fortPanel(f) {
  const i = fort?.info;
  const idx = FORTS.findIndex((x) => x.id === f.id);
  const prev = FORTS[(idx - 1 + FORTS.length) % FORTS.length], next = FORTS[(idx + 1) % FORTS.length];
  $('#panel').innerHTML = `
    <div class="kicker">${KIND[f.kind][1]} · ${esc(f.district)}</div>
    <h1>${f.mr}</h1><h2>${esc(f.name)}</h2>
    <p>${esc(f.summary)}</p>
    ${i ? `<dl class="stats"><div><dt>Summit (terrain)</dt><dd>${Math.round(i.summit)} m</dd></div><div><dt>Walls traced</dt><dd>${(i.perimeter / 1000).toFixed(1)} km</dd></div><div><dt>Enclosed</dt><dd>${Math.round(i.areaHa)} ha</dd></div></dl>` : ''}
    <h4>Key events</h4><div class="events">${f.events.map(([y, t]) => `<div><b>${y}</b><span>${esc(t)}</span></div>`).join('')}</div>
    <h4>Highlights</h4><ul>${f.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
    ${f.unesco ? `<div class="unesco">UNESCO World Heritage · ${esc(UNESCO_NOTE)}</div>` : ''}
    <p class="note">Terrain and wall lines come from real elevation data. Buildings are simplified and placed indicatively, not surveyed.</p>
    <div class="nav"><button data-f="${prev.id}">← ${prev.mr}</button><button data-f="${next.id}">${next.mr} →</button></div>`;
}
$('#panel').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) openFort(b.dataset.f); });
function mapPanel() {
  const ev = TIMELINE[state.tl], f = ev.fort && BY[ev.fort];
  $('#panel').innerHTML = `
    <div class="kicker">Chhatrapati Shivaji Maharaj · 1630–1680</div>
    <h1>स्वराज्य</h1><h2>Forts of Swarajya</h2>
    <p>Hill forts on the basalt mesas of the Sahyadri and sea forts along the Konkan coast were the backbone of the Maratha state founded by Shivaji Maharaj. Eleven of them in Maharashtra are now part of a UNESCO World Heritage Site.</p>
    <h4>${ev.year}</h4><p><b>${esc(ev.text)}</b>${f ? `<br><span style="color:var(--muted)">${f.mr} · ${esc(f.name)}</span>` : ''}</p>
    ${f ? `<button class="cta" data-f="${f.id}">Explore ${f.mr} · ${esc(f.name)} in 3D →</button>` : ''}
    <p class="note">Relief from real elevation data (height ×8). Click a saffron flag to visit a fort.</p>`;
}

// ── Timeline ───────────────────────────────────────────────────────────────
$('#tl').max = TIMELINE.length - 1;
$('#tl-ticks').innerHTML = [1630, 1640, 1650, 1660, 1670, 1680].map((y) => `<span>${y}</span>`).join('');
function setTl(i) {
  state.tl = i; $('#tl').value = i;
  const ev = TIMELINE[i];
  $('#tl-year').textContent = ev.year; $('#tl-text').textContent = ev.text;
  state.activeFort = ev.fort;
  if (state.view === 'map') { mapPanel(); if (ev.fort && map) { const p = map.pins.find((x) => x.id === ev.fort).p; flyTo(p.clone().add(new THREE.Vector3(60, 140, 190)), p.clone(), 1600); } }
}
$('#tl').addEventListener('input', (e) => { state.playing = false; syncPlay(); setTl(+e.target.value); });
$('#tl-play').addEventListener('click', () => { state.playing = !state.playing; syncPlay(); if (state.playing) { if (state.tl >= TIMELINE.length - 1) setTl(0); tlT = 0; } });
function syncPlay() { $('#tl-ico').setAttribute('d', state.playing ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z'); }
let tlT = 0;

// ── Camera flights ─────────────────────────────────────────────────────────
let fly = null;
function flyTo(pos, target, dur = 2200) { fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, s: performance.now(), dur }; }
controls.addEventListener('start', () => { fly = null; });

// ── Views ──────────────────────────────────────────────────────────────────
async function openMap() {
  state.view = 'map'; state.fortId = null;
  $('#fort').value = ''; $('#timeline').classList.remove('hide');
  document.querySelectorAll('.fcard').forEach((b) => b.classList.remove('active'));
  if (!map) {
    map = await buildMap(MAP_DEM, './data/map.png', FORTS.map((f) => BY[f.id]), CITIES);
    mapScene.add(map.group);
    map.group.traverse((o) => { if (o.element?.classList.contains('pin')) o.element.addEventListener('click', () => openFort(o.element.dataset.fort)); });
  }
  if (fort) { fortScene.remove(fort.group); fort.labels.forEach((l) => l.element.remove()); fort.dispose(); fort = null; }
  mapScene.visible = true;
  camera.near = 0.5; camera.far = 5000; camera.updateProjectionMatrix();
  controls.minDistance = 20; controls.maxDistance = 1200;
  controls.autoRotate = false; state.tour = false; $('#t-tour').classList.remove('active');
  flyTo(new THREE.Vector3(-60, 330, 420), new THREE.Vector3(10, 0, 20), 1800);
  mapPanel(); updateHash();
}

async function openFort(id) {
  if (!BY[id] || loadingId === id) return;
  loadingId = id;
  state.playing = false; syncPlay();
  $('#loader').classList.remove('done'); $('#loader').classList.add('busy'); $('#loader-t').textContent = `Raising ${BY[id].name} from the terrain…`;
  const f = BY[id];
  const built = await buildFort(f, FORT_DEM[id], `./data/${id}.png`);
  if (loadingId !== id) return;          // another fort was chosen meanwhile
  if (fort) { fortScene.remove(fort.group); fort.labels.forEach((l) => l.element.remove()); fort.dispose(); }
  fort = built; fortScene.add(fort.group);
  fort.setSeason(state.season);
  state.view = 'fort'; state.fortId = id; loadingId = null;
  $('#fort').value = id; $('#timeline').classList.add('hide');
  document.querySelectorAll('.fcard').forEach((b) => b.classList.toggle('active', b.dataset.f === id));
  if (map) map.group.traverse((o) => { if (o.isCSS2DObject) o.element.style.display = 'none'; });
  camera.near = 2; camera.far = 200000; camera.updateProjectionMatrix();
  const r = Math.max(260, fort.radius);
  controls.minDistance = 40; controls.maxDistance = r * 9;
  const t = fort.target;
  camera.position.copy(t).add(new THREE.Vector3(r * 2.6, r * 1.9, r * 3.2));
  controls.target.copy(t);
  flyTo(t.clone().add(new THREE.Vector3(r * 0.95, r * 1.15, r * 1.2)), t.clone(), 2600);
  fortPanel(f); syncHour(); updateHash();
  $('#loader').classList.add('done'); $('#loader').classList.remove('busy');
}

// ── Loop ───────────────────────────────────────────────────────────────────
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
});
// map pin picking (3D flags)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (state.view !== 'map' || !map || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(map.pins.map((p) => p.hit))[0];
  if (hit) openFort(hit.object.userData.fort);
});

const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); elapsed += dt;
  if (fly) {
    const k = Math.min(1, (performance.now() - fly.s) / fly.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e);
    if (k >= 1) fly = null;
  }
  if (state.view === 'map' && map) {
    map.group.traverse((o) => { if (o.isCSS2DObject) o.element.style.display = ''; });
    map.update(elapsed, state.activeFort);
    if (state.playing) { tlT += dt; if (tlT > 3.6) { tlT = 0; if (state.tl < TIMELINE.length - 1) setTl(state.tl + 1); else { state.playing = false; syncPlay(); } } }
    controls.update();
    renderer.toneMappingExposure = 1.0;
    renderer.render(mapScene, camera);
    labelRenderer.render(mapScene, camera);
  } else if (fort) {
    const f = BY[state.fortId];
    const sp = sunPosition(istToUtc(SEASONS[state.season].date, state.hour), f.lat, f.lon);
    sunDir(sp, sunV);
    const S = SEASONS[state.season], day = Math.max(0, Math.min(1, (Math.sin(sp.el) + 0.05) / 0.3));
    skyU.sunPosition.value.copy(sunV);
    skyU.turbidity.value = 4 + S.wet * 8; skyU.rayleigh.value = 1.2 + S.wet * 1.2;
    sun.intensity = 3.2 * Math.pow(Math.max(0, Math.sin(sp.el)), 0.5) * (1 - 0.45 * S.wet);
    sun.color.setHSL(0.08, 0.7, 0.55 + 0.4 * Math.min(1, Math.sin(Math.max(0, sp.el)) * 2));
    hemi.intensity = 0.15 + 0.5 * day;
    const R = Math.max(400, fort.radius * 2.4);
    sun.position.copy(fort.target).addScaledVector(sunV, R * 3); sun.target.position.copy(fort.target);
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 10, far: R * 7 }); sun.shadow.camera.updateProjectionMatrix();
    fortScene.fog.color.setHSL(0.58, 0.12 + 0.1 * (1 - S.wet), 0.45 + 0.3 * day - 0.25 * (1 - day));
    fortScene.fog.density = 0.00004 + 0.00008 * S.wet;
    renderer.toneMappingExposure = 0.72 + 0.2 * (1 - day);
    fort.update(elapsed, dt, sunV);
    controls.update();
    renderer.render(fortScene, camera);
    labelRenderer.render(fortScene, camera);
  }
  requestAnimationFrame(frame);
}

// ── Start ──────────────────────────────────────────────────────────────────
const m = location.hash.match(/^#\/(map|fort)(?:\/([a-z]+))?\??(.*)$/) || [];
const q = new URLSearchParams(m[3] || '');
if (SEASONS[q.get('season')]) state.season = q.get('season');
if (q.has('hour')) state.hour = Math.min(19, Math.max(5.5, +q.get('hour') || 9));
setSeason(state.season); syncHour(); setTl(0);
await openMap();
$('#loader').classList.add('done');
if (m[1] === 'fort' && BY[m[2]]) openFort(m[2]);
requestAnimationFrame(frame);
window.__forts = { state, openFort, openMap, camera, controls, get fort() { return fort; }, get map() { return map; }, setTl };
