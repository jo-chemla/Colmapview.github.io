import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReconstructionStore, useUIStore } from '../../../store';
import { useFloorPlaneStore } from '../../../store/stores/floorPlaneStore';
import { buildReconstruction, buildWasmReconstructionWrapper } from '../../../test/builders';
import { SettingsPanel, type SettingsPanelProps } from './SettingsPanel';

function renderPanel(overrides: Partial<SettingsPanelProps> = {}) {
  const props: SettingsPanelProps = {
    activePanel: 'settings',
    setActivePanel: vi.fn(),
    ...overrides,
  };

  return { ...render(<SettingsPanel {...props} />), props };
}

describe('SettingsPanel tools section', () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState(), true);
    useReconstructionStore.setState(useReconstructionStore.getInitialState(), true);
    useFloorPlaneStore.setState(useFloorPlaneStore.getInitialState(), true);
    useReconstructionStore.setState({
      reconstruction: buildReconstruction(),
      wasmReconstruction: buildWasmReconstructionWrapper({ pointCount: 3 }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the deletion window and closes the panel behind it', () => {
    const { props } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Images from Model' }));

    expect(useUIStore.getState().showDeletionModal).toBe(true);
    expect(props.setActivePanel).toHaveBeenCalledWith(null);
  });

  it('opens the camera conversion window', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Convert Camera Model' }));

    expect(useUIStore.getState().showConversionModal).toBe(true);
  });

  it('opens the floor DETECTION window, not the floor-plane store alignment window', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Floor Detection' }));

    expect(useUIStore.getState().showFloorModal).toBe(true);
    expect(useFloorPlaneStore.getState().showFloorModal).toBe(false);
  });

  it('keeps the auto-hide editor reachable from its new home in Tools', () => {
    useUIStore.setState({ idleHideTimeout: 3 });
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Auto-hide 3D Elements' }));

    expect(useUIStore.getState().showAutoHideEditor).toBe(true);
  });

  it('hides the auto-hide row while the idle timeout is off', () => {
    useUIStore.setState({ idleHideTimeout: 0 });
    renderPanel();

    expect(screen.queryByRole('button', { name: 'Auto-hide 3D Elements' })).toBeNull();
  });

  it('disables data tools on the landing page instead of opening empty windows', () => {
    useReconstructionStore.setState({ reconstruction: null, wasmReconstruction: null });
    renderPanel();

    const deletionButton = screen.getByRole('button', { name: 'Delete Images from Model' });
    expect(deletionButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Convert Camera Model' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Floor Detection' })).toBeDisabled();

    fireEvent.click(deletionButton);
    expect(useUIStore.getState().showDeletionModal).toBe(false);
  });

  it('disables floor detection when the reconstruction has no points', () => {
    useReconstructionStore.setState({
      wasmReconstruction: buildWasmReconstructionWrapper({ pointCount: 0 }),
    });
    renderPanel();

    expect(screen.getByRole('button', { name: 'Floor Detection' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Images from Model' })).toBeEnabled();
  });
});
