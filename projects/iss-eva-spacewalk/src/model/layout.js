/**
 * Station layout — every position and size the model and the EVA missions share.
 *
 * Units: metres. Frame (three.js, right-handed), matching the ISS LVLH / body frame:
 *   +x  forward  (velocity vector, ISS +X — toward Harmony / PMA-2)
 *   +y  zenith   (away from Earth, ISS −Z)
 *   +z  starboard (ISS +Y — along the starboard truss)
 *
 * Dimensions follow NASA / ESA / JAXA / Roscosmos published figures (see
 * src/data/components.js for sources). Positions of modules relative to each other
 * are approximations good to roughly half a metre.
 */

// ── Integrated Truss Structure ────────────────────────────────────────────────
export const TRUSS = {
  y: 4.9,      // truss centre-line height above the US Lab axis
  half: 1.8,   // half-size of the main box cross-section (x and y)
  length: 109, // published overall truss length
  // Starboard segments (port is mirrored with negative z)
  segments: [
    { id: 'S0', z0: -6.7, z1: 6.7, half: 1.9 },
    { id: 'S1', z0: 6.7, z1: 20.4, half: 1.8 },
    { id: 'S3', z0: 20.4, z1: 29.0, half: 1.8 },
    { id: 'S4', z0: 29.6, z1: 38.4, half: 1.6 },
    { id: 'S5', z0: 38.4, z1: 41.8, half: 1.4 },
    { id: 'S6', z0: 41.8, z1: 54.5, half: 1.6 },
  ],
  sarj: { z0: 29.0, z1: 29.6, radius: 2.0 },
};

export const TRUSS_TOP = TRUSS.y + TRUSS.half; // 6.7 m

// ── Photovoltaic modules ─────────────────────────────────────────────────────
export const PV = {
  zc4: 35.0,             // centre of the S4/P4 wing pair
  zc6: 46.7,             // centre of the S6/P6 wing pair
  wingLength: 35.0,      // each Solar Array Wing: 35 m × 12 m (incl. mast & boxes)
  blanketLength: 32.6,
  blanketWidth: 4.6,
  blanketOffset: 3.0,    // blanket centre-line offset from the mast
  baseX: 2.2,            // wing root distance from truss centre-line
  iea4: { z0: 30.2, z1: 33.5 },
  iea6: { z0: 50.8, z1: 54.2 },
  ieaHalf: 2.2,
};
export const IEA_TOP = TRUSS.y + PV.ieaHalf + 0.1; // 7.2 m

// Wing names by power channel. A wings on S4/P4, B wings on S6/P6.
// dir: which way the wing extends (+1 forward, −1 aft) when the SARJ is at 0°.
export const WINGS = [
  { id: '1A', side: +1, module: 4, dir: +1 },
  { id: '3A', side: +1, module: 4, dir: -1 },
  { id: '1B', side: +1, module: 6, dir: +1 },
  { id: '3B', side: +1, module: 6, dir: -1 },
  { id: '2A', side: -1, module: 4, dir: -1 },
  { id: '4A', side: -1, module: 4, dir: +1 },
  { id: '2B', side: -1, module: 6, dir: +1 },
  { id: '4B', side: -1, module: 6, dir: -1 },
];

// ── Pressurised modules (centre, axis, length, radius) ───────────────────────
export const MODULES = {
  destiny: { c: [0, 0, 0], axis: 'x', L: 8.5, r: 2.15 },
  harmony: { c: [8.4, 0, 0], axis: 'x', L: 7.2, r: 2.2 },
  unity: { c: [-7.35, 0, 0], axis: 'x', L: 5.5, r: 2.28 },
  columbus: { c: [8.4, 0, 5.65], axis: 'z', L: 6.9, r: 2.24 },
  kibo: { c: [8.4, 0, -7.8], axis: 'z', L: 11.2, r: 2.2 },
  kiboELM: { c: [8.4, 4.3, -6.6], axis: 'y', L: 4.2, r: 2.2 },
  tranquility: { c: [-7.35, 0, -5.65], axis: 'z', L: 6.7, r: 2.24 },
  leonardo: { c: [-1.8, 0, -5.65], axis: 'x', L: 6.6, r: 2.2 },
  zarya: { c: [-18.8, 0, 0], axis: 'x', L: 12.6, r: 2.05 },
  zvezda: { c: [-31.65, 0, 0], axis: 'x', L: 13.1, r: 2.07 },
  rassvet: { c: [-13.6, -4.2, 0], axis: 'y', L: 6.0, r: 1.175 },
  poisk: { c: [-26.35, 3.25, 0], axis: 'y', L: 4.0, r: 1.275 },
  nauka: { c: [-26.35, -7.8, 0], axis: 'y', L: 13.1, r: 2.125 },
  pirs: { c: [-26.35, -3.7, 0], axis: 'y', L: 4.9, r: 1.28 },
};

export const QUEST = {
  x: -7.35,
  equip: { z0: 2.3, z1: 5.0, r: 2.0 },
  crew: { z0: 5.0, z1: 7.8, r: 1.0 },
};

// ── Mobile Servicing System ─────────────────────────────────────────────────
export const MSS = {
  mbsX: 3.0,               // Mobile Base System sits on the forward truss face
  shoulderOffset: [0.2, 2.8, 0], // SSRMS shoulder relative to MBS centre (x, y-from-truss, z)
  boom: 8.0,               // each SSRMS half (boom + joints), total 17.6 m incl. wrist
  wrist: 1.2,
  railZ: [-28, 28],        // MT rails span the S3 → P3 worksites
};

// ── Things bolted to the zenith face of the truss (crew route goes over them) ─
export const TOP_OBSTACLES = [
  { id: 'AMS-02', z0: 21.0, z1: 25.0, top: TRUSS_TOP + 3.0 },
  { id: 'ELC-2', z0: 25.8, z1: 28.6, top: TRUSS_TOP + 1.5 },
  { id: 'SARJ-S', z0: 29.0, z1: 29.6, top: TRUSS.y + 2.05 },
  { id: 'IEA-S4', z0: 30.2, z1: 33.5, top: IEA_TOP },
  { id: 'IEA-S6', z0: 50.8, z1: 54.2, top: IEA_TOP },
  { id: 'ELC-3', z0: -28.6, z1: -24.0, top: TRUSS_TOP + 1.5 },
  { id: 'SARJ-P', z0: -29.6, z1: -29.0, top: TRUSS.y + 2.05 },
  { id: 'IEA-P4', z0: -33.5, z1: -30.2, top: IEA_TOP },
  { id: 'IEA-P6', z0: -54.2, z1: -50.8, top: IEA_TOP },
];

/** Height of a translating crew member's body centre over the truss top at station z. */
export function trussHalfAt(z) {
  const a = Math.abs(z);
  for (const s of TRUSS.segments) {
    if (s.id === 'S0' ? a <= s.z1 : a >= s.z0 && a <= s.z1) return s.half;
  }
  return TRUSS.half;
}

export function routeHeightAt(z) {
  // A translating crew member is horizontal, belly-down: centre ≈ 0.45 m above the surface.
  let h = TRUSS.y + trussHalfAt(z) + 0.45;
  for (const o of TOP_OBSTACLES) {
    if (z > o.z0 - 0.9 && z < o.z1 + 0.9) h = Math.max(h, o.top + 0.5);
  }
  return h;
}

/**
 * Hand-over-hand route along the zenith face of the truss from z0 to z1.
 * Returns points that climb over payloads (AMS-02, ELCs, IEAs) on the way.
 */
export function trussTopRoute(z0, z1, x = -0.6) {
  const dir = Math.sign(z1 - z0) || 1;
  const stops = new Set([z0, z1]);
  const edges = [];
  for (const o of TOP_OBSTACLES) edges.push(o.z0 - 1.0, o.z1 + 1.0, o.z0 + 0.2, o.z1 - 0.2);
  for (const s of TRUSS.segments) for (const sg of [1, -1]) edges.push(sg * (s.z1 + 0.3), sg * (s.z1 - 0.3));
  for (const edge of edges) {
    if ((edge - z0) * dir > 0 && (z1 - edge) * dir > 0) stops.add(edge);
  }
  return [...stops]
    .sort((a, b) => (a - b) * dir)
    .map((z) => [x, routeHeightAt(z), z]);
}
