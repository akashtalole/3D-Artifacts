/**
 * Maharashtra's power system, simplified. Plant capacities, locations and the network are
 * approximate and illustrative (rounded from public figures of the mid-2020s); costs are
 * indicative variable costs. MERC orders, SLDC reports and the companies' own data govern.
 */

/** Map projection: 1 scene unit = 2 km. */
export const LON0 = 76.7, LAT0 = 18.8;
export const XY = (lat, lon) => [(lon - LON0) * 49.5, -(lat - LAT0) * 55.5];

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
  Koyna: [[17.9, 73.65], [17.55, 73.75], [17.4, 73.78], [17.28, 74.18]],
  Tapi: [[21.25, 77.6], [21.1, 76.7], [21.05, 75.8], [21.15, 75.0], [21.3, 74.3], [21.2, 73.6]],
  Wainganga: [[21.75, 79.65], [21.15, 79.65], [20.6, 79.8], [19.95, 79.8], [19.6, 79.85]],
};

export const OWNERS = {
  mahagenco: { name: 'Mahagenco (MSPGCL)', short: 'Mahagenco', colour: '#f28c28' },
  private: { name: 'Private generators', short: 'Private', colour: '#9aa4b0' },
  central: { name: 'Central sector (NTPC, NPCIL)', short: 'Central', colour: '#3987e5' },
  re: { name: 'Renewable developers', short: 'RE', colour: '#3fcf8e' },
  market: { name: 'Power exchange', short: 'Market', colour: '#c98500' },
};
export const TYPES = {
  coal: { name: 'Coal', colour: '#6b5b4d', co2: 0.95 }, gas: { name: 'Gas', colour: '#d95926', co2: 0.42 }, nuclear: { name: 'Nuclear', colour: '#9085e9', co2: 0 },
  hydro: { name: 'Hydro', colour: '#3987e5', co2: 0 }, psp: { name: 'Pumped storage', colour: '#5fd4ff', co2: 0 }, solar: { name: 'Solar', colour: '#eda100', co2: 0 },
  wind: { name: 'Wind', colour: '#199e70', co2: 0 }, import: { name: 'Central share (outside the state)', colour: '#2a78d6', co2: 0.9 }, market: { name: 'Power exchange', colour: '#e87ba4', co2: 0.7 },
};

/** MSETCL (Mahapareshan) EHV substations used as buses. kv: highest voltage at the node. */
export const BUSES = {
  CHD: { name: 'Chandrapur', lat: 19.95, lon: 79.3, kv: 400 }, KOR: { name: 'Koradi', lat: 21.25, lon: 79.1, kv: 765 }, TIR: { name: 'Tiroda', lat: 21.4, lon: 79.95, kv: 765 },
  AKO: { name: 'Akola', lat: 20.7, lon: 77.0, kv: 765 }, AMR: { name: 'Nandgaonpeth (Amravati)', lat: 20.93, lon: 77.75, kv: 400 }, BHU: { name: 'Bhusawal', lat: 21.05, lon: 75.8, kv: 400 },
  DHU: { name: 'Dhule', lat: 20.9, lon: 74.77, kv: 400 }, AUR: { name: 'Aurangabad (Ektuni)', lat: 19.85, lon: 75.4, kv: 765 }, NSK: { name: 'Babhaleshwar', lat: 19.57, lon: 74.43, kv: 400 },
  PAD: { name: 'Padghe', lat: 19.37, lon: 73.17, kv: 400 }, KAL: { name: 'Kalwa', lat: 19.2, lon: 73.0, kv: 400 }, MUM: { name: 'Trombay (Mumbai)', lat: 19.0, lon: 72.9, kv: 220 },
  TAR: { name: 'Boisar (Tarapur)', lat: 19.8, lon: 72.75, kv: 400 }, PUN: { name: 'Lonikand (Pune)', lat: 18.62, lon: 74.03, kv: 765 }, KAR: { name: 'Karad (Koyna)', lat: 17.3, lon: 74.18, kv: 400 },
  KOL: { name: 'Kolhapur', lat: 16.7, lon: 74.25, kv: 400 }, JAI: { name: 'Jaigad', lat: 17.3, lon: 73.22, kv: 400 }, SOL: { name: 'Solapur', lat: 17.6, lon: 75.9, kv: 765 },
  PAR: { name: 'Parli', lat: 18.85, lon: 76.53, kv: 400 }, NAN: { name: 'Nanded', lat: 19.15, lon: 77.3, kv: 400 },
  X: { name: 'National grid', lat: 23, lon: 77, kv: 765, ext: true },
};
/** Lines: [from, to, kV, MW rating, circuits]. HVDC is a controlled link, set separately. Ties go to the national grid at a border point. */
export const LINES = [
  ['TIR', 'KOR', 765, 4000, 1], ['KOR', 'AKO', 765, 4000, 1], ['AKO', 'AUR', 765, 4000, 1], ['AUR', 'PUN', 765, 4000, 1], ['AUR', 'SOL', 765, 4000, 1], ['SOL', 'PUN', 765, 4000, 1],
  ['CHD', 'KOR', 400, 1000, 2], ['TIR', 'CHD', 400, 1000, 1], ['CHD', 'NAN', 400, 1000, 2], ['NAN', 'PAR', 400, 1000, 1], ['KOR', 'AMR', 400, 1000, 2], ['AMR', 'AKO', 400, 1000, 2],
  ['AKO', 'BHU', 400, 1000, 2], ['BHU', 'AUR', 400, 1000, 2], ['BHU', 'DHU', 400, 1000, 2], ['DHU', 'NSK', 400, 1000, 2], ['NSK', 'PAD', 400, 1000, 2], ['NSK', 'AUR', 400, 1000, 2],
  ['AUR', 'PAR', 400, 1000, 2], ['PAR', 'SOL', 400, 1000, 2], ['PAR', 'PUN', 400, 1000, 2], ['PUN', 'KAL', 400, 1000, 2], ['PUN', 'KAR', 400, 1000, 2], ['KAR', 'KOL', 400, 1000, 2],
  ['KAR', 'JAI', 400, 1000, 2], ['JAI', 'KAL', 400, 1000, 2], ['PAD', 'KAL', 400, 1500, 4], ['KAL', 'MUM', 220, 1200, 4], ['TAR', 'PAD', 400, 1000, 2], ['TAR', 'KAL', 400, 1000, 2],
  ['SOL', 'KOL', 400, 1000, 1], ['NSK', 'PUN', 400, 1000, 2],
  ['TAR', 'X', 400, 1500, 2, 'Gujarat', 20.25, 72.85], ['DHU', 'X', 400, 1500, 2, 'Gujarat', 21.45, 73.85], ['BHU', 'X', 400, 1500, 2, 'Madhya Pradesh', 21.62, 76.3],
  ['KOR', 'X', 765, 4000, 1, 'Madhya Pradesh', 21.7, 78.95], ['TIR', 'X', 765, 4000, 1, 'Chhattisgarh', 21.4, 80.65], ['CHD', 'X', 400, 1500, 2, 'Telangana', 19.4, 79.15],
  ['KOL', 'X', 400, 1500, 2, 'Karnataka', 16.2, 74.6], ['SOL', 'X', 765, 4000, 1, 'Karnataka', 17.2, 76.2],
];
export const HVDC = { from: 'CHD', to: 'PAD', name: 'Chandrapur–Padghe HVDC', kv: '±500 kV', mw: 1500 };

/** Generating stations. unit = size of the largest unit (MW), min = minimum technical load, ramp = fraction of capacity per 15-min block. */
export const PLANTS = [
  { id: 'chandrapur', name: 'Chandrapur STPS', owner: 'mahagenco', type: 'coal', cap: 2920, unit: 500, cost: 3.0, bus: 'CHD', lat: 19.98, lon: 79.25 },
  { id: 'koradi', name: 'Koradi TPS', owner: 'mahagenco', type: 'coal', cap: 2190, unit: 660, cost: 3.2, bus: 'KOR', lat: 21.25, lon: 79.08 },
  { id: 'khaperkheda', name: 'Khaperkheda TPS', owner: 'mahagenco', type: 'coal', cap: 1340, unit: 500, cost: 3.45, bus: 'KOR', lat: 21.33, lon: 79.2 },
  { id: 'bhusawal', name: 'Bhusawal TPS', owner: 'mahagenco', type: 'coal', cap: 1210, unit: 500, cost: 3.8, bus: 'BHU', lat: 21.0, lon: 75.85 },
  { id: 'parli', name: 'Parli TPS', owner: 'mahagenco', type: 'coal', cap: 750, unit: 250, cost: 4.1, bus: 'PAR', lat: 18.88, lon: 76.56 },
  { id: 'nashik', name: 'Nashik TPS (Eklahare)', owner: 'mahagenco', type: 'coal', cap: 630, unit: 210, cost: 4.3, bus: 'NSK', lat: 19.97, lon: 73.88 },
  { id: 'paras', name: 'Paras TPS', owner: 'mahagenco', type: 'coal', cap: 500, unit: 250, cost: 3.6, bus: 'AKO', lat: 20.72, lon: 76.78 },
  { id: 'uran', name: 'Uran Gas', owner: 'mahagenco', type: 'gas', cap: 672, unit: 120, cost: 5.6, bus: 'KAL', lat: 18.88, lon: 72.95, avail: 0.4 },
  { id: 'koyna', name: 'Koyna Hydro', owner: 'mahagenco', type: 'hydro', cap: 1956, unit: 250, cost: 0.8, bus: 'KAR', lat: 17.4, lon: 73.75 },
  { id: 'ghatghar', name: 'Ghatghar Pumped Storage', owner: 'mahagenco', type: 'psp', cap: 250, unit: 125, cost: 0, bus: 'PAD', lat: 19.5, lon: 73.68 },
  { id: 'sakri', name: 'Sakri Solar', owner: 'mahagenco', type: 'solar', cap: 125, unit: 125, cost: 2.6, bus: 'DHU', lat: 21.0, lon: 74.3 },
  { id: 'tiroda', name: 'Tiroda (Adani)', owner: 'private', type: 'coal', cap: 3300, unit: 660, cost: 2.95, bus: 'TIR', lat: 21.42, lon: 79.98 },
  { id: 'jsw', name: 'Ratnagiri (JSW)', owner: 'private', type: 'coal', cap: 1200, unit: 300, cost: 4.7, bus: 'JAI', lat: 17.28, lon: 73.2 },
  { id: 'amravati', name: 'Amravati (RattanIndia)', owner: 'private', type: 'coal', cap: 1350, unit: 270, cost: 3.6, bus: 'AMR', lat: 20.95, lon: 77.78 },
  { id: 'dahanu', name: 'Dahanu (Adani)', owner: 'private', type: 'coal', cap: 500, unit: 250, cost: 4.0, bus: 'TAR', lat: 19.95, lon: 72.76 },
  { id: 'trombay', name: 'Trombay (Tata Power)', owner: 'private', type: 'coal', cap: 930, unit: 500, cost: 5.0, bus: 'MUM', lat: 19.0, lon: 72.92 },
  { id: 'tatahydro', name: 'Bhira–Khopoli–Bhivpuri (Tata)', owner: 'private', type: 'hydro', cap: 447, unit: 150, cost: 0.9, bus: 'KAL', lat: 18.75, lon: 73.35 },
  { id: 'mauda', name: 'Mauda (NTPC)', owner: 'central', type: 'coal', cap: 2320, unit: 660, cost: 3.4, bus: 'KOR', lat: 21.17, lon: 79.43 },
  { id: 'solapur', name: 'Solapur (NTPC)', owner: 'central', type: 'coal', cap: 1320, unit: 660, cost: 3.75, bus: 'SOL', lat: 17.55, lon: 75.98 },
  { id: 'tarapur', name: 'Tarapur Atomic (NPCIL)', owner: 'central', type: 'nuclear', cap: 1400, unit: 540, cost: 3.0, bus: 'TAR', lat: 19.83, lon: 72.66 },
  { id: 'windS', name: 'Wind: Satara–Sangli', owner: 're', type: 'wind', cap: 2600, unit: 50, cost: 3.1, bus: 'KAR', lat: 17.6, lon: 74.0 },
  { id: 'windN', name: 'Wind: Dhule–Ahmednagar', owner: 're', type: 'wind', cap: 2600, unit: 50, cost: 3.1, bus: 'DHU', lat: 21.15, lon: 74.15 },
  { id: 'solarM', name: 'Solar: Marathwada parks', owner: 're', type: 'solar', cap: 3500, unit: 50, cost: 2.6, bus: 'PAR', lat: 18.55, lon: 76.1 },
  { id: 'solarW', name: 'Solar: Solapur–Ahmednagar', owner: 're', type: 'solar', cap: 3000, unit: 50, cost: 2.6, bus: 'SOL', lat: 18.0, lon: 75.2 },
  { id: 'mskvy', name: 'MSKVY 2.0 agri-feeder solar', owner: 're', type: 'solar', cap: 4000, unit: 5, cost: 3.1, bus: 'AUR', lat: 19.6, lon: 76.2, mskvy: true },
  { id: 'rooftop', name: 'Rooftop solar (cities)', owner: 're', type: 'solar', cap: 2500, unit: 1, cost: 0, bus: 'PUN', lat: 18.52, lon: 73.86, rooftop: true },
];
/** Power bought from outside: the state's share of central stations elsewhere, and the exchange. */
export const IMPORTS = { central: { cap: 7500, min: 0.55, cost: 3.5 }, market: { cap: 4000 } };

/** MSEDCL (Mahavitaran) circles grouped into load zones, plus the Mumbai licensees. share of state demand; ag = share that is farm pumping. */
export const ZONES = [
  { id: 'mumbai', name: 'Mumbai (BEST, Tata, Adani)', share: 0.13, bus: 'MUM', ag: 0, lat: 19.05, lon: 72.88, msedcl: false },
  { id: 'thane', name: 'Thane–Navi Mumbai–Kalyan', share: 0.12, bus: 'KAL', ag: 0.02, lat: 19.22, lon: 73.12 },
  { id: 'konkan', name: 'Palghar–Konkan', share: 0.04, bus: 'TAR', ag: 0.05, lat: 19.7, lon: 72.9 },
  { id: 'pune', name: 'Pune', share: 0.14, bus: 'PUN', ag: 0.12, lat: 18.52, lon: 73.86 },
  { id: 'nashik', name: 'Nashik', share: 0.08, bus: 'NSK', ag: 0.35, lat: 20.0, lon: 73.78 },
  { id: 'khandesh', name: 'Jalgaon–Dhule–Nandurbar', share: 0.05, bus: 'BHU', ag: 0.4, lat: 21.0, lon: 75.56 },
  { id: 'aurangabad', name: 'Chh. Sambhajinagar–Jalna', share: 0.07, bus: 'AUR', ag: 0.3, lat: 19.88, lon: 75.34 },
  { id: 'latur', name: 'Latur–Beed–Dharashiv', share: 0.05, bus: 'PAR', ag: 0.45, lat: 18.4, lon: 76.57 },
  { id: 'nanded', name: 'Nanded–Parbhani–Hingoli', share: 0.04, bus: 'NAN', ag: 0.42, lat: 19.15, lon: 77.31 },
  { id: 'solapur', name: 'Solapur', share: 0.05, bus: 'SOL', ag: 0.45, lat: 17.66, lon: 75.91 },
  { id: 'kolhapur', name: 'Kolhapur–Sangli–Satara', share: 0.08, bus: 'KOL', ag: 0.38, lat: 16.7, lon: 74.24 },
  { id: 'amravati', name: 'Amravati–Akola–Yavatmal', share: 0.05, bus: 'AKO', ag: 0.38, lat: 20.93, lon: 77.75 },
  { id: 'nagpur', name: 'Nagpur–Wardha–Gondia', share: 0.07, bus: 'KOR', ag: 0.2, lat: 21.15, lon: 79.09 },
  { id: 'chandrapur', name: 'Chandrapur–Gadchiroli', share: 0.03, bus: 'CHD', ag: 0.15, lat: 19.96, lon: 79.3 },
];

export const SEASONS = {
  summer: { name: 'Summer (May)', peak: 29500, wind: 0.22, solar: 0.78, cloud: 0.05, hydroMWh: 7000, icon: '☀️', rise: 6.0, set: 19.0, tOut: 34 },
  monsoon: { name: 'Monsoon (August)', peak: 23500, wind: 0.62, solar: 0.42, cloud: 0.55, hydroMWh: 30000, icon: '🌧️', rise: 6.2, set: 18.9, tOut: 26 },
  winter: { name: 'Winter (December)', peak: 27000, wind: 0.15, solar: 0.72, cloud: 0.05, hydroMWh: 12000, icon: '🌤️', rise: 6.9, set: 18.0, tOut: 22 },
};

export const SCENARIOS = [
  { id: 'heat', name: 'Heatwave', what: 'Air-conditioning pushes demand up 8% through the afternoon and evening.' },
  { id: 'mskvy', name: 'Solar agri feeders (MSKVY 2.0)', what: 'Farm pumps move from night rotation to daytime, fed by 4,000 MW of solar near substations.', on: true },
  { id: 'trip', name: 'Trip a 660 MW unit at Koradi', what: 'A unit trips. Frequency dips; Maharashtra overdraws until SLDC re-dispatches.' },
  { id: 'hvdc', name: 'HVDC Chandrapur–Padghe outage', what: 'The 1,500 MW DC link trips. Power reroutes over the AC corridor.' },
  { id: 'line', name: 'Trip Aurangabad–Pune 765 kV', what: 'The main east-to-west 765 kV line trips.' },
  { id: 'coal', name: 'Coal shortage at Chandrapur', what: 'Stocks run low; the station is held to 60% of capacity.' },
  { id: 'clouds', name: 'Cloud bank over Marathwada', what: 'Solar output in the east drops by 70% for the afternoon.' },
];

export const fmtMW = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)} GW` : `${Math.round(v)} MW`);
export const inr = (v) => `₹${Math.round(v).toLocaleString('en-IN')}`;
export const crore = (v) => `₹${(v / 1e7).toFixed(2)} cr`;
