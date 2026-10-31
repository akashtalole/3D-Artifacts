# AI Factory India: Vera Rubin NVL72

A 3D walkthrough of an illustrative 100 MW AI factory near Hyderabad built on NVIDIA Vera Rubin NVL72 racks. It has eight stops:

campus → power → warm-water cooling → data hall → NVL72 rack → exploded compute tray → NVLink 6 spine → tokens out to Indian cities

- Rack, GPU and factory figures come from NVIDIA's public Vera Rubin NVL72 page. The site and plant model are illustrative.
- The sun follows the real IST clock, and the climate follows Hyderabad's monthly normals. Presets cover summer peak, monsoon and winter.
- Live readouts show IT and facility MW, PUE, solar versus grid power, coolant temperatures, cooling mode, water use and NVFP4 compute in use.

No build step:

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#/tray
```

Docs: `docs/projects/ai-factory-india/`. This is an independent visualisation, not affiliated with NVIDIA.
