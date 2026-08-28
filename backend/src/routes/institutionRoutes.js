/**
 * routes/institutionRoutes.js
 *
 * NOTE the absence of `protect`. This is the only unauthenticated data
 * route in the API, and it has to be: someone registering has no token
 * yet, but must pick their institution.
 *
 * It is read-only. There is no POST, PATCH or DELETE here by design.
 */

import express from 'express';
import { listInstitutions } from '../controllers/institutionController.js';

const router = express.Router();

// GET /api/institutions -> active institutions, for the sign-up form
router.get('/', listInstitutions);

export default router;
