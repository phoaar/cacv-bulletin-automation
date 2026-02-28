'use strict';

const juice = require('juice');

const GITHUB_PAGES_BASE = 'https://phoaar.github.io/cacv-bulletin-automation/';
const GOOGLE_FONTS_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,400&display=swap" rel="stylesheet">';

/**
 * Returns true if all 4 WordPress env vars are set.
 */
function canPublishWordPress() {
  return !!(
    process.env.WP_URL &&
    process.env.WP_USERNAME &&
    process.env.WP_APP_PASSWORD &&
    process.env.WP_PAGE_ID
  );
}

/**
 * Inline CSS, extract body content, rewrite image paths, and wrap for Gutenberg.
 * @param {string} html  Full bulletin HTML (head + body)
 * @param {string} liveUrl  GitHub Pages live URL
 * @returns {string}  WordPress-ready HTML string
 */
function prepareContent(html, liveUrl) {
  // 1. Inline <style> CSS into element style="" attributes
  const inlined = juice(html);

  // 2. Extract <body> inner HTML
  const bodyMatch = inlined.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : inlined;

  // 3. Security: Strip scripts and event handlers
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  content = content.replace(/\bon\w+="[^"]*"/gi, '');

  // 4. Rewrite relative image paths & mark logo for linking
  content = content.replace(
    /src="(\.?\/)?assets\/([^"]+)"/g,
    (match, prefix, filename) => {
      const cleanFilename = filename.replace(/ /g, '%20');
      const newSrc = `${GITHUB_PAGES_BASE}assets/${cleanFilename}`;
      
      // Mark the logo with a temporary class for easier replacement
      if (filename.toLowerCase().includes('logo')) {
        return `data-is-logo="true" src="${newSrc}"`;
      }
      return `src="${newSrc}"`;
    }
  );

  // Wrap any image marked as a logo in an <a> tag
  content = content.replace(
    /(<img[^>]+data-is-logo="true"[^>]*>)/gi,
    '<a href="https://cacv.org.au" style="display:inline-block; border:none; outline:none; text-decoration:none;">$1</a>'
  );

  // Wrap the inline SVG hero logo in an <a> tag
  content = content.replace(
    /(<svg[^>]+class="hero-logo"[^>]*>[\s\S]*?<\/svg>)/gi,
    '<a href="https://cacv.org.au" style="display:block; text-decoration:none; border:none; outline:none; box-shadow:none;">$1</a>'
  );

  // 5. Prepend Google Fonts
  content = GOOGLE_FONTS_LINK + '\n' + content;

  // 6. Simplified styling for Elementor Canvas
  const canvasStyle = `
    <style>
      body { background-color: #F7F5EC !important; margin: 0 !important; }
      .entry-content { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
      #content { margin: 0 !important; padding: 0 !important; }
      
      /* KILL THE CHEVRONS */
      /* Target the specific Astra/Elementor list markers */
      .order-list li::before,
      .order-list li::after,
      .order-row::before,
      .order-row::after,
      li::before, 
      li::after { 
        content: none !important; 
        display: none !important; 
      }
      
      ul, li { list-style: none !important; }

      /* Ensure logo link is clean */
      a[href="https://cacv.org.au"] { border: none !important; text-decoration: none !important; box-shadow: none !important; }
    </style>
  `;
  content = canvasStyle + '\n' + content;

  // 7. Wrap in Gutenberg raw HTML block
  return `<!-- wp:html -->\n${content}\n<!-- /wp:html -->`;
}

/**
 * Publish the bulletin HTML to a fixed WordPress page via the REST API.
 * Non-fatal — logs a warning on failure but never throws.
 * @param {Object} opts
 * @param {string} opts.title      Page title (e.g. "Bulletin — 2 March 2025")
 * @param {string} opts.html       Full bulletin HTML
 * @param {string} opts.liveUrl    GitHub Pages live URL
 */
async function publishToWordPress({ title, html, liveUrl }) {
  const wpUrl      = process.env.WP_URL.replace(/\/$/, '');
  const username   = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;
  const pageId     = process.env.WP_PAGE_ID;

  if (!wpUrl.startsWith('https://')) {
    console.warn('WordPress publish aborted: WP_URL must use HTTPS.');
    return;
  }

  const endpoint = `${wpUrl}/wp-json/wp/v2/pages/${pageId}`;
  const credentials = Buffer.from(`${username}:${appPassword}`).toString('base64');

  let content;
  try {
    content = prepareContent(html, liveUrl);
  } catch (err) {
    console.warn(`WordPress publish skipped — failed to prepare content: ${err.message}`);
    return;
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
        template: 'elementor_canvas', // Use the clean blank template
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(`WordPress publish failed — HTTP ${response.status}: ${body.slice(0, 200)}`);
      return;
    }

    console.log(`✓ Bulletin published to WordPress (page ${pageId})`);
  } catch (err) {
    console.warn(`WordPress publish failed — ${err.message}`);
  }
}

module.exports = { canPublishWordPress, publishToWordPress };
