/**
 * components/RouteProgress.jsx — EFFECT 4: page transition feedback.
 *
 * A thin bar across the top on navigation. It is deliberately brief and
 * non-blocking: the new page renders immediately underneath, so this is
 * a cue that something happened, not a gate that makes people wait.
 *
 * Re-mounted via a changing key so the CSS animation replays on every
 * route change.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function RouteProgress() {
  const location = useLocation();
  const [key, setKey] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setKey((value) => value + 1);
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!visible) return null;

  return <div key={key} className="route-progress" aria-hidden="true" />;
}
