/**
 * routes/itemRoutes.js — the URL map for items.
 *
 * Responsibility: say WHICH function handles WHICH method + path.
 * Nothing else. No database access, no validation, no business rules.
 *
 * Reading this file should tell you the entire item API at a glance.
 * That is the point of having it separate: routes are a table of contents.
 */

import express from 'express';
import {
  createItem,
  getItems,
  getItemById,
} from '../controllers/itemController.js';

/**
 * express.Router() creates a mini-application: it has its own routes and
 * middleware, but no server of its own. app.js mounts it at a prefix.
 *
 * Because the prefix lives in app.js, the paths here are RELATIVE.
 * '/' below becomes '/api/items' once mounted. Moving the whole API to
 * /api/v2/items later would be a one-line change in app.js.
 */
const router = express.Router();

// POST /api/items      → create a new item report
router.post('/', createItem);

// GET  /api/items      → list items (optionally filtered)
router.get('/', getItems);

/**
 * GET /api/items/:id   → fetch one item
 *
 * ':id' is a route PARAMETER — a wildcard segment. Express matches any
 * value there and exposes it as req.params.id. So a request to
 * /api/items/68af3c1e9d4b2a7c8e1f0a33 gives req.params.id = "68af3c..."
 *
 * ORDER MATTERS: Express checks routes top to bottom and stops at the
 * first match. ':id' matches ANY single segment, so a literal route like
 * '/search' would have to be declared ABOVE this one — otherwise ':id'
 * would swallow it and treat "search" as an item ID.
 */
router.get('/:id', getItemById);

export default router;
