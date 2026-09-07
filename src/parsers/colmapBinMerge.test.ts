import { describe, expect, it } from 'vitest';
import {
  mergeCamerasBin,
  mergeColmapBinaryDatasets,
  mergeImagesBin,
  mergePoints3DBin,
} from './colmapBinMerge';
import { parseCamerasBinary } from './cameras';
import { parseImagesBinary } from './images';
import { parsePoints3DBinary } from './points3d';
import { CameraModelId } from '../types/cameraModelId';

const LE = true;

interface FabCamera { id: number; modelId: number; width: number; height: number; params: number[] }

function buildCamerasBin(cameras: FabCamera[]): ArrayBuffer {
  const size = 8 + cameras.reduce((sum, c) => sum + 4 + 4 + 8 + 8 + c.params.length * 8, 0);
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(cameras.length), LE);
  let o = 8;
  for (const camera of cameras) {
    view.setUint32(o, camera.id, LE); o += 4;
    view.setInt32(o, camera.modelId, LE); o += 4;
    view.setBigUint64(o, BigInt(camera.width), LE); o += 8;
    view.setBigUint64(o, BigInt(camera.height), LE); o += 8;
    for (const param of camera.params) { view.setFloat64(o, param, LE); o += 8; }
  }
  return buffer;
}

interface FabImage {
  id: number;
  qvec: [number, number, number, number];
  tvec: [number, number, number];
  cameraId: number;
  name: string;
  /** Fabricated observations (x, y, point3DId) — the merge must strip these. */
  points2D?: Array<[number, number, bigint]>;
}

function buildImagesBin(images: FabImage[]): ArrayBuffer {
  const encoder = new TextEncoder();
  const nameBytes = images.map((image) => encoder.encode(image.name));
  const size = 8 + images.reduce(
    (sum, image, i) => sum + 64 + nameBytes[i].length + 1 + 8 + (image.points2D?.length ?? 0) * 24,
    0
  );
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setBigUint64(0, BigInt(images.length), LE);
  let o = 8;
  for (const [i, image] of images.entries()) {
    view.setUint32(o, image.id, LE); o += 4;
    for (const q of image.qvec) { view.setFloat64(o, q, LE); o += 8; }
    for (const t of image.tvec) { view.setFloat64(o, t, LE); o += 8; }
    view.setUint32(o, image.cameraId, LE); o += 4;
    bytes.set(nameBytes[i], o); o += nameBytes[i].length;
    bytes[o++] = 0;
    const points2D = image.points2D ?? [];
    view.setBigUint64(o, BigInt(points2D.length), LE); o += 8;
    for (const [x, y, point3DId] of points2D) {
      view.setFloat64(o, x, LE); o += 8;
      view.setFloat64(o, y, LE); o += 8;
      view.setBigUint64(o, point3DId, LE); o += 8;
    }
  }
  return buffer;
}

interface FabPoint {
  id: bigint;
  xyz: [number, number, number];
  rgb: [number, number, number];
  error: number;
  /** Fabricated track (imageId, point2DIdx) — the merge must strip these. */
  track?: Array<[number, number]>;
}

function buildPoints3DBin(points: FabPoint[]): ArrayBuffer {
  const size = 8 + points.reduce((sum, p) => sum + 51 + (p.track?.length ?? 0) * 8, 0);
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(points.length), LE);
  let o = 8;
  for (const point of points) {
    view.setBigUint64(o, point.id, LE); o += 8;
    for (const x of point.xyz) { view.setFloat64(o, x, LE); o += 8; }
    for (const c of point.rgb) { view.setUint8(o, c); o += 1; }
    view.setFloat64(o, point.error, LE); o += 8;
    const track = point.track ?? [];
    view.setBigUint64(o, BigInt(track.length), LE); o += 8;
    for (const [imageId, idx] of track) {
      view.setUint32(o, imageId, LE); o += 4;
      view.setUint32(o, idx, LE); o += 4;
    }
  }
  return buffer;
}

describe('mergeCamerasBin', () => {
  it('offsets camera ids past the previous dataset and keeps records intact', () => {
    const a = buildCamerasBin([
      { id: 1, modelId: CameraModelId.PINHOLE, width: 100, height: 80, params: [50, 51, 50, 40] },
      { id: 3, modelId: CameraModelId.SIMPLE_RADIAL, width: 20, height: 10, params: [9, 10, 5, 0.1] },
    ]);
    const b = buildCamerasBin([
      { id: 1, modelId: CameraModelId.OPENCV, width: 640, height: 480, params: [1, 2, 3, 4, 5, 6, 7, 8] },
    ]);

    const merged = mergeCamerasBin([a, b]);
    expect(merged.counts).toEqual([2, 1]);
    expect(merged.idOffsets).toEqual([0, 4]); // 0, then maxId(3) + 1

    const cameras = parseCamerasBinary(merged.buffer);
    expect([...cameras.keys()].sort((x, y) => x - y)).toEqual([1, 3, 5]);
    expect(cameras.get(5)).toMatchObject({
      cameraId: 5,
      modelId: CameraModelId.OPENCV,
      width: 640,
      height: 480,
      params: [1, 2, 3, 4, 5, 6, 7, 8],
    });
    expect(cameras.get(1)?.params).toEqual([50, 51, 50, 40]);
  });

  it('rejects unknown camera models instead of walking misaligned bytes', () => {
    const bad = buildCamerasBin([{ id: 1, modelId: 99, width: 1, height: 1, params: [] }]);
    expect(() => mergeCamerasBin([bad])).toThrow(/unknown camera model id 99/);
  });
});

describe('mergeImagesBin', () => {
  it('offsets image and camera ids, prefixes names, and strips observations', () => {
    const a = buildImagesBin([
      {
        id: 1, qvec: [1, 0, 0, 0], tvec: [10, 20, 30], cameraId: 1, name: 'DJI_0001.JPG',
        points2D: [[5.5, 6.5, 42n], [7.5, 8.5, 43n]],
      },
      { id: 7, qvec: [0.5, 0.5, 0.5, 0.5], tvec: [-1, -2, -3], cameraId: 3, name: 'DJI_0002.JPG' },
    ]);
    const b = buildImagesBin([
      { id: 1, qvec: [0, 1, 0, 0], tvec: [4, 5, 6], cameraId: 1, name: 'DJI_0001.JPG' },
    ]);

    const merged = mergeImagesBin([
      { buffer: a, namePrefix: 'S4', cameraIdOffset: 0 },
      { buffer: b, namePrefix: 'N4', cameraIdOffset: 4 },
    ]);
    expect(merged.counts).toEqual([2, 1]);
    expect(merged.idOffsets).toEqual([0, 8]); // 0, then maxId(7) + 1
    expect(merged.names).toEqual([['DJI_0001.JPG', 'DJI_0002.JPG'], ['DJI_0001.JPG']]);

    const images = parseImagesBinary(merged.buffer);
    expect([...images.keys()].sort((x, y) => x - y)).toEqual([1, 7, 9]);
    expect(images.get(1)).toMatchObject({
      cameraId: 1,
      name: 'S4/DJI_0001.JPG',
      qvec: [1, 0, 0, 0],
      tvec: [10, 20, 30],
    });
    expect(images.get(1)?.points2D).toEqual([]); // observations stripped
    expect(images.get(9)).toMatchObject({
      cameraId: 5, // 1 + camera offset 4
      name: 'N4/DJI_0001.JPG',
      tvec: [4, 5, 6],
    });
  });

  it('keeps names untouched when the prefix is empty', () => {
    const a = buildImagesBin([
      { id: 1, qvec: [1, 0, 0, 0], tvec: [0, 0, 0], cameraId: 1, name: 'img.png' },
    ]);
    const merged = mergeImagesBin([{ buffer: a, namePrefix: '', cameraIdOffset: 0 }]);
    expect(parseImagesBinary(merged.buffer).get(1)?.name).toBe('img.png');
  });
});

describe('mergePoints3DBin', () => {
  it('offsets u64 point ids and strips tracks', () => {
    const a = buildPoints3DBin([
      { id: 1n, xyz: [1, 2, 3], rgb: [255, 0, 0], error: 0.5, track: [[1, 0], [7, 3]] },
      { id: 10n, xyz: [4, 5, 6], rgb: [0, 255, 0], error: 1.25 },
    ]);
    const b = buildPoints3DBin([
      { id: 2n, xyz: [-1, -2, -3], rgb: [0, 0, 255], error: 2 },
    ]);

    const merged = mergePoints3DBin([a, b]);
    expect(merged.counts).toEqual([2, 1]);
    expect(merged.idOffsets).toEqual([0n, 11n]); // 0, then maxId(10) + 1

    const points = parsePoints3DBinary(merged.buffer);
    expect([...points.keys()].sort((x, y) => (x < y ? -1 : 1))).toEqual([1n, 10n, 13n]);
    expect(points.get(1n)).toMatchObject({ xyz: [1, 2, 3], rgb: [255, 0, 0], error: 0.5 });
    expect(points.get(1n)?.track).toEqual([]); // tracks stripped
    expect(points.get(13n)).toMatchObject({ xyz: [-1, -2, -3], rgb: [0, 0, 255], error: 2 });
  });
});

describe('mergeColmapBinaryDatasets', () => {
  it('produces a consistent merged model with per-dataset counts and names', () => {
    const s4 = {
      cameras: buildCamerasBin([
        { id: 1, modelId: CameraModelId.SIMPLE_PINHOLE, width: 10, height: 10, params: [5, 5, 5] },
      ]),
      images: buildImagesBin([
        { id: 1, qvec: [1, 0, 0, 0], tvec: [0, 0, 0], cameraId: 1, name: 'a.jpg' },
        { id: 2, qvec: [1, 0, 0, 0], tvec: [1, 1, 1], cameraId: 1, name: 'b.jpg' },
      ]),
      points3D: buildPoints3DBin([
        { id: 5n, xyz: [0, 0, 0], rgb: [1, 2, 3], error: 0 },
      ]),
      namePrefix: 'S4',
    };
    const n4 = {
      cameras: buildCamerasBin([
        { id: 1, modelId: CameraModelId.SIMPLE_PINHOLE, width: 20, height: 20, params: [9, 9, 9] },
      ]),
      images: buildImagesBin([
        { id: 1, qvec: [1, 0, 0, 0], tvec: [2, 2, 2], cameraId: 1, name: 'a.jpg' },
      ]),
      points3D: buildPoints3DBin([
        { id: 5n, xyz: [9, 9, 9], rgb: [4, 5, 6], error: 1 },
      ]),
      namePrefix: 'N4',
    };

    const merged = mergeColmapBinaryDatasets([s4, n4]);
    expect(merged.cameraCounts).toEqual([1, 1]);
    expect(merged.imageCounts).toEqual([2, 1]);
    expect(merged.pointCounts).toEqual([1, 1]);
    expect(merged.imageNames).toEqual([['a.jpg', 'b.jpg'], ['a.jpg']]);

    const cameras = parseCamerasBinary(merged.cameras);
    const images = parseImagesBinary(merged.images);
    const points = parsePoints3DBinary(merged.points3D);
    expect(cameras.size).toBe(2);
    expect(images.size).toBe(3);
    expect(points.size).toBe(2);
    // Every merged image references an existing merged camera.
    for (const image of images.values()) {
      expect(cameras.has(image.cameraId)).toBe(true);
    }
    const namesByImage = [...images.values()].map((image) => image.name).sort();
    expect(namesByImage).toEqual(['N4/a.jpg', 'S4/a.jpg', 'S4/b.jpg']);
  });
});
