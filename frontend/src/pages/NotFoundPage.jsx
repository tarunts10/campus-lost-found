/**
 * pages/NotFoundPage.jsx — catch-all for unknown client routes.
 */

import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <div className="page">
      <div className="container">
        <div className="state-block" style={{ padding: 'var(--space-9) var(--space-5)' }}>
          <div className="state-icon" aria-hidden="true">
            {'\u{1F9ED}'}
          </div>
          <h1 style={{ fontSize: 'var(--text-3xl)' }}>Page not found</h1>
          <p>
            That page does not exist. It may have moved, or the link may be
            mistyped.
          </p>
          <div className="row">
            <Link to="/" className="btn btn-primary">
              Go home
            </Link>
            <Link to="/items" className="btn btn-secondary">
              Browse items
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
