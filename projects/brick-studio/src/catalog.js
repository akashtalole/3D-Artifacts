/**
 * Parts and colours. Units: 1 stud = 8 mm (one world unit), 1 plate = 3.2 mm (0.4 units), 1 brick = 3 plates.
 * Footprint cells are (i, j): i along x (0..w-1), j along z (0..d-1). Height h is in plates.
 * LDraw / BrickLink part numbers are included for export; double-check them before ordering.
 */

const all = (w, d) => { const c = []; for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) c.push([i, j]); return c; };
const row = (w, j) => Array.from({ length: w }, (_, i) => [i, j]);
const mk = (o) => ({ studs: all(o.w, o.d), anti: all(o.w, o.d), occ: null, ...o });

export const PARTS = [];
const add = (o) => PARTS.push(mk(o));
// bricks
for (const [w, d, ld] of [[1, 1, '3005'], [2, 1, '3004'], [3, 1, '3622'], [4, 1, '3010'], [6, 1, '3009'], [8, 1, '3008'], [2, 2, '3003'], [3, 2, '3002'], [4, 2, '3001'], [6, 2, '2456'], [8, 2, '3007']])
  add({ id: `brick-${d}x${w}`, name: `Brick ${d}×${w}`, cat: 'Bricks', w, d, h: 3, kind: 'box', ldraw: ld });
add({ id: 'brick-corner', name: 'Brick 2×2 corner', cat: 'Bricks', w: 2, d: 2, h: 3, kind: 'L', ldraw: '2357', mask: [[0, 0], [1, 0], [0, 1]] });
add({ id: 'brick-1x2-grille', name: 'Brick 1×2 grille', cat: 'Bricks', w: 2, d: 1, h: 3, kind: 'grille', ldraw: '2877' });
// plates
for (const [w, d, ld] of [[1, 1, '3024'], [2, 1, '3023'], [3, 1, '3623'], [4, 1, '3710'], [6, 1, '3666'], [8, 1, '3460'], [2, 2, '3022'], [3, 2, '3021'], [4, 2, '3020'], [6, 2, '3795'], [8, 2, '3034'], [4, 4, '3031'], [6, 4, '3032'], [8, 4, '3035'], [6, 6, '3958'], [8, 6, '3036'], [8, 8, '41539']])
  add({ id: `plate-${d}x${w}`, name: `Plate ${d}×${w}`, cat: 'Plates', w, d, h: 1, kind: 'box', ldraw: ld });
add({ id: 'plate-corner', name: 'Plate 2×2 corner', cat: 'Plates', w: 2, d: 2, h: 1, kind: 'L', ldraw: '2420', mask: [[0, 0], [1, 0], [0, 1]] });
add({ id: 'wedge-r', name: 'Wedge plate 2×4 right', cat: 'Plates', w: 4, d: 2, h: 1, kind: 'wedge', ldraw: '41769', poly: [[0, 0], [4, 0], [4, 1], [0, 2]] });
add({ id: 'wedge-l', name: 'Wedge plate 2×4 left', cat: 'Plates', w: 4, d: 2, h: 1, kind: 'wedge', ldraw: '41770', poly: [[0, 0], [4, 0], [4, 2], [0, 1]] });
// tiles (smooth top)
for (const [w, d, ld] of [[1, 1, '3070b'], [2, 1, '3069b'], [4, 1, '2431'], [6, 1, '6636'], [2, 2, '3068b'], [4, 2, '87079']])
  add({ id: `tile-${d}x${w}`, name: `Tile ${d}×${w}`, cat: 'Tiles', w, d, h: 1, kind: 'box', ldraw: ld, studs: [] });
add({ id: 'tile-round-1x1', name: 'Tile round 1×1', cat: 'Tiles', w: 1, d: 1, h: 1, kind: 'round', ldraw: '98138', studs: [] });
// slopes: the slope runs down towards +z (the front); studs sit on the back row
for (const [w, d, ld] of [[1, 2, '3040'], [2, 2, '3039'], [3, 2, '3038'], [4, 2, '3037']])
  add({ id: `slope45-${d}x${w}`, name: `Slope 45° ${d}×${w}`, cat: 'Slopes', w, d, h: 3, kind: 'slope', ldraw: ld, studs: row(w, 0) });
add({ id: 'slope33-3x2', name: 'Slope 33° 3×2', cat: 'Slopes', w: 2, d: 3, h: 3, kind: 'slope', ldraw: '3298', studs: row(2, 0) });
add({ id: 'slope65-2x2', name: 'Slope 65° 2×2', cat: 'Slopes', w: 2, d: 2, h: 6, kind: 'slope', ldraw: '3678b', studs: row(2, 0) });
for (const [w, d, ld] of [[1, 2, '3665'], [2, 2, '3660']])
  add({ id: `inv-${d}x${w}`, name: `Inverted slope 45° ${d}×${w}`, cat: 'Slopes', w, d, h: 3, kind: 'invslope', ldraw: ld, anti: row(w, 0) });
add({ id: 'curve-2x1', name: 'Curved slope 2×1', cat: 'Slopes', w: 1, d: 2, h: 2, kind: 'curve', ldraw: '11477', studs: [] });
add({ id: 'curve-4x1', name: 'Curved slope 4×1', cat: 'Slopes', w: 1, d: 4, h: 2, kind: 'curve', ldraw: '61678', studs: [] });
add({ id: 'curve-2x2', name: 'Curved slope 2×2', cat: 'Slopes', w: 2, d: 2, h: 2, kind: 'curve', ldraw: '15068', studs: [] });
// round
add({ id: 'round-brick-1x1', name: 'Round brick 1×1', cat: 'Round', w: 1, d: 1, h: 3, kind: 'round', ldraw: '3062b' });
add({ id: 'round-plate-1x1', name: 'Round plate 1×1', cat: 'Round', w: 1, d: 1, h: 1, kind: 'round', ldraw: '4073' });
add({ id: 'round-plate-2x2', name: 'Round plate 2×2', cat: 'Round', w: 2, d: 2, h: 1, kind: 'round', ldraw: '4032' });
add({ id: 'round-brick-2x2', name: 'Round brick 2×2', cat: 'Round', w: 2, d: 2, h: 3, kind: 'round', ldraw: '3941' });
add({ id: 'cone-1x1', name: 'Cone 1×1', cat: 'Round', w: 1, d: 1, h: 3, kind: 'cone', ldraw: '4589' });
add({ id: 'dome-2x2', name: 'Dome 2×2', cat: 'Round', w: 2, d: 2, h: 3, kind: 'dome', ldraw: '553', studs: [] });
// arches, windows, special
add({ id: 'arch-1x4', name: 'Arch 1×4', cat: 'Arches & windows', w: 4, d: 1, h: 3, kind: 'arch', ldraw: '3659', anti: [[0, 0], [3, 0]], occ: (lvl) => (lvl < 2 ? [[0, 0], [3, 0]] : null) });
add({ id: 'arch-1x6', name: 'Arch 1×6', cat: 'Arches & windows', w: 6, d: 1, h: 3, kind: 'arch', ldraw: '3455', anti: [[0, 0], [5, 0]], occ: (lvl) => (lvl < 2 ? [[0, 0], [5, 0]] : null) });
add({ id: 'arch-1x6x2', name: 'Arch 1×6×2', cat: 'Arches & windows', w: 6, d: 1, h: 6, kind: 'arch', ldraw: '15254', anti: [[0, 0], [5, 0]], occ: (lvl) => (lvl < 5 ? [[0, 0], [5, 0]] : null) });
add({ id: 'window-1x2x2', name: 'Window 1×2×2', cat: 'Arches & windows', w: 2, d: 1, h: 6, kind: 'window', ldraw: '60592' });
add({ id: 'window-1x4x3', name: 'Window 1×4×3', cat: 'Arches & windows', w: 4, d: 1, h: 9, kind: 'window', ldraw: '60594' });
add({ id: 'door-1x4x6', name: 'Door frame 1×4×6', cat: 'Arches & windows', w: 4, d: 1, h: 18, kind: 'door', ldraw: '60596', anti: [[0, 0], [3, 0]], occ: (lvl) => (lvl < 15 ? [[0, 0], [3, 0]] : null) });
add({ id: 'fence-1x4', name: 'Fence 1×4×1', cat: 'Arches & windows', w: 4, d: 1, h: 3, kind: 'fence', ldraw: '3633', studs: [[0, 0], [3, 0]] });
add({ id: 'technic-1x2', name: 'Technic brick 1×2', cat: 'Technic', w: 2, d: 1, h: 3, kind: 'technic', ldraw: '3700' });
add({ id: 'technic-1x4', name: 'Technic brick 1×4', cat: 'Technic', w: 4, d: 1, h: 3, kind: 'technic', ldraw: '3701' });
add({ id: 'technic-1x6', name: 'Technic brick 1×6', cat: 'Technic', w: 6, d: 1, h: 3, kind: 'technic', ldraw: '3894' });
add({ id: 'technic-1x8', name: 'Technic brick 1×8', cat: 'Technic', w: 8, d: 1, h: 3, kind: 'technic', ldraw: '3702' });
add({ id: 'jumper-1x2', name: 'Plate 1×2 jumper', cat: 'Plates', w: 2, d: 1, h: 1, kind: 'jumper', ldraw: '3794b', studs: [] });

// apply masks to the stud / anti-stud / occupancy lists of L-shaped and wedge parts
const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
for (const p of PARTS) {
  if (p.mask) { const key = new Set(p.mask.map((c) => c.join())); const f = (l) => l.filter((c) => key.has(c.join())); p.studs = f(p.studs); p.anti = f(p.anti); p.cells = p.mask; }
  else if (p.poly) { p.cells = all(p.w, p.d).filter(([i, j]) => inPoly(i + 0.5, j + 0.5, p.poly)); const key = new Set(p.cells.map((c) => c.join())); p.studs = p.studs.filter((c) => key.has(c.join())); p.anti = p.anti.filter((c) => key.has(c.join())); }
  else p.cells = all(p.w, p.d);
  const vol = p.cells.length * p.h / 3;                 // in "1×1 brick" units
  p.grams = +(vol * 0.29 * (p.kind === 'slope' || p.kind === 'curve' ? 0.75 : p.kind === 'arch' || p.kind === 'window' || p.kind === 'door' ? 0.55 : 1) + p.studs.length * 0.02).toFixed(2);
  p.price = +(1.5 + 0.9 * vol + (p.kind === 'box' || p.kind === 'L' ? 0 : 2)).toFixed(1);   // illustrative ₹ per part
}
export const PART = Object.fromEntries(PARTS.map((p) => [p.id, p]));
export const CATS = [...new Set(PARTS.map((p) => p.cat))];

/** Colours (Rebrickable hex values) with LDraw and BrickLink colour numbers. */
export const COLORS = [
  ['white', 'White', '#FFFFFF', 15, 1], ['lbg', 'Light bluish gray', '#A0A5A9', 71, 86], ['dbg', 'Dark bluish gray', '#6C6E68', 72, 85], ['black', 'Black', '#05131D', 0, 11],
  ['red', 'Red', '#C91A09', 4, 5], ['dred', 'Dark red', '#720E0F', 320, 59], ['orange', 'Orange', '#FE8A18', 25, 4], ['blorange', 'Bright light orange', '#F8BB3D', 191, 110],
  ['yellow', 'Yellow', '#F2CD37', 14, 3], ['blyellow', 'Bright light yellow', '#FFF03A', 226, 103], ['lime', 'Lime', '#BBE90B', 27, 34], ['bgreen', 'Bright green', '#4B9F4A', 10, 36],
  ['green', 'Green', '#237841', 2, 6], ['dgreen', 'Dark green', '#184632', 288, 80], ['sgreen', 'Sand green', '#A0BCAC', 378, 48], ['olive', 'Olive green', '#9B9A5A', 330, 155],
  ['mazure', 'Medium azure', '#36AEBF', 322, 156], ['dazure', 'Dark azure', '#078BC9', 321, 153], ['mblue', 'Medium blue', '#5A93DB', 73, 42], ['blue', 'Blue', '#0055BF', 1, 7],
  ['dblue', 'Dark blue', '#0A3463', 272, 63], ['sblue', 'Sand blue', '#6074A1', 379, 55], ['lav', 'Medium lavender', '#AC78BA', 31, 157], ['dpurple', 'Dark purple', '#3F3691', 85, 89],
  ['magenta', 'Magenta', '#923978', 26, 71], ['dpink', 'Dark pink', '#C870A0', 5, 47], ['bpink', 'Bright pink', '#E4ADC8', 29, 104], ['coral', 'Coral', '#FF698F', 353, 220],
  ['tan', 'Tan', '#E4CD9E', 19, 2], ['dtan', 'Dark tan', '#958A73', 28, 69], ['rbrown', 'Reddish brown', '#582A12', 70, 88], ['dorange', 'Dark orange', '#A95500', 484, 68],
  ['gold', 'Pearl gold', '#AA7F2E', 297, 115], ['silver', 'Flat silver', '#898788', 179, 95],
  ['tclear', 'Trans-clear', '#FCFCFC', 47, 12, true], ['tred', 'Trans-red', '#C91A09', 36, 17, true], ['torange', 'Trans-orange', '#F08F1C', 57, 98, true], ['tyellow', 'Trans-yellow', '#F5CD2F', 46, 19, true],
  ['tgreen', 'Trans-green', '#84B68D', 34, 20, true], ['tlblue', 'Trans-light blue', '#AEEFEC', 43, 15, true],
].map(([id, name, hex, ldraw, bl, trans]) => ({ id, name, hex, ldraw, bl, trans: !!trans }));
export const COLOR = Object.fromEntries(COLORS.map((c) => [c.id, c]));

/** Rotate a local cell for rotation r (quarter turns about +y). */
export function rotCell([i, j], p, r) {
  switch (r & 3) { case 0: return [i, j]; case 1: return [p.d - 1 - j, i]; case 2: return [p.w - 1 - i, p.d - 1 - j]; default: return [j, p.w - 1 - i]; }
}
export const dims = (p, r) => (r & 1 ? [p.d, p.w] : [p.w, p.d]);
