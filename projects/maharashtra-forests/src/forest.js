/**
 * The forest engine (no three.js; it also runs in Node).
 * A 6 km grid over the state holds very dense, moderately dense and open forest fractions per cell,
 * plus compensatory plantations and industrial land. Each scenario is stepped year by year from the
 * 2021 baseline to 2050 and every year is kept, so the timeline can scrub freely.
 */
import { XY, OUTLINE, AREA_KM2, FSI2021, TRACTS, GHATS, DIVISIONS, CORRIDORS, PROJECTS, SCENARIOS, CARBON } from './data.js';

export const Y0 = 2021, Y1 = 2050, S = 3, X0 = -215, Z0 = -185, NX = 143, NZ = 123;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const ghatsX = (z) => -150 + 0.06 * z + 6 * Math.sin(z / 40);
const POLY = OUTLINE.map(([la, lo]) => XY(la, lo));
export function inside(x, z) { let c = false; for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) { const [xi, zi] = POLY[i], [xj, zj] = POLY[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }
export const cellXZ = (k) => [X0 + ((k % NX) + 0.5) * S, Z0 + (Math.floor(k / NX) + 0.5) * S];
const km = (x1, z1, x2, z2) => Math.hypot(x1 - x2, z1 - z2) * 2;
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1); return [Math.hypot(px - ax - dx * t, pz - az - dz * t) * 2, t]; }

// ── grid and the 2021 baseline ──
export const CELLS = [];   // indices of cells inside the state
const N = NX * NZ, IN = new Uint8Array(N), DIV = new Uint8Array(N);
for (let k = 0; k < N; k++) { const [x, z] = cellXZ(k); if (inside(x, z)) { IN[k] = 1; CELLS.push(k); } }
export const CELL_KM2 = AREA_KM2 / CELLS.length;
const DXZ = DIVISIONS.map((d) => XY(d.lat, d.lon));
for (const k of CELLS) { const [x, z] = cellXZ(k); if (x < ghatsX(z) - 6) { DIV[k] = 0; continue; } let b = 1, bd = Infinity; for (let i = 1; i < DXZ.length; i++) { const d = Math.hypot(x - DXZ[i][0], z - DXZ[i][1]); if (d < bd) { bd = d; b = i; } } DIV[k] = b; }
export { DIV };

function baseline() {
  const v = new Float32Array(N), m = new Float32Array(N), o = new Float32Array(N), I = new Float32Array(N);
  const blobs = TRACTS.flatMap((t) => t.b.map(([la, lo, r, w]) => { const [x, z] = XY(la, lo); return { x, z, r, w }; }));
  const band = GHATS.map(([la, lo, r, w]) => { const [x, z] = XY(la, lo); return { x, z, r, w }; });
  for (const k of CELLS) {
    const [x, z] = cellXZ(k); let keep = 1;
    for (const b of blobs) { const d = km(x, z, b.x, b.z); if (d < b.r * 3) keep *= 1 - b.w * Math.exp(-((d / b.r) ** 2)); }
    for (let i = 0; i < band.length - 1; i++) { const a = band[i], b = band[i + 1], [d, t] = segDist(x, z, a.x, a.z, b.x, b.z), r = a.r + (b.r - a.r) * t, w = a.w + (b.w - a.w) * t; if (d < r * 3) keep *= 1 - w * Math.exp(-((d / r) ** 2)); }
    const n = 0.85 + 0.3 * (Math.sin(x * 0.37 + z * 0.21) * Math.cos(z * 0.29 - x * 0.13) * 0.5 + 0.5);
    I[k] = clamp((1 - keep) * n, 0, 1);
    const f = Math.min(0.95, 1.05 * I[k]), sv = 0.55 * smooth(0.45, 0.95, I[k]), sm = 0.22 + 0.25 * smooth(0.25, 0.8, I[k]);
    v[k] = f * sv; m[k] = f * sm; o[k] = f * Math.max(0, 1 - sv - sm) + 0.012;   // a thin scatter of open tree cover everywhere
  }
  // calibrate the three classes to the FSI 2021 totals, keeping each cell under full cover
  for (let it = 0; it < 4; it++) {
    const tot = { v: 0, m: 0, o: 0 }; for (const k of CELLS) { tot.v += v[k]; tot.m += m[k]; tot.o += o[k]; }
    const kv = FSI2021.vdf / (tot.v * CELL_KM2), km2 = FSI2021.mdf / (tot.m * CELL_KM2), ko = FSI2021.of / (tot.o * CELL_KM2);
    for (const k of CELLS) { v[k] *= kv; m[k] *= km2; o[k] *= ko; const s = v[k] + m[k] + o[k]; if (s > 0.97) { const q = 0.97 / s; v[k] *= q; m[k] *= q; o[k] *= q; } }
  }
  return { v, m, o, I };
}
export const BASE = baseline();

// ── project geometry ──
function footprintCells(p) {
  if (p.path) {
    const pts = p.path.map(([la, lo]) => XY(la, lo)), out = new Map();
    for (const k of CELLS) { const [x, z] = cellXZ(k); for (let i = 0; i < pts.length - 1; i++) { const [d] = segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); if (d < 4.5) { out.set(k, 1); break; } } }
    return [...out.keys()];
  }
  const [px, pz] = XY(p.lat, p.lon); return CELLS.filter((k) => { const [x, z] = cellXZ(k); return km(x, z, px, pz) < 20; }).sort((a, b) => { const [ax, az] = cellXZ(a), [bx, bz] = cellXZ(b); return km(ax, az, px, pz) - km(bx, bz, px, pz); });
}
function distTo(p, x, z) {
  if (!p.path) { const [px, pz] = XY(p.lat, p.lon); return km(x, z, px, pz); }
  const pts = p.path.map(([la, lo]) => XY(la, lo)); let best = Infinity; for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])[0]); return best;
}
const FOOT = new Map(PROJECTS.map((p) => [p.id, footprintCells(p)]));
const LINEAR = (p) => p.kind === 'road' || p.kind === 'rail';

/** The projects a scenario builds, with the forest each one takes. */
export function pipeline(sc) {
  const S2 = SCENARIOS[sc], out = [];
  for (const p of PROJECTS) {
    let ha = p.ha, status = 'built', note = '';
    if (sc === 'avoid') {
      if (p.avoid === 'drop') { status = 'dropped'; note = 'Dropped: inside a tiger reserve, corridor or the Western Ghats'; }
      else if (p.avoid === 'shift') { ha = p.ha * 0.1; note = 'Moved to non-forest land; 10% of the forest still needed for access'; }
      else if (p.avoid === 'shrink') { ha = p.ha * 0.6; note = 'Redesigned to need 40% less forest'; }
      else if (p.avoid === 'crossings') { ha = p.ha * 0.9; note = 'Built with wildlife underpasses and overpasses'; }
    }
    out.push({ ...p, haUsed: ha, status, note });
  }
  if (S2.extra) for (const p of PROJECTS) out.push({ ...p, id: `${p.id}-2`, name: `${p.name} (phase 2)`, year: p.year + 11, haUsed: p.ha * 1.3, status: p.year + 11 <= Y1 ? 'built' : 'later', note: 'Second phase in the high-growth pipeline', phase2: true });
  return out.filter((p) => p.year <= Y1);
}

/** Run a scenario from 2021 to 2050. Returns per-year cell snapshots and statistics. */
export function run(sc) {
  const S2 = SCENARIOS[sc], P = pipeline(sc), v = BASE.v.slice(), m = BASE.m.slice(), o = BASE.o.slice(), ind = new Float32Array(N);
  const bg = { bau: [0.002, 0], avoid: [0.0008, 0.003], high: [0.003, -0.001] }[sc];   // dense-forest thinning; open-cover change (restoration in Avoid)
  const plant = [], years = [], diverted = new Map(); let cumDiv = 0, cumDeg = 0, cumLost = 0;
  const caFar = CELLS.filter((k) => { const [x, z] = cellXZ(k); return DIV[k] === 3 && BASE.v[k] + BASE.m[k] + BASE.o[k] < 0.15 && Math.sin(x * 1.7 + z * 2.3) > 0.2; });
  for (let Y = Y0; Y <= Y1; Y++) {
    if (Y > Y0) {
      // background trends: slow thinning of dense forest, slow growth of open tree cover
      for (const k of CELLS) { const dv = v[k] * bg[0]; v[k] -= dv; m[k] += dv; o[k] = Math.min(o[k] * (1 + bg[1]), 0.97 - v[k] - m[k]); }
      for (const p of P) {
        if (p.status !== 'built' || p.year > Y) continue;
        const age = Y - p.year, foot = FOOT.get(p.id.replace(/-2$/, ''));
        if (age === 0) {   // clearing
          let need = p.haUsed / 100, took = 0; const per = LINEAR(p) ? need / Math.max(1, foot.length) : need;
          for (const k of foot) {
            const f = v[k] + m[k] + o[k]; if (f < 0.02) continue;
            const want = LINEAR(p) ? per : need - took, can = Math.min(want, f * CELL_KM2 * 0.85), r = can / (f * CELL_KM2);
            v[k] -= v[k] * r; m[k] -= m[k] * r; o[k] -= o[k] * r; ind[k] += can / CELL_KM2; took += can; if (!LINEAR(p) && took >= need - 1e-6) break;
          }
          diverted.set(p.id, took); cumDiv += took;
          // compensatory afforestation: equal area, after the scenario's lag
          const near = S2.caNear ? CELLS.filter((k) => { const [x, z] = cellXZ(k), d = distTo(p, x, z); return d > 8 && d < 40 && v[k] + m[k] + o[k] < 0.45; }).slice(0, 8) : caFar.filter((_, i) => (i * 7 + p.year) % 23 === 0).slice(0, 8);
          if (near.length) plant.push({ cells: near, km2: took, year: p.year + S2.lag, p: p.id });
        }
        if (age < 10) {   // edge effects, new access and settlement thin the forest around a project
          const sf = clamp(p.haUsed / 500, 0.4, 2) * (p.kind === 'mine' || p.kind === 'coal' ? 1.3 : 1), R = S2.ring * (LINEAR(p) ? 0.6 : 1);
          for (const k of CELLS) {
            const [x, z] = cellXZ(k), d = distTo(p, x, z); if (d > R * 2.2) continue;
            const w = Math.exp(-((d / R) ** 2)) * sf * S2.degrade, dv = v[k] * w, dm = m[k] * w * 0.7, lost = o[k] * w * 0.6;   // thinning, and clearing for new roads and settlement
            v[k] -= dv; m[k] += dv - dm; o[k] += dm - lost; cumDeg += (dv + dm) * CELL_KM2; cumLost += lost * CELL_KM2;
          }
        }
      }
    }
    // plantations: saplings until 5 years, then open forest, then moderately dense after 20 years
    const pO = new Float32Array(N), pM = new Float32Array(N), pY = new Float32Array(N); let pYoung = 0;
    for (const pl of plant) { const age = Y - pl.year; if (age < 0) continue; const each = pl.km2 / pl.cells.length / CELL_KM2; for (const k of pl.cells) { if (age < 5) { pY[k] += each; } else if (age < 20) pO[k] += each * S2.survival; else pM[k] += each * S2.survival; } if (age >= 0 && age < 5) pYoung += pl.km2; }
    years.push(snapshot(Y, sc, P, v, m, o, pO, pM, pY, ind, cumDiv, cumDeg, pYoung, diverted, cumLost));
  }
  return { sc, years, projects: P, diverted };
}

function snapshot(Y, sc, P, v, m, o, pO, pM, pY, ind, cumDiv, cumDeg, pYoung, diverted, cumLost) {
  const t = { v: 0, m: 0, o: 0, pl: 0 }, div = DIVISIONS.map(() => ({ v: 0, m: 0, o: 0, pl: 0 }));
  for (const k of CELLS) { t.v += v[k]; t.m += m[k]; t.o += o[k]; t.pl += pO[k] + pM[k]; const d = div[DIV[k]]; d.v += v[k]; d.m += m[k]; d.o += o[k]; d.pl += pO[k] + pM[k]; }
  for (const key of ['v', 'm', 'o', 'pl']) t[key] *= CELL_KM2; for (const d of div) for (const key of ['v', 'm', 'o', 'pl']) d[key] *= CELL_KM2;
  let pm = 0; for (const k of CELLS) pm += pM[k]; pm *= CELL_KM2;
  const cover = t.v + t.m + t.o + t.pl, carbon = ((t.v * CARBON.vdf + t.m * CARBON.mdf + t.o * CARBON.of + (t.pl - pm) * CARBON.of + pm * CARBON.mdf + pYoung * CARBON.young) * 100) / 1e6;
  const S2 = SCENARIOS[sc], corr = CORRIDORS.map((c) => {
    const pts = c.pts.map(([la, lo]) => XY(la, lo)), sc2 = [];
    for (let i = 0; i < pts.length - 1; i++) { const L = km(...pts[i], ...pts[i + 1]), n = Math.max(1, Math.round(L / 6)); for (let j = 0; j < n; j++) { const u = j / n, x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u, k = Math.floor((z - Z0) / S) * NX + Math.floor((x - X0) / S); let s = clamp((v[k] + m[k] + o[k] + pO[k] + pM[k]) / 0.3, 0, 1); for (const p of P) { if (p.status !== 'built' || p.year > Y) continue; const d = distTo(p, x, z); if (LINEAR(p) && d < 6) s *= S2.barrier; else if (!LINEAR(p) && d < 9) s *= 0.5; } sc2.push(s); } }
    return { id: c.id, score: sc2.reduce((a, b) => a + b, 0) / sc2.length, min: Math.min(...sc2) };
  });
  return { Y, v: v.slice(), m: m.slice(), o: o.slice(), p: Float32Array.from(pO, (x, i) => x + pM[i]), young: pY, ind: ind.slice(), tot: { ...t, cover, pct: (cover / AREA_KM2) * 100 }, div, carbon, cumDiv, cumDeg, cumLost, pYoung, corr, built: P.filter((p) => p.status === 'built' && p.year <= Y).length };
}
