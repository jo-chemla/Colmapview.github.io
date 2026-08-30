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
  preparingProgressVisible = false,
}: {
  addNotification: NotificationState['addNotification'];
  removeNotification: NotificationState['removeNotification'];
  requestedBackend: SplatBackendPreference;
  splatBackendResolution: SplatBackendResolution;
  splatFile?: File;
  webGpuSplatCanvasMounted: boolean;
  sparkPreloadPending: boolean;
  /**
   * True while another surface (the DropZone load overlay) already shows the
   * preparing message. The toast is suppressed for that window so the same
   * sentence is never on screen twice at once.
   */
  preparingProgressVisible?: boolean;
}) {
  // Info notices are session FACTS — the fallback is a property of this
  // browser, told once ever, so a seen-set (not a last-key ref) is right:
  // an A→B→A sequence must not re-announce A.
  const seenInfoNoticeKeysRef = useRef(new Set<string>());
  // Warnings are EVENTS. The same failure arriving again after a different
  // one is a real second failure the user is looking at right now (a→b→a
  // retries), so only the immediately-previous key is deduped.
  const lastWarningNoticeKeyRef = useRef<string | null>(null);

  // A pending Spark download is a loading state, not an outcome: show one
  // caller-owned info line (duration 0 = sticky, the repo convention for
  // notifications whose lifetime an effect owns — see SplatLayer's loading
  // notification) instead of the "unavailable" warning the resolver reports
  // during the window. The effect cleanup removes it when the preload
  // settles, the overlay takes over, or the component unmounts; the message is
  // the same one the splat loading progress uses for this phase, so the two
  // surfaces always agree.
  useEffect(() => {
    if (!sparkPreloadPending || preparingProgressVisible) return;
    const preparingId = addNotification('info', SPLAT_LOADING_PROGRESS_MESSAGE, 0);
    return () => removeNotification(preparingId);
  }, [addNotification, preparingProgressVisible, removeNotification, sparkPreloadPending]);

  useEffect(() => {
    const notice = getWebGpuSplatBackendNotice({
      requestedBackend,
      splatBackendResolution,
      splatFile,
      webGpuSplatCanvasMounted,
      sparkPreloadPending,
    });

    if (!notice) {
      return;
    }

    if (notice.severity === 'info') {
      if (seenInfoNoticeKeysRef.current.has(notice.key)) {
        return;
      }
      seenInfoNoticeKeysRef.current.add(notice.key);
      // Info notices auto-dismiss: the fallback outcome is a success with
      // context, not an alarm. 8s gives the longer messages time to be read.
      addNotification('info', notice.message, 8000);
      return;
    }

    if (lastWarningNoticeKeyRef.current === notice.key) {
      return;
    }
    lastWarningNoticeKeyRef.current = notice.key;
    addNotification('warning', notice.message);
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
