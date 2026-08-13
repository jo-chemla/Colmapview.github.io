import {
  AlignPanel,
  AxesGridPanel,
  BackgroundPanel,
  CameraDisplayPanel,
  CameraModePanel,
  ExportPanel,
  GalleryToggleButton,
  MatchesPanel,
  PointCloudPanel,
  RigPanel,
  ScreenshotPanel,
  SelectionHighlightPanel,
  SettingsPanel,
  SharePanel,
  TransformPanel,
  ViewPanel,
} from './panels';
import type { ViewerControlsController } from './useViewerControlsController';
import {
  shouldShowCameraDependentPanels,
  shouldShowMatchesPanel,
} from './viewerControlsLayoutPolicy';

export interface ViewerControlsToolbarProps {
  controller: ViewerControlsController;
}

/**
 * Hairline separator between toolbar clusters (view / data / capture / app).
 * Purely decorative grouping, so it stays out of the accessibility tree — the
 * panels themselves already carry their own labels. Each divider assumes the
 * cluster that follows it is non-empty; that holds today because every cluster
 * has an unconditional core (the Data cluster's point-cloud and camera-display
 * panels always render, only its match/highlight extras are conditional).
 */
function ToolbarDivider() {
  return <div aria-hidden="true" className="w-6 h-px bg-ds-muted/30 mx-auto" />;
}

export function ViewerControlsToolbar({ controller }: ViewerControlsToolbarProps) {
  const {
    className,
    viewPanel,
    axesGridPanel,
    cameraModePanel,
    backgroundPanel,
    transformPanel,
    alignPanel,
    pointCloudPanel,
    cameraDisplayPanel,
    matchesPanel,
    selectionHighlightPanel,
    rigPanel,
    screenshotPanel,
    sharePanel,
    exportPanel,
    settingsPanel,
    galleryToggleButton,
  } = controller;

  return (
    <div className={className} data-testid="viewer-controls">
      {/* View */}
      <ViewPanel {...viewPanel} />
      <AxesGridPanel {...axesGridPanel} />
      <CameraModePanel {...cameraModePanel} />
      <BackgroundPanel {...backgroundPanel} />
      <TransformPanel {...transformPanel} />
      <AlignPanel {...alignPanel} />

      <ToolbarDivider />

      {/* Data */}
      <PointCloudPanel {...pointCloudPanel} />
      <CameraDisplayPanel {...cameraDisplayPanel} />

      {shouldShowCameraDependentPanels(cameraDisplayPanel.showCameras) && (
        <>
          {shouldShowMatchesPanel(cameraDisplayPanel.showCameras, cameraDisplayPanel.cameraDisplayMode, cameraDisplayPanel.hasPinholeCameras) && (
            <MatchesPanel {...matchesPanel} />
          )}

          <SelectionHighlightPanel {...selectionHighlightPanel} />
        </>
      )}

      <RigPanel {...rigPanel} />

      <ToolbarDivider />

      {/* Capture */}
      <ScreenshotPanel {...screenshotPanel} />
      <SharePanel {...sharePanel} />
      <ExportPanel {...exportPanel} />

      <ToolbarDivider />

      {/* App */}
      <SettingsPanel {...settingsPanel} />
      <GalleryToggleButton {...galleryToggleButton} />
    </div>
  );
}
