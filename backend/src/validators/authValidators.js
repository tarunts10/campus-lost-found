/**
 * validators/authValidators.js — Zod schemas for auth requests.
 *
 * WHY ZOD, when Mongoose already validates?
 *
 * They validate different things at different moments:
 *
 *   Zod      validates the HTTP REQUEST, at the edge, before any logic
 *            runs. It answers "is this a well-formed request?"
 *
 *   Mongoose validates the DOCUMENT, before writing to the database.
 *            It answers "is this valid data to store?"
 *
 * Login is the clearest example: there is no document to save, so
 * Mongoose never runs at all — yet we still must check that an email and
 * password were actually supplied. Zod covers that gap.
 *
 * Zod also TRANSFORMS. The schemas below trim and lowercase the email as
 * part of parsing, so everything downstream receives clean data.
 */

import { z } from 'zod';

/**
 * Email: normalise FIRST, then validate.
 *
 * Order matters and is easy to get wrong. z.email().trim() validates the
 * raw string before trimming, so "  a@b.com " is rejected. Piping the
 * cleaned string into z.email() gives us "  A@B.COM " -> "a@b.com".
 */
const emailSchema = z
  .string({ message: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Must be a valid email address' }));

export const registerSchema = z.object({
  name: z
    .string({ message: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name cannot exceed 80 characters'),

  email: emailSchema,

  /**
   * Password rules kept deliberately simple.
   *
   * LENGTH is what actually resists brute force. Complexity rules
   * ("must contain a symbol") mostly push people toward predictable
   * substitutions like "P@ssw0rd1" and are no longer recommended by
   * modern guidance. A minimum length and a sane maximum is enough.
   *
   * The 72-byte cap is not arbitrary: bcrypt silently IGNORES anything
   * past 72 bytes, so a longer password would give a false sense of
   * security. Rejecting it is more honest than truncating it.
   */
  password: z
    .string({ message: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password cannot exceed 72 characters'),
});

export const loginSchema = z.object({
  email: emailSchema,
  /**
   * No length rule on login. Checking "at least 8 characters" here would
   * tell an attacker their guess was too short before we even look at
   * the account — and it would lock out users whose password predates a
   * rule change. Any non-empty string is accepted; bcrypt decides.
   */
  password: z.string({ message: 'Password is required' }).min(1, 'Password is required'),
});
