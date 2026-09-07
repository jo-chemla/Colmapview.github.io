import { useCallback } from 'react';
import { useReconstructionStore } from '../store';
import { useNotificationStore } from '../store/stores/notificationStore';
import { appLogger } from '../utils/logger';
import { useFileDropzone } from './useFileDropzone';
import { isUrlLoadError } from './urlLoaderErrorHandling';
import { fetchManifestFile } from './urlLoaderManifestFetch';

/**
 * On-demand upgrade from a decimated points preview (manifest pointsPreview)
 * to the full points3D file. Reuses the progressive stage-2 mechanism end to
 * end: download the full file with byte progress surfaced on the compact
 * background indicator, swap it under the same files-map points3D slot key,
 * and rebuild via processFiles({ backgroundRefresh: true }) — non-blocking, no
 * camera reset, and the georef recentering pre-pass recomputes the identical
 * offset from the unchanged images.bin bytes, so the scene does not jump.
 */
export function useFullPointsUpgrade() {
  const { processFiles } = useFileDropzone();

  return useCallback(async (): Promise<boolean> => {
    const store = useReconstructionStore.getState();
    const preview = store.pointsPreview;
    const files = store.droppedFiles;
    if (!preview || preview.loadingFull || !files) {
      return false;
    }

    store.setPointsPreview({ ...preview, loadingFull: true });

    // Throttled byte progress on the background (non-blocking) indicator, like
    // the progressive stage-2 points download.
    let lastReport = 0;
    const reportProgress = (loaded: number, total: number) => {
      const now = Date.now();
      if (now - lastReport < 200) {
        return;
      }
      lastReport = now;
      useReconstructionStore.getState().setUrlProgress({
        background: true,
        percent: total > 0 ? Math.min(100, Math.round((Math.min(loaded, total) / total) * 100)) : 0,
        message: 'Downloading full points',
        ...(total > 0
          ? { bytesLoaded: Math.min(loaded, total), bytesTotal: total }
          : { bytesLoaded: loaded }),
      });
    };
    reportProgress(0, preview.fullSizeBytes ?? 0);

    try {
      const fullFile = await fetchManifestFile(preview.baseUrl, preview.fullPath, {
        onProgress: reportProgress,
      });
      appLogger.info(`[URL Loader] Full points3D downloaded (${preview.fullPath}), rebuilding scene...`);
      useReconstructionStore.getState().setUrlProgress({
        background: true,
        percent: 100,
        message: 'Points downloaded — rebuilding scene',
      });

      // Stage-2 swap: same slot key, background rebuild (processFiles clears
      // pointsPreview via setDroppedFiles, retiring the chip).
      const nextFiles = new Map(files);
      nextFiles.set(preview.key, fullFile);
      await processFiles(nextFiles, { start: 80, end: 100 }, { throwOnError: true, backgroundRefresh: true });

      // Replace the compact background card with a terminal, non-background
      // write (mirrors the progressive stage-2 completion).
      useReconstructionStore.getState().setUrlProgress({ percent: 100, message: 'Full points loaded' });
      return true;
    } catch (err) {
      const message = err instanceof Error || isUrlLoadError(err) ? err.message : String(err);
      appLogger.error(`[URL Loader] Full points upgrade failed: ${message}`);
      useNotificationStore.getState().addNotification('warning', `Full points load failed: ${message}`, 8000);
      // Restore the chip so the upgrade stays retryable.
      useReconstructionStore.getState().setPointsPreview({ ...preview, loadingFull: false });
      useReconstructionStore.getState().setUrlProgress(null);
      return false;
    }
  }, [processFiles]);
}
