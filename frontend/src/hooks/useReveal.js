/**
 * hooks/useReveal.js — EFFECT 6: entrance reveals.
 *
 * Returns a ref. Attach it to an element carrying the `reveal` class, or
 * to a container whose descendants carry it, and they fade and slide in
 * the first time the element enters the viewport.
 *
 * WHY IntersectionObserver RATHER THAN SCROLL LISTENERS:
 * a scroll handler fires dozens of times per second and forces layout
 * every time it measures an element. IntersectionObserver is handled by
 * the browser off the main thread and calls back only when visibility
 * actually changes. It is the difference between smooth and janky.
 *
 * ==============  WHY THIS IS A CALLBACK REF  ==============
 *
 * The obvious implementation is useRef + useEffect reading ref.current.
 * That version has a failure mode that is invisible until it bites, and
 * when it bites it hides an entire page:
 *
 *   useEffect runs ONCE after mount. If the element it wants is behind
 *   a conditional that is still false at that moment — the extremely
 *   common `if (loading) return <Loader/>` — then ref.current is null,
 *   the effect returns early, and it never runs again because its
 *   dependencies never change. The element appears a moment later when
 *   the fetch resolves, still carrying `.reveal`, and therefore still
 *   at opacity: 0.
 *
 *   The result is a page that renders perfectly in the DOM, passes
 *   every "is the content there?" check, and shows the user nothing.
 *
 * A callback ref is called by React whenever the node is attached or
 * detached, so it fires the moment the element actually exists — which
 * is precisely the guarantee this needs. It also handles the element
 * being swapped out (entering edit mode, say) for free.
 */

import { useCallback, useEffect, useRef } from 'react';

export function useReveal({ threshold = 0.15, once = true } = {}) {
  const observerRef = useRef(null);

  /**
   * `threshold` and `once` go straight into the dependency array rather
   * than through a ref.
   *
   * Mirroring them into a ref during render also works, but writing to a
   * ref during render is exactly what React's own guidance (and the
   * linter) warns against — it is a side effect in the render phase, and
   * it is only safe here by accident of these values being primitives.
   *
   * Both are numbers/booleans, so the callback identity is stable across
   * renders anyway, and React only re-attaches the ref if they genuinely
   * change — which is the behaviour we want.
   */

  const disconnect = () => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  };

  const setNode = useCallback((element) => {
    disconnect();

    // React passes null when the node is detached.
    if (!element) return;

    /**
     * The ref may be attached in one of two ways, and both must work:
     *
     *   1. directly ON an element that has the `reveal` class
     *      (ItemCard does this)
     *   2. on a CONTAINER whose descendants carry `reveal`
     *      (page sections do this, so a whole section staggers in
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

    const show = () =>
      targets().forEach((node) => node.classList.add('is-visible'));

    // If motion is reduced, show the content immediately. Never leave it
    // stuck invisible because the animation was disabled.
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (reducedMotion) {
      show();
      return;
    }

    /**
     * NO IntersectionObserver, NO HIDING.
     *
     * If the API is missing the observer can never fire, and every
     * `.reveal` element would sit at opacity: 0 forever — a blank page.
     * An un-animated page is a minor loss; an invisible one is a broken
     * product, so the failure mode has to be "shows immediately".
     */
    if (typeof IntersectionObserver === 'undefined') {
      show();
      return;
    }

    /**
     * ALREADY IN VIEW ON ATTACH.
     *
     * IntersectionObserver does fire an initial callback for an element
     * that is already visible, but only on the next frame. For content
     * that appears above the fold after a fetch resolves, that is a
     * visible flash of nothing. Checking the rect synchronously here
     * removes it, and the observer below still covers everything else.
     */
    const rect = element.getBoundingClientRect();
    const alreadyVisible =
      rect.top < window.innerHeight && rect.bottom > 0 && rect.height > 0;

    if (alreadyVisible && once) {
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
    observerRef.current = observer;
  }, [threshold, once]);

  // Belt and braces: tear the observer down if the component unmounts
  // without React having called the ref with null first.
  useEffect(() => disconnect, []);

  return setNode;
}
