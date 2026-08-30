import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SPLAT_LOADING_PROGRESS_MESSAGE } from '../../utils/splatLoadingProgressPolicy';
import { Scene3DErrorBoundary } from './Scene3DErrorBoundary';
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

  it('re-announces a warning when the same failure returns after a different one', () => {
    // Warnings are events, not session facts: a.spz -> b.spz -> a.spz is a
    // genuine retry, and a lifetime seen-set would leave the third attempt
    // silent behind a blank viewport.
    const addNotification = vi.fn(() => 'n');
    const props = {
      addNotification,
      removeNotification,
      requestedBackend: 'webgpu',
      splatBackendResolution: makeUnavailable('WebGPU splat renderer failed to initialize: adapter lost'),
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: false,
    } as const;
    const fileA = new File(['x'], 'a.spz');
    const fileB = new File(['x'], 'b.spz');

    const { rerender } = render(<SplatBackendStatusNotifier {...props} splatFile={fileA} />);
    rerender(<SplatBackendStatusNotifier {...props} splatFile={fileB} />);
    rerender(<SplatBackendStatusNotifier {...props} splatFile={fileA} />);

    expect(addNotification).toHaveBeenCalledTimes(3);
  });

  it('does not repeat the preparing note while the load overlay already shows it', () => {
    // The DropZone progress overlay renders the identical message during the
    // Spark download; two surfaces saying the same thing at once reads as a
    // stutter, and the toast is only needed once the overlay is gone.
    const addNotification = vi.fn(() => 'preparing-1');
    const props = {
      addNotification,
      removeNotification,
      requestedBackend: 'auto',
      splatBackendResolution: {
        status: 'unavailable',
        requested: 'auto',
        backend: null,
        gpuPsnr: false,
        reason: 'No splat renderer is available',
      },
      splatFile: new File(['x'], 'scene.ply'),
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: true,
    } as const;

    const { rerender } = render(
      <SplatBackendStatusNotifier {...props} preparingProgressVisible />
    );
    expect(addNotification).not.toHaveBeenCalled();

    // Overlay gone, download still running: the toast is now the only surface.
    rerender(<SplatBackendStatusNotifier {...props} preparingProgressVisible={false} />);
    expect(addNotification).toHaveBeenCalledWith('info', SPLAT_LOADING_PROGRESS_MESSAGE, 0);
  });

  it('drops its sticky preparing note when the scene error boundary catches', () => {
    // Scene3D mounts the notifier INSIDE Scene3DErrorBoundary, as a sibling
    // before the Canvas: everything that can settle sparkPreloadPending lives
    // in the canvas subtree, so a canvas crash must unmount the notifier too —
    // otherwise the duration-0 note is stranded on screen with nothing left
    // that could ever remove it.
    const addNotification = vi.fn(() => 'preparing-1');
    const removePreparing = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    function Boom({ crash }: { crash: boolean }): null {
      if (crash) {
        throw new Error('canvas exploded');
      }
      return null;
    }

    const scene = (crash: boolean) => (
      <Scene3DErrorBoundary>
        <SplatBackendStatusNotifier
          addNotification={addNotification}
          removeNotification={removePreparing}
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
          sparkPreloadPending
        />
        <Boom crash={crash} />
      </Scene3DErrorBoundary>
    );

    try {
      const { rerender } = render(scene(false));
      expect(addNotification).toHaveBeenCalledWith('info', SPLAT_LOADING_PROGRESS_MESSAGE, 0);
      expect(removePreparing).not.toHaveBeenCalled();

      rerender(scene(true));
    } finally {
      consoleError.mockRestore();
    }

    expect(removePreparing).toHaveBeenCalledWith('preparing-1');
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
