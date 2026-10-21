/**
 * Sun position, Hyderabad climate and a simple plant model (power, cooling, compute).
 * The plant model is illustrative: it uses textbook relations (heat = flow·cp·ΔT,
 * dry-cooler approach, evaporative latent heat) with assumed overheads.
 */
import { SITE, CLIMATE, FACTORY } from '../data/specs.js';

const D2R = Math.PI / 180;

/** Sun direction for UTC milliseconds at the site. Returns {el, az} in radians (az from north, clockwise). */
export function sunPosition(ms, lat = SITE.lat, lon = SITE.lon) {
  const d = ms / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * D2R;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
  const e = (23.439 - 0.00000036 * d) * D2R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24) * 15 * D2R;
  const H = gmst + lon * D2R - ra;
  const phi = lat * D2R;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { el, az: (az + Math.PI * 2) % (Math.PI * 2) };
}

/** Scene direction (x east, y up, z south) for a sun position. */
export function sunVector(p, out) {
  out.set(Math.cos(p.el) * Math.sin(p.az), Math.sin(p.el), -Math.cos(p.el) * Math.cos(p.az));
  return out;
}

/** Local (IST) calendar parts for UTC ms. */
export function ist(ms) {
  const d = new Date(ms + SITE.tz * 3600000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), hour: d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 };
}

/** Ambient temperature from monthly normals: minimum near 06:00, maximum near 15:00. */
export function ambient(month, hour) {
  const [lo, hi] = CLIMATE[month];
  if (hour >= 6 && hour <= 15) return lo + (hi - lo) * (1 - Math.cos(Math.PI * (hour - 6) / 9)) / 2;
  const k = (((hour - 15) % 24) + 24) % 24 / 15;
  return hi - (hi - lo) * (1 - Math.cos(Math.PI * k)) / 2;
}

/** Cloudiness 0–1 and whether it is raining (monsoon afternoon/evening showers). */
export function weather(month, hour) {
  const cloud = Math.min(1, CLIMATE[month][2] / 14);
  const rain = cloud > 0.7 && hour >= 14 && hour <= 21;
  return { cloud, rain };
}

const gauss = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));

/** Workload utilisation 0–1. Inference follows Indian daily demand (morning and evening peaks). */
export function utilisation(mode, hour) {
  if (mode === 'training') return 0.94;
  return Math.min(0.97, 0.38 + 0.30 * gauss(hour, 11.5, 2.6) + 0.52 * gauss(hour, 21, 2.4) + 0.5 * gauss(hour + 24, 21, 2.4));
}

/** Plant state for given conditions. */
export function plant({ mode, hour, month, sunEl, solarMWp }) {
  const util = utilisation(mode, hour);
  const amb = ambient(month, hour);
  const { cloud, rain } = weather(month, hour);
  const it = FACTORY.itMW * (0.30 + 0.70 * util);
  const dryT = amb + SITE.dryCoolerApproach;
  const assist = dryT > SITE.coolantSetpoint;
  const evapFrac = assist ? Math.min(1, (dryT - SITE.coolantSetpoint) / 12) * 0.35 : 0;
  const waterM3h = evapFrac * it * 1e6 / 2.45e6 * 3.6;
  const supply = SITE.coolantSetpoint;
  const ret = supply + SITE.designDeltaT * (it / FACTORY.itMW);
  const fans = 0.006 + 0.022 * Math.min(1, Math.max(0, (amb - 15) / 25));
  const overhead = 0.035 /* electrical losses */ + 0.01 /* lighting, offices, network */ + 0.012 /* pumps */ + fans;
  const facility = it * (1 + overhead);
  const irr = Math.pow(Math.max(0, Math.sin(sunEl)), 1.15) * (1 - 0.65 * cloud);
  const solar = solarMWp * 0.82 * irr;
  const rackKW = (it * 1000) / FACTORY.racks;
  const flowLpm = ((FACTORY.itMW * 1000) / FACTORY.racks) / (4.18 * SITE.designDeltaT) * 60;
  return {
    util, amb, cloud, rain, it, facility, pue: facility / it, solar, grid: facility - solar,
    supply, ret, assist, waterM3h, rackKW, flowLpm,
    zflops: util * (mode === 'training' ? FACTORY.trainingZF : FACTORY.inferenceZF),
  };
}
