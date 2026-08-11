import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useFloatingDialogFocus } from './useFloatingDialogFocus';

afterEach(() => {
  cleanup();
});

// The open -> close focus round trip is proven end to end by the shells that use
// this hook (FloatingWindowShell.test.tsx, ModalDialogShell.test.tsx — the latter
// also covers the initialFocusRef override). Only the case they cannot stage —
// a panel with no focusable descendants — is exercised directly here.
function Harness({ isOpen }: { isOpen: boolean }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useFloatingDialogFocus(isOpen, panelRef);

  return (
    <>
      <button type="button">Opener</button>
      {isOpen && <div ref={panelRef} tabIndex={-1} data-testid="panel" />}
    </>
  );
}

describe('useFloatingDialogFocus', () => {
  it('falls back to the panel itself when it holds no focusable children', async () => {
    const { rerender } = render(<Harness isOpen={false} />);
    screen.getByRole('button', { name: 'Opener' }).focus();

    rerender(<Harness isOpen />);

    await waitFor(() => expect(screen.getByTestId('panel')).toHaveFocus());
  });
});
