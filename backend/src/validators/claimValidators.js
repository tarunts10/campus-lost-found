/**
 * validators/claimValidators.js — Zod schemas for claim requests.
 */

import { z } from 'zod';

/**
 * Creating a claim: the client supplies ONLY the evidence message.
 *
 * Everything else is determined by the server:
 *   item     — from the URL (/api/items/:id/claims)
 *   claimant — from the verified JWT (req.user._id)
 *   status   — always PENDING on creation
 *
 * Since Zod strips unknown keys, a body containing "claimant" or
 * "status" has them removed before the controller runs. There is no way
 * for a client to file a claim in somebody else's name.
 */
export const createClaimSchema = z.object({
  message: z
    .string({ message: 'A claim message is required' })
    .trim()
    .min(20, 'Claim message must be at least 20 characters')
    .max(1000, 'Claim message cannot exceed 1000 characters'),
});

/**
 * Updating a claim: the ONLY permitted change is the decision.
 *
 * Deliberately excludes item, claimant, and message — a decision must
 * not be able to rewrite the evidence it was based on, and a claim can
 * never be moved to a different item or person.
 *
 * PENDING is not an accepted value: a decision cannot be un-made by
 * reverting the claim, because approving already changed the item and
 * rejected the competing claims. Reopening a case is a different
 * operation with different consequences, not a status edit.
 */
export const updateClaimSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'], {
    message: 'Status must be either APPROVED or REJECTED',
  }),
});
