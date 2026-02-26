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
    { role: 'Morning Tea', name: s.morningTea  },
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

function buildStaffFooter(churchInfo) {
  const ci = churchInfo || {};
  return `<div>
      <div class="footer-head">Our Staff</div>
      Senior Pastor<br>${esc(ci.seniorPastorName || 'Rev Colin Wun')}<br>
      ${esc(ci.seniorPastorPhone || '0434 190 205')}<br>
      ${esc(ci.seniorPastorEmail || 'colinwun@cacv.org.au')}<br><br>
      Asst Pastor<br>${esc(ci.asstPastorName || 'Ps Kwok Kit Chan')}<br>
      ${esc(ci.asstPastorPhone || '0452 349 846')}<br>
      ${esc(ci.asstPastorEmail || 'kwokit@cacv.org.au')}<br><br>
      Admin: ${esc(ci.adminEmail || 'admin@cacv.org.au')}
    </div>`;
}

// ── Per-page content builders ──────────────────────────────────────────────────

function buildCoverPageHtml(data) {
  const { service, churchInfo } = data;
  const qrBlock = data.liveQrSvg
    ? `<div class="qr-block">
  <div class="qr-label">Scan for Digital Bulletin</div>
  ${data.liveQrSvg}
  <div class="qr-url">${esc(data.liveUrl || '')}</div>
</div>`
    : '';
  return `
  <div class="cover-top">
    <svg class="cover-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 249.16 226.07" aria-label="CACV Logo" role="img">
      <path fill="currentColor" d="M89.52,106.01c3.63-14.52,15.3-27.72,15.3-27.72l-4.78-7.64-66.92,22.95C-10.85,111.75-2.17,142.4,9.22,149.98c5.74,3.83,20.08,8.61,20.08,8.61l-1.91,22.94h52.69l4.27-9.5,8.55,9.5h4.28s-10.52-64.05-7.65-75.52ZM29.3,146.16s-15.19-.42-17.21-10.52c-3.82-19.12,20.07-29.63,20.07-29.63l-2.87,40.15ZM78.05,108.88c-.7,8.33,3.66,42.91,6.09,61.2l-45.28-.02,4.78-67.88,43.02-15.29s-7.28,6.09-8.61,21.99Z"/>
      <path fill="currentColor" d="M234.94,74.95h-72.11s-23.53,31.09-11.05,48.76c8.43,11.95,22.89,14.68,31.96,15.79,9.47.04,9.14,10.13,9.14,10.13v20.91h-21.03v10.99h53.54v-10.99h-21.03v-20.91s.02-10.21,9.7-10.2c9.24-1.19,23.14-4.01,31.41-15.72,12.48-17.67-10.52-48.76-10.52-48.76ZM234.94,117.96c-9.56,13.38-36.32,12.43-36.32,12.43,0,0-26.77.96-36.32-12.43-5.94-8.32-.47-21.89,4.97-31.57l61.94.03s15.75,17.52,5.73,31.54Z"/>
      <polygon fill="currentColor" points="143.25 36.33 143.25 0 107.88 0 107.88 36.33 74.43 36.33 74.43 68.83 107.88 68.83 107.88 174.88 122.15 155.82 118.88 155.82 118.88 58.31 84.95 58.31 84.95 46.84 118.88 46.84 118.88 10.52 132.25 10.52 132.25 46.84 166.18 46.84 166.18 58.31 132.25 58.31 132.25 155.82 129.12 155.82 143.25 174.88 143.25 68.83 176.7 68.83 176.7 36.33 143.25 36.33"/>
      <path fill="currentColor" d="M150.42,177.8l-24.86-43.02-24.85,43.02-31.55-43.02,7.65,91.29h97.5l7.64-91.29-31.54,43.02ZM163.69,215.09h-76.37s-2.87-40.16-2.87-40.16l17.2,21.99,23.9-40.63,23.9,40.63,17.21-21.99-2.97,40.16Z"/>
      <path fill="currentColor" d="M211.72,199.14c5.9,0,10.61,4.8,10.61,10.8s-4.71,10.84-10.66,10.84-10.7-4.75-10.7-10.84,4.8-10.8,10.7-10.8h.05ZM211.67,200.82c-4.75,0-8.64,4.09-8.64,9.12s3.89,9.16,8.69,9.16c4.8.05,8.64-4.03,8.64-9.12s-3.84-9.17-8.64-9.17h-.05ZM209.65,216.23h-1.92v-12.05c1.01-.14,1.97-.28,3.41-.28,1.82,0,3.02.38,3.74.91.72.53,1.11,1.34,1.11,2.5,0,1.58-1.06,2.54-2.35,2.93v.09c1.05.19,1.77,1.15,2.02,2.93.29,1.87.57,2.59.77,2.98h-2.02c-.29-.39-.57-1.49-.82-3.08-.29-1.53-1.05-2.11-2.59-2.11h-1.34v5.19ZM209.65,209.56h1.39c1.59,0,2.93-.58,2.93-2.07,0-1.05-.77-2.11-2.93-2.11-.62,0-1.05.05-1.39.09v4.09Z"/>
    </svg>
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

  ${qrBlock}

  <div class="print-footer">
    ${buildStaffFooter(churchInfo)}
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
  </div>`;
}

function buildOrderPageHtml(data) {
  const { service, order } = data;
  return `
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
  </div>`;
}

function buildAnnouncementsPageHtml(data) {
  return `
  <div class="section-head">Announcements</div>
  <div class="announce-list">
    ${buildPrintAnnouncements(data.announcements)}
  </div>`;
}

function buildPrayerPageHtml(data) {
  return `
  <div class="section">
    <div class="section-head">Prayer Items</div>
    <div class="prayer-section">
      ${buildPrintPrayer(data.prayer)}
    </div>
  </div>`;
}

// ── Shared CSS ─────────────────────────────────────────────────────────────────

const SHARED_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 9.5pt;
    line-height: 1.45;
    color: #000;
    background: #fff;
  }

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

  /* ── COVER ── */
  .cover-top {
    text-align: center;
    border-bottom: 2pt solid #000;
    padding-bottom: 4mm;
    margin-bottom: 5mm;
  }
  .cover-logo {
    display: block;
    height: 16mm;
    width: auto;
    margin: 0 auto 3mm;
    color: #000;
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

  /* ── QR BLOCK ── */
  .qr-block { text-align: center; margin-top: 4mm; }
  .qr-block svg { width: 28mm; height: 28mm; display: block; margin: 1.5mm auto; }
  .qr-label, .qr-url { font-family: Arial, sans-serif; font-size: 7pt; color: #333; }

  /* ── ORDER OF SERVICE + TEAM ── */
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

  /* ── ANNOUNCEMENTS ── */
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

  /* ── PRAYER ── */
  .prayer-section p {
    font-size: 9.5pt;
    margin-bottom: 2mm;
    line-height: 1.4;
  }
  .bullet { font-size: 8pt; }

  /* ── FOOTER ── */
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
`;

// ── Standard print (4 A5 pages) ───────────────────────────────────────────────

function buildPrintBulletin(data) {
  const { service } = data;

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
${SHARED_STYLES}
  /* ── PAGE BREAKS ── */
  .page { page-break-after: always; }

  /* ── COVER PAGE LAYOUT ── */
  .page.cover {
    display: flex;
    flex-direction: column;
    height: 100vh;
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
${buildCoverPageHtml(data)}
</div>

<!-- ── PAGE 2: ORDER OF SERVICE + SERVICE TEAM ── -->
<div class="page">
${buildOrderPageHtml(data)}
</div>

<!-- ── PAGE 3: ANNOUNCEMENTS ── -->
<div class="page">
${buildAnnouncementsPageHtml(data)}
</div>

<!-- ── PAGE 4: PRAYER ── -->
<div>
${buildPrayerPageHtml(data)}
</div>

</body>
</html>`;
}

// ── Booklet 2-up imposition (A4 landscape) ────────────────────────────────────
// Imposition order for a 4-page booklet folded in half:
//   Sheet 1 front: [page 4 (prayer) | page 1 (cover)]
//   Sheet 2 back:  [page 2 (order)  | page 3 (announcements)]

function buildBookletBulletin(data) {
  const { service } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CACV Bulletin Booklet — ${esc(service.date)}</title>
<style>
  @page {
    size: A4 landscape;
    margin: 0;
  }
${SHARED_STYLES}
  /* ── BOOKLET SHEET LAYOUT ── */
  body { background: #fff; }

  .sheet {
    display: flex;
    width: 297mm;
    height: 210mm;
    page-break-after: always;
    overflow: hidden;
  }
  .sheet:last-child { page-break-after: auto; }

  .panel {
    width: 148.5mm;
    height: 210mm;
    padding: 8mm;
    overflow: hidden;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .panel.left {
    border-right: 0.5pt dashed #bbb;
  }

  /* Cover panel fills vertically */
  .panel.cover {
    justify-content: space-between;
  }

  /* Print hint (screen only) */
  .print-hint {
    display: block;
    font-family: Arial, sans-serif;
    font-size: 11px;
    background: #fffbcc;
    border: 1px solid #e0d800;
    padding: 6px 10px;
    margin-bottom: 8px;
    color: #555;
  }
  @media print { .print-hint { display: none; } }
</style>
</head>
<body>

<div class="print-hint">
  💡 Booklet layout: Print double-sided on A4, fold in half. Sheet 1: Prayer (left) / Cover (right). Sheet 2: Order (left) / Announcements (right).
</div>

<!-- ── SHEET 1 FRONT: [Page 4: Prayer | Page 1: Cover] ── -->
<div class="sheet">
  <div class="panel left">
${buildPrayerPageHtml(data)}
  </div>
  <div class="panel cover">
${buildCoverPageHtml(data)}
  </div>
</div>

<!-- ── SHEET 2 BACK: [Page 2: Order | Page 3: Announcements] ── -->
<div class="sheet">
  <div class="panel left">
${buildOrderPageHtml(data)}
  </div>
  <div class="panel">
${buildAnnouncementsPageHtml(data)}
  </div>
</div>

</body>
</html>`;
}

module.exports = { buildPrintBulletin, buildBookletBulletin };
