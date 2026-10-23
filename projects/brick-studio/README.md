# Brick Studio Pro

An advanced 3D builder for interlocking plastic bricks, a step up from [Brick Builder](../brick-builder).

- **Parts:** 69 parts in 40 colours.
  - Bricks, plates, tiles and wedge plates.
  - 45°, 33° and 65° slopes, inverted slopes and curved slopes.
  - Round bricks, cones and domes; arches, windows, a door frame and a fence; Technic bricks.
  - Each part carries its LDraw / BrickLink part number, and each colour its LDraw and BrickLink colour numbers.
- **Snapping:** a part goes where its studs or anti-studs actually connect, so you can also hang parts under an overhang. Tiles and slope faces refuse studs. A free-placement mode lifts the rule.
- **Editing:** build, select (click, shift-click, box), paint, erase and pick.
  - Move with the arrow keys and PgUp/PgDn, rotate, mirror, copy, paste and duplicate.
  - Replace a colour across the whole build; undo and redo.
- **Check:**
  - Floating parts (not connected to the baseplate) in red, and weak single-stud joints in amber.
  - Centre of mass, weight and height.
  - A drop test where unsupported groups fall.
- **Steps:** automatic building instructions, ordered along the connections from the baseplate up, with parts callouts per step. Play them back or print a booklet.
- **Parts list:** quantities by part and colour, with estimated weight and cost. Export it as CSV or as a BrickLink wanted list (XML).
- **Create:**
  - Generators for a sphere, dome, stepped pyramid, castle tower, wall with windows, tree and spiral staircase. A brick optimizer fills each shape with the largest bricks and staggers the joints.
  - Brick lettering from a pixel font.
  - Photo mosaics: CIELAB colour matching, Floyd–Steinberg dithering, and merged tile runs.
- **Files:** autosave; Brick Studio JSON; LDraw `.ldr` import/export (LeoCAD, Stud.io); PNG; GLB.
- **Views:** realistic, flat or X-ray rendering, an exploded view and camera presets.

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/#sample=cottage
```

Brick Studio is an independent project, not affiliated with or endorsed by the LEGO Group. Part and colour numbers are given for convenience; check them before ordering.

Docs: `docs/projects/brick-studio/`.
