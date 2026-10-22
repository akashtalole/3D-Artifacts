---
hide:
  - navigation
  - toc
---

<div class="hero" markdown>

# 3D Artifacts

Interactive **three.js** visualisations of real engineering — built to published
dimensions, driven by real physics, wrapped in a modern UI. Each project is a
standalone web app that runs in the browser with no build step.

[Open the ISS EVA simulator :material-rocket-launch:](apps/iss-eva-spacewalk/){ .md-button .md-button--primary }
[Browse projects](projects/index.md){ .md-button }

</div>

## Projects

<div class="gallery" markdown>

<div class="card" markdown>
[![ISS EVA simulator](assets/iss-eva-spacewalk/overview.jpg)](apps/iss-eva-spacewalk/)

### ISS EVA Spacewalk

The International Space Station at true scale (109 m × 73 m) in a real orbit
with a real Sun. Play NASA and Roscosmos spacewalks: iROSA installation,
battery swaps and Nauka outfitting.

[Launch app](apps/iss-eva-spacewalk/) · [Documentation](projects/iss-eva-spacewalk/index.md)
</div>

<div class="card" markdown>
[![CRS-35 launch to docking](assets/crs35-launch-to-docking/pad.jpg)](apps/crs35-launch-to-docking/)

### CRS-35: Launch to Docking

NASA's SpaceX CRS-35 in three acts: pre-dawn Falcon 9 launch and booster landing,
51 hours of orbit phasing, and Dragon's autonomous docking to Harmony.

[Launch app](apps/crs35-launch-to-docking/) · [Documentation](projects/crs35-launch-to-docking/index.md)
</div>

<div class="card" markdown>
[![Solar System Explorer](assets/solar-system/home.jpg)](apps/solar-system/)

### Solar System Explorer

A true-scale, real-time Solar System in the style of NASA's Eyes. Every planet is
where it really is today. Fly between worlds and run time forwards or backwards.

[Launch app](apps/solar-system/) · [Documentation](projects/solar-system/index.md)
</div>

<div class="card" markdown>
[![AI Factory India](assets/ai-factory-india/campus.jpg)](apps/ai-factory-india/)

### AI Factory India

A 100 MW Vera Rubin NVL72 AI factory near Hyderabad, from the 220 kV grid and the
dry coolers down to an exploded compute tray, with the live Indian sun and climate.

[Launch app](apps/ai-factory-india/) · [Documentation](projects/ai-factory-india/index.md)
</div>

<div class="card" markdown>
[![Brick Builder](assets/brick-builder/cottage.jpg)](apps/brick-builder/)

### Brick Builder

Snap interlocking bricks onto a baseplate in 3D, in the real 8 mm stud system: bricks,
plates, tiles, slopes and rounds in 24 colours, with undo, replay and export.

[Launch app](apps/brick-builder/) · [Documentation](projects/brick-builder/index.md)
</div>

<div class="card" markdown>
[![Cloud Brick Architect](assets/aws-architecture-builder/ha-chaos.jpg)](apps/aws-architecture-builder/)

### Cloud Brick Architect

Build AWS architectures like bricks: six missions with live goal checks, budgets and
stars, animated traffic, and an Availability Zone failure test.

[Launch app](apps/aws-architecture-builder/) · [Documentation](projects/aws-architecture-builder/index.md)
</div>

<div class="card" markdown>
[![CAD/CAM Studio](assets/cad-cam-studio/compare.jpg)](apps/cad-cam-studio/)

### CAD/CAM Studio

Design a machined part from parametric features, then generate toolpaths, simulate the
cut against the design and export G-code and STL.

[Launch app](apps/cad-cam-studio/) · [Documentation](projects/cad-cam-studio/index.md)
</div>

<div class="card" markdown>
[![Forts of Swarajya](assets/shivaji-forts/raigad.jpg)](apps/shivaji-forts/)

### गडकिल्ले · Forts of Swarajya

Fourteen forts of Chhatrapati Shivaji Maharaj on real terrain, from Shivneri and Raigad
to Sindhudurg, with walls traced from the cliffs and a timeline of his life.

[Launch app](apps/shivaji-forts/) · [Documentation](projects/shivaji-forts/index.md)
</div>

<div class="card" markdown>
[![Proto Lab](assets/proto-lab/parking.jpg)](apps/proto-lab/)

### Proto Lab

Prototype electronics in 3D: Arduino, ESP32 and Raspberry Pi boards, breadboards and 65
sensors and modules, with a circuit check, simulation and generated firmware.

[Launch app](apps/proto-lab/) · [Documentation](projects/proto-lab/index.md)
</div>

<div class="card" markdown>
[![Logistics Twin](assets/logistics-twin/overview.jpg)](apps/logistics-twin/)

### Logistics Twin

A live digital twin of a fulfilment centre: supplier trucks, reach trucks and racking,
AMR order picking, packing, a sorter and line-haul trucks, with KPIs and bottleneck advice.

[Launch app](apps/logistics-twin/) · [Documentation](projects/logistics-twin/index.md)
</div>

<div class="card" markdown>
[![Robot Cell Studio](assets/robot-cell-studio/six-palletize.jpg)](apps/robot-cell-studio/)

### Robot Cell Studio

Build an industrial robot joint by joint, check its reach, payload and motor loads,
program it in a 3D factory cell and export URDF.

[Launch app](apps/robot-cell-studio/) · [Documentation](projects/robot-cell-studio/index.md)
</div>

<div class="card card--soon" markdown>
### More on the way

Each new visualisation gets its own folder under `projects/` and its own docs
section. See [Contributing](contributing.md) for the template.
</div>

</div>

## How this site is organised

| Path | What lives there |
| --- | --- |
| `projects/<name>/` | A self-contained three.js app (`index.html`, `styles.css`, `src/`) |
| `docs/` | This MkDocs Material site |
| `scripts/build-site.sh` | Builds the docs and copies every app to `site/apps/<name>/` |
| `.github/workflows/deploy.yml` | Builds on every push and publishes `main` to the `gh-pages` branch |
