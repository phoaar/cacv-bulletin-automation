'use strict';

const QRCode = require('qrcode');

/**
 * Generate a QR code SVG string for the given URL.
 * Returns an SVG string suitable for embedding directly in HTML.
 */
async function generateQrSvg(url) {
  return QRCode.toString(url, {
    type: 'svg',
    margin: 0,
    color: { dark: '#000', light: '#fff' },
  });
}

module.exports = { generateQrSvg };
