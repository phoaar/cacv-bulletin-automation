'use strict';

require('dotenv').config();
const path = require('path');

module.exports = {
  // Application Info
  BUILD_VERSION: process.env.BUILD_VERSION || 'V5.0-STABLE-PDF',
  LIVE_URL: process.env.LIVE_URL || 'https://cacv.org.au/cacv-english-bulletin/',
  
  // Google Sheets & Drive
  SHEET_ID: process.env.SHEET_ID,
  CREDENTIALS_PATH: process.env.CREDENTIALS_PATH || path.join(__dirname, '..', 'credentials', 'service-account.json'),
  
  // PDF Generation
  CHROME_PATH: process.env.CHROME_PATH,
  PDF_PASSWORD: process.env.PDF_PASSWORD,
  
  // Translation
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL:   process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  
  // WordPress
  WP_URL: process.env.WP_URL,
  WP_USERNAME: process.env.WP_USERNAME,
  WP_APP_PASSWORD: process.env.WP_APP_PASSWORD,
  WP_PAGE_ID: process.env.WP_PAGE_ID,
  
  // Email (Gmail)
  GMAIL_USER: process.env.GMAIL_USER,
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
  
  // GitHub Pages
  GITHUB_PAGES_BASE: 'https://phoaar.github.io/cacv-bulletin-automation/',
};
