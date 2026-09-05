/**
 * pages/ReportItemPage.jsx — file a lost or found report.
 *
 * ===================  WHY THREE STEPS  ===================
 *
 * The single long form worked, but it presented eight controls at once
 * to someone who has just lost their wallet and is not in a patient
 * mood. Splitting it means each screen asks one question:
 *
 *   1. What happened?   lost or found — the field that changes the
 *                       wording of everything after it
 *   2. Details          title, description, category, location, date
 *   3. Photos & review  optional images, then a summary before sending
 *
 * The step count is fixed at three and always visible, so this is a
 * short guided form rather than an open-ended wizard. Nothing is hidden
 * behind branching logic, and the back button never loses data — the
 * form state lives in one object above the steps.
 *
 * VALIDATION runs per step, so the user is told about a problem on the
 * screen where they can fix it rather than after they reach the end.
 * The final submit re-validates everything, because a user can reach
 * step 3 and then edit step 2 backwards.
 *
 * The form sends exactly the six fields the backend accepts. It does NOT
 * send reportedBy or status:
 *   reportedBy is derived from the JWT on the server
 *   status defaults to ACTIVE in the schema
 *
 * Sending a reportedBy from here would be pointless — the backend never
 * reads it — but more importantly it would misrepresent where identity
 * comes from. The client does not get to say who it is.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as itemService from '../services/itemService.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
} from '../utils/constants.js';
import { formatDate, todayInputValue } from '../utils/format.js';
import ImageUploader from '../components/ImageUploader.jsx';

const EMPTY_FORM = {
  title: '',
  description: '',
  category: '',
  type: '',
  location: '',
  date: todayInputValue(),
  images: [],
};

const STEPS = [
  { id: 1, label: 'What happened' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Photos & review' },
];

export default function ReportItemPage() {
  useDocumentTitle('Report an item');

  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  /**
   * Client-side validation mirrors the backend's Zod schema so people
   * see problems immediately instead of after a round trip. The server
   * validates everything again — this is UX, not security.
   *
   * Scoped per step so that clicking "Continue" on step 1 does not
   * complain about a title the user has not been shown a field for yet.
   */
  const validateStep = (which) => {
    const next = {};

    if (which === 1) {
      if (!form.type) next.type = 'Choose lost or found';
    }

    if (which === 2) {
      if (form.title.trim().length < 3) next.title = 'At least 3 characters';
      if (form.description.trim().length < 10)
        next.description =
          'At least 10 characters — details are what let the owner recognise it';
      if (!form.category) next.category = 'Choose a category';
      if (!form.location.trim()) next.location = 'Where was it?';
      if (!form.date) next.date = 'Pick a date';
      else if (new Date(form.date) > new Date())
        next.date = 'The date cannot be in the future';
    }

    return next;
  };

  const goNext = () => {
    const found = validateStep(step);

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setStep((current) => Math.min(3, current + 1));
  };

  const goBack = () => {
    setErrors({});
    setStep((current) => Math.max(1, current - 1));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    /**
     * Re-validate EVERY step, not just the current one.
     *
     * A user can reach step 3, go back, clear the title, and come
     * forward again. Validating only step 3 would let that through to
     * the API, which would reject it with a message attached to a field
     * that is no longer on screen.
     */
    const all = { ...validateStep(1), ...validateStep(2) };

    if (Object.keys(all).length > 0) {
      setErrors(all);
      // Send them back to the earliest step that has a problem.
      setStep(all.type ? 1 : 2);
      return;
    }

    setSubmitting(true);

    try {
      const created = await itemService.createItem({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        type: form.type,
        location: form.location.trim(),
        date: form.date,

        /**
         * Image metadata returned by our own upload endpoint. The backend
         * re-verifies with ImageKit that this user uploaded each fileId,
         * so these values are a reference, not a trusted assertion.
         */
        images: form.images,
      });

      toast.success('Report filed. Everyone at your college can see it now.');

      // Straight to the new item, so the reporter can see the result and
      // share the link.
      navigate(`/items/${created._id}`, { replace: true });
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  const typeWord = form.type === 'FOUND' ? 'found' : 'lost';

  return (
    <div className="page">
      <div className="container container-narrow">
        <header className="page-header">
          <h1>Report an item</h1>
          <p>
            Whether you lost something or found something that is not yours,
            start here. Good detail is what makes a match possible.
          </p>
        </header>

        {/* ------------------------------------------------- STEPPER */}
        <ol className="stepper">
          {STEPS.map((entry, index) => (
            <li key={entry.id} style={{ display: 'contents' }}>
              <span
                className={`stepper-item${
                  step === entry.id ? ' is-current' : step > entry.id ? ' is-done' : ''
                }`}
                aria-current={step === entry.id ? 'step' : undefined}
              >
                <span className="stepper-dot" aria-hidden="true">
                  {step > entry.id ? '✓' : entry.id}
                </span>
                <span className="stepper-label">{entry.label}</span>
                <span className="sr-only">
                  Step {entry.id} of 3: {entry.label}
                  {step === entry.id ? ' (current)' : step > entry.id ? ' (done)' : ''}
                </span>
              </span>

              {index < STEPS.length - 1 && (
                <span
                  className={`stepper-line${step > entry.id ? ' is-done' : ''}`}
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>

        {submitError && (
          <div
            className="alert alert-error"
            role="alert"
            style={{ marginBottom: 'var(--space-5)' }}
          >
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-card" noValidate>
          {/* =========================================== STEP 1: TYPE */}
          {step === 1 && (
            <div className="step-panel">
              <fieldset className="type-choice">
                <legend className="field-legend">What are you reporting?</legend>

                <div className="type-options">
                  {[
                    {
                      value: 'LOST',
                      icon: '\u{1F614}',
                      label: 'I lost something',
                      hint: 'Someone may have already found it',
                    },
                    {
                      value: 'FOUND',
                      icon: '\u{1F64C}',
                      label: 'I found something',
                      hint: 'Help return it to its owner',
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`type-option${form.type === option.value ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={option.value}
                        checked={form.type === option.value}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <span className="type-icon" aria-hidden="true">
                        {option.icon}
                      </span>
                      <span className="type-label">{option.label}</span>
                      <span className="type-hint">{option.hint}</span>
                    </label>
                  ))}
                </div>

                {errors.type && <p className="field-error">{errors.type}</p>}
              </fieldset>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={goNext}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ======================================== STEP 2: DETAILS */}
          {step === 2 && (
            <div className="step-panel">
              <div className="field">
                <label htmlFor="title">Title</label>
                <input
                  id="title"
                  name="title"
                  className="input"
                  value={form.title}
                  onChange={handleChange}
                  maxLength={100}
                  aria-invalid={Boolean(errors.title)}
                  aria-describedby={errors.title ? 'title-error' : undefined}
                  placeholder="Black leather wallet"
                  required
                />
                {errors.title && (
                  <p id="title-error" className="field-error">
                    {errors.title}
                  </p>
                )}
              </div>

              <div className="field">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  className="textarea"
                  value={form.description}
                  onChange={handleChange}
                  maxLength={1000}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby="description-hint"
                  placeholder="Include distinguishing details — marks, contents, colour, brand."
                  required
                />
                <p id="description-hint" className="field-hint">
                  {form.description.trim().length}/1000.{' '}
                  {form.type === 'FOUND'
                    ? 'Leave out one detail only the real owner would know — that is what you will check a claim against.'
                    : 'Mention the details you could describe to prove it is yours.'}
                </p>
                {errors.description && (
                  <p className="field-error">{errors.description}</p>
                )}
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="category">Category</label>
                  <select
                    id="category"
                    name="category"
                    className="select"
                    value={form.category}
                    onChange={handleChange}
                    aria-invalid={Boolean(errors.category)}
                    required
                  >
                    <option value="">Choose a category</option>
                    {ITEM_CATEGORIES.map((value) => (
                      <option key={value} value={value}>
                        {CATEGORY_ICONS[value]} {CATEGORY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="field-error">{errors.category}</p>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="location">Location</label>
                  <input
                    id="location"
                    name="location"
                    className="input"
                    value={form.location}
                    onChange={handleChange}
                    maxLength={200}
                    aria-invalid={Boolean(errors.location)}
                    placeholder="Central Library, second floor"
                    required
                  />
                  {errors.location && (
                    <p className="field-error">{errors.location}</p>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="date">
                    {form.type === 'FOUND' ? 'Date found' : 'Date lost'}
                  </label>
                  <input
                    id="date"
                    name="date"
                    type="date"
                    className="input"
                    value={form.date}
                    onChange={handleChange}
                    max={todayInputValue()}
                    aria-invalid={Boolean(errors.date)}
                    required
                  />
                  {errors.date && <p className="field-error">{errors.date}</p>}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={goBack}>
                  Back
                </button>
                <button type="button" className="btn btn-primary" onClick={goNext}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ================================ STEP 3: PHOTOS & REVIEW */}
          {step === 3 && (
            <div className="step-panel">
              <ImageUploader
                images={form.images}
                onChange={(images) =>
                  setForm((current) => ({ ...current, images }))
                }
                disabled={submitting}
              />

              <div>
                <span className="field-legend">Review before you send</span>

                <dl className="review-list">
                  <div className="review-row">
                    <dt>Type</dt>
                    <dd>
                      <span
                        className={`badge badge-${form.type === 'FOUND' ? 'found' : 'lost'}`}
                      >
                        {form.type}
                      </span>
                    </dd>
                  </div>
                  <div className="review-row">
                    <dt>Title</dt>
                    <dd>{form.title}</dd>
                  </div>
                  <div className="review-row">
                    <dt>Description</dt>
                    <dd style={{ whiteSpace: 'pre-wrap' }}>{form.description}</dd>
                  </div>
                  <div className="review-row">
                    <dt>Category</dt>
                    <dd>
                      {CATEGORY_ICONS[form.category]}{' '}
                      {CATEGORY_LABELS[form.category] || form.category}
                    </dd>
                  </div>
                  <div className="review-row">
                    <dt>Location</dt>
                    <dd>{form.location}</dd>
                  </div>
                  <div className="review-row">
                    <dt>Date {typeWord}</dt>
                    <dd>{formatDate(form.date)}</dd>
                  </div>
                  <div className="review-row">
                    <dt>Photos</dt>
                    <dd>
                      {form.images.length === 0
                        ? 'None added'
                        : `${form.images.length} attached`}
                    </dd>
                  </div>
                </dl>
              </div>

              <p className="text-subtle">
                Your report is linked to your account automatically, and is
                visible only to members of your own college. Your contact
                details stay private until you approve a claim.
              </p>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={goBack}
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      Submitting…
                    </>
                  ) : (
                    'Submit report'
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
