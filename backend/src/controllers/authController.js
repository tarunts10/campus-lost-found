/**
 * controllers/authController.js — registration, login, and current user.
 *
 * Zod has already validated and normalised req.body before any of these
 * run (see routes/authRoutes.js), so these functions can trust the SHAPE
 * of the input. They still must not trust its MEANING — a well-formed
 * request from an attacker is still a request from an attacker.
 */

import User from '../models/User.js';
import { signToken } from '../utils/jwt.js';
import bcrypt from 'bcrypt';

/**
 * A pre-computed bcrypt hash of a throwaway value.
 *
 * Used in login when no account matches, purely to burn roughly the same
 * amount of CPU as a real password check would. See the explanation in
 * login() below — this defeats timing-based account enumeration.
 */
const DUMMY_HASH =
  '$2b$12$XmqJIsVndfNEImBkWjBBi.MkBfs4R4u0z695AGQtSe.fNhQzR1FVi';

/**
 * Shape a user document for API responses.
 *
 * Being explicit about which fields go out is better than relying on the
 * model to strip the ones that must not. The model already does that in
 * two ways (select: false and a toJSON transform), but this is the layer
 * that decides what the CLIENT sees, and stating it here means a future
 * field added to the schema is not exposed by accident.
 */
const toPublicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

/**
 * POST /api/auth/register
 */
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  /**
   * Check for an existing account first, so the common case returns a
   * clear 409 rather than a raw database error.
   *
   * NOTE this check alone is NOT the real guarantee. Between this query
   * and the create() below, another request could insert the same email —
   * a race condition (time-of-check to time-of-use). What actually
   * prevents duplicates is the UNIQUE INDEX on the email field, and the
   * E11000 handler below catches the case where the race is lost.
   *
   * Two layers: this one for a good error message, the index for
   * correctness.
   */
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    const error = new Error('An account with this email already exists');
    error.statusCode = 409; // 409 Conflict
    throw error;
  }

  /**
   * Create the user.
   *
   * SECURITY — note which fields are passed. `role` is NOT among them.
   * Even if a client sends {"role":"ADMIN"}, Zod stripped it during
   * validation and this line would ignore it regardless. Role defaults to
   * STUDENT in the schema. Promotion to ADMIN is a deliberate action
   * taken outside the public API.
   *
   * The plaintext password is passed here, but never reaches MongoDB —
   * the pre('save') hook in the User model hashes it first.
   */
  const user = await User.create({ name, email, password });

  res.status(201).json({
    success: true,
    data: { user: toPublicUser(user) },
  });
};

/**
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  /**
   * .select('+password') is REQUIRED here.
   *
   * The schema marks password as select: false, so it is absent from
   * query results by default. Login is the one place that genuinely
   * needs the hash, so it opts in explicitly. Without the +password,
   * user.password would be undefined and every login would fail.
   */
  const user = await User.findOne({ email }).select('+password');

  /**
   * SECURITY — one identical error for both failure modes.
   *
   * "No such account" and "wrong password" must be indistinguishable.
   * Distinct messages let an attacker enumerate which email addresses
   * are registered, which is useful for targeted phishing and for
   * knowing which accounts are worth brute-forcing.
   */
  const invalidCredentials = () => {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    return error;
  };

  if (!user) {
    /**
     * Compare against a dummy hash before failing.
     *
     * Without this, a request for a non-existent account returns almost
     * instantly, while a real account takes ~250ms for bcrypt to run.
     * That timing difference is measurable, and it leaks exactly the
     * information the identical error message was meant to hide.
     *
     * Doing the work anyway makes both paths take similar time.
     */
    await bcrypt.compare(password, DUMMY_HASH);
    throw invalidCredentials();
  }

  /**
   * comparePassword re-hashes the submitted password using the salt
   * stored inside the existing hash, then compares in constant time.
   * A bcrypt hash cannot be reversed — this is the only way to check.
   */
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw invalidCredentials();
  }

  /**
   * Credentials verified. Issue the token.
   *
   * The token contains only the user id. The client will send it back on
   * every subsequent request, and authMiddleware will use it to load
   * this user again.
   */
  const token = signToken(user._id);

  res.status(200).json({
    success: true,
    data: {
      token,
      user: toPublicUser(user),
    },
  });
};

/**
 * GET /api/auth/me
 *
 * Requires authentication. By the time this runs, authMiddleware has
 * already verified the token and loaded the user, so there is nothing
 * left to do but format the response — no database call needed here.
 */
export const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: toPublicUser(req.user) },
  });
};
