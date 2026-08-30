# Splat Backend Notices Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the splat-backend notifications truthful and calm: progress while the fallback renderer downloads (not an error), a diagnosis that matches the real cause (insecure context ≠ incapable browser), and one informational outcome message instead of stacked warnings.

**Architecture:** All changes flow through the existing seams: reason strings in `splatBackendPolicy.ts`, notice selection in `splatBackendNoticePolicy.ts` (pure, chain-of-four), display in `SplatBackendStatusNotifier.tsx` (the single consumer), wired from `Scene3D.tsx`. No new stores, no new components; the notice policy gains a `severity` and a `sparkPreloadPending` input.

**Tech Stack:** React + TS, Zustand behind facades, Vitest. No e2e required (notification logic is policy+component tested; nothing hits canvas).

**Spec:** The Review Findings section below is the spec — it records the observed defects (from a real phone session) and the decided resolutions.

## Global Constraints

- Full gate before each task's commit: `npm run test:run && npm run lint && npx tsc -b --force && npm run build` (from `colmap-webview/`).
- **Release placement: `[Unreleased]` in CHANGELOG.md — the local `v0.11.0` tag does NOT move.** This work ships as 0.11.1. (User may override by relocating the bullets and re-tagging; that is not this plan's default.)
- MIXED line endings in the repo — use file-edit tools, never sed/perl.
- Components access stores only via `*StoreFacade` hooks (componentStoreBoundary test enforces). `useScene3DStoreFacade` already exposes `splatBackendAvailability` (line ~97) — no new subscription needed.
- Comments state constraints code can't show and must be accurate to shipped behavior.
- Notification API is fixed for this plan: `addNotification(type: 'info' | 'warning', message, duration?) => id` (info auto-dismisses, default 3000ms; warning persists) and `removeNotification(id)`. **Out of scope:** action/retry buttons on notifications, new severity levels.
- Executor mandate (user, standing): Opus implementers and reviewers.

---

## Review Findings (the spec)

Observed on a real phone loading over plain-HTTP LAN, with a splat selected:

- **R1 — transient state surfaced as an error.** `resolveSplatBackend` returns `status:'unavailable', reason:'No splat renderer is available'` during the window between "splat chosen" and "Spark's ~5 MB module finished downloading" (auto + webGpu `'unsupported'` + `availability.spark` still false). `getAutoWebGpuUnavailableNotice` (splatBackendNoticePolicy.ts:53-74) turns that into a persistent **warning** toast. The chain already suppresses the analogous `'Preparing WebGPU splat renderer'` reason by string-match — precedent for suppression, but by fragile string, and it misses this state. Resolution: suppress by STATE (`sparkPreloadPending` input), and show a self-removing info notification "Preparing splat renderer…" during the window. When the preload settles as failed, the warning legitimately fires (durable outcome).
- **R2 — wrong advice.** `navigator.gpu` is hidden in insecure contexts (plain HTTP), but `getBrowserWebGpuBackendState` reports the same `'unsupported'` as a genuinely incapable browser, so the toast tells a WebGPU-capable phone to "use a WebGPU-capable browser." `getBrowserWebGpuCompatibilityBlockReason` (splatBackendPolicy.ts:~99-118) is the per-cause reason seam (already special-cases Firefox/Linux) and gets an insecure-context branch. The suggestion suffix must NOT append the browser-upgrade advice for this reason.
- **R3 — stacked warnings for a successful outcome.** One user action produced two persistent warnings, though the end state was splats-rendering-via-Spark. Fallback notices (chains 3/4) become **info** (auto-dismiss, longer duration), shown once per session per reason (not per file); warnings remain for the forced-webgpu failure (chain 1) and the durable no-renderer state (chain 2). Dedupe today is last-key-only (`lastNoticeKeyRef`) — A→B→A re-fires; becomes a seen-set.
- **Not in scope:** retry affordance on the durable failure (needs notification-action UI — ticket for later); metric-side notices; the notification component's rendering.

Key code facts for implementers: `SplatBackendStatusNotifier` is the ONLY consumer of `getWebGpuSplatBackendNotice` and is mounted once in Scene3D.tsx (~line 425) with `addNotification` passed as a prop; `removeNotification` is already available in Scene3D (passed to WebGpuSplatCanvasLayer at ~line 415). Existing tests: `splatBackendNoticePolicy.test.ts`, `SplatBackendStatusNotifier.test.tsx`, `splatBackendPolicy.test.ts`.

---

### Task 1: Diagnose insecure context, and stop giving wrong advice

**Files:**
- Modify: `src/utils/splatBackendPolicy.ts` (`getBrowserWebGpuCompatibilityBlockReason`; new exported constant)
- Modify: `src/components/viewer3d/splatBackendNoticePolicy.ts` (`isWebGpuUnsupportedReason`, `withWebGpuFullFeaturesSuggestion`)
- Test: `src/utils/splatBackendPolicy.test.ts`, `src/components/viewer3d/splatBackendNoticePolicy.test.ts`

**Interfaces:**
- Produces: `WEBGPU_INSECURE_CONTEXT_REASON: string` (exported from splatBackendPolicy.ts) — this task's own notice-policy code and tests import it.
- `getBrowserWebGpuCompatibilityBlockReason(navigatorLike?, secureContext?)` gains an optional second parameter defaulting to the live `window.isSecureContext`.

- [ ] **Step 1: Write the failing policy tests**

In `src/utils/splatBackendPolicy.test.ts` (follow the file's existing navigatorLike-stub pattern for the Firefox/Linux tests):

```ts
  it('names the insecure context when WebGPU is hidden by plain HTTP', () => {
    // navigator.gpu is absent in insecure contexts even on capable browsers;
    // "use a WebGPU-capable browser" is wrong advice there.
    expect(
      getBrowserWebGpuCompatibilityBlockReason({ userAgent: 'Chrome' }, false)
    ).toBe(WEBGPU_INSECURE_CONTEXT_REASON);
  });

  it('does not blame the connection when WebGPU exists or the context is secure', () => {
    expect(getBrowserWebGpuCompatibilityBlockReason({ userAgent: 'Chrome', gpu: {} }, false)).toBeNull();
    expect(getBrowserWebGpuCompatibilityBlockReason({ userAgent: 'Chrome' }, true)).toBeNull();
  });
```

(Adapt the stub shape to the file's `BrowserWebGpuCompatibilityNavigator` type — `gpu` presence is the discriminator. Import the new constant.)

In `src/components/viewer3d/splatBackendNoticePolicy.test.ts`:

```ts
  it('suggests HTTPS, not a different browser, for the insecure-context reason', () => {
    const notice = getWebGpuSplatBackendNotice({
      requestedBackend: 'auto',
      splatFile: { name: 'scene.ply' },
      splatBackendResolution: {
        status: 'resolved',
        backend: 'spark',
        reason: `Spark fallback selected because ${WEBGPU_INSECURE_CONTEXT_REASON}`,
      } as SplatBackendResolution,
      webGpuSplatCanvasMounted: false,
    });
    expect(notice).not.toBeNull();
    expect(notice!.message).toContain('HTTPS');
    expect(notice!.message).not.toContain('WebGPU-capable browser');
  });
```

(Match the file's existing option-building helpers; if Task 2/3 have not run yet the notice shape has no `severity` — assert message only.)

- [ ] **Step 2: Run both files, verify the new tests fail**

Run: `npx vitest run src/utils/splatBackendPolicy.test.ts src/components/viewer3d/splatBackendNoticePolicy.test.ts`
Expected: FAIL — the constant doesn't exist; the insecure-reason notice either doesn't fire (chain 3's matcher misses it) or carries the browser-upgrade suffix.

- [ ] **Step 3: Implement the reason branch**

In `src/utils/splatBackendPolicy.ts`, add near the compatibility-block section:

```ts
export const WEBGPU_INSECURE_CONTEXT_REASON =
  'WebGPU needs a secure (HTTPS) connection and this page was loaded over plain HTTP';
```

Extend `getBrowserWebGpuCompatibilityBlockReason` with a `secureContext` parameter (default: `typeof window !== 'undefined' ? window.isSecureContext !== false : true` — absent means secure, since jsdom and some embedded webviews never define the property) and, AFTER the Firefox/Linux check, add (a browser that cannot run WebGPU over HTTPS either must not be told to reload over HTTPS):

```ts
  // navigator.gpu is defined only in secure contexts. On plain HTTP a fully
  // WebGPU-capable browser reports no gpu at all, so without this branch the
  // generic "unsupported" advice ("use a WebGPU-capable browser") is wrong —
  // the fix for the user is the URL scheme, not the browser.
  if (!navigatorLike.gpu && !secureContext) {
    return WEBGPU_INSECURE_CONTEXT_REASON;
  }
```

(Check the actual parameter type — if `BrowserWebGpuCompatibilityNavigator` lacks a `gpu` field, add it as optional. `createInitialSplatBackendState` and `getBrowserWebGpuBackendState`/`getBrowserWebGpuMetricState` all consult this function already, so the reason propagates to `webGpuFailureReason` with no further wiring — verify by reading `splatBackendStore.ts:38` and the two state functions.)

- [ ] **Step 4: Route the suggestion by reason type in the notice policy**

In `src/components/viewer3d/splatBackendNoticePolicy.ts`:

1. Import `WEBGPU_INSECURE_CONTEXT_REASON` from `../../utils/splatBackendPolicy`.
2. Extend `isWebGpuUnsupportedReason` so chain 3 still fires for the new reason:

```ts
function isWebGpuUnsupportedReason(reason: string): boolean {
  const normalizedReason = reason.toLowerCase();
  return normalizedReason.includes('webgpu is unsupported')
    || normalizedReason.includes('does not provide reliable webgpu support')
    || normalizedReason.includes('secure (https) connection');
}
```

3. Split the suffix:

```ts
const WEBGPU_HTTPS_SUGGESTION =
  'Reload the page over HTTPS for full features.';

function withWebGpuFullFeaturesSuggestion(message: string, reason: string): string {
  if (reason.includes(WEBGPU_INSECURE_CONTEXT_REASON)) {
    return `${message}. ${WEBGPU_HTTPS_SUGGESTION}`;
  }
  return isWebGpuUnsupportedReason(reason)
    ? `${message}. ${WEBGPU_FULL_FEATURES_SUGGESTION}`
    : message;
}
```

- [ ] **Step 5: Run to green, full gate, commit**

Run: `npx vitest run src/utils/splatBackendPolicy.test.ts src/components/viewer3d/splatBackendNoticePolicy.test.ts` → PASS, then the full gate.

```bash
git add src/utils/splatBackendPolicy.ts src/utils/splatBackendPolicy.test.ts src/components/viewer3d/splatBackendNoticePolicy.ts src/components/viewer3d/splatBackendNoticePolicy.test.ts
git commit -m "fix(splat): diagnose insecure-context WebGPU absence instead of blaming the browser"
```

---

### Task 2: Progress, not a warning, while the fallback downloads

**Files:**
- Modify: `src/components/viewer3d/splatBackendNoticePolicy.ts` (new `sparkPreloadPending` input; chain-2 gate)
- Modify: `src/components/viewer3d/SplatBackendStatusNotifier.tsx` (preparing-notification lifecycle)
- Modify: `src/components/viewer3d/Scene3D.tsx` (compute + pass the two new props)
- Test: `src/components/viewer3d/splatBackendNoticePolicy.test.ts`, `src/components/viewer3d/SplatBackendStatusNotifier.test.tsx`

**Interfaces:**
- Consumes: `shouldPreloadSparkSplatRuntime(requested, availability)` (existing export, splatBackendPolicy.ts:~236) and `splatBackendAvailability` from `useScene3DStoreFacade` (already exposed).
- Produces: `ForcedWebGpuSplatFailureNoticeOptions` gains `sparkPreloadPending: boolean`; `SplatBackendStatusNotifier` gains props `sparkPreloadPending: boolean` and `removeNotification: NotificationState['removeNotification']`. Task 3 builds on both.
- Produces: `SPLAT_RENDERER_PREPARING_MESSAGE = 'Preparing splat renderer…'` exported from the notice policy.

- [ ] **Step 1: Write the failing policy test**

In `splatBackendNoticePolicy.test.ts`:

```ts
  it('stays silent about "unavailable" while the Spark download is the expected next step', () => {
    const options = {
      requestedBackend: 'auto' as const,
      splatFile: { name: 'scene.ply' },
      splatBackendResolution: {
        status: 'unavailable',
        reason: 'No splat renderer is available',
      } as SplatBackendResolution,
      webGpuSplatCanvasMounted: false,
    };
    // Pending: the module is downloading — this is a loading state, not an outcome.
    expect(getWebGpuSplatBackendNotice({ ...options, sparkPreloadPending: true })).toBeNull();
    // Settled without Spark: now it IS a durable outcome and must warn.
    expect(getWebGpuSplatBackendNotice({ ...options, sparkPreloadPending: false })).not.toBeNull();
  });

  it('never suppresses the forced-webgpu failure notice for a pending preload', () => {
    const notice = getWebGpuSplatBackendNotice({
      requestedBackend: 'webgpu',
      splatFile: { name: 'scene.ply' },
      splatBackendResolution: { status: 'unavailable', reason: 'WebGPU is unsupported in this browser' } as SplatBackendResolution,
      webGpuSplatCanvasMounted: false,
      sparkPreloadPending: true,
    });
    expect(notice).not.toBeNull();
  });
```

All OTHER existing calls in the test file gain `sparkPreloadPending: false` (mechanical).

- [ ] **Step 2: Run, verify failure (unknown property / no suppression)**

Run: `npx vitest run src/components/viewer3d/splatBackendNoticePolicy.test.ts` → FAIL.

- [ ] **Step 3: Implement the policy gate**

In `splatBackendNoticePolicy.ts`: add `sparkPreloadPending: boolean;` to `ForcedWebGpuSplatFailureNoticeOptions`; in `getAutoWebGpuUnavailableNotice` add `options.sparkPreloadPending ||` to the early-return conditions, and REPLACE the string-match suppression of `'Preparing WebGPU splat renderer'` with a comment noting the state-based gate now covers the init window too — keep the string check only if a state where it fires with `sparkPreloadPending === false` exists (verify: auto + webGpu `'unavailable'` + spark loaded → gate is false, reason IS the preparing string → the string check must STAY; document that). Chain 1 (forced webgpu) takes no gate. Export:

```ts
export const SPLAT_RENDERER_PREPARING_MESSAGE = 'Preparing splat renderer…';
```

- [ ] **Step 4: Implement the notifier lifecycle**

In `SplatBackendStatusNotifier.tsx`, add the two props and a second effect:

```tsx
  const preparingIdRef = useRef<string | null>(null);

  // A pending Spark download is a loading state, not an outcome: show one
  // auto-removed info line instead of the "unavailable" warning the resolver
  // reports during the window. 60s ceiling is a leak guard — settle normally
  // removes it far earlier.
  useEffect(() => {
    const showPreparing = Boolean(splatFile) && sparkPreloadPending;
    if (showPreparing && preparingIdRef.current === null) {
      preparingIdRef.current = addNotification('info', SPLAT_RENDERER_PREPARING_MESSAGE, 60000);
    }
    if (!showPreparing && preparingIdRef.current !== null) {
      removeNotification(preparingIdRef.current);
      preparingIdRef.current = null;
    }
    return () => {
      if (preparingIdRef.current !== null) {
        removeNotification(preparingIdRef.current);
        preparingIdRef.current = null;
      }
    };
  }, [addNotification, removeNotification, splatFile, sparkPreloadPending]);
```

and pass `sparkPreloadPending` into `getWebGpuSplatBackendNotice`.

- [ ] **Step 5: Wire Scene3D**

At the mount site (~line 425), compute and pass (imports: `shouldPreloadSparkSplatRuntime` from `../../utils/splatBackendPolicy`; `splatBackendAvailability` is already available from the facade destructure — verify the local name at the top of the component):

```tsx
      <SplatBackendStatusNotifier
        addNotification={addNotification}
        removeNotification={removeNotification}
        requestedBackend={requestedSplatBackend}
        splatBackendResolution={splatBackendResolution}
        splatFile={splatFile}
        webGpuSplatCanvasMounted={webGpuSplatCanvasMounted}
        sparkPreloadPending={
          shouldPreloadSparkSplatRuntime(requestedSplatBackend, splatBackendAvailability)
          && !splatBackendAvailability.spark
        }
      />
```

- [ ] **Step 6: Component tests**

In `SplatBackendStatusNotifier.test.tsx` (follow its existing render/stub pattern), add: (a) pending true + splat file → `addNotification` called once with `('info', SPLAT_RENDERER_PREPARING_MESSAGE, 60000)` and NO warning call; (b) rerender with pending false + resolution still unavailable → `removeNotification` called with the returned id AND the warning fires; (c) rerender with pending false + resolution resolved-spark → preparing removed, fallback notice fires (message assertion loose — Task 3 changes severity).

- [ ] **Step 7: Run to green, full gate, commit**

```bash
git add src/components/viewer3d/splatBackendNoticePolicy.ts src/components/viewer3d/splatBackendNoticePolicy.test.ts src/components/viewer3d/SplatBackendStatusNotifier.tsx src/components/viewer3d/SplatBackendStatusNotifier.test.tsx src/components/viewer3d/Scene3D.tsx
git commit -m "fix(splat): show download progress instead of a transient 'no renderer' warning"
```

---

### Task 3: One calm outcome message, once per session

**Files:**
- Modify: `src/components/viewer3d/splatBackendNoticePolicy.ts` (notice gains `severity`; session-scoped keys for fallback notices)
- Modify: `src/components/viewer3d/SplatBackendStatusNotifier.tsx` (severity-aware display; seen-set dedupe)
- Test: both existing test files

**Interfaces:**
- Consumes: Task 2's shapes.
- Produces: `ForcedWebGpuSplatFailureNotice` gains `severity: 'info' | 'warning'`.

- [ ] **Step 1: Write the failing tests**

Policy: chain-1 (forced failure) and chain-2 (durable no-renderer) notices carry `severity: 'warning'`; chains 3/4 (resolved-spark fallbacks) carry `severity: 'info'` and a key that does NOT include the file name (assert two different `splatFile.name`s produce the SAME key for the same reason, while chain-1 keys still differ per file). Notifier: (a) info notices call `addNotification('info', message, 8000)`; (b) a notice whose key was ever seen is not re-added even after a different notice fired in between (A→B→A stays 2 calls total).

- [ ] **Step 2: Run, verify failure**

- [ ] **Step 3: Implement**

Policy: add `severity` to the returned objects — `'warning'` in `getForcedWebGpuSplatFailureNotice` and `getAutoWebGpuUnavailableNotice`, `'info'` in the two fallback builders; change the two fallback builders' keys from `` `${splatFile.name}:${reason}` `` to `` `fallback:${splatBackendResolution.reason}` `` with a comment: the fallback is a property of the SESSION's browser environment, not of the file, so a second splat must not re-announce it. Notifier: replace `lastNoticeKeyRef` with `const seenNoticeKeysRef = useRef(new Set<string>());`, guard with `.has`, add with `.add`, and call `addNotification(notice.severity, notice.message, notice.severity === 'info' ? 8000 : undefined)`.

- [ ] **Step 4: Run to green, full gate**

Also re-run the two files from Tasks 1-2 (same suites) plus `npm run test:run`.

- [ ] **Step 5: Commit**

```bash
git add src/components/viewer3d/splatBackendNoticePolicy.ts src/components/viewer3d/splatBackendNoticePolicy.test.ts src/components/viewer3d/SplatBackendStatusNotifier.tsx src/components/viewer3d/SplatBackendStatusNotifier.test.tsx
git commit -m "fix(splat): fallback notices are calm, precise, and once per session"
```

---

### Task 4: CHANGELOG + final verification

**Files:**
- Modify: `CHANGELOG.md` (`[Unreleased]` section — create it above `[0.11.0]` if absent)

- [ ] **Step 1: Add the bullets**

Under `## [Unreleased]` → `### Fixed`:

```markdown
- Choosing a splat no longer flashes a "no splat renderer is available" warning while the compatibility renderer is still downloading — that window now shows a brief "Preparing splat renderer…" note, and the warning is reserved for the case where the download actually failed.
- When WebGPU is hidden because the page was loaded over plain HTTP, the app now says so and suggests HTTPS, instead of wrongly advising a "WebGPU-capable browser".
- The compatibility-renderer notice is informational (auto-dismissing) and appears once per session, instead of a persistent warning re-raised for every splat file.
```

- [ ] **Step 2: Full gate; verify the tag did NOT move**

Run the full gate; then `git tag --points-at HEAD` must be EMPTY (v0.11.0 stays on its commit) and `git log --oneline v0.11.0..HEAD` shows exactly this plan's commits.

- [ ] **Step 3: Commit — DO NOT PUSH, DO NOT RE-TAG**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for the splat-backend notice redesign"
```

---

## Execution ledger

| Task | Status | Commit |
|------|--------|--------|
| 1. Insecure-context diagnosis | pending | |
| 2. Progress over transient warning | pending | |
| 3. Calm once-per-session outcome | pending | |
| 4. Changelog + tag-stays check | pending | |
