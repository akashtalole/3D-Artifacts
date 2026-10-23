# Krishi Yantra · Farm tractors

Farm tractors and their implements, animated in 3D. Hitch an implement, watch it work a field, and follow a whole wheat season: ploughing paddy stubble in October to taking the grain to the mandi in April.

[Open Krishi Yantra :material-tractor:](../../apps/farm-tractors/){ .md-button .md-button--primary }
[Source on GitHub](https://github.com/akashtalole/3D-Artifacts/tree/main/projects/farm-tractors){ .md-button }

![Harvesting with a front-mounted reaper](../../assets/farm-tractors/harvest.jpg)

!!! note
    The tractors and implements are generic, with no brands. Figures (widths, speeds, field
    capacity, fuel, prices) are illustrative rules of thumb from Indian farm practice. Makers'
    manuals and local agricultural university advice govern.

## Tractors

| Tractor | Power | Drive | Weight | Lift | Indicative price |
| --- | --- | --- | --- | --- | --- |
| 35 HP | 26 kW | 2WD, ROPS canopy | 1,800 kg | 1,200 kg | ₹5.5–6.5 lakh |
| 50 HP | 37 kW | 2WD, ROPS canopy | 2,100 kg | 1,800 kg | ₹7.5–8.8 lakh |
| 75 HP | 55 kW | 4WD, closed cab | 3,200 kg | 2,500 kg | ₹12.5–15 lakh |

Each tractor has working hitches:

- a **three-point linkage**: lower links, lift arms, lift rods and a top link that follow the hitch slider;
- a **PTO shaft** at 540 rpm with cardan joints, driving the rotavator, sprayer, reaper and thresher;
- a **drawbar** for trailed implements (laser leveller, trolley);
- a **front mount** for the reaper. The front weights come off when it is fitted.

Pick a paint colour (red, blue, green or orange). The **Tractor** tab lists the specification.

![Showroom](../../assets/farm-tractors/showroom.jpg)

## Implements

| Implement | Hitch | Width | Depth | Speed | What it does |
| --- | --- | --- | --- | --- | --- |
| Mould-board plough | 3-point | 0.6 m | 20–25 cm | 4.5 km/h | Inverts the soil and buries stubble |
| Disc plough | 3-point | 0.75 m | 15–25 cm | 5 km/h | Primary tillage in hard, root-bound or stony soil |
| Disc harrow | 3-point | 1.8 m | 10–15 cm | 6 km/h | Breaks clods after ploughing |
| Tine cultivator | 3-point | 2.0 m | 8–12 cm | 6 km/h | Loosens the soil and uproots weeds |
| Rotavator | 3-point + PTO | 1.8 m | 10–15 cm | 3.5 km/h | Seedbed in one pass |
| Laser land leveller | Drawbar | 2.4 m | cut and fill | 4 km/h | Levels to ±2 cm, saving 20–30% of the water |
| Seed-cum-fertiliser drill | 3-point | 1.8 m | 4–5 cm | 5 km/h | Sows 9 rows at 20 cm with fertiliser |
| Boom sprayer | 3-point + PTO | 10 m | — | 6 km/h | Herbicide through flat-fan nozzles |
| Reaper | Front + PTO | 2.1 m | — | 3.5 km/h | Cuts and lays the crop in windrows |
| Thresher | Stationary, PTO | — | — | — | Grain and bhusa, about 1.2 t/h |
| Tipping trolley | Drawbar | 5 t | — | 20 km/h | Grain bags to the mandi |

| ![MB plough](../../assets/farm-tractors/imp-plough.jpg) | ![Disc plough](../../assets/farm-tractors/imp-disc.jpg) |
| --- | --- |
| ![Disc harrow](../../assets/farm-tractors/imp-harrow.jpg) | ![Cultivator](../../assets/farm-tractors/imp-cultivator.jpg) |
| ![Laser leveller](../../assets/farm-tractors/imp-leveller.jpg) | ![Seed drill](../../assets/farm-tractors/imp-drill.jpg) |
| ![Boom sprayer](../../assets/farm-tractors/imp-sprayer.jpg) | ![Reaper](../../assets/farm-tractors/imp-reaper.jpg) |
| ![Thresher](../../assets/farm-tractors/imp-thresher.jpg) | ![Trolley](../../assets/farm-tractors/imp-trolley.jpg) |

The **Implement** tab gives each one's purpose, parts, field capacity (width × speed × field efficiency), the tractor power it needs and an indicative price.

## Three modes

### Showroom

The tractor stands with the chosen implement. Drag **Hitch** to raise and lower it on the linkage, switch **PTO 540** on to spin the shafts, and press **Work** to run the implement in place.

### Field work

The tractor takes the implement to a 40 × 24 m field and works it in lands, with looping headland turns at each end. The soil changes behind the implement: stubble, ploughed furrows, harrowed, cultivated, levelled, rotary-tilled or drilled rows. Play at 5×, 15× or 40×. The HUD shows the area done, the real time it would take, fuel used and field capacity.

| ![Ploughing](../../assets/farm-tractors/plough.jpg) | ![Rotavator](../../assets/farm-tractors/rotavator.jpg) |
| --- | --- |
| ![Sowing](../../assets/farm-tractors/drill.jpg) | ![Spraying](../../assets/farm-tractors/sprayer.jpg) |

### Crop cycle

Rabi wheat after paddy in north-west India, in twelve stages:

| # | Date | Stage | Implement |
| --- | --- | --- | --- |
| 1 | Oct 20 | Paddy stubble | — |
| 2 | Oct 24 | Deep ploughing | Mould-board plough |
| 3 | Oct 27 | Disc harrowing | Disc harrow |
| 4 | Oct 29 | Cultivating | Cultivator |
| 5 | Nov 1 | Laser levelling | Laser leveller |
| 6 | Nov 5 | Sowing, about 100 kg/ha in 20 cm rows | Seed drill |
| 7 | Nov 26 | First irrigation at crown root initiation | — |
| 8 | Dec 8 | Weed control | Boom sprayer |
| 9 | Dec → Apr | Crop growth to golden ripeness | — |
| 10 | Apr 10 | Harvesting | Reaper |
| 11 | Apr 12 | Threshing | Thresher |
| 12 | Apr 14 | To the mandi | Trolley |

| ![Laser levelling](../../assets/farm-tractors/leveller.jpg) | ![First irrigation](../../assets/farm-tractors/irrigation.jpg) |
| --- | --- |
| ![Ripe wheat](../../assets/farm-tractors/ripe.jpg) | ![Threshing](../../assets/farm-tractors/threshing.jpg) |

![To the mandi](../../assets/farm-tractors/mandi.jpg)

## Calculator

Enter a field area in hectares or acres, and the diesel price and operator wage. For the chosen tractor and implement it gives:

- field capacity in ha/h and acre/h;
- hours of work and distance driven;
- diesel per hour (0.22 L per kW-hour × load factor), per hectare and in total;
- cost of fuel and operator, in total and per unit area;
- a check that the tractor has enough power for the implement.

| ![Calculator](../../assets/farm-tractors/calculator.jpg) | ![Crop cycle tab](../../assets/farm-tractors/cycle.jpg) |
| --- | --- |

## Cameras and links

Cameras: **Follow**, **Side**, **Rear**, **Overview** and **Cab**.

The URL hash opens a view directly:

| Option | Values |
| --- | --- |
| `hp` | 35, 50, 75 |
| `colour` | red, blue, green, orange |
| `imp` | plough, disc, harrow, cultivator, rotavator, leveller, drill, sprayer, reaper, thresher, trolley |
| `mode` | field, cycle (showroom if omitted) |
| `stage` | 0–11, with `mode=cycle` |
| `cam` | follow, side, rear, over, cab |
| `tab` | imp, calc, cycle, tractor |

For example, [`#mode=field&imp=sprayer&hp=75`](../../apps/farm-tractors/#mode=field&imp=sprayer&hp=75).

On a phone the panels stack below the scene.

![Phone](../../assets/farm-tractors/phone.jpg){ width=300 }

## Files

| File | Contents |
| --- | --- |
| `src/data.js` | Tractors, implements and the crop cycle |
| `src/tractor.js` | The tractor, its linkage, PTO and steering |
| `src/implements.js` | The eleven implements and their animation |
| `src/field.js` | The farm, painted soil, the wheat crop and field paths |
| `src/main.js` | Modes, jobs, cameras and panels |
| `src/kit.js` | Shared parts (wheels, cab, beams), from Earthmovers |
