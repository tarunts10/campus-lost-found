/**
 * pages/ItemDetailPage.jsx
 *
 * Shows one item and, depending on who is looking, one of three things:
 *
 *   the reporter (or an admin)  edit / delete controls, plus the list of
 *                               claims filed on it with approve/reject
 *   another member              a form to file a claim
 *   someone who already claimed the current status of their claim
 *
 * THE UI DECIDES WHAT TO SHOW; THE BACKEND DECIDES WHAT IS ALLOWED.
 * Hiding a button prevents confusion, not abuse — the server rejects an
 * unauthorised PATCH or DELETE with 403 regardless of what is rendered.
 * Every one of those failures is surfaced here rather than swallowed.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import * as itemService from '../services/itemService.js';
import * as claimService from '../services/claimService.js';
import Badge from '../components/Badge.jsx';
import { SectionLoader } from '../components/Loader.jsx';
import { EmptyState, ErrorState } from '../components/StateBlock.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import ImageUploader from '../components/ImageUploader.jsx';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  ITEM_TYPES,
} from '../utils/constants.js';
import {
  formatDate,
  formatRelative,
  sameId,
  titleCase,
  toDateInputValue,
  todayInputValue,
} from '../utils/format.js';

export default function ItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [item, setItem] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const [claimMessage, setClaimMessage] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deciding, setDeciding] = useState(null);

  useDocumentTitle(item?.title);

  /**
   * reportedBy arrives POPULATED as { _id, name, role } from GET
   * /api/items/:id, but as a bare id string from other responses.
   * sameId() handles both shapes.
   *
   * Admins can manage any item — the same rule the backend enforces.
   */
  const isOwner = item && user && sameId(item.reportedBy, user._id);
  const isAdmin = user?.role === 'ADMIN';
  const canManage = Boolean(isOwner || isAdmin);

  const myClaim = claims.find((claim) => sameId(claim.claimant, user?._id));

  // Claiming is possible only on someone else's ACTIVE item, once.
  const canClaim =
    item && user && !isOwner && item.status === 'ACTIVE' && !myClaim;

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await itemService.getItem(id);
      setItem(data);
      setEditForm({
        title: data.title,
        description: data.description,
        category: data.category,
        type: data.type,
        location: data.location,
        date: toDateInputValue(data.date),
        images: data.images || [],
      });
    } catch (err) {
      setError(err.message);
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  /**
   * Load claims for this item.
   *
   * The backend filters by visibility: you only receive claims you filed
   * or claims on items you reported. So this same call returns the full
   * list to an owner and just their own claim to a claimant — the
   * frontend does not need to (and cannot) work that out itself.
   */
  const loadClaims = useCallback(async () => {
    setClaimsLoading(true);

    try {
      const { claims: data } = await claimService.listClaims({
        item: id,
        limit: 50,
      });
      setClaims(data);
    } catch {
      // Non-fatal: the item itself still renders.
      setClaims([]);
    } finally {
      setClaimsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadItem();
    loadClaims();
  }, [loadItem, loadClaims]);

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setActionError('');

    try {
      /**
       * Only the six editable fields are sent. Not reportedBy, not
       * status — the backend strips them anyway, but sending them would
       * misrepresent what this form does.
       */
      const updated = await itemService.updateItem(id, editForm);
      setItem(updated);
      setEditing(false);
      setNotice('Item updated.');
    } catch (err) {
      // Includes 403 if the backend disagrees that this user may edit.
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${item.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(true);
    setActionError('');

    try {
      await itemService.deleteItem(id);
      navigate('/my-items', {
        replace: true,
        state: { notice: 'Item deleted.' },
      });
    } catch (err) {
      setActionError(err.message);
      setDeleting(false);
    }
  };

  const handleClaimSubmit = async (event) => {
    event.preventDefault();
    setClaimSubmitting(true);
    setActionError('');

    try {
      await claimService.createClaim(id, claimMessage.trim());
      setClaimMessage('');
      setNotice('Claim submitted. The person who reported this item will review it.');
      await loadClaims();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleDecision = async (claimId, status) => {
    setDeciding(claimId);
    setActionError('');

    try {
      const result = await claimService.decideClaim(claimId, status);

      if (status === 'APPROVED') {
        setNotice(
          `Claim approved. This item is now ${result.itemStatus}` +
            (result.otherClaimsRejected > 0
              ? `, and ${result.otherClaimsRejected} other pending claim${
                  result.otherClaimsRejected === 1 ? ' was' : 's were'
                } rejected.`
              : '.')
        );
      } else {
        setNotice('Claim rejected.');
      }

      // Reload both: approving changes the ITEM status too.
      await Promise.all([loadItem(), loadClaims()]);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDeciding(null);
    }
  };

  if (loading) return <SectionLoader label="Loading item" />;

  if (error) {
    return (
      <div className="page">
        <div className="container">
          <ErrorState
            title={
              error.toLowerCase().includes('not found')
                ? 'Item not found'
                : 'Unable to load this item'
            }
            message={error}
            onRetry={loadItem}
          />
          <div className="text-center mt-6">
            <Link to="/items" className="btn btn-secondary">
              Back to browse
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="page">
      <div className="container">
        <Link to="/items" className="back-link">
          ← Back to browse
        </Link>

        {notice && (
          <div className="alert alert-success mt-4" role="status">
            {notice}
          </div>
        )}

        {actionError && (
          <div className="alert alert-error mt-4" role="alert">
            {actionError}
          </div>
        )}

        <div className="detail-grid mt-6">
          {/* -------------------------------------------- MAIN COLUMN */}
          <article className="form-card">
            {editing ? (
              <form onSubmit={handleSave} className="stack">
                <h2>Edit item</h2>

                <div className="field">
                  <label htmlFor="edit-title">Title</label>
                  <input
                    id="edit-title"
                    name="title"
                    className="input"
                    value={editForm.title}
                    onChange={handleEditChange}
                    minLength={3}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="edit-description">Description</label>
                  <textarea
                    id="edit-description"
                    name="description"
                    className="textarea"
                    value={editForm.description}
                    onChange={handleEditChange}
                    minLength={10}
                    maxLength={1000}
                    required
                  />
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="edit-type">Type</label>
                    <select
                      id="edit-type"
                      name="type"
                      className="select"
                      value={editForm.type}
                      onChange={handleEditChange}
                    >
                      {ITEM_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {titleCase(value)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="edit-category">Category</label>
                    <select
                      id="edit-category"
                      name="category"
                      className="select"
                      value={editForm.category}
                      onChange={handleEditChange}
                    >
                      {ITEM_CATEGORIES.map((value) => (
                        <option key={value} value={value}>
                          {CATEGORY_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="edit-location">Location</label>
                    <input
                      id="edit-location"
                      name="location"
                      className="input"
                      value={editForm.location}
                      onChange={handleEditChange}
                      maxLength={200}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="edit-date">Date</label>
                    <input
                      id="edit-date"
                      name="date"
                      type="date"
                      className="input"
                      value={editForm.date}
                      onChange={handleEditChange}
                      max={todayInputValue()}
                      required
                    />
                  </div>
                </div>

                <ImageUploader
                  images={editForm.images || []}
                  onChange={(images) =>
                    setEditForm((current) => ({ ...current, images }))
                  }
                  disabled={saving}
                />

                <div className="row">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditing(false);
                      setActionError('');
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Photo gallery. Rendered only when the report has images. */}
                {item.images?.length > 0 && (
                  <div className="detail-gallery">
                    <figure className="detail-gallery-main">
                      <img
                        src={item.images[activeImage]?.url}
                        alt={item.images[activeImage]?.name || item.title}
                      />
                    </figure>

                    {item.images.length > 1 && (
                      <div className="detail-gallery-thumbs">
                        {item.images.map((image, index) => (
                          <button
                            key={image.fileId}
                            type="button"
                            className={`detail-thumb${index === activeImage ? ' is-active' : ''}`}
                            onClick={() => setActiveImage(index)}
                            aria-label={`Show image ${index + 1} of ${item.images.length}`}
                            aria-current={index === activeImage}
                          >
                            <img src={image.url} alt="" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row">
                    <span aria-hidden="true" style={{ fontSize: '1.75rem' }}>
                      {CATEGORY_ICONS[item.category]}
                    </span>
                    <Badge value={item.type} />
                    <Badge value={item.status} />
                  </div>
                  <span className="text-subtle">
                    Reported {formatRelative(item.createdAt)}
                  </span>
                </div>

                <h1 className="mt-4" style={{ fontSize: 'var(--text-3xl)' }}>
                  {item.title}
                </h1>

                <p className="text-muted mt-4" style={{ whiteSpace: 'pre-wrap' }}>
                  {item.description}
                </p>

                <div className="detail-facts">
                  <div>
                    <p className="fact-label">Category</p>
                    <p className="fact-value">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </p>
                  </div>
                  <div>
                    <p className="fact-label">Location</p>
                    <p className="fact-value">{item.location}</p>
                  </div>
                  <div>
                    <p className="fact-label">
                      {item.type === 'LOST' ? 'Date lost' : 'Date found'}
                    </p>
                    <p className="fact-value">{formatDate(item.date)}</p>
                  </div>
                  <div>
                    <p className="fact-label">Status</p>
                    <p className="fact-value">{titleCase(item.status)}</p>
                  </div>
                </div>

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row">
                    <span className="reporter-avatar" aria-hidden="true">
                      {item.reportedBy?.name?.charAt(0).toUpperCase() || '?'}
                    </span>
                    <div>
                      <p className="fact-label">Reported by</p>
                      {/*
                        Populated with name and role only. Email is
                        deliberately withheld by the backend until a claim
                        reaches verification. Older records predate
                        authentication and have no reporter at all.
                      */}
                      <p className="fact-value">
                        {item.reportedBy?.name || 'Unknown (legacy record)'}
                        {isOwner && ' · you'}
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <div className="row">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditing(true)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>

                {isAdmin && !isOwner && (
                  <p className="text-subtle mt-4">
                    You can manage this item because you are an admin.
                  </p>
                )}
              </>
            )}
          </article>

          {/* -------------------------------------------- SIDE COLUMN */}
          <aside className="stack-lg">
            {/* Claim form — only for other people, on ACTIVE items. */}
            {canClaim && (
              <section className="form-card">
                <h2 style={{ fontSize: 'var(--text-xl)' }}>Is this yours?</h2>
                <p className="text-muted mt-4" style={{ fontSize: 'var(--text-sm)' }}>
                  Describe something only the owner would know — a mark, a
                  contents detail, where you lost it. The person who reported
                  it decides.
                </p>

                <form onSubmit={handleClaimSubmit} className="stack mt-4">
                  <div className="field">
                    <label htmlFor="claim-message">Your evidence</label>
                    <textarea
                      id="claim-message"
                      className="textarea"
                      value={claimMessage}
                      onChange={(event) => setClaimMessage(event.target.value)}
                      minLength={20}
                      maxLength={1000}
                      required
                      placeholder="It has a small scratch on the back and my initials inside the flap…"
                      aria-describedby="claim-hint"
                    />
                    <p id="claim-hint" className="field-hint">
                      {claimMessage.trim().length}/20 characters minimum
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block"
                    disabled={claimSubmitting || claimMessage.trim().length < 20}
                  >
                    {claimSubmitting ? 'Submitting…' : 'Submit claim'}
                  </button>
                </form>
              </section>
            )}

            {/* The current user's own claim status. */}
            {myClaim && (
              <section className="form-card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: 'var(--text-xl)' }}>Your claim</h2>
                  <Badge value={myClaim.status} />
                </div>
                <p className="claim-message mt-4">{myClaim.message}</p>
                <p className="text-subtle mt-4">
                  Submitted {formatRelative(myClaim.createdAt)}
                </p>
                {myClaim.status === 'PENDING' && (
                  <p className="alert alert-info mt-4">
                    Waiting for the reporter to review your claim.
                  </p>
                )}
              </section>
            )}

            {!canClaim && !myClaim && !isOwner && item.status !== 'ACTIVE' && (
              <section className="form-card">
                <EmptyState
                  icon={'\u{1F512}'}
                  title="Claims are closed"
                  message={`This item is marked ${titleCase(item.status)} and is no longer accepting new claims.`}
                />
              </section>
            )}

            {/* Claim management — owners and admins. */}
            {canManage && (
              <section className="form-card">
                <h2 style={{ fontSize: 'var(--text-xl)' }}>
                  Claims on this item
                  {claims.length > 0 && (
                    <span className="text-subtle"> ({claims.length})</span>
                  )}
                </h2>

                {claimsLoading ? (
                  <SectionLoader label="Loading claims" />
                ) : claims.length === 0 ? (
                  <p className="text-muted mt-4" style={{ fontSize: 'var(--text-sm)' }}>
                    No one has claimed this item yet.
                  </p>
                ) : (
                  <div className="stack mt-4">
                    {claims.map((claim) => (
                      <div key={claim._id} className="claim-row">
                        <div className="claim-row-top">
                          <strong>{claim.claimant?.name || 'Unknown'}</strong>
                          <Badge value={claim.status} />
                        </div>

                        <p className="claim-message">{claim.message}</p>

                        <p className="text-subtle">
                          {formatRelative(claim.createdAt)}
                        </p>

                        {/*
                          Decision buttons appear only for PENDING claims
                          on an ACTIVE item — exactly the conditions the
                          backend accepts. Anything else would offer a
                          button guaranteed to return 409.
                        */}
                        {claim.status === 'PENDING' && item.status === 'ACTIVE' && (
                          <div className="row">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleDecision(claim._id, 'APPROVED')}
                              disabled={deciding === claim._id}
                            >
                              {deciding === claim._id ? 'Working…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDecision(claim._id, 'REJECTED')}
                              disabled={deciding === claim._id}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
