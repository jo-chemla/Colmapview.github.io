import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CANVAS_TEXT_DS_FAMILY,
  CANVAS_TEXT_FALLBACK_FAMILY,
  DS_SANS_FAMILY,
  TEXT_CANVAS_FONT_SIZE,
  TEXT_CANVAS_FONT_WEIGHT,
  canvasTextFont,
  loadDsSans,
  resolveCanvasTextFamily,
} from './canvasTextSpriteFont';

/** jsdom has no FontFaceSet, so `document.fonts` has to be installed by hand. */
function stubDocumentFonts(load: (font: string) => Promise<FontFace[]>): void {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load },
  });
}

afterEach(() => {
  Reflect.deleteProperty(document, 'fonts');
});

describe('resolveCanvasTextFamily', () => {
  it('bakes the system stack until the ds face has loaded', () => {
    expect(resolveCanvasTextFamily(false)).toBe(CANVAS_TEXT_FALLBACK_FAMILY);
  });

  it('leads with the ds face once it has loaded, keeping the system stack behind it', () => {
    expect(resolveCanvasTextFamily(true)).toBe(CANVAS_TEXT_DS_FAMILY);
    expect(CANVAS_TEXT_DS_FAMILY).toBe(`${DS_SANS_FAMILY}, ${CANVAS_TEXT_FALLBACK_FAMILY}`);
  });
});

describe('canvasTextFont', () => {
  it('paints at the same weight and size the load probe asks for', () => {
    expect(canvasTextFont(true)).toBe(
      `${TEXT_CANVAS_FONT_WEIGHT} ${TEXT_CANVAS_FONT_SIZE}px ${CANVAS_TEXT_DS_FAMILY}`,
    );
    expect(canvasTextFont(false)).toBe(
      `${TEXT_CANVAS_FONT_WEIGHT} ${TEXT_CANVAS_FONT_SIZE}px ${CANVAS_TEXT_FALLBACK_FAMILY}`,
    );
  });
});

describe('loadDsSans', () => {
  it('reports unavailable instead of throwing when the document has no FontFaceSet', async () => {
    // The repo's jsdom leaves document.fonts undefined, so an unguarded read
    // would TypeError and take down every suite that mounts a label.
    expect(document.fonts).toBeUndefined();
    await expect(loadDsSans()).resolves.toBe(false);
  });

  it('requests the ds face at the bake descriptor, not a lighter probe', async () => {
    const load = vi.fn().mockResolvedValue([{} as FontFace]);
    stubDocumentFonts(load);

    await expect(loadDsSans()).resolves.toBe(true);
    expect(load).toHaveBeenCalledWith(
      `${TEXT_CANVAS_FONT_WEIGHT} ${TEXT_CANVAS_FONT_SIZE}px ${DS_SANS_FAMILY}`,
    );
  });

  it('reports unavailable when no face matches the descriptor', async () => {
    stubDocumentFonts(vi.fn().mockResolvedValue([]));
    await expect(loadDsSans()).resolves.toBe(false);
  });

  it('reports unavailable when the load rejects', async () => {
    stubDocumentFonts(vi.fn().mockRejectedValue(new Error('network')));
    await expect(loadDsSans()).resolves.toBe(false);
  });
});
