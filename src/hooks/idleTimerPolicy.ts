export const IDLE_HIDEABLE_SELECTOR = '.idle-hideable';
export const IDLE_IGNORE_SELECTOR = '[data-idle-ignore="true"]';
export const IDLE_PAUSE_TARGET_SELECTOR = [
  IDLE_HIDEABLE_SELECTOR,
  '[data-idle-pause="true"]',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[aria-haspopup]',
  'button:not([disabled])',
  'select:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'a[href]',
].join(',');
export const IDLE_FOCUS_PAUSE_TARGET_SELECTOR = [
  '[data-idle-pause="true"]',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  'select:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
].join(',');

export interface IdlePointerPosition {
  x: number;
  y: number;
}

export function getIdleTimeoutDelayMs(timeoutSeconds: number): number | null {
  if (timeoutSeconds <= 0) return null;
  return timeoutSeconds * 1000;
}

export const IDLE_WAKE_TAP_MAX_MOVE_PX = 10;

/**
 * A completed touch TAP — on anything, bare canvas included — wakes hidden
 * chrome. Touch has no equivalent of the desktop wake paths (Tab, or mousing
 * over the still-hit-testable opacity-0 status bar): while idle, every
 * idle-hideable is visibility:hidden and unhittable and the touch status bar
 * unmounts entirely, so without this a touch session that goes idle once can
 * never reach chrome again. Taps only: orbit/pinch gestures travel past the
 * threshold and keep chrome hidden while the scene is being driven, matching
 * the desktop rule that scene interaction does not postpone hiding.
 */
export function isIdleWakeTap(
  pointerType: string,
  downPosition: IdlePointerPosition | null,
  upPosition: IdlePointerPosition,
  threshold = IDLE_WAKE_TAP_MAX_MOVE_PX
): boolean {
  if (pointerType !== 'touch' || !downPosition) return false;
  const dx = upPosition.x - downPosition.x;
  const dy = upPosition.y - downPosition.y;
  return dx * dx + dy * dy <= threshold * threshold;
}

function isElementTarget(target: EventTarget | null): target is Element {
  return typeof Element !== 'undefined' && target instanceof Element;
}

export function isIdleHideableTarget(target: EventTarget | null): boolean {
  return isElementTarget(target) && target.closest(IDLE_HIDEABLE_SELECTOR) !== null;
}

export function isIdleIgnoredTarget(target: EventTarget | null): boolean {
  return isElementTarget(target) && target.closest(IDLE_IGNORE_SELECTOR) !== null;
}

export function isIdlePauseTarget(target: EventTarget | null): boolean {
  return isElementTarget(target) &&
    !isIdleIgnoredTarget(target) &&
    target.closest(IDLE_PAUSE_TARGET_SELECTOR) !== null;
}

export function isIdleFocusPauseTarget(target: EventTarget | null): boolean {
  return isElementTarget(target) &&
    !isIdleIgnoredTarget(target) &&
    target.closest(IDLE_FOCUS_PAUSE_TARGET_SELECTOR) !== null;
}

export function shouldResumeIdleTimerAfterMouseOut(relatedTarget: EventTarget | null): boolean {
  return !isIdlePauseTarget(relatedTarget);
}

export function shouldResumeIdleTimerAfterFocusOut(relatedTarget: EventTarget | null): boolean {
  return !isIdleFocusPauseTarget(relatedTarget);
}
