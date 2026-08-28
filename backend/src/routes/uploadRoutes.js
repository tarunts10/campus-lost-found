/**
 * routes/uploadRoutes.js — image upload.
 *
 * The middleware ORDER here is a security decision:
 *
 *   protect            reject anonymous requests before reading any bytes
 *   uploadSingleImage  parse the file, enforce type and size
 *   handleUploadErrors turn multer failures into our 400 shape
 *   uploadImage        verify magic bytes, then send to ImageKit
 *
 * Authentication first means an unauthenticated request never gets to
 * stream megabytes into our process.
 */

import express from 'express';
import { uploadImage } from '../controllers/uploadController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadSingleImage, handleUploadErrors } from '../middleware/upload.js';

const router = express.Router();

router.post(
  '/image',
  protect,
  uploadSingleImage,
  handleUploadErrors,
  uploadImage
);

export default router;
