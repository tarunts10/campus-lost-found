/**
 * pages/ReportItemPage.jsx — file a lost or found report.
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
import { useReveal } from '../hooks/useReveal.js';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
} from '../utils/constants.js';
import { todayInputValue } from '../utils/format.js';

const EMPTY_FORM = {
  title: '',
  description: '',
  category: '',
  type: '',
  location: '',
  date: todayInputValue(),
};

export default function ReportItemPage() {
  useDocumentTitle('Report an item');

  const navigate = useNavigate();
  const revealRef = useReveal();

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
   */
  const validate = () => {
    const next = {};

    if (form.title.trim().length < 3) next.title = 'At least 3 characters';
    if (form.description.trim().length < 10)
      next.description = 'At least 10 characters — details help the owner recognise it';
    if (!form.type) next.type = 'Choose lost or found';
    if (!form.category) next.category = 'Choose a category';
    if (!form.location.trim()) next.location = 'Where was it?';
    if (!form.date) next.date = 'Pick a date';
    else if (new Date(form.date) > new Date())
      next.date = 'The date cannot be in the future';

    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    const found = validate();

    if (Object.keys(found).length > 0) {
      setErrors(found);
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
      });

      // Straight to the new item, so the reporter can see the result and
      // share the link.
      navigate(`/items/${created._id}`, {
        replace: true,
        state: { notice: 'Item reported.' },
      });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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

        {submitError && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
            {submitError}
          </div>
        )}

        <form ref={revealRef} onSubmit={handleSubmit} className="form-card reveal stack" noValidate>
          {/* Type is the single most important field, so it gets a
              prominent two-card choice rather than a dropdown. */}
          <fieldset className="type-choice">
            <legend className="field-legend">What are you reporting?</legend>

            <div className="type-options">
              {[
                { value: 'LOST', icon: '\u{1F614}', label: 'I lost something', hint: 'Someone may have found it' },
                { value: 'FOUND', icon: '\u{1F64C}', label: 'I found something', hint: 'Help return it to its owner' },
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
              {form.description.trim().length}/1000. If you found the item,
              leave out one detail only the real owner would know.
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
              {errors.category && <p className="field-error">{errors.category}</p>}
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
              {errors.location && <p className="field-error">{errors.location}</p>}
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

          <div className="row">
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate(-1)}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>

          <p className="text-subtle">
            Your report is linked to your account automatically. Your contact
            details stay private until you approve a claim.
          </p>
        </form>
      </div>
    </div>
  );
}
