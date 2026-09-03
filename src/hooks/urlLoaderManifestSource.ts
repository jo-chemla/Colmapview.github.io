import type { ColmapManifest, UrlLoadProgress } from '../types/manifest';
import { findSplatFileSources } from '../utils/fileClassification';
import { appLogger } from '../utils/logger';
import {
  getManifestLoadSourceInfo,
  type ManifestLoadSource,
  type RemoteSplatCandidate,
} from './urlLoaderPolicy';
import { fetchManifestColmapFiles, type DeferredPoints3D } from './urlLoaderManifestFetch';

type ProcessFiles = (
  files: Map<string, File>,
  progressRange?: { start: number; end: number },
  options?: { throwOnError?: boolean; backgroundRefresh?: boolean }
) => Promise<void | boolean>;
type FetchColmapFiles = (
  manifest: ColmapManifest,
  options?: { onDeferredPoints3D?: (deferred: DeferredPoints3D) => void }
) => Promise<Map<string, File>>;
type SetSourceInfo = (
  type: ManifestLoadSource['type'],
  url?: string | null,
  imageUrlBase?: string | null,
  maskUrlBase?: string | null,
  manifest?: ColmapManifest | null,
  imageNameToUrl?: Record<string, string> | null
) => void;
type SetUrlProgress = (progress: UrlLoadProgress | null) => void;
type Log = (...args: unknown[]) => void;

export interface LoadManifestSourceDeps {
  fetchColmapFiles?: FetchColmapFiles;
  log?: Log;
  processFiles: ProcessFiles;
  setSourceInfo: SetSourceInfo;
  setUrlProgress: SetUrlProgress;
  /** Receives the full discovered remote splat catalog for lazy on-demand loading. */
  onRemoteSplatCatalog?: (catalog: RemoteSplatCandidate[]) => void;
  /**
   * Opt-in progressive loading (?progressive=1): parse cameras+images with an
   * empty points3D stub so poses/gallery show immediately, then swap in the
   * full reconstruction when the (already in-flight) points3D download lands.
   */
  progressive?: boolean;
}

export async function loadManifestSource(
  manifest: ColmapManifest,
  source: ManifestLoadSource,
  deps: LoadManifestSourceDeps
): Promise<boolean> {
  const log = deps.log ?? appLogger.info;
  const fetchColmapFiles: FetchColmapFiles = deps.fetchColmapFiles
    ?? ((targetManifest, options) => fetchManifestColmapFiles(targetManifest, {
      log: (message) => log(message),
      setUrlProgress: deps.setUrlProgress,
      onRemoteSplatCatalog: deps.onRemoteSplatCatalog,
      onDeferredPoints3D: options?.onDeferredPoints3D,
    }));

  const deferredPoints3D: { value: DeferredPoints3D | null } = { value: null };
  const files = deps.progressive
    ? await fetchColmapFiles(manifest, {
      onDeferredPoints3D: (deferred) => {
        deferredPoints3D.value = deferred;
        // A cameras/images failure aborts the load before stage 2 ever awaits
        // this download; observe it on a fork so that abort path cannot surface
        // an unhandled rejection (stage 2 still awaits the original promise).
        deferred.promise.catch(() => {});
      },
    })
    : await fetchColmapFiles(manifest);
  log(`[URL Loader] Downloaded ${files.size} COLMAP files:`, Array.from(files.keys()));

  log('[URL Loader] Skipping image download (images will be loaded lazily)');

  deps.setUrlProgress({ percent: 80, message: 'Parsing reconstruction...' });

  const sourceInfo = getManifestLoadSourceInfo(manifest, source);
  deps.setSourceInfo(
    sourceInfo.sourceType,
    sourceInfo.sourceUrl,
    sourceInfo.imageUrlBase,
    sourceInfo.maskUrlBase,
    sourceInfo.sourceManifest,
    sourceInfo.imageNameToUrl ?? null
  );
  log(`[URL Loader] Image URL base for lazy loading: ${sourceInfo.imageUrlBase}`);
  log(`[URL Loader] Mask URL base for lazy loading: ${sourceInfo.maskUrlBase}`);
  if (sourceInfo.imageNameToUrl) {
    log(
      `[URL Loader] Per-image URL mapping active for ${Object.keys(sourceInfo.imageNameToUrl).length} images`
    );
  }

  log('[URL Loader] Calling processFiles...');
  await deps.processFiles(files, { start: 80, end: 100 }, { throwOnError: true });

  if (deferredPoints3D.value) {
    // Stage 2: poses are already live from the stub parse; when the real
    // points3D (fetched in parallel since stage 1 — never refetched) lands,
    // rebuild the reconstruction in place. backgroundRefresh keeps the blocking
    // overlay down and the user's camera where they left it.
    log('[URL Loader] Progressive: camera poses shown; points3D downloading in background...');
    files.set(deferredPoints3D.value.key, await deferredPoints3D.value.promise);
    log('[URL Loader] Progressive: points3D downloaded, rebuilding full reconstruction...');
    await deps.processFiles(files, { start: 80, end: 100 }, { throwOnError: true, backgroundRefresh: true });
  }

  if (findSplatFileSources(files).length === 0) {
    deps.setUrlProgress({ percent: 100, message: 'Complete' });
  }
  log(`[URL Loader] Successfully loaded ${files.size} files from ${sourceInfo.successLabel}`);

  return true;
}
