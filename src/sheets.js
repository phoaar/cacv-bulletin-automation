'use strict';

const { google } = require('googleapis');
const path = require('path');

function getClient() {
  const credPath = path.resolve(process.env.CREDENTIALS_PATH);
  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function getRange(sheets, sheetId, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });
  return res.data.values || [];
}

/**
 * Fetch a range with UNFORMATTED_VALUE so date cells return as Google Sheets
 * serial numbers (integers) rather than locale-formatted strings.
 * Used for the roster to enable reliable date comparison.
 */
async function getRangeRaw(sheets, sheetId, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  return res.data.values || [];
}

/**
 * Convert a Google Sheets date serial number to a JS Date (UTC midnight).
 * Sheets epoch: Dec 30 1899 (includes Lotus 1-2-3 leap year bug → offset 25569).
 */
function sheetsSerialToDate(serial) {
  return new Date((serial - 25569) * 86400 * 1000);
}

/**
 * Format a roster date value (serial number or string) for display.
 * e.g. serial 46085 → "16 Mar 2026"
 */
function formatRosterDate(val) {
  if (typeof val !== 'number') return String(val || '').trim();
  const d = sheetsSerialToDate(val);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Build a key→value map from a two-column range (col A = key, col B = value).
 * Skips section-header rows (those with no value in col B).
 */
function toKV(rows) {
  const map = {};
  for (const row of rows) {
    if (row[0] && row[1] !== undefined) map[row[0].trim()] = (row[1] || '').trim();
  }
  return map;
}

async function fetchBulletinData(sheetId) {
  const sheets = getClient();

  // ── 1. SERVICE DETAILS ──────────────────────────────────────────────────────
  // Structure: rows 0-2 are title/instructions, row 3 is column header,
  // row 4 is "SERVICE INFO" section header, data rows from row 5 onwards.
  // We pass everything to toKV — it naturally ignores section-header rows
  // (those where col B is blank).
  const detailRows = await getRange(sheets, sheetId, '📋 Service Details!A:B');
  const details = toKV(detailRows);

  const service = {
    date:            details['Service Date']        || '',
    time:            details['Service Time']        || '',
    venue:           details['Venue']               || '',
    sermonTitle:     details['Sermon Title']        || '',
    sermonScripture: details['Scripture Reference'] || '',
    preacher:        details['Preacher']            || '',
    chairperson:     details['Chairperson']         || '',
    worship:         details['Worship Leader']      || '',
    music:           details['Music / Band']        || '',
    powerpoint:      details['PowerPoint']          || '',
    paSound:         details['PA / Sound']          || '',
    chiefUsher:      details['Chief Usher']         || '',
    usher:           details['Ushers']              || '',
    flowers:         details['Flowers']             || '',
    attendanceEng:   details['Attendance (English)']      || '',
    attendanceChi:   details['Attendance (Chinese)']      || '',
    attendanceKids:  details["Attendance (Children's)"]   || '',
  };

  // ── 2. ORDER OF SERVICE ─────────────────────────────────────────────────────
  // Rows 0-2: title/instructions. Row 3: column headers. Data from row 4.
  // Columns: # | Service Item | Detail (optional) | Type
  // Type values from sheet: General, Worship, Scripture, Sermon, Prayer
  // We map Scripture and Sermon → 'focus' to highlight those rows.
  const orderRows = await getRange(sheets, sheetId, '🗓 Order of Service!A:D');
  const order = orderRows
    .slice(4)
    .filter(r => r[1] && r[1].trim())
    .map(r => ({
      step:   (r[0] || '').trim(),
      item:   (r[1] || '').trim(),
      detail: (r[2] || '').trim(),
      type:   (r[3] || '').trim().toLowerCase(), // e.g. 'scripture', 'sermon', 'general'
    }));

  // ── 3. ANNOUNCEMENTS ────────────────────────────────────────────────────────
  // Rows 0-2: title/instructions. Row 3: column headers. Data from row 4.
  // Columns: # | Title | Body Text | Keep next week? | Language
  const announceRows = await getRange(sheets, sheetId, '📢 Announcements!A:E');
  const announcements = announceRows
    .slice(4)
    .filter(r => r[1] && r[1].trim())
    .slice(0, 12)
    .map(r => ({
      title: (r[1] || '').trim(),
      body:  (r[2] || '').trim(),
    }));

  // ── 4. PRAYER ITEMS ─────────────────────────────────────────────────────────
  // Rows 0-2: title/instructions. Row 3: column headers. Data from row 4.
  // Columns: Group / Category | Prayer Point | Keep next week?
  // Group name is repeated on every row (not left blank).
  const prayerRows = await getRange(sheets, sheetId, '🙏 Prayer Items!A:C');
  const prayerMap = {};
  const prayerOrder = [];
  for (const row of prayerRows.slice(4)) {
    const point = (row[1] || '').trim();
    if (!point) continue;
    const group = (row[0] || '').trim() || prayerOrder[prayerOrder.length - 1] || 'General';
    if (!prayerMap[group]) {
      prayerMap[group] = [];
      prayerOrder.push(group);
    }
    prayerMap[group].push(point);
  }
  const prayer = prayerOrder.map(g => ({ group: g, points: prayerMap[g] }));

  // ── 5. ROSTER ───────────────────────────────────────────────────────────────
  // Rows 0-2: title/instructions. Row 3: column headers. Data from row 4.
  // Columns: Date | Preacher | Chairperson | Worship Leader | Music / Band | PowerPoint | PA / Sound | Chief Usher | Ushers
  // Use UNFORMATTED_VALUE so date cells return as serial numbers for reliable comparison.
  const rosterRows = await getRangeRaw(sheets, sheetId, '👥 Roster!A:I');
  const todayUtcMs = Date.UTC(
    new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()
  );
  const roster = rosterRows
    .slice(4)
    .filter(r => {
      if (!r[1] || !String(r[1]).trim()) return false; // must have a preacher
      if (typeof r[0] === 'number') {
        // Serial date — include only if today or in the future
        return sheetsSerialToDate(r[0]).getTime() >= todayUtcMs;
      }
      // Non-numeric date (text) — include if non-empty, can't compare reliably
      return !!(r[0] && String(r[0]).trim());
    })
    .slice(0, 4)
    .map(r => ({
      date:       formatRosterDate(r[0]),
      preacher:   (r[1] || '').trim(),
      chair:      (r[2] || '').trim(),
      worship:    (r[3] || '').trim(),
      music:      (r[4] || '').trim(),
      powerpoint: (r[5] || '').trim(),
      paSound:    (r[6] || '').trim(),
      chiefUsher: (r[7] || '').trim(),
      ushers:     (r[8] || '').trim(),
    }));

  // ── 6. EVENTS ───────────────────────────────────────────────────────────────
  // Rows 0-2: title/instructions. Row 3: column headers. Data from row 4.
  // Columns: Month | Day | Event | Responsible | Show on bulletin?
  const eventRows = await getRange(sheets, sheetId, '📅 Events!A:E');
  const events = eventRows
    .slice(4)
    .filter(r => r[1] && r[1].trim() && (r[4] || '').trim().toLowerCase() === 'yes')
    .map(r => ({
      month:       (r[0] || '').trim(),
      day:         (r[1] || '').trim(),
      event:       (r[2] || '').trim(),
      responsible: (r[3] || '').trim(),
    }));

  // ── 7. SETTINGS ─────────────────────────────────────────────────────────────
  // Simple key-value tab. We look for the "Notification Emails" row.
  let notificationEmails = [];
  try {
    const settingsRows = await getRange(sheets, sheetId, '⚙️ Settings!A:B');
    const settings = toKV(settingsRows);
    const emailStr = settings['Notification Emails'] || '';
    notificationEmails = emailStr.split(',').map(e => e.trim()).filter(Boolean);
  } catch (e) {
    // Settings tab doesn't exist yet — not a fatal error
  }

  return { service, order, announcements, prayer, roster, events, notificationEmails };
}

module.exports = { fetchBulletinData };
