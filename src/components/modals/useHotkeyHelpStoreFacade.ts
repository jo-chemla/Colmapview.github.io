import { useUIStore } from '../../store';

export interface HotkeyHelpStoreFacade {
  /** Panel open state; store-owned so the status bar can open it too. */
  showHotkeyHelp: boolean;
  setShowHotkeyHelp: (show: boolean) => void;
  /** Flips the panel open/closed (? / I hotkey). */
  toggleHotkeyHelp: () => void;
}

/**
 * Store facade for HotkeyHelpModal (componentStoreBoundary: components never
 * call use*Store directly). Exposes only the shared open state for the panel:
 * the touch/embed flags and the auto-hide chrome state that used to live here
 * existed for the top-left ⓘ trigger, which was dropped once the status bar
 * gained its visible ⌨ Shortcuts entry (2026-08-13). The panel itself is a
 * modal — it never fades with the button chrome.
 */
export function useHotkeyHelpStoreFacade(): HotkeyHelpStoreFacade {
  const showHotkeyHelp = useUIStore((s) => s.showHotkeyHelp);
  const setShowHotkeyHelp = useUIStore((s) => s.setShowHotkeyHelp);
  const toggleHotkeyHelp = useUIStore((s) => s.toggleHotkeyHelp);

  return {
    showHotkeyHelp,
    setShowHotkeyHelp,
    toggleHotkeyHelp,
  };
}
