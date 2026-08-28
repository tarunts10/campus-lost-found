/**
 * pages/RegisterPage.jsx
 *
 * Client-side validation here mirrors the backend's Zod rules so people
 * get instant feedback. It is NOT a substitute for the server checks —
 * anyone can bypass this form entirely with curl. The backend validates
 * every field again regardless.
 */

import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import * as institutionService from '../services/institutionService.js';

const validate = (form, institutions) => {
  const errors = {};

  if (!form.institutionId) {
    errors.institutionId = 'Select your institution';
  }

  if (form.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address';
  }

  if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }

  if (form.confirm !== form.password) {
    errors.confirm = 'Passwords do not match';
  }

  /**
   * Mirror the backend's email-domain rule so the user finds out before
   * submitting rather than after. The backend checks this again and is
   * the actual authority — this is purely faster feedback.
   */
  const chosen = institutions.find((i) => i._id === form.institutionId);

  if (chosen && !errors.email) {
    const domain = form.email.trim().toLowerCase().split('@').pop();
    if (domain !== chosen.emailDomain) {
      errors.email = `${chosen.name} requires an @${chosen.emailDomain} email address`;
    }
  }

  return errors;
};

export default function RegisterPage() {
  useDocumentTitle('Create account');

  const { register, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [institutions, setInstitutions] = useState([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [institutionsError, setInstitutionsError] = useState('');

  const [form, setForm] = useState({
    institutionId: '',
    name: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * Load the institution list for the dropdown.
   *
   * Public endpoint: a visitor has no token yet but must choose their
   * college before an account can be created.
   */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await institutionService.listInstitutions();
        if (!cancelled) setInstitutions(data);
      } catch (err) {
        if (!cancelled) setInstitutionsError(err.message);
      } finally {
        if (!cancelled) setInstitutionsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!authLoading && isAuthenticated) {
    return <Navigate to="/items" replace />;
  }

  // The institution the user has picked, if any — drives the email hint.
  const selectedInstitution = institutions.find(
    (institution) => institution._id === form.institutionId
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));

    // Clear a field error as soon as the user starts fixing it.
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const errors = validate(form, institutions);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      /**
       * register() in AuthContext creates the account and then logs in
       * with the same credentials, because the backend's register
       * endpoint returns the user but no token.
       *
       * Note what is NOT sent: `role`. The backend defaults everyone to
       * STUDENT and ignores any role in the body, so offering the field
       * would be dishonest.
       */
      await register({
        /**
         * institutionId is sent, but it is a REQUEST, not a decision. The
         * backend verifies the institution exists, is active, and that
         * the email matches its domain before accepting it.
         */
        institutionId: form.institutionId,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      navigate('/items', { replace: true });
    } catch (err) {
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
            <h1>Create your account</h1>
            <p className="text-muted">
              Join the campus Lost &amp; Found with your college email.
            </p>
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          {institutionsError && (
            <div className="alert alert-error" role="alert">
              Could not load the institution list: {institutionsError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="stack" noValidate>
            {/*
              Institution comes FIRST: it determines which email domain is
              acceptable, so choosing it before typing an email means the
              hint below the email field is already correct.
            */}
            <div className="field">
              <label htmlFor="institutionId">Your institution</label>
              <select
                id="institutionId"
                name="institutionId"
                className="select"
                value={form.institutionId}
                onChange={handleChange}
                disabled={institutionsLoading || institutions.length === 0}
                aria-invalid={Boolean(fieldErrors.institutionId)}
                aria-describedby="institution-hint"
                required
              >
                <option value="">
                  {institutionsLoading
                    ? 'Loading institutions…'
                    : institutions.length === 0
                      ? 'No institutions available'
                      : 'Select your college'}
                </option>
                {institutions.map((institution) => (
                  <option key={institution._id} value={institution._id}>
                    {institution.name}
                  </option>
                ))}
              </select>

              <p id="institution-hint" className="field-hint">
                {selectedInstitution
                  ? `Requires an @${selectedInstitution.emailDomain} email address.`
                  : 'You will only see items reported at your own institution.'}
              </p>

              {fieldErrors.institutionId && (
                <p className="field-error">{fieldErrors.institutionId}</p>
              )}

              {!institutionsLoading && institutions.length === 0 && (
                <p className="field-hint">
                  An administrator needs to add an institution before anyone
                  can register.
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                name="name"
                type="text"
                className="input"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                required
                placeholder="Tarun Tejaswi"
              />
              {fieldErrors.name && (
                <p id="name-error" className="field-error">
                  {fieldErrors.name}
                </p>
              )}
            </div>

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
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                required
                placeholder={selectedInstitution ? `you@${selectedInstitution.emailDomain}` : "you@college.edu"}
              />
              {fieldErrors.email && (
                <p id="email-error" className="field-error">
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
                autoComplete="new-password"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby="password-hint"
                required
              />
              <p id="password-hint" className="field-hint">
                At least 8 characters.
              </p>
              {fieldErrors.password && (
                <p className="field-error">{fieldErrors.password}</p>
              )}
            </div>

            <div className="field">
              <label htmlFor="confirm">Confirm password</label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                className="input"
                value={form.confirm}
                onChange={handleChange}
                autoComplete="new-password"
                aria-invalid={Boolean(fieldErrors.confirm)}
                aria-describedby={fieldErrors.confirm ? 'confirm-error' : undefined}
                required
              />
              {fieldErrors.confirm && (
                <p id="confirm-error" className="field-error">
                  {fieldErrors.confirm}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={submitting}
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-muted text-center mt-4" style={{ fontSize: 'var(--text-sm)' }}>
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </div>

        <aside className="auth-aside" aria-hidden="true">
          <div className="auth-aside-inner">
            <h2>Found something?</h2>
            <p>
              Report it in under a minute. The owner searches, recognises it,
              and proves it is theirs before you hand anything over.
            </p>
            <ul className="auth-points">
              <li>Report lost or found items</li>
              <li>Search by category and location</li>
              <li>Approve the claim you believe</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
