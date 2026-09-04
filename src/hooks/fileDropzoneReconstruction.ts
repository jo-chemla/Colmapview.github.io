import { createEmptyImageStatsResult } from '../parsers';
import type { Reconstruction } from '../types/colmap';
import type { ColmapParseResult } from './fileDropzoneColmapParser';
import { loadOptionalRigData } from './fileDropzoneRigData';

export interface BuildColmapReconstructionOptions {
  parseResult: ColmapParseResult;
  rigsFile?: File;
  framesFile?: File;
  loadRigData?: typeof loadOptionalRigData;
  afterStatsComputed?: () => void;
}

export interface BuildColmapReconstructionResult {
  reconstruction: Reconstruction;
  pointCount: number;
}

export async function buildColmapReconstruction({
  parseResult,
  rigsFile,
  framesFile,
  loadRigData = loadOptionalRigData,
  afterStatsComputed,
}: BuildColmapReconstructionOptions): Promise<BuildColmapReconstructionResult> {
  // Stats pass is DEFERRED: the default load is poses + points only. The
  // O(points x trackLength^2) statistics computation runs lazily via
  // ensureReconstructionStats() the first time a consumer needs it (stats
  // panels, matches view, selection highlight, gallery list view).
  const stats = createEmptyImageStatsResult();

  afterStatsComputed?.();

  const rigData = await loadRigData({
    wasmRigData: parseResult.wasmRigData,
    rigsFile,
    framesFile,
  });

  return {
    reconstruction: {
      cameras: parseResult.cameras,
      images: parseResult.images,
      ...(parseResult.points3D && { points3D: parseResult.points3D }),
      imageStats: stats.imageStats,
      connectedImagesIndex: stats.connectedImagesIndex,
      globalStats: stats.globalStats,
      imageToPoint3DIds: stats.imageToPoint3DIds,
      statsPending: getColmapPointCount(parseResult) > 0,
      rigData,
    },
    pointCount: getColmapPointCount(parseResult),
  };
}

export function getColmapPointCount({
  wasmWrapper,
  points3D,
}: Pick<ColmapParseResult, 'wasmWrapper' | 'points3D'>): number {
  return wasmWrapper?.pointCount ?? points3D?.size ?? 0;
}
