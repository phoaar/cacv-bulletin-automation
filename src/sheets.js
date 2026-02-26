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

function getWriteClient() {
  const credPath = path.resolve(process.env.CREDENTIALS_PATH);
  const auth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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
 * Parse a service date string like "22nd February 2026" or "22 Feb 2026" into a local JS Date.
 * Returns null if parsing fails.
 */
function parseServiceDate(dateStr) {
  if (!dateStr) return null;
  const months = {
    january:0,february:1,march:2,april:3,may:4,june:5,
    july:6,august:7,september:8,october:9,november:10,december:11,
    jan:0,feb:1,mar:2,apr:3,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
  };
  const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/i, '$1');
  const parts = cleaned.split(/[\s,/\-]+/);
  let day, month, year;
  for (const p of parts) {
    const num = parseInt(p, 10);
    const key = p.toLowerCase();
    if (!isNaN(num) && num > 31)                             year  = num;
    else if (!isNaN(num) && num >= 1 && num <= 31 && !day)  day   = num;
    else if (months[key] !== undefined)                      month = months[key];
  }
  if (day !== undefined && month !== undefined && year !== undefined) {
    return new Date(year, month, day);
  }
  return null;
}

/**
 * Parse an event date from separate month name, day, and year strings.
 * Day may be a range like "15-16" — uses the start day.
 * Falls back to fallbackYear if yearStr is empty.
 */
function parseEventDate(monthStr, dayStr, yearStr, fallbackYear) {
  const months = {
    january:0,february:1,march:2,april:3,may:4,june:5,
    july:6,august:7,september:8,october:9,november:10,december:11,
    jan:0,feb:1,mar:2,apr:3,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
  };
  const month = months[(monthStr || '').toLowerCase().trim()];
  if (month === undefined) return null;
  const day = parseInt(dayStr); // handles "15", "15th", "15-16"
  if (isNaN(day)) return null;
  const year = parseInt(yearStr) || fallbackYear || new Date().getFullYear();
  return new Date(year, month, day);
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
    morningTea:      details['Morning Tea']         || '',
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
  // Columns: Date | Year | Preacher | Chairperson | Worship Leader | Music / Band | PowerPoint | PA / Sound | Chief Usher | Ushers | Morning Tea
  // Use UNFORMATTED_VALUE so date cells return as serial numbers for reliable comparison.
  const rosterRows = await getRangeRaw(sheets, sheetId, '👥 Roster!A:K');
  const todayUtcMs = Date.UTC(
    new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()
  );
  const roster = rosterRows
    .slice(4)
    .filter(r => {
      if (!r[2] || !String(r[2]).trim()) return false; // must have a preacher (col C)
      if (typeof r[0] === 'number') {
        // Legacy: full serial date — include only if today or in the future
        return sheetsSerialToDate(r[0]).getTime() >= todayUtcMs;
      }
      // Text date + Year column — parse and compare
      const dateStr = String(r[0] || '').trim();
      const year    = String(r[1] || '').trim();
      if (dateStr && year) {
        const parsed = parseServiceDate(`${dateStr} ${year}`);
        if (parsed) return parsed.getTime() >= todayUtcMs;
      }
      return !!dateStr; // include if non-empty, can't compare reliably
    })
    .slice(0, 4)
    .map(r => ({
      date:       typeof r[0] === 'number'
                    ? formatRosterDate(r[0])
                    : `${String(r[0] || '').trim()} ${String(r[1] || '').trim()}`.trim(),
      preacher:   (r[2]  || '').trim(),
      chair:      (r[3]  || '').trim(),
      worship:    (r[4]  || '').trim(),
      music:      (r[5]  || '').trim(),
      powerpoint: (r[6]  || '').trim(),
      paSound:    (r[7]  || '').trim(),
      chiefUsher: (r[8]  || '').trim(),
      ushers:     (r[9]  || '').trim(),
      morningTea: (r[10] || '').trim(),
    }));

  // ── 6. EVENTS ───────────────────────────────────────────────────────────────
  // Rows 0-2: title/instructions. Row 3: column headers. Data from row 4.
  // Columns: Day | Month | Year | Event | Responsible | Show on bulletin? (optional — "no" = hide)
  // Events are auto-included if they fall within the service month + next month
  // and are on or after the service date. Set col F to "no" to manually hide an event.
  const eventRows = await getRange(sheets, sheetId, '📅 Events!A:F');

  const svcDate = parseServiceDate(service.date);
  const fallbackYear = svcDate ? svcDate.getFullYear() : new Date().getFullYear();
  // Window end = last day of the month after the service month
  const windowEnd = svcDate
    ? new Date(svcDate.getFullYear(), svcDate.getMonth() + 2, 0)
    : null;

  const events = eventRows
    .slice(4)
    .filter(r => {
      if (!(r[0] || '').trim()) return false; // must have a day
      if ((r[5] || '').trim().toLowerCase() === 'no') return false; // manually hidden
      if (svcDate && windowEnd) {
        const evDate = parseEventDate(r[1], r[0], r[2], fallbackYear);
        if (evDate) {
          if (evDate < svcDate)   return false; // already passed
          if (evDate > windowEnd) return false; // beyond next month
        }
      }
      return true;
    })
    .map(r => ({
      month:       (r[1] || '').trim(),
      day:         (r[0] || '').trim(),
      event:       (r[3] || '').trim(),
      responsible: (r[4] || '').trim(),
    }));

  // ── 7. SETTINGS ─────────────────────────────────────────────────────────────
  // Simple key-value tab. We look for notification emails and staff contact rows.
  let notificationEmails = [];
  let churchInfo = {
    seniorPastorName:  'Rev Colin Wun',
    seniorPastorPhone: '0434 190 205',
    seniorPastorEmail: 'colinwun@cacv.org.au',
    asstPastorName:    'Ps Kwok Kit Chan',
    asstPastorPhone:   '0452 349 846',
    asstPastorEmail:   'kwokit@cacv.org.au',
    adminEmail:        'admin@cacv.org.au',
  };
  try {
    const settingsRows = await getRange(sheets, sheetId, '⚙️  Settings!A:B');
    const settings = toKV(settingsRows);
    const emailStr = settings['Notification Emails'] || '';
    notificationEmails = emailStr.split(',').map(e => e.trim()).filter(Boolean);
    churchInfo = {
      seniorPastorName:  settings['Senior Pastor Name']     || churchInfo.seniorPastorName,
      seniorPastorPhone: settings['Senior Pastor Phone']    || churchInfo.seniorPastorPhone,
      seniorPastorEmail: settings['Senior Pastor Email']    || churchInfo.seniorPastorEmail,
      asstPastorName:    settings['Assistant Pastor Name']  || churchInfo.asstPastorName,
      asstPastorPhone:   settings['Assistant Pastor Phone'] || churchInfo.asstPastorPhone,
      asstPastorEmail:   settings['Assistant Pastor Email'] || churchInfo.asstPastorEmail,
      adminEmail:        settings['Admin Email']            || churchInfo.adminEmail,
    };
  } catch (e) {
    // Settings tab doesn't exist yet — not a fatal error
  }

  return { service, order, announcements, prayer, roster, events, notificationEmails, churchInfo };
}

/**
 * Write the automation run status and timestamp back to the Settings tab.
 * Looks for rows labelled "Last Run Status" and "Last Run Time" in col A,
 * then updates the corresponding col B values.
 * Silently skips if the Settings tab or rows are missing.
 */
async function updateRunStatus(sheetId, status) {
  const sheets = getWriteClient();

  let statusRowNum = null;
  let timeRowNum   = null;
  try {
    const rows = await getRange(sheets, sheetId, '⚙️  Settings!A:A');
    rows.forEach((row, idx) => {
      const label = (row[0] || '').trim();
      if (label === 'Last Run Status') statusRowNum = idx + 1;
      if (label === 'Last Run Time')   timeRowNum   = idx + 1;
    });
  } catch (e) {
    console.warn(`Could not read Settings tab for status update: ${e.message}`);
    return;
  }

  if (!statusRowNum && !timeRowNum) {
    console.warn('Settings tab is missing "Last Run Status" / "Last Run Time" rows — skipping status update.');
    return;
  }

  const timestamp = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const data = [];
  if (statusRowNum) data.push({ range: `⚙️  Settings!B${statusRowNum}`, values: [[status]] });
  if (timeRowNum)   data.push({ range: `⚙️  Settings!B${timeRowNum}`,   values: [[timestamp]] });

  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });
    console.log(`Sheet status updated: ${status} at ${timestamp}`);
  } catch (e) {
    console.warn(`Could not update sheet status: ${e.message}`);
  }
}

module.exports = { fetchBulletinData, updateRunStatus };
