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

  it('preloads the spark runtime while the webgpu renderer is still undecided', async () => {
    useSplatBackendStore.setState({
      requestedBackend: 'auto',
      availability: { webGpu: 'unavailable', webGpuFailureReason: null, spark: false },
    });

    const deps = await captureWorkflowDeps();

    expect(deps.shouldPreloadSplatRuntime?.()).toBe(true);
  });

  it('reads the backend at drop time, not at hook render time', async () => {
    useSplatBackendStore.setState({
      requestedBackend: 'auto',
      availability: { webGpu: 'unavailable', webGpuFailureReason: null, spark: false },
    });

    const deps = await captureWorkflowDeps();
    expect(deps.shouldPreloadSplatRuntime?.()).toBe(true);

    useSplatBackendStore.getState().setWebGpuBackendState('ready');

    expect(deps.shouldPreloadSplatRuntime?.()).toBe(false);
  });
});
