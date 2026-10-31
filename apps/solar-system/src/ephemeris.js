/**
 * Planet and Moon positions.
 *
 * Planets & Pluto: JPL "Approximate Positions of the Planets" (E. M. Standish),
 * Table 1 — Keplerian elements and rates referred to the J2000 ecliptic and equinox,
 * valid 1800–2050 AD. Accuracy is a few arc-minutes for the inner planets, a few
 * tens of arc-minutes for the outer ones — plenty for a visual model.
 *
 * Moon: low-precision geocentric series (Astronomical Almanac), ~0.3° accurate.
 *
 * All positions are heliocentric (or planet-centric for moons) ecliptic J2000, km.
 */

export const AU = 149597870.7;            // km
const D2R = Math.PI / 180;

//            a [AU]       e            I [deg]       L [deg]         ϖ [deg]        Ω [deg]
//  rates per Julian century
export const ELEMENTS = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
    [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  pluto: [[39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
    [-0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
};

export const julian = (ms) => ms / 86400000 + 2440587.5;

function elementsAt(name, jd) {
  const [e0, r] = ELEMENTS[name];
  const T = (jd - 2451545.0) / 36525;
  return e0.map((v, i) => v + r[i] * T);
}

function solveKepler(M, e) {
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 8; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Position on an orbit for eccentric anomaly E, returned in km into `out` ({x,y,z}). */
function orbitPoint(a, e, I, w, O, E, out) {
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  out.x = ((cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp) * AU;
  out.y = ((cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp) * AU;
  out.z = ((sw * sI) * xp + (cw * sI) * yp) * AU;
  return out;
}

/** Heliocentric ecliptic J2000 position (km). */
export function planetPosition(name, jd, out = {}) {
  const [a, e, I, L, wbar, O] = elementsAt(name, jd);
  let M = ((L - wbar) % 360) * D2R;
  const E = solveKepler(M, e);
  return orbitPoint(a, e, I * D2R, (wbar - O) * D2R, O * D2R, E, out);
}

/** Points along the current osculating orbit (km), for drawing orbit lines. */
export function orbitPath(name, jd, n = 360) {
  const [a, e, I, , wbar, O] = elementsAt(name, jd);
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(orbitPoint(a, e, I * D2R, (wbar - O) * D2R, O * D2R, (i / n) * Math.PI * 2, {}));
  return pts;
}

export function orbitalPeriodDays(name) {
  return 36525 * 360 / ELEMENTS[name][1][3];
}

/** Geocentric ecliptic position of the Moon (km). */
export function moonPosition(jd, out = {}) {
  const d = jd - 2451545.0;
  const L = (218.316 + 13.176396 * d) * D2R;
  const M = (134.963 + 13.064993 * d) * D2R;
  const F = (93.272 + 13.229350 * d) * D2R;
  const lon = L + 6.289 * D2R * Math.sin(M);
  const lat = 5.128 * D2R * Math.sin(F);
  const r = 385001 - 20905 * Math.cos(M);
  out.x = r * Math.cos(lat) * Math.cos(lon);
  out.y = r * Math.cos(lat) * Math.sin(lon);
  out.z = r * Math.sin(lat);
  return out;
}

/** Greenwich sidereal angle (rad) — orients Earth's texture correctly. */
export function gmst(jd) {
  const n = jd - 2451545.0;
  return ((((280.46061837 + 360.98564736629 * n) % 360) + 360) % 360) * D2R;
}
export const OBLIQUITY = 23.4393 * D2R;
