'use strict';

const Anthropic = require('@anthropic-ai/sdk');

let client;

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
 * Returns the original text if translation fails.
 */
async function translateText(text) {
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
    console.warn(`Translation failed, using original text. Error: ${err.message}`);
    return text;
  }
}

/**
 * Translate text only if it contains Chinese — otherwise return as-is.
 */
async function translateIfChinese(text) {
  if (!text || !isChinese(text)) return text;
  return translateText(text);
}

/**
 * Translate all Chinese fields in the announcements and prayer items arrays.
 * Runs all translations in parallel for speed.
 */
async function translateData(data) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY not set — skipping translation.');
    return data;
  }

  console.log('Translating Chinese content…');

  // ── Announcements ───────────────────────────────────────────────────────────
  const translatedAnnouncements = await Promise.all(
    data.announcements.map(async (a) => ({
      title: await translateIfChinese(a.title),
      body:  await translateIfChinese(a.body),
    }))
  );

  // ── Prayer Items ────────────────────────────────────────────────────────────
  const translatedPrayer = await Promise.all(
    data.prayer.map(async (group) => ({
      group:  await translateIfChinese(group.group),
      points: await Promise.all(group.points.map(p => translateIfChinese(p))),
    }))
  );

  return {
    ...data,
    announcements: translatedAnnouncements,
    prayer:        translatedPrayer,
  };
}

module.exports = { translateData };
