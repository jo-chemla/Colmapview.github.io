import { beforeEach, describe, expect, it } from 'vitest';
import { buildCamera, buildImage, buildPoint3D } from '../../test/builders';
import { createEmptyImageStatsResult } from '../../parsers';
import type { Reconstruction } from '../../types/colmap';
import { useReconstructionStore } from '../reconstructionStore';
import { areReconstructionStatsPending, ensureReconstructionStats } from './reconstructionStatsActions';

function buildPendingReconstruction(): Reconstruction {
  const camera = buildCamera();
  const imageA = buildImage({ imageId: 1, cameraId: camera.cameraId });
  const imageB = buildImage({ imageId: 2, cameraId: camera.cameraId });
  const point = buildPoint3D({
    point3DId: 9n,
    error: 0.5,
    track: [
      { imageId: 1, point2DIdx: 0 },
      { imageId: 2, point2DIdx: 0 },
    ],
  });

  return {
    cameras: new Map([[camera.cameraId, camera]]),
    images: new Map([[imageA.imageId, imageA], [imageB.imageId, imageB]]),
    points3D: new Map([[point.point3DId, point]]),
    ...createEmptyImageStatsResult(),
    statsPending: true,
  };
}

describe('ensureReconstructionStats', () => {
  beforeEach(() => {
    useReconstructionStore.setState({
      reconstruction: null,
      wasmReconstruction: null,
      urlProgress: null,
    });
  });

  it('resolves as a no-op without a pending reconstruction', async () => {
    await expect(ensureReconstructionStats()).resolves.toBeUndefined();
    expect(areReconstructionStatsPending()).toBe(false);
  });

  it('computes deferred stats from the points3D map and clears the pending flag', async () => {
    useReconstructionStore.setState({ reconstruction: buildPendingReconstruction() });
    expect(areReconstructionStatsPending()).toBe(true);

    await ensureReconstructionStats();

    const reconstruction = useReconstructionStore.getState().reconstruction!;
    expect(reconstruction.statsPending).toBe(false);
    expect(reconstruction.imageStats.get(1)?.numPoints3D).toBe(1);
    expect(reconstruction.connectedImagesIndex.get(1)?.get(2)).toBe(1);
    expect(reconstruction.imageToPoint3DIds.get(2)?.has(9n)).toBe(true);
    expect(reconstruction.globalStats.totalPoints).toBe(1);
    // The transient background progress card is cleared when the pass ends.
    expect(useReconstructionStore.getState().urlProgress).toBeNull();
  });

  it('drops a stale result when the reconstruction changed mid-pass', async () => {
    const original = buildPendingReconstruction();
    useReconstructionStore.setState({ reconstruction: original });

    const pass = ensureReconstructionStats();
    const replacement = buildPendingReconstruction();
    useReconstructionStore.setState({ reconstruction: replacement });
    await pass;

    expect(useReconstructionStore.getState().reconstruction).toBe(replacement);
    expect(useReconstructionStore.getState().reconstruction?.statsPending).toBe(true);
  });
});
