/**
 * services/uploadService.js — image upload.
 */

import apiClient from './apiClient.js';

export const MAX_IMAGES = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * POST /api/uploads/image
 *
 * Sends ONE file and returns { url, fileId, name }.
 *
 * Note what is NOT here: no ImageKit SDK, no public key, no signature
 * logic. The browser talks only to our own backend, which holds the
 * ImageKit credentials. That is the entire point of proxying uploads —
 * IMAGEKIT_PRIVATE_KEY never exists in code the browser can read.
 */
export const uploadImage = async (file, { onProgress, signal } = {}) => {
  /**
   * FormData produces a multipart/form-data body, which is the encoding
   * browsers use for files. The Content-Type header is deliberately NOT
   * set by hand: the browser must add it itself, because it has to
   * append the multipart boundary marker. Setting it manually is a
   * classic cause of "Unexpected end of form" errors on the server.
   */
  const form = new FormData();
  form.append('image', file);

  const { data } = await apiClient.post('/uploads/image', form, {
    headers: { 'Content-Type': undefined },
    signal,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });

  return data.data;
};

/**
 * Client-side pre-checks, so an obviously invalid file is rejected
 * instantly instead of after a round trip.
 *
 * These are CONVENIENCE ONLY. The backend independently checks the MIME
 * type, the extension, the size, and the file's actual magic bytes —
 * because anything checked here can be bypassed by not using this page.
 */
export const validateImageFile = (file) => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `${file.name}: unsupported format. Use JPEG, PNG or WEBP.`;
  }

  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `${file.name}: too large (${mb}MB). Maximum is 5MB.`;
  }

  return null;
};
