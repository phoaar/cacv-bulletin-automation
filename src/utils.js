'use strict';

/**
 * Shared Constants
 */
// Safer URL Regex to mitigate ReDoS: constrained repetition and required domain structure
const URL_REGEX = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const AUTO_LINK_REGEX = new RegExp(`(${URL_REGEX.source}|${EMAIL_REGEX.source})`, 'g');

const MONTHS_MAP = {
  january:0,february:1,march:2,april:3,may:4,june:5,
  july:6,august:7,september:8,october:9,november:10,december:11,
  jan:0,feb:1,mar:2,apr:3,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
};

const ORDINAL_RE = /(\d+)(st|nd|rd|th)/i;
const DATE_SPLIT_RE = /[\s,/\-]+/;

/**
 * Escape HTML special characters to prevent injection.
 */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Common mapping of service roles to sheet data keys.
 */
function getTeamRoles(s) {
  return [
    { label: 'Preacher',    val: s.preacher },
    { label: 'Chairperson', val: s.chairperson },
    { label: 'Worship',     val: s.worship },
    { label: 'Music',       val: s.music },
    { label: 'PowerPoint',  val: s.powerpoint },
    { label: 'PA / Sound',  val: s.paSound },
    { label: 'Chief Usher', val: s.chiefUsher },
    { label: 'Ushers',      val: s.usher },
    { label: 'Flowers',     val: s.flowers },
    { label: 'Morning Tea', val: s.morningTea },
  ].filter(r => r.val);
}

/**
 * Build a BibleGateway NIV URL from a scripture reference string.
 */
function bibleGatewayUrl(reference) {
  if (!reference) return null;
  const cleaned = reference.replace(/[–—]/g, '-');
  return 'https://www.biblegateway.com/passage/?search=' + encodeURIComponent(cleaned) + '&version=NIV';
}

// YouVersion book abbreviations (NIV = version 111)
const YV_BOOKS = {
  'genesis':'GEN','exodus':'EXO','leviticus':'LEV','numbers':'NUM','deuteronomy':'DEU',
  'joshua':'JOS','judges':'JDG','ruth':'RUT','1 samuel':'1SA','2 samuel':'2SA',
  '1 kings':'1KI','2 kings':'2KI','1 chronicles':'1CH','2 chronicles':'2CH',
  'ezra':'EZR','nehemiah':'NEH','esther':'EST','job':'JOB','psalm':'PSA','psalms':'PSA',
  'proverbs':'PRO','ecclesiastes':'ECC','song of solomon':'SNG','song of songs':'SNG',
  'isaiah':'ISA','jeremiah':'JER','lamentations':'LAM','ezekiel':'EZK','daniel':'DAN',
  'hosea':'HOS','joel':'JOL','amos':'AMO','obadiah':'OBA','jonah':'JON','micah':'MIC',
  'nahum':'NAM','habakkuk':'HAB','zephaniah':'ZEP','haggai':'HAG','zechariah':'ZEC','malachi':'MAL',
  'matthew':'MAT','mark':'MRK','luke':'LUK','john':'JHN','acts':'ACT',
  'romans':'ROM','1 corinthians':'1CO','2 corinthians':'2CO','galatians':'GAL',
  'ephesians':'EPH','philippians':'PHP','colossians':'COL',
  '1 thessalonians':'1TH','2 thessalonians':'2TH','1 timothy':'1TI','2 timothy':'2TI',
  'titus':'TIT','philemon':'PHM','hebrews':'HEB','james':'JAS',
  '1 peter':'1PE','2 peter':'2PE','1 john':'1JN','2 john':'2JN','3 john':'3JN',
  'jude':'JUD','revelation':'REV',
};

/**
 * Build a YouVersion URL from a scripture reference string.
 */
function youVersionUrl(reference) {
  if (!reference) return null;
  const ref = reference.replace(/[–—]/g, '-').trim();
  const match = ref.match(/^(.+?)\s+(\d+)(?::(.+))?$/);
  if (!match) return 'https://www.bible.com/search/bible?q=' + encodeURIComponent(ref) + '&version_id=111';
  const bookKey = match[1].trim().toLowerCase();
  const chapter = match[2];
  const verses  = match[3] ? match[3].replace(/\s/g, '') : null;
  const abbr    = YV_BOOKS[bookKey];
  if (!abbr) return 'https://www.bible.com/search/bible?q=' + encodeURIComponent(ref) + '&version_id=111';
  const location = verses ? `${abbr}.${chapter}.${verses}` : `${abbr}.${chapter}`;
  return `https://www.bible.com/bible/111/${location}.NIV`;
}

/**
 * Extract the first URL found in a string.
 */
function extractUrl(text) {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  if (!match) return null;
  let url = match[0];
  const punctuationMatch = url.match(/[.,!?;:)]+$/);
  if (punctuationMatch) {
    url = url.slice(0, -punctuationMatch[0].length);
  }
  return url.startsWith('http') ? url : `https://${url}`;
}

/**
 * Auto-link URLs and email addresses in raw text.
 */
function autoLink(rawText) {
  if (!rawText) return '';
  
  // Use matchAll to avoid global regex state issues
  const matches = Array.from(rawText.matchAll(AUTO_LINK_REGEX));
  
  let result = '';
  let lastIndex = 0;

  for (const match of matches) {
    result += esc(rawText.slice(lastIndex, match.index));
    
    let url = match[0];
    let trailingPunctuation = '';

    const punctuationMatch = url.match(/[.,!?;:)]+$/);
    if (punctuationMatch) {
      trailingPunctuation = punctuationMatch[0];
      url = url.slice(0, -trailingPunctuation.length);
    }

    if (url.includes('@') && !url.startsWith('http')) {
      result += `<a href="mailto:${esc(url)}">${esc(url)}</a>`;
    } else if (url.startsWith('http')) {
      result += `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`;
    } else {
      result += `<a href="https://${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`;
    }

    result += esc(trailingPunctuation);
    lastIndex = match.index + match[0].length;
  }
  
  result += esc(rawText.slice(lastIndex));
  return result;
}

/**
 * Shared logic for the Order of Service items.
 */
function buildOrderItems(order, isPrint = false) {
  if (!order || order.length === 0) {
    return isPrint 
      ? '<li>No items listed</li>' 
      : '<li class="order-row"><div class="order-idx">—</div><span class="order-name">No items listed</span></li>';
  }

  return order.map((item, i) => {
    const isFocus = item.type === 'scripture' || item.type === 'sermon';
    const focusClass = isFocus ? ' focus' : '';
    
    if (isPrint) {
      const detail = item.detail ? ` <span class="detail">${esc(item.detail)}</span>` : '';
      return `<li>${i + 1}. ${esc(item.item)}${detail}</li>`;
    }

    // Web logic
    const sub = item.detail ? `<span class="order-sub">${esc(item.detail)}</span>` : '';
    const bibleButtons = (item.type === 'scripture' && item.detail) ? `<span class="bible-btns-sm">
        <a class="bible-btn-sm" href="${bibleGatewayUrl(item.detail)}" target="_blank" rel="noopener">BibleGateway</a>
        <a class="bible-btn-sm" href="${youVersionUrl(item.detail)}" target="_blank" rel="noopener">YouVersion</a>
      </span>` : '';
    
    return `      <li class="order-row${focusClass}"><div class="order-idx">${esc(String(i + 1))}</div><span class="order-name">${esc(item.item)}</span>${sub}${bibleButtons}</li>`;
  }).join('\n');
}

/**
 * Shared logic for Announcements.
 */
function buildAnnouncementItems(announcements, isPrint = false) {
  if (!announcements || announcements.length === 0) {
    return isPrint 
      ? '<p class="empty">No announcements this week.</p>'
      : '<p style="color:var(--muted);font-size:13px">No announcements this week.</p>';
  }

  if (isPrint) {
    return '<ol>\n' + announcements.map(a => {
      const body = a.body ? `<span class="ann-body"> — ${autoLink(a.body)}</span>` : '';
      const qrHtml = a.qrSvg
        ? `<div class="ann-qr">${a.qrSvg}</div>` 
        : '';
      const hasQrClass = a.qrSvg ? ' class="has-qr"' : '';
      return `  <li${hasQrClass}><strong>${esc(a.title)}</strong>${body}${qrHtml}</li>`;
    }).join('\n') + '\n</ol>';
  }

  // Web Logic
  return `<div class="announce-stack">\n` + announcements.map((a, i) => {
    return `      <div class="announce">
        <div class="announce-n">${i + 1}</div>
        <div>
          <div class="announce-t">${esc(a.title)}</div>
          <div class="announce-b">${autoLink(a.body)}</div>
        </div>
      </div>`;
  }).join('\n') + '\n    </div>';
}

/**
 * Shared logic for Prayer Items.
 */
function buildPrayerItems(prayer, isPrint = false) {
  if (!prayer || prayer.length === 0) {
    return isPrint
      ? '<p class="empty">No prayer items this week.</p>'
      : '<p style="color:var(--muted);font-size:13px">No prayer items this week.</p>';
  }

  if (isPrint) {
    return prayer.map(group => {
      const points = group.points.map(p => `<div class="prayer-point-print"><span class="bullet">•</span> ${esc(p)}</div>`).join('\n');
      return `<div class="prayer-group-print"><strong>${esc(group.group)}:</strong>\n${points}</div>`;
    }).join('\n');
  }

  // Web Logic
  return `<div class="prayer-groups">\n` + prayer.map(group => {
    const items = group.points.map(p => `        <div class="prayer-item"><div class="prayer-pip"></div>${esc(p)}</div>`).join('\n');
    return `      <div>
        <div class="prayer-group-head">${esc(group.group)}</div>
        <div class="prayer-items">
${items}
        </div>
      </div>`;
  }).join('\n') + '\n    </div>';
}

/**
 * Detects Google Drive URLs and converts them to a direct preview format
 */
function fixDriveUrl(url) {
  if (!url) return '';
  const match = url.match(/[a-zA-Z0-9_-]{25,110}/);
  if (match && (url.includes('drive.google.com') || url.includes('docs.google.com'))) {
    return `https://drive.google.com/file/d/${match[0]}/preview`;
  }
  return url;
}

/**
 * Parse a human-readable date string into a local-midnight Date object.
 */
function parseServiceDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = String(dateStr).replace(ORDINAL_RE, '$1');
  const parts   = cleaned.split(DATE_SPLIT_RE);
  let day, month, year;
  for (const p of parts) {
    const num = parseInt(p, 10);
    const key = p.toLowerCase();
    if (!isNaN(num) && num > 31)                            year  = num;
    else if (!isNaN(num) && num >= 1 && num <= 31 && !day) day   = num;
    else if (MONTHS_MAP[key] !== undefined)                  month = MONTHS_MAP[key];
  }
  if (day !== undefined && month !== undefined && year !== undefined) {
    return new Date(year, month, day);
  }
  return null;
}

/**
 * Normalise a human-readable date string to a YYYYMMDD numeric key.
 */
function dateToKey(dateStr) {
  const d = parseServiceDate(dateStr);
  if (!d) return null;
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Return true if two date strings refer to the same calendar day.
 */
function datesMatch(a, b) {
  const ka = dateToKey(a);
  const kb = dateToKey(b);
  if (ka === null || kb === null) return false;
  return ka === kb;
}

/**
 * Convert Google Sheets serial date number to JS Date.
 */
function sheetsSerialToDate(serial) {
  return new Date((serial - 25569) * 86400 * 1000);
}

/**
 * Format a roster date from serial or raw string.
 */
function formatRosterDate(val) {
  if (typeof val !== 'number') return String(val || '').trim();
  const d = sheetsSerialToDate(val);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Parse event date parts into a Date object.
 */
function parseEventDate(monthStr, dayStr, yearStr, fallbackYear) {
  const month = MONTHS_MAP[(monthStr || '').toLowerCase().trim()];
  if (month === undefined) return null;
  const day = parseInt(dayStr);
  if (isNaN(day)) return null;
  const year = parseInt(yearStr) || fallbackYear || new Date().getFullYear();
  return new Date(year, month, day);
}

/**
 * Basic email validation.
 */
function validateEmail(email) {
  return EMAIL_REGEX.test(email);
}

module.exports = {
  esc, getTeamRoles, bibleGatewayUrl, youVersionUrl,
  autoLink, buildOrderItems, buildAnnouncementItems, buildPrayerItems,
  extractUrl, fixDriveUrl, parseServiceDate,
  sheetsSerialToDate, formatRosterDate, parseEventDate, validateEmail,
  dateToKey, datesMatch,
  URL_REGEX
};
