/**
 * scripts/migrate-users-to-institution.js
 *
 * THE MIGRATION PROBLEM
 *
 * User.institutionId is now REQUIRED. Every account created before this
 * milestone predates the field, so those users have no institution.
 *
 * That is not a cosmetic gap. authMiddleware refuses any request from a
 * user without an institution — failing closed, because a missing
 * institution would otherwise make every isolation filter compare
 * against `undefined`, and an undefined comparison is exactly the kind
 * of bug that silently returns the wrong college's data.
 *
 * So those accounts cannot log in until they are assigned somewhere.
 *
 * WHY THIS IS NOT AUTOMATIC
 *
 * Assigning a user to an institution decides WHICH PRIVATE DATA THEY CAN
 * SEE. Guessing — from the email domain, or by picking the first
 * institution in the collection — could place a real person inside a
 * college they do not belong to. There is no safe default, so this
 * script refuses to choose: it reports what it found and requires an
 * explicit target.
 *
 * It also never deletes anything.
 *
 * USAGE
 *
 *   Report only (default — changes nothing):
 *     node --env-file=.env scripts/migrate-users-to-institution.js
 *
 *   Preview a specific assignment:
 *     node --env-file=.env scripts/migrate-users-to-institution.js --slug example-college
 *
 *   Actually apply it:
 *     node --env-file=.env scripts/migrate-users-to-institution.js --slug example-college --apply
 *
 *   Restrict to users whose email matches the institution's domain:
 *     ... --slug example-college --match-domain --apply
 *
 *   Assign ONE specific account (the safest option, and the one to
 *   prefer for a known development user):
 *     ... --email you@gmail.com --slug vit-vellore --apply
 *
 * DOMAIN MISMATCH
 *
 * Registration requires the email domain to match the institution's, but
 * that rule runs at sign-up only. A pre-existing account may have an
 * address from anywhere — a development account on @gmail.com, say.
 *
 * Assigning such a user is refused unless --allow-domain-mismatch is
 * passed, so the inconsistency is always a deliberate, recorded choice
 * rather than something that happens quietly.
 */

import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Institution from '../src/models/Institution.js';

const parseArgs = (argv) => {
  const args = { flags: new Set(), values: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.values[key] = next;
      i += 1;
    } else {
      args.flags.add(key);
    }
  }
  return args;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    /**
     * Query the raw collection, not the Mongoose model.
     *
     * The model now requires institutionId, and some drivers/validators
     * behave awkwardly around documents that predate a required field.
     * The raw collection shows exactly what is stored.
     */
    const collection = mongoose.connection.db.collection('users');

    const missingInstitution = {
      $or: [{ institutionId: { $exists: false } }, { institutionId: null }],
    };

    /**
     * --email narrows the operation to ONE named account.
     *
     * This is the safest form of the migration and the one to prefer for
     * a known development user: it cannot touch anybody else, even by
     * accident, because the query itself is scoped to that address.
     *
     * The email is lowercased to match how the User schema stores it.
     */
    const targetEmail = args.values.email
      ? String(args.values.email).trim().toLowerCase()
      : null;

    const query = targetEmail
      ? { ...missingInstitution, email: targetEmail }
      : missingInstitution;

    const orphans = await collection.find(query).toArray();

    if (targetEmail) {
      console.log(`\nTargeting a single account: ${targetEmail}`);

      if (orphans.length === 0) {
        // Distinguish "already migrated" from "no such user" — they need
        // very different responses from whoever is running this.
        const existing = await collection.findOne({ email: targetEmail });

        if (!existing) {
          console.log('No user with that email exists.\n');
        } else {
          console.log('That user already has an institution. Nothing to do.\n');
        }

        return;
      }
    } else {
      console.log(`\nUsers with no institution: ${orphans.length}`);
    }

    if (orphans.length === 0) {
      console.log('Nothing to migrate.\n');
      return;
    }

    for (const user of orphans) {
      console.log(`  ${String(user._id)}  ${String(user.email).padEnd(30)} role=${user.role}`);
    }

    const slug = args.values.slug;

    if (!slug) {
      console.log(
        '\nThese accounts CANNOT log in until they are assigned an institution.\n' +
          '\nThis script will not guess for you: choosing an institution decides which\n' +
          'private data an account can read, and there is no safe default.\n' +
          '\nOptions:\n' +
          '  1. Assign them explicitly:\n' +
          '       node --env-file=.env scripts/seed-institutions.js --list\n' +
          '       node --env-file=.env scripts/migrate-users-to-institution.js --slug <slug> --apply\n' +
          '  2. Assign ONE named account (safest — cannot touch anyone else):\n' +
          '       ... --email you@example.com --slug <slug> --apply\n' +
          '  3. Assign only those whose email already matches the domain:\n' +
          '       ... --slug <slug> --match-domain --apply\n' +
          '  4. Leave them. They are development accounts; simply register again.\n' +
          '     Nothing is deleted either way.\n'
      );
      return;
    }

    const institution = await Institution.findOne({ slug });

    if (!institution) {
      console.error(`\nNo institution with slug "${slug}". Run seed-institutions.js --list\n`);
      process.exitCode = 1;
      return;
    }

    const matchDomain = args.flags.has('match-domain');

    const targets = orphans.filter((user) => {
      if (!matchDomain) return true;
      return String(user.email).split('@').pop() === institution.emailDomain;
    });

    const skipped = orphans.length - targets.length;

    console.log(`\nTarget institution: ${institution.name} (@${institution.emailDomain})`);
    console.log(`Would assign: ${targets.length} user(s)${skipped ? `, skipping ${skipped} whose email domain does not match` : ''}`);

    for (const user of targets) console.log(`  -> ${user.email}`);

    /**
     * DOMAIN MISMATCH GUARD.
     *
     * Registration enforces "your email domain must match the
     * institution's", but only at sign-up. Assigning an existing account
     * whose address does not match creates a user the registration rules
     * would never have produced.
     *
     * That is sometimes exactly what is wanted (a development account on
     * a personal address). It must still be stated out loud rather than
     * happening quietly, so it is refused without an explicit flag.
     */
    const mismatched = targets.filter(
      (user) => String(user.email).split('@').pop() !== institution.emailDomain
    );

    if (mismatched.length > 0 && !args.flags.has('allow-domain-mismatch')) {
      console.log(
        `\nREFUSED: ${mismatched.length} account(s) do not use @${institution.emailDomain}:\n` +
          mismatched.map((u) => `  ${u.email}`).join('\n') +
          '\n\nRegistration would never have allowed this pairing, so it is not done\n' +
          'silently. If this is intentional (a development account on a personal\n' +
          'address, for example), re-run with --allow-domain-mismatch.\n'
      );
      return;
    }

    if (!args.flags.has('apply')) {
      console.log('\nDRY RUN — nothing was changed. Re-run with --apply to commit.\n');
      return;
    }

    if (targets.length === 0) {
      console.log('\nNothing to do.\n');
      return;
    }

    const result = await collection.updateMany(
      { _id: { $in: targets.map((user) => user._id) } },
      { $set: { institutionId: institution._id, updatedAt: new Date() } }
    );

    console.log(`\nAssigned ${result.modifiedCount} user(s) to ${institution.name}.\n`);
  } catch (error) {
    console.error(`\nFailed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

main();
