/**
 * hooks/useScene3D.js — EFFECT 5: the 3D hero scene.
 *
 * ==================  WHY NOT WebGL / THREE.JS  ==================
 *
 * The obvious way to "add 3D" is react-three-fiber. It was considered
 * and rejected for this hero, deliberately:
 *
 *   COST     three + @react-three/fiber is roughly 150KB gzipped on
 *            top of a 108KB bundle. That is not a rounding error; it
 *            more than doubles what a phone downloads before the page
 *            is interactive.
 *   RISK     WebGL needs a fallback path — blocked contexts, software
 *            rendering, older integrated GPUs, and browsers that have
 *            blacklisted a driver. That fallback has to be designed
 *            and maintained, and it is what most users on weak
 *            hardware would actually see.
 *   BENEFIT  the hero needs layered depth and parallax response. It
 *            does not need lighting, materials, geometry or a render
 *            loop.
 *
 * CSS 3D transforms give real perspective projection, composited on the
 * GPU, in every browser this app supports, for 0KB and with no fallback
 * to maintain. `perspective` + `translateZ` is genuinely 3D — the
 * layers project correctly and parallax against each other as the scene
 * rotates. It is the right tool for depth; three.js is the right tool
 * for a scene, and this is not a scene.
 *
 * ==========================  WHAT IT DOES  ==========================
 *
 * Tracks the pointer across the whole hero and writes two custom
 * properties, --scene-rx and --scene-ry, onto the container. CSS in
 * app.css rotates the 3D stage by those angles; each layer inside sits
 * at a different translateZ, so they separate as the stage turns.
 *
 * A gentle idle drift runs when the pointer is absent, so the scene is
 * alive on load and on touch devices rather than sitting flat until
 * someone happens to hover it.
 */

import { useEffect, useRef } from 'react';

export function useScene3D({ max = 10, idle = true } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reduced motion: leave the scene flat and static. The layers still
    // read as stacked because they carry their own shadows and offsets,
    // so nothing is lost except the movement.
    if (reducedMotion) {
      element.style.setProperty('--scene-rx', '0deg');
      element.style.setProperty('--scene-ry', '0deg');
      return;
    }

    const finePointer = window.matchMedia('(pointer: fine)').matches;

    let frame = null;
    let idleFrame = null;
    let pointerActive = false;

    const write = (rx, ry) => {
      element.style.setProperty('--scene-rx', `${rx.toFixed(2)}deg`);
      element.style.setProperty('--scene-ry', `${ry.toFixed(2)}deg`);
    };

    /* ---------------------------------------------- pointer control */

    const onMove = (event) => {
      if (!finePointer) return;
      pointerActive = true;

      if (frame !== null) return;

      frame = requestAnimationFrame(() => {
        frame = null;

        const rect = element.getBoundingClientRect();

        // -0.5 .. 0.5 relative to the centre of the scene.
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;

        // rotateX is negated so moving the pointer up tips the top of
        // the scene away from the viewer, which is how a physical
        // object responds.
        write(-py * max, px * max);
      });
    };

    const onLeave = () => {
      pointerActive = false;
    };

    /* ------------------------------------------------- idle drift */

    /**
     * A slow figure-of-eight, well under half the pointer amplitude.
     *
     * This exists so the scene does not sit dead on a touch device or
     * before the pointer arrives. It is deliberately slow (a full cycle
     * takes ~18 seconds) — anything faster reads as a distraction next
     * to the headline copy, which is the thing people are meant to be
     * reading.
     */
    const start = performance.now();

    const drift = (now) => {
      idleFrame = requestAnimationFrame(drift);

      if (pointerActive) return;

      const t = (now - start) / 1000;
      write(Math.sin(t / 3) * max * 0.28, Math.cos(t / 4.5) * max * 0.34);
    };

    if (idle) idleFrame = requestAnimationFrame(drift);
    else write(0, 0);

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);

    return () => {
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
      if (frame !== null) cancelAnimationFrame(frame);
      if (idleFrame !== null) cancelAnimationFrame(idleFrame);
    };
  }, [max, idle]);

  return ref;
}
