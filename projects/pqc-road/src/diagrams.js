/**
 * Engineering drawings as SVG, scaled to the chosen slab thickness:
 * typical cross-section, transverse contraction joint, longitudinal joint and a slab-panel plan.
 */
import { DOWELS, TIEBAR, ROAD } from './data.js';

export const dowelFor = (t) => DOWELS.reduce((best, d) => (t >= d.t ? d : best), DOWELS[0]);
const C = { pqc: '#c9c7c0', dlc: '#a9a59c', gsb: '#8d8579', sub: '#8a6d4f', ink: '#e8ecef', mute: '#9aa4b0', steel: '#d6dbe0', acc: '#ffb020', seal: '#111', back: '#3c7cd6' };
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" fill="${o.c || C.ink}" font-size="${o.fs || 10.5}" ${o.a ? `text-anchor="${o.a}"` : ''} font-family="Inter, system-ui, sans-serif" ${o.w ? `font-weight="${o.w}"` : ''}>${s}</text>`;
const dimH = (x1, x2, y, label) => `<g stroke="${C.mute}" fill="none"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y - 4}" x2="${x1}" y2="${y + 4}"/><line x1="${x2}" y1="${y - 4}" x2="${x2}" y2="${y + 4}"/></g>${T((x1 + x2) / 2, y - 4, label, { a: 'middle', c: C.mute, fs: 10 })}`;
const dimV = (x, y1, y2, label, right = true) => `<g stroke="${C.mute}" fill="none"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><line x1="${x - 4}" y1="${y1}" x2="${x + 4}" y2="${y1}"/><line x1="${x - 4}" y1="${y2}" x2="${x + 4}" y2="${y2}"/></g>${T(right ? x + 6 : x - 6, (y1 + y2) / 2 + 3.5, label, { c: C.mute, fs: 10, a: right ? 'start' : 'end' })}`;
const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;

export function crossSection(t) {
  const W = 360, sx = 22, cx = 150, ex = 4.5;   // px per m horizontally; vertical exaggeration
  const y0 = 40, hy = (mm) => (mm / 1000) * sx * ex;
  const L = [['PQC M40', t, ROAD.width, C.pqc], ['DLC', 150, 9.5, C.dlc], ['GSB / drainage', 150, 10.5, C.gsb], ['Subgrade', 500, 12, C.sub]];
  let y = y0, body = '';
  L.forEach(([name, th, w, col], i) => {
    const h = hy(th), half = (w / 2) * sx, slope = i === 3 ? 12 : 4;
    body += `<path d="M${cx - half} ${y} L${cx + half} ${y} L${cx + half + slope} ${y + h} L${cx - half - slope} ${y + h} Z" fill="${col}" stroke="#00000055"/>`;
    body += `<line x1="${cx + half + slope / 2}" y1="${y + h / 2}" x2="${300}" y2="${y + h / 2}" stroke="${C.mute}" stroke-dasharray="2 2"/>` + T(304, y + h / 2 + 3.5, `${name} · ${th} mm`, { fs: 10.5 });
    if (i === 0) body += `<line x1="${cx - half}" y1="${y + h + 0.5}" x2="${cx + half}" y2="${y + h + 0.5}" stroke="#e8f0f4" stroke-width="1.6"/>`;
    y += h;
  });
  body += `<path d="M${cx - ROAD.width / 2 * sx} ${y0} L${cx - 6.2 * sx} ${y0 + 4} L${cx - 6.6 * sx} ${y} L${cx - ROAD.width / 2 * sx} ${y} Z" fill="#7a6e60" opacity=".55"/><path d="M${cx + ROAD.width / 2 * sx} ${y0} L${cx + 6.2 * sx} ${y0 + 4} L${cx + 6.6 * sx} ${y} L${cx + ROAD.width / 2 * sx} ${y} Z" fill="#7a6e60" opacity=".55"/>`;
  body += T(cx - 5.4 * sx, y0 - 4, 'shoulder', { a: 'middle', c: C.mute, fs: 9.5 }) + T(cx + 5.4 * sx, y0 - 4, 'shoulder', { a: 'middle', c: C.mute, fs: 9.5 });
  body += `<line x1="${cx}" y1="${y0 - 14}" x2="${cx}" y2="${y0 + hy(t)}" stroke="${C.acc}" stroke-dasharray="3 2"/>` + T(cx + 4, y0 - 6, 'longitudinal joint', { c: C.acc, fs: 9.5 });
  body += dimH(cx - ROAD.width / 2 * sx, cx + ROAD.width / 2 * sx, y0 - 18, `carriageway ${ROAD.width} m (2 × 3.75 m), paved in one pass`);
  body += T(6, y + 18, 'Vertical scale exaggerated ×4.5. Separation membrane (125 µm polythene) between DLC and PQC.', { c: C.mute, fs: 9.5 });
  return svg(W + 120, y + 26, body, 'Typical cross-section');
}

const mark = (x, y, n) => `<circle cx="${x}" cy="${y}" r="8" fill="${C.acc}" stroke="#10141a" stroke-width="1.5"/>${T(x, y + 3.6, n, { a: 'middle', c: '#2a1c00', fs: 10, w: 800 })}`;
const legend = (x, y, items) => items.map((s, i) => `${mark(x + 8, y + i * 17, i + 1)}${T(x + 22, y + i * 17 + 3.8, s, { fs: 10.5 })}`).join('');

export function transverseJoint(t) {
  const d = dowelFor(t), s = 0.4, W = 480, mid = 250, top = 40, h = t * s, span = (d.L / 2 + 150) * s;
  const cut = Math.round(t / 4), cut3 = Math.round(t / 3), g = 2.2;
  let b = T(16, 20, 'Transverse contraction joint, every 4.5 m', { w: 700, fs: 12 });
  b += `<rect x="${mid - span}" y="${top + h}" width="${span * 2}" height="${110 * s}" fill="${C.dlc}"/><rect x="${mid - span}" y="${top}" width="${span * 2}" height="${h}" fill="${C.pqc}"/>`;
  b += `<line x1="${mid - span}" y1="${top + h}" x2="${mid + span}" y2="${top + h}" stroke="#e8f0f4" stroke-width="2.4"/>`;
  const gw = 10 * s * g, gd = 25 * s * g;
  b += `<rect x="${mid - gw / 2}" y="${top}" width="${gw}" height="${gd}" fill="#1b1f24"/><rect x="${mid - gw / 2}" y="${top + 4 * s * g}" width="${gw}" height="${gd * 0.55}" fill="${C.seal}" stroke="#444"/><circle cx="${mid}" cy="${top + gd * 0.82}" r="${gw / 2}" fill="${C.back}"/>`;
  b += `<rect x="${mid - 1.5}" y="${top + gd}" width="3" height="${Math.max(2, cut * s - gd)}" fill="#1b1f24"/>`;
  let crack = `M${mid} ${top + cut * s}`; for (let y = top + cut * s, k = 0; y < top + h; y += 7, k++) crack += ` L${mid + (k % 2 ? 2.5 : -2.5)} ${Math.min(top + h, y + 7)}`;
  b += `<path d="${crack}" stroke="#333" fill="none" stroke-width="1.2"/>`;
  const dy = top + h / 2, dh = Math.max(6, d.d * s), dl = d.L * s;
  b += `<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#555" stroke-width="2"/></pattern></defs>`;
  b += `<rect x="${mid - dl / 2}" y="${dy - dh / 2}" width="${dl}" height="${dh}" rx="2" fill="${C.steel}" stroke="#666"/><rect x="${mid}" y="${dy - dh / 2}" width="${dl / 2}" height="${dh}" fill="url(#hatch)" opacity=".75"/>`;
  b += dimV(mid - span - 10, top, top + h, `t = ${t}`, false) + dimV(mid + span + 10, top, dy, 't/2');
  b += mark(mid - 22, top + 4, 1) + mark(mid + 22, top + gd * 0.8, 2) + mark(mid - 18, top + cut * s + 10, 3) + mark(mid + 14, top + h - 14, 4) + mark(mid - dl / 4, dy - dh / 2 - 12, 5) + mark(mid + dl / 4, dy - dh / 2 - 12, 6) + mark(mid + span - 20, top + h + 12, 7);
  const ly = top + h + 110 * s + 18;
  b += legend(16, ly, ['Sealant (polysulphide / silicone), recessed ≈3–5 mm', 'Backer rod in a groove widened to ≈10 × 25 mm', `Initial saw cut 3–5 mm wide, depth ¼–⅓ t (${cut}–${cut3} mm)`, 'Crack forms below the cut, over the dowels', `Dowel Ø${d.d} × ${d.L} mm @ ${d.s} mm c/c, plain steel, at mid-depth`, 'Debonded half: coated so the slab can slide', 'Separation membrane on the DLC']);
  return svg(W, ly + 7 * 17, b, 'Transverse contraction joint');
}

export function longitudinalJoint(t) {
  const s = 0.4, W = 480, mid = 250, top = 40, h = t * s, span = (TIEBAR.L / 2 + 160) * s, cut = Math.round(t / 3);
  let b = T(16, 20, 'Longitudinal joint, along the centre line', { w: 700, fs: 12 });
  b += `<rect x="${mid - span}" y="${top + h}" width="${span * 2}" height="${110 * s}" fill="${C.dlc}"/><rect x="${mid - span}" y="${top}" width="${span * 2}" height="${h}" fill="${C.pqc}"/>`;
  b += `<line x1="${mid - span}" y1="${top + h}" x2="${mid + span}" y2="${top + h}" stroke="#e8f0f4" stroke-width="2.4"/>`;
  b += `<rect x="${mid - 4}" y="${top}" width="8" height="${18 * s * 2}" fill="${C.seal}"/><rect x="${mid - 1.4}" y="${top}" width="2.8" height="${cut * s}" fill="#1b1f24"/>`;
  let crack = `M${mid} ${top + cut * s}`; for (let y = top + cut * s, k = 0; y < top + h; y += 7, k++) crack += ` L${mid + (k % 2 ? 2.5 : -2.5)} ${Math.min(top + h, y + 7)}`;
  b += `<path d="${crack}" stroke="#333" fill="none" stroke-width="1.2"/>`;
  const dy = top + h / 2, dl = TIEBAR.L * s;
  b += `<rect x="${mid - dl / 2}" y="${dy - 3}" width="${dl}" height="6" fill="#8d4a2a"/>`;
  for (let x = mid - dl / 2 + 3; x < mid + dl / 2; x += 6) b += `<line x1="${x}" y1="${dy - 3.5}" x2="${x + 2}" y2="${dy + 3.5}" stroke="#5a2e19" stroke-width="1.2"/>`;
  b += dimV(mid - span - 10, top, top + h, `t = ${t}`, false);
  b += mark(mid - 16, top + 6, 1) + mark(mid + 14, top + cut * s - 4, 2) + mark(mid - dl / 2 + 20, dy - 14, 3) + mark(mid - 14, top + h - 14, 4);
  const ly = top + h + 110 * s + 18;
  b += legend(16, ly, ['Sealant in a narrow groove', `Saw cut to ⅓ t ≈ ${cut} mm`, `Tie bar Ø${TIEBAR.d} mm deformed × ${TIEBAR.L} mm @ ${TIEBAR.s} mm c/c (typical), at mid-depth`, 'Crack forms below the cut; the tie bars hold the lanes together']);
  return svg(W, ly + 4 * 17, b, 'Longitudinal joint');
}

export function panelPlan(t) {
  const d = dowelFor(t), sx = 46, W = 480, x0 = 34, y0 = 48, len = 2 * ROAD.jointSpacing;
  let b = `<rect x="${x0}" y="${y0}" width="${len * sx}" height="${ROAD.width * sx * 0.5}" fill="${C.pqc}"/>`;
  const sy = sx * 0.5, H = ROAD.width * sy;
  for (const x of [0, ROAD.jointSpacing, len]) b += `<line x1="${x0 + x * sx}" y1="${y0}" x2="${x0 + x * sx}" y2="${y0 + H}" stroke="#222" stroke-width="2"/>`;
  b += `<line x1="${x0}" y1="${y0 + H / 2}" x2="${x0 + len * sx}" y2="${y0 + H / 2}" stroke="#222" stroke-width="1.5" stroke-dasharray="6 3"/>`;
  for (const x of [0, ROAD.jointSpacing, len]) for (let z = d.s / 2000; z < ROAD.width; z += d.s / 1000) b += `<line x1="${x0 + x * sx - (d.L / 2000) * sx}" y1="${y0 + z * sy}" x2="${x0 + x * sx + (d.L / 2000) * sx}" y2="${y0 + z * sy}" stroke="#6d7680" stroke-width="2"/>`;
  for (let x = 0.3; x < len; x += TIEBAR.s / 1000) b += `<line x1="${x0 + x * sx}" y1="${y0 + H / 2 - (TIEBAR.L / 2000) * sy}" x2="${x0 + x * sx}" y2="${y0 + H / 2 + (TIEBAR.L / 2000) * sy}" stroke="#8d4a2a" stroke-width="2"/>`;
  b += dimH(x0 + ROAD.jointSpacing * sx, x0 + len * sx, y0 - 10, `${ROAD.jointSpacing} m joint spacing`);
  b += T(x0, y0 + H + 16, `${Math.round(ROAD.width * 1000 / d.s)} dowels per joint · tie bars @ ${TIEBAR.s} mm on the centre line · lane 3.75 m`, { fs: 10, c: C.mute });
  b += T(16, 20, 'Plan of two slab panels', { w: 700, fs: 12 });
  return svg(W, y0 + H + 24, b, 'Slab plan');
}
