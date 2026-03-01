'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Generate a PDF from an HTML file using puppeteer-core + system Chrome.
 * Skips gracefully if CHROME_PATH is not set.
 *
 * @param {string} htmlPath  Absolute path to the input HTML file
 * @param {string} pdfPath   Absolute path for the output PDF file
 * @param {object} [opts]    Options: { landscape: boolean, attachmentPaths: string[] }
 * @returns {Promise<boolean>} true if PDF was generated, false if skipped
 */
async function generatePdf(htmlPath, pdfPath, opts = {}) {
  const chromePath = process.env.CHROME_PATH;
  if (!chromePath) {
    console.log('PDF generation skipped — CHROME_PATH not set.');
    return false;
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch (err) {
    console.warn('PDF generation skipped — puppeteer-core not installed:', err.message);
    return false;
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: !!opts.landscape,
      printBackground: false,
      margin: opts.landscape
        ? { top: '0', bottom: '0', left: '0', right: '0' }
        : { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });

    let finalBuffer = pdfBuffer;

    if (opts.attachmentPaths && opts.attachmentPaths.length > 0) {
      const validPaths = opts.attachmentPaths.filter(p => fs.existsSync(p));
      console.log(`Merging ${validPaths.length} valid attachment(s) (out of ${opts.attachmentPaths.length} requested)…`);
      
      if (validPaths.length > 0) {
        try {
          const attachmentBuffers = validPaths.map(p => fs.readFileSync(p));
          finalBuffer = await mergePdfs(pdfBuffer, attachmentBuffers, { landscape: !!opts.landscape });
          console.log(`PDFs merged successfully. Final size: ${finalBuffer.length} bytes.`);
        } catch (err) {
          console.warn(`PDF merge failed: ${err.message}. Saving original bulletin only.`);
        }
      } else {
        console.log('No valid attachment files found on disk to merge.');
      }
    }

    fs.writeFileSync(pdfPath, finalBuffer);
    console.log(`PDF written to: ${pdfPath}`);
    return true;
  } finally {
    await browser.close();
  }
}

/**
 * Merge multiple PDF buffers into one using pdf-lib.
 * Ensures all pages in the final document are standard A4 (595.28 x 841.89 points).
 * 
 * @param {Buffer} mainBuffer 
 * @param {Buffer} attachmentBuffers 
 * @returns {Promise<Buffer>}
 */
async function mergePdfs(mainBuffer, attachmentBuffers, opts = {}) {
  const { PDFDocument, PageSizes, degrees } = require('pdf-lib');

  const mainPdf = await PDFDocument.load(mainBuffer);
  const mergedPdf = await PDFDocument.create();

  // Target page size matches the bulletin orientation.
  // pdf-lib PageSizes.A4 = [595.28, 841.89] (portrait).
  const A4_P = PageSizes.A4;                       // portrait  [595.28, 841.89]
  const A4_L = [PageSizes.A4[1], PageSizes.A4[0]]; // landscape [841.89, 595.28]
  const TARGET = opts.landscape ? A4_L : A4_P;

  // Add pages from main bulletin
  const mainPages = await mergedPdf.copyPages(mainPdf, mainPdf.getPageIndices());
  mainPages.forEach(page => mergedPdf.addPage(page));

  // Add pages from attachments
  for (const buf of attachmentBuffers) {
    const attachmentPdf = await PDFDocument.load(buf);
    const attachmentIndices = attachmentPdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(attachmentPdf, attachmentIndices);

    for (const page of copiedPages) {
      const { width, height } = page.getSize();

      // If the attachment page already matches the target size exactly, add it directly.
      // Otherwise embed it (scaled to fit, centred) on a new page of the target size.
      // This also handles portrait attachments appended to a landscape booklet — without
      // this, portrait pages appear rotated and their top content (headers) is clipped.
      const matchesTarget =
        Math.abs(width  - TARGET[0]) <= 1 &&
        Math.abs(height - TARGET[1]) <= 1;

      if (matchesTarget) {
        mergedPdf.addPage(page);
      } else {
        const newPage = mergedPdf.addPage(TARGET);
        const embeddedPage = await mergedPdf.embedPage(page);

        // If the attachment is the same paper size but opposite orientation (e.g. portrait A4
        // appended to a landscape A4 booklet), rotate 90° CCW to fill the page exactly.
        // Otherwise scale to fit centred.
        const fitsRotated =
          Math.abs(width  - TARGET[1]) <= 1 &&
          Math.abs(height - TARGET[0]) <= 1;

        if (fitsRotated) {
          // 90° CCW: portrait top → landscape left side (turn paper CW to read normally).
          // In pdf-lib (origin = bottom-left), anchor at (TARGET[0], 0) after CCW rotation
          // maps the portrait content exactly onto the landscape page.
          newPage.drawPage(embeddedPage, {
            x: TARGET[0],
            y: 0,
            width:  TARGET[1],
            height: TARGET[0],
            rotate: degrees(90),
          });
        } else {
          // Scale to fit while preserving aspect ratio, centred.
          const scale = Math.min(TARGET[0] / width, TARGET[1] / height);
          const scaledWidth  = width  * scale;
          const scaledHeight = height * scale;
          const x = (TARGET[0] - scaledWidth)  / 2;
          const y = (TARGET[1] - scaledHeight) / 2;
          newPage.drawPage(embeddedPage, { x, y, width: scaledWidth, height: scaledHeight });
        }
      }
    }
  }

  const mergedPdfBytes = await mergedPdf.save();
  return Buffer.from(mergedPdfBytes);
}

/**
 * Download a file from a URL to a local path.
 * 
 * @param {string} url 
 * @param {string} destPath 
 */
async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download file: ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

/**
 * Extract Google Drive file ID from a URL.
 */
function getDriveId(url) {
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

/**
 * Download a file from Google Drive using the service account credentials.
 */
async function downloadFromDrive(url, destPath, credPath) {
  const fileId = getDriveId(url);
  if (!fileId) return downloadFile(url, destPath); // Fallback to normal download

  const { getAccessToken } = require('./google-auth');
  const token = await getAccessToken(credPath, ['https://www.googleapis.com/auth/drive.readonly']);
  
  const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(driveUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`Google Drive Download Error: ${err.error?.message || res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

module.exports = { generatePdf, mergePdfs, downloadFile, downloadFromDrive };
