/**
 * middleware/rateLimiter.js — throttle repeated requests per IP.
 *
 * WHY AUTH ROUTES SPECIFICALLY
 *
 * bcrypt makes a single password guess slow, but it does nothing to stop
 * an attacker making guesses continuously. With no limit, a script can
 * try common passwords against an account indefinitely. Rate limiting
 * caps attempts in a time window, turning "thousands of guesses per
 * minute" into "a handful" and making credential stuffing impractical.
 *
 * It also protects the SERVER: bcrypt at cost factor 12 burns CPU by
 * design, so unlimited login attempts are an easy denial-of-service.
 */

import rateLimit from 'express-rate-limit';

const WINDOW_MINUTES = 15;

export const authLimiter = rateLimit({
  windowMs: WINDOW_MINUTES * 60 * 1000,

  /**
   * Configurable so local testing is not throttled while production
   * stays strict. Default 20 attempts per 15 minutes per IP: generous
   * for a person who mistyped their password, useless for a script.
   */
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,

  /**
   * Send the standard RateLimit-* response headers so a well-behaved
   * client can see its remaining budget instead of guessing.
   */
  standardHeaders: 'draft-7',
  legacyHeaders: false,

  /**
   * Keep the same { success, message } shape as every other error in
   * this API, so the frontend needs no special case for 429.
   */
  message: {
    success: false,
    message: `Too many attempts. Please try again in ${WINDOW_MINUTES} minutes.`,
  },
});
