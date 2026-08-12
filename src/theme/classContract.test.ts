import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TOUCH } from './sizing';

/**
 * Contract: every utility-class token referenced in TS/TSX must be defined in
 * src/index.css. This project has NO Tailwind — a class only works if a
 * hand-written rule exists. Undefined classes are silent no-ops (see the
 * retro-fix precedent at index.css ~line 889 and docs in CLAUDE.md).
 *
 * The contract stands on its own: a new class must be defined in index.css (or
 * the reference removed) in the same change that introduces it. There is no
 * allowlist — re-introducing one is a deliberate act, not a shortcut.
 */

// Comment prose is not markup. Doc comments here routinely name utilities in
// backticks *because* they do not exist (splatPickerViewModel documents
// `z-[600]` while deliberately applying the z-index inline), and the literal
// scanner cannot tell that prose from a className. The same strip runs over the
// CSS side: a class named only inside a /* … */ note is documentation, not a
// rule, and must not satisfy the contract.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\w'"`\\])\/\/[^\n]*/g, '$1');
}

// ---- collect defined classes from index.css ----
const CSS_PATH = resolve(__dirname, '../index.css');

function collectDefinedClasses(): Set<string> {
  const css = stripComments(readFileSync(CSS_PATH, 'utf8'));
  const classes = new Set<string>();
  for (const m of css.matchAll(/\.((?:[\w-]|\\.)+)/g)) {
    classes.add(m[1].replace(/\\(.)/g, '$1'));
  }
  return classes;
}

const defined = collectDefinedClasses();

// ---- collect candidate tokens from source string literals ----
// Deliberately a synchronous fs walk, not `import.meta.glob(..., { eager: true })`:
// the eager glob made Vite transform every file under src/ before this file's body
// could run (~40s), which starved the other fs-walking suites and produced timeout
// failures across the run. Same idiom as components/componentStoreBoundary.test.ts.
const SRC_ROOT = resolve(__dirname, '..');

// Test files are excluded at the walk: they pin class strings verbatim, so
// scanning them would report the same token twice and let a test keep a deleted
// class "referenced". classContract's own source is excluded for the same reason.
function isScannableSource(name: string): boolean {
  if (!name.endsWith('.ts') && !name.endsWith('.tsx')) return false;
  if (name.includes('.test.') || name.includes('.spec.')) return false;
  return !name.startsWith('classContract');
}

function collectSourceFiles(directory: string, out: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(entryPath, out);
    } else if (isScannableSource(entry.name)) {
      out.push(entryPath);
    }
  }
  return out;
}

const VARIANT_RE = /^(?:hover|focus|active|disabled|group-hover(?:\/[\w-]+)?):/;
const SINGLE_WORD_UTILITIES = new Set([
  'flex', 'grid', 'hidden', 'block', 'inline', 'truncate', 'relative',
  'absolute', 'fixed', 'sticky', 'static', 'isolate', 'uppercase',
  'capitalize', 'underline', 'rounded', 'border', 'transition', 'sr-only',
]);
const PREFIXES = [
  'bg', 'text', 'border', 'rounded', 'shadow', 'opacity', 'accent',
  'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr',
  'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', '-m', '-mx', '-my', '-mt', '-mb', '-ml', '-mr',
  'gap', 'space-x', 'space-y', 'w', 'h', 'min-w', 'min-h', 'max-w', 'max-h',
  'z', 'inset', 'top', 'bottom', 'left', 'right', 'translate', '-translate',
  'scale', 'rotate', 'flex', 'inline-flex', 'items', 'justify', 'self',
  'leading', 'font', 'tracking', 'whitespace', 'break', 'overflow',
  'object', 'aspect', 'cursor', 'select', 'pointer-events', 'transition',
  'duration', 'ease', 'animate', 'outline', 'ring', 'backdrop', 'from', 'to',
  'line', 'group', 'focus', 'active', 'shrink', 'grow',
  // Grid track/placement families. Omitting these hid a whole inert layout:
  // ContextMenuEditor asked for `grid-cols-3` + `col-span-3`, neither of which
  // exists, so its outer grid silently collapsed to one column.
  'grid-cols', 'grid-rows', 'col-span', 'row-span', 'col-start', 'row-start',
  // Dash-form variant family (.hover-ds-hover, .hover-bg-ds-accent, …). Bare
  // 'hover' covers every one of them, including composites like
  // .hover-interactive that an enumerated list kept missing.
  'hover',
];

// Enum strings that read as `hover-*` classes but are not markup. Checked before
// the prefix match so the bare 'hover' prefix above stays safe.
const NON_CLASS_TOKENS = new Set(['hover-card']);

// Positional utilities take numeric, fractional, arbitrary or keyword values —
// never direction words. This keeps `bottom-4` / `top-full` in scope while
// rejecting corner-enum strings like 'top-left' / 'bottom-right'.
const POSITIONAL = new Set(['top', 'right', 'bottom', 'left']);
const POSITIONAL_VALUE_RE = /^\d|^\[|^(?:full|auto|px)$/;

function isCandidate(token: string): boolean {
  if (NON_CLASS_TOKENS.has(token)) return false;
  if (token.length < 2 || /[A-Z{}$()=<>'"*]/.test(token)) return false;
  // `border-style:` and friends are CSS property fragments inside style
  // strings/comments, not class tokens.
  if (token.endsWith(':')) return false;
  const base = token.replace(VARIANT_RE, '');
  if (!base) return false;
  // A slash only ever introduces an opacity modifier (`bg-ds-error/20`) or a
  // fraction (`left-1/2`), so the trailing segment must be numeric/arbitrary.
  // Rejects slash-joined prose such as layer notes in popupLayerInventory.
  if (base.includes('/')) {
    const modifier = base.slice(base.lastIndexOf('/') + 1);
    if (!/^\d+$/.test(modifier) && !/^\[[^\]]*\]$/.test(modifier)) return false;
  }
  // Applies to the bare token AND to its variant forms: `hover:underline` must be
  // checked as `underline`, or single-word variants slip past the contract
  // entirely — the exact blind spot this scanner exists to close.
  if (!base.includes('-')) {
    return SINGLE_WORD_UTILITIES.has(base);
  }
  return PREFIXES.some((p) => {
    if (base !== p && !base.startsWith(`${p}-`)) return false;
    if (POSITIONAL.has(p)) return POSITIONAL_VALUE_RE.test(base.slice(p.length + 1));
    return true;
  });
}

function harvest(): Set<string> {
  const tokens = new Set<string>();
  for (const file of collectSourceFiles(SRC_ROOT)) {
    const source = stripComments(readFileSync(file, 'utf8'));
    for (const m of source.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
      const literal = m[1] ?? m[2] ?? m[3] ?? '';
      for (const segment of literal.split(/\$\{[^}]*\}/)) {
        for (const token of segment.split(/\s+/)) {
          if (isCandidate(token)) tokens.add(token);
        }
      }
    }
  }
  return tokens;
}

const found = harvest();

describe('utility class contract', () => {
  it('every referenced utility class is defined in index.css', () => {
    const missing = [...found].filter((t) => !defined.has(t)).sort();
    expect(missing).toEqual([]);
  });

  it('defines every escaped token verbatim (no Tailwind JIT to expand variants)', () => {
    // The contract above strips the variant prefix before looking a token up, so
    // `hover:text-ds-primary` passes on the strength of `.text-ds-primary`
    // alone — yet with no Tailwind the hover rule is never generated and the
    // reference is inert. Same for arbitrary-value brackets. Those tokens must
    // therefore exist in index.css under their OWN name (escaped there as
    // `.hover\:…` / `.w-\[3px\]`), which collectDefinedClasses unescapes.
    const escaped = [...found].filter((t) => t.includes(':') || t.includes('['));
    const missing = escaped.filter((t) => !defined.has(t)).sort();
    expect(missing).toEqual([]);
  });

  it('keeps .rounded-r-none after the .rounded shorthand', () => {
    // Equal specificity: the override only wins on source order (see index.css).
    const css = readFileSync(CSS_PATH, 'utf8');
    expect(css.indexOf('.rounded-r-none')).toBeGreaterThan(css.indexOf('.rounded {'));
  });

  it('keeps the tap-target custom property in sync with TOUCH.minTapTarget', () => {
    const css = readFileSync(CSS_PATH, 'utf8');
    expect(css).toContain(`--tap-target-min: ${TOUCH.minTapTarget}px`);
  });
});
