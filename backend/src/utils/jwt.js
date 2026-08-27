/**
 * utils/jwt.js — creating and verifying JSON Web Tokens.
 *
 * WHAT A JWT IS
 *
 * Three base64url-encoded parts joined by dots:
 *
 *   header.payload.signature
 *   eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI2OGFmLi4uIn0.dBjftJeZ4CVP...
 *
 *   header    — which algorithm signed this (HS256)
 *   payload   — the claims: who this is, when it expires
 *   signature — HMAC of header+payload, keyed with JWT_SECRET
 *
 * CRITICAL: the payload is ENCODED, not ENCRYPTED. Anyone holding a token
 * can decode and read it — paste one into jwt.io and see. Never put
 * anything secret in a JWT.
 *
 * What a JWT gives you is INTEGRITY, not secrecy. Change a single byte of
 * the payload and the signature no longer matches, so the server rejects
 * it. Only someone with JWT_SECRET can produce a valid signature — which
 * is exactly why that secret must never be committed or shared.
 */

import jwt from 'jsonwebtoken';

/**
 * Read the secret at call time, not at import time.
 *
 * Reading it into a module-level constant would capture the value when
 * the file is first imported, which can happen before environment
 * variables are loaded in some setups. Reading it per call is cheap and
 * always correct.
 */
const getSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not set. Check backend/.env');
  }

  return secret;
};

/**
 * Create a signed token for a user.
 *
 * The payload holds ONLY the user id, in the standard `sub` (subject)
 * claim. It deliberately does NOT include the role.
 *
 * WHY NOT PUT THE ROLE IN THE TOKEN? Because a token is issued once and
 * then lives on the client for days. If an admin is demoted, or a user is
 * deleted, a token minted earlier would still assert the old role until
 * it expired. Storing only the id forces the auth middleware to load the
 * user fresh on every request, so role changes and deletions take effect
 * immediately.
 *
 * The cost is one database lookup per authenticated request. That is a
 * real cost, and a high-traffic system might trade it away for speed.
 * For a campus application, correct authorisation is worth far more than
 * the microseconds saved.
 */
export const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, getSecret(), {
    /**
     * Expiry is configurable, and it matters: a token cannot be revoked
     * once issued, so the expiry window IS the blast radius of a stolen
     * token. Shorter is safer; too short is annoying.
     */
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/**
 * Verify a signature and expiry.
 *
 * THROWS on failure — the caller decides what that means:
 *   TokenExpiredError  — valid signature, but past its expiry
 *   JsonWebTokenError  — bad signature, malformed, or wrong secret
 *
 * Both become 401 in authMiddleware.
 */
export const verifyToken = (token) => jwt.verify(token, getSecret());
