/**
 * controllers/claimController.js — the claim workflow.
 *
 * THE CENTRAL RULE OF THIS FILE: every identity and every ownership fact
 * is derived from req.user (a verified JWT) or from documents read out of
 * the database. Nothing about WHO someone is, WHAT they own, or WHAT ROLE
 * they hold is ever read from the request body.
 */

import mongoose from 'mongoose';
import Claim, { ACTIVE_CLAIM_STATUSES } from '../models/Claim.js';
import Item from '../models/Item.js';

const PUBLIC_USER_FIELDS = 'name role';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const ALLOWED_QUERY_PARAMS = ['status', 'item', 'page', 'limit'];

/**
 * Small helper for building errors with an HTTP status attached.
 * errorHandler.js reads .statusCode and formats the response.
 */
const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertValidObjectId = (id, label) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(400, `'${id}' is not a valid ${label} ID`);
  }
};

/**
 * Compare two ObjectIds by VALUE.
 *
 * Comparing ObjectId objects with === compares references, so two
 * ObjectIds holding the same id are not === each other. Their string
 * forms are.
 */
const sameId = (a, b) => String(a) === String(b);

/**
 * Institution id from req.user, normalised.
 *
 * authMiddleware populates institutionId into a full document, so this
 * unwraps it. Same helper as in itemController; duplicated rather than
 * shared because a two-line function in its own module would be more
 * indirection than it saves.
 */
const institutionIdOf = (user) =>
  user.institutionId?._id ? user.institutionId._id : user.institutionId;

/**
 * POST /api/items/:id/claims
 * File a claim against an item.
 */
export const createClaim = async (req, res) => {
  const { id: itemId } = req.params;
  const { message } = req.body; // Zod already validated and trimmed this

  assertValidObjectId(itemId, 'item');

  /**
   * Load the item. We need it for three separate checks, and it is also
   * how we discover the owner — the owner is NEVER taken from the body.
   */
  /**
   * INSTITUTION ISOLATION.
   *
   * Scoped in the QUERY, so an item from another college is never even
   * loaded. A cross-institution id therefore returns the same 404 as a
   * non-existent one — a 403 would confirm the item is real and let
   * someone probe another college's data.
   */
  const item = await Item.findOne({
    _id: itemId,
    institutionId: institutionIdOf(req.user),
  });

  if (!item) {
    throw httpError(404, 'Item not found');
  }

  /**
   * RULE 2 — you cannot claim your own item.
   *
   * The comparison is between the item's stored reportedBy and the
   * authenticated user. Both come from trusted sources.
   */
  if (sameId(item.reportedBy, req.user._id)) {
    throw httpError(400, 'You cannot claim an item you reported yourself');
  }

  /**
   * RULE 9 (creation side) — only ACTIVE items accept new claims.
   *
   * Once an item is CLAIMED or RESOLVED the case is effectively closed,
   * and letting new claims pile up would just create work that can never
   * lead anywhere.
   */
  if (item.status !== 'ACTIVE') {
    throw httpError(
      409,
      `This item is no longer accepting claims (current status: ${item.status})`
    );
  }

  /**
   * RULE 3 — one live claim per user per item.
   *
   * This check produces the friendly error. The PARTIAL UNIQUE INDEX on
   * the Claim model is the actual guarantee: two simultaneous requests
   * could both pass this check, and the index is what stops the second
   * insert. That failure surfaces as a duplicate-key error, which
   * errorHandler.js turns into a 409.
   *
   * REJECTED claims are excluded, so someone with better evidence may
   * try again.
   */
  const existingClaim = await Claim.findOne({
    item: itemId,
    claimant: req.user._id,
    status: { $in: ACTIVE_CLAIM_STATUSES },
  });

  if (existingClaim) {
    throw httpError(
      409,
      `You already have a ${existingClaim.status.toLowerCase()} claim on this item`
    );
  }

  /**
   * Create the claim.
   *
   * item comes from the URL, claimant from the verified token, status
   * from the schema default. The client contributed exactly one field:
   * the message.
   */
  const claim = await Claim.create({
    item: itemId,
    claimant: req.user._id,
    message,
  });

  await claim.populate([
    { path: 'claimant', select: PUBLIC_USER_FIELDS },
    { path: 'item', select: 'title type status' },
  ]);

  res.status(201).json({
    success: true,
    data: claim,
  });
};

/**
 * GET /api/claims
 *
 * Returns the claims this user is entitled to see:
 *   ADMIN   — every claim
 *   Anyone  — claims they filed, PLUS claims filed on items they reported
 *
 * RULES 5, 6 and 7 are all implemented by the visibility filter below.
 */
export const getClaims = async (req, res) => {
  const unknownParams = Object.keys(req.query).filter(
    (key) => !ALLOWED_QUERY_PARAMS.includes(key)
  );

  if (unknownParams.length > 0) {
    throw httpError(
      400,
      `Unknown query parameter(s): ${unknownParams.join(', ')}. ` +
        `Allowed parameters: ${ALLOWED_QUERY_PARAMS.join(', ')}`
    );
  }

  const filter = {};

  /**
   * VISIBILITY — the security core of this endpoint.
   *
   * A claim message is private evidence. Without this filter, any logged
   * in student could read every claim in the college, including the
   * ownership proofs other people submitted.
   *
   * Non-admins get an $or of two conditions:
   *   1. claims they filed themselves
   *   2. claims filed against items they reported
   *
   * Condition 2 needs the list of item ids they own, which is a second
   * query. MongoDB is a document database and cannot join, so the join
   * happens here in application code.
   *
   * TRADEOFF: this loads every item id the user owns. Fine for a campus
   * where a person reports a handful of items; it would need an
   * aggregation pipeline with $lookup if someone owned thousands.
   */
  /**
   * INSTITUTION ISOLATION — applies to EVERYONE, admins included.
   *
   * Claims do not carry an institutionId of their own, so the boundary
   * is enforced by restricting which ITEMS a claim may reference. Every
   * branch below intersects with this list.
   */
  const institutionItemIds = await Item.find({
    institutionId: institutionIdOf(req.user),
  }).distinct('_id');

  filter.item = { $in: institutionItemIds };

  if (req.user.role !== 'ADMIN') {
    const ownedItemIds = await Item.find({
      reportedBy: req.user._id,
      institutionId: institutionIdOf(req.user),
    }).distinct('_id');

    filter.$or = [{ claimant: req.user._id }, { item: { $in: ownedItemIds } }];
  }

  if (req.query.status !== undefined) {
    if (typeof req.query.status !== 'string') {
      throw httpError(400, 'Invalid status filter. Expected a single value.');
    }

    const status = req.query.status.toUpperCase();

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      throw httpError(
        400,
        `Invalid status filter '${req.query.status}'. Must be one of: PENDING, APPROVED, REJECTED`
      );
    }

    filter.status = status;
  }

  if (req.query.item !== undefined) {
    if (typeof req.query.item !== 'string') {
      throw httpError(400, 'Invalid item filter. Expected a single value.');
    }

    assertValidObjectId(req.query.item, 'item');

    /**
     * SECURITY: this assignment REPLACES the institution scoping set
     * above, so the requested item must first be confirmed to be inside
     * the caller's own institution. Without this check,
     * ?item=<other college's item id> would have silently widened the
     * query past the isolation boundary.
     *
     * A disallowed id yields an empty result rather than an error, so a
     * caller cannot use this endpoint to discover whether an item id
     * exists in another institution.
     */
    const requestedItemId = String(req.query.item);
    const withinInstitution = institutionItemIds.some(
      (id) => String(id) === requestedItemId
    );

    filter.item = withinInstitution ? req.query.item : { $in: [] };
  }

  const page = parsePositiveInt(req.query.page, 'page', DEFAULT_PAGE);
  const limit = parsePositiveInt(req.query.limit, 'limit', DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;

  const [claims, total] = await Promise.all([
    Claim.find(filter)
      .populate('claimant', PUBLIC_USER_FIELDS)
      .populate({
        path: 'item',
        select: 'title type status reportedBy',
        populate: { path: 'reportedBy', select: PUBLIC_USER_FIELDS },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Claim.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    success: true,
    count: claims.length,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: claims,
  });
};

/**
 * Local pagination parser. Kept here rather than shared with
 * itemController because extracting a two-use helper into its own module
 * would add a file for very little benefit — if a third caller appears,
 * that is the moment to move it.
 */
function parsePositiveInt(value, fieldName, fallback, max) {
  if (value === undefined) return fallback;

  if (typeof value !== 'string') {
    throw httpError(400, `Invalid ${fieldName}. Expected a single number.`);
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw httpError(
      400,
      `Invalid ${fieldName} '${value}'. Must be a whole number of 1 or more.`
    );
  }

  if (max !== undefined && parsed > max) {
    throw httpError(
      400,
      `Invalid ${fieldName} '${value}'. Maximum allowed is ${max}.`
    );
  }

  return parsed;
}

/**
 * PATCH /api/claims/:id
 * Approve or reject a claim. Item owner or ADMIN only.
 *
 * This is the most consequential operation in the application: approving
 * a claim changes THREE things across TWO collections.
 */
export const updateClaim = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Zod restricted this to APPROVED or REJECTED

  assertValidObjectId(id, 'claim');

  const claim = await Claim.findById(id);

  if (!claim) {
    throw httpError(404, 'Claim not found');
  }

  /**
   * Load the item to discover who owns it.
   *
   * RULE 10 — ownership is read from the DATABASE, never from the body.
   * A client cannot tell us who owns an item.
   */
  /**
   * Load the item scoped to the caller's institution.
   *
   * This is what stops an admin of College A deciding a claim on College
   * B's item: the item simply is not found for them, so the claim is
   * undecidable rather than merely forbidden.
   */
  const item = await Item.findOne({
    _id: claim.item,
    institutionId: institutionIdOf(req.user),
  });

  if (!item) {
    /**
     * Reached in two situations that must be INDISTINGUISHABLE:
     *
     *   a) the item genuinely no longer exists (orphaned claim)
     *   b) the item belongs to a DIFFERENT institution
     *
     * Claim.findById above is not institution-scoped — a claim id is not
     * secret, and scoping it would need a join. So the isolation is
     * enforced here instead, by the item lookup.
     *
     * The message must therefore be identical to the "no such claim"
     * error above. A distinct message like "the item no longer exists"
     * would confirm that a probed claim id is REAL in another
     * institution, which is exactly the information this boundary is
     * supposed to withhold.
     */
    throw httpError(404, 'Claim not found');
  }

  /**
   * RULE 4 — only the item owner or an ADMIN may decide.
   *
   * Note the claimant is deliberately NOT allowed, even though they are
   * a party to the claim. Letting a claimant approve their own claim
   * would be the entire security model collapsing.
   *
   * 403 not 401: we know exactly who this is (authMiddleware proved it),
   * they are simply not permitted.
   */
  const isOwner = sameId(item.reportedBy, req.user._id);
  const isAdmin = req.user.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    throw httpError(
      403,
      'Only the person who reported this item, or an admin, can decide a claim'
    );
  }

  /**
   * A decision is final. Re-deciding an already-decided claim would
   * silently desynchronise the item status and the competing claims that
   * were rejected alongside it.
   */
  if (claim.status !== 'PENDING') {
    throw httpError(
      409,
      `This claim has already been ${claim.status.toLowerCase()}`
    );
  }

  /**
   * REJECTION — the simple path. One document changes, nothing else is
   * affected, and the item stays open for other claimants.
   */
  if (status === 'REJECTED') {
    claim.status = 'REJECTED';
    await claim.save();

    await claim.populate([
      { path: 'claimant', select: PUBLIC_USER_FIELDS },
      { path: 'item', select: 'title type status' },
    ]);

    return res.status(200).json({ success: true, data: claim });
  }

  /**
   * ============================ APPROVAL ============================
   *
   * Three writes are required:
   *   1. the item becomes CLAIMED
   *   2. this claim becomes APPROVED
   *   3. every OTHER pending claim on the item becomes REJECTED
   *
   * This deployment is a STANDALONE MongoDB, which does not support
   * multi-document transactions — verified, not assumed. So these three
   * writes cannot be made atomic as a group, and a crash between them
   * would leave the data partially updated.
   *
   * Since we cannot have atomicity, we choose an ORDER that protects the
   * one invariant that really matters:
   *
   *     AN ITEM MUST NEVER HAVE TWO APPROVED CLAIMS.
   *
   * Locking the item FIRST is what guarantees that. If the process dies
   * after step 1, the item is CLAIMED and no further approval can begin,
   * because step 1 only succeeds on an ACTIVE item. The worst outcome is
   * a claim left PENDING on a claimed item — visible, recoverable, and
   * far better than two people both told the item is theirs.
   */

  /**
   * Step 1 — atomic compare-and-set on the item.
   *
   * findOneAndUpdate matches AND writes in a single operation, and
   * MongoDB guarantees atomicity on a SINGLE document even without
   * transaction support. Including `status: 'ACTIVE'` in the filter makes
   * this a lock: if two owners approve two different claims at the same
   * instant, exactly one query matches. The loser gets null.
   *
   * Doing this as a read-then-write instead would leave a window between
   * the two where both requests believe the item is still ACTIVE.
   */
  const lockedItem = await Item.findOneAndUpdate(
    { _id: item._id, status: 'ACTIVE' },
    { status: 'CLAIMED' },
    { returnDocument: 'after' }
  );

  /**
   * RULE 9 — the item was not ACTIVE, so this claim cannot be approved.
   * Either it was already claimed, already resolved, or another approval
   * won the race a moment ago.
   */
  if (!lockedItem) {
    throw httpError(
      409,
      `This claim cannot be approved because the item is no longer active (current status: ${item.status})`
    );
  }

  // Step 2 — approve this claim.
  claim.status = 'APPROVED';
  await claim.save();

  /**
   * Step 3 — RULE 8: reject the competing pending claims.
   *
   * updateMany is one database operation covering every other pending
   * claim on this item. $ne excludes the one just approved.
   *
   * Those claimants are now definitively not getting the item, so
   * leaving their claims PENDING would be misleading.
   */
  const rejection = await Claim.updateMany(
    { item: item._id, status: 'PENDING', _id: { $ne: claim._id } },
    { status: 'REJECTED' }
  );

  await claim.populate([
    { path: 'claimant', select: PUBLIC_USER_FIELDS },
    { path: 'item', select: 'title type status' },
  ]);

  res.status(200).json({
    success: true,
    data: {
      claim,
      itemStatus: lockedItem.status,
      otherClaimsRejected: rejection.modifiedCount,
    },
  });
};
