import { describe, expect, it } from 'vitest';
import type { Sim3dEuler } from '../../../types/sim3d';
import {
  degreesToRadians,
  formatTransformDegreesValue,
  formatTransformScaleValue,
  formatTransformTranslationValue,
  getTransformCommitState,
  getTransformPanelState,
  radiansToDegrees,
  selectHasPendingTransform,
} from './transformPanelViewModel';

const identityTransform: Sim3dEuler = {
  scale: 1,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  translationX: 0,
  translationY: 0,
  translationZ: 0,
};

describe('transform panel view-model helpers', () => {
  it('converts between radians and degrees for slider display', () => {
    expect(radiansToDegrees(Math.PI)).toBeCloseTo(180);
    expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90);
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
    expect(degreesToRadians(-90)).toBeCloseTo(-Math.PI / 2);
  });

  it('formats transform slider values', () => {
    expect(formatTransformScaleValue(1)).toBe('1.00');
    expect(formatTransformScaleValue(1.234)).toBe('1.23');
    expect(formatTransformDegreesValue(32.6)).toBe('33°');
    expect(formatTransformTranslationValue(-2.34)).toBe('-2.3');
  });

  it('disables transform actions when the transform is unchanged', () => {
    expect(getTransformPanelState({
      transform: identityTransform,
      showGizmo: false,
      hasDroppedFiles: false,
    })).toEqual({
      hasChanges: false,
      canApplyTransform: false,
      canResetTransform: false,
      canReloadDroppedFiles: false,
      tooltip: 'Transform (T): Off',
    });
  });

  it('enables transform actions when the transform is changed', () => {
    expect(getTransformPanelState({
      transform: { ...identityTransform, translationX: 0.5 },
      showGizmo: true,
      hasDroppedFiles: true,
    })).toEqual({
      hasChanges: true,
      canApplyTransform: true,
      canResetTransform: true,
      canReloadDroppedFiles: true,
      tooltip: 'Transform (T): On (dbl-click to apply)',
    });
  });
});

describe('getTransformCommitState', () => {
  it('gates Reset and Apply on there being a pending transform', () => {
    expect(getTransformCommitState(false)).toEqual({
      hasChanges: false,
      canApplyTransform: false,
      canResetTransform: false,
    });
    expect(getTransformCommitState(true)).toEqual({
      hasChanges: true,
      canApplyTransform: true,
      canResetTransform: true,
    });
  });

  it('is the same state the transform panel renders, so both panels agree', () => {
    // Reset/Apply now appear in the Transform panel AND the Align panel over the
    // one transformStore value. If these ever disagree, one panel offers Apply
    // while the other refuses it for the same scene.
    const transform = { ...identityTransform, rotationZ: 0.25 };
    const commit = getTransformCommitState(selectHasPendingTransform({ transform }));
    expect(getTransformPanelState({
      transform,
      showGizmo: false,
      hasDroppedFiles: false,
    })).toMatchObject(commit);
  });
});

describe('selectHasPendingTransform', () => {
  it('reads identity as nothing pending, and any change as pending', () => {
    expect(selectHasPendingTransform({ transform: identityTransform })).toBe(false);
    expect(selectHasPendingTransform({ transform: { ...identityTransform, scale: 2 } })).toBe(true);
    expect(selectHasPendingTransform({ transform: { ...identityTransform, rotationY: -0.1 } })).toBe(true);
  });

  it('returns a primitive, so a subscriber re-renders on the flip and not per drag frame', () => {
    // The whole point of selecting the boolean: two different non-identity
    // transforms are the same value here, so no re-render between them.
    const first = selectHasPendingTransform({ transform: { ...identityTransform, translationX: 1 } });
    const second = selectHasPendingTransform({ transform: { ...identityTransform, translationX: 2 } });
    expect(typeof first).toBe('boolean');
    expect(Object.is(first, second)).toBe(true);
  });
});
