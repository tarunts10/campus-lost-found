/**
 * components/Navbar.jsx — primary navigation.
 *
 * Renders different links depending on authentication state, and shows
 * the current user's name when logged in.
 *
 * The links shown are a CONVENIENCE, not a security control. Hiding
 * "Report Item" does not stop anyone POSTing to /api/items — only the
 * backend's JWT check does that. The navbar exists so people are not
 * offered actions that will fail.
 */

import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close the mobile menu whenever the route changes, otherwise it stays
  // open covering the page the user just navigated to.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Add a border and stronger background once scrolled, so the bar
  // separates from content instead of floating over it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const links = isAuthenticated
    ? [
        { to: '/', label: 'Home' },
        { to: '/items', label: 'Browse' },
        { to: '/report', label: 'Report Item' },
        { to: '/my-items', label: 'My Items' },
        { to: '/my-claims', label: 'My Claims' },
      ]
    : [
        { to: '/', label: 'Home' },
        { to: '/items', label: 'Browse' },
      ];

  return (
    <header className={`navbar${scrolled ? ' is-scrolled' : ''}`}>
      <div className="container navbar-inner">
        <Link to="/" className="brand" aria-label="Campus Lost and Found, home">
          <span className="brand-mark" aria-hidden="true">
            CL
          </span>
          <span className="brand-text">
            Campus <strong>Lost &amp; Found</strong>
          </span>
        </Link>

        <button
          type="button"
          className="nav-toggle btn btn-ghost"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">
            {menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          </span>
          <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
        </button>

        <nav
          id="primary-navigation"
          className={`nav-links${menuOpen ? ' is-open' : ''}`}
          aria-label="Primary"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `nav-link${isActive ? ' is-active' : ''}`
              }
            >
              {link.label}
            </NavLink>
          ))}

          <span className="nav-divider" aria-hidden="true" />

          {isAuthenticated ? (
            <div className="nav-user">
              <span className="nav-username" title={user?.email}>
                <span className="nav-avatar" aria-hidden="true">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
                <span className="nav-user-text">
                  {user?.name}
                  {/* Institution shown so it is always obvious whose data you are looking at. */}
                  {user?.institution?.name && (
                    <small className="nav-institution">{user.institution.name}</small>
                  )}
                </span>
                {user?.role === 'ADMIN' && (
                  <span className="badge badge-active">Admin</span>
                )}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="nav-user">
              <Link to="/login" className="btn btn-ghost btn-sm">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
