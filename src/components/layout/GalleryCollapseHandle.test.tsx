import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '../../store/stores/uiStore';
import { GalleryCollapseHandle } from './GalleryCollapseHandle';

function renderHandle(onResizeMouseDown = vi.fn()) {
  const utils = render(<GalleryCollapseHandle onResizeMouseDown={onResizeMouseDown} />);
  return { ...utils, onResizeMouseDown };
}

function getDivider(container: HTMLElement): HTMLElement {
  const divider = container.querySelector('.resize-handle');
  if (!divider) throw new Error('resize handle not rendered');
  return divider as HTMLElement;
}

describe('GalleryCollapseHandle', () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
  });

  it('collapses the gallery from the divider handle', () => {
    renderHandle();

    fireEvent.click(screen.getByLabelText('Hide gallery'));

    expect(useUIStore.getState().galleryCollapsed).toBe(true);
  });

  it('stays mounted while collapsed so the gallery can be brought back', () => {
    useUIStore.setState({ galleryCollapsed: true });
    const { container } = renderHandle();

    expect(container.querySelector('.resize-handle')).not.toBeNull();

    fireEvent.click(screen.getByLabelText('Show gallery'));

    expect(useUIStore.getState().galleryCollapsed).toBe(false);
  });

  it('never starts a resize drag from the handle press', () => {
    const { onResizeMouseDown } = renderHandle();

    fireEvent.mouseDown(screen.getByLabelText('Hide gallery'));

    expect(onResizeMouseDown).not.toHaveBeenCalled();
  });

  it('starts a resize drag from the divider itself, but not while collapsed', () => {
    const { container, onResizeMouseDown } = renderHandle();

    fireEvent.mouseDown(getDivider(container));
    expect(onResizeMouseDown).toHaveBeenCalledTimes(1);

    cleanup();
    useUIStore.setState({ galleryCollapsed: true });
    const collapsed = renderHandle(onResizeMouseDown);

    fireEvent.mouseDown(getDivider(collapsed.container));
    expect(onResizeMouseDown).toHaveBeenCalledTimes(1);
  });

  it('renders nothing in embed mode', () => {
    useUIStore.setState({ embedMode: true });
    const { container } = renderHandle();

    expect(container.querySelector('.resize-handle')).toBeNull();
  });
});
