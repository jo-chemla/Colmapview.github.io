# Design System Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every utility class the source code references actually exist and render, restore the hover/focus/press states and stacking the code already declares, and add invisible accessibility fixes — while keeping the app's current rendered look pixel-identical wherever it isn't plainly broken.

**Architecture:** ColmapView has NO Tailwind. All utility classes are hand-written rules in `src/index.css` (~1778 lines). The codebase references ~45 Tailwind-vocabulary classes that were never defined there — silent no-ops. This plan (1) adds a contract test that permanently fails on any referenced-but-undefined class, (2) defines the missing classes literally or swaps tokens to existing defined equivalents (repo precedent: `.w-\[240px\]`, `.right-\[56px\]` are already hand-defined bracket classes), (3) fixes z-index stacking, focus, touch hit areas, and dialog semantics with zero visual delta.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest, hand-written CSS (`src/index.css`), style objects in `src/theme/componentStyles.ts`, z-scale in `src/theme/zIndex.ts`.

## Global Constraints

- **Keep the original style.** Never change a color value, radius, font, or spacing that currently renders. When a no-op class is fixed, prefer the fix that keeps current pixels; restore author intent only where current rendering is plainly broken (zero-padding buttons, missing hover feedback, square touch sheet). Each such intent-restoration is flagged in its task.
- **No Tailwind.** Do not install tailwindcss or any CSS framework. New utilities are hand-written rules in `src/index.css`, matching its existing section layout and comment style.
- **CSS escapes:** class names with `.`/`/`/`[`/`]` must escape them in CSS selectors (`.px-2\.5`, `.bg-ds-error\/20`, `.min-w-\[120px\]`) — follow the existing definitions at index.css:555 (`.p-0\.5`) and :778 (`.w-\[220px\]`).
- **One commit per task.** Commit messages: `style(design): ...` for CSS/class changes, `test: ...` for test-only, `fix: ...` for behavior. Never bundle tasks.
- **Tests:** run the affected test file per task (`npx vitest run <path>`), and the FULL suite (`npm run test:run`) plus `npm run lint` and `npx tsc -b --force` in the final task. CI runs the full suite on push — do not push with any failure.
- **Do not touch:** `src/parsers/**`, stores, 3D scene code, `VIZ_COLORS`/`FRUSTUM_COLORS`/`CANVAS_COLORS` values (3D/canvas palettes are intentional), the 1520px responsive block's scale values, `--text-muted`'s value.
- **Component/store boundary:** components must not import `use*Store` directly (repo lint rule); none of these tasks need stores.
- Repo root for all paths below: `colmap-webview/`.

## Reference: defined vs missing (verified against src/index.css on 2026-08-10)

Already defined (use these, do not redefine): `.z-sticky`(=200) `.z-overlay`(=500) `.z-modal`(=1000) `.z-toast` `.z-tooltip` `.z-fab`; `.hover-ds-hover` `.hover-ds-elevated` `.hover-ds-tertiary` `.hover-ds-tertiary-50` `.hover-bg-ds-accent` `.hover-bg-ds-accent-90` `.hover-ds-text-primary` `.hover-ds-text-secondary` `.hover-border-ds-light` `.hover-opacity-90` `.hover\:text-green-300` `.hover\:text-yellow-300` `.hover\:text-red-300`; `.p-0\.5` `.p-2\.5` `.py-1\.5` `.pt-1\.5` `.flex-shrink-0` `.rounded-2xl` `.text-2xs` `.text-amber-400` `.w-\[240px\]`.

Missing (defined or eliminated by this plan): `px-2.5` `py-0.5` `pb-1.5` `rounded-t-2xl` `min-w-[120px]` `min-w-[300px]` `max-w-[400px]` `max-w-[200px]` `min-h-[44px]` `min-h-[48px]` `text-[10px]` `text-[8px]` `text-6xl` `w-4.5` `h-4.5` `shrink-0` `z-[200]` `z-[500]` `z-[996]` `z-[997]` `z-[998]` `z-[1000]` `text-ds-tertiary` `text-orange-400` `tool-header-close` `border-ds-border` `bg-ds-bg-secondary` `bg-ds-secondary/50` `bg-ds-error/20` `bg-ds-success/20` `hover-ds-accent` and all colon-form `hover:*` / `active:*` / `focus:outline-none` tokens except the three green/yellow/red-300 ones above.

---

### Task 1: Class-existence contract test (the keystone)

**Files:**
- Create: `src/theme/classContract.test.ts`

**Interfaces:**
- Produces: a vitest suite that later tasks keep green by removing entries from its `ALLOWLIST` set as they fix each token. Later tasks reference "shrink the allowlist" — that means deleting lines from `ALLOWLIST` in this file.

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Contract: every utility-class token referenced in TS/TSX must be defined in
 * src/index.css. This project has NO Tailwind — a class only works if a
 * hand-written rule exists. Undefined classes are silent no-ops (see the
 * retro-fix precedent at index.css ~line 889 and docs in CLAUDE.md).
 *
 * ALLOWLIST = known debt, being burned down task-by-task by the
 * 2026-08-10-design-system-integrity plan. Do NOT add entries without a
 * task/issue reference.
 */

// ---- collect defined classes from index.css ----
const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
const defined = new Set<string>();
for (const m of css.matchAll(/\.((?:[\w-]|\\.)+)/g)) {
  defined.add(m[1].replace(/\\(.)/g, '$1'));
}

// ---- collect candidate tokens from source string literals ----
const SOURCES = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const VARIANT_RE = /^(?:hover|focus|active|disabled|group-hover(?:\/[\w-]+)?):/;
const SINGLE_WORD_UTILITIES = new Set([
  'flex', 'grid', 'hidden', 'block', 'inline', 'truncate', 'relative',
  'absolute', 'fixed', 'sticky', 'static', 'isolate', 'uppercase',
  'capitalize', 'underline', 'rounded', 'border', 'transition', 'sr-only',
]);
const PREFIXES = [
  'bg', 'text', 'border', 'rounded', 'shadow', 'opacity', 'accent',
  'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr',
  'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', '-m', '-mx', '-my', '-mt', '-mb', '-ml', '-mr',
  'gap', 'space-x', 'space-y', 'w', 'h', 'min-w', 'min-h', 'max-w', 'max-h',
  'z', 'inset', 'top', 'bottom', 'left', 'right', 'translate', '-translate',
  'scale', 'rotate', 'flex', 'inline-flex', 'items', 'justify', 'self',
  'leading', 'font', 'tracking', 'whitespace', 'break', 'overflow',
  'object', 'aspect', 'cursor', 'select', 'pointer-events', 'transition',
  'duration', 'ease', 'animate', 'outline', 'ring', 'backdrop', 'from', 'to',
  'line', 'group', 'hover', 'focus', 'active', 'idle', 'shrink', 'grow',
];

function isCandidate(token: string): boolean {
  if (token.length < 2 || /[A-Z{}$()=<>'"]/.test(token)) return false;
  const base = token.replace(VARIANT_RE, '');
  if (!base) return false;
  if (!base.includes('-') && !VARIANT_RE.test(token)) {
    return SINGLE_WORD_UTILITIES.has(base);
  }
  return PREFIXES.some((p) => base === p || base.startsWith(`${p}-`));
}

const found = new Set<string>();
for (const [path, source] of Object.entries(SOURCES)) {
  if (path.includes('.test.') || path.includes('classContract')) continue;
  for (const m of source.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    const literal = m[1] ?? m[2] ?? m[3] ?? '';
    for (const segment of literal.split(/\$\{[^}]*\}/)) {
      for (const token of segment.split(/\s+/)) {
        if (isCandidate(token)) found.add(token);
      }
    }
  }
}

// Known debt — burned down by the design-system-integrity plan.
const ALLOWLIST = new Set<string>([
  // Task 2 (z-index)
  'z-[200]', 'z-[500]', 'z-[996]', 'z-[997]', 'z-[998]', 'z-[1000]',
  // Task 4 (hover/press restoration)
  'hover:opacity-90', 'hover:text-ds-primary', 'hover:bg-ds-tertiary',
  'hover:bg-ds-accent/90', 'hover:bg-ds-hover', 'hover:bg-ds-secondary',
  'hover:text-ds-error', 'hover:text-ds-accent', 'hover:bg-ds-success/20',
  'hover:bg-ds-error/20', 'hover:border-ds-border-hover',
  'active:scale-95', 'active:scale-98',
  'bg-ds-secondary/50', 'bg-ds-error/20', 'bg-ds-success/20',
  'hover-ds-accent', 'border-ds-border', 'bg-ds-bg-secondary', 'shrink-0',
  // Task 5 (focus)
  'focus:outline-none',
  // Task 6 (geometry)
  'px-2.5', 'py-0.5', 'pb-1.5', 'rounded-t-2xl',
  'min-w-[120px]', 'min-w-[300px]', 'min-w-[420px]',
  'max-w-[400px]', 'max-w-[200px]', 'max-h-[80vh]',
  'min-h-[44px]', 'min-h-[48px]', 'text-[10px]', 'text-[8px]', 'text-6xl',
  'w-4.5', 'h-4.5',
  // Task 7 (text tones / status colors)
  'text-ds-tertiary', 'text-orange-400',
]);
// Note: 'tool-header-close' and 'info-line' are also undefined classes, but
// their prefixes are outside the scanner's candidate list so they cannot be
// allowlisted here (the stale-check would flag them). Task 4 deletes the
// former; Task 11 defines the latter in index.css.

describe('utility class contract', () => {
  it('every referenced utility class is defined in index.css', () => {
    const missing = [...found]
      .filter((t) => !defined.has(t) && !ALLOWLIST.has(t))
      .sort();
    expect(missing).toEqual([]);
  });

  it('allowlist contains no stale entries (fixed classes must be removed)', () => {
    const stale = [...ALLOWLIST].filter((t) => !found.has(t) || defined.has(t)).sort();
    expect(stale).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/theme/classContract.test.ts`
Expected: likely FAIL on first run with extra `missing` tokens beyond the allowlist (the audit estimated ~45 total; the list above is the verified subset). For each extra token reported: if it is genuinely referenced-and-undefined, add it to `ALLOWLIST` under a `// discovered on first run — assign to a task` comment; if it is a false positive (an English word that slipped through, e.g. from a tooltip string), tighten `isCandidate` (prefer removing the offending prefix match over special-casing strings). Iterate until PASS. If `import.meta.glob` raw syntax errors under the repo's Vite version, use the legacy `{ as: 'raw', eager: true }` form.

- [ ] **Step 3: Verify the detector actually detects**

Temporarily remove `'px-2.5'` from `ALLOWLIST`, re-run, confirm the first `it` FAILS listing `px-2.5`. Restore the entry, re-run, confirm PASS. This proves the test bites.

- [ ] **Step 4: Commit**

```bash
git add src/theme/classContract.test.ts
git commit -m "test: contract test - every referenced utility class must exist in index.css"
```

---

### Task 2: Phantom z-index classes → real layers

**Files:**
- Modify: `src/theme/zIndex.ts` (add 3 keys)
- Modify: `src/index.css` (add 3 classes next to the `.z-*` block at ~line 533-540)
- Modify: `src/theme/componentStyles.ts:317-318` (toastStyles), `:365` (loadingStyles), `:569` (statusBarStyles), `:655,662-663` (touchStyles)
- Modify: `src/components/modals/imageDetailFrameViewModel.ts:14-15`
- Modify: `src/components/layout/touchGalleryDrawerPolicy.ts:8-11`
- Modify: `src/components/ui/popupLayerInventory.ts:83,104`
- Modify: `src/theme/zIndex.test.ts`, `src/components/ui/popupLayerContract.test.ts:58-64`
- Modify: `src/theme/classContract.test.ts` (shrink allowlist)

**Interfaces:**
- Consumes: `ALLOWLIST` from Task 1.
- Produces: `Z_INDEX.touchSheet = 996`, `Z_INDEX.touchDrawerBackdrop = 997`, `Z_INDEX.touchDrawer = 998`; CSS classes `.z-touch-sheet`, `.z-touch-drawer-backdrop`, `.z-touch-drawer`. Values are identical to the numbers the phantom classes always claimed, so intended stacking is restored, not changed.

- [ ] **Step 1: Update the two z-index tests FIRST (they pin current strings)**

In `src/theme/zIndex.test.ts`, extend the pinned object with the three new keys:

```ts
    expect(Z_INDEX).toEqual({
      controls: 10,
      dropdown: 100,
      sticky: 200,
      overlay: 500,
      touchSheet: 996,
      touchDrawerBackdrop: 997,
      touchDrawer: 998,
      fab: 999,
      modal: 1000,
      contextMenu: 2100,
      modalOverlay: 1100,
      toast: 1500,
      tooltip: 2000,
      mouseTooltip: 9999,
    });
```

In `src/components/ui/popupLayerContract.test.ts`, replace the `'keeps current hard-coded class layers intact'` test body:

```ts
  it('keeps class-based popup layers on the shared scale', () => {
    expect(TOUCH_GALLERY_DRAWER_BACKDROP_CLASS).toContain('z-touch-drawer-backdrop');
    expect(TOUCH_GALLERY_DRAWER_PANEL_CLASS).toContain('z-touch-drawer');
    expect(DESKTOP_IMAGE_DETAIL_FRAME_CLASS).toContain('z-modal');
    expect(TOUCH_IMAGE_DETAIL_FRAME_CLASS).toContain('z-modal');
    expect(notificationStyles.container).toContain('z-toast');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/theme/zIndex.test.ts src/components/ui/popupLayerContract.test.ts`
Expected: FAIL (new keys/classes don't exist yet).

- [ ] **Step 3: Implement**

`src/theme/zIndex.ts` — insert between `overlay: 500,` and `fab: 999,` (keep the file's comment style):

```ts
  touchSheet: 996,          // Touch bottom sheet (below FABs)
  touchDrawerBackdrop: 997, // Touch gallery drawer backdrop
  touchDrawer: 998,         // Touch gallery drawer panel
```

`src/index.css` — after `.z-tooltip` in the z-index utilities block (~line 540):

```css
.z-touch-sheet { z-index: 996; }
.z-touch-drawer-backdrop { z-index: 997; }
.z-touch-drawer { z-index: 998; }
```

String swaps (exact replacements, nothing else on those lines changes):
- `componentStyles.ts` toastStyles.container and containerWithLayout: `z-[500]` → `z-overlay`
- `componentStyles.ts` loadingStyles.overlay: `z-[500]` → `z-overlay`
- `componentStyles.ts` statusBarStyles.container: `z-[200]` → `z-sticky`
- `componentStyles.ts` touchStyles.bottomSheet: `z-[996]` → `z-touch-sheet`; touchStyles.drawer: `z-[998]` → `z-touch-drawer`; touchStyles.drawerBackdrop: `z-[997]` → `z-touch-drawer-backdrop`
- `imageDetailFrameViewModel.ts:14-15`: `z-[1000]` → `z-modal` (both constants)
- `touchGalleryDrawerPolicy.ts`: `z-[997]` → `z-touch-drawer-backdrop`, `z-[998]` → `z-touch-drawer`
- `popupLayerInventory.ts`: layerSource `'z-[1000]'` → `'z-modal class (Z_INDEX.modal)'`; layerSource `'z-[997]/z-[998]'` → `'z-touch-drawer-backdrop and z-touch-drawer classes'` (keep the two class names whitespace-separated — the Task 1 scanner tokenizes these strings, and each token must be a defined class)

Shrink Task 1 allowlist: remove `z-[200]`, `z-[500]`, `z-[996]`, `z-[997]`, `z-[998]`, `z-[1000]`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/theme/ src/components/ui/popupLayerContract.test.ts`
Expected: PASS, including both classContract tests.

- [ ] **Step 5: Visual sanity (zero-delta check)**

Run `npm run dev`, load the toy dataset ("Try a Toy!"), confirm: status bar visible above canvas, a notification toast (trigger via Share button copy) appears above panels, image detail modal (click a gallery thumbnail) covers the viewer. Nothing should look different — these layers previously worked by DOM order.

- [ ] **Step 6: Commit**

```bash
git add src/theme/zIndex.ts src/index.css src/theme/componentStyles.ts src/components/modals/imageDetailFrameViewModel.ts src/components/layout/touchGalleryDrawerPolicy.ts src/components/ui/popupLayerInventory.ts src/theme/zIndex.test.ts src/components/ui/popupLayerContract.test.ts src/theme/classContract.test.ts
git commit -m "style(design): replace phantom z-[N] classes with real z-index layers"
```

---

### Task 3: Bound the tool-window z-index counter

**Files:**
- Modify: `src/hooks/useModalZIndex.ts`
- Create: `src/hooks/useModalZIndex.test.ts`

**Interfaces:**
- Consumes: `Z_INDEX` from `src/theme` (modal=1000, modalOverlay=1100).
- Produces: exported pure function `nextModalZIndex(counter: number): number` used by the hook; tool windows can never stack above blocking dialogs (modalOverlay=1100), toasts (1500), or tooltips (2000).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { Z_INDEX } from '../theme';
import { nextModalZIndex } from './useModalZIndex';

describe('nextModalZIndex', () => {
  it('increments within the tool-window band', () => {
    expect(nextModalZIndex(Z_INDEX.modal)).toBe(Z_INDEX.modal + 1);
  });

  it('never reaches the blocking-dialog layer (modalOverlay)', () => {
    let z = Z_INDEX.modal;
    for (let i = 0; i < 500; i++) z = nextModalZIndex(z);
    expect(z).toBeLessThan(Z_INDEX.modalOverlay);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useModalZIndex.test.ts`
Expected: FAIL — `nextModalZIndex` is not exported.

- [ ] **Step 3: Implement**

Replace the counter logic in `src/hooks/useModalZIndex.ts` (keep the existing doc comments and hook API — `{ zIndex, bringToFront }` — unchanged):

```ts
import { useState, useCallback, useEffect } from 'react';
import { Z_INDEX } from '../theme';

/** Tool windows stack in [Z_INDEX.modal, Z_INDEX.modalOverlay). The clamp keeps
 * a long session from pushing tool windows above blocking dialogs (1100),
 * toasts (1500), or tooltips (2000). At the cap, ties resolve by DOM order. */
export function nextModalZIndex(counter: number): number {
  return Math.min(counter + 1, Z_INDEX.modalOverlay - 1);
}

let globalZIndexCounter = Z_INDEX.modal;

export function useModalZIndex(isOpen: boolean) {
  const [zIndex, setZIndex] = useState(Z_INDEX.modal);

  useEffect(() => {
    if (isOpen) {
      globalZIndexCounter = nextModalZIndex(globalZIndexCounter);
      setZIndex(globalZIndexCounter);
    }
  }, [isOpen]);

  const bringToFront = useCallback(() => {
    globalZIndexCounter = nextModalZIndex(globalZIndexCounter);
    setZIndex(globalZIndexCounter);
  }, []);

  return { zIndex, bringToFront };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/hooks/useModalZIndex.test.ts src/components/ui/popupLayerContract.test.ts`
Expected: PASS (the contract test's `useModalZIndex` consumers list is prose-only; verify nothing else pins the literal 1000 — `grep -rn "globalZIndexCounter\|useModalZIndex" src --include="*.test.*"`).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useModalZIndex.ts src/hooks/useModalZIndex.test.ts
git commit -m "fix: clamp tool-window z-index counter below blocking-dialog layer"
```

---

### Task 4: Restore declared hover/press states (colon-form no-ops → working utilities)

**Files:**
- Modify: `src/index.css` (new utilities in the HOVER STATE UTILITIES block at ~1264-1297 and near `.p-0\.5`)
- Modify: `src/theme/componentStyles.ts:110,220,650-652`
- Modify: `src/components/ui/shareButtonPolicy.ts:83`
- Modify: `src/components/modals/imageDetailModalHeaderViewModel.ts:33,77-78`
- Modify: `src/components/modals/DeletionModalListItem.tsx:56,66`
- Modify: `src/components/viewer3d/controlRows/ColorRows.tsx:73,92,97`
- Modify: `src/components/dropzone/dropZonePanelViewModel.ts:61,68`
- Modify: `src/theme/classContract.test.ts` (shrink allowlist)

**Interfaces:**
- Consumes: existing utilities listed in the Reference section; `ALLOWLIST` from Task 1.
- Produces: new CSS utilities `.hover-ds-accent`, `.hover-bg-ds-secondary`, `.hover-bg-ds-success-20`, `.hover-bg-ds-error-20`, `.bg-ds-secondary\/50`, `.bg-ds-error\/20`, `.bg-ds-success\/20`, `.active-scale-95`, `.active-scale-98` (Task 8+ may reuse them).

**Why zero-visual-risk:** every colon-form `hover:`/`active:` token here currently does NOTHING (verified live 2026-08-10: Share button renders with transparent background; tool-window close X has no hover). Swapping to the defined dash-form (or defining the class) restores feedback the code already declares, using only existing token colors.

- [ ] **Step 1: Add the CSS utilities**

In `src/index.css`, HOVER STATE UTILITIES block — add after `.hover-bg-white-10` (line ~1272), matching the existing rgba style used by `.hover-ds-tertiary-50` (rgba of the var value, since these tokens are static hex):

```css
.hover-bg-ds-secondary:hover { background-color: var(--bg-secondary); }
/* 20% tints of --success #6b9b6b / --error #b86b6b (pattern: hover-ds-tertiary-50 above) */
.hover-bg-ds-success-20:hover { background-color: rgba(107, 155, 107, 0.2); }
.hover-bg-ds-error-20:hover { background-color: rgba(184, 107, 107, 0.2); }
```

After `.hover-ds-text-secondary` (line ~1276):

```css
.hover-ds-accent:hover { color: var(--accent); }
```

In the background-opacity block (after `.bg-ds-tertiary\/90`, line ~935):

```css
.bg-ds-secondary\/50 { background-color: rgba(22, 22, 22, 0.5); }  /* --bg-secondary @ 50% */
.bg-ds-success\/20 { background-color: rgba(107, 155, 107, 0.2); } /* --success @ 20% */
.bg-ds-error\/20 { background-color: rgba(184, 107, 107, 0.2); }   /* --error @ 20% */
```

New ACTIVE STATE UTILITIES mini-block directly after the HOVER STATE UTILITIES block:

```css
/* ============================================
   ACTIVE (PRESS) STATE UTILITIES
   ============================================ */

.active-scale-95:active { transform: scale(0.95); }
.active-scale-98:active { transform: scale(0.98); }
```

- [ ] **Step 2: Swap the tokens (exact string replacements)**

`src/theme/componentStyles.ts`:
- line 110 `buttonFullWidth`: `hover:opacity-90` → `hover-opacity-90`
- line 220 `toolHeaderClose`: `hover:text-ds-primary hover:bg-ds-tertiary` → `hover-ds-text-primary hover-ds-hover`, and delete the trailing ` tool-header-close` token. (Two judgment calls, both flagged: `hover:bg-ds-tertiary` would be invisible on the tertiary panel it sits on, so we use the system's standard ghost-hover `hover-ds-hover` — same pattern as `buttonStyles.variants.ghost`. `tool-header-close` is an undefined marker class; before deleting, run `grep -rn "tool-header-close" src` — if any test or CSS references it, keep the token and instead define `.tool-header-close {}` is NOT acceptable; update the referencing test to target `title="Close"` instead.)
- line 650 `fab`: `active:scale-95` → `active-scale-95`
- line 651 `fabPrimary`: `hover:bg-ds-accent/90` → `hover-bg-ds-accent-90`
- line 652 `fabSecondary`: `hover:bg-ds-hover` → `hover-ds-hover`

`src/components/ui/shareButtonPolicy.ts` line 83:

```ts
    : 'bg-ds-secondary/50 text-ds-muted hover-ds-text-primary hover-bg-ds-secondary';
```

`src/components/modals/imageDetailModalHeaderViewModel.ts`:
- line 33 `TOUCH_CLOSE_BUTTON_CLASS`: `hover:text-ds-primary` → `hover-ds-text-primary`
- lines 77-78 `getDeleteScopeButtonClassName`:

```ts
  const statusClassName = isMarked
    ? 'text-ds-success hover-bg-ds-success-20'
    : 'text-ds-muted hover-ds-text-error hover-bg-ds-error-20';
```

This needs one more utility — add to index.css text-hover group: `.hover-ds-text-error:hover { color: var(--error); }`

`src/components/modals/DeletionModalListItem.tsx`:
- line 56: `hover:text-ds-accent` → `hover-ds-accent`
- line 66: `hover:bg-ds-success/20` → `hover-bg-ds-success-20`

`src/components/viewer3d/controlRows/ColorRows.tsx` (intent-restorations, flagged: the swatch border currently falls back to `currentColor` because `border-ds-border` is undefined; `border-ds` is the system border color — slightly darker, correct per system):
- line 73: `border-ds-border hover:border-ds-border-hover` → `border-ds hover-border-ds-light`; `shrink-0` → `flex-shrink-0`
- line 92: `bg-ds-bg-secondary` → `bg-ds-secondary`; `border-ds-border` → `border-ds`
- line 97: `hover:text-ds-primary` → `hover-ds-text-primary`

`src/components/dropzone/dropZonePanelViewModel.ts` lines 61, 68: `active:scale-98` → `active-scale-98`

- [ ] **Step 3: Shrink allowlist and run tests**

Remove from Task 1 `ALLOWLIST`: `hover:opacity-90`, `hover:text-ds-primary`, `hover:bg-ds-tertiary`, `hover:bg-ds-accent/90`, `hover:bg-ds-hover`, `hover:bg-ds-secondary`, `hover:text-ds-error`, `hover:text-ds-accent`, `hover:bg-ds-success/20`, `hover:bg-ds-error/20`, `hover:border-ds-border-hover`, `active:scale-95`, `active:scale-98`, `bg-ds-secondary/50`, `bg-ds-error/20`, `bg-ds-success/20`, `hover-ds-accent`, `border-ds-border`, `bg-ds-bg-secondary`, `shrink-0`. (`tool-header-close` is not in the allowlist — the scanner can't see it — but its token must still be deleted from componentStyles.ts per Step 2.)

Run: `npm run test:run`
Expected: PASS. If any component test asserts the old class strings (search: `grep -rln "hover:" src --include="*.test.*"`), update those assertions in this same commit.

- [ ] **Step 4: Visual verification**

`npm run dev` → load toy dataset. Hover: tool-window close X (open Deletion modal via right-click menu or panels) now shows text-brighten + subtle bg; Share button has a faint dark bg and brightens on hover; slider value numbers in any control panel turn accent on hover; Deletion modal restore button shows green tint on hover. Press a touch/dropzone action button: subtle scale. Nothing else changed.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/theme/componentStyles.ts src/components/ui/shareButtonPolicy.ts src/components/modals/imageDetailModalHeaderViewModel.ts src/components/modals/DeletionModalListItem.tsx src/components/viewer3d/controlRows/ColorRows.tsx src/components/dropzone/dropZonePanelViewModel.ts src/theme/classContract.test.ts
git commit -m "style(design): restore declared hover/press states via defined dash-form utilities"
```

---

### Task 5: Consistent keyboard focus (selects + editable values)

**Files:**
- Modify: `src/index.css:223-225`
- Modify: `src/theme/componentStyles.ts:399` (valueInput)
- Modify: `src/components/modals/imageDetailControlsViewModel.ts:187`
- Modify: `src/theme/classContract.test.ts` (shrink allowlist)

**Why:** `select:focus { outline: none }` out-specifies the global `:focus-visible` ring, so keyboard users get no focus indicator on any select. The repo already documents the correct suppression idiom at index.css:1306-1311 (`.hotkey-help-tab:focus:not(:focus-visible)`). Meanwhile two "identical" editable-value inputs disagree: `controlPanelStyles.valueInput` uses no-op `focus:outline-none` (so it accidentally keeps the ring) and the ImageDetail opacity editor uses working `.focus-outline-none` (which kills keyboard focus indication entirely). Align both to the valueInput's current behavior. Mouse users see zero change.

- [ ] **Step 1: index.css**

Replace lines 223-225:

```css
/* Suppress the ring for pointer focus only — keyboard Tab still matches
   :focus-visible and keeps the accent ring (same idiom as .hotkey-help-tab). */
select:focus:not(:focus-visible) {
  outline: none;
}
```

- [ ] **Step 2: unify the twin inputs**

- `componentStyles.ts` line 399 `valueInput`: delete the ` focus:outline-none` token (it never did anything; removing it is zero-change and un-lies the code).
- `imageDetailControlsViewModel.ts` line 187 `DESKTOP_MATCH_OPACITY_EDITOR_CLASS`: delete the ` focus-outline-none` token. (Flagged intent-restoration: the auto-focused opacity editor will now show the standard accent focus ring while editing, matching every other editable value in the app.)

- [ ] **Step 3: Shrink allowlist, run tests**

Remove `focus:outline-none` from `ALLOWLIST`.
Run: `npx vitest run src/theme/classContract.test.ts && npm run test:run`
Expected: PASS (update any test asserting the removed tokens).

- [ ] **Step 4: Verify**

`npm run dev` → Tab to a select in a control panel: accent ring appears. Click it with the mouse: no ring (unchanged). Double-click a slider value: editor shows accent ring.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/theme/componentStyles.ts src/components/modals/imageDetailControlsViewModel.ts src/theme/classContract.test.ts
git commit -m "style(design): keyboard-only focus ring for selects; unify editable-value focus"
```

---

### Task 6: Define the missing geometry/typography classes

**Files:**
- Modify: `src/index.css` (insert each rule adjacent to its existing group)
- Modify: `src/theme/classContract.test.ts` (shrink allowlist)

**Why / expected deltas:** these classes are all referenced today and render as nothing. Defining them restores author intent. Visible changes (all restorations of plainly-broken rendering): `sm` buttons (ErrorBoundary retry/reload, GalleryErrorBoundary, Share button) gain their intended 10px horizontal padding (currently 0 — text touches the edges); the touch bottom sheet gets its intended rounded top; the ErrorBoundary icon becomes large as designed; two micro-labels in the cache-stats tooltip and deletion list render at their intended 10px/8px. Everything else (min/max width clamps) only matters at overflow edge cases.

- [ ] **Step 1: Add definitions (with escapes, next to their existing groups)**

After `.px-2` (~line 570): `.px-2\.5 { padding-left: 0.625rem; padding-right: 0.625rem; }`
After `.py-0` (~line 577): `.py-0\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }`
After `.pb-1` (~line 598): `.pb-1\.5 { padding-bottom: 0.375rem; }`
After `.rounded-2xl` (~line 1057): `.rounded-t-2xl { border-top-left-radius: 1rem; border-top-right-radius: 1rem; }` — first check the actual value inside `.rounded-2xl` in index.css and copy it (expected 1rem).
After `.min-w-full` (~line 819):

```css
.min-w-\[120px\] { min-width: 120px; }
.min-w-\[300px\] { min-width: 300px; }
.min-w-\[420px\] { min-width: 420px; }
```

After `.max-w-none` (~line 827):

```css
.max-w-\[200px\] { max-width: 200px; }
.max-w-\[400px\] { max-width: 400px; }
```

After `.min-h-screen` (~line 832):

```css
.min-h-\[44px\] { min-height: 44px; }
.min-h-\[48px\] { min-height: 48px; }
```

After `.max-h-screen` (~line 834):

```css
.max-h-\[80vh\] { max-height: 80vh; }
```

Also define, in the same literal pattern and adjacent to the matching group, any OTHER bracket size classes that Task 1's first-run discovery added to the allowlist (candidates the audit flagged in older files: `min-w-[400px]`, `max-w-[520px]`, `max-w-[90vw]`, `max-h-[70vh]` — check the allowlist for the authoritative list), and remove each from the allowlist as it is defined.

After `.text-4xl` (~line 853):

```css
.text-6xl { font-size: 3.75rem; line-height: 1; }
```

After `.text-2xs` (~line 845):

```css
.text-\[10px\] { font-size: 10px; }
.text-\[8px\] { font-size: 8px; }
```

After `.w-3\.5` (~line 741): `.w-4\.5 { width: 1.125rem; }`
After `.h-3\.5` (~line 791): `.h-4\.5 { height: 1.125rem; }`

Also verify `.sr-only` is defined (`grep -n "sr-only" src/index.css`) — ColorRows.tsx uses it for the hidden color input. If missing, add the standard rule to the ACCESSIBILITY section:

```css
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0; }
```

- [ ] **Step 2: Shrink allowlist, run tests**

Remove from `ALLOWLIST`: `px-2.5`, `py-0.5`, `pb-1.5`, `rounded-t-2xl`, `min-w-[120px]`, `min-w-[300px]`, `min-w-[420px]`, `max-w-[400px]`, `max-w-[200px]`, `max-h-[80vh]`, `min-h-[44px]`, `min-h-[48px]`, `text-[10px]`, `text-[8px]`, `text-6xl`, `w-4.5`, `h-4.5`, plus any bracket size classes defined in the final paragraph of Step 1.
Run: `npx vitest run src/theme/classContract.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify**

`npm run dev` → load toy → hover the cache-stats indicator in the status bar (legend text now 10px); Share button now has side padding. Landing modal action buttons (`Load URL` etc., size `action` → `min-w-[120px]`) now hold equal width.

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/theme/classContract.test.ts
git commit -m "style(design): define referenced-but-missing geometry and micro-type classes"
```

---

### Task 7: Fix misnamed text tone + broken caution color

**Files:**
- Modify: `src/components/layout/StatusBar.tsx:108`, `src/components/layout/TouchStatusBar.tsx:36`, `src/components/viewer3d/panels/ExportPanelSections.tsx:51,154`
- Modify: `src/index.css` (~line 985, Tailwind-palette block)
- Modify: `src/theme/classContract.test.ts` (shrink allowlist)

**Why:** `text-ds-tertiary` does not exist (tertiary is a *background* token; text tones are primary/secondary/muted) — verified live: the FPS counter just inherits its parent's color, which IS `text-ds-secondary` (statusBarStyles.container sets it). Renaming to `text-ds-secondary` is therefore pixel-identical in both status bars and aligns ExportPanel hint text with the system's hint convention (`controlPanelStyles.hint` uses text-ds-secondary). `STATUS_COLORS.caution` (colors.ts:187) names `text-orange-400`, which was never defined — the camera-conversion caution status renders in plain text color today; defining orange-400 restores the author's intended amber/orange distinction.

- [ ] **Step 1: Rename the tone (4 exact replacements)**

In the three files above, replace every `text-ds-tertiary` with `text-ds-secondary` (four occurrences total; `grep -rn "text-ds-tertiary" src` must come back empty afterward).

- [ ] **Step 2: Define orange-400**

In the Tailwind-palette block of index.css, after `.text-amber-400` (~line 985), add (matching the block's one-line format):

```css
.text-orange-400 { color: #fb923c; }
```

- [ ] **Step 3: Shrink allowlist, run tests**

Remove `text-ds-tertiary` and `text-orange-400` from `ALLOWLIST`.
Run: `npx vitest run src/theme/classContract.test.ts && npm run test:run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/StatusBar.tsx src/components/layout/TouchStatusBar.tsx src/components/viewer3d/panels/ExportPanelSections.tsx src/index.css src/theme/classContract.test.ts
git commit -m "style(design): text-ds-tertiary -> text-ds-secondary; define text-orange-400 for caution status"
```

---

### Task 8: 44px touch hit areas without changing visual size

**Files:**
- Modify: `src/index.css` (after the `.touch-control-panel` rules at ~line 1778)
- Modify: `src/components/modals/imageDetailNavigationViewModel.ts` (touch nav button class constants)

**Why:** `sizing.ts` declares `minTapTarget: 44`, but touch mode shrinks control buttons to 28px and image-nav buttons to 36px. Growing the buttons would change the look; instead we expand the *hit area* invisibly with a centered pseudo-element. The tooltip system owns `::after` (index.css:1391); `::before` is free. Buttons already carry `relative` (controlPanelStyles.button). Adjacent 28px buttons sit 2px apart so 44px hit areas overlap — the later DOM sibling wins in the overlap strip; taps at button centers are unaffected. This is the standard trade-off; visuals unchanged.

- [ ] **Step 1: Add CSS**

Append after the `.touch-control-panel .control-button-responsive svg` rule (end of file):

```css
/* Invisible 44px tap-target expansion (TOUCH.minTapTarget) for compact touch
   controls. Visual size unchanged; tooltips own ::after, so ::before is free.
   Requires position:relative on the element (control buttons already have it). */
.touch-control-panel .control-button-responsive::before,
.touch-hit-44::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
}
```

- [ ] **Step 2: Apply the utility to the 36px touch image-nav buttons**

In `src/components/modals/imageDetailNavigationViewModel.ts`, locate the touch nav button class constants (the ones sized ~36px, near lines 94 and 146 — `grep -n "rounded-md\|36" src/components/modals/imageDetailNavigationViewModel.ts`). Append ` relative touch-hit-44` to each touch-variant button class string that lacks `relative`. Do not touch desktop variants.

- [ ] **Step 3: Test + verify**

`touch-hit-44` and `relative` are defined classes so the contract test stays green: `npx vitest run src/theme/classContract.test.ts`.
Manual: `npm run dev`, open DevTools device emulation at 390px width, load toy dataset. Buttons look identical; taps landing ~8px outside a control button still activate it (verify via DevTools: hover shows the ::before box in the inspector).

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/components/modals/imageDetailNavigationViewModel.ts
git commit -m "style(design): invisible 44px tap targets for compact touch controls"
```

---

### Task 9: Idle-hidden controls leave the tab order

**Files:**
- Modify: `src/index.css:1611-1619`

**Why:** idle-hide only sets `opacity: 0`, so invisible controls remain keyboard-focusable and clickable (Codex finding). Adding `visibility: hidden` removes them from the tab order and hit-testing while preserving the fade (visibility transitions discretely at the end of the opacity fade). Mouse reveal is unaffected — un-idling is driven by container mousemove, which restores visibility before any click. Zero visual change.

- [ ] **Step 1: Edit the two rules**

```css
/* Elements marked as idle-hideable fade out when the scene is idle.
   visibility:hidden removes them from tab order and hit-testing while hidden;
   it flips at the end of the opacity fade. */
.idle-hideable {
  transition: opacity 0.25s ease, visibility 0.25s ease;
}

.scene-3d-container[data-idle="true"] .idle-hideable,
.scene-3d-container[data-autohide-preview="true"] .idle-hideable {
  opacity: 0;
  visibility: hidden;
}
```

(The pointer-lock rule at :1622 stays as-is.)

- [ ] **Step 2: Verify**

`npm run dev` → load toy → enable auto-hide (Settings/auto-hide panel) or wait for idle: controls fade out; moving the mouse brings them back exactly as before. While hidden, pressing Tab repeatedly never lands on an invisible control (watch `document.activeElement` in the console). If any existing test snapshots the `.idle-hideable` CSS, update it.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix: idle-hidden viewer controls leave tab order via visibility:hidden"
```

---

### Task 10: Dialog semantics for floating tool windows

**Files:**
- Create: `src/components/ui/useFloatingDialogFocus.ts`
- Create: `src/components/ui/useFloatingDialogFocus.test.tsx` (only if `@testing-library/react` is already a devDependency — check package.json; otherwise test the policy re-export via the existing modalDialogShellPolicy tests and rely on Step 4 manual verification)
- Modify: `src/components/ui/FloatingWindowShell.tsx`

**Interfaces:**
- Consumes: `getModalDialogFocusableElements(root: HTMLElement | null): HTMLElement[]` from `./modalDialogShellPolicy` (already used by ModalDialogShell).
- Produces: `useFloatingDialogFocus(isOpen: boolean, panelRef: RefObject<HTMLDivElement | null>): void`; FloatingWindowShell renders `role="dialog"` + `aria-labelledby`. ModalDialogShell is intentionally NOT modified (it works and is tested).

**Scope guard:** these are NON-modal floating tool windows (several can be open; no backdrop by default). Correct semantics: `role="dialog"` (without `aria-modal`), a label, and focus moved in on open / returned on close. NO Tab trap, and NO Escape-to-close — the viewer has global Escape semantics (deselect etc.) and multiple simultaneously-open windows would all close at once; do not add it.

- [ ] **Step 1: Write the hook**

```ts
import { useEffect, useRef, type RefObject } from 'react';
import { getModalDialogFocusableElements } from './modalDialogShellPolicy';

/**
 * Focus behavior for NON-modal floating tool windows: move focus to the first
 * focusable element when the window opens, return focus to the opener when it
 * closes. No Tab trap and no Escape handling — tool windows are non-modal
 * (see ModalDialogShell for the modal variant).
 */
export function useFloatingDialogFocus(
  isOpen: boolean,
  panelRef: RefObject<HTMLDivElement | null>
): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }

    const focusable = getModalDialogFocusableElements(panelRef.current);
    (focusable[0] ?? panelRef.current)?.focus();

    return () => {
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [isOpen, panelRef]);
}
```

- [ ] **Step 2: Wire it into FloatingWindowShell**

Changes to `FloatingWindowShell.tsx` (keep every existing prop and default):
1. Imports: add `useId, useRef` from react and the new hook.
2. Inside the component (before the `if (!isOpen) return null;` — hooks must run unconditionally, so move that early-return AFTER the hook calls):

```tsx
  const titleId = useId();
  const internalPanelRef = useRef<HTMLDivElement | null>(null);
  useFloatingDialogFocus(isOpen, internalPanelRef);

  if (!isOpen) return null;
```

3. Merge the internal ref with the `panelRef` prop on the panel div:

```tsx
      <div
        ref={(node) => {
          internalPanelRef.current = node;
          if (typeof panelRef === 'function') panelRef(node);
          else if (panelRef) (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-idle-pause="true"
        ...
```

4. Give the title span the id: `<span id={titleId} className={modalStyles.toolHeaderTitle}>{title}</span>`

- [ ] **Step 3: Run tests**

Run: `npm run test:run`
Expected: PASS. Any FloatingWindowShell consumer test that snapshots the DOM will need `role="dialog"`/`aria-labelledby` added to expectations — update in this commit.

- [ ] **Step 4: Manual verification**

`npm run dev` → load toy → open the Deletion modal (or Floor detection): focus lands inside the window (visible accent ring on its first control via :focus-visible only when keyboard-opened); close it: focus returns to the button that opened it. Dragging by the header still works; multiple tool windows still stack by click order.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/useFloatingDialogFocus.ts src/components/ui/FloatingWindowShell.tsx
git commit -m "fix: dialog role, label, and focus management for floating tool windows"
```

---

### Task 11: DropZone micro-accessibility (zero visual change)

**Files:**
- Modify: `src/components/dropzone/DropZonePanels.tsx:82-106,110-115,125`
- Modify: `src/index.css` (info-line rule)
- Modify: `src/theme/classContract.test.ts` (shrink allowlist)

- [ ] **Step 1: aria-labels for the three desktop icon buttons**

The upload/reset/dismiss buttons (lines 82-106) have only `data-tooltip` — not an accessible name. Add `aria-label` reusing the existing tooltip constants:

```tsx
            <button
              type="button"
              className={DROP_ZONE_ICON_BUTTON_CLASS}
              onClick={onUploadConfig}
              data-tooltip={DROP_ZONE_UPLOAD_CONFIG_TOOLTIP}
              aria-label={DROP_ZONE_UPLOAD_CONFIG_TOOLTIP}
            >
```

Same pattern for the reset button (`DROP_ZONE_RESET_CONFIG_TOOLTIP`) and the dismiss `×` button (`DROP_ZONE_DISMISS_TOOLTIP`).

- [ ] **Step 2: browse box div → button**

Lines 110-115: the click target is a `<div onClick>` — not keyboard-operable. Replace with:

```tsx
          <button
            type="button"
            className={DROP_ZONE_BROWSE_BOX_CLASS}
            onClick={onBrowse}
            aria-label="Browse for a COLMAP dataset folder"
          >
            <span className="text-ds-muted font-light leading-none" style={getDropZoneBrowseIconStyle()}>+</span>
          </button>
```

Zero visual change: the global button reset (index.css:150-160) zeroes background/border/padding, and `DROP_ZONE_BROWSE_BOX_CLASS` supplies all visible styling (dashed border, size, hover). Verify side-by-side in the browser that the box renders identically (the reset sets `font-size: inherit` — the 72px `+` comes from the inline style on the span, unaffected).

- [ ] **Step 3: move the inline `<style>` tag into index.css**

Delete line 125 (`<style>{`.info-line:hover ...`}</style>`) and add to the HOVER STATE UTILITIES block of index.css, keeping the exact selector and value:

```css
/* DropZone info lines (was an inline <style> tag in DropZonePanels.tsx) */
.info-line:hover { color: rgba(255, 255, 255, 0.9); }
```

(`info-line` is not in the Task 1 allowlist — its prefix is outside the scanner's candidate list — so no allowlist change here.)

- [ ] **Step 4: Run tests + verify**

Run: `npm run test:run`
Manual: landing page renders identically; Tab reaches the browse box, upload, reset, and dismiss buttons; Enter on the browse box opens the file picker.

- [ ] **Step 5: Commit**

```bash
git add src/components/dropzone/DropZonePanels.tsx src/index.css src/theme/classContract.test.ts
git commit -m "fix: keyboard/screen-reader access for drop-zone controls; extract inline style"
```

---

### Task 12: Burn down the remaining allowlist + full gate

**Files:**
- Modify: `src/theme/classContract.test.ts`
- Modify: whatever files the remaining allowlist entries live in

- [ ] **Step 1: Empty the allowlist**

Any entries still in `ALLOWLIST` at this point came from Task 1's first-run discovery ("discovered on first run" comments). For each: find its references (`grep -rn "<token>" src`), then either (a) swap to a defined equivalent that preserves current rendering, or (b) define the class literally in index.css following the patterns from Tasks 4/6. Apply the same keep-style rule: prefer current-pixels; flag intent-restorations in the commit message. Delete every entry; the target end state is `const ALLOWLIST = new Set<string>([]);`. If a token is a genuine non-class string (false positive), fix `isCandidate` instead of allowlisting.

- [ ] **Step 2: Full gate (required before push — CI runs the full suite)**

```bash
npm run test:run
npm run lint
npx tsc -b --force
npm run build
```

Expected: all green. `tsc -b --force` is required — incremental builds have masked type errors before a release in this repo.

- [ ] **Step 3: Manual regression sweep**

`npm run dev` → walk: landing modal (desktop + 390px emulation), toy dataset load, control panels (hover, slider values, selects via keyboard), gallery thumbnail → image detail (desktop + touch), Deletion modal open/close focus return, Share copy feedback, status bar + cache-stats tooltip, screenshot button. Everything should look like it did before this plan except the flagged intent-restorations (sm-button padding, hover feedback existing at all, rounded touch sheet, 10px micro-labels, orange caution text, large error icon).

- [ ] **Step 4: Commit**

```bash
git add -A src/
git commit -m "style(design): empty the class-contract allowlist - every referenced class now exists"
```

---

## Explicitly deferred (visible style changes — excluded by the "keep original style" constraint)

Not in this plan; each would change how the app looks and needs a separate decision:

1. Consolidating the dual palettes (ds-tokens vs Tailwind fossils: 3 greens, 4 reds, 5 ambers) onto single values — any merge shifts rendered hues.
2. Raising `--text-muted` (#5a5a5a, ~2.4:1 on panels) for WCAG AA — brightens text everywhere.
3. Theme-linking the 3D viewport background/grid to the ds ramp.
4. Toolbar GRD/ORB/RGB/FRM chips → icons; removing the "N/A" button label; status-bar content diet.
5. Reflowing (instead of scaling 0.85 / shrinking) at the 1520px breakpoint.
6. Loading JetBrains Mono (declared in `--font-mono` but never loaded — currently silently falls back).
7. Context-menu `role="menu"` + arrow-key model; `<main>`/`<aside>` landmarks in AppLayout.
8. `text-2xs` is aliased to the same size as `text-xs` (index.css:845) — making it genuinely smaller would change icons/ui.tsx rendering.
9. Normalizing the 4/6/8px radius tiers (tooltips and ImageDetail controls use 6px; the responsive block hand-tunes 5/6px) — any normalization changes rendered corners.
10. Consolidating the three spacing systems (`--sp-*` rem scale, near-dead `theme/spacing.ts` px scale, ad-hoc px in `sizing.ts`/viewmodels) — pure refactor with zero rendering impact, but out of scope here; do it as its own cleanup PR if desired.

## Post-plan verification

Re-run the design audit in regression mode (`/design-review --regression` against `~/.gstack/projects/colmap_webview/designs/design-audit-20260810/design-baseline.json`). Expected: Interaction States D+ → B or better, Color D+ → C+ (caution fix only), no category regresses, AI-slop stays A−.
