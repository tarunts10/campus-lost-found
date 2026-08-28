/**
 * controllers/institutionController.js
 *
 * ONE endpoint, deliberately: a public, read-only list used to populate
 * the registration dropdown.
 *
 * There is NO create/update/delete API. Institutions are the isolation
 * boundary of the entire application — letting anyone create one through
 * the public API would let an attacker invent a college, set its email
 * domain to a real one, and register inside somebody else's tenancy.
 *
 * Institutions are created by an administrator running the seed script.
 */

import Institution from '../models/Institution.js';

/**
 * GET /api/institutions
 *
 * Public, because a visitor must choose their college BEFORE they have
 * an account to authenticate with.
 *
 * Only active institutions are returned, and only the three fields the
 * sign-up form needs. isActive, timestamps and internal state stay
 * server-side: the client has no use for them.
 *
 * The emailDomain IS included, so the form can tell the user "your email
 * must end in @college.edu" before they submit rather than after. That
 * is not a secret — it is printed on the college website.
 */
export const listInstitutions = async (req, res) => {
  const institutions = await Institution.find({ isActive: true })
    .select('name slug emailDomain')
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: institutions.length,
    data: institutions,
  });
};
