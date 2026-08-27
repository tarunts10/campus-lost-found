/**
 * components/StateBlock.jsx — the empty and error states.
 *
 * Requirement 15: never leave a blank screen. Every API-driven view has
 * four possible outcomes (loading, success, empty, error) and a user
 * should always be told which one they are looking at, plus what they
 * can do about it.
 */

export function EmptyState({ icon = '\u{1F50D}', title, message, action }) {
  return (
    <div className="state-block">
      <div className="state-icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state-block" role="alert">
      <div className="state-icon" aria-hidden="true">
        {'\u26A0\uFE0F'}
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
