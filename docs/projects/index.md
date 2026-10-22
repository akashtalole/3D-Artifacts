# Projects

Every project lives in its own subfolder of [`projects/`](https://github.com/akashtalole/3D-Artifacts/tree/main/projects)
and is published at `/apps/<name>/` next to its documentation.

| Project | Live app | What it shows |
| --- | --- | --- |
| [ISS EVA Spacewalk](iss-eva-spacewalk/index.md) | [Launch](../apps/iss-eva-spacewalk/) | International Space Station spacewalks — real dimensions, orbit, Sun and EVA timelines |
| [CRS-35 Launch to Docking](crs35-launch-to-docking/index.md) | [Launch](../apps/crs35-launch-to-docking/) | Falcon 9 launch, booster landing, 51 h orbit phasing and Dragon docking for NASA's CRS-35 |
| [Solar System Explorer](solar-system/index.md) | [Launch](../apps/solar-system/) | True-scale, real-time Solar System in the style of NASA's Eyes: real planet positions, time controls, flood or natural lighting |
| [AI Factory India](ai-factory-india/index.md) | [Launch](../apps/ai-factory-india/) | Illustrative 100 MW Vera Rubin NVL72 AI factory near Hyderabad, from the grid and dry coolers down to the Rubin GPU |
| [Brick Builder](brick-builder/index.md) | [Launch](../apps/brick-builder/) | Build with interlocking bricks in 3D: real dimensions, 34 parts, 24 colours, snapping, undo, replay, save |
| [Cloud Brick Architect](aws-architecture-builder/index.md) | [Launch](../apps/aws-architecture-builder/) | 2D AWS architecture building game: snap official AWS icons into VPCs and subnets, run traffic, fail an AZ |
| [CAD/CAM Studio](cad-cam-studio/index.md) | [Launch](../apps/cad-cam-studio/) | Parametric CSG part design, 2.5D milling toolpaths, material-removal simulation, G-code and STL export |
| [Forts of Swarajya](shivaji-forts/index.md) | [Launch](../apps/shivaji-forts/) | 14 forts of Chhatrapati Shivaji Maharaj on real terrain, with a Sahyadri relief map and a 1630–1680 timeline |
| [Proto Lab](proto-lab/index.md) | [Launch](../apps/proto-lab/) | Electronics prototyping with 8 boards, breadboards and 65 sensors and modules: circuit check, simulation and Arduino/MicroPython/Python code |
| [Logistics Twin](logistics-twin/index.md) | [Launch](../apps/logistics-twin/) | Fulfilment-centre digital twin: inbound, putaway, AMR picking, packing, sortation and outbound trucks, with live KPIs, bottleneck detection and scenarios |
| [Robot Cell Studio](robot-cell-studio/index.md) | [Launch](../apps/robot-cell-studio/) | Modular industrial robot builder: kinematics, payload and joint loads, IK teaching, task programs in a work cell, URDF export |
| [Yatra · Rail & ST](yatra/index.md) | [Launch](../apps/yatra/) | Mumbai–Pune by Indian Railways (Vande Bharat, express, local, freight) through the Bhor Ghat, or by MSRTC ST bus up the Khandala Ghat: stations, signals, level crossings, monsoon, night |
| [Kumbh City · Nashik](nashik-kumbh/index.md) | [Launch](../apps/nashik-kumbh/) | Simhastha Kumbh Mela crowd and transport simulator: parking hubs, shuttles, ghats and Ramkund, the akhara procession, holding areas and the ICCC, with a costed plan and an end-of-day grade |
| [Turbofan Ops](turbofan-ops/index.md) | [Launch](../apps/turbofan-ops/) | Operate a high-bypass turbofan in a 3D cutaway: auto-start, TOGA, reverse, a live Brayton cycle, EICAS gauges and eight failure scenarios |
| [Brick Studio Pro](brick-studio/index.md) | [Launch](../apps/brick-studio/) | An advanced 3D brick builder: 69 parts with stud snapping, selection editing, a stability check, automatic instructions, generators, photo mosaics, parts lists and LDraw / BrickLink export |

## Shared conventions

- **No build step.** Apps are plain ES modules. `three` is loaded from jsDelivr via an
  import map pinned to an exact version, so the folder can be served by any static host.
- **Real units.** Scenes use metres (or the natural SI unit of the subject) so that
  published dimensions can be typed in directly.
- **Data separate from code.** Specifications and scripted sequences live in
  `src/data/`, so they can be checked against sources without reading render code.
- **Modern UI.** Glass panels, a transport bar, keyboard shortcuts, deep-linkable
  state (`?mission=…&t=…&view=…`), and responsive down to phone width.
