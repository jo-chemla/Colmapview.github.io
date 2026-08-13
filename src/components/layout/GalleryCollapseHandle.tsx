import { memo, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../../icons';
import { getTooltipProps } from '../../theme';
import { getGalleryCollapseHandleState } from './appLayoutPolicy';
import { useAppLayoutStoreFacade } from './useAppLayoutStoreFacade';

export interface GalleryCollapseHandleProps {
  /** AppLayout's resize-drag starter, attached only while the gallery has width. */
  onResizeMouseDown: (event: MouseEvent) => void;
}

/**
 * The viewer↔gallery divider plus the collapse handle it carries.
 *
 * Owns the whole `.resize-handle` element so the divider and the handle can
 * never disagree about when they exist: the divider now renders in the
 * collapsed state too, which is the only way an edge affordance can bring a
 * collapsed gallery back (the gallery panel itself is `overflow-hidden` at
 * `width: 0`, so nothing mounted inside it survives).
 *
 * The chevron stops its own mousedown: `useResizablePanel` enters resize mode on
 * the first mousedown with no drag threshold, so a bubbling press would flash
 * the col-resize cursor and could snap the panel width in the same gesture that
 * toggles it.
 */
export const GalleryCollapseHandle = memo(function GalleryCollapseHandle({
  onResizeMouseDown,
}: GalleryCollapseHandleProps) {
  const {
    data: {
      galleryCollapsed,
      embedMode,
      touchMode,
    },
    actions: {
      toggleGalleryCollapsed,
    },
  } = useAppLayoutStoreFacade();

  const handleState = getGalleryCollapseHandleState({ embedMode, touchMode, galleryCollapsed });

  const stopResizeStart = useCallback((event: MouseEvent) => {
    event.stopPropagation();
  }, []);

  if (!handleState.isVisible) return null;

  return (
    <div
      className="resize-handle"
      data-collapsed={handleState.isCollapsed ? 'true' : undefined}
      onMouseDown={handleState.canResize ? onResizeMouseDown : undefined}
    >
      <button
        type="button"
        className="gallery-collapse-handle"
        aria-label={handleState.tooltip}
        onMouseDown={stopResizeStart}
        onClick={toggleGalleryCollapsed}
        {...getTooltipProps(handleState.tooltip, 'left')}
      >
        {handleState.icon === 'collapse'
          ? <ChevronRightIcon className="w-3 h-3" />
          : <ChevronLeftIcon className="w-3 h-3" />}
      </button>
    </div>
  );
});
