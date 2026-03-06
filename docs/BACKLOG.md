# CACV Bulletin Automation — Backlog

---

## Chinese Column + Translate Button

**Status:** Backlog — implement when time permits.

### What it does
Adds dedicated Chinese input columns to the Announcements and Prayer Items tabs, plus a **🌐 Translate Items** button in the Google Sheet Bulletin menu. Admins type Chinese content into the new columns, click Translate, and Claude Haiku fills in the English cells immediately (no full generation run needed).

### Column changes

**📢 Announcements** — add at the end:
- Col F: `Title (Chinese)`
- Col G: `Body (Chinese)`
(Keep next week? stays at D — no existing index shifts)

**🙏 Prayer Items** — add at the end:
- Col D: `Point (Chinese)`
(Keep next week? stays at C — no existing index shifts)

### Apps Script changes (`apps-script/bulletin.gs`)
- New menu item: **🌐 Translate Items** → `translateItems()`
- `translateItems()` reads Chinese columns → calls Anthropic API via `UrlFetchApp` → writes English back to Title/Body/Point cols
- API key stored in `PropertiesService.getScriptProperties()` under `ANTHROPIC_API_KEY`
- Extend `setup()` to prompt for Anthropic API key on first run
- Show confirmation dialog before overwriting existing English values
- Toast on completion: "Translated X announcement fields, Y prayer items"

### Node.js pipeline changes
- **`src/sheets.js`**: Widen ranges (Announcements `A:E` → `A:G`; Prayer `A:C` → `A:D`); expose `chineseTitle`, `chineseBody`, `chinesePoint` in returned objects
- **`src/translate.js`**: Prefer `chinese*` fields as translation source when present; fall back to existing behaviour (scan English field for Chinese chars) when Chinese columns are empty

### API call format (Apps Script)
Uses the same flat key-value map as `translateBatch()` in translate.js:
`ann_0_title`, `ann_0_body`, `pr_0_pt_0`, etc. — same system prompt, same JSON response format, same Claude Haiku model (`claude-haiku-4-5-20251001`).

### Verification
1. Add Chinese text to Announcements col F+G → click Translate Items → cols B+C fill with English
2. Add Chinese to Prayer col D → Translate Items → col B updates
3. Run full `node src/index.js` pipeline → Chinese columns used as source correctly
4. Leave Chinese cols empty on a row → existing translate.js fallback still works
