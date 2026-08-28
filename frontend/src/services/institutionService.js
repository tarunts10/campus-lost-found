/**
 * services/institutionService.js
 *
 * One read-only endpoint. There is deliberately no create/update/delete:
 * institutions are the isolation boundary of the application and are
 * created by an administrator running a server-side script, never
 * through the API.
 */

import apiClient from './apiClient.js';

/**
 * GET /api/institutions
 *
 * Public — a visitor must choose their college before they have an
 * account to authenticate with. Returns { _id, name, emailDomain } for
 * each ACTIVE institution.
 */
export const listInstitutions = async () => {
  const { data } = await apiClient.get('/institutions');
  return data.data;
};
