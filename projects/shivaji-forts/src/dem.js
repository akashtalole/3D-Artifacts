/**
 * Terrarium-encoded elevation tiles: elevation = R·256 + G + B/256 − 32768 (metres).
 * Decoded without colour-space conversion so the bytes stay exact.
 */
export async function loadDem(url) {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
  const w = bmp.width, h = bmp.height, e = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) e[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
  const at = (x, y) => e[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  /** Bilinear sample at fractional pixel coordinates. */
  const sample = (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
  };
  return { w, h, e, at, sample };
}

/** Global Web-Mercator pixel → lat/lon (zoom z, 256-px tiles). */
export function pixToLatLon(px, py, z) {
  const n = 2 ** z * 256;
  return [(Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / n))) * 180) / Math.PI, (px / n) * 360 - 180];
}
export function latLonToPix(lat, lon, z) {
  const n = 2 ** z * 256, r = (lat * Math.PI) / 180;
  return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n];
}
