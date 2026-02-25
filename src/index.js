'use strict';

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { fetchBulletinData } = require('./sheets');
const { translateData }     = require('./translate');
const { buildBulletin }     = require('./template');

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

  // ── Fetch data ─────────────────────────────────────────────────────────────
  console.log('Fetching bulletin data from Google Sheets…');
  const rawData = await fetchBulletinData(sheetId);

  // ── Translate Chinese content ───────────────────────────────────────────────
  const data = await translateData(rawData);

  // ── Build HTML ────────────────────────────────────────────────────────────
  console.log('Building HTML…');
  const html = buildBulletin(data);

  // ── Write output ──────────────────────────────────────────────────────────
  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Derive a filename from the service date (e.g. "22nd February 2026" → "20260222")
  const dateSlug = slugifyDate(data.service.date);
  const filename = `bulletin-${dateSlug}.html`;
  const outputPath = path.join(outputDir, filename);

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`\nDone! Bulletin written to:\n  ${outputPath}\n`);
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
