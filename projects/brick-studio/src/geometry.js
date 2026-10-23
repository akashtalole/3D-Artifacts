import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Part geometry in local units (1 = one stud, 8 mm). Origin at the footprint's minimum corner, bottom face at y = 0. */
export const PLATE = 0.4, STUD_R = 0.3, STUD_H = 0.2125, GAP = 0.0125;
const cache = new Map();

const clean = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((n.attributes.position.count) * 2), 2)); n.morphAttributes = {}; return n; };
function box(x0, y0, z0, x1, y1, z1, r = 0.025) { const g = new RoundedBoxGeometry(x1 - x0, y1 - y0, z1 - z0, 2, Math.min(r, (y1 - y0) / 2.2)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return clean(g); }
function stud(cx, y, cz, hollow) {
  const g = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 20, 1, false); g.translate(cx, y + STUD_H / 2, cz);
  if (!hollow) return clean(g);
  const inner = new THREE.CylinderGeometry(STUD_R * 0.6, STUD_R * 0.6, STUD_H * 0.98, 16, 1, true); inner.scale(-1, 1, 1); inner.translate(cx, y + STUD_H / 2 + 0.002, cz);
  return mergeGeometries([clean(g), clean(inner)]);
}
/** Extrude a 2D profile (in the z–y plane) along x from x0 to x1. */
function extrudeZY(pts, x0, x1, bevel = 0.012) {
  const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0 - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 12 });
  // rotateY(−90°) maps (x, y, z) → (−z, y, x): the profile's first coordinate becomes world z, the extrusion runs along −x
  g.rotateY(-Math.PI / 2); g.translate(x1 - bevel, 0, 0);
  return clean(g);
}
/** Extrude a 2D profile (in the x–y plane) along z from z0 to z1. */
function extrudeXY(shape, z0, z1, bevel = 0.012) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0 - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 16 });
  g.translate(0, 0, z0 + bevel); return clean(g);
}
/** Extrude a footprint polygon (in the x–z plane) upwards. */
function extrudeXZ(pts, y0, y1, bevel = 0.012) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0 - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + bevel, 0); return clean(g);
}
const studsOn = (cells, y, hollow) => cells.map(([i, j]) => stud(i + 0.5, y, j + 0.5, hollow));

/**
 * Geometry for a part: { body, extras: [{ geo, mat: 'glass' | 'dark' }] }.
 * Cached per part id.
 */
export function partGeometry(p) {
  if (cache.has(p.id)) return cache.get(p.id);
  const H = p.h * PLATE, g = GAP, list = [], extras = [];
  const top = (cells = p.studs) => list.push(...studsOn(cells, H));
  switch (p.kind) {
    case 'box': case 'grille': case 'technic': case 'jumper':
      list.push(box(g, 0, g, p.w - g, H, p.d - g)); top();
      if (p.kind === 'jumper') list.push(stud(p.w / 2, H, p.d / 2, true));
      if (p.kind === 'grille') for (let k = 0; k < 4; k++) extras.push({ geo: clean(new THREE.BoxGeometry(p.w - 0.3, 0.05, 0.02).translate(p.w / 2, H * 0.2 + k * H * 0.18, -0.002)), mat: 'dark' });
      if (p.kind === 'technic') for (let k = 1; k < p.w; k++) for (const z of [-0.003, p.d + 0.003]) { const c = new THREE.CircleGeometry(0.24, 20); if (z < 0) c.rotateY(Math.PI); c.translate(k, H * 0.55, z); extras.push({ geo: clean(c), mat: 'dark' }); }
      break;
    case 'L': {
      for (const [i, j] of p.cells) list.push(box(i + g, 0, j + g, i + 1 - g, H, j + 1 - g, 0.01));
      top(); break;
    }
    case 'wedge': list.push(extrudeXZ(p.poly.map(([x, z]) => [x + (x === 0 ? g : -g), z + (z === 0 ? g : -g)]), 0, H)); top(); break;
    case 'slope': {   // back row full height, sloped face down to a small lip at the front (+z)
      const lip = Math.min(0.13, H * 0.25), back = 1 - g;
      list.push(extrudeZY([[g, 0], [p.d - g, 0], [p.d - g, lip], [back, H], [g, H]], g, p.w - g)); top(); break;
    }
    case 'invslope': {   // full top, sloped underside
      const lip = 0.13;
      list.push(extrudeZY([[g, 0], [1 - g, 0], [p.d - g, H - lip], [p.d - g, H], [g, H]], g, p.w - g)); top(); break;
    }
    case 'curve': {
      const pts = [[g, 0], [p.d - g, 0], [p.d - g, 0.08]];
      for (let k = 1; k <= 16; k++) { const t = k / 16, z = p.d - g - (p.d - 2 * g) * t, y = 0.08 + (H - 0.08) * Math.sin((t * Math.PI) / 2) ** 0.9; pts.push([z, y]); }
      pts.push([g, H]);
      list.push(extrudeZY(pts, g, p.w - g)); break;
    }
    case 'round': {
      const r = p.w / 2 - g, cx = p.w / 2, cz = p.d / 2;
      const c = new THREE.CylinderGeometry(r, r, H - 0.02, 32); c.translate(cx, H / 2, cz); list.push(clean(c));
      if (p.w === 1 && p.studs.length) list.push(stud(cx, H - 0.02, cz, false));
      else top();
      if (p.studs.length === 0) { const cap = new THREE.CylinderGeometry(r * 0.96, r, 0.02, 32); cap.translate(cx, H - 0.01, cz); list.push(clean(cap)); }
      break;
    }
    case 'cone': {
      const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.48, 0), new THREE.Vector2(0.48, 0.12), new THREE.Vector2(0.24, H - 0.02), new THREE.Vector2(0.001, H - 0.02)];
      const c = new THREE.LatheGeometry(pts, 28); c.translate(0.5, 0, 0.5); list.push(clean(c)); list.push(stud(0.5, H - 0.02, 0.5, true)); break;
    }
    case 'dome': {
      const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.98, 0), new THREE.Vector2(0.98, 0.2)];
      for (let k = 1; k <= 12; k++) { const a = (k / 12) * Math.PI / 2; pts.push(new THREE.Vector2(0.98 * Math.cos(a), 0.2 + (H - 0.2) * Math.sin(a))); }
      const c = new THREE.LatheGeometry(pts, 32); c.translate(1, 0, 1); list.push(clean(c)); break;
    }
    case 'arch': case 'door': {
      const s = new THREE.Shape(); const W = p.w, legs = 1, open = W - 2 * legs;
      s.moveTo(g, 0); s.lineTo(legs - g, 0);
      const spring = p.kind === 'door' ? H - 3 * PLATE : H - PLATE - open / 2 * 0.75;   // where the curve begins
      s.lineTo(legs - g, spring);
      if (p.kind === 'door') s.lineTo(W - legs + g, spring);
      else s.absellipse(W / 2, spring, open / 2 + g, (H - PLATE) - spring, Math.PI, 0, true);
      s.lineTo(W - legs + g, 0); s.lineTo(W - g, 0); s.lineTo(W - g, H); s.lineTo(g, H); s.lineTo(g, 0);
      list.push(extrudeXY(s, g, p.d - g)); top(); break;
    }
    case 'window': {
      const f = 0.18, s = new THREE.Shape([new THREE.Vector2(g, 0), new THREE.Vector2(p.w - g, 0), new THREE.Vector2(p.w - g, H), new THREE.Vector2(g, H)]);
      s.holes.push(new THREE.Path([new THREE.Vector2(f, f), new THREE.Vector2(f, H - f), new THREE.Vector2(p.w - f, H - f), new THREE.Vector2(p.w - f, f)]));
      list.push(extrudeXY(s, g + 0.25, p.d - g - 0.25)); list.push(box(g, 0, g, p.w - g, 0.4, p.d - g, 0.01)); list.push(box(g, H - 0.4, g, p.w - g, H, p.d - g, 0.01)); top();
      const pane = new THREE.BoxGeometry(p.w - 2 * f, H - 2 * f, 0.04); pane.translate(p.w / 2, H / 2, p.d / 2); extras.push({ geo: clean(pane), mat: 'glass' });
      break;
    }
    case 'fence': {
      list.push(box(g, 0, g, 1 - g, H, p.d - g)); list.push(box(p.w - 1 + g, 0, g, p.w - g, H, p.d - g)); list.push(box(g, H - 0.3, 0.3, p.w - g, H, 0.7, 0.01));
      for (let k = 1; k < p.w - 1; k++) list.push(box(k + 0.35, 0, 0.35, k + 0.65, H - 0.3, 0.65, 0.01));
      top(); break;
    }
  }
  const res = { body: mergeGeometries(list), extras };
  res.body.computeBoundingBox(); res.body.computeBoundingSphere();
  cache.set(p.id, res);
  return res;
}
/** Baseplate: a thin plate with studs on top (top face at y = 0). */
export function baseplateGeometry(size) {
  const plate = box(0, -0.25, 0, size, 0, size, 0.05);
  const s = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 14); s.translate(0, STUD_H / 2, 0);
  return { plate, stud: clean(s) };
}
