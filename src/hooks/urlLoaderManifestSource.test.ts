import { describe, expect, it, vi } from 'vitest';
import { buildFile } from '../test/builders';
import type { ColmapManifest } from '../types/manifest';
import { loadManifestSource } from './urlLoaderManifestSource';

const manifest: ColmapManifest = {
  version: 1,
  name: 'test scene',
  baseUrl: 'https://example.com/dataset',
  files: {
    cameras: 'custom/cameras.bin',
    images: 'custom/images.bin',
    points3D: 'custom/points3D.bin',
  },
  imagesPath: 'rgb/',
  masksPath: 'segmentation/',
};

function makeFiles(): Map<string, File> {
  return new Map([
    ['sparse/0/cameras.bin', buildFile('cameras.bin')],
    ['sparse/0/images.bin', buildFile('images.bin')],
    ['sparse/0/points3D.bin', buildFile('points3D.bin')],
  ]);
}

function makeDeps(files = makeFiles()) {
  return {
    fetchColmapFiles: vi.fn(async () => files),
    log: vi.fn(),
    processFiles: vi.fn(async () => {}),
    setSourceInfo: vi.fn(),
    setUrlProgress: vi.fn(),
  };
}

describe('URL loader manifest source helpers', () => {
  it('loads a URL manifest source with lazy image/mask bases and processing progress', async () => {
    const files = makeFiles();
    const deps = makeDeps(files);

    await expect(loadManifestSource(manifest, {
      type: 'url',
      sourceUrl: 'https://example.com/manifest.json',
    }, deps)).resolves.toBe(true);

    expect(deps.fetchColmapFiles).toHaveBeenCalledWith(manifest);
    expect(deps.log).toHaveBeenCalledWith('[URL Loader] Downloaded 3 COLMAP files:', [
      'sparse/0/cameras.bin',
      'sparse/0/images.bin',
      'sparse/0/points3D.bin',
    ]);
    expect(deps.log).toHaveBeenCalledWith('[URL Loader] Skipping image download (images will be loaded lazily)');
    expect(deps.setUrlProgress).toHaveBeenNthCalledWith(1, {
      percent: 80,
      message: 'Parsing reconstruction...',
    });
    expect(deps.setSourceInfo).toHaveBeenCalledWith(
      'url',
      'https://example.com/manifest.json',
      'https://example.com/dataset/rgb/',
      'https://example.com/dataset/segmentation/',
      null,
      null
    );
    expect(deps.log).toHaveBeenCalledWith('[URL Loader] Image URL base for lazy loading: https://example.com/dataset/rgb/');
    expect(deps.log).toHaveBeenCalledWith('[URL Loader] Mask URL base for lazy loading: https://example.com/dataset/segmentation/');
    expect(deps.log).toHaveBeenCalledWith('[URL Loader] Calling processFiles...');
    expect(deps.processFiles).toHaveBeenCalledWith(files, { start: 80, end: 100 }, { throwOnError: true });
    expect(deps.setUrlProgress).toHaveBeenLastCalledWith({ percent: 100, message: 'Complete' });
    expect(deps.log).toHaveBeenCalledWith('[URL Loader] Successfully loaded 3 files from URL');
  });

  it('loads an inline manifest source and stores the manifest for embedding', async () => {
    const deps = makeDeps();

    await expect(loadManifestSource(manifest, { type: 'manifest' }, deps)).resolves.toBe(true);

    expect(deps.setSourceInfo).toHaveBeenCalledWith(
      'manifest',
      null,
      'https://example.com/dataset/rgb/',
      'https://example.com/dataset/segmentation/',
      manifest,
      null
    );
    expect(deps.log).toHaveBeenCalledWith('[URL Loader] Successfully loaded 3 files from manifest');
  });

  it('leaves completion progress to the renderer when a manifest contains a splat', async () => {
    const files = new Map([
      ...makeFiles(),
      ['splats/scene.spz', buildFile('scene.spz', 'splat')],
    ]);
    const deps = makeDeps(files);

    await expect(loadManifestSource(manifest, { type: 'manifest' }, deps)).resolves.toBe(true);

    expect(deps.processFiles).toHaveBeenCalledWith(files, { start: 80, end: 100 }, { throwOnError: true });
    expect(deps.setUrlProgress).not.toHaveBeenCalledWith({ percent: 100, message: 'Complete' });
  });

  it('progressively parses a stubbed model first, then swaps in the downloaded points3D', async () => {
    const stub = buildFile('points3D.bin');
    const realPoints3D = buildFile('points3D.bin', 'full point cloud');
    const files = new Map([
      ['sparse/0/cameras.bin', buildFile('cameras.bin')],
      ['sparse/0/images.bin', buildFile('images.bin')],
      ['sparse/0/points3D.bin', stub],
    ]);
    const fetchColmapFiles = vi.fn(async (
      _manifest: ColmapManifest,
      options?: { onDeferredPoints3D?: (deferred: { key: string; promise: Promise<File> }) => void }
    ) => {
      options?.onDeferredPoints3D?.({
        key: 'sparse/0/points3D.bin',
        promise: Promise.resolve(realPoints3D),
      });
      return files;
    });
    const pointsAtCall: File[] = [];
    const processFiles = vi.fn(async (processed: Map<string, File>) => {
      pointsAtCall.push(processed.get('sparse/0/points3D.bin')!);
    });
    const deps = {
      fetchColmapFiles,
      log: vi.fn(),
      processFiles,
      progressive: true,
      setSourceInfo: vi.fn(),
      setUrlProgress: vi.fn(),
    };

    await expect(loadManifestSource(manifest, { type: 'manifest' }, deps)).resolves.toBe(true);

    // Stage 1 parses the stub (poses visible immediately); stage 2 swaps in the
    // real file as a background refresh without re-raising the loading overlay.
    expect(processFiles).toHaveBeenCalledTimes(2);
    expect(pointsAtCall).toEqual([stub, realPoints3D]);
    expect(processFiles).toHaveBeenNthCalledWith(1, files, { start: 80, end: 100 }, { throwOnError: true });
    expect(processFiles).toHaveBeenNthCalledWith(
      2,
      files,
      { start: 80, end: 100 },
      { throwOnError: true, backgroundRefresh: true }
    );
    expect(deps.setUrlProgress).toHaveBeenLastCalledWith({ percent: 100, message: 'Complete' });
  });

  it('progressively loads the poses preview first, then swaps in the full images.bin as stage 3', async () => {
    const previewImages = buildFile('images.bin', 'poses preview');
    const fullImages = buildFile('images.bin', 'full images with observations');
    const files = new Map([
      ['sparse/0/cameras.bin', buildFile('cameras.bin')],
      ['sparse/0/images.bin', previewImages],
      ['sparse/0/points3D.bin', buildFile('points3D.bin')],
    ]);
    const imagesStart = vi.fn(async () => fullImages);
    const fetchColmapFiles = vi.fn(async (
      _manifest: ColmapManifest,
      options?: {
        onDeferredPoints3D?: (deferred: { key: string; promise: Promise<File> }) => void;
        onDeferredImages?: (deferred: { key: string; fullPath: string; start: () => Promise<File> }) => void;
      }
    ) => {
      options?.onDeferredPoints3D?.({
        key: 'sparse/0/points3D.bin',
        promise: Promise.resolve(buildFile('points3D.bin', 'full point cloud')),
      });
      options?.onDeferredImages?.({
        key: 'sparse/0/images.bin',
        fullPath: 'custom/images.bin',
        start: imagesStart,
      });
      return files;
    });
    const imagesAtCall: File[] = [];
    const processFiles = vi.fn(async (processed: Map<string, File>) => {
      imagesAtCall.push(processed.get('sparse/0/images.bin')!);
      // The full-images download must not start before the points stage-2
      // rebuild ran (it would compete with the visible stages for bandwidth).
      if (processFiles.mock.calls.length <= 2) {
        expect(imagesStart).not.toHaveBeenCalled();
      }
    });
    const deps = {
      fetchColmapFiles,
      log: vi.fn(),
      processFiles,
      progressive: true,
      setSourceInfo: vi.fn(),
      setUrlProgress: vi.fn(),
    };

    await expect(loadManifestSource(
      { ...manifest, posesPreview: 'custom/poses-preview.bin' },
      { type: 'manifest' },
      deps
    )).resolves.toBe(true);

    // Stage 1 stub+preview parse, stage 2 real points, stage 3 full images.
    expect(processFiles).toHaveBeenCalledTimes(3);
    expect(imagesAtCall).toEqual([previewImages, previewImages, fullImages]);
    expect(imagesStart).toHaveBeenCalledTimes(1);
    expect(deps.setUrlProgress).toHaveBeenLastCalledWith({ percent: 100, message: 'Complete' });
  });

  it('keeps the poses preview when the stage-3 full images download fails', async () => {
    const previewImages = buildFile('images.bin', 'poses preview');
    const files = new Map([
      ['sparse/0/cameras.bin', buildFile('cameras.bin')],
      ['sparse/0/images.bin', previewImages],
      ['sparse/0/points3D.bin', buildFile('points3D.bin')],
    ]);
    const fetchColmapFiles = vi.fn(async (
      _manifest: ColmapManifest,
      options?: {
        onDeferredPoints3D?: (deferred: { key: string; promise: Promise<File> }) => void;
        onDeferredImages?: (deferred: { key: string; fullPath: string; start: () => Promise<File> }) => void;
      }
    ) => {
      options?.onDeferredPoints3D?.({
        key: 'sparse/0/points3D.bin',
        promise: Promise.resolve(buildFile('points3D.bin', 'full point cloud')),
      });
      options?.onDeferredImages?.({
        key: 'sparse/0/images.bin',
        fullPath: 'custom/images.bin',
        start: vi.fn(async () => {
          throw new Error('network gone');
        }),
      });
      return files;
    });
    const deps = {
      fetchColmapFiles,
      log: vi.fn(),
      processFiles: vi.fn(async () => {}),
      progressive: true,
      setSourceInfo: vi.fn(),
      setUrlProgress: vi.fn(),
    };

    // Non-fatal: the scene stays usable from the preview.
    await expect(loadManifestSource(
      { ...manifest, posesPreview: 'custom/poses-preview.bin' },
      { type: 'manifest' },
      deps
    )).resolves.toBe(true);

    // Stage 3 rebuild never ran (stages 1 + 2 only).
    expect(deps.processFiles).toHaveBeenCalledTimes(2);
    expect(deps.log).toHaveBeenCalledWith(
      '[URL Loader] Progressive: full images download failed (network gone); keeping the poses preview'
    );
  });

  it('reports the full-points upgrade plan once a preview-backed load completes', async () => {
    const deps = { ...makeDeps(), onPointsPreviewLoaded: vi.fn() };

    await expect(loadManifestSource(
      { ...manifest, pointsPreview: 'custom/points3D-preview.bin' },
      { type: 'manifest' },
      deps
    )).resolves.toBe(true);

    expect(deps.onPointsPreviewLoaded).toHaveBeenCalledTimes(1);
    expect(deps.onPointsPreviewLoaded).toHaveBeenCalledWith({
      previewPath: 'custom/points3D-preview.bin',
      fullPath: 'custom/points3D.bin',
      key: 'sparse/0/points3D.bin',
    });
    // The plan is only surfaced after processFiles (the preview is live).
    expect(deps.processFiles).toHaveBeenCalledTimes(1);
  });

  it('does not report a preview plan for manifests without one', async () => {
    const deps = { ...makeDeps(), onPointsPreviewLoaded: vi.fn() };

    await expect(loadManifestSource(manifest, { type: 'manifest' }, deps)).resolves.toBe(true);

    expect(deps.onPointsPreviewLoaded).not.toHaveBeenCalled();
  });

  it('does not request points3D deferral when progressive loading is off', async () => {
    const deps = makeDeps();

    await expect(loadManifestSource(manifest, { type: 'manifest' }, deps)).resolves.toBe(true);

    expect(deps.fetchColmapFiles).toHaveBeenCalledWith(manifest);
    expect(deps.processFiles).toHaveBeenCalledTimes(1);
  });

  it('propagates COLMAP fetch failures before mutating source state', async () => {
    const error = new Error('missing cameras');
    const deps = makeDeps();
    deps.fetchColmapFiles.mockRejectedValueOnce(error);

    await expect(loadManifestSource(manifest, { type: 'url' }, deps)).rejects.toBe(error);

    expect(deps.setSourceInfo).not.toHaveBeenCalled();
    expect(deps.processFiles).not.toHaveBeenCalled();
    expect(deps.setUrlProgress).not.toHaveBeenCalled();
  });

  it('propagates processing failures after source metadata is staged', async () => {
    const error = new Error('parse failed');
    const deps = makeDeps();
    deps.processFiles.mockRejectedValueOnce(error);

    await expect(loadManifestSource(manifest, { type: 'manifest' }, deps)).rejects.toBe(error);

    expect(deps.setSourceInfo).toHaveBeenCalled();
    expect(deps.setUrlProgress).toHaveBeenCalledWith({
      percent: 80,
      message: 'Parsing reconstruction...',
    });
    expect(deps.setUrlProgress).not.toHaveBeenCalledWith({ percent: 100, message: 'Complete' });
  });
});
