---
hide:
  - navigation
  - toc
---

<div class="hero" markdown>

# 3D Artifacts

Interactive **three.js** visualisations of real engineering — built to published
dimensions, driven by real physics, wrapped in a modern UI. Each project is a
standalone web app that runs in the browser with no build step.

[Open the ISS EVA simulator :material-rocket-launch:](apps/iss-eva-spacewalk/){ .md-button .md-button--primary }
[Browse projects](projects/index.md){ .md-button }

</div>

## Projects

<div class="gallery" markdown>

<div class="card" markdown>
[![ISS EVA simulator](assets/iss-eva-spacewalk/overview.jpg)](apps/iss-eva-spacewalk/)

### ISS EVA Spacewalk

The International Space Station at true scale (109 m × 73 m) in a real orbit
with a real Sun. Play NASA and Roscosmos spacewalks: iROSA installation,
battery swaps and Nauka outfitting.

[Launch app](apps/iss-eva-spacewalk/) · [Documentation](projects/iss-eva-spacewalk/index.md)
</div>

<div class="card card--soon" markdown>
### More on the way

Each new visualisation gets its own folder under `projects/` and its own docs
section. See [Contributing](contributing.md) for the template.
</div>

</div>

## How this site is organised

| Path | What lives there |
| --- | --- |
| `projects/<name>/` | A self-contained three.js app (`index.html`, `styles.css`, `src/`) |
| `docs/` | This MkDocs Material site |
| `scripts/build-site.sh` | Builds the docs and copies every app to `site/apps/<name>/` |
| `.github/workflows/deploy.yml` | Builds on every push and publishes `main` to the `gh-pages` branch |
