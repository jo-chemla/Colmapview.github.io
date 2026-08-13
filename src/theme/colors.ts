/**
 * Color constants for 3D visualization and canvas rendering.
 * UI colors should use CSS variables (--bg-*, --text-*, etc.) via Tailwind classes.
 */

import { requireCssHexColorInt } from '../utils/hexColor';

// 3D Visualization colors (bright colors preserved for visibility on dark background)
export const VIZ_COLORS = {
  frustum: {
    default: '#ff0000',
    selected: '#ff00ff',
    hover: '#6699aa',
    deleted: '#ff4444',  // Red for pending deletion
  },
  point: {
    triangulated: '#00ff00',
    untriangulated: '#ff0000',
  },
  axis: {
    x: 0xe60000,            // Red - X axis
    y: 0x00e600,            // Green - Y axis
    z: 0x0000e6,            // Blue - Z axis
  },
  interaction: {
    axisX: '#ff4444',
    axisY: '#44ff44',
    axisZ: '#4444ff',
    hover: '#ffff00',
  },
  material: {
    white: 0xffffff,     // Neutral white for textured meshes and center spheres
  },
  match: '#ff00ff',
  highlight: [1, 0, 1] as const,  // RGB for shader uniforms (magenta)
  // Suspense placeholder cube (Scene3D LoadingFallback). This was picked as a copy of
  // --text-secondary and is now deliberately NOT one: it is a two-background compromise,
  // not text. The 3D canvas background is user-toggleable, so the value has to read on
  // both #161616 (5.2:1) and white (3.5:1); the old #333333 was picked for a white canvas
  // and disappeared into the dark one at 1.6:1. Following --text-secondary up to #a8a8a8
  // would push the white case to 2.4:1, trading one background for the other, so this
  // literal stays where it is and is no longer a mirror of anything.
  wireframe: '#8a8a8a',
} as const;

/** Convert a CSS hex color string to a Three.js integer (e.g. '#ff4444' -> 0xff4444) */
export function hexToInt(hex: string): number {
  return requireCssHexColorInt(hex);
}

/** Axis colors for 3D interaction widgets (point markers, floor plane, picking cursor) */
export const INTERACTION_AXIS_COLORS: Record<string, { hex: number; css: string }> = {
  X: { hex: hexToInt(VIZ_COLORS.interaction.axisX), css: VIZ_COLORS.interaction.axisX },
  Y: { hex: hexToInt(VIZ_COLORS.interaction.axisY), css: VIZ_COLORS.interaction.axisY },
  Z: { hex: hexToInt(VIZ_COLORS.interaction.axisZ), css: VIZ_COLORS.interaction.axisZ },
} as const;

/** Hover highlight color as Three.js integer */
export const INTERACTION_HOVER_COLOR = hexToInt(VIZ_COLORS.interaction.hover);

/** Point marker colors: P1=red (X), P2=green (Y), P3=blue (Z) */
export const MARKER_COLORS_INT = [
  hexToInt(VIZ_COLORS.interaction.axisX),
  hexToInt(VIZ_COLORS.interaction.axisY),
  hexToInt(VIZ_COLORS.interaction.axisZ),
] as const;

/** Point colors as CSS strings for 2D overlays (PickingCursor) */
export const MARKER_COLORS_CSS = [
  VIZ_COLORS.interaction.axisX,
  VIZ_COLORS.interaction.axisY,
  VIZ_COLORS.interaction.axisZ,
] as const;

// Grid visualization colors (OriginVisualization infinite grid).
// The default canvas is the ds surface tone (--bg-secondary #161616), so the grid is a
// neutral ink that recedes on dark instead of the old orange, which was picked for a white
// canvas and glowed on a dark one. One ink, two weights: the major/minor hierarchy comes
// from the shader's alpha (0.8 vs 0.3 in originGridMaterial), not from two different tones.
//
// These literals are chosen for how they RENDER, not how they read in a swatch:
// originGridMaterial's fragment shader assigns gl_FragColor without the <colorspace_fragment>
// chunk, so THREE.Color's sRGB->linear conversion is never undone and every value here lands
// on screen about a gamma darker than its literal. Measured from a screenshot of the loaded
// toy scene (browse screenshot -> pixel histogram):
//   major 0x8f8f8f -> #3c3c3c on #161616, #6b6b6b on #ffffff
//   minor 0x888888 -> #222222 on #161616, #c5c5c5 on #ffffff (unchanged from the white era)
// Specifying the on-screen values directly (e.g. 0x4a4a4a / 0x2e2e2e) renders them DARKER
// than the canvas, i.e. an invisible grid. If the shader ever gains the missing colorspace
// conversion, re-measure and darken these to their rendered values.
// negativeAxis draws through a normal built-in material and is color-managed correctly, so
// it is untouched and still reads on both backgrounds.
export const GRID_COLORS = {
  negativeAxis: 0x666666,
  majorLines: 0x8f8f8f,
  minorLines: 0x888888,
} as const;

// Chart/histogram colors for SVG-based visualizations (StatusBar tooltips).
// Literal hexes, not var(--…): these feed SVG `fill` attributes rendered inside a
// portal-free <svg>, and the surrounding code passes them as plain strings — the
// same reason CANVAS_COLORS below is hardcoded. They are DERIVED from the ds
// warning ramp so the histogram reads as the same amber family as every other
// warning surface:
//   bar        = --warning verbatim (#b89b6b)
//   percentage = --warning + 24 per channel (#b8+18=#d0, #9b+18=#b3, #6b+18=#83),
//                the identical lightening step the system already uses for
//                --accent #b8b8b8 -> --accent-hover #d0d0d0. The percentage label
//                floats just ABOVE its bar on the tooltip card, so it stays the
//                lighter of the two to read against --bg-tertiary (8.30:1).
//   label      = --text-primary verbatim (#e8e8e8), was Tailwind gray-200 #e5e7eb
// If --warning or --text-primary move, re-derive these by hand.
export const CHART_COLORS = {
  bar: '#b89b6b',
  barBackground: 'rgba(255,255,255,0.05)',
  label: '#e8e8e8',
  percentage: '#d0b383',
} as const;

// Canvas rendering colors (hardcoded because canvas can't read CSS variables).
// Every opaque entry below is a verbatim mirror of the :root token named in its
// comment. The lockstep is ENFORCED by colors.test.ts, which parses :root out of
// src/index.css — before that test the "keep in lockstep" note was an honour
// system, and raising --text-secondary silently desynced this table.
export const CANVAS_COLORS = {
  bgVoid: '#0a0a0a',            // --bg-void
  bgSecondary: '#161616',       // --bg-secondary
  bgSecondaryOverlay: 'rgba(22, 22, 22, 0.85)',   // --bg-secondary @ 85%
  bgTertiary: '#1e1e1e',        // --bg-tertiary
  textPrimary: '#e8e8e8',       // --text-primary
  textSecondary: '#a8a8a8',     // --text-secondary
  textMuted: '#858585',         // --text-muted
  outline: '#000000',
  white: '#ffffff',
} as const;

// Per-link hover colors for the help panel's About tab (brand-specific)
export const LINK_COLORS = {
  github: '#facc15',
  bugs: '#ef4444',
  colmap: '#60a5fa',
} as const;

// sRGB linearization constants (for accurate color space conversion)
export const SRGB = {
  threshold: 0.04045,
  linearScale: 12.92,
  gammaOffset: 0.055,
  gammaScale: 1.055,
  gamma: 2.4,
} as const;

// Rainbow animation color cycling
export const RAINBOW = {
  chroma: 0.8,
  lightness: 0.4,
  saturation: 1.0,
  speedMultiplier: 0.5,
  // Hue segment boundaries for HSL to RGB conversion
  hueSegments: {
    redToYellow: 1 / 6,
    yellowToGreen: 2 / 6,
    greenToCyan: 3 / 6,
    cyanToBlue: 4 / 6,
    blueToMagenta: 5 / 6,
  },
} as const;

// Jet colormap thresholds for error visualization
export const COLORMAP = {
  jet: {
    threshold1: 0.25,
    threshold2: 0.5,
    threshold3: 0.75,
    multiplier: 4,
  },
  trackLength: {
    baseR: 0.1,
    rangeR: 0.1,
    baseG: 0.1,
    rangeG: 0.9,
    baseB: 0.5,
    rangeB: 0.2,
  },
} as const;

// Brightness constants for background toggle
export const BRIGHTNESS = {
  midpoint: 128,
  max: 255,
} as const;

// Distinct color palette for camera frustums (perceptually distinct, high saturation)
export const FRUSTUM_COLORS = [
  '#e6194b', // red
  '#3cb44b', // green
  '#ffe119', // yellow
  '#4363d8', // blue
  '#f58231', // orange
  '#911eb4', // purple
  '#42d4f4', // cyan
  '#f032e6', // magenta
  '#bfef45', // lime
  '#fabed4', // pink
  '#469990', // teal
  '#dcbeff', // lavender
  '#9a6324', // brown
  '#fffac8', // beige
  '#800000', // maroon
  '#aaffc3', // mint
  '#808000', // olive
  '#ffd8b1', // apricot
  '#000075', // navy
  '#a9a9a9', // gray
] as const;

// Get a distinct color for a camera by index (wraps around if more cameras than colors)
export function getCameraColor(index: number): string {
  return FRUSTUM_COLORS[index % FRUSTUM_COLORS.length];
}

/**
 * Semantic status colors as design-system utility class names.
 *
 * These map onto the ds tokens (--success/--info/--warning/--error) rather than
 * the Tailwind-era literals they used to carry (#4ade80/#60a5fa/#fbbf24/#f87171).
 * The ds tokens are canonical: before this, "success" rendered as one of two
 * different greens depending on whether a call site went through STATUS_COLORS
 * or hand-wrote `text-green-400`.
 *
 * `caution` is a deliberate SEMANTIC MERGE: it previously had its own
 * `text-orange-400`, defined for this key alone, sitting one hue step from
 * `warning`. The ds ramp has no orange between --warning and --error, and the
 * distinction was never legible at the sizes it shipped at (a 12px modal label),
 * so caution now resolves to the same token as warning. The key survives because
 * call sites read better naming their intent (approximation = caution).
 *
 * `highlight` keeps `text-purple-400`: there is NO ds analog for it. It marks the
 * "manifest" source in the cache legend, a category color rather than a status,
 * and folding it into an existing token would collide with a real status hue.
 */
export const STATUS_COLORS = {
  success: 'text-ds-success',
  info: 'text-ds-info',
  warning: 'text-ds-warning',
  error: 'text-ds-error',
  caution: 'text-ds-warning',
  highlight: 'text-purple-400',
} as const;

/**
 * Semantic status background colors as design-system utility class names.
 *
 * `inactive` is a --text-muted tint, not a surface tone. It first replaced the
 * old neutral-600 #525252 with `bg-ds-hover` on the reasoning that an
 * "unavailable" dot should recede — but --bg-hover #262626 on the cache-stats
 * card (--bg-tertiary #1e1e1e) is 1.102:1, a hole rather than a dot. Recede is
 * not vanish. `bg-ds-muted/50` composites to exactly #525252 on that card
 * (2.134:1), reproducing the old dot's weight from a ds derivative instead of a
 * fossil literal, and needs no new opaque token. See index.css .bg-ds-muted/50.
 */
export const STATUS_BG = {
  success: 'bg-ds-success',
  info: 'bg-ds-info',
  warning: 'bg-ds-warning',
  inactive: 'bg-ds-muted/50',
} as const;

/** Axis colors for UI icons (flat-UI palette, distinct from VIZ_COLORS.interaction) */
export const ICON_COLORS = {
  axisX: '#e74c3c',
  axisY: '#2ecc71',
  axisZ: '#3498db',
} as const;
