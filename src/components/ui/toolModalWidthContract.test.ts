import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modalStyles } from '../../theme';

/**
 * Contract: a tool window's authored width travels as `--tool-modal-width` and
 * is turned back into a `width` by the stylesheet — at every viewport size.
 *
 * FloatingWindowShell publishes the property INSTEAD of an inline width
 * (pinned in FloatingWindowShell.test.tsx). That only renders a window if two
 * things hold in index.css, and both of them are invisible on a >1520px dev
 * monitor, so they are asserted from the CSS text rather than from a layout:
 *
 *   1. `.tool-modal-responsive { width: var(--tool-modal-width) }` exists
 *      OUTSIDE `@media (max-width: 1520px)`. Move it inside and every tool
 *      window loses its width above the breakpoint.
 *   2. The compact tier scales that property WITHOUT `!important`. The
 *      `!important` form is what made this fail unsafely: it beat the inline
 *      width, then went invalid at computed-value time when the property was
 *      missing, and a 300px window rendered at 8.125px.
 *
 * A .ts file on purpose — tsconfig.app.json excludes `src/**\/*.test.ts`, so
 * node:fs is available here and not in the .tsx suite (and vitest stubs CSS
 * imports, so `index.css?raw` reads back as an empty string).
 */

const CSS = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')
  // Comments are prose, not markup: the rules below are documented in notes
  // that quote the old `!important` form verbatim.
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

const COMPACT_QUERY = '@media (max-width: 1520px)';

describe('tool modal width contract', () => {
  it('puts the class that carries the width rule on every tool panel', () => {
    expect(modalStyles.toolPanel.split(' ')).toContain('tool-modal-responsive');
  });

  it('resolves the published width outside the compact breakpoint', () => {
    const beforeCompactTier = CSS.split(COMPACT_QUERY)[0];

    expect(beforeCompactTier).toMatch(
      /\.tool-modal-responsive\s*\{\s*width:\s*var\(--tool-modal-width[^)]*\);?\s*\}/
    );
  });

  it('scales the width in the compact tier without !important', () => {
    expect(CSS).toMatch(/width:\s*calc\(var\(--tool-modal-width\)\s*\*\s*0\.85\);/);
    expect(CSS).not.toMatch(/var\(--tool-modal-width\)[^;]*!important/);
  });
});
