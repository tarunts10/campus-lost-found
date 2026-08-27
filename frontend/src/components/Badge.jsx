/**
 * components/Badge.jsx — consistent status pills.
 *
 * LOST vs FOUND and the claim statuses are the most important
 * information in the product. Rendering them through one component means
 * they look identical everywhere, so the colour becomes something the
 * user can learn to read at a glance.
 */

const CLASS_BY_VALUE = {
  LOST: 'badge-lost',
  FOUND: 'badge-found',
  ACTIVE: 'badge-active',
  CLAIMED: 'badge-claimed',
  RESOLVED: 'badge-resolved',
  PENDING: 'badge-pending',
  APPROVED: 'badge-approved',
  REJECTED: 'badge-rejected',
};

export default function Badge({ value, label }) {
  const variant = CLASS_BY_VALUE[value] || 'badge-neutral';

  return <span className={`badge ${variant}`}>{label || value}</span>;
}
