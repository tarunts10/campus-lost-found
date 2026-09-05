/**
 * hooks/useMagnetic.js — EFFECT 3, second half: magnetic CTAs.
 *
 * The custom cursor (CustomCursor.jsx) makes the pointer react to the
 * page. This is the other direction: the page reacts to the pointer.
 * An important button drifts a few pixels toward the cursor as it
 * approaches, so it feels like it wants to be pressed.
 *
 * WHY IT IS APPLIED TO ALMOST NOTHING
 *
 * Two or three buttons on the whole site. The effect works because it
 * is rare — if every button moved, the page would feel unstable and
 * clicking anything would become a small chase. It is reserved for the
 * primary call to action.
 *
 * WHY THE MOVEMENT IS CLAMPED SO HARD
 *
 * `strength` is the fraction of the distance to the pointer the element
 * travels, and `max` caps the result in pixels. A button that moves
 * more than ~10px genuinely becomes harder to click: the pointer
 * arrives where the button was, not where it now is. This is the exact
 * point where the effect stops being delightful and starts being a
 * usability defect, so the cap is not negotiable.
 *
 * DISABLED ENTIRELY on touch (no hover to respond to) and under
 * prefers-reduced-motion.
 */

import { useEffect, useRef } from 'react';

export function useMagnetic({ strength = 0.28, max = 9, radius = 90 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    if (reducedMotion || !finePointer) return;

    let frame = null;

    const reset = () => {
      element.style.setProperty('--magnet-x', '0px');
      element.style.setProperty('--magnet-y', '0px');
    };

    const onMove = (event) => {
      if (frame !== null) return;

      frame = requestAnimationFrame(() => {
        frame = null;

        const rect = element.getBoundingClientRect();
        const centreX = rect.left + rect.width / 2;
        const centreY = rect.top + rect.height / 2;

        const dx = event.clientX - centreX;
        const dy = event.clientY - centreY;

        /**
         * The magnetic field extends `radius` pixels BEYOND the
         * element's own box. Reacting only once the pointer is already
         * inside would be pointless — the button is hovered by then and
         * the movement would be a distraction rather than an invitation.
         */
        const reach = Math.max(rect.width, rect.height) / 2 + radius;
        const distance = Math.hypot(dx, dy);

        if (distance > reach) {
          reset();
          return;
        }

        // Falls off toward the edge of the field, so the button eases
        // back rather than snapping when the pointer leaves.
        const falloff = 1 - distance / reach;

        const clamp = (value) => Math.max(-max, Math.min(max, value));

        element.style.setProperty('--magnet-x', `${clamp(dx * strength * falloff)}px`);
        element.style.setProperty('--magnet-y', `${clamp(dy * strength * falloff)}px`);
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    element.addEventListener('pointerleave', reset);

    return () => {
      window.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', reset);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [strength, max, radius]);

  return ref;
}
