/**
 * Material-removal simulation on a height-field ("Z-map") of the stock.
 * Each feed move sweeps the tool (flat, ball, drill-point or face mill) along a
 * segment; every grid cell within the tool radius is lowered to the tool's
 * underside. The stock is drawn as a displaced grid with skirts on its sides.
 * Compare mode colours each cell against the designed part:
 * green = on size, amber = material left, red = gouge.
 */
import * as THREE from 'three';

export class StockSim {
  constructor(stock, color) {
    this.stock = stock;
    const area = stock.w * stock.d;
    this.cell = Math.max(0.2, Math.sqrt(area / 90000));
    this.nx = Math.max(2, Math.round(stock.w / this.cell) + 1);
    this.ny = Math.max(2, Math.round(stock.d / this.cell) + 1);
    this.cx = stock.w / (this.nx - 1); this.cy = stock.d / (this.ny - 1);
    this.h = new Float32Array(this.nx * this.ny);
    this.base = new THREE.Color(color);
    this.mode = 'material';
    this.design = null;
    this.removed = 0;
    this._build();
  }
  _build() {
    const { nx, ny } = this, N = nx * ny;
    // top grid + 4 skirts (2 rows of vertices each)
    const skirtN = 2 * (2 * nx + 2 * ny);
    const pos = new Float32Array((N + skirtN) * 3), nor = new Float32Array((N + skirtN) * 3), col = new Float32Array((N + skirtN) * 3);
    const idx = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; pos[k * 3] = i * this.cx; pos[k * 3 + 1] = j * this.cy; pos[k * 3 + 2] = 0; nor[k * 3 + 2] = 1;
      if (i < nx - 1 && j < ny - 1) { const a = k, b = k + 1, c = k + nx, d = k + nx + 1; idx.push(a, b, d, a, d, c); }
    }
    this.skirts = [];
    let v = N;
    const edges = [
      { cells: Array.from({ length: nx }, (_, i) => i), n: [0, -1, 0] },                          // front (y = 0)
      { cells: Array.from({ length: nx }, (_, i) => (ny - 1) * nx + (nx - 1 - i)), n: [0, 1, 0] }, // back
      { cells: Array.from({ length: ny }, (_, j) => j * nx + nx - 1), n: [1, 0, 0] },              // right
      { cells: Array.from({ length: ny }, (_, j) => (ny - 1 - j) * nx), n: [-1, 0, 0] },           // left
    ];
    for (const e of edges) {
      const start = v;
      for (const c of e.cells) {
        for (const top of [true, false]) {
          pos[v * 3] = pos[c * 3]; pos[v * 3 + 1] = pos[c * 3 + 1]; pos[v * 3 + 2] = top ? 0 : -this.stock.h;
          nor.set(e.n, v * 3); v++;
        }
      }
      const m = e.cells.length;
      for (let q = 0; q < m - 1; q++) { const a = start + q * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, d, a, d, c); }
      this.skirts.push({ start, cells: e.cells });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide }));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.dirty = [0, 0, nx - 1, ny - 1];
    this.update();
  }
  reset() { this.h.fill(0); this.removed = 0; this.dirty = [0, 0, this.nx - 1, this.ny - 1]; this.update(); }
  setDesign(fn, scrap) {
    this.design = new Float32Array(this.nx * this.ny);
    this.scrap = new Uint8Array(this.nx * this.ny);
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const k = j * this.nx + i;
      this.design[k] = fn(i * this.cx, j * this.cy);
      this.scrap[k] = scrap && scrap(i * this.cx, j * this.cy) ? 1 : 0;
    }
    this.dirty = [0, 0, this.nx - 1, this.ny - 1];
  }
  setMode(m) { this.mode = m; this.dirty = [0, 0, this.nx - 1, this.ny - 1]; this.update(); }

  /** Sweep a tool along segment a→b (machine coords). Returns volume removed (mm³). */
  sweep(a, b, tool) {
    const r = tool.d / 2, { nx, ny, cx, cy, h } = this, H = this.stock.h;
    const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - r) / cx)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a.x, b.x) + r) / cx));
    const j0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - r) / cy)), j1 = Math.min(ny - 1, Math.ceil((Math.max(a.y, b.y) + r) / cy));
    if (i0 > i1 || j0 > j1) return 0;
    if (Math.min(a.z, b.z) >= 0) return 0;
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, r2 = r * r;
    const flatXY = L2 < 1e-10, zMin = Math.min(a.z, b.z);
    const cone = Math.tan((31 * Math.PI) / 180);
    let vol = 0;
    const cellA = cx * cy;
    for (let j = j0; j <= j1; j++) {
      const py = j * cy;
      for (let i = i0; i <= i1; i++) {
        const px = i * cx;
        let t = flatXY ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = a.x + dx * t - px, qy = a.y + dy * t - py, d2 = qx * qx + qy * qy;
        if (d2 > r2) continue;
        let z = flatXY ? zMin : a.z + (b.z - a.z) * t;
        if (tool.type === 'ball') z += r - Math.sqrt(r2 - d2);
        else if (tool.type === 'drill') z += Math.sqrt(d2) * cone;
        if (z < -H) z = -H;
        const k = j * nx + i;
        if (z < h[k]) { vol += (h[k] - z) * cellA; h[k] = z; }
      }
    }
    if (vol > 0) {
      const d = this.dirty;
      if (!d) this.dirty = [i0, j0, i1, j1];
      else this.dirty = [Math.min(d[0], i0), Math.min(d[1], j0), Math.max(d[2], i1), Math.max(d[3], j1)];
      this.removed += vol;
    }
    return vol;
  }

  update() {
    if (!this.dirty) return;
    const { nx, ny, cx, cy, h, design } = this, H = this.stock.h;
    const pos = this.geo.attributes.position.array, nor = this.geo.attributes.normal.array, col = this.geo.attributes.color.array;
    const [i0, j0, i1, j1] = this.dirty;
    const base = this.base, tmp = new THREE.Color();
    const ok = new THREE.Color('#3fcf8e'), rest = new THREE.Color('#ffb020'), gouge = new THREE.Color('#ff3b30'), spoil = new THREE.Color('#5d4a37');
    for (let j = Math.max(0, j0 - 1); j <= Math.min(ny - 1, j1 + 1); j++) for (let i = Math.max(0, i0 - 1); i <= Math.min(nx - 1, i1 + 1); i++) {
      const k = j * nx + i, z = h[k];
      pos[k * 3 + 2] = z;
      const zl = h[j * nx + Math.max(0, i - 1)], zr = h[j * nx + Math.min(nx - 1, i + 1)];
      const zd = h[Math.max(0, j - 1) * nx + i], zu = h[Math.min(ny - 1, j + 1) * nx + i];
      let gx = -(zr - zl) / (2 * cx), gy = -(zu - zd) / (2 * cy), gz = 1;
      const len = Math.hypot(gx, gy, gz); nor[k * 3] = gx / len; nor[k * 3 + 1] = gy / len; nor[k * 3 + 2] = gz / len;
      if (z <= -H + 1e-3) tmp.copy(spoil);
      else if (this.mode === 'compare' && design && this.scrap[k]) tmp.copy(base).multiplyScalar(0.45);
      else if (this.mode === 'compare' && design) {
        const e = z - design[k];
        tmp.copy(e > 0.05 ? rest : e < -0.05 ? gouge : ok);
        if (e > 0.05 && z >= -1e-6) tmp.copy(base).multiplyScalar(0.92);
      } else {
        const cut = z < -1e-4;
        tmp.copy(base).multiplyScalar(cut ? 0.78 + 0.22 * (1 + z / H) : 1.0);
        if (cut && (Math.abs(gx) > 2 || Math.abs(gy) > 2)) tmp.multiplyScalar(0.8);
      }
      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
    }
    for (const s of this.skirts) {
      s.cells.forEach((c, q) => {
        const v = s.start + q * 2;
        pos[v * 3 + 2] = Math.max(-H, h[c]);
        for (const vv of [v, v + 1]) { col[vv * 3] = base.r * 0.85; col[vv * 3 + 1] = base.g * 0.85; col[vv * 3 + 2] = base.b * 0.85; }
      });
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.computeBoundingSphere();
    this.dirty = null;
  }
}

/** 3D model of the cutting tool, holder and spindle nose; origin at the tool tip. */
export function toolModel(tool) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#b9bec6', metalness: 0.9, roughness: 0.28 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2f36', metalness: 0.6, roughness: 0.4 });
  const coat = new THREE.MeshStandardMaterial({ color: tool.type === 'drill' ? '#c9a24a' : '#5d6a7a', metalness: 0.85, roughness: 0.3 });
  const r = tool.d / 2, L = tool.len;
  const spin = new THREE.Group(); g.add(spin);
  const add = (geo, m, y, p = spin) => { const mesh = new THREE.Mesh(geo, m); mesh.position.y = y; mesh.castShadow = true; p.add(mesh); return mesh; };
  if (tool.type === 'face') {
    add(new THREE.CylinderGeometry(r, r, 8, 32), dark, 4);
    for (let i = 0; i < tool.flutes; i++) {
      const ins = add(new THREE.BoxGeometry(4, 3, 2), coat, 1.5);
      const a = (i / tool.flutes) * Math.PI * 2; ins.position.x = Math.cos(a) * (r - 2); ins.position.z = Math.sin(a) * (r - 2);
    }
    add(new THREE.CylinderGeometry(8, 8, 20, 24), steel, 18);
  } else {
    const fl = add(new THREE.CylinderGeometry(r, r, L, 24, 8), coat, L / 2);
    if (tool.type === 'drill') { fl.position.y = L / 2 + r * 0.6; add(new THREE.ConeGeometry(r, r * 0.6, 24).rotateX(Math.PI), coat, r * 0.3); }  // 118° point
    if (tool.type === 'ball') add(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), coat, r);
    for (let k = 0; k < 6; k++) { const s = add(new THREE.TorusGeometry(r * 1.001, r * 0.06, 4, 24), dark, 2 + (k * (L - 4)) / 5); s.rotation.x = Math.PI / 2 + 0.25; }
    add(new THREE.CylinderGeometry(Math.max(r, 3), Math.max(r, 3), 18, 24), steel, L + 9);
  }
  const top = tool.type === 'face' ? 28 : L + 18;
  add(new THREE.CylinderGeometry(11, 13, 14, 32), dark, top + 7, g);           // collet nut
  add(new THREE.CylinderGeometry(20, 16, 26, 32), steel, top + 27, g);          // holder taper
  const spindle = add(new THREE.CylinderGeometry(32, 32, 70, 40), new THREE.MeshStandardMaterial({ color: '#e8eaee', metalness: 0.3, roughness: 0.5, transparent: true, opacity: 0.85 }), top + 75, g);
  spindle.castShadow = false;
  g.userData.spin = spin;
  return g;
}

/** Simple chip particles thrown off the cutter. */
export class Chips {
  constructor(color, floorZ) {
    this.N = 500; this.p = new Float32Array(this.N * 3); this.v = new Float32Array(this.N * 3); this.life = new Float32Array(this.N); this.i = 0; this.floorZ = floorZ;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.95 }));
    this.points.frustumCulled = false;
    this.p.fill(-9999);
  }
  emit(x, y, z, r, n) {
    for (let k = 0; k < n; k++) {
      const i = this.i = (this.i + 1) % this.N, a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 80;
      this.p.set([x + Math.cos(a) * r, y + Math.sin(a) * r, z + 0.5], i * 3);
      this.v.set([Math.cos(a + 1.4) * s, Math.sin(a + 1.4) * s, 40 + Math.random() * 60], i * 3);
      this.life[i] = 1.2;
    }
  }
  step(dt) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.v[i * 3 + 2] -= 400 * dt;
      for (let a = 0; a < 3; a++) this.p[i * 3 + a] += this.v[i * 3 + a] * dt;
      if (this.p[i * 3 + 2] < this.floorZ) { this.p[i * 3 + 2] = this.floorZ; this.v[i * 3] *= 0.3; this.v[i * 3 + 1] *= 0.3; this.v[i * 3 + 2] = 0; }
      if (this.life[i] <= 0) this.p[i * 3 + 2] = -9999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
