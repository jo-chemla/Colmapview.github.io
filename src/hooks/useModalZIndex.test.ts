import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Z_INDEX } from '../theme';
import { nextModalZIndex, useModalZIndex } from './useModalZIndex';

describe('nextModalZIndex', () => {
  it('increments within the tool-window band', () => {
    expect(nextModalZIndex(Z_INDEX.modal)).toBe(Z_INDEX.modal + 1);
  });

  it('never reaches the blocking-dialog layer (modalOverlay)', () => {
    let z = Z_INDEX.modal;
    for (let i = 0; i < 500; i++) z = nextModalZIndex(z);
    expect(z).toBeLessThan(Z_INDEX.modalOverlay);
  });
});

describe('useModalZIndex', () => {
  it('keeps the hook-assigned z-index inside the tool-window band', () => {
    const { result } = renderHook(() => useModalZIndex(true));
    const onOpen = result.current.zIndex;
    expect(onOpen).toBeGreaterThan(Z_INDEX.modal);
    expect(onOpen).toBeLessThan(Z_INDEX.modalOverlay);

    // Already the top window: bringToFront burns no counter headroom.
    act(() => result.current.bringToFront());
    expect(result.current.zIndex).toBe(onOpen);

    // A second window opens above it; clicking the first raises it back to top.
    renderHook(() => useModalZIndex(true));
    act(() => result.current.bringToFront());

    expect(result.current.zIndex).toBeGreaterThan(onOpen);
    expect(result.current.zIndex).toBeLessThan(Z_INDEX.modalOverlay);
  });
});
