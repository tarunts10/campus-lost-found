/**
 * pages/ItemsPage.jsx — browse, filter, search, paginate.
 *
 * All four data states are handled explicitly: loading, error, empty,
 * and results. There is no code path that renders a blank page.
 *
 * Filters live in the URL query string rather than in component state.
 * That costs a little plumbing and buys a lot: a filtered view is
 * shareable, survives a refresh, and the browser back button steps
 * through filter changes the way people expect.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as itemService from '../services/itemService.js';
import ItemCard from '../components/ItemCard.jsx';
import Pagination from '../components/Pagination.jsx';
import { CardSkeleton } from '../components/Loader.jsx';
import { EmptyState, ErrorState } from '../components/StateBlock.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  ITEM_STATUSES,
  ITEM_TYPES,
  PAGE_SIZE,
} from '../utils/constants.js';
import { titleCase } from '../utils/format.js';

export default function ItemsPage() {
  useDocumentTitle('Browse items');

  const [searchParams, setSearchParams] = useSearchParams();

  const type = searchParams.get('type') || '';
  const category = searchParams.get('category') || '';
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const page = Number(searchParams.get('page')) || 1;

  // Local mirror of the search box so typing does not fire a request per
  // keystroke. Committed to the URL on submit.
  const [searchDraft, setSearchDraft] = useState(search);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => setSearchDraft(search), [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      /**
       * Empty strings are stripped inside itemService, because the
       * backend REJECTS unknown or invalid query values with a 400 —
       * sending `category=` for "all categories" would be an error.
       */
      const result = await itemService.listItems({
        type,
        category,
        status,
        search,
        page,
        limit: PAGE_SIZE,
      });

      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message);
      setItems([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [type, category, status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Update one filter. Always resets to page 1 — staying on page 4 while
   * changing a filter usually lands on an empty page and looks broken.
   */
  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);

    if (value) next.set(key, value);
    else next.delete(key);

    next.delete('page');
    setSearchParams(next);
  };

  const changePage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitSearch = (event) => {
    event.preventDefault();
    updateFilter('search', searchDraft.trim());
  };

  const clearAll = () => setSearchParams(new URLSearchParams());

  const hasFilters = Boolean(type || category || status || search);

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <h1>Browse items</h1>
          <p>
            Everything reported across campus. Filter by type, category or
            status, or search by keyword.
          </p>
        </header>

        {/* ----------------------------------------------- FILTER BAR */}
        <form className="filter-bar" onSubmit={submitSearch} role="search">
          <div className="field">
            <label htmlFor="search">Search</label>
            <input
              id="search"
              name="search"
              type="search"
              className="input"
              placeholder="Wallet, keys, charger…"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="type">Type</label>
            <select
              id="type"
              className="select"
              value={type}
              onChange={(event) => updateFilter('type', event.target.value)}
            >
              <option value="">All types</option>
              {ITEM_TYPES.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              className="select"
              value={category}
              onChange={(event) => updateFilter('category', event.target.value)}
            >
              <option value="">All categories</option>
              {ITEM_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              className="select"
              value={status}
              onChange={(event) => updateFilter('status', event.target.value)}
            >
              <option value="">All statuses</option>
              {ITEM_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>

        {hasFilters && (
          <div className="row" style={{ marginBottom: 'var(--space-5)' }}>
            <span className="text-subtle">Filters applied</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}

        {/* Announced to screen readers when the count changes. */}
        {!loading && !error && pagination && (
          <p className="text-subtle" aria-live="polite" style={{ marginBottom: 'var(--space-4)' }}>
            {pagination.total} item{pagination.total === 1 ? '' : 's'} found
          </p>
        )}

        {/* -------------------------------------------- THE FOUR STATES */}
        {loading ? (
          <CardSkeleton count={PAGE_SIZE} />
        ) : error ? (
          <ErrorState
            title="Unable to load items"
            message={error}
            onRetry={load}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No items found"
            message={
              hasFilters
                ? 'No items match these filters. Try widening your search.'
                : 'Nothing has been reported yet. Be the first.'
            }
            action={
              hasFilters ? (
                <button type="button" className="btn btn-secondary" onClick={clearAll}>
                  Clear filters
                </button>
              ) : (
                <Link to="/report" className="btn btn-primary">
                  Report an item
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="grid-cards">
              {items.map((item, index) => (
                <ItemCard key={item._id} item={item} index={index} />
              ))}
            </div>

            <Pagination
              pagination={pagination}
              onChange={changePage}
              disabled={loading}
            />
          </>
        )}
      </div>
    </div>
  );
}
