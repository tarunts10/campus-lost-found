/**
 * hooks/useTilt.js — EFFECT 5: 3D motion.
 *
 * Tilts an element toward the pointer, so a flat card behaves like a
 * physical object catching the light.
 *
 * Sets two CSS custom properties, --tilt-x and --tilt-y, which the
 * `.tilt` class in components.css consumes. Doing it through custom
 * properties keeps the transform declaration in CSS where the rest of
 * the design system lives.
 *
 * `max` is capped low (6 degrees by default). Beyond roughly 10 the
 * effect stops reading as depth, starts looking like a gimmick, and
 * makes the text inside noticeably harder to read.
 */

import { useEffect, useRef } from 'react';

export function useTilt(max = 6) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    // Touch devices have no hover state, so a tilt would either never
    // fire or fire once and stick.
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    if (reducedMotion || !finePointer) return;

    let frame = null;

    const onMove = (event) => {
      if (frame !== null) return;

      frame = requestAnimationFrame(() => {
        frame = null;
        const rect = element.getBoundingClientRect();

        // Pointer position as -0.5 .. 0.5 relative to the element centre.
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;

        // Y position drives rotateX and is negated so moving the pointer
        // up tips the top of the card away, like pressing a real object.
        element.style.setProperty('--tilt-x', `${-py * max}deg`);
        element.style.setProperty('--tilt-y', `${px * max}deg`);
      });
    };

    const onLeave = () => {
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
    };

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);

    return () => {
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [max]);

  return ref;
}
