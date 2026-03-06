'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const { PDFDocument, PageSizes, degrees } = require('pdf-lib');
const { getAccessToken } = require('./google-auth');
const config = require('./config');

const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024; // 100MB
const DOWNLOAD_TIMEOUT = 30000; // 30ms

/**
 * Generate a PDF from an HTML file using puppeteer-core + system Chrome.
 * Skips gracefully if CHROME_PATH is not set.
 */
async function generatePdf(htmlPath, pdfPath, opts = {}) {
  const chromePath = config.CHROME_PATH;
  if (!chromePath) {
    console.log('PDF generation skipped — CHROME_PATH not set.');
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
 */
async function mergePdfs(mainBuffer, attachmentBuffers, opts = {}) {
  const mainPdf = await PDFDocument.load(mainBuffer);
  const mergedPdf = await PDFDocument.create();

  const A4_P = PageSizes.A4;
  const A4_L = [PageSizes.A4[1], PageSizes.A4[0]];
  const TARGET = opts.landscape ? A4_L : A4_P;

  const mainPages = await mergedPdf.copyPages(mainPdf, mainPdf.getPageIndices());
  mainPages.forEach(page => mergedPdf.addPage(page));

  for (const buf of attachmentBuffers) {
    const attachmentPdf = await PDFDocument.load(buf);
    const attachmentIndices = attachmentPdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(attachmentPdf, attachmentIndices);

    for (const page of copiedPages) {
      const { width, height } = page.getSize();
      const matchesTarget =
        Math.abs(width  - TARGET[0]) <= 5 &&
        Math.abs(height - TARGET[1]) <= 5;

      if (matchesTarget) {
        mergedPdf.addPage(page);
      } else {
        const newPage = mergedPdf.addPage(TARGET);
        const embeddedPage = await mergedPdf.embedPage(page);
        const fitsRotated =
          Math.abs(width  - TARGET[1]) <= 5 &&
          Math.abs(height - TARGET[0]) <= 5;

        if (fitsRotated) {
          newPage.drawPage(embeddedPage, {
            x: TARGET[0],
            y: 0,
            width:  TARGET[1],
            height: TARGET[0],
            rotate: degrees(90),
          });
        } else {
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
 */
async function downloadFile(url, destPath) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Downloads must use HTTPS');
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT) });
  if (!res.ok) throw new Error(`Failed to download file: ${res.statusText}`);

  const contentLength = res.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_SIZE) {
    throw new Error(`File too large: ${contentLength} bytes`);
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DOWNLOAD_SIZE) {
    throw new Error('File too large (exceeded 100MB limit)');
  }

  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

/**
 * Extract Google Drive file ID from a URL.
 */
function getDriveId(url) {
  const match = url.match(/[a-zA-Z0-9_-]{25,110}/);
  return match ? match[0] : null;
}

/**
 * Download a file from Google Drive using the service account credentials.
 */
async function downloadFromDrive(url, destPath, credPath) {
  const outputDir = path.resolve(__dirname, '..', 'output');
  if (!path.resolve(destPath).startsWith(outputDir)) {
    throw new Error('Security Error: destPath must be within output directory');
  }

  const fileId = getDriveId(url);
  if (!fileId) return downloadFile(url, destPath);

  const token = await getAccessToken(credPath, ['https://www.googleapis.com/auth/drive.readonly']);
  
  const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(driveUrl, {
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(`Google Drive Download Error: ${err.error?.message || res.statusText}`);
  }

  const contentLength = res.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_SIZE) {
    throw new Error(`File too large: ${contentLength} bytes`);
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DOWNLOAD_SIZE) {
    throw new Error('File too large (exceeded 100MB limit)');
  }

  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

/**
 * Password-protect a PDF in-place using qpdf.
 */
function protectPdf(pdfPath, password) {
  const tmpPath = pdfPath + '.protected.tmp';
  try {
    execFileSync('qpdf', [
      '--encrypt', password, password, '256', 
      '--', pdfPath, tmpPath
    ], { stdio: 'pipe' });
    
    fs.renameSync(tmpPath, pdfPath);
    console.log(`PDF password-protected: ${path.basename(pdfPath)}`);
  } catch (err) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    throw new Error(`qpdf protection failed — is qpdf installed? ${err.message}`);
  }
}

module.exports = { generatePdf, mergePdfs, downloadFile, downloadFromDrive, protectPdf };
