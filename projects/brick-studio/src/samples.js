/** Sample builds, generated in code. */
import { SHAPES, SCHEMES, packBricks, mosaic } from './generators.js';
import { Build } from './model.js';

/** Keep only parts that fit and are connected to the baseplate. */
function prune(parts, size = 32) {
  const B = new Build(size); for (const p of parts) if (B.inBounds(p) && !B.collides(p)) B.addPart(p, false);
  const fl = new Set(B.stability().floating); return B.parts.filter((p) => !fl.has(p.uid)).map(({ uid, ...p }) => p);
}

function cottage() {
  const parts = [], vox = new Map(), put = (x, l, z, c) => vox.set(`${x},${l},${z}`, c);
  const X0 = 8, X1 = 23, Z0 = 8, Z1 = 21, L = 6;   // walls 16 × 14 studs, 6 bricks high
  const openings = (x, l, z) => (z === Z0 && x >= 14 && x <= 17) ||                                   // door
    (l >= 1 && l <= 3 && ((z === Z0 || z === Z1) && ((x >= 9 && x <= 12) || (x >= 19 && x <= 22)))) ||   // front / back windows
    (l >= 1 && l <= 3 && (x === X0 || x === X1) && z >= 13 && z <= 16);                                // side windows
  for (let l = 0; l < L; l++) for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) {
    const wall = x === X0 || x === X1 || z === Z0 || z === Z1;
    if (wall && !openings(x, l, z)) put(x, l, z, l === 0 ? 'dtan' : 'tan');
  }
  // gable ends close the triangle under the roof
  for (let k = 0; k < 7; k++) for (let z = Z0 + k + 1; z <= Z1 - k - 1; z++) { put(X0, L + k, z, 'tan'); put(X1, L + k, z, 'tan'); }
  parts.push(...packBricks(vox));
  parts.push({ part: 'door-1x4x6', color: 'rbrown', x: 14, y: 0, z: Z0, r: 0 });
  for (const x of [9, 19]) for (const z of [Z0, Z1]) parts.push({ part: 'window-1x4x3', color: 'white', x, y: 3, z, r: 0 });
  for (const x of [X0, X1]) parts.push({ part: 'window-1x4x3', color: 'white', x, y: 3, z: 13, r: 1 });
  // roof: rows of 45° slopes stepping in from front and back, a ridge on top
  for (let k = 0; k < 7; k++) for (let x = X0; x <= X1; x += 4) {
    parts.push({ part: 'slope45-2x4', color: 'dred', x, y: 18 + 3 * k, z: Z0 - 1 + k, r: 2 });
    parts.push({ part: 'slope45-2x4', color: 'dred', x, y: 18 + 3 * k, z: Z1 - k, r: 0 });
  }
  for (let x = X0; x <= X1; x += 4) parts.push({ part: 'brick-2x4', color: 'dred', x, y: 39, z: 14, r: 0 }, { part: 'tile-2x4', color: 'dbg', x, y: 42, z: 14, r: 0 });
  // garden path, fence, flowers and a tree
  for (let z = 0; z < Z0; z += 2) parts.push({ part: 'tile-2x2', color: 'lbg', x: 15, y: 0, z, r: 0 });
  for (const x of [2, 6, 22, 26]) parts.push({ part: 'fence-1x4', color: 'white', x, y: 0, z: 2, r: 0 });
  const fl = ['red', 'yellow', 'bpink', 'orange', 'lav', 'white'];
  [[3, 5], [5, 6], [4, 4], [26, 6], [28, 5], [27, 4], [11, 5], [20, 5]].forEach(([x, z], i) => { parts.push({ part: 'plate-1x1', color: 'green', x, y: 0, z, r: 0 }, { part: 'round-plate-1x1', color: fl[i % fl.length], x, y: 1, z, r: 0 }); });
  const tree = packBricks(SHAPES.tree.make({ height: 4 }, 12, () => 'green'));
  parts.push(...tree.map((p) => ({ ...p, x: p.x - 2, z: p.z + 19 })));
  return { size: 32, base: 'green', parts: prune(parts) };
}
function heartImage(n) {
  const px = new Float32Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i - n / 2 + 0.5) / (n * 0.36), y = -(j - n / 2 + 0.5) / (n * 0.36) + 0.15;
    const inside = (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0, k = (j * n + i) * 4;
    const t = j / n;
    if (inside) { px[k] = 230 - 60 * t; px[k + 1] = 40 + 50 * (1 - t); px[k + 2] = 80 + 60 * t; } else { const g = 235 - 25 * ((i + j) % 2); px[k] = g; px[k + 1] = g + 5; px[k + 2] = 250; }
    px[k + 3] = 255;
  }
  return px;
}
export const SAMPLES = {
  cottage: { name: 'Cottage', make: cottage },
  tower: { name: 'Castle tower', make: () => ({ size: 32, base: 'dbg', parts: prune(packBricks(SHAPES.tower.make({ radius: 6, height: 14 }, 32, SCHEMES.stone()))) }) },
  sphere: { name: 'Rainbow sphere', make: () => ({ size: 32, base: 'white', parts: prune(packBricks(SHAPES.sphere.make({ radius: 8, hollow: 1 }, 32, SCHEMES.rainbow()))) }) },
  heart: { name: 'Heart mosaic', make: () => ({ size: 32, base: 'black', parts: mosaic(heartImage(32), 32, { dither: false }).parts }) },
};
