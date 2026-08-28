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

    const orphans = await collection
      .find({ $or: [{ institutionId: { $exists: false } }, { institutionId: null }] })
      .toArray();

    console.log(`\nUsers with no institution: ${orphans.length}`);

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
          '  2. Assign only those whose email already matches the domain:\n' +
          '       ... --slug <slug> --match-domain --apply\n' +
          '  3. Leave them. They are development accounts; simply register again.\n' +
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
