/**
 * Hook for managing z-index of multiple tool modals.
 * Ensures clicked/opened modals appear on top of others.
 */

import { useState, useCallback, useEffect } from 'react';
import { Z_INDEX } from '../theme';

/** Tool windows stack in [Z_INDEX.modal, Z_INDEX.modalOverlay). The clamp keeps
 * a long session from pushing tool windows above blocking dialogs (1100),
 * toasts (1500), or tooltips (2000). At the cap, ties resolve by DOM order. */
export function nextModalZIndex(counter: number): number {
  return Math.min(counter + 1, Z_INDEX.modalOverlay - 1);
}

// Global counter shared across all modal instances.
// Annotated `number` because Z_INDEX is `as const`, so Z_INDEX.modal is the
// literal type 1000 and would not widen on its own.
let globalZIndexCounter: number = Z_INDEX.modal;

// Takes the setter as a parameter rather than reading state: react-hooks forbids
// setting state in an effect body from a value this module owns.
function assignTopZIndex(setZIndex: (zIndex: number) => void): void {
  globalZIndexCounter = nextModalZIndex(globalZIndexCounter);
  setZIndex(globalZIndexCounter);
}

/**
 * Returns a z-index value and a function to bring the modal to front.
 * Call bringToFront() on mousedown/click to ensure the modal appears on top.
 */
export function useModalZIndex(isOpen: boolean) {
  const [zIndex, setZIndex] = useState<number>(Z_INDEX.modal);

  // When modal opens, bring it to front. Unguarded on purpose: before any window
  // has opened, several can share the initial Z_INDEX.modal value, so an
  // already-on-top check here would let a newly opened window fail to claim top.
  useEffect(() => {
    if (isOpen) {
      assignTopZIndex(setZIndex);
    }
  }, [isOpen]);

  const bringToFront = useCallback(() => {
    // Already the top window: advancing would only burn counter headroom.
    if (zIndex === globalZIndexCounter) return;
    assignTopZIndex(setZIndex);
  }, [zIndex]);

  return { zIndex, bringToFront };
}
