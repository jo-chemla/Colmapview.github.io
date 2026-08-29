# Adversarial Review Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every verified finding from the three-pass adversarial review of `6acaa8a..HEAD` (v0.11.0 pre-release): 5 behavioral fixes, 3 coverage restorations, 5 cleanups, and release housekeeping.

**Architecture:** Behavioral fixes first (CSS hit-testing, touch idle wake, splat preload gate), each pinned by a failing test before the fix. Then test-only coverage restorations, then mechanical dedup/consolidation cleanups, then a CHANGELOG amendment and local re-tag. No new dependencies, no new subsystems.

**Tech Stack:** React 18 + TypeScript + Vite, Zustand stores behind `*StoreFacade` hooks, hand-written CSS in `src/index.css` (NO Tailwind), Vitest, Playwright (chromium project).

**Spec:** The Findings Register section below IS the spec — it records each verified finding, its evidence, and the decided resolution. There is no separate document.

## Global Constraints

- **DO NOT PUSH.** All commits and the `v0.11.0` tag stay local. Publishing is the user's call.
- Full gate before each task's commit: `npm run test:run && npm run lint && npx tsc -b --force && npm run build` (from `colmap-webview/`). Tasks marked **[e2e]** additionally run `npx playwright test --project=chromium`.
- Every CSS class referenced from TS must be defined in `src/index.css` — `src/theme/classContract.test.ts` enforces it. Write dash-form utility names (`hover-ds-*`), never colon-form.
- Components reach stores only through `*StoreFacade` hooks — `src/components/componentStoreBoundary.test.ts` enforces it. None of these tasks needs a new store subscription.
- The repo has MIXED line endings (`src/types/colmap.ts`, `src/store/reconstructionStore.ts`, `src/utils/colmapPathResolver.ts` are CRLF; most files are LF). Use the Edit tool, not sed/perl, for file edits.
- Executor mandate (user, standing): Opus-class implementer and reviewer subagents for every task; run the `/codex` second-opinion gate in the loop where available.
- Comment style: comments state constraints the code can't show; match the file's existing density and voice.
- After the final task, move the local tag: `git tag -f v0.11.0 -m "v0.11.0"`. Do not push it.

---

## Findings Register (the spec)

Verified by three independent passes: a 10-finding high-effort review, a UI sweep (live headless-Chromium verification), and a logic sweep (full-suite + refutation pass). Verdicts below are post-verification.

**Behavioral (fix):**
- **B1** — `src/index.css` `.gallery-collapse-handle`: `translate(50%, -50%)` centers the reopen tab on the divider; collapsed, the divider sits flush against the layout row's `overflow-hidden` edge, clipping the tab to a ~6px sliver. NOT a lockout (right-click → "Gallery Panel" also reopens), but the primary affordance is half-gone and the stale comment above the rule still describes the old left-overhang design. → Task 2.
- **B2** — `src/index.css` `.resize-handle::before` (`left: -4px; width: 9px`): 4px of the always-on grab strip sits over the live canvas; the strip is a root-stacking-context box that beats everything inside Scene3D's `isolate`, so orbit/pan drags starting in the viewer's rightmost 4px silently become gallery resizes. Verified live via `elementFromPoint`. The same file documents this exact hazard twice. → Task 1.
- **B3** — Touch devices, default settings (`autoHideElements.buttons: true`, `idleHideTimeout: 3`): after 3 idle seconds ALL touch chrome is unreachable — `TouchStatusBar` unmounts, the control panel is `visibility:hidden` via `.idle-hideable`, and `useIdleTimer`'s wake filter (`isIdlePauseTarget`) matches nothing a finger can still hit (bare canvas doesn't qualify). Desktop survives via its `opacity-0` (still hit-testable) status bar and Tab-wake; touch has no equivalent. `hasDeliberateIdlePointerMove` in `idleTimerPolicy.ts` is a dead export — the wake was designed but never wired. → Task 3.
- **B4** — `TouchStatusBar` Help button's `touch-hit-44` box (44px centered on a 24px bar) overhangs 10px over the live canvas and wins the hit test — swallows orbit gestures, opens the modal on a within-slop tap. → Task 4.
- **B5** — `shouldPreloadSparkSplatRuntime('auto', …)` preloads unless `webGpu === 'ready'`, but a fresh page on a WebGPU-capable browser reports `'unavailable'` ('ready' only arrives after a splat canvas mounts) — so the first splat drop of every session still downloads the ~5 MB Spark chunk, contradicting the CHANGELOG claim. → Task 5.
- **B5b (accepted tradeoff, document only)** — with the Task 5 gate, a WebGPU device loss AFTER a successful init leaves the Spark fallback behind a cold 5 MB import. Accepted: preloading against a healthy WebGPU defeats the gate. → comment in Task 5, CHANGELOG note in Task 11.

**Coverage (restore):**
- **C1** — `colmapPathResolver.test.ts` title claims "ignores a database.db" but asserts nothing about it. → Task 6.
- **C2** — The vivid PSNR ramp (`#ef4444/#fb923c/#facc15/#22c55e`, user decision) is pinned by NO test — the revert made assertions tautological; the theme guard only excludes 3 token values. → Task 6.
- **C3** — Touch/embed Help-modal guards deleted in-range (`keeps the i hotkey working in touch/embed mode`, facade ignore-test, info-button-absence guard) while the range ADDED a touch-only entry point that depends on exactly those invariants. → Task 6.

**Cleanup:**
- **E1** — Three hand-rolled `:root` token parsers (`colors.test.ts`, `toolbarColumnHeight.test.ts`, `classContract.test.ts`), all reading only the FIRST `:root` block, with divergent error behavior. → Task 7.
- **E2** — `componentStoreBoundary.test.ts` walks/reads all of `src/` three times uncached; the 45s timeout absorbs self-inflicted contention. → Task 8.
- **E3** — The three-branch align-activation APPLY sequence is copy-pasted at both arming sites (`AlignPanel.tsx`, `globalContextMenuActionExecutor.ts`). → Task 9.
- **E4** — `getNextAlignPickingMode` (alignPanelViewModel) is byte-identical to the exported `getNextPickingMode` (globalContextMenuActionPolicy). → Task 9.
- **E5** — `TOUCH_STATUS_BAR_HELP_TITLE = 'Help'` re-types `HOTKEY_HELP_TITLE` plus a sync test that imports the constant anyway. → Task 10.
- **D2** — `uiStore.ts` `showHotkeyHelp` comment still lists the deleted top-left info button as an opener. → Task 10.
- **D3** — `.cursor-col-resize` / `.cursor-row-resize` in `index.css` orphaned by the `separatorStyles` deletion. → Task 10.

**Explicitly NOT in scope:** the Help panel's hidden `general` hotkey category (deliberate, user decision 2026-07-10); the context menu spanning under the divider when opened near the gallery edge IF Task 1's verification step cannot reproduce it (pre-existing stacking design, file a note instead).

---

### Task 1: Divider grab strip must not cover the canvas **[e2e]**

**Files:**
- Modify: `src/index.css` (`.resize-handle::before` block ~line 1755; two prose references to "9px")
- Test: `e2e/gallery.spec.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing later tasks rely on.

- [ ] **Step 1: Write the failing e2e test**

Append to the `test.describe('ImageGallery', …)` block in `e2e/gallery.spec.ts` (reuse the existing imports — `test`, `expect` from `./fixtures/test-fixtures`, `loadTestDataset` from `./fixtures/load-test-data`):

```ts
test('divider grab strip never hit-tests over the 3D canvas', async ({ page }) => {
  await page.goto('/');
  const closeButton = page.locator('button:has-text("×")').first();
  if (await closeButton.isVisible({ timeout: 2000 })) {
    await closeButton.click();
  }
  await loadTestDataset(page);
  await expect(page.locator('text=Source:')).toBeVisible({ timeout: 45000 });

  const divider = page.locator('.resize-handle');
  const box = await divider.boundingBox();
  expect(box).not.toBeNull();

  // 2px into the viewer from the divider's left edge must belong to the
  // scene, not the divider — the grab strip may only overhang the gallery.
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return {
      className: typeof el?.className === 'string' ? el.className : '',
      inScene: Boolean(el?.closest('.scene-3d-container')),
    };
  }, [box!.x - 2, box!.y + box!.height / 2] as [number, number]);

  expect(hit.className).not.toContain('resize-handle');
  expect(hit.inScene).toBe(true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test --project=chromium e2e/gallery.spec.ts -g "grab strip"`
Expected: FAIL — `hit.className` contains `resize-handle` (the strip currently starts at `left: -4px`).

- [ ] **Step 3: Fix the strip geometry and its comment**

In `src/index.css`, replace the `.resize-handle::before` block and its comment:

```css
/* Grab strip: widens the 1px target to 5px without adding width to the flex
   row. It overhangs the GALLERY side only (left: 0 starts at the divider).
   The viewer side must stay clear: this box lives in the root stacking
   context while everything inside Scene3D sits in an isolated context at
   z auto, so any overlap here wins the hit test over the canvas — and a band
   over live canvas turns orbit drags into gallery resizes (the collapsed
   rule below drops these pseudos for exactly that hazard). The cost is that
   the grip only lights when the pointer is on or past the divider, not on
   approach from the viewer.
   ::before, not ::after: an absolutely positioned ::before paints — and so
   hit-tests — BELOW the element's positioned children, so the collapse
   chevron keeps winning every event inside its own box. */
.resize-handle::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 5px;
  background-color: transparent;
  transition: background-color var(--transition-base);
}
```

Then fix the two stale "9px" references in the same file:
- In the `data-resizing` comment (~line 1805): `a resize drag routinely leaves this 9px strip` → `a resize drag routinely leaves this 5px strip`.
- In the collapsed-state comment (~line 1829): `Dropping both pseudos removes the grip, the tint AND the widened hit strip together — a dead 9px band over live canvas would swallow orbit drags for a gesture that does nothing.` → `Dropping both pseudos removes the grip, the tint AND the widened hit strip together — a dead strip has nothing to drag, and the expanded-state rule above explains why a band over live canvas is never acceptable.`

- [ ] **Step 4: Re-run the e2e test to verify it passes**

Run: `npx playwright test --project=chromium e2e/gallery.spec.ts -g "grab strip"`
Expected: PASS.

- [ ] **Step 5: Bounded verification of the reported menu-theft case**

The UI sweep reported `elementFromPoint(1162, 220)` returning the divider while the global context menu spanned x[975, 1163] — geometrically inconsistent with a 9px strip at x[975, 984], so treat it as unverified. Attempt a repro: load the dataset, right-click at ~20px left of the divider mid-height, and in DevTools-style evaluation check `document.elementFromPoint(...)` across the menu's width at a y-row inside the menu. If the divider steals any point INSIDE the menu's box that is not within the 5px strip, record the exact coordinates in the commit message and add a follow-up entry to this plan's Findings Register — do NOT expand this task's scope. If it only steals within the 5px strip over the gallery (menus rarely open there), note it as pre-existing stacking design and move on.

- [ ] **Step 6: Full gate and commit**

Run: `npm run test:run && npm run lint && npx tsc -b --force && npm run build && npx playwright test --project=chromium`
Expected: all green (3163+ unit tests, 56+ e2e).

```bash
git add src/index.css e2e/gallery.spec.ts
git commit -m "fix(ui): keep the divider grab strip off the canvas (gallery side only)"
```

---

### Task 2: Collapsed gallery reopen tab must stay fully on-screen **[e2e]**

**Files:**
- Modify: `src/index.css` (comment block ~lines 1838–1851 above `.gallery-collapse-handle`; new collapsed variant rule after `.gallery-collapse-handle:hover`)
- Test: `e2e/gallery.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/gallery.spec.ts`:

```ts
test('collapse tab stays fully on-screen when the gallery is collapsed', async ({ page }) => {
  await page.goto('/');
  const closeButton = page.locator('button:has-text("×")').first();
  if (await closeButton.isVisible({ timeout: 2000 })) {
    await closeButton.click();
  }
  await loadTestDataset(page);
  await expect(page.locator('text=Source:')).toBeVisible({ timeout: 45000 });

  const tab = page.locator('.gallery-collapse-handle');
  await tab.click(); // collapse — the gallery width animates for 300ms

  const viewport = page.viewportSize();
  await expect
    .poll(async () => {
      const box = await tab.boundingBox();
      return box ? box.x + box.width : Number.POSITIVE_INFINITY;
    }, { timeout: 2000 })
    .toBeLessThanOrEqual(viewport!.width);

  const box = await tab.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(11); // the full 12px tab, not a sliver

  await tab.click(); // reopen
  await expect(page.getByText('photo.jpg').first()).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test --project=chromium e2e/gallery.spec.ts -g "collapse tab"`
Expected: FAIL — collapsed, the tab's `x + width` exceeds the viewport width by ~5.5px.

- [ ] **Step 3: Replace the stale comment pair and add the collapsed variant**

In `src/index.css`, the block above `.gallery-collapse-handle` currently holds TWO stacked paragraphs — the original (claiming the tab "overhangs LEFT, onto the viewer … 12px width is exactly the control column's `right-3` inset") and the newer straddling rationale. The first paragraph describes a rule that no longer exists. Replace BOTH with one accurate block:

```css
/* Gallery collapse handle — a chevron tab straddling the viewer↔gallery
   divider (translate(50%, -50%) centres it on the 1px line). Straddling
   rather than hanging into the viewer: all 12px on the viewer side read as
   attached to the control column sitting 12px from the same edge, while
   centred the tab belongs to the divider it controls, clears those buttons
   by 7px, and costs 6px over the gallery's left padding (user decision
   2026-08-24: "middle"). The collapsed variant below is the exception.
   Not idle-hideable — the divider lives outside .scene-3d-container, which is
   where those fade rules are scoped. */
```

Then, immediately after the `.gallery-collapse-handle:hover` rule, add:

```css
/* Collapsed, the divider sits flush against the layout row's overflow-hidden
   edge, so a centred tab loses its right half to the clip — the reopen
   affordance shrank to a ~6px sliver. Anchor the whole tab inward instead:
   right: 0 with no X shift puts its right edge on the divider and all 12px
   over the viewer, where nothing clips (and where, with the gallery at zero
   width, there is no control column to collide with). */
.resize-handle[data-collapsed='true'] .gallery-collapse-handle {
  transform: translate(0, -50%);
}
```

(Specificity: `(0,3,0)` — two classes plus the attribute selector — beats the base rule's single class `(0,1,0)`; no `!important` needed.)

- [ ] **Step 4: Re-run the e2e test to verify it passes**

Run: `npx playwright test --project=chromium e2e/gallery.spec.ts -g "collapse tab"`
Expected: PASS, including the reopen click at the end.

- [ ] **Step 5: Full gate and commit**

Run: `npm run test:run && npm run lint && npx tsc -b --force && npm run build && npx playwright test --project=chromium`

```bash
git add src/index.css e2e/gallery.spec.ts
git commit -m "fix(ui): re-anchor the collapse tab inward while the gallery is collapsed"
```

---

### Task 3: Touch tap-to-wake for idle-hidden chrome

**Files:**
- Modify: `src/hooks/idleTimerPolicy.ts` (delete `IDLE_MOVE_THRESHOLD_PX` + `hasDeliberateIdlePointerMove`; add `IDLE_WAKE_TAP_MAX_MOVE_PX` + `isIdleWakeTap`)
- Modify: `src/hooks/useIdleTimer.ts` (wire tap detection into the pointer listeners)
- Test: `src/hooks/idleTimerPolicy.test.ts`

**Interfaces:**
- Consumes: existing `IdlePointerPosition` interface and `isIdleIgnoredTarget` from `idleTimerPolicy.ts`.
- Produces: `isIdleWakeTap(pointerType: string, downPosition: IdlePointerPosition | null, upPosition: IdlePointerPosition, threshold?: number): boolean` — no later task uses it.

- [ ] **Step 1: Write the failing policy tests**

In `src/hooks/idleTimerPolicy.test.ts`, DELETE the `hasDeliberateIdlePointerMove` tests (they import `hasDeliberateIdlePointerMove` and `IDLE_MOVE_THRESHOLD_PX` — both are removed this task) and add:

```ts
describe('isIdleWakeTap', () => {
  it('wakes on a still touch tap', () => {
    expect(isIdleWakeTap('touch', { x: 100, y: 100 }, { x: 104, y: 103 })).toBe(true);
  });

  it('never wakes for mouse or pen — desktop keeps its Tab/status-bar wake paths', () => {
    expect(isIdleWakeTap('mouse', { x: 100, y: 100 }, { x: 100, y: 100 })).toBe(false);
    expect(isIdleWakeTap('pen', { x: 100, y: 100 }, { x: 100, y: 100 })).toBe(false);
  });

  it('ignores drags past the tap threshold so orbit gestures keep chrome hidden', () => {
    expect(isIdleWakeTap('touch', { x: 100, y: 100 }, { x: 130, y: 100 })).toBe(false);
  });

  it('ignores a pointerup with no recorded down position', () => {
    expect(isIdleWakeTap('touch', null, { x: 100, y: 100 })).toBe(false);
  });
});
```

Update the test file's import list accordingly (`isIdleWakeTap` in, the two deleted names out).

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/hooks/idleTimerPolicy.test.ts`
Expected: FAIL — `isIdleWakeTap` is not exported.

- [ ] **Step 3: Implement the policy function**

In `src/hooks/idleTimerPolicy.ts`, delete `IDLE_MOVE_THRESHOLD_PX` and `hasDeliberateIdlePointerMove` (confirm no other consumers first: `grep -rn "hasDeliberateIdlePointerMove\|IDLE_MOVE_THRESHOLD_PX" src/` must show only the policy file and its test). Add:

```ts
export const IDLE_WAKE_TAP_MAX_MOVE_PX = 10;

/**
 * A completed touch TAP — on anything, bare canvas included — wakes hidden
 * chrome. Touch has no equivalent of the desktop wake paths (Tab, or mousing
 * over the still-hit-testable opacity-0 status bar): while idle, every
 * idle-hideable is visibility:hidden and unhittable and the touch status bar
 * unmounts entirely, so without this a touch session that goes idle once can
 * never reach chrome again. Taps only: orbit/pinch gestures travel past the
 * threshold and keep chrome hidden while the scene is being driven, matching
 * the desktop rule that scene interaction does not postpone hiding.
 */
export function isIdleWakeTap(
  pointerType: string,
  downPosition: IdlePointerPosition | null,
  upPosition: IdlePointerPosition,
  threshold = IDLE_WAKE_TAP_MAX_MOVE_PX
): boolean {
  if (pointerType !== 'touch' || !downPosition) return false;
  const dx = upPosition.x - downPosition.x;
  const dy = upPosition.y - downPosition.y;
  return dx * dx + dy * dy <= threshold * threshold;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/idleTimerPolicy.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into useIdleTimer**

In `src/hooks/useIdleTimer.ts`:

Add to the imports from `./idleTimerPolicy`: `isIdleIgnoredTarget`, `isIdleWakeTap`, and the type `IdlePointerPosition`.

Add a ref next to the existing refs at the top of the hook:

```ts
const touchDownPositionRef = useRef<IdlePointerPosition | null>(null);
```

Inside the listeners effect, after `onPointerActivity`, add two wrappers and register THEM for pointerdown/pointerup (pointermove keeps `onPointerActivity` as-is):

```ts
// Touch tap-to-wake (see isIdleWakeTap). The generic activity handler above
// deliberately filters to pause targets; these wrappers add the one touch
// exception without loosening that filter for mouse/pen.
const onPointerDown = (e: PointerEvent) => {
  touchDownPositionRef.current = e.pointerType === 'touch'
    ? { x: e.clientX, y: e.clientY }
    : null;
  onPointerActivity(e);
};
const onPointerUp = (e: PointerEvent) => {
  if (
    !isIdleIgnoredTarget(e.target) &&
    isIdleWakeTap(e.pointerType, touchDownPositionRef.current, { x: e.clientX, y: e.clientY })
  ) {
    resetTimer();
  }
  touchDownPositionRef.current = null;
  onPointerActivity(e);
};
```

Swap the registrations (and the matching cleanup lines):

```ts
el.addEventListener('pointerdown', onPointerDown, { passive: true });
el.addEventListener('pointerup', onPointerUp, { passive: true });
```

- [ ] **Step 6: Full gate and commit**

Run: `npm run test:run && npm run lint && npx tsc -b --force && npm run build`

```bash
git add src/hooks/idleTimerPolicy.ts src/hooks/idleTimerPolicy.test.ts src/hooks/useIdleTimer.ts
git commit -m "fix(touch): a completed tap wakes idle-hidden chrome (was unrecoverable without a keyboard)"
```

---

### Task 4: Touch status bar owns its 44px tap height honestly

**Files:**
- Modify: `src/components/layout/statusBarViewModel.ts` (`TOUCH_STATUS_BAR_HELP_BUTTON_CLASS` + its comment)
- Modify: `src/components/layout/TouchStatusBar.tsx` (`h-6` → `h-11`; header comment)
- Test: `src/components/layout/statusBarViewModel.test.ts`, `src/components/layout/TouchStatusBar.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `TOUCH_STATUS_BAR_HELP_BUTTON_CLASS` value changes to exactly `STATUS_BAR_SHORTCUTS_BUTTON_CLASS` — Task 10 edits neighboring constants in the same file afterward.

**Design decision (recorded):** a 44px tap target centered on a 24px bar MUST overhang 20px somewhere, and at the bottom of the screen the only direction is up, over the live canvas — there is no overlay geometry that avoids it. So the bar itself becomes 44px tall (`.h-11` exists in index.css as a 2.75rem literal, immune to the compact ladder). The height cost is bounded: the bar auto-hides when idle, and Task 3 makes it recoverable.

- [ ] **Step 1: Update the failing assertions first**

In `src/components/layout/statusBarViewModel.test.ts` (~line 96), the touch entry test currently asserts:

```ts
    // 44px tap box over a 24px bar, on top of the desktop entry's text styling.
    expect(TOUCH_STATUS_BAR_HELP_BUTTON_CLASS).toBe(
      `relative touch-hit-44 ${STATUS_BAR_SHORTCUTS_BUTTON_CLASS}`
    );
```

Replace with:

```ts
    // The bar itself is 44px tall (TouchStatusBar h-11), so the button needs
    // no synthetic tap box — and must not carry one: touch-hit-44 centered on
    // the old 24px bar overhung 10px of live canvas and stole orbit gestures.
    expect(TOUCH_STATUS_BAR_HELP_BUTTON_CLASS).toBe(STATUS_BAR_SHORTCUTS_BUTTON_CLASS);
```

In `src/components/layout/TouchStatusBar.test.tsx` (line ~37), replace:

```ts
    expect(help.className).toContain('touch-hit-44');
```

with:

```ts
    expect(help.className).not.toContain('touch-hit-44');
```

- [ ] **Step 2: Run both test files to verify they fail**

Run: `npx vitest run src/components/layout/statusBarViewModel.test.ts src/components/layout/TouchStatusBar.test.tsx`
Expected: FAIL on both changed assertions.

- [ ] **Step 3: Implement**

In `src/components/layout/statusBarViewModel.ts`, replace the constant and its comment:

```ts
// No synthetic tap box: the touch bar itself is 44px tall (h-11 in
// TouchStatusBar), so the button's real box already meets the tap minimum.
// touch-hit-44 is BANNED here — centered on a bottom-of-screen bar it can
// only overhang upward, over the live canvas, where it steals orbit
// gestures (found by adversarial review 2026-08-29).
export const TOUCH_STATUS_BAR_HELP_BUTTON_CLASS = STATUS_BAR_SHORTCUTS_BUTTON_CLASS;
```

In `src/components/layout/TouchStatusBar.tsx`: change `h-6` to `h-11` in the footer's className, and update the header comment line `* Height: 24px (vs 40px desktop status bar)` to `* Height: 44px — the tap-target minimum, so the Help button needs no synthetic tap box (vs 40px desktop status bar)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/layout/statusBarViewModel.test.ts src/components/layout/TouchStatusBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full gate and commit**

Run: `npm run test:run && npm run lint && npx tsc -b --force && npm run build`

```bash
git add src/components/layout/statusBarViewModel.ts src/components/layout/statusBarViewModel.test.ts src/components/layout/TouchStatusBar.tsx src/components/layout/TouchStatusBar.test.tsx
git commit -m "fix(touch): 44px status bar instead of a tap box that overhung the canvas"
```

---

### Task 5: Spark preload gate keys on capability, not readiness

**Files:**
- Modify: `src/utils/splatBackendPolicy.ts` (`shouldPreloadSparkSplatRuntime`)
- Test: `src/utils/splatBackendPolicy.test.ts` (~line 97)

**Interfaces:**
- Consumes: `WebGpuSplatBackendState = 'unsupported' | 'unavailable' | 'ready' | 'failed'` (existing).
- Produces: changed gate semantics — `'unavailable'` no longer triggers preload. No other task depends on it.

- [ ] **Step 1: Flip the failing assertion**

In `src/utils/splatBackendPolicy.test.ts`, the test `'preloads Spark when requested or when auto WebGPU is not ready'`: rename it to `'preloads Spark when requested, or when auto WebGPU cannot work'` and change line 98:

```ts
    // 'unavailable' = capable browser, renderer just not initialized yet (it
    // only flips to 'ready' once a splat canvas mounts) — every fresh page on
    // a WebGPU machine reports it, so preloading here re-downloaded the 5 MB
    // fallback on the first drop of every session.
    expect(shouldPreloadSparkSplatRuntime('auto', { webGpu: 'unavailable' })).toBe(false);
```

(the `'ready'`/`'unsupported'`/`'failed'`/`'spark'`/`'webgpu'` lines stay as they are).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/utils/splatBackendPolicy.test.ts`
Expected: FAIL — the gate still returns `true` for `'unavailable'`.

- [ ] **Step 3: Implement the gate change**

In `src/utils/splatBackendPolicy.ts`, replace `shouldPreloadSparkSplatRuntime`:

```ts
export function shouldPreloadSparkSplatRuntime(
  requested: SplatBackendPreference,
  availability: Pick<SplatBackendAvailability, 'webGpu'>
): boolean {
  // Preload only when Spark is certain to be needed: requested outright, or
  // auto on a browser where WebGPU cannot work ('unsupported') or has already
  // failed. 'unavailable' means capable-but-not-initialized — it is every
  // fresh page's state on a WebGPU machine ('ready' only arrives once a splat
  // canvas mounts), and preloading against it re-downloaded the 5 MB fallback
  // on the first drop of every session. Deliberate tradeoff: a device loss
  // AFTER a successful init now starts the Spark download cold at failure
  // time — accepted, because prefetching against a healthy WebGPU defeats
  // the gate's whole purpose.
  return requested === 'spark'
    || (
      requested === 'auto'
      && (availability.webGpu === 'unsupported' || availability.webGpu === 'failed')
    );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/utils/splatBackendPolicy.test.ts src/hooks/fileDropzoneWorkflow.test.ts src/hooks/useFileDropzone.test.ts`
Expected: PASS (the workflow seam defaults to `() => true` and is unaffected; if any dropzone test stubs the seam with `'unavailable'` expectations, align it with the new gate).

- [ ] **Step 5: Full gate and commit**

Run: `npm run test:run && npm run lint && npx tsc -b --force && npm run build`

```bash
git add src/utils/splatBackendPolicy.ts src/utils/splatBackendPolicy.test.ts
git commit -m "fix(splat): don't preload Spark on capable-but-uninitialized WebGPU (first-drop 5MB)"
```

---

### Task 6: Restore the weakened test coverage

**Files:**
- Modify: `src/utils/colmapPathResolver.test.ts` (~line 66)
- Modify: `src/theme/colors.test.ts` (after the `'pins the unavailable metric colour…'` test)
- Modify: `src/components/modals/HotkeyHelpModal.test.tsx`
- Modify: `src/components/modals/useHotkeyHelpStoreFacade.test.ts`
- Modify: `src/components/modals/hotkeyHelpViewModel.test.ts`

**Interfaces:**
- Consumes: `useHotkeyHelpStoreFacade`, `useUIStore`, existing test helpers (`renderModal`, `pressI`, `openFromStatusBar`) already in the modal test file.
- Produces: nothing.

All five edits are additive test code — write them, then run once. Each MUST pass against current production code (they pin current behavior; nothing here changes production files).

- [ ] **Step 1: Pin the `.db` ignore in the resolver test**

In `src/utils/colmapPathResolver.test.ts`, inside `'captures optional rigs and frames files and ignores a database.db'`, add before the existing assertions:

```ts
    // The ignore is the point (0e96d19 removed the role): no field of the
    // selection may resolve to the .db path.
    expect(Object.values(sel ?? {})).not.toContain('sparse/0/database.db');
```

- [ ] **Step 2: Pin the vivid ramp literals**

In `src/theme/colors.test.ts`, after the `'pins the unavailable metric colour to --text-muted, and only that one'` test, add:

```ts
  it('pins the vivid quality-ramp stops by value', () => {
    // These four are a DATA ENCODING, not chrome (splatPsnrMetric.ts). The
    // off-the-semantic-ramp guard above cannot stop a re-mute that picks new
    // near-muted hexes — that exact consolidation shipped and was reverted
    // (user decision 2026-08-24: vivid). Moving these is a product decision;
    // update this test only alongside one.
    expect(SPLAT_PSNR_RED).toBe('#ef4444');
    expect(SPLAT_PSNR_ORANGE).toBe('#fb923c');
    expect(SPLAT_PSNR_YELLOW).toBe('#facc15');
    expect(SPLAT_PSNR_GREEN).toBe('#22c55e');
  });
```

(The four constants are already imported by this file.)

- [ ] **Step 3: Restore the touch/embed modal guards**

In `src/components/modals/HotkeyHelpModal.test.tsx`, after the `'stays open while the scene is idle…'` test, add:

```ts
  it('opens from the store in touch mode — the touch status bar Help entry depends on it', () => {
    useUIStore.setState({ touchMode: true });
    renderModal();
    openFromStatusBar();

    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('keeps the i hotkey working in embed mode', () => {
    useUIStore.setState({ embedMode: true });
    renderModal();

    pressI();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });
```

- [ ] **Step 4: Restore the facade isolation guard**

In `src/components/modals/useHotkeyHelpStoreFacade.test.ts`, add:

```ts
  it('ignores touch mode, embed mode, and idle chrome changes', () => {
    const { result } = renderHook(() => useHotkeyHelpStoreFacade());
    const before = result.current;

    act(() => {
      useUIStore.setState({ touchMode: true, embedMode: true, isIdle: true });
    });

    // Same object identity: the facade subscribes to none of those keys, so
    // re-adding a touchMode/embedMode/isIdle gate here (the pre-0.11 shape)
    // fails this test instead of silently breaking the touch Help entry.
    expect(result.current).toBe(before);
  });
```

- [ ] **Step 5: Restore the info-button-absence guard**

In `src/components/modals/hotkeyHelpViewModel.test.ts`, re-add at the end of the top-level describe (this exact test existed at `6acaa8a` and was deleted in-range):

```ts
  it('exports no floating info-button view model anymore', async () => {
    // The top-left ⓘ button was dropped once the status bar gained its visible
    // ⌨ Shortcuts entry into this same panel (2026-08-13); its predicate,
    // classes, styles, and labels went with it.
    const viewModel = await import('./hotkeyHelpViewModel');
    for (const removed of [
      'shouldShowHotkeyInfoButton',
      'getHotkeyInfoButtonClassName',
      'getHotkeyInfoButtonStyle',
      'HOTKEY_INFO_BUTTON_CLASS',
      'HOTKEY_INFO_BUTTON_HIDDEN_CLASS',
      'HOTKEY_INFO_BUTTON_ICON_CLASS',
      'HOTKEY_INFO_BUTTON_TITLE',
      'HOTKEY_INFO_BUTTON_ARIA_LABEL',
    ]) {
      expect(viewModel).not.toHaveProperty(removed);
    }
  });
```

- [ ] **Step 6: Run all five files — every new test must pass immediately**

Run: `npx vitest run src/utils/colmapPathResolver.test.ts src/theme/colors.test.ts src/components/modals/HotkeyHelpModal.test.tsx src/components/modals/useHotkeyHelpStoreFacade.test.ts src/components/modals/hotkeyHelpViewModel.test.ts`
Expected: PASS. A failure means current production code violates the pinned invariant — STOP and report rather than adjusting the test.

- [ ] **Step 7: Full gate and commit**

Run: `npm run test:run && npm run lint && npx tsc -b --force && npm run build`

```bash
git add src/utils/colmapPathResolver.test.ts src/theme/colors.test.ts src/components/modals/HotkeyHelpModal.test.tsx src/components/modals/useHotkeyHelpStoreFacade.test.ts src/components/modals/hotkeyHelpViewModel.test.ts
git commit -m "test: restore coverage weakened in-range (.db ignore, vivid ramp pins, touch/embed help guards)"
```

---

### Task 7: One shared `:root` token parser for the contract tests

**Files:**
- Create: `src/test/cssRootTokens.ts`
- Create: `src/test/cssRootTokens.test.ts`
- Modify: `src/theme/colors.test.ts` (delete local `readRootTokens`, import the shared one)
- Modify: `src/components/viewer3d/toolbarColumnHeight.test.ts` (delete local `rootTokens` block + `toPixels`, use shared)
- Modify: `src/theme/classContract.test.ts` (delete `rootLadder()`, build the ladder from the shared reader)

**Interfaces:**
- Produces (later steps in this task consume):
  - `readRootTokens(cssPath?: string): Map<string, string>` — token name (unescaped) → raw value string; reads EVERY `:root` block; strips comments first; throws if no block found.
  - `resolveValueToPixels(tokens: Map<string, string>, value: string): number` — resolves `px`, `rem` (×16), bare `0`, and `var(--name)` chains; THROWS on anything else.
  - `INDEX_CSS_PATH: string`, `ROOT_FONT_SIZE = 16`.

- [ ] **Step 1: Write the failing helper test**

Create `src/test/cssRootTokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readRootTokens, resolveValueToPixels } from './cssRootTokens';

describe('cssRootTokens', () => {
  const tokens = readRootTokens();

  it('reads a full token map out of index.css', () => {
    expect(tokens.size).toBeGreaterThan(50);
    expect(tokens.get('--sp-4')).toBeDefined();
    expect(tokens.get('--sp-1.5')).toBeDefined(); // escaped name resolved
  });

  it('resolves px, rem, zero, and var() chains to pixels', () => {
    expect(resolveValueToPixels(tokens, '16px')).toBe(16);
    expect(resolveValueToPixels(tokens, '1rem')).toBe(16);
    expect(resolveValueToPixels(tokens, '0')).toBe(0);
    expect(resolveValueToPixels(tokens, 'var(--sp-4)')).toBe(
      resolveValueToPixels(tokens, tokens.get('--sp-4')!)
    );
  });

  it('throws on unresolvable values instead of returning NaN', () => {
    // A silent NaN made classContract's old rootLadder() quietly vacuous for
    // any rung it could not parse; the shared parser refuses instead.
    expect(() => resolveValueToPixels(tokens, 'calc(1px + 1px)')).toThrow();
    expect(() => resolveValueToPixels(tokens, 'var(--does-not-exist)')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/test/cssRootTokens.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/test/cssRootTokens.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The stylesheet every :root token contract in the suite reads. */
export const INDEX_CSS_PATH = resolve(__dirname, '../index.css');

export const ROOT_FONT_SIZE = 16;

/**
 * Shared reader for the design tokens declared in `:root`. Three contract
 * tests (colors, classContract, toolbarColumnHeight) each hand-rolled this
 * with divergent behavior — all truncated at the FIRST `:root` block and one
 * stored silent NaN — so reorganizing the tokens broke each differently.
 * One parser, one failure mode.
 *
 * Comments are stripped first: the :root block is thick with prose that
 * quotes hex values and contrast arithmetic, and a value named in prose must
 * never be mistaken for a declaration. Escaped names (`--sp-1\.5`) are
 * stored unescaped (`--sp-1.5`). EVERY `:root` block in the file contributes
 * (later blocks override earlier ones, matching the cascade).
 */
export function readRootTokens(cssPath: string = INDEX_CSS_PATH): Map<string, string> {
  const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const tokens = new Map<string, string>();
  let blocks = 0;
  for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
    blocks += 1;
    for (const declaration of block[1].matchAll(/(--(?:[\w-]|\\.)+)\s*:\s*([^;]+);/g)) {
      tokens.set(declaration[1].replace(/\\(.)/g, '$1'), declaration[2].trim());
    }
  }
  if (blocks === 0) throw new Error(`no :root block found in ${cssPath}`);
  return tokens;
}

/**
 * Resolve a declaration VALUE to pixels: raw px, rem (16px root), bare 0, or
 * a `var(--name)` chain through other tokens. THROWS on anything else — a
 * contract test that measures a utility must fail loudly on a rung it cannot
 * read, never report a silent 0 or NaN.
 */
export function resolveValueToPixels(tokens: Map<string, string>, value: string): number {
  const trimmed = value.trim();
  const reference = trimmed.match(/^var\((--(?:[\w-]|\\.)+)\)$/);
  if (reference) {
    const name = reference[1].replace(/\\(.)/g, '$1');
    const next = tokens.get(name);
    if (next === undefined) {
      throw new Error(`${trimmed} does not resolve to a :root token`);
    }
    return resolveValueToPixels(tokens, next);
  }
  const rem = trimmed.match(/^([\d.]+)rem$/);
  if (rem) return Number(rem[1]) * ROOT_FONT_SIZE;
  const px = trimmed.match(/^([\d.]+)px$/);
  if (px) return Number(px[1]);
  if (trimmed === '0') return 0;
  throw new Error(`cannot resolve "${value}" to pixels`);
}
```

- [ ] **Step 4: Run to verify the helper test passes**

Run: `npx vitest run src/test/cssRootTokens.test.ts`
Expected: PASS.

- [ ] **Step 5: Migrate the three consumers, one at a time, running each file's tests after its edit**

1. `src/theme/colors.test.ts`: delete the local `readRootTokens()` function (and the now-unused `CSS_PATH`/`readFileSync`/`resolve` imports if nothing else uses them); `import { readRootTokens } from '../test/cssRootTokens';`. Keep the file's `token()` wrapper unchanged — it reads from the map exactly as before. Preserve the existing comment about stripping prose hexes by MOVING it? No — the shared helper now owns that rationale; leave a one-liner: `// Token parsing lives in src/test/cssRootTokens.ts, shared with the other :root contracts.`
   Run: `npx vitest run src/theme/colors.test.ts`
2. `src/components/viewer3d/toolbarColumnHeight.test.ts`: delete the module-level `rootTokens` block and the local `toPixels`; replace with:

```ts
import { readRootTokens, resolveValueToPixels } from '../../test/cssRootTokens';

const rootTokens = readRootTokens();
const toPixels = (value: string): number => resolveValueToPixels(rootTokens, value);
```

   Keep the surrounding explanatory comment about the `--sp-*` ladder indirection. Run: `npx vitest run src/components/viewer3d/toolbarColumnHeight.test.ts`
3. `src/theme/classContract.test.ts`: delete the `rootLadder()` function; replace its call with:

```ts
import { readRootTokens, resolveValueToPixels } from '../test/cssRootTokens';
// ...
const rootTokens = readRootTokens();
const ladder = new Map(
  [...rootTokens]
    .filter(([name]) => name.startsWith('--sp-'))
    .map(([name, value]) => [name, resolveValueToPixels(rootTokens, value)] as const)
);
```

   The `'parses a full ladder out of :root'` guard test stays and must still pass (`--sp-4` → 16, `--sp-1.5` → 6). NOTE: the old parser stored NaN for unparsable rungs; the shared one throws. If the throw fires, a rung is genuinely unreadable — fix the rung or extend the helper, never catch-and-NaN. Run: `npx vitest run src/theme/classContract.test.ts`

- [ ] **Step 6: Full gate and commit**

Run: `npm run test:run && npm run lint && npx tsc -b --force && npm run build`

```bash
git add src/test/cssRootTokens.ts src/test/cssRootTokens.test.ts src/theme/colors.test.ts src/theme/classContract.test.ts src/components/viewer3d/toolbarColumnHeight.test.ts
git commit -m "test: one shared :root token parser for the three CSS contract suites"
```

---

### Task 8: Cache the store-boundary tree walk; restore the 15s budget

**Files:**
- Modify: `src/components/componentStoreBoundary.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Restructure to a single walk**

In `src/components/componentStoreBoundary.test.ts`:

Replace the timeout constant and its comment (lines ~7–14):

```ts
// One walk of src/, shared by all three tests below. The suite runs alongside
// the other whole-tree scans (classContract, sparkImportBoundary), and three
// separate uncached walks of the same tree were what pushed this file past
// its budget on a loaded machine — the timeout kept widening (15s → 45s) to
// absorb work the tests were repeating, not work they needed. With the walk
// cached, 15s is comfortable: a real regression here would be orders of
// magnitude, not 2x.
const STORE_BOUNDARY_SCAN_TIMEOUT_MS = 15_000;
```

After the `collectSourceFiles`/`fileExists` helpers, add the shared walk (module scope, so it starts once):

```ts
const sourceFilesPromise = collectSourceFiles(SRC_ROOT);
const componentFilesPromise = sourceFilesPromise.then((files) =>
  files.filter((file) => file.startsWith(COMPONENTS_ROOT + path.sep))
);
```

Then, in each of the three tests, replace the walk call:
- Test 1 (`keeps production component store hooks behind facade modules`): `const files = await collectSourceFiles(COMPONENTS_ROOT);` → `const files = await componentFilesPromise;`
- Test 2 (`keeps non-component store hook calls in documented boundary modules`): `const files = await collectSourceFiles(SRC_ROOT);` → `const files = await sourceFilesPromise;`
- Test 3 (`keeps store facades covered by colocated tests`): `const files = await collectSourceFiles(COMPONENTS_ROOT);` → `const files = await componentFilesPromise;`

- [ ] **Step 2: Run the file standalone**

Run: `npx vitest run src/components/componentStoreBoundary.test.ts`
Expected: PASS, well under 5s.

- [ ] **Step 3: Run the full suite twice to shake out contention flakes**

Run: `npm run test:run` — twice. Both runs green, and this file's tests must not approach 15s in either run. If they do, STOP and report timings instead of re-widening the budget.

- [ ] **Step 4: Lint, typecheck, build, commit**

Run: `npm run lint && npx tsc -b --force && npm run build`

```bash
git add src/components/componentStoreBoundary.test.ts
git commit -m "test: single cached src/ walk in componentStoreBoundary; restore the 15s budget"
```

---

### Task 9: One owner for the align-activation apply sequence and the mode toggle

**Files:**
- Modify: `src/components/viewer3d/panels/alignPanelViewModel.ts` (add `applyAlignPickingActivation` + `AlignPickingActivationSinks`; delete `getNextAlignPickingMode`; import `getNextPickingMode`)
- Modify: `src/components/viewer3d/panels/AlignPanel.tsx` (~lines 45–60: use the shared apply)
- Modify: `src/components/viewer3d/contextMenu/globalContextMenuActionExecutor.ts` (~lines 137–153: use the shared apply)
- Test: `src/components/viewer3d/panels/alignPanelViewModel.test.ts`

**Interfaces:**
- Consumes: existing `getAlignPickingActivation`, `AlignPickingActivation` (fields `pickingMode: PointPickingMode`, `showPointCloud: boolean | null`, `colorMode: ColorMode | null`), `getNextPickingMode` from `../contextMenu/globalContextMenuActionPolicy` (no import cycle: the policy imports only from the store barrel).
- Produces:
  - `AlignPickingActivationSinks { setShowPointCloud(visible: boolean): void; setColorMode(mode: ColorMode): void; setPickingMode(mode: PointPickingMode): void; }`
  - `applyAlignPickingActivation(activation: AlignPickingActivation, sinks: AlignPickingActivationSinks): void`

- [ ] **Step 1: Write the failing tests**

In `src/components/viewer3d/panels/alignPanelViewModel.test.ts`, add (`PointPickingMode` values are `'off' | 'origin-1pt' | 'distance-2pt' | 'normal-3pt'`):

```ts
describe('applyAlignPickingActivation', () => {
  it('applies every non-null field, visibility before mode', () => {
    const calls: string[] = [];
    applyAlignPickingActivation(
      { pickingMode: 'origin-1pt', showPointCloud: true, colorMode: 'rgb' },
      {
        setShowPointCloud: (visible) => calls.push(`show:${visible}`),
        setColorMode: (mode) => calls.push(`color:${mode}`),
        setPickingMode: (mode) => calls.push(`mode:${mode}`),
      }
    );
    expect(calls).toEqual(['show:true', 'color:rgb', 'mode:origin-1pt']);
  });

  it('skips the null fields so disarming touches nothing but the mode', () => {
    const calls: string[] = [];
    applyAlignPickingActivation(
      { pickingMode: 'off', showPointCloud: null, colorMode: null },
      {
        setShowPointCloud: () => calls.push('show'),
        setColorMode: () => calls.push('color'),
        setPickingMode: (mode) => calls.push(`mode:${mode}`),
      }
    );
    expect(calls).toEqual(['mode:off']);
  });
});
```

Add `applyAlignPickingActivation` to the file's imports.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/viewer3d/panels/alignPanelViewModel.test.ts`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement in the view model**

In `src/components/viewer3d/panels/alignPanelViewModel.ts`:

1. Add near `AlignPickingActivation`:

```ts
/** The three store setters an arming site must feed an activation into. */
export interface AlignPickingActivationSinks {
  setShowPointCloud: (visible: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
  setPickingMode: (mode: PointPickingMode) => void;
}

/**
 * The APPLY half of arming: getAlignPickingActivation owns the rule, this
 * owns feeding it into the stores. Both arming sites (AlignPanel and the
 * context-menu executor) MUST route through here — the rule being
 * centralized while the apply was copy-pasted is exactly how the two sites
 * could still drift (adding a field to AlignPickingActivation would silently
 * no-op at whichever site wasn't updated).
 */
export function applyAlignPickingActivation(
  activation: AlignPickingActivation,
  sinks: AlignPickingActivationSinks
): void {
  if (activation.showPointCloud !== null) {
    sinks.setShowPointCloud(activation.showPointCloud);
  }
  if (activation.colorMode !== null) {
    sinks.setColorMode(activation.colorMode);
  }
  sinks.setPickingMode(activation.pickingMode);
}
```

2. Delete the private `getNextAlignPickingMode` and import the identical exported one instead: add `import { getNextPickingMode } from '../contextMenu/globalContextMenuActionPolicy';` and in `getAlignPickingButtonState` use `nextMode: getNextPickingMode(currentMode, targetMode)`. (`ActiveAlignPickingMode` is `Exclude<PointPickingMode, 'off'>` — the exact parameter type `getNextPickingMode` takes.)

- [ ] **Step 4: Run to verify the new tests pass**

Run: `npx vitest run src/components/viewer3d/panels/alignPanelViewModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Collapse both call sites**

`src/components/viewer3d/panels/AlignPanel.tsx` — replace the body of `armPickingMode` (keep its existing comments about click-time reads):

```ts
  const armPickingMode = (nextMode: PointPickingMode) => {
    // Read at click time. The panel does not subscribe to point-cloud state, so
    // this is the freshest answer and costs nothing while the tools sit idle.
    const { showPointCloud, colorMode } = getPointCloudSnapshot();
    applyAlignPickingActivation(
      getAlignPickingActivation({ nextMode, showPointCloud, colorMode }),
      { setShowPointCloud, setColorMode, setPickingMode }
    );
  };
```

`src/components/viewer3d/contextMenu/globalContextMenuActionExecutor.ts` — the arming helper's body becomes (its `deps` object already carries the three setters under the same names, so it satisfies `AlignPickingActivationSinks` structurally):

```ts
  applyAlignPickingActivation(
    getAlignPickingActivation({
      nextMode,
      showPointCloud: deps.showPointCloud,
      colorMode: deps.colorMode,
    }),
    deps
  );
```

Update both files' imports to include `applyAlignPickingActivation`.

- [ ] **Step 6: Full gate and commit**

Run: `npm run test:run && npm run lint && npx tsc -b --force && npm run build`

```bash
git add src/components/viewer3d/panels/alignPanelViewModel.ts src/components/viewer3d/panels/alignPanelViewModel.test.ts src/components/viewer3d/panels/AlignPanel.tsx src/components/viewer3d/contextMenu/globalContextMenuActionExecutor.ts
git commit -m "refactor: one owner for the align-activation apply; drop the duplicated mode toggle"
```

---

### Task 10: Literal dedup, stale comments, dead CSS

**Files:**
- Modify: `src/components/layout/statusBarViewModel.ts` (alias `TOUCH_STATUS_BAR_HELP_TITLE`)
- Modify: `src/components/layout/statusBarViewModel.test.ts` (drop the now-tautological sync assertion)
- Modify: `src/store/stores/uiStore.ts` (~line 156 comment)
- Modify: `src/index.css` (delete `.cursor-col-resize`, `.cursor-row-resize`)

**Interfaces:**
- Consumes: `HOTKEY_HELP_TITLE` from `src/components/modals/hotkeyHelpViewModel.ts` (value `'Help'`; that module imports nothing from `layout/`, so no cycle).
- Produces: nothing.

- [ ] **Step 1: Alias the touch Help title**

In `src/components/layout/statusBarViewModel.ts`: add `import { HOTKEY_HELP_TITLE } from '../modals/hotkeyHelpViewModel';` and change:

```ts
export const TOUCH_STATUS_BAR_HELP_TITLE = 'Help';
```

to:

```ts
// Aliased, not re-typed: renaming the panel must rename this tooltip with it.
export const TOUCH_STATUS_BAR_HELP_TITLE = HOTKEY_HELP_TITLE;
```

In `src/components/layout/statusBarViewModel.test.ts`, delete the line `expect(TOUCH_STATUS_BAR_HELP_TITLE).toBe(HOTKEY_HELP_TITLE);` (now tautological). KEEP `expect(TOUCH_STATUS_BAR_HELP_TITLE).not.toContain('(');` and the desktop `toContain` assertion — those still pin real content.

- [ ] **Step 2: Fix the uiStore comment**

In `src/store/stores/uiStore.ts` (~line 155), the `showHotkeyHelp` comment lists three openers including the deleted info button. Replace:

```ts
  // Keyboard-shortcuts / About panel. Store-owned (not HotkeyHelpModal-local)
  // because widely separated trees open it: the top-left info button in the
  // modal itself, the desktop status bar's Shortcuts entry, and the touch
  // status bar's Help entry. Transient — never persisted.
```

with:

```ts
  // Keyboard-shortcuts / About panel. Store-owned (not HotkeyHelpModal-local)
  // because widely separated trees open it: the desktop status bar's
  // Shortcuts entry and the touch status bar's Help entry. Transient — never
  // persisted.
```

- [ ] **Step 3: Delete the orphaned cursor utilities**

First verify: `grep -rn "cursor-col-resize\|cursor-row-resize" src/ --include="*.ts" --include="*.tsx"` must return nothing (their only referencer, `separatorStyles`, was deleted in-range). Then delete these two lines from `src/index.css` (~line 1281):

```css
.cursor-col-resize { cursor: col-resize; }
.cursor-row-resize { cursor: row-resize; }
```

Leave `.cursor-n-resize` / `.cursor-e-resize` / `.cursor-s-resize` etc. alone — they have live referencers (image-detail resize handles).

- [ ] **Step 4: Full gate and commit**

Run: `npm run test:run && npm run lint && npx tsc -b --force && npm run build`

```bash
git add src/components/layout/statusBarViewModel.ts src/components/layout/statusBarViewModel.test.ts src/store/stores/uiStore.ts src/index.css
git commit -m "chore: alias the Help title, fix the stale opener comment, drop orphaned cursor rules"
```

---

### Task 11: CHANGELOG amendment, final gate, re-tag **[e2e]**

**Files:**
- Modify: `CHANGELOG.md` (`[0.11.0]` section — the tag is local and unpushed, so amend in place rather than adding a new version)

**Interfaces:**
- Consumes: all prior tasks committed.
- Produces: the moved local `v0.11.0` tag. NOT pushed.

- [ ] **Step 1: Amend the 0.11.0 entry**

In `CHANGELOG.md` under `## [0.11.0]`:

1. Replace the Fixed bullet `- Splat previews no longer download the 5 MB renderer when the viewer is going to draw them with WebGPU instead.` with:

```markdown
- Splat previews no longer download the 5 MB compatibility renderer when WebGPU will draw them — including on the first drop of a fresh session, which previously slipped through because the WebGPU renderer only reports ready after a splat canvas mounts.
```

2. Add to the Fixed list:

```markdown
- The divider's grab strip no longer overhangs the 3D viewport, where a drag that started in the canvas's rightmost 4 pixels silently resized the gallery instead of orbiting.
- The gallery's collapse tab stays fully on-screen while the gallery is collapsed; it previously lost half its width to the window edge, leaving a ~6px sliver as the reopen affordance.
- On touch devices, a tap anywhere — including the bare canvas — now wakes chrome hidden by the idle fade. Previously nothing a finger could reach would wake it, so three idle seconds effectively removed the touch UI until reload.
- The touch status bar is 44px tall so its Help entry is a real 44px target; the previous invisible tap box was centered on a 24px bar and swallowed orbit gestures that began in the strip of canvas above it.
```

3. Add to the Notes list:

```markdown
- If WebGPU fails after successfully initializing (device loss), the compatibility renderer now starts its 5 MB download at failure time instead of having a head start — an accepted tradeoff, since prefetching it while WebGPU is healthy would re-create the download the gate exists to avoid.
```

- [ ] **Step 2: Final full gate**

Run: `npm run test:run && npm run lint && npx tsc -b --force && npm run build && npx playwright test --project=chromium`
Expected: all green. Report the totals in the commit message.

- [ ] **Step 3: Commit and move the local tag — DO NOT PUSH**

```bash
git add CHANGELOG.md
git commit -m "docs: amend 0.11.0 changelog for the adversarial-review fixes"
git tag -f v0.11.0 -m "v0.11.0"
```

Verify: `git tag --points-at HEAD` shows `v0.11.0`, and `git log --oneline origin/main..HEAD | wc -l` confirms everything is still local-only.

---

## Execution ledger

| Task | Status | Commit |
|------|--------|--------|
| 1. Divider strip off the canvas | pending | |
| 2. Collapsed tab on-screen | pending | |
| 3. Touch tap-to-wake | pending | |
| 4. 44px touch bar | pending | |
| 5. Spark preload gate | pending | |
| 6. Coverage restorations | pending | |
| 7. Shared :root parser | pending | |
| 8. Cached boundary walk | pending | |
| 9. Align apply/toggle dedup | pending | |
| 10. Literal/docs/dead-CSS batch | pending | |
| 11. Changelog + re-tag | pending | |
