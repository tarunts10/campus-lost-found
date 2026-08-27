/**
 * layouts/MainLayout.jsx — the shell every page renders inside.
 *
 * Navbar, main content, footer, plus the app-wide effects. Keeping this
 * in one place is what makes every page feel like the same product.
 */

import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import RouteProgress from '../components/RouteProgress.jsx';
import ScrollToTop from '../components/ScrollToTop.jsx';
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
    </>
  );
}
