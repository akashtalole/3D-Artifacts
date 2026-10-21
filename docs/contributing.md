# Contributing a project

Each visualisation is a standalone folder under `projects/` plus a docs section.

## 1. Create the app folder

```text
projects/<your-project>/
├── index.html      # import map + UI shell
├── styles.css
├── README.md       # short summary (not published)
└── src/
    └── main.js
```

Start the `index.html` with an import map pinned to an exact three.js version:

```html
<script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
    }
  }
</script>
<script type="module" src="./src/main.js"></script>
```

Keep paths relative (`./src/…`). The app is published at `/apps/<your-project>/`.

## 2. Add documentation

1. Create `docs/projects/<your-project>/index.md` and link to the app with
   `../../apps/<your-project>/`.
2. Add the pages to `nav:` in `mkdocs.yml`.
3. Add a row to `docs/projects/index.md` and a card to `docs/index.md`.
4. Put screenshots in `docs/assets/<your-project>/` (JPEG, ~1600 px wide).

## 3. Preview

```bash
pip install -r requirements.txt
scripts/build-site.sh --serve      # docs + apps on http://localhost:8000
# or, docs only with live reload:
mkdocs serve
```

## 4. Publish

Pushing to `main` runs `.github/workflows/deploy.yml`. It checks JavaScript syntax,
builds the docs with `--strict`, bundles every app and force-pushes the result to
the **`gh-pages`** branch.

!!! tip "One-time GitHub setup"
    In **Settings → Pages**, set *Source* to **Deploy from a branch**, branch
    **`gh-pages`**, folder **`/ (root)`**. The site is then served at
    `https://<user>.github.io/3D-Artifacts/`.

## Guidelines

- Use real units and published dimensions. Cite the sources on the project's
  reference page.
- Keep data (`src/data/`) separate from rendering code.
- Make the UI work at phone width, and give every view a keyboard shortcut.
- Prefer procedural textures. Load large imagery from a pinned CDN URL with a fallback.
