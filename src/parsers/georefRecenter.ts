/**
 * Georeferenced-reconstruction recentering.
 *
 * COLMAP bins store positions as float64, but every rendering path here ends in
 * Float32Array (the WASM parser even stores points as float32 internally). For
 * georeferenced models (UTM-magnitude coordinates, ~5e5/4.6e6 m) that float32
 * quantization is 0.03-0.5 m — visible as banding stripes in the point cloud
 * and jitter in camera frusta.
 *
 * Fix: before any parser runs, compute the camera-center centroid in DOUBLE
 * precision straight from the images.bin bytes, and — when it is large enough
 * to matter — rewrite the float64 world coordinates in place so the model is
 * centered near the origin BEFORE any double→float32 conversion happens:
 *
 *   points:  xyz' = xyz - c
 *   cameras: tvec' = tvec + R(qvec) · c     (world-to-cam: x_cam = R x + t)
 *
 * which shifts every camera center by exactly the same -c as the points
 * (C' = -Rᵀ tvec' = C - c), so poses and points can never diverge.
 *
 * The centroid comes from the CAMERAS (not the points) deliberately: the
 * progressive loader's stage 1 parses a zero-point points3D stub next to the
 * real images.bin, and stage 2 re-parses with the real points. Deriving the
 * offset from the (identical) images.bin bytes makes both stages recenter by
 * the exact same offset, so the already-live scene does not jump when the
 * background points swap in.
 *
 * The applied offset is surfaced on the Reconstruction (georefOffset) so the
 * original georeferenced frame can be displayed/exported later:
 * original = local + georefOffset.
 */

import type { Image, Point3D } from '../types/colmap';

export type GeorefOffset = [number, number, number];

/**
 * Only recenter when the camera centroid is farther out than this (meters).
 * Above 1e4 the float32 ulp passes 1 mm and keeps growing (0.06 m at UTM
 * northing magnitudes); below it quantization is invisible and ordinary
 * local reconstructions (coords ~1e0-1e3) are left byte-identical.
 */
export const GEOREF_RECENTER_THRESHOLD = 1e4;

const LE = true; // COLMAP binary files are little-endian

/** Rotate vector v by quaternion (w,x,y,z): computes R(q)·v. Assumes |q|≈1. */
function quatRotate(
  w: number, x: number, y: number, z: number,
  vx: number, vy: number, vz: number,
): GeorefOffset {
  // v' = v + w*t + u×t with t = 2(u×v)
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
}

/** Camera center C = -Rᵀ·t = rotate(-t) by conj(q). */
function cameraCenter(
  qw: number, qx: number, qy: number, qz: number,
  tx: number, ty: number, tz: number,
): GeorefOffset {
  return quatRotate(qw, -qx, -qy, -qz, -tx, -ty, -tz);
}

/**
 * Walk images.bin invoking `visit` once per image with the qvec/tvec doubles
 * and the byte offset of tvec (so callers can rewrite it in place).
 */
function walkImagesBinary(
  buffer: ArrayBuffer,
  visit: (
    qw: number, qx: number, qy: number, qz: number,
    tx: number, ty: number, tz: number,
    tvecByteOffset: number,
  ) => void,
): void {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const numImages = Number(view.getBigUint64(0, LE));
  let o = 8;
  for (let i = 0; i < numImages; i++) {
    o += 4; // image_id (uint32)
    const qw = view.getFloat64(o, LE);
    const qx = view.getFloat64(o + 8, LE);
    const qy = view.getFloat64(o + 16, LE);
    const qz = view.getFloat64(o + 24, LE);
    const tvecOffset = o + 32;
    const tx = view.getFloat64(tvecOffset, LE);
    const ty = view.getFloat64(tvecOffset + 8, LE);
    const tz = view.getFloat64(tvecOffset + 16, LE);
    o = tvecOffset + 24;
    o += 4; // camera_id (uint32)
    while (bytes[o] !== 0) o++; // name (null-terminated)
    o++;
    const numPoints2D = Number(view.getBigUint64(o, LE));
    o += 8 + numPoints2D * 24; // points2D: x f64, y f64, point3D_id u64
    visit(qw, qx, qy, qz, tx, ty, tz, tvecOffset);
  }
}

/** Mean camera center of images.bin, computed entirely in float64. */
export function computeImagesBinaryCameraCentroid(buffer: ArrayBuffer): GeorefOffset | null {
  let sx = 0, sy = 0, sz = 0, n = 0;
  walkImagesBinary(buffer, (qw, qx, qy, qz, tx, ty, tz) => {
    const [cx, cy, cz] = cameraCenter(qw, qx, qy, qz, tx, ty, tz);
    sx += cx; sy += cy; sz += cz; n++;
  });
  if (n === 0) return null;
  return [sx / n, sy / n, sz / n];
}

/** Mean camera center of a parsed images map (JS/text parser path). */
export function computeImageMapCameraCentroid(images: Map<number, Image>): GeorefOffset | null {
  let sx = 0, sy = 0, sz = 0, n = 0;
  for (const img of images.values()) {
    const [cx, cy, cz] = cameraCenter(
      img.qvec[0], img.qvec[1], img.qvec[2], img.qvec[3],
      img.tvec[0], img.tvec[1], img.tvec[2],
    );
    sx += cx; sy += cy; sz += cz; n++;
  }
  if (n === 0) return null;
  return [sx / n, sy / n, sz / n];
}

/**
 * The offset to subtract from world coordinates, or null when the model is
 * already near the origin. Rounded to whole meters so the stored georef
 * offset stays a clean, exactly-representable number.
 */
export function getGeorefRecenterOffset(centroid: GeorefOffset | null): GeorefOffset | null {
  if (!centroid) return null;
  if (Math.max(Math.abs(centroid[0]), Math.abs(centroid[1]), Math.abs(centroid[2])) <= GEOREF_RECENTER_THRESHOLD) {
    return null;
  }
  return [Math.round(centroid[0]), Math.round(centroid[1]), Math.round(centroid[2])];
}

/** In-place: tvec' = tvec + R(qvec)·offset for every image in images.bin. */
export function recenterImagesBinary(buffer: ArrayBuffer, offset: GeorefOffset): void {
  const view = new DataView(buffer);
  walkImagesBinary(buffer, (qw, qx, qy, qz, tx, ty, tz, tvecOffset) => {
    const [rx, ry, rz] = quatRotate(qw, qx, qy, qz, offset[0], offset[1], offset[2]);
    view.setFloat64(tvecOffset, tx + rx, LE);
    view.setFloat64(tvecOffset + 8, ty + ry, LE);
    view.setFloat64(tvecOffset + 16, tz + rz, LE);
  });
}

/** In-place: xyz' = xyz - offset for every point in points3D.bin. */
export function recenterPoints3DBinary(buffer: ArrayBuffer, offset: GeorefOffset): void {
  const view = new DataView(buffer);
  const numPoints = Number(view.getBigUint64(0, LE));
  let o = 8;
  for (let i = 0; i < numPoints; i++) {
    o += 8; // point3D_id (uint64)
    view.setFloat64(o, view.getFloat64(o, LE) - offset[0], LE);
    view.setFloat64(o + 8, view.getFloat64(o + 8, LE) - offset[1], LE);
    view.setFloat64(o + 16, view.getFloat64(o + 16, LE) - offset[2], LE);
    o += 24;
    o += 3; // rgb (3 x uint8)
    o += 8; // error (float64)
    const trackLength = Number(view.getBigUint64(o, LE));
    o += 8 + trackLength * 8; // track: image_id u32 + point2D_idx u32
  }
}

/** In-place map variant of recenterImagesBinary (JS/text parser path). */
export function recenterImageMap(images: Map<number, Image>, offset: GeorefOffset): void {
  for (const img of images.values()) {
    const [rx, ry, rz] = quatRotate(
      img.qvec[0], img.qvec[1], img.qvec[2], img.qvec[3],
      offset[0], offset[1], offset[2],
    );
    img.tvec[0] += rx;
    img.tvec[1] += ry;
    img.tvec[2] += rz;
  }
}

/** In-place map variant of recenterPoints3DBinary (JS/text parser path). */
export function recenterPoints3DMap(points3D: Map<bigint, Point3D>, offset: GeorefOffset): void {
  for (const point of points3D.values()) {
    point.xyz[0] -= offset[0];
    point.xyz[1] -= offset[1];
    point.xyz[2] -= offset[2];
  }
}

export interface RecenteredColmapBinaryFiles {
  imagesFile: File;
  points3DFile: File;
  offset: GeorefOffset;
}

/**
 * If the model's camera centroid is far from the origin, return Files whose
 * float64 world coordinates have been recentered (see module doc), plus the
 * applied offset. Returns null when no recentering is needed.
 *
 * Both the WASM parser and the JS binary fallback then parse the recentered
 * bytes, so the WASM-internal float32 conversion and the lazy 2D-point byte
 * offsets all see one consistent, small-coordinate model.
 */
export async function maybeRecenterColmapBinaryFiles({
  imagesFile,
  points3DFile,
}: {
  imagesFile: File;
  points3DFile: File;
}): Promise<RecenteredColmapBinaryFiles | null> {
  const imagesBuffer = await imagesFile.arrayBuffer();
  const offset = getGeorefRecenterOffset(computeImagesBinaryCameraCentroid(imagesBuffer));
  if (!offset) return null;

  const points3DBuffer = await points3DFile.arrayBuffer();
  recenterImagesBinary(imagesBuffer, offset);
  recenterPoints3DBinary(points3DBuffer, offset);

  return {
    imagesFile: new File([imagesBuffer], imagesFile.name),
    points3DFile: new File([points3DBuffer], points3DFile.name),
    offset,
  };
}
