/**
 * utils/format.js — display helpers.
 */

/**
 * The API returns ISO strings ("2026-08-25T00:00:00.000Z").
 * People read "25 Aug 2026".
 */
export const formatDate = (value) => {
  if (!value) return 'Unknown';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/** "2 days ago" reads faster than a date when scanning a list. */
export const formatRelative = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return formatDate(value);
};

/** <input type="date"> requires exactly YYYY-MM-DD. */
export const toDateInputValue = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
};

export const todayInputValue = () => new Date().toISOString().slice(0, 10);

/** Sentence case from SCREAMING_CASE, for badges. */
export const titleCase = (value) =>
  typeof value === 'string'
    ? value.charAt(0) + value.slice(1).toLowerCase()
    : '';

/**
 * Compare a Mongo ObjectId that may arrive as a string OR as a populated
 * object. GET /api/items/:id populates reportedBy into { _id, name, role },
 * while a freshly created item returns it as a bare id string. Both must
 * compare correctly against the logged-in user.
 */
export const idOf = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

export const sameId = (a, b) => {
  const left = idOf(a);
  const right = idOf(b);
  return Boolean(left && right && left === right);
};
