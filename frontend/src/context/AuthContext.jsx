/**
 * context/AuthContext.jsx — who is logged in, for the whole app.
 *
 * React Context solves "many components at different depths need the
 * same value". Without it, the user object would have to be threaded
 * through every intermediate component as props.
 *
 * State held here:
 *   user            the current user object, or null
 *   token           the raw JWT, or null
 *   loading         true while the startup /auth/me check is running
 *   isAuthenticated derived: a user object exists
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as authService from '../services/authService.js';
import { setSessionExpiredHandler, tokenStorage } from '../services/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => tokenStorage.get());
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    setUser(null);
  }, []);

  /**
   * STARTUP: if a token exists in storage, verify it against the backend.
   *
   * We deliberately do NOT trust a cached user object from localStorage.
   * The token may have expired, the account may have been deleted, or
   * the role may have changed since it was issued. Only the server can
   * say. GET /api/auth/me is that question.
   *
   * `loading` stays true until this resolves, which is what stops the
   * app flashing the logged-out navbar before the check completes.
   */
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!tokenStorage.get()) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();
        if (!cancelled) setUser(currentUser);
      } catch {
        // 401 already cleared the token in the response interceptor.
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  /**
   * Let the Axios interceptor tell us when a 401 arrived mid-session.
   *
   * This is what turns "the backend rejected the token" into "the UI
   * returns to a logged-out state and explains why", instead of the user
   * staring at a page whose buttons silently stop working.
   */
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession();
      setSessionExpired(true);
    });

    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  const login = useCallback(async (credentials) => {
    const { token: newToken, user: loggedInUser } =
      await authService.login(credentials);

    tokenStorage.set(newToken);
    setToken(newToken);
    setUser(loggedInUser);
    setSessionExpired(false);

    return loggedInUser;
  }, []);

  /**
   * Register, then log in immediately.
   *
   * The backend's register endpoint returns the created user but NOT a
   * token — a deliberate choice there. Rather than making a new student
   * fill in a second form, we exchange the same credentials for a token
   * straight away.
   */
  const register = useCallback(
    async (details) => {
      await authService.register(details);
      return login({ email: details.email, password: details.password });
    },
    [login]
  );

  /**
   * Logout is purely client-side, because JWTs are stateless — the
   * backend has no session to end. Discarding the token is what logging
   * out means. The token technically stays valid until it expires, which
   * is the documented tradeoff of stateless auth.
   */
  const logout = useCallback(() => {
    clearSession();
    setSessionExpired(false);
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user),
      sessionExpired,
      dismissSessionExpired: () => setSessionExpired(false),
      login,
      register,
      logout,
    }),
    [user, token, loading, sessionExpired, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }

  return context;
}
