/**
 * Maharashtra's forests and an illustrative pipeline of industrial projects.
 *
 * The 2021 baseline is calibrated to the Forest Survey of India's India State of Forest Report
 * 2021 totals for Maharashtra (forest cover about 50,800 km², 16.5% of 307,713 km²: very dense
 * 8,734, moderately dense 20,589, open 21,475 km²). Where the forest lies is a smoothed sketch of
 * the main forest tracts, not the FSI map. The projects are illustrative types placed in real
 * forest regions; they are not a record of actual proposals or approvals. Growth, degradation
 * and plantation rates are assumptions for the scenarios.
 */

/** Map projection: 1 scene unit = 2 km (shared with Urja Maharashtra). */
export const LON0 = 76.7, LAT0 = 18.8;
export const XY = (lat, lon) => [(lon - LON0) * 49.5, -(lat - LAT0) * 55.5];
export const AREA_KM2 = 307713;
export const FSI2021 = { vdf: 8734, mdf: 20589, of: 21475 };

/** State outline, approximate (lat, lon), clockwise from the Gujarat coast. */
export const OUTLINE = [
  [20.14, 72.74], [20.55, 73.2], [20.95, 73.45], [21.3, 73.8], [21.75, 74.05], [22.03, 74.3], [21.8, 74.9], [21.55, 75.4], [21.4, 75.95],
  [21.55, 76.4], [21.65, 76.9], [21.4, 77.25], [21.75, 77.5], [21.9, 78.1], [21.55, 78.45], [21.7, 78.95], [21.55, 79.3], [21.75, 79.8],
  [21.65, 80.3], [21.35, 80.7], [20.95, 80.55], [20.45, 80.45], [20.05, 80.8], [19.55, 80.9], [19.05, 80.5], [18.75, 80.2], [18.8, 79.9],
  [19.15, 79.45], [19.5, 79.05], [19.75, 78.4], [19.55, 77.95], [19.1, 77.7], [18.85, 77.45], [18.4, 77.55], [18.05, 77.15], [17.7, 76.9],
  [17.35, 76.5], [17.15, 75.85], [16.75, 75.5], [16.45, 75.0], [16.3, 74.6], [15.9, 74.4], [15.62, 74.15], [15.7, 73.85], [16.2, 73.45],
  [16.8, 73.3], [17.4, 73.15], [18.0, 72.95], [18.5, 72.85], [18.95, 72.8], [19.4, 72.8], [19.85, 72.7],
];
export const NEIGHBOURS = [['Gujarat', 21.2, 73.0], ['Madhya Pradesh', 22.4, 77.2], ['Chhattisgarh', 21.4, 81.4], ['Telangana', 18.3, 79.0], ['Karnataka', 16.4, 76.4], ['Goa', 15.3, 74.0], ['Arabian Sea', 18.0, 71.6]];
export const RIVERS = {
  Godavari: [[19.95, 73.53], [19.85, 74.3], [19.55, 75.0], [19.45, 75.7], [19.25, 76.3], [19.1, 77.0], [19.15, 77.6], [18.95, 78.6], [18.8, 79.9]],
  Krishna: [[17.98, 73.67], [17.6, 73.9], [17.3, 74.2], [16.85, 74.6], [16.6, 75.0]],
  Tapi: [[21.25, 77.6], [21.1, 76.7], [21.05, 75.8], [21.15, 75.0], [21.3, 74.3], [21.2, 73.6]],
  Wainganga: [[21.75, 79.65], [21.15, 79.65], [20.6, 79.8], [19.95, 79.8], [19.6, 79.85]],
  Indravati: [[19.25, 80.9], [19.05, 80.6], [18.85, 80.3]],
};

/**
 * Forest tracts as soft blobs (lat, lon, radius km, intensity 0–1) and bands along a line
 * (the Sahyadri). Intensity drives both the share of land under forest and its density.
 */
export const TRACTS = [
  { name: 'Gadchiroli', b: [[19.75, 80.2, 62, 0.95], [19.2, 80.35, 55, 0.9], [20.35, 80.1, 35, 0.8]] },
  { name: 'Chandrapur–Tadoba', b: [[20.25, 79.38, 32, 0.95], [19.65, 79.5, 38, 0.75], [19.95, 79.0, 25, 0.5]] },
  { name: 'Gondia–Bhandara', b: [[21.05, 80.1, 30, 0.9], [21.3, 80.4, 25, 0.75], [20.85, 79.95, 22, 0.6]] },
  { name: 'Nagpur (Pench, Umred)', b: [[21.62, 79.3, 22, 0.85], [20.85, 79.35, 16, 0.75]] },
  { name: 'Melghat', b: [[21.45, 77.2, 34, 0.95], [21.55, 77.7, 20, 0.6]] },
  { name: 'Yavatmal–Kinwat', b: [[20.0, 78.3, 26, 0.6], [19.55, 78.1, 20, 0.6], [20.35, 78.95, 16, 0.5], [20.95, 78.65, 14, 0.7]] },
  { name: 'Satpura (Nandurbar–Jalgaon)', b: [[21.75, 74.3, 28, 0.75], [21.35, 75.9, 20, 0.65], [21.55, 74.9, 18, 0.5]] },
  { name: 'Nashik–Thane–Palghar', b: [[20.35, 73.6, 26, 0.65], [19.85, 73.2, 38, 0.75], [19.22, 72.91, 7, 0.85]] },
  { name: 'Konkan mangroves', b: [[19.05, 72.98, 6, 0.6], [18.6, 73.0, 6, 0.45], [17.0, 73.3, 5, 0.45], [16.2, 73.45, 5, 0.45]] },
];
/** The Sahyadri forest band: points along the crest, half-width km, intensity. */
export const GHATS = [[20.1, 73.55, 14, 0.6], [19.7, 73.58, 14, 0.7], [19.07, 73.53, 15, 0.8], [18.45, 73.43, 15, 0.75], [17.9, 73.65, 15, 0.7], [17.35, 73.75, 18, 0.9], [16.9, 73.82, 16, 0.75], [16.4, 73.98, 16, 0.85], [15.85, 74.1, 15, 0.85]];

export const DIVISIONS = [
  { id: 'konkan', name: 'Konkan', lat: 18.6, lon: 73.2 }, { id: 'pune', name: 'Pune', lat: 17.9, lon: 74.7 }, { id: 'nashik', name: 'Nashik', lat: 20.6, lon: 74.6 },
  { id: 'aurangabad', name: 'Chh. Sambhajinagar', lat: 19.0, lon: 76.2 }, { id: 'amravati', name: 'Amravati', lat: 20.6, lon: 77.5 }, { id: 'nagpur', name: 'Nagpur', lat: 20.4, lon: 79.6 },
];

/** Tiger reserves (approximate centres, km radius) and the corridors that link forest blocks. */
export const RESERVES = [
  { id: 'tadoba', name: 'Tadoba-Andhari TR', lat: 20.25, lon: 79.38, r: 24 }, { id: 'melghat', name: 'Melghat TR', lat: 21.45, lon: 77.2, r: 30 },
  { id: 'pench', name: 'Pench TR', lat: 21.65, lon: 79.3, r: 14 }, { id: 'nnt', name: 'Navegaon-Nagzira TR', lat: 21.05, lon: 80.1, r: 20 },
  { id: 'bor', name: 'Bor TR', lat: 20.97, lon: 78.65, r: 9 }, { id: 'sahyadri', name: 'Sahyadri TR', lat: 17.35, lon: 73.75, r: 22 },
];
export const CORRIDORS = [
  { id: 'tad-pen', name: 'Tadoba–Umred–Pench', pts: [[20.25, 79.38], [20.85, 79.35], [21.35, 79.3], [21.65, 79.3]] },
  { id: 'pen-nnt', name: 'Pench–Nagzira', pts: [[21.65, 79.3], [21.45, 79.7], [21.1, 80.05]] },
  { id: 'tad-bor', name: 'Tadoba–Bor', pts: [[20.25, 79.38], [20.55, 79.0], [20.97, 78.65]] },
  { id: 'tad-gad', name: 'Tadoba–Gadchiroli–Indravati', pts: [[20.25, 79.38], [19.95, 79.75], [19.6, 80.2], [19.25, 80.7]] },
  { id: 'mel-sat', name: 'Melghat–Satpura', pts: [[21.45, 77.2], [21.6, 77.65], [21.85, 78.0]] },
  { id: 'sah-til', name: 'Sahyadri–Radhanagari–Tillari', pts: [[17.35, 73.75], [16.9, 73.82], [16.4, 73.98], [15.85, 74.1]] },
];

/**
 * Illustrative project pipeline. ha = forest land sought. kind: mine, coal, plant, road, rail, dam, estate, port.
 * avoid = what the Avoid & mitigate scenario does with it: drop, shift (to non-forest land), shrink, crossings (wildlife crossings on a linear project).
 */
export const PROJECTS = [
  { id: 'ore1', name: 'Iron-ore mine, Gadchiroli hills', kind: 'mine', year: 2023, ha: 880, lat: 19.55, lon: 80.25, avoid: 'shrink' },
  { id: 'road1', name: 'Expressway, Nagpur–Mumbai corridor', kind: 'road', year: 2022, ha: 1500, path: [[21.1, 79.05], [20.75, 78.6], [20.6, 77.6], [20.2, 77.1], [19.9, 75.4], [19.85, 74.4], [19.7, 73.6], [19.3, 73.2]], avoid: 'crossings' },
  { id: 'metro', name: 'Metro depot and urban expansion, Mumbai', kind: 'estate', year: 2023, ha: 150, lat: 19.16, lon: 72.9, avoid: 'shift' },
  { id: 'coal1', name: 'Open-cast coal mine, Wardha valley', kind: 'coal', year: 2024, ha: 1120, lat: 20.12, lon: 79.12, avoid: 'shrink' },
  { id: 'nh44', name: 'Highway widening through the Pench corridor', kind: 'road', year: 2025, ha: 500, path: [[21.15, 79.08], [21.45, 79.2], [21.75, 79.25]], avoid: 'crossings' },
  { id: 'hsr', name: 'High-speed rail, Thane–Palghar', kind: 'rail', year: 2025, ha: 320, path: [[19.2, 73.0], [19.5, 72.95], [19.95, 72.85], [20.15, 72.85]], avoid: 'crossings' },
  { id: 'ash', name: 'Thermal expansion and ash pond, Chandrapur', kind: 'plant', year: 2026, ha: 750, lat: 19.97, lon: 79.28, avoid: 'shift' },
  { id: 'mel-road', name: 'Highway widening through the Melghat buffer', kind: 'road', year: 2026, ha: 380, path: [[21.2, 77.0], [21.45, 77.3], [21.72, 77.5]], avoid: 'drop' },
  { id: 'ore2', name: 'Iron-ore mine expansion, Gadchiroli', kind: 'mine', year: 2027, ha: 2250, lat: 19.42, lon: 80.4, avoid: 'drop' },
  { id: 'wind', name: 'Wind farm on Satpura hill forest, Nandurbar', kind: 'plant', year: 2027, ha: 620, lat: 21.72, lon: 74.3, avoid: 'shift' },
  { id: 'ring', name: 'Ring road, Pune', kind: 'road', year: 2027, ha: 620, path: [[18.72, 73.72], [18.45, 73.68], [18.35, 73.98], [18.52, 74.2]], avoid: 'crossings' },
  { id: 'lime', name: 'Limestone mine and cement plant, Yavatmal', kind: 'mine', year: 2028, ha: 1250, lat: 19.75, lon: 78.95, avoid: 'shrink' },
  { id: 'gargai', name: 'Water-supply dam for Mumbai, Palghar', kind: 'dam', year: 2028, ha: 2000, lat: 19.75, lon: 73.25, avoid: 'shrink' },
  { id: 'coal2', name: 'Open-cast coal mine near the Tadoba buffer', kind: 'coal', year: 2029, ha: 1750, lat: 20.38, lon: 79.55, avoid: 'drop' },
  { id: 'ghat', name: 'Ghat road and resort, Mahabaleshwar–Koyna', kind: 'road', year: 2029, ha: 300, path: [[17.92, 73.66], [17.65, 73.72], [17.42, 73.76]], avoid: 'crossings' },
  { id: 'steel', name: 'Steel plant and township, Gadchiroli', kind: 'plant', year: 2030, ha: 1500, lat: 19.82, lon: 79.98, avoid: 'shift' },
  { id: 'midc-ngp', name: 'Industrial estate, Nagpur', kind: 'estate', year: 2030, ha: 750, lat: 21.0, lon: 79.25, avoid: 'shift' },
  { id: 'chem', name: 'Chemical industrial estate, Raigad', kind: 'estate', year: 2030, ha: 1000, lat: 18.45, lon: 73.18, avoid: 'shift' },
  { id: 'rail', name: 'Ore railway, Gadchiroli', kind: 'rail', year: 2031, ha: 750, path: [[19.5, 80.3], [19.75, 80.0], [19.95, 79.6]], avoid: 'crossings' },
  { id: 'bauxite', name: 'Bauxite mines, Sindhudurg Sahyadri', kind: 'mine', year: 2031, ha: 1250, lat: 16.2, lon: 73.98, avoid: 'drop' },
  { id: 'port', name: 'Port and logistics hub, Palghar coast', kind: 'port', year: 2032, ha: 1250, lat: 19.95, lon: 72.76, avoid: 'shrink' },
  { id: 'dam-gb', name: 'Irrigation dam, Gondia–Bhandara', kind: 'dam', year: 2033, ha: 2500, lat: 21.25, lon: 80.05, avoid: 'shrink' },
  { id: 'refinery', name: 'Refinery and petrochemical complex, Konkan', kind: 'plant', year: 2035, ha: 3750, lat: 16.95, lon: 73.36, avoid: 'drop' },
  { id: 'dam-mel', name: 'Hydro and irrigation dam, Melghat', kind: 'dam', year: 2036, ha: 3000, lat: 21.33, lon: 77.33, avoid: 'drop' },
];
export const KINDS = {
  mine: { name: 'Mine', colour: '#b5651d' }, coal: { name: 'Coal mine', colour: '#3b3f45' }, plant: { name: 'Industrial plant', colour: '#8f98a3' }, road: { name: 'Road', colour: '#e8c547' },
  rail: { name: 'Railway', colour: '#c58cff' }, dam: { name: 'Dam', colour: '#4aa3df' }, estate: { name: 'Industrial estate', colour: '#d95926' }, port: { name: 'Port', colour: '#5fd4ff' },
};

export const SCENARIOS = {
  bau: { name: 'Business as usual', short: 'As usual', degrade: 0.03, ring: 18, lag: 4, survival: 0.55, caNear: false, barrier: 0.45, extra: 0, what: 'Every project goes ahead as proposed. Compensatory planting comes 4 years later on distant degraded land, and about half survives. Dense forest around each project thins for a decade.' },
  avoid: { name: 'Avoid and mitigate', short: 'Avoid', degrade: 0.008, ring: 10, lag: 1, survival: 0.85, caNear: true, barrier: 0.9, extra: 0, what: 'Projects inside tiger reserves and corridors are dropped or moved to non-forest land, others are shrunk, and linear projects get wildlife crossings. Planting starts at once next to the same forest block.' },
  high: { name: 'High growth', short: 'High growth', degrade: 0.035, ring: 20, lag: 5, survival: 0.5, caNear: false, barrier: 0.4, extra: 1, what: 'The pipeline repeats at 1.3 times the size from 2033, as mining and industry expand. Planting lags and survival are poor.' },
};
export const CARBON = { vdf: 130, mdf: 90, of: 45, young: 20 };   // tC per ha, illustrative
export const fmtKm = (v) => `${Math.round(v).toLocaleString('en-IN')} km²`;
