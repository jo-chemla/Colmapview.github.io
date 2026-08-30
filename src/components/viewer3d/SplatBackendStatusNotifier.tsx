import { useEffect, useRef } from 'react';
import type { NotificationState } from '../../store';
import type {
  SplatBackendPreference,
  SplatBackendResolution,
} from '../../utils/splatBackendPolicy';
import { SPLAT_LOADING_PROGRESS_MESSAGE } from '../../utils/splatLoadingProgressPolicy';
import { getWebGpuSplatBackendNotice } from './splatBackendNoticePolicy';

export function SplatBackendStatusNotifier({
  addNotification,
  removeNotification,
  requestedBackend,
  splatBackendResolution,
  splatFile,
  webGpuSplatCanvasMounted,
  sparkPreloadPending,
}: {
  addNotification: NotificationState['addNotification'];
  removeNotification: NotificationState['removeNotification'];
  requestedBackend: SplatBackendPreference;
  splatBackendResolution: SplatBackendResolution;
  splatFile?: File;
  webGpuSplatCanvasMounted: boolean;
  sparkPreloadPending: boolean;
}) {
  // A seen-SET, not a last-key ref: with only the last key, an A→B→A
  // sequence re-announces A. Every key is a fact about this session the user
  // has already been told once.
  const seenNoticeKeysRef = useRef(new Set<string>());

  // A pending Spark download is a loading state, not an outcome: show one
  // caller-owned info line (duration 0 = sticky, the repo convention for
  // notifications whose lifetime an effect owns — see SplatLayer's loading
  // notification) instead of the "unavailable" warning the resolver reports
  // during the window. The effect cleanup removes it when the preload
  // settles or the component unmounts; the message is the same one the splat
  // loading progress uses for this phase, so the two surfaces always agree.
  useEffect(() => {
    if (!sparkPreloadPending) return;
    const preparingId = addNotification('info', SPLAT_LOADING_PROGRESS_MESSAGE, 0);
    return () => removeNotification(preparingId);
  }, [addNotification, removeNotification, sparkPreloadPending]);

  useEffect(() => {
    const notice = getWebGpuSplatBackendNotice({
      requestedBackend,
      splatBackendResolution,
      splatFile,
      webGpuSplatCanvasMounted,
      sparkPreloadPending,
    });

    if (!notice || seenNoticeKeysRef.current.has(notice.key)) {
      return;
    }

    seenNoticeKeysRef.current.add(notice.key);
    if (notice.severity === 'info') {
      // Info notices auto-dismiss: the fallback outcome is a success with
      // context, not an alarm. 8s gives the longer messages time to be read.
      addNotification('info', notice.message, 8000);
    } else {
      addNotification('warning', notice.message);
    }
  }, [
    addNotification,
    requestedBackend,
    splatBackendResolution,
    splatFile,
    webGpuSplatCanvasMounted,
    sparkPreloadPending,
  ]);

  return null;
}
