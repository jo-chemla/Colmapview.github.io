# UX Tier 1 Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the viewer's layout scannable and its affordances discoverable through cosmetic, zero-behavior-change edits: toolbar clustering, real-word labels, an honest load modal, a status bar that carries only status, and gallery dedupe.

**Architecture:** All items are markup/string/class-composition changes on branch `ux-tier1-quick-wins` (forked from main at 0980261). No new interaction behavior, no store changes, no new CSS rules unless composed classes can't express it — this repo has NO Tailwind and `src/theme/classContract.test.ts` fails on any class not defined in `src/index.css`, so compose from existing defined utilities wherever possible.

**Tech Stack:** React+TS, hand-written index.css, vitest.

## Global Constraints

- **Zero behavior change.** Same handlers, same state, same keyboard shortcuts. Only labels, ordering, grouping markup, and where existing UI elements live.
- **No Tailwind; contract test enforced.** Every class you write must already exist in index.css (compose utilities) or be added there as a hand-written rule. Run `npx vitest run src/theme/classContract.test.ts` after any class-string change.
- **Keep all expert paths**: right-click menus, hotkeys, hover cards, and context-menu affordances stay; this plan only ADDS visible equivalents or relocates chrome.
- One commit per task; message prefix `feat(ux):` for additive UI, `style(ux):` for pure relabel/reorder. Run the affected suites per task and the FULL gate (`npm run test:run && npm run lint && npx tsc -b --force && npm run build`) in the final task.
- Update any test pinning changed strings faithfully (never weaken assertion style) in the same commit.
- Dev server may already be running on 5173 (hot-reloads this branch).

---

### Task 1: Toolbar clustering

**Files:** Modify `src/components/viewer3d/ViewerControlsToolbar.tsx` (+ its test if children order/count is pinned)

The toolbar is one undifferentiated flex-col of 15 panels. Insert hairline dividers to form four clusters, keeping component order EXACTLY as it is today:
- View: ViewPanel, AxesGridPanel, CameraModePanel, BackgroundPanel, TransformPanel
- Data: PointCloudPanel, CameraDisplayPanel, (conditional MatchesPanel + SelectionHighlightPanel), RigPanel
- Capture: ScreenshotPanel, SharePanel, ExportPanel
- App: SettingsPanel, GalleryToggleButton

- [ ] **Step 1:** Add a local `ToolbarDivider` element in the file: `<div aria-hidden="true" className="w-6 h-px bg-ds-hover mx-auto" />` (all four classes exist in index.css). Insert one between each cluster (3 dividers, placed after TransformPanel, after RigPanel, after ExportPanel).
- [ ] **Step 2:** Run `npx vitest run src/components/viewer3d/` — update any test pinning the container's children. Contract test stays green (no new classes).
- [ ] **Step 3:** Visual check in the running app (or ask controller): dividers render as subtle 24px hairlines; touch mode (gap 0.125rem) still reads fine.
- [ ] **Step 4:** Commit `style(ux): cluster viewer toolbar into view/data/capture/app groups`

### Task 2: Real-word button labels; kill "N/A"

**Files:** Modify `src/components/viewer3d/viewerControlsViewModel.ts` (+ its test)

The hover chips (rendered by `HoverIcon`, `src/icons/ui.tsx:9-18`, inside a 24px span over a 32-40px button) show cryptic codes. Replace with real words ≤6 chars; keep genuine technical initialisms. Exact mapping (every `label:` in the file):

| old | new | | old | new |
|---|---|---|---|---|
| A+G | Both | | FRM | Frust |
| AXS | Axes | | ARW | Arrow |
| GRD | Grid | | IMG | Image |
| OFF | Off | | RIG | Rig |
| ORB | Orbit | | BLK | Blink |
| FLY | Fly | | ERR | Error |
| TRK | Track | | SPL | Splat |
| RGB | RGB (keep) | | S+P | S+P (keep) |
| RNB | RNB (keep) | | N/A | Rig |

The `N/A` case (line ~383) keeps `disabled: true` and tooltip `'Rig not available'` — the chip just stops shouting N/A.

- [ ] **Step 1:** Apply the mapping; nothing else in the objects changes.
- [ ] **Step 2:** `npx vitest run src/components/viewer3d/` — update label pins faithfully.
- [ ] **Step 3:** Visual check: hover each toolbar button at desktop AND at ≤1520px (32px buttons) — no chip may clip badly; if a 6-char word overflows the 32px button illegibly, fall back to the 5-char alternative and note it (e.g. Frust→Frus is NOT acceptable; prefer reverting that one chip to its old code and flagging it).
- [ ] **Step 4:** Commit `style(ux): real-word hover labels on viewer controls; retire N/A chip`

### Task 3: Honest load modal

**Files:** Modify `src/components/dropzone/dropZonePanelViewModel.ts`, `src/components/dropzone/DropZonePanels.tsx` (+ tests)

- [ ] **Step 1:** Primary path: in `getDesktopDropZoneActionButtonClass`, the Try-a-Toy button gets `buttonStyles.variants.primary` while URL/JSON keep secondary (touch already does exactly this — mirror `getTouchDropZoneToyButtonClass`). Implement via a variant parameter or a parallel `getDesktopDropZonePrimaryButtonClass`, whichever matches file style.
- [ ] **Step 2:** Rename `DROP_ZONE_ACTION_LABELS.loadJson`: `'Load JSON'` → `'Load manifest'` (the file it loads is a manifest .json; tooltip/hover card text mentioning JSON may stay).
- [ ] **Step 3:** Surface the hidden right-click affordances as visible text links under the button row (desktop panel only): a small row `Open example dataset · Download example manifest` wired to the EXISTING `onOpenExampleDataset` / `onDownloadExampleManifest` props (keep the onContextMenu handlers too). Style from defined utilities: `text-ds-muted text-xs hover-ds-text-primary cursor-pointer` links, `mt-3 flex gap-4 justify-center` row (all defined; verify with the contract test). Add matching constants in the viewModel (house style: strings live there).
- [ ] **Step 4:** `npx vitest run src/components/dropzone/` + contract test; update pinned strings.
- [ ] **Step 5:** Visual check on landing: Toy button reads as the primary; links legible but quiet.
- [ ] **Step 6:** Commit `feat(ux): primary action + visible example links in load modal; rename Load JSON`

### Task 4: Status bar carries status; About/Shortcuts get a home

**Files:** Modify `src/components/layout/StatusBar.tsx`, `src/components/layout/statusBarViewModel.ts`, `src/components/modals/HotkeyHelpModal.tsx` (+ viewmodels/tests). Read first; the ⓘ trigger button top-left is rendered by HotkeyHelpModal itself (grep `InfoIcon` — it appears in that file); the modal already has a tab system (`.hotkey-help-tab` classes in index.css).

- [ ] **Step 1:** In HotkeyHelpModal, add an **About** tab (alongside existing tabs) containing what today lives in the status bar's right cluster: "ColmapView by OpsiClear", the project links (`STATUS_BAR_PROJECT_LINKS` — move/rename the constants to the modal's viewmodel or import them), "AGPL 3.0", "Based on COLMAP" (link), and `v{__APP_VERSION__}`. Reuse the links' existing hover-color behavior or simplify to `hover-ds-text-primary` — but keep each `href`/`title` exactly.
- [ ] **Step 2:** StatusBar right group becomes exactly two items: a `⌨ Shortcuts` text button that opens the hotkey/about modal (grep how the ⓘ trigger opens it — same store action/prop; do NOT add a new mechanism) and `v{__APP_VERSION__}`. Style the button from defined utilities (`text-ds-secondary hover-ds-text-primary cursor-pointer` + existing text sizing).
- [ ] **Step 3:** Delete the now-unused status-bar link plumbing ONLY if nothing else consumes it (`STATUS_BAR_*` exports, `StatusBarLinkAnchor`, `getStatusBarLink*` helpers — grep each); anything moved keeps its tests moved/updated alongside.
- [ ] **Step 4:** `npx vitest run src/components/layout/ src/components/modals/` + contract test; full-string pins updated faithfully.
- [ ] **Step 5:** Visual check: status bar = metrics left, Shortcuts + version right; ⓘ modal shows tabs incl. About with working links.
- [ ] **Step 6:** Commit `feat(ux): status bar diet — brand/legal moves to About tab; visible Shortcuts entry`

### Task 5: Gallery loading-tile dedupe

**Files:** locate the gallery item component (`grep -rln "galleryStyles" src/components/gallery`) and its viewmodel/tests.

While a thumbnail is loading, the tile currently shows the image name twice: centered placeholder text AND the bottom caption strip. Keep the bottom caption (consistent with the loaded state); the placeholder keeps only non-name content (or empty). Smallest change wins.

- [ ] **Step 1:** Make the edit; confirm the loaded state (image present) is untouched.
- [ ] **Step 2:** `npx vitest run src/components/gallery/` + update pins.
- [ ] **Step 3:** Full gate: `npm run test:run && npm run lint && npx tsc -b --force && npm run build`.
- [ ] **Step 4:** Commit `style(ux): single filename on loading gallery tiles`

## Explicitly out of scope (Tier 2/3 — separate plans)
Alignment tools in toolbar; gallery edge chevron; tools enumeration in Settings; click-to-pin panels; auto-hide anchor; first-run defaults.
