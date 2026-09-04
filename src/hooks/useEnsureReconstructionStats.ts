import { useEffect } from 'react';
import { ensureReconstructionStats } from '../store/actions';
import { useReconstructionStore } from '../store/reconstructionStore';

/**
 * Kick the deferred reconstruction statistics pass when a consumer actually
 * needs stats (image detail, matches, data panel, gallery list view, ...).
 * Returns whether stats are still pending so callers can gate placeholder UI.
 */
export function useEnsureReconstructionStats(needed: boolean): boolean {
  const statsPending = useReconstructionStore((s) => Boolean(s.reconstruction?.statsPending));

  useEffect(() => {
    if (needed && statsPending) {
      void ensureReconstructionStats();
    }
  }, [needed, statsPending]);

  return statsPending;
}
