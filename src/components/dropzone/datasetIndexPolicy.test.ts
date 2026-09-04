import { describe, expect, it } from 'vitest';
import {
  formatDatasetCount,
  getDatasetEntryMetaLabel,
  getDatasetViewerHref,
  getManifestDisplayName,
  getManifestsParamEntries,
  parseDatasetIndex,
} from './datasetIndexPolicy';

const INDEX_URL = 'https://datasets.example.com/cam-poses/Interior/index.json';

describe('parseDatasetIndex', () => {
  it('parses a datasets-object index and resolves relative manifests against the index URL', () => {
    const entries = parseDatasetIndex({
      version: 1,
      datasets: [
        { name: 'S4', manifest: 'S4/manifest.json', images: 3136, points: 5812663 },
      ],
    }, INDEX_URL);

    expect(entries).toEqual([{
      name: 'S4',
      manifestUrl: 'https://datasets.example.com/cam-poses/Interior/S4/manifest.json',
      images: 3136,
      points: 5812663,
    }]);
  });

  it('accepts a bare array and drops malformed entries', () => {
    const entries = parseDatasetIndex([
      { name: 'ok', manifest: 'ok/manifest.json' },
      { name: 'no manifest' },
      'not an object',
      null,
    ], INDEX_URL);

    expect(entries.map((entry) => entry.name)).toEqual(['ok']);
    expect(entries[0].images).toBeUndefined();
  });

  it('returns no entries for non-index payloads', () => {
    expect(parseDatasetIndex('nope', INDEX_URL)).toEqual([]);
    expect(parseDatasetIndex({ datasets: 'nope' }, INDEX_URL)).toEqual([]);
  });
});

describe('manifests query param entries', () => {
  it('parses comma-separated manifest URLs and derives short names', () => {
    const entries = getManifestsParamEntries(
      '?manifests=https://a.example.com/models/S4/manifest.json,https://b.example.com/nave.json'
    );

    expect(entries).toEqual([
      { name: 'S4', manifestUrl: 'https://a.example.com/models/S4/manifest.json' },
      { name: 'nave', manifestUrl: 'https://b.example.com/nave.json' },
    ]);
  });

  it('skips malformed URLs and returns empty without the param', () => {
    expect(getManifestsParamEntries('?manifests=not-a-url,')).toEqual([]);
    expect(getManifestsParamEntries('?url=whatever')).toEqual([]);
  });
});

describe('picker labels and links', () => {
  it('builds a progressive viewer link', () => {
    expect(getDatasetViewerHref('https://x.example.com/m.json'))
      .toBe('?url=https%3A%2F%2Fx.example.com%2Fm.json&progressive=1');
  });

  it('formats counts without locale separators', () => {
    expect(formatDatasetCount(3136)).toBe('3136');
    expect(formatDatasetCount(20362)).toBe('20k');
    expect(formatDatasetCount(5812663)).toBe('5.8M');
  });

  it('joins images and points meta', () => {
    expect(getDatasetEntryMetaLabel({ name: 'x', manifestUrl: 'u', images: 3136, points: 5812663 }))
      .toBe('3136 imgs · 5.8M pts');
    expect(getDatasetEntryMetaLabel({ name: 'x', manifestUrl: 'u' })).toBeNull();
  });

  it('falls back through manifest.json to the parent directory name', () => {
    expect(getManifestDisplayName('https://x.example.com/models/abside/manifest.json')).toBe('abside');
    expect(getManifestDisplayName('https://x.example.com/models/nave.json')).toBe('nave');
  });
});
