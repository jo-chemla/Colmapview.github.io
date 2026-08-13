// White, the pre-0.11 viewport default: splats render badly on it, so loading one swaps the
// canvas to black. The viewport default is now the ds tone #161616 (uiStore), which is
// already a fine splat backdrop, so a fresh profile keeps its canvas on a splat load and
// only profiles still holding white get swapped.
export const DEFAULT_VIEWER_BACKGROUND_COLOR = '#ffffff';
export const DEFAULT_SPLAT_BACKGROUND_COLOR = '#000000';

function normalizeHexColor(color: string): string {
  return color.trim().toLowerCase();
}

export function getDefaultBackgroundColorForSplatLoad(
  backgroundColor: string,
  hasSplatFile: boolean
): string {
  if (!hasSplatFile) return backgroundColor;

  const normalizedColor = normalizeHexColor(backgroundColor);
  return normalizedColor === DEFAULT_VIEWER_BACKGROUND_COLOR || normalizedColor === '#fff'
    ? DEFAULT_SPLAT_BACKGROUND_COLOR
    : backgroundColor;
}
