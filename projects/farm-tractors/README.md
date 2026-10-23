# Krishi Yantra · Farm tractors

Animated farm tractors and their implements in three.js. Hitch an implement, watch it work a field, and follow a whole wheat season from paddy stubble to the mandi.

- **Three tractors:** 35 HP and 50 HP 2WD with a ROPS canopy, and a 75 HP 4WD with a closed cab. Four paint colours.
- **Working hitches:** a three-point linkage (lower links, lift arms, lift rods, top link), a PTO shaft with a cardan joint, a drawbar for trailed implements and a front mount.
- **Eleven implements, all animated:**
  1. Mould-board plough
  2. Disc plough
  3. Disc harrow
  4. Tine cultivator
  5. Rotavator (PTO-driven)
  6. Laser land leveller, with its transmitter and receiver mast
  7. Seed-cum-fertiliser drill
  8. Boom sprayer with a folding boom
  9. Front-mounted reaper laying windrows
  10. Stationary multi-crop thresher, driven by the PTO
  11. Tipping trolley carrying grain bags to the mandi
- **Three modes:**
  - **Showroom:** raise and lower the hitch, switch the PTO on, run the implement in place.
  - **Field work:** the tractor works a 40 × 24 m field in lands with headland turns. The soil changes as it goes (stubble → ploughed → harrowed → cultivated → levelled → sown). A HUD shows area, real time and fuel.
  - **Crop cycle:** twelve stages of rabi wheat after paddy, Oct 20 to Apr 14, including the first irrigation and the crop growing and ripening.
- **Panels:**
  - **Implement:** what it does, its parts, width, depth, speed, field capacity, tractor power and price.
  - **Calculator:** time, diesel and cost to work a field in hectares or acres, with a tractor-power check.
  - **Crop cycle:** the season's stages and dates.
  - **Tractor:** the specification of the selected tractor.
- **Cameras:** follow, side, rear, overview and cab.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#mode=field&imp=plough&hp=50
# or   http://localhost:8000/#mode=cycle&stage=9
```

Hash options: `hp` (35, 50, 75), `colour` (red, blue, green, orange), `imp`, `mode` (field, cycle), `stage` (0–11), `cam` (follow, side, rear, over, cab), `tab` (imp, calc, cycle, tractor) and `run`.

The tractors and implements are generic, with no brands. Figures are illustrative rules of thumb from Indian farm practice; makers' manuals and local agricultural university advice govern. `src/kit.js` is shared with `projects/heavy-machinery`.

Docs: `docs/projects/farm-tractors/`.
