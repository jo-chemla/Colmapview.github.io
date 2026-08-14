import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  usePointCloudStore,
  usePointPickingStore,
  useReconstructionStore,
} from '../../../store';
import { buildReconstruction } from '../../../test/builders';
import { AlignPanel, type AlignPanelProps } from './AlignPanel';
import { ALIGN_TOOLS } from './alignPanelViewModel';

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

  it('shows the picking tools and leaves the gizmo to the transform panel', () => {
    renderPanel();

    for (const tool of ALIGN_TOOLS) {
      expect(screen.getByText(tool.label)).toBeInTheDocument();
    }
    expect(screen.queryByText('Gizmo (T)')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('stays disabled with no reconstruction loaded', () => {
    useReconstructionStore.setState({ reconstruction: null });
    renderPanel();

    expect(screen.getByLabelText('Align tools (no data loaded)')).toBeDisabled();
    expect(screen.queryByText('1-Point Origin')).toBeNull();
  });
});
