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
  const focusTypes = new Set(['scripture', 'sermon']);
  const orderRows = await getRange(sheets, sheetId, '🗓 Order of Service!A:D');
  const order = orderRows
    .slice(4)
    .filter(r => r[1] && r[1].trim())
    .map(r => ({
      step:   (r[0] || '').trim(),
      item:   (r[1] || '').trim(),
      detail: (r[2] || '').trim(),
      type:   focusTypes.has((r[3] || '').trim().toLowerCase()) ? 'focus' : '',
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
  // Columns: Date | Preacher | Chairperson | Worship / Music | PP & PA | Chief Usher / Ushers
  const rosterRows = await getRange(sheets, sheetId, '👥 Roster!A:F');
  const roster = rosterRows
    .slice(4)
    .filter(r => r[0] && r[0].trim() && r[1] && r[1].trim())
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

  return { service, order, announcements, prayer, roster, events };
}

module.exports = { fetchBulletinData };
