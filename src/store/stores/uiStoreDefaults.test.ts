import { describe, expect, it } from 'vitest';
import { useUIStore } from './uiStore';
import { generateDefaultConfiguration } from '../../config/registry/generators/defaults';
import { CANVAS_COLORS } from '../../theme/colors';

/**
 * The viewer opens on the ds surface tone so the canvas reads as one piece with
 * the chrome (user decision 2026-08-12). The value lives in two places by
 * necessity — the store's initial state and the config registry that drives the
 * "Default" profile reset — and uiStore.ts carries only a prose "keep in sync"
 * comment. These assertions are what actually holds the invariant: without them
 * the store default can be reverted to white and the whole suite stays green.
 */
describe('uiStore scene defaults', () => {
  it('opens on the dark ds surface tone', () => {
    expect(useUIStore.getState().backgroundColor).toBe('#161616');
  });

  it('keeps the store default and the registry default in lockstep', () => {
    const registryDefault = generateDefaultConfiguration().ui.backgroundColor;

    expect(useUIStore.getState().backgroundColor).toBe(registryDefault);
    expect(registryDefault).toBe(CANVAS_COLORS.bgSecondary);
  });
});
