/**
 * File-level merge of several COLMAP binary datasets into one model.
 *
 * Multi-dataset loading (?urls=) concatenates cameras.bin / images.bin /
 * points3D.bin records from N datasets BEFORE any parser runs — far cheaper
 * than teaching the single-reconstruction stores about multiple models. Only
 * three id spaces need rewriting (camera_id, image_id, point3D_id, each with a
 * per-dataset offset); observations and tracks are STRIPPED from the merged
 * output (n2d = 0, track_len = 0), so there are no cross-file references left
 * to fix. That matches the decimated preview files this mode is designed for
 * (posesPreview / pointsPreview already ship with zeroed observations), and
 * when a dataset falls back to its full files the stats/tracks features simply
 * stay zeroed — the same accepted behavior previews have today.
 *
 * Image names are namespaced as `${prefix}/${name}` during the rebuild so
 * datasets with identical filenames (DJI_0001.JPG in both rigs) stay distinct
 * in the gallery and in per-image URL resolution.
 *
 * All id rewrites are plain integer adds done through DataView (u32) or BigInt
 * (u64) — never via float64 arithmetic that could lose precision.
 */

import { CameraModelId } from '../types/cameraModelId';
import { getCameraModelNumParams } from '../utils/cameraModelRegistry';

const LE = true; // COLMAP binaries are little-endian

const U32_MAX = 0xffffffff;

function isKnownCameraModelId(value: number): value is CameraModelId {
  return Object.values(CameraModelId).includes(value as CameraModelId);
}

/**
 * Per-dataset id offsets that keep merged ids unique: dataset k's ids are
 * shifted past the maximum id seen in datasets 0..k-1 (+1 so a 0-based id set
 * can never collide with the previous dataset's max).
 */
function nextIdOffset(currentOffset: number, maxIdSeen: number): number {
  return currentOffset + maxIdSeen + 1;
}

export interface MergedCamerasBin {
  buffer: ArrayBuffer;
  /** Cameras per input dataset, in input order. */
  counts: number[];
  /** camera_id offset applied to each input dataset (images.bin needs these). */
  idOffsets: number[];
}

/**
 * Concatenate cameras.bin buffers, rewriting camera_id with per-dataset
 * offsets. Record layout: u32 camera_id, i32 model_id, u64 width, u64 height,
 * f64[numParams(model)] — records are copied verbatim except the id.
 */
export function mergeCamerasBin(buffers: readonly ArrayBuffer[]): MergedCamerasBin {
  interface Record_ { start: number; length: number; cameraId: number }
  const perDataset: { records: Record_[]; bytes: Uint8Array }[] = [];
  let totalBodyBytes = 0;
  let totalCameras = 0;

  for (const [datasetIndex, buffer] of buffers.entries()) {
    const view = new DataView(buffer);
    const numCameras = Number(view.getBigUint64(0, LE));
    const records: Record_[] = [];
    let o = 8;
    for (let i = 0; i < numCameras; i++) {
      const start = o;
      const cameraId = view.getUint32(o, LE);
      const modelId = view.getInt32(o + 4, LE);
      if (!isKnownCameraModelId(modelId)) {
        throw new Error(
          `Cannot merge cameras.bin of dataset ${datasetIndex + 1}: unknown camera model id ${modelId}`
        );
      }
      o += 4 + 4 + 8 + 8 + getCameraModelNumParams(modelId) * 8;
      records.push({ start, length: o - start, cameraId });
    }
    perDataset.push({ records, bytes: new Uint8Array(buffer) });
    totalBodyBytes += o - 8;
    totalCameras += numCameras;
  }

  const out = new ArrayBuffer(8 + totalBodyBytes);
  const outBytes = new Uint8Array(out);
  const outView = new DataView(out);
  outView.setBigUint64(0, BigInt(totalCameras), LE);

  const counts: number[] = [];
  const idOffsets: number[] = [];
  let offset = 0;
  let writePos = 8;
  for (const { records, bytes } of perDataset) {
    idOffsets.push(offset);
    counts.push(records.length);
    let maxId = -1;
    for (const record of records) {
      outBytes.set(bytes.subarray(record.start, record.start + record.length), writePos);
      const newId = record.cameraId + offset;
      if (newId > U32_MAX) {
        throw new Error(`Merged camera_id ${newId} exceeds uint32 range`);
      }
      outView.setUint32(writePos, newId, LE);
      writePos += record.length;
      if (record.cameraId > maxId) maxId = record.cameraId;
    }
    offset = nextIdOffset(offset, Math.max(maxId, 0));
  }

  return { buffer: out, counts, idOffsets };
}

export interface ImagesBinMergeInput {
  buffer: ArrayBuffer;
  /** Prepended to every image name as `${namePrefix}/`; '' keeps names as-is. */
  namePrefix: string;
  /** camera_id offset for this dataset (from mergeCamerasBin). */
  cameraIdOffset: number;
}

export interface MergedImagesBin {
  buffer: ArrayBuffer;
  /** Images per input dataset, in input order. */
  counts: number[];
  /** image_id offset applied to each input dataset. */
  idOffsets: number[];
  /** Per dataset: ORIGINAL (un-prefixed) image names in file order. */
  names: string[][];
}

/**
 * Concatenate images.bin buffers, rewriting image_id and camera_id with
 * per-dataset offsets and namespacing each image name as `${prefix}/${name}`.
 * Observations are stripped (num_points2D = 0): with tracks also stripped by
 * mergePoints3DBin there are no image<->point references left to remap.
 * Record layout: u32 image_id, f64[4] qvec, f64[3] tvec, u32 camera_id,
 * name\0, u64 num_points2D, num_points2D * (f64 x, f64 y, u64 point3D_id).
 */
export function mergeImagesBin(inputs: readonly ImagesBinMergeInput[]): MergedImagesBin {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const POSE_BYTES = 4 + 32 + 24 + 4; // image_id + qvec + tvec + camera_id

  interface Record_ {
    poseStart: number; // start of the fixed pose block (image_id)
    imageId: number;
    cameraId: number;
    nameBytes: Uint8Array;
    name: string;
  }
  const perDataset: { records: Record_[]; bytes: Uint8Array }[] = [];
  let totalImages = 0;
  let totalOutBytes = 8;

  for (const [datasetIndex, input] of inputs.entries()) {
    const view = new DataView(input.buffer);
    const bytes = new Uint8Array(input.buffer);
    const numImages = Number(view.getBigUint64(0, LE));
    const prefixBytes = input.namePrefix.length > 0
      ? encoder.encode(`${input.namePrefix}/`)
      : new Uint8Array(0);
    const records: Record_[] = [];
    let o = 8;
    for (let i = 0; i < numImages; i++) {
      const poseStart = o;
      const imageId = view.getUint32(o, LE);
      const cameraId = view.getUint32(o + 60, LE);
      o += POSE_BYTES;
      const nameStart = o;
      while (o < bytes.length && bytes[o] !== 0) o++;
      if (o >= bytes.length) {
        throw new Error(`Truncated images.bin in dataset ${datasetIndex + 1}`);
      }
      const originalNameBytes = bytes.subarray(nameStart, o);
      o++; // \0
      const numPoints2D = Number(view.getBigUint64(o, LE));
      o += 8 + numPoints2D * 24;
      const nameBytes = new Uint8Array(prefixBytes.length + originalNameBytes.length);
      nameBytes.set(prefixBytes, 0);
      nameBytes.set(originalNameBytes, prefixBytes.length);
      records.push({
        poseStart,
        imageId,
        cameraId,
        nameBytes,
        name: decoder.decode(originalNameBytes),
      });
      totalOutBytes += POSE_BYTES + nameBytes.length + 1 + 8; // n2d = 0, no observations
    }
    perDataset.push({ records, bytes });
    totalImages += numImages;
  }

  const out = new ArrayBuffer(totalOutBytes);
  const outBytes = new Uint8Array(out);
  const outView = new DataView(out);
  outView.setBigUint64(0, BigInt(totalImages), LE);

  const counts: number[] = [];
  const idOffsets: number[] = [];
  const names: string[][] = [];
  let imageIdOffset = 0;
  let writePos = 8;
  for (const [datasetIndex, { records, bytes }] of perDataset.entries()) {
    idOffsets.push(imageIdOffset);
    counts.push(records.length);
    const datasetNames: string[] = [];
    let maxId = -1;
    for (const record of records) {
      // Fixed pose block copied verbatim, then ids patched in place.
      outBytes.set(bytes.subarray(record.poseStart, record.poseStart + POSE_BYTES), writePos);
      const newImageId = record.imageId + imageIdOffset;
      const newCameraId = record.cameraId + inputs[datasetIndex].cameraIdOffset;
      if (newImageId > U32_MAX || newCameraId > U32_MAX) {
        throw new Error(`Merged image/camera id exceeds uint32 range in dataset ${datasetIndex + 1}`);
      }
      outView.setUint32(writePos, newImageId, LE);
      outView.setUint32(writePos + 60, newCameraId, LE);
      writePos += POSE_BYTES;
      outBytes.set(record.nameBytes, writePos);
      writePos += record.nameBytes.length;
      outBytes[writePos++] = 0;
      outView.setBigUint64(writePos, 0n, LE); // observations stripped
      writePos += 8;
      datasetNames.push(record.name);
      if (record.imageId > maxId) maxId = record.imageId;
    }
    names.push(datasetNames);
    imageIdOffset = nextIdOffset(imageIdOffset, Math.max(maxId, 0));
  }

  return { buffer: out, counts, idOffsets, names };
}

export interface MergedPoints3DBin {
  buffer: ArrayBuffer;
  /** Points per input dataset, in input order. */
  counts: number[];
  /** point3D_id offset applied to each input dataset. */
  idOffsets: bigint[];
}

/**
 * Concatenate points3D.bin buffers, rewriting point3D_id (u64, via BigInt)
 * with per-dataset offsets and stripping tracks (track_len = 0). Record
 * layout: u64 id, f64[3] xyz, u8[3] rgb, f64 error, u64 track_len,
 * track_len * (u32 image_id, u32 point2D_idx).
 */
export function mergePoints3DBin(buffers: readonly ArrayBuffer[]): MergedPoints3DBin {
  const RECORD_OUT_BYTES = 8 + 24 + 3 + 8 + 8; // id + xyz + rgb + error + track_len(0)
  const FIXED_IN_BYTES = 8 + 24 + 3 + 8; // record bytes before track_len

  interface Record_ { start: number; id: bigint }
  const perDataset: { records: Record_[]; bytes: Uint8Array }[] = [];
  let totalPoints = 0;

  for (const buffer of buffers) {
    const view = new DataView(buffer);
    const numPoints = Number(view.getBigUint64(0, LE));
    const records: Record_[] = [];
    let o = 8;
    for (let i = 0; i < numPoints; i++) {
      records.push({ start: o, id: view.getBigUint64(o, LE) });
      o += FIXED_IN_BYTES;
      const trackLength = Number(view.getBigUint64(o, LE));
      o += 8 + trackLength * 8;
    }
    perDataset.push({ records, bytes: new Uint8Array(buffer) });
    totalPoints += numPoints;
  }

  const out = new ArrayBuffer(8 + totalPoints * RECORD_OUT_BYTES);
  const outBytes = new Uint8Array(out);
  const outView = new DataView(out);
  outView.setBigUint64(0, BigInt(totalPoints), LE);

  const counts: number[] = [];
  const idOffsets: bigint[] = [];
  let idOffset = 0n;
  let writePos = 8;
  for (const { records, bytes } of perDataset) {
    idOffsets.push(idOffset);
    counts.push(records.length);
    let maxId = -1n;
    for (const record of records) {
      outBytes.set(bytes.subarray(record.start, record.start + FIXED_IN_BYTES), writePos);
      outView.setBigUint64(writePos, record.id + idOffset, LE);
      writePos += FIXED_IN_BYTES;
      outView.setBigUint64(writePos, 0n, LE); // tracks stripped
      writePos += 8;
      if (record.id > maxId) maxId = record.id;
    }
    idOffset = idOffset + (maxId > 0n ? maxId : 0n) + 1n;
  }

  return { buffer: out, counts, idOffsets };
}

export interface ColmapBinMergeInput {
  cameras: ArrayBuffer;
  images: ArrayBuffer;
  points3D: ArrayBuffer;
  /** Dataset namespace for image names (gallery shows `${namePrefix}/...`). */
  namePrefix: string;
}

export interface ColmapBinMergeResult {
  cameras: ArrayBuffer;
  images: ArrayBuffer;
  points3D: ArrayBuffer;
  cameraCounts: number[];
  imageCounts: number[];
  pointCounts: number[];
  /** Per dataset: ORIGINAL (un-prefixed) image names in file order. */
  imageNames: string[][];
}

/** Merge N binary COLMAP datasets into one consistent model (see module doc). */
export function mergeColmapBinaryDatasets(
  inputs: readonly ColmapBinMergeInput[]
): ColmapBinMergeResult {
  const cameras = mergeCamerasBin(inputs.map((input) => input.cameras));
  const images = mergeImagesBin(inputs.map((input, index) => ({
    buffer: input.images,
    namePrefix: input.namePrefix,
    cameraIdOffset: cameras.idOffsets[index],
  })));
  const points3D = mergePoints3DBin(inputs.map((input) => input.points3D));
  return {
    cameras: cameras.buffer,
    images: images.buffer,
    points3D: points3D.buffer,
    cameraCounts: cameras.counts,
    imageCounts: images.counts,
    pointCounts: points3D.counts,
    imageNames: images.names,
  };
}
