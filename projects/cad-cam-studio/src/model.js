/**
 * Document model: stock, machine, features (CAD), tools and operations (CAM).
 * Units: millimetres. Work origin (G54 X0 Y0 Z0) = top, front-left corner of the stock;
 * X to the right, Y away from the operator, Z up (stock spans Z −H … 0).
 */

/** Cutting data: surface speed Vc (m/min) and chip load fz ≈ k·D (mm/tooth), clamped. */
export const MATERIALS = {
  alu: { name: 'Aluminium 6061', vc: 180, fzK: 0.006, fzMin: 0.01, fzMax: 0.08, doc: 0.5, color: '#c9ced6', metal: 0.75, rough: 0.32, density: 2.70 },
  brass: { name: 'Brass C360', vc: 120, fzK: 0.005, fzMin: 0.01, fzMax: 0.06, doc: 0.4, color: '#d6b25a', metal: 0.8, rough: 0.3, density: 8.50 },
  acrylic: { name: 'Acrylic (PMMA)', vc: 250, fzK: 0.010, fzMin: 0.02, fzMax: 0.12, doc: 0.6, color: '#bfe3f2', metal: 0.0, rough: 0.12, density: 1.18 },
  hdpe: { name: 'HDPE', vc: 300, fzK: 0.015, fzMin: 0.03, fzMax: 0.2, doc: 1.0, color: '#ecebe4', metal: 0.0, rough: 0.6, density: 0.95 },
  oak: { name: 'Hardwood (oak)', vc: 400, fzK: 0.020, fzMin: 0.05, fzMax: 0.3, doc: 1.0, color: '#b98a57', metal: 0.0, rough: 0.75, density: 0.75 },
  mdf: { name: 'MDF', vc: 450, fzK: 0.025, fzMin: 0.05, fzMax: 0.35, doc: 1.2, color: '#a98c6a', metal: 0.0, rough: 0.9, density: 0.75 },
};

export const TOOL_TYPES = { flat: 'Flat end mill', ball: 'Ball end mill', drill: 'Twist drill', face: 'Face mill' };
export const DEFAULT_TOOLS = [
  { id: 't1', num: 1, type: 'flat', d: 6, flutes: 3, len: 20, name: '6 mm flat end mill' },
  { id: 't2', num: 2, type: 'flat', d: 3, flutes: 2, len: 12, name: '3 mm flat end mill' },
  { id: 't3', num: 3, type: 'flat', d: 10, flutes: 3, len: 25, name: '10 mm flat end mill' },
  { id: 't4', num: 4, type: 'face', d: 25, flutes: 3, len: 10, name: '25 mm face mill' },
  { id: 't5', num: 5, type: 'drill', d: 4.2, flutes: 2, len: 40, name: '4.2 mm drill (M5 tap)' },
  { id: 't6', num: 6, type: 'drill', d: 5, flutes: 2, len: 45, name: '5 mm drill' },
  { id: 't7', num: 7, type: 'drill', d: 8, flutes: 2, len: 55, name: '8 mm drill' },
];

/** Spindle speed, feed, plunge feed, default stepdown and stepover for a tool in a material. */
export function cutting(tool, materialId, machine) {
  const m = MATERIALS[materialId] || MATERIALS.alu;
  const rpm = Math.round(Math.min(machine.maxRpm, (m.vc * 1000) / (Math.PI * tool.d)) / 100) * 100;
  const fz = Math.min(m.fzMax, Math.max(m.fzMin, m.fzK * tool.d)) * (tool.type === 'face' ? 0.8 : 1);
  const feed = Math.round(rpm * tool.flutes * fz);
  return {
    rpm, feed,
    plunge: Math.round(tool.type === 'drill' ? rpm * fz * 1.5 : feed / 3),
    stepdown: +(tool.d * m.doc * (tool.type === 'face' ? 0.1 : 1)).toFixed(2),
    stepover: tool.type === 'face' ? 70 : 40,
  };
}

// ── Feature definitions (CAD) ───────────────────────────────────────────────
// Field: [key, label, kind ('mm' | 'deg' | 'int' | 'bool' | select array), showIf?]
export const FEATURES = {
  face: { label: 'Facing', icon: '▤', fields: [['depth', 'Depth', 'mm']] },
  rectPocket: { label: 'Rectangular pocket', icon: '▭', fields: [['cx', 'Centre X', 'mm'], ['cy', 'Centre Y', 'mm'], ['w', 'Width (X)', 'mm'], ['h', 'Length (Y)', 'mm'], ['r', 'Corner radius', 'mm'], ['depth', 'Depth', 'mm']] },
  circPocket: { label: 'Circular pocket', icon: '◯', fields: [['cx', 'Centre X', 'mm'], ['cy', 'Centre Y', 'mm'], ['d', 'Diameter', 'mm'], ['depth', 'Depth', 'mm']] },
  slot: { label: 'Slot', icon: '⊂⊃', fields: [['cx', 'Centre X', 'mm'], ['cy', 'Centre Y', 'mm'], ['len', 'Overall length', 'mm'], ['width', 'Width', 'mm'], ['angle', 'Angle', 'deg'], ['depth', 'Depth', 'mm']] },
  holes: {
    label: 'Holes', icon: '⊙',
    fields: [['d', 'Diameter', 'mm'], ['through', 'Through all', 'bool'], ['depth', 'Depth', 'mm', (f) => !f.through], ['pattern', 'Pattern', ['single', 'grid', 'circle']],
      ['cx', 'Centre X', 'mm'], ['cy', 'Centre Y', 'mm'],
      ['nx', 'Count X', 'int', (f) => f.pattern === 'grid'], ['ny', 'Count Y', 'int', (f) => f.pattern === 'grid'], ['px', 'Pitch X', 'mm', (f) => f.pattern === 'grid'], ['py', 'Pitch Y', 'mm', (f) => f.pattern === 'grid'],
      ['count', 'Count', 'int', (f) => f.pattern === 'circle'], ['radius', 'Circle radius', 'mm', (f) => f.pattern === 'circle'], ['angle0', 'Start angle', 'deg', (f) => f.pattern === 'circle']],
  },
  profile: {
    label: 'Outside profile', icon: '⬚',
    fields: [['shape', 'Shape', ['rect', 'circle']], ['cx', 'Centre X', 'mm'], ['cy', 'Centre Y', 'mm'],
      ['w', 'Width (X)', 'mm', (f) => f.shape === 'rect'], ['h', 'Length (Y)', 'mm', (f) => f.shape === 'rect'], ['r', 'Corner radius', 'mm', (f) => f.shape === 'rect'],
      ['d', 'Diameter', 'mm', (f) => f.shape === 'circle'], ['through', 'Cut through', 'bool'], ['depth', 'Depth', 'mm', (f) => !f.through]],
  },
};

export function newFeature(type, stock) {
  const cx = +(stock.w / 2).toFixed(1), cy = +(stock.d / 2).toFixed(1);
  const base = {
    face: { depth: 0.5 },
    rectPocket: { cx, cy, w: Math.round(stock.w * 0.4), h: Math.round(stock.d * 0.4), r: 4, depth: Math.min(5, stock.h / 2) },
    circPocket: { cx, cy, d: Math.round(Math.min(stock.w, stock.d) * 0.3), depth: Math.min(5, stock.h / 2) },
    slot: { cx, cy, len: Math.round(stock.w * 0.3), width: 6.5, angle: 0, depth: Math.min(3, stock.h / 3) },
    holes: { d: 5, through: true, depth: stock.h, pattern: 'grid', cx, cy, nx: 2, ny: 2, px: Math.round(stock.w * 0.75), py: Math.round(stock.d * 0.7), count: 6, radius: 15, angle0: 0 },
    profile: { shape: 'rect', cx, cy, w: stock.w - 4, h: stock.d - 4, r: 6, d: Math.min(stock.w, stock.d) - 4, through: true, depth: stock.h },
  }[type];
  return { id: uid('f'), type, name: FEATURES[type].label, visible: true, ...base };
}

let n = 0;
export const uid = (p) => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;

/** Hole centres for a holes feature. */
export function holeCentres(f) {
  if (f.pattern === 'grid') {
    const out = [];
    for (let i = 0; i < f.nx; i++) for (let j = 0; j < f.ny; j++) out.push([f.cx + (i - (f.nx - 1) / 2) * f.px, f.cy + (j - (f.ny - 1) / 2) * f.py]);
    return out;
  }
  if (f.pattern === 'circle') {
    return Array.from({ length: Math.max(1, f.count | 0) }, (_, i) => {
      const a = ((f.angle0 || 0) + (360 * i) / Math.max(1, f.count)) * Math.PI / 180;
      return [f.cx + Math.cos(a) * f.radius, f.cy + Math.sin(a) * f.radius];
    });
  }
  return [[f.cx, f.cy]];
}
export const featureDepth = (f, stock) => ((f.type === 'holes' || f.type === 'profile') && f.through ? stock.h : f.depth);

// ── Operations (CAM) ───────────────────────────────────────────────────────
const OP_FOR = { face: 'face', rectPocket: 'pocket', circPocket: 'pocket', slot: 'slot', holes: 'drill', profile: 'profile' };
export const OP_LABEL = { face: 'Face', pocket: 'Pocket', slot: 'Slot', drill: 'Drill', bore: 'Helical bore', profile: 'Profile' };
const OP_ORDER = { face: 0, pocket: 1, slot: 2, drill: 3, bore: 3, profile: 4 };

function pickTool(doc, f) {
  const flats = doc.tools.filter((t) => t.type === 'flat').sort((a, b) => b.d - a.d);
  const smallest = flats.at(-1);
  if (f.type === 'face') return doc.tools.find((t) => t.type === 'face' && t.d < Math.min(doc.stock.w, doc.stock.d)) || flats[0];
  if (f.type === 'rectPocket') return flats.find((t) => t.d <= Math.min(f.w, f.h) / 2.5 && t.d <= 2 * Math.max(f.r, 1.5) + 0.01) || flats.find((t) => t.d <= Math.min(f.w, f.h) / 2.5) || smallest;
  if (f.type === 'circPocket') return flats.find((t) => t.d <= f.d / 2.5) || smallest;
  if (f.type === 'slot') return flats.find((t) => t.d <= f.width + 0.01) || smallest;
  if (f.type === 'holes') return doc.tools.find((t) => t.type === 'drill' && Math.abs(t.d - f.d) < 0.05) || flats.find((t) => t.d <= f.d * 0.8) || smallest;
  if (f.type === 'profile') return flats.find((t) => t.d === 6) || flats[0];
  return flats[0];
}
/** Keep one operation per feature: add missing ones with sensible defaults, drop orphans. */
export function syncOps(doc) {
  const ids = new Set(doc.features.map((f) => f.id));
  doc.ops = doc.ops.filter((o) => ids.has(o.featureId));
  for (const o of doc.ops) if (!doc.tools.some((t) => t.id === o.toolId)) o.toolId = pickTool(doc, doc.features.find((f) => f.id === o.featureId)).id;
  for (const f of doc.features) {
    if (doc.ops.some((o) => o.featureId === f.id)) continue;
    const tool = pickTool(doc, f);
    const type = OP_FOR[f.type] === 'drill' && tool.type !== 'drill' ? 'bore' : OP_FOR[f.type];
    const cd = cutting(tool, doc.stock.material, doc.machine);
    doc.ops.push({
      id: uid('o'), featureId: f.id, type, toolId: tool.id, enabled: true,
      strategy: 'offset', stepover: cd.stepover, stepdown: cd.stepdown, rpm: null, feed: null,
      tabs: f.type === 'profile' ? 4 : 0, tabW: 6, tabH: 1.5, peck: +(tool.d).toFixed(1),
    });
  }
  // drill ↔ bore follows the chosen tool
  for (const o of doc.ops) {
    const t = doc.tools.find((x) => x.id === o.toolId);
    if (o.type === 'drill' && t.type !== 'drill') o.type = 'bore';
    if (o.type === 'bore' && t.type === 'drill') o.type = 'drill';
  }
  doc.ops.sort((a, b) => OP_ORDER[a.type] - OP_ORDER[b.type] || doc.features.findIndex((f) => f.id === a.featureId) - doc.features.findIndex((f) => f.id === b.featureId));
  return doc;
}

// ── Samples ────────────────────────────────────────────────────────────────
const F = (type, props) => ({ id: uid('f'), type, name: FEATURES[type].label, visible: true, ...props });
export function sampleDoc(which = 'plate') {
  const machine = { name: 'Desktop VMC (GRBL)', maxRpm: 24000, rapid: 5000, safeZ: 5, toolChange: 15 };
  if (which === 'coaster') {
    return syncOps({
      name: 'Oak coaster', stock: { w: 100, d: 100, h: 10, material: 'oak' }, machine, tools: structuredClone(DEFAULT_TOOLS), ops: [],
      features: [
        F('circPocket', { name: 'Cup recess', cx: 50, cy: 50, d: 80, depth: 3 }),
        F('circPocket', { name: 'Centre dimple', cx: 50, cy: 50, d: 24, depth: 4.5 }),
        F('slot', { name: 'Groove A', cx: 50, cy: 50, len: 60, width: 3.2, angle: 45, depth: 4 }),
        F('slot', { name: 'Groove B', cx: 50, cy: 50, len: 60, width: 3.2, angle: -45, depth: 4 }),
        F('profile', { name: 'Outline', shape: 'circle', cx: 50, cy: 50, w: 96, h: 96, r: 8, d: 94, through: true, depth: 10 }),
      ],
    });
  }
  return syncOps({
    name: 'Motor mounting plate', stock: { w: 120, d: 80, h: 12, material: 'alu' }, machine, tools: structuredClone(DEFAULT_TOOLS), ops: [],
    features: [
      F('face', { name: 'Face top', depth: 0.5 }),
      F('rectPocket', { name: 'Motor pocket', cx: 60, cy: 40, w: 64, h: 40, r: 6, depth: 5 }),
      F('circPocket', { name: 'Bearing bore', cx: 60, cy: 40, d: 22, depth: 9 }),
      F('holes', { name: 'M5 bolt circle', d: 4.2, through: true, depth: 12, pattern: 'circle', cx: 60, cy: 40, count: 6, radius: 15.5, angle0: 0, nx: 2, ny: 2, px: 96, py: 56 }),
      F('holes', { name: 'Mounting holes', d: 6.6, through: true, depth: 12, pattern: 'grid', cx: 60, cy: 40, nx: 2, ny: 2, px: 96, py: 56, count: 4, radius: 20, angle0: 0 }),
      F('slot', { name: 'Cable slot', cx: 60, cy: 70, len: 40, width: 6.5, angle: 0, depth: 3 }),
      F('profile', { name: 'Outline', shape: 'rect', cx: 60, cy: 40, w: 116, h: 76, r: 8, d: 70, through: true, depth: 12 }),
    ],
  });
}
