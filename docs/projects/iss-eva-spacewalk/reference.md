# Station reference

The model is built from published dimensions. Every element below can be clicked
in the app to open the same data in the inspector panel
([`src/data/components.js`](https://github.com/akashtalole/3D-Artifacts/blob/main/projects/iss-eva-spacewalk/src/data/components.js)).

## Whole station

| | |
| --- | --- |
| Span | 109 m (truss) × 73 m (module stack incl. visiting vehicles) |
| Mass | ≈ 420,000 kg |
| Pressurised volume | 916 m³ (388 m³ habitable) |
| Orbit | ≈ 415 km, 51.64° inclination, 92.7 min period, 7.66 km/s |
| Continuously crewed | Since 2 November 2000 |

## Coordinate frame

The scene uses the ISS local-vertical / local-horizontal frame, mapped onto three.js axes:

| three.js | ISS body / LVLH | Direction |
| --- | --- | --- |
| `+x` | `+X` | Forward, along the velocity vector (Harmony, PMA-2) |
| `+y` | `−Z` | Zenith, away from Earth |
| `+z` | `+Y` | Starboard, along the starboard truss |

Units are metres. The US Lab (Destiny) is at the origin, and the truss centre-line
runs 4.9 m above it.

## Pressurised modules

| Module | Agency | Launched | Length × Ø |
| --- | --- | --- | --- |
| Zarya (FGB) | Roscosmos / NASA | 20 Nov 1998 | 12.6 × 4.1 m |
| Unity (Node 1) | NASA | 4 Dec 1998 | 5.5 × 4.6 m |
| Zvezda | Roscosmos | 12 Jul 2000 | 13.1 × 4.15 m |
| Destiny | NASA | 7 Feb 2001 | 8.5 × 4.3 m |
| Quest airlock | NASA | 12 Jul 2001 | 5.5 × 4.0 m |
| Harmony (Node 2) | NASA | 23 Oct 2007 | 7.2 × 4.4 m |
| Columbus | ESA | 7 Feb 2008 | 6.9 × 4.5 m |
| Kibo PM / ELM-PS | JAXA | 2008 | 11.2 × 4.4 m / 4.2 × 4.4 m |
| Poisk (MRM-2) | Roscosmos | 10 Nov 2009 | 4.0 × 2.55 m |
| Tranquility (Node 3) + Cupola | NASA / ESA | 8 Feb 2010 | 6.7 × 4.5 m / 1.5 × 2.95 m |
| Rassvet (MRM-1) | Roscosmos | 14 May 2010 | 6.0 × 2.35 m |
| Leonardo PMM | ASI / NASA | 24 Feb 2011 | 6.6 × 4.5 m |
| BEAM | NASA / Bigelow | 8 Apr 2016 | 4.0 × 3.2 m (expanded) |
| Bishop airlock | Nanoracks | 6 Dec 2020 | ≈ 2.1 × 1.8 m |
| Nauka (MLM) | Roscosmos | 21 Jul 2021 | 13.1 × 4.25 m |
| Prichal | Roscosmos | 24 Nov 2021 | ≈ 3.3 m sphere |
| ~~Pirs~~ | Roscosmos | 2001 – deorbited 26 Jul 2021 | 4.9 × 2.55 m |

## Truss, power and thermal

| Element | Model |
| --- | --- |
| Integrated Truss Structure | S0 (13.4 m) at the centre; S1/P1, S3/P3, then the rotating S4–S6 / P4–P6, 109 m in total. Lattice bays every ≈ 2.3 m. |
| Solar Alpha Rotary Joints | Between S3/S4 and P3/P4. Turn the outboard truss once per orbit. |
| Solar Array Wings | 8 wings, each two 4.6 m-wide blankets on a FAST mast, 35 m × 12 m. Power channels 1A/3A (S4), 1B/3B (S6), 2A/4A (P4), 2B/4B (P6). |
| Beta Gimbal Assemblies | Rotate each wing about its long axis to follow the beta angle. |
| iROSA | 19 m × 6 m roll-out arrays canted ≈ 10° over the old wings. 2B and 4B (2021), 3A and 4A (2022), 1A and 1B (2023). |
| Integrated Equipment Assemblies | On S4/P4 and S6/P6. Batteries on the zenith face, Photovoltaic Radiator below. |
| Heat Rejection System | Three radiators on each of S1 and P1, each 23.3 m × 3.4 m, on rotary joints. |
| External payloads | AMS-02 on S3 zenith; ExPRESS Logistics Carriers on S3 and P3. |

## Robotics

| Element | Model |
| --- | --- |
| Canadarm2 (SSRMS) | 17.6 m, two 7 m booms plus wrist; analytic two-link IK with an elbow-up pole. |
| Mobile Base System | Rides the Mobile Transporter rails on the forward truss face, from the S3 to the P3 worksites. |
| Dextre | Parked on the MBS. |
| ERA | 11.3 m symmetric arm on Nauka (2021 →). |
| JEM-RMS | 10 m arm over the Kibo Exposed Facility. |

## Visiting vehicles

| Vehicle | Port in the sim |
| --- | --- |
| Crew Dragon | Harmony forward (PMA-2 / IDA-2) |
| Soyuz MS | Rassvet nadir |
| Progress MS | Zvezda aft |

## Sources

- NASA, *Reference Guide to the International Space Station* (Utilization Edition, 2015)
- NASA ISS fact sheets and module pages; NASA ISS assembly sequence
- ESA (Columbus, Cupola, ERA), JAXA (Kibo), CSA (Canadarm2, Dextre, MBS), Roscosmos (Zvezda, Poisk, Nauka, Prichal)
- NASA / Redwire iROSA releases (2021–2023)
- Astronomical Almanac low-precision solar coordinates; IAU GMST expression
