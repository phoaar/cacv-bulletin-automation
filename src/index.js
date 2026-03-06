'use strict';

const fs   = require('fs');
const fsp  = require('fs').promises;
const path = require('path');
const config = require('./config');
const { fetchBulletinData, updateRunStatus }  = require('./sheets');
const { translateData }      = require('./translate');
const { buildBulletin }      = require('./template');
const { buildPrintBulletin, buildBookletBulletin } = require('./print-template');
const { generatePdf, protectPdf, downloadFromDrive } = require('./pdf');
const { generateQrSvg }      = require('./qr');
const { validateBulletin, validateLinks }   = require('./validate');
const { notifyFailures, notifySuccess, canSendEmail } = require('./notify');
const { canPublishWordPress, publishToWordPress } = require('./wordpress');
const { extractUrl, parseServiceDate } = require('./utils');

/**
 * Clean up old output files asynchronously.
 */
async function cleanOldOutputs(dir, maxAgeDays) {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  try {
    const files = await fsp.readdir(dir);
    for (const file of files) {
      if (!/\.(html|pdf)$/.test(file)) continue;
      const filePath = path.join(dir, file);
      const stats = await fsp.stat(filePath);
      if (stats.mtimeMs < cutoff) {
        await fsp.unlink(filePath);
        removed++;
      }
    }
    if (removed > 0) console.log(`Cleaned ${removed} output file(s) older than ${maxAgeDays} days.`);
  } catch (err) {
    console.warn(`Failed to clean old outputs: ${err.message}`);
  }
}

/**
 * Helper to generate and protect a PDF.
 */
async function generateAndProtectPdf(name, htmlBuilder, data, outputDir, dateSlug, opts = {}) {
  try {
    console.log(`Building ${name} HTML…`);
    const html = htmlBuilder(data);
    const htmlPath = path.join(outputDir, `bulletin-${name}-${dateSlug}.html`);
    fs.writeFileSync(htmlPath, html, 'utf8');

    const pdfPath = path.join(outputDir, `bulletin-${name}-${dateSlug}.pdf`);
    const generated = await generatePdf(path.resolve(htmlPath), pdfPath, {
      ...opts,
      attachmentPaths: opts.attachmentPaths || []
    });

    if (generated) {
      const pdfPassword = (data.pdfPassword || config.PDF_PASSWORD || '').trim();
      if (pdfPassword) {
        try {
          protectPdf(pdfPath, pdfPassword);
        } catch (err) {
          console.warn(`${name} PDF protection skipped: ${err.message}`);
        }
      }
    }
    return { generated, pdfPath, htmlPath };
  } catch (err) {
    console.warn(`${name} PDF generation failed: ${err.message}`);
    throw err;
  }
}

async function main() {
  // ── Validate env ───────────────────────────────────────────────────────────
  if (!config.SHEET_ID) {
    console.error('Error: SHEET_ID is not set in .env');
    process.exit(1);
  }
  if (!config.CREDENTIALS_PATH) {
    console.error('Error: CREDENTIALS_PATH is not set in .env');
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(config.CREDENTIALS_PATH))) {
    console.error(`Error: credentials file not found at "${config.CREDENTIALS_PATH}"`);
    console.error('Place your service account JSON at that path and try again.');
    process.exit(1);
  }

  // ── Clean old outputs ──────────────────────────────────────────────────────
  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  await cleanOldOutputs(outputDir, 30);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  console.log('Fetching bulletin data from Google Sheets…');
  const rawData = await fetchBulletinData(config.SHEET_ID);

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

  // Generate QR codes for announcements in parallel
  await Promise.all(data.announcements.map(async (ann) => {
    const url = extractUrl(ann.body);
    if (url) {
      ann.qrSvg = await generateQrSvg(url).catch((err) => {
        console.warn(`Failed to generate QR for announcement: ${err.message}`);
        return null;
      });
    }
  }));

  const html = buildBulletin(data, failures);

  // ── Write output ──────────────────────────────────────────────────────────
  const dateSlug = slugifyDate(data.service.date);
  const filename = `bulletin-${dateSlug}.html`;
  const outputPath = path.join(outputDir, filename);

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`\nDone! Bulletin written to:\n  ${outputPath}\n`);

  // ── Generate QR code for live bulletin ───────────────────────────────────
  console.log('Generating QR code…');
  data.liveQrSvg = await generateQrSvg(config.LIVE_URL).catch(() => '');
  data.liveUrl   = config.LIVE_URL;

  // ── Handle Attachments ────────────────────────────────────────────────────
  let attachmentLocalPaths = [];
  if (data.pdfAttachments && data.pdfAttachments.length > 0) {
    const downloadPromises = data.pdfAttachments.map(async (att, i) => {
      try {
        const localPath = path.join(outputDir, `attachment-${dateSlug}-${i}.pdf`);
        console.log(`Downloading attachment [${att.name}] from: ${att.url}`);
        await downloadFromDrive(att.url, localPath, config.CREDENTIALS_PATH);
        return localPath;
      } catch (err) {
        console.warn(`Failed to download attachment [${att.name}]: ${err.message}`);
        return null;
      }
    });
    const results = await Promise.all(downloadPromises);
    attachmentLocalPaths = results.filter(p => p !== null);
  }

  // ── Generate print PDF ────────────────────────────────────────────────────
  let printPdfPath = null;
  let printHtmlPath = null;
  try {
    const result = await generateAndProtectPdf('print', buildPrintBulletin, data, outputDir, dateSlug, {
      attachmentPaths: attachmentLocalPaths
    });
    printPdfPath = result.pdfPath;
    printHtmlPath = result.htmlPath;
  } catch (err) {
    allIssues.push(`Print PDF generation failed: ${err.message}`);
  }

  // ── Generate booklet PDF (2-up A4 landscape) ──────────────────────────────
  let pdfPath = null;
  try {
    const result = await generateAndProtectPdf('booklet', buildBookletBulletin, data, outputDir, dateSlug, {
      landscape: true,
      attachmentPaths: attachmentLocalPaths
    });
    if (result.generated) {
      pdfPath = result.pdfPath;
    }
  } catch (err) {
    allIssues.push(`Booklet PDF generation failed: ${err.message}`);
  }

  // ── Finalise outputs for deployment ───────────────────────────────────────
  try {
    if (fs.existsSync(outputPath)) {
      fs.copyFileSync(outputPath, path.join(outputDir, 'index.html'));
      console.log('✓ Updated index.html');
    }
    
    if (printHtmlPath && fs.existsSync(printHtmlPath)) {
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
      await notifyFailures({ to, serviceDate, liveUrl: config.LIVE_URL, issues: allIssues });
    } else {
      // Only notify success once WordPress has confirmed the page is live
      console.log('Sending success notification…');
      await notifySuccess({ to, serviceDate, liveUrl: config.LIVE_URL, pdfPath });
    }
  } else {
    console.log('Email notifications skipped (GMAIL_USER / GMAIL_APP_PASSWORD not configured).');
  }

  // ── Update sheet status ────────────────────────────────────────────────────
  const runStatus = allIssues.length === 0
    ? '✓ Live'
    : `⚠️ Issues (${allIssues.length})`;
  await updateRunStatus(config.SHEET_ID, runStatus, allIssues);
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
