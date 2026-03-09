'use strict';

const juice = require('juice');
const config = require('./config');

const GOOGLE_FONTS_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">';
const FETCH_TIMEOUT = 30000;

/**
 * Returns true if all 4 WordPress env vars are set.
 */
function canPublishWordPress() {
  return !!(
    config.WP_URL &&
    config.WP_USERNAME &&
    config.WP_APP_PASSWORD &&
    config.WP_PAGE_ID
  );
}

/**
 * Inline CSS, extract body content, rewrite image paths, and wrap for Gutenberg.
 */
function prepareContent(html, liveUrl) {
  // Extract ALL style tags
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const styles = styleMatches.map(m => m.replace(/<\/?style[^>]*>/gi, '')).join('\n');

  // Extract content inside #cacv-bulletin-root
  const rootMatch = html.match(/<div id="cacv-bulletin-root"[^>]*>([\s\S]*?)<\/div>\s*<script/i);
  let content = rootMatch ? rootMatch[1] : html;

  // Final fallback if regex failed to find the root div precisely
  if (!rootMatch) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    content = bodyMatch ? bodyMatch[1] : html;
  }

  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  content = content.replace(/\bon\w+="[^"]*"/gi, '');

  content = content.replace(
    /src="(\.?\/)?assets\/([^"]+)"/g,
    (match, prefix, filename) => {
      const cleanFilename = filename.replace(/ /g, '%20');
      const newSrc = `${config.GITHUB_PAGES_BASE}assets/${cleanFilename}`;
      if (filename.toLowerCase().includes('logo')) return `data-is-logo="true" src="${newSrc}"`;
      return `src="${newSrc}"`;
    }
  );

  content = content.replace(
    /(<img[^>]+data-is-logo="true"[^>]*>)/gi,
    '<a href="https://cacv.org.au" style="display:inline-block; border:none !important; text-decoration:none !important; box-shadow:none !important;">$1</a>'
  );

  const canvasStyle = `
    <style>
      ${styles}
      
      /* Reset WordPress container interference */
      #cacv-bulletin-root,
      body, .site, #page, #content, #primary, .site-content, .site-main, 
      .entry-content, .ast-container, .elementor, .elementor-section, .elementor-container { 
        max-width: 100% !important; 
        width: 100% !important; 
        margin: 0 !important; 
        padding: 0 !important; 
      }

      #cacv-bulletin-root {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }

      .hero, .sermon-strip, .sticky-nav, footer {
        width: 100% !important;
        max-width: 100% !important;
      }

      .hero-inner, .sermon-inner, .nav-scroll, .page, .footer-inner {
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: 740px; 
      }

      /* Force hidden elements to stay hidden */
      .order-list li::before, .order-list li::after, .order-row::before, .order-row::after,
      li::before, li::after, .grecaptcha-badge, .rc-anchor-center-item, .rc-anchor-error-message { 
        content: none !important; display: none !important; visibility: hidden !important; opacity: 0 !important;
      }
      
      #cacv-bulletin-root ul, #cacv-bulletin-root li { list-style: none !important; }
      #cacv-bulletin-root a { text-decoration: none !important; box-shadow: none !important; border: none !important; }
    </style>
  `;

  content = GOOGLE_FONTS_LINK + '\n' + canvasStyle + '\n<div id="cacv-bulletin-root">' + content + '</div>';

  return `<!-- wp:html -->\n${content}\n<!-- /wp:html -->`;
}

/**
 * Publish the bulletin HTML to a fixed WordPress page via the REST API.
 */
async function publishToWordPress({ title, html, liveUrl }) {
  const wpUrl      = config.WP_URL.replace(/\/$/, '');
  const username   = config.WP_USERNAME;
  const appPassword = config.WP_APP_PASSWORD;
  const pageId     = config.WP_PAGE_ID;

  if (!wpUrl.startsWith('https://')) {
    console.warn('WordPress publish aborted: WP_URL must use HTTPS.');
    return false;
  }

  const endpoint = `${wpUrl}/wp-json/wp/v2/pages/${pageId}`;
  const credentials = Buffer.from(`${username}:${appPassword}`).toString('base64');

  let content;
  try {
    content = prepareContent(html, liveUrl);
  } catch (err) {
    console.warn(`WordPress publish skipped — failed to prepare content: ${err.message}`);
    return false;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
        status: 'publish', 
        slug:   'cacv-english-bulletin', 
        template: 'elementor_canvas',
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT)
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(`WordPress publish failed — HTTP ${response.status}: ${body.slice(0, 200)}`);
      return false;
    }

    console.log(`✓ Bulletin published to WordPress (page ${pageId})`);
    return true;
  } catch (err) {
    console.warn(`WordPress publish failed — ${err.message}`);
    return false;
  }
}

module.exports = { canPublishWordPress, publishToWordPress };
