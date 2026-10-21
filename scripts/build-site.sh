#!/usr/bin/env bash
# Build the documentation site and bundle every project's live app into it.
#
#   docs/      → site/            (MkDocs Material)
#   projects/X → site/apps/X/     (static three.js apps, served as-is)
#
# Usage: scripts/build-site.sh            # build into ./site
#        scripts/build-site.sh --serve    # build, then serve on http://localhost:8000
set -euo pipefail
cd "$(dirname "$0")/.."

mkdocs build --strict --clean

mkdir -p site/apps
for dir in projects/*/; do
  name="$(basename "$dir")"
  [ -f "$dir/index.html" ] || continue
  rm -rf "site/apps/$name"
  cp -R "$dir" "site/apps/$name"
  rm -f "site/apps/$name/README.md"
  echo "bundled app: $name → site/apps/$name/"
done

if [ "${1:-}" = "--serve" ]; then
  echo "Serving on http://localhost:8000"
  python3 -m http.server 8000 --directory site
fi
