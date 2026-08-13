import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Contract: src/fonts.css vendors a pruned subset of the @fontsource-variable
 * packages' @font-face rules (latin + latin-ext only, see that file's header).
 * Hand-copied declarations rot silently — Vite only WARNS when a url() fails to
 * resolve, so a fontsource release that renames a file would ship a build whose
 * text falls back to system fonts everywhere. These assertions turn every such
 * drift into a test failure.
 */

const REPO_ROOT = resolve(__dirname, '../..');
const FONTS_CSS = resolve(REPO_ROOT, 'src/fonts.css');
const INDEX_CSS = resolve(REPO_ROOT, 'src/index.css');
const PACKAGES = ['ibm-plex-sans', 'jetbrains-mono'] as const;
const KEPT_SUBSETS = ['latin', 'latin-ext'] as const;

interface FontFaceRule {
  family: string;
  style: string;
  display: string;
  weight: string;
  format: string;
  url: string;
  file: string;
  unicodeRange: string;
}

function parseFontFaces(css: string): FontFaceRule[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
    const pick = (property: string): string =>
      (new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;]+);`).exec(body)?.[1] ?? '').trim();
    const url = /url\(\s*([^)\s]+)\s*\)/.exec(body)?.[1] ?? '';
    return {
      family: pick('font-family'),
      style: pick('font-style'),
      display: pick('font-display'),
      weight: pick('font-weight'),
      format: /format\((['"])([^'"]*)\1\)/.exec(body)?.[2] ?? '',
      url,
      file: url.slice(url.lastIndexOf('/') + 1),
      unicodeRange: pick('unicode-range'),
    };
  });
}

const vendored = parseFontFaces(readFileSync(FONTS_CSS, 'utf8'));

const upstream = new Map<string, FontFaceRule>();
for (const pkg of PACKAGES) {
  const packageCss = resolve(REPO_ROOT, `node_modules/@fontsource-variable/${pkg}/index.css`);
  for (const rule of parseFontFaces(readFileSync(packageCss, 'utf8'))) {
    upstream.set(rule.file, rule);
  }
}

describe('vendored webface contract', () => {
  it('declares one face per kept subset per family', () => {
    expect(vendored.map((rule) => rule.file).sort()).toEqual([
      'ibm-plex-sans-latin-ext-wght-normal.woff2',
      'ibm-plex-sans-latin-wght-normal.woff2',
      'jetbrains-mono-latin-ext-wght-normal.woff2',
      'jetbrains-mono-latin-wght-normal.woff2',
    ]);
  });

  it('copies every descriptor verbatim from the fontsource package', () => {
    // Drift in weight range, unicode-range or format is what makes a vendored
    // face render subtly wrong rather than not at all.
    for (const rule of vendored) {
      const source = upstream.get(rule.file);
      expect(source, `${rule.file} is not declared by any installed fontsource package`)
        .toBeDefined();
      const { url: _vendoredUrl, ...vendoredDescriptors } = rule;
      const { url: _upstreamUrl, ...upstreamDescriptors } = source!;
      expect(vendoredDescriptors).toEqual(upstreamDescriptors);
    }
  });

  it('points every url at a woff2 that exists in the installed package', () => {
    for (const rule of vendored) {
      expect(rule.url).toMatch(/^@fontsource-variable\/[\w-]+\/files\/[\w-]+\.woff2$/);
      expect(existsSync(resolve(REPO_ROOT, 'node_modules', rule.url)), `missing ${rule.url}`)
        .toBe(true);
    }
  });

  it('keeps the pruned subsets out of the bundle', () => {
    // The prune is the point: re-adding cyrillic/greek/vietnamese should be a
    // deliberate edit here, not an accidental re-import of the package entry.
    const subsets = new Set(
      // Longest-first alternation: `latin` would otherwise swallow `latin-ext`.
      vendored.map((rule) => /-(latin-ext|latin|cyrillic-ext|cyrillic|greek|vietnamese)-/.exec(rule.file)?.[1]),
    );
    expect([...subsets].sort()).toEqual([...KEPT_SUBSETS]);
  });

  it('declares the families the design tokens ask for', () => {
    // A typo in a vendored family name is invisible: every token silently falls
    // back to the system stack listed after it.
    const indexCss = readFileSync(INDEX_CSS, 'utf8');
    const families = new Set(vendored.map((rule) => rule.family));
    for (const token of ['--font-sans', '--font-mono']) {
      const value = new RegExp(`${token}:\\s*([^;]+);`).exec(indexCss)?.[1] ?? '';
      const head = value.split(',')[0].trim();
      expect(families, `${token} leads with ${head}, which no @font-face declares`)
        .toContain(head);
    }
  });
});
