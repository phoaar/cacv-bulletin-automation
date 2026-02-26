'use strict';

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPrintOrder(order) {
  if (!order || order.length === 0) return '<li>No items listed</li>';
  return order.map((item, i) => {
    const detail = item.detail ? ` <span class="detail">${esc(item.detail)}</span>` : '';
    return `<li>${i + 1}. ${esc(item.item)}${detail}</li>`;
  }).join('\n');
}

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

function buildPrintAnnouncements(announcements) {
  if (!announcements || announcements.length === 0) return '<p class="empty">No announcements this week.</p>';
  return '<ol>\n' + announcements.map(a => {
    const body = a.body ? `<span class="ann-body"> — ${esc(a.body)}</span>` : '';
    return `  <li><strong>${esc(a.title)}</strong>${body}</li>`;
  }).join('\n') + '\n</ol>';
}

function buildPrintPrayer(prayer) {
  if (!prayer || prayer.length === 0) return '<p class="empty">No prayer items this week.</p>';
  return prayer.map(group => {
    const points = group.points.map(p => `<span class="bullet">•</span> ${esc(p)}`).join(' ');
    return `<p><strong>${esc(group.group)}:</strong> ${points}</p>`;
  }).join('\n');
}

function buildPrintBulletin(data) {
  const { service, order, announcements, prayer } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CACV Bulletin Print — ${esc(service.date)}</title>
<style>
  @page {
    size: A5;
    margin: 8mm;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 9.5pt;
    line-height: 1.45;
    color: #000;
    background: #fff;
  }

  /* ── PAGE BREAKS ── */
  .page { page-break-after: always; }

  /* ── SECTION HEADING ── */
  .section-head {
    font-size: 7.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    border-bottom: 1pt solid #000;
    padding-bottom: 1.5mm;
    margin-bottom: 2.5mm;
    font-family: Arial, Helvetica, sans-serif;
  }

  .section { margin-bottom: 5mm; }

  /* ── PAGE 1: COVER ── */
  .page.cover {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .cover-top {
    text-align: center;
    border-bottom: 2pt solid #000;
    padding-bottom: 4mm;
    margin-bottom: 5mm;
  }
  .cover-church {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13pt;
    font-weight: bold;
    letter-spacing: 0.02em;
    line-height: 1.2;
    margin-bottom: 2mm;
  }
  .cover-service {
    font-size: 9pt;
    font-family: Arial, Helvetica, sans-serif;
  }
  .cover-sermon {
    border: 1pt solid #000;
    padding: 4mm 5mm;
    margin-top: 4mm;
  }
  .cover-sermon-label {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin-bottom: 2mm;
  }
  .cover-sermon-title {
    font-size: 12pt;
    font-weight: bold;
    line-height: 1.25;
    margin-bottom: 1.5mm;
  }
  .cover-sermon-detail {
    font-size: 9pt;
    font-style: italic;
  }

  /* ── PAGE 2: ORDER OF SERVICE + TEAM ── */
  .order-list {
    list-style: none;
    font-size: 9.5pt;
  }
  .order-list li {
    padding: 1mm 0;
    border-bottom: 0.5pt dotted #ccc;
  }
  .order-list li:last-child { border-bottom: none; }
  .detail {
    font-style: italic;
    font-size: 8.5pt;
    color: #333;
  }

  .team-list {
    list-style: none;
    font-size: 9.5pt;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1mm 4mm;
  }
  .team-list li { padding: 0.5mm 0; }
  .role { font-family: Arial, sans-serif; font-size: 7.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; }

  /* ── PAGE 3: ANNOUNCEMENTS ── */
  .announce-list ol {
    padding-left: 5mm;
    font-size: 9.5pt;
  }
  .announce-list ol li {
    margin-bottom: 3mm;
    line-height: 1.4;
  }
  .ann-body { color: #222; }
  .empty { font-style: italic; color: #555; }

  /* ── PAGE 4: PRAYER + FOOTER ── */
  .prayer-section p {
    font-size: 9.5pt;
    margin-bottom: 2mm;
    line-height: 1.4;
  }
  .bullet { font-size: 8pt; }

  .print-footer {
    border-top: 1pt solid #000;
    padding-top: 3mm;
    margin-top: auto;
    font-size: 8pt;
    font-family: Arial, Helvetica, sans-serif;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 3mm;
    line-height: 1.5;
  }
  .footer-head {
    font-weight: bold;
    text-transform: uppercase;
    font-size: 7pt;
    letter-spacing: 0.1em;
    margin-bottom: 1mm;
  }

  /* ── PRINT HINT (screen only) ── */
  .print-hint {
    display: block;
    font-family: Arial, sans-serif;
    font-size: 11px;
    background: #fffbcc;
    border: 1px solid #e0d800;
    padding: 8px 12px;
    margin-bottom: 12px;
    color: #555;
  }
  @media print { .print-hint { display: none; } }
</style>
</head>
<body>

<div class="print-hint">
  💡 To print as an A5 booklet: Cmd+P → More settings → Pages per sheet: 2, then print double-sided and fold.
</div>

<!-- ── PAGE 1: COVER ── -->
<div class="page cover">
  <div class="cover-top">
    <div class="cover-church">Christian Alliance<br>Church of Victoria</div>
    <div class="cover-service">
      ${esc(service.date)}${service.time ? ' &nbsp;·&nbsp; ' + esc(service.time) : ''}
      ${service.venue ? '<br>' + esc(service.venue) : ''}
    </div>
  </div>

  <div class="cover-sermon">
    <div class="cover-sermon-label">This Week's Message</div>
    <div class="cover-sermon-title">${esc(service.sermonTitle || '—')}</div>
    <div class="cover-sermon-detail">
      ${[service.preacher, service.sermonScripture].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ') || '&nbsp;'}
    </div>
  </div>

  <div class="print-footer">
    <div>
      <div class="footer-head">Our Staff</div>
      Senior Pastor<br>Rev Colin Wun<br>
      0434 190 205<br>
      colinwun@cacv.org.au<br><br>
      Asst Pastor<br>Ps Kwok Kit Chan<br>
      0452 349 846<br>
      kwokit@cacv.org.au<br><br>
      Admin: admin@cacv.org.au
    </div>
    <div>
      <div class="footer-head">Online Giving</div>
      Christian Alliance<br>Church of Victoria<br><br>
      BSB: 033 389<br>
      Acct: 268 531<br><br>
      <em style="font-size:7.5pt">Include your name and giving category in the description.</em>
    </div>
    <div>
      <div class="footer-head">Get in Touch</div>
      17 Livingstone Close<br>Burwood VIC 3125<br>
      PO Box 7091<br>Wattle Park 3128<br><br>
      (03) 9888-7114<br>
      cacv@cacv.org.au<br>
      www.cacv.org.au
    </div>
  </div>
</div>

<!-- ── PAGE 2: ORDER OF SERVICE + SERVICE TEAM ── -->
<div class="page">
  <div class="section">
    <div class="section-head">Order of Service</div>
    <ul class="order-list">
${buildPrintOrder(order)}
    </ul>
  </div>

  <div class="section">
    <div class="section-head">Service Team</div>
    <ul class="team-list">
${buildPrintTeam(service)}
    </ul>
  </div>
</div>

<!-- ── PAGE 3: ANNOUNCEMENTS ── -->
<div class="page">
  <div class="section-head">Announcements</div>
  <div class="announce-list">
    ${buildPrintAnnouncements(announcements)}
  </div>
</div>

<!-- ── PAGE 4: PRAYER ── -->
<div>
  <div class="section">
    <div class="section-head">Prayer Items</div>
    <div class="prayer-section">
      ${buildPrintPrayer(prayer)}
    </div>
  </div>
</div>

</body>
</html>`;
}

module.exports = { buildPrintBulletin };
