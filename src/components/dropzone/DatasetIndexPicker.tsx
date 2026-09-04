import { useEffect, useMemo, useState } from 'react';
import {
  getDatasetEntryMetaLabel,
  getDatasetViewerHref,
  getManifestsParamEntries,
  parseDatasetIndex,
  REMOTE_DATASET_INDEX_URL,
  type DatasetPickerEntry,
} from './datasetIndexPolicy';

type IndexStatus = 'loading' | 'ready' | 'unavailable';

interface DatasetIndexState {
  status: IndexStatus;
  entries: DatasetPickerEntry[];
}

/**
 * Start-screen dataset selector: lists hosted COLMAP models from the remote
 * dataset index (plus any `manifests` query-param extras) as one-click
 * progressive loads. Rendered only while no dataset/url is active; a missing
 * index degrades to a small note instead of an error.
 */
export function DatasetIndexPicker() {
  const [index, setIndex] = useState<DatasetIndexState>({ status: 'loading', entries: [] });
  const extraEntries = useMemo(
    () => getManifestsParamEntries(window.location.search),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(REMOTE_DATASET_INDEX_URL);
        if (!response.ok) {
          throw new Error(`index fetch failed (${response.status})`);
        }
        const entries = parseDatasetIndex(await response.json(), REMOTE_DATASET_INDEX_URL);
        if (!cancelled) {
          setIndex({ status: entries.length > 0 ? 'ready' : 'unavailable', entries });
        }
      } catch {
        if (!cancelled) {
          setIndex({ status: 'unavailable', entries: [] });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (index.status === 'loading' && extraEntries.length === 0) {
    return (
      <div className="w-full mt-4 pt-3 border-t border-ds">
        <div className="text-ds-muted text-xs">Loading dataset index…</div>
      </div>
    );
  }

  return (
    <div className="w-full mt-4 pt-3 border-t border-ds">
      <div className="text-ds-secondary text-xs font-medium mb-2">Hosted datasets</div>
      {index.status === 'unavailable' && (
        <div className="text-ds-muted text-xs mb-2">
          No remote dataset index available.
        </div>
      )}
      {index.entries.length > 0 && <DatasetEntryList entries={index.entries} />}
      {extraEntries.length > 0 && (
        <>
          <div className="text-ds-secondary text-xs font-medium mt-3 mb-2">From URL (?manifests=)</div>
          <DatasetEntryList entries={extraEntries} />
        </>
      )}
    </div>
  );
}

function DatasetEntryList({ entries }: { entries: DatasetPickerEntry[] }) {
  return (
    <div className="flex flex-col overflow-y-auto" style={{ maxHeight: '12rem' }}>
      {entries.map((entry) => {
        const meta = getDatasetEntryMetaLabel(entry);
        return (
          <a
            key={entry.manifestUrl}
            href={getDatasetViewerHref(entry.manifestUrl)}
            className="flex items-center justify-between gap-2 px-2 py-1 rounded text-ds-primary text-xs no-underline hover-bg-ds-secondary"
            title={entry.manifestUrl}
          >
            <span className="truncate">{entry.name}</span>
            {meta && <span className="text-ds-muted whitespace-nowrap">{meta}</span>}
          </a>
        );
      })}
    </div>
  );
}
