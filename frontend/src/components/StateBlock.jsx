/**
 * components/StateBlock.jsx — the empty and error states.
 *
 * Never leave a blank screen. Every API-driven view has four possible
 * outcomes (loading, success, empty, error) and the user should always
 * be told which one they are looking at, plus what they can do about it.
 *
 * EmptyState has two looks:
 *
 *   default   a quiet dashed panel. Right for "no results for this
 *             filter" — a routine, low-stakes outcome that should not
 *             be dressed up as an event.
 *
 *   photo     a full photographic panel, used where the empty state is
 *             the ONLY thing on screen (a signed-out home page, a
 *             brand-new institution with nothing reported). Those are
 *             first impressions, and a dashed grey box is a poor one.
 *
 * The photograph is atmosphere — a campus, not an item. See the rule at
 * the top of utils/media.js.
 */

import SmartImage from './SmartImage.jsx';
import { photo, photoSrcSet } from '../utils/media.js';

export function EmptyState({
  icon = '\u{1F50D}',
  title,
  message,
  action,
  photoName,
}) {
  if (photoName) {
    return (
      <div className="state-block state-block-photo">
        <SmartImage
          src={photo(photoName, 1280)}
          srcSet={photoSrcSet(photoName, [640, 960, 1280, 1600])}
          sizes="(max-width: 900px) 100vw, 1100px"
          alt=""
          aspect="auto"
          className="state-photo-bg"
        >
          {/* Flat, not a gradient: this panel centres its text, so a
              top-light gradient would leave the heading under-darkened. */}
          <div className="image-scrim image-scrim-panel" />
        </SmartImage>

        <div className="state-photo-inner">
          <div className="state-icon" aria-hidden="true">
            {icon}
          </div>
          <h3>{title}</h3>
          {message && <p>{message}</p>}
          {action}
        </div>
      </div>
    );
  }

  return (
    <div className="state-block">
      <div className="state-icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state-block" role="alert">
      <div className="state-icon" aria-hidden="true">
        {'⚠️'}
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
