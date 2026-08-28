/**
 * services/authService.js — auth endpoints.
 *
 * Each function returns just the useful part of the payload, so
 * components never have to remember the { success, data } envelope.
 */

import apiClient from './apiClient.js';

/**
 * POST /api/auth/register -> 201 { success, data: { user } }
 *
 * institutionId is REQUIRED by the backend. It is a request, not a
 * decision: the server verifies the institution exists, is active, and
 * that the email matches its configured domain before accepting it.
 */
export const register = async ({ institutionId, name, email, password }) => {
  const { data } = await apiClient.post('/auth/register', {
    institutionId,
    name,
    email,
    password,
  });
  return data.data.user;
};

// POST /api/auth/login -> 200 { success, data: { token, user } }
export const login = async ({ email, password }) => {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return data.data; // { token, user }
};

// GET /api/auth/me -> 200 { success, data: { user } }
export const getCurrentUser = async () => {
  const { data } = await apiClient.get('/auth/me');
  return data.data.user;
};
