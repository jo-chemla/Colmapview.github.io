import {
  usePointCloudStore,
  usePointPickingStore,
  useReconstructionStore,
  type ColorMode,
  type PointCloudState,
  type PointPickingState,
} from '../../../store';
import type { Reconstruction } from '../../../types/colmap';

interface AlignPanelDataFacade {
  reconstruction: Reconstruction | null;
}

interface AlignPanelPointPickingFacade {
  pickingMode: PointPickingState['pickingMode'];
  setPickingMode: PointPickingState['setPickingMode'];
}

export interface AlignPanelPointCloudSnapshot {
  showPointCloud: boolean;
  colorMode: ColorMode;
}

interface AlignPanelPointCloudFacade {
  /**
   * Read on demand rather than subscribed. The panel needs these two values
   * only inside its arm-a-tool handler, and subscribing re-rendered the whole
   * toolbar entry every time point-cloud visibility or the color mode changed
   * anywhere else in the app.
   */
  getPointCloudSnapshot: () => AlignPanelPointCloudSnapshot;
  setShowPointCloud: PointCloudState['setShowPointCloud'];
  setColorMode: PointCloudState['setColorMode'];
}

// Module scope, so the identity is stable across renders and handlers closing
// over it need no dependency on it.
function getPointCloudSnapshot(): AlignPanelPointCloudSnapshot {
  const { showPointCloud, colorMode } = usePointCloudStore.getState();
  return { showPointCloud, colorMode };
}

export interface AlignPanelStoreFacade {
  data: AlignPanelDataFacade;
  pointPicking: AlignPanelPointPickingFacade;
  pointCloud: AlignPanelPointCloudFacade;
}

export function useAlignPanelStoreFacade(): AlignPanelStoreFacade {
  const reconstruction = useReconstructionStore((s) => s.reconstruction);

  const pickingMode = usePointPickingStore((s) => s.pickingMode);
  const setPickingMode = usePointPickingStore((s) => s.setPickingMode);

  const setShowPointCloud = usePointCloudStore((s) => s.setShowPointCloud);
  const setColorMode = usePointCloudStore((s) => s.setColorMode);

  return {
    data: {
      reconstruction,
    },
    pointPicking: {
      pickingMode,
      setPickingMode,
    },
    pointCloud: {
      getPointCloudSnapshot,
      setShowPointCloud,
      setColorMode,
    },
  };
}
