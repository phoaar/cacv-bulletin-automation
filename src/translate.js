'use strict';

const Anthropic = require('@anthropic-ai/sdk');

let client;
const failures = [];

function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Returns true if the text contains Chinese characters.
 */
function isChinese(text) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

/**
 * Translate a single string using Claude Haiku.
 * Returns the original text and records the failure if translation fails.
 */
async function translateText(text, fieldLabel) {
  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are translating content for a Christian church bulletin. Translate the following Chinese text into natural English suitable for a church bulletin. Return only the translated text, nothing else.\n\n${text}`,
      }],
    });
    return response.content[0].text.trim();
  } catch (err) {
    const reason = err.message || 'Unknown error';
    console.warn(`Translation failed for "${fieldLabel}": ${reason}`);
    failures.push({ field: fieldLabel, reason });
    return text;
  }
}

/**
 * Translate text only if it contains Chinese — otherwise return as-is.
 */
async function translateIfChinese(text, fieldLabel) {
  if (!text || !isChinese(text)) return text;
  return translateText(text, fieldLabel);
}

/**
 * Translate all Chinese fields in the announcements and prayer items arrays.
 * Runs all translations in parallel for speed.
 * Returns { data, failures } — failures is an array of { field, reason }.
 */
async function translateData(data) {
  failures.length = 0; // reset

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY not set — skipping translation.');
    return { data, failures: [] };
  }

  console.log('Translating Chinese content…');

  // ── Announcements ───────────────────────────────────────────────────────────
  const translatedAnnouncements = await Promise.all(
    data.announcements.map(async (a, i) => ({
      title: await translateIfChinese(a.title, `Announcement ${i + 1} title`),
      body:  await translateIfChinese(a.body,  `Announcement ${i + 1} body`),
    }))
  );

  // ── Prayer Items ────────────────────────────────────────────────────────────
  const translatedPrayer = await Promise.all(
    data.prayer.map(async (group, gi) => ({
      group:  await translateIfChinese(group.group, `Prayer group ${gi + 1} name`),
      points: await Promise.all(
        group.points.map((p, pi) => translateIfChinese(p, `Prayer group ${gi + 1} point ${pi + 1}`))
      ),
    }))
  );

  return {
    data: { ...data, announcements: translatedAnnouncements, prayer: translatedPrayer },
    failures: [...failures],
  };
}

module.exports = { translateData };
