import type { Sim3dEuler } from '../../../types/sim3d';
import { isIdentityEuler } from '../../../utils/sim3dTransforms';

export interface TransformPanelState {
  hasChanges: boolean;
  canApplyTransform: boolean;
  canResetTransform: boolean;
  canReloadDroppedFiles: boolean;
  canRunFloorDetection: boolean;
  tooltip: string;
}

export interface TransformPanelStateInput {
  transform: Sim3dEuler;
  showGizmo: boolean;
  hasPoints: boolean;
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

export function getTransformPanelState({
  transform,
  showGizmo,
  hasPoints,
  hasDroppedFiles,
}: TransformPanelStateInput): TransformPanelState {
  const hasChanges = !isIdentityEuler(transform);
  const tooltip = `Transform (T): ${showGizmo ? 'On' : 'Off'}${hasChanges ? ' (dbl-click to apply)' : ''}`;

  return {
    hasChanges,
    canApplyTransform: hasChanges,
    canResetTransform: hasChanges,
    canReloadDroppedFiles: hasDroppedFiles,
    canRunFloorDetection: hasPoints,
    tooltip,
  };
}
