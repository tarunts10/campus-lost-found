/**
 * utils/media.js — editorial photography, and the rules about where it may be used.
 *
 * ==========================  THE RULE  ==========================
 *
 * Photographs in this file are ATMOSPHERE. They illustrate the product:
 * a hero, a section header, the panel beside a login form.
 *
 * They are NEVER used to represent a real lost or found item.
 *
 * That distinction matters more than it might look. A stock photo of a
 * wallet sitting on an item card would be a lie: the user would read it
 * as "this is the wallet that was found". Item imagery comes from one
 * place only — a photo a real member uploaded through ImageKit. When a
 * report has no photo, the card shows a generated graphic (see
 * categoryArtwork below), not a photograph.
 *
 * ======================  WHY A CDN, NOT FILES  ======================
 *
 * These could be committed as local assets. They are not, because:
 *   - a dozen full-width photographs is several megabytes in Git, which
 *     is the wrong thing to put in a repository forever
 *   - Unsplash's CDN does the format negotiation and resizing for us,
 *     so a phone downloads a 640px WebP instead of a 2400px JPEG
 *
 * The cost, stated plainly: the marketing imagery depends on a third
 * party. That is why every use goes through <SmartImage>, which keeps
 * its own themed gradient underneath. If images.unsplash.com is blocked
 * or slow, the page still looks deliberate — it just loses the photo.
 * Nothing functional depends on any of this.
 *
 * ======================  WHY THESE PARAMETERS  ======================
 *
 *   auto=format  serve WebP/AVIF to browsers that accept it
 *   fit=crop     crop to the box rather than letterboxing
 *   q=<n>        quality; 65-72 is indistinguishable at these sizes
 *   w=<n>        the actual pixel width requested
 *
 * Width is always specified. Omitting it serves the original, which for
 * these photographs is 3-5MB — the single easiest way to make a fast
 * site feel slow on a phone.
 */

const CDN = 'https://images.unsplash.com';

/**
 * Build one URL at a given width.
 * Kept private: callers use `photo()` or `photoSrcSet()` instead.
 */
const url = (id, width, quality = 70) =>
  `${CDN}/${id}?auto=format&fit=crop&w=${width}&q=${quality}`;

/**
 * The photograph library.
 *
 * Every entry carries its own alt text. Alt lives WITH the image rather
 * than at each call site, because the same photo used in three places
 * should not be described three different ways — and because a call
 * site that forgets it produces an unlabelled image for screen readers.
 *
 * `alt: ''` marks a photo as decorative. Those are rendered with an
 * empty alt and aria-hidden, which is correct: describing a background
 * texture to a screen reader is noise, not access.
 */
export const PHOTOS = {
  /* --- Landing hero ------------------------------------------------- */
  campusWalk: {
    id: 'photo-1541339907198-e08756dedf3f',
    alt: '',
    tone: 'cool',
  },
  lectureHall: {
    id: 'photo-1523240795612-9a054b0db644',
    alt: '',
    tone: 'warm',
  },
  libraryShelves: {
    id: 'photo-1521587760476-6c12a4b040da',
    alt: '',
    tone: 'warm',
  },
  studentsSteps: {
    id: 'photo-1531482615713-2afd69097998',
    alt: '',
    tone: 'cool',
  },

  /* --- Informational sections --------------------------------------- */
  handover: {
    id: 'photo-1497633762265-9d179a990aa6',
    alt: 'Students working together at a shared desk',
    tone: 'warm',
  },
  studyDesk: {
    id: 'photo-1517245386807-bb43f82c33c4',
    alt: 'A desk with a laptop, notebook and coffee',
    tone: 'warm',
  },
  campusExterior: {
    id: 'photo-1498243691581-b145c3f54a5a',
    alt: 'A university building on a bright day',
    tone: 'cool',
  },
  quietLibrary: {
    id: 'photo-1507842217343-583bb7270b66',
    alt: 'Rows of books in a university library',
    tone: 'warm',
  },

  /* --- Auth page panels --------------------------------------------- */
  authCampus: {
    id: 'photo-1562774053-701939374585',
    alt: '',
    tone: 'cool',
  },
  authStudy: {
    id: 'photo-1523240795612-9a054b0db644',
    alt: '',
    tone: 'warm',
  },

  /* --- Empty-state backdrops ---------------------------------------- */
  emptyCampus: {
    id: 'photo-1519452575417-564c1401ecc0',
    alt: '',
    tone: 'cool',
  },
};

/**
 * A single URL at one width.
 *
 *   photo('campusWalk', 1200)
 */
export const photo = (name, width = 1200, quality = 70) => {
  const entry = PHOTOS[name];
  if (!entry) return null;
  return url(entry.id, width, quality);
};

/**
 * A srcSet across sensible widths, so the browser downloads the size it
 * actually needs.
 *
 * Paired with a `sizes` attribute this is the difference between a phone
 * fetching 640px and fetching 1920px for the same slot — roughly a 6x
 * difference in bytes for an identical result on screen.
 */
export const photoSrcSet = (name, widths = [640, 960, 1280, 1920], quality = 70) => {
  const entry = PHOTOS[name];
  if (!entry) return null;

  return widths.map((width) => `${url(entry.id, width, quality)} ${width}w`).join(', ');
};

/** The alt text that belongs to a photo. Empty string means decorative. */
export const photoAlt = (name) => PHOTOS[name]?.alt ?? '';

/* ==================================================================
   GENERATED ITEM ARTWORK — for reports with no uploaded photo
   ================================================================== */

/**
 * A deterministic gradient + glyph per category.
 *
 * WHY GENERATED RATHER THAN PHOTOGRAPHIC: this fills the media slot on
 * an item card that has no upload. A photograph here would imply the
 * item looks like the photograph, which is false and actively
 * misleading — a user might dismiss a real match because the picture
 * "isn't theirs". An abstract, clearly-synthetic panel cannot be
 * mistaken for a photo of the item.
 *
 * It is deterministic (keyed off the category, not random) so the same
 * category always looks the same. That turns it into a weak visual
 * signal rather than noise, and it stays stable across re-renders.
 *
 * Colours are expressed as CSS custom properties consumed by
 * `.item-card-art` in components.css, so both themes stay correct.
 */
export const CATEGORY_ART = {
  ELECTRONICS: { from: '#6366f1', to: '#0ea5e9', glyph: '\u{1F4BB}' },
  ACCESSORIES: { from: '#a855f7', to: '#ec4899', glyph: '\u{1F45C}' },
  DOCUMENTS: { from: '#0891b2', to: '#0d9488', glyph: '\u{1F4C4}' },
  CLOTHING: { from: '#f59e0b', to: '#ef4444', glyph: '\u{1F455}' },
  KEYS: { from: '#eab308', to: '#f97316', glyph: '\u{1F511}' },
  BOOKS: { from: '#059669', to: '#65a30d', glyph: '\u{1F4DA}' },
  OTHER: { from: '#64748b', to: '#475569', glyph: '\u{1F4E6}' },
};

export const categoryArtwork = (category) =>
  CATEGORY_ART[category] || CATEGORY_ART.OTHER;
