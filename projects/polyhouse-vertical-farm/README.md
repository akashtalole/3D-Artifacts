# Harit Ghar · Polyhouse and vertical farm

A polyhouse and a vertical farm in three.js, run by IoT sensors and AI. Both facilities run on a live climate model, and you can watch three control strategies side by side: manual, rule-based and AI.

- **Polyhouse:** a three-bay naturally ventilated polyhouse (NVPH), 24 × 40 m (960 m²), with gothic arches.
  - Climate kit: roll-up side curtains behind insect net, ridge vent flaps, an aluminised shade screen, a fan wall (6 fans) and a cellulose pad wall, and fogging lines.
  - Crop: 12 drip-irrigated beds of coloured capsicum, tomato or cucumber trained up strings.
  - Outside: a fertigation shed (stock tanks A, B and acid, venturi manifold, filters, pump), a water tank, a weather station and an anteroom with a foot bath.
- **Vertical farm:** an insulated 14 × 20 m room with four 16 m racks of six NFT tiers (9,216 plant sites, 461 m²) under LED bars.
  - Handling: harvest lifts and a conveyor to the packing table.
  - Services: a nutrient room (tanks, dosing pumps, UV steriliser, chiller), HVAC with ducted supply and visible airflow, CO₂ cylinders, a dehumidifier and a germination shelf.
  - Crops: butterhead lettuce, basil or baby spinach.
- **Climate physics** (`src/sim.js`):
  - Polyhouse: an energy, water-vapour and CO₂ balance covering solar gain through cover and screen, wind- and stack-driven ventilation, fan-and-pad evaporative cooling (wet-bulb approach), fogging, transpiration, photosynthesis, substrate moisture per bed and fertigation EC.
  - Vertical farm: LED heat, HVAC with outdoor-temperature-dependent COP, dehumidification and condensate recovery, CO₂ dosing and leakage, nutrient EC drift, and logistic head growth per tier.
  - Weather: a typical summer, monsoon or winter day near Pune.
- **IoT** (`src/iot.js`):
  - Polyhouse: four climate nodes, 12 bed-moisture probes, and fertigation, pad-pump and weather-station nodes on LoRaWAN to a gateway.
  - Vertical farm: rack, nutrient, flow and HVAC nodes on Wi-Fi to an edge gateway.
  - Packets fly to the gateway in 3D. The Dashboard shows the node table and a live MQTT feed.
- **AI:**
  - **Model-predictive climate control:** every 10 minutes it simulates 51 plans an hour ahead and picks the one with the best score (stress + wet leaves + power and water − crop value of photosynthesis). It explains its choice against the best plan that changes one thing.
  - **Sensor-based irrigation:** per-bed valves open on probe moisture and the light sum.
  - **Anomaly detection:**
    - Polyhouse: sensor drift (redundant nodes); pad-pump failure (model residual); clogged drippers (moisture and valve open-time); fertigation EC; gateway loss with edge fallback.
    - Vertical farm: HVAC trip (auto-dims the LEDs), NFT pump failure (switches to standby), lost airflow, LED driver failure and EC probe drift.
  - **Plant-health vision** (simulated): a scouting robot in the polyhouse and a camera AGV in the vertical farm flag disease and tipburn early.
  - **Photoperiod optimiser:** shifts the vertical farm's lights to the cheapest tariff hours.
  - **Forecasts:** a yield forecast for the polyhouse and a 7-day harvest forecast for the vertical farm.
- **Panels:**
  - **Dashboard:** live tiles, 24-hour charts, the node table and the MQTT feed.
  - **Control:** actuators and setpoints.
  - **AI:** the plan, alerts and detections, and a 24-hour rules-vs-AI comparison.
  - **Crop:** beds or tiers.
  - **Economics:** capex, subsidy, margin, payback and the value of IoT + AI.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#season=monsoon&t=15
# or   http://localhost:8000/#fac=vf&tab=ai&fault=hvac
```

Hash options:

| Option | Values |
| --- | --- |
| `fac` | `ph` or `vf` |
| `season` | `summer`, `monsoon` or `winter` |
| `crop` | capsicum, tomato, cucumber, lettuce, basil or spinach |
| `mode` | `manual`, `rules` or `ai` |
| `speed` | `60`, `600` or `3600` sim-seconds per second |
| `t` | start hour |
| `cam` | a camera name from the toolbar |
| `tab` | `dash`, `ctrl`, `ai`, `crop` or `eco` |
| `fault` | a comma-separated list of faults |
| `iot` | `0` hides the network |

The equipment is generic. The physics and crop figures are simplified and illustrative, and the vision detections are simulated. Crop advisories, makers' data and current scheme guidelines govern.

Docs: `docs/projects/polyhouse-vertical-farm/`.
