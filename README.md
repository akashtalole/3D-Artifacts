# 3D Artifacts

Interactive **three.js** visualisations of real engineering, built to published
dimensions, driven by real physics, with a modern UI. Each project is a
standalone browser app in its own folder, documented with MkDocs Material and
published to GitHub Pages.

**Live site:** https://akashtalole.github.io/3D-Artifacts/

![ISS EVA simulator](docs/assets/iss-eva-spacewalk/overview.jpg)

## Projects

| Project | App | Docs |
| --- | --- | --- |
| **ISS EVA Spacewalk**: the International Space Station at true scale in a real orbit, with playable NASA and Roscosmos spacewalks (iROSA install, Li-ion battery swap, Nauka/ERA outfitting) | [`projects/iss-eva-spacewalk`](projects/iss-eva-spacewalk) · [live](https://akashtalole.github.io/3D-Artifacts/apps/iss-eva-spacewalk/) | [docs](https://akashtalole.github.io/3D-Artifacts/projects/iss-eva-spacewalk/) |
| **CRS-35 Launch to Docking**: NASA's SpaceX CRS-35 from the pre-dawn Falcon 9 launch and booster landing, through 51 h of orbit phasing, to Dragon docking on Harmony | [`projects/crs35-launch-to-docking`](projects/crs35-launch-to-docking) · [live](https://akashtalole.github.io/3D-Artifacts/apps/crs35-launch-to-docking/) | [docs](https://akashtalole.github.io/3D-Artifacts/projects/crs35-launch-to-docking/) |

## Repository layout

```text
projects/<name>/          standalone three.js app (index.html + src/, no build step)
docs/                     MkDocs Material documentation
mkdocs.yml                docs configuration & navigation
scripts/build-site.sh     builds docs and bundles apps into site/apps/<name>/
.github/workflows/        CI: syntax check, build, publish to gh-pages
```

## Run locally

```bash
# a single app: serve the repo root, open http://localhost:8000/projects/iss-eva-spacewalk/
python3 -m http.server 8000

# the full site (docs + apps)
pip install -r requirements.txt
scripts/build-site.sh --serve
```

## Deploying to GitHub Pages

Every push to `main` builds the site and force-pushes it to the `gh-pages` branch.
One-time setup: **Settings → Pages → Source: Deploy from a branch → `gh-pages` / root**.

## Adding a project

See [docs/contributing.md](docs/contributing.md).

## License

MIT. Earth imagery is NASA Blue Marble / Black Marble, served from the three.js examples.
