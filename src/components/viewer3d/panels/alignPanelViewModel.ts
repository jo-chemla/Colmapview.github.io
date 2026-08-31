import type { ColorMode, PointPickingMode } from '../../../store';
import { getNextPickingMode } from '../contextMenu/globalContextMenuActionPolicy';
import {
  getTransformCommitState,
  type TransformCommitState,
} from './transformPanelViewModel';

type ActiveAlignPickingMode = Exclude<PointPickingMode, 'off'>;

export interface AlignToolDescriptor {
  mode: ActiveAlignPickingMode;
  label: string;
  tooltip: string;
}

/** The automatic operations the panel can run. Each one needs its own handler. */
export type AlignAutomaticAction = 'centerAtOrigin' | 'floorDetection';

export interface AlignAutomaticDescriptor {
  action: AlignAutomaticAction;
  label: string;
  tooltip: string;
}

export interface AlignGoalDescriptor {
  /** What the user is trying to achieve — the group's caption. */
  goal: string;
  /** The compute-it-for-me half. `null` where no automatic method exists yet. */
  automatic: AlignAutomaticDescriptor | null;
  /** The pick-points half. Every goal has one. */
  pick: AlignToolDescriptor;
}

/**
 * The panel's structure: one group per GOAL, each listing the ways to reach it.
 * Both halves compute the same shared Sim3D transform, so grouping by goal is
 * what makes "Center at Origin" and "1-Point Origin" read as two methods rather
 * than two unrelated buttons — the naming collision that had them sitting in
 * different panels.
 *
 * Scale has no automatic half on purpose: normalizing to a unit bounding box is
 * not a scale anyone asked for, so only the measured 2-point method is offered.
 *
 * Labels and tooltips intentionally match the context-menu entries: the menu is
 * the only other entry point into these same store actions, not a second set of
 * tools.
 */
export const ALIGN_GOALS: readonly AlignGoalDescriptor[] = [
  {
    goal: 'Set the origin',
    automatic: {
      action: 'centerAtOrigin',
      label: 'Center at Origin',
      tooltip: 'Move scene center to (0,0,0)',
    },
    pick: {
      mode: 'origin-1pt',
      label: '1-Point Origin',
      tooltip: '{LMB} Click 1 point to set as origin (0,0,0)',
    },
  },
  {
    goal: 'Set the scale',
    automatic: null,
    pick: {
      mode: 'distance-2pt',
      label: '2-Point Scale',
      tooltip: '{LMB} Click 2 points, set target distance',
    },
  },
  {
    goal: 'Level the scene',
    automatic: {
      action: 'floorDetection',
      label: 'Floor Detection',
      tooltip: 'RANSAC floor plane detection',
    },
    pick: {
      mode: 'normal-3pt',
      label: '3-Point Align',
      tooltip: '{LMB} Click 3 points clockwise to align plane with Y-up',
    },
  },
];

/**
 * The point-picking tools alone, in the order the context menu lists them.
 * Projected from ALIGN_GOALS rather than listed again, so a tool cannot exist in
 * one place and not the other.
 */
export const ALIGN_TOOLS: readonly AlignToolDescriptor[] = ALIGN_GOALS.map((goal) => goal.pick);

export const ALIGN_PANEL_IDLE_TOOLTIP = 'Align tools';
// States the one thing the panel cannot show: every operation here COMPOSES
// onto the pending transform instead of replacing it or touching the data
// (applyTransformPreset, distanceInputModalViewModel and floorPlaneAlignmentPolicy
// all composeSim3d with the current transform), so several can be stacked before
// a single Apply. Earlier drafts named the goals or the methods, which the group
// captions and the button labels already say.
export const ALIGN_PANEL_IDLE_HINT =
  'Each result stacks onto the pending transform — combine several, then Apply once.';

export interface AlignPanelState extends TransformCommitState {
  tooltip: string;
  hint: string;
  isPicking: boolean;
  activeToolLabel: string | null;
  canRunFloorDetection: boolean;
}

export interface AlignPanelStateInput {
  pickingMode: PointPickingMode;
  /**
   * Whether the shared Sim3D transform every operation here writes is
   * uncommitted. A boolean, not the transform: see `selectHasPendingTransform`.
   */
  hasPendingTransform: boolean;
  /** RANSAC needs a point cloud to fit a plane to. */
  hasPoints: boolean;
}

export interface AlignPickingButtonState {
  isActive: boolean;
  nextMode: PointPickingMode;
}

interface PointCloudPickingVisibilityState {
  showPointCloud: boolean;
  colorMode: ColorMode;
}

export interface AlignPickingActivation {
  pickingMode: PointPickingMode;
  /** Non-null only when the point cloud has to be shown/hidden to make points pickable. */
  showPointCloud: boolean | null;
  /** Non-null only when the color mode has to change to make points pickable. */
  colorMode: ColorMode | null;
}

/** The three store setters an arming site must feed an activation into. */
export interface AlignPickingActivationSinks {
  setShowPointCloud: (visible: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
  setPickingMode: (mode: PointPickingMode) => void;
}

/**
 * The APPLY half of arming: getAlignPickingActivation owns the rule, this
 * owns feeding it into the stores. Both arming sites (AlignPanel and the
 * context-menu executor) MUST route through here — the rule being
 * centralized while the apply was copy-pasted is exactly how the two sites
 * could still drift (adding a field to AlignPickingActivation would silently
 * no-op at whichever site wasn't updated).
 */
export function applyAlignPickingActivation(
  activation: AlignPickingActivation,
  sinks: AlignPickingActivationSinks
): void {
  if (activation.showPointCloud !== null) {
    sinks.setShowPointCloud(activation.showPointCloud);
  }
  if (activation.colorMode !== null) {
    sinks.setColorMode(activation.colorMode);
  }
  sinks.setPickingMode(activation.pickingMode);
}

export function getAlignToolLabel(pickingMode: PointPickingMode): string | null {
  return ALIGN_TOOLS.find((tool) => tool.mode === pickingMode)?.label ?? null;
}

/**
 * Toolbar button + panel copy for the align tools, plus the commit state its
 * Reset/Apply pair shares with the Transform panel. While a tool is armed the
 * button doubles as its off-switch, which is the only mouse-reachable cancel:
 * the right-click menu is taken over by point picking while a mode is active.
 */
export function getAlignPanelState({
  pickingMode,
  hasPendingTransform,
  hasPoints,
}: AlignPanelStateInput): AlignPanelState {
  const activeToolLabel = getAlignToolLabel(pickingMode);
  const shared = {
    ...getTransformCommitState(hasPendingTransform),
    canRunFloorDetection: hasPoints,
  };

  if (!activeToolLabel) {
    return {
      ...shared,
      tooltip: ALIGN_PANEL_IDLE_TOOLTIP,
      hint: ALIGN_PANEL_IDLE_HINT,
      isPicking: false,
      activeToolLabel: null,
    };
  }

  return {
    ...shared,
    tooltip: `Align: ${activeToolLabel} (click to cancel)`,
    hint: `${activeToolLabel} is armed — click points in the viewport, or press Esc to cancel.`,
    isPicking: true,
    activeToolLabel,
  };
}

/** A tool row is lit while its own mode is armed, and disarms it when clicked again. */
export function getAlignPickingButtonState(
  currentMode: PointPickingMode,
  targetMode: ActiveAlignPickingMode
): AlignPickingButtonState {
  return {
    isActive: currentMode === targetMode,
    nextMode: getNextPickingMode(currentMode, targetMode),
  };
}

function getPointCloudStateForPickingMode({
  showPointCloud,
  colorMode,
}: PointCloudPickingVisibilityState): PointCloudPickingVisibilityState {
  if (!showPointCloud) {
    return { showPointCloud: true, colorMode: 'rgb' };
  }

  if (colorMode === 'splats') {
    return { showPointCloud: true, colorMode: 'splatPoints' };
  }

  return { showPointCloud, colorMode };
}

/**
 * Arming a picking tool must also make points pickable: splats are not
 * ray-castable and a hidden cloud offers nothing to click. Both arming sites —
 * this panel and the context menu — route through here, so the rule has exactly
 * one owner and neither can drift into arming a tool with nothing to click.
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
