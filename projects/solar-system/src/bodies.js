/**
 * Physical data (NASA Planetary Fact Sheet, rounded) and texture names.
 * Radius km, mass 10^24 kg, rotation = sidereal period in hours (negative = retrograde),
 * tilt = obliquity to orbit in degrees, period = orbital period in days.
 */
export const TEX = 'https://cdn.jsdelivr.net/gh/jeromeetienne/threex.planets@master/images/';
export const THREE_TEX = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/';

export const BODIES = [
  { id: 'sun', name: 'Sun', type: 'Star', radius: 695700, mass: 1988500, rotation: 609.12, tilt: 7.25, color: '#ffcf6b', tex: TEX + 'sunmap.jpg',
    fact: 'Holds 99.8 % of the Solar System’s mass. Its light takes 8 min 20 s to reach Earth.' },
  { id: 'mercury', name: 'Mercury', type: 'Planet', radius: 2439.7, mass: 0.330, rotation: 1407.6, tilt: 0.03, period: 88.0, color: '#b9a99a', tex: TEX + 'mercurymap.jpg',
    fact: 'Three rotations for every two orbits; a day on Mercury lasts 176 Earth days.' },
  { id: 'venus', name: 'Venus', type: 'Planet', radius: 6051.8, mass: 4.87, rotation: -5832.5, tilt: 177.4, period: 224.7, color: '#e8c48f', tex: TEX + 'venusmap.jpg',
    fact: 'Spins backwards, and its thick CO₂ atmosphere makes it the hottest planet (≈ 465 °C).' },
  { id: 'earth', name: 'Earth', type: 'Planet', radius: 6371.0, mass: 5.97, rotation: 23.934, tilt: 23.44, period: 365.25, color: '#6fa8ff', tex: THREE_TEX + 'earth_day_4096.jpg', clouds: THREE_TEX + 'earth_clouds_1024.png',
    fact: 'The only world known to host life. Oriented here by sidereal time — the lit continents match the real date.' },
  { id: 'moon', name: 'Moon', type: 'Moon', parent: 'earth', radius: 1737.4, mass: 0.073, rotation: 655.7, tilt: 6.7, period: 27.32, color: '#cfcfcf', tex: TEX + 'moonmap1k.jpg',
    fact: 'Tidally locked: the same face always points at Earth. Position from a low-precision lunar series.' },
  { id: 'mars', name: 'Mars', type: 'Planet', radius: 3389.5, mass: 0.642, rotation: 24.623, tilt: 25.19, period: 687.0, color: '#ff7b54', tex: TEX + 'marsmap1k.jpg',
    fact: 'Home to Olympus Mons, the largest volcano known, and to NASA’s Perseverance and Curiosity rovers.' },
  { id: 'jupiter', name: 'Jupiter', type: 'Planet', radius: 69911, mass: 1898, rotation: 9.925, tilt: 3.13, period: 4331, color: '#e3b98c', tex: TEX + 'jupitermap.jpg',
    fact: 'More than twice as massive as all the other planets combined; the Great Red Spot is a centuries-old storm.' },
  { id: 'io', name: 'Io', type: 'Moon', parent: 'jupiter', radius: 1821.6, mass: 0.0893, a: 421700, period: 1.769, color: '#e8d36a', approx: true,
    fact: 'The most volcanically active body known.' },
  { id: 'europa', name: 'Europa', type: 'Moon', parent: 'jupiter', radius: 1560.8, mass: 0.048, a: 671034, period: 3.551, color: '#d8cdb8', approx: true,
    fact: 'An ice shell over a global salt-water ocean — the target of NASA’s Europa Clipper.' },
  { id: 'ganymede', name: 'Ganymede', type: 'Moon', parent: 'jupiter', radius: 2634.1, mass: 0.148, a: 1070412, period: 7.155, color: '#a69886', approx: true,
    fact: 'The largest moon in the Solar System, bigger than Mercury.' },
  { id: 'callisto', name: 'Callisto', type: 'Moon', parent: 'jupiter', radius: 2410.3, mass: 0.108, a: 1882709, period: 16.689, color: '#6f655a', approx: true,
    fact: 'One of the most heavily cratered surfaces in the Solar System.' },
  { id: 'saturn', name: 'Saturn', type: 'Planet', radius: 58232, mass: 568, rotation: 10.656, tilt: 26.73, period: 10747, color: '#f1d9a0', tex: TEX + 'saturnmap.jpg',
    rings: { inner: 74500, outer: 140220, color: TEX + 'saturnringcolor.jpg', alpha: TEX + 'saturnringpattern.gif' },
    fact: 'Its main rings span about 280,000 km but are mostly only tens of metres thick.' },
  { id: 'titan', name: 'Titan', type: 'Moon', parent: 'saturn', radius: 2574.7, mass: 0.135, a: 1221870, period: 15.945, color: '#e0a54b', approx: true,
    fact: 'Thick nitrogen atmosphere and methane lakes; NASA’s Dragonfly rotorcraft is headed there.' },
  { id: 'uranus', name: 'Uranus', type: 'Planet', radius: 25362, mass: 86.8, rotation: -17.24, tilt: 97.77, period: 30589, color: '#9fe3ee', tex: TEX + 'uranusmap.jpg',
    fact: 'Rolls around the Sun on its side, tilted almost 98°.' },
  { id: 'neptune', name: 'Neptune', type: 'Planet', radius: 24622, mass: 102, rotation: 16.11, tilt: 28.32, period: 59800, color: '#5b7bff', tex: TEX + 'neptunemap.jpg',
    fact: 'Supersonic winds up to 2,000 km/h — the fastest of any planet.' },
  { id: 'pluto', name: 'Pluto', type: 'Dwarf planet', radius: 1188.3, mass: 0.0130, rotation: -153.29, tilt: 122.53, period: 90560, color: '#d9b99b', tex: TEX + 'plutomap1k.jpg',
    fact: 'Visited by New Horizons in 2015, which revealed the heart-shaped Sputnik Planitia glacier.' },
];

export const byId = Object.fromEntries(BODIES.map((b) => [b.id, b]));
