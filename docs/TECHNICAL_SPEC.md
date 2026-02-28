# 🛠️ Technical Specification

This document details the system architecture, API integrations, and technical configuration for the CACV Bulletin Automation.

---

## 🏗️ System Architecture

The system is a serverless flow using Google Apps Script, GitHub Actions, and Node.js.

1.  **Input:** Admin staff update the [Master Google Sheet].
2.  **Trigger:** Staff click the custom "Generate Now" button (Google Apps Script).
3.  **Engine:** Apps Script sends a `repository_dispatch` event to GitHub.
4.  **Process:** GitHub Actions runs a Node.js script that:
    - Fetches data from **Google Sheets API** (v4).
    - Translates Chinese text via **Anthropic Claude API** (v3.5 Sonnet).
    - Generates HTML/PDFs (using custom templates in `src/`).
    - Pushes the HTML to the **WordPress REST API**.
    - Pushes the PDF and HTML archive to **GitHub Pages**.
    - Sends success/failure logs via **Gmail SMTP** (Nodemailer).
5.  **Output:** Live at `cacv.org.au/cacv-english-bulletin/` and PDF archive on GitHub Pages.

---

## 🔑 Credentials & Secrets

All sensitive keys are stored in the **GitHub Repository Secrets** (`Settings > Secrets and variables > Actions`):

| Secret | Purpose |
| :--- | :--- |
| `SHEET_ID` | The ID of the Google Spreadsheet (found in the URL). |
| `GOOGLE_CREDENTIALS` | Full contents of the service account JSON file. |
| `ANTHROPIC_API_KEY` | Claude API key for Chinese -> English translation. |
| `WP_URL` | `https://cacv.org.au` |
| `WP_USERNAME` | `bulletin-bot` (bot user created in WP). |
| `WP_APP_PASSWORD` | The 24-character Application Password from WP user settings. |
| `WP_PAGE_ID` | `13954` (English Bulletin Page). |
| `GMAIL_USER` | Gmail address for sending notifications. |
| `GMAIL_APP_PASSWORD` | 16-character Gmail App Password. |

---

## 🔗 API Integrations

### 1. Google Sheets API
- **Scope:** `https://www.googleapis.com/auth/spreadsheets`
- **Authentication:** Service Account JSON.
- **Access:** The service account email **must** have "Editor" access to the spreadsheet.

### 2. Anthropic API
- **Model:** `claude-3-5-sonnet-20240620`
- **Usage:** Used to translate Chinese sermon titles, scripture references, and announcements into English.

### 3. WordPress REST API
- **Endpoint:** `/wp-json/wp/v2/pages/${WP_PAGE_ID}`
- **Authentication:** Application Password (basic auth).
- **Template:** Pushes HTML using the `elementor_canvas` template to ensure a clean, edge-to-edge look.

### 4. Gmail SMTP
- **Host:** `smtp.gmail.com`
- **Authentication:** App Password (bypass 2-Step Verification).

---

## 🎨 Design & Branding

All UI elements (HTML templates, PDF styling) should follow the [CACV Brand & Style Guide](../../BRAND_GUIDE.md).

- **Colors:** Moss Green (`#3D4A2A`), Warm Paper (`#F7F5EC`).
- **Typography:** `Instrument Serif` for headings, `Instrument Sans` for body text.
- **Visuals:** Subtle paper grain texture and organic pill-shaped components.

---

## 📂 Source Code structure

- `src/index.js`: Main entry point and orchestration.
- `src/sheets.js`: Logic for fetching and writing back to Google Sheets.
- `src/translate.js`: Anthropic API translation logic.
- `src/template.js`: HTML/CSS templates for web and print.
- `src/wordpress.js`: WordPress REST API client.
- `src/notify.js`: Email notification logic (Nodemailer).
- `apps-script/`: Scripts that live inside the Google Sheet.
