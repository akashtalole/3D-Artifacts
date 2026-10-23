# गडकिल्ले · Forts of Swarajya

A 3D explorer of 14 forts of Chhatrapati Shivaji Maharaj in Maharashtra, on real terrain:

- **Hill forts:** Shivneri, Torna, Rajgad, Sinhagad, Purandar, Pratapgad, Raigad, Lohagad, Panhala and Salher.
- **Sea forts:** Sindhudurg, Vijaydurg, Suvarnadurg and Khanderi.

The 11 forts of the 2025 UNESCO "Maratha Military Landscapes of India" are marked.

- **Map:** a relief of the Sahyadri and Konkan coast, plus a 1630–1680 timeline of his life.
- **Fort scenes:**
  - real terrain at about 9 m resolution
  - walls traced from the plateau edges and shorelines, with bastions, gates and the saffron Bhagwa
  - indicative buildings
  - Marathi and English labels
- **Atmosphere:** monsoon, winter and summer looks, and a real sun position for any time of day.

Terrain comes from Terrarium elevation tiles (AWS Open Data · Mapzen/Tilezen · SRTM), baked into `data/`. Buildings are indicative, not surveyed.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#/fort/raigad?season=monsoon&hour=7
```

Docs: `docs/projects/shivaji-forts/`.
