/**
 * hooks/useDocumentTitle.js — set the browser tab title per page.
 *
 * Small, but it matters for accessibility: screen readers announce the
 * document title on navigation, and it is how a user tells one open tab
 * from another.
 */

import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title
      ? `${title} · Campus Lost & Found`
      : 'Campus Lost & Found';
  }, [title]);
}
