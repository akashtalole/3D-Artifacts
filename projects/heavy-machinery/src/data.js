/**
 * Portfolio data. Figures are typical of each machine class and are illustrative,
 * not the published specification of any manufacturer's model. Prices are indicative
 * ex-showroom ranges in India (₹ lakh) and vary with configuration, taxes and region.
 */
export const MACHINES = {
  backhoe: {
    name: 'Backhoe Loader', cls: '≈8 t · 55 kW', tag: 'The all-rounder of Indian construction: a loader at the front, an excavator at the back.',
    examples: 'JCB 3DX / 3CX, CAT 424 / 432, Case 770, Mahindra EarthMaster',
    apps: ['Trenching', 'Utilities', 'Road works', 'Loading', 'Site clearing', 'Agriculture'],
    specs: [['Operating weight', '8,070 kg'], ['Engine power', '55 kW (74 hp)'], ['Loader bucket', '1.0 m³'], ['Backhoe dig depth', '4.4 m (5.9 m extended)'], ['Backhoe bucket force', '61 kN'], ['Loader lift capacity', '3,200 kg'], ['Travel speed', '40 km/h'], ['Fuel tank', '160 L']],
    m: { weight: 8.07, power: 55, price: 34, cap: 1.0, speed: 40, fuel: 160, cost: 1900 },
    price: [30, 38], cycle: 20, fuelLph: 6,
  },
  excavator: {
    name: 'Hydraulic Excavator', cls: '≈20 t · 110 kW', tag: 'The workhorse of mass excavation, quarrying and trenching, with 360° swing and a deep reach.',
    examples: 'CAT 320, JCB JS205, Komatsu PC210, Tata Hitachi EX210',
    apps: ['Mass excavation', 'Truck loading', 'Trenching', 'Demolition', 'Quarrying', 'Canals'],
    specs: [['Operating weight', '20,500 kg'], ['Engine power', '110 kW (148 hp)'], ['Bucket', '1.0 m³ (0.8–1.4 m³)'], ['Max dig depth', '6.7 m'], ['Max reach at ground', '9.9 m'], ['Bucket digging force', '140 kN'], ['Swing speed', '11 rpm'], ['Travel speed', '5.5 km/h'], ['Fuel tank', '345 L']],
    m: { weight: 20.5, power: 110, price: 95, cap: 1.0, speed: 5.5, fuel: 345, cost: 4200 },
    price: [85, 110], cycle: 18, fuelLph: 14,
  },
  loader: {
    name: 'Wheel Loader', cls: '≈19 t · 140 kW', tag: 'Fast loading of trucks and hoppers from stockpiles, in quarries, plants and ports.',
    examples: 'CAT 950, JCB 456, Volvo L120, Komatsu WA380',
    apps: ['Truck loading', 'Stockpiling', 'Aggregates', 'Ports', 'Cement and steel plants', 'Snow'],
    specs: [['Operating weight', '18,800 kg'], ['Engine power', '140 kW (188 hp)'], ['Bucket', '3.1 m³ (2.5–4.2 m³)'], ['Rated payload', '5.4 t'], ['Dump clearance', '2.9 m'], ['Breakout force', '155 kN'], ['Articulation', '±40°'], ['Travel speed', '38 km/h'], ['Fuel tank', '290 L']],
    m: { weight: 18.8, power: 140, price: 135, cap: 3.1, speed: 38, fuel: 290, cost: 4800 },
    price: [120, 150], cycle: 32, fuelLph: 16,
  },
  dozer: {
    name: 'Crawler Dozer', cls: '≈20 t · 160 kW', tag: 'Pushes, spreads and rips: the first machine on a new site and the last on a finished grade.',
    examples: 'CAT D6, Komatsu D65, BEML BD155, Shantui SD22',
    apps: ['Bulk earthmoving', 'Spreading fill', 'Ripping', 'Land clearing', 'Mines', 'Dams'],
    specs: [['Operating weight', '20,500 kg'], ['Engine power', '160 kW (215 hp)'], ['Blade', 'Semi-U, 5.6 m³, 3.4 m wide'], ['Ripper depth', '0.5 m'], ['Ground pressure', '0.6 kg/cm²'], ['Drawbar pull', '≈300 kN'], ['Travel speed', '11 km/h'], ['Fuel tank', '380 L']],
    m: { weight: 20.5, power: 160, price: 225, cap: 5.6, speed: 11, fuel: 380, cost: 6200 },
    price: [200, 250], cycle: 60, fuelLph: 22,
  },
  truck: {
    name: 'Rigid Haul Truck', cls: '≈90 t payload · 760 kW', tag: 'Moves overburden and ore in open-pit mines and quarries, at the lowest cost per tonne.',
    examples: 'CAT 777, Komatsu HD785, BEML BH100, Belaz 7557',
    apps: ['Open-pit mining', 'Overburden', 'Quarries', 'Large dams'],
    specs: [['Rated payload', '90 t'], ['Gross machine weight', '163 t'], ['Engine power', '760 kW (1,020 hp)'], ['Body capacity', '60 m³ heaped'], ['Top speed', '64 km/h'], ['Body raise time', '13 s'], ['Tyres', '27.00R49'], ['Fuel tank', '1,140 L']],
    m: { weight: 73, power: 760, price: 1100, cap: 60, speed: 64, fuel: 1140, cost: 21000 },
    price: [1000, 1250], cycle: 0, fuelLph: 70,
  },
  grader: {
    name: 'Motor Grader', cls: '≈16 t · 140 kW', tag: 'Cuts and trims to precise grade for roads, runways and building pads.',
    examples: 'CAT 140, Komatsu GD655, Volvo G940, Mahindra RoadMaster',
    apps: ['Road building', 'Fine grading', 'Ditching', 'Haul-road upkeep', 'Snow clearing'],
    specs: [['Operating weight', '16,000 kg'], ['Engine power', '140 kW (188 hp)'], ['Moldboard', '3.7 m × 0.6 m'], ['Blade angle', '±60° on a 360° circle'], ['Side shift', '±0.6 m'], ['Turning radius', '7.5 m'], ['Travel speed', '45 km/h'], ['Fuel tank', '416 L']],
    m: { weight: 16, power: 140, price: 140, cap: 0, speed: 45, fuel: 416, cost: 4600 },
    price: [125, 160], cycle: 0, fuelLph: 15,
  },
  telehandler: {
    name: 'Telescopic Handler', cls: '3.5 t · 9.5 m', tag: 'A forklift and a crane in one: lifts pallets, blocks and steel to upper floors.',
    examples: 'JCB 535-95, CAT TH357, Manitou MT 933, Genie GTH-3509',
    apps: ['Building sites', 'Material handling', 'Agriculture', 'Industrial plants'],
    specs: [['Max lift capacity', '3,500 kg'], ['Max lift height', '9.5 m'], ['Max forward reach', '6.5 m'], ['Operating weight', '8,000 kg'], ['Engine power', '81 kW (109 hp)'], ['Steering modes', '2-wheel, 4-wheel, crab'], ['Travel speed', '40 km/h'], ['Fuel tank', '120 L']],
    m: { weight: 8, power: 81, price: 60, cap: 3.5, speed: 40, fuel: 120, cost: 2600 },
    price: [55, 66], cycle: 0, fuelLph: 7,
  },
  skid: {
    name: 'Skid Steer Loader', cls: '≈3 t · 55 kW', tag: 'Small, quick and turns on the spot; with 70+ attachments it does far more than load.',
    examples: 'JCB Robot / 155, CAT 226, Bobcat S450, Case SR175',
    apps: ['Landscaping', 'Cleaning', 'Industrial yards', 'Small sites', 'Snow', 'Agriculture'],
    specs: [['Rated operating capacity', '900 kg'], ['Operating weight', '3,200 kg'], ['Engine power', '55 kW (74 hp)'], ['Bucket', '0.45 m³'], ['Hinge-pin height', '3.0 m'], ['Travel speed', '12 km/h'], ['Fuel tank', '95 L']],
    m: { weight: 3.2, power: 55, price: 22, cap: 0.45, speed: 12, fuel: 95, cost: 1300 },
    price: [19, 26], cycle: 25, fuelLph: 5,
  },
};
export const ORDER = ['backhoe', 'excavator', 'loader', 'dozer', 'truck', 'grader', 'telehandler', 'skid'];

export const PAINTS = [
  { id: 'yellow', name: 'Construction yellow', hex: '#f2b705', rim: '#d9a404' },
  { id: 'orange', name: 'Industrial orange', hex: '#ef7d14', rim: '#d16a0c' },
  { id: 'red', name: 'Signal red', hex: '#c4241b', rim: '#9a1c15' },
  { id: 'white', name: 'Fleet white', hex: '#e9ecee', rim: '#b8bec4' },
  { id: 'green', name: 'Forest green', hex: '#3d7a3c', rim: '#e9c21a' },
  { id: 'blue', name: 'Utility blue', hex: '#2a62b8', rim: '#c9ced4' },
  { id: 'graphite', name: 'Graphite', hex: '#4b5057', rim: '#f2b705' },
];
/** options common to every machine; price in ₹ lakh */
export const OPTIONS = [
  { id: 'led', name: 'LED work-light package', price: 0.9, def: true },
  { id: 'beacon', name: 'Rotating beacon', price: 0.15, def: true },
  { id: 'ac', name: 'Air-conditioned cab', price: 1.6, def: false },
  { id: 'telematics', name: 'Telematics: location, hours, fuel and alerts', price: 0.6, def: true },
  { id: 'camera', name: 'Rear and side cameras with object detection', price: 1.1, def: false },
  { id: 'fire', name: 'Fire suppression system', price: 2.4, def: false },
  { id: 'grade', name: 'Grade control (2D/3D GNSS)', price: 9.5, def: false, only: ['excavator', 'dozer', 'grader'] },
  { id: 'payload', name: 'On-board payload weighing', price: 2.8, def: false, only: ['loader', 'truck', 'excavator'] },
  { id: 'warranty', name: 'Extended warranty, 3 years / 6,000 h', price: 2.2, def: false },
];
/** materials for the fleet planner: loose density t/m³ and bucket fill factor */
export const MATERIALS = [
  { id: 'soil', name: 'Common earth', density: 1.6, fill: 1.0, swell: 1.25 },
  { id: 'clay', name: 'Wet clay', density: 1.75, fill: 1.05, swell: 1.3 },
  { id: 'gravel', name: 'Sand and gravel', density: 1.8, fill: 0.95, swell: 1.12 },
  { id: 'rock', name: 'Blasted rock', density: 1.9, fill: 0.75, swell: 1.55 },
];
/** haulers for the fleet planner, including road tippers that have no 3D model */
export const HAULERS = [
  { id: 'tipper', name: 'Road tipper, 16 m³ / 25 t', cap: 16, payload: 25, speed: 30, spot: 40, dump: 60, cost: 1800 },
  { id: 'adt', name: 'Articulated dump truck, 30 t', cap: 18, payload: 30, speed: 25, spot: 30, dump: 45, cost: 6500 },
  { id: 'truck', name: 'Rigid haul truck, 90 t', cap: 60, payload: 90, speed: 28, spot: 45, dump: 70, cost: 21000 },
];
export const fmtL = (lakh) => (lakh >= 100 ? `₹${(lakh / 100).toFixed(lakh >= 1000 ? 1 : 2)} cr` : `₹${lakh.toFixed(lakh < 10 ? 2 : 1)} lakh`);
