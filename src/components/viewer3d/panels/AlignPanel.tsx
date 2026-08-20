import { memo, useCallback } from 'react';
import { AlignIcon, HoverIcon } from '../../../icons';
import type { PointPickingMode } from '../../../store';
import { controlPanelStyles } from '../../../theme';
import {
  ControlButton,
  type PanelType,
} from '../ControlComponents';
import {
  ALIGN_TOOLS,
  getAlignPanelState,
  getAlignPickingActivation,
  getAlignPickingButtonState,
} from './alignPanelViewModel';
import { useAlignPanelStoreFacade } from './useAlignPanelStoreFacade';

const styles = controlPanelStyles;

export interface AlignPanelProps {
  activePanel: PanelType;
  setActivePanel: (panel: PanelType) => void;
}

/**
 * Toolbar entry point for the point-picking alignment tools. This panel is
 * their only home in the toolbar — the Transform panel next door owns the gizmo
 * and the sliders, and neither panel repeats the other's controls. It
 * deliberately registers no hotkey: the Transform panel owns the `T` gizmo
 * binding, and a second registration would fire the toggle twice per press.
 */
export const AlignPanel = memo(function AlignPanel({
  activePanel,
  setActivePanel,
}: AlignPanelProps) {
  const {
    data: { reconstruction },
    pointPicking: { pickingMode, setPickingMode },
    pointCloud: { getPointCloudSnapshot, setShowPointCloud, setColorMode },
  } = useAlignPanelStoreFacade();

  const panelState = getAlignPanelState(pickingMode);

  // Deliberately not memoised: every tool row hands a fresh arrow
  // (`() => armPickingMode(...)`) to a plain <button>, so a stable identity here
  // would have no consumer to spare a render.
  const armPickingMode = (nextMode: PointPickingMode) => {
    // Read at click time. The panel does not subscribe to point-cloud state, so
    // this is the freshest answer and costs nothing while the tools sit idle.
    const { showPointCloud, colorMode } = getPointCloudSnapshot();
    const activation = getAlignPickingActivation({ nextMode, showPointCloud, colorMode });

    if (activation.showPointCloud !== null) {
      setShowPointCloud(activation.showPointCloud);
    }
    if (activation.colorMode !== null) {
      setColorMode(activation.colorMode);
    }

    setPickingMode(activation.pickingMode);
  };

  const cancelPicking = useCallback(() => setPickingMode('off'), [setPickingMode]);

  return (
    <ControlButton
      panelId="align"
      activePanel={activePanel}
      setActivePanel={setActivePanel}
      icon={<HoverIcon icon={<AlignIcon className="w-6 h-6" />} label="Align" />}
      tooltip={panelState.tooltip}
      isActive={panelState.isPicking}
      onClick={panelState.isPicking ? cancelPicking : undefined}
      panelTitle="Alignment Tools"
      disabled={!reconstruction}
    >
      <div className={styles.panelContent}>
        <div className={styles.presetGroup}>
          {ALIGN_TOOLS.map((tool) => {
            const buttonState = getAlignPickingButtonState(pickingMode, tool.mode);

            return (
              <button
                key={tool.mode}
                onClick={() => armPickingMode(buttonState.nextMode)}
                className={buttonState.isActive ? styles.actionButtonPrimary : styles.presetButton}
                data-tooltip={tool.tooltip}
                data-tooltip-pos="bottom"
              >
                {tool.label}
              </button>
            );
          })}
        </div>

        <div className={styles.hint}>{panelState.hint}</div>
      </div>
    </ControlButton>
  );
});
