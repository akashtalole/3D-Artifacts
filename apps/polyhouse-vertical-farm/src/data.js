/**
 * Facilities, crops, seasons, faults and costs. Figures are typical of Indian
 * protected cultivation and published controlled-environment-agriculture practice;
 * they are illustrative. Crop advisories, makers' data and the scheme guidelines govern.
 */

/** Polyhouse: a naturally ventilated polyhouse (NVPH) with a fan-and-pad wall. */
export const PH = {
  bays: 3, bay: 8, len: 40, span: 4, gutter: 4.5, ridge: 6.6, beds: 12,
  area: 3 * 8 * 40, vol: 3 * 8 * 40 * 5.2,
  fans: 6, fanFlow: 30000, fanKW: 1.1, padPumpKW: 0.75, fogKW: 2.2, dripKW: 3.7,
  cover: '200 µm UV-stabilised polythene', net: '40-mesh insect net', screen: '50% aluminised shade screen',
};

/** Vertical farm: an insulated indoor room with NFT racks under LEDs. */
export const VF = {
  racks: 4, tiers: 6, len: 16, width: 1.2, channels: 6, holes: 64,
  get area() { return this.racks * this.tiers * this.len * this.width; },
  efficacy: 2.8, hvacKW: 60, cop: 3.2, dehumKW: 4, pumpKW: 1.5, fansKW: 2,
};

export const SEASONS = {
  summer: { name: 'Summer (April)', tmean: 30.5, amp: 8, rh: 34, g: 960, cloud: 0.06, wind: 3.2, rise: 6.1, set: 18.9, icon: '☀️' },
  monsoon: { name: 'Monsoon (July)', tmean: 25, amp: 3, rh: 86, g: 880, cloud: 0.6, wind: 5.5, rise: 6.1, set: 19.2, icon: '🌧️' },
  winter: { name: 'Winter (December)', tmean: 21, amp: 9, rh: 55, g: 760, cloud: 0.05, wind: 2, rise: 7.0, set: 18.1, icon: '🌤️' },
};

/**
 * Polyhouse crops. day/night = air temperature band (°C), vpd = band (kPa), theta = substrate
 * moisture band (% vol), ec/ph = drip feed. yield = kg/m²/yr typical in a well-run NVPH.
 */
export const PH_CROPS = {
  capsicum: { name: 'Coloured capsicum', day: [21, 27], night: [16, 20], vpd: [0.7, 1.2], theta: [28, 38], ec: 2.4, ph: 6.0, yield: 9, price: 110, h: 1.9, fruit: ['#d61f1f', '#f2c40c'], spacing: 0.45, disease: 'Powdery mildew', dur: '9–10 months' },
  tomato: { name: 'Indeterminate tomato', day: [20, 27], night: [15, 18], vpd: [0.8, 1.3], theta: [28, 38], ec: 2.8, ph: 6.0, yield: 14, price: 22, h: 3.2, fruit: ['#d8321e', '#e8572a'], spacing: 0.5, disease: 'Late blight', dur: '8–9 months' },
  cucumber: { name: 'Parthenocarpic cucumber', day: [22, 28], night: [17, 20], vpd: [0.6, 1.1], theta: [30, 40], ec: 2.0, ph: 6.0, yield: 15, price: 20, h: 2.4, fruit: ['#3e7d2a', '#4c8f33'], spacing: 0.45, disease: 'Downy mildew', dur: '3 crops a year' },
};

/** Vertical-farm crops. ppfd µmol/m²/s, photo h/day, days transplant → harvest, g = harvest fresh weight per plant. */
export const VF_CROPS = {
  lettuce: { name: 'Butterhead lettuce', ppfd: 230, photo: 16, days: 28, g: 150, temp: [20, 23], rh: [60, 75], ec: 1.6, ph: 6.0, co2: 1000, price: 220, colour: '#7cc04a', disorder: 'Tipburn' },
  basil: { name: 'Genovese basil', ppfd: 260, photo: 16, days: 24, g: 60, temp: [22, 26], rh: [55, 70], ec: 1.8, ph: 6.0, co2: 1000, price: 450, colour: '#2f8f3a', disorder: 'Downy mildew' },
  spinach: { name: 'Baby spinach', ppfd: 200, photo: 14, days: 21, g: 40, temp: [18, 22], rh: [60, 75], ec: 1.8, ph: 6.2, co2: 900, price: 260, colour: '#2f6f2f', disorder: 'Leaf yellowing' },
};

/** Maharashtra-style time-of-day tariff, ₹/kWh (illustrative). */
export const TARIFF = (h) => (h >= 22 || h < 6 ? 6.6 : h >= 9 && h < 12 ? 8.6 : h >= 18 && h < 22 ? 8.9 : 8.1);
export const WATER_COST = 0.02;   // ₹ per litre, pumped from a borewell or farm pond

export const FAULTS = {
  ph: [
    { id: 'pad', name: 'Pad pump failure', what: 'The pad wall stops getting water, so the fans pull in hot dry air.' },
    { id: 'drift', name: 'Sensor drift (TH-3)', what: 'Climate node TH-3 starts reading 3 °C high.' },
    { id: 'clog', name: 'Clogged drippers, bed 7', what: 'Emitters on bed 7 deliver only a third of the water.' },
    { id: 'ec', name: 'Dosing pump B stuck', what: 'Fertigation over-doses stock B and the feed EC climbs.' },
    { id: 'gateway', name: 'Gateway offline', what: 'The LoRaWAN gateway loses its uplink. Control falls back to the edge controller.' },
    { id: 'disease', name: 'Disease outbreak', what: 'Infection starts in a corner of the house and spreads if missed.' },
  ],
  vf: [
    { id: 'hvac', name: 'HVAC compressor trip', what: 'Cooling stops while the LEDs keep heating the room.' },
    { id: 'pump', name: 'NFT pump failure', what: 'Rack 2 channels stop flowing; roots start to dry.' },
    { id: 'airflow', name: 'Rack fans failed', what: 'Air stops moving over rack 3, so tipburn develops.' },
    { id: 'led', name: 'LED driver failure', what: 'One tier on rack 4 goes dark.' },
    { id: 'ec', name: 'EC drift', what: 'The nutrient EC probe drifts and the doser over-feeds.' },
  ],
};

export const fmtL = (lakh) => (lakh >= 1 ? `₹${lakh.toFixed(lakh < 10 ? 2 : 1)} lakh` : `₹${Math.round(lakh * 100)}k`);
export const inr = (v) => `₹${Math.round(v).toLocaleString('en-IN')}`;
