/**
 * middleware/validate.js — run a Zod schema against the request body.
 *
 * Used as: router.post('/login', validate(loginSchema), login)
 *
 * This is a middleware FACTORY: validate(schema) returns a middleware
 * function that closes over that schema. It lets one generic function
 * serve every route instead of writing validation into each controller.
 */

export const validate = (schema) => (req, res, next) => {
  /**
   * Guard: was a JSON body actually parsed?
   *
   * express.json() only parses bodies whose Content-Type is
   * application/json. With the header missing it skips silently, leaving
   * req.body undefined. Zod would then report "expected object, received
   * undefined", which is technically true but unhelpful.
   *
   * Naming Content-Type turns a confusing error into an obvious fix.
   * Handling it HERE means every validated route gets it for free,
   * instead of each controller repeating the same check.
   */
  if (req.body === undefined || req.body === null) {
    const error = new Error(
      'Request body must be a JSON object. Did you set the ' +
        'Content-Type: application/json header?'
    );
    error.statusCode = 400;
    return next(error);
  }

  /**
   * safeParse returns { success, data } or { success, error } instead of
   * throwing. Using it keeps the control flow explicit and lets us build
   * our own error message rather than leaking Zod's internal shape.
   */
  const result = schema.safeParse(req.body);

  if (!result.success) {
    /**
     * Report EVERY problem at once, prefixed by field name.
     * A caller fixing one field at a time across four round trips is a
     * bad experience we can avoid for free.
     *
     * issue.path is an array (["email"]) and can be empty for errors on
     * the object as a whole, such as a completely missing body.
     */
    const message = result.error.issues
      .map((issue) => {
        const field = issue.path.length > 0 ? issue.path.join('.') : 'body';
        return `${field}: ${issue.message}`;
      })
      .join('. ');

    const error = new Error(message);
    error.statusCode = 400;
    return next(error);
  }

  /**
   * SECURITY: replace req.body with the PARSED data.
   *
   * Zod objects strip unknown keys by default, so the controller now
   * receives only the fields declared in the schema. A client sending
   * {"name":"x","email":"...","password":"...","role":"ADMIN"} has the
   * role silently discarded before any controller code can see it.
   *
   * It also carries the transformations through: email arrives already
   * trimmed and lowercased.
   */
  req.body = result.data;
  next();
};
