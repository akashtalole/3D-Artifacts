/**
 * Vera Rubin NVL72 figures are from NVIDIA's product page
 * (nvidia.com/en-in/data-center/vera-rubin-nvl72/). Tray layout is from NVIDIA's DGX
 * Vera Rubin user guide and partner data sheets.
 * Everything about the site (layout, solar, cooling setpoints, climate) is an
 * illustrative design, not a real facility.
 */

export const RACK_SPECS = [
  ['GPUs / CPUs', '72 Rubin · 36 Vera'],
  ['NVFP4 inference', '3,600 PFLOPS (sparse)'],
  ['NVFP4 training', '2,520 PFLOPS'],
  ['FP8 / FP6 training', '1,260 PFLOPS'],
  ['GPU memory', '20.7 TB HBM4'],
  ['HBM4 bandwidth', '1,400 TB/s'],
  ['NVLink 6 bandwidth', '216 TB/s'],
  ['NVLink-C2C', '65 TB/s'],
  ['CPU cores', '3,168 Olympus'],
  ['CPU memory', 'up to 54 TB LPDDR5X'],
  ['Scale-out (bi-dir)', '32.4 TB/s'],
  ['Silicon', '1,296 chips'],
];

export const GPU_SPECS = [
  ['NVFP4 inference', '50 PFLOPS'],
  ['NVFP4 training', '35 PFLOPS'],
  ['HBM4', '288 GB · 19.2 TB/s'],
  ['NVLink 6', '3 TB/s'],
  ['Chips per package', '12 (incl. 8 HBM4)'],
];

export const SUPERCHIP_SPECS = [
  ['Make-up', '1 Vera CPU + 2 Rubin GPUs'],
  ['NVFP4 inference', '100 PFLOPS'],
  ['HBM4', '576 GB'],
  ['Vera cores', '88 Olympus · 176 threads'],
  ['LPDDR5X', 'up to 1.5 TB'],
  ['NVLink-C2C', '1.8 TB/s'],
];

/** NVIDIA's "100 MW AI factory" reference figures. */
export const FACTORY = {
  gpus: 40000,
  racks: 556,                 // 40,032 GPUs ≈ 40K
  inferenceZF: 2.0,           // NVFP4 sparse, ZFLOPS
  trainingZF: 1.4,            // NVFP4 dense, ZFLOPS
  hbmPB: 12,
  hbmBwPBs: 800,
  facilityMW: 100,
  itMW: 88,                   // assumed IT share of the 100 MW envelope
};

export const FACTORY_SPECS = [
  ['Rubin GPUs', '≈ 40,000 (556 racks)'],
  ['NVFP4 inference', '2 ZFLOPS'],
  ['NVFP4 training', '1.4 ZFLOPS'],
  ['FP8 / FP6 training', '700 EFLOPS'],
  ['HBM4', '12 PB · 800 PB/s'],
  ['CPU memory', 'up to 30 PB LPDDR5X'],
];

/** Illustrative site on the Deccan Plateau near Hyderabad, Telangana. */
export const SITE = {
  name: 'Deccan AI Factory (illustrative)',
  lat: 17.385, lon: 78.4867, tz: 5.5,           // IST = UTC+5:30
  halls: 4, racksPerHall: 139,
  gridKV: 220, mvKV: 33, hz: 50,
  coolantSetpoint: 42,                           // °C rack inlet (NVIDIA allows up to 45 °C)
  coolantMax: 45,
  designDeltaT: 10,                              // K across the rack at full load
  dryCoolerApproach: 5,                          // K above ambient
};

/** Approximate Hyderabad climate normals: [mean daily min, mean daily max] °C, rainy days/month. */
export const CLIMATE = [
  [15, 29, 1], [17, 32, 1], [20, 36, 1], [24, 38, 2], [26, 39, 3], [24, 34, 8],
  [22, 30, 13], [22, 29, 14], [22, 30, 10], [20, 30, 6], [17, 29, 2], [14, 28, 1],
];

export const SEASONS = {
  today: { label: 'Today', date: null },
  summer: { label: 'Summer peak', date: '2026-05-15' },
  monsoon: { label: 'Monsoon', date: '2026-07-20' },
  winter: { label: 'Winter', date: '2026-12-15' },
};

/** Token consumers: lat/lon of Indian cities (drawn at 3 m per km around the site). */
export const CITIES = [
  ['Mumbai', 19.076, 72.8777], ['Delhi', 28.6139, 77.209], ['Bengaluru', 12.9716, 77.5946],
  ['Chennai', 13.0827, 80.2707], ['Kolkata', 22.5726, 88.3639], ['Ahmedabad', 23.0225, 72.5714], ['Lucknow', 26.8467, 80.9462], ['Jaipur', 26.9124, 75.7873],
  ['Kochi', 9.9312, 76.2673], ['Guwahati', 26.1445, 91.7362], ['Visakhapatnam', 17.6868, 83.2185],
  ['Bhubaneswar', 20.2961, 85.8245], ['Nagpur', 21.1458, 79.0882],
  ['Indore', 22.7196, 75.8577],
];
export const KM = 3;   // scene metres per real kilometre on the token map

export const STOPS = [
  { id: 'campus', title: 'The AI factory', kicker: '100 MW campus',
    text: 'An AI factory turns electricity into tokens. This illustrative 100 MW campus on the Deccan Plateau near Hyderabad houses about 40,000 Rubin GPUs in 556 Vera Rubin NVL72 racks across four halls.',
    india: 'Hyderabad sits on the stable granite of the Deccan Plateau, away from coastal cyclones and flood plains, and has 220 kV grid access and fibre to the Mumbai and Chennai cable landings.',
    specs: 'factory' },
  { id: 'power', title: 'Power in', kicker: '220 kV grid · solar · back-up',
    text: 'Power arrives from the 220 kV transmission grid at the on-site substation and is stepped down to 33 kV for the halls. A solar field adds daytime energy, and diesel generators with fuel for 48 hours cover grid failures.',
    india: 'Most green energy for Indian data centres comes from open-access solar and wind contracts, wheeled over the grid from Telangana, Karnataka or Rajasthan. On-site solar only covers a few percent.',
    specs: 'power' },
  { id: 'cooling', title: 'Warm-water cooling', kicker: 'Up to 45 °C inlet · chiller-free',
    text: 'Every rack is liquid-cooled. Rubin trays have no fans: cold plates sit on every GPU and CPU. The rack inlet can run as warm as 45 °C, so dry coolers reject the heat directly to outside air without chillers.',
    india: 'A 45 °C inlet matters in India. Hyderabad afternoons reach about 40 °C in May, yet the dry coolers keep up with a little adiabatic spray on the hottest hours, and use no water for the rest of the year.',
    specs: 'cooling' },
  { id: 'hall', title: 'Data hall', kicker: '139 racks · ≈ 22 MW per hall',
    text: 'Each hall has 139 NVL72 racks in eight rows, about 10,000 GPUs. At roughly 158 kW per rack, the racks need far less floor than the electrical and cooling rooms that feed them.',
    india: 'Cutaway view: the overhead pipes carry warm water (blue supply, red return), yellow trays carry the InfiniBand and Ethernet fibre, and busways deliver 415 V power to each rack.',
    specs: 'hall' },
  { id: 'rack', title: 'Vera Rubin NVL72', kicker: 'One rack · one giant GPU',
    text: '18 compute trays and 9 NVLink 6 switch trays make 72 Rubin GPUs and 36 Vera CPUs act as a single accelerator. The trays are cable-free and modular, and four power shelves feed a DC busbar.',
    india: '3,600 PFLOPS of NVFP4 inference and 20.7 TB of HBM4 in one rack, about the floor space of a household refrigerator.',
    specs: 'rack' },
  { id: 'tray', title: 'Compute tray', kicker: '2 Vera Rubin superchips',
    text: 'Each 1U tray holds two superchips, each one Vera CPU plus two Rubin GPUs. Each Rubin package has two compute dies, two I/O dies and eight HBM4 stacks. Cold plates and braided hoses carry the coolant, and ConnectX-9 and BlueField-4 cards handle the network.',
    india: 'The tray is exploded here: the lid lifts off, then the cold plates, to show the silicon.',
    specs: 'tray' },
  { id: 'spine', title: 'NVLink 6 spine', kicker: '216 TB/s all-to-all',
    text: 'At the back of the rack, copper cable cartridges link every GPU to all nine NVLink 6 switch trays. Any GPU can reach any other at 3 TB/s, so the whole rack can run one giant model.',
    india: 'Blue and red manifolds beside the spine supply and return coolant to every tray through drip-free quick disconnects.',
    specs: 'gpu' },
  { id: 'tokens', title: 'Tokens out', kicker: 'Serving India',
    text: 'Requests arrive over fibre from across India and tokens stream back. The NVFP4 compute in use follows the workload: steady for training, and peaking in the morning and evening for inference.',
    india: 'Map drawn at 3 m per km around the site: Bengaluru is about 500 km away and Delhi about 1,250 km. A request from Mumbai crosses about 4 ms of fibre each way.',
    specs: 'factory' },
];
