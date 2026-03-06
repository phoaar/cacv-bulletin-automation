'use strict';

/**
 * Admin Quick Start Guide Generator
 * Generates docs/Admin_Quick_Start_Guide.pdf using puppeteer-core.
 *
 * Usage:
 *   cd "/Users/aaronpho/Documents/Code/CACV/Bulletin Automation"
 *   node docs/generate-guide.js
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const LIVE_URL = 'https://phoaar.github.io/cacv-bulletin-automation/';
const PDF_URL  = 'https://phoaar.github.io/cacv-bulletin-automation/output/bulletin.pdf';
const OUT_PATH = path.resolve(__dirname, 'Admin_Quick_Start_Guide.pdf');

// ─── Screenshot helpers ────────────────────────────────────────────────────────

async function screenshot(browser, url, opts = {}) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: opts.width || 1280, height: opts.height || 900, deviceScaleFactor: 1.5 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    if (opts.delay) await new Promise(r => setTimeout(r, opts.delay));
    const buf = await page.screenshot({ fullPage: !!opts.fullPage, type: 'png' });
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch (err) {
    console.warn(`  Screenshot skipped (${url}): ${err.message}`);
    return null;
  } finally {
    await page.close();
  }
}

// ─── Placeholder HTML ──────────────────────────────────────────────────────────

function placeholder(label) {
  return `<div class="placeholder">📸 ${label}</div>`;
}

// ─── Guide HTML ────────────────────────────────────────────────────────────────

function buildHtml({ bulletinScreenshot, pdfScreenshot }) {
  const bulletinImg = bulletinScreenshot
    ? `<img src="${bulletinScreenshot}" alt="Live bulletin preview" class="screenshot">`
    : placeholder('Live bulletin — phoaar.github.io/cacv-bulletin-automation');

  const pdfImg = pdfScreenshot
    ? `<img src="${pdfScreenshot}" alt="Booklet PDF preview" class="screenshot">`
    : placeholder('Booklet PDF — first page of bulletin.pdf');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Admin Quick Start Guide — CACV Bulletin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
  :root {
    --moss:  #3D4A2A;
    --paper: #F7F5EC;
    --slate: #8BA5C4;
    --sage:  #A8B896;
    --sand:  #EDE9D8;
    --fog:   #D8D5C4;
    --ink:   #2A2A2A;
    --warn:  #8B5E00;
    --warn-bg: #FFF8E7;
    --tip-bg:  #EBF3E8;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Instrument Sans', sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: var(--ink);
    background: white;
    padding: 0;
  }

  /* ── Cover page ── */
  .cover {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    min-height: 100vh;
    padding: 60px 56px;
    background: var(--moss);
    color: white;
    page-break-after: always;
  }
  .cover .label {
    font-family: 'Instrument Sans', sans-serif;
    font-size: 9pt;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--sage);
    margin-bottom: 18px;
  }
  .cover h1 {
    font-family: 'Instrument Serif', serif;
    font-size: 38pt;
    font-weight: 400;
    line-height: 1.15;
    color: var(--paper);
    margin-bottom: 20px;
    max-width: 480px;
  }
  .cover .subtitle {
    font-size: 12pt;
    color: var(--sage);
    max-width: 420px;
    line-height: 1.6;
    margin-bottom: 48px;
  }
  .cover .meta {
    font-size: 9pt;
    color: var(--fog);
    border-top: 1px solid rgba(255,255,255,0.15);
    padding-top: 20px;
    width: 100%;
  }

  /* ── Page layout ── */
  .page {
    padding: 24mm 22mm 20mm 22mm;
    max-width: 210mm;
    margin: 0 auto;
  }

  /* ── TOC ── */
  .toc-page { page-break-after: always; }
  .toc-page h2 { margin-bottom: 20px; }
  .toc-list { list-style: none; }
  .toc-list li {
    display: flex;
    align-items: baseline;
    gap: 0;
    padding: 6px 0;
    border-bottom: 1px dotted var(--fog);
  }
  .toc-list li:last-child { border-bottom: none; }
  .toc-section { font-weight: 500; flex: 1; }
  .toc-desc { color: #666; font-size: 9pt; margin-left: 8px; flex: 2; }

  /* ── Section headings ── */
  h2 {
    font-family: 'Instrument Serif', serif;
    font-size: 20pt;
    font-weight: 400;
    color: var(--moss);
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--sage);
  }
  h3 {
    font-family: 'Instrument Sans', sans-serif;
    font-size: 11pt;
    font-weight: 600;
    color: var(--moss);
    margin: 18px 0 8px;
  }
  h4 {
    font-size: 10.5pt;
    font-weight: 600;
    color: var(--ink);
    margin: 14px 0 6px;
  }

  /* ── Step badge ── */
  .step-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: var(--moss);
    color: white;
    padding: 6px 16px 6px 12px;
    border-radius: 4px;
    margin-bottom: 14px;
    font-size: 9.5pt;
    font-weight: 600;
    letter-spacing: 0.05em;
  }
  .step-badge .num {
    background: var(--sage);
    color: var(--moss);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9pt;
    font-weight: 700;
  }

  /* ── Callout boxes ── */
  .tip {
    background: var(--tip-bg);
    border-left: 3px solid var(--moss);
    padding: 10px 14px;
    margin: 12px 0;
    border-radius: 0 4px 4px 0;
    font-size: 9.5pt;
  }
  .tip strong { color: var(--moss); }
  .warn {
    background: var(--warn-bg);
    border-left: 3px solid #C8860A;
    padding: 10px 14px;
    margin: 12px 0;
    border-radius: 0 4px 4px 0;
    font-size: 9.5pt;
  }
  .warn strong { color: var(--warn); }

  /* ── Screenshot / placeholder ── */
  .screenshot {
    width: 100%;
    border: 1px solid var(--fog);
    border-radius: 4px;
    margin: 12px 0;
    display: block;
  }
  .placeholder {
    width: 100%;
    border: 1.5px dashed var(--fog);
    border-radius: 4px;
    background: var(--sand);
    color: #777;
    font-style: italic;
    font-size: 9.5pt;
    padding: 20px 16px;
    margin: 12px 0;
    text-align: center;
  }

  /* ── Tables ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 9.5pt;
  }
  th {
    background: var(--moss);
    color: white;
    padding: 7px 10px;
    text-align: left;
    font-weight: 600;
    font-size: 9pt;
  }
  td {
    padding: 6px 10px;
    border-bottom: 1px solid var(--fog);
    vertical-align: top;
  }
  tr:nth-child(even) td { background: var(--sand); }
  tr:last-child td { border-bottom: none; }
  td code, th code {
    background: rgba(0,0,0,0.07);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: monospace;
    font-size: 8.5pt;
  }

  /* ── Lists ── */
  ul, ol {
    padding-left: 20px;
    margin: 8px 0;
  }
  li { margin: 4px 0; }

  /* ── Workflow timeline ── */
  .timeline {
    display: flex;
    align-items: flex-start;
    gap: 0;
    margin: 20px 0;
    position: relative;
  }
  .timeline::before {
    content: '';
    position: absolute;
    top: 22px;
    left: 40px;
    right: 40px;
    height: 2px;
    background: var(--sage);
    z-index: 0;
  }
  .tl-step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
    z-index: 1;
  }
  .tl-dot {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--moss);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16pt;
    margin-bottom: 8px;
    flex-shrink: 0;
    border: 3px solid white;
    box-shadow: 0 0 0 2px var(--sage);
  }
  .tl-label {
    font-weight: 600;
    font-size: 8.5pt;
    color: var(--moss);
    line-height: 1.3;
  }
  .tl-when {
    font-size: 8pt;
    color: #888;
    margin-top: 3px;
  }

  /* ── Field tag ── */
  .field {
    display: inline-block;
    background: var(--sand);
    border: 1px solid var(--fog);
    padding: 1px 7px;
    border-radius: 3px;
    font-size: 8.5pt;
    font-weight: 600;
    color: var(--moss);
  }
  .req {
    display: inline-block;
    background: #FDECEA;
    border: 1px solid #E8A09A;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 8pt;
    color: #9B2B22;
    font-weight: 600;
    margin-left: 4px;
  }

  /* ── Menu path ── */
  .menu-path {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--moss);
    color: white;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 9pt;
    font-weight: 600;
    margin: 6px 0;
  }
  .menu-path .arrow { color: var(--sage); }

  /* ── Troubleshoot table ── */
  .trouble td:first-child { font-weight: 500; width: 40%; }

  /* ── Page break control ── */
  .break-before { page-break-before: always; }
  .break-after  { page-break-after:  always; }
  .no-break { page-break-inside: avoid; }

  p { margin: 8px 0; }

  /* ── Footer on each content page ── */
  @page { margin: 0; }
</style>
</head>
<body>

<!-- ══════════════════════════════════════════════════════════
     COVER PAGE
═══════════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="label">Chinese Australian Christian Village · Weekly Bulletin</div>
  <h1>Admin Quick Start Guide</h1>
  <div class="subtitle">
    Everything you need to fill in the Google Sheet, generate the weekly bulletin,
    and understand what gets published — in one place.
  </div>
  <div class="meta">
    For bulletin administrators &amp; pastoral team &bull;
    System: Automated Bulletin Pipeline v2 &bull;
    Updated March 2026
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     TABLE OF CONTENTS
═══════════════════════════════════════════════════════════ -->
<div class="page toc-page">
  <h2>Contents</h2>
  <ul class="toc-list">
    <li><span class="toc-section">1. Welcome</span><span class="toc-desc">What the system does &amp; your role</span></li>
    <li><span class="toc-section">2. Weekly Workflow Overview</span><span class="toc-desc">Mon → Fri → Sun at a glance</span></li>
    <li><span class="toc-section">3. The Google Sheet at a Glance</span><span class="toc-desc">All 7 tabs and their purpose</span></li>
    <li><span class="toc-section">4. Step 1 — Service Details</span><span class="toc-desc">Required fields, auto-filled fields</span></li>
    <li><span class="toc-section">5. Step 2 — Order of Service</span><span class="toc-desc">Adding and reordering items</span></li>
    <li><span class="toc-section">6. Step 3 — Announcements</span><span class="toc-desc">Title, body, QR codes, keep next week</span></li>
    <li><span class="toc-section">7. Step 4 — Prayer Items</span><span class="toc-desc">Categories, keep next week</span></li>
    <li><span class="toc-section">8. Step 5 — Roster</span><span class="toc-desc">Read-only view, secretary updates</span></li>
    <li><span class="toc-section">9. Step 6 — Events</span><span class="toc-desc">Adding events, show-on-bulletin flag</span></li>
    <li><span class="toc-section">10. Generating the Bulletin</span><span class="toc-desc">Bulletin menu → Generate Now / Schedule</span></li>
    <li><span class="toc-section">11. What Gets Published</span><span class="toc-desc">Web bulletin, booklet PDF, email</span></li>
    <li><span class="toc-section">12. After Service</span><span class="toc-desc">Attendance &amp; advancing to next week</span></li>
    <li><span class="toc-section">13. Settings &amp; Notifications</span><span class="toc-desc">⚙️ Settings tab, email recipients</span></li>
    <li><span class="toc-section">14. Troubleshooting</span><span class="toc-desc">Common issues &amp; fixes</span></li>
  </ul>

  <div class="tip" style="margin-top:28px;">
    <strong>Quick reference:</strong> If you just need to do the routine weekly update,
    follow Steps 1–6 (sections 4–9) then jump to section 10 to generate.
    The whole process takes about 10–15 minutes once you're familiar with it.
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 1: WELCOME
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>1. Welcome</h2>
  <p>
    The CACV Bulletin Automation system produces the weekly Sunday bulletin automatically —
    translating Chinese content, generating QR codes for announcements, composing a polished
    web bulletin and a print-ready booklet PDF, then publishing it to the website and sending
    notification emails.
  </p>
  <p>
    <strong>Your job as admin</strong> is simple: keep the Google Sheet up to date each week,
    then press a single button to trigger generation. Everything else — formatting, translation,
    PDF layout, website publishing — happens automatically.
  </p>

  <h3>What the system does for you</h3>
  <ul>
    <li>Translates Chinese service details and announcements (via AI)</li>
    <li>Generates a styled web bulletin at <strong>phoaar.github.io/cacv-bulletin-automation</strong></li>
    <li>Creates a print-ready A4 landscape booklet PDF (fold &amp; staple)</li>
    <li>Attaches any extra PDF documents (e.g. Communion service insert) automatically</li>
    <li>Sends notification emails to configured recipients</li>
    <li>Optionally publishes to the church WordPress website</li>
  </ul>

  <h3>What you are responsible for</h3>
  <ul>
    <li>Filling in the <strong>📋 Service Details</strong> tab each week</li>
    <li>Updating <strong>🗓 Order of Service</strong>, <strong>📢 Announcements</strong>, and <strong>🙏 Prayer Items</strong></li>
    <li>Checking that <strong>📅 Events</strong> are current</li>
    <li>Triggering bulletin generation via the <strong>Bulletin</strong> menu (or scheduling it)</li>
    <li>Clicking <strong>Next Service</strong> after Sunday to advance the roster</li>
  </ul>

  <div class="tip">
    <strong>Tip:</strong> You do not need to touch anything in
    <strong>👥 Roster</strong> — that is maintained by the church secretary.
    The system reads it automatically.
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 2: WEEKLY WORKFLOW OVERVIEW
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>2. Weekly Workflow Overview</h2>
  <p>The typical weekly cycle runs from Monday to Sunday:</p>

  <div class="timeline">
    <div class="tl-step">
      <div class="tl-dot">📋</div>
      <div class="tl-label">Fill Sheet</div>
      <div class="tl-when">Mon – Thu</div>
    </div>
    <div class="tl-step">
      <div class="tl-dot">🔄</div>
      <div class="tl-label">Generate Bulletin</div>
      <div class="tl-when">Fri (by noon)</div>
    </div>
    <div class="tl-step">
      <div class="tl-dot">✉️</div>
      <div class="tl-label">Email Sent</div>
      <div class="tl-when">Fri (auto)</div>
    </div>
    <div class="tl-step">
      <div class="tl-dot">⛪</div>
      <div class="tl-label">Sunday Service</div>
      <div class="tl-when">Sun</div>
    </div>
    <div class="tl-step">
      <div class="tl-dot">➡️</div>
      <div class="tl-label">Next Service</div>
      <div class="tl-when">Sun (after)</div>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Day</th><th>Action</th><th>Who</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Mon – Wed</strong></td>
        <td>Update Service Details, Announcements, Prayer Items</td>
        <td>Admin</td>
      </tr>
      <tr>
        <td><strong>Thu</strong></td>
        <td>Final review — confirm all required fields are filled</td>
        <td>Admin</td>
      </tr>
      <tr>
        <td><strong>Fri (by noon)</strong></td>
        <td>
          Open the Sheet → <strong>Bulletin menu → Schedule for This Week</strong>
          (auto-runs at noon Friday), <em>or</em>
          click <strong>Generate Now</strong> immediately
        </td>
        <td>Admin</td>
      </tr>
      <tr>
        <td><strong>Fri</strong></td>
        <td>System generates bulletin, publishes to website, emails recipients</td>
        <td>Automated</td>
      </tr>
      <tr>
        <td><strong>Sunday (after)</strong></td>
        <td>Click <strong>Bulletin → Next Service</strong> to advance the roster</td>
        <td>Admin</td>
      </tr>
    </tbody>
  </table>

  <div class="warn">
    <strong>Important:</strong> If you use <em>Schedule for This Week</em>, the bulletin
    will generate automatically at Friday noon — you do not need to do anything else that day.
    However, make sure all content is entered <em>before</em> noon Friday.
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 3: THE GOOGLE SHEET AT A GLANCE
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>3. The Google Sheet at a Glance</h2>
  <p>
    The Sheet has 7 tabs. The first 4 rows of each tab are header rows — data starts on row 5.
    Cells highlighted <strong>yellow</strong> are required; the rest are optional or auto-filled.
  </p>

  <table>
    <thead>
      <tr><th>Tab</th><th>Purpose</th><th>Who edits?</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>📋 Service Details</strong></td>
        <td>Date, sermon, preacher, language, special notes. Main data entry tab.</td>
        <td>Admin</td>
      </tr>
      <tr>
        <td><strong>🗓 Order of Service</strong></td>
        <td>Each row = one item in the service (song, prayer, sermon, etc.).</td>
        <td>Admin</td>
      </tr>
      <tr>
        <td><strong>📢 Announcements</strong></td>
        <td>Title + body text for each announcement. URLs become QR codes.</td>
        <td>Admin</td>
      </tr>
      <tr>
        <td><strong>🙏 Prayer Items</strong></td>
        <td>Prayer requests grouped by category (Praise, Church, Community, etc.).</td>
        <td>Admin</td>
      </tr>
      <tr>
        <td><strong>👥 Roster</strong></td>
        <td>Weekly duty roster (Preacher, Chair, Worship, Ushers, etc.). Read-only for admins.</td>
        <td>Church Secretary</td>
      </tr>
      <tr>
        <td><strong>📅 Events</strong></td>
        <td>Upcoming events. Past events are hidden automatically.</td>
        <td>Admin</td>
      </tr>
      <tr>
        <td><strong>⚙️ Settings</strong></td>
        <td>Email recipients, WordPress settings, PDF password, generation log.</td>
        <td>Admin (occasionally)</td>
      </tr>
    </tbody>
  </table>

  ${placeholder('Google Sheet — overview of all 7 tabs (requires Google login to screenshot)')}

  <div class="tip">
    <strong>Sheet protections:</strong> The Roster tab and formula-driven cells are protected —
    you will see a padlock icon if you try to edit them. This is intentional; the system reads
    these values automatically. Never try to override a protected cell.
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 4: STEP 1 — SERVICE DETAILS
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>4. Step 1 — Service Details <span style="font-family:sans-serif;font-size:14pt;">📋</span></h2>
  <div class="step-badge"><span class="num">1</span> Start here every week</div>

  <p>
    The <strong>📋 Service Details</strong> tab is the main data entry tab.
    It uses key–value rows: column A is the field name, column B is your value.
  </p>

  <h3>Required fields <span class="req">must fill</span></h3>
  <table>
    <thead>
      <tr><th>Field (Column A)</th><th>What to enter</th><th>Example</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="field">Service Date</span></td>
        <td>Date of the upcoming Sunday service</td>
        <td><code>2 March 2026</code></td>
      </tr>
      <tr>
        <td><span class="field">Sermon Title</span></td>
        <td>Full sermon title (English)</td>
        <td><code>Walking in the Light</code></td>
      </tr>
      <tr>
        <td><span class="field">Sermon Title (Chinese)</span></td>
        <td>Chinese sermon title (auto-translated if blank)</td>
        <td><code>行在光中</code></td>
      </tr>
      <tr>
        <td><span class="field">Scripture</span></td>
        <td>Bible passage reference</td>
        <td><code>1 John 1:5–10</code></td>
      </tr>
      <tr>
        <td><span class="field">Preacher</span></td>
        <td>Preacher name (auto-filled from Roster)</td>
        <td><code>Rev. David Chan</code></td>
      </tr>
      <tr>
        <td><span class="field">Service Type</span></td>
        <td>Regular / Communion / Special</td>
        <td><code>Regular</code></td>
      </tr>
      <tr>
        <td><span class="field">Language</span></td>
        <td>Primary language of the service</td>
        <td><code>Cantonese</code></td>
      </tr>
    </tbody>
  </table>

  <h3>Auto-filled fields (do not type)</h3>
  <p>
    The following fields are pulled automatically from other tabs or the Roster —
    leave them as-is unless the auto-fill is wrong:
  </p>
  <ul>
    <li><span class="field">Chair</span>, <span class="field">Worship</span>, <span class="field">Music</span>,
        <span class="field">PA</span>, <span class="field">Ushers</span> — from Roster tab</li>
    <li><span class="field">Morning Tea</span> — from Roster tab</li>
  </ul>

  <h3>Optional fields</h3>
  <ul>
    <li><span class="field">Special Notes</span> — any one-off message shown on the bulletin header</li>
    <li><span class="field">PDF Attachment URL</span> — Google Drive URL of a PDF to append to the booklet
        (e.g. Communion service insert). Must be a shared Drive link.</li>
    <li><span class="field">PDF Password</span> — set a password on the output PDF (overrides system default)</li>
  </ul>

  ${placeholder('📋 Service Details tab — filled example (requires Google login)')}

  <div class="warn">
    <strong>Sermon / Scripture rows in Order of Service are formula-driven.</strong>
    Do <em>not</em> type directly into those cells — the values flow from Service Details automatically.
    If you need to change the sermon title, update it here in Service Details.
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 5: STEP 2 — ORDER OF SERVICE
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>5. Step 2 — Order of Service <span style="font-family:sans-serif;font-size:14pt;">🗓</span></h2>
  <div class="step-badge"><span class="num">2</span> Define the service flow</div>

  <p>
    Each row in this tab represents one item in the Sunday service programme.
    The bulletin lists items in the order they appear here.
  </p>

  <h3>Columns</h3>
  <table>
    <thead>
      <tr><th>Column</th><th>What to enter</th></tr>
    </thead>
    <tbody>
      <tr><td><strong>Item</strong></td><td>Short name of the item (e.g. <code>Opening Prayer</code>, <code>Praise &amp; Worship</code>)</td></tr>
      <tr><td><strong>Item (Chinese)</strong></td><td>Chinese name — auto-translated if blank</td></tr>
      <tr><td><strong>Detail</strong></td><td>Optional extra info (e.g. song title, Scripture reference)</td></tr>
      <tr><td><strong>Detail (Chinese)</strong></td><td>Chinese detail — auto-translated if blank</td></tr>
      <tr><td><strong>Leader</strong></td><td>Person leading this item (if applicable)</td></tr>
    </tbody>
  </table>

  <h3>Adding / reordering items</h3>
  <ul>
    <li>To <strong>add</strong> a new item: type in the next empty row.</li>
    <li>To <strong>reorder</strong>: cut the row (right-click → Cut) and paste it where you need it.</li>
    <li>To <strong>remove</strong> an item: delete the row contents (or right-click → Delete row).</li>
  </ul>

  <div class="warn">
    <strong>Do not edit the Sermon or Scripture rows directly.</strong>
    These rows contain formulas that pull values from the Service Details tab.
    Typing over them will break the link. If you accidentally overwrite one,
    press <strong>Ctrl+Z / Cmd+Z</strong> to undo.
  </div>

  <h3>Typical order of service</h3>
  <ol>
    <li>Welcome &amp; Announcements</li>
    <li>Opening Prayer</li>
    <li>Praise &amp; Worship (3–4 songs)</li>
    <li>Scripture Reading</li>
    <li>Sermon</li>
    <li>Response / Altar Call</li>
    <li>Offering</li>
    <li>Communion (if applicable)</li>
    <li>Benediction</li>
  </ol>

  ${placeholder('🗓 Order of Service tab — example rows (requires Google login)')}
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 6: STEP 3 — ANNOUNCEMENTS
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>6. Step 3 — Announcements <span style="font-family:sans-serif;font-size:14pt;">📢</span></h2>
  <div class="step-badge"><span class="num">3</span> What's happening in the church</div>

  <p>
    Each row in this tab is one announcement that appears on the bulletin.
    Announcements are shown in the web bulletin and in the print PDF.
  </p>

  <h3>Columns</h3>
  <table>
    <thead>
      <tr><th>Column</th><th>What to enter</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Title</strong> <span class="req">required</span></td>
        <td>Short heading for the announcement</td>
      </tr>
      <tr>
        <td><strong>Title (Chinese)</strong></td>
        <td>Chinese heading — auto-translated if blank</td>
      </tr>
      <tr>
        <td><strong>Body</strong></td>
        <td>Full announcement text. Can include dates, details, contacts.</td>
      </tr>
      <tr>
        <td><strong>Body (Chinese)</strong></td>
        <td>Chinese body — auto-translated if blank</td>
      </tr>
      <tr>
        <td><strong>URL</strong></td>
        <td>Optional link (registration, form, etc.). If provided, a QR code is generated automatically.</td>
      </tr>
      <tr>
        <td><strong>Keep next week?</strong></td>
        <td>Type <code>Yes</code> to carry this announcement forward when you click <em>Next Service</em>.</td>
      </tr>
    </tbody>
  </table>

  <h3>QR codes</h3>
  <p>
    If you enter a URL in the URL column, the system automatically generates a QR code
    that appears alongside the announcement in the print bulletin.
    This lets church members scan to register for events or access resources.
  </p>

  <div class="tip">
    <strong>Tip:</strong> Use URL shorteners (e.g. <code>bit.ly</code>) for long links
    — shorter URLs produce cleaner QR codes that are easier to scan in print.
  </div>

  <h3>Keep next week?</h3>
  <p>
    When you click <strong>Bulletin → Next Service</strong> after Sunday, announcements with
    <code>Yes</code> in the <em>Keep next week?</em> column are preserved.
    All others are cleared. Use this for multi-week announcements.
  </p>

  ${placeholder('📢 Announcements tab — example with URL and Keep columns (requires Google login)')}
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 7: STEP 4 — PRAYER ITEMS
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>7. Step 4 — Prayer Items <span style="font-family:sans-serif;font-size:14pt;">🙏</span></h2>
  <div class="step-badge"><span class="num">4</span> Weekly prayer needs</div>

  <p>
    Each row is one prayer request shown on the bulletin.
    Items are grouped by <strong>Category</strong> on the bulletin.
  </p>

  <h3>Columns</h3>
  <table>
    <thead>
      <tr><th>Column</th><th>What to enter</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Category</strong></td>
        <td>Group name: <code>Praise</code>, <code>Church</code>, <code>Community</code>, <code>World</code>, etc.</td>
      </tr>
      <tr>
        <td><strong>Item</strong> <span class="req">required</span></td>
        <td>The prayer request text (English)</td>
      </tr>
      <tr>
        <td><strong>Item (Chinese)</strong></td>
        <td>Chinese text — auto-translated if blank</td>
      </tr>
      <tr>
        <td><strong>Keep next week?</strong></td>
        <td>Type <code>Yes</code> to carry forward when Next Service is clicked</td>
      </tr>
    </tbody>
  </table>

  <h3>Typical categories</h3>
  <ul>
    <li><strong>Praise</strong> — thanksgiving and answered prayers</li>
    <li><strong>Church</strong> — congregation-specific needs (sick members, ministry needs)</li>
    <li><strong>Community</strong> — local community concerns</li>
    <li><strong>World</strong> — broader global prayer points</li>
  </ul>

  <div class="tip">
    <strong>Tip:</strong> Keep individual items concise (1–2 sentences). Long items
    may be truncated in the print bulletin layout.
  </div>

  ${placeholder('🙏 Prayer Items tab — example with categories (requires Google login)')}
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 8: STEP 5 — ROSTER
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>8. Step 5 — Roster <span style="font-family:sans-serif;font-size:14pt;">👥</span></h2>
  <div class="step-badge"><span class="num">5</span> Read-only — maintained by secretary</div>

  <p>
    The <strong>👥 Roster</strong> tab lists who is on duty for each Sunday.
    It is <strong>read-only for bulletin admins</strong> — do not edit it.
  </p>

  <h3>Roster columns</h3>
  <table>
    <thead>
      <tr><th>Column</th><th>Duty</th></tr>
    </thead>
    <tbody>
      <tr><td>A</td><td>Date text (e.g. <em>1st Sunday of March</em>)</td></tr>
      <tr><td>B</td><td>Year</td></tr>
      <tr><td>C</td><td>Preacher</td></tr>
      <tr><td>D</td><td>Chair</td></tr>
      <tr><td>E</td><td>Worship leader</td></tr>
      <tr><td>F</td><td>Music (band/organist)</td></tr>
      <tr><td>G</td><td>PowerPoint operator</td></tr>
      <tr><td>H</td><td>PA / sound</td></tr>
      <tr><td>I</td><td>Chief Usher</td></tr>
      <tr><td>J</td><td>Ushers</td></tr>
      <tr><td>K</td><td>Morning Tea</td></tr>
    </tbody>
  </table>

  <h3>How it works</h3>
  <ul>
    <li>
      When you click <strong>Bulletin → Next Service</strong>, the system reads the <em>next</em>
      row in the Roster (by date) and auto-fills the Service Details tab.
    </li>
    <li>
      If a name is wrong on the bulletin, contact the church secretary to update the Roster.
      Do not type over the auto-filled cells in Service Details — they will be overwritten next time.
    </li>
  </ul>

  <div class="warn">
    <strong>Protected tab:</strong> The Roster tab is sheet-protected. Attempting to edit it
    will show an error. If the duty assignments for a particular Sunday need to change,
    ask the church secretary.
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 9: STEP 6 — EVENTS
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>9. Step 6 — Events <span style="font-family:sans-serif;font-size:14pt;">📅</span></h2>
  <div class="step-badge"><span class="num">6</span> Upcoming church events</div>

  <p>
    The <strong>📅 Events</strong> tab lists upcoming events shown in the <em>Events</em>
    section of the bulletin. Past events are hidden from the bulletin automatically —
    you don't need to delete old rows.
  </p>

  <h3>Columns</h3>
  <table>
    <thead>
      <tr><th>Column</th><th>What to enter</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Date</strong> <span class="req">required</span></td>
        <td>Event date (format: <code>DD/MM/YYYY</code> or <code>1 March 2026</code>)</td>
      </tr>
      <tr>
        <td><strong>Title</strong> <span class="req">required</span></td>
        <td>Event name</td>
      </tr>
      <tr>
        <td><strong>Title (Chinese)</strong></td>
        <td>Chinese name — auto-translated if blank</td>
      </tr>
      <tr>
        <td><strong>Description</strong></td>
        <td>Brief event details</td>
      </tr>
      <tr>
        <td><strong>Description (Chinese)</strong></td>
        <td>Auto-translated if blank</td>
      </tr>
      <tr>
        <td><strong>Show on bulletin?</strong></td>
        <td>
          <code>Yes</code> = include on bulletin; <code>No</code> = internal record only.
          Defaults to <code>Yes</code> if blank.
        </td>
      </tr>
    </tbody>
  </table>

  <div class="tip">
    <strong>Auto-filtering:</strong> Only events with a date on or after the service date
    appear on the bulletin. You can safely add future events weeks in advance.
  </div>

  ${placeholder('📅 Events tab — example events (requires Google login)')}
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 10: GENERATING THE BULLETIN
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>10. Generating the Bulletin</h2>
  <p>
    Once the Sheet is filled in, generating the bulletin takes a single click.
    The menu is in the Google Sheet menu bar under <strong>Bulletin</strong>.
  </p>

  ${placeholder('Bulletin menu in Google Sheet — showing all menu options (requires Google login)')}

  <h3>Menu options explained</h3>
  <table>
    <thead>
      <tr><th>Menu Item</th><th>What it does</th><th>When to use</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Generate Now</strong></td>
        <td>Runs the pipeline immediately — translates, generates, publishes, emails.</td>
        <td>When you're ready to publish straight away</td>
      </tr>
      <tr>
        <td><strong>Schedule for This Week</strong></td>
        <td>Sets the system to auto-generate at Friday noon this week.</td>
        <td>Normal weekly workflow — set and forget</td>
      </tr>
      <tr>
        <td><strong>Next Service</strong></td>
        <td>Advances the roster to the next Sunday, clears non-kept content.</td>
        <td>After Sunday service, to prepare for next week</td>
      </tr>
      <tr>
        <td><strong>View PDF</strong></td>
        <td>Opens the published booklet PDF in a new tab.</td>
        <td>To review the latest published bulletin</td>
      </tr>
      <tr>
        <td><strong>Custom Date…</strong></td>
        <td>Generate for a specific date (e.g. a special service).</td>
        <td>Public holidays, Christmas, Easter, etc.</td>
      </tr>
    </tbody>
  </table>

  <h3>What happens when you click Generate Now</h3>
  <ol>
    <li>A confirmation dialog appears — click <strong>OK</strong> to proceed.</li>
    <li>The script runs (takes 1–3 minutes). You'll see a progress bar.</li>
    <li>On success, a green confirmation appears with a link to the live bulletin.</li>
    <li>Email notifications are sent to all configured recipients.</li>
    <li>The website is updated with the new bulletin and PDF.</li>
  </ol>

  <div class="warn">
    <strong>Do not close the Sheet</strong> while generation is running — this can interrupt
    the Apps Script. Wait for the confirmation message before navigating away.
  </div>

  <div class="tip">
    <strong>Validation check:</strong> If any required fields are missing, generation will stop
    and show a list of what needs to be filled in. Fix the missing fields and run again.
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 11: WHAT GETS PUBLISHED
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>11. What Gets Published</h2>
  <p>
    Each generation run produces and publishes three things:
    a live web bulletin, a print booklet PDF, and email notifications.
  </p>

  <h3>Live web bulletin</h3>
  <p>
    A responsive web page at <strong>phoaar.github.io/cacv-bulletin-automation</strong>
    — designed for phone and desktop viewing.
    Church members can access it via the QR code on the print bulletin cover.
  </p>

  ${bulletinImg}

  <h3>Booklet PDF (bulletin.pdf)</h3>
  <p>
    An A4 landscape PDF designed for folding in half to produce an A5 booklet.
    Print double-sided, fold in half, staple on the spine. 4 pages total:
  </p>
  <table>
    <thead><tr><th>Page</th><th>Content</th></tr></thead>
    <tbody>
      <tr><td><strong>Cover (front)</strong></td><td>Church name, service date, sermon title, QR code to web bulletin</td></tr>
      <tr><td><strong>Back cover</strong></td><td>Prayer items</td></tr>
      <tr><td><strong>Inside left</strong></td><td>Order of service + duty roster</td></tr>
      <tr><td><strong>Inside right</strong></td><td>Announcements &amp; events</td></tr>
    </tbody>
  </table>

  ${pdfImg}

  <div class="tip">
    <strong>PDF attachment:</strong> If a Google Drive PDF URL is set in Service Details,
    that PDF is automatically appended to the booklet after the 4 main pages.
    Use this for Communion service inserts or devotional handouts.
  </div>

  <h3>Email notification</h3>
  <p>
    An email is sent to all recipients listed in the <strong>⚙️ Settings</strong> tab.
    It includes the bulletin PDF as an attachment and links to the live web bulletin.
  </p>
  ${placeholder('Email notification — example with PDF attachment and bulletin link')}
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 12: AFTER SERVICE
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>12. After Service</h2>
  <p>
    After Sunday service, do two things to keep the system current for next week:
  </p>

  <h3>1. Click "Next Service"</h3>
  <p>
    In the Google Sheet, go to <strong>Bulletin → Next Service</strong>.
    This will:
  </p>
  <ul>
    <li>Advance the Roster pointer to the next Sunday</li>
    <li>Auto-fill preacher, chair, worship, and other roles from the Roster</li>
    <li>Clear announcements and prayer items <em>not</em> marked "Keep next week?"</li>
    <li>Update the service date in Service Details</li>
  </ul>

  <div class="tip">
    <strong>Timing:</strong> Click Next Service on Sunday afternoon or Monday morning,
    before you begin entering content for the coming week.
  </div>

  <h3>2. Start next week's content</h3>
  <p>
    Once Next Service has run, the Sheet is ready for the coming week.
    Begin entering the new sermon details, announcements, and prayer items
    for next Sunday.
  </p>

  <div class="warn">
    <strong>Don't click Next Service twice</strong> — it advances the Roster one row
    each time. If clicked accidentally, use <strong>Ctrl+Z / Cmd+Z</strong> to undo,
    or contact your system administrator to reset the roster pointer.
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 13: SETTINGS & NOTIFICATIONS
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>13. Settings &amp; Notifications <span style="font-family:sans-serif;font-size:14pt;">⚙️</span></h2>
  <p>
    The <strong>⚙️ Settings</strong> tab controls system-wide options.
    You rarely need to change these, but here is what each setting does.
  </p>

  <h3>Key settings</h3>
  <table>
    <thead>
      <tr><th>Setting</th><th>What it controls</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Email Recipients</strong></td>
        <td>
          Comma-separated email addresses that receive the bulletin each week.
          Add or remove addresses here as team members change.
        </td>
      </tr>
      <tr>
        <td><strong>PDF Password</strong></td>
        <td>
          Password to protect the published PDF (recommended for privacy).
          If blank, falls back to the system default password.
        </td>
      </tr>
      <tr>
        <td><strong>WordPress Publish</strong></td>
        <td><code>Yes</code>/<code>No</code> — whether to publish to the church WordPress site.</td>
      </tr>
      <tr>
        <td><strong>Generation Log</strong></td>
        <td>
          Read-only log of the last 10 generation runs — timestamp, status, and any errors.
          Check here if something seems wrong.
        </td>
      </tr>
    </tbody>
  </table>

  <h3>Adding email recipients</h3>
  <ol>
    <li>Open the <strong>⚙️ Settings</strong> tab</li>
    <li>Find the <strong>Email Recipients</strong> row</li>
    <li>In column B, add the new email address separated by a comma</li>
    <li>Example: <code>pastor@cacv.org.au, secretary@cacv.org.au, admin@cacv.org.au</code></li>
  </ol>

  <div class="tip">
    <strong>Generation Log:</strong> After clicking Generate Now, check the Settings tab
    Generation Log section to confirm the run completed successfully.
    Each entry shows the timestamp, outcome (Success / Failed), and any error message.
  </div>

  ${placeholder('⚙️ Settings tab — Email Recipients and Generation Log (requires Google login)')}
</div>

<!-- ══════════════════════════════════════════════════════════
     SECTION 14: TROUBLESHOOTING
═══════════════════════════════════════════════════════════ -->
<div class="page break-before">
  <h2>14. Troubleshooting</h2>
  <p>
    Most issues are caused by missing required fields or temporary network problems.
    Check the Generation Log in the <strong>⚙️ Settings</strong> tab for the error message,
    then use the table below.
  </p>

  <table class="trouble">
    <thead>
      <tr><th>Problem</th><th>Likely cause &amp; fix</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>"Validation failed" error when generating</td>
        <td>
          One or more required fields are empty. The error message lists exactly which fields
          need to be filled. Fix them and click Generate Now again.
        </td>
      </tr>
      <tr>
        <td>Bulletin shows wrong preacher / roster names</td>
        <td>
          The Roster tab may not be up to date. Ask the church secretary to correct it,
          then re-generate.
        </td>
      </tr>
      <tr>
        <td>Translation didn't run — Chinese text missing</td>
        <td>
          The AI translation service may have timed out. Re-run Generate Now.
          If persistent, check the Generation Log for an API error.
        </td>
      </tr>
      <tr>
        <td>PDF not updated on website after generating</td>
        <td>
          GitHub Pages can take 1–3 minutes to deploy. Wait a few minutes and refresh.
          Check the Generation Log confirms success.
        </td>
      </tr>
      <tr>
        <td>Email not received after generation</td>
        <td>
          Check Spam folder. Verify email addresses in <strong>⚙️ Settings → Email Recipients</strong>.
          Check the Generation Log for an email error.
        </td>
      </tr>
      <tr>
        <td>QR code not appearing on an announcement</td>
        <td>
          Make sure the URL column is a valid URL starting with <code>http://</code>
          or <code>https://</code>.
        </td>
      </tr>
      <tr>
        <td>"Next Service" didn't advance the roster</td>
        <td>
          The system could not find a future row in the Roster tab.
          Ask the church secretary to add more dates to the Roster.
        </td>
      </tr>
      <tr>
        <td>PDF attachment not appearing in booklet</td>
        <td>
          The Google Drive link in <em>Service Details → PDF Attachment URL</em> may not be
          publicly shared. Ensure the Drive file is set to "Anyone with the link can view".
        </td>
      </tr>
      <tr>
        <td>Generation takes more than 5 minutes</td>
        <td>
          The script may have hung. Close the confirmation dialog, wait 2 minutes,
          then try Generate Now again.
        </td>
      </tr>
      <tr>
        <td>Apps Script "Authorization required" popup</td>
        <td>
          Click <strong>Review Permissions</strong> and grant the requested permissions
          (this only happens once, or after a permission scope change).
        </td>
      </tr>
      <tr>
        <td>Anything else</td>
        <td>
          Note the exact error from the Generation Log and contact your system administrator
          with the error text and the date/time it occurred.
        </td>
      </tr>
    </tbody>
  </table>

  <div class="tip" style="margin-top: 20px;">
    <strong>Best practice:</strong> Generate the bulletin on Thursday afternoon for a
    final check before scheduling Friday delivery. This gives time to fix any issues.
  </div>

  <div style="margin-top: 40px; border-top: 2px solid var(--sage); padding-top: 20px; text-align: center; color: #888; font-size: 9pt;">
    <p>CACV Bulletin Automation · Admin Quick Start Guide · Updated March 2026</p>
    <p style="margin-top: 6px;">
      System administrator: <strong>phoaar</strong> ·
      Live bulletin: <strong>phoaar.github.io/cacv-bulletin-automation</strong>
    </p>
  </div>
</div>

</body>
</html>`;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const chromePath = process.env.CHROME_PATH;
  if (!chromePath) {
    console.error('Error: CHROME_PATH not set in .env');
    process.exit(1);
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch (err) {
    console.error('Error: puppeteer-core not installed:', err.message);
    process.exit(1);
  }

  console.log('Launching browser…');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let bulletinScreenshot = null;
  let pdfScreenshot = null;

  try {
    // 1. Screenshot the live bulletin
    console.log('Taking screenshot of live bulletin…');
    bulletinScreenshot = await screenshot(browser, LIVE_URL, {
      width: 1280,
      height: 900,
      fullPage: false,
      delay: 1000,
    });
    if (bulletinScreenshot) console.log('  ✓ Bulletin screenshot captured.');

    // 2. Screenshot the bulletin PDF (open in browser)
    console.log('Taking screenshot of bulletin PDF…');
    pdfScreenshot = await screenshot(browser, PDF_URL, {
      width: 1280,
      height: 900,
      fullPage: false,
      delay: 2000,
    });
    if (pdfScreenshot) console.log('  ✓ PDF screenshot captured.');
    else console.log('  ⚠ PDF screenshot skipped (browser PDF viewer may not render it).');

    // 3. Build HTML
    console.log('Building guide HTML…');
    const html = buildHtml({ bulletinScreenshot, pdfScreenshot });

    // 4. Render to PDF
    console.log('Rendering PDF…');
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      path: OUT_PATH,
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

    await page.close();

    console.log(`\n✓ Guide saved to: ${OUT_PATH}`);
    console.log(`  Size: ${(fs.statSync(OUT_PATH).size / 1024).toFixed(0)} KB`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
