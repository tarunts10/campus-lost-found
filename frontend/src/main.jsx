/**
 * main.jsx — the entry point.
 *
 * Mounts React into #root and installs the providers everything else
 * depends on. The nesting order matters:
 *
 *   ThemeProvider   outermost — it touches only <html>, and nothing
 *                   below it needs to be mounted first
 *   BrowserRouter   must wrap AuthProvider, which uses navigation-aware
 *                   hooks
 *   ToastProvider   must wrap AuthProvider so an auth event (a session
 *                   expiring, say) can raise a toast
 *   AuthProvider    innermost of the providers, so every page can read
 *                   the current user
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/app.css';

import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
