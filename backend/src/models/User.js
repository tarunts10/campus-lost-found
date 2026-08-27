/**
 * models/User.js — the User model.
 *
 * Holds the identity of every college member. Two responsibilities that
 * matter more than the fields themselves:
 *
 *   1. The plaintext password NEVER reaches the database.
 *   2. The password hash NEVER reaches an API response.
 *
 * Both are enforced here, in the model, rather than in controllers.
 * A rule enforced in a controller is a rule someone forgets to copy into
 * the next controller. A rule enforced in the model cannot be skipped.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

export const USER_ROLES = ['STUDENT', 'ADMIN'];

/**
 * bcrypt cost factor.
 *
 * Each increment DOUBLES the time to compute a hash. 12 takes roughly
 * 200-300ms on typical hardware — slow enough that brute-forcing stolen
 * hashes is impractical, fast enough that logging in feels instant.
 *
 * That slowness is the entire point. A fast hash (MD5, SHA-256) can be
 * tested billions of times per second on a GPU. bcrypt is deliberately
 * expensive, which is what makes a stolen database far less useful.
 */
const BCRYPT_SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },

    /**
     * email — the login identifier.
     *
     * lowercase + trim normalise the value BEFORE it is stored, so
     * "Tarun@Example.com " and "tarun@example.com" are the same account.
     * Without normalising, a user could register twice with what looks
     * like one address, and then fail to log in with the "wrong" casing.
     *
     * unique: true creates a UNIQUE INDEX in MongoDB. This is the real
     * guarantee — see the note in authController about why the explicit
     * "does this email exist" check is not sufficient on its own.
     */
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },

    /**
     * password — stores the bcrypt HASH, never the plaintext.
     *
     * select: false means this field is EXCLUDED from every query result
     * unless explicitly asked for with .select('+password').
     *
     * This is the single most valuable line in the file. It means that
     * even a careless `res.json(user)` in some future controller cannot
     * leak the hash, because the hash was never loaded from the database
     * in the first place. Secure by default, opt-in to the risk.
     */
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },

    /**
     * role — STUDENT or ADMIN.
     *
     * Defaults to STUDENT. Note that the register controller NEVER reads
     * a role from the request body: a client that sends {"role":"ADMIN"}
     * is ignored and gets STUDENT like everyone else. Promotion to ADMIN
     * is a deliberate action taken outside the public API.
     */
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: `Role must be one of: ${USER_ROLES.join(', ')}`,
      },
      default: 'STUDENT',
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

/**
 * Hash the password before saving.
 *
 * A pre('save') hook runs automatically on every .save() and .create().
 * Putting the hashing HERE rather than in the controller means it is
 * impossible to forget: any code path that creates or updates a user
 * gets hashing for free.
 *
 * `this` is the document being saved, so this must be a regular function,
 * not an arrow function (arrow functions have no own `this`).
 */
userSchema.pre('save', async function () {
  /**
   * NOTE for anyone following older tutorials: they write this hook as
   * `async function (next) { ... next(); }`. In Mongoose 9 an ASYNC hook
   * receives NO `next` argument — Mongoose simply awaits the returned
   * promise. Calling next() here throws "next is not a function".
   * Return early instead; throw to abort the save.
   */

  /**
   * Only hash when the password actually changed.
   *
   * Without this guard, updating a user's NAME would re-hash the already
   * hashed password, producing a hash of a hash. The user could then
   * never log in again — a genuinely nasty bug, because it appears long
   * after the code that caused it.
   */
  if (!this.isModified('password')) {
    return;
  }

  /**
   * bcrypt.hash generates a random SALT and folds it into the result.
   *
   * The salt is why two users with the same password get different
   * hashes, and why an attacker cannot precompute a lookup table
   * ("rainbow table") that works against every account at once.
   * The salt is stored inside the hash string itself, so it does not
   * need a separate column.
   */
  this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
});

/**
 * Instance method: compare a submitted password against the stored hash.
 *
 * You cannot "decrypt" a bcrypt hash — hashing is one-way by design.
 * What bcrypt.compare does is re-hash the candidate password using the
 * salt embedded in the stored hash, then check whether the results match.
 *
 * It also does that comparison in constant time, so an attacker cannot
 * learn anything from how long the check took.
 *
 * NOTE: this only works if the document was loaded with
 * .select('+password') — otherwise this.password is undefined.
 */
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Defence in depth: strip the password whenever a user is serialised.
 *
 * select: false already prevents the hash from being loaded in normal
 * queries. But the login controller MUST load it (with +password) in
 * order to verify it — and at that moment a careless res.json(user)
 * would leak the hash.
 *
 * toJSON runs automatically whenever res.json() serialises a document,
 * so this closes that window. Two independent protections, because
 * leaking password hashes is not a mistake you get to make twice.
 */
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

export default User;
