/** Streams the world along a route in chunks: terrain, track or road, structures, scenery. */
import * as THREE from 'three';
import { at, offset, ground, waterLevel, noise2, rng } from './route.js';

export const CHUNK = 300;
const MAT = new Map();
export function mat(c, o = {}) { const k = c + JSON.stringify(o); if (!MAT.has(k)) MAT.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.05, ...o })); return MAT.get(k); }
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const speckle = (g, w, h, base, n, a) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const v = Math.random(); g.fillStyle = `rgba(${v > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3); } };
let TEX = null;
function textures() {
  if (TEX) return TEX;
  TEX = {
    ballast: canvasTex(128, 128, (g, w, h) => speckle(g, w, h, '#7b766f', 2600, 0.35), true),
    asphalt: canvasTex(256, 512, (g, w, h) => {
      speckle(g, w, h, '#4a4b4e', 5000, 0.12);
      g.fillStyle = '#e8e8e2'; g.fillRect(6, 0, 7, h); g.fillRect(w - 13, 0, 7, h);   // edge lines
      g.fillStyle = '#f2f2ec'; for (let y = 0; y < h; y += 128) g.fillRect(w / 2 - 4, y, 8, 64);   // centre dashes
    }, true),
    platform: canvasTex(256, 256, (g, w, h) => { speckle(g, w, h, '#b9b2a6', 1500, 0.12); g.fillStyle = '#e6c330'; g.fillRect(0, 0, 24, h); g.strokeStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(24, y); g.lineTo(w, y); g.stroke(); } }, true),
    stone: canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6d6458'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) { g.fillStyle = `hsl(30,${8 + Math.random() * 8}%,${30 + Math.random() * 14}%)`; g.fillRect(x + 2, y + 2, 60, 28); } }, true),
    fall: canvasTex(64, 256, (g, w, h) => { g.fillStyle = 'rgba(255,255,255,0)'; g.clearRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(235,245,255,${0.25 + Math.random() * 0.6})`; const x = Math.random() * w; g.fillRect(x, Math.random() * h, 1 + Math.random() * 3, 20 + Math.random() * 60); } }, true),
    water: canvasTex(128, 128, (g, w, h) => speckle(g, w, h, '#4f6f6a', 800, 0.15), true),
    tunnel: canvasTex(128, 128, (g, w, h) => speckle(g, w, h, '#3b3631', 1500, 0.25), true),
  };
  return TEX;
}
const SEASON = {
  monsoon: { low: '#4f8f2f', mid: '#3d7a2a', high: '#4a6f33', rock: '#5b5a4c', paddy: '#6cbf3a', soil: '#7a5a3c', leaf: ['#2f6b22', '#3c7d2a', '#4c8c2c', '#2a5d24'] },
  winter: { low: '#7f8f4a', mid: '#6b7d44', high: '#7c7a52', rock: '#7a7262', paddy: '#b8a85a', soil: '#8a6a48', leaf: ['#4d6b2a', '#5d7a32', '#6e7f3a', '#4a5f2c'] },
  summer: { low: '#a68f5c', mid: '#8c7a4f', high: '#8a7656', rock: '#86786a', paddy: '#c2a368', soil: '#9a6b44', leaf: ['#6f6a35', '#7c6d3a', '#5d5a30', '#8a7240'] },
};
const D_SAMPLES = [-420, -320, -240, -180, -135, -100, -75, -56, -42, -32, -24, -18, -13, -9.5, -7, -5, -3, 0, 3, 5, 7, 9.5, 13, 18, 24, 32, 42, 56, 75, 100, 135, 180, 240, 320, 420];

export class World {
  constructor(scene, R, opts) {
    this.scene = scene; this.R = R; this.opts = opts; this.chunks = new Map(); this.root = new THREE.Group(); scene.add(this.root);
    this.dynamic = { signals: [], gates: [], falls: [], people: [] };
    this.tex = textures();
  }
  dispose() { for (const c of this.chunks.values()) this.drop(c); this.scene.remove(this.root); }
  drop(c) { this.root.remove(c.g); c.g.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); for (const k of Object.keys(this.dynamic)) this.dynamic[k] = this.dynamic[k].filter((d) => d.chunk !== c.id); }
  setSeason(s) { this.opts.season = s; for (const c of [...this.chunks.values()]) this.drop(c); this.chunks.clear(); }
  /** Keep chunks around s loaded. */
  update(s, ahead = 2400, behind = 900) {
    const lo = Math.max(0, Math.floor((s - behind) / CHUNK)), hi = Math.min(Math.floor(this.R.length / CHUNK), Math.floor((s + ahead) / CHUNK));
    for (const [id, c] of this.chunks) if (id < lo || id > hi) { this.drop(c); this.chunks.delete(id); }
    let built = 0;
    for (let id = lo; id <= hi; id++) {
      if (this.chunks.has(id)) continue;
      if (built++ >= 2) break;   // spread work across frames
      const c = this.build(id); this.chunks.set(id, c); this.root.add(c.g);
    }
    return built;
  }
  build(id) {
    const R = this.R, s0 = id * CHUNK, s1 = Math.min(R.length, s0 + CHUNK);
    const g = new THREE.Group(), c = { id, g, s0, s1 };
    g.add(this.terrain(s0, s1));
    if (R.def.id === 'rail') this.track(g, s0, s1, c); else this.road(g, s0, s1, c);
    this.structures(g, s0, s1, c);
    this.scenery(g, s0, s1, c);
    g.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; } });
    return c;
  }

  // ── terrain ribbon (path-aligned) ──
  terrain(s0, s1) {
    const R = this.R, step = 8, ns = Math.ceil((s1 - s0) / step) + 1, nd = D_SAMPLES.length;
    const pos = new Float32Array(ns * nd * 3), col = new Float32Array(ns * nd * 3);
    const S = SEASON[this.opts.season], cc = new THREE.Color(), tmp = new THREE.Color();
    for (let i = 0; i < ns; i++) {
      const s = Math.min(s1, s0 + i * step), p = at(R, s), sec = R.section(s);
      // limit the inner side of tight curves so the ribbon doesn't fold
      let kk = 0; for (const ds of [-60, -30, 0, 30, 60]) kk = Math.abs(at(R, s + ds).k) > Math.abs(kk) ? at(R, s + ds).k : kk;
      const innerMax = Math.abs(kk) > 1e-5 ? 0.8 / Math.abs(kk) : 1e9;
      for (let j = 0; j < nd; j++) {
        let d = D_SAMPLES[j];
        if ((kk > 0 && d < 0) || (kk < 0 && d > 0)) d = Math.sign(d) * Math.min(Math.abs(d), innerMax);
        const h = ground(R, s, d);
        const o = (i * nd + j) * 3;
        pos[o] = p.x - p.nx * d; pos[o + 1] = h; pos[o + 2] = p.z - p.nz * d;
        // colour by section, relative height and noise
        const rel = h - p.y, n = noise2(s * 0.02, d * 0.02), ad = Math.abs(d);
        if (sec.kind === 'plains' && Math.abs(rel) < 4 && ad > 14) { cc.set(S.paddy); if ((Math.floor(s / 40) + Math.floor(d / 30)) % 3 === 0) cc.lerp(tmp.set(S.low), 0.4); }
        else if (sec.kind === 'city' && ad > 14) cc.set('#8d8778').lerp(tmp.set(S.low), 0.35 + n * 0.2);
        else if (sec.kind === 'plateau') cc.set(S.low).lerp(tmp.set(S.soil), 0.35 + n * 0.3);
        else cc.set(rel > 120 ? S.high : rel > 25 ? S.mid : S.low).lerp(tmp.set(S.rock), Math.max(0, n) * (sec.kind === 'ghat' ? 0.55 : 0.15));
        if (ad < 12 && Math.abs(rel) < 1.5) cc.set(S.soil).lerp(tmp.set('#6f6a60'), 0.4);
        col[o] = cc.r; col[o + 1] = cc.g; col[o + 2] = cc.b;
      }
    }
    const idx = [];
    for (let i = 0; i < ns - 1; i++) for (let j = 0; j < nd - 1; j++) { const a = i * nd + j, b = a + nd; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat('#ffffff', { vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    return m;
  }
  /** Sweep a cross-section profile [[d, dy, u]...] along the route. */
  sweep(s0, s1, step, prof, material, vScale = 4, closed = false) {
    const R = this.R, ns = Math.ceil((s1 - s0) / step) + 1, np = prof.length;
    const pos = new Float32Array(ns * np * 3), uv = new Float32Array(ns * np * 2);
    for (let i = 0; i < ns; i++) {
      const s = Math.min(s1, s0 + i * step), p = at(R, s);
      for (let j = 0; j < np; j++) {
        const [d, dy, u] = prof[j], o = i * np + j;
        pos[o * 3] = p.x - p.nx * d; pos[o * 3 + 1] = p.y + dy; pos[o * 3 + 2] = p.z - p.nz * d;
        uv[o * 2] = u ?? j / (np - 1); uv[o * 2 + 1] = s / vScale;
      }
    }
    const idx = [];
    for (let i = 0; i < ns - 1; i++) for (let j = 0; j < np - 1 + (closed ? 1 : 0); j++) { const a = i * np + j, b = a + np, a1 = i * np + ((j + 1) % np), b1 = a1 + np; idx.push(a, a1, b, a1, b1, b); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    return new THREE.Mesh(geo, material);
  }
  placeInstanced(geo, material, list) {
    const m = new THREE.InstancedMesh(geo, material, Math.max(1, list.length)); const d = new THREE.Object3D();
    list.forEach((t, i) => { d.position.set(t.x, t.y, t.z); d.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0); d.scale.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix); if (t.c) m.setColorAt(i, new THREE.Color(t.c)); });
    m.count = list.length; m.castShadow = true; m.receiveShadow = true; return m;
  }

  // ── railway ──
  track(g, s0, s1, c) {
    const R = this.R, T = this.tex;
    const ballastM = new THREE.MeshStandardMaterial({ map: T.ballast, roughness: 1 });
    for (const tc of [-2.65, 2.65]) {
      g.add(this.sweep(s0, s1, 4, [[tc - 2.6, -0.55, 0], [tc - 1.7, 0.05, 0.25], [tc + 1.7, 0.05, 0.75], [tc + 2.6, -0.55, 1]], ballastM, 3));
      for (const r of [-0.8380, 0.8380]) {   // broad gauge 1676 mm
        g.add(this.sweep(s0, s1, 2, [[tc + r - 0.04, 0.27, 0], [tc + r - 0.04, 0.42, 0.3], [tc + r + 0.04, 0.42, 0.6], [tc + r + 0.04, 0.27, 1]], mat('#8f8a84', { metalness: 0.7, roughness: 0.35 }), 2));
      }
      const sl = []; for (let s = Math.ceil(s0 / 0.65) * 0.65; s < s1; s += 0.65) { const q = offset(R, s, tc, 0.17); sl.push({ x: q.x, y: q.y, z: q.z, ry: -q.h }); }
      const geo = new THREE.BoxGeometry(0.26, 0.2, 2.75); g.add(this.placeInstanced(geo, mat('#9a968e'), sl));
    }
    // overhead equipment (25 kV AC): masts both sides, catenary and contact wires
    const masts = [], arms = [];
    for (let s = Math.ceil(s0 / 55) * 55; s < s1; s += 55) {
      if (R.tunnelAt(s, 5)) continue;
      for (const side of [-1, 1]) {
        const q = offset(R, s, side * 5.6, 0); masts.push({ x: q.x, y: q.y + 3.9, z: q.z, ry: -q.h });
        const a = offset(R, s, side * 3.9, 7.2); arms.push({ x: a.x, y: a.y, z: a.z, ry: -q.h });
      }
    }
    g.add(this.placeInstanced(new THREE.BoxGeometry(0.25, 7.8, 0.25), mat('#7d8790', { metalness: 0.6 }), masts));
    g.add(this.placeInstanced(new THREE.BoxGeometry(0.12, 0.12, 3.6), mat('#7d8790', { metalness: 0.6 }), arms));
    const wireM = new THREE.LineBasicMaterial({ color: '#2b2b2b' });
    for (const tc of [-2.65, 2.65]) for (const hgt of [5.9, 7.0]) {
      const pts = []; for (let s = s0; s <= s1; s += 5) { const q = offset(R, s, tc + Math.sin(s / 55 * Math.PI) * 0.2, hgt + (hgt > 6 ? -0.3 * Math.sin(((s % 55) / 55) * Math.PI) : 0)); pts.push(new THREE.Vector3(q.x, q.y, q.z)); }
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
    }
    // signals (left of each running line; trains run on the left)
    for (let s = Math.ceil(s0 / 1400) * 1400 + 300; s < s1; s += 1400) if (!R.tunnelAt(s, 30) && !R.bridgeAt(s, 10)) this.signal(g, s, c);
    for (const st of R.def.stops) for (const ds of [-260, 260]) if (st.s + ds >= s0 && st.s + ds < s1) this.signal(g, st.s + ds, c);
  }
  signal(g, s, c) {
    const R = this.R, q = offset(R, s, -5.3, 0), grp = new THREE.Group(); grp.position.set(q.x, q.y, q.z); grp.rotation.y = -q.h - Math.PI / 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 5, 8), mat('#d9d9d9')); post.position.y = 2.5; grp.add(post);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.3), mat('#151515')); head.position.y = 5.3; grp.add(head);
    const lamps = ['#ff2a1a', '#ffbf1a', '#2aff6a'].map((col, k) => { const l = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), new THREE.MeshStandardMaterial({ color: '#222', emissive: col, emissiveIntensity: 0 })); l.position.set(0, 5.75 - k * 0.42, 0.16); grp.add(l); return l; });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.05), mat('#f2f2f2')); board.position.y = 4.2; grp.add(board);
    g.add(grp); this.dynamic.signals.push({ s, lamps, chunk: c.id });
  }
  // ── road ──
  road(g, s0, s1, c) {
    const R = this.R, T = this.tex, ghat = (s) => R.section(s).kind === 'ghat';
    const roadM = new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: 0.9 });
    g.add(this.sweep(s0, s1, 3, [[-3.9, 0.02, 0], [3.9, 0.02, 1]], roadM, 12));
    g.add(this.sweep(s0, s1, 4, [[-6.2, -0.35, 0], [-3.9, 0.0, 0.5], [3.9, 0.0, 0.5], [6.2, -0.35, 1]], mat('#8b7d66', { roughness: 1 }), 4));
    // ghat kerb stones painted black and white; crash barrier on the valley side
    const kw = [], kb = [], posts = [];
    for (let s = Math.ceil(s0 / 2.5) * 2.5; s < s1; s += 2.5) {
      if (!ghat(s) || R.bridgeAt(s, 0)) continue;
      const i = Math.round(s / 2.5);
      for (const side of [-1, 1]) { const q = offset(R, s, side * 4.4, 0.25); (i % 2 ? kw : kb).push({ x: q.x, y: q.y, z: q.z, ry: -q.h }); }
      if (i % 2 === 0) { const q = offset(R, s, -5.2, 0.55); posts.push({ x: q.x, y: q.y, z: q.z, ry: -q.h }); }
    }
    const kg = new THREE.BoxGeometry(1.2, 0.5, 0.35);
    if (kw.length) g.add(this.placeInstanced(kg, mat('#f0f0ea'), kw));
    if (kb.length) g.add(this.placeInstanced(kg, mat('#1b1b1b'), kb));
    if (posts.length) g.add(this.placeInstanced(new THREE.BoxGeometry(0.12, 1.1, 0.12), mat('#9ea4a8', { metalness: 0.5 }), posts));
    for (let s = s0; s < s1; s += 60) if (ghat(s) && !R.bridgeAt(s, 0)) g.add(this.sweep(s, Math.min(s1, s + 60), 3, [[-5.2, 0.7], [-5.25, 1.0], [-5.2, 1.0], [-5.15, 0.7]], mat('#c7cdd2', { metalness: 0.7, roughness: 0.3 }), 3));
    // milestones every km (yellow top) and roadside trees with white-red painted trunks in the plains
    for (let km = Math.ceil(s0 / 1000) * 1000; km < s1; km += 1000) this.milestone(g, km);
    const trunks = [], cans = [];
    const r = rng(s0 + 5);
    for (let s = s0; s < s1; s += 14) {
      const sec = R.section(s); if (sec.kind !== 'plains' && sec.kind !== 'plateau') continue;
      if (R.def.stops.some((q) => Math.abs(q.s - s) < 300) || R.bridgeAt(s, 10)) continue;
      for (const side of [-1, 1]) { if (r() < 0.25) continue; const q = offset(R, s, side * (8 + r() * 2), 0); trunks.push({ x: q.x, y: q.y + 1.6, z: q.z }); cans.push({ x: q.x, y: q.y + 5 + r(), z: q.z, sx: 1 + r() * 0.5, sy: 0.8 + r() * 0.4, sz: 1 + r() * 0.5, c: SEASON[this.opts.season].leaf[Math.floor(r() * 4)] }); }
    }
    if (trunks.length) {
      g.add(this.placeInstanced(new THREE.CylinderGeometry(0.22, 0.28, 3.2, 8), new THREE.MeshStandardMaterial({ map: canvasTex(16, 64, (gg) => { gg.fillStyle = '#5b4030'; gg.fillRect(0, 0, 16, 64); gg.fillStyle = '#f2f2f2'; gg.fillRect(0, 40, 16, 12); gg.fillStyle = '#c0392b'; gg.fillRect(0, 52, 16, 12); }), roughness: 0.9 }), trunks));
      g.add(this.placeInstanced(new THREE.IcosahedronGeometry(2.8, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), cans));
    }
  }
  milestone(g, s) {
    const R = this.R, q = offset(R, s, -5.6, 0), grp = new THREE.Group(); grp.position.set(q.x, q.y, q.z); grp.rotation.y = -q.h + Math.PI / 2;
    const left = Math.round((R.length - s) / 1000);
    const t = canvasTex(64, 96, (gg) => { gg.fillStyle = '#f4f4f0'; gg.fillRect(0, 0, 64, 96); gg.fillStyle = '#f2c230'; gg.fillRect(0, 0, 64, 34); gg.fillStyle = '#111'; gg.font = '700 15px Inter, Arial'; gg.textAlign = 'center'; gg.fillText('पुणे', 32, 58); gg.font = '700 18px Inter, Arial'; gg.fillText(String(left), 32, 84); });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.2), [mat('#eee'), mat('#eee'), mat('#f2c230'), mat('#eee'), new THREE.MeshStandardMaterial({ map: t }), mat('#eee')]); body.position.y = 0.42; grp.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16, 1, false, 0, Math.PI), mat('#f2c230')); top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2; top.position.y = 0.85; grp.add(top);
    g.add(grp);
  }

  // ── structures ──
  structures(g, s0, s1, c) {
    const R = this.R, T = this.tex, rail = R.def.id === 'rail';
    // tunnels
    for (const [a, b] of R.def.tunnels) {
      if (b < s0 || a > s1) continue;
      const lo = Math.max(a, s0), hi = Math.min(b, s1);
      const prof = []; for (let k = 0; k <= 12; k++) { const t = Math.PI * (k / 12); prof.push([-Math.cos(t) * 6.4, Math.sin(t) * 8.2 - 0.6, k / 12]); }
      g.add(this.sweep(lo, hi, 4, prof.reverse(), new THREE.MeshStandardMaterial({ map: T.tunnel, side: THREE.DoubleSide, roughness: 1 }), 6));
      const lights = []; for (let s = Math.ceil(lo / 40) * 40; s < hi; s += 40) { const q = offset(R, s, -5.6, 3.2); lights.push({ x: q.x, y: q.y, z: q.z }); }
      if (lights.length) g.add(this.placeInstanced(new THREE.BoxGeometry(0.3, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb050', emissiveIntensity: 1.5 }), lights));
      for (const [sp, dir] of [[a, 1], [b, -1]]) if (sp >= s0 && sp < s1) this.portal(g, sp, dir, R.def.tunnels.findIndex((t) => t[0] === a) + 1);
    }
    // bridges / viaducts
    for (const [a, b] of R.def.bridges) {
      if (b < s0 || a > s1) continue;
      const lo = Math.max(a, s0), hi = Math.min(b, s1), w = rail ? 6.2 : 6.6;
      g.add(this.sweep(lo, hi, 4, [[-w, -0.6], [-w, -2.4], [w, -2.4], [w, -0.6]], mat('#7c7a76'), 4));
      g.add(this.sweep(lo, hi, 4, [[-w, -0.6], [-w, 1.0], [-w + 0.25, 1.0], [-w + 0.25, -0.4]], mat('#9a9a96'), 4));
      g.add(this.sweep(lo, hi, 4, [[w - 0.25, -0.4], [w - 0.25, 1.0], [w, 1.0], [w, -0.6]], mat('#9a9a96'), 4));
      const wl = waterLevel(R, (a + b) / 2);
      const piers = [];
      for (let s = Math.ceil(lo / 30) * 30; s <= hi; s += 30) {
        const q = offset(R, s, 0, 0), h = q.y - 2.4 - (wl ?? q.y - 30) + 3;
        piers.push({ x: q.x, y: q.y - 2.4 - h / 2, z: q.z, ry: -q.h, sy: h });
      }
      if (piers.length) g.add(this.placeInstanced(new THREE.BoxGeometry(3.2, 1, w * 1.2), new THREE.MeshStandardMaterial({ map: T.stone, roughness: 0.95 }), piers));
      if (wl !== null && a >= s0 && a < s1) {
        const m = at(R, (a + b) / 2), frame = new THREE.Group(); frame.position.set(m.x, wl, m.z); frame.rotation.y = -m.h; g.add(frame);
        const water = new THREE.Mesh(new THREE.PlaneGeometry(b - a + 300, 600), new THREE.MeshStandardMaterial({ map: T.water, color: '#7fa0a0', roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.92 }));
        water.rotation.x = -Math.PI / 2; frame.add(water);
      }
    }
    // stations / bus stands
    for (const st of R.def.stops) if (st.s >= s0 && st.s < s1) (rail ? this.station(g, st, c) : this.busStand(g, st, c));
    // level crossings
    for (const x of R.def.crossings) if (x >= s0 && x < s1) this.crossing(g, x, c);
    // monsoon waterfalls on the mountain side
    if (this.opts.season === 'monsoon') for (const f of R.def.falls) if (f >= s0 && f < s1) this.waterfall(g, f, c);
  }
  portal(g, s, dir, n) {
    const R = this.R, q = offset(R, s, 0, 0), grp = new THREE.Group(); grp.position.set(q.x, q.y, q.z); grp.rotation.y = -q.h + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const shape = new THREE.Shape(); shape.moveTo(-12, -1); shape.lineTo(12, -1); shape.lineTo(12, 14); shape.lineTo(-12, 14); shape.lineTo(-12, -1);
    const hole = new THREE.Path(); hole.moveTo(-6.4, -0.6); hole.lineTo(-6.4, 4.2); hole.absarc(0, 4.2, 6.4, Math.PI, 0, true); hole.lineTo(6.4, -0.6); hole.lineTo(-6.4, -0.6); shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false });
    const T = this.tex; const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: T.stone, roughness: 0.95 })); m.position.z = -1.2; T.stone.repeat.set(0.1, 0.1); grp.add(m);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.9), new THREE.MeshStandardMaterial({ map: canvasTex(192, 64, (gg) => { gg.fillStyle = '#e8e2d4'; gg.fillRect(0, 0, 192, 64); gg.fillStyle = '#222'; gg.font = '700 26px Inter, Arial'; gg.textAlign = 'center'; gg.fillText(`Tunnel ${n}`, 96, 42); }) }));
    plaque.position.set(0, 11.6, 1.25); grp.add(plaque);
    g.add(grp);
  }
  station(g, st, c) {
    const R = this.R, a = st.s - 210, b = st.s + 210;
    const pm = new THREE.MeshStandardMaterial({ map: this.tex.platform, roughness: 0.9 });
    for (const side of [-1, 1]) {
      const d0 = side * 4.35, d1 = side * 12;
      const prof = side < 0 ? [[d1, 0.2], [d1, 1.15], [d0, 1.15], [d0, 0.2]] : [[d0, 0.2], [d0, 1.15], [d1, 1.15], [d1, 0.2]];
      g.add(this.sweep(a, b, 4, prof.map(([d, y], k) => [d, y, k / 3]), pm, 8));
      // canopy
      const cols = []; for (let s = a + 30; s < b - 30; s += 10) { const q = offset(R, s, side * 9, 3.2); cols.push({ x: q.x, y: q.y, z: q.z }); }
      g.add(this.placeInstanced(new THREE.CylinderGeometry(0.15, 0.15, 4.2, 8), mat('#3e6e8e', { metalness: 0.4 }), cols));
      g.add(this.sweep(a + 25, b - 25, 6, side < 0 ? [[side * 12.4, 5.2], [side * 8.5, 5.7], [side * 5.2, 5.3]] : [[side * 5.2, 5.3], [side * 8.5, 5.7], [side * 12.4, 5.2]], mat('#c0392b', { side: THREE.DoubleSide, roughness: 0.6 }), 6));
      for (const ds of [-150, 0, 150]) this.nameBoard(g, st, st.s + ds, side * 10.5);
      // waiting passengers
      this.people(g, a + 40, b - 40, side * 6, side * 11, 1.15, 40, c);
    }
    // station building and foot over bridge
    const q = offset(R, st.s + 40, -22, 0), bld = new THREE.Mesh(new THREE.BoxGeometry(46, 9, 12), [mat('#e4c9a4'), mat('#e4c9a4'), mat('#a0503a'), mat('#e4c9a4'), new THREE.MeshStandardMaterial({ map: buildingTex(st) }), mat('#e4c9a4')]);
    bld.position.set(q.x, q.y + 4.5, q.z); bld.rotation.y = -q.h; bld.castShadow = true; g.add(bld);
    const f = offset(R, st.s - 120, 0, 7.5), fob = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 30), mat('#8a9aa6', { metalness: 0.4 })); fob.position.set(f.x, f.y, f.z); fob.rotation.y = -f.h; g.add(fob);
    for (const side of [-1, 1]) { const s2 = offset(R, st.s - 120, side * 12, 3.2); const leg = new THREE.Mesh(new THREE.BoxGeometry(3, 6.4, 3), mat('#8a9aa6', { metalness: 0.4 })); leg.position.set(s2.x, s2.y, s2.z); leg.rotation.y = -s2.h; g.add(leg); }
  }
  nameBoard(g, st, s, d) {
    const R = this.R, q = offset(R, s, d, 0), grp = new THREE.Group(); grp.position.set(q.x, q.y + 1.15, q.z); grp.rotation.y = -q.h;
    const t = canvasTex(512, 200, (gg) => {
      gg.fillStyle = '#f2c230'; gg.fillRect(0, 0, 512, 200); gg.strokeStyle = '#111'; gg.lineWidth = 8; gg.strokeRect(4, 4, 504, 192);
      gg.fillStyle = '#111'; gg.textAlign = 'center'; gg.font = '700 64px "Noto Sans Devanagari", Inter, Arial'; gg.fillText(st.mr, 256, 86);
      gg.font = '700 52px Inter, Arial'; gg.fillText(st.name.toUpperCase(), 256, 150);
      gg.font = '600 18px Inter, Arial'; gg.fillText(`समुद्र सपाटीपासून उंची ${Math.round(at(R, st.s).y)} मी.   HEIGHT ABOVE MSL ${Math.round(at(R, st.s).y)} M`, 256, 184);
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2, 5.2), [new THREE.MeshStandardMaterial({ map: t }), new THREE.MeshStandardMaterial({ map: t }), mat('#111'), mat('#111'), mat('#111'), mat('#111')]);
    board.position.y = 3.4; grp.add(board);
    for (const z of [-2.2, 2.2]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), mat('#222')); leg.position.set(0, 1.2, z); grp.add(leg); }
    g.add(grp);
  }
  busStand(g, st, c) {
    const R = this.R, a = st.s - 120, b = st.s + 120;
    g.add(this.sweep(a, b, 4, [[-24, 0.03], [-4, 0.03]], mat('#7f7b74', { roughness: 0.95 }), 6));
    const q = offset(R, st.s, -30, 0);
    const bld = new THREE.Mesh(new THREE.BoxGeometry(60, 7, 10), [mat('#e8d8b0'), mat('#e8d8b0'), mat('#c0392b'), mat('#e8d8b0'), new THREE.MeshStandardMaterial({ map: standTex(st) }), mat('#e8d8b0')]);
    bld.position.set(q.x, q.y + 3.5, q.z); bld.rotation.y = -q.h; bld.castShadow = true; g.add(bld);
    // platforms with shelters and parked ST buses
    for (let k = -3; k <= 3; k++) {
      const s = st.s + k * 14, sh = offset(R, s, -22, 3);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 4), mat('#c0392b')); roof.position.set(sh.x, sh.y, sh.z); roof.rotation.y = -sh.h; g.add(roof);
      const post = offset(R, s, -22, 1.4); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 8), mat('#555')); p.position.set(post.x, post.y, post.z); g.add(p);
    }
    this.people(g, a + 20, b - 20, -20, -26, 0.05, 50, c);
    if (this.opts.makeBus) {   // ST buses parked nose-in at the platforms
      const types = ['lalpari', 'lalpari', 'hirkani', 'shivshahi', 'lalpari', 'shivneri'];
      for (let k = -3; k <= 3; k++) {
        if (k === 0 || (!st.depot && Math.abs(k) > 2)) continue;
        const B = this.opts.makeBus(types[(k + 3 + Math.floor(st.s)) % types.length]);
        const p = offset(R, st.s + k * 14, -17.5, 0);
        B.group.position.set(p.x, p.y, p.z); B.group.rotation.y = -p.h + Math.PI / 2; g.add(B.group);
      }
    }
  }
  crossing(g, s, c) {
    const R = this.R, q = at(R, s);
    const frame = new THREE.Group(); frame.position.set(q.x, q.y, q.z); frame.rotation.y = -q.h; g.add(frame);   // local x = along track, local z = across
    const rd = new THREE.Mesh(new THREE.PlaneGeometry(8, 90), new THREE.MeshStandardMaterial({ map: this.tex.asphalt, roughness: 0.9 }));
    rd.rotation.x = -Math.PI / 2; rd.position.y = 0.46; frame.add(rd);
    const gates = [];
    const boomTex = canvasTex(128, 16, (gg) => { for (let k = 0; k < 8; k++) { gg.fillStyle = k % 2 ? '#d32f2f' : '#f5f5f5'; gg.fillRect(k * 16, 0, 16, 16); } });
    for (const side of [-1, 1]) for (const lr of [-1, 1]) {
      const grp = new THREE.Group(); grp.position.set(lr * 5, 0.3, side * 8.5); frame.add(grp);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), mat('#e8e8e8')); post.position.y = 0.7; grp.add(post);
      const pivot = new THREE.Group(); pivot.position.y = 1.2; grp.add(pivot);
      const boom = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 0.16), new THREE.MeshStandardMaterial({ map: boomTex })); boom.position.x = -lr * 2.3; pivot.add(boom);
      gates.push({ pivot, lr });
    }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(3, 2.8, 3), mat('#d8c39a')); hut.position.set(12, 1.7, 13); frame.add(hut);
    const kinds = [['#f2c230', 2.7, 1.7, 1.4], ['#2f6fd6', 4.2, 1.5, 1.7], ['#c0392b', 7, 3, 2.4], ['#ecf0f1', 4.4, 1.5, 1.8]];
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const [col, L, Hh, W] = kinds[(k * 2 + (side > 0 ? 1 : 0)) % 4];
      const m = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, L), mat(col)); m.position.set(side * 1.9, Hh / 2 + 0.35, side * (12 + k * 8)); m.castShadow = true; frame.add(m);
    }
    this.dynamic.gates.push({ s, gates, chunk: c.id });
  }
  waterfall(g, s, c) {
    const R = this.R, d = 52, q = offset(R, s, d, 0), top = ground(R, s, d + 40), bottom = q.y + 1;
    const h = Math.max(20, top - bottom);
    const t = this.tex.fall.clone(); t.needsUpdate = true; t.repeat.set(1, h / 30);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.9, side: THREE.DoubleSide }));
    m.position.set(q.x, bottom + h / 2, q.z); m.rotation.y = -q.h; g.add(m);
    const mist = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false })); mist.position.set(q.x, bottom + 2, q.z); mist.scale.y = 0.4; g.add(mist);
    this.dynamic.falls.push({ tex: t, chunk: c.id });
  }
  people(g, a, b, d0, d1, dy, n, c) {
    const R = this.R, r = rng(Math.floor(a)), bodies = [], heads = [];
    const shirts = ['#c0392b', '#2f6fd6', '#f2c230', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#d35400', '#16a085', '#e84393'];
    for (let i = 0; i < n; i++) {
      const s = a + r() * (b - a), d = d0 + (d1 - d0) * r(), q = offset(R, s, d, dy);
      bodies.push({ x: q.x, y: q.y + 0.75, z: q.z, c: shirts[Math.floor(r() * shirts.length)] });
      heads.push({ x: q.x, y: q.y + 1.62, z: q.z });
    }
    g.add(this.placeInstanced(new THREE.CapsuleGeometry(0.22, 0.95, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), bodies));
    g.add(this.placeInstanced(new THREE.SphereGeometry(0.14, 10, 8), mat('#8d5a3b'), heads));
  }

  // ── scenery: forest, houses, towns ──
  scenery(g, s0, s1, c) {
    const R = this.R, r = rng(s0 * 7 + (R.def.id === 'rail' ? 1 : 2)), S = SEASON[this.opts.season];
    const trunks = [], crowns = [], palms = [], fronds = [], walls = [], roofs = [], towers = [];
    const nearStop = (s) => R.def.stops.some((q) => Math.abs(q.s - s) < 380);
    for (let k = 0; k < 520; k++) {
      const s = s0 + r() * (s1 - s0), sec = R.section(s);
      const side = r() < 0.5 ? -1 : 1, d = side * (16 + Math.pow(r(), 1.4) * 360);
      if (R.tunnelAt(s, 30) && Math.abs(d) < 60) continue;
      if (R.bridgeAt(s, 40) && Math.abs(d) < 120) continue;
      const q = offset(R, s, d, 0), y = ground(R, s, d);
      if (sec.kind === 'city' || (nearStop(s) && Math.abs(d) > 28)) {
        if (Math.abs(d) < 28) continue;
        const tall = sec.kind === 'city' && r() < 0.45, h = tall ? 12 + r() * 30 : 4 + r() * 6, w = 8 + r() * 14, dd = 8 + r() * 12;
        const cols = ['#e8dcc4', '#d9c7a3', '#f1e7d0', '#c9d6df', '#e6b8a2', '#a8c3b0', '#f2d7a0', '#d0c0e0'];
        (tall ? towers : walls).push({ x: q.x, y: y + h / 2, z: q.z, sx: w, sy: h, sz: dd, ry: -q.h + (r() - 0.5) * 0.3, c: cols[Math.floor(r() * cols.length)] });
        if (!tall) roofs.push({ x: q.x, y: y + h + 0.2, z: q.z, sx: w + 0.6, sy: 0.4, sz: dd + 0.6, ry: -q.h, c: r() < 0.5 ? '#a0503a' : '#8a8a8a' });
        continue;
      }
      if (sec.kind === 'plains' && Math.abs(y - q.p.y) < 4 && r() < 0.65) {   // paddy: palms along bunds, few houses
        if (r() < 0.6) { palms.push({ x: q.x, y: y + 5, z: q.z, rz: (r() - 0.5) * 0.2 }); fronds.push({ x: q.x, y: y + 10, z: q.z, ry: r() * 6 }); }
        else if (r() < 0.3) { walls.push({ x: q.x, y: y + 1.6, z: q.z, sx: 7, sy: 3.2, sz: 5, ry: -q.h, c: '#e8d8b8' }); roofs.push({ x: q.x, y: y + 3.6, z: q.z, sx: 7.6, sy: 0.8, sz: 5.6, ry: -q.h, c: '#a0503a' }); }
        continue;
      }
      const sz = 0.7 + r() * 0.9;
      trunks.push({ x: q.x, y: y + 1.5 * sz, z: q.z, sx: sz, sy: sz, sz });
      crowns.push({ x: q.x, y: y + 4.6 * sz, z: q.z, sx: sz * (1 + r() * 0.4), sy: sz * (0.8 + r() * 0.5), sz: sz * (1 + r() * 0.4), c: S.leaf[Math.floor(r() * 4)] });
    }
    if (trunks.length) { g.add(this.placeInstanced(new THREE.CylinderGeometry(0.3, 0.45, 3, 6), mat('#5b4030'), trunks)); g.add(this.placeInstanced(new THREE.IcosahedronGeometry(3.2, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), crowns)); }
    if (palms.length) { g.add(this.placeInstanced(new THREE.CylinderGeometry(0.18, 0.3, 10, 6), mat('#7a6248'), palms)); g.add(this.placeInstanced(new THREE.ConeGeometry(3.4, 1.6, 7), new THREE.MeshStandardMaterial({ color: S.leaf[1], flatShading: true }), fronds)); }
    if (walls.length) g.add(this.placeInstanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), walls));
    if (towers.length) g.add(this.placeInstanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: windowsTex(), roughness: 0.8 }), towers));
    if (roofs.length) g.add(this.placeInstanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), roofs));
  }
}
let WIN = null;
function windowsTex() { return (WIN ||= canvasTex(64, 128, (g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 128); for (let y = 6; y < 128; y += 16) for (let x = 6; x < 64; x += 16) { g.fillStyle = Math.random() < 0.3 ? '#f6d488' : '#5d7286'; g.fillRect(x, y, 9, 9); } })); }
function buildingTex(st) {
  return canvasTex(512, 100, (g) => { g.fillStyle = '#e4c9a4'; g.fillRect(0, 0, 512, 100); for (let x = 16; x < 512; x += 40) { g.fillStyle = '#7a5a3a'; g.fillRect(x, 50, 18, 40); } g.fillStyle = '#f2c230'; g.fillRect(140, 6, 232, 38); g.fillStyle = '#111'; g.font = '700 22px Inter, Arial'; g.textAlign = 'center'; g.fillText(`${st.mr} · ${st.name.toUpperCase()}`, 256, 33); });
}
function standTex(st) {
  return canvasTex(640, 90, (g) => { g.fillStyle = '#e8d8b0'; g.fillRect(0, 0, 640, 90); g.fillStyle = '#c0392b'; g.fillRect(150, 6, 340, 40); g.fillStyle = '#fff'; g.font = '700 22px Inter, Arial'; g.textAlign = 'center'; g.fillText(`${st.mr} बस स्थानक · ${st.name.toUpperCase()} S.T. STAND`, 320, 34); for (let x = 20; x < 640; x += 46) { g.fillStyle = '#6b5440'; g.fillRect(x, 54, 22, 32); } });
}
