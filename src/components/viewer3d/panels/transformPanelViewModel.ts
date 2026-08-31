import type { Sim3dEuler } from '../../../types/sim3d';
import { isIdentityEuler } from '../../../utils/sim3dTransforms';

export interface TransformCommitState {
  hasChanges: boolean;
  canApplyTransform: boolean;
  canResetTransform: boolean;
}

/**
 * The pending-change copy, shown by BOTH panels under their Reset/Apply pair.
 * A constant rather than a literal per panel: the two would have to be edited
 * together, and only one of them was pinned by a test.
 */
export const TRANSFORM_PENDING_HINT =
  'Transform will be applied to reconstruction data when you click "Apply".';

/**
 * Zustand selector for "the scene has an uncommitted transform". Returning the
 * BOOLEAN rather than the transform is what keeps the Align panel out of the
 * gizmo's per-frame render loop: only the identity flip changes what that panel
 * draws, so a dragged gizmo re-renders it once, not once per frame.
 */
export function selectHasPendingTransform(state: { transform: Sim3dEuler }): boolean {
  return !isIdentityEuler(state.transform);
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
export function getTransformCommitState(hasPendingTransform: boolean): TransformCommitState {
  return {
    hasChanges: hasPendingTransform,
    canApplyTransform: hasPendingTransform,
    canResetTransform: hasPendingTransform,
  };
}

export function getTransformPanelState({
  transform,
  showGizmo,
  hasDroppedFiles,
}: TransformPanelStateInput): TransformPanelState {
  // This panel subscribes to the whole transform anyway — the sliders read every
  // component of it — so it applies the shared selector rather than duplicating
  // the subscription its facade would otherwise need.
  const commit = getTransformCommitState(selectHasPendingTransform({ transform }));
  const tooltip = `Transform (T): ${showGizmo ? 'On' : 'Off'}${commit.hasChanges ? ' (dbl-click to apply)' : ''}`;

  return {
    ...commit,
    canReloadDroppedFiles: hasDroppedFiles,
    tooltip,
  };
}
