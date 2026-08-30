import type { Sim3dEuler } from '../../../types/sim3d';
import { isIdentityEuler } from '../../../utils/sim3dTransforms';

export interface TransformCommitState {
  hasChanges: boolean;
  canApplyTransform: boolean;
  canResetTransform: boolean;
}

export interface TransformPanelState extends TransformCommitState {
  canReloadDroppedFiles: boolean;
  tooltip: string;
}

export interface TransformPanelStateInput {
  transform: Sim3dEuler;
  showGizmo: boolean;
  hasDroppedFiles: boolean;
}

export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function formatTransformScaleValue(value: number): string {
  return value.toFixed(2);
}

export function formatTransformDegreesValue(value: number): string {
  return `${value.toFixed(0)}°`;
}

export function formatTransformTranslationValue(value: number): string {
  return value.toFixed(1);
}

/**
 * Reset/Apply readiness for the pending Sim3D transform. Both panels render
 * those two buttons — Transform for the hand-edited gizmo/slider value, Align
 * for whatever an alignment op computed — over the SAME `transformStore`
 * transform, so the rule has one owner here rather than a copy per panel that
 * could disagree about whether the scene has a pending change.
 */
export function getTransformCommitState(transform: Sim3dEuler): TransformCommitState {
  const hasChanges = !isIdentityEuler(transform);

  return {
    hasChanges,
    canApplyTransform: hasChanges,
    canResetTransform: hasChanges,
  };
}

export function getTransformPanelState({
  transform,
  showGizmo,
  hasDroppedFiles,
}: TransformPanelStateInput): TransformPanelState {
  const commit = getTransformCommitState(transform);
  const tooltip = `Transform (T): ${showGizmo ? 'On' : 'Off'}${commit.hasChanges ? ' (dbl-click to apply)' : ''}`;

  return {
    ...commit,
    canReloadDroppedFiles: hasDroppedFiles,
    tooltip,
  };
}
