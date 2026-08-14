import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  usePointCloudStore,
  usePointPickingStore,
  useReconstructionStore,
} from '../../../store';
import { buildReconstruction } from '../../../test/builders';
import { useAlignPanelStoreFacade } from './useAlignPanelStoreFacade';

describe('useAlignPanelStoreFacade', () => {
  beforeEach(() => {
    useReconstructionStore.setState(useReconstructionStore.getInitialState(), true);
    usePointPickingStore.setState(usePointPickingStore.getInitialState(), true);
    usePointCloudStore.setState(usePointCloudStore.getInitialState(), true);
  });

  it('collects align-panel dependencies from owning stores', () => {
    const reconstruction = buildReconstruction();
    useReconstructionStore.setState({ reconstruction });
    usePointPickingStore.setState({ pickingMode: 'origin-1pt' });
    usePointCloudStore.setState({ showPointCloud: false, colorMode: 'splats' });

    const { result } = renderHook(() => useAlignPanelStoreFacade());

    expect(result.current.data.reconstruction).toBe(reconstruction);
    expect(result.current.pointPicking.pickingMode).toBe('origin-1pt');
    expect(result.current.pointCloud).toMatchObject({
      showPointCloud: false,
      colorMode: 'splats',
    });
  });

  it('leaves the gizmo to the transform panel and exposes no UI slice', () => {
    const { result } = renderHook(() => useAlignPanelStoreFacade());

    expect(Object.keys(result.current).sort()).toEqual(['data', 'pointCloud', 'pointPicking']);
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
