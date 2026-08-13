import { describe, expect, it } from 'vitest';
import {
  ALIGN_PANEL_IDLE_HINT,
  ALIGN_PANEL_IDLE_TOOLTIP,
  ALIGN_TOOLS,
  getAlignPanelState,
  getAlignPickingActivation,
  getAlignToolLabel,
} from './alignPanelViewModel';

describe('align panel view-model helpers', () => {
  it('exposes exactly the three context-menu point-picking tools, in menu order', () => {
    expect(ALIGN_TOOLS.map((tool) => [tool.mode, tool.label])).toEqual([
      ['origin-1pt', '1-Point Origin'],
      ['distance-2pt', '2-Point Scale'],
      ['normal-3pt', '3-Point Align'],
    ]);
  });

  it('names the armed tool, and nothing when picking is off', () => {
    expect(getAlignToolLabel('off')).toBeNull();
    expect(getAlignToolLabel('origin-1pt')).toBe('1-Point Origin');
    expect(getAlignToolLabel('distance-2pt')).toBe('2-Point Scale');
    expect(getAlignToolLabel('normal-3pt')).toBe('3-Point Align');
  });

  it('describes the idle button as an entry point', () => {
    expect(getAlignPanelState('off')).toEqual({
      tooltip: ALIGN_PANEL_IDLE_TOOLTIP,
      hint: ALIGN_PANEL_IDLE_HINT,
      isPicking: false,
      activeToolLabel: null,
    });
  });

  it('turns the button into the armed tool cancel affordance while picking', () => {
    expect(getAlignPanelState('normal-3pt')).toEqual({
      tooltip: 'Align: 3-Point Align (click to cancel)',
      hint: '3-Point Align is armed — click points in the viewport, or press Esc to cancel.',
      isPicking: true,
      activeToolLabel: '3-Point Align',
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
