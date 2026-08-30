import { describe, expect, it } from 'vitest';
import type { Sim3dEuler } from '../../../types/sim3d';
import {
  ALIGN_GOALS,
  ALIGN_PANEL_IDLE_HINT,
  ALIGN_PANEL_IDLE_TOOLTIP,
  ALIGN_TOOLS,
  applyAlignPickingActivation,
  getAlignPanelState,
  getAlignPickingActivation,
  getAlignPickingButtonState,
  getAlignToolLabel,
} from './alignPanelViewModel';

const identityTransform: Sim3dEuler = {
  scale: 1,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  translationX: 0,
  translationY: 0,
  translationZ: 0,
};

const idleInput = {
  pickingMode: 'off',
  transform: identityTransform,
  hasPoints: false,
} as const;

describe('align panel view-model helpers', () => {
  it('exposes exactly the three context-menu point-picking tools, in menu order', () => {
    expect(ALIGN_TOOLS.map((tool) => [tool.mode, tool.label])).toEqual([
      ['origin-1pt', '1-Point Origin'],
      ['distance-2pt', '2-Point Scale'],
      ['normal-3pt', '3-Point Align'],
    ]);
  });

  it('pairs each goal with its automatic half and its pick-points half', () => {
    expect(ALIGN_GOALS.map((goal) => [
      goal.goal,
      goal.automatic?.label ?? null,
      goal.pick.label,
    ])).toEqual([
      ['Set the origin', 'Center at Origin', '1-Point Origin'],
      ['Set the scale', null, '2-Point Scale'],
      ['Level the scene', 'Floor Detection', '3-Point Align'],
    ]);
  });

  it('keeps the tool list a projection of the goals, so the two cannot drift', () => {
    expect(ALIGN_TOOLS).toEqual(ALIGN_GOALS.map((goal) => goal.pick));
  });

  it('keeps the automatic labels and tooltips they had in the Transform panel', () => {
    expect(ALIGN_GOALS.map((goal) => goal.automatic).filter((a) => a !== null)).toEqual([
      {
        action: 'centerAtOrigin',
        label: 'Center at Origin',
        tooltip: 'Move scene center to (0,0,0)',
      },
      {
        action: 'floorDetection',
        label: 'Floor Detection',
        tooltip: 'RANSAC floor plane detection',
      },
    ]);
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
      transform: { ...identityTransform, translationY: -3 },
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
