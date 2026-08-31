import { memo, useCallback } from 'react';
import { AlignIcon, HoverIcon } from '../../../icons';
import type { PointPickingMode } from '../../../store';
import { controlPanelStyles } from '../../../theme';
import {
  ControlButton,
  type PanelType,
} from '../ControlComponents';
import {
  ALIGN_GOALS,
  applyAlignPickingActivation,
  getAlignPanelState,
  getAlignPickingActivation,
  getAlignPickingButtonState,
  type AlignAutomaticAction,
} from './alignPanelViewModel';
import { TRANSFORM_PENDING_HINT } from './transformPanelViewModel';
import { useAlignPanelStoreFacade } from './useAlignPanelStoreFacade';

const styles = controlPanelStyles;

export interface AlignPanelProps {
  activePanel: PanelType;
  setActivePanel: (panel: PanelType) => void;
  onOpenFloorModal: () => void;
}

/**
 * Toolbar entry point for every operation that COMPUTES the Sim3D transform
 * from something about the scene — automatically (Center at Origin, Floor
 * Detection) or from picked points (1/2/3-point). The Transform panel next door
 * is the other half of the split: it EDITS a transform by hand with the gizmo
 * and the sliders. Both write the one pending transform in `transformStore`,
 * which is why Reset/Apply appear in both panels — one state shown twice, not
 * two states.
 *
 * The panel deliberately registers no hotkey: the Transform panel owns the `T`
 * gizmo binding, and a second registration would fire the toggle twice per press.
 */
export const AlignPanel = memo(function AlignPanel({
  activePanel,
  setActivePanel,
  onOpenFloorModal,
}: AlignPanelProps) {
  const {
    data: { reconstruction, wasmReconstruction },
    pointPicking: { pickingMode, setPickingMode },
    pointCloud: { getPointCloudSnapshot, setShowPointCloud, setColorMode },
    transform: { hasPendingTransform, resetTransform },
    actions: { applyTransformPreset, applyTransformToData },
  } = useAlignPanelStoreFacade();

  const panelState = getAlignPanelState({
    pickingMode,
    hasPendingTransform,
    hasPoints: wasmReconstruction?.hasPoints() ?? false,
  });

  // Handler and gate live side by side, one entry per automatic operation, so a
  // new one cannot be wired up without answering when it is allowed to run.
  const runAutomatic: Record<AlignAutomaticAction, () => void> = {
    centerAtOrigin: () => applyTransformPreset('centerAtOrigin'),
    floorDetection: onOpenFloorModal,
  };
  const automaticEnabled: Record<AlignAutomaticAction, boolean> = {
    centerAtOrigin: true,
    floorDetection: panelState.canRunFloorDetection,
  };

  // Deliberately not memoised: every tool row hands a fresh arrow
  // (`() => armPickingMode(...)`) to a plain <button>, so a stable identity here
  // would have no consumer to spare a render.
  const armPickingMode = (nextMode: PointPickingMode) => {
    // Read at click time. The panel does not subscribe to point-cloud state, so
    // this is the freshest answer and costs nothing while the tools sit idle.
    const { showPointCloud, colorMode } = getPointCloudSnapshot();
    applyAlignPickingActivation(
      getAlignPickingActivation({ nextMode, showPointCloud, colorMode }),
      { setShowPointCloud, setColorMode, setPickingMode }
    );
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
        {/*
          Grouped by GOAL, not by method: the automatic op and the pick-points op
          that reach the same result sit under one caption, so "Center at Origin"
          and "1-Point Origin" read as two ways to do one thing. The automatic
          one comes first in every group.
        */}
        <div className={styles.presetGroupList}>
          {ALIGN_GOALS.map((goal) => {
            const buttonState = getAlignPickingButtonState(pickingMode, goal.pick.mode);
            const { automatic } = goal;
            const automaticIsEnabled = automatic ? automaticEnabled[automatic.action] : false;

            return (
              <div key={goal.goal} className={styles.presetGroup}>
                <div className={styles.presetGroupLabel}>{goal.goal}</div>

                {automatic && (
                  <button
                    onClick={runAutomatic[automatic.action]}
                    disabled={!automaticIsEnabled}
                    className={automaticIsEnabled ? styles.presetButton : styles.presetButtonDisabled}
                    data-tooltip={automatic.tooltip}
                    data-tooltip-pos="bottom"
                  >
                    {automatic.label}
                  </button>
                )}

                <button
                  onClick={() => armPickingMode(buttonState.nextMode)}
                  className={buttonState.isActive ? styles.actionButtonPrimary : styles.presetButton}
                  data-tooltip={goal.pick.tooltip}
                  data-tooltip-pos="bottom"
                >
                  {goal.pick.label}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.hint}>{panelState.hint}</div>

        {/*
          The same Reset/Apply the Transform panel shows, over the same store
          value. Reload stays in Transform: it re-reads the dropped files, which
          is not an alignment.
        */}
        <div className={styles.actionGroup}>
          <button
            onClick={resetTransform}
            disabled={!panelState.canResetTransform}
            className={panelState.canResetTransform ? styles.actionButton : styles.actionButtonDisabled}
          >
            Reset
          </button>
          <button
            onClick={applyTransformToData}
            disabled={!panelState.canApplyTransform}
            className={panelState.canApplyTransform ? styles.actionButtonPrimary : styles.actionButtonPrimaryDisabled}
          >
            Apply
          </button>
        </div>

        {panelState.hasChanges && (
          <div className={styles.hint}>{TRANSFORM_PENDING_HINT}</div>
        )}
      </div>
    </ControlButton>
  );
});
