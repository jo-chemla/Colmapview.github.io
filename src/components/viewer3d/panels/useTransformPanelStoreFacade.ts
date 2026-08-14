import {
  applyTransformPreset,
  applyTransformToData,
  useReconstructionStore,
  useTransformStore,
  useUIStore,
  type TransformState,
  type UIState,
} from '../../../store';
import type { Reconstruction } from '../../../types/colmap';
import type { WasmReconstructionWrapper } from '../../../wasm/reconstruction';

interface TransformPanelDataFacade {
  reconstruction: Reconstruction | null;
  wasmReconstruction: WasmReconstructionWrapper | null;
  droppedFiles: Map<string, File> | null;
}

interface TransformPanelTransformFacade {
  transform: TransformState['transform'];
  setTransform: TransformState['setTransform'];
  resetTransform: TransformState['resetTransform'];
}

interface TransformPanelUiFacade {
  showGizmo: boolean;
  toggleGizmo: UIState['toggleGizmo'];
}

interface TransformPanelActionFacade {
  applyTransformPreset: typeof applyTransformPreset;
  applyTransformToData: typeof applyTransformToData;
}

export interface TransformPanelStoreFacade {
  data: TransformPanelDataFacade;
  transform: TransformPanelTransformFacade;
  ui: TransformPanelUiFacade;
  actions: TransformPanelActionFacade;
}

export function useTransformPanelStoreFacade(): TransformPanelStoreFacade {
  const reconstruction = useReconstructionStore((s) => s.reconstruction);
  const wasmReconstruction = useReconstructionStore((s) => s.wasmReconstruction);
  const droppedFiles = useReconstructionStore((s) => s.droppedFiles);

  const transform = useTransformStore((s) => s.transform);
  const setTransform = useTransformStore((s) => s.setTransform);
  const resetTransform = useTransformStore((s) => s.resetTransform);

  const showGizmo = useUIStore((s) => s.showGizmo);
  const toggleGizmo = useUIStore((s) => s.toggleGizmo);

  return {
    data: {
      reconstruction,
      wasmReconstruction,
      droppedFiles,
    },
    transform: {
      transform,
      setTransform,
      resetTransform,
    },
    ui: {
      showGizmo,
      toggleGizmo,
    },
    actions: {
      applyTransformPreset,
      applyTransformToData,
    },
  };
}
