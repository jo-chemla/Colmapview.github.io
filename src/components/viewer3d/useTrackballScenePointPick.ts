import { useCallback, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePointCloudStore } from '../../store';
import { syncPointRaycasterThreshold } from '../../utils/threeObjectMutations';

/** Resolves the point-cloud point under a client-space cursor position (null over empty space). */
export type ScenePointPick = (clientX: number, clientY: number) => THREE.Vector3 | null;

export interface ScenePickCacheEntry {
  x: number;
  y: number;
  time: number;
  point: THREE.Vector3 | null;
}

// Wheel events fire far faster than a full point-cloud raycast can run, so wheel
// zoom reuses the previous pick (hit OR miss) while the cursor stays near it and
// the pick is still fresh.
export const SCENE_PICK_REUSE_MAX_DISTANCE_PX = 8;
export const SCENE_PICK_REUSE_MAX_AGE_MS = 300;

export function canReuseScenePick(
  cache: ScenePickCacheEntry | null,
  clientX: number,
  clientY: number,
  now: number,
  maxDistancePx = SCENE_PICK_REUSE_MAX_DISTANCE_PX,
  maxAgeMs = SCENE_PICK_REUSE_MAX_AGE_MS
): boolean {
  if (!cache) return false;
  if (now - cache.time > maxAgeMs) return false;

  const dx = clientX - cache.x;
  const dy = clientY - cache.y;
  return dx * dx + dy * dy <= maxDistancePx * maxDistancePx;
}

// Mirrors usePointPicking's nearest-point resolution: intersections are sorted by
// camera distance, not by distance to the ray, so scan them ALL and keep the hit
// closest to the ray.
export function findNearestScenePointHit(intersections: THREE.Intersection[]): THREE.Vector3 | null {
  let closestDist = Infinity;
  let closestPoint: THREE.Vector3 | null = null;

  for (const hit of intersections) {
    if (hit.index === undefined) continue;

    const dist = hit.distanceToRay ?? Infinity;
    if (dist < closestDist) {
      closestDist = dist;
      closestPoint = hit.point;
    }
  }

  return closestPoint ? closestPoint.clone() : null;
}

function collectVisiblePointsObjects(scene: THREE.Scene): THREE.Object3D[] {
  const targets: THREE.Object3D[] = [];
  scene.traverseVisible((object) => {
    if ((object as THREE.Points).isPoints) targets.push(object);
  });
  return targets;
}

/**
 * Point-cloud pick shared by the camera controls (double-click re-pivot, wheel
 * zoom-to-cursor). Uses a dedicated raycaster with the same Points threshold as
 * the measurement point-picking tools, so it never clobbers the shared r3f
 * raycaster they tune.
 */
export function useTrackballScenePointPick(): ScenePointPick {
  const { camera, gl, scene } = useThree();
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const ndcRef = useRef(new THREE.Vector2());

  return useCallback((clientX: number, clientY: number) => {
    raycasterRef.current ??= new THREE.Raycaster();
    const raycaster = raycasterRef.current;

    const rect = gl.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const targets = collectVisiblePointsObjects(scene);
    if (targets.length === 0) return null;

    ndcRef.current.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    syncPointRaycasterThreshold(raycaster, usePointCloudStore.getState().pointSize * 0.3);
    raycaster.setFromCamera(ndcRef.current, camera);

    return findNearestScenePointHit(raycaster.intersectObjects(targets, false));
  }, [camera, gl, scene]);
}

/** Wraps a pick with the reuse cache above (for rapid-fire wheel events). */
export function useCachedScenePointPick(pickScenePoint: ScenePointPick): ScenePointPick {
  const cacheRef = useRef<ScenePickCacheEntry | null>(null);

  return useCallback((clientX: number, clientY: number) => {
    const now = performance.now();
    if (canReuseScenePick(cacheRef.current, clientX, clientY, now)) {
      return cacheRef.current!.point;
    }

    const point = pickScenePoint(clientX, clientY);
    cacheRef.current = { x: clientX, y: clientY, time: now, point };
    return point;
  }, [pickScenePoint]);
}
