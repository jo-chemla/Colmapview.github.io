import {
  parseCamerasBinary,
  parseCamerasText,
  parseImagesBinary,
  parseImagesText,
  parsePoints3DBinary,
  parsePointCloudPlyBuffer,
  parsePoints3DText,
  parseWithWasm,
} from '../parsers';
import type { SkippedCameraRecord } from '../parsers';
import {
  computeImageMapCameraCentroid,
  getGeorefRecenterOffset,
  maybeRecenterColmapBinaryFiles,
  recenterImageMap,
  recenterPoints3DMap,
  type GeorefOffset,
} from '../parsers/georefRecenter';
import type { Camera, Image as ColmapImage, Point3D } from '../types/colmap';
import { appLogger } from '../utils/logger';
import type { RigData } from '../types/rig';
import type { WasmReconstructionWrapper } from '../wasm';

export interface ColmapParserFiles {
  camerasFile: File;
  imagesFile: File;
  points3DFile: File;
  rigsFile?: File;
  framesFile?: File;
}

export interface ColmapParseResult {
  cameras: Map<number, Camera>;
  images: Map<number, ColmapImage>;
  points3D?: Map<bigint, Point3D>;
  wasmRigData?: RigData;
  wasmWrapper: WasmReconstructionWrapper | null;
  usedWasmPath: boolean;
  /**
   * World offset subtracted from all positions when a georeferenced model
   * (UTM-magnitude coordinates) was recentered to preserve Float32 precision.
   * original world coordinate = parsed coordinate + georefOffset.
   */
  georefOffset: GeorefOffset | null;
}

export interface ColmapParserDeps {
  parseWithWasm: typeof parseWithWasm;
  parseCamerasBinary: typeof parseCamerasBinary;
  parseCamerasText: typeof parseCamerasText;
  parseImagesBinary: typeof parseImagesBinary;
  parseImagesText: typeof parseImagesText;
  parsePoints3DBinary: typeof parsePoints3DBinary;
  parsePointCloudPlyBuffer: typeof parsePointCloudPlyBuffer;
  parsePoints3DText: typeof parsePoints3DText;
}

interface ParseColmapFilesOptions extends ColmapParserFiles {
  parsers?: ColmapParserDeps;
  addNotification: (type: 'info' | 'warning', message: string, duration?: number) => void;
  log?: (message: string) => void;
}

const defaultParsers: ColmapParserDeps = {
  parseWithWasm,
  parseCamerasBinary,
  parseCamerasText,
  parseImagesBinary,
  parseImagesText,
  parsePoints3DBinary,
  parsePointCloudPlyBuffer,
  parsePoints3DText,
};

export async function parseColmapFiles({
  camerasFile,
  imagesFile,
  points3DFile,
  rigsFile,
  framesFile,
  parsers = defaultParsers,
  addNotification,
  log = appLogger.info,
}: ParseColmapFilesOptions): Promise<ColmapParseResult> {
  // Georeferenced models (UTM-magnitude float64 coordinates) must be
  // recentered BEFORE parsing: every parse path downstream converts positions
  // to float32 (the WASM parser stores float32 internally), where ~5e5-scale
  // coordinates quantize to 0.03-0.5 m banding. Rewriting the float64 bytes in
  // place shifts points and camera poses by the same world offset, so poses
  // and points stay exactly consistent. Skipped when rig/frame files are
  // present: frames.bin carries additional world-frame poses this pass does
  // not rewrite, and a partial shift would tear rigs away from the model.
  let georefOffset: GeorefOffset | null = null;
  const canRecenterBinary =
    imagesFile.name.endsWith('.bin')
    && points3DFile.name.endsWith('.bin')
    && !rigsFile
    && !framesFile;
  if (canRecenterBinary) {
    try {
      const recentered = await maybeRecenterColmapBinaryFiles({ imagesFile, points3DFile });
      if (recentered) {
        ({ imagesFile, points3DFile } = recentered);
        georefOffset = recentered.offset;
        log(`[Georef] Large coordinates detected — recentered by [${georefOffset.join(', ')}] to preserve Float32 precision`);
      }
    } catch (err) {
      appLogger.warn('[Georef] Recentering pre-pass failed, parsing original coordinates:', err);
    }
  }

  log('[Parser] Attempting WASM parser (memory-optimized)...');
  const wasmResult = await parsers.parseWithWasm(
    camerasFile,
    imagesFile,
    points3DFile,
    rigsFile,
    framesFile
  );

  if (wasmResult) {
    addNotification(
      'info',
      `Loaded ${wasmResult.wasmWrapper.pointCount.toLocaleString()} points`,
      5000
    );

    return {
      cameras: wasmResult.cameras,
      images: wasmResult.images,
      wasmRigData: wasmResult.rigData,
      wasmWrapper: wasmResult.wasmWrapper,
      usedWasmPath: true,
      georefOffset,
    };
  }

  log('[Parser] WASM failed, falling back to JS parser (without 2D points)');
  const useLiteImages = imagesFile.name.endsWith('.bin');

  // Unknown-model cameras in cameras.txt are skipped (partial loads stay
  // useful); collect them so we can surface a single aggregate notification.
  const skippedCameras: SkippedCameraRecord[] = [];

  const [cameras, images, points3D] = await Promise.all([
    camerasFile.name.endsWith('.bin')
      ? camerasFile.arrayBuffer().then(parsers.parseCamerasBinary)
      : camerasFile.text().then(text =>
          parsers.parseCamerasText(text, { onSkip: record => skippedCameras.push(record) })
        ),
    imagesFile.name.endsWith('.bin')
      ? imagesFile.arrayBuffer().then(buf => parsers.parseImagesBinary(buf, true))
      : imagesFile.text().then(parsers.parseImagesText),
    points3DFile.name.endsWith('.bin')
      ? points3DFile.arrayBuffer().then(parsers.parsePoints3DBinary)
      : points3DFile.name.toLowerCase().endsWith('.ply')
      ? points3DFile.arrayBuffer().then(parsers.parsePointCloudPlyBuffer)
      : points3DFile.text().then(parsers.parsePoints3DText),
  ]);

  // Text-format (and PLY-backed) models never went through the binary
  // recentering pre-pass; apply the same world shift to the parsed maps in
  // float64 (exact) so georeferenced text models get identical treatment.
  // After a binary pre-pass georefOffset is already set (or the centroid is
  // near zero), so this cannot double-shift.
  if (!georefOffset && !rigsFile && !framesFile) {
    const mapOffset = getGeorefRecenterOffset(computeImageMapCameraCentroid(images));
    if (mapOffset) {
      recenterImageMap(images, mapOffset);
      recenterPoints3DMap(points3D, mapOffset);
      georefOffset = mapOffset;
      log(`[Georef] Large coordinates detected — recentered by [${mapOffset.join(', ')}] to preserve Float32 precision`);
    }
  }

  if (skippedCameras.length > 0) {
    const uniqueModels = [...new Set(skippedCameras.map(s => s.modelName))];
    addNotification(
      'warning',
      `Skipped ${skippedCameras.length} camera(s) with unsupported model(s): ${uniqueModels.join(', ')}`
    );
  }

  if (useLiteImages) {
    addNotification(
      'info',
      '2D point data not loaded. Keypoint overlay may be limited.',
      5000
    );
  }

  return {
    cameras,
    images,
    points3D,
    wasmWrapper: null,
    usedWasmPath: false,
    georefOffset,
  };
}
