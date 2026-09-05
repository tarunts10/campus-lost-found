/**
 * components/ItemCard.jsx — one item in a grid.
 *
 * Carries three of the six effects at once:
 *   1. hover  — lift, shadow, image zoom, title colour shift
 *   5. 3D     — pointer-following tilt (useTilt + .tilt)
 *   6. reveal — fades in when scrolled into view, staggered by index
 *
 * The whole card is a <Link>, so it is one keyboard tab stop with a real
 * focus ring, rather than a div with an onClick that keyboard users
 * cannot reach.
 *
 * ================  THE "NO PHOTO" DECISION  ================
 *
 * Most reports have no photograph. That state used to be a dashed box
 * reading "NO PHOTO", which made a perfectly good report look like a
 * broken record — and made the grid look unfinished.
 *
 * It is now a generated artwork panel: a category-keyed gradient with
 * the category glyph. Deliberately SYNTHETIC rather than a stock photo,
 * because a photograph here would imply the item looks like the
 * photograph. Someone might scroll past their own lost wallet because
 * the picture was not theirs. See utils/media.js.
 */

import { Link } from 'react-router-dom';
import Badge from './Badge.jsx';
import SmartImage from './SmartImage.jsx';
import { useReveal } from '../hooks/useReveal.js';
import { useTilt } from '../hooks/useTilt.js';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '../utils/constants.js';
import { categoryArtwork } from '../utils/media.js';
import { formatDate, formatRelative } from '../utils/format.js';

export default function ItemCard({ item, index = 0 }) {
  const revealRef = useReveal();
  const tiltRef = useTilt(5);

  // Stagger the reveal so a grid cascades in rather than appearing as
  // one block. Capped so late rows do not sit blank for a noticeable time.
  const delay = `${Math.min(index * 60, 360)}ms`;

  const reporterName = item.reportedBy?.name;
  const art = categoryArtwork(item.category);
  const hasPhoto = item.images?.length > 0;

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
        {/*
          Every card gets a media area, photo or not, so the whole grid
          shares one silhouette and rows line up regardless of which
          reports happen to have images.
        */}
        {hasPhoto ? (
          <div className="item-card-thumb">
            <SmartImage
              src={item.images[0].url}
              /* Real alt text: the item's title describes the picture
                 far better than the uploaded filename does. */
              alt={item.title}
              aspect="16 / 9"
            />
            {item.images.length > 1 && (
              <span className="item-card-thumb-count">
                +{item.images.length - 1}
                <span className="sr-only"> more photos</span>
              </span>
            )}
          </div>
        ) : (
          <div
            className="item-card-thumb item-card-art"
            style={{ '--art-from': art.from, '--art-to': art.to }}
            aria-hidden="true"
          >
            <span className="item-card-art-glyph">{art.glyph}</span>
            <span className="item-card-art-label">
              {CATEGORY_LABELS[item.category] || 'Item'}
            </span>
          </div>
        )}

        <div className="item-card-top">
          <div className="row" style={{ gap: 'var(--space-2)' }}>
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
          <span>
            {CATEGORY_ICONS[item.category] || '\u{1F4E6}'}{' '}
            {CATEGORY_LABELS[item.category] || item.category}
          </span>
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
