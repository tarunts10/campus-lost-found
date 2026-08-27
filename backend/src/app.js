/**
 * app.js — the Express APPLICATION.
 *
 * This file answers: "WHAT does this application do?"
 * It defines middleware and routes, then exports the configured app.
 *
 * It deliberately does NOT start a server or know about a port.
 * That is server.js's job. Keeping them apart means tests can import
 * this app and send requests straight into it, with no network involved.
 */

import express from 'express';

// Create the application instance.
// `app` is a function that node:http can use as a request handler,
// with Express's routing and middleware attached to it.
const app = express();

/**
 * GET /api/health — health check.
 *
 * Confirms the API process is alive and able to respond.
 * Intentionally has no dependencies (no database, no auth), so that
 * a failure here can only ever mean "the server itself is down".
 * Render will poll this endpoint to decide if a deployment is healthy.
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HELLO FROM MY BACKEND',
  });
});

// Export the app so server.js (or a future test file) can use it.
export default app;
