import { memo, useCallback } from 'react';
import { AlignIcon, HoverIcon } from '../../../icons';
import type { PointPickingMode } from '../../../store';
import { controlPanelStyles } from '../../../theme';
import {
  ControlButton,
  ToggleRow,
  type PanelType,
} from '../ControlComponents';
import {
  ALIGN_TOOLS,
  getAlignPanelState,
  getAlignPickingActivation,
} from './alignPanelViewModel';
import { getTransformPickingButtonState } from './transformPanelViewModel';
import { useAlignPanelStoreFacade } from './useAlignPanelStoreFacade';

const styles = controlPanelStyles;

export interface AlignPanelProps {
  activePanel: PanelType;
  setActivePanel: (panel: PanelType) => void;
}

/**
 * Toolbar entry point for the point-picking alignment tools. These live in the
 * context menu and (below seven transform sliders) in the Transform panel; this
 * panel makes them visible on their own button. It deliberately registers no
 * hotkey — the Transform panel already owns the `T` gizmo binding, and a second
 * registration would fire the toggle twice per press.
 */
export const AlignPanel = memo(function AlignPanel({
  activePanel,
  setActivePanel,
}: AlignPanelProps) {
  const {
    data: { reconstruction },
    ui: { showGizmo, toggleGizmo },
    pointPicking: { pickingMode, setPickingMode },
    pointCloud: { showPointCloud, colorMode, setShowPointCloud, setColorMode },
  } = useAlignPanelStoreFacade();

  const panelState = getAlignPanelState(pickingMode);

  const armPickingMode = useCallback((nextMode: PointPickingMode) => {
    const activation = getAlignPickingActivation({ nextMode, showPointCloud, colorMode });

    if (activation.showPointCloud !== null) {
      setShowPointCloud(activation.showPointCloud);
    }
    if (activation.colorMode !== null) {
      setColorMode(activation.colorMode);
    }

    setPickingMode(activation.pickingMode);
  }, [colorMode, setColorMode, setPickingMode, setShowPointCloud, showPointCloud]);

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
        <ToggleRow label="Gizmo (T)" checked={showGizmo} onChange={toggleGizmo} />

        <div className={styles.presetGroup}>
          {ALIGN_TOOLS.map((tool) => {
            const buttonState = getTransformPickingButtonState(pickingMode, tool.mode);

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
