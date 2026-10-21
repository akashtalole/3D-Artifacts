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
    id: 'irosa',
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
    id: 'orbit',
    title: 'Free Orbit',
    subtitle: 'No EVA · arrays sun-tracking · current configuration',
    inspiration: 'The station as configured since mid-2023: six iROSAs, Nauka and Prichal, Bishop airlock. Arrays and radiators track the Sun around a full orbit.',
    epoch: '2026-10-21T09:00:00Z',
    raan: 40,
    duration: 93,
    loop: true,
    sunTracking: true,
    airlock: null,
    config: { nauka: true, pirs: false, prichal: true, bishop: true, irosa: ['2B', '4B', '3A', '4A', '1A', '1B'], vehicles: ['dragon', 'soyuz', 'progress'] },
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
