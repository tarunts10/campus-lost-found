/**
 * middleware/upload.js — receive an image file safely.
 *
 * Multer parses multipart/form-data, which is how browsers send files.
 * express.json() cannot read it, which is why this exists.
 *
 * Everything here runs BEFORE ImageKit is contacted, so a bad file is
 * rejected without costing an external API call.
 */

import multer from 'multer';

/**
 * 5 MB per image.
 *
 * Generous for a phone photo of a lost wallet, small enough that a
 * handful of concurrent uploads cannot exhaust server memory. The limit
 * is enforced by multer as the stream arrives, so an oversized file is
 * aborted mid-transfer rather than being fully buffered first.
 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const MAX_IMAGES_PER_ITEM = 5;

/**
 * The only formats accepted.
 *
 * A strict allowlist, never a denylist of "bad" types. GIF is excluded
 * because animated files are usually large and add nothing here; SVG is
 * excluded deliberately and importantly — SVG is XML that can contain
 * <script>, so serving user-uploaded SVGs is a stored-XSS vector.
 */
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * memoryStorage keeps the file in a Buffer instead of writing it to disk.
 *
 * Right for this flow: the file is forwarded straight to ImageKit and
 * never needed again. Writing to disk would mean temp files to clean up,
 * a writable filesystem in production, and a window where an uploaded
 * file sits on our server. The size limit is what makes buffering safe.
 */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  /**
   * SECURITY: mimetype is supplied by the CLIENT and can be forged.
   *
   * Checking it stops honest mistakes but is not proof of anything, so
   * the extension is checked too, and the upload controller verifies the
   * file's actual MAGIC BYTES before sending it anywhere. Three layers,
   * because "reject executables" has to mean something stronger than
   * trusting a header the attacker wrote.
   */
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);

  const extension = (file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
  const extensionOk = ALLOWED_EXTENSIONS.includes(extension);

  if (!mimeOk || !extensionOk) {
    const error = new Error(
      `Unsupported file type. Allowed formats: JPEG, PNG, WEBP.`
    );
    error.statusCode = 400;
    return cb(error);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 1,
    fields: 4,
  },
});

/**
 * Accept exactly one file, from a form field named "image".
 *
 * One per request keeps the endpoint simple and gives the frontend
 * per-file progress and per-file error reporting for free.
 */
export const uploadSingleImage = upload.single('image');

/**
 * Translate multer's own errors into our standard shape.
 *
 * Without this, exceeding the size limit produces a raw MulterError that
 * the global handler would report as a 500 — blaming the server for the
 * client sending too large a file.
 */
export const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `Image is too large. Maximum size is ${MAX_FILE_BYTES / (1024 * 1024)}MB.`,
      LIMIT_FILE_COUNT: 'Only one image can be uploaded per request.',
      LIMIT_UNEXPECTED_FILE:
        'Unexpected file field. Send the file in a field named "image".',
    };

    const error = new Error(messages[err.code] || 'File upload failed.');
    error.statusCode = 400;
    return next(error);
  }

  return next(err);
};
