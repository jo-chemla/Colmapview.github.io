import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { applyWheelZoomAboutPoint, moveCamera, setOrthographicZoom } from './trackballCameraMutations';

describe('trackball camera mutations', () => {
  it('moves a camera by an offset vector', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 2, 3);

    moveCamera(camera, new THREE.Vector3(4, -1, 2));

    expect(camera.position.toArray()).toEqual([5, 1, 5]);
  });

  it('updates orthographic zoom and projection matrix', () => {
    const camera = new THREE.OrthographicCamera();
    const updateProjectionMatrix = vi.spyOn(camera, 'updateProjectionMatrix');

    setOrthographicZoom(camera, 2.5);

    expect(camera.zoom).toBe(2.5);
    expect(updateProjectionMatrix).toHaveBeenCalledOnce();
  });

  it('scales pivot and camera distance about the wheel focus point', () => {
    const camera = new THREE.PerspectiveCamera();
    const targetVecRef = { current: new THREE.Vector3(0, 0, 0) };
    const cameraQuatRef = { current: new THREE.Quaternion() };
    const distanceRef = { current: 10 };
    const targetDistanceRef = { current: 10 };
    const focus = new THREE.Vector3(10, 0, 0);

    applyWheelZoomAboutPoint({
      camera,
      focus,
      scale: 0.5,
      targetVecRef,
      cameraQuatRef,
      distanceRef,
      targetDistanceRef,
    });

    expect(targetVecRef.current.toArray()).toEqual([5, 0, 0]);
    expect(distanceRef.current).toBe(5);
    expect(targetDistanceRef.current).toBe(5);
    expect(camera.position.toArray()).toEqual([5, 0, 5]);
    expect(focus.toArray()).toEqual([10, 0, 0]); // focus itself untouched
  });
});
