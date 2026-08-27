/**
 * components/ItemCard.jsx — one item in a grid.
 *
 * Carries three of the six effects at once:
 *   1. hover  — lift, shadow, and title colour shift (.card-hover)
 *   5. 3D     — pointer-following tilt (useTilt + .tilt)
 *   6. reveal — fades in when scrolled into view (useReveal + .reveal)
 *
 * The whole card is a <Link>, so it is one keyboard tab stop with a real
 * focus ring, rather than a div with an onClick that keyboard users
 * cannot reach.
 */

import { Link } from 'react-router-dom';
import Badge from './Badge.jsx';
import { useReveal } from '../hooks/useReveal.js';
import { useTilt } from '../hooks/useTilt.js';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../utils/constants.js';
import { formatDate, formatRelative } from '../utils/format.js';

export default function ItemCard({ item, index = 0 }) {
  const revealRef = useReveal();
  const tiltRef = useTilt(5);

  // Stagger the reveal so a grid cascades in rather than appearing as
  // one block. Capped so late rows do not sit blank for a noticeable time.
  const delay = `${Math.min(index * 60, 360)}ms`;

  const reporterName = item.reportedBy?.name;

  return (
    <div
      ref={revealRef}
      className="reveal tilt-wrap"
      style={{ '--reveal-delay': delay }}
    >
      <Link
        ref={tiltRef}
        to={`/items/${item._id}`}
        className="card card-hover tilt item-card"
        aria-label={`${item.type === 'LOST' ? 'Lost' : 'Found'} item: ${item.title}`}
      >
        <div className="item-card-top">
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <span aria-hidden="true" style={{ fontSize: '1.25rem' }}>
              {CATEGORY_ICONS[item.category] || '\u{1F4E6}'}
            </span>
            <Badge value={item.type} />
          </div>
          <Badge value={item.status} />
        </div>

        <h3>{item.title}</h3>
        <p className="item-card-desc">{item.description}</p>

        <div className="item-card-meta">
          <span>
            {'\u{1F4CD}'} {item.location}
          </span>
          <span>{formatDate(item.date)}</span>
        </div>

        <div className="item-card-meta" style={{ borderTop: 'none', paddingTop: 0 }}>
          <span>{CATEGORY_LABELS[item.category] || item.category}</span>
          {/*
            reportedBy is null for legacy records created before
            authentication existed. Guarding rather than assuming keeps
            the card from crashing on old data.
          */}
          <span>
            {reporterName ? `by ${reporterName}` : 'Reporter unknown'} ·{' '}
            {formatRelative(item.createdAt)}
          </span>
        </div>
      </Link>
    </div>
  );
}
