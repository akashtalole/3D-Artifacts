/**
 * A deformable heightfield for the sandbox. Buckets and blades cut it; dumped
 * material piles on it and slumps to its angle of repose. Volumes are in m³.
 */
import * as THREE from 'three';

const C_BASE = new THREE.Color('#a68a63'), C_GRASS = new THREE.Color('#8d8a5a'), C_CUT = new THREE.Color('#6b4a2e'), C_FILL = new THREE.Color('#b48b5c');

export class Terrain {
  constructor(size = 48, res = 0.25) {
    this.size = size; this.res = res; this.n = Math.round(size / res) + 1;
    const n = this.n; this.h = new Float32Array(n * n); this.base = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -size / 2 + i * res, z = -size / 2 + j * res;
      const v = 0.08 * Math.sin(x * 0.31) * Math.cos(z * 0.27) + 0.04 * Math.sin(x * 0.9 + z * 0.7);
      this.h[j * n + i] = this.base[j * n + i] = v;
    }
    const g = new THREE.PlaneGeometry(size, size, n - 1, n - 1); g.rotateX(-Math.PI / 2);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * n * 3), 3));
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }));
    this.mesh.receiveShadow = true;
    this.dirty = true; this.sync();
    this.moved = 0;      // m³ cut in total
  }
  idx(x, z) { const i = Math.round((x + this.size / 2) / this.res), j = Math.round((z + this.size / 2) / this.res); return i < 0 || j < 0 || i >= this.n || j >= this.n ? -1 : j * this.n + i; }
  height(x, z) {
    const fx = (x + this.size / 2) / this.res, fz = (z + this.size / 2) / this.res, n = this.n;
    const i = Math.max(0, Math.min(n - 2, Math.floor(fx))), j = Math.max(0, Math.min(n - 2, Math.floor(fz))), u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
    const h = this.h; return (h[j * n + i] * (1 - u) + h[j * n + i + 1] * u) * (1 - v) + (h[(j + 1) * n + i] * (1 - u) + h[(j + 1) * n + i + 1] * u) * v;
  }
  /** lower the ground to y inside a disc; returns the volume removed */
  cut(x, z, r, y) {
    const n = this.n, a = this.res * this.res; let vol = 0;
    this.each(x, z, r, (k, d) => { const t = y + (d / r) ** 2 * 0.25; if (this.h[k] > t) { vol += (this.h[k] - t) * a; this.h[k] = t; } });
    if (vol > 0) { this.dirty = true; this.moved += vol; this.relax(x, z, r + 1.2); }
    return vol;
  }
  /** pile a volume around a point */
  add(x, z, vol, r = 0.9) {
    if (vol <= 0) return; let wsum = 0; const ws = [];
    this.each(x, z, r, (k, d) => { const w = 1 - d / r; ws.push([k, w]); wsum += w; });
    if (!wsum) return; const a = this.res * this.res;
    for (const [k, w] of ws) this.h[k] += (vol * w) / (wsum * a);
    this.dirty = true; this.relax(x, z, r + 1.5);
  }
  each(x, z, r, f) {
    const n = this.n, res = this.res, i0 = Math.max(0, Math.floor((x - r + this.size / 2) / res)), i1 = Math.min(n - 1, Math.ceil((x + r + this.size / 2) / res));
    const j0 = Math.max(0, Math.floor((z - r + this.size / 2) / res)), j1 = Math.min(n - 1, Math.ceil((z + r + this.size / 2) / res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const px = -this.size / 2 + i * res, pz = -this.size / 2 + j * res, d = Math.hypot(px - x, pz - z); if (d <= r) f(j * n + i, d); }
  }
  /** let steep slopes slump to ≈38° (loose soil), conserving volume */
  relax(x, z, r, iters = 4) {
    const n = this.n, maxd = Math.tan(38 * Math.PI / 180) * this.res, h = this.h;
    const i0 = Math.max(1, Math.floor((x - r + this.size / 2) / this.res)), i1 = Math.min(n - 2, Math.ceil((x + r + this.size / 2) / this.res));
    const j0 = Math.max(1, Math.floor((z - r + this.size / 2) / this.res)), j1 = Math.min(n - 2, Math.ceil((z + r + this.size / 2) / this.res));
    for (let it = 0; it < iters; it++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * n + i;
      for (const o of [1, -1, n, -n]) { const d = h[k] - h[k + o]; if (d > maxd) { const m = (d - maxd) * 0.25; h[k] -= m; h[k + o] += m; } }
    }
  }
  sync() {
    if (!this.dirty) return; this.dirty = false;
    const p = this.geo.attributes.position, c = this.geo.attributes.color, n = this.n, col = new THREE.Color();
    for (let k = 0; k < n * n; k++) {
      p.setY(k, this.h[k]); const d = this.h[k] - this.base[k];
      if (d < -0.04) col.copy(C_BASE).lerp(C_CUT, Math.min(1, -d / 0.8));
      else if (d > 0.04) col.copy(C_BASE).lerp(C_FILL, Math.min(1, d / 0.5));
      else { const x = k % n, z = Math.floor(k / n); col.copy(C_BASE).lerp(C_GRASS, 0.5 + 0.5 * Math.sin(x * 0.37) * Math.cos(z * 0.29)); }
      c.setXYZ(k, col.r, col.g, col.b);
    }
    p.needsUpdate = true; c.needsUpdate = true; this.geo.computeVertexNormals();
  }
  reset() { this.h.set(this.base); this.moved = 0; this.dirty = true; this.sync(); }
}
