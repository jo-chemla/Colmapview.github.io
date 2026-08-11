import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Contract: every utility-class token referenced in TS/TSX must be defined in
 * src/index.css. This project has NO Tailwind — a class only works if a
 * hand-written rule exists. Undefined classes are silent no-ops (see the
 * retro-fix precedent at index.css ~line 889 and docs in CLAUDE.md).
 *
 * ALLOWLIST was the known-debt escape hatch; the 2026-08-10-design-system-integrity
 * plan burned it down to zero. Do NOT add entries without a task/issue reference.
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
  // Grid track/placement families. Omitting these hid a whole inert layout:
  // ContextMenuEditor asked for `grid-cols-3` + `col-span-3`, neither of which
  // exists, so its outer grid silently collapsed to one column.
  'grid-cols', 'grid-rows', 'col-span', 'row-span', 'col-start', 'row-start',
  // Dash-form variant families, enumerated as they exist in index.css
  // (.hover-ds-hover, .hover-bg-ds-accent, …) rather than as a bare 'hover'.
  // A bare 'hover' prefix also swallows enum strings such as the PopupKind
  // 'hover-card' in components/ui/popupLayerInventory.ts.
  'hover-ds', 'hover-bg', 'hover-border', 'hover-opacity', 'hover-brightness',
  'hover-underline',
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

// Empty, and meant to stay that way: the design-system-integrity plan burned
// down every entry. A new class must be defined in index.css (or the reference
// removed) in the same change that introduces it — do not re-open this list
// without a task/issue reference.
const ALLOWLIST = new Set<string>([]);
// Note: some undefined classes have prefixes outside the scanner's candidate
// list and so could never be allowlisted here anyway (the stale check would flag
// them). The two the plan found — 'info-line' and 'tool-header-close' — were
// fixed directly: Task 11 defined the former in index.css, Task 4 deleted the
// latter.

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
