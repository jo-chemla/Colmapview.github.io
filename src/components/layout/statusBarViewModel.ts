export const STATUS_BAR_HIDDEN_CLASS_NAME = 'opacity-0';

export const STATUS_BAR_SHORTCUTS_LABEL = '⌨ Shortcuts';
// Agrees with HOTKEY_HELP_TITLE and the showHelp binding by literal, not by
// import (statusBarViewModel.test.ts asserts both) — this is the desktop bar's
// pointer entry point; touch mode has its own below.
export const STATUS_BAR_SHORTCUTS_TITLE = 'Help & keyboard shortcuts (I)';
// Plain text button: the global `button` reset in index.css already clears the
// background, border, padding, and font-size, so the class only has to state
// the muted-to-bright text behavior the rest of the bar uses.
export const STATUS_BAR_SHORTCUTS_BUTTON_CLASS =
  'text-ds-secondary hover-ds-text-primary cursor-pointer transition-colors';

// Touch mode's entry into the same panel. It is the only pointer route there on
// a phone or tablet — the desktop status bar is not rendered and the I / Shift+?
// bindings need a keyboard — so the label advertises Help rather than the
// desktop bar's keyboard-shortcuts framing, and the title drops the (I) suffix
// that nothing on a touch device can press.
export const TOUCH_STATUS_BAR_HELP_LABEL = '? Help';
export const TOUCH_STATUS_BAR_HELP_TITLE = 'Help';
// The desktop entry's muted-to-bright text treatment plus the shared 44px tap
// box (`relative` anchors the touch-hit-44 ::before in index.css), because the
// touch bar itself is only 24px tall. The button stays a leaf target, which
// that utility requires.
export const TOUCH_STATUS_BAR_HELP_BUTTON_CLASS =
  `relative touch-hit-44 ${STATUS_BAR_SHORTCUTS_BUTTON_CLASS}`;

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
