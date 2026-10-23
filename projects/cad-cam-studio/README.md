# CAD/CAM Studio

A three.js CAD/CAM workbench for 2.5D milled parts. Everything runs in the browser.

- **Design:** a stock block minus parametric features: facing, pockets, slots, holes (grids and bolt circles) and an outside profile. The solid is rebuilt live with CSG (three-bvh-csg).
- **Manufacture:**
  - each feature gets an automatic operation (face, offset or zig-zag pocket, slot, peck drill, helical bore, profile with tabs)
  - feeds and speeds come from the material and tool
  - every setting can be edited per operation
- **Simulate:** Z-map material removal with the cutter, holder and chips. Live G-code highlighting, and a compare mode that shows on size, stock left and gouges.
- **Export:** GRBL G-code (.nc), STL and the project as JSON.

No build step:

```bash
python3 -m http.server 8000      # from this folder
# open http://localhost:8000/
```

Docs: `docs/projects/cad-cam-studio/`. This is educational software, so verify G-code before running a real machine.
