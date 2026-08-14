import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  usePointCloudStore,
  usePointPickingStore,
  useReconstructionStore,
  useUIStore,
} from '../../../store';
import { buildReconstruction } from '../../../test/builders';
import { AlignPanel, type AlignPanelProps } from './AlignPanel';

function renderPanel(overrides: Partial<AlignPanelProps> = {}) {
  const props: AlignPanelProps = {
    activePanel: 'align',
    setActivePanel: vi.fn(),
    ...overrides,
  };

  return render(<AlignPanel {...props} />);
}

describe('AlignPanel', () => {
  beforeEach(() => {
    useReconstructionStore.setState(useReconstructionStore.getInitialState(), true);
    useUIStore.setState(useUIStore.getInitialState(), true);
    usePointPickingStore.setState(usePointPickingStore.getInitialState(), true);
    usePointCloudStore.setState(usePointCloudStore.getInitialState(), true);
    useReconstructionStore.setState({ reconstruction: buildReconstruction() });
  });

  afterEach(() => {
    cleanup();
  });

  it('arms a picking tool and makes the point cloud pickable', () => {
    usePointCloudStore.setState({ showPointCloud: false, colorMode: 'trackLength' });
    renderPanel();

    fireEvent.click(screen.getByText('1-Point Origin'));

    expect(usePointPickingStore.getState().pickingMode).toBe('origin-1pt');
    expect(usePointCloudStore.getState()).toMatchObject({
      showPointCloud: true,
      colorMode: 'rgb',
    });
  });

  it('swaps splats to splat points so arming never leaves nothing to click', () => {
    usePointCloudStore.setState({ showPointCloud: true, colorMode: 'splats' });
    renderPanel();

    fireEvent.click(screen.getByText('3-Point Align'));

    expect(usePointPickingStore.getState().pickingMode).toBe('normal-3pt');
    expect(usePointCloudStore.getState()).toMatchObject({
      showPointCloud: true,
      colorMode: 'splatPoints',
    });
  });

  it('disarms the active tool when its own row is clicked again', () => {
    usePointPickingStore.setState({ pickingMode: 'distance-2pt' });
    renderPanel();

    fireEvent.click(screen.getByText('2-Point Scale'));

    expect(usePointPickingStore.getState().pickingMode).toBe('off');
  });

  it('turns the toolbar button into the cancel affordance while a tool is armed', () => {
    usePointPickingStore.setState({ pickingMode: 'origin-1pt' });
    renderPanel();

    fireEvent.click(screen.getByLabelText('Align: 1-Point Origin (click to cancel)'));

    expect(usePointPickingStore.getState().pickingMode).toBe('off');
    expect(screen.queryByLabelText('Align tools')).not.toBeNull();
  });

  it('shows the three picking tools and leaves the gizmo to the transform panel', () => {
    renderPanel();

    // Everything inside the panel, i.e. every button but the labelled toolbar one.
    const panelButtons = screen
      .queryAllByRole('button')
      .filter((button) => !button.hasAttribute('aria-label'));

    expect(panelButtons.map((button) => button.textContent)).toEqual([
      '1-Point Origin',
      '2-Point Scale',
      '3-Point Align',
    ]);
    expect(screen.queryByText('Gizmo (T)')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(useUIStore.getState().showGizmo).toBe(false);
  });

  it('stays disabled with no reconstruction loaded', () => {
    useReconstructionStore.setState({ reconstruction: null });
    renderPanel();

    expect(screen.getByLabelText('Align tools (no data loaded)')).toBeDisabled();
    expect(screen.queryByText('1-Point Origin')).toBeNull();
  });
});
