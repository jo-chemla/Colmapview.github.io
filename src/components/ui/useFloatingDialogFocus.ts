import { useEffect, useRef, type RefObject } from 'react';
import { getModalDialogFocusableElements } from './modalDialogShellPolicy';

/**
 * Save/move/restore focus for a dialog that mounts on `isOpen`: focus moves into
 * the panel on open and returns to the opener on close. Shared by the non-modal
 * tool windows (FloatingWindowShell) and the modal ones (ModalDialogShell) —
 * only the Tab trap and Escape handling are modal-specific, and those stay in
 * ModalDialogShell.
 *
 * `initialFocusRef` overrides the default target (the panel's first focusable
 * element, or the panel itself when it holds none).
 */
export function useFloatingDialogFocus(
  isOpen: boolean,
  panelRef: RefObject<HTMLDivElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>
): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }

    const focusable = getModalDialogFocusableElements(panelRef.current);
    (initialFocusRef?.current ?? focusable[0] ?? panelRef.current)?.focus();

    return () => {
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [isOpen, panelRef, initialFocusRef]);
}
