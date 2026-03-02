'use strict';

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { fetchBulletinData, updateRunStatus }  = require('./sheets');
const { translateData }      = require('./translate');
const { buildBulletin }      = require('./template');
const { buildPrintBulletin, buildBookletBulletin } = require('./print-template');
const { generatePdf, protectPdf } = require('./pdf');
const { generateQrSvg }      = require('./qr');
const { validateBulletin, validateLinks }   = require('./validate');
const { notifyFailures, notifySuccess, canSendEmail } = require('./notify');
const { canPublishWordPress, publishToWordPress } = require('./wordpress');
const { extractUrl, parseServiceDate } = require('./utils');

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
  console.log(`Found ${data.pdfAttachments?.length || 0} PDF attachment(s).`);

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
  const attachmentLocalPaths = [];
  
  if (data.pdfAttachments && data.pdfAttachments.length > 0) {
    const { downloadFromDrive } = require('./pdf');
    for (let i = 0; i < data.pdfAttachments.length; i++) {
      const att = data.pdfAttachments[i];
      try {
        const localPath = path.join(outputDir, `attachment-${dateSlug}-${i}.pdf`);
        console.log(`Downloading attachment [${att.name}] from: ${att.url}`);
        await downloadFromDrive(att.url, localPath, credsPath);
        attachmentLocalPaths.push(localPath);
      } catch (err) {
        console.warn(`Failed to download attachment [${att.name}]: ${err.message}`);
      }
    }
  }

  try {
    console.log('Building print HTML…');
    const printHtml = buildPrintBulletin(data);
    const printHtmlPath = path.join(outputDir, `bulletin-print-${dateSlug}.html`);
    fs.writeFileSync(printHtmlPath, printHtml, 'utf8');

    const printPdfPath = path.join(outputDir, `bulletin-print-${dateSlug}.pdf`);
    const printGenerated = await generatePdf(path.resolve(printHtmlPath), printPdfPath, {
      attachmentPaths: attachmentLocalPaths
    });
    const pdfPassword = data.pdfPassword || process.env.PDF_PASSWORD;
    if (printGenerated && pdfPassword) {
      try {
        protectPdf(printPdfPath, pdfPassword);
      } catch (err) {
        console.warn(`Print PDF protection skipped: ${err.message}`);
      }
    }
  } catch (err) {
    console.warn(`Print PDF generation failed: ${err.message}`);
    allIssues.push(`Print PDF generation failed: ${err.message}`);
  }

  // ── Generate booklet PDF (2-up A4 landscape) ──────────────────────────────
  try {
    console.log('Building booklet HTML…');
    const bookletHtml = buildBookletBulletin(data);
    const bookletHtmlPath = path.join(outputDir, `bulletin-booklet-${dateSlug}.html`);
    fs.writeFileSync(bookletHtmlPath, bookletHtml, 'utf8');

    const bookletPdfPath = path.join(outputDir, `bulletin-booklet-${dateSlug}.pdf`);
    const bookletGenerated = await generatePdf(path.resolve(bookletHtmlPath), bookletPdfPath, {
      landscape: true,
      attachmentPaths: attachmentLocalPaths
    });
    if (bookletGenerated) {
      pdfPath = bookletPdfPath;
      const pdfPassword = data.pdfPassword || process.env.PDF_PASSWORD;
      if (pdfPassword) {
        try {
          protectPdf(bookletPdfPath, pdfPassword);
        } catch (err) {
          console.warn(`Booklet PDF protection skipped: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.warn(`Booklet PDF generation failed: ${err.message}`);
    allIssues.push(`Booklet PDF generation failed: ${err.message}`);
  }

  // ── Finalise outputs for deployment ───────────────────────────────────────
  try {
    if (fs.existsSync(outputPath)) {
      fs.copyFileSync(outputPath, path.join(outputDir, 'index.html'));
      console.log('✓ Updated index.html');
    }
    
    const printHtmlPath = path.join(outputDir, `bulletin-print-${dateSlug}.html`);
    if (fs.existsSync(printHtmlPath)) {
      fs.copyFileSync(printHtmlPath, path.join(outputDir, 'print.html'));
      console.log('✓ Updated print.html');
    }

    if (pdfPath && fs.existsSync(pdfPath)) {
      fs.copyFileSync(pdfPath, path.join(outputDir, 'bulletin.pdf'));
      console.log('✓ Updated bulletin.pdf');
    }
  } catch (err) {
    console.warn(`Failed to finalise deployment files: ${err.message}`);
  }

  const to = data.notificationEmails || [];
  const serviceDate = data.service.date || 'Unknown date';

  // ── Publish to WordPress ───────────────────────────────────────────────────
  let wpPublished = false;
  if (canPublishWordPress()) {
    console.log('Publishing to WordPress…');
    wpPublished = await publishToWordPress({ title: `Bulletin — ${serviceDate}`, html, liveUrl: data.liveUrl });
    if (!wpPublished) {
      allIssues.push('WordPress publish failed — bulletin may not be live on the CACV website');
    }
  } else {
    console.log('WordPress publish skipped (WP_URL / WP_USERNAME / WP_APP_PASSWORD / WP_PAGE_ID not configured).');
  }

  // ── Send notifications ─────────────────────────────────────────────────────
  if (canSendEmail()) {
    if (allIssues.length > 0) {
      console.log('Sending failure notification…');
      await notifyFailures({ to, serviceDate, liveUrl: LIVE_URL, issues: allIssues });
    } else {
      // Only notify success once WordPress has confirmed the page is live
      console.log('Sending success notification…');
      await notifySuccess({ to, serviceDate, liveUrl: LIVE_URL, pdfPath });
    }
  } else {
    console.log('Email notifications skipped (GMAIL_USER / GMAIL_APP_PASSWORD not configured).');
  }

  // ── Update sheet status ────────────────────────────────────────────────────
  const runStatus = allIssues.length === 0
    ? '✓ Live'
    : `⚠️ Issues (${allIssues.length})`;
  await updateRunStatus(sheetId, runStatus, allIssues);
}

/**
 * Convert a human-readable date string to a YYYYMMDD slug for filenames.
 * Falls back to the sanitised raw string if parsing fails.
 */
function slugifyDate(dateStr) {
  if (!dateStr) return 'undated';
  const d = parseServiceDate(dateStr);
  if (d) {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  }
  return dateStr.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'undated';
}

main().catch(err => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
