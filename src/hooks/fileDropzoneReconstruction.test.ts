import { describe, expect, it, vi } from 'vitest';
import {
  buildCamera,
  buildFile,
  buildImage,
  buildPoint3D,
  buildRigData,
  buildWasmReconstructionWrapper,
} from '../test/builders';
import type { RigData } from '../types/rig';
import {
  buildColmapReconstruction,
  getColmapPointCount,
} from './fileDropzoneReconstruction';

function createRigData(): RigData {
  return buildRigData({ rigs: [], frames: [] });
}

describe('file dropzone reconstruction builder', () => {
  it('builds JS-parser reconstructions with deferred (empty) stats and optional rig data', async () => {
    const camera = buildCamera();
    const image = buildImage({ imageId: 7, cameraId: camera.cameraId });
    const point = buildPoint3D({ point3DId: 9n });
    const cameras = new Map([[camera.cameraId, camera]]);
    const images = new Map([[image.imageId, image]]);
    const points3D = new Map([[point.point3DId, point]]);
    const rigData = createRigData();
    const loadRigData = vi.fn(async () => rigData);
    const afterStatsComputed = vi.fn();
    const rigsFile = buildFile('rigs.txt');
    const framesFile = buildFile('frames.txt');

    const result = await buildColmapReconstruction({
      parseResult: {
        cameras,
        images,
        points3D,
        wasmWrapper: null,
        usedWasmPath: false,
      },
      rigsFile,
      framesFile,
      loadRigData,
      afterStatsComputed,
    });

    expect(afterStatsComputed.mock.invocationCallOrder[0]).toBeLessThan(
      loadRigData.mock.invocationCallOrder[0]
    );
    expect(loadRigData).toHaveBeenCalledWith({ wasmRigData: undefined, rigsFile, framesFile });
    expect(result.pointCount).toBe(1);
    expect(result.reconstruction).toMatchObject({
      cameras,
      images,
      points3D,
      rigData,
      statsPending: true,
    });
    expect(result.reconstruction.imageStats.size).toBe(0);
    expect(result.reconstruction.connectedImagesIndex.size).toBe(0);
    expect(result.reconstruction.imageToPoint3DIds.size).toBe(0);
    expect(result.reconstruction.globalStats.totalPoints).toBe(0);
  });

  it('builds WASM-parser reconstructions without materializing a points3D map', async () => {
    const camera = buildCamera();
    const image = buildImage({ cameraId: camera.cameraId });
    const cameras = new Map([[camera.cameraId, camera]]);
    const images = new Map([[image.imageId, image]]);
    const wasmRigData = createRigData();
    const wasmWrapper = buildWasmReconstructionWrapper({ pointCount: 42 });
    const loadRigData = vi.fn(async () => wasmRigData);

    const result = await buildColmapReconstruction({
      parseResult: {
        cameras,
        images,
        wasmRigData,
        wasmWrapper,
        usedWasmPath: true,
      },
      loadRigData,
    });

    expect(loadRigData).toHaveBeenCalledWith({
      wasmRigData,
      rigsFile: undefined,
      framesFile: undefined,
    });
    expect(result.pointCount).toBe(42);
    expect(result.reconstruction.points3D).toBeUndefined();
    expect(result.reconstruction.rigData).toBe(wasmRigData);
    expect(result.reconstruction.statsPending).toBe(true);
  });

  it('does not mark point-less reconstructions as stats-pending', async () => {
    const camera = buildCamera();
    const image = buildImage({ cameraId: camera.cameraId });

    const result = await buildColmapReconstruction({
      parseResult: {
        cameras: new Map([[camera.cameraId, camera]]),
        images: new Map([[image.imageId, image]]),
        points3D: new Map(),
        wasmWrapper: null,
        usedWasmPath: false,
      },
      loadRigData: vi.fn(async () => undefined),
    });

    expect(result.pointCount).toBe(0);
    expect(result.reconstruction.statsPending).toBe(false);
  });

  it('derives point counts from WASM first, then JS points, then zero', () => {
    expect(getColmapPointCount({
      wasmWrapper: buildWasmReconstructionWrapper({ pointCount: 5 }),
      points3D: new Map([[1n, buildPoint3D()]]),
    })).toBe(5);

    expect(getColmapPointCount({
      wasmWrapper: null,
      points3D: new Map([[1n, buildPoint3D()], [2n, buildPoint3D({ point3DId: 2n })]]),
    })).toBe(2);

    expect(getColmapPointCount({
      wasmWrapper: null,
      points3D: undefined,
    })).toBe(0);
  });
});
