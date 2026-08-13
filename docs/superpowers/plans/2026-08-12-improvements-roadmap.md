# Improvements Roadmap Implementation Plan (post-v0.10.0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development task-by-task. Checkbox steps. **Do NOT push anything** — v0.10.0 is tagged locally and unpushed by explicit user instruction; this plan ends at a locally-tagged v0.11.0.

**Goal:** Close the gaps from the 2026-08-12 improvement review: startup-payload verification, e2e CI, small engineering debts, Tier-2 UX additions, and the user-approved design-debt items (dark viewport default, muted-token palette consolidation, 1520px reflow, slower idle fade).

**User decisions (2026-08-12, binding):** viewport default = dark ds-derived; click-to-pin = **SKIPPED** (out of scope entirely); auto-hide behavior unchanged except **slower fade**; palette canonical = **muted ds tokens**.

**Architecture:** One branch `improvements-2026-08` off main (post-v0.10.0). Three phases: A engineering (T1-T3), B UX additions (T4-T6), C design debt (T7-T9), then release prep (T10). Phases are ordered lowest-risk-first; each task independently committable and revertable. No Tailwind — classContract.test.ts enforces referenced→defined; compose from defined utilities or hand-write rules.

## Global Constraints

- **NO `git push`** at any point.
- Zero behavior change outside each task's stated delta; visible deltas appear only in Phase C and are user-approved above.
- Full gate before each phase's last commit: `npm run test:run && npm run lint && npx tsc -b --force && npm run build`.
- Store access from components only via `*StoreFacade` (componentStoreBoundary enforces). Persisted uiStore keys are whitelist-partialized — new transient state stays off the whitelist; changing a PERSISTED default (T7) affects fresh profiles only, existing users keep their stored value (this is intended — note it, don't migrate).
- Update pinned tests faithfully; never weaken assertion style.

## Grounded facts (verified 2026-08-12)

- Spark: only a `type` import at top of `src/utils/sparkSplatRuntime.ts`; runtime loads via `import('@sparkjsdev/spark')` at line ~10 (cached promise). vite.config.ts:84-87 puts it in manualChunks `spark-vendor`. Consumers of the runtime: SplatLayer.tsx, Scene3D.tsx, fileDropzoneWorkflow.ts, sparkPsnrSession.ts.
- Playwright projects (playwright.config.ts): `chromium`, `firefox`, `chromium-webgpu`, `chromium-webgpu-hardware`, `chromium-webgpu-bicycle`. CI workflows: only `.github/workflows/deploy.yml`. Fixture-dependent suites skip via out-of-repo `tests/colmapFixturePaths.ts`.
- Background default: `src/store/stores/uiStore.ts:265` `backgroundColor: '#ffffff'` (persisted). Grid: `GRID_COLORS` in src/theme/colors.ts (majorLines 0xffcc88 orange, minorLines 0x888888).
- Idle fade: index.css ~1689 `transition: opacity 0.25s ease, visibility 0.25s ease`.
- CanvasTextSprite.tsx:19 deliberately bakes system-stack text once at mount (pre-fonts).
- z counter: useModalZIndex clamps at Z_INDEX.modalOverlay-1; ties at cap resolve by DOM order (approved trade-off; renormalize follow-up ticketed).

---

## Phase A — Engineering (no visual change)

### Task 1: Verify splat-chunk laziness; add a guard

**Files:** possibly none in src; Create `src/utils/sparkImportBoundary.test.ts`; Modify only if eagerness is found.

- [ ] Build (`npm run build`) and verify `dist/index.html` + the entry chunk contain NO reference/modulepreload to `spark-vendor-*.js` (grep dist). Then runtime-verify: with the dev server, load the landing page headless (gstack browse at $HOME/.claude/skills/gstack/browse/dist/browse; `browse goto http://localhost:5173/` then read network requests if the tool supports it, else check `performance.getEntriesByType('resource')` via `browse js`) — assert no spark chunk fetched before a splat loads.
- [ ] If (unexpectedly) eager: find the static import chain (`npx vite-bundle-visualizer` or grep for value-imports of `@sparkjsdev/spark` outside sparkSplatRuntime) and break it with the same cached-dynamic-import pattern; re-verify.
- [ ] Either way, add the guard test `sparkImportBoundary.test.ts`: fs-walk src (reuse the classContract walk idiom) asserting the ONLY file containing `from '@sparkjsdev/spark'` as a value import (not `import type`) or a raw `import('@sparkjsdev/spark')` is `src/utils/sparkSplatRuntime.ts`. This pins laziness structurally.
- [ ] Report the measured initial-load JS (sum of assets fetched on landing) in the task report for the release notes.
- [ ] Commit `test: pin spark vendor chunk laziness` (or `perf: ...` if a fix was needed).

### Task 2: Playwright e2e in CI

**Files:** Create `.github/workflows/e2e.yml`. Do not touch deploy.yml.

- [ ] Workflow: on push to main + pull_request; ubuntu-latest; setup-node with npm cache; `npm ci`; `npx playwright install --with-deps chromium`; run ONLY the `chromium` project (`npx playwright test --project=chromium`); upload the playwright report as artifact on failure. The webgpu/firefox/hardware projects stay local-only (no GPU on runners) — state this in a workflow comment. Fixture suites self-skip (colmapFixturePaths resolves outside the repo).
- [ ] Verify locally that `npx playwright test --project=chromium` passes (or document which specs need the dev server and confirm the config's webServer block handles it — read playwright.config.ts).
- [ ] Commit `ci: run chromium e2e suite on push and PRs`.

### Task 3: Engineering batch (three small debts)

**Files:** src/hooks/useModalZIndex.ts (+test), src/components/viewer3d/CanvasTextSprite.tsx, src/main.tsx or font imports.

- [ ] **z-counter reset-at-zero:** module-level open-window refcount in useModalZIndex — increment in the isOpen effect, decrement in its cleanup; when it reaches 0, reset `globalZIndexCounter = Z_INDEX.modal`. Keep the clamp. Pure addition; extend useModalZIndex.test.ts: after all hooks unmount, a fresh open gets modal+1 again (cap becomes unreachable in practice).
- [ ] **CanvasTextSprite font re-bake:** after `document.fonts.ready` resolves (and once `'12px "IBM Plex Sans Variable"'` is loaded per document.fonts.check), re-bake the texture once (set the canvas font to the ds sans stack and mark texture needsUpdate). Guard for test envs without document.fonts. In-scene labels then match the chrome. Keep the system-stack fallback for the pre-ready bake.
- [ ] **Font subset pruning (optional, skip if fiddly):** if `@fontsource-variable/ibm-plex-sans` ships per-subset css (e.g. `.../latin.css` or wght-latin files), switch imports to latin-only and confirm the build drops the Cyrillic/Greek/Vietnamese woff2 files from dist; if the package layout doesn't support it cleanly, SKIP and note (users never fetch unused subsets; this is dist-size only).
- [ ] Full gate. Commit `fix: z-counter reset at zero windows; bake 3D labels in Plex; prune font subsets`.

---

## Phase B — UX additions (additive only)

### Task 4: Alignment tools visible in the toolbar

**Files:** new panel under src/components/viewer3d/panels/ + wiring in useViewerControlsController/ViewerControlsToolbar (Data cluster, before the divider that precedes Capture); locate the toast.

- [ ] Read GlobalContextMenu/globalContextMenuViewModel to find the existing actions for Transform Gizmo (T), 1-Point Origin, 2-Point Scale, 3-Point Align — the new panel exposes EXACTLY those, same store actions, no new state. Follow the house panel pattern (hover panel via ControlComponents like TransformPanel; a `HoverIcon` label `Align`).
- [ ] Find and remove the "Right-click anywhere for quick actions" instructional toast (grep the string; it's a notification fired post-load). Context menu itself unchanged.
- [ ] Tests per house pattern (panel viewmodel + routing test like sibling panels). Commit `feat(ux): alignment tools panel in toolbar; retire right-click instruction toast`.

### Task 5: Gallery edge chevron + Tools list in Settings

**Files:** gallery layout component (locate via the separator/AppLayout), SettingsPanel.tsx.

- [ ] Chevron: a slim collapse handle on the viewer↔gallery divider (or gallery's left edge) toggling the SAME store state as the toolbar's GalleryToggleButton (grep its facade action). Both controls coexist. Style from defined utilities; 44px touch-hit if in touch mode (reuse `touch-hit-44`).
- [ ] Settings panel gains a "Tools" section: rows for Deletion, Camera conversion, Floor detection, Auto-hide editor — each a button firing the existing `showDeletionModal`/`showConversionModal`/`showFloorModal`/`showAutoHideEditor` store actions via the panel's existing facade pattern. Labels match the tool windows' titles.
- [ ] Tests; commit `feat(ux): gallery edge collapse handle; tools list in settings`.

### Task 6: One-liners batch

**Files:** ViewerControlsToolbar.tsx, index.css, src/hooks/useIdleTimer.ts, HotkeyHelpModal (+ viewmodels/tests).

- [ ] **Cluster a11y:** wrap each toolbar cluster in `<div role="group" aria-label="View|Data|Capture|App" className="contents">` — define `.contents { display: contents; }` in index.css (hand-written; contract test picks it up) so flex layout is unchanged. Replace the `{/* View */}` comment markers with these wrappers.
- [ ] **Tab wakes chrome:** in useIdleTimer, add a document-level keydown listener for `Tab` that calls the existing reset/show path when idle (mirror the existing document `focusin` listener's plumbing). One test alongside the existing idle-timer tests.
- [ ] **Slower idle fade (user decision):** index.css ~1689 `0.25s` → `0.6s` for both opacity and visibility transitions (hide only — reveal stays instant by the visibility keyword semantics already documented there). Update the adjacent comment.
- [ ] **Help rename:** HotkeyHelpModal title "Keyboard Shortcuts" → "Help" (tabs unchanged: Essentials / Camera Controls / About). Update pinned tests + the Shortcuts button keeps its label (it opens Help; title attr may say "Help & keyboard shortcuts (I)" — single-source via the shared constant from the simplify pass).
- [ ] Full gate. Commit `feat(ux): toolbar group semantics; Tab wakes chrome; slower idle fade; Help rename`.

---

## Phase C — Design debt (visible, user-approved)

### Task 7: Dark ds-derived viewport default

**Files:** uiStore.ts:265, src/theme/colors.ts GRID_COLORS (+ any brightness-dependent overlay logic).

- [ ] `backgroundColor` default `'#ffffff'` → `'#161616'` (= --bg-secondary). PERSISTED key: existing profiles keep their stored white — intended; fresh sessions get the unified dark look. Note in report.
- [ ] Grid on dark: `GRID_COLORS.majorLines` 0xffcc88 → a ds-ramp tone (0x4a4a4a) and `minorLines` 0x888888 → 0x2e2e2e; `negativeAxis` unchanged. The orange grid was designed for the light canvas; on dark it must recede, not glow. Verify the background-cycle (B) still offers white and that brightness-dependent overlays (footer social icons, logo opacity, BRIGHTNESS midpoint logic in colors.ts) render legibly on both — screenshot both states.
- [ ] Update any test pinning the default ('#ffffff') faithfully. Visual evidence: landing + loaded screenshots dark AND after cycling to white.
- [ ] Commit `feat(design): dark ds-derived viewport default with receded grid`.

### Task 8: Palette consolidation to muted ds tokens (+ muted contrast)

**Files:** src/theme/colors.ts (STATUS_COLORS, STATUS_BG, CHART_COLORS), src/theme/componentStyles.ts (iconButton hovers), src/index.css (Tailwind palette block + hover:text-*-300 trio + --text-muted).

- [ ] Remap semantic consumers to ds classes: `STATUS_COLORS` text-green-400→text-ds-success, text-blue-400→text-ds-info, text-amber-400→text-ds-warning, text-red-400→text-ds-error, text-orange-400→text-ds-warning (caution folds into warning — orange was defined only for this; note the semantic merge), text-purple-400→text-ds-accent? NO — purple has no ds analog: keep text-purple-400 (highlight) and note it. `STATUS_BG` similarly onto bg-ds-success/info/warning (inactive bg-neutral-600 → bg-ds-hover). `CHART_COLORS.bar/percentage` → var-derived ds warning hexes (canvas/SVG need literals — use the --warning hex #b89b6b and a lighter derivative, documented).
- [ ] The `hover:text-green-300/yellow-300/red-300` trio (iconButtonConfirm/Retry/Cancel) → define dash-form hover rules using ds tokens' 20%-lighter forms OR simply hover-opacity-90 on the ds color — pick the minimal visually-sane form and document it.
- [ ] After remapping, grep each Tailwind palette class for zero references and DELETE the newly-dead rules from the index.css palette block (the contract test proves nothing references them; keep any still-referenced, e.g. gray-500 context-menu hotkeys → also remap those to text-ds-muted while here, then delete).
- [ ] **--text-muted contrast:** #5a5a5a → the darkest value achieving ≥4.5:1 on --bg-tertiary #1e1e1e (compute; ~#767676). This brightens all muted text slightly — user-approved category. Verify the muted/70 and /30 tint rgba literals derived from it (index.css comments name them) get recomputed to match, or explicitly kept with updated comments.
- [ ] Full gate + screenshots of a panel with success/error states, cache-stats legend, deletion modal. Commit `feat(design): consolidate status colors onto ds tokens; AA muted text`.

### Task 9: 1520px reflow instead of scale(0.85)

**Files:** src/index.css responsive block (~1742+).

- [ ] Replace `transform: scale(0.85)` on `.tool-modal-responsive`/`.hover-panel-responsive` with real compact styles reproducing the same effective footprint: panel width 240px→204px equivalent (w-[204px]? define bracket class or use padding reduction), padding p-4→p-3, panel title/text one step down — derive the exact substitutions by measuring the current scaled result first (screenshot + getBoundingClientRect at 1400px viewport), then match within a few px. Text renders sharp instead of scaled-blurry; hover-panel transform-origin hacks go away.
- [ ] Verify no overflow/clipped rows in the widest panels (Transform, Settings, Export) at 1400px; before/after screenshots.
- [ ] Leave the `@media (max-height: 880px)` / `(max-height: 680px)` control-column tiers alone (index.css, added by the T4 review fix). They are a vertical-fit guard — the column has no overflow and cannot get one without clipping the hover panels — and are orthogonal to this width reflow; `src/components/viewer3d/toolbarColumnHeight.test.ts` fails if a tier is dropped or a 17th button outgrows one.
- [ ] Full gate. Commit `style(design): reflow tool panels at compact breakpoint instead of scaling`.

---

## Task 10: Release prep (NO PUSH)

- [ ] Full gate twice (flake check). Visual regression: re-run the design-review audit checks against `~/.gstack/projects/colmap_webview/designs/design-audit-20260810/design-baseline.json` expectations (color count will drop post-T8 — that's the point; record new grades).
- [ ] CHANGELOG 0.11.0 entry (user-facing bullets per section); `npm pkg set version=0.11.0`; commit `Bump version to 0.11.0`; `git tag v0.11.0`. **STOP — do not push. Both v0.10.0 and v0.11.0 remain local until the user says push.**

## Out of scope (explicit)

Click-to-pin panels (user: skip). Auto-hide anchor/first-run changes (user: keep current behavior, fade timing only). LINK_COLORS brand hovers (brand, not status — stay). Radius normalization. Any push/deploy/canary.
