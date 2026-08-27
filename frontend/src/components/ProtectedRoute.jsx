/**
 * components/ProtectedRoute.jsx — gate for authenticated pages.
 *
 * Wraps a route element. Three cases:
 *   still checking  -> full page loader (NOT a redirect; see below)
 *   authenticated   -> render the page
 *   not logged in   -> redirect to /login
 *
 * THE ORDER MATTERS. Without the loading check first, a page refresh
 * would briefly see isAuthenticated === false while GET /api/auth/me is
 * still in flight, and bounce a perfectly valid session to the login
 * screen. Waiting for `loading` to settle fixes that.
 *
 * This is CONVENIENCE, not security. It stops a user landing on a page
 * that would only show errors. The actual protection is the backend
 * rejecting requests without a valid JWT — which it does regardless of
 * what this component decides.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { FullPageLoader } from './Loader.jsx';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoader label="Checking your session" />;
  }

  if (!isAuthenticated) {
    /**
     * `state` carries where the user was heading so the login page can
     * send them back there afterwards, instead of dumping everyone on
     * the home page. `replace` keeps the blocked URL out of history, so
     * the back button does not bounce between login and the same wall.
     */
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
