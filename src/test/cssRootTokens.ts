import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The stylesheet every :root token contract in the suite reads. */
export const INDEX_CSS_PATH = resolve(__dirname, '../index.css');

export const ROOT_FONT_SIZE = 16;

/**
 * Shared reader for the design tokens declared in `:root`. Three contract
 * tests (colors, classContract, toolbarColumnHeight) each hand-rolled this
 * with divergent behavior — all truncated at the FIRST `:root` block and one
 * stored silent NaN — so reorganizing the tokens broke each differently.
 * One parser, one failure mode.
 *
 * Comments are stripped first: the :root block is thick with prose that
 * quotes hex values and contrast arithmetic, and a value named in prose must
 * never be mistaken for a declaration. Escaped names (`--sp-1\.5`) are
 * stored unescaped (`--sp-1.5`). EVERY `:root` block in the file contributes
 * (later blocks override earlier ones, matching the cascade).
 *
 * Reading every block is future-proofing, not a behaviour change: index.css
 * declares exactly ONE `:root` today, so this returns what the three private
 * parsers returned. In particular the compact tier does NOT re-open `:root` —
 * it re-declares the `--sp-*` rungs in px on `.tool-modal-responsive,
 * .hover-panel-responsive`, relying on inheritance — so the desktop rungs the
 * ladder contracts assert are never overwritten by the compact px values.
 * Keep it that way: a `@media { :root { --sp-*: …px } }` would land in this
 * map and silently redefine the desktop ladder those tests pin.
 */
export function readRootTokens(cssPath: string = INDEX_CSS_PATH): Map<string, string> {
  const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const tokens = new Map<string, string>();
  let blocks = 0;
  for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
    blocks += 1;
    for (const declaration of block[1].matchAll(/(--(?:[\w-]|\\.)+)\s*:\s*([^;]+);/g)) {
      tokens.set(declaration[1].replace(/\\(.)/g, '$1'), declaration[2].trim());
    }
  }
  if (blocks === 0) throw new Error(`no :root block found in ${cssPath}`);
  return tokens;
}

/**
 * Resolve a declaration VALUE to pixels: raw px, rem (16px root), bare 0, or
 * a `var(--name)` chain through other tokens. THROWS on anything else — a
 * contract test that measures a utility must fail loudly on a rung it cannot
 * read, never report a silent 0 or NaN.
 */
function finitePixels(pixels: number, value: string): number {
  if (!Number.isFinite(pixels)) throw new Error(`cannot resolve "${value}" to pixels`);
  return pixels;
}

export function resolveValueToPixels(tokens: Map<string, string>, value: string): number {
  const trimmed = value.trim();
  const reference = trimmed.match(/^var\((--(?:[\w-]|\\.)+)\)$/);
  if (reference) {
    const name = reference[1].replace(/\\(.)/g, '$1');
    const next = tokens.get(name);
    if (next === undefined) {
      throw new Error(`${trimmed} does not resolve to a :root token`);
    }
    return resolveValueToPixels(tokens, next);
  }
  // `[\d.]+` also admits malformed numerals like `1.2.3`, which Number() turns
  // into NaN — the silent value this parser exists to refuse. Check the result,
  // not just the shape.
  const rem = trimmed.match(/^([\d.]+)rem$/);
  if (rem) return finitePixels(Number(rem[1]) * ROOT_FONT_SIZE, value);
  const px = trimmed.match(/^([\d.]+)px$/);
  if (px) return finitePixels(Number(px[1]), value);
  if (trimmed === '0') return 0;
  throw new Error(`cannot resolve "${value}" to pixels`);
}
