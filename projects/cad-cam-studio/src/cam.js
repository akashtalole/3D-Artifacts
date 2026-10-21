/**
 * Toolpath generation (2.5D milling) and G-code output.
 *
 * Strategies
 *  - Face: zig-zag rows across the stock, entering from outside the material.
 *  - Pocket (offset): concentric offsets from the centre outwards, helical entry, climb (CCW).
 *  - Pocket (zig-zag): raster rows with a ramp entry plus a finishing pass.
 *  - Slot: ramped centre-line passes when the tool matches the slot width, otherwise a pocket.
 *  - Drill: G83-style peck drilling (written out as G0/G1 moves for GRBL).
 *  - Helical bore: helix down at the hole radius minus tool radius, then a clean-up circle.
 *  - Profile: outside contour, climb (CW), ramped entry, optional holding tabs.
 */
import { MATERIALS, cutting, holeCentres, featureDepth, OP_LABEL } from './model.js';
import { rrect, circle, stadium, offset, ring, spine, rrectHalfWidthAt, pathLength } from './geom2d.js';

const RAMP = (3 * Math.PI) / 180;      // ramp angle for entries
const CLEAR = 1;                        // clearance plane above the top surface

class Path {
  constructor(safe, start) { this.safe = safe; this.m = []; this.p = { ...start }; }
  _push(x, y, z, rapid, f) {
    if (Math.abs(x - this.p.x) < 1e-6 && Math.abs(y - this.p.y) < 1e-6 && Math.abs(z - this.p.z) < 1e-6) return;
    this.m.push({ x, y, z, rapid, f }); this.p = { x, y, z };
  }
  rapid(x = this.p.x, y = this.p.y, z = this.p.z) { this._push(x, y, z, true, 0); }
  feed(x = this.p.x, y = this.p.y, z = this.p.z, f) { this._push(x, y, z, false, f); }
  retract() { this.rapid(this.p.x, this.p.y, this.safe); }
  goTo(x, y) { this.retract(); this.rapid(x, y, this.safe); this.rapid(x, y, CLEAR); }
}

const levels = (depth, step) => {
  const out = []; const s = Math.max(0.05, step);
  for (let z = -s; z > -depth + 1e-6; z -= s) out.push(+z.toFixed(4));
  out.push(-depth);
  return out;
};

/**
 * Walk a closed polyline by arc length, starting at arc position s0, for `total` mm,
 * with z = zFn(sRelative, sAbsolute). Breakpoints (absolute) get vertical steps.
 */
function traverse(P, pts, s0, total, zFn, extraBreaks, f) {
  const n = pts.length, cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const closing = Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]);
  const L = cum[n - 1] + closing;
  const at = (s) => {
    let u = ((s % L) + L) % L;
    if (u >= cum[n - 1]) { const t = closing ? (u - cum[n - 1]) / closing : 0; return [pts[n - 1][0] + (pts[0][0] - pts[n - 1][0]) * t, pts[n - 1][1] + (pts[0][1] - pts[n - 1][1]) * t]; }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= u) lo = mid; else hi = mid; }
    const t = (u - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
  };
  const rel = (a) => (((a - s0) % L) + L) % L;
  const breaks = new Set([0]);
  for (let k = 0; k * L <= total + L; k++) for (const a of [...cum, L, ...extraBreaks]) breaks.add(rel(a) + k * L);
  const list = [...breaks].filter((b) => b >= 0 && b <= total + 1e-9).sort((a, b) => a - b);
  if (list[list.length - 1] < total) list.push(total);
  for (const b of list) {
    const [x, y] = at(b + s0), zl = zFn(b - 1e-7, b + s0 - 1e-7), zr = zFn(b + 1e-7, b + s0 + 1e-7);
    P.feed(x, y, zl, f);
    if (Math.abs(zr - zl) > 1e-6) P.feed(x, y, zr, f);
  }
  return L;
}

function helix(P, cx, cy, rh, zFrom, zTo, f) {
  P.feed(cx + rh, cy, zFrom, f);
  const pitch = Math.max(0.05, 2 * Math.PI * rh * Math.tan(RAMP));
  const turns = Math.max(0, (zFrom - zTo) / pitch), steps = Math.ceil(turns * 36);
  for (let i = 1; i <= steps; i++) { const a = (2 * Math.PI * turns * i) / steps; P.feed(cx + rh * Math.cos(a), cy + rh * Math.sin(a), zFrom - ((zFrom - zTo) * i) / steps, f); }
  for (let i = 1; i <= 36; i++) { const a = (2 * Math.PI * (turns + i / 36)); P.feed(cx + rh * Math.cos(a), cy + rh * Math.sin(a), zTo, f); }
  P.feed(cx, cy, zTo, f);
}
/** Ramp down back and forth along segment a→b, finishing at a on zTo. */
function rampLine(P, a, b, zFrom, zTo, f) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.5) { P.feed(a[0], a[1], zFrom, f); P.feed(a[0], a[1], zTo, f * 0.4); return; }
  P.feed(a[0], a[1], zFrom, f);
  let z = zFrom, atA = true;
  const drop = len * Math.tan(RAMP);
  while (z > zTo + 1e-6) {
    z = Math.max(zTo, z - drop);
    const [x, y] = atA ? b : a; P.feed(x, y, z, f); atA = !atA;
  }
  if (!atA) P.feed(a[0], a[1], zTo, f);
}

// ── Strategies ─────────────────────────────────────────────────────────────
function pocketOffset(P, S, depth, tool, o, c, warn) {
  const rt = tool.d / 2, so = Math.min(0.95, Math.max(0.05, o.stepover / 100)) * tool.d;
  const rings = [];
  let innerShape = null;
  for (let d = rt; rings.length < 400; d += so) { const s = offset(S, -d); if (!s) break; rings.push(ring(s, true)); innerShape = s; }
  if (!rings.length) { warn.push(`Tool Ø${tool.d} is too large for this pocket`); return; }
  rings.reverse();
  const sp = spine(innerShape);
  const innerMin = innerShape.kind === 'circle' ? innerShape.R : innerShape.kind === 'stadium' ? innerShape.R : Math.min(innerShape.w, innerShape.h) / 2;
  const rh = Math.min(rt * 0.8, innerMin);
  const cx = S.cx, cy = S.cy;
  let zPrev = CLEAR;
  P.goTo(cx, cy);
  for (const z of levels(depth, o.stepdown)) {
    if (zPrev !== CLEAR) P.feed(cx, cy, zPrev, c.feed);
    if (rh > 0.25) helix(P, cx, cy, rh, zPrev === CLEAR ? 0.2 : zPrev, z, c.feed * 0.7);
    else { P.feed(cx, cy, Math.min(zPrev, 0.2), c.plunge); P.feed(cx, cy, z, c.plunge); }
    if (sp) { P.feed(sp[0][0], sp[0][1], z, c.feed); P.feed(sp[1][0], sp[1][1], z, c.feed); }
    for (const r of rings) { P.feed(r[0][0], r[0][1], z, c.feed); for (const p of r) P.feed(p[0], p[1], z, c.feed); P.feed(r[0][0], r[0][1], z, c.feed); }
    zPrev = z;
  }
  P.retract();
  if (S.kind === 'rrect' && S.r + 1e-6 < rt) warn.push(`Corners will have R${rt.toFixed(1)} (tool radius) instead of R${S.r}`);
}

function pocketZigzag(P, S, depth, tool, o, c, warn) {
  const rt = tool.d / 2, so = Math.min(0.95, Math.max(0.05, o.stepover / 100)) * tool.d;
  const inner = offset(S, -rt);
  if (!inner) { warn.push(`Tool Ø${tool.d} is too large for this pocket`); return; }
  const n = Math.max(1, Math.ceil(inner.h / so)), rows = [];
  for (let i = 0; i <= n; i++) {
    const y = inner.cy - inner.h / 2 + (inner.h * i) / n, hw = rrectHalfWidthAt(inner, y);
    if (hw > 0) rows.push(i % 2 ? [[inner.cx + hw, y], [inner.cx - hw, y]] : [[inner.cx - hw, y], [inner.cx + hw, y]]);
  }
  const fin = ring(inner, true);
  let zPrev = CLEAR;
  P.goTo(rows[0][0][0], rows[0][0][1]);
  for (const z of levels(depth, o.stepdown)) {
    if (zPrev !== CLEAR) P.feed(rows[0][0][0], rows[0][0][1], zPrev, c.feed);
    rampLine(P, rows[0][0], rows[0][1], zPrev === CLEAR ? 0.2 : zPrev, z, c.feed * 0.7);
    for (const [a, b] of rows) { P.feed(a[0], a[1], z, c.feed); P.feed(b[0], b[1], z, c.feed); }
    P.feed(fin[0][0], fin[0][1], z, c.feed); for (const p of fin) P.feed(p[0], p[1], z, c.feed); P.feed(fin[0][0], fin[0][1], z, c.feed);
    zPrev = z;
  }
  P.retract();
}

function slot(P, S, depth, tool, o, c, warn) {
  if (S.R * 2 - tool.d > 0.25 || S.L < 1e-6) { pocketOffset(P, S, depth, tool, o, c, warn); return; }
  if (tool.d > S.R * 2 + 0.01) warn.push(`Tool Ø${tool.d} is wider than the ${(S.R * 2).toFixed(2)} mm slot`);
  const [a, b] = spine(S);
  let zPrev = CLEAR, fwd = true;
  P.goTo(a[0], a[1]);
  for (const z of levels(depth, o.stepdown)) {
    const [s, e] = fwd ? [a, b] : [b, a];
    rampLine(P, s, e, zPrev === CLEAR ? 0.2 : zPrev, z, c.feed * 0.6);
    P.feed(e[0], e[1], z, c.feed);
    zPrev = z; fwd = !fwd;
  }
  P.retract();
}

function nearestOrder(pts, start) {
  const left = pts.slice(), out = [];
  let cur = start;
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((p, i) => { const d = Math.hypot(p[0] - cur[0], p[1] - cur[1]); if (d < bd) { bd = d; bi = i; } });
    cur = left.splice(bi, 1)[0]; out.push(cur);
  }
  return out;
}

function drill(P, f, stock, tool, o, c, warn) {
  const r = tool.d / 2, tip = r * Math.tan((31 * Math.PI) / 180);
  if (Math.abs(tool.d - f.d) > 0.05) warn.push(`Drill Ø${tool.d} does not match the Ø${f.d} hole`);
  const zt = f.through ? -(stock.h + tip + 0.5) : -(f.depth + tip);
  const q = Math.max(0.2, o.peck || tool.d);
  for (const [x, y] of nearestOrder(holeCentres(f), [P.p.x, P.p.y])) {
    P.retract(); P.rapid(x, y, P.safe); P.rapid(x, y, CLEAR);
    let zc = 0;
    while (zc > zt + 1e-6) {
      const zn = Math.max(zt, zc - q);
      if (zc < 0) P.rapid(x, y, zc + 0.5);
      P.feed(x, y, zn, c.plunge);
      P.rapid(x, y, CLEAR);
      zc = zn;
    }
  }
  P.retract();
}

function bore(P, f, stock, tool, o, c, warn) {
  const rh = (f.d - tool.d) / 2;
  if (rh < -0.01) { warn.push(`Tool Ø${tool.d} is larger than the Ø${f.d} hole`); return; }
  const zt = f.through ? -(stock.h + 0.3) : -f.depth;
  for (const [x, y] of nearestOrder(holeCentres(f), [P.p.x, P.p.y])) {
    P.goTo(x, y);
    if (rh < 0.05) { // plunge with an end mill (pecking)
      let zc = 0.2; P.feed(x, y, zc, c.plunge);
      while (zc > zt + 1e-6) { const zn = Math.max(zt, zc - Math.max(0.3, tool.d * 0.5)); P.feed(x, y, zn, c.plunge); P.rapid(x, y, CLEAR); P.rapid(x, y, zn + 0.3); zc = zn; }
      P.retract(); continue;
    }
    P.feed(x, y, 0.2, c.plunge);
    const pitch = Math.max(0.08, Math.min(o.stepdown, 2 * Math.PI * rh * Math.tan((6 * Math.PI) / 180)));
    const turns = (0.2 - zt) / pitch, steps = Math.ceil(turns * 36);
    P.feed(x + rh, y, 0.2, c.feed * 0.6);
    for (let i = 1; i <= steps; i++) { const a = (2 * Math.PI * turns * i) / steps; P.feed(x + rh * Math.cos(a), y + rh * Math.sin(a), 0.2 - ((0.2 - zt) * i) / steps, c.feed * 0.6); }
    for (let i = 1; i <= 36; i++) { const a = 2 * Math.PI * (turns + i / 36); P.feed(x + rh * Math.cos(a), y + rh * Math.sin(a), zt, c.feed * 0.6); }
    P.feed(x, y, zt, c.feed * 0.6);
    P.retract();
  }
}

function profile(P, f, stock, tool, o, c, warn) {
  const rt = tool.d / 2;
  const O = f.shape === 'circle' ? circle(f.cx, f.cy, f.d / 2) : rrect(f.cx, f.cy, f.w, f.h, f.r);
  const pts = ring(offset(O, rt), false);
  const L = pathLength(pts) + Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]);
  const depth = f.through ? stock.h + 0.3 : f.depth;
  const tabs = f.through && o.tabs > 0 ? o.tabs | 0 : 0;
  const tabZ = -stock.h + Math.max(0.2, o.tabH || 1.5);
  const half = (o.tabW || 6) / 2 + rt;
  const tabC = Array.from({ length: tabs }, (_, k) => ((k + 0.5) * L) / tabs);
  const inTab = (s) => { const u = ((s % L) + L) % L; return tabC.some((t) => Math.abs(u - t) < half || Math.abs(u - t + L) < half || Math.abs(u - t - L) < half); };
  const tabBreaks = tabC.flatMap((t) => [t - half, t + half]).map((b) => ((b % L) + L) % L);
  if (tabs && half * 2 * tabs > L * 0.8) warn.push('Tabs cover most of the profile; reduce their count or width');
  let zPrev = 0, s0 = 0;
  P.goTo(pts[0][0], pts[0][1]);
  P.feed(pts[0][0], pts[0][1], 0, c.plunge);
  for (const z of levels(depth, o.stepdown)) {
    // each level continues from where the last ended, ramping down along the contour
    const ramp = Math.min(L * 0.9, (zPrev - z) / Math.tan(RAMP));
    const zFn = (s, abs) => {
      const zr = s < ramp ? zPrev - ((zPrev - z) * s) / ramp : z;
      return tabs && inTab(abs) ? Math.max(zr, tabZ) : zr;
    };
    traverse(P, pts, s0, L + ramp, zFn, tabBreaks, c.feed);
    s0 = (s0 + L + ramp) % L;
    zPrev = z;
  }
  P.retract();
}

function face(P, f, stock, tool, o, c) {
  const rt = tool.d / 2, so = Math.min(0.95, Math.max(0.1, o.stepover / 100)) * tool.d;
  const x0 = -rt - 2, x1 = stock.w + rt + 2, rows = [];
  for (let y = rt * 0.5; ; y += so) { rows.push(y); if (y + rt >= stock.d + 0.5 || rows.length > 500) break; }
  for (const z of levels(f.depth, o.stepdown)) {
    P.retract(); P.rapid(x0, rows[0], P.safe); P.rapid(x0, rows[0], z);
    rows.forEach((y, i) => { const [a, b] = i % 2 ? [x1, x0] : [x0, x1]; P.feed(a, y, z, c.feed); P.feed(b, y, z, c.feed); });
  }
  P.retract();
}

// ── Public API ─────────────────────────────────────────────────────────────
/** Build toolpaths for every enabled operation. */
export function generate(doc) {
  const { stock, machine } = doc;
  let pos = { x: 0, y: 0, z: machine.safeZ + 20 };
  const results = [];
  for (const o of doc.ops) {
    const f = doc.features.find((x) => x.id === o.featureId);
    const tool = doc.tools.find((t) => t.id === o.toolId);
    if (!f || !tool) continue;
    const auto = cutting(tool, stock.material, machine);
    const c = { rpm: o.rpm || auto.rpm, feed: o.feed || auto.feed, plunge: Math.max(20, Math.round((o.feed || auto.feed) / (tool.type === 'drill' ? 1 : 3))) };
    if (tool.type === 'drill') c.plunge = o.feed || auto.plunge;
    const warn = [];
    const P = new Path(machine.safeZ, pos);
    if (o.enabled && f.visible !== false) {
      P.rapid(pos.x, pos.y, machine.safeZ);
      const depth = featureDepth(f, stock);
      if (depth > stock.h + 1e-6) warn.push('Deeper than the stock');
      if (f.type === 'face') face(P, f, stock, tool, o, c);
      else if (f.type === 'rectPocket') (o.strategy === 'zigzag' ? pocketZigzag : pocketOffset)(P, rrect(f.cx, f.cy, f.w, f.h, f.r), f.depth, tool, o, c, warn);
      else if (f.type === 'circPocket') pocketOffset(P, circle(f.cx, f.cy, f.d / 2), f.depth, tool, o, c, warn);
      else if (f.type === 'slot') slot(P, stadium(f.cx, f.cy, f.len, f.width, f.angle), f.depth, tool, o, c, warn);
      else if (f.type === 'holes') (o.type === 'drill' ? drill : bore)(P, f, stock, tool, o, c, warn);
      else if (f.type === 'profile') profile(P, f, stock, tool, o, c, warn);
      if (tool.type === 'drill' && f.type !== 'holes') warn.push('A drill cannot mill this feature');
      if (o.stepdown > tool.len) warn.push('Stepdown is longer than the flutes');
      if (featureDepth(f, stock) > tool.len + 0.01 && f.type !== 'face') warn.push(`Depth exceeds the ${tool.len} mm flute length`);
      pos = { ...P.p };
    }
    let len = 0, t = 0, prev = null;
    for (const m of P.m) {
      if (prev) { const d = Math.hypot(m.x - prev.x, m.y - prev.y, m.z - prev.z); len += m.rapid ? 0 : d; t += m.rapid ? (d / machine.rapid) * 60 : (d / m.f) * 60; }
      prev = m;
    }
    results.push({ op: o, feature: f, tool, c, moves: P.m, warnings: warn, length: len, time: P.m.length ? t + machine.toolChange : 0, label: `${OP_LABEL[o.type]} · ${f.name}` });
  }
  return results;
}

/** G-code comments: ASCII only, no nested parentheses (GRBL rejects both). */
const cm = (t) => `(${String(t).replace(/[()]/g, (c) => (c === '(' ? '[' : ']')).replace(/Ø/g, 'D').replace(/[—–]/g, '-').replace(/·/g, '-').replace(/[^\x20-\x7e]/g, '')})`;
const n3 = (v) => (Math.abs(v) < 5e-5 ? '0' : v.toFixed(3).replace(/\.?0+$/, ''));
/** GRBL-flavoured G-code; also returns the G-code line index for every move. */
export function toGcode(doc, results) {
  const { stock, machine } = doc;
  const L = [];
  const lineOf = [];
  L.push('%', cm(`${doc.name} - CAD/CAM Studio`), cm(`Stock ${stock.w} x ${stock.d} x ${stock.h} mm, ${MATERIALS[stock.material].name}`),
    cm('WCS G54: X0 Y0 = front-left corner, Z0 = top of stock'));
  const used = [...new Map(results.filter((r) => r.moves.length).map((r) => [r.tool.id, r.tool])).values()];
  for (const t of used) L.push(cm(`T${t.num} D=${t.d} ${t.name}`));
  L.push('G21 G90 G94 G17', 'G54');
  let last = { x: null, y: null, z: null, f: null };
  results.forEach((r, ri) => {
    lineOf[ri] = [];
    if (!r.moves.length) return;
    L.push('', cm(`${r.label} - T${r.tool.num} D${r.tool.d}`), 'M5', `T${r.tool.num} M6`, `S${r.c.rpm} M3`, 'G4 P2');
    let mode = null;
    for (const m of r.moves) {
      const parts = [];
      const g = m.rapid ? 'G0' : 'G1';
      if (g !== mode) { parts.push(g); mode = g; }
      if (m.x !== last.x) parts.push(`X${n3(m.x)}`);
      if (m.y !== last.y) parts.push(`Y${n3(m.y)}`);
      if (m.z !== last.z) parts.push(`Z${n3(m.z)}`);
      if (!m.rapid && m.f !== last.f) { parts.push(`F${Math.round(m.f)}`); last.f = m.f; }
      last = { ...last, x: m.x, y: m.y, z: m.z };
      if (parts.length === 1 && (parts[0] === 'G0' || parts[0] === 'G1')) { lineOf[ri].push(L.length - 1); continue; }
      L.push(parts.join(' '));
      lineOf[ri].push(L.length - 1);
    }
  });
  L.push('', 'M5', `G0 Z${n3(machine.safeZ + 20)}`, 'G0 X0 Y0', 'M30', '%');
  return { text: L.join('\n'), lines: L, lineOf };
}
