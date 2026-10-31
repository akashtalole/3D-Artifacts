/**
 * Facility layout of an illustrative e-commerce fulfilment centre (metres).
 * Building frame: x runs west → east (0…W), y runs north → south (0…D).
 * North wall: outbound docks · sorter · pack stations. Middle: AMR pick zone (west) and
 * pallet reserve racking (east). South wall: receiving and inbound docks.
 */
export const W = 132, D = 84, CELL = 1;
export const H = 11;   // clear height

// ── Outbound ──
export const OUT_DOORS = Array.from({ length: 8 }, (_, i) => ({ id: i, x: 60 + i * 9, y: 0 }));
export const LANE = { y0: 3, y1: 13 };
export const CONVEYOR = { y: 16, x0: 6, x1: 128, w: 1.0 };

// ── Pack stations (up to 10) ──
export const PACK_MAX = 12;
export const PACK = Array.from({ length: PACK_MAX }, (_, k) => ({ id: k, x: 9 + k * 5, table: { y0: 18.4, y1: 19.8, w: 3 }, packer: { y: 17.5 }, access: { x: 9 + k * 5, y: 21.6 } }));

// ── Pick zone shelving (carton flow / shelving, one SKU per bay face) ──
export const PICK_ROWS = [30, 35, 40, 45, 50, 55];
export const PICK_DEPTH = 1.2, PICK_BAY = 1.6, PICK_LEVELS = 4;
export const PICK_BLOCKS = [{ x0: 6, n: 20 }, { x0: 42, n: 20 }];
export const SHELF_H = 0.55;   // shelf pitch

// ── Reserve pallet racking (double-deep back-to-back rows running north–south) ──
export const RES = { x0: 87.4, pitch: 5.6, rows: 7, depth: 1.1, bay: 2.7, bays: 13, y0: 32, levels: 5, levelH: 1.7 };
export const resRowX = (r) => RES.x0 + r * RES.pitch;   // west face of the double row

// ── Inbound ──
export const IN_DOORS = Array.from({ length: 8 }, (_, i) => ({ id: i, x: 62 + i * 8, y: D }));
export const STAGE_Y = 78.5;

// ── Chargers, offices ──
export const CHARGERS = Array.from({ length: 10 }, (_, i) => ({ id: i, x: 1.0, y: 31 + i * 2.6, access: { x: 3, y: 31 + i * 2.6 } }));
export const OFFICE = { x0: 0, y0: 66, x1: 22, y1: 84 };

export const ZONES = [
  { name: 'Outbound docks', x: 92, y: 1.5 }, { name: 'Sorter', x: 30, y: 14 }, { name: 'Pack stations', x: 36, y: 23.5 },
  { name: 'AMR pick zone', x: 40, y: 61 }, { name: 'Reserve racking', x: 106, y: 28.8 }, { name: 'Receiving', x: 92, y: 75 },
  { name: 'Charging', x: 4, y: 28.5 }, { name: 'Office', x: 11, y: 75 }, { name: 'Returns & VAS', x: 40, y: 72 },
];

/** Pick faces: each bay has a north and a south face. */
export function pickFaces() {
  const out = [];
  for (const [bi, b] of PICK_BLOCKS.entries()) for (const [ri, y] of PICK_ROWS.entries()) for (let k = 0; k < b.n; k++) {
    const x = b.x0 + (k + 0.5) * PICK_BAY;
    out.push({ id: out.length, block: bi, row: ri, bay: k, side: 'N', x, y, ax: x, ay: y - 1.3 });
    out.push({ id: out.length, block: bi, row: ri, bay: k, side: 'S', x, y: y + PICK_DEPTH, ax: x, ay: y + PICK_DEPTH + 1.3 });
  }
  return out;
}
/** Reserve pallet positions. */
export function reservePositions() {
  const out = [];
  for (let r = 0; r < RES.rows; r++) for (const side of ['W', 'E']) for (let b = 0; b < RES.bays; b++) for (let l = 0; l < RES.levels; l++) {
    const xr = resRowX(r);
    const x = side === 'W' ? xr + RES.depth / 2 : xr + RES.depth * 1.5;
    const y = RES.y0 + (b + 0.5) * RES.bay;
    out.push({ id: out.length, row: r, side, bay: b, level: l, x, y, z: l * RES.levelH, ax: side === 'W' ? xr - 1.7 : xr + 2 * RES.depth + 1.7, ay: y, pallet: null, reserved: false });
  }
  return out;
}

/** Occupancy grid for vehicle path planning (1 = blocked). */
export function buildGrid() {
  const gw = W / CELL, gh = D / CELL; const g = new Uint8Array(gw * gh);
  const block = (x0, y0, x1, y1) => { for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) if (x >= 0 && y >= 0 && x < gw && y < gh) g[y * gw + x] = 1; };
  // perimeter
  block(0, 0, W, 1); block(0, D - 1, W, D); block(0, 0, 1, D); block(W - 1, 0, W, D);
  // conveyor line and everything north of it is a separate (outbound) area
  block(0, 0, W, CONVEYOR.y + 0.5);
  block(0, 0, PACK[PACK_MAX - 1].x + 3, 18.4);   // packers' walkway
  for (const p of PACK) block(p.x - p.table.w / 2, p.table.y0, p.x + p.table.w / 2, p.table.y1);
  for (const b of PICK_BLOCKS) for (const y of PICK_ROWS) block(b.x0, y, b.x0 + b.n * PICK_BAY, y + PICK_DEPTH);
  for (let r = 0; r < RES.rows; r++) block(resRowX(r), RES.y0, resRowX(r) + 2 * RES.depth, RES.y0 + RES.bays * RES.bay);
  block(OFFICE.x0, OFFICE.y0, OFFICE.x1, OFFICE.y1);
  for (const c of CHARGERS) block(0, c.y - 0.6, 1.8, c.y + 0.6);
  return { g, gw, gh };
}
