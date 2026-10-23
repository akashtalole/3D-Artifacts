/**
 * Tractors, implements and the wheat crop cycle. Figures are typical of Indian farm
 * practice and agricultural-engineering rules of thumb; they are illustrative, and
 * makers' manuals and local agricultural university advice govern.
 */
export const TRACTORS = {
  35: { hp: 35, name: '35 HP, 2WD', kw: 26, weight: 1800, lift: 1200, fuelTank: 50, price: [5.5, 6.5], speed: '2.5–30 km/h', s: 0.93, wd: 2, cab: false },
  50: { hp: 50, name: '50 HP, 2WD', kw: 37, weight: 2100, lift: 1800, fuelTank: 60, price: [7.5, 8.8], speed: '2.7–32 km/h', s: 1.0, wd: 2, cab: false },
  75: { hp: 75, name: '75 HP, 4WD with cab', kw: 55, weight: 3200, lift: 2500, fuelTank: 90, price: [12.5, 15], speed: '1.5–35 km/h', s: 1.12, wd: 4, cab: true },
};
export const COLOURS = [['red', '#c4241b'], ['blue', '#1f5fae'], ['green', '#2f7d32'], ['orange', '#e8721a']];

/**
 * Implements. hitch: 3pt (three-point linkage), pto (also PTO-driven), drawbar (trailed),
 * front (front-mounted), stationary. w = working width (m), v = typical speed (km/h),
 * eff = field efficiency, hp = [min, max] tractor HP, lf = engine load factor.
 */
export const IMPLEMENTS = {
  plough: { name: 'Mould-board plough', short: 'MB plough', hitch: '3pt', w: 0.6, depth: '20–25 cm', v: 4.5, eff: 0.75, hp: [35, 45], lf: 0.8, price: [0.3, 0.4], soil: 'ploughed',
    what: 'Two bottoms cut, lift and invert the soil, burying stubble and weeds. Used for primary tillage, typically once every 2–3 years for deep ploughing.',
    parts: ['2 bottoms, 30 cm each', 'Share, mould-board, landside and frog', 'Reversible or fixed', 'Category I/II three-point hitch'] },
  disc: { name: 'Disc plough', short: 'Disc plough', hitch: '3pt', w: 0.75, depth: '15–25 cm', v: 5, eff: 0.75, hp: [45, 55], lf: 0.75, price: [0.55, 0.7], soil: 'ploughed',
    what: 'Rolling concave discs cut and turn hard, dry, root-bound or stony soil where a mould-board would clog or break.',
    parts: ['3 discs, 660 mm (26")', 'Disc and tilt angles adjustable', 'Scrapers on every disc', 'Rear furrow wheel takes side thrust'] },
  harrow: { name: 'Disc harrow', short: 'Disc harrow', hitch: '3pt', w: 1.8, depth: '10–15 cm', v: 6, eff: 0.8, hp: [35, 45], lf: 0.65, price: [0.5, 0.7], soil: 'harrowed',
    what: 'Two gangs of discs set at opposite angles break clods after ploughing and chop residue. Usually two passes, the second across the first.',
    parts: ['14 discs, 460–510 mm', 'Front gang notched, rear gang plain', 'Gang angle 15–25°', 'Tandem mounted'] },
  cultivator: { name: 'Tine cultivator', short: 'Cultivator', hitch: '3pt', w: 2.0, depth: '8–12 cm', v: 6, eff: 0.8, hp: [35, 45], lf: 0.6, price: [0.25, 0.35], soil: 'cultivated',
    what: 'Spring-loaded tines with reversible shovels loosen the soil and uproot weeds for secondary tillage. A plank (sohaga) often follows to smooth and firm the surface.',
    parts: ['9 tines in two staggered rows', 'Reversible shovels', 'Spring tines spring back over stones', 'Depth wheels'] },
  rotavator: { name: 'Rotavator (rotary tiller)', short: 'Rotavator', hitch: 'pto', w: 1.8, depth: '10–15 cm', v: 3.5, eff: 0.75, hp: [45, 50], lf: 0.85, price: [1.0, 1.3], soil: 'tilled',
    what: 'A PTO-driven rotor of L-blades chops and mixes soil and residue into a fine seedbed in one pass, replacing several harrow and cultivator passes.',
    parts: ['42 L-blades on a 1.8 m (6 ft) rotor', 'PTO 540 rpm, rotor ≈200 rpm', 'Side chain or gear drive', 'Trailing board levels the tilth'] },
  leveller: { name: 'Laser land leveller', short: 'Laser leveller', hitch: 'drawbar', w: 2.4, depth: 'cut and fill', v: 4, eff: 0.6, hp: [50, 60], lf: 0.75, price: [3.5, 4.5], soil: 'levelled',
    what: 'A laser transmitter sweeps a level reference plane over the field; the receiver on the bucket drives the hydraulics to cut high spots and fill low ones within ±2 cm. Saves 20–30% of irrigation water.',
    parts: ['2.4 m drag bucket', 'Rotating laser transmitter on a tripod', 'Receiver on a mast, control box in the cab', 'Hydraulic lift ram'] },
  drill: { name: 'Seed-cum-fertiliser drill', short: 'Seed drill', hitch: '3pt', w: 1.8, depth: '4–5 cm', v: 5, eff: 0.65, hp: [35, 45], lf: 0.45, price: [0.45, 0.6], soil: 'sown',
    what: 'Meters seed and fertiliser together and places them in rows at a set depth through furrow openers. A ground wheel drives the metering, so the rate stays the same at any speed.',
    parts: ['9 rows at 20 cm', 'Seed and fertiliser boxes', 'Fluted-roller metering, ground-wheel drive', 'Inverted-T or shoe openers'] },
  sprayer: { name: 'Boom sprayer', short: 'Boom sprayer', hitch: 'pto', w: 10, depth: '—', v: 6, eff: 0.6, hp: [35, 50], lf: 0.35, price: [0.8, 1.5], soil: null,
    what: 'A PTO pump sprays pesticide or herbicide through flat-fan nozzles on a folding boom, at a set volume per hectare.',
    parts: ['400 L tank', '10 m folding boom, nozzles at 50 cm', 'PTO piston or diaphragm pump', 'Typical 300–500 L/ha for herbicide'] },
  reaper: { name: 'Front-mounted reaper', short: 'Reaper', hitch: 'front', w: 2.1, depth: '—', v: 3.5, eff: 0.7, hp: [35, 45], lf: 0.5, price: [0.7, 1.0], soil: null,
    what: 'A reciprocating cutter bar cuts the crop and vertical conveyors lay it in a neat windrow to one side, ready for bundling and threshing.',
    parts: ['2.1 m cutter bar', 'Crop dividers and star wheels', 'Vertical conveyor belts with lugs', 'Belt drive from the PTO'] },
  thresher: { name: 'Multi-crop thresher', short: 'Thresher', hitch: 'stationary', w: 0, depth: '—', v: 0, eff: 1, hp: [35, 45], lf: 0.6, price: [1.5, 2.5], soil: null, rate: 1.2,
    what: 'Stationary and PTO-driven: a spike-tooth drum threshes the crop, sieves and a blower clean the grain, and the straw comes out as bhusa (chaff). About 1–1.5 t of grain an hour.',
    parts: ['Spike-tooth drum', 'Feeding chute and trough', 'Sieves and blower', 'Bhusa outlet and grain spout'] },
  trolley: { name: 'Tipping trolley', short: 'Trolley', hitch: 'drawbar', w: 0, depth: '—', v: 20, eff: 1, hp: [35, 50], lf: 0.4, price: [1.5, 2.5], soil: null,
    what: 'A 5-tonne two-axle trolley carries produce to the mandi. A hydraulic ram from the tractor tips it for unloading.',
    parts: ['5 t payload', 'Hydraulic tipping', 'Four wheels on two axles', 'Drawbar hitch'] },
};
export const ORDER = ['plough', 'disc', 'harrow', 'cultivator', 'rotavator', 'leveller', 'drill', 'sprayer', 'reaper', 'thresher', 'trolley'];

/** Wheat after paddy (rabi, north-west India): conventional tillage, laser levelling and line sowing. */
export const CYCLE = [
  { id: 'stubble', date: 'Oct 20', name: 'Paddy stubble', imp: null, dur: 6, what: 'The paddy has been harvested and the field is left with stubble. Residue is managed in the soil rather than burnt.' },
  { id: 'plough', date: 'Oct 24', name: 'Deep ploughing', imp: 'plough', dur: 26, what: 'The mould-board plough inverts the soil and buries the stubble.' },
  { id: 'harrow', date: 'Oct 27', name: 'Disc harrowing', imp: 'harrow', dur: 16, what: 'Disc harrowing breaks the clods left by the plough.' },
  { id: 'cultivator', date: 'Oct 29', name: 'Cultivating', imp: 'cultivator', dur: 16, what: 'The cultivator loosens the top layer, followed by planking to firm it into a seedbed.' },
  { id: 'leveller', date: 'Nov 1', name: 'Laser levelling', imp: 'leveller', dur: 18, what: 'A level field takes water evenly, so less is needed and germination is uniform.' },
  { id: 'drill', date: 'Nov 5', name: 'Sowing', imp: 'drill', dur: 18, what: 'Seed at about 100 kg/ha in rows 20 cm apart, 4–5 cm deep, with basal fertiliser.' },
  { id: 'irrigate', date: 'Nov 26', name: 'First irrigation (CRI)', imp: null, dur: 10, what: 'Crown root initiation, about 21 days after sowing, is the most critical stage for water.' },
  { id: 'sprayer', date: 'Dec 8', name: 'Weed control', imp: 'sprayer', dur: 14, what: 'Herbicide sprayed about 30–35 days after sowing, at the label rate in 300–500 L of water per hectare.' },
  { id: 'grow', date: 'Dec → Apr', name: 'Crop growth', imp: null, dur: 14, what: 'Tillering, jointing, heading and grain filling, with irrigations at the critical stages, until the crop turns golden.' },
  { id: 'reaper', date: 'Apr 10', name: 'Harvesting', imp: 'reaper', dur: 20, what: 'The reaper cuts the ripe crop and lays it in windrows. It is then bundled for threshing.' },
  { id: 'thresher', date: 'Apr 12', name: 'Threshing', imp: 'thresher', dur: 14, what: 'The tractor drives the thresher from its PTO, giving grain and bhusa (wheat straw for fodder).' },
  { id: 'trolley', date: 'Apr 14', name: 'To the mandi', imp: 'trolley', dur: 14, what: 'Grain bags go by trolley to the market yard for sale.' },
];
export const fmtL = (lakh) => (lakh >= 1 ? `₹${lakh.toFixed(lakh < 10 ? 2 : 1)} lakh` : `₹${Math.round(lakh * 100)}k`);
