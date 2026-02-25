'use strict';

const { google } = require('googleapis');
const path = require('path');

/**
 * Authenticate using the service account JSON pointed to by CREDENTIALS_PATH.
 * Returns an authenticated Google Sheets client.
 */
function getClient() {
  const credPath = path.resolve(process.env.CREDENTIALS_PATH);
  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Read a named range from the sheet and return the raw values array.
 * Rows with no data are filtered out.
 */
async function getRange(sheets, sheetId, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });
  return res.data.values || [];
}

/**
 * Build a key→value map from a two-column range (col A = key, col B = value).
 */
function toKV(rows) {
  const map = {};
  for (const row of rows) {
    if (row[0]) map[row[0].trim()] = (row[1] || '').trim();
  }
  return map;
}

/**
 * Fetch all bulletin data from the Google Sheet.
 *
 * Returns a structured object ready for template.js to consume.
 */
async function fetchBulletinData(sheetId) {
  const sheets = getClient();

  // ── 1. SERVICE DETAILS ──────────────────────────────────────────────────────
  const detailRows = await getRange(sheets, sheetId, '📋 Service Details!A:B');
  const details = toKV(detailRows);

  const service = {
    date:             details['Date']             || '',
    time:             details['Time']             || '',
    venue:            details['Venue']            || '',
    sermonTitle:      details['Sermon Title']     || '',
    sermonScripture:  details['Scripture']        || '',
    preacher:         details['Preacher']         || '',
    chairperson:      details['Chairperson']      || '',
    worship:          details['Worship']          || '',
    music:            details['Music']            || '',
    pppa:             details['PP & PA']          || '',
    chiefUsher:       details['Chief Usher']      || '',
    usher:            details['Usher']            || '',
    flowers:          details['Flowers']          || '',
    attendanceEng:    details['Attendance (English)']    || '',
    attendanceChi:    details['Attendance (Chinese)']    || '',
    attendanceKids:   details['Attendance (Children\'s)'] || '',
  };

  // ── 2. ORDER OF SERVICE ─────────────────────────────────────────────────────
  const orderRows = await getRange(sheets, sheetId, '🗓 Order of Service!A:D');
  // Expected columns: Step | Item | Detail | Type
  // Skip header row (row 0)
  const order = orderRows
    .slice(1)
    .filter(r => r[0] || r[1])
    .map(r => ({
      step:   (r[0] || '').trim(),
      item:   (r[1] || '').trim(),
      detail: (r[2] || '').trim(),
      type:   (r[3] || '').trim().toLowerCase(), // 'focus' highlights the row
    }));

  // ── 3. ANNOUNCEMENTS ────────────────────────────────────────────────────────
  const announceRows = await getRange(sheets, sheetId, '📢 Announcements!A:B');
  // Expected columns: Title | Body
  // Skip header row
  const announcements = announceRows
    .slice(1)
    .filter(r => r[0])
    .slice(0, 8)
    .map(r => ({
      title: (r[0] || '').trim(),
      body:  (r[1] || '').trim(),
    }));

  // ── 4. PRAYER ITEMS ─────────────────────────────────────────────────────────
  const prayerRows = await getRange(sheets, sheetId, '🙏 Prayer Items!A:B');
  // Expected columns: Group | Point
  // Skip header row
  const prayerMap = {};
  const prayerOrder = [];
  for (const row of prayerRows.slice(1)) {
    if (!row[1]) continue;
    const group = (row[0] || '').trim();
    const point = (row[1] || '').trim();
    if (!group && prayerOrder.length === 0) continue;
    const effectiveGroup = group || prayerOrder[prayerOrder.length - 1];
    if (!prayerMap[effectiveGroup]) {
      prayerMap[effectiveGroup] = [];
      prayerOrder.push(effectiveGroup);
    }
    prayerMap[effectiveGroup].push(point);
  }
  const prayer = prayerOrder.map(g => ({ group: g, points: prayerMap[g] }));

  // ── 5. ROSTER ───────────────────────────────────────────────────────────────
  const rosterRows = await getRange(sheets, sheetId, '👥 Roster!A:F');
  // Expected columns: Date | Preacher | Chair | Worship/Music | PP&PA | Ushers
  // Skip header row; take up to 4 data rows
  const roster = rosterRows
    .slice(1)
    .filter(r => r[0])
    .slice(0, 4)
    .map(r => ({
      date:         (r[0] || '').trim(),
      preacher:     (r[1] || '').trim(),
      chair:        (r[2] || '').trim(),
      worshipMusic: (r[3] || '').trim(),
      pppa:         (r[4] || '').trim(),
      ushers:       (r[5] || '').trim(),
    }));

  // ── 6. EVENTS ───────────────────────────────────────────────────────────────
  const eventRows = await getRange(sheets, sheetId, '📅 Events!A:E');
  // Expected columns: Month | Day | Event | Responsible | Show
  // Skip header row; only include rows where Show = Yes (col E)
  const events = eventRows
    .slice(1)
    .filter(r => r[1] && (r[4] || '').trim().toLowerCase() === 'yes')
    .map(r => ({
      month:       (r[0] || '').trim(),
      day:         (r[1] || '').trim(),
      event:       (r[2] || '').trim(),
      responsible: (r[3] || '').trim(),
    }));

  return { service, order, announcements, prayer, roster, events };
}

module.exports = { fetchBulletinData };
