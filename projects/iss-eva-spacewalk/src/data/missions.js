import { trussTopRoute, PV } from '../model/layout.js';

/**
 * EVA mission scripts. Times are minutes of Phase Elapsed Time (PET) from the
 * moment the airlock hatch opens; positions are station-frame metres (layout.js).
 *
 * Each mission is modelled on a real class of ISS spacewalk; durations and the
 * order of tasks follow the published EVA timelines, compressed where the real
 * work is repetitive. Crew positions are approximate — this is a visualisation,
 * not a procedures trainer.
 */

// ── helpers ──────────────────────────────────────────────────────────────────
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Spread keys over [t0, t1] proportional to path length. */
function route(t0, t1, pts, opts = {}) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1] || 1;
  return pts.map((p, i) => ({ t: t0 + ((t1 - t0) * cum[i]) / total, p, ...opts }));
}
const at = (t, p, o = {}) => ({ t, p, ...o });
const rev = (a) => [...a].reverse();

// ── US segment: Quest airlock geometry ──────────────────────────────────────
const IN_LOCK = { up: [0, 0, -1], face: [0, 1, 0], lock: true };
const QUEST_IN = [-7.35, 0, 6.5];
const QUEST_OUT = [-7.35, 0.3, 8.7];
const QUEST_EGRESS = [QUEST_OUT, [-7.35, 1.55, 7.3], [-7.35, 2.5, 4.6], [-7.2, 2.78, 2.0], [-4.4, 2.75, 1.0], [-3.0, 2.62, 0.8]];
const TO_TRUSS = (z = 0.8) => [[-2.5, 3.3, z], [-2.45, 6.3, z], [-1.2, 7.15, z]];
const usOut = (zTruss, zTo) => [...QUEST_EGRESS.slice(1), ...TO_TRUSS(zTruss), ...trussTopRoute(zTruss, zTo)];

// ── Russian segment: Poisk ───────────────────────────────────────────────────
const POISK_IN = [-26.35, 3.4, 0.25];
const POISK_OUT = [-26.35, 3.5, 1.95];
const POISK_TO_NAUKA = [POISK_OUT, [-26.9, 2.3, 1.95], [-27.3, 0.6, 2.0], [-27.0, -1.0, 2.1], [-26.6, -2.2, 2.45], [-26.35, -3.5, 2.7]];
const RU_BELLY = { belly: [0, 0, -1] };

const ZC6 = PV.zc6;
const IROSA_MOUNT = [4.0, 6.0, -ZC6];

export const MISSIONS = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'irosa2026',
    category: 'eva',
    date: '2026-10-29',
    status: 'planned',
    source: 'https://www.nasa.gov/blogs/spacestation/2026/10/20/blood-vessel-printing-cancer-research-and-spacewalk-preps-keep-crew-busy/',
    title: 'Final iROSA Installs',
    subtitle: 'US EVA · Menon & Kutryk · Oct 29 & Nov 5, 2026',
    inspiration: 'NASA’s Anil Menon and CSA’s Joshua Kutryk are scheduled to install the last roll-out solar arrays, delivered by CRS-35, in spacewalks on 29 Oct and 5 Nov 2026, finishing the power upgrade (“up to 30 percent” more generation). NASA has not said which wing comes first; the sim shows wing 2A on P4, and which crew member rides the arm is illustrative.',
    epoch: '2026-10-29T12:00:00Z',
    raan: 60,
    daylightAt: 206,
    duration: 390,
    airlock: 'quest',
    config: { nauka: true, pirs: false, prichal: true, bishop: true, irosa: ['2B', '4B', '3A', '4A', '1A', '1B'], vehicles: ['dragon', 'cargoDragon', 'soyuz', 'progress'] },
    crew: [
      { id: 'ev1', role: 'EV1', suit: 'emu', stripes: 'red', note: 'Translates to the P4 worksite' },
      { id: 'ev2', role: 'EV2', suit: 'emu', stripes: 'none', note: 'Rides Canadarm2 with the iROSA' },
    ],
    worksite: { target: [-3.0, 6.5, -35.0], offset: [-15, 9, -14] },
    phases: [
      { t: 0, title: 'Hatch open · egress', detail: 'Crew Lock depressurised; both spacewalkers leave Quest and set up safety tethers. Menon configured the tools and inspected the tethers in Quest beforehand.' },
      { t: 12, title: 'Translate to P4', detail: 'EV1 moves hand-over-hand along the port truss to the P4 power module (≈ 35 m).' },
      { t: 20, title: 'EV2 boards Canadarm2', detail: 'EV2 ingresses the foot restraint on the arm, which holds one of the two iROSAs CRS-35 delivered in Dragon’s trunk.' },
      { t: 38, title: 'MBS to P3', detail: 'The Mobile Transporter carries the arm to the P3 worksite.' },
      { t: 66, title: 'Arm fly-over', detail: 'Robotics officers fly EV2 and the iROSA over the truss to the aft side of P4, where wing 2A extends.' },
      { t: 100, title: 'Hand-off', detail: 'EV2 leaves the arm and carries the iROSA to the 2A mast canister with EV1.' },
      { t: 128, title: 'Mount on bracket', detail: 'The iROSA is aligned with the modification-kit bracket on the mast canister.' },
      { t: 150, title: 'Bolt & connect', detail: 'Bolts torqued and cables mated to channel 2A.' },
      { t: 196, title: 'Crew clear · unfold', detail: 'Crew moves clear of the deploy envelope and the two halves unfold.' },
      { t: 200, title: 'Roll-out deploy', detail: 'The blanket unrolls in about 10 minutes, driven by the stored strain energy in its booms.' },
      { t: 212, title: 'Inspection & clean-up', detail: 'Photo survey, cable restraints and tool clean-up. The second spacewalk on 5 Nov installs the other iROSA.' },
      { t: 262, title: 'Return to Quest', detail: 'Translation back; Canadarm2 and the MBS return to S0.' },
      { t: 350, title: 'Ingress', detail: 'Both crew back in the Crew Lock; hatch closed, repressurisation.' },
    ],
    tracks: {
      ev1: [
        at(0, QUEST_IN, IN_LOCK), at(3, QUEST_IN, IN_LOCK), at(7, QUEST_OUT, { face: [0, 0, 1] }), at(12, QUEST_OUT, { face: [0, 0, 1] }),
        ...route(12, 70, [...usOut(0.8, -31.6), [-2.4, 7.6, -32.6], [-2.9, 7.0, -33.0]]),
        at(100, [-2.9, 7.0, -33.0], { face: [-0.5, -0.2, -0.85] }),
        at(104, [-2.9, 7.0, -33.2], { face: [-0.5, -0.2, -0.85] }),
        at(128, [-3.0, 7.2, -33.2], { face: [-0.5, -0.2, -0.85] }),
        at(150, [-2.9, 7.0, -33.2], { face: [-0.5, -0.2, -0.85] }),
        at(196, [-2.9, 7.0, -33.2], { face: [-0.5, -0.2, -0.85] }),
        at(200, [0.0, 7.7, -31.6], { face: [-1, 0, -0.3] }),
        at(214, [0.0, 7.7, -31.6], { face: [-1, 0, -0.3] }),
        at(222, [-2.9, 7.0, -33.2], { face: [-0.5, -0.2, -0.85] }),
        at(254, [-2.9, 7.0, -33.2], { face: [-0.5, -0.2, -0.85] }),
        at(258, [0.0, 7.7, -31.6], { face: [-1, 0, -0.3] }),
        ...route(270, 362, [[0.0, 7.7, -31.6], ...rev(usOut(0.8, -31.6))]),
        at(366, QUEST_OUT, { face: [0, 0, -1] }), at(370, QUEST_IN, IN_LOCK),
      ],
      ev2: [
        at(0, QUEST_IN, IN_LOCK), at(10, QUEST_IN, IN_LOCK), at(14, QUEST_OUT, { face: [0, 0, 1] }), at(20, QUEST_OUT, { face: [0, 0, 1] }),
        ...route(20, 32, [...QUEST_EGRESS.slice(1), ...TO_TRUSS(1.5), [0.8, 7.35, 2.6], [3.8, 7.8, 3.0]]),
        ...route(104, 128, [[-2.7, 9.6, -35.5], [-2.8, 8.0, -36.5], [-2.8, 6.9, -37.2]]),
        at(150, [-2.8, 6.9, -37.0], { face: [-0.5, -0.2, 0.85] }),
        at(196, [-2.8, 6.9, -37.0], { face: [-0.5, -0.2, 0.85] }),
        at(200, [0.0, 7.5, -38.0], { face: [-1, 0, 0.3] }),
        at(262, [0.0, 7.5, -38.0], { face: [-1, 0, 0.3] }),
        ...route(262, 350, [[0.0, 7.5, -38.0], ...rev(usOut(0.8, -37.6))]),
        at(352, QUEST_OUT, { face: [0, 0, -1] }), at(356, QUEST_IN, IN_LOCK),
      ],
      arm: [
        at(0, [3.6, 6.6, 3.0]), at(38, [3.6, 6.6, 3.0]), at(66, [3.6, 6.6, -23.0]),
        at(80, [2.5, 11.5, -28.0]), at(96, [-3.6, 8.6, -35.5]), at(110, [-3.6, 8.6, -35.5]),
        at(135, [2.5, 11.5, -25.0]), at(160, [4.5, 9.5, -24.0]), at(190, [4.5, 9.5, 2.0]), at(205, [5.5, 9.5, 7.5]),
      ],
    },
    scalars: {
      mbs: [[0, 0], [38, 0], [66, -26], [160, -26], [190, 0]],
      hatch: [[0, 0], [1, 0], [3, 1], [372, 1], [376, 0]],
      irosa2A: [[0, 0], [150, 0], [150.05, 1]],
      deploy2A: [[0, 0], [200, 0], [212, 1]],
    },
    payloads: [
      { id: 'pkg', kind: 'irosaPackage', label: 'iROSA', show: [0, 150], keys: [at(134, [-4.0, 6.0, -35.0]), at(150, [-4.0, 6.0, -35.0])] },
    ],
    attach: [
      { who: 'ev2', to: 'arm', from: 34, until: 104, off: [0.9, 1.0, 0], face: [1, 0, 0], up: [0, 1, 0], mode: 'ride' },
      { who: 'pkg', to: 'arm', from: 0, until: 102, off: [2.2, 0.3, 0] },
      { who: 'pkg', to: 'ev2', from: 106, until: 128, off: [-1.3, -0.4, 0] },
    ],
    irosaTarget: '2A',
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'z1antenna',
    category: 'eva',
    date: '2026-08-25',
    status: 'completed',
    source: 'https://www.nasa.gov/blogs/spacestation/2026/10/20/blood-vessel-printing-cancer-research-and-spacewalk-preps-keep-crew-busy/',
    title: 'Z1 Antenna Replacement',
    subtitle: 'US EVA · Menon & Adenot · Aug 25, 2026 · 6 h 30 min',
    inspiration: 'NASA’s Anil Menon and ESA’s Sophie Adenot spent 6 hours 30 minutes replacing a failed high-speed space-to-ground antenna with a spare on the Z1 truss above Unity, then made the connections to activate it. Menon worked from a foot restraint on Canadarm2’s end effector. Where the spare and the failed unit were stowed is illustrative.',
    epoch: '2026-08-25T12:00:00Z',
    raan: 300,
    daylightAt: 120,
    duration: 390,
    airlock: 'quest',
    hide: ['sgant'],
    config: { nauka: true, pirs: false, prichal: true, bishop: true, irosa: ['2B', '4B', '3A', '4A', '1A', '1B'], vehicles: ['dragon', 'cygnus', 'soyuz', 'progress'] },
    crew: [
      { id: 'ev1', role: 'Adenot', suit: 'emu', stripes: 'none', note: 'ESA · works from the Z1 truss' },
      { id: 'ev2', role: 'Menon', suit: 'emu', stripes: 'red', note: 'NASA · rides Canadarm2 (stripes illustrative)' },
    ],
    worksite: { target: [-6.6, 7.0, 0.3], offset: [9, 4, 12] },
    phases: [
      { t: 0, title: 'Hatch open · egress', detail: 'Both spacewalkers leave the Quest Crew Lock and set up their safety tethers.' },
      { t: 12, title: 'Adenot to Z1', detail: 'Adenot climbs over Quest and Unity to the top of the Z1 truss, where the antenna boom stands.' },
      { t: 20, title: 'Menon on Canadarm2', detail: 'Menon ingresses the foot restraint on Canadarm2’s latching end effector. The spare antenna rides alongside on the arm.' },
      { t: 40, title: 'Arm to the worksite', detail: 'Robotics officers fly Menon and the spare over the S0 truss to the Z1 antenna.' },
      { t: 62, title: 'Disconnect failed antenna', detail: 'Connectors demated and the boom’s attachment bolt released.' },
      { t: 95, title: 'Remove failed antenna', detail: 'Menon lifts the failed boom-and-dish unit off the Z1 interface plate while on the arm.' },
      { t: 110, title: 'Install the spare', detail: 'The arm positions the spare on the interface plate; Adenot guides it in and drives the bolt.' },
      { t: 124, title: 'Connect & activate', detail: 'Power and data connectors mated so flight controllers can activate the new antenna.' },
      { t: 175, title: 'Stow failed unit', detail: 'The arm carries Menon and the failed antenna back over S0, where it is temporarily stowed.' },
      { t: 230, title: 'Get-ahead tasks', detail: 'Clean-up and photo documentation while the timeline allows.' },
      { t: 290, title: 'Return to Quest', detail: 'Both crew translate back to the airlock.' },
      { t: 358, title: 'Ingress', detail: 'Hatch closed at about 6 h 20 min; repressurisation ends the 6 h 30 min spacewalk.' },
    ],
    tracks: {
      ev1: [
        at(0, QUEST_IN, IN_LOCK), at(3, QUEST_IN, IN_LOCK), at(7, QUEST_OUT, { face: [0, 0, 1] }), at(12, QUEST_OUT, { face: [0, 0, 1] }),
        ...route(12, 45, [...QUEST_EGRESS.slice(1, 4), [-7.35, 3.6, 1.8], [-7.6, 5.6, 1.6], [-7.7, 6.35, 0.6]]),
        at(62, [-7.7, 6.35, 0.6], { face: [1, 0, -0.4] }),
        at(110, [-7.7, 6.35, 0.6], { face: [1, 0, -0.4] }),
        at(116, [-7.6, 6.35, -0.8], { face: [1, 0, 0.3] }),
        at(175, [-7.6, 6.35, -0.8], { face: [1, 0, 0.3] }),
        at(182, [-7.7, 6.35, 0.6], { face: [1, 0, -0.4] }),
        at(290, [-7.7, 6.35, 0.6], { face: [1, 0, -0.4] }),
        ...route(290, 354, [[-7.7, 6.35, 0.6], [-7.6, 5.6, 1.6], [-7.35, 3.6, 1.8], ...rev(QUEST_EGRESS.slice(1, 4))]),
        at(356, QUEST_OUT, { face: [0, 0, -1] }), at(360, QUEST_IN, IN_LOCK),
      ],
      ev2: [
        at(0, QUEST_IN, IN_LOCK), at(10, QUEST_IN, IN_LOCK), at(14, QUEST_OUT, { face: [0, 0, 1] }), at(20, QUEST_OUT, { face: [0, 0, 1] }),
        ...route(20, 30, [...QUEST_EGRESS.slice(1), ...TO_TRUSS(1.5), [0.8, 7.35, 2.6], [3.8, 7.8, 3.0]]),
        // 32 → 238 on the arm
        ...route(238, 250, [[4.5, 7.6, 3.0], [2.0, 7.6, 2.8], [0.8, 7.35, 2.6]]),
        at(330, [0.8, 7.35, 2.6], { face: [1, 0, 0] }),
        ...route(330, 362, [[0.8, 7.35, 2.6], ...rev(TO_TRUSS(1.5)), ...rev(QUEST_EGRESS.slice(1))]),
        at(366, QUEST_OUT, { face: [0, 0, -1] }), at(370, QUEST_IN, IN_LOCK),
      ],
      arm: [
        at(0, [3.6, 6.6, 3.0]), at(34, [3.6, 6.6, 3.0]), at(42, [2.0, 11.0, 3.0]), at(52, [-3.0, 11.0, 2.0]),
        at(57, [-4.6, 7.0, 1.6]), at(62, [-6.3, 5.6, 1.2]), at(95, [-6.3, 5.6, 1.2]),
        at(104, [-4.6, 7.4, 2.0]), at(118, [-7.15, 6.8, -2.4]), at(175, [-7.15, 6.8, -2.4]),
        at(190, [-3.0, 11.0, -2.0]), at(200, [0.5, 10.0, -3.5]), at(208, [0.5, 10.0, -3.5]),
        at(225, [2.5, 9.5, 1.0]), at(234, [3.6, 6.6, 3.0]), at(250, [3.6, 6.6, 3.0]), at(270, [5.5, 9.5, 7.5]),
      ],
    },
    scalars: {
      hatch: [[0, 0], [1, 0], [3, 1], [380, 1], [384, 0]],
    },
    payloads: [
      { id: 'oruNew', kind: 'antenna', label: 'Spare antenna', keys: [at(124, [-6.55, 7.1, 0]), at(400, [-6.55, 7.1, 0])] },
      { id: 'oruOld', kind: 'antennaOld', label: 'Failed antenna', keys: [at(0, [-6.55, 7.1, 0]), at(94, [-6.55, 7.1, 0]), at(212, [0.0, 7.1, -4.6]), at(400, [0.0, 7.1, -4.6])] },
    ],
    attach: [
      { who: 'ev2', to: 'arm', from: 32, until: 238, off: [0.9, 1.0, 0], face: [-1, 0, -0.3], up: [0, 1, 0], mode: 'ride' },
      { who: 'oruNew', to: 'arm', from: 0, until: 122, off: [0.6, 0.3, 2.4] },
      { who: 'oruOld', to: 'ev2', from: 95, until: 205, off: [-1.15, 0.5, -1.2] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'cygnus',
    category: 'vehicle',
    date: '2026-10-09',
    status: 'completed',
    source: 'https://www.nasa.gov/blogs/spacestation/2026/10/09/cygnus-xl-cargo-spacecraft-released-from-station-by-canadarm2/',
    title: 'Cygnus XL Release',
    subtitle: 'Canadarm2 unberths Cygnus · Unity Earth-facing port · Oct 9, 2026',
    inspiration: 'After nearly six months berthed to Unity’s Earth-facing port, Northrop Grumman’s Cygnus XL was detached and released by Canadarm2 at 12:44 p.m. EDT on 9 Oct 2026, about 260 miles above the Pacific. It had delivered about 11,000 lb of cargo and left with several thousand pounds of disposal items for a destructive re-entry after its 12 Oct deorbit. The arm’s base point and the release distance are illustrative.',
    epoch: '2026-10-09T15:22:00Z',
    raan: 140,
    daylightAt: 82,
    duration: 130,
    airlock: null,
    config: { nauka: true, pirs: false, prichal: true, bishop: true, irosa: ['2B', '4B', '3A', '4A', '1A', '1B'], vehicles: ['dragon', 'soyuz', 'progress'] },
    crew: [],
    armBase: { point: [1.0, -2.15, 0], dir: [0, -1, 0], tipDir: [-1, 0, 0], pole: [1, -0.4, 0] },
    vehicle: {
      kind: 'cygnus',
      label: 'Cygnus XL',
      portName: 'Unity',
      port: [-7.35, -2.28, 0],
      axis: [0, -1, 0],
      noseAlignBy: 0,
      details: [
        ['Operator', 'Northrop Grumman'],
        ['Port', 'Unity Earth-facing (nadir)'],
        ['Delivered', '≈ 11,000 lb of cargo'],
        ['Berthed', 'Nearly six months'],
        ['Release', '12:44 p.m. EDT · 9 Oct 2026'],
        ['Deorbit', '12 Oct · burns up with trash'],
      ],
    },
    views: { ev1: 'Cygnus', helmet: 'LEE cam', ev2: null },
    leeCam: true,
    startView: 'worksite',
    worksite: { target: [-6.5, -8.5, 1.0], offset: [26, -4, 24] },
    phases: [
      { t: 0, title: 'Grapple Cygnus', detail: 'Canadarm2, working from a base point on the US Lab, latches onto Cygnus’s grapple fixture.' },
      { t: 12, title: 'Unbolt from Unity', detail: 'The Common Berthing Mechanism bolts that held Cygnus to Unity’s Earth-facing port are driven out.' },
      { t: 40, title: 'Unberth', detail: 'The arm pulls Cygnus straight out of the berthing port.' },
      { t: 48, title: 'Maneuver to release', detail: 'Robotics controllers fly Cygnus away from the station to the release position below Unity.' },
      { t: 70, title: 'Release position', detail: 'Cygnus holds on the end of the arm while teams confirm “go” for release.' },
      { t: 82, title: 'Release · 12:44 p.m. EDT', detail: 'The end effector opens and Cygnus floats free, about 260 miles above the Pacific Ocean.' },
      { t: 88, title: 'Arm backs away', detail: 'Canadarm2 retreats while Cygnus drifts away from the station.' },
      { t: 95, title: 'Departure burns', detail: 'Cygnus fires its thrusters to leave the station’s vicinity. Deorbit follows on 12 Oct; it burns up over the ocean with its disposal cargo.' },
    ],
    tracks: {
      vehicle: [at(0, [-7.35, -2.28, 0]), at(39, [-7.35, -2.28, 0]), at(95, [-7.35, -30, 3]), at(110, [-40, -110, 3]), at(130, [-180, -300, 3])],
      arm: [
        at(0, [-4.3, -7.0, 0]), at(10, [-5.8, -7.0, 0]), at(40, [-5.8, -7.0, 0]), at(70, [-5.8, -16, 3]), at(82, [-5.8, -16, 3]),
        at(88, [-3.8, -15, 3]), at(130, [-3.8, -15, 3]),
      ],
    },
    scalars: {},
    payloads: [],
    attach: [
      { who: 'vehicle', to: 'arm', from: 40, until: 82, off: [-1.55, 4.72, 0] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'irosa',
    category: 'eva',
    date: '2021-06-20',
    status: 'completed',
    title: 'iROSA Installation',
    subtitle: 'US EVA · P6 truss · Power channel 2B',
    inspiration: 'Modelled on the June 2021 spacewalks in which NASA’s Shane Kimbrough and ESA’s Thomas Pesquet installed the first ISS Roll-Out Solar Array over wing 2B.',
    epoch: '2021-06-20T11:42:00Z',
    raan: 115,
    duration: 390,
    airlock: 'quest',
    config: { nauka: false, pirs: true, prichal: false, bishop: true, irosa: [], vehicles: ['dragon', 'soyuz', 'progress'] },
    crew: [
      { id: 'ev1', role: 'EV1', suit: 'emu', stripes: 'red', note: 'Red stripes · translates to the P6 worksite' },
      { id: 'ev2', role: 'EV2', suit: 'emu', stripes: 'none', note: 'Plain suit · rides Canadarm2 with the iROSA' },
    ],
    worksite: { target: [3.0, 6.5, -ZC6], offset: [16, 9, 14] },
    phases: [
      { t: 0, title: 'Hatch open · egress', detail: 'Crew Lock depressurised to vacuum. EV1 opens the outward-opening hatch and leaves first, hooking the 85-ft safety tether reel.' },
      { t: 12, title: 'Translate to P6', detail: 'EV1 moves hand-over-hand over Quest and Destiny, onto the S0 truss and out along the port truss (≈ 50 m).' },
      { t: 20, title: 'EV2 boards Canadarm2', detail: 'EV2 ingresses the Articulating Portable Foot Restraint on the arm’s end effector. The arm already holds the iROSA, extracted from the Dragon trunk by ground controllers.' },
      { t: 38, title: 'MBS translation to P3', detail: 'The Mobile Transporter carries the MBS and Canadarm2 down the rails (≈ 2.5 cm/s) to the P3 worksite.' },
      { t: 66, title: 'Arm fly-out', detail: 'Robotics officers fly EV2 and the 340 kg iROSA past the P4 arrays to the hand-off point.' },
      { t: 100, title: 'iROSA hand-off', detail: 'EV2 releases the arm foot restraint and takes the iROSA; with EV1’s help it is hand-carried to the 2B mast canister.' },
      { t: 128, title: 'Position on mod-kit bracket', detail: 'The iROSA is aligned to the modification-kit bracket installed on the mast canister during an earlier EVA.' },
      { t: 150, title: 'Bolt & connect', detail: 'Bolts torqued with the Pistol Grip Tool; power and data cables mated to the existing channel 2B wiring.' },
      { t: 196, title: 'Crew clear · unfold', detail: 'Crew moves clear of the deploy envelope. Release pins pulled, the two halves unfold.' },
      { t: 200, title: 'Roll-out deploy', detail: 'Strain energy in the composite slit-tube booms unrolls the 19 m blanket in about 10 minutes — no motor needed.' },
      { t: 212, title: 'Inspection & clean-up', detail: 'Photo documentation of the deployed iROSA, cable restraints, tool clean-up and tether checks.' },
      { t: 262, title: 'Return to Quest', detail: 'EV2 leads the translation back. Canadarm2 and the MBS return to the S0 worksite.' },
      { t: 350, title: 'Ingress', detail: 'EV2 then EV1 enter the Crew Lock. Hatch closed at PET ≈ 6:15; repressurisation ends the EVA.' },
    ],
    tracks: {
      ev1: [
        at(0, QUEST_IN, IN_LOCK), at(3, QUEST_IN, IN_LOCK), at(7, QUEST_OUT, { face: [0, 0, 1] }), at(12, QUEST_OUT, { face: [0, 0, 1] }),
        ...route(12, 70, [...usOut(0.8, -41.6), [1.2, 7.4, -42.8], [2.6, 6.9, -44.2]]),
        at(100, [2.6, 6.9, -44.2], { face: [0.4, -0.2, -0.9] }),
        at(104, [2.7, 6.9, -44.6], { face: [0.5, -0.2, -0.85] }),
        at(128, [2.8, 7.2, -44.6], { face: [0.5, -0.2, -0.85] }),
        at(150, [2.7, 6.9, -44.6], { face: [0.5, -0.2, -0.85] }),
        at(196, [2.7, 6.9, -44.6], { face: [0.5, -0.2, -0.85] }),
        at(200, [0.6, 7.6, -43.2], { face: [1, 0, -0.3] }),
        at(214, [0.6, 7.6, -43.2], { face: [1, 0, -0.3] }),
        at(222, [2.7, 6.9, -44.6], { face: [0.5, -0.2, -0.85] }),
        at(254, [2.7, 6.9, -44.6], { face: [0.5, -0.2, -0.85] }),
        at(258, [0.6, 7.6, -43.2], { face: [1, 0, -0.3] }),
        at(262, [0.6, 7.6, -43.2], { face: [1, 0, -0.3] }),
        ...route(270, 362, [[0.6, 7.6, -43.2], ...rev(usOut(0.8, -42.4))]),
        at(366, QUEST_OUT, { face: [0, 0, -1] }), at(370, QUEST_IN, IN_LOCK),
      ],
      ev2: [
        at(0, QUEST_IN, IN_LOCK), at(10, QUEST_IN, IN_LOCK), at(14, QUEST_OUT, { face: [0, 0, 1] }), at(20, QUEST_OUT, { face: [0, 0, 1] }),
        ...route(20, 32, [...QUEST_EGRESS.slice(1), ...TO_TRUSS(1.5), [0.8, 7.35, 2.6], [3.6, 7.5, 3.0]]),
        // 34 → 104 rides the arm (see attach)
        ...route(104, 128, [[3.9, 8.2, -39.2], [3.4, 8.0, -42.5], [2.6, 6.9, -49.2]]),
        at(150, [2.6, 6.9, -48.8], { face: [0.5, -0.2, 0.85] }),
        at(196, [2.6, 6.9, -48.8], { face: [0.5, -0.2, 0.85] }),
        at(200, [0.6, 7.6, -50.2], { face: [1, 0, 0.3] }),
        at(262, [0.6, 7.6, -50.2], { face: [1, 0, 0.3] }),
        ...route(262, 350, [[0.6, 7.6, -50.2], ...rev(usOut(0.8, -49.6))]),
        at(352, QUEST_OUT, { face: [0, 0, -1] }), at(356, QUEST_IN, IN_LOCK),
      ],
      arm: [
        at(0, [3.0, 6.3, 3.0]), at(38, [3.0, 6.3, 3.0]), at(66, [3.0, 6.3, -23.0]),
        at(80, [4.5, 9.5, -31.0]), at(96, [3.0, 7.2, -39.2]), at(110, [3.0, 7.2, -39.2]),
        at(135, [4.5, 9.5, -25.0]), at(160, [4.5, 9.5, -24.0]), at(190, [4.5, 9.5, 2.0]), at(205, [5.5, 9.5, 7.5]),
      ],
    },
    scalars: {
      mbs: [[0, 0], [38, 0], [66, -26], [160, -26], [190, 0]],
      hatch: [[0, 0], [1, 0], [3, 1], [372, 1], [376, 0]],
      irosa2B: [[0, 0], [150, 0], [150.05, 1]],
      deploy2B: [[0, 0], [200, 0], [212, 1]],
    },
    payloads: [
      { id: 'pkg', kind: 'irosaPackage', label: 'iROSA', show: [0, 150], keys: [at(134, IROSA_MOUNT), at(150, IROSA_MOUNT)] },
    ],
    attach: [
      { who: 'ev2', to: 'arm', from: 34, until: 104, off: [0.9, 1.0, 0], face: [1, 0, 0], up: [0, 1, 0], mode: 'ride' },
      { who: 'pkg', to: 'arm', from: 0, until: 104, off: [2.2, 0.3, 0] },
      { who: 'pkg', to: 'ev2', from: 104, until: 128, off: [1.3, -0.7, 0] },
    ],
    irosaTarget: '2B',
    power: { channel: '2B', before: 'SAW 2B ≈ 31 kW (degraded)', after: '+ iROSA ≈ 20 kW' },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'battery',
    category: 'eva',
    date: '2019-03-22',
    status: 'representative',
    title: 'Li-ion Battery Swap',
    subtitle: 'US EVA · S4 Integrated Equipment Assembly',
    inspiration: 'Modelled on the 2017–2021 power-system upgrade spacewalks that replaced 48 nickel-hydrogen batteries with 24 lithium-ion ORUs and adapter plates on the four IEAs.',
    epoch: '2019-03-22T12:01:00Z',
    raan: 210,
    duration: 370,
    airlock: 'quest',
    config: { nauka: false, pirs: true, prichal: false, bishop: false, irosa: [], vehicles: ['soyuz', 'progress'] },
    hideBattery: { side: 1, index: 0 },
    crew: [
      { id: 'ev1', role: 'EV1', suit: 'emu', stripes: 'red', note: 'Removes the old Ni-H₂ battery' },
      { id: 'ev2', role: 'EV2', suit: 'emu', stripes: 'none', note: 'Installs the new Li-ion ORU' },
    ],
    worksite: { target: [0.5, 7.8, 31.5], offset: [12, 7, -9] },
    phases: [
      { t: 0, title: 'Hatch open · egress', detail: 'Both crew members leave the Crew Lock and configure safety tethers, tools and the BRT (body restraint tether).' },
      { t: 10, title: 'Translate to S4', detail: 'Route over Quest and Destiny, up the S0 truss and out the starboard side past AMS-02 and ELC-2 (≈ 30 m).' },
      { t: 20, title: 'MBS to S3 worksite', detail: 'Canadarm2, holding a new Li-ion battery pre-staged by Dextre, rides the Mobile Transporter to S3.' },
      { t: 70, title: 'Arm to hand-off point', detail: 'The arm flies the 197 kg Li-ion ORU to just above the S4 IEA.' },
      { t: 96, title: 'Remove Ni-H₂ battery', detail: 'EV1 drives the battery’s bolt with the Pistol Grip Tool and lifts it from slot B1.' },
      { t: 100, title: 'Take new battery', detail: 'EV2 grasps the Li-ion ORU from the arm’s end effector.' },
      { t: 114, title: 'Install Li-ion ORU', detail: 'EV2 slides the new battery into slot B1 and torques the bolt.' },
      { t: 124, title: 'Old battery to arm', detail: 'EV1 hands the Ni-H₂ battery to Canadarm2 for transfer to the disposal pallet.' },
      { t: 136, title: 'Adapter plate & connectors', detail: 'Adapter plate installed in the vacated slot; power and data connectors mated.' },
      { t: 180, title: 'Power-up check', detail: 'Mission Control confirms the new battery is charging on channel 1A.' },
      { t: 215, title: 'Get-ahead tasks', detail: 'Photo survey of the IEA and MLI clean-up while the timeline allows.' },
      { t: 265, title: 'Return to Quest', detail: 'Translation back; the MBS and arm return to S0 with the old battery.' },
      { t: 337, title: 'Ingress', detail: 'EV2 then EV1 ingress. Hatch closed, repressurisation.' },
    ],
    tracks: {
      ev1: [
        at(0, QUEST_IN, IN_LOCK), at(3, QUEST_IN, IN_LOCK), at(7, QUEST_OUT, { face: [0, 0, 1] }), at(10, QUEST_OUT, { face: [0, 0, 1] }),
        ...route(10, 55, [...usOut(0.8, 29.9), [1.0, 8.0, 30.4], [1.15, 8.3, 30.85]]),
        at(96, [1.15, 8.3, 30.85], { face: [-1, -0.4, 0] }),
        at(112, [1.0, 8.6, 29.4], { face: [-1, -0.4, 0] }),
        at(128, [1.0, 8.6, 29.4], { face: [-1, -0.4, 0] }),
        at(136, [1.15, 8.3, 30.3], { face: [-1, -0.4, 0] }),
        at(215, [1.15, 8.3, 30.3], { face: [-1, -0.4, 0] }),
        at(225, [-1.6, 8.0, 32.0], { face: [1, -0.4, 0] }),
        at(273, [-1.6, 8.0, 32.0], { face: [1, -0.4, 0] }),
        ...route(273, 347, [[-1.6, 8.0, 32.0], [-0.8, 8.0, 30.0], ...rev(usOut(0.8, 29.9))]),
        at(351, QUEST_OUT, { face: [0, 0, -1] }), at(355, QUEST_IN, IN_LOCK),
      ],
      ev2: [
        at(0, QUEST_IN, IN_LOCK), at(8, QUEST_IN, IN_LOCK), at(12, QUEST_OUT, { face: [0, 0, 1] }), at(18, QUEST_OUT, { face: [0, 0, 1] }),
        ...route(18, 62, [...usOut(1.4, 32.0), [1.0, 8.0, 32.4], [1.15, 8.3, 32.75]]),
        at(92, [1.15, 8.3, 32.75], { face: [-1, -0.4, 0] }),
        at(100, [1.9, 8.35, 32.9], { face: [0.6, -0.2, -0.8] }),
        at(114, [1.15, 8.3, 31.75], { face: [-1, -0.4, 0] }),
        at(136, [1.15, 8.3, 31.6], { face: [-1, -0.4, 0] }),
        at(215, [1.15, 8.3, 31.6], { face: [-1, -0.4, 0] }),
        at(225, [1.6, 8.0, 33.4], { face: [-1, -0.4, 0] }),
        at(265, [1.6, 8.0, 33.4], { face: [-1, -0.4, 0] }),
        ...route(265, 335, [[1.6, 8.0, 33.4], [-0.6, 7.9, 33.0], ...rev(usOut(1.4, 29.9))]),
        at(339, QUEST_OUT, { face: [0, 0, -1] }), at(343, QUEST_IN, IN_LOCK),
      ],
      arm: [
        at(0, [5.5, 9.5, 7.5]), at(20, [5.5, 9.5, 7.5]), at(45, [5.0, 9.8, 26.0]), at(70, [5.0, 9.8, 26.0]),
        at(90, [2.6, 8.7, 32.0]), at(102, [2.6, 8.7, 32.0]), at(118, [-0.15, 8.26, 29.4]), at(128, [-0.15, 8.26, 29.4]),
        at(150, [4.5, 10.5, 26.0]), at(230, [4.5, 10.5, 26.0]), at(260, [5.5, 9.5, 7.5]),
      ],
    },
    scalars: {
      mbs: [[0, 0], [20, 0], [45, 22], [230, 22], [260, 0]],
      hatch: [[0, 0], [1, 0], [3, 1], [357, 1], [361, 0]],
    },
    payloads: [
      { id: 'n1', kind: 'battery', label: 'Li-ion ORU', keys: [at(124, [0.9, 7.6, 30.85]), at(132, [0, 7.41, 30.85])] },
      { id: 'o1', kind: 'batteryOld', label: 'Ni-H₂', show: [0, 262], keys: [at(0, [0, 7.41, 30.85]), at(95, [0, 7.41, 30.85])] },
    ],
    attach: [
      { who: 'n1', to: 'arm', from: 0, until: 100, off: [0, -0.55, 0] },
      { who: 'n1', to: 'ev2', from: 100, until: 114, off: [0.7, -0.2, -0.9] },
      { who: 'o1', to: 'ev1', from: 96, until: 124, off: [-1.15, -0.89, 0] },
      { who: 'o1', to: 'arm', from: 128, until: 999, off: [0, -0.55, 0] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'nauka',
    category: 'eva',
    date: '2022-04-18',
    status: 'representative',
    title: 'Nauka & ERA Outfitting',
    subtitle: 'Russian EVA · Poisk airlock · Orlan-MKS suits',
    inspiration: 'Modelled on the 2022 Roscosmos spacewalks that removed launch restraints from the European Robotic Arm, installed its control panel and checked it out on Nauka.',
    epoch: '2022-04-18T14:00:00Z',
    raan: 320,
    duration: 375,
    airlock: 'poisk',
    config: { nauka: true, pirs: false, prichal: true, bishop: true, irosa: ['2B', '4B'], vehicles: ['dragon', 'soyuz', 'progress'] },
    crew: [
      { id: 'ev1', role: 'EV1', suit: 'orlan', stripes: 'red', note: 'Orlan red stripes · EVA leader' },
      { id: 'ev2', role: 'EV2', suit: 'orlan', stripes: 'blue', note: 'Orlan blue stripes' },
    ],
    worksite: { target: [-25.0, -8.0, 1.8], offset: [12, 3, 14] },
    phases: [
      { t: 0, title: 'Poisk hatch open', detail: 'After depressurising Poisk, the EVA leader opens the outward side hatch. Orlan suits run at 40 kPa (5.8 psi) — no long pre-breathe.' },
      { t: 12, title: 'Translate to Nauka', detail: 'Hand-over-hand down Zvezda’s transfer compartment and onto Nauka, carrying the ERA control panel (IUPO).' },
      { t: 56, title: 'Remove launch restraints', detail: 'Thermal covers and launch locks taken off the ERA joints and end effectors.' },
      { t: 110, title: 'Install IUPO control panel', detail: 'The portable control panel lets an EVA cosmonaut command ERA from outside.' },
      { t: 150, title: 'ERA checkout', detail: 'ERA is commanded through joint tests and a reach to a new pose while the crew monitors from a safe position.' },
      { t: 215, title: 'Handrails & cables', detail: 'Handrails installed and cable runs routed to Nauka’s external experiment ports.' },
      { t: 265, title: 'Photo survey', detail: 'Inspection photos of Nauka’s hull and clean-up of tools.' },
      { t: 300, title: 'Return to Poisk', detail: 'Translation back up Zvezda to the Poisk hatch.' },
      { t: 344, title: 'Ingress', detail: 'Both cosmonauts back in Poisk; hatch closed and repressurised.' },
    ],
    tracks: {
      ev1: [
        at(0, POISK_IN, IN_LOCK), at(5, POISK_IN, IN_LOCK), at(8, POISK_OUT, { face: [0, 0, -1] }), at(12, POISK_OUT, { face: [0, 0, -1] }),
        ...route(12, 50, [...POISK_TO_NAUKA.slice(1), [-26.35, -6.8, 2.75]], RU_BELLY),
        at(56, [-26.35, -6.8, 2.75], { face: [0, 0, -1] }),
        at(70, [-26.0, -8.2, 2.75], { face: [0, 0, -1] }),
        at(90, [-26.6, -10.5, 2.75], { face: [0, 0, -1] }),
        at(108, [-26.35, -6.8, 2.75], { face: [0, 0, -1] }),
        at(118, [-26.0, -5.9, 2.75], { face: [0.3, 0, -0.95] }),
        at(150, [-26.35, -6.0, 2.75], { face: [0.3, 0, -0.95] }),
        at(215, [-26.35, -6.0, 2.75], { face: [0.3, 0, -0.95] }),
        at(230, [-26.9, -9.5, 2.7], { face: [0, 0, -1] }),
        at(250, [-25.2, -11.0, 2.55], { face: [0.3, 0, -0.95] }),
        at(300, [-26.35, -6.8, 2.75], { face: [0, 0, -1] }),
        ...route(306, 346, [[-26.35, -6.8, 2.75], ...rev(POISK_TO_NAUKA.slice(1))], RU_BELLY),
        at(348, POISK_OUT, { face: [0, 0, -1] }), at(352, POISK_IN, IN_LOCK),
      ],
      ev2: [
        at(0, POISK_IN, IN_LOCK), at(10, POISK_IN, IN_LOCK), at(14, POISK_OUT, { face: [0, 0, -1] }), at(18, POISK_OUT, { face: [0, 0, -1] }),
        ...route(18, 56, [...POISK_TO_NAUKA.slice(1), [-25.5, -6.0, 2.6], [-24.6, -8.4, 2.3]], RU_BELLY),
        at(60, [-24.6, -8.4, 2.3], { face: [-0.6, 0, -0.8] }),
        at(85, [-24.0, -10.8, 1.95], { face: [-0.75, 0, -0.65] }),
        at(108, [-24.6, -8.4, 2.3], { face: [-0.6, 0, -0.8] }),
        at(150, [-24.5, -4.0, 2.25], { face: [-0.6, 0, -0.8] }),
        at(215, [-24.5, -4.0, 2.25], { face: [-0.6, 0, -0.8] }),
        at(235, [-24.6, -8.4, 2.3], { face: [-0.6, 0, -0.8] }),
        at(300, [-24.6, -8.4, 2.3], { face: [-0.6, 0, -0.8] }),
        ...route(300, 338, [[-24.6, -8.4, 2.3], [-25.5, -6.0, 2.6], ...rev(POISK_TO_NAUKA.slice(1))], RU_BELLY),
        at(340, POISK_OUT, { face: [0, 0, -1] }), at(344, POISK_IN, IN_LOCK),
      ],
      era: [
        at(0, [-23.4, -18.5, 0.0]), at(150, [-23.4, -18.5, 0.0]), at(165, [-21.5, -6.0, 3.5]),
        at(180, [-19.5, -10.0, 2.0]), at(195, [-21.0, -13.0, -2.5]), at(205, [-22.0, -7.0, 2.8]), at(215, [-21.5, -6.5, 3.0]),
      ],
      arm: [at(0, [5.5, 9.5, 7.5])],
    },
    scalars: {
      hatch: [[0, 0], [2, 0], [5, 1], [355, 1], [359, 0]],
    },
    payloads: [
      { id: 'iupo', kind: 'panel', label: 'IUPO panel', keys: [at(122, [-25.7, -5.6, 2.25]), at(400, [-25.7, -5.6, 2.25])] },
    ],
    attach: [
      { who: 'iupo', to: 'ev1', from: 0, until: 115, off: [0.45, -0.2, -0.3] },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'crs35',
    category: 'vehicle',
    date: '2026-10-15',
    status: 'completed',
    source: 'https://www.nasa.gov/blogs/spacestation/2026/10/15/spacex-dragon-docks-with-science-supplies-and-roll-out-solar-arrays/',
    title: 'SpaceX CRS-35 Docking',
    subtitle: 'Cargo Dragon · Harmony zenith (IDA-3) · Oct 2026',
    inspiration: 'NASA’s 35th SpaceX resupply mission launched on a Falcon 9 from SLC-40 on 13 Oct 2026 and docked autonomously to Harmony’s space-facing port on 15 Oct after about 51 hours of phasing. It carries more than 6,300 lb of science and supplies, including the final pair of iROSAs, and stays about a month.',
    epoch: '2026-10-15T13:14:00Z',
    raan: 75,
    daylightAt: 106,
    duration: 160,
    airlock: null,
    config: { nauka: true, pirs: false, prichal: true, bishop: true, irosa: ['2B', '4B', '3A', '4A', '1A', '1B'], vehicles: ['dragon', 'soyuz', 'progress'] },
    crew: [],
    vehicle: {
      kind: 'cargoDragon',
      label: 'Dragon CRS-35',
      port: [8.4, 5.1, 0],      // IDA-3 on PMA-3, Harmony zenith
      axis: [0, 1, 0],          // docking axis (vehicle body extends along +axis)
      noseAlignBy: 58,          // minutes: from here the nose points down the docking axis
      details: [
        ['Launch', 'Falcon 9 · SLC-40 · 13 Oct 2026'],
        ['Port', 'Harmony zenith (IDA-3)'],
        ['Cargo', '> 6,300 lb science & supplies'],
        ['Trunk', 'Final iROSA pair'],
        ['Stay', '≈ 1 month · Pacific splashdown'],
      ],
    },
    views: { ev1: 'Dragon', helmet: 'Centerline cam', ev2: null },
    startView: 'ev1',
    worksite: { target: [8.4, 12, 0], offset: [45, 22, 55] },
    phases: [
      { t: 0, title: 'Approach ellipsoid', detail: 'After ≈ 51 hours of phasing, Dragon enters the 4 × 2 × 2 km approach ellipsoid behind and below the station, talking to it over the proximity link.' },
      { t: 25, title: 'Waypoint 0', detail: 'Dragon holds about 400 m below the station. NASA and SpaceX poll “go” for entering the 200 m Keep-Out Sphere.' },
      { t: 40, title: 'Keep-Out Sphere entry', detail: 'Dragon swings around the station’s forward side toward the zenith docking axis, firing its Draco thrusters in short pulses.' },
      { t: 60, title: 'Waypoint 1', detail: 'Holding ≈ 220 m directly above Harmony on the docking axis. Dragon aligns its nose with IDA-3 using its LIDAR and cameras.' },
      { t: 70, title: 'Approach to Waypoint 2', detail: 'Dragon closes down the approach corridor at ≈ 0.15 m/s.' },
      { t: 90, title: 'Waypoint 2', detail: 'Final hold 20 m from the port. Last go / no-go; the crew stand by to command a hold, retreat or abort.' },
      { t: 100, title: 'Final approach', detail: 'Dragon closes the last 20 m autonomously at a few centimetres per second.' },
      { t: 106, title: 'Soft capture', detail: 'Contact with the International Docking Adapter on Harmony’s space-facing port; capture latches engage.' },
      { t: 116, title: 'Hard capture', detail: 'Twelve structural hooks close to form a rigid, sealed connection.' },
      { t: 120, title: 'Leak checks', detail: 'The vestibule between Dragon and IDA-3 is pressurised and checked for leaks.' },
      { t: 152, title: 'Hatch open', detail: 'The crew open the hatch and start unloading: LambdaVision-1, Stellar Spheroids, ELF-Unconventional Glass 2, MINDS and station hardware. Canadarm2 will later extract the iROSA pair from the trunk.' },
    ],
    tracks: {
      vehicle: [
        at(0, [-900, -350, 0]), at(25, [8.4, -400, 0]), at(30, [8.4, -400, 0]),
        at(40, [230, -200, 0]), at(50, [240, 120, 0]), at(58, [8.4, 225.1, 0]), at(70, [8.4, 225.1, 0]),
        at(90, [8.4, 25.1, 0]), at(100, [8.4, 25.1, 0]), at(106, [8.4, 5.1, 0]),
      ],
      arm: [at(0, [5.5, 9.5, 7.5])],
    },
    scalars: {},
    payloads: [],
    attach: [],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'robotics',
    category: 'robotics',
    date: '2026-10-21',
    status: 'representative',
    title: 'Canadarm2 & Dextre: Antenna Swap',
    subtitle: 'Robotics · Ku-band antenna ORU on Z1 · no spacewalk',
    inspiration: 'A representative Mobile Servicing System task, not a replay of one dated event. Ground controllers in Houston and at CSA in Saint-Hubert command Canadarm2 to pick up Dextre, fetch a spare from an ExPRESS Logistics Carrier and swap a failed Ku-band antenna boom on the Z1 truss. This is how many ORUs (batteries, cameras, pumps) are now replaced without a spacewalk.',
    epoch: '2026-10-21T09:00:00Z',
    raan: 40,
    daylightAt: 165, // antenna swap in sunlight
    duration: 240,
    airlock: null,
    config: { nauka: true, pirs: false, prichal: true, bishop: true, irosa: ['2B', '4B', '3A', '4A', '1A', '1B'], vehicles: ['dragon', 'cargoDragon', 'soyuz', 'progress'] },
    hide: ['dextre', 'sgant'],
    crew: [],
    robotics: true,
    infoCard: {
      label: 'Mobile Servicing System',
      details: [
        ['Arm', 'Canadarm2 (SSRMS) · 17.6 m · 7 joints'],
        ['Hand', 'Dextre (SPDM) · two 3.35 m arms'],
        ['Base', 'MBS on the Mobile Transporter'],
        ['Task', 'Ku-band antenna ORU swap on Z1'],
        ['Spare', 'From ExPRESS Logistics Carrier 2 (S3)'],
        ['Control', 'Ground-commanded · NASA & CSA'],
      ],
    },
    follow: { ev1: 'arm', ev2: 'dextre' },
    views: { ev1: 'Canadarm2', ev2: 'Dextre', helmet: 'LEE cam' },
    startView: 'ev1',
    worksite: { target: [-6.5, 8.2, 0.6], offset: [11, 6, 15] },
    phases: [
      { t: 0, title: 'Robotics ops begin', detail: 'Ground controllers take the arm out of its park position. The crew is not needed; the whole job is commanded from Earth over the Ku/S-band links.' },
      { t: 12, title: 'Approach Dextre', detail: 'Canadarm2 flies its Latching End Effector over Dextre’s grapple fixture on the Mobile Base System.' },
      { t: 25, title: 'Grapple Dextre', detail: 'Snare wires close on the grapple pin and the LEE rigidises. Dextre is released from the MBS and now hangs from the end of the arm.' },
      { t: 40, title: 'MBS to S3', detail: 'The Mobile Transporter carries the MBS, Canadarm2 and Dextre down the rails to the S3 worksite (≈ 2.5 cm/s).' },
      { t: 65, title: 'Fetch the spare', detail: 'The arm positions Dextre over ExPRESS Logistics Carrier 2 on the S3 truss.' },
      { t: 75, title: 'Extract new antenna ORU', detail: 'Dextre’s right arm drives its OTCM gripper onto the spare’s fixture and unbolts it from the carrier.' },
      { t: 95, title: 'Back to S0', detail: 'MBS returns to the S0 worksite; the arm carries Dextre and the spare toward the Z1 truss on top of Unity.' },
      { t: 140, title: 'Remove failed antenna', detail: 'Dextre’s left arm grips the failed Ku-band boom-and-dish ORU, releases its bolt and pulls it off the Z1 interface plate.' },
      { t: 158, title: 'Reposition', detail: 'Canadarm2 shifts Dextre about 3 m so the right arm, holding the spare, lines up with the empty interface.' },
      { t: 168, title: 'Install new antenna', detail: 'The new ORU is inserted and its bolt driven. Power and data connect through the interface.' },
      { t: 190, title: 'Link checkout', detail: 'Flight controllers power the antenna, slew its gimbal and check the Ku-band link through a Tracking and Data Relay Satellite.' },
      { t: 205, title: 'Stow & return', detail: 'The failed unit is stowed on Dextre’s ORU platform for return on a later cargo flight. Dextre goes back to the MBS and the arm returns to park.' },
    ],
    tracks: {
      arm: [
        at(0, [5.5, 9.5, 7.5]), at(12, [3.3, 9.0, -3.1]), at(25, [3.3, 6.3, -3.1]), at(30, [3.3, 6.3, -3.1]),
        at(40, [4.5, 10.8, -2.0]), at(65, [4.5, 10.8, 20.0]), at(75, [1.0, 11.4, 26.6]), at(95, [1.0, 11.4, 26.6]),
        at(100, [2.5, 13.5, 22.5]), at(125, [2.5, 13.5, 0.5]), at(140, [-5.0, 10.6, 1.8]), at(158, [-5.0, 10.6, 1.8]),
        at(168, [-8.2, 10.6, 1.8]), at(205, [-8.2, 10.6, 1.8]), at(214, [4.5, 10.8, -2.0]), at(222, [3.3, 6.3, -3.1]),
        at(225, [3.3, 6.3, -3.1]), at(236, [5.5, 9.5, 7.5]),
      ],
    },
    scalars: {
      mbs: [[0, 0], [40, 0], [65, 22], [100, 22], [125, 0]],
    },
    payloads: [
      { id: 'dextre', kind: 'dextre', label: 'Dextre', keys: [at(0, [3.3, 4.5, -3.1]), at(28, [3.3, 4.5, -3.1]), at(230, [3.3, 4.5, -3.1])] },
      { id: 'dexL', kind: 'hand', keys: [at(146, [-6.55, 7.1, 0]), at(150, [-6.55, 7.1, 0])] },
      { id: 'dexR', kind: 'hand', keys: [at(82, [0.4, 8.3, 28.4]), at(86, [0.4, 8.3, 28.4]), at(174, [-6.55, 7.1, 0]), at(180, [-6.55, 7.1, 0])] },
      { id: 'oruNew', kind: 'antenna', label: 'Spare antenna', keys: [at(0, [0.4, 8.3, 28.4]), at(85, [0.4, 8.3, 28.4]), at(180, [-6.55, 7.1, 0])] },
      { id: 'oruOld', kind: 'antennaOld', label: 'Failed antenna', show: [0, 224], keys: [at(0, [-6.55, 7.1, 0]), at(149, [-6.55, 7.1, 0])] },
    ],
    attach: [
      { who: 'dextre', to: 'arm', from: 30, until: 224, off: [0, -1.8, 0] },
      { who: 'dexL', to: 'dextre', from: 0, until: 140, off: [-0.9, -0.5, -1.0] },
      { who: 'dexL', to: 'dextre', from: 158, until: 999, off: [-0.9, -0.5, -1.0] },
      { who: 'dexR', to: 'dextre', from: 0, until: 75, off: [0.9, -0.5, -1.0] },
      { who: 'dexR', to: 'dextre', from: 95, until: 168, off: [0.9, -0.5, -1.0] },
      { who: 'dexR', to: 'dextre', from: 190, until: 999, off: [0.9, -0.5, -1.0] },
      { who: 'oruNew', to: 'dexR', from: 86, until: 176 },
      { who: 'oruOld', to: 'dexL', from: 150, until: 999 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'orbit',
    category: 'station',
    date: '2026-10-21',
    status: 'live',
    title: 'Free Orbit',
    subtitle: 'No EVA · arrays sun-tracking · current configuration',
    inspiration: 'The station as configured since mid-2023: six iROSAs, Nauka and Prichal, Bishop airlock. Arrays and radiators track the Sun around a full orbit.',
    epoch: '2026-10-21T09:00:00Z',
    raan: 40,
    duration: 93,
    loop: true,
    sunTracking: true,
    airlock: null,
    config: { nauka: true, pirs: false, prichal: true, bishop: true, irosa: ['2B', '4B', '3A', '4A', '1A', '1B'], vehicles: ['dragon', 'cargoDragon', 'soyuz', 'progress'] },
    crew: [],
    worksite: { target: [0, 0, 0], offset: [70, 35, 90] },
    phases: [
      { t: 0, title: 'Orbital day', detail: 'SARJs turn the outboard truss at one revolution per orbit; Beta Gimbals trim each wing for the beta angle.' },
    ],
    tracks: { arm: [at(0, [5.5, 9.5, 7.5])] },
    scalars: {},
    payloads: [],
    attach: [],
  },
];
