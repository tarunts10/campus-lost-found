/**
 * services/apiClient.js — the single Axios instance for the whole app.
 *
 * Everything that talks to the backend goes through here. No component
 * ever calls axios directly or types a URL, so:
 *   - the API base URL is configured in ONE place
 *   - the Authorization header is attached in ONE place
 *   - expired sessions are handled in ONE place
 */

import axios from 'axios';

/**
 * VITE_API_URL is injected at BUILD time by Vite, not read at runtime.
 *
 * Only variables prefixed VITE_ are exposed to the browser — that prefix
 * is a deliberate safety rail. Anything in here ends up inside the
 * JavaScript bundle that every visitor downloads, so it is PUBLIC.
 * A backend secret placed here would be readable by anyone.
 *
 * An API URL is public information (the browser has to know where to
 * send requests), so it belongs here. JWT_SECRET and MONGODB_URI never do.
 */
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'clf_token';

export const tokenStorage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      // Private browsing modes can throw on access.
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

/**
 * REQUEST INTERCEPTOR — attach the JWT to every outgoing request.
 *
 * Reading from storage per request (rather than setting the header once
 * at login) means the very first request after a page refresh already
 * carries the token, with no ordering problem between app startup and
 * the auth context mounting.
 */
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * Callback registered by AuthContext, invoked when the backend says the
 * session is no longer valid.
 *
 * Using a callback rather than importing the context avoids a circular
 * import (context imports the client, the client would import context).
 */
let onSessionExpired = null;

export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

/**
 * RESPONSE INTERCEPTOR — normalise errors and handle dead sessions.
 *
 * The backend always answers failures with { success: false, message }.
 * This turns that into a plain Error carrying a readable `.message` and
 * the `.status`, so components can write `catch (err) { setError(err.message) }`
 * without knowing anything about Axios.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    /**
     * 401 means the token is missing, invalid, expired, or the account
     * was deleted. Whatever the cause, the stored token is now useless,
     * so clear it and let the app return to a logged-out state.
     *
     * The login request itself is excluded: a wrong password also
     * returns 401, and that must show "Invalid email or password"
     * rather than triggering a "session expired" flow.
     */
    const isLoginAttempt = error.config?.url?.includes('/auth/login');

    if (status === 401 && !isLoginAttempt) {
      tokenStorage.clear();
      if (onSessionExpired) onSessionExpired();
    }

    let message;

    if (error.response) {
      // The backend replied with an error payload.
      message = error.response.data?.message || `Request failed (${status})`;
    } else if (error.code === 'ECONNABORTED') {
      message = 'The request timed out. Please try again.';
    } else {
      // No response at all: server down, wrong port, or CORS refusal.
      message =
        'Cannot reach the server. Make sure the backend is running on ' +
        baseURL.replace('/api', '') +
        '.';
    }

    const normalised = new Error(message);
    normalised.status = status;
    normalised.original = error;

    return Promise.reject(normalised);
  }
);

export { baseURL };
export default apiClient;
