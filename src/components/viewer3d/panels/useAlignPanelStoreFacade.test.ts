import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
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
import { useAlignPanelStoreFacade } from './useAlignPanelStoreFacade';

describe('useAlignPanelStoreFacade', () => {
  beforeEach(() => {
    useReconstructionStore.setState(useReconstructionStore.getInitialState(), true);
    usePointPickingStore.setState(usePointPickingStore.getInitialState(), true);
    usePointCloudStore.setState(usePointCloudStore.getInitialState(), true);
    useTransformStore.setState(useTransformStore.getInitialState(), true);
  });

  it('collects align-panel dependencies from owning stores', () => {
    const reconstruction = buildReconstruction();
    const wasmReconstruction = buildWasmReconstructionWrapper({
      positions: new Float32Array([0, 0, 0]),
    });
    const transform = { ...createIdentityEuler(), scale: 2 };
    useReconstructionStore.setState({ reconstruction, wasmReconstruction });
    usePointPickingStore.setState({ pickingMode: 'origin-1pt' });
    usePointCloudStore.setState({ showPointCloud: false, colorMode: 'splats' });
    useTransformStore.setState({ transform });

    const { result } = renderHook(() => useAlignPanelStoreFacade());

    expect(result.current.data.reconstruction).toBe(reconstruction);
    expect(result.current.data.wasmReconstruction).toBe(wasmReconstruction);
    expect(result.current.pointPicking.pickingMode).toBe('origin-1pt');
    expect(result.current.transform.hasPendingTransform).toBe(true);
    expect(result.current.pointCloud.getPointCloudSnapshot()).toEqual({
      showPointCloud: false,
      colorMode: 'splats',
    });
    expect(typeof result.current.actions.applyTransformPreset).toBe('function');
    expect(typeof result.current.actions.applyTransformToData).toBe('function');
  });

  it('reads point-cloud state on demand instead of subscribing the panel to it', () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useAlignPanelStoreFacade();
    });
    const rendersAfterMount = renderCount;

    act(() => {
      usePointCloudStore.getState().setShowPointCloud(false);
      usePointCloudStore.getState().setColorMode('splats');
    });

    // Point-cloud visibility and color mode change constantly elsewhere in the
    // app; the align panel only consults them when a tool is armed.
    expect(renderCount).toBe(rendersAfterMount);
    expect(result.current.pointCloud.getPointCloudSnapshot()).toEqual({
      showPointCloud: false,
      colorMode: 'splats',
    });
  });

  it('keeps the snapshot reader stable across renders', () => {
    const { result, rerender } = renderHook(() => useAlignPanelStoreFacade());
    const firstReader = result.current.pointCloud.getPointCloudSnapshot;
    expect(typeof firstReader).toBe('function');

    rerender();

    expect(result.current.pointCloud.getPointCloudSnapshot).toBe(firstReader);
  });

  it('leaves the gizmo to the transform panel and exposes no UI slice', () => {
    const { result } = renderHook(() => useAlignPanelStoreFacade());

    // `transform` and `actions` are here because Align commits the same pending
    // transform the Transform panel does; `ui` is not, because the gizmo (and
    // its `T` hotkey) still has exactly one home.
    expect(Object.keys(result.current).sort()).toEqual([
      'actions',
      'data',
      'pointCloud',
      'pointPicking',
      'transform',
    ]);
  });

  it('routes Reset back to the shared transform store', () => {
    useTransformStore.setState({ transform: { ...createIdentityEuler(), rotationZ: 1 } });
    const { result } = renderHook(() => useAlignPanelStoreFacade());

    act(() => {
      result.current.transform.resetTransform();
    });

    expect(useTransformStore.getState().transform).toEqual(createIdentityEuler());
  });

  it('subscribes to the pending-transform flag, not the transform, so drags do not re-render it', () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useAlignPanelStoreFacade();
    });

    act(() => {
      useTransformStore.getState().setTransform({ translationX: 1 });
    });
    const rendersAfterFlip = renderCount;
    expect(result.current.transform.hasPendingTransform).toBe(true);

    // Two more slider/gizmo steps. The flag does not change, so neither does the
    // panel: subscribing to the transform object would re-render on all of them.
    act(() => {
      useTransformStore.getState().setTransform({ translationX: 2 });
      useTransformStore.getState().setTransform({ translationX: 3 });
    });

    expect(renderCount).toBe(rendersAfterFlip);
    expect(result.current.transform.hasPendingTransform).toBe(true);
  });

  it('routes point-picking and point-cloud actions back to owning stores', () => {
    const { result } = renderHook(() => useAlignPanelStoreFacade());

    act(() => {
      result.current.pointCloud.setShowPointCloud(true);
      result.current.pointCloud.setColorMode('splatPoints');
      result.current.pointPicking.setPickingMode('distance-2pt');
    });

    expect(usePointCloudStore.getState()).toMatchObject({
      showPointCloud: true,
      colorMode: 'splatPoints',
    });
    expect(usePointPickingStore.getState()).toMatchObject({
      pickingMode: 'distance-2pt',
      selectedPoints: [],
    });

    act(() => {
      result.current.pointPicking.setPickingMode('off');
    });

    expect(usePointPickingStore.getState().pickingMode).toBe('off');
  });
});
