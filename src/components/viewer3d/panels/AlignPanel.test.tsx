import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  usePointCloudStore,
  usePointPickingStore,
  useReconstructionStore,
  useTransformStore,
} from '../../../store';
import {
  buildReconstruction,
  buildWasmReconstructionWrapper,
} from '../../../test/builders';
import { createIdentityEuler } from '../../../utils/sim3dTransforms';
import { AlignPanel, type AlignPanelProps } from './AlignPanel';
import { ALIGN_GOALS, ALIGN_TOOLS } from './alignPanelViewModel';
import { TRANSFORM_PENDING_HINT } from './transformPanelViewModel';

function renderPanel(overrides: Partial<AlignPanelProps> = {}) {
  const props: AlignPanelProps = {
    activePanel: 'align',
    setActivePanel: vi.fn(),
    onOpenFloorModal: vi.fn(),
    ...overrides,
  };

  return render(<AlignPanel {...props} />);
}

describe('AlignPanel', () => {
  beforeEach(() => {
    useReconstructionStore.setState(useReconstructionStore.getInitialState(), true);
    usePointPickingStore.setState(usePointPickingStore.getInitialState(), true);
    usePointCloudStore.setState(usePointCloudStore.getInitialState(), true);
    useTransformStore.setState(useTransformStore.getInitialState(), true);
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

  it('groups each automatic operation with the pick tool that reaches the same goal', () => {
    renderPanel();

    for (const goal of ALIGN_GOALS) {
      const caption = screen.getByText(goal.goal);
      const group = caption.parentElement;
      const labels = [...(group?.querySelectorAll('button') ?? [])].map((b) => b.textContent);

      // The automatic half first, then the by-picking half, under one caption.
      expect(labels).toEqual(
        goal.automatic ? [goal.automatic.label, goal.pick.label] : [goal.pick.label]
      );
    }
  });

  it('centers the scene at the origin without picking anything', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Center at Origin' }));

    // The preset writes the same pending transform the pick tools do.
    expect(useTransformStore.getState().transform).not.toEqual(createIdentityEuler());
  });

  it('opens the floor modal only once the reconstruction has points', () => {
    const onOpenFloorModal = vi.fn();
    renderPanel({ onOpenFloorModal });

    const disabledFloor = screen.getByRole('button', { name: 'Floor Detection' });
    expect(disabledFloor).toBeDisabled();
    // Still the preset SHAPE while gated, so it lines up under its goal caption
    // instead of shrinking to a centered action button.
    expect(disabledFloor.className).toContain('justify-start');
    expect(disabledFloor.className).toContain('w-full');
    expect(disabledFloor.className).not.toContain('flex-1');
    fireEvent.click(disabledFloor);
    expect(onOpenFloorModal).not.toHaveBeenCalled();

    cleanup();
    useReconstructionStore.setState({
      wasmReconstruction: buildWasmReconstructionWrapper({
        positions: new Float32Array([0, 0, 0]),
      }),
    });
    renderPanel({ onOpenFloorModal });

    fireEvent.click(screen.getByRole('button', { name: 'Floor Detection' }));
    expect(onOpenFloorModal).toHaveBeenCalledTimes(1);
  });

  it('offers the same Reset/Apply the transform panel does, on the shared transform', () => {
    useTransformStore.setState({ transform: { ...createIdentityEuler(), translationX: 2 } });
    renderPanel();

    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    // Same constant TransformPanel.test.tsx asserts — the two panels must not
    // drift into describing the same pending state differently.
    expect(screen.getByText(TRANSFORM_PENDING_HINT)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(useTransformStore.getState().transform).toEqual(createIdentityEuler());
  });

  it('disables Reset/Apply while the transform is untouched, and offers no Reload', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    // Reload re-reads the dropped files; it is not an alignment and stays in Transform.
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
  });

  it('stays disabled with no reconstruction loaded', () => {
    useReconstructionStore.setState({ reconstruction: null });
    renderPanel();

    expect(screen.getByLabelText('Align tools (no data loaded)')).toBeDisabled();
    expect(screen.queryByText('1-Point Origin')).toBeNull();
  });
});
