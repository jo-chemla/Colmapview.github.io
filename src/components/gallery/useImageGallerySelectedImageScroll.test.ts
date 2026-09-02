import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  getSelectedImageScrollTarget,
  isScrollIndexVisible,
  useImageGallerySelectedImageScroll,
} from './useImageGallerySelectedImageScroll';

const images = [
  { imageId: 10 },
  { imageId: 20 },
  { imageId: 30 },
  { imageId: 40 },
  { imageId: 50 },
];

function createVirtualizer(range: { startIndex: number; endIndex: number } | null = null) {
  return {
    scrollToIndex: vi.fn(),
    range,
  };
}

describe('getSelectedImageScrollTarget', () => {
  it('returns the gallery row for a selected image', () => {
    expect(getSelectedImageScrollTarget({
      selectedImageId: 40,
      images,
      viewMode: 'gallery',
      galleryColumns: 3,
    })).toEqual({
      viewMode: 'gallery',
      index: 1,
    });
  });

  it('returns the list index for a selected image', () => {
    expect(getSelectedImageScrollTarget({
      selectedImageId: 40,
      images,
      viewMode: 'list',
      galleryColumns: 3,
    })).toEqual({
      viewMode: 'list',
      index: 3,
    });
  });

  it('returns null when no selected image can be found', () => {
    expect(getSelectedImageScrollTarget({
      selectedImageId: null,
      images,
      viewMode: 'gallery',
      galleryColumns: 3,
    })).toBeNull();

    expect(getSelectedImageScrollTarget({
      selectedImageId: 99,
      images,
      viewMode: 'list',
      galleryColumns: 3,
    })).toBeNull();
  });
});

describe('useImageGallerySelectedImageScroll', () => {
  it('scrolls the gallery virtualizer to the selected image row', () => {
    const rowVirtualizer = createVirtualizer();
    const listVirtualizer = createVirtualizer();

    renderHook(() => useImageGallerySelectedImageScroll({
      selectedImageId: 50,
      images,
      viewMode: 'gallery',
      galleryColumns: 2,
      rowVirtualizer,
      listVirtualizer,
    }));

    expect(rowVirtualizer.scrollToIndex).toHaveBeenCalledWith(2, {
      align: 'center',
      behavior: 'auto',
    });
    expect(listVirtualizer.scrollToIndex).not.toHaveBeenCalled();
  });

  it('scrolls the list virtualizer to the selected image index', () => {
    const rowVirtualizer = createVirtualizer();
    const listVirtualizer = createVirtualizer();

    renderHook(() => useImageGallerySelectedImageScroll({
      selectedImageId: 30,
      images,
      viewMode: 'list',
      galleryColumns: 2,
      rowVirtualizer,
      listVirtualizer,
    }));

    expect(listVirtualizer.scrollToIndex).toHaveBeenCalledWith(2, {
      align: 'center',
      behavior: 'auto',
    });
    expect(rowVirtualizer.scrollToIndex).not.toHaveBeenCalled();
  });

  it('does not recenter when the selected row is already visible', () => {
    const rowVirtualizer = createVirtualizer({ startIndex: 1, endIndex: 3 });
    const listVirtualizer = createVirtualizer();

    renderHook(() => useImageGallerySelectedImageScroll({
      selectedImageId: 50,
      images,
      viewMode: 'gallery',
      galleryColumns: 2,
      rowVirtualizer,
      listVirtualizer,
    }));

    expect(rowVirtualizer.scrollToIndex).not.toHaveBeenCalled();
  });

  it('reports index visibility against the virtualizer range', () => {
    expect(isScrollIndexVisible(2, { startIndex: 1, endIndex: 3 })).toBe(true);
    expect(isScrollIndexVisible(4, { startIndex: 1, endIndex: 3 })).toBe(false);
    expect(isScrollIndexVisible(0, null)).toBe(false);
  });

  it('does not scroll when the selected image is missing', () => {
    const rowVirtualizer = createVirtualizer();
    const listVirtualizer = createVirtualizer();

    renderHook(() => useImageGallerySelectedImageScroll({
      selectedImageId: 99,
      images,
      viewMode: 'gallery',
      galleryColumns: 2,
      rowVirtualizer,
      listVirtualizer,
    }));

    expect(rowVirtualizer.scrollToIndex).not.toHaveBeenCalled();
    expect(listVirtualizer.scrollToIndex).not.toHaveBeenCalled();
  });
});
