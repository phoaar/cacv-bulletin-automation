'use strict';

/**
 * Escape HTML special characters.
 */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the Order of Service list for print (compact, numbered).
 */
function buildPrintOrder(order) {
  if (!order || order.length === 0) return '<li>No items listed</li>';
  return order.map((item, i) => {
    const detail = item.detail ? ` <span class="detail">${esc(item.detail)}</span>` : '';
    return `<li>${i + 1}. ${esc(item.item)}${detail}</li>`;
  }).join('\n');
}

/**
 * Build the Service Team list for print.
 */
function buildPrintTeam(s) {
  const roles = [
    { role: 'Preacher',    name: s.preacher    },
    { role: 'Chairperson', name: s.chairperson },
    { role: 'Worship',     name: s.worship     },
    { role: 'Music',       name: s.music       },
    { role: 'PowerPoint',  name: s.powerpoint  },
    { role: 'PA / Sound',  name: s.paSound     },
    { role: 'Chief Usher', name: s.chiefUsher  },
    { role: 'Ushers',      name: s.usher       },
  ];
  return roles
    .filter(r => r.name)
    .map(r => `<li><span class="role">${esc(r.role)}:</span> ${esc(r.name)}</li>`)
    .join('\n');
}

/**
 * Build the Announcements list for print.
 */
function buildPrintAnnouncements(announcements) {
  if (!announcements || announcements.length === 0) return '<p>No announcements this week.</p>';
  return '<ol>\n' + announcements.map(a => {
    const body = a.body ? ` — ${esc(a.body)}` : '';
    return `  <li><strong>${esc(a.title)}</strong>${body}</li>`;
  }).join('\n') + '\n</ol>';
}

/**
 * Build the Prayer Items section for print (compact inline format).
 */
function buildPrintPrayer(prayer) {
  if (!prayer || prayer.length === 0) return '<p>No prayer items this week.</p>';
  return prayer.map(group => {
    const points = group.points.map(p => `<span class="bullet">•</span> ${esc(p)}`).join(' ');
    return `<p><strong>${esc(group.group)}:</strong> ${points}</p>`;
  }).join('\n');
}

/**
 * Build the complete print bulletin HTML.
 * Designed to fit on one A4 sheet (front + back) when printed.
 * Black and white only — no decorative elements, no colour blocks.
 */
function buildPrintBulletin(data) {
  const { service, order, announcements, prayer } = data;

  const sermonLine = [service.sermonTitle, service.sermonScripture, service.preacher]
    .filter(Boolean)
    .join(' · ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CACV Bulletin Print — ${esc(service.date)}</title>
<style>
  @page {
    size: A4;
    margin: 10mm;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 10.5pt;
    line-height: 1.4;
    color: #000;
    background: #fff;
  }

  /* ── PAGE STRUCTURE ── */
  .page-1 {
    page-break-after: always;
  }

  /* ── HEADER ── */
  .bulletin-header {
    text-align: center;
    border-bottom: 2px solid #000;
    padding-bottom: 4mm;
    margin-bottom: 4mm;
  }
  .bulletin-header h1 {
    font-size: 15pt;
    font-weight: bold;
    letter-spacing: 0.02em;
  }
  .bulletin-header .service-info {
    font-size: 10pt;
    margin-top: 1mm;
  }

  /* ── SERMON BLOCK ── */
  .sermon-block {
    border: 1px solid #000;
    padding: 3mm 4mm;
    margin-bottom: 4mm;
    text-align: center;
  }
  .sermon-block .sermon-label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-bottom: 1mm;
  }
  .sermon-block .sermon-title {
    font-size: 13pt;
    font-weight: bold;
  }
  .sermon-block .sermon-detail {
    font-size: 9.5pt;
    margin-top: 1mm;
    font-style: italic;
  }

  /* ── TWO-COLUMN LAYOUT (page 1 bottom) ── */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5mm;
  }

  /* ── SECTION HEADERS ── */
  .section-head {
    font-size: 8.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    border-bottom: 1px solid #000;
    padding-bottom: 1mm;
    margin-bottom: 2mm;
  }

  /* ── ORDER OF SERVICE ── */
  .order-list {
    list-style: none;
    font-size: 10pt;
  }
  .order-list li {
    padding: 0.5mm 0;
  }
  .order-list .detail {
    font-style: italic;
    font-size: 9pt;
  }

  /* ── SERVICE TEAM ── */
  .team-list {
    list-style: none;
    font-size: 10pt;
  }
  .team-list li {
    padding: 0.5mm 0;
  }
  .team-list .role {
    font-weight: bold;
  }

  /* ── PAGE 2: single column sections ── */
  .announce-section {
    margin-bottom: 4mm;
  }
  .announce-section ol {
    padding-left: 5mm;
    font-size: 10pt;
  }
  .announce-section ol li {
    margin-bottom: 1.5mm;
    line-height: 1.45;
  }

  .prayer-section {
    margin-bottom: 4mm;
  }
  .prayer-section p {
    font-size: 10pt;
    margin-bottom: 1.5mm;
    line-height: 1.45;
  }
  .prayer-section .bullet {
    font-size: 8pt;
  }

  /* ── FOOTER ── */
  .print-footer {
    border-top: 1px solid #000;
    padding-top: 3mm;
    margin-top: 4mm;
    font-size: 8.5pt;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 4mm;
    line-height: 1.5;
  }
  .print-footer .footer-head {
    font-weight: bold;
    text-transform: uppercase;
    font-size: 7.5pt;
    letter-spacing: 0.1em;
    margin-bottom: 1mm;
  }
</style>
</head>
<body>

<!-- ── PAGE 1: FRONT ── -->
<div class="page-1">

  <div class="bulletin-header">
    <h1>Christian Alliance Church of Victoria</h1>
    <div class="service-info">
      ${esc(service.date)}${service.time ? ' · ' + esc(service.time) : ''}${service.venue ? ' · ' + esc(service.venue) : ''}
    </div>
  </div>

  <div class="sermon-block">
    <div class="sermon-label">This Week's Message</div>
    <div class="sermon-title">${esc(service.sermonTitle || '—')}</div>
    <div class="sermon-detail">
      ${[service.preacher, service.sermonScripture].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}
    </div>
  </div>

  <div class="two-col">
    <div>
      <div class="section-head">Order of Service</div>
      <ul class="order-list">
${buildPrintOrder(order)}
      </ul>
    </div>
    <div>
      <div class="section-head">Service Team</div>
      <ul class="team-list">
${buildPrintTeam(service)}
      </ul>
    </div>
  </div>

</div>

<!-- ── PAGE 2: BACK ── -->
<div class="page-2">

  <div class="announce-section">
    <div class="section-head">Announcements</div>
    ${buildPrintAnnouncements(announcements)}
  </div>

  <div class="prayer-section">
    <div class="section-head">Prayer Items</div>
    ${buildPrintPrayer(prayer)}
  </div>

  <div class="print-footer">
    <div>
      <div class="footer-head">Our Staff</div>
      Senior Pastor: Rev Colin Wun<br>
      0434 190 205 · colinwun@cacv.org.au<br><br>
      Asst Pastor: Ps Kwok Kit Chan<br>
      0452 349 846 · kwokit@cacv.org.au<br><br>
      Admin: admin@cacv.org.au
    </div>
    <div>
      <div class="footer-head">Online Giving</div>
      Account: Christian Alliance Church of Victoria<br>
      BSB: 033 389<br>
      Account No: 268 531<br><br>
      <em>Include your name and giving category in the payment description.</em>
    </div>
    <div>
      <div class="footer-head">Get in Touch</div>
      17 Livingstone Close, Burwood VIC 3125<br>
      PO Box 7091 Wattle Park 3128<br>
      (03) 9888-7114<br>
      cacv@cacv.org.au<br>
      www.cacv.org.au
    </div>
  </div>

</div>

</body>
</html>`;
}

module.exports = { buildPrintBulletin };
