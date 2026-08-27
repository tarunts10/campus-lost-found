/**
 * services/claimService.js — claim endpoints.
 */

import apiClient from './apiClient.js';

/**
 * POST /api/items/:itemId/claims -> 201 { success, data: claim }
 *
 * The item comes from the URL and the claimant from the JWT. The only
 * thing this client sends is the evidence message.
 */
export const createClaim = async (itemId, message) => {
  const { data } = await apiClient.post(`/items/${itemId}/claims`, { message });
  return data.data;
};

/**
 * GET /api/claims
 *
 * The backend decides visibility: you see claims you filed plus claims
 * filed on items you reported. Admins see everything. The frontend does
 * not and cannot widen that.
 */
export const listClaims = async (params = {}) => {
  const query = {};

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query[key] = value;
    }
  }

  const { data } = await apiClient.get('/claims', { params: query });
  return { claims: data.data, pagination: data.pagination };
};

/**
 * PATCH /api/claims/:id -> { success, data: { claim, itemStatus, otherClaimsRejected } }
 *
 * Only the item owner or an admin may call this successfully. If anyone
 * else tries, the backend returns 403 and this rejects — the UI hides
 * the buttons as a convenience, but the server is the authority.
 */
export const decideClaim = async (claimId, status) => {
  const { data } = await apiClient.patch(`/claims/${claimId}`, { status });
  return data.data;
};
