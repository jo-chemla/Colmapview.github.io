/**
 * Multi-dataset loading (?urls=<manifestUrl1>,<manifestUrl2>,...): fetch each
 * manifest's COLMAP binaries — preferring the cheap preview slots
 * (posesPreview / pointsPreview) — and merge them at the FILE level into one
 * model before any parser runs (see parsers/colmapBinMerge.ts). The regular
 * single-dataset `?url=` path is untouched.
 *
 * Georef recentering needs no special handling here: the existing recenter
 * pre-pass keys on the MERGED files map, so it computes ONE camera-centroid
 * offset across all datasets and applies it to every pose and point — the
 * shared (e.g. utm33-rs) frame stays co-registered. Per-dataset offsets would
 * tear the rigs apart.
 *
 * Image names are namespaced `${dataset}/${name}` by the merge; every merged
 * name gets an explicit per-image URL (imageNameToUrl) pointing back at its
 * own dataset's images base, so gallery/detail views resolve across datasets.
 */

import type { ColmapManifest, UrlLoadError, UrlLoadProgress } from '../types/manifest';
import { appLogger } from '../utils/logger';
import { mergeColmapBinaryDatasets } from '../parsers/colmapBinMerge';
import { getManifestDisplayName } from '../components/dropzone/datasetIndexPolicy';
import { joinManifestUrlPath } from './urlLoaderPolicy';
import { fetchManifestFile, fetchUrlManifest } from './urlLoaderManifestFetch';

type ProcessFiles = (
  files: Map<string, File>,
  progressRange?: { start: number; end: number },
  options?: { throwOnError?: boolean; backgroundRefresh?: boolean }
) => Promise<void | boolean>;
type SetSourceInfo = (
  type: 'url' | 'manifest',
  url?: string | null,
  imageUrlBase?: string | null,
  maskUrlBase?: string | null,
  manifest?: ColmapManifest | null,
  imageNameToUrl?: Record<string, string> | null
) => void;
type SetUrlProgress = (progress: UrlLoadProgress | null) => void;
type AddNotification = (type: 'info' | 'warning', message: string, duration?: number) => void;
type Log = (...args: unknown[]) => void;

/** Hard cap on datasets merged into one scene. */
export const MAX_MULTI_DATASETS = 12;

export const MULTI_DATASET_CAP_MESSAGE =
  `Too many datasets: multi-dataset mode loads at most ${MAX_MULTI_DATASETS} at once`;

/**
 * Manifest URLs from a `?urls=` query parameter (comma-separated, entries may
 * be individually URL-encoded). Invalid URLs are dropped; order is preserved
 * and duplicates removed.
 */
export function getMultiManifestUrlsFromSearch(search: string): string[] {
  const raw = new URLSearchParams(search).get('urls');
  if (!raw) {
    return [];
  }
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const candidate = part.trim();
    if (!candidate) {
      continue;
    }
    try {
      const url = new URL(candidate).toString();
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    } catch {
      // Skip malformed entries; the rest still load.
    }
  }
  return urls;
}

function invalidManifestError(message: string, failedFile?: string): UrlLoadError {
  return { type: 'invalid_manifest', message, failedFile };
}

function ensureTrailingSlash(path: string): string {
  return path === '' || path.endsWith('/') ? path : `${path}/`;
}

/**
 * The three binary paths fetched for one dataset in multi mode: cameras, poses
 * (posesPreview preferred, else full images) and points (pointsPreview
 * preferred, else full points3D), each flagged so callers can warn about the
 * heavier full-file fallbacks.
 */
export interface MultiDatasetFilePlan {
  cameras: string;
  poses: string;
  posesIsPreview: boolean;
  points: string;
  pointsIsPreview: boolean;
}

export function getMultiDatasetFilePlan(manifest: ColmapManifest): MultiDatasetFilePlan {
  const plan: MultiDatasetFilePlan = {
    cameras: manifest.files.cameras,
    poses: manifest.posesPreview ?? manifest.files.images,
    posesIsPreview: manifest.posesPreview !== undefined,
    points: manifest.pointsPreview ?? manifest.files.points3D,
    pointsIsPreview: manifest.pointsPreview !== undefined,
  };
  for (const path of [plan.cameras, plan.poses, plan.points]) {
    if (/\.txt$/i.test(path)) {
      throw invalidManifestError(
        'Multi-dataset mode only merges binary COLMAP files (.bin); this manifest lists text files',
        path
      );
    }
  }
  return plan;
}

/**
 * Unique, filesystem-ish display prefixes for the merged image names: the
 * manifest URL's directory name (e.g. .../S4/manifest.json -> "S4"), with a
 * numeric suffix on collision so two datasets can never alias each other.
 */
export function getDatasetNamePrefixes(manifestUrls: readonly string[]): string[] {
  const prefixes: string[] = [];
  const used = new Set<string>();
  for (const [index, url] of manifestUrls.entries()) {
    // Slashes would create phantom nesting in the `${prefix}/${name}` namespace.
    const base = (getManifestDisplayName(url) || `dataset-${index + 1}`).replace(/\//g, '-');
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${n++}`;
    }
    used.add(candidate);
    prefixes.push(candidate);
  }
  return prefixes;
}

export interface LoadMultiManifestSourceDeps {
  log?: Log;
  processFiles: ProcessFiles;
  setSourceInfo: SetSourceInfo;
  setUrlProgress: SetUrlProgress;
  addNotification?: AddNotification;
  /** Test seams. */
  fetchManifestImpl?: (manifestUrl: string) => Promise<ColmapManifest>;
  fetchFileImpl?: (baseUrl: string, relativePath: string) => Promise<File>;
}

export interface MultiManifestLoadSummary {
  datasets: Array<{
    manifestUrl: string;
    name: string;
    poseCount: number;
    pointCount: number;
    cameraCount: number;
  }>;
}

/**
 * Load N manifests into ONE scene: download each dataset's (preview) binaries,
 * merge them file-level with id offsets and name prefixes, then hand the
 * merged files to the regular parse pipeline.
 */
export async function loadMultiManifestSource(
  manifestUrls: readonly string[],
  deps: LoadMultiManifestSourceDeps
): Promise<MultiManifestLoadSummary> {
  const log = deps.log ?? appLogger.info;
  const warn = deps.addNotification ?? (() => undefined);
  const fetchManifest = deps.fetchManifestImpl
    ?? ((manifestUrl: string) => fetchUrlManifest(manifestUrl, { setUrlProgress: () => undefined }));
  const fetchFile = deps.fetchFileImpl ?? ((baseUrl: string, path: string) => fetchManifestFile(baseUrl, path));

  const total = manifestUrls.length;
  const prefixes = getDatasetNamePrefixes(manifestUrls);
  const reportDataset = (index: number, message: string) => {
    deps.setUrlProgress({
      percent: 5 + Math.round((index / total) * 70),
      message: `Dataset ${index + 1}/${total}: ${message}`,
      filesDownloaded: index,
      totalFiles: total,
    });
  };

  const datasets: Array<{
    manifest: ColmapManifest;
    prefix: string;
    cameras: ArrayBuffer;
    images: ArrayBuffer;
    points3D: ArrayBuffer;
  }> = [];

  for (const [index, manifestUrl] of manifestUrls.entries()) {
    const prefix = prefixes[index];
    reportDataset(index, 'fetching manifest…');
    const manifest = await fetchManifest(manifestUrl);
    const plan = getMultiDatasetFilePlan(manifest);
    if (!plan.posesIsPreview) {
      warn('warning', `${prefix}: manifest has no posesPreview — downloading the full images.bin`, 8000);
    }
    if (!plan.pointsIsPreview) {
      warn('warning', `${prefix}: manifest has no pointsPreview — downloading the full points3D.bin`, 8000);
    }
    reportDataset(index, `downloading ${plan.posesIsPreview ? 'poses preview' : 'images.bin'}…`);
    const [camerasFile, posesFile] = await Promise.all([
      fetchFile(manifest.baseUrl, plan.cameras),
      fetchFile(manifest.baseUrl, plan.poses),
    ]);
    reportDataset(index, `downloading ${plan.pointsIsPreview ? 'points preview' : 'points3D.bin'}…`);
    const pointsFile = await fetchFile(manifest.baseUrl, plan.points);
    datasets.push({
      manifest,
      prefix,
      cameras: await camerasFile.arrayBuffer(),
      images: await posesFile.arrayBuffer(),
      points3D: await pointsFile.arrayBuffer(),
    });
    log(`[Multi Loader] Dataset ${index + 1}/${total} (${prefix}) downloaded from ${manifestUrl}`);
  }

  deps.setUrlProgress({ percent: 76, message: `Merging ${total} datasets…` });
  const merged = mergeColmapBinaryDatasets(datasets.map((dataset) => ({
    cameras: dataset.cameras,
    images: dataset.images,
    points3D: dataset.points3D,
    namePrefix: dataset.prefix,
  })));

  // Per-image URL map: every merged (prefixed) name resolves against its own
  // dataset's images base — the merged scene has no single imagesPath.
  const imageNameToUrl: Record<string, string> = {};
  for (const [index, dataset] of datasets.entries()) {
    const { manifest, prefix } = dataset;
    const imagesPath = ensureTrailingSlash(manifest.imagesPath ?? 'images/');
    for (const name of merged.imageNames[index]) {
      const override = manifest.imageNameToPath?.[name];
      imageNameToUrl[`${prefix}/${name}`] = joinManifestUrlPath(
        manifest.baseUrl,
        override ?? `${imagesPath}${name}`
      );
    }
  }

  const files = new Map<string, File>([
    ['sparse/0/cameras.bin', new File([merged.cameras], 'cameras.bin')],
    ['sparse/0/images.bin', new File([merged.images], 'images.bin')],
    ['sparse/0/points3D.bin', new File([merged.points3D], 'points3D.bin')],
  ]);

  const first = datasets[0].manifest;
  deps.setSourceInfo(
    'url',
    null, // no single manifest URL: share/switcher affordances treat this like a local load
    joinManifestUrlPath(first.baseUrl, ensureTrailingSlash(first.imagesPath ?? 'images/')),
    joinManifestUrlPath(first.baseUrl, ensureTrailingSlash(first.masksPath ?? 'masks/')),
    null,
    imageNameToUrl
  );

  deps.setUrlProgress({ percent: 80, message: 'Parsing merged reconstruction…' });
  await deps.processFiles(files, { start: 80, end: 100 }, { throwOnError: true });

  const summary: MultiManifestLoadSummary = {
    datasets: datasets.map((dataset, index) => ({
      manifestUrl: manifestUrls[index],
      name: dataset.prefix,
      poseCount: merged.imageCounts[index],
      pointCount: merged.pointCounts[index],
      cameraCount: merged.cameraCounts[index],
    })),
  };
  const label = summary.datasets
    .map((entry) => `${entry.name}: ${entry.poseCount} poses / ${entry.pointCount} pts`)
    .join(', ');
  log(`[Multi Loader] Merged ${total} datasets — ${label}`);
  deps.setUrlProgress({ percent: 100, message: 'Complete' });
  return summary;
}
