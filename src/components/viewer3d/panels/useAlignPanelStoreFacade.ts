import {
  usePointCloudStore,
  usePointPickingStore,
  useReconstructionStore,
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

interface AlignPanelPointCloudFacade {
  showPointCloud: boolean;
  colorMode: PointCloudState['colorMode'];
  setShowPointCloud: PointCloudState['setShowPointCloud'];
  setColorMode: PointCloudState['setColorMode'];
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

  const showPointCloud = usePointCloudStore((s) => s.showPointCloud);
  const colorMode = usePointCloudStore((s) => s.colorMode);
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
      showPointCloud,
      colorMode,
      setShowPointCloud,
      setColorMode,
    },
  };
}
