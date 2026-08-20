import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useReconstructionStore } from '../../store/reconstructionStore';
import { useUIStore } from '../../store/stores/uiStore';
import { TouchStatusBar } from './TouchStatusBar';
import {
  TOUCH_STATUS_BAR_HELP_LABEL,
  TOUCH_STATUS_BAR_HELP_TITLE,
} from './statusBarViewModel';

describe('TouchStatusBar', () => {
  beforeEach(() => {
    useReconstructionStore.setState(useReconstructionStore.getInitialState(), true);
    useUIStore.setState(useUIStore.getInitialState(), true);
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the help panel from the only pointer route touch mode has', () => {
    render(<TouchStatusBar />);

    expect(useUIStore.getState().showHotkeyHelp).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: TOUCH_STATUS_BAR_HELP_TITLE }));

    expect(useUIStore.getState().showHotkeyHelp).toBe(true);
  });

  it('gives the entry a 44px tap box over the 24px bar', () => {
    render(<TouchStatusBar />);

    const help = screen.getByRole('button', { name: TOUCH_STATUS_BAR_HELP_TITLE });

    expect(help).toHaveTextContent(TOUCH_STATUS_BAR_HELP_LABEL);
    expect(help.className).toContain('touch-hit-44');
    expect(help.className).toContain('relative');
  });

  it('hides the entry with the bar it lives in', () => {
    useUIStore.setState({
      touchUI: {
        ...useUIStore.getState().touchUI,
        statusBar: false,
      },
    });

    render(<TouchStatusBar />);

    expect(screen.queryByRole('button', { name: TOUCH_STATUS_BAR_HELP_TITLE })).toBeNull();
  });
});
