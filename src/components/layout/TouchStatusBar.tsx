import {
  TOUCH_STATUS_BAR_HELP_BUTTON_CLASS,
  TOUCH_STATUS_BAR_HELP_LABEL,
  TOUCH_STATUS_BAR_HELP_TITLE,
  formatStatusBarFps,
  getTouchEmptyStatusText,
  shouldShowTouchStatusBar,
} from './statusBarViewModel';
import { shouldHideChromeWithButtons } from './autoHideChromePolicy';
import { useTouchStatusBarStoreFacade } from './useTouchStatusBarStoreFacade';

/**
 * Simplified status bar for touch mode.
 * Shows FPS and the Help entry - removes histograms, cache stats, and links.
 * Height: 44px — the tap-target minimum, so the Help button needs no synthetic
 * tap box (vs 40px desktop status bar)
 * Visibility controlled by touchUI.statusBar.
 *
 * The Help entry is this layout's only pointer route into HotkeyHelpModal: the
 * desktop status bar that carries the ⌨ Shortcuts entry is not rendered in
 * touch mode, and the panel's I / Shift+? bindings need a keyboard.
 */
export function TouchStatusBar() {
  const {
    fps,
    touchUI,
    autoHideButtons,
    isIdle,
    showAutoHideEditor,
    urlLoading,
    reconstruction,
    setShowHotkeyHelp,
  } = useTouchStatusBarStoreFacade();
  const emptyStatusText = getTouchEmptyStatusText({
    hasReconstruction: Boolean(reconstruction),
    urlLoading,
  });

  // Hide status bar if touchUI.statusBar is false
  if (!shouldShowTouchStatusBar(touchUI.statusBar)) return null;
  if (shouldHideChromeWithButtons({ autoHideButtons, isIdle, showAutoHideEditor })) return null;

  return (
    <footer className="h-11 border-t border-ds bg-ds-tertiary text-ds-secondary text-xs px-3 flex items-center justify-between">
      <span className="text-ds-secondary">{formatStatusBarFps(fps)}</span>
      {emptyStatusText !== null && (
        <span className="text-ds-muted">
          {emptyStatusText}
        </span>
      )}
      {/* self-stretch is what makes the h-11 bar the button's OWN box: the row
          is `items-center`, which would otherwise shrink the button to one line
          of text-xs (~16px) and leave the 44px purely decorative. */}
      <button
        type="button"
        onClick={() => setShowHotkeyHelp(true)}
        className={`${TOUCH_STATUS_BAR_HELP_BUTTON_CLASS} self-stretch`}
        title={TOUCH_STATUS_BAR_HELP_TITLE}
        aria-label={TOUCH_STATUS_BAR_HELP_TITLE}
      >
        {TOUCH_STATUS_BAR_HELP_LABEL}
      </button>
    </footer>
  );
}
