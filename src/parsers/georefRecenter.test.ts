import { describe, expect, it } from 'vitest';
import type { Image, Point3D } from '../types/colmap';
import { buildReadableBinaryFile, readBlobAsArrayBuffer } from '../test/builders/fileFakes';
import { writeImagesBinary, writePoints3DBinary } from './colmapBinaryWriters';
import { parseImagesBinary } from './images';
import { parsePoints3DBinary } from './points3d';
import {
  GEOREF_RECENTER_THRESHOLD,
  computeImageMapCameraCentroid,
  computeImagesBinaryCameraCentroid,
  getGeorefRecenterOffset,
  maybeRecenterColmapBinaryFiles,
  recenterImageMap,
  recenterImagesBinary,
  recenterPoints3DBinary,
  recenterPoints3DMap,
  type GeorefOffset,
} from './georefRecenter';

/** Camera center C = -R(q)^T t computed with three.js-free reference math. */
function centerOf(qvec: readonly number[], tvec: readonly number[]): [number, number, number] {
  const [w, x, y, z] = qvec;
  // Rotation matrix R from (w,x,y,z), then C = -R^T t
  const r = [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
  return [
    -(r[0][0] * tvec[0] + r[1][0] * tvec[1] + r[2][0] * tvec[2]),
    -(r[0][1] * tvec[0] + r[1][1] * tvec[1] + r[2][1] * tvec[2]),
    -(r[0][2] * tvec[0] + r[1][2] * tvec[1] + r[2][2] * tvec[2]),
  ];
}

function normalizeQuat(q: [number, number, number, number]): [number, number, number, number] {
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** tvec for a camera whose world CENTER is `center`: t = -R * center. */
function tvecForCenter(qvec: readonly number[], center: readonly number[]): [number, number, number] {
  const [w, x, y, z] = qvec;
  const r = [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
  return [
    -(r[0][0] * center[0] + r[0][1] * center[1] + r[0][2] * center[2]),
    -(r[1][0] * center[0] + r[1][1] * center[1] + r[1][2] * center[2]),
    -(r[2][0] * center[0] + r[2][1] * center[1] + r[2][2] * center[2]),
  ];
}

// UTM33-magnitude world frame like the RealityScan-exported Vatican datasets.
const BASE: GeorefOffset = [504321.75, 4645678.25, 132.5];

function buildGeorefImages(): Map<number, Image> {
  const q1 = normalizeQuat([0.9, 0.1, -0.2, 0.3]);
  const q2 = normalizeQuat([0.7, -0.3, 0.5, 0.1]);
  const images = new Map<number, Image>();
  images.set(1, {
    imageId: 1,
    qvec: q1,
    tvec: tvecForCenter(q1, [BASE[0] + 2, BASE[1] - 3, BASE[2] + 1]),
    cameraId: 1,
    name: 'a.jpg',
    points2D: [{ xy: [10.5, 20.5], point3DId: 7n }],
  });
  images.set(2, {
    imageId: 2,
    qvec: q2,
    tvec: tvecForCenter(q2, [BASE[0] - 4, BASE[1] + 5, BASE[2] - 2]),
    cameraId: 1,
    name: 'b.jpg',
    points2D: [],
  });
  return images;
}

function buildGeorefPoints(): Map<bigint, Point3D> {
  const points = new Map<bigint, Point3D>();
  points.set(7n, {
    point3DId: 7n,
    xyz: [BASE[0] + 1.25, BASE[1] - 0.5, BASE[2] + 3.75],
    rgb: [10, 20, 30],
    error: 0.5,
    track: [{ imageId: 1, point2DIdx: 0 }],
  });
  points.set(8n, {
    point3DId: 8n,
    xyz: [BASE[0] - 2.5, BASE[1] + 1.5, BASE[2] - 1.25],
    rgb: [40, 50, 60],
    error: 1.5,
    track: [],
  });
  return points;
}

describe('georefRecenter', () => {
  it('computes the camera-center centroid from images.bin bytes in double precision', () => {
    const images = buildGeorefImages();
    const buffer = writeImagesBinary(images);
    const centroid = computeImagesBinaryCameraCentroid(buffer)!;
    // Mean of the two constructed centers: BASE + [-1, 1, -0.5]
    expect(centroid[0]).toBeCloseTo(BASE[0] - 1, 6);
    expect(centroid[1]).toBeCloseTo(BASE[1] + 1, 6);
    expect(centroid[2]).toBeCloseTo(BASE[2] - 0.5, 6);
    // Map path computes the identical centroid
    const mapCentroid = computeImageMapCameraCentroid(images)!;
    expect(mapCentroid[0]).toBeCloseTo(centroid[0], 6);
    expect(mapCentroid[1]).toBeCloseTo(centroid[1], 6);
    expect(mapCentroid[2]).toBeCloseTo(centroid[2], 6);
  });

  it('only offers an offset above the threshold, rounded to whole units', () => {
    expect(getGeorefRecenterOffset(null)).toBeNull();
    expect(getGeorefRecenterOffset([12.3, -45.6, 7.8])).toBeNull();
    expect(getGeorefRecenterOffset([GEOREF_RECENTER_THRESHOLD, 0, 0])).toBeNull();
    expect(getGeorefRecenterOffset([504320.75, 4645679.25, 132])).toEqual([504321, 4645679, 132]);
    expect(getGeorefRecenterOffset([0, -4645679.25, 0])).toEqual([0, -4645679, 0]);
  });

  it('shifts points and camera centers by exactly the same world offset (binary in-place)', () => {
    const images = buildGeorefImages();
    const points = buildGeorefPoints();
    const imagesBuffer = writeImagesBinary(images);
    const pointsBuffer = writePoints3DBinary(points);
    const offset = getGeorefRecenterOffset(computeImagesBinaryCameraCentroid(imagesBuffer))!;

    recenterImagesBinary(imagesBuffer, offset);
    recenterPoints3DBinary(pointsBuffer, offset);

    const shiftedImages = parseImagesBinary(imagesBuffer);
    const shiftedPoints = parsePoints3DBinary(pointsBuffer);

    // Camera centers moved by exactly -offset; rotations untouched.
    for (const [id, original] of images) {
      const shifted = shiftedImages.get(id)!;
      expect(shifted.qvec).toEqual(original.qvec);
      const c0 = centerOf(original.qvec, original.tvec);
      const c1 = centerOf(shifted.qvec, shifted.tvec);
      expect(c1[0]).toBeCloseTo(c0[0] - offset[0], 6);
      expect(c1[1]).toBeCloseTo(c0[1] - offset[1], 6);
      expect(c1[2]).toBeCloseTo(c0[2] - offset[2], 6);
      // Recentered coordinates are small: safely inside Float32 precision.
      expect(Math.max(...c1.map(Math.abs))).toBeLessThan(1e3);
    }

    // Points moved by exactly -offset (double-precision exact for integer offsets).
    for (const [id, original] of points) {
      const shifted = shiftedPoints.get(id)!;
      expect(shifted.xyz[0]).toBe(original.xyz[0] - offset[0]);
      expect(shifted.xyz[1]).toBe(original.xyz[1] - offset[1]);
      expect(shifted.xyz[2]).toBe(original.xyz[2] - offset[2]);
      expect(shifted.rgb).toEqual(original.rgb);
      expect(shifted.error).toBe(original.error);
      expect(shifted.track).toEqual(original.track);
    }

    // Point-to-camera relative geometry is preserved to double precision
    // (float64 rounding of R·c at UTM magnitude is ~5e-10 m: sub-nanometer).
    const p0 = points.get(7n)!.xyz;
    const p1 = shiftedPoints.get(7n)!.xyz;
    const cam0 = centerOf(images.get(1)!.qvec, images.get(1)!.tvec);
    const cam1 = centerOf(shiftedImages.get(1)!.qvec, shiftedImages.get(1)!.tvec);
    for (let axis = 0; axis < 3; axis++) {
      expect(p1[axis] - cam1[axis]).toBeCloseTo(p0[axis] - cam0[axis], 8);
    }

    // 2D observations (image-plane coords) are untouched.
    expect(shiftedImages.get(1)!.points2D[0].xy).toEqual([10.5, 20.5]);
  });

  it('applies the identical shift on the parsed-map (JS/text) path', () => {
    const images = buildGeorefImages();
    const points = buildGeorefPoints();
    const originalCenter = centerOf(images.get(2)!.qvec, images.get(2)!.tvec);
    const offset = getGeorefRecenterOffset(computeImageMapCameraCentroid(images))!;

    recenterImageMap(images, offset);
    recenterPoints3DMap(points, offset);

    const shiftedCenter = centerOf(images.get(2)!.qvec, images.get(2)!.tvec);
    expect(shiftedCenter[0]).toBeCloseTo(originalCenter[0] - offset[0], 6);
    expect(shiftedCenter[1]).toBeCloseTo(originalCenter[1] - offset[1], 6);
    expect(shiftedCenter[2]).toBeCloseTo(originalCenter[2] - offset[2], 6);
    expect(points.get(8n)!.xyz[0]).toBe(BASE[0] - 2.5 - offset[0]);
  });

  it('recenters Files when needed and leaves near-origin models untouched', async () => {
    const georefImages = writeImagesBinary(buildGeorefImages());
    const georefPoints = writePoints3DBinary(buildGeorefPoints());
    const result = await maybeRecenterColmapBinaryFiles({
      imagesFile: buildReadableBinaryFile({ name: 'images.bin', contents: new Uint8Array(georefImages) }),
      points3DFile: buildReadableBinaryFile({ name: 'points3D.bin', contents: new Uint8Array(georefPoints) }),
    });
    expect(result).not.toBeNull();
    expect(result!.imagesFile.name).toBe('images.bin');
    expect(result!.points3DFile.name).toBe('points3D.bin');
    expect(result!.offset).toEqual([Math.round(BASE[0] - 1), Math.round(BASE[1] + 1), Math.round(BASE[2] - 0.5)]);
    const reparsed = parsePoints3DBinary(await readBlobAsArrayBuffer(result!.points3DFile));
    expect(Math.abs(reparsed.get(7n)!.xyz[0])).toBeLessThan(1e3);

    // Local-frame model: byte-identical no-op.
    const localImages = new Map<number, Image>([[1, {
      imageId: 1,
      qvec: [1, 0, 0, 0],
      tvec: [1.5, -2.5, 3.5],
      cameraId: 1,
      name: 'local.jpg',
      points2D: [],
    }]]);
    const noop = await maybeRecenterColmapBinaryFiles({
      imagesFile: buildReadableBinaryFile({ name: 'images.bin', contents: new Uint8Array(writeImagesBinary(localImages)) }),
      points3DFile: buildReadableBinaryFile({ name: 'points3D.bin', contents: new Uint8Array(writePoints3DBinary(new Map())) }),
    });
    expect(noop).toBeNull();
  });

  it('handles the progressive zero-point points3D stub (stage 1) with the same offset as stage 2', async () => {
    const imagesBuffer = writeImagesBinary(buildGeorefImages());
    // Stage 1: empty stub (lone uint64 zero count), stage 2: real points.
    const stub = await maybeRecenterColmapBinaryFiles({
      imagesFile: buildReadableBinaryFile({ name: 'images.bin', contents: new Uint8Array(imagesBuffer) }),
      points3DFile: buildReadableBinaryFile({ name: 'points3D.bin', contents: new Uint8Array(8) }),
    });
    const real = await maybeRecenterColmapBinaryFiles({
      imagesFile: buildReadableBinaryFile({ name: 'images.bin', contents: new Uint8Array(imagesBuffer) }),
      points3DFile: buildReadableBinaryFile({ name: 'points3D.bin', contents: new Uint8Array(writePoints3DBinary(buildGeorefPoints())) }),
    });
    // Offset derives from the cameras only, so both stages recenter identically
    // and the live scene cannot jump when background points swap in.
    expect(stub!.offset).toEqual(real!.offset);
  });
});
