/**
 * app.js — the Express APPLICATION.
 *
 * This file answers: "WHAT does this application do?"
 * It wires global middleware and mounts route modules, then exports the
 * configured app. It deliberately does NOT start a server, open a database
 * connection, or know about a port — that is server.js's job.
 *
 * ORDER IS EVERYTHING IN THIS FILE. Express runs middleware top to bottom,
 * so the sequence below is the actual request pipeline:
 *
 *   1. helmet          (security headers on every response)
 *   2. cors            (which browsers may call this API)
 *   3. express.json()  (turn raw bytes into req.body)
 *   4. routes          (do the actual work)
 *   5. notFound        (nothing matched)
 *   6. errorHandler    (something threw)
 */

import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';

import itemRoutes from './routes/itemRoutes.js';
import claimRoutes from './routes/claimRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

/**
 * helmet() — set defensive HTTP response headers.
 *
 * A collection of small, cheap protections applied to every response:
 *
 *   X-Content-Type-Options: nosniff   stops browsers guessing a response
 *                                     is HTML when we said it is JSON
 *   Strict-Transport-Security         forces HTTPS on future visits
 *   X-Frame-Options / frame-ancestors blocks clickjacking via <iframe>
 *   Content-Security-Policy           restricts what a page may load
 *
 * It also REMOVES `X-Powered-By: Express`, which previously announced our
 * framework to anyone scanning for framework-specific vulnerabilities.
 *
 * Placed first so the headers are present even on error responses.
 */
app.use(helmet());

/**
 * cors() — decide which browser origins may call this API.
 *
 * Browsers enforce the Same-Origin Policy: JavaScript on
 * http://localhost:5173 cannot read a response from http://localhost:5000
 * unless that server explicitly permits it. CORS is how the server grants
 * that permission, via Access-Control-Allow-Origin headers.
 *
 * Two things worth being clear about:
 *
 *   1. CORS is a BROWSER protection, not a server one. curl and Postman
 *      ignore it entirely. It stops a malicious website from reading your
 *      API using a visitor's credentials — it does not stop an attacker
 *      calling the API directly. Real access control is the JWT.
 *
 *   2. We name an explicit origin instead of allowing everything. Using
 *      `origin: '*'` would let any website on the internet call this API
 *      from a user's browser.
 *
 * The default matches Vite's dev server, which the frontend will use.
 */
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  })
);

/**
 * express.json() — parse incoming JSON request bodies.
 *
 * A body arrives as a stream of raw bytes. This accumulates them, parses
 * the result as JSON, and puts the object on req.body. Without it,
 * req.body is undefined and every POST fails.
 *
 * It only acts on requests whose Content-Type is application/json, so it
 * costs nothing on GET requests that have no body.
 *
 * The limit caps body size, preventing a client from sending a huge
 * payload to exhaust server memory.
 */
app.use(express.json({ limit: '10kb' }));

/**
 * GET /api/health — health check.
 *
 * Deliberately public and deliberately free of any database or auth
 * dependency. A health check must be able to answer even when MongoDB is
 * down — that is precisely how you tell "the API is dead" apart from
 * "the API is up but the database is unreachable".
 */
app.get('/api/health', (req, res) => {
  /**
   * readyState is Mongoose's view of the connection:
   *   0 disconnected  1 connected  2 connecting  3 disconnecting
   *
   * It is read from memory — no query is sent — so this stays instant
   * and cannot itself fail.
   *
   * The status code stays 200 whenever the PROCESS is healthy, and the
   * database state is reported in the body instead. Restarting the API
   * would not fix an unreachable database, so failing the health check
   * would make a hosting platform restart the wrong thing.
   *
   * A stricter 'deep' health check returning 503 when the database is
   * down is a reasonable alternative; it is a deployment-time decision.
   */
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

  res.status(200).json({
    success: true,
    message: 'HELLO FROM MY BACKEND',
    data: {
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbStates[mongoose.connection.readyState] ?? 'unknown',
    },
  });
});

/**
 * Route modules.
 *
 * app.use(prefix, router) means: for any request whose path starts with
 * the prefix, strip it and hand the rest to that router. So
 * POST /api/auth/login arrives at authRoutes as POST /login.
 *
 * Authentication is mounted first purely for readability — it is the
 * entry point of the application from a user's perspective.
 */
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/claims', claimRoutes);

/**
 * notFound — reached only if no route above matched.
 *
 * Must come AFTER all routes. Placed earlier, it would catch every
 * request before the real routes ran, and the entire API would 404.
 */
app.use(notFound);

/**
 * errorHandler — must be LAST.
 *
 * Express recognises it as an error handler by its four-argument
 * signature and routes every error here from anywhere above.
 */
app.use(errorHandler);

export default app;
