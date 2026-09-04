import { useEffect, useMemo, useState } from 'react';
import { inputStyles } from '../../theme';
import {
  fetchRemoteDatasetIndex,
  getDatasetSwitcherEntries,
  getDatasetViewerHref,
  getManifestsParamEntries,
  type DatasetPickerEntry,
} from '../dropzone/datasetIndexPolicy';

/**
 * Compact dataset switcher for the gallery toolbar: lists the hosted datasets
 * from the remote index (same cached fetch as the start-screen picker) plus
 * any `?manifests=` extras and the currently loaded manifest. Picking another
 * dataset navigates to `?url=<manifest>&progressive=1`, carrying over the
 * `pointerlock` URL opt-out. Renders nothing when there is nothing to switch
 * to (no index and no URL-loaded dataset).
 */
export function DatasetSwitcherSelect() {
  const [indexEntries, setIndexEntries] = useState<DatasetPickerEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchRemoteDatasetIndex()
      .then((entries) => {
        if (!cancelled) setIndexEntries(entries);
      })
      .catch(() => {
        // No remote index — the switcher stays hidden unless a URL dataset is loaded.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentManifestUrl = useMemo(
    () => new URLSearchParams(window.location.search).get('url'),
    []
  );
  const extraEntries = useMemo(
    () => getManifestsParamEntries(window.location.search),
    []
  );
  const entries = useMemo(
    () => getDatasetSwitcherEntries({ indexEntries, extraEntries, currentManifestUrl }),
    [indexEntries, extraEntries, currentManifestUrl]
  );

  // Nothing to switch between: hide entirely.
  if (entries.length === 0 || (entries.length === 1 && entries[0].manifestUrl === currentManifestUrl)) {
    return null;
  }

  return (
    <select
      aria-label="Dataset"
      title="Switch hosted dataset (reloads the viewer)"
      value={currentManifestUrl ?? ''}
      onChange={(e) => {
        const manifestUrl = e.target.value;
        if (manifestUrl && manifestUrl !== currentManifestUrl) {
          window.location.href = getDatasetViewerHref(manifestUrl, window.location.search);
        }
      }}
      className={`${inputStyles.select} ${inputStyles.sizes.sm} image-gallery-toolbar__select image-gallery-toolbar__dataset`}
    >
      {currentManifestUrl === null && (
        <option value="" disabled>
          Local dataset
        </option>
      )}
      {entries.map((entry) => (
        <option key={entry.manifestUrl} value={entry.manifestUrl} title={entry.manifestUrl}>
          {entry.name}
        </option>
      ))}
    </select>
  );
}
