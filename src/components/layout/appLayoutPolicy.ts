import type { CSSProperties } from 'react';

export const APP_LAYOUT_MIN_PANEL_WIDTH = 300;
export const APP_LAYOUT_MAX_PANEL_WIDTH_PERCENT = 0.6;
export const APP_LAYOUT_CURSOR_OWNER = 'app-layout';

/**
 * Touch-layout shell classes. `safe-area-inset` pads the UI clear of notches
 * and the home indicator (requires viewport-fit=cover in index.html);
 * `touch-none` disables browser gestures inside the app shell.
 */
export const TOUCH_LAYOUT_ROOT_CLASS = 'h-screen flex flex-col bg-ds-primary touch-none safe-area-inset';

/**
 * First-load guide tip. Touch only: the desktop right-click instruction was
 * retired once the alignment tools became visible in the toolbar, so the
 * context menu no longer needs to be advertised on load.
 */
export type AppLayoutGuideTip = { id: 'touchMode'; message: 'Tap to select, long-press for options' };

export function getInitialGalleryPanelWidth(
  windowWidth: number,
  defaultWidthPercent: number
): number {
  return Math.round(windowWidth * (defaultWidthPercent / 100));
}

export function getDraggedGalleryPanelWidth({
  windowWidth,
  clientX,
  minWidth = APP_LAYOUT_MIN_PANEL_WIDTH,
  maxWidthPercent = APP_LAYOUT_MAX_PANEL_WIDTH_PERCENT,
}: {
  windowWidth: number;
  clientX: number;
  minWidth?: number;
  maxWidthPercent?: number;
}): number {
  const requestedWidth = windowWidth - clientX;
  const maxWidth = windowWidth * maxWidthPercent;
  return Math.max(minWidth, Math.min(maxWidth, requestedWidth));
}

export function getWindowResizedGalleryPanelWidth({
  currentWidth,
  windowWidth,
  maxWidthPercent = APP_LAYOUT_MAX_PANEL_WIDTH_PERCENT,
}: {
  currentWidth: number;
  windowWidth: number;
  maxWidthPercent?: number;
}): number {
  return Math.min(currentWidth, windowWidth * maxWidthPercent);
}

export function shouldHideInlineGallery({
  embedMode,
  touchMode,
  galleryCollapsed,
}: {
  embedMode: boolean;
  touchMode: boolean;
  galleryCollapsed: boolean;
}): boolean {
  return embedMode || touchMode || galleryCollapsed;
}

export function getGalleryPanelStyle({
  hideGallery,
  panelWidth,
}: {
  hideGallery: boolean;
  panelWidth: number;
}): CSSProperties {
  return {
    width: hideGallery ? 0 : panelWidth,
  };
}

export function getGalleryPanelInnerStyle(
  minWidth = APP_LAYOUT_MIN_PANEL_WIDTH
): CSSProperties {
  return {
    minWidth: `${minWidth}px`,
  };
}

export function getAppLayoutGuideTip({
  hasReconstruction,
  urlLoading,
  touchMode,
  hasShownTip,
}: {
  hasReconstruction: boolean;
  urlLoading: boolean;
  touchMode: boolean;
  hasShownTip: boolean;
}): AppLayoutGuideTip | null {
  if (!hasReconstruction || urlLoading || hasShownTip || !touchMode) {
    return null;
  }

  return { id: 'touchMode', message: 'Tap to select, long-press for options' };
}
