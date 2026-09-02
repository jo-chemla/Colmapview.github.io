import type { MutableRefObject } from 'react';
import * as THREE from 'three';

export function moveCamera(camera: THREE.Camera, offset: THREE.Vector3): void {
  camera.position.add(offset);
}

export interface WheelZoomAboutPointOptions {
  camera: THREE.Camera;
  focus: THREE.Vector3;
  scale: number;
  targetVecRef: MutableRefObject<THREE.Vector3>;
  cameraQuatRef: MutableRefObject<THREE.Quaternion>;
  distanceRef: MutableRefObject<number>;
  targetDistanceRef: MutableRefObject<number>;
}

/**
 * Multiplicative zoom about a picked focus point (orbit + perspective only):
 * scales the orbit pivot AND the camera distance about the focus. Because the
 * orientation is unchanged and position = pivot + quat·(0,0,distance), scaling
 * both by the same factor is exactly scaling the camera position about the focus,
 * so the picked point stays under the cursor. No minDistance floor here — the
 * step is a fixed fraction of the remaining distance, so it converges without
 * ever reaching the surface (empty-space fallback keeps the classic floor).
 */
export function applyWheelZoomAboutPoint({
  camera,
  focus,
  scale,
  targetVecRef,
  cameraQuatRef,
  distanceRef,
  targetDistanceRef,
}: WheelZoomAboutPointOptions): void {
  targetVecRef.current.sub(focus).multiplyScalar(scale).add(focus);

  const nextDistance = distanceRef.current * scale;
  distanceRef.current = nextDistance;
  targetDistanceRef.current = nextDistance;

  camera.position
    .copy(targetVecRef.current)
    .add(new THREE.Vector3(0, 0, nextDistance).applyQuaternion(cameraQuatRef.current));
}

export function setOrthographicZoom(camera: THREE.OrthographicCamera, zoom: number): void {
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
}
