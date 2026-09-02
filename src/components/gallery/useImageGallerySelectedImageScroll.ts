import { useEffect } from 'react';
import type { ScrollToOptions } from '@tanstack/react-virtual';

type ImageGallerySelectedImageScrollViewMode = 'gallery' | 'list';

type ImageGallerySelectedImageScrollItem = {
  imageId: number;
};

type ImageGalleryScrollRange = {
  startIndex: number;
  endIndex: number;
};

type ImageGalleryScrollVirtualizer = {
  scrollToIndex: (index: number, options: ScrollToOptions) => void;
  /** Currently visible (pre-overscan) row range; null before first measure. */
  range: ImageGalleryScrollRange | null;
};

interface SelectedImageScrollTargetOptions {
  selectedImageId: number | null;
  images: ImageGallerySelectedImageScrollItem[];
  viewMode: ImageGallerySelectedImageScrollViewMode;
  galleryColumns: number;
}

interface SelectedImageScrollTarget {
  viewMode: ImageGallerySelectedImageScrollViewMode;
  index: number;
}

interface UseImageGallerySelectedImageScrollOptions extends SelectedImageScrollTargetOptions {
  rowVirtualizer: ImageGalleryScrollVirtualizer;
  listVirtualizer: ImageGalleryScrollVirtualizer;
}

const SELECTED_IMAGE_SCROLL_OPTIONS: ScrollToOptions = {
  align: 'center',
  behavior: 'auto',
};

// Selecting an image that is ALREADY in view (e.g. the click/double-click that
// opens the image detail modal) must not recenter the gallery: the jump
// re-virtualizes the scroll window and evicts/refetches thumbnails. Only scroll
// when the selected row is outside the visible range (selection from the 3D view).
export function isScrollIndexVisible(
  index: number,
  range: ImageGalleryScrollRange | null
): boolean {
  return range !== null && index >= range.startIndex && index <= range.endIndex;
}

export function getSelectedImageScrollTarget({
  selectedImageId,
  images,
  viewMode,
  galleryColumns,
}: SelectedImageScrollTargetOptions): SelectedImageScrollTarget | null {
  if (selectedImageId === null) return null;

  const imageIndex = images.findIndex((img) => img.imageId === selectedImageId);
  if (imageIndex === -1) return null;

  return {
    viewMode,
    index: viewMode === 'gallery' ? Math.floor(imageIndex / galleryColumns) : imageIndex,
  };
}

export function useImageGallerySelectedImageScroll({
  selectedImageId,
  images,
  viewMode,
  galleryColumns,
  rowVirtualizer,
  listVirtualizer,
}: UseImageGallerySelectedImageScrollOptions): void {
  useEffect(() => {
    const target = getSelectedImageScrollTarget({
      selectedImageId,
      images,
      viewMode,
      galleryColumns,
    });

    if (target === null) return;

    const virtualizer = target.viewMode === 'gallery' ? rowVirtualizer : listVirtualizer;
    if (isScrollIndexVisible(target.index, virtualizer.range)) return;

    virtualizer.scrollToIndex(target.index, SELECTED_IMAGE_SCROLL_OPTIONS);
  }, [selectedImageId, images, viewMode, galleryColumns, rowVirtualizer, listVirtualizer]);
}
