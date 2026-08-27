/**
 * hooks/useReveal.js — EFFECT 6: entrance reveals.
 *
 * Returns a ref. Attach it to an element with the `reveal` class and the
 * element fades and slides in the first time it enters the viewport.
 *
 * WHY IntersectionObserver RATHER THAN SCROLL LISTENERS:
 * a scroll handler fires dozens of times per second and forces layout
 * every time it measures an element. IntersectionObserver is handled by
 * the browser off the main thread and calls back only when visibility
 * actually changes. It is the difference between smooth and janky.
 */

import { useEffect, useRef } from 'react';

export function useReveal({ threshold = 0.15, once = true } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If motion is reduced, show the content immediately. Never leave it
    // stuck invisible because the animation was disabled.
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    /**
     * The ref may be attached in one of two ways, and both must work:
     *
     *   1. directly ON an element that has the `reveal` class
     *      (ItemCard does this)
     *   2. on a CONTAINER whose descendants carry `reveal`
     *      (HomePage sections do this, so a whole section staggers in
     *      together when it scrolls into view)
     *
     * Marking only the observed element handles case 1 but silently
     * breaks case 2 — the children stay at opacity 0 forever, which
     * makes the content invisible rather than merely un-animated.
     */
    const targets = () => {
      const found = [...element.querySelectorAll('.reveal')];
      if (element.classList.contains('reveal')) found.push(element);
      return found;
    };

    const show = () => targets().forEach((node) => node.classList.add('is-visible'));

    if (reducedMotion) {
      show();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            show();
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            targets().forEach((node) => node.classList.remove('is-visible'));
          }
        });
      },
      { threshold, rootMargin: '0px 0px -60px 0px' }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, once]);

  return ref;
}
