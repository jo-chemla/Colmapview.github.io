# Fork changes

Iconem fork of [ColmapView/colmapview.github.io](https://github.com/ColmapView/colmapview.github.io)
(branch `iconem-txt-manifest-pointerlock`, diverged from upstream at v0.12.0 / `6d361f5`).
User-facing changes since divergence, newest last within each group.

## Loading & manifests

- `.txt` COLMAP model files accepted in manifests, plus `?url=<manifest>` loading (`1b70c08`).
- Optional `hdImagesPath` manifest field: gallery uses the thumbnail base, detail views get a full-resolution base (`4cba728`), with the detail modal progressively swapping thumbnail → HD and metric images preferring the HD base (`54fe5e2`).
- Opt-in progressive loading via `?progressive=1`: cameras + images parse first for instant poses/gallery; points3D streams in from a background fetch and is swapped in without disturbing the live scene (`09546e8`).
- Cooperative main-thread yielding through the heavy parse/stats phases, a compact non-blocking corner progress card for the background points download, and a start-screen picker listing hosted datasets from the remote `index.json` (plus `?manifests=<url,url>` extras) (`e05222e`).
- Manifests without a `baseUrl` default to the manifest's own directory — fixes hosted blob manifests that omit it by design (`4fb39b3`).
- Deferred statistics: the per-image/global stats pass (the longest post-parse main-thread cost) is skipped at load; it runs lazily — with the background progress card — the first time something needs it (image detail, matches, selection highlight, gallery list view, data panel). Default load is poses + points only.
- In-viewer dataset switcher: a compact select in the gallery toolbar lists the hosted datasets (same cached `index.json` fetch as the start screen) plus the currently loaded manifest; picking one reloads via `?url=<manifest>&progressive=1`, preserving a `?pointerlock=0` opt-out.

## Viewer & navigation

- `?pointerlock=0` URL opt-out for pointer-lock acquisition (embeds/automation) (`1b70c08`).
- Double-click sets the orbit pivot; the wheel zooms toward the point under the cursor (`8bdc4e3`).
- Orbit pan speed doubled — the distance-proportional coefficient was ~0.5x screen-space (`ce4b9e0`).
- Frusta defaults: single white color, line width 1.5, camera scale 0.6 (was per-camera red / 1 / 0.25); persisted stores migrate, keeping customized values (`4f5417b`).
- Selection highlight defaults to a **static** single color instead of the animated rainbow cycle (persisted store migrates the old default; explicit blink/rainbow choices are kept).

## Gallery

- Grid-columns select in the gallery toolbar, complementing Shift+scroll (`6fb61dc`); default 5 columns (`cd808b1`).
- Scroll stability: keep position when selecting an already-visible image (`e40d600`); only re-center on actual selection changes, never while the user scrolls (`555d66f`).
- Cached thumbnails survive load-gating — no more thumbnails blanking to placeholders on click/scroll/settle (`4f5417b`).
- Decode-time thumbnail downscaling: gallery thumbs decode via `createImageBitmap` resize options (512px, medium quality) so full-resolution originals (8k JPEGs on blob datasets without a separate thumbs path) are never materialized in memory; detail views still load full-res.

## Misc

- Image detail: 2D points are not loaded while the matches view has no pair (`b48d004`).

## TODO

- Consider moving the app's top horizontal bar into a left sidebar (sidebars preferred): today the desktop chrome is a bottom status bar plus the floating viewer-controls toolbar; a left sidebar could host the dataset switcher, stats chips and panel toggles in one persistent column. Assessment only — not implemented.
