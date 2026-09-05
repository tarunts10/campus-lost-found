/**
 * components/Lightbox.jsx — full-size view of an item photo.
 *
 * Item photos are the evidence in a lost-and-found. A 400px thumbnail
 * is often not enough to recognise a scratch, a keyring, or a sticker,
 * so being able to open one properly is a functional need rather than a
 * flourish.
 *
 * Same accessibility contract as ConfirmDialog:
 *   - role="dialog" + aria-modal
 *   - Escape closes
 *   - focus moves in on open and returns to the trigger on close
 *   - body scroll is locked underneath
 *
 * Arrow keys step between photos, because that is what people try.
 */

import { useCallback, useEffect, useRef } from 'react';

export default function Lightbox({ images, index, onClose, onNavigate, title }) {
  const closeRef = useRef(null);
  const returnFocusRef = useRef(null);

  const image = images?.[index];

  const handleKey = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (images.length < 2) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNavigate((index + 1) % images.length);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onNavigate((index - 1 + images.length) % images.length);
      }
    },
    [images, index, onClose, onNavigate]
  );

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;

      const previous = returnFocusRef.current;
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [handleKey]);

  if (!image) return null;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${images.length}${title ? ` for ${title}` : ''}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        ref={closeRef}
        type="button"
        className="lightbox-close"
        onClick={onClose}
        aria-label="Close photo"
      >
        {'✕'}
      </button>

      <img src={image.url} alt={title ? `${title} — photo ${index + 1}` : image.name} />

      {images.length > 1 && (
        <p className="lightbox-caption">
          {index + 1} of {images.length} · use the arrow keys to move between
          photos
        </p>
      )}
    </div>
  );
}
