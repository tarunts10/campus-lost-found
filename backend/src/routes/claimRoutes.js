/**
 * routes/claimRoutes.js — the URL map for claims.
 *
 * Note that POST /api/items/:id/claims is NOT here — it lives in
 * itemRoutes.js, because its URL is nested under an item. Creating a
 * claim is an action performed ON an item, so that is where the route
 * belongs. Both files import from the same claimController.
 */

import express from 'express';
import { getClaims, updateClaim } from '../controllers/claimController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { updateClaimSchema } from '../validators/claimValidators.js';

const router = express.Router();

/**
 * Every claim operation requires authentication.
 *
 * Applied to the whole router rather than per-route, so a route added
 * later is protected by default. You have to actively opt out, which is
 * the safe direction for a mistake to fall.
 */
router.use(protect);

// GET   /api/claims      → claims this user may see (own + on own items)
router.get('/', getClaims);

// PATCH /api/claims/:id  → approve or reject (item owner or ADMIN only)
router.patch('/:id', validate(updateClaimSchema), updateClaim);

export default router;
