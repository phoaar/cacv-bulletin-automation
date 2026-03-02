'use strict';

const https = require('https');
const http  = require('http');
const { parseServiceDate } = require('./utils');

/**
 * Validate required bulletin fields and return a list of human-readable issues.
 * Returns an empty array when everything looks good.
 */
function validateBulletin(data) {
  const issues = [];
  const { service, order, announcements, prayer, roster } = data;

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

  // ── Roster gap check (upcoming week = roster[0]) ───────────────────────────
  if (roster && roster.length > 0) {
    if (!roster[0].preacher) issues.push('Upcoming roster: Preacher is not assigned');
    if (!roster[0].paSound)  issues.push('Upcoming roster: PA / Sound is not assigned');
  }

  // ── Service date vs roster date mismatch ──────────────────────────────────
  if (roster && roster.length > 0 && service.date) {
    if (!datesMatch(service.date, roster[0].date)) {
      issues.push(`Service date ("${service.date}") doesn't match roster ("${roster[0].date}")`);
    }
  }

  return issues;
}

/**
 * Normalise a human-readable date string to a YYYYMMDD numeric key for comparison.
 * Returns null if parsing fails.
 */
function dateToKey(dateStr) {
  const d = parseServiceDate(dateStr);
  if (!d) return null;
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Return true if two date strings refer to the same calendar day.
 * Treats null/unparseable dates as non-matching.
 */
function datesMatch(a, b) {
  const ka = dateToKey(a);
  const kb = dateToKey(b);
  if (ka === null || kb === null) return false;
  return ka === kb;
}

// ── URL reachability check ─────────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s"'<>)]+/gi;

/**
 * Send a HEAD request to url.  Returns true for 2xx/3xx, false for 4xx/5xx or errors.
 * Follows up to 3 redirects; times out after 5 s.
 */
function checkUrl(url, redirectsLeft = 3) {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      const lib    = parsed.protocol === 'https:' ? https : http;
      const req    = lib.request(
        { method: 'HEAD', hostname: parsed.hostname, path: parsed.pathname + parsed.search, timeout: 5000 },
        res => {
          const { statusCode, headers } = res;
          // Consume response so socket is released
          res.resume();
          if (statusCode >= 300 && statusCode < 400 && headers.location && redirectsLeft > 0) {
            resolve(checkUrl(headers.location, redirectsLeft - 1));
          } else {
            resolve(statusCode < 400);
          }
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Check all URLs found in announcement titles and bodies.
 * Returns a list of human-readable issues for broken links.
 */
async function validateLinks(announcements) {
  if (!announcements || announcements.length === 0) return [];

  // Collect all unique URLs with their announcement title for reporting
  const checks = [];
  for (const ann of announcements) {
    const text = `${ann.title || ''} ${ann.body || ''}`;
    const urls = [...new Set(text.match(URL_RE) || [])];
    for (const url of urls) {
      checks.push({ url, title: ann.title });
    }
  }

  const results = await Promise.allSettled(checks.map(c => checkUrl(c.url)));

  const issues = [];
  results.forEach((result, i) => {
    const ok = result.status === 'fulfilled' && result.value === true;
    if (!ok) issues.push(`Broken link in "${checks[i].title}": ${checks[i].url}`);
  });
  return issues;
}

module.exports = { validateBulletin, validateLinks };
