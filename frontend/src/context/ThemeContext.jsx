/**
 * context/ThemeContext.jsx — light / dark / system theme.
 *
 * THREE states, not two. "System" is a real choice, distinct from
 * light and dark: it means "follow whatever the OS is doing", so a
 * user whose laptop switches to dark at sunset gets that for free.
 *
 * How the choice is applied:
 *   'light' | 'dark'  -> stamp data-theme on <html>, overriding the OS
 *   'system'          -> REMOVE the attribute, so the
 *                        prefers-color-scheme media query in tokens.css
 *                        decides
 *
 * The initial value is read and applied by an inline script in
 * index.html BEFORE React mounts, which is what prevents a flash of the
 * wrong theme. This context takes over afterwards.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'clf_theme';
const THEMES = ['light', 'dark', 'system'];

const ThemeContext = createContext(null);

const readStoredTheme = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : 'system';
  } catch {
    // Private browsing can throw on access.
    return 'system';
  }
};

/** What the user actually SEES, once 'system' is resolved. */
const resolveTheme = (choice) => {
  if (choice !== 'system') return choice;

  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
};

const applyTheme = (choice) => {
  const root = document.documentElement;

  if (choice === 'system') {
    // No attribute -> the media query in tokens.css takes over.
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', choice);
  }
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);
  const [resolved, setResolved] = useState(() => resolveTheme(readStoredTheme()));

  // Apply and persist whenever the choice changes.
  useEffect(() => {
    applyTheme(theme);
    setResolved(resolveTheme(theme));

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable — the theme still applies for this session */
    }
  }, [theme]);

  /**
   * While on 'system', follow live OS changes.
   *
   * Without this listener the page would keep the theme it had at load
   * and only correct itself on refresh.
   */
  useEffect(() => {
    if (theme !== 'system') return;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(query.matches ? 'dark' : 'light');

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (THEMES.includes(next)) setThemeState(next);
  }, []);

  /**
   * Cycle light -> dark -> system -> light.
   *
   * One button rather than three: the header has limited room, and the
   * current state is always shown by the icon and the accessible label.
   */
  const cycleTheme = useCallback(() => {
    setThemeState((current) => {
      const index = THEMES.indexOf(current);
      return THEMES[(index + 1) % THEMES.length];
    });
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, cycleTheme }),
    [theme, resolved, setTheme, cycleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }

  return context;
}
