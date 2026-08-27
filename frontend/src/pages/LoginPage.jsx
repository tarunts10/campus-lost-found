/**
 * pages/LoginPage.jsx
 */

import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function LoginPage() {
  useDocumentTitle('Login');

  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Where ProtectedRoute wanted to send them before the redirect.
  const redirectTo = location.state?.from || '/items';

  // Already logged in? Do not show the form at all.
  if (!authLoading && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(form);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      /**
       * The backend returns the same "Invalid email or password" for both
       * a wrong password and a non-existent account — deliberately, so
       * accounts cannot be enumerated. We show its message verbatim
       * rather than inventing a more specific one.
       */
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="container auth-container">
        <div className="auth-card form-card">
          <div className="auth-header">
            <h1>Welcome back</h1>
            <p className="text-muted">
              Sign in to browse reported items and manage your claims.
            </p>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="stack" noValidate>
            <div className="field">
              <label htmlFor="email">College email</label>
              <input
                id="email"
                name="email"
                type="email"
                className="input"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
                placeholder="you@college.edu"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="input"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-muted text-center mt-4" style={{ fontSize: 'var(--text-sm)' }}>
            No account yet? <Link to="/register">Create one</Link>
          </p>
        </div>

        <aside className="auth-aside" aria-hidden="true">
          <div className="auth-aside-inner">
            <h2>Lost something on campus?</h2>
            <p>
              Every report is tied to a verified college account, so items go
              back to the people who actually own them.
            </p>
            <ul className="auth-points">
              <li>Verified members only</li>
              <li>Ownership checked before handover</li>
              <li>Contact details stay private until then</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
