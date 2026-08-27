/**
 * server.js — the ENTRY POINT.
 *
 * This file answers: "WHERE and HOW does the application run?"
 * It connects to the database, then binds the app to a network port.
 *
 * This is the file that `npm run dev` and `npm start` actually execute.
 */

import app from './app.js'; // ES Modules require the .js extension
import connectDB from './config/db.js';

const PORT = process.env.PORT || 5000;

/**
 * Environment variables the application cannot run without.
 *
 * Checking these at STARTUP rather than on first use is the difference
 * between "the server refuses to start and tells you why" and "logins
 * mysteriously return 500 at 2am". A missing JWT_SECRET would otherwise
 * stay invisible until the first person tried to log in.
 *
 * Fail loudly, fail immediately, fail with the fix in the message.
 */
const REQUIRED_ENV_VARS = ['MONGODB_URI', 'JWT_SECRET'];

const assertRequiredEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy backend/.env.example to backend/.env and fill in the values.'
    );
  }
};

/**
 * Start the application.
 *
 * ORDER MATTERS: connect to MongoDB BEFORE listening for HTTP traffic.
 *
 * If we listened first, the server would accept requests during the second
 * or two before the database was ready, and those requests would fail for
 * reasons that look like application bugs. Connecting first means that by
 * the time the port is open, the app is genuinely ready to serve.
 */
const startServer = async () => {
  try {
    assertRequiredEnv();
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`Health check:     http://localhost:${PORT}/api/health`);
      console.log(`Items API:        http://localhost:${PORT}/api/items`);
    });
  } catch (error) {
    /**
     * FAIL FAST.
     *
     * If the database is unreachable at startup, there is nothing useful
     * this API can do. Starting anyway would mean every request returns a
     * 500 and the real problem stays buried in the logs.
     *
     * process.exit(1) ends the process with a non-zero code, which is the
     * Unix convention for failure. Render reads that code to know the
     * deployment failed rather than silently serving a broken API.
     */
    console.error('FAILED TO START SERVER');
    console.error(error.message);
    process.exit(1);
  }
};

startServer();
