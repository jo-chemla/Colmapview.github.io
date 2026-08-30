import { describe, expect, it } from 'vitest';
import {
  getForcedWebGpuSplatFailureNotice,
  getWebGpuSplatBackendNotice,
} from './splatBackendNoticePolicy';
import { WEBGPU_INSECURE_CONTEXT_REASON } from '../../utils/splatBackendPolicy';
import type { SplatBackendResolution } from '../../utils/splatBackendPolicy';

const unavailableResolution: SplatBackendResolution = {
  status: 'unavailable',
  requested: 'webgpu',
  backend: null,
  gpuPsnr: false,
  reason: 'WebGPU is unsupported in this browser',
};

describe('splat backend notice policy', () => {
  it('creates a forced-WebGPU warning when no WebGPU canvas attempt is active', () => {
    const options = {
      requestedBackend: 'webgpu',
      splatFile: new File(['x'], 'scene.spz'),
      splatBackendResolution: unavailableResolution,
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: false,
    } as const;

    expect(getForcedWebGpuSplatFailureNotice(options)).toEqual({
      key: 'scene.spz:WebGPU is unsupported in this browser',
      message: 'WebGPU splat renderer unavailable: WebGPU is unsupported in this browser. Enable WebGPU in your browser, or use a WebGPU-capable browser, for full features.',
    });
    expect(getWebGpuSplatBackendNotice(options)).toEqual({
      key: 'scene.spz:WebGPU is unsupported in this browser',
      message: 'WebGPU splat renderer unavailable: WebGPU is unsupported in this browser. Enable WebGPU in your browser, or use a WebGPU-capable browser, for full features.',
    });
  });

  it('does not warn while forced WebGPU is still warming up on a mounted canvas', () => {
    expect(getForcedWebGpuSplatFailureNotice({
      requestedBackend: 'webgpu',
      splatFile: new File(['x'], 'scene.spz'),
      splatBackendResolution: unavailableResolution,
      webGpuSplatCanvasMounted: true,
      sparkPreloadPending: false,
    })).toBeNull();
  });

  it('does not warn without a forced unavailable WebGPU splat request', () => {
    expect(getForcedWebGpuSplatFailureNotice({
      requestedBackend: 'auto',
      splatFile: new File(['x'], 'scene.spz'),
      splatBackendResolution: unavailableResolution,
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: false,
    })).toBeNull();

    expect(getForcedWebGpuSplatFailureNotice({
      requestedBackend: 'webgpu',
      splatBackendResolution: unavailableResolution,
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: false,
    })).toBeNull();

    expect(getForcedWebGpuSplatFailureNotice({
      requestedBackend: 'webgpu',
      splatFile: new File(['x'], 'scene.spz'),
      splatBackendResolution: {
        status: 'resolved',
        requested: 'webgpu',
        backend: 'webgpu',
        gpuPsnr: true,
        reason: 'WebGPU renderer forced by splatBackend=webgpu',
      },
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: false,
    })).toBeNull();
  });

  it('creates an auto-mode Spark fallback warning after WebGPU initialization fails', () => {
    const fallbackResolution: SplatBackendResolution = {
      status: 'resolved',
      requested: 'auto',
      backend: 'spark',
      gpuPsnr: false,
      reason: 'Spark fallback selected because WebGPU splat renderer failed to initialize: adapter lost',
    };

    expect(getWebGpuSplatBackendNotice({
      requestedBackend: 'auto',
      splatFile: new File(['x'], 'scene.spz'),
      splatBackendResolution: fallbackResolution,
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: false,
    })).toEqual({
      key: 'scene.spz:Spark fallback selected because WebGPU splat renderer failed to initialize: adapter lost',
      message: 'Using Spark fallback: WebGPU splat renderer failed to initialize: adapter lost',
    });
  });

  it('creates an auto-mode Spark fallback warning when WebGPU is unsupported', () => {
    const fallbackResolution: SplatBackendResolution = {
      status: 'resolved',
      requested: 'auto',
      backend: 'spark',
      gpuPsnr: false,
      reason: 'Spark fallback selected because WebGPU is unsupported',
    };

    expect(getWebGpuSplatBackendNotice({
      requestedBackend: 'auto',
      splatFile: new File(['x'], 'scene.spz'),
      splatBackendResolution: fallbackResolution,
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: false,
    })).toEqual({
      key: 'scene.spz:Spark fallback selected because WebGPU is unsupported',
      message: 'Using Spark fallback: WebGPU is unsupported. Enable WebGPU in your browser, or use a WebGPU-capable browser, for full features.',
    });
  });

  it('creates an auto-mode Spark fallback warning for browser-policy WebGPU blocks', () => {
    const fallbackResolution: SplatBackendResolution = {
      status: 'resolved',
      requested: 'auto',
      backend: 'spark',
      gpuPsnr: false,
      reason: 'Spark fallback selected because Firefox on Linux does not provide reliable WebGPU support for splat rendering',
    };

    expect(getWebGpuSplatBackendNotice({
      requestedBackend: 'auto',
      splatFile: new File(['x'], 'scene.spz'),
      splatBackendResolution: fallbackResolution,
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: false,
    })).toEqual({
      key: 'scene.spz:Spark fallback selected because Firefox on Linux does not provide reliable WebGPU support for splat rendering',
      message: 'Using Spark fallback: Firefox on Linux does not provide reliable WebGPU support for splat rendering. Enable WebGPU in your browser, or use a WebGPU-capable browser, for full features.',
    });
  });

  it('does not warn while auto WebGPU is still warming up', () => {
    expect(getWebGpuSplatBackendNotice({
      requestedBackend: 'auto',
      splatFile: new File(['x'], 'scene.spz'),
      splatBackendResolution: {
        status: 'unavailable',
        requested: 'auto',
        backend: null,
        gpuPsnr: false,
        reason: 'Preparing WebGPU splat renderer',
      },
      webGpuSplatCanvasMounted: true,
      sparkPreloadPending: false,
    })).toBeNull();
  });

  it('creates an auto-mode warning when WebGPU has a concrete unavailable reason', () => {
    expect(getWebGpuSplatBackendNotice({
      requestedBackend: 'auto',
      splatFile: new File(['x'], 'scene.spz'),
      splatBackendResolution: {
        status: 'unavailable',
        requested: 'auto',
        backend: null,
        gpuPsnr: false,
        reason: 'WebGPU adapter is unavailable',
      },
      webGpuSplatCanvasMounted: true,
      sparkPreloadPending: false,
    })).toEqual({
      key: 'scene.spz:WebGPU adapter is unavailable',
      message: 'WebGPU splat renderer unavailable: WebGPU adapter is unavailable',
    });
  });

  it('suggests HTTPS, not a different browser, for the insecure-context reason', () => {
    const notice = getWebGpuSplatBackendNotice({
      requestedBackend: 'auto',
      splatFile: new File(['x'], 'scene.ply'),
      splatBackendResolution: {
        status: 'resolved',
        requested: 'auto',
        backend: 'spark',
        gpuPsnr: false,
        reason: `Spark fallback selected because ${WEBGPU_INSECURE_CONTEXT_REASON}`,
      },
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: false,
    });

    expect(notice).not.toBeNull();
    expect(notice!.message).toContain('HTTPS');
    expect(notice!.message).not.toContain('WebGPU-capable browser');
  });

  it('stays silent about "unavailable" while the Spark download is the expected next step', () => {
    const options = {
      requestedBackend: 'auto',
      splatFile: new File(['x'], 'scene.ply'),
      splatBackendResolution: {
        status: 'unavailable',
        requested: 'auto',
        backend: null,
        gpuPsnr: false,
        reason: 'No splat renderer is available',
      },
      webGpuSplatCanvasMounted: false,
    } as const;

    // Pending: the module is downloading — a loading state, not an outcome.
    expect(getWebGpuSplatBackendNotice({ ...options, sparkPreloadPending: true })).toBeNull();
    // Settled without Spark: now it IS a durable outcome and must warn.
    expect(getWebGpuSplatBackendNotice({ ...options, sparkPreloadPending: false })).not.toBeNull();
  });

  it('never suppresses the forced-webgpu failure notice for a pending preload', () => {
    expect(getWebGpuSplatBackendNotice({
      requestedBackend: 'webgpu',
      splatFile: new File(['x'], 'scene.spz'),
      splatBackendResolution: unavailableResolution,
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: true,
    })).not.toBeNull();
  });
});
