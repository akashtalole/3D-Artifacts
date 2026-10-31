/**
 * The grid engine, without three.js (it also runs in Node).
 * Demand by zone and consumer type, merit-order dispatch in 15-minute blocks with ramp limits,
 * hydro peak-shaving on a daily water budget, a pumped-storage cycle, purchases from the central
 * share and the power exchange, a DC load flow over the EHV network, and frequency and
 * deviation-settlement (DSM) effects of trips.
 */
import { PLANTS, BUSES, LINES, HVDC, ZONES, SEASONS, IMPORTS, XY, TYPES } from './data.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hod = (t) => ((t % 24) + 24) % 24;
const between = (h, a, b) => (a <= b ? h >= a && h < b : h >= a || h < b);
const smooth = (h, a, b, w = 0.5) => { // 0→1 window with soft edges
  const up = clamp((hod(h - a) < 12 ? hod(h - a) : -1) / w + 0.5, 0, 1), dn = clamp((hod(b - h) < 12 ? hod(b - h) : -1) / w + 0.5, 0, 1);
  return between(h, a, b) ? Math.min(up, dn) : 0;
};

// ── profiles (fraction of each category's own peak) ──
const resP = (h, se) => { const ac = se === 'summer' ? 0.18 : se === 'monsoon' ? 0.04 : 0.06; return 0.42 + 0.22 * smooth(h, 6, 9.5, 1.5) + ac * smooth(h, 12, 17, 2) + 0.55 * smooth(h, 18.3, 23.3, 1.2); };
const indP = (h) => 0.78 + 0.18 * smooth(h, 8, 20, 1.5) - 0.06 * smooth(h, 13, 14, 0.5);
const comP = (h) => 0.35 + 0.65 * smooth(h, 9.5, 21.5, 1.2);
const agP = (h, mskvy) => (mskvy ? 0.92 * smooth(h, 8.5, 16.5, 1) + 0.12 * smooth(h, 23, 5, 1) + 0.05 : 0.5 * smooth(h, 9.5, 17.5, 1) + 0.5 * smooth(h, 22, 6, 1) + 0.05);   // same daily farm energy, moved to daylight
function zoneRaw(z, h, se, mskvy) { const r = resP(h, se), i = indP(h), c = comP(h), a = agP(h, mskvy); const urban = 1 - z.ag; return { ag: z.ag * a * (se === 'monsoon' ? 0.45 : se === 'winter' ? 1.1 : 1), res: urban * 0.33 * r, ind: urban * 0.5 * i, com: urban * 0.17 * c }; }
const SCALE = {};
function scaleFor(se) {   // normalise on the default (MSKVY) curve so the peak matches the season
  if (SCALE[se]) return SCALE[se];
  let mx = 0; for (let b = 0; b < 96; b++) { const h = b / 4; let s = 0; for (const z of ZONES) { const r = zoneRaw(z, h, se, true); s += z.share * (r.ag + r.res + r.ind + r.com); } mx = Math.max(mx, s); }
  return (SCALE[se] = SEASONS[se].peak / mx);
}
/** Demand by zone at hour h (MW), split by consumer type. */
export function demand(h, se, sc = {}) {
  const k = scaleFor(se), heat = sc.heat ? 1 + 0.08 * smooth(h, 12, 23.5, 2) : 1, out = [];
  let total = 0;
  for (const z of ZONES) {
    const r = zoneRaw(z, h, se, !!sc.mskvy), m = z.share * k;
    const d = { id: z.id, ag: r.ag * m, res: r.res * m * heat, ind: r.ind * m, com: r.com * m * (heat > 1 ? 1 + (heat - 1) * 0.6 : 1) };
    d.total = d.ag + d.res + d.ind + d.com; total += d.total; out.push(d);
  }
  return { zones: out, total };
}

// ── renewables ──
export function solarCF(h, se, t = 0) {
  const S = SEASONS[se], u = (hod(h) - S.rise) / (S.set - S.rise); if (u <= 0 || u >= 1) return 0;
  const cl = S.cloud * (0.5 + 0.5 * Math.sin(t * 1.9 + 1.3) * Math.sin(t * 0.7));
  return S.solar * Math.pow(Math.sin(Math.PI * u), 1.15) * (1 - 0.8 * clamp(cl, 0, 1));
}
export const windCF = (h, se, t = 0) => clamp(SEASONS[se].wind * (0.78 + 0.3 * Math.sin((2 * Math.PI * (hod(h) - 10)) / 24) + 0.12 * Math.sin(t * 0.37)), 0.02, 0.95);
export function marketPrice(h, se) {   // ₹/kWh on the exchange: cheap in solar hours, dear in the evening
  const base = se === 'monsoon' ? 3.6 : 4.4, ev = smooth(h, 18, 23.5, 1), sol = smooth(h, 9.5, 16.5, 1.5);
  return clamp(base + 5.4 * ev - 1.9 * sol + 0.8 * smooth(h, 6, 9, 1), 2.2, 10);
}

// ── network ──
const BUS_IDS = Object.keys(BUSES), BI = Object.fromEntries(BUS_IDS.map((b, i) => [b, i]));
const km = (a, b) => { const [x1, z1] = XY(a.lat, a.lon), [x2, z2] = XY(b.lat, b.lon); return Math.hypot(x2 - x1, z2 - z1) * 2; };
export const NET = LINES.map((l, i) => {
  const [f, t, kv, mw, n, tieTo, blat, blon] = l, A = BUSES[f], B = tieTo ? { lat: blat, lon: blon } : BUSES[t];
  const len = km(A, B) + (tieTo ? 150 : 0), x = (len * (kv >= 765 ? 1 : kv >= 400 ? 4.5 : 12)) / n;
  return { i, f, t, kv, rating: mw * n, n, len, x, tie: tieTo || null, blat, blon, id: `${f}-${tieTo ? tieTo.split(' ')[0] : t}-${kv}` };
});
export function solveFlow(inj, out = {}) {
  const N = BUS_IDS.length, slack = BI.X, idx = BUS_IDS.map((_, i) => i).filter((i) => i !== slack), m = idx.length, pos = new Map(idx.map((b, k) => [b, k]));
  const A = Array.from({ length: m }, () => new Float64Array(m + 1));
  for (const l of NET) {
    if (out[l.i] === true) continue; const a = BI[l.f], b = BI[l.t], y = 1 / (l.x * (typeof out[l.i] === 'number' ? out[l.i] : 1));
    if (a !== slack) A[pos.get(a)][pos.get(a)] += y; if (b !== slack) A[pos.get(b)][pos.get(b)] += y;
    if (a !== slack && b !== slack) { A[pos.get(a)][pos.get(b)] -= y; A[pos.get(b)][pos.get(a)] -= y; }
  }
  idx.forEach((b, k) => { A[k][m] = inj[b]; });
  for (let c = 0; c < m; c++) {   // Gaussian elimination with partial pivoting
    let p = c; for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; const d = A[c][c] || 1e-12;
    for (let r = c + 1; r < m; r++) { const f = A[r][c] / d; if (f) for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k]; }
  }
  const th = new Float64Array(m); for (let r = m - 1; r >= 0; r--) { let s = A[r][m]; for (let k = r + 1; k < m; k++) s -= A[r][k] * th[k]; th[r] = s / (A[r][r] || 1e-12); }
  const theta = new Float64Array(N); idx.forEach((b, k) => { theta[b] = th[k]; });
  return NET.map((l) => (out[l.i] === true ? 0 : (theta[BI[l.f]] - theta[BI[l.t]]) / (l.x * (typeof out[l.i] === 'number' ? out[l.i] : 1))));
}

// ── dispatch ──
const avail = (p, sc) => (p.type === 'coal' ? 0.9 : p.type === 'gas' ? p.avail ?? 0.4 : p.type === 'nuclear' ? 0.85 : 1) * (sc.coal && p.id === 'chandrapur' ? 0.6 / 0.9 : 1);
export function plantCap(p, sc, trip) {
  if (p.mskvy && !sc.mskvy) return 0;
  return p.cap * avail(p, sc) - (trip && trip.id === p.id ? trip.mw : 0);
}
/** Hydro water budget spread over the highest net-load blocks; pumped storage pumps at the solar trough and generates at the peak. */
export function dayPlan(se, sc) {
  const net = [];
  for (let b = 0; b < 96; b++) { const h = b / 4, D = demand(h, se, sc).total; let mr = 0; for (const p of PLANTS) mr += mustRun(p, h, se, sc, 0); net.push(D - mr); }
  const hyd = PLANTS.filter((p) => p.type === 'hydro'), cap = hyd.reduce((a, p) => a + p.cap, 0), E = SEASONS[se].hydroMWh * 4;   // MW·blocks
  let lo = Math.min(...net) - cap, hi = Math.max(...net);
  for (let k = 0; k < 50; k++) { const L = (lo + hi) / 2, e = net.reduce((a, n) => a + clamp(n - L, 0, cap), 0); if (e > E) lo = L; else hi = L; }
  const L = (lo + hi) / 2, hydro = net.map((n) => clamp(n - L, 0, cap));
  const order = net.map((n, b) => [n, b]).sort((a, b) => a[0] - b[0]), psp = Array(96).fill(0);
  order.slice(0, 20).forEach(([, b]) => { psp[b] = -250; }); order.slice(-15).forEach(([, b]) => { psp[b] = 250; });   // 5 h pumping, 3.75 h generating (≈75% round trip)
  return { net, hydro, psp, L };
}
function mustRun(p, h, se, sc, t) {
  if (p.type === 'solar') { let cf = solarCF(h, se, t); if (sc.clouds && (p.id === 'solarM' || p.id === 'mskvy') && between(hod(h), 12, 17.5)) cf *= 0.3; return plantCap(p, sc) * cf; }
  if (p.type === 'wind') return p.cap * windCF(h, se, t);
  if (p.type === 'nuclear') return plantCap(p, sc);
  return 0;
}
/**
 * One 15-minute block. prev: last block's dispatch (for ramp limits); trip: {id, mw, t} lost unit.
 * Returns plant outputs, imports, flows and totals.
 */
export function dispatch(t, se, sc, plan, prev = null, trip = null) {
  const h = hod(t), b = Math.floor(h * 4) % 96, D = demand(h, se, sc), gen = {}, price = marketPrice(h, se);
  for (const p of PLANTS) gen[p.id] = mustRun(p, h, se, sc, t);
  // hydro and pumped storage from the day plan, shared by capacity
  const hyd = PLANTS.filter((p) => p.type === 'hydro'), hcap = hyd.reduce((a, p) => a + p.cap, 0);
  for (const p of hyd) gen[p.id] = (plan.hydro[b] * p.cap) / hcap;
  gen.ghatghar = plan.psp[b];
  let need = D.total - Object.values(gen).reduce((a, v) => a + v, 0);
  // flexible resources with bounds from ramp limits
  const flex = [];
  for (const p of PLANTS) {
    if (!['coal', 'gas'].includes(p.type)) continue;
    const cap = Math.max(0, plantCap(p, sc, trip)), mn = p.type === 'coal' ? 0.55 * cap : 0, r = p.type === 'coal' ? 0.12 * p.cap : cap, pv = prev ? prev.gen[p.id] : null;
    const lo = pv === null ? mn : clamp(pv - r, mn, cap), hi = pv === null ? cap : clamp(pv + r, mn, cap);
    flex.push({ id: p.id, cost: p.cost, lo: Math.min(lo, cap), hi: Math.max(Math.min(hi, cap), Math.min(lo, cap)) });
  }
  const C = IMPORTS.central, cPrev = prev ? prev.central : null, cLo = Math.max(C.min * C.cap, cPrev === null ? 0 : cPrev - 0.12 * C.cap), cHi = cPrev === null ? C.cap : Math.min(C.cap, cPrev + 0.12 * C.cap);
  flex.push({ id: 'central', cost: C.cost, lo: Math.min(cLo, cHi), hi: cHi });
  const mPrev = prev ? prev.market : null, mStep = 600, mLo = mPrev === null ? -IMPORTS.market.cap : Math.max(-IMPORTS.market.cap, mPrev - mStep), mHi = mPrev === null ? IMPORTS.market.cap : Math.min(IMPORTS.market.cap, mPrev + mStep);
  flex.push({ id: 'market', cost: price, lo: mLo, hi: mHi, market: true });
  // everything at its floor (market at zero if allowed), then fill by merit order
  const out = {}; let sum = 0;
  for (const f of flex) { out[f.id] = f.market ? clamp(0, f.lo, f.hi) : f.lo; sum += out[f.id]; }
  let rest = need - sum;
  if (rest > 0) { for (const f of [...flex].sort((a, b2) => a.cost - b2.cost)) { const add = Math.min(rest, f.hi - out[f.id]); out[f.id] += add; rest -= add; if (rest <= 0) break; } }
  else if (rest < 0) { for (const f of [...flex].sort((a, b2) => b2.cost - a.cost)) { const cut = Math.min(-rest, out[f.id] - f.lo); out[f.id] -= cut; rest += cut; if (rest >= 0) break; } }
  // a remaining surplus curtails solar and wind; a remaining shortfall is drawn from the grid (deviation)
  let curtail = 0;
  if (rest < -1) { curtail = -rest; const re = PLANTS.filter((p) => p.type === 'solar' || p.type === 'wind'), tot = re.reduce((a, p) => a + gen[p.id], 0); for (const p of re) gen[p.id] -= tot ? (gen[p.id] / tot) * curtail : 0; rest = 0; }
  for (const f of flex) if (f.id !== 'central' && f.id !== 'market') gen[f.id] = out[f.id];
  const dev = Math.max(0, rest);   // overdrawal beyond the schedule
  const central = out.central, market = out.market;
  // flows
  const inj = Object.fromEntries(Object.keys(BUSES).map((k) => [k, 0]));
  for (const p of PLANTS) {
    if (p.rooftop) { for (const z of ZONES) if (z.ag < 0.15) inj[z.bus] += gen[p.id] * (z.share / 0.47); continue; }
    if (p.mskvy) { const ws = ZONES.reduce((a, z) => a + z.share * z.ag, 0); for (const z of ZONES) inj[z.bus] += gen[p.id] * ((z.share * z.ag) / ws); continue; }
    inj[p.bus] += gen[p.id];
  }
  D.zones.forEach((z, i) => { inj[ZONES[i].bus] -= z.total; });
  const hvdc = sc.hvdc ? 0 : Math.min(HVDC.mw, 1200); inj[HVDC.from] -= hvdc; inj[HVDC.to] += hvdc;
  const outL = {}; if (sc.line) { const l = NET.find((q) => q.f === 'AUR' && q.t === 'PUN'); outL[l.i] = true; }
  const flows = solveFlow(Object.values(inj), outL);
  // totals
  let costR = 0, co2 = 0; const byType = {}, byOwner = {};
  for (const p of PLANTS) { const g = gen[p.id]; byType[p.type] = (byType[p.type] || 0) + g; byOwner[p.owner] = (byOwner[p.owner] || 0) + Math.max(0, g); costR += Math.max(0, g) * p.cost * 1000; co2 += Math.max(0, g) * TYPES[p.type].co2; }
  byType.import = central; byType.market = market; byOwner.central = (byOwner.central || 0) + central; byOwner.market = market;
  costR += central * C.cost * 1000 + market * price * 1000; co2 += central * TYPES.import.co2 + Math.max(0, market) * TYPES.market.co2;
  const re = (byType.solar || 0) + (byType.wind || 0) + (byType.hydro || 0);
  return { t, h, b, D, gen, central, market, price, dev, curtail, flows, outL, hvdc, costR, co2, byType, byOwner, re, inj: Object.values(inj) };
}

/** Frequency after losing mw of generation: the national grid's stiffness sets the dip; primary response arrests it, AGC restores it. */
export function freqTrace(mw, f0 = 50.0) {
  const beta = 12000, H = 5.5, out = [];   // MW/Hz of combined response; inertia constant, s
  const df = mw / beta;
  for (let s = 0; s <= 300; s += 2) {
    const nadir = df * 1.7 * (s / 6) * Math.exp(1 - s / 6), droop = df * (1 - Math.exp(-s / 8)), agc = df * (1 - Math.exp(-Math.max(0, s - 30) / 90));
    out.push([s, f0 - Math.max(nadir, droop) * (s < 12 ? 1 : 1) + agc * (s > 30 ? 1 : 0) * 0.95]);
  }
  return out.map(([s, f]) => [s, Math.min(f0, f)]);
}
export const dsmRate = (f) => (f >= 50.05 ? 0 : f >= 49.9 ? 3 + (50.05 - f) * 40 : 9 + (49.9 - f) * 60);   // ₹/kWh for overdrawal, illustrative

/** Whole day at once, for charts and comparisons. */
export function runDay(se, sc) {
  const plan = dayPlan(se, sc), out = []; let prev = null;
  for (let b = 0; b < 96; b++) { prev = dispatch(b / 4, se, sc, plan, prev); out.push(prev); }
  const sum = (f) => out.reduce((a, r) => a + f(r), 0) / 4;   // MWh
  const energy = sum((r) => r.D.total), coal = sum((r) => r.byType.coal || 0), re = sum((r) => r.re);
  return { blocks: out, energy, peak: Math.max(...out.map((r) => r.D.total)), cost: out.reduce((a, r) => a + r.costR, 0) / 4, co2: sum((r) => r.co2), coal, re, curtail: sum((r) => r.curtail), market: sum((r) => Math.max(0, r.market)), coalSwing: Math.max(...out.map((r) => r.byType.coal)) - Math.min(...out.map((r) => r.byType.coal)), plan };
}

/** N-1: trip each internal line in turn and report the worst resulting loading. */
export function contingency(r) {
  let worst = null;
  for (const l of NET) {
    if (l.tie || r.outL[l.i]) continue;
    const o = { ...r.outL, [l.i]: l.n > 1 ? l.n / (l.n - 1) : true }, f = solveFlow(r.inj, o);   // lose one circuit
    NET.forEach((m, k) => { if (r.outL[k] === true || (k === l.i && l.n === 1)) return; const rating = k === l.i ? (m.rating * (m.n - 1)) / m.n : m.rating, u = Math.abs(f[k]) / rating; if (!worst || u > worst.u) worst = { lost: l, hit: m, u, mw: f[k] }; });
  }
  return worst;
}
