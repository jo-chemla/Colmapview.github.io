import type { ConfirmationRequest } from '../../../utils/confirmation';

export const SETTINGS_PANEL_SECTION_LABELS = {
  profiles: 'Profiles',
  configuration: 'Configuration',
  customization: 'Customization',
  tools: 'Tools',
  developer: 'Developer',
} as const;

export const SETTINGS_CONFIG_DOWNLOAD = {
  filename: 'colmapview-config.yml',
  mimeType: 'text/yaml',
} as const;

export const SETTINGS_EXAMPLE_MANIFEST_DOWNLOAD = {
  filename: 'manifest.json',
  mimeType: 'application/json',
} as const;

export const CLEAR_SETTINGS_CONFIRMATION: ConfirmationRequest = {
  title: 'Clear settings?',
  message: 'This will clear all saved settings and reload the app.',
  confirmLabel: 'Clear',
  tone: 'danger',
  size: 'compact',
};

export const EXAMPLE_MANIFEST_DESCRIPTION = 'JSON file for loading COLMAP reconstructions from URLs.';

export function formatIdleHideTimeoutValue(timeoutSeconds: number): string {
  return timeoutSeconds === 0 ? 'Off' : `${timeoutSeconds}s`;
}

export function shouldShowAutoHideEditorButton(timeoutSeconds: number): boolean {
  return timeoutSeconds > 0;
}

export type SettingsToolId = 'deletion' | 'cameraConversion' | 'floorDetection' | 'autoHide';

export interface SettingsToolRow {
  id: SettingsToolId;
  label: string;
  /**
   * False renders the row disabled. Every tool window opens on a null
   * reconstruction without crashing, but it opens EMPTY — so the rows carry the
   * same preconditions their original entry points already enforce, rather than
   * offering a dead end from the landing page.
   */
  enabled: boolean;
}

export interface SettingsToolAvailability {
  /** Export panel gate: its whole button is disabled without a reconstruction. */
  hasReconstruction: boolean;
  /** Export panel gate: 'Convert Camera Model' only renders when cameras exist. */
  hasCameras: boolean;
  /** Transform panel gate for 'Floor Detection' (wasmReconstruction.hasPoints()). */
  hasPoints: boolean;
  idleHideTimeout: number;
}

export const SETTINGS_TOOL_LABELS: Record<SettingsToolId, string> = {
  deletion: 'Delete Images from Model',
  cameraConversion: 'Convert Camera Model',
  floorDetection: 'Floor Detection',
  // Predates the Tools section (it sat under Customization) and keeps its
  // wording; the window it opens is titled 'Auto-hide Elements'.
  autoHide: 'Auto-hide 3D Elements',
};

/**
 * The Settings panel's index of tool windows. These windows already have entry
 * points — Export owns deletion + camera conversion, Transform owns floor
 * detection — but each is buried behind an unrelated panel, so Settings lists
 * them in one place. Deliberate duplication: the original buttons stay exactly
 * where they are and fire the same store actions.
 */
export function getSettingsToolRows({
  hasReconstruction,
  hasCameras,
  hasPoints,
  idleHideTimeout,
}: SettingsToolAvailability): SettingsToolRow[] {
  const rows: SettingsToolRow[] = [
    {
      id: 'deletion',
      label: SETTINGS_TOOL_LABELS.deletion,
      enabled: hasReconstruction,
    },
    {
      id: 'cameraConversion',
      label: SETTINGS_TOOL_LABELS.cameraConversion,
      enabled: hasReconstruction && hasCameras,
    },
    {
      id: 'floorDetection',
      label: SETTINGS_TOOL_LABELS.floorDetection,
      enabled: hasPoints,
    },
  ];

  // Auto-hide has no data precondition, only its own feature switch: with the
  // idle timeout off there is nothing for the editor to configure.
  if (shouldShowAutoHideEditorButton(idleHideTimeout)) {
    rows.push({
      id: 'autoHide',
      label: SETTINGS_TOOL_LABELS.autoHide,
      enabled: true,
    });
  }

  return rows;
}
