import { useEffect, useRef, type Ref, type RefCallback, type RefObject } from 'react';
import { getModalDialogFocusableElements } from './modalDialogShellPolicy';

/**
 * Merge the shell's internal panel ref with the caller-supplied one so the same
 * node reaches both: the internal ref drives focus management, the forwarded ref
 * drives caller-owned behavior (drag bounds, outside-click checks).
 */
export function mergeFloatingPanelRefs<T extends HTMLElement>(
  internalRef: RefObject<T | null>,
  forwardedRef: Ref<T> | undefined
): RefCallback<T> {
  return (node) => {
    internalRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };
}

/**
 * Focus behavior for NON-modal floating tool windows: move focus to the first
 * focusable element when the window opens, return focus to the opener when it
 * closes. No Tab trap and no Escape handling — tool windows are non-modal
 * (see ModalDialogShell for the modal variant).
 */
export function useFloatingDialogFocus(
  isOpen: boolean,
  panelRef: RefObject<HTMLDivElement | null>
): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }

    const focusable = getModalDialogFocusableElements(panelRef.current);
    (focusable[0] ?? panelRef.current)?.focus();

    return () => {
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [isOpen, panelRef]);
}
