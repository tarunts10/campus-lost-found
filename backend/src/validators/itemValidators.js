/**
 * validators/itemValidators.js — Zod schemas for item requests.
 *
 * TWO LAYERS OF VALIDATION, AND WHY BOTH EARN THEIR PLACE
 *
 *   Zod      validates the HTTP REQUEST at the edge, before any logic
 *            runs. It also STRIPS unknown keys, which is a security
 *            control: reportedBy and status simply cease to exist on
 *            req.body before a controller can be careless with them.
 *
 *   Mongoose validates the DOCUMENT just before writing. It protects the
 *            database from every code path, including scripts and jobs
 *            that never go through HTTP at all.
 *
 * Neither replaces the other. Zod protects the controller; Mongoose
 * protects the data.
 */

import { z } from 'zod';
import {
  ITEM_TYPES,
  ITEM_CATEGORIES,
} from '../models/Item.js';

/**
 * Reject dates in the future, matching the Item model's own validator.
 *
 * The 24-hour allowance absorbs the difference between a user's local
 * date and the server's UTC clock.
 */
const notInFuture = (value) => {
  const oneDayMs = 24 * 60 * 60 * 1000;
  return value.getTime() <= Date.now() + oneDayMs;
};

/**
 * z.coerce.date() accepts the string "2026-08-27" and converts it to a
 * real Date, rejecting anything unparseable. Without coerce, a JSON
 * string would fail a plain z.date() outright.
 */
const itemDateSchema = z.coerce
  .date({ message: 'Date must be a valid date, e.g. 2026-08-27' })
  .refine(notInFuture, { message: 'Date cannot be in the future' });

/**
 * Fields a client may supply when CREATING an item.
 *
 * Note what is absent: status (defaults to ACTIVE) and reportedBy (taken
 * from the verified JWT). Because Zod strips unknown keys, sending them
 * is not an error — they are silently discarded, which is exactly what
 * we want for a forgery attempt.
 */
export const createItemSchema = z.object({
  title: z
    .string({ message: 'Title is required' })
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title cannot exceed 100 characters'),

  description: z
    .string({ message: 'Description is required' })
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description cannot exceed 1000 characters'),

  category: z.enum(ITEM_CATEGORIES, {
    message: `Category must be one of: ${ITEM_CATEGORIES.join(', ')}`,
  }),

  type: z.enum(ITEM_TYPES, {
    message: `Type must be one of: ${ITEM_TYPES.join(', ')}`,
  }),

  location: z
    .string({ message: 'Location is required' })
    .trim()
    .min(1, 'Location is required')
    .max(200, 'Location cannot exceed 200 characters'),

  date: itemDateSchema,
});

/**
 * Fields a client may supply when UPDATING an item.
 *
 * .partial() makes every field optional, which is what PATCH means —
 * "change only what I sent". The refine then requires at least one
 * field, because an empty PATCH is almost always a client bug and
 * silently succeeding would hide it.
 */
export const updateItemSchema = createItemSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message:
      'Provide at least one field to update: title, description, category, type, location, date',
  }
);
