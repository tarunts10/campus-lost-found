/**
 * context/ToastContext.jsx — transient confirmation messages.
 *
 * WHAT PROBLEM THIS SOLVES
 *
 * Before this, a successful action either navigated away with a
 * `state.notice` that the destination page had to remember to render,
 * or set a local `notice` string that pushed the layout down. Both
 * worked; neither was consistent, and the layout shift on every save
 * was the kind of small ugliness that makes an app feel homemade.
 *
 * A toast is the right shape for "this worked": it confirms without
 * interrupting, needs no dismissal, and never moves the content.
 *
 * WHAT THIS IS NOT
 *
 * Not for errors that need a decision, and not for validation messages.
 * Those belong next to the thing that went wrong, where the user is
 * already looking — a toast that disappears after four seconds is a bad
 * place to put something the user must act on. Destructive confirmation
 * goes through <ConfirmDialog>, not here.
 *
 * ACCESSIBILITY
 *
 * The live region lives in <Toaster>, is present in the DOM from the
 * start (a region added at the same moment as its content is often not
 * announced), and is polite rather than assertive so it waits for a
 * natural pause instead of interrupting.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const ToastContext = createContext(null);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /**
   * Timers are tracked so they can be cleared on unmount. Without this,
   * a toast dismissal firing after the provider unmounts calls setState
   * on a dead component — harmless in React 19, but it also means a
   * navigation away leaves timers running for no reason.
   */
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));

    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, { variant = 'success', duration = DEFAULT_DURATION } = {}) => {
      if (!message) return null;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setToasts((current) => {
        const next = [...current, { id, message, variant }];

        // Cap the stack. Three is plenty; beyond that they cover the
        // page and the oldest is unreadable anyway.
        return next.slice(-3);
      });

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration)
        );
      }

      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  /**
   * Named helpers rather than making every call site pass a variant
   * string. `toast.success(...)` reads better than
   * `toast.push(..., { variant: 'success' })` and cannot be misspelled
   * into a variant that has no styles.
   */
  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      push,
      success: (message, options) => push(message, { ...options, variant: 'success' }),
      error: (message, options) =>
        push(message, { ...options, variant: 'error', duration: 6000, ...options }),
      info: (message, options) => push(message, { ...options, variant: 'info' }),
    }),
    [toasts, dismiss, push]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }

  return context;
}
