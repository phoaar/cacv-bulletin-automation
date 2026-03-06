'use strict';

const { 
  parseServiceDate, 
  sheetsSerialToDate, 
  formatRosterDate, 
  parseEventDate, 
  validateEmail 
} = require('./utils');
const { getAccessToken } = require('./google-auth');
const config = require('./config');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const FETCH_TIMEOUT = 15000;
const SHEET_HEADER_ROWS = 4;
const MAX_ANNOUNCEMENTS = 12;

/**
 * Fetch multiple ranges from a spreadsheet in a single API call.
 */
async function batchGet(sheetId, ranges, valueRenderOption = 'FORMATTED_VALUE') {
  const token = await getAccessToken(config.CREDENTIALS_PATH, SCOPES);
  const params = new URLSearchParams({
    valueRenderOption,
    majorDimension: 'ROWS'
  });
  ranges.forEach(r => params.append('ranges', r));

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${params}`;
  
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(`Sheets API Error: ${data.error?.message || 'Unknown'}`);
  
  return data.valueRanges.map(vr => vr.values || []);
}

/**
 * Write values to multiple ranges in a single API call.
 */
async function batchUpdate(sheetId, data) {
  const token = await getAccessToken(config.CREDENTIALS_PATH, SCOPES);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: data.map(item => ({
        range: item.range,
        values: item.values
      }))
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Sheets Update Error: ${err.error?.message || 'Unknown'}`);
  }
}

function toKV(rows) {
  const map = {};
  for (const row of rows) {
    if (row[0] && row[1] !== undefined) map[row[0].trim()] = (row[1] || '').trim();
  }
  return map;
}

// ─── Main Logic ──────────────────────────────────────────────────────────────

async function fetchBulletinData(sheetId) {
  // Fetch all main tabs in one call
  const ranges = [
    "'📋 Service Details'!A:C",
    "'🗓 Order of Service'!A:D",
    "'📢 Announcements'!A:E",
    "'🙏 Prayer Items'!A:C",
    "'📅 Events'!A:F",
    "'⚙️  Settings'!A:B"
  ];
  
  const [
    detailRows,
    orderRows,
    announceRows,
    prayerRows,
    eventRows,
    settingsRows
  ] = await batchGet(sheetId, ranges);
  
  // Roster needs UNFORMATTED_VALUE for date comparison, so it gets its own call
  const [rosterRows] = await batchGet(sheetId, ["'👥 Roster'!A:K"], 'UNFORMATTED_VALUE');

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

  const order = orderRows
    .slice(SHEET_HEADER_ROWS)
    .filter(r => r[1] && r[1].trim())
    .map(r => ({
      step:   (r[0] || '').trim(),
      item:   (r[1] || '').trim(),
      detail: (r[2] || '').trim(),
      type:   (r[3] || '').trim().toLowerCase(),
    }));

  const announcements = announceRows
    .slice(SHEET_HEADER_ROWS)
    .filter(r => r[1] && r[1].trim())
    .slice(0, MAX_ANNOUNCEMENTS)
    .map(r => ({
      title: (r[1] || '').trim(),
      body:  (r[2] || '').trim(),
    }));

  const prayerMap = {};
  const prayerOrder = [];
  for (const row of prayerRows.slice(SHEET_HEADER_ROWS)) {
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

  const _now = new Date();
  const todayMs = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate()).getTime();
  const roster = rosterRows
    .slice(SHEET_HEADER_ROWS)
    .filter(r => {
      if (!r[2] || !String(r[2]).trim()) return false;
      if (typeof r[0] === 'number') {
        const d = sheetsSerialToDate(r[0]);
        const localMs = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
        return localMs >= todayMs;
      }
      const dateStr = String(r[0] || '').trim();
      const year    = String(r[1] || '').trim();
      if (dateStr && year) {
        const parsed = parseServiceDate(`${dateStr} ${year}`);
        if (parsed) return parsed.getTime() >= todayMs;
      }
      return !!dateStr;
    })
    .slice(0, 4)
    .map(r => ({
      date:       typeof r[0] === 'number' ? formatRosterDate(r[0]) : `${String(r[0] || '').trim()} ${String(r[1] || '').trim()}`.trim(),
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

  const svcDate = parseServiceDate(service.date);
  const fallbackYear = svcDate ? svcDate.getFullYear() : new Date().getFullYear();
  const windowEnd = svcDate ? new Date(svcDate.getFullYear(), svcDate.getMonth() + 2, 0) : null;

  const events = eventRows
    .slice(SHEET_HEADER_ROWS)
    .filter(r => {
      if (!(r[0] || '').trim()) return false;
      if ((r[5] || '').trim().toLowerCase() === 'no') return false;
      if (svcDate && windowEnd) {
        const evDate = parseEventDate(r[1], r[0], r[2], fallbackYear);
        if (evDate) {
          if (evDate < svcDate)   return false;
          if (evDate > windowEnd) return false;
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

  const settings = toKV(settingsRows);
  const notificationEmails = (settings['Notification Emails'] || '')
    .split(',')
    .map(e => e.trim())
    .filter(e => e && validateEmail(e));

  const churchInfo = {
    seniorPastorName:  settings['Senior Pastor Name']     || 'Rev Colin Wun',
    seniorPastorPhone: settings['Senior Pastor Phone']    || '0434 190 205',
    seniorPastorEmail: settings['Senior Pastor Email']    || 'colinwun@cacv.org.au',
    asstPastorName:    settings['Assistant Pastor Name']  || 'Ps Kwok Kit Chan',
    asstPastorPhone:   settings['Assistant Pastor Phone'] || '0452 349 846',
    asstPastorEmail:   settings['Assistant Pastor Email'] || 'kwokit@cacv.org.au',
    adminEmail:        settings['Admin Email']            || 'admin@cacv.org.au',
  };

  const pdfAttachments = detailRows
    .filter(r => {
      const label = (r[0] || '').trim().toLowerCase();
      return (label === 'pdf attachment url' || label === 'pdf attachment') && (r[1] || '').trim();
    })
    .map(r => ({
      url: (r[1] || '').trim(),
      name: (r[2] || '').trim() || 'Document'
    }));

  const defaultThemeCells = [
    { letter: 'H', word: 'Healthy Relationships',       desc: 'with God and with others' },
    { letter: 'O', word: 'On Mission',                  desc: 'Everyone, everywhere, all the time' },
    { letter: 'P', word: 'People of Prayer and Praise', desc: '' },
    { letter: 'E', word: 'Empowered & Equipped',        desc: 'by the Holy Spirit for this task' },
  ];
  const theme = {
    year:  settings['Theme Year']  || new Date().getFullYear().toString(),
    title: settings['Theme Title'] || 'Proclaim HOPE',
    cells: [1, 2, 3, 4].map((i, idx) => {
      const raw = (settings[`Theme Cell ${i}`] || '').trim();
      if (!raw) return defaultThemeCells[idx];
      const parts = raw.split('|').map(s => s.trim());
      return { letter: parts[0] || '', word: parts[1] || '', desc: parts[2] || '' };
    }),
  };

  const pdfPassword = (settings['PDF Password'] || '').trim();

  return { service, order, announcements, prayer, roster, events, notificationEmails, churchInfo, pdfAttachments, theme, pdfPassword };
}

async function updateRunStatus(sheetId, status, errors = []) {
  const token = await getAccessToken(config.CREDENTIALS_PATH, SCOPES);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/'⚙️  Settings'!A:A`;

  const res = await fetch(url, { 
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT)
  });
  const data = await res.json();
  const rows = data.values || [];

  let statusRowNum = null;
  let timeRowNum   = null;
  let errorsRowNum = null;
  rows.forEach((row, idx) => {
    const label = (row[0] || '').trim();
    if (label === 'Last Run Status') statusRowNum = idx + 1;
    if (label === 'Last Run Time')   timeRowNum   = idx + 1;
    if (label === 'Last Run Errors') errorsRowNum = idx + 1;
  });

  if (!statusRowNum && !timeRowNum && !errorsRowNum) return;

  const timestamp = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const updates = [];
  if (statusRowNum) updates.push({ range: `⚙️  Settings!B${statusRowNum}`, values: [[status]] });
  if (timeRowNum)   updates.push({ range: `⚙️  Settings!B${timeRowNum}`,   values: [[timestamp]] });
  if (errorsRowNum) {
    const errorText = errors.length > 0 ? errors.map(e => `• ${e}`).join('\n') : '—';
    updates.push({ range: `⚙️  Settings!B${errorsRowNum}`, values: [[errorText]] });
  }

  await batchUpdate(sheetId, updates);
  console.log(`Sheet status updated: ${status} at ${timestamp}`);
}

module.exports = { fetchBulletinData, updateRunStatus };
