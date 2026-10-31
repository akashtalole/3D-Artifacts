import { T_DOCK, T_RNDZ, MILESTONES as M, PHASING_BURNS } from '../sim/trajectory.js';

/** Facts shown in the mission card, all from NASA's CRS-35 pages and station blog. */
export const FACTS = [
  ['Mission', 'SpaceX CRS-35 (NASA Commercial Resupply)'],
  ['Liftoff', '13 Oct 2026 · 6:33 a.m. EDT'],
  ['Pad', 'SLC-40, Cape Canaveral Space Force Station'],
  ['Rocket', 'Falcon 9 (booster’s 8th flight)'],
  ['Spacecraft', 'Cargo Dragon (4th flight)'],
  ['Cargo', '> 6,300 lb, incl. final iROSA pair'],
  ['Docking', '15 Oct · ≈ 11:00 a.m. EDT · Harmony zenith'],
  ['Stay', '≈ 1 month, Pacific splashdown'],
];

export const SOURCES = [
  ['NASA: CRS-35 mission', 'https://www.nasa.gov/mission/nasas-spacex-crs-35/'],
  ['NASA blog: Dragon lifts off', 'https://www.nasa.gov/blogs/spacestation/2026/10/13/spacex-dragon-lifts-off-for-thursday-cargo-delivery/'],
  ['NASA blog: Dragon docks', 'https://www.nasa.gov/blogs/spacestation/2026/10/15/spacex-dragon-docks-with-science-supplies-and-roll-out-solar-arrays/'],
];

/** The three acts. Each owns a slice of the scrubber regardless of its real length. */
export const ACTS = [
  { id: 'launch', title: 'Launch & landing', t0: -90, t1: 780, width: 0.42 },
  { id: 'orbit', title: 'Orbit phasing · 51 h', t0: 780, t1: T_RNDZ, width: 0.22 },
  { id: 'dock', title: 'Rendezvous & docking', t0: T_RNDZ, t1: T_DOCK + 15 * 60, width: 0.36 },
];

const min = (m) => T_RNDZ + m * 60;

/**
 * Chapters: MET (s), title, detail, auto time-warp, auto camera.
 * Warp is how many seconds of mission time pass per real second in Auto mode.
 */
export const CHAPTERS = [
  { t: -90, act: 'launch', title: 'Final countdown', detail: 'Falcon 9 and Cargo Dragon stand on SLC-40 under the pad floodlights in the pre-dawn dark. Propellant loading is complete.', warp: 2, cam: 'pad' },
  { t: -3, act: 'launch', title: 'Engine ignition', detail: 'The nine Merlin 1D engines ignite; the flight computer checks they are healthy before release.', warp: 1, cam: 'pad' },
  { t: 0, act: 'launch', title: 'Liftoff · 6:33 a.m. EDT', detail: 'Liftoff from Space Launch Complex 40. Falcon 9 rolls onto a north-east heading to match the station’s 51.6° orbit.', warp: 1.5, cam: 'pad' },
  { t: 25, act: 'launch', title: 'Pitch program', detail: 'The rocket pitches downrange over the Atlantic.', warp: 2, cam: 'chase' },
  { t: M.maxQ, act: 'launch', title: 'Max-Q', detail: 'Maximum aerodynamic pressure, about 10 km up. The engines throttle down briefly to ease the load.', warp: 2, cam: 'chase' },
  { t: M.meco, act: 'launch', title: 'MECO', detail: 'Main-engine cutoff on the first stage, about 55 km up and 80 km downrange.', warp: 1, cam: 'chase' },
  { t: M.sep, act: 'launch', title: 'Stage separation', detail: 'The stages separate. Grid fins unfold on the booster.', warp: 1, cam: 'chase' },
  { t: M.ses, act: 'launch', title: 'Second-stage ignition', detail: 'The Merlin Vacuum engine lights; its plume balloons in the near-vacuum.', warp: 2, cam: 'chase' },
  { t: M.boostback[0], act: 'launch', title: 'Boostback burn', detail: 'The booster flips and fires three engines to reverse its course back toward Cape Canaveral.', warp: 3, cam: 'booster' },
  { t: M.apogeeB, act: 'launch', title: 'Booster apogee', detail: 'The booster coasts over the top of its arc, about 110 km high, engines first.', warp: 4, cam: 'booster' },
  { t: M.entry[0], act: 'launch', title: 'Entry burn', detail: 'Three engines slow the booster as it falls back into the thicker atmosphere.', warp: 2, cam: 'booster' },
  { t: M.landing[0], act: 'launch', title: 'Landing burn', detail: 'A single engine fires and the four legs deploy for touchdown at the Cape Canaveral landing zone (planned return-to-launch-site recovery).', warp: 1, cam: 'booster' },
  { t: M.landing[1], act: 'launch', title: 'Booster touchdown', detail: 'The first stage — on its eighth flight — settles on the landing zone a few kilometres from the pad.', warp: 2, cam: 'booster' },
  { t: M.seco, act: 'launch', title: 'SECO', detail: 'Second-stage engine cutoff. Dragon is in orbit, about 1,500 km downrange.', warp: 2, cam: 'dragon' },
  { t: M.dragonSep, act: 'launch', title: 'Dragon separation', detail: 'About nine minutes after launch, Dragon separates from the second stage (NASA).', warp: 2, cam: 'dragon' },
  { t: M.nose[0], act: 'launch', title: 'Nosecone opens', detail: 'Dragon opens its nosecone to expose the docking system and starts a “carefully choreographed series of thruster firings” to reach the station.', warp: 4, cam: 'dragon' },
  ...PHASING_BURNS.slice(1).map((b, i) => ({
    t: b.t, act: 'orbit', title: b.name, detail: i === 0
      ? 'Dragon chases the station from a lower, faster orbit. Each burn raises its orbit, slowing the catch-up as it nears the ISS.'
      : `Draco thrusters raise Dragon’s orbit to about ${b.h} km.`,
    warp: 2400, cam: 'globe',
  })),
  { t: 780, act: 'orbit', title: 'Phasing orbit', detail: 'Over about 51 hours Dragon gains on the ISS: a lower orbit is shorter, so each lap gains a little on the station.', warp: 2400, cam: 'globe' },
  { t: min(0), act: 'dock', title: 'Approach ellipsoid', detail: 'Dragon enters the 4 × 2 × 2 km approach ellipsoid and talks to the station over its proximity link.', warp: 40, cam: 'approach' },
  { t: min(25), act: 'dock', title: 'Waypoint 0', detail: 'Hold about 400 m below the station; teams poll “go” to enter the 200 m Keep-Out Sphere.', warp: 40, cam: 'approach' },
  { t: min(40), act: 'dock', title: 'Keep-Out Sphere entry', detail: 'Dragon flies around the station’s forward side toward the zenith docking axis.', warp: 40, cam: 'dragon' },
  { t: min(58), act: 'dock', title: 'Waypoint 1', detail: 'About 220 m above Harmony, aligned with the docking axis.', warp: 40, cam: 'approach' },
  { t: min(90), act: 'dock', title: 'Waypoint 2', detail: '20 m from the port — final go / no-go.', warp: 20, cam: 'centerline' },
  { t: min(100), act: 'dock', title: 'Final approach', detail: 'Dragon closes the last 20 m autonomously at a few centimetres per second.', warp: 10, cam: 'dragon' },
  { t: T_DOCK, act: 'dock', title: 'Docked · ≈ 11:00 a.m. EDT', detail: 'Soft capture on the International Docking Adapter on Harmony’s space-facing port, about 51 hours after launch.', warp: 10, cam: 'approach' },
  { t: T_DOCK + 10 * 60, act: 'dock', title: 'Hard capture', detail: 'Twelve hooks close. The crew will open the hatch and unpack the 6,300 lb of science and supplies.', warp: 20, cam: 'approach' },
].sort((a, b) => a.t - b.t);

/** Dragon relative to the station (LVLH metres, as in the station sim) during the rendezvous act. */
export const RNDZ_KEYS = [
  [0, [-900, -350, 0]], [25, [8.4, -400, 0]], [30, [8.4, -400, 0]],
  [40, [230, -200, 0]], [50, [240, 120, 0]], [58, [8.4, 225.1, 0]], [70, [8.4, 225.1, 0]],
  [90, [8.4, 25.1, 0]], [100, [8.4, 25.1, 0]], [106, [8.4, 5.1, 0]],
].map(([m, p]) => [T_RNDZ + m * 60, p]);
export const PORT = [8.4, 5.1, 0];
