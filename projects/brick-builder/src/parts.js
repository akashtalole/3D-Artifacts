/**
 * Part catalogue and geometry, in millimetres, using the classic system brick dimensions:
 * stud pitch 8.0 mm, plate 3.2 mm, brick 9.6 mm (3 plates), stud Ø 4.8 × 1.7 mm,
 * 0.1 mm clearance on every side so neighbouring bricks show a hairline seam.
 *
 * Geometry origin: bottom centre. Long side along +x (w), depth along z (d).
 * Slopes descend towards +z; their studded row is at −z.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const P = 8, PH = 3.2, GAP = 0.1, STUD_R = 2.4, STUD_H = 1.7;

const defs = [];
const add = (cat, kind, w, d, h, name) => defs.push({ id: `${kind}-${w}x${d}`, cat, kind, w, d, h, name });
for (const [w, d] of [[1, 1], [2, 1], [3, 1], [4, 1], [6, 1], [8, 1], [2, 2], [3, 2], [4, 2], [6, 2], [8, 2]]) add('Bricks', 'brick', w, d, 3, `Brick ${d}×${w}`);
for (const [w, d] of [[1, 1], [2, 1], [3, 1], [4, 1], [6, 1], [8, 1], [2, 2], [3, 2], [4, 2], [6, 2], [8, 2], [4, 4], [6, 4], [6, 6], [8, 6]]) add('Plates', 'plate', w, d, 1, `Plate ${d}×${w}`);
for (const [w, d] of [[1, 1], [2, 1], [4, 1], [2, 2], [4, 2]]) add('Tiles', 'tile', w, d, 1, `Tile ${d}×${w}`);
for (const w of [1, 2, 3, 4]) add('Slopes', 'slope', w, 2, 3, `Slope 45° 2×${w}`);
add('Round', 'round', 1, 1, 3, 'Round brick 1×1');
add('Round', 'roundplate', 1, 1, 1, 'Round plate 1×1');
add('Round', 'cone', 1, 1, 3, 'Cone 1×1');
export const PARTS = defs;
export const PART = Object.fromEntries(defs.map((p) => [p.id, p]));
export const CATS = [...new Set(defs.map((p) => p.cat))];

/** Is local cell row j of this part studded on top (for stacking)? */
export const studdedRow = (part, j) => part.kind !== 'tile' && !(part.kind === 'slope' && j > 0);

function studGeo(x, z, y) {
  return new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 24, 1).translate(x, y + STUD_H / 2, z);
}
const cellX = (i, w) => (i + 0.5) * P - (w * P) / 2;

function build(part) {
  const { kind, w, d, h } = part;
  const H = h * PH, W = w * P - 2 * GAP, D = d * P - 2 * GAP;
  const geos = [];
  if (kind === 'brick' || kind === 'plate' || kind === 'tile') {
    geos.push(new RoundedBoxGeometry(W, H, D, 2, kind === 'tile' ? 0.45 : 0.35).translate(0, H / 2, 0));
    if (kind !== 'tile') for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) geos.push(studGeo(cellX(i, w), cellX(j, d), H));
  } else if (kind === 'slope') {
    // Profile in (u = −z, v = y), extruded along x
    const run = P - GAP, lip = H - run;
    const s = new THREE.Shape();
    s.moveTo(-D / 2, 0); s.lineTo(-D / 2, lip); s.lineTo(-D / 2 + run, H); s.lineTo(D / 2, H); s.lineTo(D / 2, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false });
    g.rotateY(Math.PI / 2).translate(-W / 2, 0, 0);
    geos.push(g);
    for (let i = 0; i < w; i++) geos.push(studGeo(cellX(i, w), cellX(0, d), H));
  } else if (kind === 'round' || kind === 'roundplate') {
    geos.push(new THREE.CylinderGeometry(P / 2 - GAP, P / 2 - GAP, H, 40).translate(0, H / 2, 0));
    geos.push(studGeo(0, 0, H));
  } else if (kind === 'cone') {
    geos.push(new THREE.CylinderGeometry(STUD_R + 0.1, P / 2 - GAP, H - PH * 0.4, 40).translate(0, PH * 0.4 + (H - PH * 0.4) / 2, 0));
    geos.push(new THREE.CylinderGeometry(P / 2 - GAP, P / 2 - GAP, PH * 0.4, 40).translate(0, PH * 0.2, 0));
    geos.push(studGeo(0, 0, H));
  }
  const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { g.deleteAttribute('uv'); return g; }));
  merged.computeBoundingBox(); merged.computeBoundingSphere();
  return merged;
}

const cache = new Map();
export function partGeometry(id) {
  if (!cache.has(id)) cache.set(id, build(PART[id]));
  return cache.get(id);
}
