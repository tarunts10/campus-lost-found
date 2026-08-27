/**
 * components/ScrollToTop.jsx
 *
 * A single-page app does not reload on navigation, so the browser keeps
 * the previous scroll position. Without this, clicking an item from
 * halfway down a list opens the detail page already scrolled past the
 * title.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
