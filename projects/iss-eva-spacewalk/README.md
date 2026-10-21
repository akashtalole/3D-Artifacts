# ISS EVA Spacewalk

Real-time three.js simulation of International Space Station spacewalks.

- Station built to published dimensions: modules, 109 m truss, 8 Solar Array Wings,
  iROSAs, radiators, Canadarm2 / MBS / Dextre, ERA, visiting vehicles.
- Real orbit (415 km, 51.64°), Sun ephemeris and Earth rotation: day/night, beta
  angle, sunrise countdown, live ground track.
- Playable missions: iROSA installation (P6), Li-ion battery swap (S4), Nauka & ERA
  outfitting (Poisk / Orlan suits), and free orbit with sun-tracking arrays.
- Cameras: station, follow EV1/EV2, helmet cam, worksite, Cupola window.

Run it by serving the repository root and opening `/projects/iss-eva-spacewalk/`:

```bash
python3 -m http.server 8000
```

Full documentation: `docs/projects/iss-eva-spacewalk/` (published at
https://akashtalole.github.io/3D-Artifacts/projects/iss-eva-spacewalk/).
