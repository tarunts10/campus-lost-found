/**
 * components/ThemeToggle.jsx — one button, cycling light -> dark -> system.
 *
 * ACCESSIBILITY NOTES:
 *   - the icon is aria-hidden; the state is announced through the
 *     accessible name, because an emoji alone tells a screen reader user
 *     nothing useful
 *   - aria-live announces the change after it happens
 *   - title gives sighted mouse users the same information on hover
 */

import { useTheme } from '../context/ThemeContext.jsx';

const LABELS = {
  light: { icon: '☀', name: 'Light', next: 'dark' },
  dark: { icon: '☾', name: 'Dark', next: 'system' },
  system: { icon: '◐', name: 'System', next: 'light' },
};

export default function ThemeToggle() {
  const { theme, resolved, cycleTheme } = useTheme();

  const current = LABELS[theme] ?? LABELS.system;

  // For "system", say which theme it actually resolved to — otherwise
  // "System" alone leaves the user guessing what they are looking at.
  const description =
    theme === 'system' ? `System (currently ${resolved})` : current.name;

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycleTheme}
      title={`Theme: ${description}. Click to switch to ${current.next}.`}
      aria-label={`Theme: ${description}. Switch to ${current.next} theme.`}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {current.icon}
      </span>
      <span className="theme-toggle-text">{current.name}</span>
      <span className="sr-only" role="status" aria-live="polite">
        {description} theme active
      </span>
    </button>
  );
}
