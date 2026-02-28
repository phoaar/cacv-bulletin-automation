'use strict';

const juice = require('juice');

const GITHUB_PAGES_BASE = 'https://phoaar.github.io/cacv-bulletin-automation/';
const GOOGLE_FONTS_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">';

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
 */
function prepareContent(html, liveUrl) {
  // 1. Extract the original <style> block (juice strips pseudo-elements)
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const originalStyles = styleMatch ? styleMatch[1] : '';

  // 2. Inline CSS into tags for maximum compatibility
  const inlined = juice(html);

  // 3. Extract <body> inner HTML
  const bodyMatch = inlined.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : inlined;

  // 4. Security: Strip scripts and event handlers
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  content = content.replace(/\bon\w+="[^"]*"/gi, '');

  // 5. Rewrite relative image paths & mark logo for linking
  content = content.replace(
    /src="(\.?\/)?assets\/([^"]+)"/g,
    (match, prefix, filename) => {
      const cleanFilename = filename.replace(/ /g, '%20');
      const newSrc = `${GITHUB_PAGES_BASE}assets/${cleanFilename}`;
      if (filename.toLowerCase().includes('logo')) return `data-is-logo="true" src="${newSrc}"`;
      return `src="${newSrc}"`;
    }
  );

  // Wrap logo in <a> tag
  content = content.replace(
    /(<img[^>]+data-is-logo="true"[^>]*>)/gi,
    '<a href="https://cacv.org.au" style="display:inline-block; border:none !important; text-decoration:none !important; box-shadow:none !important;">$1</a>'
  );

  // 6. WordPress Specific Overrides (Restored V4.2 style)
  const canvasStyle = `
    <style>
      ${originalStyles}
      
      /* WordPress / Astra / Elementor FULL WIDTH FORCE */
      body, .site, #page, #content, #primary, .site-content, .site-main, 
      .entry-content, .ast-container, .elementor, .elementor-section, .elementor-container { 
        max-width: 100% !important; 
        width: 100% !important; 
        margin: 0 !important; 
        padding: 0 !important; 
      }

      /* Force our sections to actually be full screen width where needed */
      .hero, .sermon-strip, .sticky-nav, footer {
        width: 100% !important;
        max-width: 100% !important;
      }

      /* Centering for the interior content */
      .hero-inner, .sermon-inner, .nav-scroll, .page, .footer-inner {
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: 740px; /* Standard inner width */
      }

      /* KILL THE CHEVRONS & CAPTCHA ERRORS */
      .order-list li::before, .order-list li::after, .order-row::before, .order-row::after,
      li::before, li::after, .grecaptcha-badge, .rc-anchor-center-item, .rc-anchor-error-message { 
        content: none !important; display: none !important; visibility: hidden !important; opacity: 0 !important;
      }
      
      ul, li { list-style: none !important; }
      a { text-decoration: none !important; box-shadow: none !important; border: none !important; }
    </style>
  `;

  // Prepend fonts and final style block
  content = GOOGLE_FONTS_LINK + '\n' + canvasStyle + '\n' + content;

  // 7. Wrap in Gutenberg raw HTML block
  return `<!-- wp:html -->\n${content}\n<!-- /wp:html -->`;
}

/**
 * Publish the bulletin HTML to a fixed WordPress page via the REST API.
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
        template: 'elementor_canvas',
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
