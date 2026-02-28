# 🚨 Maintenance & Troubleshooting

This guide is for the **Church IT Team / Deacons**. It outlines the technical maintenance and troubleshooting requirements for the automated bulletin system.

---

## 🛠️ Maintenance Tasks

### 1. Anthropic Credits (Quarterly)
The translation engine requires credits. Monitor the balance at [console.anthropic.com](https://console.anthropic.com). If the balance hits $0, the bulletin will still generate but will contain untranslated Chinese text.

### 2. WordPress Page Layout
The script pushes to the page using the `elementor_canvas` template to ensure a clean, edge-to-edge look.
- **Warning:** If someone manually edits the bulletin page in WordPress, their changes **will be overwritten** the next time the script runs. All content must be managed in the Google Sheet.

### 3. Google Service Account
The script authenticates using a Service Account. The key is stored in `credentials/service-account.json` (Gitignored).
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

If GitHub is down or you need to test changes locally:

### 1. Requirements
- Node.js (v18 or higher) installed.
- A `.env` file with all the secrets listed in `TECHNICAL_SPEC.md`.
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
