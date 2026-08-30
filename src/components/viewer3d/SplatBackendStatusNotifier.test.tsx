import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SPLAT_LOADING_PROGRESS_MESSAGE } from '../../utils/splatLoadingProgressPolicy';
import { SplatBackendStatusNotifier } from './SplatBackendStatusNotifier';
import type { SplatBackendResolution } from '../../utils/splatBackendPolicy';

function makeUnavailable(reason: string): SplatBackendResolution {
  return {
    status: 'unavailable',
    requested: 'webgpu',
    backend: null,
    gpuPsnr: false,
    reason,
  };
}

// Shared no-op for tests that don't assert removal; lifecycle tests below
// create their own local spies.
const removeNotification = vi.fn();

describe('SplatBackendStatusNotifier', () => {
  it('adds one warning for each forced-WebGPU failure key', () => {
    const addNotification = vi.fn(() => 'notification-1');
    const file = new File(['x'], 'scene.spz');
    const firstResolution = makeUnavailable('WebGPU is unsupported in this browser');
    const { rerender } = render(
      <SplatBackendStatusNotifier
        addNotification={addNotification}
        removeNotification={removeNotification}
        sparkPreloadPending={false}
        requestedBackend="webgpu"
        splatBackendResolution={firstResolution}
        splatFile={file}
        webGpuSplatCanvasMounted={false}
      />
    );

    expect(addNotification).toHaveBeenCalledTimes(1);
    expect(addNotification).toHaveBeenLastCalledWith(
      'warning',
      'WebGPU splat renderer unavailable: WebGPU is unsupported in this browser. Enable WebGPU in your browser, or use a WebGPU-capable browser, for full features.'
    );

    rerender(
      <SplatBackendStatusNotifier
        addNotification={addNotification}
        removeNotification={removeNotification}
        sparkPreloadPending={false}
        requestedBackend="webgpu"
        splatBackendResolution={firstResolution}
        splatFile={file}
        webGpuSplatCanvasMounted={false}
      />
    );
    expect(addNotification).toHaveBeenCalledTimes(1);

    rerender(
      <SplatBackendStatusNotifier
        addNotification={addNotification}
        removeNotification={removeNotification}
        sparkPreloadPending={false}
        requestedBackend="webgpu"
        splatBackendResolution={makeUnavailable('WebGPU splat renderer failed to initialize: adapter lost')}
        splatFile={file}
        webGpuSplatCanvasMounted={false}
      />
    );
    expect(addNotification).toHaveBeenCalledTimes(2);
  });

  it('suppresses warnings while a forced WebGPU canvas attempt is mounted', () => {
    const addNotification = vi.fn(() => 'notification-1');

    render(
      <SplatBackendStatusNotifier
        addNotification={addNotification}
        removeNotification={removeNotification}
        sparkPreloadPending={false}
        requestedBackend="webgpu"
        splatBackendResolution={makeUnavailable('WebGPU splat renderer is not available')}
        splatFile={new File(['x'], 'scene.spz')}
        webGpuSplatCanvasMounted
      />
    );

    expect(addNotification).not.toHaveBeenCalled();
  });

  it('adds a warning when auto mode keeps Spark after WebGPU initialization fails', () => {
    const addNotification = vi.fn(() => 'notification-1');
    const fallbackResolution: SplatBackendResolution = {
      status: 'resolved',
      requested: 'auto',
      backend: 'spark',
      gpuPsnr: false,
      reason: 'Spark fallback selected because WebGPU splat renderer failed to initialize: adapter lost',
    };

    render(
      <SplatBackendStatusNotifier
        addNotification={addNotification}
        removeNotification={removeNotification}
        sparkPreloadPending={false}
        requestedBackend="auto"
        splatBackendResolution={fallbackResolution}
        splatFile={new File(['x'], 'scene.spz')}
        webGpuSplatCanvasMounted={false}
      />
    );

    expect(addNotification).toHaveBeenCalledWith(
      'info',
      'Using Spark fallback: WebGPU splat renderer failed to initialize: adapter lost',
      8000
    );
  });

  it('adds a full-features warning when auto mode uses Spark because WebGPU is unsupported', () => {
    const addNotification = vi.fn(() => 'notification-1');
    const fallbackResolution: SplatBackendResolution = {
      status: 'resolved',
      requested: 'auto',
      backend: 'spark',
      gpuPsnr: false,
      reason: 'Spark fallback selected because WebGPU is unsupported',
    };

    render(
      <SplatBackendStatusNotifier
        addNotification={addNotification}
        removeNotification={removeNotification}
        sparkPreloadPending={false}
        requestedBackend="auto"
        splatBackendResolution={fallbackResolution}
        splatFile={new File(['x'], 'scene.spz')}
        webGpuSplatCanvasMounted={false}
      />
    );

    expect(addNotification).toHaveBeenCalledWith(
      'info',
      'Using Spark fallback: WebGPU is unsupported. Enable WebGPU in your browser, or use a WebGPU-capable browser, for full features.',
      8000
    );
  });

  it('shows a preparing note instead of a warning while the Spark download is pending', () => {
    const addNotification = vi.fn(() => 'preparing-1');
    const removePreparing = vi.fn();

    render(
      <SplatBackendStatusNotifier
        addNotification={addNotification}
        removeNotification={removePreparing}
        sparkPreloadPending={true}
        requestedBackend="auto"
        splatBackendResolution={{
          status: 'unavailable',
          requested: 'auto',
          backend: null,
          gpuPsnr: false,
          reason: 'No splat renderer is available',
        }}
        splatFile={new File(['x'], 'scene.ply')}
        webGpuSplatCanvasMounted={false}
      />
    );

    expect(addNotification).toHaveBeenCalledTimes(1);
    // Same message the splat loading progress uses for this phase; duration 0
    // is the repo's caller-owned (sticky) notification convention.
    expect(addNotification).toHaveBeenCalledWith('info', SPLAT_LOADING_PROGRESS_MESSAGE, 0);
  });

  it('removes the preparing note and warns once the preload settles without Spark', () => {
    const addNotification = vi.fn(() => 'preparing-1');
    const removePreparing = vi.fn();
    const unavailable: SplatBackendResolution = {
      status: 'unavailable',
      requested: 'auto',
      backend: null,
      gpuPsnr: false,
      reason: 'No splat renderer is available',
    };
    const props = {
      addNotification,
      removeNotification: removePreparing,
      requestedBackend: 'auto',
      splatBackendResolution: unavailable,
      splatFile: new File(['x'], 'scene.ply'),
      webGpuSplatCanvasMounted: false,
    } as const;

    const { rerender } = render(
      <SplatBackendStatusNotifier {...props} sparkPreloadPending={true} />
    );
    rerender(<SplatBackendStatusNotifier {...props} sparkPreloadPending={false} />);

    expect(removePreparing).toHaveBeenCalledWith('preparing-1');
    expect(addNotification).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('WebGPU splat renderer unavailable')
    );
  });

  it('removes the preparing note quietly when Spark takes over', () => {
    const addNotification = vi.fn(() => 'preparing-1');
    const removePreparing = vi.fn();
    const props = {
      addNotification,
      removeNotification: removePreparing,
      requestedBackend: 'auto',
      splatFile: new File(['x'], 'scene.ply'),
      webGpuSplatCanvasMounted: false,
    } as const;

    const { rerender } = render(
      <SplatBackendStatusNotifier
        {...props}
        sparkPreloadPending={true}
        splatBackendResolution={{
          status: 'unavailable',
          requested: 'auto',
          backend: null,
          gpuPsnr: false,
          reason: 'No splat renderer is available',
        }}
      />
    );
    rerender(
      <SplatBackendStatusNotifier
        {...props}
        sparkPreloadPending={false}
        splatBackendResolution={{
          status: 'resolved',
          requested: 'auto',
          backend: 'spark',
          gpuPsnr: false,
          reason: 'Spark fallback selected because WebGPU is unsupported',
        }}
      />
    );

    expect(removePreparing).toHaveBeenCalledWith('preparing-1');
    expect(addNotification).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('Using Spark fallback'),
      8000
    );
  });

  it('never re-announces a notice key it has already shown, even after another notice', () => {
    const addNotification = vi.fn(() => 'n');
    const fallback: SplatBackendResolution = {
      status: 'resolved',
      requested: 'auto',
      backend: 'spark',
      gpuPsnr: false,
      reason: 'Spark fallback selected because WebGPU is unsupported',
    };
    const failed: SplatBackendResolution = {
      status: 'resolved',
      requested: 'auto',
      backend: 'spark',
      gpuPsnr: false,
      reason: 'Spark fallback selected because WebGPU splat renderer failed to initialize: adapter lost',
    };
    const props = {
      addNotification,
      removeNotification,
      requestedBackend: 'auto',
      splatFile: new File(['x'], 'scene.ply'),
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: false,
    } as const;

    const { rerender } = render(
      <SplatBackendStatusNotifier {...props} splatBackendResolution={fallback} />
    );
    rerender(<SplatBackendStatusNotifier {...props} splatBackendResolution={failed} />);
    // A last-key-only dedupe would re-fire here; a seen-set must not.
    rerender(<SplatBackendStatusNotifier {...props} splatBackendResolution={fallback} />);

    expect(addNotification).toHaveBeenCalledTimes(2);
  });
});
