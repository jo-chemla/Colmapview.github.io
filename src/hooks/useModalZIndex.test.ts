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
    const first = renderHook(() => useModalZIndex(true));
    expect(first.result.current.zIndex).toBeGreaterThan(Z_INDEX.modal);
    expect(first.result.current.zIndex).toBeLessThan(Z_INDEX.modalOverlay);

    // The counter is module-global, so a long session is simulated by
    // repeatedly bringing windows to front across instances.
    act(() => {
      for (let i = 0; i < 500; i++) first.result.current.bringToFront();
    });
    expect(first.result.current.zIndex).toBeLessThan(Z_INDEX.modalOverlay);

    const later = renderHook(() => useModalZIndex(true));
    expect(later.result.current.zIndex).toBeLessThan(Z_INDEX.modalOverlay);
    expect(later.result.current.zIndex).toBeGreaterThanOrEqual(Z_INDEX.modal);
  });
});
