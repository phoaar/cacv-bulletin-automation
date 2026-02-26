'use strict';

const https = require('https');
const http  = require('http');

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
 * Handles formats like "22nd February 2026", "22 Feb 2026", "16 Mar 2026".
 * Returns null if parsing fails.
 */
function dateToKey(dateStr) {
  if (!dateStr) return null;
  const months = {
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
    jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
  };
  const cleaned = String(dateStr).replace(/(\d+)(st|nd|rd|th)/i, '$1');
  const parts   = cleaned.split(/[\s,/\-]+/);
  let day, month, year;
  for (const p of parts) {
    const num = parseInt(p, 10);
    const key = p.toLowerCase();
    if (!isNaN(num) && num > 31)                           year  = num;
    else if (!isNaN(num) && num >= 1 && num <= 31 && !day) day   = num;
    else if (months[key] !== undefined)                    month = months[key];
  }
  if (day !== undefined && month !== undefined && year !== undefined) {
    return year * 10000 + month * 100 + day;
  }
  return null;
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
  const issues = [];
  if (!announcements || announcements.length === 0) return issues;

  for (const ann of announcements) {
    const text = `${ann.title || ''} ${ann.body || ''}`;
    const urls = [...new Set(text.match(URL_RE) || [])];
    for (const url of urls) {
      const ok = await checkUrl(url);
      if (!ok) issues.push(`Broken link in "${ann.title}": ${url}`);
    }
  }
  return issues;
}

module.exports = { validateBulletin, validateLinks };
