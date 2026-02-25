'use strict';

/**
 * Generate a PDF from an HTML file using puppeteer-core + system Chrome.
 * Skips gracefully if CHROME_PATH is not set.
 *
 * @param {string} htmlPath  Absolute path to the input HTML file
 * @param {string} pdfPath   Absolute path for the output PDF file
 * @returns {Promise<boolean>} true if PDF was generated, false if skipped
 */
async function generatePdf(htmlPath, pdfPath) {
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
    await page.pdf({
      path:   pdfPath,
      format: 'A4',
      printBackground: false,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });
    console.log(`PDF written to: ${pdfPath}`);
    return true;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePdf };
