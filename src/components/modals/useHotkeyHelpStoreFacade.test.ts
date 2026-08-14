import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useUIStore } from '../../store';
import { useHotkeyHelpStoreFacade } from './useHotkeyHelpStoreFacade';

const DEFAULT_FACADE = {
  // Panel open state is store-owned so the status bar's Shortcuts entry can
  // open this exact panel.
  showHotkeyHelp: false,
  setShowHotkeyHelp: expect.any(Function),
  toggleHotkeyHelp: expect.any(Function),
};

describe('useHotkeyHelpStoreFacade', () => {
  afterEach(() => {
    act(() => {
      useUIStore.setState(useUIStore.getInitialState(), true);
    });
  });

  it('exposes only the shared panel open state', () => {
    const { result } = renderHook(() => useHotkeyHelpStoreFacade());

    expect(result.current).toEqual(DEFAULT_FACADE);
    // The top-left ⓘ trigger is gone, so the modal no longer subscribes to the
    // mode flags or the auto-hide chrome state that only gated that button.
    expect(result.current).not.toHaveProperty('touchMode');
    expect(result.current).not.toHaveProperty('embedMode');
    expect(result.current).not.toHaveProperty('autoHideButtons');
    expect(result.current).not.toHaveProperty('isIdle');
    expect(result.current).not.toHaveProperty('showAutoHideEditor');
  });

  it('ignores touch mode, embed mode, and idle chrome changes', () => {
    const { result } = renderHook(() => useHotkeyHelpStoreFacade());

    act(() => {
      useUIStore.getState().setTouchMode(true);
      useUIStore.getState().setEmbedMode(true);
      useUIStore.setState({
        isIdle: true,
        autoHideElements: { ...useUIStore.getState().autoHideElements, buttons: false },
      });
    });

    expect(result.current).toEqual(DEFAULT_FACADE);
  });

  it('reflects and writes the shared panel open state', () => {
    const { result } = renderHook(() => useHotkeyHelpStoreFacade());

    act(() => {
      result.current.setShowHotkeyHelp(true);
    });

    expect(useUIStore.getState().showHotkeyHelp).toBe(true);
    expect(result.current).toEqual({ ...DEFAULT_FACADE, showHotkeyHelp: true });
  });

  it('flips the panel open state through the store toggle, identity-stable', () => {
    const { result } = renderHook(() => useHotkeyHelpStoreFacade());
    const toggle = result.current.toggleHotkeyHelp;

    act(() => {
      toggle();
    });
    expect(useUIStore.getState().showHotkeyHelp).toBe(true);

    act(() => {
      toggle();
    });
    expect(useUIStore.getState().showHotkeyHelp).toBe(false);
    // The action never changes identity, so consumers need no memoization.
    expect(result.current.toggleHotkeyHelp).toBe(toggle);
  });
});
