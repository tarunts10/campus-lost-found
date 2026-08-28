/**
 * models/Institution.js — a school or college.
 *
 * The institution is the ISOLATION BOUNDARY of the whole application.
 * Every user belongs to exactly one, and every item belongs to exactly
 * one. A user must never see data from another institution.
 *
 * That boundary is enforced in controllers, using the institution stored
 * on the authenticated user — never a value supplied by the client.
 */

import mongoose from 'mongoose';

const institutionSchema = new mongoose.Schema(
  {
    /**
     * name — the human-readable title shown in the UI.
     * e.g. "VIT Vellore"
     */
    name: {
      type: String,
      required: [true, 'Institution name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },

    /**
     * slug — a stable, URL-safe identifier.
     * e.g. "vit-vellore"
     *
     * Unique so it can be used in scripts and URLs without ambiguity.
     * The seed script looks institutions up by slug, which makes it
     * safe to re-run: it updates rather than creating duplicates.
     */
    slug: {
      type: String,
      required: [true, 'Institution slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Slug must be lowercase letters, numbers and hyphens only',
      ],
    },

    /**
     * emailDomain — the domain a member's email must end with.
     * e.g. "vitstudent.ac.in"
     *
     * This is what makes registration verifiable: anyone can CLAIM to
     * belong to a college, but only someone with an address at that
     * college's domain can register for it.
     *
     * Stored WITHOUT the "@" and lowercased, so comparison is a simple
     * suffix check against the normalised email.
     *
     * Unique, because two institutions sharing a domain would make the
     * domain check meaningless — a member of one could register as a
     * member of the other.
     */
    emailDomain: {
      type: String,
      required: [true, 'Email domain is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/,
        'Email domain must look like "college.edu" (no @, no protocol)',
      ],
    },

    /**
     * isActive — whether this institution may currently accept sign-ups.
     *
     * Deactivating stops NEW registrations without deleting the
     * institution or orphaning the users and items that reference it.
     * Deleting an institution would break every reference pointing at it,
     * because MongoDB does not enforce referential integrity.
     */
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Institution = mongoose.model('Institution', institutionSchema);

export default Institution;
