# Projects

Every project lives in its own subfolder of [`projects/`](https://github.com/akashtalole/3D-Artifacts/tree/main/projects)
and is published at `/apps/<name>/` next to its documentation.

| Project | Live app | What it shows |
| --- | --- | --- |
| [ISS EVA Spacewalk](iss-eva-spacewalk/index.md) | [Launch](../apps/iss-eva-spacewalk/) | International Space Station spacewalks — real dimensions, orbit, Sun and EVA timelines |

## Shared conventions

- **No build step.** Apps are plain ES modules. `three` is loaded from jsDelivr via an
  import map pinned to an exact version, so the folder can be served by any static host.
- **Real units.** Scenes use metres (or the natural SI unit of the subject) so that
  published dimensions can be typed in directly.
- **Data separate from code.** Specifications and scripted sequences live in
  `src/data/`, so they can be checked against sources without reading render code.
- **Modern UI.** Glass panels, a transport bar, keyboard shortcuts, deep-linkable
  state (`?mission=…&t=…&view=…`), and responsive down to phone width.
