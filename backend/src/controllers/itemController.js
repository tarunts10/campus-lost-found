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
 * ======================= TEMPORARY — REMOVE WITH AUTH =======================
 *
 * Every item must record who reported it, but authentication does not exist
 * yet, so there is no real user. This is a fixed, fake ObjectId used for all
 * development data.
 *
 * When the auth milestone lands, the change is:
 *   1. Delete this constant.
 *   2. Replace `DEV_PLACEHOLDER_USER_ID` below with `req.user._id`,
 *      populated by authentication middleware.
 *
 * No schema change and no data migration are needed, because the FIELD is
 * already correct — only the VALUE is fake.
 *
 * Note this ObjectId points at no real User document. That is harmless
 * until we call .populate(), which we do not do yet.
 * ===========================================================================
 */
const DEV_PLACEHOLDER_USER_ID = new mongoose.Types.ObjectId(
  '000000000000000000000001'
);

/**
 * The only query parameters GET /api/items accepts.
 *
 * Anything else is rejected rather than ignored. Silently ignoring an
 * unrecognised filter is worse than it sounds: the request degrades into
 * "return everything", and the caller cannot tell that from a genuine
 * empty-filter request. A typo becomes a silent wrong answer.
 */
const ALLOWED_QUERY_PARAMS = ['type', 'status', 'category', 'page', 'limit'];

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
   * Guard: make sure a JSON body was actually parsed.
   *
   * express.json() only parses bodies whose Content-Type is
   * application/json. If the header is missing, it skips silently and
   * req.body stays undefined — and destructuring undefined throws a
   * TypeError, which would surface as a 500.
   *
   * That would be wrong: forgetting the header is the CLIENT's mistake,
   * so it must be a 4xx. Naming Content-Type in the message turns a
   * confusing "server error" into an obvious fix.
   */
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    const error = new Error(
      'Request body must be a JSON object. Did you set the ' +
        'Content-Type: application/json header?'
    );
    error.statusCode = 400;
    throw error;
  }

  /**
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

    // NOT taken from the client:
    // status   — defaults to ACTIVE in the schema
    // reportedBy — injected by the server (see TEMPORARY note above)
    reportedBy: DEV_PLACEHOLDER_USER_ID,
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
    Item.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
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

  const item = await Item.findById(id);

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
