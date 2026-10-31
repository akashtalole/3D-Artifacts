/** Low-precision solar position (NOAA-style) for a place and time. */
const D2R = Math.PI / 180;
export function sunPosition(ms, lat, lon) {
  const d = ms / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * D2R;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
  const e = (23.439 - 0.00000036 * d) * D2R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24) * 15 * D2R;
  const H = gmst + lon * D2R - ra, phi = lat * D2R;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { el, az };
}
/** Direction in scene axes (x east, y up, z south). */
export const sunDir = (p, v) => v.set(Math.cos(p.el) * Math.sin(p.az), Math.sin(p.el), -Math.cos(p.el) * Math.cos(p.az));
/** UTC ms for a local IST hour on a date (YYYY-MM-DD). */
export const istToUtc = (date, hour) => Date.parse(`${date}T00:00:00Z`) + (hour - 5.5) * 3600000;
