import { WEBGPU_INSECURE_CONTEXT_REASON } from '../../utils/splatBackendPolicy';
import type {
  SplatBackendPreference,
  SplatBackendResolution,
} from '../../utils/splatBackendPolicy';

export interface ForcedWebGpuSplatFailureNoticeOptions {
  requestedBackend: SplatBackendPreference;
  splatFile?: Pick<File, 'name'>;
  splatBackendResolution: SplatBackendResolution;
  webGpuSplatCanvasMounted: boolean;
  /**
   * True while the Spark module download is the expected next step (the
   * preload gate fired and availability.spark has not settled). An
   * "unavailable" resolution during that window is a loading state, not an
   * outcome, and must not raise the no-renderer warning.
   */
  sparkPreloadPending: boolean;
}

/** Shown (as an info notification) instead of a notice while the download runs. */
export const SPLAT_RENDERER_PREPARING_MESSAGE = 'Preparing splat renderer…';

export interface ForcedWebGpuSplatFailureNotice {
  key: string;
  message: string;
  /**
   * 'warning' = the user lost something durable (no renderer at all, or a
   * forced backend failed). 'info' = the outcome is success via fallback —
   * splats render, the message is context, and it must not persist as an
   * alarm.
   */
  severity: 'info' | 'warning';
}

const WEBGPU_FULL_FEATURES_SUGGESTION =
  'Enable WebGPU in your browser, or use a WebGPU-capable browser, for full features.';

const WEBGPU_HTTPS_SUGGESTION =
  'Reload the page over HTTPS for full features.';

export function getWebGpuSplatBackendNotice(options: ForcedWebGpuSplatFailureNoticeOptions): ForcedWebGpuSplatFailureNotice | null {
  return getForcedWebGpuSplatFailureNotice(options)
    ?? getAutoWebGpuUnavailableNotice(options)
    ?? getAutoWebGpuUnsupportedSparkFallbackNotice(options)
    ?? getAutoWebGpuFailureSparkFallbackNotice(options);
}

export function getForcedWebGpuSplatFailureNotice({
  requestedBackend,
  splatFile,
  splatBackendResolution,
  webGpuSplatCanvasMounted,
}: ForcedWebGpuSplatFailureNoticeOptions): ForcedWebGpuSplatFailureNotice | null {
  if (
    !splatFile ||
    requestedBackend !== 'webgpu' ||
    splatBackendResolution.status !== 'unavailable' ||
    webGpuSplatCanvasMounted
  ) {
    return null;
  }

  return {
    key: `${splatFile.name}:${splatBackendResolution.reason}`,
    message: withWebGpuFullFeaturesSuggestion(
      `WebGPU splat renderer unavailable: ${splatBackendResolution.reason}`,
      splatBackendResolution.reason
    ),
    severity: 'warning',
  };
}

function getAutoWebGpuUnavailableNotice({
  requestedBackend,
  splatFile,
  splatBackendResolution,
  sparkPreloadPending,
}: ForcedWebGpuSplatFailureNoticeOptions): ForcedWebGpuSplatFailureNotice | null {
  // Two loading states must stay silent, and they need separate guards:
  // sparkPreloadPending covers the Spark download window (webGpu unsupported/
  // failed, module in flight), while the string check covers the WebGPU init
  // window (webGpu 'unavailable' with Spark already loaded), where the preload
  // gate never fires and pending is therefore false.
  if (
    !splatFile ||
    requestedBackend !== 'auto' ||
    splatBackendResolution.status !== 'unavailable' ||
    sparkPreloadPending ||
    splatBackendResolution.reason === 'Preparing WebGPU splat renderer'
  ) {
    return null;
  }

  return {
    key: `${splatFile.name}:${splatBackendResolution.reason}`,
    message: withWebGpuFullFeaturesSuggestion(
      `WebGPU splat renderer unavailable: ${splatBackendResolution.reason}`,
      splatBackendResolution.reason
    ),
    severity: 'warning',
  };
}

function getAutoWebGpuUnsupportedSparkFallbackNotice({
  requestedBackend,
  splatFile,
  splatBackendResolution,
  webGpuSplatCanvasMounted,
}: ForcedWebGpuSplatFailureNoticeOptions): ForcedWebGpuSplatFailureNotice | null {
  if (
    !splatFile ||
    requestedBackend !== 'auto' ||
    splatBackendResolution.status !== 'resolved' ||
    splatBackendResolution.backend !== 'spark' ||
    webGpuSplatCanvasMounted ||
    !isWebGpuUnsupportedReason(splatBackendResolution.reason)
  ) {
    return null;
  }

  const fallbackReason = splatBackendResolution.reason.replace(/^Spark fallback selected because /, '');
  return {
    // Keyed by reason alone: the fallback is a property of this SESSION's
    // browser environment, not of the file, so a second splat must not
    // re-announce it.
    key: `fallback:${splatBackendResolution.reason}`,
    message: withWebGpuFullFeaturesSuggestion(`Using Spark fallback: ${fallbackReason}`, fallbackReason),
    severity: 'info',
  };
}

function getAutoWebGpuFailureSparkFallbackNotice({
  requestedBackend,
  splatFile,
  splatBackendResolution,
  webGpuSplatCanvasMounted,
}: ForcedWebGpuSplatFailureNoticeOptions): ForcedWebGpuSplatFailureNotice | null {
  if (
    !splatFile ||
    requestedBackend !== 'auto' ||
    splatBackendResolution.status !== 'resolved' ||
    splatBackendResolution.backend !== 'spark' ||
    webGpuSplatCanvasMounted ||
    !splatBackendResolution.reason.includes('WebGPU splat renderer failed')
  ) {
    return null;
  }

  return {
    // Session-keyed for the same reason as the unsupported fallback above.
    key: `fallback:${splatBackendResolution.reason}`,
    message: `Using Spark fallback: ${splatBackendResolution.reason.replace(/^Spark fallback selected because /, '')}`,
    severity: 'info',
  };
}

function withWebGpuFullFeaturesSuggestion(message: string, reason: string): string {
  // The insecure-context reason gets its own advice: the browser is fine,
  // the URL scheme hid navigator.gpu — suggesting a different browser there
  // sends the user on a wild goose chase.
  if (reason.includes(WEBGPU_INSECURE_CONTEXT_REASON)) {
    return `${message}. ${WEBGPU_HTTPS_SUGGESTION}`;
  }
  return isWebGpuUnsupportedReason(reason)
    ? `${message}. ${WEBGPU_FULL_FEATURES_SUGGESTION}`
    : message;
}

function isWebGpuUnsupportedReason(reason: string): boolean {
  const normalizedReason = reason.toLowerCase();
  return normalizedReason.includes('webgpu is unsupported')
    || normalizedReason.includes('does not provide reliable webgpu support')
    || normalizedReason.includes('secure (https) connection');
}
