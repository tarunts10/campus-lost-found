/**
 * routes/itemRoutes.js — the URL map for items.
 *
 * Responsibility: say WHICH function handles WHICH method + path, and
 * WHICH middleware guards it. Reading this file should tell you the
 * entire item API, including its security posture, at a glance.
 *
 * Each route is a CHAIN, run left to right, and the order is a security
 * decision: authentication, then validation, then the controller. By the
 * time a controller runs, it can trust both the identity of the caller
 * and the shape of the input.
 */

import express from 'express';
import {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
} from '../controllers/itemController.js';
import { createClaim } from '../controllers/claimController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  createItemSchema,
  updateItemSchema,
} from '../validators/itemValidators.js';
import { createClaimSchema } from '../validators/claimValidators.js';

const router = express.Router();

/**
 * ALL item routes require authentication.
 *
 * Applied to the whole router so a route added later is protected by
 * default — you have to actively opt out.
 *
 * DESIGN DECISION: the reads (GET) are protected too, not just writes.
 * The product brief states that only authenticated college members may
 * use the application, and the listing exposes what was lost, where, and
 * who reported it. To make browsing public, delete this line and add
 * `protect` individually to the write routes below.
 */
router.use(protect);

// POST   /api/items          → create a new item report
router.post('/', validate(createItemSchema), createItem);

// GET    /api/items          → list items (search, filters, pagination)
router.get('/', getItems);

/**
 * ':id' is a route PARAMETER — a wildcard segment exposed as req.params.id.
 *
 * ORDER MATTERS: Express checks routes top to bottom and stops at the
 * first match. ':id' matches ANY single segment, so a literal route like
 * '/search' would have to be declared ABOVE these — otherwise ':id'
 * would swallow it and treat "search" as an item ID.
 */

// GET    /api/items/:id      → fetch one item
router.get('/:id', getItemById);

// PATCH  /api/items/:id      → update an item (owner or ADMIN only)
router.patch('/:id', validate(updateItemSchema), updateItem);

// DELETE /api/items/:id      → delete an item (owner or ADMIN only)
router.delete('/:id', deleteItem);

/**
 * POST /api/items/:id/claims → file a claim against this item
 *
 * Nested under the item because filing a claim is an action performed ON
 * an item: the URL itself states which item, so the client never sends an
 * item id in the body where it could be tampered with.
 *
 * The handler lives in claimController; only the ROUTE lives here.
 */
router.post('/:id/claims', validate(createClaimSchema), createClaim);

export default router;
