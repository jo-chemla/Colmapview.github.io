/**
 * Cooperative main-thread yielding for large parse/stats passes.
 *
 * The WASM reconstruction wrapper must live on the main thread: the renderer
 * consumes zero-copy typed-array views into its memory, the store actions call
 * it synchronously, and (without COOP/COEP headers on the static hosts we
 * deploy to) SharedArrayBuffer-backed worker memory is unavailable. So heavy
 * load work cannot move wholesale to a Web Worker — instead the big JS loops
 * yield to the event loop between bounded blocks, keeping input, paint and
 * React commits responsive while a multi-GB model is parsed in the background.
 *
 * Why not scheduler.yield(): its continuation jumps the queue of its own
 * priority level, which in practice starves React's MessageChannel commit
 * tasks and timers for the whole pass (measured: a 28s stats pass froze the
 * progress card and delivered ~7 timer ticks). A MessageChannel macrotask
 * queues FIFO with React's scheduler instead, and every few yields we fall
 * back to a real setTimeout so timer-driven machinery cannot starve either.
 */

/** Every Nth yield goes through setTimeout so timer tasks get a turn too. */
const TIMEOUT_YIELD_INTERVAL = 8;

let yieldCounter = 0;

interface YieldChannel {
  post: () => void;
  pending: Array<() => void>;
}

let yieldChannel: YieldChannel | null | undefined;

function getYieldChannel(): YieldChannel | null {
  if (yieldChannel !== undefined) {
    return yieldChannel;
  }
  if (typeof MessageChannel === 'undefined') {
    yieldChannel = null;
    return yieldChannel;
  }
  const channel = new MessageChannel();
  const state: YieldChannel = {
    post: () => channel.port2.postMessage(null),
    pending: [],
  };
  channel.port1.onmessage = () => {
    const resolvers = state.pending;
    state.pending = [];
    for (const resolve of resolvers) {
      resolve();
    }
  };
  // Node (vitest) exposes worker_threads-backed ports whose handlers keep the
  // process alive; unref them so the lazily-created singleton can never hold a
  // test runner open. No-op in browsers.
  (channel.port1 as unknown as { unref?: () => void }).unref?.();
  (channel.port2 as unknown as { unref?: () => void }).unref?.();
  yieldChannel = state;
  return yieldChannel;
}

/** Yield to the event loop so pending input/paint/React work can run. */
export function yieldToMain(): Promise<void> {
  yieldCounter += 1;
  const channel = yieldCounter % TIMEOUT_YIELD_INTERVAL === 0 ? null : getYieldChannel();
  if (channel) {
    return new Promise<void>((resolve) => {
      channel.pending.push(resolve);
      channel.post();
    });
  }
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Default time budget a block may hold the main thread before yielding. */
export const MAIN_THREAD_YIELD_BUDGET_MS = 14;

/**
 * Create a checkpoint function for long loops: call it periodically; it yields
 * to the event loop only once the elapsed budget is spent, so tight loops pay
 * (almost) nothing until a yield is actually due.
 */
export function createCooperativeYielder(
  budgetMs: number = MAIN_THREAD_YIELD_BUDGET_MS
): () => Promise<void> {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let blockStart = now();
  return async () => {
    if (now() - blockStart < budgetMs) {
      return;
    }
    await yieldToMain();
    blockStart = now();
  };
}
