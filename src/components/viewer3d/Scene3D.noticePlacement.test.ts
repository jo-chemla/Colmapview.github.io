import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A placement contract, pinned at the source level because the alternative —
 * mounting Scene3D with its R3F canvas and ~40 imports — costs far more than
 * the one line it protects. Same idiom as SplatPsnrEvaluator.staticImports and
 * componentStoreBoundary.
 */
describe('Scene3D notice placement', () => {
  it('keeps the splat backend notifier inside the scene error boundary', () => {
    // The notifier owns a duration-0 notification whose only removal path is
    // its own effect cleanup, and everything that can settle the flags behind
    // it lives in the Canvas subtree. Mounted outside the boundary it survives
    // a canvas crash, leaving that note on screen with nothing left that could
    // ever take it down.
    const source = readFileSync(resolve(__dirname, 'Scene3D.tsx'), 'utf8');

    const boundaryOpen = source.indexOf('<Scene3DErrorBoundary');
    const boundaryClose = source.indexOf('</Scene3DErrorBoundary>');
    const notifier = source.indexOf('<SplatBackendStatusNotifier');

    expect(boundaryOpen).toBeGreaterThan(-1);
    expect(boundaryClose).toBeGreaterThan(boundaryOpen);
    expect(notifier).toBeGreaterThan(boundaryOpen);
    expect(notifier).toBeLessThan(boundaryClose);
  });
});
