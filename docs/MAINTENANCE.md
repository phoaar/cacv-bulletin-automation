# 🚨 Maintenance & Troubleshooting

This guide is for the **Church IT Team / Deacons**. It outlines the technical maintenance and troubleshooting requirements for the automated bulletin system.

---

## 🛠️ System Overview

The CACV English Bulletin is a "serverless" automation that converts data from a Google Sheet into a formatted web page (WordPress) and a print-ready PDF.

### Architecture & Data Flow
1.  **TRIGGER:** Staff click "Generate" in the Master Google Sheet (Google Apps Script).
2.  **DISPATCH:** Apps Script sends a `repository_dispatch` event to GitHub.
3.  **WORKFLOW:** GitHub Actions starts a Node.js process to:
    - Fetch data from the Google Sheets API.
    - Translate sermon/announcement text via Anthropic's Claude API.
    - Generate HTML/PDF using local templates and CSS.
    - Update the WordPress page via REST API.
    - Upload the PDF to GitHub Pages for archival.
4.  **NOTIFY:** Success/failure reports are sent via Gmail.

### Data Storage & Persistence
-   **Primary Data:** Google Sheets (The "Master" record).
-   **Logs & Archive:** GitHub Actions run logs and GitHub Pages (PDF history).
-   **Secrets:** All API keys/credentials are stored in GitHub Repository Secrets.
-   **Live Content:** Hosted on the main church WordPress site ([cacv.org.au](https://cacv.org.au)).

---

## 🛠️ Maintenance Tasks

### 1. Anthropic Credits & Models (Quarterly)
The translation engine requires credits and uses the **Claude 3.5 Haiku** model.
- Monitor the balance at [console.anthropic.com](https://console.anthropic.com).
- **Error: 404 "not_found_error" (Model Deprecated):** If Anthropic retires the model being used, the script will fail with a 404. You can update the model ID in your `.env` file without changing the code:
  ```bash
  ANTHROPIC_MODEL=claude-3-5-haiku-latest
  ```

### 2. WordPress Page Layout
The script pushes to the page using the `elementor_canvas` template to ensure a clean, edge-to-edge look.
- **Warning:** If someone manually edits the bulletin page in WordPress, their changes **will be overwritten** the next time the script runs. All content must be managed in the Google Sheet.

### 3. Google Service Account
The script authenticates using a Service Account. The key is stored in `credentials/service-account.json` (Gitignored).
- **Share Permission:** The Service Account email (found in the JSON) **must** have "Editor" access to the Google Sheet.

---

## 🚀 Deployment & Credentials

### 1. GitHub Secrets
The production pipeline runs via GitHub Actions. All sensitive variables must be set in **Settings > Secrets and variables > Actions**:

| Secret Name | Description |
| :--- | :--- |
| `GOOGLE_CREDENTIALS` | The entire content of the Service Account JSON file. |
| `SHEET_ID` | The ID of the Master Google Sheet. |
| `ANTHROPIC_API_KEY` | API key from Anthropic Console. |
| `GMAIL_USER` | The email address used to send notifications. |
| `GMAIL_APP_PASSWORD` | Google "App Password" for the above email. |
| `WP_URL` | Base URL of the church WordPress site. |
| `WP_USERNAME` | WordPress username for the automation bot. |
| `WP_APP_PASSWORD` | WordPress "Application Password". |
| `WP_PAGE_ID` | Numeric ID of the bulletin page in WordPress. |
| `PDF_PASSWORD` | (Optional) Password for PDF files. |

### 2. Credential Rotation
For security, it is recommended to rotate credentials annually:
- **Google Service Account:** Generate a new key in Google Cloud Console, delete the old one, and update `GOOGLE_CREDENTIALS` in GitHub.
- **WordPress Bot:** Revoke the old Application Password in the user's profile and create a new one.
- **Gmail:** Revoke the old App Password and generate a new one.

### 3. Service Account Setup
1.  Go to [Google Cloud Console](https://console.cloud.google.com/).
2.  Enable **Google Sheets API** and **Google Drive API**.
3.  Create a **Service Account** and download the **JSON Key**.
4.  Share the Master Google Sheet with the Service Account email address.

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

If GitHub is down or you need to test changes locally:

### 1. Requirements
- Node.js (v20 or higher) installed.
- A `.env` file with all the secrets.
- A `credentials/service-account.json` file.

### 2. Execution
```bash
# Clone the repo (if not already done)
git clone <repository_url>

# Install dependencies
npm install

# Run the generation process
npm start
```

Output is written to `output/bulletin-YYYYMMDD.html`.
