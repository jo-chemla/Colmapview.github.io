import { describe, expect, it } from 'vitest';
import type { ContextMenuAction, PointPickingMode } from '../../../store';
import { CONTEXT_MENU_ACTIONS } from '../contextMenu/contextMenuActions';
import {
  ALIGN_GOALS,
  ALIGN_PANEL_IDLE_HINT,
  ALIGN_PANEL_IDLE_TOOLTIP,
  applyAlignPickingActivation,
  getAlignPanelState,
  getAlignPickingActivation,
  getAlignPickingButtonState,
  getAlignToolLabel,
  type AlignAutomaticAction,
} from './alignPanelViewModel';

const idleInput = {
  pickingMode: 'off',
  hasPendingTransform: false,
  hasPoints: false,
} as const;

/**
 * Which context-menu entry each align operation is the second entry point for.
 * A `Record` over both id unions, so adding a goal half without deciding which
 * menu entry it mirrors is a type error rather than an untested label.
 */
const MENU_ACTION_BY_ALIGN_ID: Record<
  AlignAutomaticAction | Exclude<PointPickingMode, 'off'>,
  ContextMenuAction
> = {
  centerAtOrigin: 'centerAtOrigin',
  floorDetection: 'openFloorDetection',
  'origin-1pt': 'onePointOrigin',
  'distance-2pt': 'twoPointScale',
  'normal-3pt': 'threePointAlign',
};

describe('align panel view-model helpers', () => {
  it('groups the goals in panel order, each with its automatic half and its pick tool', () => {
    expect(ALIGN_GOALS).toEqual([
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
        // No automatic half on purpose: normalizing to a unit bounding box is
        // not a scale anyone asked for.
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
    ]);
  });

  // ALIGN_GOALS claims in prose that its labels match the context menu's. Assert
  // that against CONTEXT_MENU_ACTIONS itself: re-typed literals would let a
  // rename on either side ship with the two surfaces naming one operation two
  // ways and every test still green. Same contract idiom as classContract and
  // sparkImportBoundary.
  it('labels every operation exactly as the context menu labels it', () => {
    const alignLabels = Object.fromEntries(
      ALIGN_GOALS.flatMap((goal) => [
        ...(goal.automatic ? [[goal.automatic.action, goal.automatic.label] as const] : []),
        [goal.pick.mode, goal.pick.label] as const,
      ])
    );
    const menuLabels = Object.fromEntries(
      Object.entries(MENU_ACTION_BY_ALIGN_ID).map(([alignId, menuId]) => [
        alignId,
        CONTEXT_MENU_ACTIONS.find((action) => action.id === menuId)?.label,
      ])
    );

    expect(alignLabels).toEqual(menuLabels);
  });

  it('names the armed tool, and nothing when picking is off', () => {
    expect(getAlignToolLabel('off')).toBeNull();
    expect(getAlignToolLabel('origin-1pt')).toBe('1-Point Origin');
    expect(getAlignToolLabel('distance-2pt')).toBe('2-Point Scale');
    expect(getAlignToolLabel('normal-3pt')).toBe('3-Point Align');
  });

  it('describes the idle button as an entry point', () => {
    expect(getAlignPanelState(idleInput)).toEqual({
      tooltip: ALIGN_PANEL_IDLE_TOOLTIP,
      hint: ALIGN_PANEL_IDLE_HINT,
      isPicking: false,
      activeToolLabel: null,
      hasChanges: false,
      canApplyTransform: false,
      canResetTransform: false,
      canRunFloorDetection: false,
    });
  });

  it('turns the button into the armed tool cancel affordance while picking', () => {
    expect(getAlignPanelState({ ...idleInput, pickingMode: 'normal-3pt' })).toMatchObject({
      tooltip: 'Align: 3-Point Align (click to cancel)',
      hint: '3-Point Align is armed — click points in the viewport, or press Esc to cancel.',
      isPicking: true,
      activeToolLabel: '3-Point Align',
    });
  });

  it('carries the shared transform commit state, so Reset/Apply match the Transform panel', () => {
    expect(getAlignPanelState({
      ...idleInput,
      hasPendingTransform: true,
    })).toMatchObject({
      hasChanges: true,
      canApplyTransform: true,
      canResetTransform: true,
    });
  });

  it('gates floor detection on the reconstruction actually having points', () => {
    expect(getAlignPanelState(idleInput).canRunFloorDetection).toBe(false);
    expect(getAlignPanelState({ ...idleInput, hasPoints: true }).canRunFloorDetection).toBe(true);
  });

  it('lights the armed tool row and makes its next click the off-switch', () => {
    expect(getAlignPickingButtonState('origin-1pt', 'origin-1pt')).toEqual({
      isActive: true,
      nextMode: 'off',
    });
    expect(getAlignPickingButtonState('distance-2pt', 'origin-1pt')).toEqual({
      isActive: false,
      nextMode: 'origin-1pt',
    });
    expect(getAlignPickingButtonState('off', 'normal-3pt')).toEqual({
      isActive: false,
      nextMode: 'normal-3pt',
    });
  });

  it('forces the point cloud pickable when arming a tool', () => {
    expect(getAlignPickingActivation({
      nextMode: 'origin-1pt',
      showPointCloud: false,
      colorMode: 'trackLength',
    })).toEqual({
      pickingMode: 'origin-1pt',
      showPointCloud: true,
      colorMode: 'rgb',
    });

    expect(getAlignPickingActivation({
      nextMode: 'distance-2pt',
      showPointCloud: true,
      colorMode: 'splats',
    })).toEqual({
      pickingMode: 'distance-2pt',
      showPointCloud: null,
      colorMode: 'splatPoints',
    });
  });

  it('leaves an already-pickable point cloud untouched', () => {
    expect(getAlignPickingActivation({
      nextMode: 'normal-3pt',
      showPointCloud: true,
      colorMode: 'rgb',
    })).toEqual({
      pickingMode: 'normal-3pt',
      showPointCloud: null,
      colorMode: null,
    });

    // Already swapped to splat points by an earlier arming: nothing left to do.
    expect(getAlignPickingActivation({
      nextMode: 'origin-1pt',
      showPointCloud: true,
      colorMode: 'splatPoints',
    })).toEqual({
      pickingMode: 'origin-1pt',
      showPointCloud: null,
      colorMode: null,
    });
  });

  it('never changes point cloud state when disarming', () => {
    expect(getAlignPickingActivation({
      nextMode: 'off',
      showPointCloud: false,
      colorMode: 'splats',
    })).toEqual({
      pickingMode: 'off',
      showPointCloud: null,
      colorMode: null,
    });
  });
});

describe('applyAlignPickingActivation', () => {
  it('applies every non-null field, visibility before mode', () => {
    const calls: string[] = [];
    applyAlignPickingActivation(
      { pickingMode: 'origin-1pt', showPointCloud: true, colorMode: 'rgb' },
      {
        setShowPointCloud: (visible) => calls.push(`show:${visible}`),
        setColorMode: (mode) => calls.push(`color:${mode}`),
        setPickingMode: (mode) => calls.push(`mode:${mode}`),
      }
    );
    expect(calls).toEqual(['show:true', 'color:rgb', 'mode:origin-1pt']);
  });

  it('skips the null fields so disarming touches nothing but the mode', () => {
    const calls: string[] = [];
    applyAlignPickingActivation(
      { pickingMode: 'off', showPointCloud: null, colorMode: null },
      {
        setShowPointCloud: () => calls.push('show'),
        setColorMode: () => calls.push('color'),
        setPickingMode: (mode) => calls.push(`mode:${mode}`),
      }
    );
    expect(calls).toEqual(['mode:off']);
  });
});
