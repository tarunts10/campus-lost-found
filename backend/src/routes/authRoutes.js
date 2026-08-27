/**
 * routes/authRoutes.js — the URL map for authentication.
 *
 * Note the middleware CHAIN on each route. Express runs them left to
 * right, and any one of them can end the request without calling the
 * next. That ordering is a security decision, not a style choice:
 *
 *   authLimiter  runs first, so a flood of requests is rejected BEFORE
 *                any parsing, database work, or expensive bcrypt calls.
 *   validate     runs next, so the controller never sees malformed input.
 *   controller   runs last, and can trust the shape of what it receives.
 */

import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
} from '../validators/authValidators.js';

const router = express.Router();

// POST /api/auth/register  → create an account
router.post('/register', authLimiter, validate(registerSchema), register);

// POST /api/auth/login     → exchange credentials for a JWT
router.post('/login', authLimiter, validate(loginSchema), login);

/**
 * GET /api/auth/me         → the currently authenticated user
 *
 * `protect` is what makes this endpoint private. Without it, the route
 * would run with req.user undefined and crash. With it, an unauthenticated
 * request is rejected with 401 before the controller is ever reached.
 *
 * No rate limiter here: this is a cheap read for an already-authenticated
 * user, not a guessable credential check.
 */
router.get('/me', protect, getMe);

export default router;
