'use strict';

/**
 * Validate required bulletin fields and return a list of human-readable issues.
 * Returns an empty array when everything looks good.
 */
function validateBulletin(data) {
  const issues = [];
  const { service, order, announcements, prayer } = data;

  // ── Service Details ────────────────────────────────────────────────────────
  if (!service.date)        issues.push('Service date is missing');
  if (!service.time)        issues.push('Service time is missing');
  if (!service.venue)       issues.push('Venue is missing');
  if (!service.sermonTitle) issues.push('Sermon title is missing');
  if (!service.preacher)    issues.push('Preacher name is missing');

  // ── Order of Service ───────────────────────────────────────────────────────
  if (!order || order.length === 0) {
    issues.push('Order of service is empty');
  }

  // ── Announcements ──────────────────────────────────────────────────────────
  if (!announcements || announcements.length === 0) {
    issues.push('No announcements found');
  }

  // ── Prayer Items ───────────────────────────────────────────────────────────
  if (!prayer || prayer.length === 0) {
    issues.push('No prayer items found');
  }

  return issues;
}

module.exports = { validateBulletin };
