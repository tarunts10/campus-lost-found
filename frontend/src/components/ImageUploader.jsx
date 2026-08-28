/**
 * components/ImageUploader.jsx — pick, preview, upload and remove images.
 *
 * Flow, deliberately upload-first:
 *   1. user picks files with a normal <input type="file">
 *   2. each is validated locally and previewed immediately
 *   3. each is uploaded to OUR backend, which forwards it to ImageKit
 *   4. the returned { url, fileId, name } is handed to the parent form
 *   5. the parent submits those references with the item
 *
 * Uploading before the item is submitted means the user sees failures
 * while they can still fix them, rather than losing a filled-in form to
 * a rejected file. The cost is that abandoning the form leaves orphaned
 * files in ImageKit — a documented limitation.
 *
 * Previews come from URL.createObjectURL, so they appear instantly from
 * local memory instead of waiting for a network round trip.
 */

import { useEffect, useRef, useState } from 'react';
import * as uploadService from '../services/uploadService.js';

export default function ImageUploader({ images, onChange, disabled }) {
  const inputRef = useRef(null);

  // Files currently uploading: { key, name, previewUrl, progress, error }
  const [pending, setPending] = useState([]);
  const [error, setError] = useState('');

  /**
   * Object URLs hold a reference to the file in memory until revoked.
   * Not revoking them leaks memory for as long as the page is open.
   */
  useEffect(
    () => () => {
      pending.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    },
    [pending]
  );

  const remaining = uploadService.MAX_IMAGES - images.length;

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);

    // Reset immediately so picking the same file twice still fires onChange.
    event.target.value = '';

    if (files.length === 0) return;
    setError('');

    if (files.length > remaining) {
      setError(
        `You can add ${remaining} more image${remaining === 1 ? '' : 's'} (maximum ${uploadService.MAX_IMAGES} per item).`
      );
      return;
    }

    // Validate everything before uploading anything, so a bad file in the
    // batch does not leave half the selection uploaded.
    const problems = files.map(uploadService.validateImageFile).filter(Boolean);

    if (problems.length > 0) {
      setError(problems.join(' '));
      return;
    }

    const entries = files.map((file) => ({
      key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      error: '',
    }));

    setPending((current) => [...current, ...entries]);

    // Sequential rather than parallel: clearer progress, and it avoids
    // several multi-megabyte requests competing for the same connection.
    for (const entry of entries) {
      try {
        const uploaded = await uploadService.uploadImage(entry.file, {
          onProgress: (progress) =>
            setPending((current) =>
              current.map((item) =>
                item.key === entry.key ? { ...item, progress } : item
              )
            ),
        });

        onChange([...imagesRef.current, uploaded]);

        setPending((current) => {
          const done = current.find((item) => item.key === entry.key);
          if (done) URL.revokeObjectURL(done.previewUrl);
          return current.filter((item) => item.key !== entry.key);
        });
      } catch (err) {
        setPending((current) =>
          current.map((item) =>
            item.key === entry.key ? { ...item, error: err.message } : item
          )
        );
      }
    }
  };

  /**
   * A ref mirroring the latest images prop.
   *
   * The upload loop above is async and closes over `images` as it was
   * when handleFiles started. Uploading three files would then have each
   * one overwrite the previous, because all three would append to the
   * same stale array. Reading through a ref always sees current state.
   */
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const removeUploaded = (fileId) => {
    onChange(images.filter((image) => image.fileId !== fileId));
  };

  const dismissFailed = (key) => {
    setPending((current) => {
      const entry = current.find((item) => item.key === key);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return current.filter((item) => item.key !== key);
    });
  };

  const isBusy = pending.some((entry) => !entry.error);
  const atLimit = remaining <= 0;

  return (
    <div className="field">
      <span className="field-legend" id="images-label">
        Photos <span className="text-subtle">(optional)</span>
      </span>

      <p className="field-hint" id="images-hint">
        Up to {uploadService.MAX_IMAGES} images · JPEG, PNG or WEBP · max 5MB
        each. {images.length}/{uploadService.MAX_IMAGES} added.
      </p>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="image-grid">
        {/* Successfully uploaded images */}
        {images.map((image) => (
          <figure key={image.fileId} className="image-tile">
            <img src={image.url} alt={image.name} loading="lazy" />
            <button
              type="button"
              className="image-remove"
              onClick={() => removeUploaded(image.fileId)}
              disabled={disabled}
              aria-label={`Remove ${image.name}`}
            >
              ✕
            </button>
          </figure>
        ))}

        {/* In-flight or failed uploads */}
        {pending.map((entry) => (
          <figure
            key={entry.key}
            className={`image-tile${entry.error ? ' is-failed' : ' is-uploading'}`}
          >
            <img src={entry.previewUrl} alt="" />

            {entry.error ? (
              <>
                <div className="image-status image-status-error">
                  <span>Upload failed</span>
                </div>
                <button
                  type="button"
                  className="image-remove"
                  onClick={() => dismissFailed(entry.key)}
                  aria-label={`Dismiss failed upload ${entry.name}`}
                >
                  ✕
                </button>
              </>
            ) : (
              <div className="image-status" role="status" aria-live="polite">
                <div className="image-progress">
                  <div
                    className="image-progress-bar"
                    style={{ width: `${entry.progress}%` }}
                  />
                </div>
                <span>{entry.progress}%</span>
              </div>
            )}
          </figure>
        ))}

        {/* The picker itself, styled as a tile so the grid reads as one unit */}
        {!atLimit && (
          <label
            className={`image-add${disabled || isBusy ? ' is-disabled' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={handleFiles}
              disabled={disabled || isBusy}
              aria-describedby="images-hint"
            />
            <span aria-hidden="true" className="image-add-icon">
              +
            </span>
            <span className="image-add-text">
              {isBusy ? 'Uploading…' : 'Add photos'}
            </span>
          </label>
        )}
      </div>

      {pending.some((entry) => entry.error) && (
        <p className="field-error">
          {pending.find((entry) => entry.error)?.error}
        </p>
      )}
    </div>
  );
}
