# CACV Bulletin Automation

An automated system to generate and publish the CACV weekly church bulletin. 

The system transforms a **Google Sheet** (filled by the admin team) into a **live web bulletin** and **PDF archive**, automatically translating content and notifying stakeholders.

---

## 🚀 Overview

- **Single Source of Truth:** All content is managed within a Google Sheet.
- **Automated Translation:** Uses AI (Anthropic Claude) to translate Chinese content into English.
- **Multi-Channel Publishing:**
  - Deploys as a responsive web page to **WordPress**.
  - Generates a print-ready **PDF**.
  - Hosts a public archive on **GitHub Pages**.
- **Integrated Notifications:** Sends success/failure reports to admins via email.
- **Simple Trigger:** Staff can generate the bulletin directly from a custom menu in Google Sheets.

---

## 🏁 Getting Started

### Prerequisites
- **Node.js:** v20.0.0 or higher
- **Google Chrome / Chromium:** Installed on your system (required for PDF generation)
- **qpdf:** Installed on your system (required for PDF password protection)
  - macOS: `brew install qpdf`
  - Linux: `sudo apt-get install qpdf`

### Installation
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/phoaar/cacv-bulletin-automation.git
    cd cacv-bulletin-automation
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Setup Environment Variables:**
    - Copy `.env.example` to `.env`.
    - Fill in the required API keys and configuration (see [Environment Setup](#-environment-setup) below).
4.  **Setup Google Credentials:**
    - Place your Google Service Account JSON key at `./credentials/service-account.json` (or the path defined in your `.env`).

### Running Locally
To generate a bulletin from your local machine:
```bash
npm start
```
This will fetch the latest data from the sheet, generate HTML/PDF outputs in the `output/` directory, and attempt to publish to WordPress/Email if configured.

---

## 📖 Documentation Index

### [👤 User & Admin Guide](./docs/ADMIN_GUIDE.md)
**Best for: Admin staff and Church Secretaries.**
- How to fill out the Google Sheet.
- How to trigger a new bulletin generation.
- How to manage notification recipients.

### [🎨 Brand & Style Guide](../BRAND_GUIDE.md)
**Best for: UI/UX designers and Frontend developers.**
- Visual identity (colors, typography).
- UI component standards.

### [🛠️ Technical Specification](./docs/TECHNICAL_SPEC.md)
**Best for: Developers and IT Maintenance.**
- System architecture and process flow.
- API integrations (Google, Anthropic, WordPress, Gmail).
- GitHub Actions and Secrets configuration.

### [🚨 Maintenance & Troubleshooting](./docs/MAINTENANCE.md)
**Best for: Church IT Team.**
- Troubleshooting common errors.
- Managing API credits and credentials.
- Performing local emergency runs.

---

## 🔗 Quick Links

- **Live Web Bulletin:** [cacv.org.au/cacv-english-bulletin/](https://cacv.org.au/cacv-english-bulletin/)
- **PDF Archive:** [GitHub Pages Link](https://phoaar.github.io/cacv-bulletin-automation/)
- **Control Center:** [Master Google Sheet Link]
