/**
 * utils/constants.js — values that must match the backend enums exactly.
 *
 * These are duplicated from the backend Mongoose schemas. That
 * duplication is a real (if small) maintenance cost: adding a category
 * means editing two files. The alternative would be an endpoint that
 * serves the enums, which is not worth an extra request for a list that
 * changes once a year.
 *
 * If these ever drift, the backend wins — it rejects unknown values with
 * a 400, so a mismatch shows up immediately rather than corrupting data.
 */

export const ITEM_TYPES = ['LOST', 'FOUND'];

export const ITEM_STATUSES = ['ACTIVE', 'CLAIMED', 'RESOLVED'];

export const ITEM_CATEGORIES = [
  'ELECTRONICS',
  'ACCESSORIES',
  'DOCUMENTS',
  'CLOTHING',
  'KEYS',
  'BOOKS',
  'OTHER',
];

export const CLAIM_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

// Human-readable labels. The API speaks SCREAMING_CASE; people do not.
export const CATEGORY_LABELS = {
  ELECTRONICS: 'Electronics',
  ACCESSORIES: 'Accessories',
  DOCUMENTS: 'Documents',
  CLOTHING: 'Clothing',
  KEYS: 'Keys',
  BOOKS: 'Books',
  OTHER: 'Other',
};

export const CATEGORY_ICONS = {
  ELECTRONICS: '\u{1F4BB}',
  ACCESSORIES: '\u{1F45C}',
  DOCUMENTS: '\u{1F4C4}',
  CLOTHING: '\u{1F455}',
  KEYS: '\u{1F511}',
  BOOKS: '\u{1F4DA}',
  OTHER: '\u{1F4E6}',
};

// Matches the backend default of 10 per page.
export const PAGE_SIZE = 9;
