import { useEffect, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useLatestRef } from '../../hooks/useLatestRef';
import type { CameraMode } from '../../store/types';
import { getPointDistance } from './trackballControlsViewModel';
import type { XYValue } from './trackballPointerHandlers';
import type { TrackballAnimationTarget } from './useTrackballFlyTo';
import type { ScenePointPick } from './useTrackballScenePointPick';

// Double-click re-pivot: the orbit target jumps to the picked point-cloud point
// and the camera eases partially toward it (dolly ~40% closer) via the existing
// fly-to animation mechanism in the frame loop.
export const DOUBLE_CLICK_PIVOT_DOLLY_FACTOR = 0.6;
export const DOUBLE_CLICK_PIVOT_DURATION_MS = 400;
export const DOUBLE_CLICK_MAX_DRAG_PX = 5;

export interface DoubleClickDownPositions {
  prev: XYValue | null;
  last: XYValue | null;
}

// A dblclick fired after the pointer dragged between the two clicks is an orbit
// gesture artifact, not an intentional re-pivot — compare the two pointerdown
// positions and ignore the event when they are more than the threshold apart.
export function isDoubleClickDrag(
  positions: DoubleClickDownPositions,
  maxDragPx = DOUBLE_CLICK_MAX_DRAG_PX
): boolean {
  if (!positions.prev || !positions.last) return false;
  return getPointDistance(positions.prev, positions.last) > maxDragPx;
}

export interface DoubleClickPivotAnimationOptions {
  camera: THREE.Camera;
  target: THREE.Vector3;
  quaternion: THREE.Quaternion;
  distance: number;
  point: THREE.Vector3;
  dollyFactor?: number;
  durationMs?: number;
}

export function buildDoubleClickPivotAnimation({
  camera,
  target,
  quaternion,
  distance,
  point,
  dollyFactor = DOUBLE_CLICK_PIVOT_DOLLY_FACTOR,
  durationMs = DOUBLE_CLICK_PIVOT_DURATION_MS,
}: DoubleClickPivotAnimationOptions): TrackballAnimationTarget {
  const endDistance = distance * dollyFactor;
  const endTarget = point.clone();
  const endPosition = endTarget.clone()
    .add(new THREE.Vector3(0, 0, endDistance).applyQuaternion(quaternion));

  return {
    startPosition: camera.position.clone(),
    startQuaternion: camera.quaternion.clone(),
    startTarget: target.clone(),
    startDistance: distance,
    endPosition,
    endQuaternion: quaternion.clone(),
    endTarget,
    endDistance,
    startTime: performance.now(),
    duration: durationMs,
  };
}

export interface TrackballDoubleClickHandlersOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  cameraMode: CameraMode;
  pickingMode: string;
  pickScenePoint: ScenePointPick;
  targetVecRef: MutableRefObject<THREE.Vector3>;
  cameraQuatRef: MutableRefObject<THREE.Quaternion>;
  distanceRef: MutableRefObject<number>;
  angularVelocityRef: MutableRefObject<XYValue>;
  animationTargetRef: MutableRefObject<TrackballAnimationTarget | null>;
  enabledRef: MutableRefObject<boolean>;
  downPositionsRef: MutableRefObject<DoubleClickDownPositions>;
  navActions: {
    clearNavigationHistory: () => void;
  };
}

export interface TrackballDoubleClickEventOptions extends Omit<TrackballDoubleClickHandlersOptions, 'canvas'> {
  event: MouseEvent;
}

export function handleTrackballDoubleClick({
  event,
  camera,
  cameraMode,
  pickingMode,
  pickScenePoint,
  targetVecRef,
  cameraQuatRef,
  distanceRef,
  angularVelocityRef,
  animationTargetRef,
  enabledRef,
  downPositionsRef,
  navActions,
}: TrackballDoubleClickEventOptions): void {
  if (!enabledRef.current) return;
  // Re-pivot only makes sense while orbiting; measurement picking modes own clicks.
  if (cameraMode !== 'orbit' || pickingMode !== 'off') return;
  if (isDoubleClickDrag(downPositionsRef.current)) return;

  const point = pickScenePoint(event.clientX, event.clientY);
  if (!point) return;

  navActions.clearNavigationHistory();
  angularVelocityRef.current.x = 0;
  angularVelocityRef.current.y = 0;
  animationTargetRef.current = buildDoubleClickPivotAnimation({
    camera,
    target: targetVecRef.current,
    quaternion: cameraQuatRef.current,
    distance: distanceRef.current,
    point,
  });
}

export function useTrackballDoubleClickHandlers(
  options: Omit<TrackballDoubleClickHandlersOptions, 'downPositionsRef'>
): void {
  const downPositionsRef = useRef<DoubleClickDownPositions>({ prev: null, last: null });
  const handlerOptionsRef = useLatestRef<TrackballDoubleClickHandlersOptions>({
    ...options,
    downPositionsRef,
  });
  const canvas = options.canvas;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const positions = downPositionsRef.current;
      positions.prev = positions.last;
      positions.last = { x: event.clientX, y: event.clientY };
    };
    const onDoubleClick = (event: MouseEvent) => {
      handleTrackballDoubleClick({ event, ...handlerOptionsRef.current });
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('dblclick', onDoubleClick);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('dblclick', onDoubleClick);
    };
  }, [canvas, handlerOptionsRef]);
}
