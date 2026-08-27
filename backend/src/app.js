/**
 * app.js — the Express APPLICATION.
 *
 * This file answers: "WHAT does this application do?"
 * It wires global middleware and mounts route modules, then exports the
 * configured app.
 *
 * It deliberately does NOT start a server, open a database connection, or
 * know about a port. That is server.js's job. Keeping them apart means
 * tests can import this app and send requests straight into it.
 *
 * ORDER IS EVERYTHING IN THIS FILE. Express runs middleware top to bottom,
 * so the sequence below is the actual request pipeline:
 *
 *   1. Body parsing        (turn raw bytes into req.body)
 *   2. Routes              (do the actual work)
 *   3. notFound            (nothing matched)
 *   4. errorHandler        (something threw)
 */

import express from 'express';
import itemRoutes from './routes/itemRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

/**
 * express.json() — parse incoming JSON request bodies.
 *
 * A request body arrives as a stream of raw bytes. This middleware
 * accumulates them, parses the result as JSON, and puts the object on
 * req.body. Without it, req.body is undefined and every POST fails.
 *
 * It only acts on requests whose Content-Type is application/json, so it
 * costs nothing on GET requests that have no body.
 *
 * The limit caps body size. Default is 100kb; being explicit documents the
 * intent and prevents a client from sending a huge payload to exhaust
 * server memory. Raising it for image uploads happens in a later milestone.
 */
app.use(express.json({ limit: '10kb' }));

/**
 * GET /api/health — health check.
 *
 * Deliberately declared BEFORE the database-backed routes, and deliberately
 * NOT touching the database. A health check must be able to answer even
 * when MongoDB is down — that is precisely how you tell "the API is dead"
 * apart from "the API is up but the database is unreachable".
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HELLO FROM MY BACKEND',
  });
});

/**
 * Mount the item routes under the /api/items prefix.
 *
 * app.use(prefix, router) means: for any request whose path starts with
 * /api/items, strip that prefix and hand the rest to itemRoutes.
 * So GET /api/items/123 arrives at itemRoutes as GET /123.
 */
app.use('/api/items', itemRoutes);

/**
 * notFound — reached only if no route above matched.
 *
 * Must come AFTER all routes. Placed earlier, it would catch every request
 * before the real routes had a chance to run, and the entire API would 404.
 */
app.use(notFound);

/**
 * errorHandler — must be LAST.
 *
 * Express recognises it as an error handler by its four-argument signature
 * and sends every error here, from anywhere above. Registered earlier, it
 * would not see errors thrown by middleware declared after it.
 */
app.use(errorHandler);

export default app;
