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
  const [fieldErrors, setFieldErrors] = useState({});
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

    // Clear a field's error as soon as the user starts correcting it.
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  /**
   * Client-side checks before anything is sent.
   *
   * The form carries `noValidate`, which switches OFF the browser's own
   * required/type checking so we can show our own consistently styled
   * messages. Without a replacement, submitting the form empty sent
   * {"email":"","password":""} to the API and surfaced the backend's raw
   * validation string ("email: Must be a valid email address. password:
   * Password is required") as if something had gone wrong.
   *
   * This is UX only. The backend validates every field again and remains
   * the authority — nothing here weakens that.
   */
  const validate = () => {
    const errors = {};

    if (!form.email.trim()) {
      errors.email = 'Enter your college email';
    } else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      errors.email = 'Enter a valid email address';
    }

    if (!form.password) {
      errors.password = 'Enter your password';
    }

    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const errors = validate();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return; // no request is made
    }

    setSubmitting(true);

    try {
      /**
       * Send the trimmed email and the password exactly as typed.
       *
       * Trimming the email matches what the backend does during
       * validation, so a stray copy-paste space cannot cause a
       * confusing "invalid email" rejection. The password is NEVER
       * trimmed — leading or trailing spaces are legitimate characters
       * in a password.
       */
      await login({ email: form.email.trim(), password: form.password });
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
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                placeholder="you@college.edu"
              />
              {fieldErrors.email && (
                <p id="login-email-error" className="field-error">
                  {fieldErrors.email}
                </p>
              )}
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
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                placeholder="Your password"
              />
              {fieldErrors.password && (
                <p id="login-password-error" className="field-error">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
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
