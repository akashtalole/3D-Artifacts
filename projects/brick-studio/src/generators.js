/** Procedural builds: shapes made of voxels, packed into real bricks; text; photo mosaics. */
import { COLORS, COLOR } from './catalog.js';

// brick sizes the optimizer may use, largest first: [long, short]
const SIZES = [[8, 2], [6, 2], [4, 2], [3, 2], [2, 2], [8, 1], [6, 1], [4, 1], [3, 1], [2, 1], [1, 1]];
const brickId = (a, b) => `brick-${Math.min(a, b)}x${Math.max(a, b)}`;

/**
 * Pack voxels into bricks. voxels: Map "x,l,z" → colour id, where l is the brick layer (3 plates).
 * Alternates the preferred direction each layer and avoids seams that line up with the layer below.
 */
export function packBricks(voxels, y0 = 0) {
  const layers = new Map();
  for (const [k, c] of voxels) { const [x, l, z] = k.split(',').map(Number); if (!layers.has(l)) layers.set(l, new Map()); layers.get(l).set(`${x},${z}`, c); }
  const out = []; let below = new Map();   // cell → brick index in the layer below
  for (const l of [...layers.keys()].sort((a, b) => a - b)) {
    const cells = layers.get(l), used = new Map(), alongX = l % 2 === 0;
    const keys = [...cells.keys()].map((k) => k.split(',').map(Number)).sort((a, b) => (alongX ? a[1] - b[1] || a[0] - b[0] : a[0] - b[0] || a[1] - b[1]));
    let idx = 0;
    for (const [x, z] of keys) {
      if (used.has(`${x},${z}`)) continue;
      const col = cells.get(`${x},${z}`);
      let best = null;
      for (const [a, b] of SIZES) for (const flip of alongX ? [false, true] : [true, false]) {
        const sx = flip ? b : a, sz = flip ? a : b;
        let fits = true;
        for (let i = 0; i < sx && fits; i++) for (let j = 0; j < sz && fits; j++) { const k = `${x + i},${z + j}`; if (cells.get(k) !== col || used.has(k)) fits = false; }
        if (!fits) continue;
        // seam penalty: cells of this brick sitting on several different bricks below is good (bonding)
        const under = new Set(); for (let i = 0; i < sx; i++) for (let j = 0; j < sz; j++) { const u = below.get(`${x + i},${z + j}`); if (u !== undefined) under.add(u); }
        const score = sx * sz * 10 + (under.size > 1 ? 6 : 0) - (flip === alongX ? 3 : 0);
        if (!best || score > best.score) best = { sx, sz, score };
      }
      const { sx, sz } = best;
      for (let i = 0; i < sx; i++) for (let j = 0; j < sz; j++) used.set(`${x + i},${z + j}`, idx);
      const long = Math.max(sx, sz), short = Math.min(sx, sz);
      // catalogue bricks are defined with w (x extent) = long side, so rotate when the long side runs along z
      out.push({ part: brickId(long, short), color: col, x, z, y: y0 + l * 3, r: sx >= sz ? 0 : 1 });
      idx++;
    }
    below = used;
  }
  return out;
}

const V = () => new Map();
const put = (m, x, l, z, c) => m.set(`${x},${l},${z}`, c);
/** Shape generators: return a voxel map centred on the plate (size = plate studs). */
export const SHAPES = {
  sphere: { name: 'Sphere', params: { radius: [3, 12, 6], hollow: [0, 1, 1] }, make: ({ radius: R, hollow }, size, col) => {
    const m = V(), c = size / 2, hz = 1.2;   // a brick is 1.2 studs tall
    const L = Math.ceil((2 * R) / hz);
    for (let l = 0; l < L; l++) for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) {
      const dx = x + 0.5 - c, dz = z + 0.5 - c, dy = (l + 0.5) * hz - R, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d <= R && (!hollow || d > R - 1.6)) put(m, x, l, z, col(l, L));
    }
    return m; } },
  dome: { name: 'Dome', params: { radius: [3, 14, 8] }, make: ({ radius: R }, size, col) => {
    const m = V(), c = size / 2, hz = 1.2, L = Math.ceil(R / hz);
    for (let l = 0; l < L; l++) for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) { const dx = x + 0.5 - c, dz = z + 0.5 - c, dy = l * hz, d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d <= R && d > R - 2.4) put(m, x, l, z, col(l, L)); }
    return m; } },
  pyramid: { name: 'Stepped pyramid', params: { base: [4, 30, 16] }, make: ({ base }, size, col) => {
    const m = V(), c = Math.floor((size - base) / 2), L = Math.ceil(base / 2);
    for (let l = 0; l < L; l++) for (let x = l; x < base - l; x++) for (let z = l; z < base - l; z++) put(m, c + x, l, c + z, col(l, L));
    return m; } },
  tower: { name: 'Castle tower', params: { radius: [3, 10, 5], height: [4, 24, 12] }, make: ({ radius: R, height: H }, size, col) => {
    const m = V(), c = size / 2;
    for (let l = 0; l <= H; l++) for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) {
      const d = Math.hypot(x + 0.5 - c, z + 0.5 - c); if (d > R || d < R - 1.5) continue;
      const a = Math.atan2(z + 0.5 - c, x + 0.5 - c), seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 16);
      if (l === H && seg % 2) continue;                                         // crenellations
      if (l > 2 && l < H - 1 && l % 4 === 0 && seg % 4 === 1) continue;         // arrow slits
      if (l < 3 && Math.abs(a + Math.PI / 2) < 0.25) continue;                  // doorway
      put(m, x, l, z, col(l, H));
    }
    return m; } },
  wall: { name: 'Wall with windows', params: { length: [6, 30, 20], height: [3, 12, 6] }, make: ({ length, height }, size, col) => {
    const m = V(), x0 = Math.floor((size - length) / 2), z = Math.floor(size / 2);
    for (let l = 0; l < height; l++) for (let x = 0; x < length; x++) {
      const win = l >= 1 && l <= 2 && (x % 5 === 2 || x % 5 === 3) && x > 1 && x < length - 2;
      if (!win) { put(m, x0 + x, l, z, col(l, height)); put(m, x0 + x, l, z + 1, col(l, height)); }
    }
    return m; } },
  tree: { name: 'Tree', params: { height: [3, 10, 5] }, make: ({ height }, size, col) => {
    const m = V(), c = Math.floor(size / 2), R = 2 + height * 0.6;
    // canopy: a ball of leaves whose lowest layer rests on the trunk, which runs up into its middle
    const layers = []; for (let l = 0; l < 2 * R / 1.2 + 1; l++) { const cells = []; for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) { const dx = x + 0.5 - c, dz = z + 0.5 - c, dy = (l + 0.5) * 1.2 - R; if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= R) cells.push([x, z]); } if (cells.length) layers.push(cells); }
    layers.forEach((cells, k) => { for (const [x, z] of cells) put(m, x, height + k, z, k % 3 === 1 ? 'bgreen' : 'green'); });
    for (let l = 0; l < height + Math.floor(layers.length / 2); l++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(m, c - 1 + dx, l, c - 1 + dz, 'rbrown');
    void col; return m; } },
  stairs: { name: 'Spiral staircase', params: { radius: [3, 10, 6], height: [4, 30, 16] }, make: ({ radius: R, height: H }, size, col) => {
    const m = V(), c = size / 2;
    for (let l = 0; l < H; l++) { const a0 = (l / 8) * Math.PI * 2; for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) { const dx = x + 0.5 - c, dz = z + 0.5 - c, d = Math.hypot(dx, dz); if (d < 1.2) { put(m, x, l, z, col(l, H)); continue; } if (d > R) continue; let a = Math.atan2(dz, dx) - a0; a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); if (a < Math.PI * 0.8) put(m, x, l, z, col(l, H)); } }
    return m; } },
};

// a compact 5 × 7 pixel font for brick lettering
const FONT5 = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110', D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110', J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111', 0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111', 3: '11111000100010000010000011000101110',
  4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110', 6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110', 9: '01110100011000101111000010001001100',
  ' ': '00000000000000000000000000000000000', '-': '00000000000000011111000000000000000', '!': '00100001000010000100001000000000100', '.': '00000000000000000000000000110001100', '&': '01100100101010001000101011001001101', '♥': '00000010101111111111011100010000000',
};
/** Standing 1-stud-thick lettering, packed into 1×N bricks along each row. */
export function textBuild(text, size, col) {
  const chars = [...text.toUpperCase()].filter((ch) => FONT5[ch]).slice(0, Math.floor(size / 6));
  const W = chars.length * 6 - 1, x0 = Math.max(0, Math.floor((size - W) / 2)), z = Math.floor(size / 2), m = V();
  chars.forEach((ch, k) => { const g = FONT5[ch]; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r * 5 + c] === '1') put(m, x0 + k * 6 + c, 6 - r, z, col(k, chars.length)); });
  return m;
}

// ── mosaics ──
function lab(hex) {
  const n = parseInt(hex.slice(1), 16); let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  [r, g, b] = [r, g, b].map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  [x, y, z] = [x, y, z].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/**
 * Photo → mosaic. rgba: pixels already resampled to n × n. Returns parts: a layer of plates to hold it and
 * 1×1 / 1×2 / 1×4 tiles (or round tiles / plates) on top, colour-matched in CIELAB with optional dithering.
 */
export function mosaic(rgba, n, { palette = COLORS.filter((c) => !c.trans && !['gold', 'silver'].includes(c.id)), dither = true, style = 'tile', merge = true, x0 = 0, z0 = 0 } = {}) {
  const P = palette.map((c) => ({ c, lab: lab(c.hex) }));
  const buf = Float32Array.from(rgba);
  const grid = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j * n + i) * 4, r = buf[k], g = buf[k + 1], b = buf[k + 2];
    const L = lab('#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''));
    let best = P[0], bd = Infinity; for (const p of P) { const d = (p.lab[0] - L[0]) ** 2 + (p.lab[1] - L[1]) ** 2 + (p.lab[2] - L[2]) ** 2; if (d < bd) { bd = d; best = p; } }
    grid.push(best.c.id);
    if (dither) {   // Floyd–Steinberg error diffusion in RGB
      const h = best.c.hex, n2 = parseInt(h.slice(1), 16), er = r - ((n2 >> 16) & 255), eg = g - ((n2 >> 8) & 255), eb = b - (n2 & 255);
      const spread = (di, dj, w) => { const ii = i + di, jj = j + dj; if (ii < 0 || ii >= n || jj >= n) return; const q = (jj * n + ii) * 4; buf[q] += er * w; buf[q + 1] += eg * w; buf[q + 2] += eb * w; };
      spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16); spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
    }
  }
  const parts = [];
  // backing plates (8 × 8 where possible) so every tile connects
  for (let j = 0; j < n; j += 8) for (let i = 0; i < n; i += 8) { const w = Math.min(8, n - i), d = Math.min(8, n - j); const id = plateFor(w, d); if (id) parts.push({ part: id.id, color: 'black', x: x0 + i, z: z0 + j, y: 0, r: id.r }); else for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) parts.push({ part: 'plate-1x1', color: 'black', x: x0 + i + a, z: z0 + j + b, y: 0, r: 0 }); }
  const one = style === 'round' ? 'tile-round-1x1' : style === 'plate' ? 'plate-1x1' : 'tile-1x1';
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n;) {
      const c = grid[j * n + i]; let run = 1;
      if (merge && style === 'tile') while (i + run < n && grid[j * n + i + run] === c && run < 4) run++;
      if (run === 3) run = 2;
      parts.push({ part: run === 4 ? 'tile-1x4' : run === 2 ? 'tile-1x2' : one, color: c, x: x0 + i, z: z0 + j, y: 1, r: 0 });
      i += run;
    }
  }
  return { parts, colors: new Set(grid).size };
}
function plateFor(w, d) {
  const ok = { '8x8': 'plate-8x8', '8x6': 'plate-6x8', '6x8': 'plate-6x8', '8x4': 'plate-4x8', '4x8': 'plate-4x8', '6x6': 'plate-6x6', '4x4': 'plate-4x4', '6x4': 'plate-4x6', '4x6': 'plate-4x6', '8x2': 'plate-2x8', '2x8': 'plate-2x8', '4x2': 'plate-2x4', '2x4': 'plate-2x4', '2x2': 'plate-2x2' }[`${w}x${d}`];
  if (!ok) return null;
  return { id: ok, r: w >= d ? 0 : 1 };
}
/** Colour schemes for generated shapes. */
export const SCHEMES = {
  solid: (c) => () => c,
  stripes: (c, c2) => (l) => (l % 2 ? c2 : c),
  gradient: () => (l, L) => ['dred', 'red', 'orange', 'blorange', 'yellow', 'blyellow', 'white'][Math.min(6, Math.floor((l / Math.max(1, L)) * 7))],
  rainbow: () => (l) => ['red', 'orange', 'yellow', 'lime', 'bgreen', 'mazure', 'blue', 'lav', 'magenta'][l % 9],
  stone: () => (l, L, x = l) => ['lbg', 'dbg', 'lbg', 'lbg'][(x * 7 + l * 3) % 4],
};
void COLOR;
