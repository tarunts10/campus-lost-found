/**
 * layouts/MainLayout.jsx — the shell every page renders inside.
 *
 * Navbar, main content, footer, plus the app-wide effects. Keeping this
 * in one place is what makes every page feel like the same product.
 *
 * <Toaster> lives HERE rather than inside any page, so a toast raised by
 * an action that then navigates ("item reported" → the new item's page)
 * still gets shown. A toast mounted inside the page that raised it would
 * unmount before it could be read.
 */

import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import RouteProgress from '../components/RouteProgress.jsx';
import ScrollToTop from '../components/ScrollToTop.jsx';
import Toaster from '../components/Toaster.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function MainLayout() {
  const { sessionExpired, dismissSessionExpired } = useAuth();

  return (
    <>
      {/* First tab stop: lets keyboard users jump past the navigation. */}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <ScrollToTop />
      <RouteProgress />
      <Navbar />

      {/*
        Session expiry banner. The Axios interceptor detects a 401 and
        clears the token; this is how the user finds out WHY the app
        suddenly logged them out, rather than being silently signed out.

        Deliberately NOT a toast: a toast disappears, and this carries an
        instruction the user has to act on.
      */}
      {sessionExpired && (
        <div className="container" style={{ paddingTop: 'var(--space-4)' }}>
          <div className="alert alert-error" role="alert">
            <span>
              Your session has expired or is no longer valid. Please log in
              again.
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={dismissSessionExpired}
              style={{ marginLeft: 'auto' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main id="main-content">
        <Outlet />
      </main>

      <Footer />

      <Toaster />
    </>
  );
}
