import type { ColorMode, PointPickingMode } from '../../../store';
import { getPointCloudStateForPickingMode } from './transformPanelViewModel';

type ActiveAlignPickingMode = Exclude<PointPickingMode, 'off'>;

export interface AlignToolDescriptor {
  mode: ActiveAlignPickingMode;
  label: string;
  tooltip: string;
}

/**
 * The point-picking alignment tools, in the order the context menu lists them.
 * Labels and tooltips intentionally match the context-menu entries and the
 * Transform panel presets: these are alternative entry points into the same
 * store actions, not a second set of tools.
 */
export const ALIGN_TOOLS: readonly AlignToolDescriptor[] = [
  {
    mode: 'origin-1pt',
    label: '1-Point Origin',
    tooltip: '{LMB} Click 1 point to set as origin (0,0,0)',
  },
  {
    mode: 'distance-2pt',
    label: '2-Point Scale',
    tooltip: '{LMB} Click 2 points, set target distance',
  },
  {
    mode: 'normal-3pt',
    label: '3-Point Align',
    tooltip: '{LMB} Click 3 points clockwise to align plane with Y-up',
  },
];

export const ALIGN_PANEL_IDLE_TOOLTIP = 'Align tools';
export const ALIGN_PANEL_IDLE_HINT =
  'Pick points in the viewport to set the origin, scale the scene, or level it.';

export interface AlignPanelState {
  tooltip: string;
  hint: string;
  isPicking: boolean;
  activeToolLabel: string | null;
}

export interface AlignPickingActivation {
  pickingMode: PointPickingMode;
  /** Non-null only when the point cloud has to be shown/hidden to make points pickable. */
  showPointCloud: boolean | null;
  /** Non-null only when the color mode has to change to make points pickable. */
  colorMode: ColorMode | null;
}

export function getAlignToolLabel(pickingMode: PointPickingMode): string | null {
  return ALIGN_TOOLS.find((tool) => tool.mode === pickingMode)?.label ?? null;
}

/**
 * Toolbar button + panel copy for the align tools. While a tool is armed the
 * button doubles as its off-switch, which is the only mouse-reachable cancel:
 * the right-click menu is taken over by point picking while a mode is active.
 */
export function getAlignPanelState(pickingMode: PointPickingMode): AlignPanelState {
  const activeToolLabel = getAlignToolLabel(pickingMode);

  if (!activeToolLabel) {
    return {
      tooltip: ALIGN_PANEL_IDLE_TOOLTIP,
      hint: ALIGN_PANEL_IDLE_HINT,
      isPicking: false,
      activeToolLabel: null,
    };
  }

  return {
    tooltip: `Align: ${activeToolLabel} (click to cancel)`,
    hint: `${activeToolLabel} is armed — click points in the viewport, or press Esc to cancel.`,
    isPicking: true,
    activeToolLabel,
  };
}

/**
 * Arming a picking tool must also make points pickable — the context menu and
 * the Transform panel both force the point cloud visible and swap the splats
 * color mode before setting the mode. Reuses that shared helper so the align
 * panel cannot drift into silently arming a tool with nothing to click.
 */
export function getAlignPickingActivation({
  nextMode,
  showPointCloud,
  colorMode,
}: {
  nextMode: PointPickingMode;
  showPointCloud: boolean;
  colorMode: ColorMode;
}): AlignPickingActivation {
  if (nextMode === 'off') {
    return { pickingMode: 'off', showPointCloud: null, colorMode: null };
  }

  const pickable = getPointCloudStateForPickingMode({ showPointCloud, colorMode });

  return {
    pickingMode: nextMode,
    showPointCloud: pickable.showPointCloud === showPointCloud ? null : pickable.showPointCloud,
    colorMode: pickable.colorMode === colorMode ? null : pickable.colorMode,
  };
}
