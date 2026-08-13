import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useReconstructionStore, useUIStore } from '../../../store';
import { useFloorPlaneStore } from '../../../store/stores/floorPlaneStore';
import { buildReconstruction } from '../../../test/builders';
import { useSettingsPanelStoreFacade } from './useSettingsPanelStoreFacade';

describe('useSettingsPanelStoreFacade', () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState(), true);
    useReconstructionStore.setState(useReconstructionStore.getInitialState(), true);
    useFloorPlaneStore.setState(useFloorPlaneStore.getInitialState(), true);
  });

  it('collects settings-panel dependencies from the UI store', () => {
    useUIStore.setState({ idleHideTimeout: 7 });

    const { result } = renderHook(() => useSettingsPanelStoreFacade());

    expect(result.current.ui.idleHideTimeout).toBe(7);
    expect(typeof result.current.ui.setIdleHideTimeout).toBe('function');
    expect(typeof result.current.ui.setShowAutoHideEditor).toBe('function');
    expect(typeof result.current.ui.openContextMenuEditor).toBe('function');
    expect(typeof result.current.ui.setShowDeletionModal).toBe('function');
    expect(typeof result.current.ui.setShowConversionModal).toBe('function');
    expect(typeof result.current.ui.setShowFloorModal).toBe('function');
  });

  it('exposes the reconstruction the Tools rows gate on', () => {
    const reconstruction = buildReconstruction();
    useReconstructionStore.setState({ reconstruction });

    const { result } = renderHook(() => useSettingsPanelStoreFacade());

    expect(result.current.data.reconstruction).toBe(reconstruction);
    expect(result.current.data.wasmReconstruction).toBeNull();
  });

  it('routes settings actions back to the UI store', () => {
    const { result } = renderHook(() => useSettingsPanelStoreFacade());

    act(() => {
      result.current.ui.setIdleHideTimeout(5);
      result.current.ui.setShowAutoHideEditor(true);
      result.current.ui.openContextMenuEditor();
    });

    expect(useUIStore.getState()).toMatchObject({
      idleHideTimeout: 5,
      showAutoHideEditor: true,
      showContextMenuEditor: true,
    });
  });

  it('routes tool-window actions to the UI store flags, not the floor-plane store', () => {
    const { result } = renderHook(() => useSettingsPanelStoreFacade());

    act(() => {
      result.current.ui.setShowDeletionModal(true);
      result.current.ui.setShowConversionModal(true);
      result.current.ui.setShowFloorModal(true);
    });

    expect(useUIStore.getState()).toMatchObject({
      showDeletionModal: true,
      showConversionModal: true,
      showFloorModal: true,
    });
    // floorPlaneStore declares its own showFloorModal (the floor ALIGN window);
    // the Tools row must not be wired to that one.
    expect(useFloorPlaneStore.getState().showFloorModal).toBe(false);
  });
});
