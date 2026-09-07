import { useEffect, useMemo, useState } from 'react';
import {
  fetchRemoteDatasetIndex,
  getDatasetEntryMetaLabel,
  getDatasetViewerHref,
  getManifestsParamEntries,
  getMultiDatasetViewerHref,
  type DatasetPickerEntry,
} from './datasetIndexPolicy';
import { MAX_MULTI_DATASETS } from '../../hooks/urlLoaderMultiSource';

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
 *
 * Rows also carry checkboxes for multi-select: picking two or more offers a
 * combined load via `?urls=` (file-level merge into one scene — designed for
 * the subsampled preview slots).
 */
export function DatasetIndexPicker() {
  const [index, setIndex] = useState<DatasetIndexState>({ status: 'loading', entries: [] });
  const [selected, setSelected] = useState<string[]>([]);
  const extraEntries = useMemo(
    () => getManifestsParamEntries(window.location.search),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await fetchRemoteDatasetIndex();
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

  const toggleSelected = (manifestUrl: string) => {
    setSelected((current) =>
      current.includes(manifestUrl)
        ? current.filter((url) => url !== manifestUrl)
        : [...current, manifestUrl]
    );
  };

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
      {index.entries.length > 0 && (
        <DatasetEntryList entries={index.entries} selected={selected} onToggle={toggleSelected} />
      )}
      {extraEntries.length > 0 && (
        <>
          <div className="text-ds-secondary text-xs font-medium mt-3 mb-2">From URL (?manifests=)</div>
          <DatasetEntryList entries={extraEntries} selected={selected} onToggle={toggleSelected} />
        </>
      )}
      {selected.length >= 2 && (
        <button
          type="button"
          disabled={selected.length > MAX_MULTI_DATASETS}
          title={
            selected.length > MAX_MULTI_DATASETS
              ? `At most ${MAX_MULTI_DATASETS} datasets can be merged into one scene`
              : 'Merge the selected datasets into one scene (subsampled previews)'
          }
          onClick={() => {
            window.location.href = getMultiDatasetViewerHref(selected, window.location.search);
          }}
          className="mt-2 w-full px-2 py-1 rounded border border-ds text-ds-primary text-xs hover-bg-ds-secondary disabled:opacity-50"
        >
          Load {selected.length} selected together
          {selected.length > MAX_MULTI_DATASETS ? ` (max ${MAX_MULTI_DATASETS})` : ''}
        </button>
      )}
    </div>
  );
}

function DatasetEntryList({
  entries,
  selected,
  onToggle,
}: {
  entries: DatasetPickerEntry[];
  selected: string[];
  onToggle: (manifestUrl: string) => void;
}) {
  return (
    <div className="flex flex-col overflow-y-auto" style={{ maxHeight: '12rem' }}>
      {entries.map((entry) => {
        const meta = getDatasetEntryMetaLabel(entry);
        return (
          <div key={entry.manifestUrl} className="flex items-center gap-1">
            <input
              type="checkbox"
              aria-label={`Select ${entry.name} for combined load`}
              checked={selected.includes(entry.manifestUrl)}
              onChange={() => onToggle(entry.manifestUrl)}
              className="shrink-0"
            />
            <a
              href={getDatasetViewerHref(entry.manifestUrl)}
              className="flex flex-1 items-center justify-between gap-2 px-2 py-1 rounded text-ds-primary text-xs no-underline hover-bg-ds-secondary"
              title={entry.manifestUrl}
            >
              <span className="truncate">{entry.name}</span>
              {meta && <span className="text-ds-muted whitespace-nowrap">{meta}</span>}
            </a>
          </div>
        );
      })}
    </div>
  );
}
