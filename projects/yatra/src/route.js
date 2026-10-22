/**
 * Routes: a centreline built by integrating curvature, an elevation profile, sections,
 * stops and civil structures (tunnels, bridges, crossings). Distances are compressed;
 * the sequence of places and the climb through the Bhor Ghat follow the real corridor.
 * World frame: x east, z south, y up (metres).
 */
export const DS = 2;   // centreline sample spacing (m)

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const smooth = (t) => t * t * (3 - 2 * t);

const RAIL = {
  id: 'rail', name: 'Mumbai → Pune via the Bhor Ghat', length: 40000, seed: 11,
  sections: [
    { s0: 0, s1: 5200, kind: 'city', name: 'Mumbai suburbs', limit: 80, rMin: 900, straight: 0.6 },
    { s0: 5200, s1: 12600, kind: 'plains', name: 'Konkan plains', limit: 110, rMin: 1100, straight: 0.65 },
    { s0: 12600, s1: 30200, kind: 'ghat', name: 'Bhor Ghat — 1 in 37', limit: 55, rMin: 340, straight: 0.25 },
    { s0: 30200, s1: 40000, kind: 'plateau', name: 'Deccan plateau', limit: 110, rMin: 1000, straight: 0.55 },
  ],
  elev: [[0, 12], [5000, 14], [12600, 62], [30000, 618], [31200, 622], [36000, 575], [40000, 560]],
  stops: [
    { s: 700, name: 'Dadar', mr: 'दादर', code: 'DR' }, { s: 4300, name: 'Thane', mr: 'ठाणे', code: 'TNA' },
    { s: 8200, name: 'Kalyan Jn', mr: 'कल्याण जं.', code: 'KYN' }, { s: 12300, name: 'Karjat', mr: 'कर्जत', code: 'KJT' },
    { s: 28700, name: 'Khandala', mr: 'खंडाळा', code: 'KNDL' }, { s: 31000, name: 'Lonavala', mr: 'लोणावळा', code: 'LNL' },
    { s: 39300, name: 'Pune Jn', mr: 'पुणे जं.', code: 'PUNE' },
  ],
  tunnels: [[14200, 14760], [16100, 16480], [17500, 18350], [20150, 20520], [22300, 22980], [24800, 25180], [26550, 27050]],
  bridges: [[15180, 15460], [18950, 19280], [21280, 21500], [23650, 23980], [25850, 26150], [34500, 34720]],
  crossings: [6500, 10400, 33200],
  falls: [15600, 17100, 19800, 21900, 24300, 27600],
};
const ROAD = {
  id: 'road', name: 'Mumbai → Pune old highway via the Khandala Ghat', length: 40000, seed: 23,
  sections: [
    { s0: 0, s1: 6000, kind: 'city', name: 'Mumbai & Navi Mumbai', limit: 45, rMin: 300, straight: 0.5 },
    { s0: 6000, s1: 17500, kind: 'plains', name: 'Panvel – Khopoli', limit: 65, rMin: 380, straight: 0.5 },
    { s0: 17500, s1: 30500, kind: 'ghat', name: 'Khandala Ghat', limit: 35, rMin: 150, straight: 0.15 },
    { s0: 30500, s1: 40000, kind: 'plateau', name: 'Lonavala – Pune', limit: 65, rMin: 400, straight: 0.45 },
  ],
  elev: [[0, 10], [6000, 14], [17500, 58], [30000, 612], [31600, 624], [36000, 576], [40000, 562]],
  stops: [
    { s: 700, name: 'Mumbai Central', mr: 'मुंबई सेंट्रल', code: 'MC', depot: true }, { s: 9200, name: 'Panvel', mr: 'पनवेल', code: 'PNVL' },
    { s: 17000, name: 'Khopoli', mr: 'खोपोली', code: 'KHPL' }, { s: 31400, name: 'Lonavala', mr: 'लोणावळा', code: 'LNL' },
    { s: 39300, name: 'Pune (Swargate)', mr: 'पुणे (स्वारगेट)', code: 'SWG', depot: true },
  ],
  tunnels: [], bridges: [[12800, 13000], [21400, 21560], [26200, 26340], [34400, 34560]], crossings: [], falls: [19500, 22800, 25300, 28200],
};
export const ROUTES = { rail: RAIL, road: ROAD };

/** Build the sampled centreline. */
export function buildRoute(def) {
  const r = rng(def.seed), n = Math.ceil(def.length / DS) + 1;
  const x = new Float64Array(n), z = new Float64Array(n), h = new Float64Array(n), y = new Float64Array(n), k = new Float64Array(n);
  // curvature plan: alternate tangents and curves inside each section
  const plan = [];
  for (const sec of def.sections) {
    let s = sec.s0, sign = r() < 0.5 ? 1 : -1;
    while (s < sec.s1) {
      const straight = r() < sec.straight;
      const len = straight ? 300 + r() * 900 : 220 + r() * 520;
      const R = sec.rMin * (1 + r() * 1.6);
      plan.push({ s0: s, s1: Math.min(sec.s1, s + len), k: straight ? 0 : sign / R });
      if (!straight) sign = -sign;
      s += len;
    }
  }
  // stations, crossings, tunnels and bridges sit on gentler geometry
  const calm = [...def.stops.map((p) => [p.s - 450, p.s + 450]), ...def.crossings.map((c) => [c - 120, c + 120])];
  let hd = -Math.PI / 2 + 0.35, pi = 0;
  for (let i = 0; i < n; i++) {
    const s = i * DS;
    while (pi < plan.length - 1 && s > plan[pi].s1) pi++;
    // ease curvature in and out (transition curves)
    const P = plan[pi], tIn = Math.min(1, (s - P.s0) / 60), tOut = Math.min(1, (P.s1 - s) / 60);
    let kk = P.k * smooth(Math.max(0, Math.min(tIn, tOut)));
    if (calm.some(([a, b]) => s > a && s < b)) kk *= 0.08;
    k[i] = kk;
    if (i) { hd += kk * DS; x[i] = x[i - 1] + Math.cos(hd) * DS; z[i] = z[i - 1] + Math.sin(hd) * DS; }
    h[i] = hd;
  }
  // elevation: smooth piecewise profile
  const E = def.elev;
  for (let i = 0; i < n; i++) {
    const s = i * DS; let j = 0; while (j < E.length - 2 && s > E[j + 1][0]) j++;
    const [s0, e0] = E[j], [s1, e1] = E[j + 1]; const t = Math.max(0, Math.min(1, (s - s0) / (s1 - s0)));
    y[i] = e0 + (e1 - e0) * t;
  }
  // soften the grade breaks
  const ys = Float64Array.from(y); const W = 60;
  for (let i = 0; i < n; i++) { let a = 0, c = 0; for (let d = -W; d <= W; d++) { const j = Math.min(n - 1, Math.max(0, i + d)); a += y[j]; c++; } ys[i] = a / c; }
  return { def, n, x, z, h, y: ys, k, length: def.length, ...index(def) };
}
function index(def) {
  const sec = (s) => def.sections.find((q) => s >= q.s0 && s < q.s1) || def.sections.at(-1);
  const inRanges = (s, list, pad = 0) => list.find(([a, b]) => s >= a - pad && s <= b + pad);
  return { section: sec, tunnelAt: (s, pad) => inRanges(s, def.tunnels, pad), bridgeAt: (s, pad) => inRanges(s, def.bridges, pad) };
}
/** Point and frame at distance s (linear interpolation of samples). */
export function at(R, s) {
  s = Math.max(0, Math.min(R.length, s));
  const f = s / DS, i = Math.min(R.n - 2, Math.floor(f)), t = f - i;
  const x = R.x[i] + (R.x[i + 1] - R.x[i]) * t, z = R.z[i] + (R.z[i + 1] - R.z[i]) * t, y = R.y[i] + (R.y[i + 1] - R.y[i]) * t;
  const h = R.h[i] + (R.h[i + 1] - R.h[i]) * t;
  const tx = Math.cos(h), tz = Math.sin(h);
  return { x, y, z, h, tx, tz, nx: -tz, nz: tx, grade: (R.y[i + 1] - R.y[i]) / DS, k: R.k[i] };
}
/** Offset point: d > 0 is to the right of travel. */
export function offset(R, s, d, dy = 0) { const p = at(R, s); return { x: p.x - p.nx * d, y: p.y + dy, z: p.z - p.nz * d, h: p.h, p }; }

/** Natural ground height relative to the route at (s, d). */
export function ground(R, s, d, seed = 1) {
  const p = at(R, s), sec = R.section(s), base = p.y;
  const ad = Math.abs(d);
  const n1 = noise2(s * 0.004, d * 0.004 + seed), n2 = noise2(s * 0.017 + 9, d * 0.017 - 3), n3 = noise2(s * 0.06, d * 0.06);
  let g;
  if (sec.kind === 'ghat') {
    // mountain on the inside of the climb (right), valley on the left
    const side = d > 0 ? 1 : -1;
    const up = side > 0 ? Math.min(380, ad * (0.55 + 0.25 * n1)) : -Math.min(260, ad * (0.38 + 0.15 * n1));
    g = base + up + n2 * 14 + n3 * 3;
  } else if (sec.kind === 'plateau') g = base + n1 * 38 + n2 * 9 + Math.max(0, ad - 300) * 0.05 + n3 * 1.5;
  else if (sec.kind === 'city') g = base + n1 * 6 + n3 * 0.6;
  else g = base + n1 * 10 + n2 * 3 + Math.max(0, ad - 500) * 0.12 * (0.5 + n1);
  // blend from formation level near the corridor
  const cw = R.def.id === 'rail' ? 9 : 8, stop = R.def.stops.find((q) => Math.abs(q.s - s) < 520);
  const flatW = stop ? 46 : cw, blendW = stop ? 40 : 34;
  const tun = R.tunnelAt(s, 40), br = R.bridgeAt(s, 30);
  let w = smooth(Math.max(0, Math.min(1, (ad - flatW) / blendW)));
  if (tun) {
    const [a, b] = tun;
    const cover = Math.max(g, base + 30 + 14 * n2 + 30 * smooth(Math.min(1, Math.max(0, Math.min(s - a, b - s)) / 150)));
    if (s >= a && s <= b) return cover;
    // approach cutting: walls rise towards the portal
    const f = 1 - Math.min(1, (s < a ? a - s : s - b) / 40);
    if (ad < 6.5) return base - 0.4;
    return base - 0.4 + (cover - base) * f * smooth(Math.min(1, (ad - 6.5) / 10)) + (g - base) * (1 - f) * w;
  }
  if (br) {
    const [a, b] = br, m = Math.min(s - a + 30, b + 30 - s) / 60;
    const depth = (R.def.id === 'rail' ? 34 : 24) * smooth(Math.max(0, Math.min(1, m)));
    return Math.min(g, base - 2 - depth * (1 - smooth(Math.min(1, ad / 260))));
  }
  return base - 0.35 + (g - base + 0.35) * w;
}
export function waterLevel(R, s) { const br = R.bridgeAt(s, 0); if (!br) return null; const a = at(R, (br[0] + br[1]) / 2); return a.y - (R.def.id === 'rail' ? 30 : 21); }

// value noise
const P = new Uint8Array(512); { const r = rng(7); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => P[(P[a & 255] + b) & 255] / 255;
  const u = smooth(xf), v = smooth(yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export { noise2, rng };

/** Speed limit (km/h) at s for a vehicle with top speed vmax. */
export function limitAt(R, s, vmax) {
  const sec = R.section(s);
  let v = R.def.id === 'rail' ? (sec.kind === 'ghat' ? sec.limit : sec.kind === 'city' ? 90 : 130) : sec.limit;
  v = Math.min(vmax, v);
  const p = at(R, s); if (Math.abs(p.k) > 1e-4) v = Math.min(v, Math.sqrt((R.def.id === 'rail' ? 1.1 : 2.2) / Math.abs(p.k)) * 3.6);
  return Math.max(15, v);
}
