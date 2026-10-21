# Operations

The app's **Operations** browser lists every scenario newest first, grouped by month. You can filter it by type (Spacewalks, Vehicles, Robotics, Station), and each card is tagged *Completed*, *Planned*, *Representative* or *Live*, with a link to the NASA source where there is one.

Each mission is a script in
[`src/data/missions.js`](https://github.com/akashtalole/3D-Artifacts/blob/main/projects/iss-eva-spacewalk/src/data/missions.js).
Times are **Phase Elapsed Time (PET)**, counted from hatch opening, as in real EVA
timelines. The tables below are generated from that file.

!!! info "About the timing"
    US spacewalks typically last 6–7 hours. The PLSS is certified for about 8.5 hours
    and EMU crews pre-breathe pure oxygen first, because the suit runs at 4.3 psi.
    The station circles Earth every ~93 minutes, so a single EVA crosses three or four
    orbital nights. The sim starts each mission in the orbital morning, and the
    iROSA mission is timed so the roll-out happens in sunlight.

## iROSA Installation

*US EVA · P6 truss · Power channel 2B* · sim date 2021-06-20 · duration 6:30 (h:mm)

Modelled on the June 2021 spacewalks in which NASA’s Shane Kimbrough and ESA’s Thomas Pesquet installed the first ISS Roll-Out Solar Array over wing 2B.

| Crew | Suit | Role |
| --- | --- | --- |
| EV1 | EMU (red stripes) | Red stripes · translates to the P6 worksite |
| EV2 | EMU | Plain suit · rides Canadarm2 with the iROSA |

| PET | Phase | What happens |
| --- | --- | --- |
| 0:00 | **Hatch open · egress** | Crew Lock depressurised to vacuum. EV1 opens the outward-opening hatch and leaves first, hooking the 85-ft safety tether reel. |
| 0:12 | **Translate to P6** | EV1 moves hand-over-hand over Quest and Destiny, onto the S0 truss and out along the port truss (≈ 50 m). |
| 0:20 | **EV2 boards Canadarm2** | EV2 ingresses the Articulating Portable Foot Restraint on the arm’s end effector. The arm already holds the iROSA, extracted from the Dragon trunk by ground controllers. |
| 0:38 | **MBS translation to P3** | The Mobile Transporter carries the MBS and Canadarm2 down the rails (≈ 2.5 cm/s) to the P3 worksite. |
| 1:06 | **Arm fly-out** | Robotics officers fly EV2 and the 340 kg iROSA past the P4 arrays to the hand-off point. |
| 1:40 | **iROSA hand-off** | EV2 releases the arm foot restraint and takes the iROSA; with EV1’s help it is hand-carried to the 2B mast canister. |
| 2:08 | **Position on mod-kit bracket** | The iROSA is aligned to the modification-kit bracket installed on the mast canister during an earlier EVA. |
| 2:30 | **Bolt & connect** | Bolts torqued with the Pistol Grip Tool; power and data cables mated to the existing channel 2B wiring. |
| 3:16 | **Crew clear · unfold** | Crew moves clear of the deploy envelope. Release pins pulled, the two halves unfold. |
| 3:20 | **Roll-out deploy** | Strain energy in the composite slit-tube booms unrolls the 19 m blanket in about 10 minutes — no motor needed. |
| 3:32 | **Inspection & clean-up** | Photo documentation of the deployed iROSA, cable restraints, tool clean-up and tether checks. |
| 4:22 | **Return to Quest** | EV2 leads the translation back. Canadarm2 and the MBS return to the S0 worksite. |
| 5:50 | **Ingress** | EV2 then EV1 enter the Crew Lock. Hatch closed at PET ≈ 6:15; repressurisation ends the EVA. |

[Open this mission](../../apps/iss-eva-spacewalk/?mission=irosa){ .md-button }

## Li-ion Battery Swap

*US EVA · S4 Integrated Equipment Assembly* · sim date 2019-03-22 · duration 6:10 (h:mm)

Modelled on the 2017–2021 power-system upgrade spacewalks that replaced 48 nickel-hydrogen batteries with 24 lithium-ion ORUs and adapter plates on the four IEAs.

| Crew | Suit | Role |
| --- | --- | --- |
| EV1 | EMU (red stripes) | Removes the old Ni-H₂ battery |
| EV2 | EMU | Installs the new Li-ion ORU |

| PET | Phase | What happens |
| --- | --- | --- |
| 0:00 | **Hatch open · egress** | Both crew members leave the Crew Lock and configure safety tethers, tools and the BRT (body restraint tether). |
| 0:10 | **Translate to S4** | Route over Quest and Destiny, up the S0 truss and out the starboard side past AMS-02 and ELC-2 (≈ 30 m). |
| 0:20 | **MBS to S3 worksite** | Canadarm2, holding a new Li-ion battery pre-staged by Dextre, rides the Mobile Transporter to S3. |
| 1:10 | **Arm to hand-off point** | The arm flies the 197 kg Li-ion ORU to just above the S4 IEA. |
| 1:36 | **Remove Ni-H₂ battery** | EV1 drives the battery’s bolt with the Pistol Grip Tool and lifts it from slot B1. |
| 1:40 | **Take new battery** | EV2 grasps the Li-ion ORU from the arm’s end effector. |
| 1:54 | **Install Li-ion ORU** | EV2 slides the new battery into slot B1 and torques the bolt. |
| 2:04 | **Old battery to arm** | EV1 hands the Ni-H₂ battery to Canadarm2 for transfer to the disposal pallet. |
| 2:16 | **Adapter plate & connectors** | Adapter plate installed in the vacated slot; power and data connectors mated. |
| 3:00 | **Power-up check** | Mission Control confirms the new battery is charging on channel 1A. |
| 3:35 | **Get-ahead tasks** | Photo survey of the IEA and MLI clean-up while the timeline allows. |
| 4:25 | **Return to Quest** | Translation back; the MBS and arm return to S0 with the old battery. |
| 5:37 | **Ingress** | EV2 then EV1 ingress. Hatch closed, repressurisation. |

[Open this mission](../../apps/iss-eva-spacewalk/?mission=battery){ .md-button }

## Nauka & ERA Outfitting

*Russian EVA · Poisk airlock · Orlan-MKS suits* · sim date 2022-04-18 · duration 6:15 (h:mm)

Modelled on the 2022 Roscosmos spacewalks that removed launch restraints from the European Robotic Arm, installed its control panel and checked it out on Nauka.

| Crew | Suit | Role |
| --- | --- | --- |
| EV1 | Orlan-MKS (red stripes) | Orlan red stripes · EVA leader |
| EV2 | Orlan-MKS (blue stripes) | Orlan blue stripes |

| PET | Phase | What happens |
| --- | --- | --- |
| 0:00 | **Poisk hatch open** | After depressurising Poisk, the EVA leader opens the outward side hatch. Orlan suits run at 40 kPa (5.8 psi) — no long pre-breathe. |
| 0:12 | **Translate to Nauka** | Hand-over-hand down Zvezda’s transfer compartment and onto Nauka, carrying the ERA control panel (IUPO). |
| 0:56 | **Remove launch restraints** | Thermal covers and launch locks taken off the ERA joints and end effectors. |
| 1:50 | **Install IUPO control panel** | The portable control panel lets an EVA cosmonaut command ERA from outside. |
| 2:30 | **ERA checkout** | ERA is commanded through joint tests and a reach to a new pose while the crew monitors from a safe position. |
| 3:35 | **Handrails & cables** | Handrails installed and cable runs routed to Nauka’s external experiment ports. |
| 4:25 | **Photo survey** | Inspection photos of Nauka’s hull and clean-up of tools. |
| 5:00 | **Return to Poisk** | Translation back up Zvezda to the Poisk hatch. |
| 5:44 | **Ingress** | Both cosmonauts back in Poisk; hatch closed and repressurised. |

[Open this mission](../../apps/iss-eva-spacewalk/?mission=nauka){ .md-button }

## SpaceX CRS-35 Docking (visiting vehicle)

*Cargo Dragon · Harmony zenith (IDA-3) · Oct 2026* · sim date 2026-10-15 · duration 2:40 (h:mm)

NASA’s 35th SpaceX resupply mission launched on a Falcon 9 from SLC-40 on 13 Oct 2026 and docked autonomously to Harmony’s space-facing port on 15 Oct after about 51 hours of phasing. It carries more than 6,300 lb of science and supplies, including the final pair of iROSAs, and stays about a month.

| | |
| --- | --- |
| Launch | Falcon 9 · SLC-40 · 13 Oct 2026 |
| Port | Harmony zenith (IDA-3) |
| Cargo | > 6,300 lb science & supplies |
| Trunk | Final iROSA pair |
| Stay | ≈ 1 month · Pacific splashdown |

| PET | Phase | What happens |
| --- | --- | --- |
| 0:00 | **Approach ellipsoid** | After ≈ 51 hours of phasing, Dragon enters the 4 × 2 × 2 km approach ellipsoid behind and below the station, talking to it over the proximity link. |
| 0:25 | **Waypoint 0** | Dragon holds about 400 m below the station. NASA and SpaceX poll “go” for entering the 200 m Keep-Out Sphere. |
| 0:40 | **Keep-Out Sphere entry** | Dragon swings around the station’s forward side toward the zenith docking axis, firing its Draco thrusters in short pulses. |
| 1:00 | **Waypoint 1** | Holding ≈ 220 m directly above Harmony on the docking axis. Dragon aligns its nose with IDA-3 using its LIDAR and cameras. |
| 1:10 | **Approach to Waypoint 2** | Dragon closes down the approach corridor at ≈ 0.15 m/s. |
| 1:30 | **Waypoint 2** | Final hold 20 m from the port. Last go / no-go; the crew stand by to command a hold, retreat or abort. |
| 1:40 | **Final approach** | Dragon closes the last 20 m autonomously at a few centimetres per second. |
| 1:46 | **Soft capture** | Contact with the International Docking Adapter on Harmony’s space-facing port; capture latches engage. |
| 1:56 | **Hard capture** | Twelve structural hooks close to form a rigid, sealed connection. |
| 2:00 | **Leak checks** | The vestibule between Dragon and IDA-3 is pressurised and checked for leaks. |
| 2:32 | **Hatch open** | The crew open the hatch and start unloading: LambdaVision-1, Stellar Spheroids, ELF-Unconventional Glass 2, MINDS and station hardware. Canadarm2 will later extract the iROSA pair from the trunk. |

[Open this mission](../../apps/iss-eva-spacewalk/?mission=crs35){ .md-button }

Dragon follows the standard rendezvous profile: Waypoint 0 below the station, a fly-around outside the 200 m Keep-Out Sphere, Waypoint 1 (≈ 220 m) and Waypoint 2 (20 m) on the docking axis, then autonomous final approach. The **Zones** toggle shows the Keep-Out Sphere and approach corridor; **Centerline cam** looks up the docking axis from IDA-3.

Sources: [NASA CRS-35 mission overview](https://www.nasa.gov/general/nasas-spacex-35th-commercial-resupply-mission-overview/), [Space.com docking coverage](https://www.space.com/space-exploration/launches-spacecraft/spacex-crs-35-iss-cargo-mission-docking).

## Canadarm2 & Dextre: antenna swap (robotics)

*Robotics · Ku-band antenna ORU on Z1 · no spacewalk* · sim date 2026-10-21 · duration 4:00 (h:mm)

A representative Mobile Servicing System task, not a replay of one dated event. Ground controllers in Houston and at CSA in Saint-Hubert command Canadarm2 to pick up Dextre, fetch a spare from an ExPRESS Logistics Carrier and swap a failed Ku-band antenna boom on the Z1 truss. This is how many ORUs (batteries, cameras, pumps) are now replaced without a spacewalk.

| | |
| --- | --- |
| Arm | Canadarm2 (SSRMS) · 17.6 m · 7 joints |
| Hand | Dextre (SPDM) · two 3.35 m arms |
| Base | MBS on the Mobile Transporter |
| Task | Ku-band antenna ORU swap on Z1 |
| Spare | From ExPRESS Logistics Carrier 2 (S3) |
| Control | Ground-commanded · NASA & CSA |

| PET | Phase | What happens |
| --- | --- | --- |
| 0:00 | **Robotics ops begin** | Ground controllers take the arm out of its park position. The crew is not needed; the whole job is commanded from Earth over the Ku/S-band links. |
| 0:12 | **Approach Dextre** | Canadarm2 flies its Latching End Effector over Dextre’s grapple fixture on the Mobile Base System. |
| 0:25 | **Grapple Dextre** | Snare wires close on the grapple pin and the LEE rigidises. Dextre is released from the MBS and now hangs from the end of the arm. |
| 0:40 | **MBS to S3** | The Mobile Transporter carries the MBS, Canadarm2 and Dextre down the rails to the S3 worksite (≈ 2.5 cm/s). |
| 1:05 | **Fetch the spare** | The arm positions Dextre over ExPRESS Logistics Carrier 2 on the S3 truss. |
| 1:15 | **Extract new antenna ORU** | Dextre’s right arm drives its OTCM gripper onto the spare’s fixture and unbolts it from the carrier. |
| 1:35 | **Back to S0** | MBS returns to the S0 worksite; the arm carries Dextre and the spare toward the Z1 truss on top of Unity. |
| 2:20 | **Remove failed antenna** | Dextre’s left arm grips the failed Ku-band boom-and-dish ORU, releases its bolt and pulls it off the Z1 interface plate. |
| 2:38 | **Reposition** | Canadarm2 shifts Dextre about 3 m so the right arm, holding the spare, lines up with the empty interface. |
| 2:48 | **Install new antenna** | The new ORU is inserted and its bolt driven. Power and data connect through the interface. |
| 3:10 | **Link checkout** | Flight controllers power the antenna, slew its gimbal and check the Ku-band link through a Tracking and Data Relay Satellite. |
| 3:25 | **Stow & return** | The failed unit is stowed on Dextre’s ORU platform for return on a later cargo flight. Dextre goes back to the MBS and the arm returns to park. |

[Open this mission](../../apps/iss-eva-spacewalk/?mission=robotics){ .md-button }

The arm, Dextre's two arms and the hand-offs use the same keyframe and attachment system as the spacewalks: Dextre rides the arm's end effector, Dextre's hands follow invisible markers, and each antenna unit rides a hand. Views: **Canadarm2** follows the end effector, **Dextre** follows the robot, **LEE cam** looks down past the end effector.

## Final iROSA Installs

*US EVA · Menon & Kutryk · Oct 29 & Nov 5, 2026* · sim date 2026-10-29 · duration 6:30 (h:mm)

NASA’s Anil Menon and CSA’s Joshua Kutryk are scheduled to install the last roll-out solar arrays, delivered by CRS-35, in spacewalks on 29 Oct and 5 Nov 2026, finishing the power upgrade (“up to 30 percent” more generation). NASA has not said which wing comes first; the sim shows wing 2A on P4, and which crew member rides the arm is illustrative.

| Crew | Suit | Role |
| --- | --- | --- |
| EV1 | EMU (red stripes) | Translates to the P4 worksite |
| EV2 | EMU | Rides Canadarm2 with the iROSA |

| PET | Phase | What happens |
| --- | --- | --- |
| 0:00 | **Hatch open · egress** | Crew Lock depressurised; both spacewalkers leave Quest and set up safety tethers. Menon configured the tools and inspected the tethers in Quest beforehand. |
| 0:12 | **Translate to P4** | EV1 moves hand-over-hand along the port truss to the P4 power module (≈ 35 m). |
| 0:20 | **EV2 boards Canadarm2** | EV2 ingresses the foot restraint on the arm, which holds one of the two iROSAs CRS-35 delivered in Dragon’s trunk. |
| 0:38 | **MBS to P3** | The Mobile Transporter carries the arm to the P3 worksite. |
| 1:06 | **Arm fly-over** | Robotics officers fly EV2 and the iROSA over the truss to the aft side of P4, where wing 2A extends. |
| 1:40 | **Hand-off** | EV2 leaves the arm and carries the iROSA to the 2A mast canister with EV1. |
| 2:08 | **Mount on bracket** | The iROSA is aligned with the modification-kit bracket on the mast canister. |
| 2:30 | **Bolt & connect** | Bolts torqued and cables mated to channel 2A. |
| 3:16 | **Crew clear · unfold** | Crew moves clear of the deploy envelope and the two halves unfold. |
| 3:20 | **Roll-out deploy** | The blanket unrolls in about 10 minutes, driven by the stored strain energy in its booms. |
| 3:32 | **Inspection & clean-up** | Photo survey, cable restraints and tool clean-up. The second spacewalk on 5 Nov installs the other iROSA. |
| 4:22 | **Return to Quest** | Translation back; Canadarm2 and the MBS return to S0. |
| 5:50 | **Ingress** | Both crew back in the Crew Lock; hatch closed, repressurisation. |

[Open this mission](../../apps/iss-eva-spacewalk/?mission=irosa2026){ .md-button }

## Z1 Antenna Replacement

*US EVA · Menon & Adenot · Aug 25, 2026 · 6 h 30 min* · sim date 2026-08-25 · duration 6:30 (h:mm)

NASA’s Anil Menon and ESA’s Sophie Adenot spent 6 hours 30 minutes replacing a failed high-speed space-to-ground antenna with a spare on the Z1 truss above Unity, then made the connections to activate it. Menon worked from a foot restraint on Canadarm2’s end effector. Where the spare and the failed unit were stowed is illustrative.

| Crew | Suit | Role |
| --- | --- | --- |
| Adenot | EMU | ESA · works from the Z1 truss |
| Menon | EMU (red stripes) | NASA · rides Canadarm2 (stripes illustrative) |

| PET | Phase | What happens |
| --- | --- | --- |
| 0:00 | **Hatch open · egress** | Both spacewalkers leave the Quest Crew Lock and set up their safety tethers. |
| 0:12 | **Adenot to Z1** | Adenot climbs over Quest and Unity to the top of the Z1 truss, where the antenna boom stands. |
| 0:20 | **Menon on Canadarm2** | Menon ingresses the foot restraint on Canadarm2’s latching end effector. The spare antenna rides alongside on the arm. |
| 0:40 | **Arm to the worksite** | Robotics officers fly Menon and the spare over the S0 truss to the Z1 antenna. |
| 1:02 | **Disconnect failed antenna** | Connectors demated and the boom’s attachment bolt released. |
| 1:35 | **Remove failed antenna** | Menon lifts the failed boom-and-dish unit off the Z1 interface plate while on the arm. |
| 1:50 | **Install the spare** | The arm positions the spare on the interface plate; Adenot guides it in and drives the bolt. |
| 2:04 | **Connect & activate** | Power and data connectors mated so flight controllers can activate the new antenna. |
| 2:55 | **Stow failed unit** | The arm carries Menon and the failed antenna back over S0, where it is temporarily stowed. |
| 3:50 | **Get-ahead tasks** | Clean-up and photo documentation while the timeline allows. |
| 4:50 | **Return to Quest** | Both crew translate back to the airlock. |
| 5:58 | **Ingress** | Hatch closed at about 6 h 20 min; repressurisation ends the 6 h 30 min spacewalk. |

[Open this mission](../../apps/iss-eva-spacewalk/?mission=z1antenna){ .md-button }

## Cygnus XL Release

*Canadarm2 unberths Cygnus · Unity Earth-facing port · Oct 9, 2026* · sim date 2026-10-09 · duration 2:10 (h:mm)

After nearly six months berthed to Unity’s Earth-facing port, Northrop Grumman’s Cygnus XL was detached and released by Canadarm2 at 12:44 p.m. EDT on 9 Oct 2026, about 260 miles above the Pacific. It had delivered about 11,000 lb of cargo and left with several thousand pounds of disposal items for a destructive re-entry after its 12 Oct deorbit. The arm’s base point and the release distance are illustrative.

| | |
| --- | --- |
| Operator | Northrop Grumman |
| Port | Unity Earth-facing (nadir) |
| Delivered | ≈ 11,000 lb of cargo |
| Berthed | Nearly six months |
| Release | 12:44 p.m. EDT · 9 Oct 2026 |
| Deorbit | 12 Oct · burns up with trash |

| PET | Phase | What happens |
| --- | --- | --- |
| 0:00 | **Grapple Cygnus** | Canadarm2, working from a base point on the US Lab, latches onto Cygnus’s grapple fixture. |
| 0:12 | **Unbolt from Unity** | The Common Berthing Mechanism bolts that held Cygnus to Unity’s Earth-facing port are driven out. |
| 0:40 | **Unberth** | The arm pulls Cygnus straight out of the berthing port. |
| 0:48 | **Maneuver to release** | Robotics controllers fly Cygnus away from the station to the release position below Unity. |
| 1:10 | **Release position** | Cygnus holds on the end of the arm while teams confirm “go” for release. |
| 1:22 | **Release · 12:44 p.m. EDT** | The end effector opens and Cygnus floats free, about 260 miles above the Pacific Ocean. |
| 1:28 | **Arm backs away** | Canadarm2 retreats while Cygnus drifts away from the station. |
| 1:35 | **Departure burns** | Cygnus fires its thrusters to leave the station’s vicinity. Deorbit follows on 12 Oct; it burns up over the ocean with its disposal cargo. |

[Open this mission](../../apps/iss-eva-spacewalk/?mission=cygnus){ .md-button }

These three operations come from NASA's [Space Station blog](https://www.nasa.gov/blogs/spacestation/) (Expedition 75). Where NASA did not publish a detail (which wing gets the first 2026 iROSA, where the failed antenna was stowed, Canadarm2's base point for the Cygnus release), the sim makes an illustrative choice and says so in the app.

## Free orbit

No crew outside. The station is shown in its current configuration (six iROSAs,
Nauka, Prichal, Bishop) and loops one orbit. The SARJs turn once per revolution,
the Beta Gimbals trim each wing for the beta angle, and the radiators turn edge-on
to the Sun.

[Open free orbit](../../apps/iss-eva-spacewalk/?mission=orbit){ .md-button }

## Writing a new mission

A mission is a plain object:

```js
{
  id: 'my-eva', title: '…', subtitle: '…', inspiration: '…',
  epoch: '2024-01-01T12:00:00Z',   // sets Sun position & Earth rotation
  raan: 120,                        // orbit plane orientation (deg)
  duration: 390,                    // minutes
  airlock: 'quest',                 // 'quest' | 'poisk' — tether anchor & hatch
  config: { nauka: true, pirs: false, prichal: true, bishop: true,
            irosa: ['2B', '4B'], vehicles: ['dragon', 'soyuz', 'progress'] },
  crew: [{ id: 'ev1', role: 'EV1', suit: 'emu', stripes: 'red', note: '…' }],
  phases: [{ t: 0, title: 'Hatch open', detail: '…' }],
  tracks: {
    ev1: [ /* { t, p:[x,y,z], face?, up?, belly? } */ ],
    arm: [ /* Canadarm2 end-effector keys */ ],
    era: [ /* ERA end-effector keys */ ],
  },
  scalars: { mbs: [[t, z]], hatch: [[t, 0..1]] },
  payloads: [{ id, kind: 'battery' | 'batteryOld' | 'irosaPackage' | 'panel', keys, show }],
  attach:   [{ who, to, from, until, off:[x,y,z], face?, up?, mode? }],
}
```

- Positions are station-frame metres (`x` forward, `y` zenith, `z` starboard). The
  helpers `route()` and `trussTopRoute()` lay out hand-over-hand paths along the
  truss, including climbing over AMS-02, the ELCs and the IEAs.
- `attach` lets one thing ride another: an astronaut on the arm's foot restraint,
  a battery in a crew member's hands. Boundary keys are inserted automatically, so
  hand-offs glide rather than jump.
- While a crew member is moving they translate head-first, with `belly` (default
  nadir) facing the structure. When stationary they use `face` and `up`.
