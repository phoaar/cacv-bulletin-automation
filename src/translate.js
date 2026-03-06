'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');

let client;

async function translateData(data) {
  if (!client && config.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }

  const failures = [];
  const result = JSON.parse(JSON.stringify(data)); // deep clone

  if (!config.ANTHROPIC_API_KEY) {
    console.warn('Anthropic API key not set. Skipping translation.');
    return { data: result, failures };
  }

  // Translation logic...
  // (Assuming the rest of the file logic remains the same, just showing the setup change)
  // For brevity in this tool call, I'll stop here as the prompt only requires config refactor.
  // Wait, I should provide the full file as per instructions.
  
  // Announcements
  if (result.announcements && result.announcements.length > 0) {
    for (let i = 0; i < result.announcements.length; i++) {
      const ann = result.announcements[i];
      if (hasChinese(ann.title) || hasChinese(ann.body)) {
        console.log(`Translating announcement ${i + 1}…`);
        try {
          const translated = await translateAnnouncement(ann);
          result.announcements[i].title = translated.title;
          result.announcements[i].body = translated.body;
        } catch (err) {
          failures.push({ field: `Announcement ${i + 1}`, reason: err.message });
        }
      }
    }
  }

  // Prayer
  if (result.prayer && result.prayer.length > 0) {
    for (let i = 0; i < result.prayer.length; i++) {
      const group = result.prayer[i];
      if (hasChinese(group.group)) {
        try {
          group.group = await translateText(group.group);
        } catch (err) {
          failures.push({ field: `Prayer Group ${i + 1} Name`, reason: err.message });
        }
      }
      for (let j = 0; j < group.points.length; j++) {
        if (hasChinese(group.points[j])) {
          try {
            group.points[j] = await translateText(group.points[j]);
          } catch (err) {
            failures.push({ field: `Prayer Point ${i + 1}.${j + 1}`, reason: err.message });
          }
        }
      }
    }
  }

  return { data: result, failures };
}

function hasChinese(str) {
  return /[\u4e00-\u9fff]/.test(str || '');
}

async function translateText(text) {
  const response = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1024,
    system: 'You are a professional translator. Translate the following Chinese text to English. Maintain the original tone and formatting. Return ONLY the translated text.',
    messages: [{ role: 'user', content: text }],
  });
  return response.content[0].text.trim();
}

async function translateAnnouncement(ann) {
  const prompt = `Translate this church announcement to English.
Title: ${ann.title}
Body: ${ann.body}

Return JSON format: { "title": "...", "body": "..." }`;

  const response = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1024,
    system: 'You are a professional translator. Return ONLY valid JSON.',
    messages: [{ role: 'user', content: prompt }],
  });
  
  const text = response.content[0].text;
  return JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

module.exports = { translateData };
