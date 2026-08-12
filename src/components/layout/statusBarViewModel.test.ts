import { describe, expect, it } from 'vitest';
import { statusBarStyles } from '../../theme';
import {
  STATUS_BAR_HIDDEN_CLASS_NAME,
  STATUS_BAR_SHORTCUTS_BUTTON_CLASS,
  STATUS_BAR_SHORTCUTS_LABEL,
  STATUS_BAR_SHORTCUTS_TITLE,
  formatStatusBarFps,
  getDesktopEmptyStatusText,
  getStatusBarContainerClassName,
  getTouchEmptyStatusText,
  shouldShowStatusHistograms,
  shouldShowTouchStatusBar,
} from './statusBarViewModel';

describe('status bar view model', () => {
  it('formats FPS values consistently for desktop and touch status bars', () => {
    expect(formatStatusBarFps(0)).toBe('0 FPS');
    expect(formatStatusBarFps(59)).toBe('59 FPS');
  });

  it('selects desktop empty-state copy from reconstruction and URL loading state', () => {
    expect(getDesktopEmptyStatusText({
      hasReconstruction: true,
      urlLoading: false,
    })).toBeNull();

    expect(getDesktopEmptyStatusText({
      hasReconstruction: false,
      urlLoading: true,
    })).toBe('Loading...');

    expect(getDesktopEmptyStatusText({
      hasReconstruction: false,
      urlLoading: false,
    })).toBe('Drop dataset or images to load');
  });

  it('preserves the compact touch loading message behavior', () => {
    expect(getTouchEmptyStatusText({
      hasReconstruction: true,
      urlLoading: true,
    })).toBeNull();

    expect(getTouchEmptyStatusText({
      hasReconstruction: false,
      urlLoading: true,
    })).toBe('Loading...');

    expect(getTouchEmptyStatusText({
      hasReconstruction: false,
      urlLoading: false,
    })).toBe('');
  });

  it('derives histogram and touch-status visibility from explicit state', () => {
    expect(shouldShowStatusHistograms({
      hasReconstruction: true,
      hasGlobalStats: true,
    })).toBe(true);

    expect(shouldShowStatusHistograms({
      hasReconstruction: true,
      hasGlobalStats: false,
    })).toBe(false);

    expect(shouldShowStatusHistograms({
      hasReconstruction: false,
      hasGlobalStats: true,
    })).toBe(false);

    expect(shouldShowTouchStatusBar(true)).toBe(true);
    expect(shouldShowTouchStatusBar(false)).toBe(false);
  });

  it('offers a visible Shortcuts entry point in place of the brand/legal cluster', () => {
    // The status bar carries status only (2026-08-12): brand, project links,
    // license, and the COLMAP credit live on the help panel's About tab, and
    // this button is the only non-hotkey way in besides the top-left ⓘ.
    expect(STATUS_BAR_SHORTCUTS_LABEL).toBe('⌨ Shortcuts');
    expect(STATUS_BAR_SHORTCUTS_TITLE).toBe('Keyboard shortcuts (I)');
    expect(STATUS_BAR_SHORTCUTS_BUTTON_CLASS).toBe(
      'text-ds-secondary hover-ds-text-primary cursor-pointer transition-colors'
    );
    // No Tailwind-only escapes: JIT hover variants or arbitrary bracket utilities.
    expect(STATUS_BAR_SHORTCUTS_BUTTON_CLASS).not.toContain('hover:');
    expect(STATUS_BAR_SHORTCUTS_BUTTON_CLASS).not.toContain('[');
  });

  it('visually hides the desktop status bar while preserving its hover target', () => {
    expect(STATUS_BAR_HIDDEN_CLASS_NAME).toBe('opacity-0');
    expect(statusBarStyles.container).toContain('absolute');
    expect(statusBarStyles.container).toContain('bottom-0');
    expect(getStatusBarContainerClassName({
      baseClassName: 'h-10 footer',
      hidden: false,
    })).toBe('h-10 footer');
    expect(getStatusBarContainerClassName({
      baseClassName: 'h-10 footer',
      hidden: true,
    })).toBe('h-10 footer opacity-0');
  });
});
