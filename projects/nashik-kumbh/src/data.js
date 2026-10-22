/**
 * Kumbh City — stylised geography of Nashik for the Simhastha, plus scenarios and the
 * planning catalogue. Coordinates are metres: x east, z south, origin at Ramkund.
 * The layout keeps the real relationships (Ramkund and Kalaram in Panchavati on the
 * north bank, old Nashik across the Holkar bridge, Tapovan at the Kapila sangam
 * downstream, Nashik Road and Dasak to the south-east) but it is not a survey.
 */

// ── the Godavari and the Kapila ──
export const RIVER = [[-5600, -980], [-4400, -1020], [-3400, -930], [-2600, -850], [-1800, -660], [-1100, -440], [-600, -270], [-250, -120], [0, -40], [300, -15], [700, 10], [1100, 25], [1500, 15], [1900, -10], [2400, 60], [3000, 340], [3600, 840], [4150, 1440], [4700, 1950], [5300, 2350], [6000, 2700], [7200, 3150]];
export const RIVER_W = 64;
export const KAPILA = [[1900, -10], [1860, -500], [1760, -1100], [1700, -1800], [1550, -2600], [1350, -3600], [1200, -4800]];
export const KAPILA_W = 22;

/** Densified polyline with arc length, tangent and normal (normal points to the south bank). */
export function polyline(pts, step = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) { const t = k / n; out.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t }); }
  }
  out.push({ x: pts.at(-1)[0], z: pts.at(-1)[1] });
  // smooth corners (Chaikin-like relaxation) and compute frames
  for (let it = 0; it < 6; it++) for (let i = 1; i < out.length - 1; i++) { out[i].x = (out[i - 1].x + 2 * out[i].x + out[i + 1].x) / 4; out[i].z = (out[i - 1].z + 2 * out[i].z + out[i + 1].z) / 4; }
  let s = 0;
  for (let i = 0; i < out.length; i++) {
    if (i) s += Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z);
    const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    out[i].s = s; out[i].tx = (b.x - a.x) / L; out[i].tz = (b.z - a.z) / L; out[i].nx = -out[i].tz; out[i].nz = out[i].tx;
  }
  return out;
}
export const RIVER_PTS = polyline(RIVER);
export const KAPILA_PTS = polyline(KAPILA);
/** Nearest point on the river to (x, z). */
export function nearestOn(pts, x, z) {
  let best = pts[0], bd = Infinity;
  for (const p of pts) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = p; } }
  return { p: best, d: Math.sqrt(bd) };
}
export function riverDist(x, z) { return Math.min(nearestOn(RIVER_PTS, x, z).d - RIVER_W / 2, nearestOn(KAPILA_PTS, x, z).d - KAPILA_W / 2); }

// ── ghats: placed on a bank of the river at the point nearest to x ──
// side -1 = north bank (Panchavati / Tapovan), +1 = south bank (old Nashik / Dasak)
// F = frontage in metres (bathing steps along the water); max = how far it can be extended
export const GHATS = [
  { id: 'G_RAM', name: 'Ramkund', mr: 'रामकुंड', x: 0, side: -1, F: 140, max: 200, sacred: true, desc: 'The most sacred bathing place. The akharas bathe here on Amrit Snan days.' },
  { id: 'G_LAX', name: 'Laxmankund', mr: 'लक्ष्मणकुंड', x: 230, side: -1, F: 80, max: 180, sacred: true, desc: 'Next to Ramkund, part of the same ghat complex.' },
  { id: 'G_GAD', name: 'Gadge Maharaj ghat', mr: 'गाडगे महाराज घाट', x: -330, side: -1, F: 110, max: 260, sacred: true, desc: 'Upstream of Ramkund towards the Holkar bridge.' },
  { id: 'G_GODA', name: 'Goda ghat (old Nashik)', mr: 'गोदा घाट', x: -180, side: 1, F: 90, max: 240, desc: 'South-bank steps facing Ramkund, reached from Sardar Chowk.' },
  { id: 'G_GWD', name: 'Ganeshwadi ghat', mr: 'गणेशवाडी घाट', x: 700, side: -1, F: 160, max: 520, desc: 'Downstream of Laxmankund on the Panchavati bank.' },
  { id: 'G_KAP', name: 'Kapila sangam', mr: 'कपिला संगम', x: 1720, side: -1, F: 140, max: 480, desc: 'Where the Kapila meets the Godavari at Tapovan.' },
  { id: 'G_TAP', name: 'Tapovan ghats', mr: 'तपोवन घाट', x: 2450, side: -1, F: 200, max: 1100, desc: 'Long new ghats beside the Sadhugram.' },
  { id: 'G_DAS', name: 'Dasak ghat', mr: 'दसक घाट', x: 4450, side: 1, F: 220, max: 1000, desc: 'Near Nashik Road, convenient for rail pilgrims.' },
  { id: 'G_SOM', name: 'Someshwar ghat', mr: 'सोमेश्वर घाट', x: -2550, side: 1, F: 0, max: 700, cand: 'someshwar', desc: 'Upstream site. Needs new ghats and the Gangapur Road access.' },
];
/** Bathing rate: people per metre of frontage per hour (steps, a dip and climbing out). */
export const DIP_RATE = 60;
export const DIP_MIN = 12;
export function ghatPos(g) {
  let p = RIVER_PTS[0]; for (const q of RIVER_PTS) if (Math.abs(q.x - g.x) < Math.abs(p.x - g.x)) p = q;
  const off = RIVER_W / 2 + 22;
  return { x: p.x + p.nx * off * g.side, z: p.z + p.nz * off * g.side, tx: p.tx, tz: p.tz, nx: p.nx * g.side, nz: p.nz * g.side, bx: p.x + p.nx * (RIVER_W / 2) * g.side, bz: p.z + p.nz * (RIVER_W / 2) * g.side };
}

// ── pedestrian network ──
// kinds: tp (shuttle transfer point / entry to the walking zone), j (junction), ghat, temple, hub
export const NODES = {
  TP_W: { name: 'Ravivar Karanja TP', mr: 'रविवार कारंजा', x: -1350, z: 760, kind: 'tp', area: 26000 },
  TP_N: { name: 'Peth Naka TP', mr: 'पेठ नाका', x: 120, z: -1650, kind: 'tp', area: 26000 },
  TP_T: { name: 'Tapovan TP', mr: 'तपोवन', x: 2650, z: -1050, kind: 'tp', area: 30000 },
  TP_D: { name: 'Dwarka TP', mr: 'द्वारका', x: 1150, z: 1550, kind: 'tp', area: 26000 },
  TP_R: { name: 'Dasak TP', mr: 'दसक', x: 4250, z: 2550, kind: 'tp', area: 22000 },
  J_RAV: { name: 'Ravivar Karanja', x: -760, z: 470, kind: 'j', area: 2400 },
  J_SAR: { name: 'Sardar Chowk', x: -170, z: 250, kind: 'j', area: 1800 },
  J_RKS: { name: 'Ramkund footbridge (south)', x: 40, z: 45, kind: 'j', area: 700 },
  J_HOLS: { name: 'Holkar bridge (south)', x: -560, z: -150, kind: 'j', area: 1500 },
  J_HOLN: { name: 'Holkar bridge (north)', x: -620, z: -380, kind: 'j', area: 1500 },
  J_MAL: { name: 'Malegaon Stand', x: -520, z: -820, kind: 'j', area: 2200 },
  J_PAN: { name: 'Panchavati Karanja', x: 160, z: -900, kind: 'j', area: 2400 },
  J_KAL: { name: 'Kalaram Mandir', mr: 'काळाराम मंदिर', x: 320, z: -430, kind: 'temple', area: 3000 },
  J_TAP: { name: 'Tapovan Road', x: 1250, z: -520, kind: 'j', area: 2000 },
  J_AMR: { name: 'Amardham Road', x: 520, z: 420, kind: 'j', area: 1800 },
  J_DAS: { name: 'Jail Road', x: 4700, z: 2350, kind: 'j', area: 1500 },
  J_TS: { name: 'Tapovan south bank', x: 1700, z: 300, kind: 'j', area: 1500, cand: 'tapovanBridge' },
  J_GPR: { name: 'Gangapur Road', x: -2150, z: -250, kind: 'j', area: 1500, cand: 'someshwar' },
};
for (const g of GHATS) { const p = ghatPos(g); NODES[g.id] = { name: g.name, mr: g.mr, x: p.x, z: p.z, kind: 'ghat', area: 0, cand: g.cand }; }

/** [a, b, width m, one-way (1 = a→b only, -1 = b→a only, 0 = both) when circulation is one-way, name, extra] */
export const LINKS_DEF = [
  ['TP_W', 'J_RAV', 14, 1, 'Main Road'],
  ['J_RAV', 'J_SAR', 10, 1, 'Main Road'],
  ['J_SAR', 'J_RKS', 9, 1, 'Ramkund approach'],
  ['J_RKS', 'G_RAM', 6, 1, 'Ramkund footbridge', { bridge: true, widen: 'footbridge' }],
  ['J_SAR', 'G_GODA', 8, 0, 'Goda ghat lane'],
  ['G_GODA', 'J_HOLS', 10, 0, 'Ganga ghat road'],
  ['J_HOLS', 'J_HOLN', 12, -1, 'Ahilyabai Holkar bridge', { bridge: true }],
  ['J_HOLS', 'TP_W', 12, 1, 'Ganga ghat road'],
  ['G_RAM', 'G_LAX', 12, 0, 'Ramkund ghats'],
  ['G_RAM', 'G_GAD', 9, 1, 'Riverside walk'],
  ['G_GAD', 'J_HOLN', 10, 1, 'Gadge Maharaj road'],
  ['J_HOLN', 'J_MAL', 12, 1, 'Malegaon Stand road'],
  ['J_MAL', 'TP_N', 12, 1, 'Malegaon road'],
  ['TP_N', 'J_PAN', 14, 1, 'Peth Road'],
  ['J_PAN', 'J_KAL', 9, 1, 'Kalaram Road', { widen: 'kalaram' }],
  ['J_KAL', 'G_RAM', 8, 1, 'Kapaleshwar lane'],
  ['J_KAL', 'G_LAX', 8, 0, 'Sita Gufa lane'],
  ['G_LAX', 'G_GWD', 10, 0, 'Ganeshwadi riverside'],
  ['G_GWD', 'J_TAP', 10, 1, 'Ganeshwadi road'],
  ['J_PAN', 'J_TAP', 12, 0, 'Tapovan Road'],
  ['J_TAP', 'TP_T', 14, 0, 'Tapovan Road', { bridge: 'kapila' }],
  ['J_TAP', 'G_KAP', 10, 1, 'Kapila sangam road'],
  ['G_KAP', 'G_TAP', 10, 1, 'Tapovan riverside', { bridge: 'kapila' }],
  ['G_TAP', 'TP_T', 12, 1, 'Tapovan exit road'],
  ['TP_D', 'J_SAR', 12, 1, 'Kathe Galli road'],
  ['G_LAX', 'J_AMR', 7, 1, 'Laxmankund footbridge', { bridge: true }],
  ['J_AMR', 'TP_D', 14, 1, 'Amardham Road'],
  ['TP_R', 'G_DAS', 16, 1, 'Dasak ghat road'],
  ['G_DAS', 'J_DAS', 12, 1, 'Dasak riverside'],
  ['J_DAS', 'TP_R', 12, 1, 'Jail Road'],
  ['J_AMR', 'J_TS', 10, 0, 'South bank road', { cand: 'tapovanBridge' }],
  ['J_TS', 'G_KAP', 8, 0, 'Tapovan pontoon bridge', { cand: 'tapovanBridge', bridge: true, pontoon: true }],
  ['TP_W', 'J_GPR', 12, 0, 'Gangapur Road', { cand: 'someshwar' }],
  ['J_GPR', 'G_SOM', 10, 0, 'Someshwar ghat road', { cand: 'someshwar' }],
];

// ── roads, parking hubs and stations ──
export const HUBS = {
  H_MUM: { name: 'Mumbai Naka hub', sub: 'Vilholi · Mumbai–Agra highway', x: -4700, z: 2700, cap: 22000, share: 0.22 },
  H_TRI: { name: 'Trimbak Road hub', sub: 'Satpur', x: -4800, z: -250, cap: 14000, share: 0.13 },
  H_DIN: { name: 'Dindori Road hub', sub: 'Mhasrul', x: 300, z: -4300, cap: 14000, share: 0.12 },
  H_AUR: { name: 'Aurangabad Road hub', sub: 'Adgaon', x: 5600, z: -1250, cap: 16000, share: 0.13 },
  H_PUN: { name: 'Pune Road hub', sub: 'Shinde', x: 6300, z: 4250, cap: 18000, share: 0.16 },
  H_RLY: { name: 'Nashik Road station', sub: 'Special trains', x: 4400, z: 3950, cap: Infinity, rail: true, share: 0 },
  H_PET: { name: 'Peth Road hub', sub: 'Makhmalabad', x: -2300, z: -3800, cap: 12000, share: 0.08, cand: 'hubPeth' },
  H_GAN: { name: 'Gangapur Road hub', sub: 'Anandvalli', x: -4200, z: -2300, cap: 12000, share: 0.08, cand: 'hubGangapur' },
  H_DEO: { name: 'Deolali station', sub: 'Extra special trains', x: 2300, z: 5300, cap: Infinity, rail: true, share: 0, cand: 'deolali' },
};
export const ROAD_NODES = {
  W_CBS: [-2300, 1200], W_GPR: [-2600, -350], W_DIN: [200, -2900], W_PTH: [-1100, -2500], W_ADG: [4000, -950], W_NRD: [2900, 2300], W_DTB: [1900, 700], W_STN: [4400, 3250],
};
/** Road edges for shuttle buses (pairs of road or hub/TP node ids). */
export const ROADS = [
  ['H_MUM', 'W_CBS', 'Mumbai–Agra highway'], ['W_CBS', 'TP_W', 'Old Agra Road'], ['H_TRI', 'W_GPR', 'Trimbak Road'], ['W_GPR', 'W_CBS', 'Trimbak Road'],
  ['W_GPR', 'W_PTH', 'Gangapur–Peth link'], ['W_PTH', 'TP_N', 'Peth Road'], ['H_DIN', 'W_DIN', 'Dindori Road'], ['W_DIN', 'TP_N', 'Dindori Road'],
  ['TP_N', 'TP_T', 'Aurangabad Naka road'], ['H_AUR', 'W_ADG', 'Aurangabad Road'], ['W_ADG', 'TP_T', 'Aurangabad Road'],
  ['TP_T', 'W_DTB', 'Tapovan bridge road'], ['W_DTB', 'TP_D', 'Dwarka link'], ['TP_W', 'TP_D', 'Trimbak Road – Dwarka'],
  ['TP_D', 'W_NRD', 'Nashik–Pune Road'], ['W_NRD', 'TP_R', 'Nashik–Pune Road'], ['H_PUN', 'TP_R', 'Nashik–Pune Road'],
  ['H_RLY', 'W_STN', 'Station Road'], ['W_STN', 'TP_R', 'Station Road'], ['W_STN', 'W_NRD', 'Bytco link'],
  ['H_PET', 'W_PTH', 'Peth Road'], ['H_GAN', 'W_GPR', 'Gangapur Road'], ['H_DEO', 'W_NRD', 'Deolali Road'],
];
export const BUS_SEATS = 70;    // crush-loaded electric shuttle
export const BUS_KMH = 20;      // shuttle speed with a vehicle-free core
export const BUS_KMH_CARS = 11; // shuttle speed when private cars are allowed into the city
export const TURN_MIN = 6;      // loading and turnaround at each end

// ── the akhara procession on Amrit Snan ──
export const PROCESSION = { nodes: ['TP_T', 'J_TAP', 'J_PAN', 'J_KAL', 'G_RAM'], from: 4.0, march: 4.6, bath: [6.3, 9.0], open: 9.5, akharas: ['Nirmohi Ani', 'Digambar Ani', 'Nirvani Ani'] };
export const SADHUGRAM = { x0: 2000, x1: 3500, z0: -1750, z1: -300 };

// ── scenarios ──
// arrival profile: share of the day's pilgrims arriving in each hour 0..23
const norm = (a) => { const s = a.reduce((x, y) => x + y, 0); return a.map((v) => v / s); };
export const SCENARIOS = {
  normal: { name: 'Normal mela day', mr: 'सामान्य दिवस', crowd: 3, amrit: false, ramkund: 0.55, darshan: 0.45, rail: 0.18, local: 0.25,
    profile: norm([0.2, 0.2, 0.3, 0.6, 1.4, 2.4, 3, 3, 2.6, 2.2, 1.8, 1.4, 1.1, 1, 1, 1.2, 1.6, 2.2, 2.4, 1.6, 0.8, 0.4, 0.2, 0.1]), desc: 'About 3 lakh pilgrims, with a morning peak and an evening Godavari aarti.' },
  parva: { name: 'Parva snan', mr: 'पर्व स्नान', crowd: 15, amrit: false, ramkund: 0.6, darshan: 0.35, rail: 0.22, local: 0.15,
    profile: norm([2, 2.4, 3, 4, 5, 5.4, 5.2, 4.6, 4, 3.4, 2.8, 2.2, 1.8, 1.6, 1.4, 1.2, 1.2, 1.2, 1, 0.8, 0.5, 0.3, 0.2, 0.1]), desc: 'A festival bathing day: about 15 lakh pilgrims, mostly before noon.' },
  amrit: { name: 'Amrit Snan', mr: 'अमृत स्नान', crowd: 40, amrit: true, ramkund: 0.65, darshan: 0.2, rail: 0.25, local: 0.1,
    profile: norm([5, 5.6, 6, 6.2, 6, 5.6, 5, 4.6, 4.4, 4.2, 3.8, 3.2, 2.6, 2.2, 1.8, 1.5, 1.2, 1, 0.8, 0.6, 0.4, 0.3, 0.2, 0.1]), desc: 'The main bathing day: about 40 lakh pilgrims. The three Vaishnav akharas process from Tapovan and bathe at Ramkund at dawn, so the Ramkund complex is closed to the public until 09:30.' },
};
export const AMRIT_DATES = ['2 August 2027', '31 August 2027', '11 September 2027'];

// ── planning catalogue (illustrative costs, ₹ crore) ──
export const PLAN_DEFAULT = {
  ghats: Object.fromEntries(GHATS.map((g) => [g.id, 0])),   // extra frontage added (m)
  buses: 1500, oneWay: false, holding: false, iccc: false, carFree: true,
  toilets: 6000, medical: 40, hubPeth: false, hubGangapur: false, deolali: false, someshwar: false, tapovanBridge: false,
  footbridge: false, kalaram: false, release: false,
};
export const COST = {
  ghatPer50: 2.5, someshwarAccess: 9, bus100: 3.2, oneWay: 4, holding: 14, iccc: 32,
  toilet1000: 5, medical10: 2.5, hubPeth: 11, hubGangapur: 11, deolali: 18, tapovanBridge: 16, footbridge: 14, kalaram: 9, release: 6,
};
export const BUDGET = 600;
export function planCost(P) {
  let c = 0;
  for (const g of GHATS) c += Math.ceil((P.ghats[g.id] || 0) / 50) * COST.ghatPer50;
  if (P.someshwar) c += COST.someshwarAccess;
  c += (P.buses / 100) * COST.bus100;
  for (const k of ['oneWay', 'holding', 'iccc', 'hubPeth', 'hubGangapur', 'deolali', 'tapovanBridge', 'footbridge', 'kalaram', 'release']) if (P[k]) c += COST[k];
  c += (P.toilets / 1000) * COST.toilet1000 + (P.medical / 10) * COST.medical10;
  return c;
}
/** A strong plan for the Amrit Snan, used by the "Suggest a plan" button. */
export const PLAN_GOOD = {
  ghats: { G_RAM: 50, G_LAX: 100, G_GAD: 150, G_GODA: 150, G_GWD: 350, G_KAP: 350, G_TAP: 900, G_DAS: 750, G_SOM: 500 },
  buses: 3600, oneWay: true, holding: true, iccc: true, carFree: true, toilets: 16000, medical: 120,
  hubPeth: true, hubGangapur: true, deolali: true, someshwar: true, tapovanBridge: true, footbridge: true, kalaram: true, release: true,
};

export function rng(seed = 7) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
