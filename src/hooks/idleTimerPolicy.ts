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
 * One touch pointer's journey since its pointerdown: where it went down, and
 * the FURTHEST it has been from there (squared, to keep the hot path free of
 * sqrt). Endpoint distance alone would call a round-trip orbit — swing 200px
 * out and drift back onto the start — a tap, because it only ever compares the
 * two ends. Tracking the maximum makes any excursion disqualifying.
 */
export interface IdlePointerTravel {
  readonly downPosition: IdlePointerPosition;
  readonly maxTravelSquaredPx: number;
}

/** Start tracking a pointer from its pointerdown position. */
export function beginIdlePointerTravel(downPosition: IdlePointerPosition): IdlePointerTravel {
  return { downPosition, maxTravelSquaredPx: 0 };
}

/**
 * Fold one more sample (a pointermove, or the pointerup itself) into a
 * pointer's travel, keeping the largest distance from the down position seen so
 * far. Pure: returns the same object when the sample does not extend the reach.
 */
export function extendIdlePointerTravel(
  travel: IdlePointerTravel,
  position: IdlePointerPosition
): IdlePointerTravel {
  const dx = position.x - travel.downPosition.x;
  const dy = position.y - travel.downPosition.y;
  const travelSquaredPx = dx * dx + dy * dy;
  return travelSquaredPx > travel.maxTravelSquaredPx
    ? { downPosition: travel.downPosition, maxTravelSquaredPx: travelSquaredPx }
    : travel;
}

/**
 * A completed touch TAP — on anything, bare canvas included — wakes hidden
 * chrome. Desktop has two discoverable wake paths: Tab, and mousing over the
 * opacity-0 status bar, which stays hit-testable. Touch has neither, and the
 * one path it does have is undiscoverable: an idle .idle-hideable keeps a
 * hit-testable ::before hot-zone (src/index.css) and is the first entry of
 * IDLE_PAUSE_TARGET_SELECTOR, so a tap landing on a faded control's box
 * already woke chrome — but that box is invisible, so reaching it means blind-
 * tapping where a control used to be. Everything else fails: the bare canvas
 * covering most of the screen matches no pause selector, and the touch status
 * bar unmounts entirely (TouchStatusBar returns null), leaving no box to aim
 * at where desktop keeps one. Waking on any tap replaces that guesswork.
 *
 * Taps only, judged on the pointer's MAXIMUM travel (`travel`, accumulated per
 * pointerId by the caller) rather than on where it happened to end: orbit and
 * pinch gestures pass the threshold somewhere along the way and keep chrome
 * hidden while the scene is being driven, matching the desktop rule that scene
 * interaction does not postpone hiding. `travel` is null when no pointerdown
 * was recorded for this pointer — a pointerup with no history is never a tap.
 */
export function isIdleWakeTap(
  pointerType: string,
  travel: IdlePointerTravel | null,
  upPosition: IdlePointerPosition,
  threshold = IDLE_WAKE_TAP_MAX_MOVE_PX
): boolean {
  if (pointerType !== 'touch' || !travel) return false;
  const { maxTravelSquaredPx } = extendIdlePointerTravel(travel, upPosition);
  return maxTravelSquaredPx <= threshold * threshold;
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

/** The pause-target element a hover event lands on, or null — ignored scopes included. */
export function getIdleHoverPauseTarget(target: EventTarget | null): Element | null {
  if (!isElementTarget(target) || isIdleIgnoredTarget(target)) return null;
  return target.closest(IDLE_PAUSE_TARGET_SELECTOR);
}

/**
 * A latched hover pause is only real while its element is still in the
 * document. Pause targets routinely unmount mid-hover — a button that closes
 * its own modal fires no mouseout afterwards — and a boolean latch therefore
 * stayed set for the rest of the session, so chrome never auto-hid again after
 * the first such click. Connectedness is re-checked at decision time rather
 * than at event time because no DOM event marks the unmount.
 */
export function isIdleHoverPauseActive(element: Element | null): boolean {
  return element !== null && element.isConnected;
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
