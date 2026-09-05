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
 *
 * WHAT IS DELIBERATELY NOT SHOWN: the reporter's email, and any claimant
 * detail beyond a name. The backend withholds those, and this page does
 * not attempt to reconstruct them from anywhere else.
 *
 * FINAL PASS CHANGES:
 *   - the gallery is now the first thing on the page, full width, and
 *     opens a lightbox. Item photos are evidence; they earn the space
 *   - an item with no photos gets the generated category artwork rather
 *     than a missing block, so the layout is identical either way
 *   - window.confirm is gone. Deleting an item and approving a claim
 *     both go through <ConfirmDialog>: they are irreversible, and
 *     approving in particular auto-rejects every other pending claim
 *   - transient confirmations are toasts, so the layout stops jumping
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as itemService from '../services/itemService.js';
import * as claimService from '../services/claimService.js';
import Badge from '../components/Badge.jsx';
import SmartImage from '../components/SmartImage.jsx';
import Lightbox from '../components/Lightbox.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { SectionLoader } from '../components/Loader.jsx';
import { EmptyState, ErrorState } from '../components/StateBlock.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useReveal } from '../hooks/useReveal.js';
import ImageUploader from '../components/ImageUploader.jsx';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  ITEM_TYPES,
} from '../utils/constants.js';
import { categoryArtwork } from '../utils/media.js';
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
  const toast = useToast();

  const [item, setItem] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const [claimMessage, setClaimMessage] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deciding, setDeciding] = useState(null);

  /**
   * Which confirmation is open, if any.
   *
   * One piece of state rather than a boolean per dialog: only one can be
   * open at a time, and a single value makes that impossible to get
   * wrong. `null` means nothing is open.
   */
  const [confirming, setConfirming] = useState(null);

  const detailRef = useReveal();

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

  const pendingClaims = claims.filter((claim) => claim.status === 'PENDING');

  const loadItem = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await itemService.getItem(id);
      setItem(data);
      setActiveImage(0);
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
      setActiveImage(0);
      toast.success('Item updated.');
    } catch (err) {
      // Includes 403 if the backend disagrees that this user may edit.
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setActionError('');

    try {
      await itemService.deleteItem(id);
      toast.success('Item deleted.');
      navigate('/my-items', { replace: true });
    } catch (err) {
      setActionError(err.message);
      setDeleting(false);
      setConfirming(null);
    }
  };

  const handleClaimSubmit = async (event) => {
    event.preventDefault();
    setClaimSubmitting(true);
    setActionError('');

    try {
      await claimService.createClaim(id, claimMessage.trim());
      setClaimMessage('');
      toast.success(
        'Claim submitted. The person who reported this item will review it.'
      );
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
    setConfirming(null);

    try {
      const result = await claimService.decideClaim(claimId, status);

      if (status === 'APPROVED') {
        toast.success(
          `Claim approved. This item is now ${result.itemStatus}` +
            (result.otherClaimsRejected > 0
              ? `, and ${result.otherClaimsRejected} other pending claim${
                  result.otherClaimsRejected === 1 ? ' was' : 's were'
                } rejected.`
              : '.')
        );
      } else {
        toast.success('Claim rejected.');
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

  const images = item.images || [];
  const hasPhotos = images.length > 0;
  const art = categoryArtwork(item.category);

  return (
    <div className="page">
      <div className="container">
        <Link to="/items" className="back-link">
          ← Back to browse
        </Link>

        {actionError && (
          <div className="alert alert-error mt-4" role="alert">
            {actionError}
          </div>
        )}

        <div className="detail-grid mt-6" ref={detailRef}>
          {/* -------------------------------------------- MAIN COLUMN */}
          <article className="form-card reveal">
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
                  onChange={(nextImages) =>
                    setEditForm((current) => ({ ...current, images: nextImages }))
                  }
                  disabled={saving}
                />

                <div className="row">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true" />
                        Saving…
                      </>
                    ) : (
                      'Save changes'
                    )}
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
                {/* ============================================ GALLERY
                    Promoted to the top and given real size: an item photo
                    is the evidence someone uses to recognise their own
                    property, so it should not be a thumbnail.

                    An item with NO photos gets the generated category
                    artwork instead of nothing at all, so the page has the
                    same shape either way. */}
                <div className="detail-gallery">
                  {hasPhotos ? (
                    <>
                      <button
                        type="button"
                        className="detail-gallery-main"
                        onClick={() => setLightboxOpen(true)}
                        aria-label={`Open photo ${activeImage + 1} of ${images.length} full size`}
                      >
                        <SmartImage
                          src={images[activeImage]?.url}
                          alt={item.title}
                          aspect="16 / 10"
                          objectFit="contain"
                          eager
                        />
                        <span className="gallery-zoom-hint" aria-hidden="true">
                          {'\u{1F50E}'} View full size
                        </span>
                      </button>

                      {images.length > 1 && (
                        <div className="detail-gallery-thumbs">
                          {images.map((image, index) => (
                            <button
                              key={image.fileId}
                              type="button"
                              className={`detail-thumb${index === activeImage ? ' is-active' : ''}`}
                              onClick={() => setActiveImage(index)}
                              aria-label={`Show image ${index + 1} of ${images.length}`}
                              aria-current={index === activeImage}
                            >
                              <img src={image.url} alt="" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div
                      className="detail-gallery-main item-card-art"
                      style={{
                        '--art-from': art.from,
                        '--art-to': art.to,
                        cursor: 'default',
                      }}
                      aria-hidden="true"
                    >
                      <span className="item-card-art-glyph">{art.glyph}</span>
                      <span className="item-card-art-label">
                        No photo on this report
                      </span>
                    </div>
                  )}
                </div>

                <div className="detail-hero-meta">
                  <Badge value={item.type} />
                  <Badge value={item.status} />
                  <span className="text-subtle" style={{ marginLeft: 'auto' }}>
                    Reported {formatRelative(item.createdAt)}
                  </span>
                </div>

                <h1 style={{ fontSize: 'var(--text-3xl)' }}>{item.title}</h1>

                <p className="text-muted mt-4" style={{ whiteSpace: 'pre-wrap' }}>
                  {item.description}
                </p>

                <div className="detail-facts">
                  <div>
                    <p className="fact-label">Category</p>
                    <p className="fact-value">
                      {CATEGORY_ICONS[item.category]}{' '}
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
                        onClick={() => setConfirming({ kind: 'delete' })}
                        disabled={deleting}
                      >
                        {deleting ? (
                          <>
                            <span className="btn-spinner" aria-hidden="true" />
                            Deleting…
                          </>
                        ) : (
                          'Delete'
                        )}
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
          <aside className="stack-lg detail-side">
            {/* Claim form — only for other people, on ACTIVE items. */}
            {canClaim && (
              <section className="form-card reveal" style={{ '--reveal-delay': '90ms' }}>
                <h2 style={{ fontSize: 'var(--text-xl)' }}>Is this yours?</h2>
                <p className="text-muted mt-4" style={{ fontSize: 'var(--text-sm)' }}>
                  Describe something only the owner would know — a mark, a
                  contents detail, where you lost it. The person who reported
                  it decides, so specifics matter far more than urgency.
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
                    {claimSubmitting ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true" />
                        Submitting…
                      </>
                    ) : (
                      'Submit claim'
                    )}
                  </button>
                </form>
              </section>
            )}

            {/* The current user's own claim status. */}
            {myClaim && (
              <section className="form-card reveal" style={{ '--reveal-delay': '90ms' }}>
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
                {myClaim.status === 'APPROVED' && (
                  <p className="alert alert-success mt-4">
                    Approved. Arrange collection with the person who reported
                    it.
                  </p>
                )}
              </section>
            )}

            {!canClaim && !myClaim && !isOwner && item.status !== 'ACTIVE' && (
              <section className="form-card reveal">
                <EmptyState
                  icon={'\u{1F512}'}
                  title="Claims are closed"
                  message={`This item is marked ${titleCase(item.status)} and is no longer accepting new claims.`}
                />
              </section>
            )}

            {/* Claim management — owners and admins. */}
            {canManage && (
              <section className="form-card reveal" style={{ '--reveal-delay': '140ms' }}>
                <h2 style={{ fontSize: 'var(--text-xl)' }}>
                  Claims on this item
                  {claims.length > 0 && (
                    <span className="text-subtle"> ({claims.length})</span>
                  )}
                </h2>

                {pendingClaims.length > 0 && item.status === 'ACTIVE' && (
                  <p className="alert alert-info mt-4">
                    {pendingClaims.length} claim
                    {pendingClaims.length === 1 ? '' : 's'} waiting for your
                    decision.
                  </p>
                )}

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
                              onClick={() =>
                                setConfirming({
                                  kind: 'approve',
                                  claimId: claim._id,
                                  name: claim.claimant?.name || 'this person',
                                })
                              }
                              disabled={deciding === claim._id}
                            >
                              {deciding === claim._id ? (
                                <>
                                  <span className="btn-spinner" aria-hidden="true" />
                                  Working…
                                </>
                              ) : (
                                'Approve'
                              )}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() =>
                                setConfirming({
                                  kind: 'reject',
                                  claimId: claim._id,
                                  name: claim.claimant?.name || 'this person',
                                })
                              }
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

      {/* ================================================== LIGHTBOX */}
      {lightboxOpen && hasPhotos && (
        <Lightbox
          images={images}
          index={activeImage}
          title={item.title}
          onNavigate={setActiveImage}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* ============================================== CONFIRMATIONS */}
      <ConfirmDialog
        open={confirming?.kind === 'delete'}
        destructive
        busy={deleting}
        title="Delete this report?"
        message={`"${item.title}" will be removed permanently, along with any photos attached to it. Claims filed against it are removed too. This cannot be undone.`}
        confirmLabel="Delete report"
        cancelLabel="Keep it"
        onConfirm={handleDelete}
        onCancel={() => setConfirming(null)}
      />

      {/*
        Approving is confirmed as well as deleting, and for a real
        reason: approval marks the item CLAIMED and auto-rejects every
        other pending claim. That is irreversible through the UI, so the
        consequence is spelled out before it happens rather than
        discovered afterwards.
      */}
      <ConfirmDialog
        open={confirming?.kind === 'approve'}
        busy={deciding === confirming?.claimId}
        title="Approve this claim?"
        message={
          `This marks the item as claimed by ${confirming?.name}` +
          (pendingClaims.length > 1
            ? `, and automatically rejects the other ${pendingClaims.length - 1} pending claim${pendingClaims.length - 1 === 1 ? '' : 's'}.`
            : '.') +
          ' You cannot undo this from here.'
        }
        confirmLabel="Approve claim"
        onConfirm={() => handleDecision(confirming.claimId, 'APPROVED')}
        onCancel={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming?.kind === 'reject'}
        destructive
        busy={deciding === confirming?.claimId}
        title="Reject this claim?"
        message={`${confirming?.name} will be told their claim was rejected. The item stays active, so other people can still claim it.`}
        confirmLabel="Reject claim"
        onConfirm={() => handleDecision(confirming.claimId, 'REJECTED')}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
