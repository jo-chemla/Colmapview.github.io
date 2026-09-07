import type { MatchesDisplayMode } from '../../../store/types';

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface MatchesPanelHint {
  title: string;
  lines: string[];
}

export const MATCHES_DISPLAY_MODE_OPTIONS: SelectOption<MatchesDisplayMode>[] = [
  { value: 'static', label: 'Static' },
  { value: 'blink', label: 'Blink' },
];

const MATCHES_OFF_HINT: MatchesPanelHint = {
  title: 'Off:',
  lines: ['Match lines hidden.'],
};

const MATCHES_DISPLAY_MODE_HINTS: Record<MatchesDisplayMode, MatchesPanelHint> = {
  static: {
    title: 'Static:',
    lines: ['Show match lines between', 'selected camera and points.'],
  },
  blink: {
    title: 'Blink:',
    lines: ['Match lines animate with', 'blinking effect.'],
  },
};

export function getSupportedMatchesDisplayMode(value: string): MatchesDisplayMode | null {
  if (value === 'static' || value === 'blink') return value;
  return null;
}

/**
 * Appended while a track-less decimated points preview is active: matches are
 * derived from point tracks, so none can be drawn until the full points3D is
 * loaded (the preview strips tracks).
 */
export const MATCHES_PREVIEW_POINTS_HINT_LINE =
  'Preview points have no tracks — load full points for matches.';

export function getMatchesPanelHint(
  showMatches: boolean,
  matchesDisplayMode: MatchesDisplayMode | string,
  hasPreviewPoints = false
): MatchesPanelHint {
  const hint = showMatches
    ? MATCHES_DISPLAY_MODE_HINTS[getSupportedMatchesDisplayMode(matchesDisplayMode) ?? 'static']
    : MATCHES_OFF_HINT;
  if (!hasPreviewPoints) return hint;
  return { ...hint, lines: [...hint.lines, MATCHES_PREVIEW_POINTS_HINT_LINE] };
}
