import {
  useCallback,
  useId,
  useRef,
  type CSSProperties,
  type MouseEventHandler,
  type PointerEventHandler,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { modalStyles } from '../../theme';
import { CloseIcon } from '../../icons';
import { useFloatingDialogFocus } from './useFloatingDialogFocus';

/**
 * Mirror an inline `width` into `--tool-modal-width` so the compact breakpoint
 * can restyle it (index.css, `@media (max-width: 1520px)`).
 *
 * Tool windows own their width in JS — the same number clamps the drag position
 * against the viewport — and it therefore arrives as an inline declaration,
 * which no stylesheet can beat. Publishing it as a custom property lets the
 * compact tier do arithmetic on it instead of scaling the rendered pixels.
 * Windows that size to their content pass no width and set no property; the
 * compact rule's `calc()` is then invalid at computed-value time and `width`
 * falls back to `auto`, which is what those windows already had.
 */
function withCompactWidthVar(style: CSSProperties | undefined): CSSProperties | undefined {
  if (style?.width === undefined) return style;
  return {
    ...style,
    '--tool-modal-width': typeof style.width === 'number' ? `${style.width}px` : style.width,
  } as CSSProperties;
}

// Module scope on purpose: react-hooks/immutability forbids writing to a prop's
// `.current` inside the component body.
function assignForwardedRef(ref: Ref<HTMLDivElement> | undefined, node: HTMLDivElement | null): void {
  if (typeof ref === 'function') {
    ref(node);
  } else if (ref) {
    ref.current = node;
  }
}

interface FloatingWindowShellProps {
  isOpen: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  panelRef?: Ref<HTMLDivElement>;
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  panelClassName?: string;
  panelStyle?: CSSProperties;
  panelTestId?: string;
  headerClassName?: string;
  headerStyle?: CSSProperties;
  closeTitle?: string;
  onPanelPointerDown?: PointerEventHandler<HTMLDivElement>;
  onHeaderPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPanelMouseDown?: MouseEventHandler<HTMLDivElement>;
  onHeaderMouseDown?: MouseEventHandler<HTMLDivElement>;
  onPanelContextMenu?: MouseEventHandler<HTMLDivElement>;
  onHeaderContextMenu?: MouseEventHandler<HTMLDivElement>;
  renderBackdrop?: boolean;
  backdropClassName?: string;
  onBackdropClick?: () => void;
  renderCloseIcon?: ReactNode;
  portal?: boolean;
}

export function FloatingWindowShell({
  isOpen,
  title,
  onClose,
  children,
  panelRef,
  overlayClassName = 'fixed inset-0 pointer-events-none',
  overlayStyle,
  panelClassName = modalStyles.toolPanel,
  panelStyle,
  panelTestId,
  headerClassName = modalStyles.toolHeader,
  headerStyle,
  closeTitle = 'Close',
  onPanelPointerDown,
  onHeaderPointerDown,
  onPanelMouseDown,
  onHeaderMouseDown,
  onPanelContextMenu,
  onHeaderContextMenu,
  renderBackdrop = false,
  backdropClassName = modalStyles.backdrop,
  onBackdropClick,
  renderCloseIcon,
  portal = false,
}: FloatingWindowShellProps) {
  const titleId = useId();
  const internalPanelRef = useRef<HTMLDivElement | null>(null);
  // The node has to reach both refs: the internal one drives focus management,
  // the forwarded one drives caller-owned behavior (drag bounds, outside-click
  // checks). Memoized on panelRef so a re-render does not detach/re-attach
  // (null, then node) the caller-supplied ref, which a plain object ref never
  // did before.
  const setPanelRef = useCallback((node: HTMLDivElement | null) => {
    internalPanelRef.current = node;
    assignForwardedRef(panelRef, node);
  }, [panelRef]);
  useFloatingDialogFocus(isOpen, internalPanelRef);

  if (!isOpen) return null;

  const shell = (
    <div className={overlayClassName} style={overlayStyle}>
      {renderBackdrop && (
        <div
          className={backdropClassName}
          onClick={onBackdropClick}
        />
      )}
      <div
        ref={setPanelRef}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-idle-pause="true"
        data-testid={panelTestId}
        className={panelClassName}
        style={withCompactWidthVar(panelStyle)}
        onPointerDown={onPanelPointerDown}
        onMouseDown={onPanelMouseDown}
        onContextMenu={onPanelContextMenu}
      >
        <div
          className={headerClassName}
          style={headerStyle}
          onPointerDown={onHeaderPointerDown}
          onMouseDown={onHeaderMouseDown}
          onContextMenu={onHeaderContextMenu}
        >
          <span id={titleId} className={modalStyles.toolHeaderTitle}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            className={modalStyles.toolHeaderClose}
            title={closeTitle}
          >
            {renderCloseIcon ?? <CloseIcon className="w-3.5 h-3.5" />}
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return portal ? createPortal(shell, document.body) : shell;
}
