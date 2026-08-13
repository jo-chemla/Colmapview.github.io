export type GalleryToggleAction = 'toggleDesktopGallery' | 'toggleTouchGalleryDrawer';
export type GalleryToggleIcon = 'collapse' | 'expand';

/**
 * Copy shared by every gallery-visibility control. The toolbar button and the
 * gallery edge handle (src/components/layout/GalleryCollapseHandle.tsx) toggle
 * the same store flag, so they read from these constants rather than each
 * spelling the wording out — two controls for one state must never disagree
 * about what the state is called.
 */
export const GALLERY_TOGGLE_TOOLTIP_OPEN = 'Hide gallery';
export const GALLERY_TOGGLE_TOOLTIP_COLLAPSED = 'Show gallery';

export interface GalleryToggleButtonInput {
  embedMode: boolean;
  touchMode: boolean;
  galleryCollapsed: boolean;
  touchGalleryDrawer: boolean;
}

export interface GalleryToggleButtonState {
  isVisible: boolean;
  isOpen: boolean;
  icon: GalleryToggleIcon;
  tooltip: string;
  action: GalleryToggleAction | null;
}

export function getGalleryToggleButtonState({
  embedMode,
  touchMode,
  galleryCollapsed,
  touchGalleryDrawer,
}: GalleryToggleButtonInput): GalleryToggleButtonState {
  if (embedMode) {
    return {
      isVisible: false,
      isOpen: false,
      icon: 'expand',
      tooltip: GALLERY_TOGGLE_TOOLTIP_COLLAPSED,
      action: null,
    };
  }

  const isOpen = touchMode ? touchGalleryDrawer : !galleryCollapsed;

  return {
    isVisible: true,
    isOpen,
    icon: isOpen ? 'collapse' : 'expand',
    tooltip: isOpen ? GALLERY_TOGGLE_TOOLTIP_OPEN : GALLERY_TOGGLE_TOOLTIP_COLLAPSED,
    action: touchMode ? 'toggleTouchGalleryDrawer' : 'toggleDesktopGallery',
  };
}
