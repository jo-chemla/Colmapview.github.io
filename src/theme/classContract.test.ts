import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Contract: every utility-class token referenced in TS/TSX must be defined in
 * src/index.css. This project has NO Tailwind — a class only works if a
 * hand-written rule exists. Undefined classes are silent no-ops (see the
 * retro-fix precedent at index.css ~line 889 and docs in CLAUDE.md).
 *
 * ALLOWLIST = known debt, being burned down task-by-task by the
 * 2026-08-10-design-system-integrity plan. Do NOT add entries without a
 * task/issue reference.
 */

// ---- collect defined classes from index.css ----
const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
const defined = new Set<string>();
for (const m of css.matchAll(/\.((?:[\w-]|\\.)+)/g)) {
  defined.add(m[1].replace(/\\(.)/g, '$1'));
}

// ---- collect candidate tokens from source string literals ----
const SOURCES = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

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
  // Dash-form variant families, enumerated as they exist in index.css
  // (.hover-ds-hover, .hover-bg-ds-accent, …) rather than as a bare 'hover'.
  // A bare 'hover' prefix also swallows enum strings such as the PopupKind
  // 'hover-card' in components/ui/popupLayerInventory.ts.
  'hover-ds', 'hover-bg', 'hover-border', 'hover-opacity', 'hover-brightness',
];

// Positional utilities take numeric, fractional, arbitrary or keyword values —
// never direction words. This keeps `bottom-4` / `top-full` in scope while
// rejecting enum strings like the TouchFabPosition 'top-left'.
const POSITIONAL = new Set(['top', 'right', 'bottom', 'left']);
const POSITIONAL_VALUE_RE = /^\d|^\[|^(?:full|auto|px)$/;

function isCandidate(token: string): boolean {
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
  if (!base.includes('-') && !VARIANT_RE.test(token)) {
    return SINGLE_WORD_UTILITIES.has(base);
  }
  return PREFIXES.some((p) => {
    if (base !== p && !base.startsWith(`${p}-`)) return false;
    if (POSITIONAL.has(p)) return POSITIONAL_VALUE_RE.test(base.slice(p.length + 1));
    return true;
  });
}

// Comment prose is not markup. Doc comments here routinely name utilities in
// backticks *because* they do not exist (splatPickerViewModel documents
// `z-[600]` while deliberately applying the z-index inline), and the literal
// scanner cannot tell that prose from a className.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\w'"`\\])\/\/[^\n]*/g, '$1');
}

const found = new Set<string>();
for (const [path, source] of Object.entries(SOURCES)) {
  if (path.includes('.test.') || path.includes('classContract')) continue;
  for (const m of stripComments(source).matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    const literal = m[1] ?? m[2] ?? m[3] ?? '';
    for (const segment of literal.split(/\$\{[^}]*\}/)) {
      for (const token of segment.split(/\s+/)) {
        if (isCandidate(token)) found.add(token);
      }
    }
  }
}

// Known debt — burned down by the design-system-integrity plan.
const ALLOWLIST = new Set<string>([
  // Task 4 (hover/press restoration)
  'hover:opacity-90', 'hover:text-ds-primary', 'hover:bg-ds-tertiary',
  'hover:bg-ds-accent/90', 'hover:bg-ds-hover', 'hover:bg-ds-secondary',
  'hover:text-ds-error', 'hover:text-ds-accent', 'hover:bg-ds-success/20',
  'hover:bg-ds-error/20', 'hover:border-ds-border-hover',
  'active:scale-95', 'active:scale-98',
  'bg-ds-secondary/50', 'bg-ds-error/20', 'bg-ds-success/20',
  'hover-ds-accent', 'border-ds-border', 'bg-ds-bg-secondary', 'shrink-0',
  // Task 5 (focus)
  'focus:outline-none',
  // Task 6 (geometry)
  'px-2.5', 'py-0.5', 'pb-1.5', 'rounded-t-2xl',
  'min-w-[120px]', 'min-w-[300px]', 'min-w-[420px]',
  'max-w-[400px]', 'max-w-[200px]', 'max-h-[80vh]',
  'min-h-[44px]', 'min-h-[48px]', 'text-[10px]', 'text-[8px]', 'text-6xl',
  'w-4.5', 'h-4.5',
  // Task 7 (text tones / status colors)
  'text-ds-tertiary', 'text-orange-400',
  // discovered on first run — assign to a task
  'active:bg-ds-hover', 'bg-ds-muted/30', 'bg-ds-secondary/20',
  'bg-ds-tertiary/95', 'bg-ds-void/60', 'border-ds-muted', 'bottom-4',
  'bottom-full', 'cursor-help', 'gap-x-5', 'max-w-[520px]', 'max-w-[80px]',
  'min-w-[400px]', 'pl-0.5', 'right-4', 'rounded-l-lg', 'rounded-r-none',
  'shadow-ds', 'shadow-lg', 'shadow-sm', 'text-ds-muted/80', 'top-full',
  'tracking-tight',
]);
// Note: 'tool-header-close' and 'info-line' are also undefined classes, but
// their prefixes are outside the scanner's candidate list so they cannot be
// allowlisted here (the stale-check would flag them). Task 4 deletes the
// former; Task 11 defines the latter in index.css.

describe('utility class contract', () => {
  it('every referenced utility class is defined in index.css', () => {
    const missing = [...found]
      .filter((t) => !defined.has(t) && !ALLOWLIST.has(t))
      .sort();
    expect(missing).toEqual([]);
  });

  it('allowlist contains no stale entries (fixed classes must be removed)', () => {
    const stale = [...ALLOWLIST].filter((t) => !found.has(t) || defined.has(t)).sort();
    expect(stale).toEqual([]);
  });
});
