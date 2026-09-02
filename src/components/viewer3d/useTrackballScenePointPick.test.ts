import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  canReuseScenePick,
  findNearestScenePointHit,
  SCENE_PICK_REUSE_MAX_AGE_MS,
  SCENE_PICK_REUSE_MAX_DISTANCE_PX,
} from './useTrackballScenePointPick';

function buildHit(overrides: Partial<THREE.Intersection>): THREE.Intersection {
  return {
    distance: 1,
    point: new THREE.Vector3(),
    object: new THREE.Points(),
    index: 0,
    ...overrides,
  } as THREE.Intersection;
}

describe('findNearestScenePointHit', () => {
  it('returns the hit closest to the ray, not the closest to the camera', () => {
    const nearRay = new THREE.Vector3(1, 2, 3);
    const hits = [
      buildHit({ distance: 1, distanceToRay: 0.5, point: new THREE.Vector3(9, 9, 9) }),
      buildHit({ distance: 5, distanceToRay: 0.1, point: nearRay }),
    ];

    const result = findNearestScenePointHit(hits);

    expect(result?.toArray()).toEqual([1, 2, 3]);
    expect(result).not.toBe(nearRay); // cloned, safe to keep
  });

  it('ignores hits without a point index and returns null when nothing matches', () => {
    expect(findNearestScenePointHit([])).toBeNull();
    expect(findNearestScenePointHit([
      buildHit({ index: undefined, distanceToRay: 0.1 }),
    ])).toBeNull();
  });
});

describe('canReuseScenePick', () => {
  const cache = { x: 100, y: 100, time: 1000, point: null };

  it('reuses a fresh pick while the cursor stays within the pixel threshold', () => {
    expect(canReuseScenePick(cache, 104, 103, 1000 + SCENE_PICK_REUSE_MAX_AGE_MS)).toBe(true);
  });

  it('rejects stale, distant, or missing cache entries', () => {
    expect(canReuseScenePick(null, 100, 100, 1000)).toBe(false);
    expect(canReuseScenePick(cache, 100, 100, 1001 + SCENE_PICK_REUSE_MAX_AGE_MS)).toBe(false);
    expect(canReuseScenePick(cache, 100 + SCENE_PICK_REUSE_MAX_DISTANCE_PX + 1, 100, 1000)).toBe(false);
  });
});
