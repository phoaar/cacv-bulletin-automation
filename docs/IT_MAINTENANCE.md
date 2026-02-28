# CACV Bulletin Automation — IT Maintenance Guide

This document is for the **Church IT Team / Deacons**. It outlines the technical infrastructure and maintenance requirements for the automated bulletin system.

---

## 🏗️ System Architecture
The system follows a "Low-Maintenance" serverless flow:
1.  **Input:** Admin staff update the [Master Google Sheet].
2.  **Trigger:** Staff click the custom "Generate Now" button (Google Apps Script).
3.  **Engine:** Apps Script sends a `repository_dispatch` event to GitHub.
4.  **Process:** GitHub Actions runs a Node.js script that:
    - Fetches data from Sheets API (Direct REST, no SDK).
    - Translates Chinese text via **Anthropic Claude API**.
    - Generates HTML/PDFs (using custom templates in `src/`).
    - Pushes the HTML to the **WordPress REST API**.
5.  **Output:** Live at `cacv.org.au/cacv-english-bulletin/` and PDF archive on GitHub Pages.

---

## 🔑 Key Credentials & Secrets
All sensitive keys are stored in the **GitHub Repository Secrets** (`Settings > Secrets > Actions`):

| Secret | Purpose |
| :--- | :--- |
| `SHEET_ID` | The ID of the Google Spreadsheet. |
| `ANTHROPIC_API_KEY` | Claude API key for Chinese -> English translation. |
| `WP_URL` | `https://cacv.org.au` |
| `WP_USERNAME` | `bulletin-bot` (bot user created in WP). |
| `WP_APP_PASSWORD` | The 24-character Application Password from WP user settings. |
| `WP_PAGE_ID` | `13954` (English Bulletin Page). |
| `GMAIL_USER` | Email account for sending success/failure logs. |
| `GMAIL_APP_PASSWORD` | Google App Password (not the main password). |

---

## 🛠️ Maintenance Tasks

### 1. Anthropic Credits (Quarterly)
The translation engine requires credits. Monitor the balance at [console.anthropic.com](https://console.anthropic.com). If the balance hits $0, the bulletin will still generate but will contain untranslated Chinese text.

### 2. WordPress Page Layout
The script pushes to the page using the `elementor_canvas` template to ensure a clean, edge-to-edge look.
- **Warning:** If someone manually edits the bulletin page in WordPress, their changes **will be overwritten** the next time the script runs. All content must be managed in the Google Sheet.

### 3. Google Service Account
The script authenticates using a Service Account. The key is stored in `credentials/service-account.json`. 
- **Share Permission:** The Service Account email (found in the JSON) **must** have "Editor" access to the Google Sheet.

---

## 🚨 Troubleshooting

- **Error: "rows is not iterable"**
    - The admin staff likely deleted a required tab or modified the first 4 header rows. Ensure the Sheet structure matches the baseline.
- **Error: "401 Unauthorized" (WordPress)**
    - The `WP_APP_PASSWORD` has likely expired or the `bulletin-bot` user was deleted. Generate a new App Password in WP and update the GitHub Secret.
- **Action Fails on GitHub:**
    - Check the **"Actions"** tab in the repository. The logs will pinpoint exactly which step failed (Translation, Sheets Fetch, or WordPress Push).

---

## 💻 Local Emergency Run
If GitHub is down, you can run the process manually on any PC with Node.js:
1. Clone the repo.
2. Create a `.env` file with the secrets listed above.
3. Place `service-account.json` in `/credentials`.
4. Run `npm install` then `npm start`.
