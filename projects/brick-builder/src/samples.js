/**
 * Sample builds for a 32 × 32 baseplate.
 * Each brick: [partId, colourIndex, x, y, z, rot] — x/z = min stud cell of the
 * rotated footprint, y = height in plates, rot = quarter turns.
 */
import { C } from './colors.js';

function house() {
  const out = [];
  const X0 = 10, X1 = 21, Z0 = 10, Z1 = 19, COURSES = 5;
  const opening = (x, z, c) => {
    if (z === Z1 && x >= 15 && x <= 16 && c <= 2) return 'door';
    if (c >= 1 && c <= 2) {
      if (z === Z1 && ((x >= 12 && x <= 13) || (x >= 18 && x <= 19))) return 'window';
      if (z === Z0 && x >= 14 && x <= 17) return 'window';
      if ((x === X0 || x === X1) && z >= 14 && z <= 15) return 'window';
    }
    return 'wall';
  };
  const colour = { wall: C.White, window: C['Trans-Light Blue'], door: C['Reddish Brown'] };
  // split a run of cells into brick lengths; walls start with a 2 on odd courses (running bond)
  const split = (n, offset) => {
    const lens = [];
    let left = n;
    if (offset && left > 2) { lens.push(2); left -= 2; }
    while (left > 0) { const l = [4, 3, 2, 1].find((k) => k <= left); lens.push(l); left -= l; }
    return lens;
  };
  const line = (cells, c, along) => {
    let i = 0;
    while (i < cells.length) {
      const kind = opening(cells[i][0], cells[i][1], c);
      let j = i; while (j < cells.length && opening(cells[j][0], cells[j][1], c) === kind) j++;
      let k = i;
      for (const l of split(j - i, kind === 'wall' && c % 2 === 1)) {
        const [x, z] = cells[k];
        out.push([`brick-${l}x1`, colour[kind], x, c * 3, z, along === 'x' ? 0 : 1]);
        k += l;
      }
      i = j;
    }
  };
  for (let c = 0; c < COURSES; c++) {
    const xOwns = c % 2 === 0;
    for (const z of [Z0, Z1]) {
      const cells = []; for (let x = xOwns ? X0 : X0 + 1; x <= (xOwns ? X1 : X1 - 1); x++) cells.push([x, z]);
      line(cells, c, 'x');
    }
    for (const x of [X0, X1]) {
      const cells = []; for (let z = xOwns ? Z0 + 1 : Z0; z <= (xOwns ? Z1 - 1 : Z1); z++) cells.push([x, z]);
      line(cells, c, 'z');
    }
  }
  // gable roof: 45° slopes stepping in one stud per course, ridge of tiles
  const top = COURSES * 3;
  for (let k = 0; k < 4; k++) {
    for (const x of [X0, X0 + 4, X0 + 8]) {
      out.push(['slope-4x2', C['Dark Red'], x, top + 3 * k, Z1 - 1 - k, 0]);
      out.push(['slope-4x2', C['Dark Red'], x, top + 3 * k, Z0 + k, 2]);
    }
    const a = Z0 + 2 + k, b = Z1 - 2 - k;
    if (b >= a) for (const x of [X0, X1]) out.push([`brick-${b - a + 1}x1`, C.White, x, top + 3 * k, a, 1]);
  }
  for (const x of [X0, X0 + 4, X0 + 8]) out.push(['tile-4x2', C['Dark Red'], x, top + 12, 14, 0]);
  // path, trees, flowers
  for (let z = 20; z < 32; z += 2) out.push(['tile-2x2', C.Tan, 15, 0, z, 0]);
  const tree = (x, z) => {
    for (let y = 0; y < 9; y += 3) out.push(['brick-2x2', C['Reddish Brown'], x, y, z, 0]);
    out.push(['plate-6x6', C.Green, x - 2, 9, z - 2, 0], ['plate-6x6', C.Green, x - 2, 10, z - 2, 0]);
    for (let y = 11; y < 14; y++) out.push(['plate-4x4', C.Green, x - 1, y, z - 1, 0]);
    out.push(['brick-2x2', C.Lime, x, 14, z, 0], ['cone-1x1', C.Lime, x, 17, z, 0]);
  };
  tree(3, 24); tree(26, 4); tree(26, 25);
  [[5, 14, C.Red], [6, 16, C.Yellow], [4, 18, C.Red], [8, 22, C['Bright Pink']], [22, 22, C.Yellow], [24, 20, C.Red], [27, 15, C['Medium Lavender']]]
    .forEach(([x, z, col]) => out.push(['roundplate-1x1', col, x, 0, z, 0]));
  return out;
}

function tower() {
  const cyc = [C.Red, C.Orange, C.Yellow, C.Lime, C.Green, C['Medium Azure'], C.Blue, C['Medium Lavender'], C.Magenta];
  const out = [];
  for (let L = 0; L < 27; L++) out.push(L % 2 ? ['brick-4x2', cyc[L % cyc.length], 15, 3 * L, 14, 1] : ['brick-4x2', cyc[L % cyc.length], 14, 3 * L, 15, 0]);
  out.push(['cone-1x1', C.Yellow, 15, 81, 15, 0], ['cone-1x1', C.Yellow, 16, 81, 16, 0]);
  return out;
}

function heart() {
  const out = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out.push(['plate-4x4', C.White, 8 + i * 4, 0, 8 + j * 4, 0]);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const X = (i - 7.5) / 6.6, Y = (7.5 - j) / 6.6 + 0.12;
    const inside = (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0;
    const edge = inside && ((X * 1.06) ** 2 + (Y * 1.06) ** 2 - 1) ** 3 - (X * 1.06) ** 2 * (Y * 1.06) ** 3 > 0;
    out.push(['tile-1x1', inside ? (edge ? C['Dark Red'] : C.Red) : C.White, 8 + i, 1, 8 + j, 0]);
  }
  return out;
}

export const SAMPLES = [
  { id: 'house', name: 'Cottage', build: house },
  { id: 'tower', name: 'Rainbow tower', build: tower },
  { id: 'heart', name: 'Heart mosaic', build: heart },
];
