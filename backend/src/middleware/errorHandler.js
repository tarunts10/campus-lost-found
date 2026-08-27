/**
 * middleware/errorHandler.js — centralized error handling.
 *
 * Every failure in the API funnels through here and leaves in the same
 * shape. Controllers therefore never format error responses themselves:
 * they just throw, and this file decides the status code and wording.
 *
 * Two exports:
 *   notFound     — catches requests that matched no route at all
 *   errorHandler — catches every error thrown anywhere in the app
 */

/**
 * notFound — the last "normal" middleware in the stack.
 *
 * Express tries each route in order. If none matched, execution reaches
 * here. Without it, Express's built-in fallback returns an HTML error
 * page — which breaks any client calling response.json() on it.
 */
export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

/**
 * errorHandler — the global error handler.
 *
 * CRITICAL DETAIL: this function takes FOUR arguments (err, req, res, next).
 * That signature is how Express identifies error-handling middleware.
 * Remove the unused `next` parameter and Express treats this as ordinary
 * middleware and never routes errors to it. The parameter must be present
 * even though we do not call it.
 *
 * Because we use Express 5, an error thrown inside an async controller
 * arrives here automatically. In Express 4 it would not — the request
 * would hang until it timed out.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // Log the FULL error server-side. This is for us, never for the client.
  console.error('--- ERROR ---');
  console.error(`${req.method} ${req.originalUrl}`);
  console.error(err);

  // Defaults, used unless a more specific case below overrides them.
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';

  /**
   * Mongoose ValidationError — a required field is missing, an enum value
   * is wrong, a string is too short. The CLIENT sent bad data, so 400.
   *
   * err.errors is an object keyed by field name. We collect every failure
   * so the client learns about all problems at once, rather than fixing
   * one field and resubmitting to discover the next.
   */
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('. ');
  }

  /**
   * Mongoose CastError — a value could not be converted to the schema type.
   * Most often a malformed ObjectId, but also e.g. "banana" for a Date.
   * Still the client's fault, so 400.
   */
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field '${err.path}'`;
  }

  /**
   * SECURITY: never leak internal details on a 500.
   *
   * A raw 500 message can contain file paths, database internals, or even
   * the connection string (password included). 4xx messages are safe —
   * we wrote them deliberately for the user. 5xx messages are not.
   */
  if (statusCode === 500) {
    message = 'Something went wrong';
  }

  const response = {
    success: false,
    message,
  };

  // In development only, include the stack trace to make debugging bearable.
  // NODE_ENV is "production" on Render, so this never reaches real users.
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
