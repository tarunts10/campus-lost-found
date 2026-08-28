/**
 * pages/MyClaimsPage.jsx — the user's claim activity.
 *
 * GET /api/claims returns TWO kinds of claim, because the backend's
 * visibility rule is "claims you filed OR claims on items you reported":
 *
 *   Claims I made      — waiting on someone else's decision
 *   Claims on my items — waiting on MY decision
 *
 * Splitting them here matters: one list is passive (wait), the other is
 * a to-do list (act). Mixing them buries the actionable ones.
 *
 * The split is computed by comparing claimant ids, not by asking the
 * server for two different things — one request already contains both.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import * as claimService from '../services/claimService.js';
import Badge from '../components/Badge.jsx';
import Pagination from '../components/Pagination.jsx';
import { SectionLoader } from '../components/Loader.jsx';
import { EmptyState, ErrorState } from '../components/StateBlock.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { CLAIM_STATUSES } from '../utils/constants.js';
import { formatRelative, sameId, titleCase } from '../utils/format.js';

export default function MyClaimsPage() {
  useDocumentTitle('My claims');

  const { user } = useAuth();

  const [claims, setClaims] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [deciding, setDeciding] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await claimService.listClaims({
        status: statusFilter,
        page,
        limit: 20,
      });

      setClaims(result.claims);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message);
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const { mine, onMyItems } = useMemo(() => {
    const filed = [];
    const received = [];

    for (const claim of claims) {
      if (sameId(claim.claimant, user?._id)) filed.push(claim);
      else received.push(claim);
    }

    return { mine: filed, onMyItems: received };
  }, [claims, user]);

  const handleDecision = async (claimId, status) => {
    setDeciding(claimId);
    setActionError('');
    setNotice('');

    try {
      const result = await claimService.decideClaim(claimId, status);

      setNotice(
        status === 'APPROVED'
          ? `Claim approved. The item is now ${result.itemStatus}` +
              (result.otherClaimsRejected > 0
                ? `, and ${result.otherClaimsRejected} competing claim${
                    result.otherClaimsRejected === 1 ? ' was' : 's were'
                  } rejected.`
                : '.')
          : 'Claim rejected.'
      );

      await load();
    } catch (err) {
      // Surfaces 403 (not your item) and 409 (already decided / item no
      // longer active) rather than silently failing.
      setActionError(err.message);
    } finally {
      setDeciding(null);
    }
  };

  const renderClaim = (claim, { actionable }) => (
    <article key={claim._id} className="card claim-card">
      <div className="claim-row-top">
        <div>
          <Link
            to={`/items/${claim.item?._id}`}
            style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}
          >
            {claim.item?.title || 'Item unavailable'}
          </Link>
          <p className="text-subtle">
            {actionable
              ? `Claimed by ${claim.claimant?.name || 'Unknown'}`
              : `Reported by ${claim.item?.reportedBy?.name || 'Unknown'}`}
            {' · '}
            {formatRelative(claim.createdAt)}
          </p>
        </div>

        <div className="row">
          {claim.item?.type && <Badge value={claim.item.type} />}
          <Badge value={claim.status} />
        </div>
      </div>

      <p className="claim-message">{claim.message}</p>

      {/*
        Decision buttons appear only when the backend would actually
        accept them: a PENDING claim on an item that is still ACTIVE.
        Rendering them otherwise would offer a guaranteed 409.
      */}
      {actionable && claim.status === 'PENDING' && claim.item?.status === 'ACTIVE' && (
        <div className="row">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleDecision(claim._id, 'APPROVED')}
            disabled={deciding === claim._id}
          >
            {deciding === claim._id ? (<><span className="btn-spinner" aria-hidden="true" />Working…</>) : ('Approve')}
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

      {actionable && claim.status === 'PENDING' && claim.item?.status !== 'ACTIVE' && (
        <p className="text-subtle">
          This item is {titleCase(claim.item?.status || 'unavailable')}, so this
          claim can no longer be decided.
        </p>
      )}

      {!actionable && claim.status === 'PENDING' && (
        <p className="text-subtle">Waiting for the reporter to review.</p>
      )}

      {!actionable && claim.status === 'APPROVED' && (
        <p className="alert alert-success">
          Approved — arrange collection with the reporter.
        </p>
      )}
    </article>
  );

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>My claims</h1>
          <p>
            Claims you have made, and claims other people have made on items
            you reported.
          </p>
        </header>

        {notice && (
          <div className="alert alert-success" role="status" style={{ marginBottom: 'var(--space-5)' }}>
            {notice}
          </div>
        )}

        {actionError && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
            {actionError}
          </div>
        )}

        <div className="row" style={{ marginBottom: 'var(--space-6)' }}>
          <label htmlFor="claim-status" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
            Filter by status
          </label>
          <select
            id="claim-status"
            className="select"
            style={{ maxWidth: '220px' }}
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {CLAIM_STATUSES.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <SectionLoader label="Loading claims" />
        ) : error ? (
          <ErrorState title="Unable to load claims" message={error} onRetry={load} />
        ) : claims.length === 0 ? (
          <EmptyState
            icon={'\u{1F91D}'}
            title={statusFilter ? 'No claims with this status' : 'No claims yet'}
            message={
              statusFilter
                ? 'Try a different status filter.'
                : 'When you claim an item, or someone claims one of yours, it appears here.'
            }
            action={
              <Link to="/items" className="btn btn-primary">
                Browse items
              </Link>
            }
          />
        ) : (
          <div className="stack-lg">
            {onMyItems.length > 0 && (
              <section>
                <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)' }}>
                  Claims on my items
                  <span className="text-subtle"> ({onMyItems.length})</span>
                </h2>
                <div className="stack">
                  {onMyItems.map((claim) => renderClaim(claim, { actionable: true }))}
                </div>
              </section>
            )}

            {mine.length > 0 && (
              <section>
                <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)' }}>
                  Claims I made
                  <span className="text-subtle"> ({mine.length})</span>
                </h2>
                <div className="stack">
                  {mine.map((claim) => renderClaim(claim, { actionable: false }))}
                </div>
              </section>
            )}

            <Pagination pagination={pagination} onChange={setPage} disabled={loading} />
          </div>
        )}
      </div>
    </div>
  );
}
