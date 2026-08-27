/**
 * components/CustomCursor.jsx — EFFECT 3: cursor.
 *
 * A small dot that tracks the pointer exactly, plus a larger ring that
 * trails behind with easing. The lag is what makes it feel physical
 * rather than like a second mouse pointer.
 *
 * DESKTOP ONLY, and strictly so. On a touch device there is no pointer
 * to follow, and hiding the real cursor would be actively harmful. The
 * component renders nothing at all unless the device reports a fine
 * pointer AND the user has not asked for reduced motion.
 *
 * The ring grows and fills when the pointer is over anything
 * interactive, so the cursor itself communicates "this is clickable".
 */

import { useEffect, useRef, useState } from 'react';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const evaluate = () => setEnabled(finePointer.matches && !reducedMotion.matches);

    evaluate();
    finePointer.addEventListener('change', evaluate);
    reducedMotion.addEventListener('change', evaluate);

    return () => {
      finePointer.removeEventListener('change', evaluate);
      reducedMotion.removeEventListener('change', evaluate);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.body.classList.remove('has-custom-cursor');
      return;
    }

    document.body.classList.add('has-custom-cursor');

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let ringX = pointerX;
    let ringY = pointerY;
    let frame;

    const onMove = (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;

      // The dot is written directly, with no easing, so it stays exactly
      // under the physical pointer. Anything else feels broken.
      dot.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
    };

    /**
     * The ring eases toward the pointer: each frame it closes 18% of the
     * remaining gap. That exponential approach is cheap and gives a
     * natural deceleration without any physics maths.
     */
    const animate = () => {
      ringX += (pointerX - ringX) * 0.18;
      ringY += (pointerY - ringY) * 0.18;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      frame = requestAnimationFrame(animate);
    };

    /**
     * Grow the ring over interactive elements.
     *
     * Uses event delegation with closest() rather than attaching
     * listeners to every button, so elements added later (a modal, a new
     * list) work with no extra wiring.
     */
    const onOver = (event) => {
      const interactive = event.target.closest(
        'a, button, input, select, textarea, [role="button"]'
      );
      ring.classList.toggle('is-active', Boolean(interactive));
    };

    // Hide entirely when the pointer leaves the window, so the dot does
    // not sit frozen at the edge of the screen.
    const onLeave = () => {
      dot.style.opacity = '0';
      ring.style.opacity = '0';
    };

    const onEnter = () => {
      dot.style.opacity = '1';
      ring.style.opacity = '1';
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointerenter', onEnter);
    frame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerenter', onEnter);
      cancelAnimationFrame(frame);
      document.body.classList.remove('has-custom-cursor');
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
