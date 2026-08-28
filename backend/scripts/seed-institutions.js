/**
 * scripts/seed-institutions.js — create or update institutions.
 *
 * WHY A SCRIPT AND NOT AN API
 *
 * An institution is the isolation boundary of the whole application. A
 * public "create institution" endpoint would let anyone invent a college,
 * point its emailDomain at a real one, and register inside somebody
 * else's private data. Creating institutions is therefore an
 * administrative act performed with database access, not an API call.
 *
 * USAGE
 *
 *   List what exists:
 *     node --env-file=.env scripts/seed-institutions.js --list
 *
 *   Seed the built-in development examples:
 *     node --env-file=.env scripts/seed-institutions.js --dev
 *
 *   Add or update a real one (this is how an administrator adds a college):
 *     node --env-file=.env scripts/seed-institutions.js \
 *       --name "VIT Vellore" --slug vit-vellore --domain vitstudent.ac.in
 *
 *   Deactivate one (stops new sign-ups; keeps existing users and items):
 *     node --env-file=.env scripts/seed-institutions.js --slug vit-vellore --deactivate
 *
 * The script is IDEMPOTENT: it looks up by slug and updates rather than
 * creating duplicates, so re-running it is always safe.
 */

import mongoose from 'mongoose';
import Institution from '../src/models/Institution.js';

/**
 * Development examples only, and reachable ONLY via the explicit --dev
 * flag. They are deliberately NOT hardcoded anywhere in the application
 * itself — no controller or model references them.
 */
const DEV_INSTITUTIONS = [
  { name: 'VIT Vellore', slug: 'vit-vellore', emailDomain: 'vitstudent.ac.in' },
  { name: 'Example College', slug: 'example-college', emailDomain: 'example.edu' },
];

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

const upsert = async ({ name, slug, emailDomain, isActive = true }) => {
  const existing = await Institution.findOne({ slug });

  if (existing) {
    existing.name = name ?? existing.name;
    existing.emailDomain = emailDomain ?? existing.emailDomain;
    existing.isActive = isActive;
    await existing.save();
    console.log(`  UPDATED  ${existing.slug.padEnd(18)} ${existing.name} @${existing.emailDomain} active=${existing.isActive}`);
    return existing;
  }

  const created = await Institution.create({ name, slug, emailDomain, isActive });
  console.log(`  CREATED  ${created.slug.padEnd(18)} ${created.name} @${created.emailDomain} active=${created.isActive}`);
  return created;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Run with: node --env-file=.env scripts/seed-institutions.js ...');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    // ---- list -------------------------------------------------------
    if (args.flags.has('list') || process.argv.length === 2) {
      const all = await Institution.find({}).sort({ name: 1 });
      console.log(`\nInstitutions (${all.length}):`);
      if (all.length === 0) console.log('  (none — run with --dev to seed examples)');
      for (const i of all) {
        console.log(`  ${String(i._id)}  ${i.slug.padEnd(18)} ${i.name.padEnd(22)} @${i.emailDomain.padEnd(20)} ${i.isActive ? 'ACTIVE' : 'INACTIVE'}`);
      }
      console.log('');
      return;
    }

    // ---- deactivate --------------------------------------------------
    if (args.flags.has('deactivate')) {
      const slug = args.values.slug;
      if (!slug) throw new Error('--deactivate requires --slug <slug>');

      const institution = await Institution.findOne({ slug });
      if (!institution) throw new Error(`No institution with slug "${slug}"`);

      institution.isActive = false;
      await institution.save();
      console.log(`\nDeactivated ${institution.name}. Existing users and items are untouched; new sign-ups are blocked.\n`);
      return;
    }

    // ---- dev seed ----------------------------------------------------
    if (args.flags.has('dev')) {
      console.log('\nSeeding development institutions:');
      for (const institution of DEV_INSTITUTIONS) await upsert(institution);
      console.log('');
      return;
    }

    // ---- explicit single institution ---------------------------------
    const { name, slug, domain } = args.values;

    if (!name || !slug || !domain) {
      console.error(
        '\nUsage:\n' +
          '  --list\n' +
          '  --dev\n' +
          '  --name "College Name" --slug college-slug --domain college.edu\n' +
          '  --slug college-slug --deactivate\n'
      );
      process.exit(1);
    }

    console.log('');
    await upsert({ name, slug, emailDomain: domain });
    console.log('');
  } catch (error) {
    console.error(`\nFailed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

main();
