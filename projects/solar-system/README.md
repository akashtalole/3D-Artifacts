# Solar System Explorer

A real-time, true-scale 3D Solar System modelled on NASA's *Eyes on the Solar System*.

- Planets and Pluto placed from JPL Keplerian elements (valid 1800–2050), plus the Moon from a low-precision lunar series.
- Fly to any planet or major moon from the planet bar, the search box or by clicking.
- Time controls from −1 yr/s to +1 yr/s, pause and LIVE.
- Flood or natural lighting, orbit lines, asteroid belt and labels.
- Deep links: `#/saturn?lighting=natural&date=2030-01-01&rate=86400`.

No build step. Serve the folder with any static server:

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#/home
```

Docs: `docs/projects/solar-system/`.
