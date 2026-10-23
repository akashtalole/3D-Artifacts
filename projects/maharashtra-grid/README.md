# Urja Maharashtra · State power grid

Maharashtra's electricity system in three.js, from plant to plug, dispatched every 15 minutes. It follows the three state companies:

- **Mahagenco** (MSPGCL) generates.
- **Mahapareshan** (MSETCL) transmits.
- **Mahavitaran** (MSEDCL) distributes.

- **State map:** the Konkan, the Sahyadri, the Deccan plateau and the Satpura in relief, with the Godavari, Krishna, Koyna, Tapi and Wainganga rivers. Stations sit at their locations, each with a live output column inside a capacity sleeve and a ring for its owner. Stations shown:
  - **Mahagenco:** Chandrapur, Koradi, Khaperkheda, Bhusawal, Parli, Nashik and Paras coal; Uran gas; Koyna hydro; Ghatghar pumped storage; Sakri solar.
  - **Private:** Tiroda, Ratnagiri, Amravati, Dahanu, Trombay and the Tata hydros.
  - **Central:** Mauda, Solapur and Tarapur.
  - **Renewables:** wind on the Satara and Dhule ridges, solar parks, MSKVY 2.0 farm-feeder solar and rooftop solar.
- **Network:** 20 Mahapareshan EHV substations joined by 765, 400 and 220 kV lines on towers, the ±500 kV Chandrapur–Padghe HVDC link, and ties to Gujarat, Madhya Pradesh, Chhattisgarh, Telangana and Karnataka. Dots run along every line in the direction of flow, coloured by loading.
- **Close-up sites** (1 unit = 1 m):
  - Koradi coal station: three 660 MW units with boilers, chimneys, cooling towers, a coal yard, a conveyor, a coal train and a switchyard.
  - Koyna dam: Shivajisagar lake, spillway gates, penstocks and the powerhouse tailrace.
  - An MSKVY solar plant with tracking panels, a 33/11 kV substation and farm feeders to pumps.
  - A Satara wind ridge.
  - Padghe: the 400 kV substation and the HVDC converter.
  - A Mahavitaran distribution area: a 33/11 kV substation, a town feeder with pole transformers and rooftop solar, and a farm feeder.
- **Simulation** (`src/grid.js`):
  - Demand by area and by consumer type (industry, homes, commercial, farm pumps) for a summer, monsoon or winter day.
  - Merit-order dispatch in 15-minute blocks, with minimum technical load and ramp limits.
  - Koyna water budgeted onto the highest net-load hours, and Ghatghar pumping at the solar trough.
  - Purchases from the central share and the power exchange, at a day-shaped price.
  - A DC load flow on the network, with N-1 checks.
  - The frequency dip and DSM charges after a trip.
- **Scenarios:** heatwave; MSKVY 2.0 solar farm feeders (on by default); a 660 MW unit trip at Koradi; an HVDC outage; an Aurangabad–Pune 765 kV trip; a coal shortage at Chandrapur; a cloud bank over Marathwada.
- **Panels:**
  - **Overview:** tiles, a stacked generation-by-source chart and energy by source.
  - **Mahagenco:** every station's output against capacity, cost and state.
  - **Mahapareshan:** line loadings, the worst N-1 case, the HVDC link and flows on each border.
  - **Mahavitaran:** load by area and consumer type, rooftop solar and the farm-feeder schedule.
  - **System:** frequency, the trip event, DSM, the exchange price, an MSKVY on/off comparison and who does what.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#view=vidarbha&t=19
# or   http://localhost:8000/#view=coal&scen=trip&tab=sys
```

Hash options:

| Option | Values |
| --- | --- |
| `season` | `summer`, `monsoon` or `winter` |
| `t` | start hour |
| `speed` | `60`, `600` or `3600` |
| `view` | `state`, `vidarbha`, `mumbai`, `koyna`, `marathwada`, `coal`, `hydro`, `solar`, `wind`, `sub` or `dist` |
| `tab` | `over`, `gen`, `tx`, `dist` or `sys` |
| `scen` | a comma-separated list: `heat`, `trip`, `hvdc`, `line`, `coal`, `clouds` |
| `mskvy` | `0` turns MSKVY 2.0 off |

Capacities, locations, costs and the network are approximate and simplified for illustration. SLDC, MERC and the companies' own reports govern. `src/charts.js` and `src/labels.js` are shared with `projects/polyhouse-vertical-farm`.

Docs: `docs/projects/maharashtra-grid/`.
