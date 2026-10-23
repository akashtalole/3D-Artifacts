/**
 * Solid model by constructive solid geometry (three-bvh-csg):
 * stock box minus one cutter body per feature. Everything is built in machine
 * coordinates (X right, Y back, Z up); the scene rotates the "machine" group.
 */
import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { holeCentres } from './model.js';
import { rrect, circle, stadium, ring, contains } from './geom2d.js';

const ev = new Evaluator();
ev.attributes = ['position', 'normal'];
ev.useGroups = false;

const brush = (geo) => { geo.deleteAttribute('uv'); const b = new Brush(geo); b.updateMatrixWorld(); return b; };
function prism(shape2d, zBottom, zTop) {
  const pts = ring(shape2d, true).map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: zTop - zBottom, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, zBottom);
  return geo;
}
function cylinder(x, y, r, zBottom, zTop, seg = 40) {
  return new THREE.CylinderGeometry(r, r, zTop - zBottom, seg).rotateX(Math.PI / 2).translate(x, y, (zTop + zBottom) / 2);
}

/** Cutter bodies (geometries) for one feature. */
function cutters(f, stock) {
  const top = 2;
  switch (f.type) {
    case 'face': return [new THREE.BoxGeometry(stock.w + 4, stock.d + 4, f.depth + top).translate(stock.w / 2, stock.d / 2, -f.depth + (f.depth + top) / 2)];
    case 'rectPocket': return [prism(rrect(f.cx, f.cy, f.w, f.h, f.r), -f.depth, top)];
    case 'circPocket': return [cylinder(f.cx, f.cy, f.d / 2, -f.depth, top, 64)];
    case 'slot': return [prism(stadium(f.cx, f.cy, f.len, f.width, f.angle), -f.depth, top)];
    case 'holes': {
      const r = f.d / 2, tip = r * Math.tan((31 * Math.PI) / 180);
      return holeCentres(f).flatMap(([x, y]) => (f.through
        ? [cylinder(x, y, r, -stock.h - 2, top, 32)]
        : [cylinder(x, y, r, -f.depth, top, 32), new THREE.ConeGeometry(r, tip, 32).rotateX(-Math.PI / 2).translate(x, y, -f.depth - tip / 2)]));
    }
    default: return [];
  }
}

/** Build the finished part. Returns a BufferGeometry (machine coordinates). */
export function buildPart(doc) {
  const { stock } = doc;
  let result = brush(new THREE.BoxGeometry(stock.w, stock.d, stock.h).translate(stock.w / 2, stock.d / 2, -stock.h / 2));
  for (const f of doc.features) {
    if (f.visible === false) continue;
    if (f.type === 'profile') {
      const depth = f.through ? stock.h + 2 : f.depth;
      const outline = f.shape === 'circle' ? circle(f.cx, f.cy, f.d / 2) : rrect(f.cx, f.cy, f.w, f.h, f.r);
      const big = brush(new THREE.BoxGeometry(stock.w + 60, stock.d + 60, depth + 2).translate(stock.w / 2, stock.d / 2, -depth + (depth + 2) / 2));
      const keep = brush(prism(outline, -depth - 1, 3));
      const cutter = ev.evaluate(big, keep, SUBTRACTION);
      cutter.updateMatrixWorld();
      result = ev.evaluate(result, cutter, SUBTRACTION);
      continue;
    }
    for (const g of cutters(f, stock)) result = ev.evaluate(result, brush(g), SUBTRACTION);
  }
  const geo = result.geometry;
  geo.computeBoundingBox();
  return geo;
}

/** Height of the designed part's top surface at (x, y) — used by the CAM simulation comparison. */
export function designHeightFn(doc) {
  const { stock } = doc;
  const shapes = doc.features.filter((f) => f.visible !== false).map((f) => {
    if (f.type === 'face') return { all: true, z: -f.depth };
    if (f.type === 'rectPocket') return { s: rrect(f.cx, f.cy, f.w, f.h, f.r), z: -f.depth };
    if (f.type === 'circPocket') return { s: circle(f.cx, f.cy, f.d / 2), z: -f.depth };
    if (f.type === 'slot') return { s: stadium(f.cx, f.cy, f.len, f.width, f.angle), z: -f.depth };
    if (f.type === 'holes') return { many: holeCentres(f).map(([x, y]) => circle(x, y, f.d / 2)), z: f.through ? -stock.h : -f.depth };
    if (f.type === 'profile') return { outside: f.shape === 'circle' ? circle(f.cx, f.cy, f.d / 2) : rrect(f.cx, f.cy, f.w, f.h, f.r), z: f.through ? -stock.h : -f.depth };
    return null;
  }).filter(Boolean);
  return (x, y) => {
    let z = 0;
    for (const s of shapes) {
      if (s.all) z = Math.min(z, s.z);
      else if (s.s && contains(s.s, x, y)) z = Math.min(z, s.z);
      else if (s.many && s.many.some((c) => contains(c, x, y))) z = Math.min(z, s.z);
      else if (s.outside && !contains(s.outside, x, y)) z = Math.min(z, s.z);
    }
    return Math.max(z, -stock.h);
  };
}

/** True where (x, y) lies outside a through profile: that material falls away as scrap. */
export function scrapFn(doc) {
  const p = doc.features.find((f) => f.type === 'profile' && f.visible !== false);
  if (!p) return () => false;
  const o = p.shape === 'circle' ? circle(p.cx, p.cy, p.d / 2 + 0.6) : rrect(p.cx, p.cy, p.w + 1.2, p.h + 1.2, p.r + 0.6);
  return (x, y) => !contains(o, x, y);
}

/** Removed volume (cm³) and part mass from the design height function. */
export function massProps(doc, fn, density) {
  const { stock } = doc, step = Math.max(0.25, Math.sqrt(stock.w * stock.d / 40000));
  let removed = 0;
  for (let y = step / 2; y < stock.d; y += step) for (let x = step / 2; x < stock.w; x += step) removed += -fn(x, y) * step * step;
  const stockV = stock.w * stock.d * stock.h;
  const partV = stockV - removed;
  return { stockCm3: stockV / 1000, removedCm3: removed / 1000, partCm3: partV / 1000, massG: (partV / 1000) * density };
}
