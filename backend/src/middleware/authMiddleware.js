/**
 * middleware/authMiddleware.js — "who is making this request?"
 *
 * This runs BEFORE protected controllers. If it succeeds it attaches the
 * authenticated user to req.user and calls next(). If it fails, the
 * request never reaches the controller at all.
 *
 * The controller can therefore assume req.user exists and is genuine.
 * That assumption is only safe because this middleware is the single
 * gate — which is why authentication belongs in middleware rather than
 * being re-implemented in each controller.
 */

import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';

/**
 * Small helper so every failure below returns an identical 401.
 *
 * Deliberately vague wording. Telling a caller "this token is expired"
 * versus "this signature is invalid" hands an attacker free information
 * about what to try next. The server logs the real reason; the client
 * gets one uniform answer.
 */
const unauthorized = (message = 'Not authorised. Please log in.') => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

/**
 * protect — require a valid JWT.
 */
export const protect = async (req, res, next) => {
  const header = req.headers.authorization;

  /**
   * Expected format:  Authorization: Bearer <token>
   *
   * "Bearer" is the HTTP auth scheme meaning whoever bears this token
   * gets access — there is no additional proof of identity. That is
   * precisely why tokens must travel over HTTPS in production: anyone
   * who intercepts one can use it.
   *
   * A missing header and a malformed header are handled identically.
   */
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('Not authorised. No token provided.'));
  }

  const token = header.slice(7).trim();

  if (!token) {
    return next(unauthorized('Not authorised. No token provided.'));
  }

  let payload;

  try {
    payload = verifyToken(token);
  } catch (error) {
    // Log the real reason for us; return the vague one to the client.
    console.warn(`JWT rejected (${error.name}): ${error.message}`);
    return next(unauthorized('Not authorised. Invalid or expired token.'));
  }

  /**
   * Load the user fresh from the database on every request.
   *
   * This is what makes deleted accounts and role changes take effect
   * immediately, rather than whenever the old token happens to expire.
   * See the note in utils/jwt.js about why the role is not in the token.
   *
   * The password is NOT loaded: the schema marks it select: false, and
   * nothing here asks for it.
   */
  const user = await User.findById(payload.sub);

  if (!user) {
    // Signature was valid, but the account is gone.
    return next(unauthorized('Not authorised. User no longer exists.'));
  }

  /**
   * Attach the user to the request.
   *
   * From here on, req.user is the ONLY trustworthy source of identity in
   * the entire application. Nothing in req.body about who someone is may
   * ever be believed — the body is written by the client.
   */
  req.user = user;
  next();
};
