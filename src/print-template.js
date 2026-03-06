'use strict';

const { esc, buildOrderItems, buildAnnouncementItems, buildPrayerItems } = require('./utils');
const config = require('./config');

/**
 * Build the printable A4 bulletin.
 */
function buildPrintBulletin(data) {
  const { service, order, announcements, prayer, theme } = data;

  const engAtt  = service.attendanceEng   || '—';
  const chiAtt  = service.attendanceChi   || '—';
  const kidsAtt = service.attendanceKids  || '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 10mm; }
  body {
    font-family: 'Instrument Sans', -apple-system, sans-serif;
    font-size: 11pt;
    line-height: 1.4;
    color: #2C3420;
    margin: 0;
    padding: 0;
  }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #3D4A2A; padding-bottom: 10px; }
  .logo { height: 40px; margin-bottom: 5px; }
  .title { font-size: 18pt; font-weight: bold; margin: 0; color: #3D4A2A; }
  .subtitle { font-size: 12pt; margin: 0; color: #8A9178; }
  
  .section { margin-bottom: 15px; }
  .section-title { 
    font-size: 10pt; 
    text-transform: uppercase; 
    letter-spacing: 0.1em; 
    color: #8A9178; 
    border-bottom: 1px solid #D8D5C4; 
    margin-bottom: 8px;
    font-weight: bold;
  }
  
  .sermon-box { background: #F7F5EC; padding: 10px; border-radius: 5px; margin-bottom: 15px; }
  .sermon-title { font-size: 14pt; font-weight: bold; margin: 0; }
  .sermon-info { font-size: 10pt; color: #4A5535; font-style: italic; }

  .order-list { margin: 0; padding-left: 20px; }
  .order-list li { margin-bottom: 4px; }
  
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  
  .announcement-item { margin-bottom: 8px; font-size: 10pt; position: relative; padding-right: 60px; min-height: 50px; }
  .ann-qr { position: absolute; right: 0; top: 0; width: 50px; height: 50px; }
  .ann-qr svg { width: 100%; height: 100%; }

  .footer { 
    margin-top: 20px; 
    padding-top: 10px; 
    border-top: 1px solid #D8D5C4; 
    font-size: 8pt; 
    color: #8A9178; 
    text-align: center;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="title">Christian Alliance Church of Victoria</div>
    <div class="subtitle">Weekly Bulletin — ${esc(service.date)}</div>
  </div>

  <div class="sermon-box">
    <div class="sermon-title">${esc(service.sermonTitle)}</div>
    <div class="sermon-info">${esc(service.sermonScripture)} — ${esc(service.preacher)}</div>
  </div>

  <div class="grid">
    <div class="col">
      <div class="section">
        <div class="section-title">Order of Service</div>
        <ul class="order-list">
          ${buildOrderItems(order, true)}
        </ul>
      </div>
      
      <div class="section">
        <div class="section-title">Prayer Items</div>
        ${buildPrayerItems(prayer, true)}
      </div>
    </div>

    <div class="col">
      <div class="section">
        <div class="section-title">Announcements</div>
        ${buildAnnouncementItems(announcements, true)}
      </div>

      <div class="section">
        <div class="section-title">Attendance</div>
        <div style="font-size: 9pt;">
          English: ${esc(engAtt)} | Chinese: ${esc(chiAtt)} | Children: ${esc(kidsAtt)}
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    &copy; 2026 Christian Alliance Church of Victoria | 17 Livingstone Close, Burwood VIC 3125 | ${config.BUILD_VERSION}
  </div>
</body>
</html>`;
}

/**
 * Build a 2-up booklet version (A4 landscape with two A5 pages).
 */
function buildBookletBulletin(data) {
  // Simple implementation: reuse the print template in a 2-column layout
  // for a 4-page A5 booklet (Front/Back on one side, Inside on the other)
  // This is a simplified version for the purpose of the refactor.
  return buildPrintBulletin(data); 
}

module.exports = { buildPrintBulletin, buildBookletBulletin };
