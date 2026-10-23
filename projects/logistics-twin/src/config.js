/** Parameters, scenarios and master data (illustrative). */
export const DESTS = [
  { name: 'Mumbai', km: 35, share: 0.28, color: '#ff6b5b' }, { name: 'Pune', km: 150, share: 0.17, color: '#ffb020' },
  { name: 'Nashik', km: 150, share: 0.08, color: '#ffd23f' }, { name: 'Surat', km: 255, share: 0.10, color: '#3fcf8e' },
  { name: 'Ahmedabad', km: 520, share: 0.12, color: '#2fd0d0' }, { name: 'Goa', km: 570, share: 0.07, color: '#41b6ff' },
  { name: 'Indore', km: 590, share: 0.08, color: '#a77bff' }, { name: 'Hyderabad', km: 710, share: 0.10, color: '#ff6bc6' },
];
export const CATS = [
  { name: 'Electronics', color: '#4f8dff' }, { name: 'Home & kitchen', color: '#ff9f43' }, { name: 'Fashion', color: '#ff6b9a' },
  { name: 'Beauty', color: '#c77dff' }, { name: 'Books', color: '#3fcf8e' }, { name: 'Toys', color: '#ffd23f' },
  { name: 'Grocery', color: '#9bd14b' }, { name: 'Sports', color: '#2fd0d0' },
];
export const CARRIERS = ['Konkan Roadways', 'Deccan Express Cargo', 'WestLine Freight', 'Sahyadri Movers', 'Narmada Logistics', 'Arabian Sea Carriers'];

/** Order arrival profile by hour of day (multiplies the hourly rate; averages ≈ 1). */
export const HOURLY = [0.35, 0.25, 0.2, 0.2, 0.25, 0.45, 0.7, 0.95, 1.15, 1.3, 1.4, 1.45, 1.45, 1.35, 1.3, 1.3, 1.35, 1.4, 1.45, 1.5, 1.45, 1.2, 0.9, 0.55];

export const DEFAULTS = {
  ordersPerHour: 220,   // average customer orders per hour
  amrs: 12, forklifts: 4, packStations: 5,
  pickMode: 'single', batch: 3,
  slotting: 'abc',
  inboundPerHour: 0.9, palletsPerTruck: 16, inboundDoors: 6,
  slaHours: 4, truckCap: 220,
};
export const LIMITS = {
  ordersPerHour: [40, 900, 10], amrs: [2, 60, 1], forklifts: [1, 12, 1], packStations: [1, 12, 1],
  batch: [2, 6, 1], inboundPerHour: [0.2, 3, 0.05], palletsPerTruck: [8, 26, 1], inboundDoors: [1, 8, 1], slaHours: [2, 12, 1],
};
export const SCENARIOS = {
  normal: { name: 'Normal weekday', desc: 'Steady demand of ~220 orders/hour with 12 AMRs and 5 pack stations.', p: {} },
  festive: { name: 'Festive sale peak', desc: 'Sale-day demand at 2.6× with the normal crew — watch the backlog grow and find the bottleneck.', p: { ordersPerHour: 570, inboundPerHour: 2.2 } },
  scaled: { name: 'Festive peak, scaled up', desc: 'Same 2.6× demand with 30 AMRs on batch picking, 12 pack stations and 7 forklifts.', p: { ordersPerHour: 570, amrs: 30, packStations: 12, forklifts: 7, pickMode: 'batch', batch: 3, inboundPerHour: 2.2, inboundDoors: 8 } },
  docks: { name: 'Dock disruption', desc: 'Only 1 inbound door is open while full 26-pallet trucks keep arriving — trucks queue in the yard and wait for hours.', p: { inboundDoors: 1, inboundPerHour: 1.5, palletsPerTruck: 26 } },
  random: { name: 'Random slotting', desc: 'Fast movers scattered across the pick zone instead of placed near packing — compare robot travel per order.', p: { slotting: 'random' } },
};
/** Illustrative costs in ₹ per hour. */
export const COST = { amr: 180, picker: 210, packer: 220, forklift: 520, dockCrew: 420, fixed: 9500 };

export function rng(seed = 7) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ADJ = ['Smart', 'Classic', 'Eco', 'Pro', 'Mini', 'Ultra', 'Daily', 'Prime', 'Royal', 'Swift'];
const NOUN = { Electronics: ['earbuds', 'charger', 'power bank', 'smart bulb', 'speaker', 'keyboard'], 'Home & kitchen': ['pressure cooker', 'tawa', 'mixer jar', 'bedsheet', 'lamp', 'storage box'], Fashion: ['kurta', 'sneakers', 'saree', 'backpack', 'jeans', 'watch'], Beauty: ['face wash', 'kajal', 'shampoo', 'perfume', 'lip balm', 'sunscreen'], Books: ['novel', 'cookbook', 'exam guide', 'comic', 'atlas', 'diary'], Toys: ['puzzle', 'cricket set', 'RC car', 'blocks', 'board game', 'doll'], Grocery: ['basmati rice', 'tea', 'ghee', 'dry fruits', 'spice kit', 'coffee'], Sports: ['yoga mat', 'football', 'dumbbells', 'bottle', 'badminton set', 'skipping rope'] };
/** 480 SKUs with Pareto-like demand. */
export function makeSkus(n, rand) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const cat = Math.floor(rand() * CATS.length), cn = CATS[cat].name;
    const w = 1 / Math.pow(i + 1, 0.95); sum += w;
    out.push({ id: i, code: `SKU-${String(10001 + i)}`, name: `${ADJ[Math.floor(rand() * ADJ.length)]} ${NOUN[cn][Math.floor(rand() * 6)]}`, cat, w });
  }
  let acc = 0;
  for (const s of out) { s.w /= sum; acc += s.w; s.cum = acc; s.cls = acc <= 0.8 ? 'A' : acc <= 0.95 ? 'B' : 'C'; }
  return out;
}
