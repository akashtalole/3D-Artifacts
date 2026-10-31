/**
 * CRS-35 flight model, from the pad to Harmony.
 *
 * Times are Mission Elapsed Time (MET) in seconds from liftoff, 13 Oct 2026 10:33:00 UTC
 * (6:33 a.m. EDT, NASA). Docking is at about 11:00 a.m. EDT on 15 Oct (NASA blog),
 * i.e. MET 52 h 27 min.
 *
 * Ascent: a smooth reconstruction of a typical Falcon 9 ISS-bound profile (MECO ≈ 2:18,
 * second-stage cutoff ≈ 8:35, Dragon separation ≈ 9 min, as NASA reports). The booster
 * returns to a Cape Canaveral landing zone (the planned recovery). Altitudes and speeds
 * are representative, not SpaceX telemetry.
 *
 * Orbit: Dragon's orbit plane is the ISS plane through SLC-40 at liftoff (an instantaneous
 * launch window). A series of phasing burns raises Dragon from ≈ 210 km to the ISS
 * altitude; the ISS phase is solved so the two meet at the docking time.
 */
import { gmst } from 'iss/sim/orbit.js';

export const MU = 398600.4418;           // km³/s²
export const RE = 6371.0;                // km
export const LIFTOFF = new Date(Date.UTC(2026, 9, 13, 10, 33, 0));
export const T_DOCK = (52 * 60 + 27) * 60;      // s
export const T_RNDZ = T_DOCK - 106 * 60;        // start of the local rendezvous (approach ellipsoid)
export const INC = 51.64 * Math.PI / 180;
export const SITE = { lat: 28.5619, lon: -80.5772, name: 'SLC-40, Cape Canaveral SFS' };
export const ISS_ALT = 415;

export const MILESTONES = {
  maxQ: 72, meco: 138, sep: 141, ses: 148, boostback: [152, 195], apogeeB: 262,
  entry: [375, 395], landing: [446, 465], seco: 515, dragonSep: 540, nose: [690, 720],
};

const D2R = Math.PI / 180;

// ── helpers ────────────────────────────────────────────────────────────────
function catmull(table, t) {
  const n = table.length;
  if (t <= table[0][0]) return table[0][1];
  if (t >= table[n - 1][0]) return table[n - 1][1];
  let i = 0;
  while (i < n - 2 && table[i + 1][0] <= t) i++;
  const [t0, p0] = table[Math.max(0, i - 1)];
  const [t1, p1] = table[i];
  const [t2, p2] = table[i + 1];
  const [t3, p3] = table[Math.min(n - 1, i + 2)];
  const s = (t - t1) / (t2 - t1);
  const m1 = ((p2 - p0) / (t2 - t0 || 1)) * (t2 - t1);
  const m2 = ((p3 - p1) / (t3 - t1 || 1)) * (t2 - t1);
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p1 + (s3 - 2 * s2 + s) * m1 + (-2 * s3 + 3 * s2) * p2 + (s3 - s2) * m2;
}
const smooth01 = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

// ── Ascent (first stage, then second stage + Dragon) ───────────────────────
const ALT_UP = [
  [0, 0], [10, 0.15], [20, 0.7], [30, 1.7], [40, 3.0], [60, 7.0], [72, 10.0], [90, 16], [110, 26],
  [138, 55], [148, 63], [200, 102], [260, 136], [330, 166], [420, 192], [515, 209], [600, 210.5], [900, 211],
];
function speedUp(t) {                      // ground-relative speed, m/s
  if (t <= 0) return 0;
  if (t <= 138) return 1850 * Math.pow(t / 138, 1.6);
  if (t <= 148) return 1850 - (t - 138) * 6;
  if (t <= 515) return 1790 + (7450 - 1790) * Math.pow((t - 148) / 367, 1.55);
  return 7450;
}

const DT = 0.25;
const T_END = 900;
const up = [];               // {t, h (km), dr (km), v (m/s), vv (m/s)}
{
  let dr = 0;
  for (let t = 0; t <= T_END; t += DT) {
    const h = catmull(ALT_UP, t);
    const vv = (catmull(ALT_UP, t + 0.5) - catmull(ALT_UP, t - 0.5)) * 1000;
    const v = speedUp(t);
    const vh = Math.sqrt(Math.max(0, v * v - vv * vv));
    up.push({ t, h, dr, v, vv });
    dr += (vh * DT) / 1000 * (RE / (RE + h));      // ground distance
  }
}
function sampleArr(arr, t) {
  const i = Math.min(arr.length - 2, Math.max(0, Math.floor(t / DT)));
  const a = arr[i], b = arr[i + 1];
  const s = Math.min(1, Math.max(0, (t - a.t) / DT));
  const o = {};
  for (const k of Object.keys(a)) o[k] = a[k] + (b[k] - a[k]) * s;
  return o;
}
export function upperState(t) { return sampleArr(up, Math.max(0, Math.min(T_END, t))); }

// ── Booster return to launch site ──────────────────────────────────────────
const sepState = upperState(141);
export function boosterTables(lz) {
  const h0 = sepState.h, d0 = sepState.dr;
  const H = [[141, h0], [160, h0 + 9], [200, h0 + 33], [240, h0 + 47], [262, h0 + 50], [300, h0 + 42], [340, h0 + 22],
    [375, 40], [395, 30], [430, 12], [446, 3.6], [458, 0.6], [465, 0.0], [600, 0.0]];
  const X = [[141, d0], [160, d0 * 1.12], [200, d0 * 1.2], [240, d0 * 1.06], [262, d0 * 0.95], [300, d0 * 0.72],
    [340, d0 * 0.45], [375, d0 * 0.26], [395, d0 * 0.16], [430, lz.x / 1000 + 2.0], [446, lz.x / 1000 + 0.4], [465, lz.x / 1000], [600, lz.x / 1000]];
  const Z = [[141, 0], [262, lz.z * 0.0003], [375, lz.z * 0.0008], [430, lz.z * 0.00095], [446, lz.z / 1000], [600, lz.z / 1000]];
  return { H, X, Z };
}
export function boosterState(t, tables) {
  const tt = Math.max(141, Math.min(600, t));
  return { h: Math.max(0, catmull(tables.H, tt)), dr: catmull(tables.X, tt), cr: catmull(tables.Z, tt) };
}

/** Local launch frame (metres): x downrange along the great circle, y up at the pad, z crossrange. */
export function localPos(hKm, drKm, crKm = 0, out) {
  const th = drKm / RE;
  const r = (RE + hKm) * 1000;
  return out.set(r * Math.sin(th), r * Math.cos(th) - RE * 1000, crKm * 1000);
}

// ── Engines & events ───────────────────────────────────────────────────────
export function engineState(t) {
  const m = MILESTONES;
  const s1 = t >= -3 && t < m.meco ? (t > 55 && t < 80 ? 0.72 : 1) : 0;
  const boost = (t >= m.boostback[0] && t < m.boostback[1]) ? 0.8 : 0;
  const entry = (t >= m.entry[0] && t < m.entry[1]) ? 0.8 : 0;
  const land = (t >= m.landing[0] && t < m.landing[1]) ? 0.6 : 0;
  const s2 = t >= m.ses && t < m.seco ? 1 : 0;
  return { s1, booster: Math.max(boost, entry, land), s2, phase: boost ? 'boostback' : entry ? 'entry' : land ? 'landing' : '' };
}

// ── Orbit phasing ──────────────────────────────────────────────────────────
const n = (h) => Math.sqrt(MU / (RE + h) ** 3);
export const PHASING_BURNS = [
  { t: 540, h: 210, name: 'Insertion orbit' },
  { t: 2.5 * 3600, h: 245, name: 'Phasing burn 1' },
  { t: 12 * 3600, h: 290, name: 'Phasing burn 2' },
  { t: 24 * 3600, h: 330, name: 'Phasing burn 3' },
  { t: 38 * 3600, h: 370, name: 'Phasing burn 4' },
  { t: 47 * 3600, h: 395, name: 'Height-adjust burn' },
  { t: T_RNDZ - 3600, h: 412, name: 'Coelliptic burn' },
];

const siteU = Math.asin(Math.sin(SITE.lat * D2R) / Math.sin(INC));
const lamRel = Math.atan2(Math.cos(INC) * Math.sin(siteU), Math.cos(siteU));
export const RAAN = SITE.lon * D2R + gmst(LIFTOFF) - lamRel;     // plane through the pad at liftoff
const uInsert = siteU + upperState(540).dr / RE;

export function dragonAlt(t) {
  let h = PHASING_BURNS[0].h;
  for (const b of PHASING_BURNS) if (t >= b.t) h = b.h;
  return t >= T_RNDZ ? ISS_ALT : h;
}
function dragonU0(t) {
  let u = uInsert;
  for (let i = 0; i < PHASING_BURNS.length; i++) {
    const a = PHASING_BURNS[i];
    const end = Math.min(t, PHASING_BURNS[i + 1]?.t ?? Infinity);
    if (end <= a.t) break;
    u += n(a.h) * (end - a.t);
  }
  return u;
}
const nIss = n(ISS_ALT);
const uDock = dragonU0(T_DOCK);
export function issU(t) { return uDock + nIss * (t - T_DOCK); }
export const ISS_N = nIss;

// The coarse burn model leaves Dragon ≈ 30 km off at the start of the rendezvous.
// Blend that residual out over the last 6 h so the orbit view hands over exactly
// at the approach-ellipsoid entry point (≈ 0.9 km behind the station).
const RESID = issU(T_RNDZ) - dragonUraw(T_RNDZ) - 0.9 / (RE + ISS_ALT);
function dragonUraw(t) { return dragonU0(t); }
export function dragonUDisplay(t) {
  const k = Math.min(1, Math.max(0, (t - (T_RNDZ - 6 * 3600)) / (6 * 3600)));
  return dragonU0(t) + RESID * k * k * (3 - 2 * k);
}

/** Unit ECI position for an argument of latitude in the shared orbit plane. */
export function eciDir(u, out) {
  const cO = Math.cos(RAAN), sO = Math.sin(RAAN), ci = Math.cos(INC), si = Math.sin(INC);
  const cu = Math.cos(u), su = Math.sin(u);
  return out.set(cu * cO - su * ci * sO, cu * sO + su * ci * cO, su * si);
}

/** Phase angle (deg) by which the ISS leads Dragon, wrapped to [0, 360). */
export function phaseLead(t) {
  const d = ((issU(t) - dragonUDisplay(t)) / D2R) % 360;
  return (d + 360) % 360;
}
