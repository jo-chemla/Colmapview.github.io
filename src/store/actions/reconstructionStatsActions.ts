/**
 * Lazy reconstruction statistics.
 *
 * The per-image/global statistics pass (computeStatsFromTracks — O(points x
 * trackLength^2) of Map/Set work) is skipped at load time; reconstructions
 * carry empty stats and `statsPending: true`. Consumers that actually need
 * stats (image detail, matches, selection highlight, gallery list view, data
 * panel) call ensureReconstructionStats() on first need. The pass reuses the
 * cooperative-yielding compute and surfaces the existing compact background
 * progress card while it runs.
 */

import { computeImageStats, computeImageStatsFromWasm } from '../../parsers/index.js';
import { useReconstructionStore } from '../reconstructionStore.js';

let inFlight: Promise<void> | null = null;

/** Whether the given (or current) reconstruction still needs its stats pass. */
export function areReconstructionStatsPending(): boolean {
  return Boolean(useReconstructionStore.getState().reconstruction?.statsPending);
}

/**
 * Compute the deferred statistics for the currently loaded reconstruction and
 * swap them into the store. Idempotent: no-op when stats are already computed
 * or no reconstruction is loaded; concurrent callers share one pass.
 */
export function ensureReconstructionStats(): Promise<void> {
  const store = useReconstructionStore.getState();
  const reconstruction = store.reconstruction;
  if (!reconstruction?.statsPending) {
    return Promise.resolve();
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    // Non-blocking corner card (same one as the progressive background points
    // download); the scene stays fully interactive while the pass yields.
    store.setUrlProgress({ percent: 50, message: 'Computing image statistics…', background: true });
    try {
      const wasm = useReconstructionStore.getState().wasmReconstruction;
      const stats = wasm?.hasPoints()
        ? await computeImageStatsFromWasm(reconstruction.images, wasm)
        : reconstruction.points3D
          ? await computeImageStats(reconstruction.images, reconstruction.points3D)
          : null;

      const latest = useReconstructionStore.getState().reconstruction;
      if (latest !== reconstruction) {
        // Dataset changed mid-pass (e.g. progressive stage-2 swap): drop this
        // result; the new reconstruction carries its own statsPending flag.
        return;
      }

      useReconstructionStore.getState().setReconstruction({
        ...reconstruction,
        ...(stats ?? {}),
        statsPending: false,
      });
    } finally {
      const progress = useReconstructionStore.getState().urlProgress;
      if (progress?.background && progress.message === 'Computing image statistics…') {
        useReconstructionStore.getState().setUrlProgress(null);
      }
      inFlight = null;
    }
  })();
  return inFlight;
}
