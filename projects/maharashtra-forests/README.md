# Van Maharashtra · Forests and industrial projects

Maharashtra's forest cover in three.js, from 2021 to 2050, as an illustrative pipeline of mines, plants, roads, railways, dams, industrial estates and ports takes forest land. Three scenarios show how the outcome changes.

- **Baseline:** the state is cut into 6 km cells holding very dense, moderately dense and open forest. The 2021 totals match the Forest Survey of India's ISFR 2021 for Maharashtra:
  - forest cover about 50,800 km², 16.5% of the state;
  - very dense 8,734 km², moderately dense 20,589 km², open 21,475 km².

  Where the forest lies is a smoothed sketch of the main tracts:
  - Gadchiroli, Chandrapur–Tadoba, Gondia–Bhandara, Pench, Melghat, Yavatmal and the Satpura in the north and east;
  - Nashik–Thane–Palghar and the Sahyadri in the west;
  - the Konkan mangroves.
- **Each year:**
  - projects clear forest where they sit or along their route;
  - the forest around each one thins for a decade;
  - compensatory planting begins after a lag, and saplings count as forest only once their canopy closes;
  - corridors between tiger reserves are rescored.
- **Scenarios:**
  - **Business as usual:** every project goes ahead.
  - **Avoid and mitigate:** projects in reserves and corridors are dropped or moved, others shrink, linear projects get wildlife crossings and planting follows at once nearby.
  - **High growth:** the pipeline repeats at 1.3 times the size from 2033.
- **Map:**
  - Tiles are coloured by forest, plantation and industrial land.
  - A **Change** layer turns lost forest red and thinned dense forest orange.
  - Trees thin and fall cell by cell.
  - Projects grow in their year.
  - Tiger reserves are drawn as dashed rings, and corridors turn from green to amber to red.
- **Close-ups:**
  - an iron-ore pit dug into a Gadchiroli hill, with dumps, haul trucks and a compensatory plantation;
  - a highway widened through the Pench corridor, with or without wildlife underpasses;
  - a Melghat valley drowned by a reservoir;
  - Palghar mangroves reclaimed for a port.
- **Panels:**
  - **Overview:** tiles, change by density class, cover by class, and every scenario compared.
  - **Projects:** the pipeline and its status.
  - **Regions:** each revenue division.
  - **Wildlife:** corridor scores and projects near each reserve.
  - **About:** the method, the law in brief, and what this is not.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#sc=high&view=vidarbha
# or   http://localhost:8000/#view=mine&year=2026
```

Hash options:

| Option | Values |
| --- | --- |
| `sc` | `bau`, `avoid` or `high` |
| `year` | 2021–2050 |
| `play` | `0` starts paused |
| `view` | `state`, `vidarbha`, `sahyadri`, `konkan`, `melghat`, `mine`, `road`, `dam` or `port` |
| `tab` | `over`, `proj`, `reg`, `wild` or `about` |

This is illustrative, not a forecast or a record of approvals. The projects are types placed where such projects are often proposed, and the rates are scenario assumptions. For real figures see the Forest Survey of India's reports and the PARIVESH portal.

`src/charts.js` and `src/labels.js` are shared with `projects/maharashtra-grid`, which also shares the map projection.

Docs: `docs/projects/maharashtra-forests/`.
