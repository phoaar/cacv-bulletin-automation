'use strict';

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
 * Auto-link URLs and email addresses in raw text.
 */
function autoLink(rawText) {
  // Pattern matches URLs or email addresses. 
  // We use a capture group for the main part, then handle trailing punctuation manually.
  const pattern = /(https?:\/\/[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*(?:\.[a-zA-Z]{2,})+\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  
  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(rawText)) !== null) {
    // Add text before the match
    result += esc(rawText.slice(lastIndex, match.index));
    
    let url = match[1];
    let trailingPunctuation = '';

    // Strip trailing punctuation that is likely part of the sentence, not the URL
    // e.g., "Check this: https://google.com." -> Link should not include the "."
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

    // Add back the punctuation as raw escaped text
    result += esc(trailingPunctuation);
    
    lastIndex = match.index + match[1].length;
  }
  
  result += esc(rawText.slice(lastIndex));
  return result;
}

module.exports = { esc, getTeamRoles, bibleGatewayUrl, youVersionUrl, autoLink };
