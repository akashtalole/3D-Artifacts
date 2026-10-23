import * as THREE from 'three';
import { r } from './model.js';

/** Airflow particles: bypass (blue) and core (coloured by gas temperature). */
const X_IN = 4.5, X_FAN = 1.2, X_SPLIT = 0.98, X_BYP_OUT = -1.9, X_CORE_OUT = -2.4, X_END = -7;
export class Flow {
  constructor(n = 5000) {
    this.n = n;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const sprite = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
    this.mat = new THREE.PointsMaterial({ size: 0.04, map: sprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
    this.p = Array.from({ length: n }, (_, i) => this.spawn({ core: i % 10 < 3 }, true));
  }
  spawn(p, anywhere) {
    p.x = anywhere ? X_END + Math.random() * (X_IN - X_END) : X_IN + Math.random() * 0.3;
    p.q = Math.random(); p.th = Math.random() * Math.PI * 2; p.rv = 0;
    return p;
  }
  /** Radius for a particle at axial position x across its duct (q = 0 inner … 1 outer). */
  radius(p, x, rev) {
    if (x > X_FAN) {   // inlet stream tube converging onto the fan face
      const rf = p.core ? 0.3 + 0.2 * p.q : 0.52 + 0.46 * p.q, k = Math.min(1, (x - X_FAN) / 3.3);
      return rf * (1 + 0.35 * k);
    }
    if (p.core) {
      if (x > X_SPLIT) return 0.3 + 0.2 * p.q;
      if (x > X_CORE_OUT) { const h = r('hubC', x), c = r('caseC', x); return h + (c - h) * (0.1 + 0.8 * p.q); }
      const k = (X_CORE_OUT - x) / 4; return (0.05 + 0.37 * p.q) * (1 + 0.5 * k) + 0.0;
    }
    if (x > X_SPLIT) return 0.52 + 0.46 * p.q;
    if (rev && x < -0.55) return r('cowl', -0.55) + (1.18 - r('cowl', -0.55)) * p.q + (-0.55 - x) * 2.5;   // through the cascades
    if (x > X_BYP_OUT) { const i = r('cowl', x), o = r('nacIn', x); return i + (o - i) * (0.08 + 0.84 * p.q); }
    const k = (X_BYP_OUT - x) / 5; return (0.6 + 0.3 * p.q) * (1 + 0.25 * k);
  }
  /** Gas temperature (K) at x for the core stream from the cycle stations. */
  temp(c, x, core) {
    if (!core) return x > X_FAN ? c.T2 : x > X_BYP_OUT ? c.T13 : c.T13 + (c.T0 - c.T13) * Math.min(1, (X_BYP_OUT - x) / 4);
    const S = [[X_IN, c.T0], [X_FAN, c.T2], [0.98, c.T25 * 0.8 + c.T2 * 0.2], [0.5, c.T25], [-0.45, c.T3], [-0.62, c.T3], [-0.75, c.T4], [-0.98, c.T4], [-1.15, c.T45], [-1.95, c.T5], [-2.4, c.T5], [X_END, (c.T5 + c.T0) / 2]];
    for (let i = 1; i < S.length; i++) if (x >= S[i][0]) { const [x0, t0] = S[i - 1], [x1, t1] = S[i]; return t0 + (t1 - t0) * (x - x0) / (x1 - x0); }
    return c.T0;
  }
  update(dt, E, slow, visible) {
    const c = E.c, rev = E.revPos > 0.5;
    const vb = Math.max(0, c.V19 * 0.6 + c.V0), vc = Math.max(0, c.V9 * 0.5 + c.V0);
    const flowOn = c.W > 2 || c.V0 > 5;
    this.points.visible = visible && flowOn; if (!this.points.visible) return;
    this.mat.opacity = 0.25 + 0.4 * Math.min(1, c.W / 150);
    const fanSwirl = E.N1 / 100 * 1.2, coreSwirl = E.N2 / 100 * 2.5;
    const col = new THREE.Color();
    for (let i = 0; i < this.n; i++) {
      const p = this.p[i];
      let v;   // local axial speed (m/s, before slow motion)
      const x = p.x;
      if (p.core) v = x > 0.5 ? 60 + c.Wc * 3 : x > -0.5 ? 40 + c.Wc * 2 : x > -1.0 ? 30 + c.Wc * 2 : x > X_CORE_OUT ? 80 + vc * 0.4 : vc;
      else v = x > X_BYP_OUT ? 50 + vb * 0.6 : vb;
      if (!flowOn) v = 0;
      if (rev && !p.core && x < -0.55 && x > -1.6) v = vb * 0.5;
      p.x -= v * dt * slow;
      // swirl behind the rotors, removed by stators / OGVs
      if (x < X_FAN && x > 0.72 && !p.core) p.th += fanSwirl * dt * slow * 20; 
      if (p.core && x < 0.5 && x > -1.95) p.th += (x > -0.5 ? coreSwirl : -coreSwirl * 0.6) * dt * slow * 10;
      if (p.x < X_END || (rev && !p.core && p.x < -1.6)) this.spawn(p, false);
      if (!flowOn && Math.random() < 0.002) this.spawn(p, true);
      const rr = this.radius(p, p.x, rev && !p.core);
      let px = p.x;
      if (rev && !p.core && p.x < -0.55) px = -0.55 + (p.x + 0.55) * 0.3;   // turned outwards and forwards
      this.pos[i * 3] = px; this.pos[i * 3 + 1] = Math.cos(p.th) * rr; this.pos[i * 3 + 2] = Math.sin(p.th) * rr;
      const T = this.temp(c, p.x, p.core && p.x < 0.98);
      heat(col, T, p.core);
      const fade = flowOn ? 1 : 0.15;
      this.col[i * 3] = col.r * fade; this.col[i * 3 + 1] = col.g * fade; this.col[i * 3 + 2] = col.b * fade;
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
  }
}
/** Blue for cold air, through white and yellow to orange-red for hot gas. */
export function heat(col, T, core) {
  const k = Math.max(0, Math.min(1, (T - 280) / 1500));
  if (!core && k < 0.06) return col.setRGB(0.35, 0.6, 1.0);
  if (k < 0.15) return col.setRGB(0.4 + k * 3, 0.7 + k, 1.0);
  if (k < 0.35) return col.setRGB(1.0, 0.95, 0.75 - (k - 0.15) * 2);
  if (k < 0.6) return col.setRGB(1.0, 0.85 - (k - 0.35) * 1.4, 0.35 - (k - 0.35));
  return col.setRGB(1.0, 0.45 - (k - 0.6) * 0.6, 0.12);
}
