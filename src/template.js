'use strict';

/**
 * Escape HTML special characters to prevent injection.
 */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a BibleGateway NIV URL from a scripture reference string.
 * e.g. "Matthew 3:1–17" → https://www.biblegateway.com/passage/?search=Matthew+3%3A1-17&version=NIV
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
 * e.g. "Matthew 3:1–17" → https://www.bible.com/bible/111/MAT.3.1-17.NIV
 * Opens in the YouVersion app on mobile, falls back to bible.com on desktop.
 */
function youVersionUrl(reference) {
  if (!reference) return null;
  // Normalise dashes and split into book + location
  const ref = reference.replace(/[–—]/g, '-').trim();
  // Match "Book Name Chapter:Verses" or "Book Name Chapter"
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
 * Build the Order of Service list items.
 */
function buildOrder(order) {
  if (!order || order.length === 0) return '<li class="order-row"><div class="order-idx">—</div><span class="order-name">No items listed</span></li>';

  return order.map((item, i) => {
    const isFocus = item.type === 'scripture' || item.type === 'sermon';
    const focusClass = isFocus ? ' focus' : '';
    const sub = item.detail ? `<span class="order-sub">${esc(item.detail)}</span>` : '';
    // Bible buttons only on scripture rows with a passage in the detail field
    const bibleButtons = (item.type === 'scripture' && item.detail) ? `<span class="bible-btns-sm">
        <a class="bible-btn-sm" href="${bibleGatewayUrl(item.detail)}" target="_blank" rel="noopener">BibleGateway</a>
        <a class="bible-btn-sm" href="${youVersionUrl(item.detail)}" target="_blank" rel="noopener">YouVersion</a>
      </span>` : '';
    return `      <li class="order-row${focusClass}"><div class="order-idx">${esc(String(i + 1))}</div><span class="order-name">${esc(item.item)}</span>${sub}${bibleButtons}</li>`;
  }).join('\n');
}

/**
 * Build the Service Team chips.
 */
function buildTeam(s) {
  const roles = [
    { role: 'Preacher',    name: s.preacher    },
    { role: 'Chairperson', name: s.chairperson },
    { role: 'Worship',     name: s.worship     },
    { role: 'Music',       name: s.music       },
    { role: 'PowerPoint',  name: s.powerpoint  },
    { role: 'PA / Sound',  name: s.paSound     },
    { role: 'Chief Usher', name: s.chiefUsher  },
    { role: 'Usher',       name: s.usher       },
    { role: 'Flowers',     name: s.flowers     },
  ];

  return roles
    .filter(r => r.name)
    .map(r => `      <div class="team-chip"><div class="team-role">${esc(r.role)}</div><div class="team-name">${esc(r.name)}</div></div>`)
    .join('\n');
}

/**
 * Auto-link URLs (with or without protocol) and email addresses in raw text.
 * Escapes all non-link text. Works on raw (unescaped) input.
 */
function autoLink(rawText) {
  const pattern = /(https?:\/\/[^\s]+|[a-zA-Z0-9][a-zA-Z0-9-]*(?:\.[a-zA-Z]{2,})+\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  let result = '';
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(rawText)) !== null) {
    result += esc(rawText.slice(lastIndex, match.index));
    const url = match[1];
    if (url.includes('@') && !url.startsWith('http')) {
      result += `<a href="mailto:${esc(url)}">${esc(url)}</a>`;
    } else if (url.startsWith('http')) {
      result += `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`;
    } else {
      result += `<a href="https://${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`;
    }
    lastIndex = match.index + url.length;
  }
  result += esc(rawText.slice(lastIndex));
  return result;
}

/**
 * Build the Announcements list.
 */
function buildAnnouncements(announcements) {
  if (!announcements || announcements.length === 0) return '<p style="color:var(--muted);font-size:13px">No announcements this week.</p>';

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
 * Build the Prayer Items section.
 */
function buildPrayer(prayer) {
  if (!prayer || prayer.length === 0) return '<p style="color:var(--muted);font-size:13px">No prayer items this week.</p>';

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
 * Build the Roster table rows.
 */
function buildRoster(roster) {
  if (!roster || roster.length === 0) return '<tr><td colspan="6" style="color:var(--muted);text-align:center">No roster data available</td></tr>';
  return roster.map(r =>
    `          <tr><td>${esc(r.date)}</td><td>${esc(r.preacher)}</td><td>${esc(r.chair)}</td><td>${esc(r.worshipMusic)}</td><td>${esc(r.pppa)}</td><td>${esc(r.ushers)}</td></tr>`
  ).join('\n');
}

/**
 * Build the Events table rows.
 * Suppress repeated month values (show blank in merged-style rows).
 */
function buildEvents(events) {
  if (!events || events.length === 0) return '<tr><td colspan="4" style="color:var(--muted);text-align:center">No upcoming events</td></tr>';

  let lastMonth = '';
  return events.map(e => {
    const displayMonth = e.month !== lastMonth ? e.month : '';
    if (e.month) lastMonth = e.month;
    return `          <tr><td>${esc(displayMonth)}</td><td>${esc(e.day)}</td><td>${esc(e.event)}</td><td>${esc(e.responsible)}</td></tr>`;
  }).join('\n');
}

/**
 * Build the full bulletin HTML from the structured data object.
 */
function buildBulletin(data) {
  const { service, order, announcements, prayer, roster, events } = data;

  const engAtt  = service.attendanceEng   || '—';
  const chiAtt  = service.attendanceChi   || '—';
  const kidsAtt = service.attendanceKids  || '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CACV Bulletin — ${esc(service.date)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>
  :root {
    --ink:       #2C3420;
    --ink-mid:   #4A5535;
    --slate:     #8BA5C4;
    --slate-lt:  #B8CCDE;
    --cream:     #F4F1E6;
    --sand:      #EDE9D8;
    --paper:     #F7F5EC;
    --fog:       #D8D5C4;
    --muted:     #8A9178;
    --text:      #2C3420;
    --white:     #FAFAF4;
    --radius:    14px;
    --gold:      #8BA5C4;
    --gold-pale: #E8EFF6;
    --gold-dim:  rgba(139,165,196,0.12);
    --yellow:    #B8CCDE;
    --accent:    #8BA5C4;
    --sage:      #A8B896;
    --moss:      #4A5535;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  /* ── GRAIN OVERLAY ── */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
    opacity: 0.032;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    background-size: 160px 160px;
  }

  body {
    background: var(--paper);
    color: var(--text);
    font-family: 'Instrument Sans', system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }

  /* ── HERO ── */
  .hero {
    background: #3D4A2A;
    position: relative;
    overflow: hidden;
    isolation: isolate;
  }

  .hero::before {
    content: '';
    position: absolute;
    width: 600px; height: 600px;
    border-radius: 60% 40% 55% 45% / 50% 60% 40% 50%;
    background: radial-gradient(ellipse, rgba(168,184,150,0.2) 0%, transparent 70%);
    top: -200px; right: -100px;
    animation: drift 18s ease-in-out infinite alternate;
  }
  .hero::after {
    content: '';
    position: absolute;
    width: 400px; height: 400px;
    border-radius: 45% 55% 40% 60% / 60% 40% 55% 45%;
    background: radial-gradient(ellipse, rgba(139,165,196,0.12) 0%, transparent 65%);
    bottom: -120px; left: -60px;
    animation: drift 22s ease-in-out infinite alternate-reverse;
  }
  @keyframes drift {
    from { transform: translate(0,0) rotate(0deg) scale(1); }
    to   { transform: translate(30px, 20px) rotate(8deg) scale(1.08); }
  }

  .hero-blob {
    position: absolute;
    top: -40px; left: -40px;
    width: 220px; height: 220px;
    border-radius: 40% 60% 55% 45%;
    background: radial-gradient(ellipse, rgba(139,165,196,0.2) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .hero-grain {
    position: absolute;
    inset: 0;
    opacity: 0.06;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 120px 120px;
    pointer-events: none;
  }

  .hero-inner {
    max-width: 740px;
    margin: 0 auto;
    padding: 60px 28px 52px;
    position: relative;
    z-index: 1;
  }

  .bulletin-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(139,165,196,0.6);
    background: rgba(139,165,196,0.15);
    color: #6A8FAE;
    font-size: 10.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding: 6px 14px 6px 10px;
    border-radius: 100px;
    margin-bottom: 6px;
    font-weight: 500;
  }
  .chip-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #8BA5C4;
    animation: glow 3s ease-in-out infinite;
  }
  @keyframes glow {
    0%,100% { box-shadow: 0 0 0 0 rgba(139,165,196,0.5); }
    50% { box-shadow: 0 0 0 4px rgba(139,165,196,0); }
  }
  .hero-service-tag {
    display: block;
    font-size: 13px;
    letter-spacing: 0.06em;
    color: rgba(255,255,255,0.75);
    font-weight: 500;
    margin-bottom: 20px;
    margin-top: 0;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.1);
  }

  .hero-title {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: clamp(28px, 4.8vw, 46px);
    font-weight: 400;
    color: #fff;
    line-height: 1.15;
    letter-spacing: 0.01em;
    margin-bottom: 6px;
  }
  .hero-title em { color: var(--slate-lt); font-style: italic; }

  .hero-date {
    font-family: 'Instrument Serif', serif;
    font-size: clamp(16px, 2.8vw, 24px);
    color: rgba(255,255,255,0.5);
    font-style: italic;
    margin-bottom: 28px;
  }

  .hero-pills {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .hero-pill {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.55);
    font-size: 12px;
    padding: 7px 16px;
    border-radius: 100px;
    backdrop-filter: blur(4px);
  }

  /* ── SERMON STRIP ── */
  .sermon-strip {
    background: #5C6B48;
    position: relative;
    overflow: hidden;
  }
  .sermon-strip::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 100px 100px;
    opacity: 0.08;
    pointer-events: none;
  }
  .sermon-inner {
    max-width: 740px;
    margin: 0 auto;
    padding: 22px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    position: relative;
  }
  .sermon-eyebrow {
    font-size: 9.5px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
    margin-bottom: 5px;
    font-weight: 600;
  }
  .sermon-title {
    font-family: 'Instrument Serif', serif;
    font-size: clamp(18px, 3vw, 28px);
    color: #fff;
    line-height: 1.1;
  }
  .sermon-ref {
    font-size: 13px;
    color: rgba(255,255,255,0.55);
    margin-top: 3px;
    font-style: italic;
  }
  .bible-btns-sm {
    display: inline-flex;
    gap: 5px;
    margin-left: 8px;
    flex-shrink: 0;
  }
  .bible-btn-sm {
    display: inline-flex;
    align-items: center;
    padding: 2px 9px;
    border-radius: 100px;
    border: 1px solid var(--fog);
    background: var(--sand);
    color: var(--muted);
    font-size: 10.5px;
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .bible-btn-sm:hover { background: var(--fog); color: var(--ink); border-color: var(--fog); }

  .bible-btns {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  .bible-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border-radius: 100px;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.8);
    font-size: 11.5px;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
  }
  .bible-btn:hover { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.4); }
  .bible-btn svg { width: 11px; height: 11px; opacity: 0.7; flex-shrink: 0; }

  .preacher-tag {
    background: rgba(255,255,255,0.18);
    border: 1px solid rgba(255,255,255,0.3);
    color: rgba(255,255,255,0.95);
    font-size: 13px;
    font-weight: 500;
    padding: 10px 20px;
    border-radius: 100px;
    white-space: nowrap;
    flex-shrink: 0;
    letter-spacing: 0.01em;
  }

  /* ── LAYOUT ── */
  .page {
    max-width: 740px;
    margin: 0 auto;
    padding: 36px 28px 80px;
  }

  /* ── CARD ── */
  .card {
    background: var(--white);
    border-radius: var(--radius);
    padding: 26px 24px;
    margin-bottom: 16px;
    border: 1px solid rgba(0,0,0,0.06);
    box-shadow:
      0 1px 2px rgba(0,0,0,0.04),
      0 4px 16px rgba(0,0,0,0.03),
      inset 0 1px 0 rgba(255,255,255,0.8);
    position: relative;
    overflow: hidden;
    animation: up 0.45s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes up {
    from { opacity:0; transform:translateY(18px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .card:nth-child(1){animation-delay:.04s}
  .card:nth-child(2){animation-delay:.08s}
  .card:nth-child(3){animation-delay:.12s}
  .card:nth-child(4){animation-delay:.16s}
  .card:nth-child(5){animation-delay:.20s}
  .card:nth-child(6){animation-delay:.24s}
  .card:nth-child(7){animation-delay:.28s}
  .card:nth-child(8){animation-delay:.32s}

  .card::before {
    content: '';
    position: absolute;
    top: -30px; left: -30px;
    width: 90px; height: 90px;
    border-radius: 40% 60% 55% 45%;
    background: radial-gradient(ellipse, rgba(168,184,150,0.15) 0%, transparent 70%);
    pointer-events: none;
  }

  .card-label {
    font-size: 9.5px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .card-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--fog), transparent);
  }

  /* ── ORDER OF SERVICE ── */
  .order-list { list-style: none; }
  .order-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 12px;
    border-radius: 9px;
    transition: background 0.15s;
    cursor: default;
  }
  .order-row:hover { background: var(--sand); }
  .order-idx {
    width: 26px; height: 26px;
    border-radius: 50%;
    background: var(--fog);
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .order-row.focus .order-idx { background: rgba(139,165,196,0.2); color: #5C82A8; }
  .order-row.focus .order-name { color: var(--ink); font-weight: 600; }
  .order-name { font-size: 14.5px; flex: 1; }
  .order-sub { font-size: 12.5px; color: var(--muted); font-style: italic; }

  /* ── SERVICE TEAM ── */
  .team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
    gap: 8px;
  }
  .team-chip {
    background: var(--sand);
    border-radius: 10px;
    padding: 12px 14px;
    border: 1px solid var(--fog);
    transition: border-color 0.15s, transform 0.15s;
  }
  .team-chip:hover { border-color: rgba(139,165,196,0.6); transform: translateY(-1px); }
  .team-role { font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; font-weight: 600; }
  .team-name { font-size: 14px; font-weight: 600; color: var(--ink); }

  /* ── ANNOUNCEMENTS ── */
  .announce-stack { display: flex; flex-direction: column; gap: 12px; }
  .announce {
    display: flex;
    gap: 14px;
    background: #EEEBda;
    border-radius: 10px;
    padding: 14px 16px;
    border: 1px solid var(--fog);
    border-left: 3px solid #A8B896;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .announce:hover { transform: translateX(3px); box-shadow: -4px 0 0 #A8B896; border-left-color: #A8B896; }
  .announce-n {
    font-family: 'Instrument Serif', serif;
    font-size: 26px;
    color: var(--ink);
    line-height: 1;
    flex-shrink: 0;
    width: 24px;
    margin-top: 1px;
  }
  .announce-t { font-size: 13.5px; font-weight: 600; color: #2C3420; margin-bottom: 3px; }
  .announce-b { font-size: 13px; color: var(--text); line-height: 1.6; }
  .announce-b a { color: #6A8FAE; text-underline-offset: 2px; }

  /* ── PRAYER ── */
  .prayer-groups { display: flex; flex-direction: column; gap: 20px; }
  .prayer-group-head {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-mid);
    margin-bottom: 10px;
    padding-bottom: 7px;
    border-bottom: 1.5px solid #D8D5C4;
  }
  .prayer-items { display: flex; flex-direction: column; gap: 7px; }
  .prayer-item {
    display: flex;
    gap: 10px;
    font-size: 13.5px;
    color: var(--text);
    line-height: 1.6;
  }
  .prayer-pip {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--gold);
    margin-top: 9px;
    flex-shrink: 0;
  }

  /* ── TABLES ── */
  .tbl-scroll { overflow-x: auto; border-radius: 10px; border: 1px solid var(--fog); }
  .tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    min-width: 460px;
  }
  .tbl thead tr { background: #3D4A2A; }
  .tbl th {
    padding: 10px 13px;
    text-align: left;
    font-size: 9.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.65);
    font-weight: 600;
  }
  .tbl td {
    padding: 10px 13px;
    border-bottom: 1px solid var(--fog);
    color: var(--text);
  }
  .tbl tr:last-child td { border-bottom: none; }
  .tbl tbody tr { transition: background 0.12s; }
  .tbl tbody tr:hover td { background: var(--sand); }

  /* ── ATTENDANCE ── */
  .att-grid {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 10px;
  }
  .att-cell {
    background: var(--sand);
    border-radius: 10px;
    border: 1px solid var(--fog);
    padding: 20px 12px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .att-cell::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #A8B896, transparent);
    opacity: 0.6;
  }
  .att-n {
    font-family: 'Instrument Serif', serif;
    font-size: 44px;
    color: var(--ink);
    line-height: 1;
  }
  .att-l { font-size: 11px; color: var(--muted); margin-top: 4px; letter-spacing: 0.06em; }

  /* ── HOPE CARD ── */
  .hope-card {
    background: #3D4A2A;
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 16px;
    position: relative;
    isolation: isolate;
    border: 1px solid rgba(0,0,0,0.1);
    animation: up 0.45s cubic-bezier(0.22,1,0.36,1) 0.36s both;
  }
  .hope-card::before {
    content: '';
    position: absolute;
    width: 500px; height: 500px;
    border-radius: 55% 45% 60% 40% / 45% 55% 45% 55%;
    background: radial-gradient(ellipse, rgba(139,165,196,0.14) 0%, transparent 65%);
    top: -200px; right: -100px;
    animation: drift 20s ease-in-out infinite alternate;
    pointer-events: none;
  }
  .hope-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 120px 120px;
    opacity: 0.045;
    pointer-events: none;
  }

  .hope-header {
    padding: 30px 28px 20px;
    position: relative;
    z-index: 1;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .hope-eyebrow { font-size: 9.5px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 6px; }
  .hope-title {
    font-family: 'Instrument Serif', serif;
    font-size: 34px;
    color: #fff;
    line-height: 1;
  }
  .hope-title em { color: var(--slate-lt); font-style: italic; }

  .hope-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    position: relative;
    z-index: 1;
  }
  .hope-cell {
    padding: 22px 24px;
    border-right: 1px solid rgba(255,255,255,0.08);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    display: flex;
    gap: 14px;
    align-items: flex-start;
    transition: background 0.2s;
  }
  .hope-cell:hover { background: rgba(255,255,255,0.03); }
  .hope-cell:nth-child(even) { border-right: none; }
  .hope-cell:nth-child(3),
  .hope-cell:nth-child(4) { border-bottom: none; }
  .hope-letter {
    font-family: 'Instrument Serif', serif;
    font-size: 42px;
    color: var(--slate-lt);
    line-height: 0.9;
    flex-shrink: 0;
  }
  .hope-word { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.9); margin-bottom: 3px; }
  .hope-desc { font-size: 12px; color: rgba(255,255,255,0.35); font-style: italic; line-height: 1.5; }

  /* ── FOOTER ── */
  footer {
    background: #3D4A2A;
    position: relative;
    overflow: hidden;
  }
  footer::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 100px 100px;
    opacity: 0.04;
    pointer-events: none;
  }
  footer a { color: #B8CCDE; text-decoration: none; }
  footer a:hover { text-decoration: underline; }
  .footer-inner {
    max-width: 740px;
    margin: 0 auto;
    padding: 52px 28px 32px;
    position: relative;
    z-index: 1;
  }
  .footer-grid {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr 0.9fr;
    gap: 40px;
    padding-bottom: 36px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .footer-col-head {
    font-size: 9.5px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--gold);
    font-weight: 600;
    margin-bottom: 18px;
  }
  .footer-staff-row { margin-bottom: 16px; }
  .footer-staff-row:last-child { margin-bottom: 0; }
  .footer-staff-role {
    font-size: 9.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.28);
    margin-bottom: 2px;
    font-weight: 600;
  }
  .footer-staff-name { font-size: 13.5px; color: rgba(255,255,255,0.8); font-weight: 500; margin-bottom: 3px; }
  .footer-staff-contact { display: flex; flex-direction: column; gap: 1px; }
  .footer-staff-contact a { font-size: 12px; color: rgba(255,255,255,0.35); }
  .footer-staff-contact a:hover { color: var(--gold); }
  .footer-giving-box {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .footer-giving-row { display: flex; flex-direction: column; gap: 1px; }
  .footer-giving-label { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.25); font-weight: 600; }
  .footer-giving-val { font-size: 13.5px; color: rgba(255,255,255,0.75); font-weight: 500; }
  .footer-giving-note { font-size: 11.5px; color: rgba(255,255,255,0.25); line-height: 1.5; font-style: italic; }
  .footer-contact-items { display: flex; flex-direction: column; gap: 11px; }
  .footer-contact-item { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.5; }
  .footer-contact-icon { font-size: 13px; flex-shrink: 0; margin-top: 1px; opacity: 0.6; }
  .footer-contact-item a { color: rgba(255,255,255,0.5); }
  .footer-contact-item a:hover { color: var(--gold); }
  .footer-base {
    display: flex;
    justify-content: space-between;
    padding-top: 24px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.2);
    letter-spacing: 0.04em;
    flex-wrap: wrap;
    gap: 8px;
  }
  @media(max-width:620px) {
    .footer-grid { grid-template-columns: 1fr; gap: 28px; }
    .footer-base { flex-direction: column; align-items: center; text-align: center; }
  }

  @media(max-width:520px) {
    .hero-inner { padding: 44px 20px 38px; }
    .page { padding: 24px 16px 64px; }
    .hope-grid { grid-template-columns: 1fr; }
    .hope-cell:nth-child(odd) { border-right: none; }
    .hope-cell:nth-child(3) { border-bottom: 1px solid rgba(255,255,255,0.05); }
    .att-grid { grid-template-columns: 1fr; }
    .sermon-inner { flex-direction: column; align-items: flex-start; }
    .bible-btns-sm { display: none; }
  }

  /* ── STICKY NAV ── */
  .sticky-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(247,245,236,0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--fog);
    padding: 0 20px;
  }
  .sticky-nav::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 100px 100px;
    opacity: 0.025;
    pointer-events: none;
  }
  .nav-scroll {
    max-width: 740px;
    margin: 0 auto;
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 10px 0;
    position: relative;
  }
  .nav-scroll::-webkit-scrollbar { display: none; }
  .nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    border-radius: 100px;
    border: 1px solid var(--fog);
    background: var(--white);
    color: var(--muted);
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.1s;
    flex-shrink: 0;
  }
  .nav-btn:hover {
    background: var(--sand);
    border-color: var(--fog);
    color: var(--ink);
    transform: translateY(-1px);
  }
  .nav-btn.active {
    background: #3D4A2A;
    border-color: #3D4A2A;
    color: rgba(255,255,255,0.92);
  }
  .nav-btn svg {
    width: 12px;
    height: 12px;
    opacity: 0.7;
    flex-shrink: 0;
  }
</style>
</head>
<body>

<!-- HERO -->
<div class="hero">
  <div class="hero-blob"></div>
  <div class="hero-grain"></div>
  <div class="hero-inner">
    <div class="bulletin-chip"><span class="chip-dot"></span> Weekly Bulletin</div>
    <div class="hero-service-tag">English Service</div>
    <h1 class="hero-title">Christian Alliance<br>Church of <em>Victoria</em></h1>
    <p class="hero-date">${esc(service.date)}</p>
    <div class="hero-pills">
      <span class="hero-pill">${esc(service.time)}</span>
      <span class="hero-pill">${esc(service.venue)}</span>
    </div>
  </div>
</div>

<!-- SERMON STRIP -->
<div class="sermon-strip">
  <div class="sermon-inner">
    <div>
      <div class="sermon-eyebrow">This Week's Message</div>
      <div class="sermon-title">${esc(service.sermonTitle)}</div>
      <div class="sermon-ref">${esc(service.sermonScripture)}</div>
      ${service.sermonScripture ? `<div class="bible-btns">
        <a class="bible-btn" href="${bibleGatewayUrl(service.sermonScripture)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 3h5.5a2 2 0 0 1 2 2v9l-1.5-1.5H2V3z"/><path d="M14 3H8.5a0 0 0 0 0 0 0v9l1.5-1.5H14V3z" stroke-opacity=".5"/></svg>
          BibleGateway
        </a>
        <a class="bible-btn" href="${youVersionUrl(service.sermonScripture)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="1" width="10" height="14" rx="1.5"/><path d="M6 5h4M6 8h4M6 11h2"/></svg>
          YouVersion
        </a>
      </div>` : ''}
    </div>
    <div class="preacher-tag">${esc(service.preacher)}</div>
  </div>
</div>

<!-- STICKY NAV -->
<nav class="sticky-nav" aria-label="Jump to section">
  <div class="nav-scroll">
    <a href="#order" class="nav-btn">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 4h12M2 8h9M2 12h6"/></svg>
      Order
    </a>
    <a href="#team" class="nav-btn">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="5" r="2.5"/><path d="M1 13c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5"/><circle cx="12" cy="5" r="2"/><path d="M14 13c0-1.8-1-3-2.5-3.5"/></svg>
      Team
    </a>
    <a href="#announcements" class="nav-btn">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 3v3.5m0 2h.01"/></svg>
      Notices
    </a>
    <a href="#prayer" class="nav-btn">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 2c0 0-5 3-5 7a5 5 0 0 0 10 0c0-4-5-7-5-7z"/></svg>
      Prayer
    </a>
    <a href="#roster" class="nav-btn">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 2v12M2 6h12M2 10h12"/></svg>
      Roster
    </a>
    <a href="#events" class="nav-btn">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 2v2m6-2v2M2 7h12"/></svg>
      Events
    </a>
    <a href="#attendance" class="nav-btn">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12l3-4 3 2 3-5 3 3"/></svg>
      Attendance
    </a>
    <a href="#theme" class="nav-btn">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 2l1.5 4.5H14l-3.7 2.7 1.4 4.3L8 11l-3.7 2.5 1.4-4.3L2 6.5h4.5z"/></svg>
      Theme
    </a>
  </div>
</nav>

<div class="page">

  <!-- ORDER OF SERVICE -->
  <div class="card" id="order">
    <div class="card-label">Order of Service</div>
    <ul class="order-list">
${buildOrder(order)}
    </ul>
  </div>

  <!-- SERVICE TEAM -->
  <div class="card" id="team">
    <div class="card-label">Service Team</div>
    <div class="team-grid">
${buildTeam(service)}
    </div>
  </div>

  <!-- ANNOUNCEMENTS -->
  <div class="card" id="announcements">
    <div class="card-label">Announcements</div>
    ${buildAnnouncements(announcements)}
  </div>

  <!-- PRAYER -->
  <div class="card" id="prayer">
    <div class="card-label">Prayer Items</div>
    ${buildPrayer(prayer)}
  </div>

  <!-- ROSTER -->
  <div class="card" id="roster">
    <div class="card-label">Upcoming Roster</div>
    <div class="tbl-scroll">
      <table class="tbl">
        <thead><tr><th>Date</th><th>Preacher</th><th>Chair</th><th>Worship / Music</th><th>PP &amp; PA</th><th>Ushers</th></tr></thead>
        <tbody>
${buildRoster(roster)}
        </tbody>
      </table>
    </div>
  </div>

  <!-- EVENTS -->
  <div class="card" id="events">
    <div class="card-label">Upcoming Events</div>
    <div class="tbl-scroll">
      <table class="tbl">
        <thead><tr><th>Month</th><th>Day</th><th>Event</th><th>Responsible</th></tr></thead>
        <tbody>
${buildEvents(events)}
        </tbody>
      </table>
    </div>
  </div>

  <!-- ATTENDANCE -->
  <div class="card" id="attendance">
    <div class="card-label">Last Week's Attendance</div>
    <div class="att-grid">
      <div class="att-cell"><div class="att-n">${esc(engAtt)}</div><div class="att-l">English Service</div></div>
      <div class="att-cell"><div class="att-n">${esc(chiAtt)}</div><div class="att-l">Chinese Service</div></div>
      <div class="att-cell"><div class="att-n">${esc(kidsAtt)}</div><div class="att-l">Children's Service</div></div>
    </div>
  </div>

  <!-- HOPE THEME -->
  <div class="hope-card" id="theme">
    <div class="hope-header">
      <div class="hope-eyebrow">Church Theme 2026</div>
      <div class="hope-title">Proclaim <em>HOPE</em></div>
    </div>
    <div class="hope-grid">
      <div class="hope-cell">
        <div class="hope-letter">H</div>
        <div><div class="hope-word">Healthy Relationships</div><div class="hope-desc">with God and with others</div></div>
      </div>
      <div class="hope-cell">
        <div class="hope-letter">O</div>
        <div><div class="hope-word">On Mission</div><div class="hope-desc">Everyone, everywhere, all the time</div></div>
      </div>
      <div class="hope-cell">
        <div class="hope-letter">P</div>
        <div><div class="hope-word">People of Prayer and Praise</div><div class="hope-desc"></div></div>
      </div>
      <div class="hope-cell">
        <div class="hope-letter">E</div>
        <div><div class="hope-word">Empowered &amp; Equipped</div><div class="hope-desc">by the Holy Spirit for this task</div></div>
      </div>
    </div>
  </div>

</div>

<footer>
  <div class="footer-inner">
    <div class="footer-grid">

      <div class="footer-col">
        <div class="footer-col-head">Our Staff</div>
        <div class="footer-staff-row">
          <div class="footer-staff-role">Senior Pastor</div>
          <div class="footer-staff-name">Rev Colin Wun</div>
          <div class="footer-staff-contact">
            <a href="tel:0434190205">0434 190 205</a>
            <a href="mailto:colinwun@cacv.org.au">colinwun@cacv.org.au</a>
          </div>
        </div>
        <div class="footer-staff-row">
          <div class="footer-staff-role">Assistant Pastor</div>
          <div class="footer-staff-name">Ps Kwok Kit Chan</div>
          <div class="footer-staff-contact">
            <a href="tel:0452349846">0452 349 846</a>
            <a href="mailto:kwokit@cacv.org.au">kwokit@cacv.org.au</a>
          </div>
        </div>
        <div class="footer-staff-row">
          <div class="footer-staff-role">Administration</div>
          <div class="footer-staff-name">Mrs Shirley Dew &amp; Mrs May Poon</div>
          <div class="footer-staff-contact">
            <a href="mailto:admin@cacv.org.au">admin@cacv.org.au</a>
          </div>
        </div>
      </div>

      <div class="footer-col">
        <div class="footer-col-head">Online Giving</div>
        <div class="footer-giving-box">
          <div class="footer-giving-row">
            <span class="footer-giving-label">Account Name</span>
            <span class="footer-giving-val">Christian Alliance Church of Victoria</span>
          </div>
          <div class="footer-giving-row">
            <span class="footer-giving-label">BSB</span>
            <span class="footer-giving-val">033 389</span>
          </div>
          <div class="footer-giving-row">
            <span class="footer-giving-label">Account No.</span>
            <span class="footer-giving-val">268 531</span>
          </div>
        </div>
        <p class="footer-giving-note">Please include your name and giving category in the payment description.</p>
      </div>

      <div class="footer-col">
        <div class="footer-col-head">Get in Touch</div>
        <div class="footer-contact-items">
          <div class="footer-contact-item">
            <div class="footer-contact-icon">📍</div>
            <div>17 Livingstone Close, Burwood VIC 3125<br><span style="opacity:0.6;font-size:11.5px">PO Box 7091 Wattle Park 3128</span></div>
          </div>
          <div class="footer-contact-item">
            <div class="footer-contact-icon">📞</div>
            <div><a href="tel:0398887114">(03) 9888-7114</a></div>
          </div>
          <div class="footer-contact-item">
            <div class="footer-contact-icon">✉️</div>
            <div><a href="mailto:cacv@cacv.org.au">cacv@cacv.org.au</a></div>
          </div>
          <div class="footer-contact-item">
            <div class="footer-contact-icon">🌐</div>
            <div><a href="https://cacv.org.au">cacv.org.au</a></div>
          </div>
        </div>
      </div>

    </div>
    <div class="footer-base">
      <span>&copy; 2026 Christian Alliance Church of Victoria</span>
      <span>C&amp;MA Member Church</span>
    </div>
  </div>
</footer>

<script>
  // Highlight active nav button based on scroll position
  const sections = ['order','team','announcements','prayer','roster','events','attendance','theme'];
  const btns = {};
  sections.forEach(id => {
    btns[id] = document.querySelector(\`.nav-btn[href="#\${id}"]\`);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const btn = btns[entry.target.id];
      if (!btn) return;
      if (entry.isIntersecting) {
        Object.values(btns).forEach(b => b && b.classList.remove('active'));
        btn.classList.add('active');
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });

  // Smooth scroll for nav links
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(btn.getAttribute('href'));
      if (target) {
        const offset = 56;
        const top = target.getBoundingClientRect().top + window.scrollY - offset - 12;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
</script>
</body>
</html>`;
}

module.exports = { buildBulletin };
