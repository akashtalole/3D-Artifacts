# CRS-35: Launch to Docking

3D animation of NASA's SpaceX CRS-35 mission (Oct 2026):

1. **Launch & landing.** Pre-dawn countdown at SLC-40, Falcon 9 ascent, the booster's boostback, entry and landing burns, SECO, Dragon separation and nosecone opening.
2. **Orbit phasing.** About 51 h of burns on a rotating globe, with the real orbit plane through the pad at liftoff.
3. **Rendezvous & docking.** Waypoints, Keep-Out Sphere, autonomous final approach to Harmony's zenith port (IDA-3).

The ISS model, Earth and orbit code are shared with `../iss-eva-spacewalk` through the `iss/` import-map alias, so serve the `projects/` folder (or the repo root):

```bash
python3 -m http.server 8000      # from the repo root
# open http://localhost:8000/projects/crs35-launch-to-docking/
```

Docs: `docs/projects/crs35-launch-to-docking/`.
