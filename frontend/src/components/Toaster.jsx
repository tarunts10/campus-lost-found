/**
 * components/Toaster.jsx — renders the toast stack.
 *
 * Mounted once in MainLayout so toasts survive route changes: an action
 * that navigates on success ("item reported", then straight to the item
 * page) still gets its confirmation, because the toast lives above the
 * router outlet rather than inside the page that triggered it.
 *
 * The live region is ALWAYS in the DOM, even when empty. Screen readers
 * frequently miss content inserted into a region that appeared in the
 * same tick; having the container present from the start is what makes
 * the announcement reliable.
 */

import { useToast } from '../context/ToastContext.jsx';

const ICONS = {
  success: '✓',
  error: '⚠',
  info: 'ℹ',
};

export default function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="toaster" role="region" aria-label="Notifications">
      <div className="sr-only" role="status" aria-live="polite">
        {toasts.map((toast) => toast.message).join('. ')}
      </div>

      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.variant}`}
          /* The visible copy is aria-hidden because the live region
             above already announces it. Without this, a screen reader
             reads every toast twice. */
          aria-hidden="true"
        >
          <span className="toast-icon">{ICONS[toast.variant] || ICONS.info}</span>
          <span className="toast-message">{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismiss(toast.id)}
            tabIndex={-1}
          >
            {'✕'}
          </button>
        </div>
      ))}
    </div>
  );
}
