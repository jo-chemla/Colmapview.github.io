import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANVAS_COLORS, CHART_COLORS, LINK_COLORS } from './colors';
import {
  SPLAT_PSNR_GREEN,
  SPLAT_PSNR_ORANGE,
  SPLAT_PSNR_RED,
  SPLAT_PSNR_UNAVAILABLE_COLOR,
  SPLAT_PSNR_YELLOW,
} from '../components/viewer3d/splatPsnrMetric';

/**
 * Contract: the TS colour tables that MIRROR a CSS token must equal that token.
 *
 * A handful of literals in colors.ts are hardcoded copies of :root variables
 * because their consumers cannot read CSS at all — CANVAS_COLORS feeds
 * `ctx.fillStyle` on a 2D canvas, CHART_COLORS feeds SVG `fill` attributes passed
 * as plain strings. Their comments have always said "keep in lockstep", but
 * nothing enforced it: moving --text-secondary desynced CANVAS_COLORS silently,
 * which is exactly the drift this file exists to catch. The CSS side stays the
 * single source of truth; this test only asserts the copies still match it.
 *
 * Only DECLARED mirrors belong here. VIZ_COLORS.wireframe is deliberately absent:
 * it used to copy --text-secondary and now documents itself as an independent
 * two-background compromise, so pinning it would re-couple what was uncoupled.
 * LINK_COLORS is absent for the opposite reason — it is per-destination BRAND
 * colour that never mirrored a token — but it is asserted NOT to collide with
 * one, so "exempt" cannot quietly become "drifted".
 */

const CSS_PATH = resolve(__dirname, '../index.css');

// The :root block is thick with explanatory comments that quote hex values and
// contrast arithmetic ("L >= 4.5 * (0.0129830 + 0.05) ..."). Strip them first so a
// value named in prose can never be mistaken for a declaration — the same rule
// classContract.test.ts applies to both sides of its contract.
function readRootTokens(): Map<string, string> {
  const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const root = /:root\s*\{([^}]*)\}/.exec(css);
  if (!root) throw new Error(`no :root block found in ${CSS_PATH}`);
  const tokens = new Map<string, string>();
  for (const m of root[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(m[1], m[2].trim());
  }
  return tokens;
}

const tokens = readRootTokens();

function token(name: string): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`${name} is not declared in :root`);
  return value;
}

/** '#b89b6b' -> [184, 155, 107] */
function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

describe('TS <-> CSS colour mirrors', () => {
  it('parses the :root token block', () => {
    // Guards the parser itself: a rename or a reformat that made readRootTokens
    // return an empty map would otherwise make every assertion below vacuous.
    expect(tokens.size).toBeGreaterThan(20);
    expect(token('--text-muted')).toBe('#858585');
  });

  it('keeps CANVAS_COLORS in lockstep with the tokens it copies', () => {
    // Table form so a new canvas colour is one line, and so a failure names the
    // token rather than just reporting two hexes that differ.
    const mirrors: Array<[keyof typeof CANVAS_COLORS, string]> = [
      ['bgVoid', '--bg-void'],
      ['bgSecondary', '--bg-secondary'],
      ['bgTertiary', '--bg-tertiary'],
      ['textPrimary', '--text-primary'],
      ['textSecondary', '--text-secondary'],
      ['textMuted', '--text-muted'],
    ];
    const actual = mirrors.map(([key]) => `${key}=${CANVAS_COLORS[key]}`);
    const expected = mirrors.map(([key, name]) => `${key}=${token(name)}`);
    expect(actual).toEqual(expected);
  });

  it('keeps the canvas overlay on the --bg-secondary channels', () => {
    // bgSecondaryOverlay is the same surface at 85%, so only its rgb triple is
    // pinned; the alpha is a canvas-side choice.
    const [r, g, b] = channels(token('--bg-secondary'));
    expect(CANVAS_COLORS.bgSecondaryOverlay).toBe(`rgba(${r}, ${g}, ${b}, 0.85)`);
  });

  it('keeps CHART_COLORS on the --warning / --text-primary ramp', () => {
    expect(CHART_COLORS.bar).toBe(token('--warning'));
    expect(CHART_COLORS.label).toBe(token('--text-primary'));
  });

  it('derives the histogram percentage label from --warning', () => {
    // Documented derivation (colors.ts): --warning + 24 per channel, the same
    // lightening step as --accent #b8b8b8 -> --accent-hover #d0d0d0. Pinned as
    // arithmetic, not as a hex, so re-deriving is mechanical if --warning moves.
    const lightened = channels(token('--warning'))
      .map((c) => (c + 24).toString(16).padStart(2, '0'))
      .join('');
    expect(CHART_COLORS.percentage).toBe(`#${lightened}`);
    const [accent, accentHover] = [token('--accent'), token('--accent-hover')].map(channels);
    expect(accentHover[0] - accent[0]).toBe(24);
  });

  it('pins the unavailable metric colour to --text-muted, and only that one', () => {
    // "No metric for this image" is an absence — chrome — so it mirrors the muted
    // token and must move with it.
    expect(SPLAT_PSNR_UNAVAILABLE_COLOR).toBe(token('--text-muted'));

    // The four quality stops are deliberately NOT ds tokens: this is a data
    // encoding, and derived from --error/--warning/--success the ramp loses the
    // separation that is its entire purpose (tried and rejected 2026-08-20, see
    // splatPsnrMetric.ts). Assert they stay OFF the semantic ramp, so a future
    // consolidation pass cannot quietly re-mute them.
    const semantic = ['--error', '--warning', '--success'].map(token);
    for (const stop of [SPLAT_PSNR_RED, SPLAT_PSNR_ORANGE, SPLAT_PSNR_YELLOW, SPLAT_PSNR_GREEN]) {
      expect(semantic).not.toContain(stop);
    }
  });

  it('pins the vivid quality-ramp stops by value', () => {
    // These four are a DATA ENCODING, not chrome (splatPsnrMetric.ts). The
    // off-the-semantic-ramp guard above cannot stop a re-mute that picks new
    // near-muted hexes — that exact consolidation shipped and was reverted
    // (user decision 2026-08-24: vivid). Moving these is a product decision;
    // update this test only alongside one.
    expect(SPLAT_PSNR_RED).toBe('#ef4444');
    expect(SPLAT_PSNR_ORANGE).toBe('#fb923c');
    expect(SPLAT_PSNR_YELLOW).toBe('#facc15');
    expect(SPLAT_PSNR_GREEN).toBe('#22c55e');
  });

  it('keeps the About-tab brand hues clear of the token palette', () => {
    // LINK_COLORS is a DOCUMENTED exemption (colors.ts): per-destination brand
    // hue, not status. This does not pin its values — a rebrand is free to move
    // them — it pins that the exemption stays an exemption. If a brand hue ever
    // equals a semantic token, one of the two is wrong: either the link is
    // secretly a status, or the palette drifted onto someone's brand.
    const semantic = ['--success', '--warning', '--error', '--info', '--accent']
      .map((name) => token(name).toLowerCase());
    const collisions = Object.entries(LINK_COLORS)
      .filter(([, hex]) => semantic.includes(hex.toLowerCase()))
      .map(([key]) => key);
    expect(collisions).toEqual([]);
  });
});
