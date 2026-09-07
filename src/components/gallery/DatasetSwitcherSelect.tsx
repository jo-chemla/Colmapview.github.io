import { useEffect, useMemo, useState } from 'react';
import { inputStyles } from '../../theme';
import {
  fetchRemoteDatasetIndex,
  getDatasetSwitcherEntries,
  getDatasetViewerHref,
  getManifestsParamEntries,
  getMultiDatasetViewerHref,
  type DatasetPickerEntry,
} from '../dropzone/datasetIndexPolicy';
import {
  getMultiManifestUrlsFromSearch,
  MAX_MULTI_DATASETS,
} from '../../hooks/urlLoaderMultiSource';

/**
 * Compact dataset switcher for the gallery toolbar: lists the hosted datasets
 * from the remote index (same cached fetch as the start-screen picker) plus
 * any `?manifests=` extras and the currently loaded manifest. Picking another
 * dataset navigates to `?url=<manifest>&progressive=1`, carrying over the
 * `pointerlock` URL opt-out. Renders nothing when there is nothing to switch
 * to (no index and no URL-loaded dataset).
 *
 * A second "+" select adds a dataset to the current scene via the multi-load
 * `?urls=` merge (current dataset(s) plus the picked one).
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
  // Multi-dataset mode (?urls=): every currently merged manifest URL.
  const currentMultiUrls = useMemo(
    () => getMultiManifestUrlsFromSearch(window.location.search),
    []
  );
  const loadedUrls = useMemo(
    () => (currentMultiUrls.length > 0 ? currentMultiUrls : currentManifestUrl ? [currentManifestUrl] : []),
    [currentMultiUrls, currentManifestUrl]
  );
  const extraEntries = useMemo(
    () => getManifestsParamEntries(window.location.search),
    []
  );
  const entries = useMemo(
    () => getDatasetSwitcherEntries({ indexEntries, extraEntries, currentManifestUrl }),
    [indexEntries, extraEntries, currentManifestUrl]
  );
  const addableEntries = useMemo(
    () => entries.filter((entry) => !loadedUrls.includes(entry.manifestUrl)),
    [entries, loadedUrls]
  );

  // Nothing to switch between: hide entirely.
  if (entries.length === 0 || (entries.length === 1 && entries[0].manifestUrl === currentManifestUrl)) {
    return null;
  }

  const isMulti = currentMultiUrls.length > 1;
  const canAdd = loadedUrls.length > 0
    && loadedUrls.length < MAX_MULTI_DATASETS
    && addableEntries.length > 0;

  return (
    <>
      <select
        aria-label="Dataset"
        title="Switch hosted dataset (reloads the viewer)"
        value={isMulti ? '' : currentManifestUrl ?? ''}
        onChange={(e) => {
          const manifestUrl = e.target.value;
          if (manifestUrl && manifestUrl !== currentManifestUrl) {
            window.location.href = getDatasetViewerHref(manifestUrl, window.location.search);
          }
        }}
        className={`${inputStyles.select} ${inputStyles.sizes.sm} image-gallery-toolbar__select image-gallery-toolbar__dataset`}
      >
        {isMulti && (
          <option value="" disabled>
            {currentMultiUrls.length} datasets
          </option>
        )}
        {!isMulti && currentManifestUrl === null && (
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
      {canAdd && (
        <select
          aria-label="Add dataset to scene"
          title="Add a hosted dataset to the current scene (merged multi-dataset reload)"
          value=""
          onChange={(e) => {
            const manifestUrl = e.target.value;
            if (manifestUrl) {
              window.location.href = getMultiDatasetViewerHref(
                [...loadedUrls, manifestUrl],
                window.location.search
              );
            }
          }}
          className={`${inputStyles.select} ${inputStyles.sizes.sm} image-gallery-toolbar__select image-gallery-toolbar__dataset`}
        >
          <option value="" disabled>
            + Add
          </option>
          {addableEntries.map((entry) => (
            <option key={entry.manifestUrl} value={entry.manifestUrl} title={entry.manifestUrl}>
              {entry.name}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
