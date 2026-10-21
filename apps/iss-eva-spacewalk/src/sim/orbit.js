import * as THREE from 'three';

/**
 * Circular-orbit model of the ISS with a real Sun ephemeris and Earth rotation.
 *
 *  - Orbit: circular, altitude ≈ 415 km, inclination 51.64°, Keplerian period.
 *  - Sun:   low-precision solar position (Astronomical Almanac, ≈ 0.01° accuracy).
 *  - Earth: rotates at the sidereal rate (GMST), so the ground track, day/night
 *           terminator and city lights are consistent with the simulated UTC time.
 *
 * Everything is expressed in the station's local-vertical / local-horizontal frame
 * (see layout.js): x = velocity, y = zenith, z = starboard (= −orbit normal).
 */

export const MU = 398600.4418;      // km³/s²
export const R_EARTH = 6371.0;      // km, mean radius
const D2R = Math.PI / 180;

function julian(date) { return date.getTime() / 86400000 + 2440587.5; }

/** Unit vector to the Sun in ECI (J2000-ish equator/equinox). */
export function sunECI(date, out = new THREE.Vector3()) {
  const n = julian(date) - 2451545.0;
  const L = (280.46 + 0.9856474 * n) * D2R;
  const g = (357.528 + 0.9856003 * n) * D2R;
  const lambda = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  return out.set(Math.cos(lambda), Math.cos(eps) * Math.sin(lambda), Math.sin(eps) * Math.sin(lambda));
}

/** Greenwich Mean Sidereal Time, radians. */
export function gmst(date) {
  const n = julian(date) - 2451545.0;
  return (((280.46061837 + 360.98564736629 * n) % 360) + 360) % 360 * D2R;
}

export class Orbit {
  constructor({ altitudeKm = 415, inclinationDeg = 51.64, raanDeg = 0, epoch = new Date(), startPhase = 'morning', daylightAt = null } = {}) {
    this.altitude = altitudeKm;
    this.a = R_EARTH + altitudeKm;
    this.inc = inclinationDeg * D2R;
    this.raan = raanDeg * D2R;
    this.epoch = epoch;
    this.n = Math.sqrt(MU / this.a ** 3);              // rad/s
    this.period = (2 * Math.PI) / this.n;                // s
    this.speed = Math.sqrt(MU / this.a);                 // km/s
    this.rho = Math.asin(R_EARTH / this.a);              // angular radius of Earth from the ISS
    this.u0 = 0;
    this._s = {};
    if (startPhase) this.u0 = this.solveStartPhase(startPhase);
    // Optionally phase the orbit so that a key moment (seconds after epoch) is near orbit noon.
    if (daylightAt != null) this.u0 += 1.0 - 0.3 - this.n * daylightAt;
  }

  /** Argument of latitude at time t (s after epoch). */
  u(t) { return this.u0 + this.n * t; }

  /** Pick the initial orbital position so the sim starts shortly after orbital sunrise. */
  solveStartPhase(kind) {
    this.u0 = 0;
    const s = this.state(0);
    const theta0 = s.theta; // sun angle from orbit noon at u0 = 0
    // 'morning': about 25 minutes before orbit noon — the ground below is in daylight
    const target = kind === 'morning' ? -1.0 : 0;
    return target - theta0;
  }

  /** Full state at t seconds after epoch. Allocates nothing per call except the returned object. */
  state(t) {
    const s = this._s;
    const date = new Date(this.epoch.getTime() + t * 1000);
    const u = this.u(t);
    const cO = Math.cos(this.raan), sO = Math.sin(this.raan);
    const ci = Math.cos(this.inc), si = Math.sin(this.inc);
    const cu = Math.cos(u), su = Math.sin(u);

    // ECI position / velocity directions:  Rz(Ω) · Rx(i) · [cos u, sin u, 0]
    const r = (s.r ||= new THREE.Vector3()).set(cu * cO - su * ci * sO, cu * sO + su * ci * cO, su * si);
    const v = (s.v ||= new THREE.Vector3()).set(-su * cO - cu * ci * sO, -su * sO + cu * ci * cO, cu * si);
    const z = (s.zAxis ||= new THREE.Vector3()).crossVectors(v, r); // starboard = v × r = −h
    const sun = sunECI(date, (s.sunEci ||= new THREE.Vector3()));

    // Sun in station frame
    const sunLocal = (s.sun ||= new THREE.Vector3()).set(sun.dot(v), sun.dot(r), sun.dot(z));
    const betaRad = Math.asin(THREE.MathUtils.clamp(-sunLocal.z, -1, 1)); // β = angle to orbit plane (+ toward h)
    const theta = Math.atan2(-sunLocal.x, sunLocal.y);                       // 0 at orbit noon

    // Eclipse: Sun hidden when its angle from nadir is less than Earth's angular radius
    const psi = Math.acos(THREE.MathUtils.clamp(-sunLocal.y, -1, 1));
    const sunElevation = (psi - this.rho) / D2R;           // degrees above the Earth's limb
    const inShadow = sunElevation < 0;

    // Next sunrise / sunset (Sun nearly fixed over one orbit)
    const c = -Math.cos(this.rho) / Math.max(1e-6, Math.cos(betaRad));
    let next = null;
    if (Math.abs(c) <= 1) {
      const tSet = Math.acos(c);
      const tRise = 2 * Math.PI - tSet;
      const th = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (th < tSet) next = { type: 'sunset', in: (tSet - th) / this.n };
      else if (th < tRise) next = { type: 'sunrise', in: (tRise - th) / this.n };
      else next = { type: 'sunset', in: (2 * Math.PI - th + tSet) / this.n };
      s.nightFraction = (tRise - tSet) / (2 * Math.PI);
    } else {
      s.nightFraction = 0;
    }

    // Ground track
    const g = gmst(date);
    const cg = Math.cos(g), sg = Math.sin(g);
    const ex = r.x * cg + r.y * sg, ey = -r.x * sg + r.y * cg;
    const lat = Math.asin(r.z) / D2R;
    const lon = Math.atan2(ey, ex) / D2R;

    // Rotation that places the Earth mesh (three.js sphere UV layout) in the station frame:
    // M = L · Rz(GMST) · P   where P maps mesh axes → ECEF and L maps ECI → station frame.
    const L = (s.L ||= new THREE.Matrix4()).set(v.x, v.y, v.z, 0, r.x, r.y, r.z, 0, z.x, z.y, z.z, 0, 0, 0, 0, 1);
    const Rz = (s.Rz ||= new THREE.Matrix4()).set(cg, -sg, 0, 0, sg, cg, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    const P = (s.P ||= new THREE.Matrix4()).set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);
    const earthRot = (s.earthRot ||= new THREE.Matrix4()).copy(L).multiply(Rz).multiply(P);

    Object.assign(s, {
      t, date, u, theta, betaRad, betaDeg: betaRad / D2R, sunElevation, inShadow, next, lat, lon,
      orbitNumber: Math.floor((u - this.u0) / (2 * Math.PI)) + 1,
      earthCenterKm: this.a,
    });
    return s;
  }
}
