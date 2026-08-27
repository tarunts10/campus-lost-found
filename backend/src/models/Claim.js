/**
 * models/Claim.js — a request to recover an item.
 *
 * A Claim is the join between a User and an Item: "I believe this found
 * item is mine, and here is why." It is deliberately its own collection
 * rather than an array inside Item, because:
 *
 *   - An item can receive many claims, and disputes are expected. An
 *     embedded array would grow unboundedly inside one document.
 *   - Claims need their own lifecycle, their own timestamps, and their
 *     own queries ("show me every claim I have made").
 *   - MongoDB documents have a 16MB cap; unbounded arrays are a known
 *     anti-pattern.
 *
 * This file stores REFERENCES (ObjectIds), not copies of the user and
 * item documents. Copying would duplicate data that then goes stale the
 * moment the original changes.
 */

import mongoose from 'mongoose';

export const CLAIM_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

/**
 * Statuses that count as "this person already has a live claim here".
 *
 * A REJECTED claim does not block a new attempt — someone may genuinely
 * have more evidence the second time. PENDING and APPROVED do block it.
 */
export const ACTIVE_CLAIM_STATUSES = ['PENDING', 'APPROVED'];

const claimSchema = new mongoose.Schema(
  {
    /**
     * item — which item is being claimed.
     *
     * ref: 'Item' lets .populate() swap this ObjectId for the actual
     * item document when we ask for it. Without populate it stays a
     * plain id, which is all most queries need.
     */
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: [true, 'Item is required'],
    },

    /**
     * claimant — who is making the claim.
     *
     * SECURITY: this is ALWAYS set from req.user._id in the controller,
     * never from the request body. Same rule as Item.reportedBy.
     */
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Claimant is required'],
    },

    /**
     * message — the claimant's evidence of ownership.
     *
     * This is the heart of the whole verification workflow. Anyone can
     * say "that is mine"; only the real owner can describe the scratch on
     * the back, the photo on the lock screen, or what was in the wallet.
     *
     * A minimum length is enforced because a one-word claim carries no
     * evidence and just creates work for the item owner.
     */
    message: {
      type: String,
      required: [true, 'A claim message is required'],
      trim: true,
      minlength: [20, 'Claim message must be at least 20 characters'],
      maxlength: [1000, 'Claim message cannot exceed 1000 characters'],
    },

    /**
     * status — where this claim sits in its lifecycle.
     *
     *   PENDING  — submitted, awaiting the item owner's decision
     *   APPROVED — accepted; the item is handed over
     *   REJECTED — declined, or superseded by another approved claim
     *
     * Defaults to PENDING. The client never sets this on creation, and
     * may only change it through PATCH /api/claims/:id, which enforces
     * who is allowed to decide.
     */
    status: {
      type: String,
      enum: {
        values: CLAIM_STATUSES,
        message: `Status must be one of: ${CLAIM_STATUSES.join(', ')}`,
      },
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Prevent one user holding two live claims on the same item.
 *
 * The controller checks for this too, so the common case gets a clear
 * 409 message. But that check has a race window: two simultaneous
 * requests can both pass it before either inserts.
 *
 * This PARTIAL UNIQUE INDEX is the actual guarantee. "Partial" means it
 * only applies to documents matching the filter — so a REJECTED claim is
 * outside the index and does not block a fresh attempt.
 *
 * Note this is deliberately per (item, claimant) and NOT per item:
 * MULTIPLE DIFFERENT USERS may hold pending claims on the same item at
 * once. Disputes are a real scenario the system must be able to
 * represent, not prevent.
 */
claimSchema.index(
  { item: 1, claimant: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ACTIVE_CLAIM_STATUSES },
    },
    name: 'one_active_claim_per_user_per_item',
  }
);

/**
 * Supporting index for the most common query in the app:
 * "show me every claim on this item, newest first".
 */
claimSchema.index({ item: 1, createdAt: -1 });

const Claim = mongoose.model('Claim', claimSchema);

export default Claim;
