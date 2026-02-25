# CACV Bulletin Automation

Automatically generates and publishes the CACV weekly church bulletin from a Google Sheet.

**Live bulletin:** https://phoaar.github.io/cacv-bulletin-automation/

---

## How it works

1. Admin team fills in the Google Sheet (service details, order of service, announcements, prayer items, roster, events)
2. A button in the sheet triggers a GitHub Actions workflow
3. The workflow fetches the sheet data, translates any Chinese content, builds an HTML bulletin, and deploys it to GitHub Pages
4. Notification emails are sent to addresses listed in the Settings tab

---

## Setup

### 1. Google Cloud — Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create a project
2. Enable the **Google Sheets API**
3. Create a **Service Account** → download the JSON key
4. Place the key at `./credentials/service-account.json` (gitignored)
5. Share the Google Sheet with the service account email (Viewer access)

### 2. Environment variables

Copy `.env.example` to `.env` and fill in your values:

```
SHEET_ID=your_google_sheet_id_here
CREDENTIALS_PATH=./credentials/service-account.json
ANTHROPIC_API_KEY=your_anthropic_api_key_here

GMAIL_USER=your.gmail@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### 3. GitHub Secrets

Add these secrets in your repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `SHEET_ID` | Google Sheet ID (from its URL) |
| `GOOGLE_CREDENTIALS` | Full contents of the service account JSON file |
| `ANTHROPIC_API_KEY` | Anthropic API key for Chinese translation |
| `GMAIL_USER` | Gmail address used to send notifications |
| `GMAIL_APP_PASSWORD` | Gmail App Password (see below) |

### 4. Run locally

```bash
npm install
node src/index.js
```

Output is written to `output/bulletin-YYYYMMDD.html`.

---

## Email notifications

When the bulletin is generated, the system emails everyone listed in the **⚙️ Settings** tab of the Google Sheet:

- **Success** — a clean confirmation with a link to the live bulletin
- **Issues found** — a warning email listing any missing fields or translation failures

### Setting up Gmail

Notifications are sent via Gmail using an App Password (not your regular account password).

**Step 1 — Enable 2-Step Verification** on the Gmail account you want to send from:
1. Go to [myaccount.google.com](https://myaccount.google.com) → Security
2. Turn on **2-Step Verification** if it isn't already

**Step 2 — Create an App Password:**
1. Go to [myaccount.google.com](https://myaccount.google.com) → Security → **App passwords**
2. Select app: **Mail** / device: **Other** → name it `CACV Bulletin`
3. Copy the 16-character password (e.g. `abcd efgh ijkl mnop`)

**Step 3 — Add to GitHub Secrets:**
- `GMAIL_USER` → the Gmail address (e.g. `cacvbulletin@gmail.com`)
- `GMAIL_APP_PASSWORD` → the 16-character App Password (spaces are fine)

**Step 4 — Add recipient emails to the Google Sheet:**
1. Open the Google Sheet
2. Add a tab named exactly `⚙️ Settings`
3. In that tab:
   - **A1:** `Notification Emails`
   - **B1:** `admin1@gmail.com, admin2@gmail.com` (comma-separated)

> **Note:** Notifications are optional. If `GMAIL_USER` or `GMAIL_APP_PASSWORD` are not set, the bulletin still generates and deploys — email steps are simply skipped.

---

## Google Sheet structure

| Tab | Contents |
|-----|----------|
| 📋 Service Details | Date, time, venue, sermon, service team |
| 🗓 Order of Service | Each item with type (General / Worship / Scripture / Sermon) |
| 📢 Announcements | Title + body text (up to 12) |
| 🙏 Prayer Items | Grouped prayer points (up to 20) |
| 👥 Roster | 4 upcoming weeks of service roles |
| 📅 Events | Calendar events with "Show on bulletin?" flag |
| ⚙️ Settings | Notification email addresses |

---

## Apps Script buttons

The Google Sheet has a **Bulletin** menu with three options:

- **Generate Now** — triggers the GitHub Actions workflow immediately
- **Schedule for Sunday** — schedules generation for Saturday 9:00 pm AEST
- **Schedule for Custom Date** — prompts for a specific date and time

To set up: open the sheet → Extensions → Apps Script → paste the contents of `apps-script/bulletin.gs` → run `setup()` to store your GitHub token.
