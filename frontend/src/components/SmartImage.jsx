/**
 * components/SmartImage.jsx — EFFECT 4: image loading, done properly.
 *
 * A plain <img> has two ugly failure modes on a real network:
 *
 *   1. it pops in abruptly when it decodes, shifting the eye
 *   2. if it 404s or the host is blocked, the browser draws its own
 *      broken-image glyph — the single most "unfinished" thing a page
 *      can show
 *
 * This component fixes both:
 *
 *   - the slot is painted with a themed gradient FIRST, so there is
 *     never a blank or white box
 *   - the photo fades over it once decoded
 *   - if it fails, the gradient simply stays. The layout is identical,
 *     nothing jumps, and the page still looks deliberate
 *
 * That last point is what makes depending on an external image CDN
 * acceptable: the failure mode is "no photograph", not "broken page".
 *
 * `aspect` reserves the box before the image arrives, which is what
 * keeps Cumulative Layout Shift at zero.
 */

import { useState } from 'react';

export default function SmartImage({
  src,
  srcSet,
  sizes,
  alt = '',
  aspect = '16 / 9',
  className = '',
  eager = false,
  objectFit = 'cover',
  children,
}) {
  const [state, setState] = useState('loading'); // loading | loaded | failed

  /**
   * A decorative image (alt === '') is hidden from assistive technology.
   * Announcing "image" for a background texture is noise; an empty alt
   * plus aria-hidden is the correct way to say "skip this".
   */
  const decorative = alt === '';

  return (
    <div
      className={`smart-image is-${state} ${className}`.trim()}
      style={{ aspectRatio: aspect }}
      data-fit={objectFit}
    >
      {src && state !== 'failed' && (
        <img
          src={src}
          srcSet={srcSet || undefined}
          sizes={sizes || undefined}
          alt={alt}
          aria-hidden={decorative ? 'true' : undefined}
          /**
           * loading="lazy" keeps off-screen photographs out of the
           * initial page load entirely. `eager` opts the hero out,
           * because lazy-loading the largest visible image is a
           * measurable regression in perceived speed.
           *
           * decoding="async" lets the browser decode off the main
           * thread, so a large photo cannot stall scrolling.
           */
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : 'auto'}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
        />
      )}

      {/* Overlays: captions, badges, gradients scrims. */}
      {children}
    </div>
  );
}
