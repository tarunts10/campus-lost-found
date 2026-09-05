/**
 * pages/HomePage.jsx — the landing page.
 *
 * STRUCTURE (the hierarchy the page is built around):
 *
 *   Hero              the promise, plus the 3D scene
 *   Search band       the single most likely next action
 *   Recently reported real items, as early as it is useful
 *   How it works      three steps
 *   Trust & privacy   why this is safe to use
 *   Final CTA         the ask
 *
 * "Recently reported" sits ABOVE "how it works" on purpose. Someone who
 * lost their keys an hour ago wants to search, not to read an
 * explanation of the product. The explanation is for the smaller group
 * who scroll past it.
 *
 * ALL SIX EFFECTS, each with a job:
 *   1. hover     cards, chips, buttons, the search band
 *   2. parallax  two hero orbs at different speeds
 *   3. cursor    app-wide follower, plus a magnetic primary CTA
 *   4. loader    skeletons while recent items load
 *   5. 3D        the hero scene (perspective + per-layer translateZ)
 *   6. reveal    every section, staggered
 *
 * NOTE ON RECENT ITEMS: the backend protects GET /api/items, so this
 * section only loads for signed-in users. Logged-out visitors get a
 * sign-in prompt in its place rather than an error.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useReveal } from '../hooks/useReveal.js';
import { useParallax } from '../hooks/useParallax.js';
import { useScene3D } from '../hooks/useScene3D.js';
import { useMagnetic } from '../hooks/useMagnetic.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import * as itemService from '../services/itemService.js';
import ItemCard from '../components/ItemCard.jsx';
import SmartImage from '../components/SmartImage.jsx';
import { CardSkeleton } from '../components/Loader.jsx';
import { EmptyState, ErrorState } from '../components/StateBlock.jsx';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
} from '../utils/constants.js';
import { photo, photoSrcSet, photoAlt } from '../utils/media.js';

const STEPS = [
  {
    icon: '\u{1F4DD}',
    title: 'Report it',
    body: 'Lost or found, file a report in under a minute: what it is, where it was, and when. Add photos if you have them.',
  },
  {
    icon: '\u{1F50E}',
    title: 'Search and match',
    body: 'Browse everything reported at your college, filtered by category, type and status, or search by keyword.',
  },
  {
    icon: '\u{1F91D}',
    title: 'Prove and recover',
    body: 'Describe a detail only the owner would know. The person who filed the report reviews it and approves the right claim.',
  },
];

const TRUST = [
  {
    icon: '\u{1F3EB}',
    title: 'Your college only',
    body: 'Every account belongs to one institution, and the server filters every single query by it. Nobody outside your college can see what was reported inside it — that boundary is enforced in the API, not hidden in the interface.',
  },
  {
    icon: '\u{1F512}',
    title: 'Contact details stay private',
    body: 'Reports do not publish phone numbers or email addresses. A claim is a private conversation between the two people involved, and it only opens once the finder approves it.',
  },
  {
    icon: '\u{2696}\u{FE0F}',
    title: 'The finder decides',
    body: 'Claims are not first-come-first-served. Whoever filed the report reviews the evidence and approves one claim — so an item goes back to the person who can actually describe it.',
  },
  {
    icon: '\u{1F510}',
    title: 'Real account security',
    body: 'Passwords are stored as bcrypt hashes and never leave the server. Sessions use signed tokens that are verified against the database on every request, so a revoked account stops working immediately.',
  },
];

export default function HomePage() {
  useDocumentTitle();

  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  /* --- Effects -------------------------------------------------------- */
  const orbBackRef = useParallax(0.22);   // effect 2
  const orbFrontRef = useParallax(0.08);  // effect 2
  const sceneRef = useScene3D({ max: 11 }); // effect 5
  const heroCtaRef = useMagnetic();        // effect 3

  const recentRef = useReveal();
  const stepsRef = useReveal();
  const trustRef = useReveal();
  const categoriesRef = useReveal();
  const ctaRef = useReveal();

  /* --- Search band ---------------------------------------------------- */
  const [query, setQuery] = useState('');

  const submitSearch = (event) => {
    event.preventDefault();
    const trimmed = query.trim();

    // Send them to the browse page with the search applied. Unauthenticated
    // visitors get bounced to login by ProtectedRoute, which then returns
    // them here — so the search is never silently lost.
    navigate(trimmed ? `/items?search=${encodeURIComponent(trimmed)}` : '/items');
  };

  /* --- Recent items --------------------------------------------------- */
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
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="hero-v2">
        <div className="hero-grid" aria-hidden="true" />
        <div ref={orbBackRef} className="hero-orb hero-orb-a" aria-hidden="true" />
        <div ref={orbFrontRef} className="hero-orb hero-orb-b" aria-hidden="true" />

        <div className="container hero-v2-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true">{'\u{1F393}'}</span>
              Private to your campus
            </p>

            <h1 className="display-1">
              Lost something?
              <br />
              <span className="hero-accent">Someone probably found it.</span>
            </h1>

            <p className="hero-sub">
              The lost-and-found for your college, in one place. Report what
              you lost, list what you found, and let real ownership checks
              decide who gets it back — not whoever asks first.
            </p>

            <div className="hero-cta-row">
              {isAuthenticated ? (
                <>
                  {/* EFFECT 3: the magnetic treatment is on exactly one
                      button per page. It works because it is rare. */}
                  <Link
                    ref={heroCtaRef}
                    to="/report"
                    className="btn btn-primary btn-lg magnetic"
                  >
                    Report an item
                  </Link>
                  <Link to="/items" className="btn btn-secondary btn-lg">
                    Browse items
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    ref={heroCtaRef}
                    to="/register"
                    className="btn btn-primary btn-lg magnetic"
                  >
                    Get started
                  </Link>
                  <Link to="/login" className="btn btn-secondary btn-lg">
                    I have an account
                  </Link>
                </>
              )}
            </div>

            <div className="hero-proof">
              <div className="hero-proof-item">
                <span className="hero-proof-value">
                  <span aria-hidden="true">{'\u{1F3EB}'}</span> College-only
                </span>
                <span className="hero-proof-label">Verified email required</span>
              </div>
              <div className="hero-proof-item">
                <span className="hero-proof-value">
                  <span aria-hidden="true">{'\u{1F512}'}</span> Private by default
                </span>
                <span className="hero-proof-label">Contact details never public</span>
              </div>
              <div className="hero-proof-item">
                <span className="hero-proof-value">
                  <span aria-hidden="true">{'\u{2705}'}</span> Owner-verified
                </span>
                <span className="hero-proof-label">The finder approves the claim</span>
              </div>
            </div>

            {isAuthenticated && (
              <p className="text-subtle" style={{ marginTop: 'var(--space-5)' }}>
                Signed in as <strong>{user?.name}</strong>
                {user?.institution?.name ? ` · ${user.institution.name}` : ''}
              </p>
            )}
          </div>

          {/* ============================================================
              EFFECT 5 — THE 3D SCENE

              .scene owns the perspective; .scene-stage rotates; each
              .scene-layer sits at its own translateZ so the layers
              separate as the stage turns. That separation is real
              perspective projection, not a simulation of it.

              aria-hidden: this is decoration. Everything it depicts is
              stated in the copy beside it, so announcing a fake item
              card to a screen reader would be noise at best and
              confusing at worst.
              ============================================================ */}
          <div ref={sceneRef} className="scene" aria-hidden="true">
            <div className="scene-stage">
              <div className="scene-shadow" />

              <div className="scene-layer" style={{ '--depth': '0px' }}>
                <article className="scene-card scene-card-main">
                  <div className="scene-card-photo">
                    <SmartImage
                      src={photo('studyDesk', 640)}
                      srcSet={photoSrcSet('studyDesk', [420, 640, 900])}
                      sizes="(max-width: 980px) 0px, 420px"
                      alt=""
                      aspect="16 / 10"
                    />
                  </div>

                  <div className="scene-card-head">
                    <span className="badge badge-found">Found</span>
                    <span className="badge badge-active">Active</span>
                  </div>

                  <h3 className="scene-card-title">Blue steel water bottle</h3>
                  <p className="scene-card-desc">
                    Dented cap, sticker on the base. Left on the third row in
                    Lecture Hall 3.
                  </p>

                  <div className="scene-card-meta">
                    <span>{'\u{1F4CD}'} Lecture Hall 3</span>
                    <span>2 days ago</span>
                  </div>
                </article>
              </div>

              {/* Satellite cards, pushed forward in Z so they detach from
                  the main card as the scene rotates. */}
              <div className="scene-layer scene-chip scene-chip-a" style={{ '--depth': '70px' }}>
                <span className="scene-chip-icon">{'\u{1F511}'}</span>
                <span>
                  <strong className="scene-chip-title">Keys returned</strong>
                  <span className="scene-chip-sub">Claim approved</span>
                </span>
              </div>

              <div className="scene-layer scene-chip scene-chip-b" style={{ '--depth': '104px' }}>
                <span className="scene-chip-icon">{'\u{1F50E}'}</span>
                <span>
                  <strong className="scene-chip-title">14 active reports</strong>
                  <span className="scene-chip-sub">Across campus</span>
                </span>
              </div>

              <div className="scene-layer scene-chip scene-chip-c" style={{ '--depth': '46px' }}>
                <span className="scene-chip-icon">{'\u{23F3}'}</span>
                <span>
                  <strong className="scene-chip-title">1 claim pending</strong>
                  <span className="scene-chip-sub">Awaiting review</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SEARCH BAND — overlaps the hero so it reads as the next step
          ================================================================ */}
      <div className="container search-band">
        <form className="search-band-inner" onSubmit={submitSearch} role="search">
          <label htmlFor="home-search" className="sr-only">
            Search reported items
          </label>

          <div className="search-band-field">
            <span className="search-band-icon" aria-hidden="true">
              {'\u{1F50D}'}
            </span>
            <input
              id="home-search"
              type="search"
              className="search-band-input"
              placeholder="Search for a wallet, ID card, charger, umbrella…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg">
            Search items
          </button>
        </form>
      </div>

      {/* ================================================================
          RECENTLY REPORTED
          ================================================================ */}
      <section className="section" ref={recentRef} style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head section-head-row reveal">
            <div>
              <h2>Recently reported</h2>
              <p className="text-muted">
                The latest items reported at your college.
              </p>
            </div>
            {isAuthenticated && (
              <Link to="/items" className="btn btn-secondary">
                View all
              </Link>
            )}
          </div>

          {/* Five explicit states: signed-out, loading, error, empty, data. */}
          {!isAuthenticated ? (
            <EmptyState
              photoName="emptyCampus"
              icon={'\u{1F510}'}
              title="Sign in to see reported items"
              message="Campus Lost & Found is private to verified college members, so listings only appear once you are signed in."
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
              photoName="emptyCampus"
              icon={'\u{1F4E6}'}
              title="Nothing reported yet"
              message="Be the first to file a report at your college — it takes less than a minute."
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

      {/* ================================================================
          HOW IT WORKS
          ================================================================ */}
      <section className="section section-subtle" ref={stepsRef}>
        <div className="container">
          <div className="section-head reveal">
            <h2>How it works</h2>
            <p className="text-muted">
              Three steps, built so items reach the people who actually own
              them.
            </p>
          </div>

          <div className="steps-grid">
            {STEPS.map((step, index) => (
              <article
                key={step.title}
                className="card card-hover reveal step-card-v2"
                style={{ '--reveal-delay': `${index * 90}ms` }}
              >
                <span className="step-ghost" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="step-icon-box" aria-hidden="true">
                  {step.icon}
                </span>
                <h3>{step.title}</h3>
                <p className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          TRUST & PRIVACY
          ================================================================ */}
      <section className="section" ref={trustRef}>
        <div className="container">
          <div className="split">
            <div className="split-media reveal">
              <SmartImage
                src={photo('quietLibrary', 900)}
                srcSet={photoSrcSet('quietLibrary', [560, 900, 1200])}
                sizes="(max-width: 900px) 100vw, 540px"
                alt={photoAlt('quietLibrary')}
                aspect="4 / 3"
              />
            </div>

            <div className="reveal" style={{ '--reveal-delay': '120ms' }}>
              <p className="eyebrow">
                <span aria-hidden="true">{'\u{1F6E1}\u{FE0F}'}</span>
                Trust &amp; privacy
              </p>

              <h2 style={{ marginTop: 'var(--space-4)' }}>
                Built so the wrong person cannot walk off with your things
              </h2>

              <p className="text-muted" style={{ marginTop: 'var(--space-4)' }}>
                A public lost-and-found board has an obvious problem: whoever
                claims first, wins. This one is designed the other way round.
              </p>

              <ul className="trust-list">
                {TRUST.map((entry) => (
                  <li key={entry.title} className="trust-item">
                    <span className="trust-icon" aria-hidden="true">
                      {entry.icon}
                    </span>
                    <div>
                      <h3>{entry.title}</h3>
                      <p>{entry.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          BROWSE BY CATEGORY
          ================================================================ */}
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

      {/* ================================================================
          FINAL CTA
          ================================================================ */}
      <section className="section" ref={ctaRef}>
        <div className="container">
          <div className="cta-photo reveal">
            <SmartImage
              src={photo('campusWalk', 1600)}
              srcSet={photoSrcSet('campusWalk', [960, 1280, 1920])}
              sizes="(max-width: 1180px) 100vw, 1140px"
              alt=""
              aspect="auto"
              className="cta-photo-bg"
            >
              {/* Flat: the copy spans the panel, so it must be dark
                  everywhere rather than only at the bottom. */}
              <div className="image-scrim image-scrim-panel" />
            </SmartImage>

            <div className="cta-photo-content">
              <div>
                <h2>Found something that is not yours?</h2>
                <p>
                  Ten minutes of your time can save someone their ID card,
                  their keys, or their laptop charger the night before a
                  deadline.
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
        </div>
      </section>
    </div>
  );
}
