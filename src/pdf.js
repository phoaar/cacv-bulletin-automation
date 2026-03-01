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
      console.log(`Merging ${opts.attachmentPaths.length} attachment(s)…`);
      try {
        const attachmentBuffers = opts.attachmentPaths
          .filter(p => fs.existsSync(p))
          .map(p => fs.readFileSync(p));
          
        if (attachmentBuffers.length > 0) {
          finalBuffer = await mergePdfs(pdfBuffer, attachmentBuffers);
          console.log('PDFs merged successfully.');
        }
      } catch (err) {
        console.warn(`PDF merge failed: ${err.message}. Saving original only.`);
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
 * 
 * @param {Buffer} mainBuffer 
 * @param {Buffer} attachmentBuffers 
 * @returns {Promise<Buffer>}
 */
async function mergePdfs(mainBuffer, attachmentBuffers) {
  const { PDFDocument } = require('pdf-lib');
  
  const mainPdf = await PDFDocument.load(mainBuffer);
  const mergedPdf = await PDFDocument.create();
  
  // Add pages from main bulletin
  const mainPages = await mergedPdf.copyPages(mainPdf, mainPdf.getPageIndices());
  mainPages.forEach(page => mergedPdf.addPage(page));
  
  // Add pages from attachments
  for (const buf of attachmentBuffers) {
    const attachmentPdf = await PDFDocument.load(buf);
    const attachmentPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
    attachmentPages.forEach(page => mergedPdf.addPage(page));
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
