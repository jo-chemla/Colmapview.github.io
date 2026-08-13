import {
  usePointCloudStore,
  usePointPickingStore,
  useReconstructionStore,
  useUIStore,
  type PointCloudState,
  type PointPickingState,
  type UIState,
} from '../../../store';
import type { Reconstruction } from '../../../types/colmap';

interface AlignPanelDataFacade {
  reconstruction: Reconstruction | null;
}

interface AlignPanelUiFacade {
  showGizmo: boolean;
  toggleGizmo: UIState['toggleGizmo'];
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
  ui: AlignPanelUiFacade;
  pointPicking: AlignPanelPointPickingFacade;
  pointCloud: AlignPanelPointCloudFacade;
}

export function useAlignPanelStoreFacade(): AlignPanelStoreFacade {
  const reconstruction = useReconstructionStore((s) => s.reconstruction);

  const showGizmo = useUIStore((s) => s.showGizmo);
  const toggleGizmo = useUIStore((s) => s.toggleGizmo);

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
    ui: {
      showGizmo,
      toggleGizmo,
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
