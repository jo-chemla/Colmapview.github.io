import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useReconstructionStore,
  useTransformStore,
  useUIStore,
} from '../../../store';
import { buildReconstruction } from '../../../test/builders';
import { createIdentityEuler } from '../../../utils/sim3dTransforms';
import { TransformPanel, type TransformPanelProps } from './TransformPanel';

function renderPanel(overrides: Partial<TransformPanelProps> = {}) {
  const props: TransformPanelProps = {
    activePanel: 'transform',
    setActivePanel: vi.fn(),
    ...overrides,
  };

  return render(<TransformPanel {...props} />);
}

describe('TransformPanel', () => {
  beforeEach(() => {
    useReconstructionStore.setState(useReconstructionStore.getInitialState(), true);
    useTransformStore.setState(useTransformStore.getInitialState(), true);
    useUIStore.setState(useUIStore.getInitialState(), true);
    useReconstructionStore.setState({ reconstruction: buildReconstruction() });
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the by-hand controls: the gizmo toggle and the sliders', () => {
    renderPanel();

    expect(screen.getByText('Gizmo (T)')).toBeInTheDocument();
    for (const label of ['Scale', 'Rotate-X', 'Rotate-Y', 'Rotate-Z', 'Translate-X', 'Translate-Y', 'Translate-Z']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('no longer hosts the operations that compute a transform from the scene', () => {
    useReconstructionStore.setState({ reconstruction: buildReconstruction() });
    renderPanel();

    // Both moved to Align, where they sit beside the pick tools that reach the
    // same goals ("Center at Origin" / "1-Point Origin" were the giveaway).
    expect(screen.queryByRole('button', { name: 'Center at Origin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Floor Detection' })).toBeNull();
    expect(screen.queryByRole('button', { name: '1-Point Origin' })).toBeNull();
  });

  it('keeps Reset, Reload and Apply — Reload is this panel alone', () => {
    useTransformStore.setState({ transform: { ...createIdentityEuler(), scale: 1.5 } });
    renderPanel();

    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(useTransformStore.getState().transform).toEqual(createIdentityEuler());
  });
});
