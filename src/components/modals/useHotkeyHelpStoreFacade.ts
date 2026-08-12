import { useUIStore } from '../../store';

export interface HotkeyHelpStoreFacade {
  touchMode: boolean;
  embedMode: boolean;
  /** Whether the 'buttons' chrome participates in auto-hide. */
  autoHideButtons: boolean;
  isIdle: boolean;
  showAutoHideEditor: boolean;
  /** Panel open state; store-owned so the status bar can open it too. */
  showHotkeyHelp: boolean;
  setShowHotkeyHelp: (show: boolean) => void;
  /** Flips the panel open/closed (info button, ? / I hotkey). */
  toggleHotkeyHelp: () => void;
}

/**
 * Store facade for HotkeyHelpModal (componentStoreBoundary: components never
 * call use*Store directly). Exposes the flags that gate the info button, the
 * auto-hide chrome state that fades it when the viewer goes idle, and the
 * shared open state for the panel itself.
 */
export function useHotkeyHelpStoreFacade(): HotkeyHelpStoreFacade {
  const touchMode = useUIStore((s) => s.touchMode);
  const embedMode = useUIStore((s) => s.embedMode);
  const autoHideButtons = useUIStore((s) => s.autoHideElements.buttons);
  const isIdle = useUIStore((s) => s.isIdle);
  const showAutoHideEditor = useUIStore((s) => s.showAutoHideEditor);
  const showHotkeyHelp = useUIStore((s) => s.showHotkeyHelp);
  const setShowHotkeyHelp = useUIStore((s) => s.setShowHotkeyHelp);
  const toggleHotkeyHelp = useUIStore((s) => s.toggleHotkeyHelp);

  return {
    touchMode,
    embedMode,
    autoHideButtons,
    isIdle,
    showAutoHideEditor,
    showHotkeyHelp,
    setShowHotkeyHelp,
    toggleHotkeyHelp,
  };
}
