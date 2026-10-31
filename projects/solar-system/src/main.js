import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AU, ELEMENTS, julian, planetPosition, orbitPath, moonPosition, gmst, OBLIQUITY } from './ephemeris.js';
import { BODIES, byId } from './bodies.js';

/*
 * Units: kilometres. Ecliptic J2000 (X, Y, Z) maps to three.js (x, y, z) = (X, Z, −Y),
 * so the ecliptic plane is horizontal and ecliptic north is up.
 *
 * Floating origin: every frame the focused body is placed at (0, 0, 0) and the rest of
 * the system is positioned relative to it in double precision before handing float32
 * values to the GPU — that keeps a 6,000-km moon sharp 40 AU from the Sun.
 */

const $ = (s) => document.querySelector(s);
const D2R = Math.PI / 180;
const J2000 = 2451545.0;
const toThree = (p, out) => out.set(p.x, p.z, -p.y);

// ── Renderer ───────────────────────────────────────────────────────────────
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020308);
const camera = new THREE.PerspectiveCamera(45, 1, 1, 2e11);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.zoomSpeed = 1.4;
controls.rotateSpeed = 0.6;
controls.target.set(0, 0, 0);
controls.enablePan = false;
const labelRenderer = new CSS2DRenderer({ element: $('#labels') });
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.7, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ── Lights ─────────────────────────────────────────────────────────────────
const sunLight = new THREE.PointLight(0xffffff, 3.2, 0, 0);
scene.add(sunLight);
const ambient = new THREE.AmbientLight(0xffffff, 1.6);
scene.add(ambient);

// ── Stars (at "infinity", follow the camera) ───────────────────────────────
{
  const N = 9000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    // concentrate some stars toward a galactic band
    const band = rnd() < 0.35 ? (rnd() - 0.5) * 0.25 : u;
    const ss = Math.sqrt(1 - band * band);
    pos.set([Math.cos(th) * (rnd() < 0.35 ? ss : s), rnd() < 0.35 ? band : u, Math.sin(th) * (rnd() < 0.35 ? ss : s)].map((v) => v * 1e11), i * 3);
    const b = 0.22 + Math.pow(rnd(), 5) * 0.66, t = rnd();   // stay under the bloom threshold
    col.set((t < 0.15 ? [1, 0.82, 0.7] : t < 0.3 ? [0.75, 0.85, 1] : [1, 1, 1]).map((v) => v * b), i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  var stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
  stars.frustumCulled = false;
  scene.add(stars);
}

// ── Bodies ─────────────────────────────────────────────────────────────────
const loader = new THREE.TextureLoader();
function tex(url, srgb = true) {
  return new Promise((res) => loader.load(url, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, () => res(null)));
}
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const DOT = dotTexture();

const objs = {};    // id → { def, group, tilt, spin, mesh, marker, label, world: {x,y,z} }
for (const b of BODIES) {
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  group.add(tilt);
  tilt.add(spin);
  tilt.rotation.x = (b.tilt || 0) * D2R;
  const seg = b.type === 'Moon' ? 48 : 96;
  const geo = new THREE.SphereGeometry(b.radius, seg, seg / 2);
  let mat;
  if (b.id === 'sun') {
    mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 1.1) });
  } else {
    mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(b.color), roughness: 1, metalness: 0 });
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.id = b.id;
  spin.add(mesh);
  if (b.tex) tex(b.tex).then((t) => { if (t) { mat.map = t; mat.color.set(b.id === 'sun' ? new THREE.Color(1.6, 1.4, 1.1) : 0xffffff); mat.needsUpdate = true; } });
  if (b.clouds) {
    const cm = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.85, depthWrite: false, roughness: 1 });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(b.radius * 1.008, 96, 48), cm);
    spin.add(clouds);
    tex(b.clouds).then((t) => { if (t) { cm.map = t; cm.needsUpdate = true; } });
  }
  if (b.id === 'sun') {
    // Corona glow
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,230,170,0.9)'); grd.addColorStop(0.25, 'rgba(255,170,80,0.35)'); grd.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.setScalar(b.radius * 6);
    group.add(glow);
    const far = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, sizeAttenuation: false, opacity: 0.85 }));
    far.scale.setScalar(0.09);
    group.add(far);
  }
  if (b.rings) {
    const r = b.rings;
    const rg = new THREE.RingGeometry(r.inner, r.outer, 160, 1);
    const p = rg.attributes.position, uv = rg.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv.setXY(i, (v.length() - r.inner) / (r.outer - r.inner), 0.5); }
    const rm = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, transparent: true, roughness: 1, color: 0xd9c9a8, opacity: 0.9, depthWrite: false });
    const ring = new THREE.Mesh(rg, rm);
    ring.rotation.x = -Math.PI / 2;
    tilt.add(ring);
    tex(r.color).then((t) => { if (t) { rm.map = t; rm.color.set(0xffffff); rm.needsUpdate = true; } });
    tex(r.alpha, false).then((t) => { if (t) { rm.alphaMap = t; rm.needsUpdate = true; } });
  }
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: new THREE.Color(b.color), sizeAttenuation: false, depthTest: false, transparent: true }));
  marker.scale.setScalar(b.type === 'Moon' ? 0.012 : 0.018);
  marker.renderOrder = 5;
  group.add(marker);
  const el = document.createElement('div');
  el.className = `lbl${b.type === 'Moon' ? ' moon' : ''}`;
  el.style.setProperty('--c', b.color);
  el.textContent = b.name;
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); focusOn(b.id); });
  const label = new CSS2DObject(el);
  group.add(label);
  scene.add(group);
  objs[b.id] = { def: b, group, tilt, spin, mesh, marker, label, world: { x: 0, y: 0, z: 0 } };
}

// Orbit lines (recomputed when the date drifts far)
const orbitLines = {};
const PLANETS = BODIES.filter((b) => !b.parent && b.id !== 'sun').map((b) => b.id);
function buildOrbits(jd) {
  for (const id of PLANETS) {
    const pts = orbitPath(id, jd, 512);
    let line = orbitLines[id];
    if (!line) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.length * 3), 3));
      line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(byId[id].color), transparent: true, opacity: 0.45 }));
      line.frustumCulled = false;
      scene.add(line);
      orbitLines[id] = line;
    }
    line.userData.pts = pts;
    line.userData.parent = null;
  }
  // Moon orbits: circles around their parent (Moon: mean distance in the ecliptic, ≈ 5° tilt ignored)
  for (const b of BODIES.filter((x) => x.parent)) {
    if (orbitLines[b.id]) continue;
    const a = b.a || 384400;
    const pts = [];
    for (let i = 0; i <= 256; i++) {
      const th = (i / 256) * Math.PI * 2;
      pts.push({ x: a * Math.cos(th), y: a * Math.sin(th), z: 0, local: true });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.length * 3), 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(b.color), transparent: true, opacity: 0.35 }));
    line.frustumCulled = false;
    line.userData = { pts, parent: b.parent, moon: b };
    scene.add(line);
    orbitLines[b.id] = line;
  }
}

// Main asteroid belt — illustrative: 5,000 particles on Keplerian circles, 2.2–3.3 AU
const belt = (() => {
  const N = 4000, r = new Float32Array(N), th = new Float32Array(N), z = new Float32Array(N), pos = new Float32Array(N * 3);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) { r[i] = 2.2 + Math.pow(rnd(), 0.8) * 1.1; th[i] = rnd() * Math.PI * 2; z[i] = (rnd() - 0.5) * 0.25 * r[i]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('r', new THREE.BufferAttribute(r, 1));
  g.setAttribute('th', new THREE.BufferAttribute(th, 1));
  g.setAttribute('zz', new THREE.BufferAttribute(z, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { days: { value: 0 }, origin: { value: new THREE.Vector3() }, au: { value: AU }, opacity: { value: 0.32 } },
    vertexShader: `attribute float r; attribute float th; attribute float zz; uniform float days; uniform vec3 origin; uniform float au;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){
        float n = 0.0172021 / pow(r, 1.5);           // rad/day (Kepler's third law)
        float a = th + n * days;
        vec3 p = vec3(r * cos(a), zz, -r * sin(a)) * au - origin;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 1.3;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform float opacity;
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        gl_FragColor = vec4(0.62, 0.57, 0.5, opacity);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
})();

// ── State ──────────────────────────────────────────────────────────────────
const RATES = [
  [-31557600, '−1 yr/s'], [-2629800, '−1 mo/s'], [-86400, '−1 day/s'], [-3600, '−1 hr/s'],
  [0, '❚❚'], [1, '1×'], [60, '1 min/s'], [3600, '1 hr/s'], [86400, '1 day/s'], [604800, '1 wk/s'], [2629800, '1 mo/s'], [31557600, '1 yr/s'],
];
const MIN_MS = Date.UTC(1800, 0, 1), MAX_MS = Date.UTC(2050, 0, 1);
const state = { ms: Date.now(), rate: 1, live: true, focus: 'sun', flood: true, orbits: true, labels: true, orbitJd: 0 };
const origin = { x: 0, y: 0, z: 0 };
let fly = null;

// ── Positions ──────────────────────────────────────────────────────────────
const tmp = {};
function computeWorld(jd) {
  objs.sun.world = { x: 0, y: 0, z: 0 };
  for (const id of PLANETS) objs[id].world = planetPosition(id, jd, {});
  const e = objs.earth.world;
  const m = moonPosition(jd, tmp);
  objs.moon.world = { x: e.x + m.x, y: e.y + m.y, z: e.z + m.z };
  // Galilean moons & Titan: circular orbits in the parent's equatorial plane (approximate phase)
  for (const b of BODIES.filter((x) => x.approx)) {
    const p = objs[b.parent];
    const th = ((jd - J2000) / b.period) * Math.PI * 2;
    const tl = p.def.tilt * D2R;
    // local (three axes) → ecliptic: tilt about the three x axis
    const lx = b.a * Math.cos(th), lz = -b.a * Math.sin(th);
    const ty = -lz * Math.sin(tl), tz = lz * Math.cos(tl);
    objs[b.id].world = { x: p.world.x + lx, y: p.world.y - tz, z: p.world.z + ty };
  }
}
const _v = new THREE.Vector3();
function rel(world, out) { return toThree({ x: world.x - origin.x, y: world.y - origin.y, z: world.z - origin.z }, out); }

// ── Focus & camera flights ─────────────────────────────────────────────────
function viewDistance(id, mode = 'close') {
  const b = byId[id];
  if (mode === 'orbit') {
    if (b.parent) return (b.a || 384400) * 3.2;
    const w = objs[id].world;
    return Math.hypot(w.x, w.y, w.z) * 2.6;
  }
  if (id === 'sun') return 6.5 * AU;
  return b.radius * (b.rings ? 7 : 4.2);
}
function focusOn(id, mode = 'close') {
  const target = mode === 'orbit' && !byId[id].parent ? 'sun' : mode === 'orbit' ? byId[id].parent : id;
  const camWorld = { x: origin.x, y: origin.y, z: origin.z };
  const cl = camera.position;
  // camera.position is in three axes relative to origin: convert back to ecliptic
  camWorld.x += cl.x; camWorld.y += -cl.z; camWorld.z += cl.y;
  const nw = objs[target].world;
  const start = toThree({ x: camWorld.x - nw.x, y: camWorld.y - nw.y, z: camWorld.z - nw.z }, new THREE.Vector3());
  const dist = mode === 'home' ? 6.5 * AU : viewDistance(id, mode);
  let dir = start.clone().normalize();
  if (!isFinite(dir.x) || dir.lengthSq() < 0.5) dir.set(0.3, 0.5, 1).normalize();
  if (mode === 'home') dir.set(0.35, 0.55, 0.76).normalize();
  else if (id === 'sun' && mode !== 'orbit') dir.set(0.35, 0.55, 0.76).normalize();
  if (dir.y < 0.25) dir.y = 0.25;
  dir.normalize();
  fly = { target, from: start, to: dir.multiplyScalar(dist), t0: performance.now(), dur: 2400 };
  state.focus = target;
  controls.minDistance = byId[target].radius * 1.15;
  if (mode === 'home') $('#info').hidden = true; else showInfo(id);
  history.replaceState(null, '', `#/${mode === 'home' ? 'home' : id}?lighting=${state.flood ? 'flood' : 'natural'}`);
  document.querySelectorAll('#quick button').forEach((b) => b.classList.toggle('active', b.dataset.id === id && mode !== 'home'));
}
function updateFly() {
  if (!fly) return;
  const k = Math.min(1, (performance.now() - fly.t0) / fly.dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const d0 = fly.from.length(), d1 = fly.to.length();
  const d = Math.exp(Math.log(d0) + (Math.log(d1) - Math.log(d0)) * e);
  const dir = fly.from.clone().normalize().lerp(fly.to.clone().normalize(), e).normalize();
  camera.position.copy(dir.multiplyScalar(d));
  if (k >= 1) fly = null;
}

// ── UI ─────────────────────────────────────────────────────────────────────
const fmtKm = (km) => (km > 0.1 * AU ? `${(km / AU).toFixed(3)} AU` : `${Math.round(km).toLocaleString('en-US')} km`);
function lightTime(km) {
  const s = km / 299792.458;
  return s < 120 ? `${s.toFixed(1)} s` : s < 7200 ? `${(s / 60).toFixed(1)} min` : `${(s / 3600).toFixed(2)} h`;
}
function showInfo(id) {
  const b = byId[id];
  $('#info').hidden = false;
  $('#info-type').textContent = b.parent ? `Moon of ${byId[b.parent].name}` : b.type;
  $('#info-name').textContent = b.name;
  const kv = [
    ['Radius', `${b.radius.toLocaleString('en-US')} km`],
    ['Mass', `${b.mass.toLocaleString('en-US')} × 10²⁴ kg`],
    ['Day (sidereal)', b.rotation ? `${Math.abs(b.rotation) > 72 ? (Math.abs(b.rotation) / 24).toFixed(1) + ' d' : Math.abs(b.rotation).toFixed(1) + ' h'}${b.rotation < 0 ? ' retro' : ''}` : 'tidally locked'],
    ['Orbit', b.period ? (b.period > 800 ? `${(b.period / 365.25).toFixed(1)} yr` : `${b.period} d`) : '—'],
    ['Axial tilt', b.tilt != null ? `${b.tilt}°` : '—'],
    ['Type', b.type],
  ];
  $('#info-kv').innerHTML = kv.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('#info-fact').textContent = b.fact + (b.approx ? ' (Moon position approximate: circular orbit, nominal phase.)' : '');
  $('#info').dataset.id = id;
}
function updateLive() {
  const id = $('#info').dataset.id;
  if (!id || $('#info').hidden) return;
  const w = objs[id].world, e = objs.earth.world;
  const ds = Math.hypot(w.x, w.y, w.z);
  const de = Math.hypot(w.x - e.x, w.y - e.y, w.z - e.z);
  const rows = [];
  if (id !== 'sun') rows.push(['Distance from Sun', fmtKm(ds)]);
  if (id !== 'earth') rows.push(['Distance from Earth', fmtKm(de)], ['Light time from Earth', lightTime(de)]);
  if (objs[id].speed) rows.push(['Orbital speed', `${objs[id].speed.toFixed(2)} km/s`]);
  $('#info-live').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('');
}
$('#info-close').addEventListener('click', () => { $('#info').hidden = true; });
$('#info-orbit').addEventListener('click', () => focusOn($('#info').dataset.id, 'orbit'));
$('#info-zoom').addEventListener('click', () => focusOn($('#info').dataset.id));
$('#home').addEventListener('click', () => focusOn('sun', 'home'));

$('#quick').innerHTML = BODIES.filter((b) => !b.parent).map((b) => `<button data-id="${b.id}" style="--c:${b.color}"><i></i>${b.name}</button>`).join('');
$('#quick').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (b) focusOn(b.dataset.id); });

const search = $('#search'), results = $('#results');
let sel = 0;
function renderResults() {
  const q = search.value.trim().toLowerCase();
  const list = BODIES.filter((b) => !q || b.name.toLowerCase().includes(q) || b.type.toLowerCase().includes(q));
  results.hidden = !list.length || document.activeElement !== search;
  sel = Math.min(sel, list.length - 1);
  results.innerHTML = list.map((b, i) => `<li data-id="${b.id}" class="${i === sel ? 'sel' : ''}">${b.name}<span>${b.parent ? 'Moon · ' + byId[b.parent].name : b.type}</span></li>`).join('');
}
search.addEventListener('focus', renderResults);
search.addEventListener('input', () => { sel = 0; renderResults(); });
search.addEventListener('blur', () => setTimeout(() => { results.hidden = true; }, 150));
search.addEventListener('keydown', (e) => {
  const items = [...results.querySelectorAll('li')];
  if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); renderResults(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); renderResults(); e.preventDefault(); }
  if (e.key === 'Enter' && items[sel]) { focusOn(items[sel].dataset.id); search.value = ''; search.blur(); }
});
results.addEventListener('pointerdown', (e) => { const li = e.target.closest('li'); if (li) { focusOn(li.dataset.id); search.value = ''; } });

$('#rates').innerHTML = RATES.map(([r, l]) => `<button data-r="${r}" class="${r === 0 ? 'pause' : ''}">${l}</button>`).join('');
function setRate(r) {
  state.rate = r;
  if (r !== 1) state.live = false;
  document.querySelectorAll('#rates button').forEach((b) => b.classList.toggle('active', +b.dataset.r === r));
  $('#rate-label').textContent = r === 0 ? 'Paused' : r === 1 ? (state.live ? 'Real time · live' : 'Real time') : `${RATES.find((x) => x[0] === r)[1]} · ${r > 0 ? 'forward' : 'reverse'}`;
  $('#live').classList.toggle('on', state.live);
}
$('#rates').addEventListener('click', (e) => { const b = e.target.closest('button[data-r]'); if (b) setRate(+b.dataset.r); });
$('#live').addEventListener('click', () => { state.ms = Date.now(); state.live = true; setRate(1); });

function applyToggles() {
  ambient.intensity = state.flood ? 1.6 : 0.025;
  sunLight.intensity = state.flood ? 1.4 : 3.2;
  document.querySelector('[data-t="flood"]').classList.toggle('active', state.flood);
  document.querySelector('[data-t="orbits"]').classList.toggle('active', state.orbits);
  document.querySelector('[data-t="labels"]').classList.toggle('active', state.labels);
  Object.values(orbitLines).forEach((l) => { l.visible = state.orbits; });
  belt.visible = state.orbits;
  $('#labels').classList.toggle('off', !state.labels);
}
document.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
  state[b.dataset.t] = !state[b.dataset.t];
  applyToggles();
  if (b.dataset.t === 'flood') history.replaceState(null, '', `#/${$('#info').dataset.id || state.focus}?lighting=${state.flood ? 'flood' : 'natural'}`);
}));

// Click a planet's sphere to focus it
const ray = new THREE.Raycaster();
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects(Object.values(objs).map((o) => o.mesh), false)[0];
  if (hit) focusOn(hit.object.userData.id);
});
addEventListener('keydown', (e) => {
  if (e.target === search) return;
  if (e.key === ' ') { e.preventDefault(); setRate(state.rate === 0 ? 1 : 0); }
});

// ── Frame ──────────────────────────────────────────────────────────────────
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const GM_SUN = 1.32712440018e11;   // km³/s²
const clock = new THREE.Clock();
let lastUi = 0, first = true;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (state.live) state.ms = Date.now();
  else state.ms += dt * 1000 * state.rate;
  if (state.ms < MIN_MS || state.ms > MAX_MS) { state.ms = THREE.MathUtils.clamp(state.ms, MIN_MS, MAX_MS); setRate(0); }
  const jd = julian(state.ms);
  if (Math.abs(jd - state.orbitJd) > 3650) { buildOrbits(jd); state.orbitJd = jd; applyToggles(); }

  computeWorld(jd);
  // Orbital speed from the vis-viva equation: v² = GM (2/r − 1/a)
  for (const id of PLANETS) {
    const w = objs[id].world, r = Math.hypot(w.x, w.y, w.z);
    objs[id].speed = Math.sqrt(GM_SUN * (2 / r - 1 / (ELEMENTS[id][0][0] * AU)));
  }
  const f = objs[state.focus].world;
  origin.x = f.x; origin.y = f.y; origin.z = f.z;

  // Place bodies, orient them
  const camDist = camera.position.length();
  for (const o of Object.values(objs)) {
    rel(o.world, o.group.position);
    const b = o.def;
    if (b.id === 'earth') {
      // mesh → ECEF → ECI (GMST) → ecliptic (obliquity) → three
      const g = gmst(jd), ce = Math.cos(OBLIQUITY), se = Math.sin(OBLIQUITY);
      const P = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
      const Rz = new THREE.Matrix4().makeRotationZ(g);
      const E = new THREE.Matrix4().set(1, 0, 0, 0, 0, ce, se, 0, 0, -se, ce, 0, 0, 0, 0, 1);
      const T = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
      o.tilt.rotation.set(0, 0, 0);
      o.spin.quaternion.setFromRotationMatrix(T.multiply(E).multiply(Rz).multiply(P));
    } else if (b.id === 'moon') {
      const e = objs.earth.world, w = o.world;
      const toEarth = toThree({ x: e.x - w.x, y: e.y - w.y, z: e.z - w.z }, _v).normalize();
      o.tilt.rotation.set(0, 0, 0);
      o.spin.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), toEarth);
    } else if (b.rotation) {
      o.spin.rotation.y = (((jd - J2000) * 24) / b.rotation) * Math.PI * 2 % (Math.PI * 2);
    }
    // Marker when the body is too small to see; moon labels only near their planet
    const d = o.group.position.distanceTo(camera.position);
    const ang = b.radius / Math.max(d, 1);
    o.marker.visible = ang < 0.004 && b.id !== 'sun';
    let showLabel = true;
    if (b.parent) {
      const pd = objs[b.parent].group.position.distanceTo(camera.position);
      showLabel = pd < byId[b.parent].radius * (b.parent === 'earth' ? 900 : 450);
      o.marker.visible = o.marker.visible && showLabel;
    }
    o.label.element.classList.toggle('hide', !showLabel || ang > 0.08);
  }
  sunLight.position.copy(objs.sun.group.position);
  stars.position.copy(camera.position);

  // Orbit lines relative to the floating origin
  for (const line of Object.values(orbitLines)) {
    const { pts, parent } = line.userData;
    const a = line.geometry.attributes.position;
    const pw = parent ? objs[parent].world : null;
    const tl = parent ? byId[parent].tilt * D2R : 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      let x = p.x, y = p.y, z = p.z;
      if (parent) {
        if (parent !== 'earth') { const ly = y; y = ly * Math.cos(tl); z = ly * Math.sin(tl); }
        x += pw.x; y += pw.y; z += pw.z;
      }
      a.setXYZ(i, x - origin.x, z - origin.z, -(y - origin.y));
    }
    a.needsUpdate = true;
    if (parent) line.visible = state.orbits && objs[parent].group.position.distanceTo(camera.position) < byId[parent].radius * 900;
  }
  belt.material.uniforms.days.value = jd - J2000;
  toThree(origin, belt.material.uniforms.origin.value);

  updateFly();
  controls.update(dt);
  composer.render();
  labelRenderer.render(scene, camera);

  const now = performance.now();
  if (now - lastUi > 100) {
    lastUi = now;
    const d = new Date(state.ms);
    $('#date').textContent = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })} · ${d.toISOString().slice(11, 19)} UTC`;
    updateLive();
  }
  if (first) { first = false; setTimeout(() => $('#loader').classList.add('done'), 400); }
  requestAnimationFrame(frame);
}

// ── Boot: #/body?lighting=flood|natural ─────────────────────────────────────
const [, hashBody, hashQuery] = location.hash.match(/^#\/([a-z]+)?\??(.*)$/) || [];
const q = new URLSearchParams(hashQuery || location.search.slice(1));
if (q.get('lighting') === 'natural' || q.get('lighting') === 'shadow') state.flood = false;
if (q.has('date')) { const t = Date.parse(q.get('date')); if (!isNaN(t)) { state.ms = t; state.live = false; } }
if (q.has('rate')) state.live = false;
computeWorld(julian(state.ms));
buildOrbits(julian(state.ms));
state.orbitJd = julian(state.ms);
applyToggles();
setRate(q.has('rate') ? +q.get('rate') : 1);
camera.position.set(0.35, 0.55, 0.76).normalize().multiplyScalar(6.5 * AU);
const startBody = byId[hashBody] ? hashBody : 'sun';
if (startBody !== 'sun') {
  camera.position.multiplyScalar(1);
  focusOn(startBody);
  fly.dur = 3600;
} else {
  controls.minDistance = byId.sun.radius * 1.15;
  if (hashBody === 'sun') showInfo('sun');
}
window.__solar = { state, focusOn, camera, objs };
requestAnimationFrame(frame);
