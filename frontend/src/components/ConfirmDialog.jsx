/**
 * components/ConfirmDialog.jsx — confirmation for destructive actions.
 *
 * REPLACES window.confirm(), and the reasons are not cosmetic:
 *
 *   - window.confirm BLOCKS the JavaScript thread. Nothing renders,
 *     no timer fires, and on mobile it can be suppressed entirely by
 *     the browser — so a "destructive action guard" that silently
 *     stops existing is a real correctness problem, not a style one
 *   - it cannot be themed, so it lands as an OS-grey box in the middle
 *     of a dark-mode page
 *   - it cannot explain consequences with any structure
 *
 * ACCESSIBILITY, which is the whole difficulty with custom modals:
 *
 *   - role="dialog" + aria-modal, labelled by its own heading
 *   - focus moves INTO the dialog on open, and returns to the element
 *     that opened it on close (otherwise keyboard focus is dumped at
 *     the top of the document)
 *   - Tab is trapped inside while open
 *   - Escape cancels
 *   - the backdrop cancels on click, but only on the backdrop itself,
 *     so a drag that ends outside the panel does not destroy anything
 *
 * The confirm button is autofocused only for non-destructive dialogs.
 * For a delete, focus lands on Cancel — the safe option should be the
 * one a reflexive Enter press hits.
 */

import { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const panelRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  /** The element focused before the dialog opened, so it can be restored. */
  const returnFocusRef = useRef(null);

  const handleCancel = useCallback(() => {
    if (busy) return; // never cancel mid-request
    onCancel?.();
  }, [busy, onCancel]);

  /* --- Open: remember focus, then move it inside ---------------------- */
  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement;

    // Safe default first. A reflexive Enter on a delete dialog should
    // cancel, not delete.
    const target = destructive ? cancelRef.current : confirmRef.current;
    target?.focus();

    return () => {
      // Restore focus to the trigger. Without this the keyboard user is
      // returned to the top of the document and has to tab back.
      const previous = returnFocusRef.current;
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [open, destructive]);

  /* --- Escape to cancel, Tab trapped inside --------------------------- */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = [...panel.querySelectorAll(FOCUSABLE)];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Wrap in both directions, so Tab can never escape the dialog and
      // land on the page behind it.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, handleCancel]);

  /* --- Lock body scroll while open ------------------------------------ */
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      /* Only a click that both started and ended on the backdrop
         cancels. Comparing target to currentTarget is what excludes a
         drag that began inside the panel. */
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleCancel();
      }}
    >
      <div
        ref={panelRef}
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={message ? 'dialog-message' : undefined}
      >
        <h2 id="dialog-title" className="dialog-title">
          {title}
        </h2>

        {message && (
          <p id="dialog-message" className="dialog-message">
            {message}
          </p>
        )}

        <div className="dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-ghost"
            onClick={handleCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmRef}
            type="button"
            className={`btn ${destructive ? 'btn-danger-solid' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
