/**
 * models/Item.js — the Item model.
 *
 * Responsibility: define WHAT an item is, and enforce that definition.
 *
 * This file knows nothing about HTTP. No req, no res, no status codes.
 * That is deliberate: the same model can be used by a route, a test, a
 * CLI script, or a scheduled job. Data rules live here so they cannot be
 * bypassed by forgetting to check them in some new controller later.
 *
 * Remember: MongoDB itself enforces NOTHING. Every rule below exists only
 * because Mongoose checks it in our application code before writing.
 */

import mongoose from 'mongoose';

/**
 * Allowed values, defined once as constants.
 *
 * Declaring them here (and exporting them) means the controller can reuse
 * the same lists to validate query filters. One source of truth: adding a
 * category later is a single-line change, not a hunt through the codebase.
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

const itemSchema = new mongoose.Schema(
  {
    /**
     * title — the short label shown in listings.
     * Required because an item with no name is unsearchable and useless.
     * trim removes accidental leading/trailing spaces from user input.
     * maxlength keeps list layouts predictable and blocks absurd payloads.
     */
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },

    /**
     * description — the detail that makes ownership verifiable.
     * This is what separates a real claim from a guess: the owner can
     * describe details a stranger could not. Required for that reason.
     */
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },

    /**
     * category — a fixed list, not free text.
     * enum makes filtering reliable: free text would produce "electronics",
     * "Electronics" and "electronic" as three values that filters miss.
     */
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ITEM_CATEGORIES,
        message: `Category must be one of: ${ITEM_CATEGORIES.join(', ')}`,
      },
    },

    /**
     * type — LOST or FOUND. The single most important field in the app.
     *
     * NOTE a Mongoose quirk: this field is literally named "type", which is
     * also the keyword Mongoose uses to declare a field's data type. The
     * nested form below is the correct way to write it and works as expected.
     */
    type: {
      type: String,
      required: [true, 'Type is required (LOST or FOUND)'],
      enum: {
        values: ITEM_TYPES,
        message: `Type must be one of: ${ITEM_TYPES.join(', ')}`,
      },
    },

    /**
     * location — where on campus it was lost or found.
     * Free text on purpose: campus place names are too varied and too
     * institution-specific to hardcode, and a wrong list is worse than none.
     */
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },

    /**
     * date — WHEN the item was lost or found.
     *
     * Distinct from createdAt (when the report was filed). A wallet lost on
     * Monday and reported on Thursday has date=Monday, createdAt=Thursday.
     * Mongoose casts the incoming "2026-08-27" string into a real Date.
     */
    date: {
      type: Date,
      required: [true, 'Date is required'],
      validate: {
        validator: function (value) {
          // An item cannot be lost or found in the future.
          // The 24h allowance absorbs timezone differences between the
          // user's local date and the server's UTC clock.
          const oneDayMs = 24 * 60 * 60 * 1000;
          return value.getTime() <= Date.now() + oneDayMs;
        },
        message: 'Date cannot be in the future',
      },
    },

    /**
     * status — where this item is in its lifecycle.
     *   ACTIVE   — open, awaiting resolution (the default on creation)
     *   CLAIMED  — someone has claimed it; verification in progress
     *   RESOLVED — returned to its owner; case closed
     *
     * Defaults to ACTIVE so the client never sets it on creation.
     * Status changes will be driven by the Claims workflow later, never
     * by the client sending whatever value it likes.
     */
    status: {
      type: String,
      enum: {
        values: ITEM_STATUSES,
        message: `Status must be one of: ${ITEM_STATUSES.join(', ')}`,
      },
      default: 'ACTIVE',
    },

    /**
     * reportedBy — who filed this report.
     *
     * ===================== TEMPORARY =====================
     * Authentication does not exist yet, so there is no real user to
     * record. The controller currently injects a hardcoded development
     * ObjectId. See DEV_PLACEHOLDER_USER_ID in itemController.js.
     *
     * The FIELD is already correct and permanent: an ObjectId referencing
     * the future User model. Only the VALUE is fake. When auth lands, the
     * fix is `reportedBy: req.user._id` and deleting the constant —
     * no schema change, no data migration.
     *
     * The ref is not resolved until .populate() is called, which is why
     * pointing at a User model that does not exist yet is harmless.
     * =====================================================
     */
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'reportedBy is required'],
    },

    /**
     * institutionId — which college this item belongs to.
     *
     * THE ISOLATION KEY. Every read of this collection is filtered by it,
     * so a member of one college can never see another college's items.
     *
     * SECURITY: always copied from req.user.institutionId at creation
     * time, never read from the request body. It is deliberately NOT in
     * the updatable field list, so it can never change after creation —
     * an item cannot be moved between institutions through the API.
     *
     * Denormalised onto the item (rather than being looked up through
     * reportedBy on every query) because it is used in the filter of
     * EVERY item query. Following the reference each time would mean a
     * second round trip per request, or an aggregation pipeline, for a
     * value that can never change once set.
     */
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'institutionId is required'],
      index: true,
    },

    /**
     * images — metadata for photos stored in ImageKit.
     *
     * The image BYTES live in ImageKit, not here. MongoDB stores only
     * the pointer: where the file is, its ImageKit id, and its original
     * name. Storing binaries in MongoDB would bloat every document,
     * blow through the 16MB document cap, and make every list query slow.
     *
     *   url    — the public CDN URL the browser loads
     *   fileId — ImageKit's identifier, needed to DELETE the file later
     *   name   — the original filename, used as alt-text fallback
     *
     * _id: false because these are plain value objects, not documents
     * that need their own identity.
     */
    images: {
      type: [
        {
          _id: false,
          url: { type: String, required: true, trim: true },
          fileId: { type: String, required: true, trim: true },
          name: { type: String, required: true, trim: true, maxlength: 255 },
        },
      ],
      default: [],
      validate: {
        validator: (value) => value.length <= 5,
        message: 'An item can have at most 5 images',
      },
    },
  },
  {
    /**
     * timestamps: true adds and maintains two fields automatically:
     *   createdAt — set once when the document is first saved
     *   updatedAt — rewritten on every save
     *
     * Essentially free, and the moment you need to sort by "newest first"
     * or debug "when did this change", you already have the data.
     */
    timestamps: true,
  }
);

/**
 * mongoose.model() compiles the schema into a Model — the class we use to
 * create and query documents.
 *
 * The name 'Item' determines the collection name: Mongoose lowercases and
 * pluralises it, so documents land in the "items" collection.
 */
const Item = mongoose.model('Item', itemSchema);

export default Item;
