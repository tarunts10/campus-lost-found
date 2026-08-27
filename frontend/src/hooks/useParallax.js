/**
 * hooks/useParallax.js — EFFECT 2: parallax.
 *
 * Moves an element more slowly than the page scrolls, which the eye
 * reads as depth.
 *
 * RESTRAINT IS THE WHOLE POINT. `speed` is a small fraction (0.15 means
 * the element moves at 15% of scroll speed). Larger values make the page
 * feel like it is fighting the scroll wheel, which is uncomfortable and
 * a common accessibility complaint.
 *
 * The update runs inside requestAnimationFrame so the transform is
 * written once per frame, in sync with the browser's paint, rather than
 * on every one of the many scroll events fired per frame.
 */

import { useEffect, useRef } from 'react';

export function useParallax(speed = 0.15) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    // Parallax is one of the effects most likely to cause motion
    // sickness. If the user asked for less motion, do nothing at all.
    if (reducedMotion) return;

    let frame = null;

    const update = () => {
      frame = null;
      const offset = window.scrollY * speed;
      element.style.transform = `translate3d(0, ${offset}px, 0)`;
    };

    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [speed]);

  return ref;
}
