/**
 * One fort, on its real terrain (metres; x east, y up, z south; origin = crop centre).
 * Walls are traced from the elevation data: rays cast from the summit stop where the
 * ground falls `drop` metres below it (or reaches the sea). Buildings are indicative.
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Water } from 'three/addons/objects/Water.js';
import { loadDem } from './dem.js';

export const SEASONS = {
  monsoon: { label: 'Monsoon', date: '2026-07-20', grass: ['#3d7a22', '#5d9b31'], forest: '#28531b', tree: ['#2f6b22', '#3b7d29', '#4a8d2f'], treeDensity: 1, mist: 1, wet: 1 },
  winter: { label: 'Winter', date: '2026-12-15', grass: ['#788a3d', '#a39552'], forest: '#3b5622', tree: ['#3c6327', '#56702f', '#7a7a38'], treeDensity: 0.85, mist: 0.35, wet: 0.3 },
  summer: { label: 'Summer', date: '2026-04-20', grass: ['#a7865a', '#c3a46c'], forest: '#5b5a2e', tree: ['#5f6d33', '#7b6b3b', '#4f6430'], treeDensity: 0.6, mist: 0, wet: 0 },
};

const STONE = '#6f665c', STONE_LIGHT = '#9a8f80', BASALT = '#4a4541', LATERITE = '#7a4b37', SAFFRON = '#ff7a00';
const mats = {};
const M = (c, r = 0.9, m = 0) => (mats[`${c}${r}${m}`] ||= new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }));

function rng(seed) { let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (hash2(xi, yi) * (1 - u) + hash2(xi + 1, yi) * u) * (1 - v) + (hash2(xi, yi + 1) * (1 - u) + hash2(xi + 1, yi + 1) * u) * v;
}

function label(text, sub, cls = '') {
  const el = document.createElement('div');
  el.className = `lbl ${cls}`;
  el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
  return new CSS2DObject(el);
}

/** Swallow-tailed saffron flag (Bhagwa Dhwaj) on a pole; returns { group, update(t) }. */
function bhagwa(height = 14) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, height, 8), M('#d9d2c4', 0.5, 0.4));
  pole.position.y = height / 2; g.add(pole);
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 256, 0); grd.addColorStop(0, '#ff8c1a'); grd.addColorStop(1, '#ff6a00');
  x.fillStyle = grd; x.beginPath(); x.moveTo(0, 0); x.lineTo(256, 0); x.lineTo(176, 64); x.lineTo(256, 128); x.lineTo(0, 128); x.closePath(); x.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(7, 3.4, 24, 6).translate(3.5, 0, 0);
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.y = height - 1.9; flag.castShadow = true; g.add(flag);
  const base = geo.attributes.position.array.slice();
  return {
    group: g,
    update(t) {
      const a = geo.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { const u = base[i] / 7; a[i + 2] = Math.sin(base[i] * 1.1 - t * 5) * 0.35 * u; a[i + 1] = base[i + 1] - u * u * 0.4; }
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    },
  };
}

// ── Building kit (metres, origin at ground) ────────────────────────────────
function box(w, h, d, m, x = 0, y = 0, z = 0, p) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; p?.add(o); return o; }
function cyl(r0, r1, h, m, x = 0, y = 0, z = 0, p, seg = 16) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; p?.add(o); return o; }
const water = () => new THREE.MeshStandardMaterial({ color: '#3d6f7a', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9 });

const BUILD = {
  temple(g) { // plinth, mandapa, stepped shikhara with kalash
    box(12, 1.2, 16, M(STONE_LIGHT), 0, 0, 0, g); box(8, 5, 8, M(STONE), 0, 1.2, 3, g); box(6, 6, 6, M(STONE), 0, 1.2, -3.5, g);
    for (let i = 0; i < 4; i++) box(6 - i * 1.3, 1.6, 6 - i * 1.3, M(STONE_LIGHT), 0, 7.2 + i * 1.6, -3.5, g);
    cyl(0.6, 0.9, 1.2, M('#c99b3b', 0.4, 0.7), 0, 13.6, -3.5, g);
    const f = bhagwa(4); f.group.position.set(0, 14.5, -3.5); g.add(f.group); g.userData.flags = [f];
  },
  birthplace(g) { box(14, 1, 10, M(STONE_LIGHT), 0, 0, 0, g); box(12, 6, 8, M('#8c7f6c'), 0, 1, 0, g); box(13, 0.8, 9, M('#5c4033'), 0, 7, 0, g); box(10, 3, 6, M('#8c7f6c'), 0, 7.8, 0, g); box(11, 0.6, 7, M('#5c4033'), 0, 10.8, 0, g); },
  citadel(g) { for (const [w, d, x, z] of [[30, 1.5, 0, -11], [30, 1.5, 0, 11], [1.5, 22, -15, 0], [1.5, 22, 15, 0], [1.5, 10, 0, 0]]) box(w, 4.5, d, M(STONE), x, 0, z, g); box(10, 7, 8, M(STONE), -6, 0, -5, g); },
  throne(g) { // Raj Sadar: walled court + throne canopy (meghadambari)
    for (const [w, d, x, z] of [[60, 2, 0, -18], [60, 2, 0, 18], [2, 36, -30, 0], [2, 36, 30, 0]]) box(w, 5, d, M(STONE), x, 0, z, g);
    box(14, 1.5, 10, M(STONE_LIGHT), 0, 0, -10, g);
    for (const [x, z] of [[-3, -13], [3, -13], [-3, -7], [3, -7]]) cyl(0.35, 0.35, 5, M('#c9a24a', 0.35, 0.8), x, 1.5, z, g, 10);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M('#d4a83f', 0.3, 0.85)); dome.position.set(0, 6.5, -10); dome.castShadow = true; g.add(dome);
    box(8, 0.6, 8, M('#c9a24a', 0.35, 0.8), 0, 6.4, -10, g);
  },
  samadhi(g) { cyl(5, 5.5, 1.4, M(STONE_LIGHT), 0, 0, 0, g, 8); cyl(3, 3, 2.6, M(STONE), 0, 1.4, 0, g, 8); cyl(0.4, 0.4, 2, M('#d4a83f', 0.4, 0.7), 0, 4, 0, g, 8); },
  memorial(g) { box(5, 1.2, 5, M(STONE_LIGHT), 0, 0, 0, g); box(2.4, 4.5, 2.4, M(STONE), 0, 1.2, 0, g); box(1.4, 1.2, 1.4, M('#7a5a3a', 0.6, 0.3), 0, 5.7, 0, g); },
  statue(g) { // pedestal + stylised bronze equestrian figure
    box(8, 4, 5, M(STONE_LIGHT), 0, 0, 0, g);
    const br = M('#6b5236', 0.45, 0.75);
    box(4.5, 1.6, 1.4, br, 0, 6, 0, g); for (const [x, z] of [[-1.7, -0.5], [-1.7, 0.5], [1.7, -0.5], [1.7, 0.5]]) cyl(0.18, 0.18, 2, br, x, 4, z, g, 6);
    box(1, 1.8, 0.5, br, 2.4, 6.9, 0, g).rotation.z = -0.5; cyl(0.45, 0.5, 2, br, -0.3, 7.6, 0, g, 8); cyl(0.32, 0.32, 0.6, br, -0.3, 9.6, 0, g, 8);
  },
  tank(g) { box(34, 0.8, 22, M(STONE_LIGHT), 0, -0.6, 0, g); const w = new THREE.Mesh(new THREE.PlaneGeometry(30, 18).rotateX(-Math.PI / 2), water()); w.position.y = -0.2; g.add(w); },
  well(g) { cyl(4.5, 4.5, 1, M(STONE_LIGHT), 0, 0, 0, g, 20); const w = new THREE.Mesh(new THREE.CircleGeometry(3.6, 20).rotateX(-Math.PI / 2), water()); w.position.y = 1.01; g.add(w); },
  granary(g) { box(26, 3, 9, M(STONE), 0, 0, 0, g); const v = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 26, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), M(STONE_LIGHT)); v.position.y = 3; v.rotation.y = Math.PI / 2; v.castShadow = true; g.add(v); },
  bazaar(g) { for (const side of [-1, 1]) for (let i = 0; i < 12; i++) box(6, 2.2, 5, M(STONE), -36 + i * 6.5, 0, side * 8, g); box(80, 0.2, 9, M('#a08f78'), 0, 0, 0, g); },
  gatehouse(g) { cyl(5, 5.5, 11, M(STONE), -8, 0, 0, g, 16); cyl(5, 5.5, 11, M(STONE), 8, 0, 0, g, 16); box(11, 9, 6, M(STONE), 0, 0, 0, g); box(4, 6, 6.4, M('#1d1a17', 1), 0, 0, 0, g); },
  pavilion(g) { box(10, 4, 7, M(STONE), 0, 0, 0, g); box(10, 3.5, 7, M('#8c7f6c'), 0, 4, 0, g); box(11, 0.6, 8, M('#5c4033'), 0, 7.5, 0, g); },
  cave(g) { box(8, 4, 3, M('#1f1c19', 1), 0, 0, 0, g); },
  lighthouse(g) { cyl(2.6, 3.2, 18, M('#efefe9', 0.6), 0, 0, 0, g, 16); cyl(2.9, 2.9, 2.2, M('#c0392b', 0.6), 0, 18, 0, g, 16); const l = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 2 })); l.position.y = 21; g.add(l); },
  machi() {}, cliff() {}, bastion() {},
};

/**
 * Cast rays from (cx, cy) [px] while `inside(elev)` holds; returns radii [px].
 * A short tolerance lets rays cross small dips such as tanks on the plateau.
 */
function traceRadii(dem, cx, cy, inside, maxR, n = 256, inward = false) {
  const radii = new Float32Array(n), step = 0.35;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    // sea forts tolerate ~90 m of low ground inside the island but stop at the sea channel
    const tol = inward ? Math.round(90 / 9 / step) : 4;
    let r = 0, miss = 0, last = 0;
    while (r < maxR) {
      r += step;
      if (inside(dem.sample(cx + dx * r, cy + dy * r))) { miss = 0; last = r; } else if (++miss > tol) break;
    }
    radii[k] = Math.max(2, last - 0.3);
  }
  // median filter to remove single-ray spikes
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) { const w = [-2, -1, 0, 1, 2].map((d) => radii[(k + d + n) % n]).sort((a, b) => a - b); out[k] = w[2]; }
  return out;
}

export async function buildFort(fort, meta, dataUrl) {
  const dem = await loadDem(dataUrl);
  const { mpp, size } = meta;
  const c = size / 2;
  const group = new THREE.Group();
  const labels = [];
  const toW = (px, py) => new THREE.Vector3((px - c) * mpp, dem.sample(px, py), (py - c) * mpp);
  const sea = fort.kind === 'island' || fort.kind === 'coastal';

  // ── Terrain ──
  const N = size, geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; pos.set([(i - c) * mpp, dem.e[k], (j - c) * mpp], k * 3); }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6);
  let q = 0;
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const a = j * N + i, b = a + 1, d = a + N, e = d + 1; idx.set([a, d, b, b, d, e], q); q += 6; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = true; terrain.castShadow = false;   // self-shadowing a 9 m grid only produces blotches
  group.add(terrain);

  // ── Reference point & wall rings ──
  let sx = c, sy = c;
  if (!sea) { // highest point within 350 m of the crop centre
    const r = Math.round(350 / mpp); let best = -1e9;
    for (let y = c - r; y <= c + r; y++) for (let x = c - r; x <= c + r; x++) { const v = dem.at(x, y); if (v > best) { best = v; sx = x; sy = y; } }
  }
  const ref = dem.at(sx, sy);
  const rings = fort.walls.map((w) => {
    const inside = w.level != null ? (e) => e >= w.level : (e) => e >= ref - w.drop;
    let radii = traceRadii(dem, sx, sy, inside, w.maxR / mpp, 256, w.level != null);
    if (w.scale) radii = radii.map((r) => r * w.scale);
    const pts = [];
    for (let k = 0; k < radii.length; k++) { const a = (k / radii.length) * Math.PI * 2; pts.push([sx + Math.cos(a) * radii[k], sy + Math.sin(a) * radii[k]]); }
    // Chaikin smoothing, then resample every ~6 m
    let p = pts;
    for (let it = 0; it < 2; it++) { const o = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); } p = o; }
    const res = [];
    let acc = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) * mpp;
      if (i === 0) res.push(a);
      acc += L;
      if (acc >= 6) { res.push(b); acc = 0; }
    }
    return { spec: w, radii, px: res, world: res.map(([x, y]) => { const v = toW(x, y); v.y = Math.max(v.y, dem.sample(x + (sx - x) * 0.03, y + (sy - y) * 0.03)); return v; }) };
  });
  const main = rings.reduce((a, b) => (b.radii.reduce((s, r) => s + r * r, 0) > a.radii.reduce((s, r) => s + r * r, 0) ? b : a));
  const inPoly = (x, y, poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };

  // ── Walls, merlons, bastions ──
  const H = sea ? 9 : 6, T = sea ? 4 : 3;
  const wallM = M('#5d5650'), topM = M('#8a8174');
  const merlonGeo = new THREE.BoxGeometry(1.3, 1.2, 0.9);
  const merlonPos = [], bastions = [];
  let perimeter = 0;
  for (const ring of rings) {
    const P = ring.world, n = P.length;
    const cxW = (sx - c) * mpp, czW = (sy - c) * mpp;
    const vp = [], vi = [];
    for (let i = 0; i < n; i++) {
      const a = P[(i - 1 + n) % n], b = P[(i + 1) % n], p = P[i];
      let tx = b.x - a.x, tz = b.z - a.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      let nx = tz, nz = -tx;
      if ((p.x - cxW) * nx + (p.z - czW) * nz < 0) { nx = -nx; nz = -nz; }
      const base = p.y - 3, top = p.y + H;
      vp.push(p.x + nx * T / 2, top, p.z + nz * T / 2, p.x + nx * T / 2, base, p.z + nz * T / 2, p.x - nx * T / 2, top, p.z - nz * T / 2, p.x - nx * T / 2, base, p.z - nz * T / 2);
      perimeter += Math.hypot(b.x - p.x, b.z - p.z) / 2;
      if (i % 2 === 0) merlonPos.push([p.x + nx * (T / 2 - 0.45), top + 0.6, p.z + nz * (T / 2 - 0.45), Math.atan2(tx, tz)]);
    }
    for (let i = 0; i < n; i++) {
      const a = i * 4, b = ((i + 1) % n) * 4;
      vi.push(a, a + 1, b, b, a + 1, b + 1);       // outer face
      vi.push(a + 2, b + 2, a + 3, b + 2, b + 3, a + 3); // inner face
      vi.push(a, b, a + 2, b, b + 2, a + 2);       // top
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3)); wg.setIndex(vi); wg.computeVertexNormals();
    const wall = new THREE.Mesh(wg, [wallM][0]); wall.material.side = THREE.DoubleSide; wall.castShadow = wall.receiveShadow = true; group.add(wall);
    // bastions every ~85 m (more on sea forts)
    const every = sea ? 55 : 85;
    let acc = every / 2;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n]; acc += Math.hypot(b.x - a.x, b.z - a.z);
      if (acc >= every) { acc = 0; bastions.push({ p: a, r: sea ? 7.5 : 6, h: H + 3 }); }
    }
  }
  const bastionGeo = new THREE.CylinderGeometry(1, 1.12, 1, 20).translate(0, 0.5, 0);
  const bast = new THREE.InstancedMesh(bastionGeo, wallM, bastions.length);
  const m4 = new THREE.Matrix4(), qn = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  bastions.forEach((b, i) => { m4.compose(new THREE.Vector3(b.p.x, b.p.y - 3, b.p.z), qn.identity(), new THREE.Vector3(b.r, b.h + 3, b.r)); bast.setMatrixAt(i, m4); });
  bast.castShadow = bast.receiveShadow = true; group.add(bast);
  for (const b of bastions) for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; merlonPos.push([b.p.x + Math.cos(a) * (b.r - 0.5), b.p.y + b.h + 0.6, b.p.z + Math.sin(a) * (b.r - 0.5), -a]); }
  const merl = new THREE.InstancedMesh(merlonGeo, topM, merlonPos.length);
  merlonPos.forEach(([x, y, z, r], i) => { m4.compose(new THREE.Vector3(x, y, z), qn.setFromAxisAngle(up, r), one); merl.setMatrixAt(i, m4); });
  merl.castShadow = true; group.add(merl);

  // ── Feature points for buildings ──
  const R = rng(fort.id);
  const mainPx = main.px;
  const insideSamples = [];
  for (let t = 0; t < 4000 && insideSamples.length < 600; t++) {
    const x = sx + (R() - 0.5) * 2 * Math.max(...main.radii), y = sy + (R() - 0.5) * 2 * Math.max(...main.radii);
    if (!inPoly(x, y, mainPx)) continue;
    const dist = Math.min(...mainPx.filter((_, i) => i % 6 === 0).map(([a, b]) => Math.hypot(a - x, b - y))) * mpp;
    if (dist < 22) continue;
    const s = Math.hypot(dem.sample(x + 1, y) - dem.sample(x - 1, y), dem.sample(x, y + 1) - dem.sample(x, y - 1)) / (2 * mpp);
    insideSamples.push({ x, y, e: dem.sample(x, y), s, dist });
  }
  const flat = insideSamples.filter((p) => p.s < 0.35);
  const used = [];
  const farFrom = (p, d) => used.every((u) => Math.hypot(u.x - p.x, u.y - p.y) * mpp > d);
  const take = (p) => { used.push(p); return p; };
  const spurs = (() => { const r = main.radii, n = r.length, out = []; const idxs = [...r.keys()].sort((a, b) => r[b] - r[a]); for (const k of idxs) { if (out.every((o) => Math.min(Math.abs(o - k), n - Math.abs(o - k)) > n / 7)) out.push(k); if (out.length >= 4) break; } return out.map((k) => { const a = (k / n) * Math.PI * 2; return { x: sx + Math.cos(a) * r[k] * 0.86, y: sy + Math.sin(a) * r[k] * 0.86 }; }); })();
  const edgeInfo = mainPx.map(([x, y]) => { const dx = x - sx, dy = y - sy, L = Math.hypot(dx, dy) || 1, o = 60 / mpp; return { x, y, drop: dem.sample(x, y) - dem.sample(x + (dx / L) * o, y + (dy / L) * o) }; });
  const steep = []; for (const p of [...edgeInfo].sort((a, b) => b.drop - a.drop)) { if (steep.every((s) => Math.hypot(s.x - p.x, s.y - p.y) * mpp > 160)) steep.push(p); if (steep.length >= 3) break; }
  let gates;
  if (sea) { // gate on the landward (east) side
    const k = mainPx.reduce((bi, p, i) => (p[0] > mainPx[bi][0] ? i : bi), 0); gates = [{ x: mainPx[k][0], y: mainPx[k][1] }];
  } else {
    const g = []; for (const p of [...edgeInfo].sort((a, b) => a.drop - b.drop)) { if (g.every((s) => Math.hypot(s.x - p.x, s.y - p.y) * mpp > 300)) g.push(p); if (g.length >= 2) break; } gates = g;
  }
  const centroid = { x: mainPx.reduce((s, p) => s + p[0], 0) / mainPx.length, y: mainPx.reduce((s, p) => s + p[1], 0) / mainPx.length };
  const resolve = (at) => {
    const [kind, n] = at.split(':'); const k = +n || 0;
    if (kind === 'summit') return take({ x: sx, y: sy });
    if (kind === 'center') return take(inPoly(centroid.x, centroid.y, mainPx) ? centroid : { x: sx, y: sy });
    if (kind === 'spur') return spurs[k] && take(spurs[k]);
    if (kind === 'steep') return steep[k] && take(steep[k]);
    if (kind === 'gate') return gates[k] && take(gates[k]);
    if (kind === 'low') { const p = [...flat].sort((a, b) => a.e - b.e).find((q) => farFrom(q, 45)); return p && take(p); }
    const p = flat.find((q) => farFrom(q, 60)) || insideSamples.find((q) => farFrom(q, 40)); return p && take(p);
  };

  // gates (generic) — buildings on top
  const named = new Set(fort.structures.filter((s) => s.at.startsWith('gate')).map((s) => s.at));
  gates.forEach((gp, i) => {
    if (named.has(`gate:${i}`)) return;
    const g = new THREE.Group(); BUILD.gatehouse(g);
    const w = toW(gp.x, gp.y); g.position.set(w.x, w.y - 1, w.z); g.lookAt(new THREE.Vector3((sx - c) * mpp, w.y - 1, (sy - c) * mpp)); group.add(g);
    const l = label('Darwaja', 'gate'); l.position.set(w.x, w.y + 14, w.z); group.add(l); labels.push(l);
  });
  const flags = [];
  for (const s of fort.structures) {
    const p = resolve(s.at); if (!p) continue;
    const w = toW(p.x, p.y);
    const g = new THREE.Group(); (BUILD[s.type] || (() => {}))(g);
    g.position.set(w.x, w.y, w.z);
    g.rotation.y = Math.atan2((sx - p.x), (sy - p.y)) + (s.type === 'gatehouse' ? 0 : Math.PI);
    if (s.type === 'gatehouse') g.lookAt(new THREE.Vector3((sx - c) * mpp, w.y, (sy - c) * mpp));
    group.add(g);
    if (g.userData.flags) flags.push(...g.userData.flags);
    if (s.type === 'machi' || s.type === 'bastion') { const b = new THREE.Mesh(bastionGeo, wallM); b.scale.set(9, H + 6, 9); b.position.set(w.x, w.y - 3, w.z); b.castShadow = true; group.add(b); }
    const l = label(s.label, null, s.type === 'cliff' ? 'warn' : ''); l.position.set(w.x, w.y + (s.type === 'lighthouse' ? 28 : 18), w.z); group.add(l); labels.push(l);
  }
  // Bhagwa at the summit
  const sumW = toW(sx, sy);
  const flag = bhagwa(16); flag.group.position.set(sumW.x + 6, sumW.y, sumW.z + 6); group.add(flag.group); flags.push(flag);
  const title = label(`${fort.mr}`, fort.name, 'title'); title.position.set(sumW.x, sumW.y + 60, sumW.z); group.add(title); labels.push(title);

  // ── Trees ──
  const treeGeo = new THREE.IcosahedronGeometry(1, 0), trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1, 5).translate(0, 0.5, 0);
  const cand = [];
  for (let t = 0; t < 26000 && cand.length < 5000; t++) {
    const x = 2 + R() * (N - 4), y = 2 + R() * (N - 4), e = dem.sample(x, y);
    if (e < 2) continue;
    const s = Math.hypot(dem.sample(x + 1, y) - dem.sample(x - 1, y), dem.sample(x, y + 1) - dem.sample(x, y - 1)) / (2 * mpp);
    if (s > 0.7) continue;
    if (inPoly(x, y, mainPx) && R() > 0.12) continue;
    const valley = Math.min(1, Math.max(0.2, (ref - e) / 250));
    if (R() > valley) continue;
    cand.push({ x, y, e, k: R(), c: Math.floor(R() * 3) });
  }
  const crowns = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), cand.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, M('#4a3526'), cand.length);
  cand.forEach((p, i) => {
    const w = toW(p.x, p.y), s = 2.6 + p.k * 3.5;
    m4.compose(new THREE.Vector3(w.x, w.y + s * 1.1, w.z), qn.identity(), new THREE.Vector3(s, s * 0.85, s)); crowns.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(w.x, w.y - 0.3, w.z), qn.identity(), new THREE.Vector3(1, s * 0.9, 1)); trunks.setMatrixAt(i, m4);
  });
  crowns.castShadow = true; group.add(crowns, trunks);

  // ── Clouds (monsoon mist) ──
  const ctex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); for (let i = 0; i < 26; i++) { const px = 24 + Math.random() * 80, py = 40 + Math.random() * 50, r = 14 + Math.random() * 30; const gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); } const t = new THREE.CanvasTexture(cv); return t; })();
  const clouds = new THREE.Group(); group.add(clouds);
  const span = (N * mpp) / 2;
  for (let i = 0; i < 46; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, color: '#e8eef2', transparent: true, depthWrite: false, opacity: 0 }));
    const a = R() * Math.PI * 2, r = span * (0.25 + R() * 0.75);
    sp.position.set(Math.cos(a) * r, sea ? 60 + R() * 120 : ref - 60 - R() * 260, Math.sin(a) * r);
    sp.scale.setScalar(260 + R() * 320); sp.userData.v = 4 + R() * 6;
    clouds.add(sp);
  }

  // ── Sea ──
  let sea3 = null;
  if (meta.emin < -0.5) {
    const tex = new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    sea3 = new Water(new THREE.PlaneGeometry(span * 8, span * 8), { textureWidth: 512, textureHeight: 512, waterNormals: tex, sunDirection: new THREE.Vector3(0.5, 0.8, 0.2), sunColor: 0xffffff, waterColor: 0x0d4b5c, distortionScale: 2.2, fog: true });
    sea3.rotation.x = -Math.PI / 2; sea3.position.y = 0.3; group.add(sea3);
  }

  // ── Season colouring ──
  function setSeason(name) {
    const S = SEASONS[name];
    const g0 = new THREE.Color(S.grass[0]), g1 = new THREE.Color(S.grass[1]), forest = new THREE.Color(S.forest);
    const rock = new THREE.Color(BASALT), lat = new THREE.Color(LATERITE), sand = new THREE.Color('#d6c08e'), wetSand = new THREE.Color('#9d8a63'), tmp = new THREE.Color();
    const nor = geo.attributes.normal.array, laterite = sea || fort.id === 'panhala';
    for (let k = 0; k < N * N; k++) {
      const e = dem.e[k], ny = nor[k * 3 + 1], x = k % N, y = (k / N) | 0;
      const n = vnoise(x * 0.09, y * 0.09) * 0.6 + vnoise(x * 0.4, y * 0.4) * 0.4;
      if (sea && e < 2.5) tmp.copy(e < 0.3 ? wetSand : sand);
      else if (ny < 0.62) tmp.copy(laterite && n > 0.55 ? lat : rock).multiplyScalar(0.85 + n * 0.3);
      else {
        tmp.copy(g0).lerp(g1, n);
        const low = Math.min(1, Math.max(0, (ref - e - 120) / 300));
        tmp.lerp(forest, low * 0.6 * (0.5 + n));
        if (ny < 0.8) tmp.lerp(rock, (0.8 - ny) * 1.6);
      }
      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
    }
    geo.attributes.color.needsUpdate = true;
    const tc = S.tree.map((h) => new THREE.Color(h));
    cand.forEach((p, i) => crowns.setColorAt(i, tmp.copy(tc[p.c]).multiplyScalar(0.85 + p.k * 0.3)));
    crowns.instanceColor.needsUpdate = true;
    crowns.count = Math.round(cand.length * S.treeDensity); trunks.count = crowns.count;
    for (const sp of clouds.children) sp.userData.target = S.mist * (0.25 + 0.2 * Math.random());
  }

  // stats
  let area = 0; for (let i = 0; i < mainPx.length; i++) { const [x1, y1] = mainPx[i], [x2, y2] = mainPx[(i + 1) % mainPx.length]; area += x1 * y2 - x2 * y1; }
  const info = { summit: ref, perimeter, areaHa: (Math.abs(area) / 2) * mpp * mpp / 1e4, rings: rings.length, bastions: bastions.length };
  const target = new THREE.Vector3((centroid.x - c) * mpp, ref - 20, (centroid.y - c) * mpp);
  const radius = Math.max(...main.radii) * mpp;

  return {
    group, labels, info, target, radius, sea3, setSeason, ref,
    update(t, dt, sunV) {
      for (const f of flags) f.update(t);
      for (const sp of clouds.children) {
        sp.material.opacity += ((sp.userData.target || 0) - sp.material.opacity) * Math.min(1, dt * 0.8);
        sp.position.x += sp.userData.v * dt; if (sp.position.x > span) sp.position.x = -span;
      }
      if (sea3) { sea3.material.uniforms.time.value = t * 0.6; sea3.material.uniforms.sunDirection.value.copy(sunV); }
    },
    dispose() { group.traverse((o) => { o.geometry?.dispose?.(); }); },
  };
}
