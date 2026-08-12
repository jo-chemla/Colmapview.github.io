import {
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
 * panels themselves already carry their own labels.
 */
function ToolbarDivider() {
  return <div aria-hidden="true" className="w-6 h-px bg-ds-hover mx-auto" />;
}

export function ViewerControlsToolbar({ controller }: ViewerControlsToolbarProps) {
  const {
    className,
    viewPanel,
    axesGridPanel,
    cameraModePanel,
    backgroundPanel,
    transformPanel,
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
      <ViewPanel {...viewPanel} />
      <AxesGridPanel {...axesGridPanel} />
      <CameraModePanel {...cameraModePanel} />
      <BackgroundPanel {...backgroundPanel} />
      <TransformPanel {...transformPanel} />

      <ToolbarDivider />

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

      <ScreenshotPanel {...screenshotPanel} />
      <SharePanel {...sharePanel} />
      <ExportPanel {...exportPanel} />

      <ToolbarDivider />

      <SettingsPanel {...settingsPanel} />
      <GalleryToggleButton {...galleryToggleButton} />
    </div>
  );
}
