import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const cache = new Map();
/** Shared PBR material by key. */
export function mat(color, rough = 0.6, metal = 0, extra = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  return cache.get(key);
}
export const glow = (color, intensity = 2) => mat('#000000', 1, 0, { emissive: color, emissiveIntensity: intensity });

export function box(w, h, d, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}
export function cyl(r, h, material, x = 0, y = 0, z = 0, parent, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ── Animated flow tubes ─────────────────────────────────────────────────────
const STRIPE = canvasTex(64, 8, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.25)');
  grd.addColorStop(0.85, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
}, false);
STRIPE.wrapS = STRIPE.wrapT = THREE.RepeatWrapping;

export const flows = [];   // { tex, speed, group, kind }
/**
 * A glowing tube whose stripes travel along the path.
 * kind: power | supply | return | data | token — speeds are scaled per kind each frame.
 */
export function flowTube(points, { radius = 0.3, color = '#ffd34d', dash = 6, kind = 'power', opacity = 0.9, closed = false, segments } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), closed, 'catmullrom', 0.05);
  const len = curve.getLength();
  const tex = STRIPE.clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, len / dash), 1);
  const m = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const geo = new THREE.TubeGeometry(curve, segments || Math.max(8, Math.min(400, Math.round(len / (radius * 4)))), radius, 8, closed);
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = 3;
  flows.push({ tex, len, dash, kind, mesh });
  return mesh;
}
/** Advance every flow tube; speeds is {kind: stripes per second}. */
export function updateFlows(dt, speeds) {
  for (const f of flows) f.tex.offset.x -= dt * (speeds[f.kind] ?? 1);
}

// ── Labels ─────────────────────────────────────────────────────────────────
export const labels = [];   // { obj, tags }
export function label(text, parent, pos, tags, cls = '') {
  const el = document.createElement('div');
  el.className = `tag ${cls}`;
  el.innerHTML = text;
  const o = new CSS2DObject(el);
  o.position.copy(pos);
  parent.add(o);
  labels.push({ obj: o, tags: Array.isArray(tags) ? tags : [tags] });
  return o;
}
