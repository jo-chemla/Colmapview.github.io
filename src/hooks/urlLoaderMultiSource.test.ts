import { describe, expect, it, vi } from 'vitest';
import {
  getDatasetNamePrefixes,
  getMultiDatasetFilePlan,
  getMultiManifestUrlsFromSearch,
  loadMultiManifestSource,
} from './urlLoaderMultiSource';
import type { ColmapManifest } from '../types/manifest';
import { parseImagesBinary } from '../parsers/images';
import { CameraModelId } from '../types/cameraModelId';

const LE = true;

function buildCamerasBin(): ArrayBuffer {
  // One SIMPLE_PINHOLE camera, id 1.
  const buffer = new ArrayBuffer(8 + 4 + 4 + 8 + 8 + 3 * 8);
  const view = new DataView(buffer);
  view.setBigUint64(0, 1n, LE);
  view.setUint32(8, 1, LE);
  view.setInt32(12, CameraModelId.SIMPLE_PINHOLE, LE);
  view.setBigUint64(16, 10n, LE);
  view.setBigUint64(24, 10n, LE);
  return buffer;
}

function buildImagesBin(name: string, tz: number): ArrayBuffer {
  const nameBytes = new TextEncoder().encode(name);
  const buffer = new ArrayBuffer(8 + 64 + nameBytes.length + 1 + 8);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setBigUint64(0, 1n, LE);
  let o = 8;
  view.setUint32(o, 1, LE); o += 4; // image_id
  view.setFloat64(o, 1, LE); o += 8; // qw
  o += 3 * 8; // qx qy qz = 0
  o += 2 * 8; // tx ty = 0
  view.setFloat64(o, tz, LE); o += 8;
  view.setUint32(o, 1, LE); o += 4; // camera_id
  bytes.set(nameBytes, o); o += nameBytes.length;
  bytes[o++] = 0;
  view.setBigUint64(o, 0n, LE);
  return buffer;
}

function buildPoints3DBin(): ArrayBuffer {
  const buffer = new ArrayBuffer(8 + 51);
  const view = new DataView(buffer);
  view.setBigUint64(0, 1n, LE);
  view.setBigUint64(8, 7n, LE); // id; xyz/rgb/error/track_len stay zero
  return buffer;
}

/** jsdom's File lacks arrayBuffer(); stub just what the loader touches. */
function asFile(buffer: ArrayBuffer, name: string): File {
  return { name, arrayBuffer: async () => buffer } as unknown as File;
}

/** FileReader-based read for the real Files the loader creates (jsdom-safe). */
function readFileBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function makeManifest(baseUrl: string, overrides: Partial<ColmapManifest> = {}): ColmapManifest {
  return {
    version: 1,
    baseUrl,
    files: {
      cameras: 'sparse/0/cameras.bin',
      images: 'sparse/0/images.bin',
      points3D: 'sparse/0/points3D.bin',
    },
    ...overrides,
  };
}

describe('getMultiManifestUrlsFromSearch', () => {
  it('parses comma-separated, URL-encoded entries and deduplicates', () => {
    const search = `?urls=${encodeURIComponent('https://a.test/S4/manifest.json')},https://a.test/N4/manifest.json,https://a.test/N4/manifest.json`;
    expect(getMultiManifestUrlsFromSearch(search)).toEqual([
      'https://a.test/S4/manifest.json',
      'https://a.test/N4/manifest.json',
    ]);
  });

  it('drops malformed entries and returns [] without the param', () => {
    expect(getMultiManifestUrlsFromSearch('?urls=not-a-url,,https://a.test/m.json'))
      .toEqual(['https://a.test/m.json']);
    expect(getMultiManifestUrlsFromSearch('?url=https://a.test/m.json')).toEqual([]);
  });
});

describe('getDatasetNamePrefixes', () => {
  it('derives directory names and uniquifies collisions', () => {
    expect(getDatasetNamePrefixes([
      'https://a.test/S4/manifest.json',
      'https://a.test/N4/manifest.json',
      'https://b.test/S4/manifest.json',
    ])).toEqual(['S4', 'N4', 'S4-2']);
  });
});

describe('getMultiDatasetFilePlan', () => {
  it('prefers the preview slots and flags fallbacks', () => {
    const withPreviews = getMultiDatasetFilePlan(makeManifest('https://a.test/S4/', {
      posesPreview: 'sparse/0/poses-preview.bin',
      pointsPreview: 'sparse/0/points3D-preview.bin',
    }));
    expect(withPreviews).toEqual({
      cameras: 'sparse/0/cameras.bin',
      poses: 'sparse/0/poses-preview.bin',
      posesIsPreview: true,
      points: 'sparse/0/points3D-preview.bin',
      pointsIsPreview: true,
    });

    const withoutPreviews = getMultiDatasetFilePlan(makeManifest('https://a.test/N4/'));
    expect(withoutPreviews.poses).toBe('sparse/0/images.bin');
    expect(withoutPreviews.posesIsPreview).toBe(false);
    expect(withoutPreviews.pointsIsPreview).toBe(false);
  });

  it('rejects text-format models', () => {
    const manifest = makeManifest('https://a.test/T/', {
      files: { cameras: 'sparse/0/cameras.txt', images: 'sparse/0/images.txt', points3D: 'sparse/0/points3D.txt' },
    });
    expect(() => getMultiDatasetFilePlan(manifest)).toThrowError();
  });
});

describe('loadMultiManifestSource', () => {
  it('merges datasets, prefixes image names, and maps per-image URLs', async () => {
    const manifests: Record<string, ColmapManifest> = {
      'https://a.test/S4/manifest.json': makeManifest('https://a.test/S4/', {
        posesPreview: 'sparse/0/poses-preview.bin',
        pointsPreview: 'sparse/0/points3D-preview.bin',
        imagesPath: '../../Interior/S4/images/',
      }),
      'https://a.test/N4/manifest.json': makeManifest('https://a.test/N4/', {
        posesPreview: 'sparse/0/poses-preview.bin',
      }),
    };
    const fetchedPaths: string[] = [];
    const fetchFileImpl = async (baseUrl: string, path: string): Promise<File> => {
      fetchedPaths.push(`${baseUrl}${path}`);
      if (path.includes('cameras')) return asFile(buildCamerasBin(), 'cameras.bin');
      if (path.includes('poses')) {
        return asFile(
          buildImagesBin('DJI_0001.JPG', baseUrl.includes('/S4/') ? 1 : 2),
          'poses-preview.bin'
        );
      }
      return asFile(buildPoints3DBin(), 'points3D.bin');
    };

    const processFiles = vi.fn(async () => undefined);
    const setSourceInfo = vi.fn();
    const addNotification = vi.fn();
    const progress: string[] = [];

    const summary = await loadMultiManifestSource(
      ['https://a.test/S4/manifest.json', 'https://a.test/N4/manifest.json'],
      {
        fetchManifestImpl: async (url) => manifests[url],
        fetchFileImpl,
        processFiles,
        setSourceInfo,
        setUrlProgress: (p) => { if (p) progress.push(p.message); },
        addNotification,
        log: () => undefined,
      }
    );

    // Preview slots preferred over the full files.
    expect(fetchedPaths).toContain('https://a.test/S4/sparse/0/poses-preview.bin');
    expect(fetchedPaths).not.toContain('https://a.test/S4/sparse/0/images.bin');
    // N4 lacks a pointsPreview: full points3D fetched, with a warning.
    expect(fetchedPaths).toContain('https://a.test/N4/sparse/0/points3D.bin');
    expect(addNotification).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('N4: manifest has no pointsPreview'),
      expect.anything()
    );
    expect(addNotification).not.toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('posesPreview'),
      expect.anything()
    );

    // Merged files handed to the regular parse pipeline under the bin keys.
    expect(processFiles).toHaveBeenCalledTimes(1);
    const files = processFiles.mock.calls[0][0] as Map<string, File>;
    expect([...files.keys()].sort()).toEqual([
      'sparse/0/cameras.bin',
      'sparse/0/images.bin',
      'sparse/0/points3D.bin',
    ]);
    const mergedImages = parseImagesBinary(await readFileBuffer(files.get('sparse/0/images.bin')!));
    expect([...mergedImages.values()].map((image) => image.name).sort())
      .toEqual(['N4/DJI_0001.JPG', 'S4/DJI_0001.JPG']);

    // Per-image URLs point at each dataset's own images base.
    const imageNameToUrl = setSourceInfo.mock.calls[0][5] as Record<string, string>;
    expect(imageNameToUrl['S4/DJI_0001.JPG'])
      .toBe('https://a.test/S4/../../Interior/S4/images/DJI_0001.JPG');
    expect(imageNameToUrl['N4/DJI_0001.JPG'])
      .toBe('https://a.test/N4/images/DJI_0001.JPG');

    expect(summary.datasets.map((d) => ({ name: d.name, poses: d.poseCount, points: d.pointCount })))
      .toEqual([
        { name: 'S4', poses: 1, points: 1 },
        { name: 'N4', poses: 1, points: 1 },
      ]);
    expect(progress.some((message) => message.startsWith('Dataset 1/2'))).toBe(true);
    expect(progress.some((message) => message.startsWith('Dataset 2/2'))).toBe(true);
  });
});
