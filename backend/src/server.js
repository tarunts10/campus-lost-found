/**
 * server.js — the ENTRY POINT.
 *
 * This file answers: "WHERE and HOW does the application run?"
 * It takes the app defined in app.js and binds it to a network port.
 *
 * This is the file that `npm run dev` and `npm start` actually execute.
 */

import app from './app.js'; // ES Modules require the .js extension

/**
 * Which port to listen on.
 *
 * process.env.PORT is an environment variable — a value supplied by
 * whatever is running this process, from outside the code.
 *
 * In production, Render CHOOSES the port and injects it here. An app
 * with a hardcoded port will fail to deploy. Locally no one sets it,
 * so we fall back to 5000.
 */
const PORT = process.env.PORT || 5000;

/**
 * Bind to the port and start listening.
 *
 * This does three things:
 *   1. Asks the OS to reserve PORT for this process.
 *   2. Registers `app` as the handler for arriving requests.
 *   3. Keeps the Node process alive — an open socket is a permanently
 *      pending event, so the event loop never empties and never exits.
 *
 * listen() is asynchronous: it returns before the socket is ready.
 * The callback runs once binding has actually succeeded, which is why
 * the confirmation log belongs inside it rather than after it.
 */
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Health check:     http://localhost:${PORT}/api/health`);
});
