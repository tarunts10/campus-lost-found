/**
 * config/imagekit.js — the ImageKit client.
 *
 * WHY UPLOADS GO THROUGH OUR BACKEND
 *
 * ImageKit supports uploading straight from the browser, but that needs
 * either the private key in the client (catastrophic — anyone could
 * upload to, and delete from, our account) or a signed-token endpoint,
 * which is most of this file anyway.
 *
 * Routing uploads through the backend means:
 *   - IMAGEKIT_PRIVATE_KEY never leaves the server
 *   - we authenticate the uploader before a single byte is accepted
 *   - we validate type and size ourselves rather than trusting the client
 *   - every file is tagged with its uploader, which is what later lets us
 *     verify that someone attaching a fileId actually owns that file
 *
 * The cost is that image bytes pass through our server. For a campus app
 * with a 5MB cap that is a fine trade.
 */

import ImageKit from 'imagekit';

const REQUIRED_KEYS = [
  'IMAGEKIT_PUBLIC_KEY',
  'IMAGEKIT_PRIVATE_KEY',
  'IMAGEKIT_URL_ENDPOINT',
];

/**
 * Is ImageKit configured on this deployment?
 *
 * Uploads are an optional feature: the rest of the application must work
 * without them. Rather than crashing at startup when the keys are absent,
 * the upload endpoint returns a clear 503 and everything else runs.
 */
export const isImageKitConfigured = () =>
  REQUIRED_KEYS.every((key) => Boolean(process.env[key]));

/**
 * The client is created lazily and cached.
 *
 * Building it at import time would read process.env before the runtime
 * has necessarily finished loading it, and would throw on a deployment
 * that legitimately has no image support configured.
 */
let client = null;

export const getImageKit = () => {
  if (!isImageKitConfigured()) {
    const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
    const error = new Error(
      `Image uploads are not configured on this server (missing: ${missing.join(', ')}).`
    );
    error.statusCode = 503; // Service Unavailable — a real, temporary gap
    throw error;
  }

  if (!client) {
    client = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
  }

  return client;
};

/**
 * Tag applied to every upload, naming the uploader.
 *
 * This is what makes ownership verifiable later. When a user submits an
 * item carrying image fileIds, we ask ImageKit for each file's tags and
 * confirm this user uploaded it — so nobody can attach a fileId they
 * found or guessed belonging to someone else.
 */
export const uploaderTag = (userId) => `uploader_${String(userId)}`;

/**
 * Where files live inside the ImageKit media library.
 *
 * Segregating by institution keeps the library navigable and means a
 * misconfiguration cannot easily mix colleges together.
 */
export const uploadFolder = (institutionSlug) =>
  `/campus-lost-found/${institutionSlug || 'unknown'}`;
