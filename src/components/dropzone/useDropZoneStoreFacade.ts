import {
  hasUrlToLoad,
  selectPointCount,
  useReconstructionStore,
  useUIStore,
  type PointsPreviewState,
} from '../../store';

export interface DropZoneStoreFacadeData {
  error: ReturnType<typeof useReconstructionStore.getState>['error'];
  reconstruction: ReturnType<typeof useReconstructionStore.getState>['reconstruction'];
  touchMode: ReturnType<typeof useUIStore.getState>['touchMode'];
  hasUrlLoadRequest: boolean;
  /** Active decimated points preview (drives the "load full points" chip). */
  pointsPreview: PointsPreviewState | null;
  /** Loaded point count (the preview chip shows it as the preview size). */
  pointCount: number;
}

export interface DropZoneStoreFacadeActions {
  setError: ReturnType<typeof useReconstructionStore.getState>['setError'];
}

export interface DropZoneStoreFacade {
  data: DropZoneStoreFacadeData;
  actions: DropZoneStoreFacadeActions;
}

export function useDropZoneStoreFacade(): DropZoneStoreFacade {
  const error = useReconstructionStore((s) => s.error);
  const setError = useReconstructionStore((s) => s.setError);
  const reconstruction = useReconstructionStore((s) => s.reconstruction);
  const pointsPreview = useReconstructionStore((s) => s.pointsPreview);
  const pointCount = useReconstructionStore(selectPointCount);
  const touchMode = useUIStore((s) => s.touchMode);

  return {
    data: {
      error,
      reconstruction,
      touchMode,
      hasUrlLoadRequest: hasUrlToLoad(),
      pointsPreview,
      pointCount,
    },
    actions: {
      setError,
    },
  };
}
