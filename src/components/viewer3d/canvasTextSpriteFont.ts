/**
 * Font resolution for the canvas-baked 3D labels (CanvasTextSprite).
 *
 * Sprites can bake before the self-hosted design-system webfont is available, so
 * the first bake uses the system stack and a second one follows once IBM Plex
 * Sans has actually loaded. Lives in its own module because CanvasTextSprite.tsx
 * may only export components (react-refresh/only-export-components).
 */

import { useSyncExternalStore } from 'react';

/** The sprite bakes at a fixed canvas size and scales the result into world
 * units, so these are texture resolution knobs, not the on-screen text size. */
export const TEXT_CANVAS_FONT_SIZE = 96;
export const TEXT_CANVAS_FONT_WEIGHT = 600;

/** Matches --font-sans in src/index.css, so in-scene labels read as the same
 * typeface as the chrome around them. */
export const DS_SANS_FAMILY = "'IBM Plex Sans Variable'";

/** The pre-webfont bake, and the tail of the ds stack: a font that never loads
 * degrades to exactly the glyphs the labels shipped with before. */
export const CANVAS_TEXT_FALLBACK_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const CANVAS_TEXT_DS_FAMILY = `${DS_SANS_FAMILY}, ${CANVAS_TEXT_FALLBACK_FAMILY}`;

export function resolveCanvasTextFamily(dsSansLoaded: boolean): string {
  return dsSansLoaded ? CANVAS_TEXT_DS_FAMILY : CANVAS_TEXT_FALLBACK_FAMILY;
}

/** The exact CSS font shorthand the sprite paints with. */
export function canvasTextFont(dsSansLoaded: boolean): string {
  return `${TEXT_CANVAS_FONT_WEIGHT} ${TEXT_CANVAS_FONT_SIZE}px ${resolveCanvasTextFamily(dsSansLoaded)}`;
}

/** Same weight and size the bake uses: a lighter probe could report a face the
 * bake would not actually resolve to. */
const DS_SANS_PROBE = `${TEXT_CANVAS_FONT_WEIGHT} ${TEXT_CANVAS_FONT_SIZE}px ${DS_SANS_FAMILY}`;

/**
 * Resolves true once the ds sans face is usable for the bake descriptor.
 *
 * `fonts.load()` rather than `fonts.ready` + `fonts.check()`: `ready` resolves
 * whenever nothing is pending, which can be BEFORE the face is ever requested —
 * `check()` then reports false and the re-bake silently never happens.
 */
export function loadDsSans(): Promise<boolean> {
  // jsdom exposes no FontFaceSet at all, and there is no document off the main
  // thread; either way the labels just keep the fallback bake.
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts || typeof fonts.load !== 'function') return Promise.resolve(false);
  return fonts
    .load(DS_SANS_PROBE)
    .then((faces) => faces.length > 0)
    .catch(() => false);
}

// One request per document no matter how many sprites mount, and a plain flag so
// sprites mounting after it settles bake in Plex directly instead of baking the
// fallback and immediately re-baking. The 3D scene mounts long after first paint,
// so that is the common case rather than the edge case.
let dsSansLoaded = false;
let dsSansRequested = false;
const subscribers = new Set<() => void>();

function subscribeToDsSans(onStoreChange: () => void): () => void {
  subscribers.add(onStoreChange);
  if (!dsSansRequested) {
    dsSansRequested = true;
    void loadDsSans().then((loaded) => {
      dsSansLoaded = loaded;
      if (loaded) for (const notify of [...subscribers]) notify();
    });
  }
  return () => {
    subscribers.delete(onStoreChange);
  };
}

function getDsSansSnapshot(): boolean {
  return dsSansLoaded;
}

/**
 * Whether 3D labels should bake in the ds sans face yet. Read through
 * useSyncExternalStore because the answer is module state shared by every
 * sprite — exactly what that hook exists to subscribe to safely (and the one
 * `use*Store` name componentStoreBoundary exempts).
 */
export function useDsSansLoaded(): boolean {
  return useSyncExternalStore(subscribeToDsSans, getDsSansSnapshot, getDsSansSnapshot);
}
