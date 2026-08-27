/**
 * components/Pagination.jsx
 *
 * Renders straight from the backend pagination object, so the UI can
 * never disagree with the server about how many pages exist.
 */

export default function Pagination({ pagination, onChange, disabled }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, total, hasNextPage, hasPrevPage } = pagination;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onChange(page - 1)}
        disabled={!hasPrevPage || disabled}
      >
        Previous
      </button>

      <p className="pagination-info" aria-live="polite">
        Page {page} of {totalPages}
        <span className="sr-only"> — {total} items in total</span>
      </p>

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onChange(page + 1)}
        disabled={!hasNextPage || disabled}
      >
        Next
      </button>
    </nav>
  );
}
