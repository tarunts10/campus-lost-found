/**
 * pages/MyItemsPage.jsx — items reported by the logged-in user.
 *
 * Uses GET /api/items?mine=true. That parameter was added to the backend
 * for this page: filtering client-side would be WRONG rather than merely
 * slow, because with pagination, page 1 of everyone's items can contain
 * none of yours — the page would look empty while your items sit on
 * page 3.
 *
 * The backend resolves `mine` against the JWT, never against a user id
 * in the query, so there is no way to ask for someone else's items.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as itemService from '../services/itemService.js';
import ItemCard from '../components/ItemCard.jsx';
import Pagination from '../components/Pagination.jsx';
import { CardSkeleton } from '../components/Loader.jsx';
import { EmptyState, ErrorState } from '../components/StateBlock.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { PAGE_SIZE } from '../utils/constants.js';

export default function MyItemsPage() {
  useDocumentTitle('My items');

  const location = useLocation();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await itemService.listItems({
        mine: 'true',
        page,
        limit: PAGE_SIZE,
      });

      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  // Clear the "Item deleted." banner after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const stats = {
    total: pagination?.total ?? 0,
    lost: items.filter((item) => item.type === 'LOST').length,
    found: items.filter((item) => item.type === 'FOUND').length,
    claimed: items.filter((item) => item.status === 'CLAIMED').length,
  };

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <h1>My items</h1>
              <p>Everything you have reported. Open an item to edit, delete, or review claims.</p>
            </div>
            <Link to="/report" className="btn btn-primary">
              Report an item
            </Link>
          </div>
        </header>

        {notice && (
          <div className="alert alert-success" role="status" style={{ marginBottom: 'var(--space-5)' }}>
            {notice}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="stat-row">
            <div className="stat">
              <p className="stat-value">{stats.total}</p>
              <p className="stat-label">Reported</p>
            </div>
            <div className="stat">
              <p className="stat-value">{stats.lost}</p>
              <p className="stat-label">Lost (this page)</p>
            </div>
            <div className="stat">
              <p className="stat-value">{stats.found}</p>
              <p className="stat-label">Found (this page)</p>
            </div>
            <div className="stat">
              <p className="stat-value">{stats.claimed}</p>
              <p className="stat-label">Claimed (this page)</p>
            </div>
          </div>
        )}

        {loading ? (
          <CardSkeleton count={PAGE_SIZE} />
        ) : error ? (
          <ErrorState title="Unable to load your items" message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={'\u{1F4E6}'}
            title="You have not reported anything yet"
            message="When you lose something or find something that is not yours, report it here and it becomes searchable across campus."
            action={
              <Link to="/report" className="btn btn-primary">
                Report your first item
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid-cards">
              {items.map((item, index) => (
                <ItemCard key={item._id} item={item} index={index} />
              ))}
            </div>
            <Pagination pagination={pagination} onChange={setPage} disabled={loading} />
          </>
        )}
      </div>
    </div>
  );
}
