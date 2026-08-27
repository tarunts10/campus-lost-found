/**
 * config/db.js — the MongoDB connection.
 *
 * Responsibility: open ONE connection to MongoDB when the app starts.
 *
 * Mongoose keeps a single shared connection pool internally. We connect
 * once here at startup; every model everywhere then uses that same pool.
 * You never open a connection per request — that would be slow and would
 * exhaust the database's connection limit under load.
 */

import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  /**
   * Fail loudly and immediately if configuration is missing.
   *
   * Without this check, `mongoose.connect(undefined)` produces a confusing
   * error far from the real cause. This says exactly what is wrong and how
   * to fix it — the most common setup mistake on a fresh clone.
   */
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy backend/.env.example to backend/.env, ' +
        'then run the server with `npm run dev`.'
    );
  }

  /**
   * serverSelectionTimeoutMS: how long to keep trying before giving up.
   *
   * The default is 30 seconds. When MongoDB is not running, that means the
   * server appears to hang for half a minute before telling you anything.
   * 5 seconds gives us a fast, clear failure in development.
   */
  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  console.log(
    `MongoDB connected -> host: ${conn.connection.host}, database: ${conn.connection.name}`
  );

  /**
   * The await above only covers the INITIAL connection.
   *
   * If MongoDB dies an hour later, that failure arrives as an event, not as
   * a rejected promise. Without a listener, an unhandled 'error' event can
   * crash the process. These listeners keep the app alive and make the
   * problem visible in the logs.
   *
   * Mongoose buffers queries and reconnects automatically, so a brief
   * database blip does not require restarting the API.
   */
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Mongoose will attempt to reconnect.');
  });

  return conn;
};

export default connectDB;
