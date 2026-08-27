/**
 * controllers/itemController.js — request handlers for items.
 *
 * Responsibility: handle ONE HTTP request each.
 *   1. Read input from the request (body, query, params)
 *   2. Ask the model to do the data work
 *   3. Choose a status code and send a response
 *
 * This is the ONLY layer that touches req and res. Business rules live in
 * the model; routing lives in routes. Controllers are the translation
 * between "an HTTP request" and "an operation on our data".
 *
 * These functions are `async` and contain no try/catch. That is deliberate:
 * Express 5 automatically forwards a rejected promise to errorHandler.js.
 * (In Express 4 this would silently hang — one of the main reasons we
 * chose Express 5 in the previous milestone.)
 */

import mongoose from 'mongoose';
import Item, {
  ITEM_TYPES,
  ITEM_STATUSES,
  ITEM_CATEGORIES,
} from '../models/Item.js';

/**
 * Which user fields are safe to expose when populating reportedBy.
 *
 * Mongoose replaces the stored ObjectId with the referenced User document.
 * Listing the fields explicitly means only these are fetched from MongoDB
 * in the first place — the password hash is never even loaded, let alone
 * serialised. (The User schema also marks password as select: false, so
 * this is the second of two independent protections.)
 *
 * Email is deliberately omitted. Contact details stay hidden until a claim
 * reaches the verification step, which is a Claims-milestone concern.
 */
const PUBLIC_USER_FIELDS = 'name role';

/**
 * Ownership check: may this user modify this item?
 *
 * Two ways to qualify — you reported it, or you are an ADMIN.
 *
 * SECURITY: req.user comes from authMiddleware, which loaded it from the
 * database using a verified token. It is NOT read from the request body,
 * so a client cannot claim to be someone else or claim to be an admin.
 *
 * The .toString() calls matter: item.reportedBy is an ObjectId and
 * req.user._id is an ObjectId, and comparing two ObjectId OBJECTS with
 * === compares references, not values. Two ObjectIds holding the same id
 * are not === each other. Comparing their string forms is correct.
 */
const canModifyItem = (item, user) =>
  item.reportedBy.toString() === user._id.toString() || user.role === 'ADMIN';

/**
 * Fields a client is allowed to change on an existing item.
 *
 * Deliberately excludes:
 *   reportedBy — ownership is not transferable by request
 *   status     — driven by the Claims workflow, not by direct edits
 *   _id, createdAt, updatedAt — managed by MongoDB and Mongoose
 */
const UPDATABLE_ITEM_FIELDS = [
  'title',
  'description',
  'category',
  'type',
  'location',
  'date',
];

/**
 * The only query parameters GET /api/items accepts.
 *
 * Anything else is rejected rather than ignored. Silently ignoring an
 * unrecognised filter is worse than it sounds: the request degrades into
 * "return everything", and the caller cannot tell that from a genuine
 * empty-filter request. A typo becomes a silent wrong answer.
 */
const ALLOWED_QUERY_PARAMS = [
  'type',
  'status',
  'category',
  'search',
  'page',
  'limit',
];

/**
 * Escape every character that has special meaning in a regular expression.
 *
 * SECURITY: a search term goes straight into a RegExp, and user input in
 * a regex is dangerous in two ways. A term like "a(" is invalid syntax
 * and would throw a 500. Worse, a crafted pattern such as "(a+)+$" can
 * cause catastrophic backtracking — a ReDoS attack that pins the CPU and,
 * because Node is single threaded, freezes the entire server for everyone.
 *
 * Escaping turns every character into a literal, so the term can only
 * ever mean "match this exact text".
 */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Pagination defaults and bounds.
 *
 * MAX_LIMIT exists for protection, not tidiness. Without a cap, a client
 * could send ?limit=1000000 and force the server to load the entire
 * collection into memory and serialise it to JSON — a cheap way to
 * exhaust the server's memory. The cap makes the worst case bounded.
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * Helper: parse a pagination parameter that must be a positive integer.
 *
 * Query values are ALWAYS strings ("2", never 2), so this must convert
 * and validate. Number() is used rather than parseInt() deliberately:
 * parseInt('10abc') returns 10 and silently accepts nonsense, whereas
 * Number('10abc') returns NaN and lets us reject it.
 */
const parsePositiveInt = (value, fieldName, { max } = {}) => {
  if (typeof value !== 'string') {
    const error = new Error(`Invalid ${fieldName}. Expected a single number.`);
    error.statusCode = 400;
    throw error;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    const error = new Error(
      `Invalid ${fieldName} '${value}'. Must be a whole number of 1 or more.`
    );
    error.statusCode = 400;
    throw error;
  }

  if (max !== undefined && parsed > max) {
    const error = new Error(
      `Invalid ${fieldName} '${value}'. Maximum allowed is ${max}.`
    );
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

/**
 * Helper: normalise and validate a query filter value.
 *
 * Uppercasing lets ?type=lost work as well as ?type=LOST — the kind of
 * small thing that saves real confusion.
 *
 * Rejecting unknown values with a clear 400 is better than silently
 * returning an empty array, which leaves the caller unable to tell
 * "no matches" apart from "you made a typo".
 */
const parseEnumFilter = (value, allowed, fieldName) => {
  /**
   * SECURITY — reject anything that is not a plain string.
   *
   * Express 5 parses query strings in "simple" mode by default, so
   * ?type[$ne]=X arrives as the literal key "type[$ne]" and never becomes
   * a nested object. But that is a DEFAULT, not a guarantee: switching to
   * the "extended" parser (Express 4's default) would make req.query.type
   * an object like { $ne: 'X' }, which passed straight to .find() would be
   * a MongoDB operator injection.
   *
   * Checking the type explicitly means this filter is safe under either
   * setting, instead of safe by accident.
   */
  if (typeof value !== 'string') {
    const error = new Error(
      `Invalid ${fieldName} filter. Expected a single text value.`
    );
    error.statusCode = 400;
    throw error;
  }

  const normalised = value.toUpperCase();

  if (!allowed.includes(normalised)) {
    const error = new Error(
      `Invalid ${fieldName} filter '${value}'. Must be one of: ${allowed.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  return normalised;
};

/**
 * POST /api/items
 * Create a new lost or found item report.
 */
export const createItem = async (req, res) => {
  /**
   * No body guard needed here any more: validate(createItemSchema) runs
   * before this controller and has already rejected a missing, malformed
   * or invalid body with a 400.
   *
   * SECURITY — explicit field picking, NOT `Item.create(req.body)`.
   *
   * Passing req.body straight through is a mass-assignment vulnerability.
   * Mongoose drops fields that are not in the schema, but `status` and
   * `reportedBy` ARE in the schema — so a malicious client could set
   * status to RESOLVED, or attribute the report to another student.
   *
   * Listing the allowed fields by hand means anything else the client
   * sends is ignored. Whitelist, never blacklist.
   */
  const { title, description, category, type, location, date } = req.body;

  const item = await Item.create({
    title,
    description,
    category,
    type,
    location,
    date,

    /**
     * NOT taken from the client:
     *   status     — defaults to ACTIVE in the schema
     *   reportedBy — taken from the VERIFIED identity, never the body
     *
     * req.user was loaded by authMiddleware from a cryptographically
     * verified JWT. It is the only trustworthy statement of who is making
     * this request. If a client sends {"reportedBy": "<someone else>"},
     * that value is simply never read — the line below overwrites nothing
     * because the forged field was never destructured above.
     */
    reportedBy: req.user._id,
  });

  /**
   * 201 Created, not 200 OK.
   *
   * 201 specifically means "a new resource now exists". It tells any HTTP
   * client something was created rather than merely read.
   */
  res.status(201).json({
    success: true,
    data: item,
  });
};

/**
 * GET /api/items
 * List items, with optional filtering by type, category and status.
 *
 * Examples:
 *   GET /api/items
 *   GET /api/items?type=LOST
 *   GET /api/items?status=ACTIVE&category=ELECTRONICS
 */
export const getItems = async (req, res) => {
  /**
   * Build the filter from whitelisted query parameters only.
   *
   * SECURITY: we never pass req.query to .find() directly. Query values
   * can be objects (?type[$ne]=X arrives as an object, not a string), which
   * would let a client inject MongoDB operators and bypass the filter
   * entirely. This is NoSQL injection. Reading known keys by name and
   * validating each one prevents it.
   *
   * An empty filter object {} means "match everything" — which is exactly
   * what we want when no query parameters are supplied.
   */
  const filter = {};

  /**
   * Reject unrecognised query parameters instead of ignoring them.
   *
   * This also catches injection-shaped input: ?type[$ne]=X produces the
   * literal key "type[$ne]" under Express 5's default parser, which is not
   * in the allowed list and is therefore refused with a clear 400 rather
   * than quietly returning the entire collection.
   */
  const unknownParams = Object.keys(req.query).filter(
    (key) => !ALLOWED_QUERY_PARAMS.includes(key)
  );

  if (unknownParams.length > 0) {
    const error = new Error(
      `Unknown query parameter(s): ${unknownParams.join(', ')}. ` +
        `Allowed parameters: ${ALLOWED_QUERY_PARAMS.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (req.query.type !== undefined) {
    filter.type = parseEnumFilter(req.query.type, ITEM_TYPES, 'type');
  }

  if (req.query.status !== undefined) {
    filter.status = parseEnumFilter(req.query.status, ITEM_STATUSES, 'status');
  }

  if (req.query.category !== undefined) {
    filter.category = parseEnumFilter(
      req.query.category,
      ITEM_CATEGORIES,
      'category'
    );
  }

  /**
   * TEXT SEARCH — ?search=wallet
   *
   * Matches the term anywhere in the title OR the description,
   * case-insensitively. $or means "either condition satisfies the match".
   *
   * WHY REGEX RATHER THAN A MONGODB TEXT INDEX:
   *   - A text index matches whole WORDS after stemming, so "wall" would
   *     not find "wallet" — which is not what someone typing into a
   *     search box expects.
   *   - Regex does substring matching, which is the intuitive behaviour.
   *
   * THE COST, stated honestly: an unanchored regex cannot use an index,
   * so this scans every matching document. That is fine for a campus
   * collection of a few thousand items and would need a proper text index
   * (or Atlas Search) at a much larger scale. The right time to change it
   * is when a measurement says so, not before.
   */
  if (req.query.search !== undefined) {
    if (typeof req.query.search !== 'string') {
      const error = new Error('Invalid search. Expected a single text value.');
      error.statusCode = 400;
      throw error;
    }

    const term = req.query.search.trim();

    if (term.length === 0) {
      const error = new Error('Search term cannot be empty');
      error.statusCode = 400;
      throw error;
    }

    if (term.length > 100) {
      const error = new Error('Search term cannot exceed 100 characters');
      error.statusCode = 400;
      throw error;
    }

    const pattern = new RegExp(escapeRegex(term), 'i');

    filter.$or = [{ title: pattern }, { description: pattern }];
  }

  /**
   * PAGINATION
   *
   * Why it exists: `Item.find(filter)` with no limit returns EVERY matching
   * document. That is fine with 4 items and catastrophic with 50,000 — the
   * server loads them all into memory, serialises megabytes of JSON, and the
   * client waits. Pagination makes the cost of a request constant rather
   * than growing with the size of the collection.
   */
  const page =
    req.query.page !== undefined
      ? parsePositiveInt(req.query.page, 'page')
      : DEFAULT_PAGE;

  const limit =
    req.query.limit !== undefined
      ? parsePositiveInt(req.query.limit, 'limit', { max: MAX_LIMIT })
      : DEFAULT_LIMIT;

  /**
   * skip = how many documents to step over before collecting results.
   *   page 1, limit 10 -> skip 0   (items 1-10)
   *   page 2, limit 10 -> skip 10  (items 11-20)
   */
  const skip = (page - 1) * limit;

  /**
   * Two queries are needed: one for this page of documents, one for the
   * TOTAL count of matches. The count is what lets the client know how many
   * pages exist — .find() alone can never tell you that.
   *
   * Promise.all runs them concurrently instead of one after the other.
   * Both are independent, so waiting for the first before starting the
   * second would roughly double the response time for no reason. This is
   * the single-threaded event loop being useful: while one query is in
   * flight, the thread is free to issue the other.
   */
  const [items, total] = await Promise.all([
    Item.find(filter)
      .populate('reportedBy', PUBLIC_USER_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Item.countDocuments(filter),
  ]);

  /**
   * Math.ceil, because a remainder still needs a whole page:
   * 25 items at 10 per page is 3 pages, not 2.5.
   */
  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    success: true,
    count: items.length, // how many are in THIS page
    pagination: {
      page,
      limit,
      total, // total matching the filter, across all pages
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: items,
  });
};

/**
 * GET /api/items/:id
 * Fetch a single item by its MongoDB _id.
 */
export const getItemById = async (req, res) => {
  const { id } = req.params;

  /**
   * Check the ID is a well-formed ObjectId BEFORE querying.
   *
   * Without this, Mongoose throws a CastError which our error handler
   * would turn into a 400 anyway — but checking here produces a clearer
   * message and avoids a pointless round trip to the database.
   *
   * 400 (not 404) is correct: "abc" is not an ID that could ever exist,
   * so the request itself is malformed. 404 would imply the ID was valid
   * but absent.
   */
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(`'${id}' is not a valid item ID`);
    error.statusCode = 400;
    throw error;
  }

  const item = await Item.findById(id).populate(
    'reportedBy',
    PUBLIC_USER_FIELDS
  );

  /**
   * findById returns null when nothing matches — it does not throw.
   * Forgetting this check is one of the most common Mongoose bugs: the
   * code carries on with `null` and fails confusingly somewhere later.
   *
   * 404 here is correct: the ID is well-formed, there is simply no such item.
   */
  if (!item) {
    const error = new Error('Item not found');
    error.statusCode = 404;
    throw error;
  }

  res.status(200).json({
    success: true,
    data: item,
  });
};

/**
 * Helper shared by update and delete: validate the id, load the item,
 * and confirm this user is allowed to modify it.
 *
 * Returns the item, or throws the appropriate error.
 */
const loadItemForModification = async (id, user) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(`'${id}' is not a valid item ID`);
    error.statusCode = 400;
    throw error;
  }

  const item = await Item.findById(id);

  if (!item) {
    const error = new Error('Item not found');
    error.statusCode = 404;
    throw error;
  }

  /**
   * AUTHORISATION — the check that makes this endpoint safe.
   *
   * 403 Forbidden, not 401 Unauthorised. The distinction is real:
   *   401 = "I do not know who you are"      (no or bad token)
   *   403 = "I know exactly who you are, and you may not do this"
   *
   * The user IS authenticated here — authMiddleware already proved that.
   * They simply do not own this item.
   */
  if (!canModifyItem(item, user)) {
    const error = new Error('You do not have permission to modify this item');
    error.statusCode = 403;
    throw error;
  }

  return item;
};

/**
 * PATCH /api/items/:id
 * Update an item. Owner or ADMIN only.
 *
 * PATCH rather than PUT: PATCH means "apply these partial changes",
 * which matches sending only the fields you want to alter. PUT means
 * "replace the entire resource", which would require sending every field
 * every time and would blank out anything omitted.
 */
export const updateItem = async (req, res) => {
  /**
   * validate(updateItemSchema) has already run: the body is a valid
   * object containing at least one updatable field, and Zod has STRIPPED
   * every key not in the schema — so reportedBy and status are literally
   * absent from req.body by the time this runs.
   */
  const item = await loadItemForModification(req.params.id, req.user);

  /**
   * SECURITY — apply only whitelisted fields.
   *
   * Same mass-assignment defence as createItem. Without this loop, a
   * request containing {"reportedBy": "<attacker id>"} would transfer
   * ownership of the item, and {"status": "RESOLVED"} would bypass the
   * claims workflow entirely.
   *
   * Anything not in UPDATABLE_ITEM_FIELDS is silently ignored.
   */
  const applied = [];

  for (const field of UPDATABLE_ITEM_FIELDS) {
    if (req.body[field] !== undefined) {
      item[field] = req.body[field];
      applied.push(field);
    }
  }

  if (applied.length === 0) {
    const error = new Error(
      `No updatable fields supplied. Allowed: ${UPDATABLE_ITEM_FIELDS.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  /**
   * .save() rather than findByIdAndUpdate().
   *
   * save() runs the full Mongoose validation pipeline — casting, enums,
   * the custom future-date validator — exactly as it does on create.
   * findByIdAndUpdate skips most validators unless explicitly told to
   * with runValidators: true, which is a very easy thing to forget.
   */
  await item.save();
  await item.populate('reportedBy', PUBLIC_USER_FIELDS);

  res.status(200).json({
    success: true,
    data: item,
  });
};

/**
 * DELETE /api/items/:id
 * Delete an item. Owner or ADMIN only.
 */
export const deleteItem = async (req, res) => {
  const item = await loadItemForModification(req.params.id, req.user);

  await item.deleteOne();

  /**
   * 200 with a confirmation body rather than 204 No Content.
   *
   * 204 is also correct and common, but it forbids a response body,
   * which would make this the only endpoint in the API that does not
   * return the { success, data } envelope. Consistency for the frontend
   * is worth more here than protocol purity.
   */
  res.status(200).json({
    success: true,
    data: { _id: item._id, message: 'Item deleted' },
  });
};
