/**
 * Remote dataset index for the start-screen dataset picker.
 *
 * When the app loads without a ?url= parameter, the picker fetches a small
 * JSON index listing hosted COLMAP models and offers one-click progressive
 * loads (?url=<manifest>&progressive=1). Extra entries can be injected via a
 * `manifests` query parameter (comma-separated manifest URLs).
 */

export const REMOTE_DATASET_INDEX_URL =
  'https://datasets.sanpietro.iconem.com/cam-poses/Interior-binary-colmap/index.json';

export interface DatasetPickerEntry {
  name: string;
  /** Absolute manifest URL for the viewer link. */
  manifestUrl: string;
  images?: number;
  points?: number;
}

interface RawIndexEntry {
  name?: unknown;
  manifest?: unknown;
  images?: unknown;
  points?: unknown;
}

function asPositiveCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined;
}

/**
 * Parse a dataset index document into picker entries. Accepts either a bare
 * array of entries or an object with a `datasets` array, and drops anything
 * malformed rather than failing the whole index. Relative `manifest` paths
 * resolve against the index URL, so the index can sit next to its models.
 */
export function parseDatasetIndex(data: unknown, indexUrl: string): DatasetPickerEntry[] {
  const rawEntries: unknown = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { datasets?: unknown }).datasets)
      ? (data as { datasets: unknown[] }).datasets
      : [];
  if (!Array.isArray(rawEntries)) {
    return [];
  }

  const entries: DatasetPickerEntry[] = [];
  for (const raw of rawEntries) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const { name, manifest, images, points } = raw as RawIndexEntry;
    if (typeof manifest !== 'string' || manifest.length === 0) {
      continue;
    }
    let manifestUrl: string;
    try {
      manifestUrl = new URL(manifest, indexUrl).toString();
    } catch {
      continue;
    }
    entries.push({
      name: typeof name === 'string' && name.length > 0 ? name : manifest,
      manifestUrl,
      images: asPositiveCount(images),
      points: asPositiveCount(points),
    });
  }
  return entries;
}

/** Derive a short display name for a bare manifest URL (e.g. .../S4/manifest.json -> S4). */
export function getManifestDisplayName(manifestUrl: string): string {
  try {
    const segments = new URL(manifestUrl).pathname.split('/').filter(Boolean).map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
    const last = segments[segments.length - 1] ?? '';
    const stem = last.replace(/\.json$/i, '');
    if (stem && stem.toLowerCase() !== 'manifest') {
      return stem;
    }
    return segments[segments.length - 2] ?? manifestUrl;
  } catch {
    return manifestUrl;
  }
}

/**
 * Picker entries from a `manifests` query parameter: comma-separated manifest
 * URLs, each becoming a progressive-load entry. Invalid URLs are dropped.
 */
export function getManifestsParamEntries(search: string): DatasetPickerEntry[] {
  const raw = new URLSearchParams(search).get('manifests');
  if (!raw) {
    return [];
  }
  const entries: DatasetPickerEntry[] = [];
  for (const part of raw.split(',')) {
    const candidate = part.trim();
    if (!candidate) {
      continue;
    }
    try {
      const manifestUrl = new URL(candidate).toString();
      entries.push({ name: getManifestDisplayName(manifestUrl), manifestUrl });
    } catch {
      // Skip malformed URLs; the rest of the list still renders.
    }
  }
  return entries;
}

/** Viewer link for a picker entry: same page, ?url=<manifest>&progressive=1. */
export function getDatasetViewerHref(manifestUrl: string): string {
  return `?url=${encodeURIComponent(manifestUrl)}&progressive=1`;
}

/** Locale-independent compact count (21.4M / 320k / 3136). */
export function formatDatasetCount(count: number): string {
  if (count >= 1_000_000) {
    const millions = count / 1_000_000;
    return `${millions >= 100 ? Math.round(millions) : millions.toFixed(1)}M`;
  }
  if (count >= 10_000) {
    return `${Math.round(count / 1_000)}k`;
  }
  return String(count);
}

/** One-line meta label for an entry ("3136 imgs - 5.8M pts"), or null. */
export function getDatasetEntryMetaLabel(entry: DatasetPickerEntry): string | null {
  const parts: string[] = [];
  if (entry.images !== undefined) {
    parts.push(`${formatDatasetCount(entry.images)} imgs`);
  }
  if (entry.points !== undefined) {
    parts.push(`${formatDatasetCount(entry.points)} pts`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
