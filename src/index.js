'use strict';

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { fetchBulletinData, updateRunStatus }  = require('./sheets');
const { translateData }      = require('./translate');
const { buildBulletin }      = require('./template');
const { buildPrintBulletin, buildBookletBulletin } = require('./print-template');
const { generatePdf }        = require('./pdf');
const { generateQrSvg }      = require('./qr');
const { validateBulletin, validateLinks }   = require('./validate');
const { notifyFailures, notifySuccess, canSendEmail } = require('./notify');
const { canPublishWordPress, publishToWordPress } = require('./wordpress');
const { extractUrl }         = require('./utils');

// Official CACV Bulletin URL
const LIVE_URL = process.env.LIVE_URL || 'https://cacv.org.au/cacv-english-bulletin/';

function cleanOldOutputs(dir, maxAgeDays) {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const file of fs.readdirSync(dir)) {
    if (!/\.(html|pdf)$/.test(file)) continue;
    const filePath = path.join(dir, file);
    const { mtimeMs } = fs.statSync(filePath);
    if (mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      removed++;
    }
  }
  if (removed > 0) console.log(`Cleaned ${removed} output file(s) older than ${maxAgeDays} days.`);
}

async function main() {
  // ── Validate env ───────────────────────────────────────────────────────────
  const sheetId = process.env.SHEET_ID;
  const credsPath = process.env.CREDENTIALS_PATH;

  if (!sheetId) {
    console.error('Error: SHEET_ID is not set in .env');
    process.exit(1);
  }
  if (!credsPath) {
    console.error('Error: CREDENTIALS_PATH is not set in .env');
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(credsPath))) {
    console.error(`Error: credentials file not found at "${credsPath}"`);
    console.error('Place your service account JSON at that path and try again.');
    process.exit(1);
  }

  // ── Clean old outputs ──────────────────────────────────────────────────────
  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  cleanOldOutputs(outputDir, 30);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  console.log('Fetching bulletin data from Google Sheets…');
  const rawData = await fetchBulletinData(sheetId);

  // ── Translate Chinese content ───────────────────────────────────────────────
  const { data, failures } = await translateData(rawData);

  if (failures.length > 0) {
    console.warn(`\n⚠️  ${failures.length} translation(s) failed:`);
    failures.forEach(f => console.warn(`   • ${f.field}: ${f.reason}`));
    console.warn('');
  }

  // ── Validate required fields ───────────────────────────────────────────────
  const validationIssues = validateBulletin(data);
  const translationIssues = failures.map(f => `Translation failed — ${f.field}: ${f.reason}`);

  console.log('Checking announcement links…');
  const linkIssues = await validateLinks(data.announcements);
  if (linkIssues.length > 0) {
    console.warn(`\n⚠️  ${linkIssues.length} broken link(s):`);
    linkIssues.forEach(i => console.warn(`   • ${i}`));
    console.warn('');
  }

  const allIssues = [...validationIssues, ...translationIssues, ...linkIssues];

  if (validationIssues.length > 0) {
    console.warn(`\n⚠️  ${validationIssues.length} validation issue(s):`);
    validationIssues.forEach(i => console.warn(`   • ${i}`));
    console.warn('');
  }

  // ── Build HTML ────────────────────────────────────────────────────────────
  console.log('Building HTML…');

  // Generate QR codes for announcements (Print only)
  for (const ann of data.announcements) {
    const url = extractUrl(ann.body);
    if (url) {
      ann.qrSvg = await generateQrSvg(url).catch(() => null);
    }
  }

  const html = buildBulletin(data, failures);

  // ── Write output ──────────────────────────────────────────────────────────
  const dateSlug = slugifyDate(data.service.date);
  const filename = `bulletin-${dateSlug}.html`;
  const outputPath = path.join(outputDir, filename);

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`\nDone! Bulletin written to:\n  ${outputPath}\n`);

  // ── Generate QR code for live bulletin ───────────────────────────────────
  console.log('Generating QR code…');
  data.liveQrSvg = await generateQrSvg(LIVE_URL).catch(() => '');
  data.liveUrl   = LIVE_URL;

  // ── Generate print PDF ────────────────────────────────────────────────────
  let pdfPath = null;
  try {
    console.log('Building print HTML…');
    const printHtml = buildPrintBulletin(data);
    const printHtmlPath = path.join(outputDir, `bulletin-print-${dateSlug}.html`);
    fs.writeFileSync(printHtmlPath, printHtml, 'utf8');

    const printPdfPath = path.join(outputDir, `bulletin-print-${dateSlug}.pdf`);
    const pdfGenerated = await generatePdf(path.resolve(printHtmlPath), printPdfPath);
    if (pdfGenerated) pdfPath = printPdfPath;
  } catch (err) {
    console.warn(`Print PDF generation failed: ${err.message}`);
  }

  // ── Generate booklet PDF (2-up A4 landscape) ──────────────────────────────
  try {
    console.log('Building booklet HTML…');
    const bookletHtml = buildBookletBulletin(data);
    const bookletHtmlPath = path.join(outputDir, `bulletin-booklet-${dateSlug}.html`);
    fs.writeFileSync(bookletHtmlPath, bookletHtml, 'utf8');

    const bookletPdfPath = path.join(outputDir, `bulletin-booklet-${dateSlug}.pdf`);
    await generatePdf(path.resolve(bookletHtmlPath), bookletPdfPath, { landscape: true });
  } catch (err) {
    console.warn(`Booklet PDF generation failed: ${err.message}`);
  }

  // ── Send notifications ─────────────────────────────────────────────────────
  const to = data.notificationEmails || [];
  const serviceDate = data.service.date || 'Unknown date';

  if (canSendEmail()) {
    if (allIssues.length > 0) {
      console.log('Sending failure notification…');
      await notifyFailures({ to, serviceDate, liveUrl: LIVE_URL, issues: allIssues });
    } else {
      console.log('Sending success notification…');
      await notifySuccess({ to, serviceDate, liveUrl: LIVE_URL, pdfPath });
    }
  } else {
    console.log('Email notifications skipped (GMAIL_USER / GMAIL_APP_PASSWORD not configured).');
  }

  // ── Publish to WordPress ───────────────────────────────────────────────────
  if (canPublishWordPress()) {
    console.log('Publishing to WordPress…');
    await publishToWordPress({ title: `Bulletin — ${serviceDate}`, html, liveUrl: data.liveUrl });
  } else {
    console.log('WordPress publish skipped (WP_URL / WP_USERNAME / WP_APP_PASSWORD / WP_PAGE_ID not configured).');
  }

  // ── Update sheet status ────────────────────────────────────────────────────
  const runStatus = allIssues.length === 0
    ? '✓ Success'
    : `⚠️ Issues (${allIssues.length})`;
  await updateRunStatus(sheetId, runStatus);
}

/**
 * Convert a human-readable date string to a YYYYMMDD slug for filenames.
 * Handles formats like "22nd February 2026" or "22 Feb 2026" or "2026-02-22".
 * Falls back to the raw string (spaces replaced with dashes) if parsing fails.
 */
function slugifyDate(dateStr) {
  if (!dateStr) return 'undated';

  // Try ISO format first
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}${isoMatch[2]}${isoMatch[3]}`;

  // Try "22nd February 2026" / "22 Feb 2026"
  const months = {
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
    jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
  };
  const parts = dateStr.replace(/(\d+)(st|nd|rd|th)/i,'$1').split(/[\s,]+/);
  let day, month, year;
  for (const part of parts) {
    const num = parseInt(part, 10);
    const key = part.toLowerCase();
    if (!isNaN(num) && num > 31) year = num;
    else if (!isNaN(num) && num >= 1 && num <= 31 && !day) day = num;
    else if (months[key]) month = months[key];
  }
  if (day && month && year) {
    return `${year}${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}`;
  }

  // Fallback: sanitise raw string
  return dateStr.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'undated';
}

main().catch(err => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
