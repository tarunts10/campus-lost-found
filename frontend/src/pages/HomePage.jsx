/**
 * pages/HomePage.jsx — the landing page.
 *
 * Carries all six effects, each with a job:
 *   1. hover    CTA buttons and item cards
 *   2. parallax hero background layers (subtle, 0.12-0.25 speed)
 *   3. cursor   app-wide, via <CustomCursor />
 *   4. loader   skeletons while recent items load
 *   5. 3D       tilt on the hero panel and on item cards
 *   6. reveal   every section fades in on scroll
 *
 * NOTE ON RECENT ITEMS: the backend protects GET /api/items, so this
 * section only loads for signed-in users. Logged-out visitors get a
 * sign-in prompt in its place rather than an error.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useReveal } from '../hooks/useReveal.js';
import { useParallax } from '../hooks/useParallax.js';
import { useTilt } from '../hooks/useTilt.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import * as itemService from '../services/itemService.js';
import ItemCard from '../components/ItemCard.jsx';
import { CardSkeleton } from '../components/Loader.jsx';
import { EmptyState, ErrorState } from '../components/StateBlock.jsx';
import { CATEGORY_ICONS, CATEGORY_LABELS, ITEM_CATEGORIES } from '../utils/constants.js';

const STEPS = [
  {
    icon: '\u{1F4DD}',
    title: 'Report it',
    body: 'Lost or found, file a report in under a minute with the details that matter: what, where, and when.',
  },
  {
    icon: '\u{1F50E}',
    title: 'Search and match',
    body: 'Browse everything on campus, filtered by category, type and location, or search by keyword.',
  },
  {
    icon: '\u{1F91D}',
    title: 'Prove and recover',
    body: 'Describe something only the owner would know. The finder reviews it and approves the right claim.',
  },
];

export default function HomePage() {
  useDocumentTitle();

  const { isAuthenticated, user } = useAuth();

  const heroBackRef = useParallax(0.25);
  const heroFrontRef = useParallax(0.1);
  const heroPanelRef = useTilt(7);

  const stepsRef = useReveal();
  const categoriesRef = useReveal();
  const recentRef = useReveal();
  const ctaRef = useReveal();

  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState('');

  useEffect(() => {
    // Nothing to fetch when signed out — the endpoint requires a token.
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const { items } = await itemService.listItems({ limit: 6, page: 1 });
        if (!cancelled) setRecent(items);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <div className="home">
      {/* ---------------------------------------------------- HERO */}
      <section className="hero">
        {/*
          Two parallax layers at different speeds. The difference between
          them is what creates the sense of depth — a single moving layer
          just looks like a bug.
        */}
        <div ref={heroBackRef} className="hero-layer hero-layer-back" aria-hidden="true" />
        <div ref={heroFrontRef} className="hero-layer hero-layer-front" aria-hidden="true" />

        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="hero-eyebrow">Private to your campus</p>
            <h1>
              Lost something?
              <br />
              <span className="hero-accent">Someone probably found it.</span>
            </h1>
            <p className="hero-lead">
              A verified lost-and-found for college members. Report what you
              lost, list what you found, and let real ownership checks decide
              who gets it back — not whoever asks first.
            </p>

            <div className="row hero-actions">
              {isAuthenticated ? (
                <>
                  <Link to="/report" className="btn btn-primary btn-lg">
                    Report an item
                  </Link>
                  <Link to="/items" className="btn btn-secondary btn-lg">
                    Browse items
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg">
                    Get started
                  </Link>
                  <Link to="/login" className="btn btn-secondary btn-lg">
                    I have an account
                  </Link>
                </>
              )}
            </div>

            {isAuthenticated && (
              <p className="hero-welcome">
                Signed in as <strong>{user?.name}</strong>
              </p>
            )}
          </div>

          {/* 3D tilt panel — the hero's visual anchor. */}
          <div className="tilt-wrap hero-visual">
            <div ref={heroPanelRef} className="hero-panel tilt">
              <div className="hero-panel-head">
                <span className="badge badge-found">Found</span>
                <span className="badge badge-active">Active</span>
              </div>
              <h3 className="tilt-layer">Blue water bottle</h3>
              <p className="hero-panel-desc">
                Steel blue bottle with a dented cap, left in Lecture Hall 3.
              </p>
              <div className="hero-panel-meta">
                <span>{'\u{1F4CD}'} Lecture Hall 3</span>
                <span>2 days ago</span>
              </div>
              <div className="hero-panel-foot tilt-layer">
                <span className="hero-panel-avatar" aria-hidden="true">
                  P
                </span>
                <span>Priya reported this</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- HOW IT WORKS */}
      <section className="section" ref={stepsRef}>
        <div className="container">
          <div className="section-head reveal">
            <h2>How it works</h2>
            <p className="text-muted">
              Three steps, built so items reach their actual owners.
            </p>
          </div>

          <div className="steps-grid">
            {STEPS.map((step, index) => (
              <article
                key={step.title}
                className="card card-hover reveal step-card"
                style={{ '--reveal-delay': `${index * 90}ms` }}
              >
                <span className="step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="step-icon" aria-hidden="true">
                  {step.icon}
                </span>
                <h3>{step.title}</h3>
                <p className="text-muted">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- CATEGORIES */}
      <section className="section section-subtle" ref={categoriesRef}>
        <div className="container">
          <div className="section-head reveal">
            <h2>Browse by category</h2>
            <p className="text-muted">
              Most campus losses fall into a handful of buckets.
            </p>
          </div>

          <div className="category-grid">
            {ITEM_CATEGORIES.map((category, index) => (
              <Link
                key={category}
                to={`/items?category=${category}`}
                className="category-chip reveal"
                style={{ '--reveal-delay': `${index * 50}ms` }}
              >
                <span aria-hidden="true">{CATEGORY_ICONS[category]}</span>
                {CATEGORY_LABELS[category]}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- RECENT ITEMS */}
      <section className="section" ref={recentRef}>
        <div className="container">
          <div className="section-head section-head-row reveal">
            <div>
              <h2>Recently reported</h2>
              <p className="text-muted">The latest items across campus.</p>
            </div>
            {isAuthenticated && (
              <Link to="/items" className="btn btn-secondary">
                View all
              </Link>
            )}
          </div>

          {/* Four explicit states: signed-out, loading, error, empty, data. */}
          {!isAuthenticated ? (
            <EmptyState
              icon={'\u{1F510}'}
              title="Sign in to see reported items"
              message="Campus Lost & Found is private to verified college members, so listings are only visible once you are signed in."
              action={
                <Link to="/login" className="btn btn-primary">
                  Sign in to browse
                </Link>
              }
            />
          ) : loading ? (
            <CardSkeleton count={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => window.location.reload()} />
          ) : recent.length === 0 ? (
            <EmptyState
              title="Nothing reported yet"
              message="Be the first to file a report — it takes less than a minute."
              action={
                <Link to="/report" className="btn btn-primary">
                  Report an item
                </Link>
              }
            />
          ) : (
            <div className="grid-cards">
              {recent.map((item, index) => (
                <ItemCard key={item._id} item={item} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------- CTA */}
      <section className="section" ref={ctaRef}>
        <div className="container">
          <div className="cta-panel reveal">
            <div>
              <h2>Found something that is not yours?</h2>
              <p>
                Ten minutes of your time can save someone their ID card, their
                keys, or their laptop charger the night before a deadline.
              </p>
            </div>
            <Link
              to={isAuthenticated ? '/report' : '/register'}
              className="btn btn-primary btn-lg"
            >
              {isAuthenticated ? 'Report an item' : 'Create an account'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
