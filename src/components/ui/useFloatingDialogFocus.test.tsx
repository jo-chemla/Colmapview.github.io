import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createRef, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeFloatingPanelRefs, useFloatingDialogFocus } from './useFloatingDialogFocus';

afterEach(() => {
  cleanup();
});

interface HarnessProps {
  isOpen: boolean;
  withFocusableChild?: boolean;
}

function Harness({ isOpen, withFocusableChild = true }: HarnessProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useFloatingDialogFocus(isOpen, panelRef);

  return (
    <>
      <button type="button">Opener</button>
      {isOpen && (
        <div ref={panelRef} tabIndex={-1} data-testid="panel">
          {withFocusableChild && <button type="button">Inside</button>}
        </div>
      )}
    </>
  );
}

describe('useFloatingDialogFocus', () => {
  it('moves focus to the first focusable element on open and returns it on close', async () => {
    const { rerender } = render(<Harness isOpen={false} />);
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();

    rerender(<Harness isOpen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus());

    rerender(<Harness isOpen={false} />);
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('falls back to the panel itself when it holds no focusable children', async () => {
    const { rerender } = render(<Harness isOpen={false} withFocusableChild={false} />);
    screen.getByRole('button', { name: 'Opener' }).focus();

    rerender(<Harness isOpen withFocusableChild={false} />);

    await waitFor(() => expect(screen.getByTestId('panel')).toHaveFocus());
  });

  it('leaves focus alone while the window is closed', () => {
    render(<Harness isOpen={false} />);
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();

    expect(opener).toHaveFocus();
  });
});

describe('mergeFloatingPanelRefs', () => {
  it('feeds the node to the internal ref plus object or callback forwarded refs', () => {
    const internalRef = createRef<HTMLDivElement>();
    const forwardedObjectRef = createRef<HTMLDivElement>();
    const forwardedCallbackRef = vi.fn();
    const node = document.createElement('div');

    mergeFloatingPanelRefs(internalRef, forwardedObjectRef)(node);
    expect(internalRef.current).toBe(node);
    expect(forwardedObjectRef.current).toBe(node);

    mergeFloatingPanelRefs(internalRef, forwardedCallbackRef)(node);
    expect(forwardedCallbackRef).toHaveBeenCalledWith(node);

    mergeFloatingPanelRefs(internalRef, undefined)(null);
    expect(internalRef.current).toBeNull();
  });
});
