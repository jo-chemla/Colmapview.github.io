import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, type MouseEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { modalStyles } from '../../theme';
import { FloatingWindowShell } from './FloatingWindowShell';

afterEach(() => {
  cleanup();
});

describe('FloatingWindowShell', () => {
  it('renders non-modal floating chrome with non-modal dialog semantics', () => {
    const onClose = vi.fn();
    const onPanelPointerDown = vi.fn();
    const onHeaderPointerDown = vi.fn();
    const panelRef = createRef<HTMLDivElement>();

    render(
      <FloatingWindowShell
        isOpen
        title="Floating title"
        onClose={onClose}
        panelRef={panelRef}
        overlayStyle={{ zIndex: 1007 }}
        panelStyle={{ left: 12, top: 24, width: 300 }}
        onPanelPointerDown={onPanelPointerDown}
        onHeaderPointerDown={onHeaderPointerDown}
      >
        <div>Body</div>
      </FloatingWindowShell>
    );

    const dialog = screen.getByRole('dialog', { name: 'Floating title' });
    expect(dialog).toBe(panelRef.current);
    expect(dialog).not.toHaveAttribute('aria-modal');
    expect(dialog).toHaveAttribute('tabindex', '-1');
    expect(dialog).toHaveAttribute('aria-labelledby', screen.getByText('Floating title').id);
    expect(screen.getByText('Floating title')).toBeVisible();
    expect(panelRef.current).toHaveClass(...modalStyles.toolPanel.split(' '));
    expect(panelRef.current).toHaveAttribute('data-idle-pause', 'true');
    expect(panelRef.current).toHaveStyle({ left: '12px', top: '24px', width: '300px' });
    // The compact breakpoint restyles the width, and no stylesheet beats an
    // inline declaration — so the shell republishes it as a custom property.
    expect(panelRef.current!.style.getPropertyValue('--tool-modal-width')).toBe('300px');

    fireEvent.pointerDown(panelRef.current!);
    fireEvent.pointerDown(screen.getByText('Floating title').parentElement!);
    fireEvent.click(screen.getByTitle('Close'));

    expect(onPanelPointerDown).toHaveBeenCalledTimes(2);
    expect(onHeaderPointerDown).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('can preserve backdrop click behavior for mixed dialog/tool windows', () => {
    const onBackdropClick = vi.fn();

    render(
      <FloatingWindowShell
        isOpen
        title="With backdrop"
        onClose={vi.fn()}
        renderBackdrop
        onBackdropClick={onBackdropClick}
      >
        <div>Body</div>
      </FloatingWindowShell>
    );

    const backdrop = Array.from(document.querySelectorAll('div'))
      .find((element) => element.classList.contains('bg-ds-void/50'));
    if (!backdrop) throw new Error('expected backdrop');

    fireEvent.click(backdrop);

    expect(onBackdropClick).toHaveBeenCalledTimes(1);
  });

  it('publishes no width property for windows that size to their content', () => {
    // The compact rule's calc() is then invalid at computed-value time and the
    // width falls back to auto — the width these windows already had.
    const panelRef = createRef<HTMLDivElement>();

    render(
      <FloatingWindowShell
        isOpen
        title="Content sized"
        onClose={vi.fn()}
        panelRef={panelRef}
        panelStyle={{ maxWidth: '90vw' }}
      >
        <div>Body</div>
      </FloatingWindowShell>
    );

    expect(panelRef.current).toHaveStyle({ maxWidth: '90vw' });
    expect(panelRef.current!.style.getPropertyValue('--tool-modal-width')).toBe('');
  });

  it('moves focus into the window on open and back to the opener on close', async () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button type="button">Opener</button>
          <FloatingWindowShell isOpen={open} title="Focus target" onClose={vi.fn()}>
            <button type="button">Inside</button>
          </FloatingWindowShell>
        </>
      );
    }

    const { rerender } = render(<Harness open={false} />);
    const opener = screen.getByRole('button', { name: 'Opener' });
    opener.focus();

    rerender(<Harness open />);
    await waitFor(() => expect(screen.getByTitle('Close')).toHaveFocus());

    rerender(<Harness open={false} />);
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('does not close on Escape because the viewer owns global Escape semantics', () => {
    const onClose = vi.fn();

    render(
      <FloatingWindowShell isOpen title="Escape safe" onClose={onClose}>
        <div>Body</div>
      </FloatingWindowShell>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('forwards panel context-menu events when provided', () => {
    const onPanelContextMenu = vi.fn((event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
    });

    render(
      <FloatingWindowShell
        isOpen
        title="Context surface"
        onClose={vi.fn()}
        onPanelContextMenu={onPanelContextMenu}
      >
        <div>Body</div>
      </FloatingWindowShell>
    );

    fireEvent.contextMenu(screen.getByText('Body'));

    expect(onPanelContextMenu).toHaveBeenCalledTimes(1);
  });
});
