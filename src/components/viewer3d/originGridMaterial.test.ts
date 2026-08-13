import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GRID_COLORS } from '../../theme';
import {
  ORIGIN_GRID_FRAGMENT_SHADER,
  ORIGIN_GRID_VERTEX_SHADER,
  createOriginGridMaterial,
  getOriginGridScale,
  updateOriginGridScale,
} from './originGridMaterial';

describe('origin grid material helpers', () => {
  it('calculates grid scale from scene size and user scale', () => {
    expect(getOriginGridScale(100, 1)).toBe(10);
    expect(getOriginGridScale(80, 0.5)).toBe(4);
  });

  it('creates a transparent double-sided shader material with grid uniforms', () => {
    const material = createOriginGridMaterial(12);

    expect(material.transparent).toBe(true);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.depthWrite).toBe(false);
    expect(material.vertexShader).toBe(ORIGIN_GRID_VERTEX_SHADER);
    expect(material.fragmentShader).toBe(ORIGIN_GRID_FRAGMENT_SHADER);
    expect(material.uniforms.uGridScale.value).toBe(12);
    expect((material.uniforms.uColor1.value as THREE.Color).getHexString()).toBe(
      new THREE.Color(GRID_COLORS.majorLines).getHexString()
    );
    expect((material.uniforms.uColor2.value as THREE.Color).getHexString()).toBe(
      new THREE.Color(GRID_COLORS.minorLines).getHexString()
    );

    material.dispose();
  });

  it('writes gl_FragColor without the colorspace chunk that GRID_COLORS compensates for', () => {
    // GRID_COLORS.majorLines/minorLines are deliberately ~a gamma light because this
    // shader never undoes THREE.Color's sRGB->linear conversion (see the comment on
    // GRID_COLORS in src/theme/colors.ts). Adding <colorspace_fragment> here would make
    // the grid glow on the dark canvas, and the failure is silent — no other test would
    // catch it. If you add the chunk on purpose, re-measure both literals first.
    expect(ORIGIN_GRID_FRAGMENT_SHADER).toContain('gl_FragColor = vec4(color, alpha);');
    expect(ORIGIN_GRID_FRAGMENT_SHADER).not.toContain('colorspace_fragment');
  });

  it('updates the existing scale uniform without replacing the material', () => {
    const material = createOriginGridMaterial(5);

    updateOriginGridScale(material, 18);

    expect(material.uniforms.uGridScale.value).toBe(18);
    material.dispose();
  });
});
