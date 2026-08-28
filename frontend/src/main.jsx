/**
 * main.jsx — the entry point.
 *
 * Mounts React into #root and installs the two providers everything
 * else depends on:
 *   BrowserRouter  makes routing available (must wrap AuthProvider,
 *                  because AuthContext uses navigation-aware hooks)
 *   AuthProvider   makes the current user available
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
