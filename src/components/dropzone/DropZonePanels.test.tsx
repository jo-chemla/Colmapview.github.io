import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopDropZonePanel, TouchDropZonePanel } from './DropZonePanels';
import {
  DROP_ZONE_BROWSE_LABEL,
  DROP_ZONE_DISMISS_TOOLTIP,
  DROP_ZONE_EXAMPLE_LINK_LABELS,
  DROP_ZONE_RESET_CONFIG_TOOLTIP,
  DROP_ZONE_UPLOAD_CONFIG_TOOLTIP,
} from './dropZonePanelViewModel';

vi.mock('./ProfileDropdown', () => ({
  ProfileDropdown: () => <div data-testid="profile-dropdown" />,
}));

// The dataset picker fetches a remote index on mount; stub it so panel tests
// stay network-free and act()-quiet.
vi.mock('./DatasetIndexPicker', () => ({
  DatasetIndexPicker: () => <div data-testid="dataset-index-picker" />,
}));

function createDesktopProps() {
  return {
    urlLoading: false,
    onOpenUrlModal: vi.fn(),
    onOpenManifestFile: vi.fn(),
    onLoadToy: vi.fn(),
    onBrowse: vi.fn(),
    onUploadConfig: vi.fn(),
    onResetConfig: vi.fn(),
    onDismiss: vi.fn(),
    onOpenExampleDataset: vi.fn(),
    onDownloadExampleManifest: vi.fn(),
  };
}

describe('DropZone panels', () => {
  it('renders desktop actions and routes button events', () => {
    const props = createDesktopProps();
    render(<DesktopDropZonePanel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: DROP_ZONE_BROWSE_LABEL }));
    fireEvent.click(screen.getByRole('button', { name: /Load URL/i }));
    fireEvent.click(screen.getByRole('button', { name: /Load manifest/i }));
    fireEvent.click(screen.getByRole('button', { name: /Try a Toy!/i }));
    fireEvent.click(screen.getByRole('button', { name: DROP_ZONE_DISMISS_TOOLTIP }));

    expect(props.onBrowse).toHaveBeenCalledTimes(1);
    expect(props.onOpenUrlModal).toHaveBeenCalledTimes(1);
    expect(props.onOpenManifestFile).toHaveBeenCalledTimes(1);
    expect(props.onLoadToy).toHaveBeenCalledTimes(1);
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('exposes the desktop config icon buttons by accessible name', () => {
    const props = createDesktopProps();
    render(<DesktopDropZonePanel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: DROP_ZONE_UPLOAD_CONFIG_TOOLTIP }));
    fireEvent.click(screen.getByRole('button', { name: DROP_ZONE_RESET_CONFIG_TOOLTIP }));

    expect(props.onUploadConfig).toHaveBeenCalledTimes(1);
    expect(props.onResetConfig).toHaveBeenCalledTimes(1);
  });

  it('routes desktop secondary context actions', () => {
    const props = createDesktopProps();
    render(<DesktopDropZonePanel {...props} />);

    fireEvent.contextMenu(screen.getByRole('button', { name: /Load URL/i }));
    fireEvent.contextMenu(screen.getByRole('button', { name: /Load manifest/i }));

    expect(props.onOpenExampleDataset).toHaveBeenCalledTimes(1);
    expect(props.onDownloadExampleManifest).toHaveBeenCalledTimes(1);
  });

  it('routes the visible example links to the same handlers as the context menus', () => {
    const props = createDesktopProps();
    render(<DesktopDropZonePanel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: DROP_ZONE_EXAMPLE_LINK_LABELS.openExampleDataset }));
    fireEvent.click(screen.getByRole('button', { name: DROP_ZONE_EXAMPLE_LINK_LABELS.downloadExampleManifest }));

    expect(props.onOpenExampleDataset).toHaveBeenCalledTimes(1);
    expect(props.onDownloadExampleManifest).toHaveBeenCalledTimes(1);
  });

  it('shows desktop hover help for URL loading', () => {
    render(<DesktopDropZonePanel {...createDesktopProps()} />);

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Load URL/i }));

    expect(screen.getByText('Load from URL')).toBeVisible();
    expect(screen.getByText(/Supports: S3, GCS, R2/)).toBeVisible();
  });

  it('renders touch actions and routes callbacks', () => {
    const onOpenUrlModal = vi.fn();
    const onLoadToy = vi.fn();
    const onDismiss = vi.fn();

    render(
      <TouchDropZonePanel
        urlLoading={false}
        onOpenUrlModal={onOpenUrlModal}
        onLoadToy={onLoadToy}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Load from URL/i }));
    fireEvent.click(screen.getByRole('button', { name: /Try a Toy!/i }));
    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));

    expect(onOpenUrlModal).toHaveBeenCalledTimes(1);
    expect(onLoadToy).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
