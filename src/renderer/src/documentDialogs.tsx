import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { RecentDocument } from "../../shared/documents";

export type DocumentUiLabels = {
  recentTitle: string;
  recentEmpty: string;
  close: string;
  saveChangesTitle: string;
  saveChangesDescription: (name: string) => string;
  save: string;
  dontSave: string;
  cancel: string;
};

type ModalProps = {
  title: string;
  ariaLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  closeLabel: string;
  closeOnBackdrop?: boolean;
};

const CloseIcon = (): React.JSX.Element => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const Modal = ({
  title,
  ariaLabel,
  onClose,
  children,
  className = "",
  closeLabel,
  closeOnBackdrop = true
}: ModalProps): React.JSX.Element | null => {
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const portalTarget = document.querySelector<HTMLElement>(
    ".app-shell .excalidraw"
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const content = contentRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const autofocusTarget = content?.querySelector<HTMLElement>(
      "[data-dialog-autofocus]"
    );
    const focusable = content?.querySelectorAll<HTMLElement>(focusableSelector);
    (autofocusTarget ?? focusable?.[0])?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !content) {
        return;
      }

      const currentFocusable = Array.from(
        content.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (currentFocusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  if (!portalTarget) {
    return null;
  }

  return createPortal(
    <div className={`desktop-modal ${className}`.trim()}>
      <button
        aria-label={closeLabel}
        className="desktop-modal__backdrop"
        onClick={closeOnBackdrop ? onClose : undefined}
        type="button"
      />
      <div
        aria-label={ariaLabel}
        aria-modal="true"
        className="desktop-modal__content"
        ref={contentRef}
        role="dialog"
      >
        <div className="desktop-modal__header">
          <h2>{title}</h2>
          <button
            aria-label={closeLabel}
            className="desktop-modal__close"
            onClick={onClose}
            title={closeLabel}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>,
    portalTarget
  );
};

const FileIcon = (): React.JSX.Element => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="M6.75 3.75h6.5l4 4v12.5H6.75z" />
    <path d="M13.25 3.75v4h4" />
  </svg>
);

export const RecentDocumentsDialog = ({
  documents,
  labels,
  busy,
  onClose,
  onOpen
}: {
  documents: RecentDocument[];
  labels: DocumentUiLabels;
  busy: boolean;
  onClose: () => void;
  onOpen: (document: RecentDocument) => void;
}): React.JSX.Element => {
  return (
    <Modal
      ariaLabel={labels.recentTitle}
      className="recent-documents-dialog"
      closeLabel={labels.close}
      onClose={onClose}
      title={labels.recentTitle}
    >
      {documents.length === 0 ? (
        <div className="recent-documents-dialog__empty">
          {labels.recentEmpty}
        </div>
      ) : (
        <div className="recent-documents-dialog__list">
          {documents.map((document) => (
            <button
              className="recent-document"
              data-dialog-autofocus={
                document === documents[0] ? "true" : undefined
              }
              disabled={busy}
              key={document.path}
              onClick={() => onOpen(document)}
              title={document.path}
              type="button"
            >
              <span className="recent-document__icon">
                <FileIcon />
              </span>
              <span className="recent-document__details">
                <span className="recent-document__name">{document.name}</span>
                <span className="recent-document__path">{document.path}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
};

export const SaveChangesDialog = ({
  documentName,
  labels,
  busy,
  onSave,
  onDontSave,
  onCancel
}: {
  documentName: string;
  labels: DocumentUiLabels;
  busy: boolean;
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
}): React.JSX.Element => {
  return (
    <Modal
      ariaLabel={labels.saveChangesTitle}
      className="save-changes-dialog"
      closeLabel={labels.close}
      closeOnBackdrop={!busy}
      onClose={busy ? () => undefined : onCancel}
      title={labels.saveChangesTitle}
    >
      <p className="save-changes-dialog__description">
        {labels.saveChangesDescription(documentName)}
      </p>
      <div className="desktop-dialog-actions">
        <button
          className="desktop-dialog-button"
          disabled={busy}
          onClick={onCancel}
          type="button"
        >
          {labels.cancel}
        </button>
        <button
          className="desktop-dialog-button"
          disabled={busy}
          onClick={onDontSave}
          type="button"
        >
          {labels.dontSave}
        </button>
        <button
          className="desktop-dialog-button desktop-dialog-button--primary"
          data-dialog-autofocus="true"
          disabled={busy}
          onClick={onSave}
          type="button"
        >
          {labels.save}
        </button>
      </div>
    </Modal>
  );
};
