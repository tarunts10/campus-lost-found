/**
 * services/itemService.js — item endpoints.
 */

import apiClient from './apiClient.js';

/**
 * GET /api/items
 *
 * The backend REJECTS unknown query parameters with a 400, so only keys
 * with a real value are sent. Passing `category: ''` for "all categories"
 * would be an error, not a no-op.
 */
export const listItems = async (params = {}) => {
  const query = {};

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query[key] = value;
    }
  }

  const { data } = await apiClient.get('/items', { params: query });

  // { success, count, pagination, data: [...] }
  return { items: data.data, pagination: data.pagination, count: data.count };
};

// GET /api/items/:id -> { success, data: item }
export const getItem = async (id) => {
  const { data } = await apiClient.get(`/items/${id}`);
  return data.data;
};

/**
 * POST /api/items -> 201 { success, data: item }
 *
 * NOTE what is NOT sent: reportedBy and status. The backend derives the
 * reporter from the JWT and defaults the status. Sending a reportedBy
 * from here would be ignored anyway — the server never reads it.
 */
export const createItem = async (payload) => {
  const { data } = await apiClient.post('/items', payload);
  return data.data;
};

// PATCH /api/items/:id -> { success, data: item }
export const updateItem = async (id, payload) => {
  const { data } = await apiClient.patch(`/items/${id}`, payload);
  return data.data;
};

// DELETE /api/items/:id -> { success, data: { _id, message } }
export const deleteItem = async (id) => {
  const { data } = await apiClient.delete(`/items/${id}`);
  return data.data;
};
