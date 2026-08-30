import { useEffect, useRef } from 'react';
import type { NotificationState } from '../../store';
import type {
  SplatBackendPreference,
  SplatBackendResolution,
} from '../../utils/splatBackendPolicy';
import {
  SPLAT_RENDERER_PREPARING_MESSAGE,
  getWebGpuSplatBackendNotice,
} from './splatBackendNoticePolicy';

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
  const preparingIdRef = useRef<string | null>(null);

  // A pending Spark download is a loading state, not an outcome: show one
  // self-removing info line instead of the "unavailable" warning the resolver
  // reports during the window. The 60s duration is a leak guard only — a
  // settled preload removes the notification far earlier.
  useEffect(() => {
    const showPreparing = Boolean(splatFile) && sparkPreloadPending;
    if (showPreparing && preparingIdRef.current === null) {
      preparingIdRef.current = addNotification('info', SPLAT_RENDERER_PREPARING_MESSAGE, 60000);
    }
    if (!showPreparing && preparingIdRef.current !== null) {
      removeNotification(preparingIdRef.current);
      preparingIdRef.current = null;
    }
    return () => {
      if (preparingIdRef.current !== null) {
        removeNotification(preparingIdRef.current);
        preparingIdRef.current = null;
      }
    };
  }, [addNotification, removeNotification, splatFile, sparkPreloadPending]);

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
