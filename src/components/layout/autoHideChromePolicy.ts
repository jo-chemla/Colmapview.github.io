/**
 * Attributes every auto-hidden chrome control needs. A faded control is still
 * in the DOM, so without these it stays tabbable and readable to assistive tech
 * while invisible on screen: `aria-hidden` takes it out of the a11y tree and
 * `tabIndex={-1}` takes it out of the tab order. Both are omitted (rather than
 * set to a falsy value) while the chrome is visible so the markup matches an
 * ordinary control exactly.
 */
export function getAutoHiddenChromeProps(hidden: boolean): {
  'aria-hidden': true | undefined;
  tabIndex: number | undefined;
} {
  return {
    'aria-hidden': hidden || undefined,
    tabIndex: hidden ? -1 : undefined,
  };
}

export function shouldHideChromeWithButtons({
  autoHideButtons,
  isIdle,
  showAutoHideEditor,
}: {
  autoHideButtons: boolean;
  isIdle: boolean;
  showAutoHideEditor: boolean;
}): boolean {
  return autoHideButtons && (isIdle || showAutoHideEditor);
}
