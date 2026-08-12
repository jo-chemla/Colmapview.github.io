import { describe, expect, it } from 'vitest';
import { getAutoHiddenChromeProps, shouldHideChromeWithButtons } from './autoHideChromePolicy';

describe('auto-hide chrome policy', () => {
  it('hides chrome only when button auto-hide is active', () => {
    expect(shouldHideChromeWithButtons({
      autoHideButtons: true,
      isIdle: true,
      showAutoHideEditor: false,
    })).toBe(true);

    expect(shouldHideChromeWithButtons({
      autoHideButtons: true,
      isIdle: false,
      showAutoHideEditor: true,
    })).toBe(true);

    expect(shouldHideChromeWithButtons({
      autoHideButtons: false,
      isIdle: true,
      showAutoHideEditor: true,
    })).toBe(false);

    expect(shouldHideChromeWithButtons({
      autoHideButtons: true,
      isIdle: false,
      showAutoHideEditor: false,
    })).toBe(false);
  });

  it('takes hidden chrome out of the a11y tree and the tab order, and leaves visible chrome untouched', () => {
    expect(getAutoHiddenChromeProps(true)).toEqual({ 'aria-hidden': true, tabIndex: -1 });
    // Visible: both attributes are undefined, so React omits them entirely
    // rather than rendering aria-hidden="false" / tabindex="0".
    expect(getAutoHiddenChromeProps(false)).toEqual({
      'aria-hidden': undefined,
      tabIndex: undefined,
    });
  });
});
