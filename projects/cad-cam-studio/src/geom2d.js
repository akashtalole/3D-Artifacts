/**
 * 2D shapes used by features and toolpaths: rounded rectangle, circle, stadium (slot).
 * All three are convex, so offsets are exact and analytic:
 *   rounded rect (w, h, r) offset by d → (w+2d, h+2d, max(0, r+d))
 *   circle R → R+d ; stadium (half-length L, radius R) → (L, R+d)
 */
const TOL = 0.02;       // chord tolerance, mm

export const rrect = (cx, cy, w, h, r = 0, angle = 0) => ({ kind: 'rrect', cx, cy, w, h, r: Math.max(0, Math.min(r, w / 2, h / 2)), angle });
export const circle = (cx, cy, R) => ({ kind: 'circle', cx, cy, R });
export const stadium = (cx, cy, len, width, angle = 0) => ({ kind: 'stadium', cx, cy, L: Math.max(0, (len - width) / 2), R: width / 2, angle });

/** Offset a shape (d > 0 grows, d < 0 shrinks). Returns null when it vanishes. */
export function offset(s, d) {
  if (s.kind === 'rrect') {
    const w = s.w + 2 * d, h = s.h + 2 * d;
    if (w <= 1e-6 || h <= 1e-6) return null;
    return { ...s, w, h, r: Math.max(0, Math.min(s.r + d, w / 2, h / 2)) };
  }
  if (s.kind === 'circle') return s.R + d > 1e-6 ? { ...s, R: s.R + d } : null;
  if (s.kind === 'stadium') return s.R + d > 1e-6 ? { ...s, R: s.R + d } : null;
  return null;
}

const arcSteps = (R, sweep) => Math.max(2, Math.ceil(sweep / (2 * Math.acos(Math.max(-1, 1 - TOL / Math.max(R, TOL * 2))))));
function arc(out, cx, cy, R, a0, a1) {
  const n = arcSteps(R, Math.abs(a1 - a0));
  for (let i = 1; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
}
const rot = (p, s) => {
  if (!s.angle) return [p[0] + s.cx, p[1] + s.cy];
  const a = (s.angle * Math.PI) / 180, c = Math.cos(a), n = Math.sin(a);
  return [s.cx + p[0] * c - p[1] * n, s.cy + p[0] * n + p[1] * c];
};

/**
 * Closed polyline around a shape, counter-clockwise, starting on the +X side
 * (middle of the right edge). Pass ccw=false for clockwise.
 */
export function ring(s, ccw = true) {
  const pts = [];
  if (s.kind === 'circle') {
    pts.push([s.R, 0]); arc(pts, 0, 0, s.R, 0, Math.PI * 2);
  } else if (s.kind === 'rrect') {
    const hw = s.w / 2, hh = s.h / 2, r = s.r, ix = hw - r, iy = hh - r;
    pts.push([hw, 0]);
    const corner = (cx, cy, a0) => { if (r > 1e-6) arc(pts, cx, cy, r, a0, a0 + Math.PI / 2); else pts.push([cx, cy]); };
    pts.push([hw, iy]); corner(ix, iy, 0);
    pts.push([-ix, hh]); corner(-ix, iy, Math.PI / 2);
    pts.push([-hw, -iy]); corner(-ix, -iy, Math.PI);
    pts.push([ix, -hh]); corner(ix, -iy, 1.5 * Math.PI);
    pts.push([hw, 0]);
  } else if (s.kind === 'stadium') {
    const { L, R } = s;
    pts.push([L + R, 0]); arc(pts, L, 0, R, 0, Math.PI / 2);
    pts.push([-L, R]); arc(pts, -L, 0, R, Math.PI / 2, 1.5 * Math.PI);
    pts.push([L, -R]); arc(pts, L, 0, R, 1.5 * Math.PI, 2 * Math.PI);
  }
  const dedup = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6).map((p) => rot(p, s));
  return ccw ? dedup : dedup.reverse();
}

/** Medial "spine" of an elongated shape (segment its centre-line traces), or null. */
export function spine(s) {
  if (s.kind === 'stadium' && s.L > 1e-6) return [rot([-s.L, 0], s), rot([s.L, 0], s)];
  if (s.kind === 'rrect' && Math.abs(s.w - s.h) > 1e-6) {
    const k = Math.abs(s.w - s.h) / 2;
    return s.w > s.h ? [rot([-k, 0], s), rot([k, 0], s)] : [rot([0, -k], s), rot([0, k], s)];
  }
  return null;
}

/** Is (x, y) inside the shape? */
export function contains(s, x, y) {
  let px = x - s.cx, py = y - s.cy;
  if (s.angle) { const a = (-s.angle * Math.PI) / 180, c = Math.cos(a), n = Math.sin(a); [px, py] = [px * c - py * n, px * n + py * c]; }
  if (s.kind === 'circle') return px * px + py * py <= s.R * s.R;
  if (s.kind === 'stadium') { const qx = Math.max(0, Math.abs(px) - s.L); return qx * qx + py * py <= s.R * s.R; }
  const qx = Math.abs(px) - (s.w / 2 - s.r), qy = Math.abs(py) - (s.h / 2 - s.r);
  if (Math.abs(px) > s.w / 2 || Math.abs(py) > s.h / 2) return false;
  return qx <= 0 || qy <= 0 || qx * qx + qy * qy <= s.r * s.r;
}

/** Half-width (in X) of a rounded rect at local height y (for zig-zag rows), or -1. */
export function rrectHalfWidthAt(s, y) {
  const ay = Math.abs(y - s.cy), hh = s.h / 2, hw = s.w / 2;
  if (ay > hh) return -1;
  if (ay <= hh - s.r) return hw;
  const dy = ay - (hh - s.r);
  return hw - s.r + Math.sqrt(Math.max(0, s.r * s.r - dy * dy));
}

export const pathLength = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
