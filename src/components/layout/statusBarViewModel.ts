export const STATUS_BAR_HIDDEN_CLASS_NAME = 'opacity-0';

export const STATUS_BAR_SHORTCUTS_LABEL = '⌨ Shortcuts';
// Agrees with HOTKEY_HELP_TITLE and the showHelp binding by literal, not by
// import (statusBarViewModel.test.ts asserts both) — this is the panel's only
// pointer entry point, so the string has exactly one consumer.
export const STATUS_BAR_SHORTCUTS_TITLE = 'Help & keyboard shortcuts (I)';
// Plain text button: the global `button` reset in index.css already clears the
// background, border, padding, and font-size, so the class only has to state
// the muted-to-bright text behavior the rest of the bar uses.
export const STATUS_BAR_SHORTCUTS_BUTTON_CLASS =
  'text-ds-secondary hover-ds-text-primary cursor-pointer transition-colors';

export function formatStatusBarFps(fps: number): string {
  return `${fps} FPS`;
}

export function getStatusBarContainerClassName({
  baseClassName,
  hidden,
}: {
  baseClassName: string;
  hidden: boolean;
}): string {
  return hidden ? `${baseClassName} ${STATUS_BAR_HIDDEN_CLASS_NAME}` : baseClassName;
}

export function getDesktopEmptyStatusText({
  hasReconstruction,
  urlLoading,
}: {
  hasReconstruction: boolean;
  urlLoading: boolean;
}): string | null {
  if (hasReconstruction) return null;
  return urlLoading ? 'Loading...' : 'Drop dataset or images to load';
}

export function getTouchEmptyStatusText({
  hasReconstruction,
  urlLoading,
}: {
  hasReconstruction: boolean;
  urlLoading: boolean;
}): string | null {
  if (hasReconstruction) return null;
  return urlLoading ? 'Loading...' : '';
}

export function shouldShowStatusHistograms({
  hasReconstruction,
  hasGlobalStats,
}: {
  hasReconstruction: boolean;
  hasGlobalStats: boolean;
}): boolean {
  return hasReconstruction && hasGlobalStats;
}

export function shouldShowTouchStatusBar(statusBarVisible: boolean): boolean {
  return statusBarVisible;
}
