import { useReconstructionStore } from '../../store';

export type DataPanelReconstruction = ReturnType<typeof useReconstructionStore.getState>['reconstruction'];

export interface DataPanelStoreFacade {
  reconstruction: DataPanelReconstruction;
  /** Track-less decimated points preview active: track stats compute to zeros. */
  hasPreviewPoints: boolean;
}

export function useDataPanelStoreFacade(): DataPanelStoreFacade {
  const reconstruction = useReconstructionStore((s) => s.reconstruction);
  const hasPreviewPoints = useReconstructionStore((s) => s.pointsPreview !== null);

  return { reconstruction, hasPreviewPoints };
}
