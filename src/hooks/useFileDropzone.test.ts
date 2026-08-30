import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSplatBackendStore } from '../store';
import type { FileDropzoneWorkflowDeps } from './fileDropzoneWorkflow';
import { useFileDropzone } from './useFileDropzone';

const { processFileDropzoneFilesMock } = vi.hoisted(() => ({
  processFileDropzoneFilesMock: vi.fn(async () => true),
}));

vi.mock('./fileDropzoneWorkflow', () => ({
  processFileDropzoneFiles: processFileDropzoneFilesMock,
}));

async function captureWorkflowDeps(): Promise<FileDropzoneWorkflowDeps> {
  const { result } = renderHook(() => useFileDropzone());
  await result.current.processFiles(new Map());

  const deps = processFileDropzoneFilesMock.mock.calls.at(-1)?.[1] as FileDropzoneWorkflowDeps | undefined;
  if (!deps) throw new Error('processFileDropzoneFiles was not called');
  return deps;
}

describe('useFileDropzone', () => {
  beforeEach(() => {
    processFileDropzoneFilesMock.mockClear();
    useSplatBackendStore.setState(useSplatBackendStore.getInitialState(), true);
  });

  it('does not preload the spark runtime when webgpu is the resolved splat backend', async () => {
    useSplatBackendStore.setState({
      requestedBackend: 'webgpu',
      availability: { webGpu: 'ready', webGpuFailureReason: null, spark: false },
    });

    const deps = await captureWorkflowDeps();

    expect(deps.shouldPreloadSplatRuntime?.()).toBe(false);
  });

  it('preloads the spark runtime when webgpu cannot work in this browser', async () => {
    useSplatBackendStore.setState({
      requestedBackend: 'auto',
      availability: { webGpu: 'unsupported', webGpuFailureReason: null, spark: false },
    });

    const deps = await captureWorkflowDeps();

    expect(deps.shouldPreloadSplatRuntime?.()).toBe(true);
  });

  it('does not preload the spark runtime while the webgpu renderer is still undecided', async () => {
    // A fresh page on a WebGPU-capable machine reports 'unavailable' until a
    // splat canvas mounts, so preloading here cost a 5 MB download on the
    // first drop of every session.
    useSplatBackendStore.setState({
      requestedBackend: 'auto',
      availability: { webGpu: 'unavailable', webGpuFailureReason: null, spark: false },
    });

    const deps = await captureWorkflowDeps();

    expect(deps.shouldPreloadSplatRuntime?.()).toBe(false);
  });

  it('records a failed drop-time preload so nothing re-requests the chunk', async () => {
    useSplatBackendStore.setState({
      requestedBackend: 'auto',
      availability: { webGpu: 'unsupported', webGpuFailureReason: null, spark: false },
    });

    const deps = await captureWorkflowDeps();
    expect(deps.shouldPreloadSplatRuntime?.()).toBe(true);

    // The drop-time attempt is the first of three in the app; if its failure
    // only reaches the log, the store keeps waiting on a download nobody is
    // making and the renderer-side attempts re-request the 5 MB chunk.
    deps.onSplatRuntimePreloadFailed?.();

    expect(useSplatBackendStore.getState().availability.sparkPreloadFailed).toBe(true);
    expect(deps.shouldPreloadSplatRuntime?.()).toBe(false);
  });

  it('reads the backend at drop time, not at hook render time', async () => {
    useSplatBackendStore.setState({
      requestedBackend: 'auto',
      availability: { webGpu: 'unsupported', webGpuFailureReason: null, spark: false },
    });

    const deps = await captureWorkflowDeps();
    expect(deps.shouldPreloadSplatRuntime?.()).toBe(true);

    useSplatBackendStore.getState().setWebGpuBackendState('ready');

    expect(deps.shouldPreloadSplatRuntime?.()).toBe(false);
  });
});
