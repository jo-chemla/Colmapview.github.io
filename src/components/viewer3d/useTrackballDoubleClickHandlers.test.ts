import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  buildDoubleClickPivotAnimation,
  DOUBLE_CLICK_PIVOT_DOLLY_FACTOR,
  DOUBLE_CLICK_PIVOT_DURATION_MS,
  handleTrackballDoubleClick,
  isDoubleClickDrag,
  type TrackballDoubleClickEventOptions,
} from './useTrackballDoubleClickHandlers';

function ref<T>(current: T) {
  return { current };
}

function createOptions(
  overrides: Partial<TrackballDoubleClickEventOptions> = {}
): TrackballDoubleClickEventOptions {
  return {
    event: new MouseEvent('dblclick', { clientX: 50, clientY: 60 }),
    camera: new THREE.PerspectiveCamera(),
    cameraMode: 'orbit' as const,
    pickingMode: 'off',
    pickScenePoint: () => new THREE.Vector3(1, 2, 3),
    targetVecRef: ref(new THREE.Vector3(0, 0, 0)),
    cameraQuatRef: ref(new THREE.Quaternion()),
    distanceRef: ref(10),
    angularVelocityRef: ref({ x: 0.5, y: 0.5 }),
    animationTargetRef: ref(null),
    enabledRef: ref(true),
    downPositionsRef: ref({ prev: { x: 50, y: 60 }, last: { x: 51, y: 61 } }),
    navActions: {
      clearNavigationHistory: vi.fn(),
    },
    ...overrides,
  };
}

describe('isDoubleClickDrag', () => {
  it('flags click pairs further apart than the drag threshold', () => {
    expect(isDoubleClickDrag({ prev: { x: 0, y: 0 }, last: { x: 3, y: 4 } })).toBe(false);
    expect(isDoubleClickDrag({ prev: { x: 0, y: 0 }, last: { x: 6, y: 0 } })).toBe(true);
    expect(isDoubleClickDrag({ prev: null, last: { x: 0, y: 0 } })).toBe(false);
  });
});

describe('buildDoubleClickPivotAnimation', () => {
  it('targets the picked point with a partial dolly using the current orientation', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const point = new THREE.Vector3(2, 0, 0);

    const animation = buildDoubleClickPivotAnimation({
      camera,
      target: new THREE.Vector3(0, 0, 0),
      quaternion: new THREE.Quaternion(),
      distance: 10,
      point,
    });

    expect(animation.endTarget.toArray()).toEqual([2, 0, 0]);
    expect(animation.endTarget).not.toBe(point);
    expect(animation.endDistance).toBeCloseTo(10 * DOUBLE_CLICK_PIVOT_DOLLY_FACTOR, 10);
    expect(animation.endPosition.toArray()).toEqual([2, 0, 6]);
    expect(animation.duration).toBe(DOUBLE_CLICK_PIVOT_DURATION_MS);
    expect(animation.startPosition.toArray()).toEqual([0, 0, 10]);
  });
});

describe('handleTrackballDoubleClick', () => {
  it('starts the re-pivot animation and clears momentum on a clean double-click', () => {
    const options = createOptions();

    handleTrackballDoubleClick(options);

    expect(options.animationTargetRef.current?.endTarget.toArray()).toEqual([1, 2, 3]);
    expect(options.angularVelocityRef.current).toEqual({ x: 0, y: 0 });
    expect(options.navActions.clearNavigationHistory).toHaveBeenCalledOnce();
  });

  it('does nothing when no point resolves under the cursor', () => {
    const options = createOptions({ pickScenePoint: () => null });

    handleTrackballDoubleClick(options);

    expect(options.animationTargetRef.current).toBeNull();
    expect(options.navActions.clearNavigationHistory).not.toHaveBeenCalled();
  });

  it('ignores drags, fly mode, picking modes, and disabled controls', () => {
    const dragged = createOptions({
      downPositionsRef: ref({ prev: { x: 0, y: 0 }, last: { x: 20, y: 0 } }),
    });
    handleTrackballDoubleClick(dragged);
    expect(dragged.animationTargetRef.current).toBeNull();

    const flying = createOptions({ cameraMode: 'fly' as const });
    handleTrackballDoubleClick(flying);
    expect(flying.animationTargetRef.current).toBeNull();

    const picking = createOptions({ pickingMode: 'distance' });
    handleTrackballDoubleClick(picking);
    expect(picking.animationTargetRef.current).toBeNull();

    const disabled = createOptions({ enabledRef: ref(false) });
    handleTrackballDoubleClick(disabled);
    expect(disabled.animationTargetRef.current).toBeNull();
  });
});
