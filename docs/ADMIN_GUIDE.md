# 👤 User & Admin Guide

This guide is for the **Church Admin Team / Secretaries**. It explains how to update the Google Sheet and trigger the automated bulletin generation.

---

## 📋 How to Update the Bulletin

The system generates the bulletin based on the data in the **[Master Google Sheet]**. 

### Google Sheet Tabs

| Tab | Contents |
|-----|----------|
| **📋 Service Details** | Date, time, venue, sermon title, and service team roster. |
| **🗓 Order of Service** | Individual items (e.g. Worship, Scripture, Sermon) and details. |
| **📢 Announcements** | Title and body text for up to 12 announcements. |
| **🙏 Prayer Items** | Grouped prayer points (up to 20). |
| **👥 Roster** | Shows 4 upcoming weeks of service roles (automatically filtered by date). |
| **📅 Events** | Calendar events. Use the "Show on bulletin?" flag to include them. |
| **⚙️  Settings** | Manage notification emails and view system status. |

### System Status (⚙️ Settings Tab)

The **⚙️ Settings** tab acts as a dashboard for the automation:
- **Notification Emails (B1):** Enter comma-separated email addresses to receive success/failure reports.
- **Last Run Status:** Shows if the most recent generation was successful (✓ Success) or if it encountered issues (⚠️ Failed).
- **Last Run Time:** Shows the date and time of the last run.

---

## 🚀 Triggering Generation

The Google Sheet has a custom **Bulletin** menu (at the top near "Extensions" and "Help"). 

| Option | Description |
|--------|-------------|
| **Generate Now** | Triggers the system immediately. The bulletin will be live in 1-2 minutes. |
| **Schedule for Sunday** | Automatically triggers the system on **Saturday at 9:00 PM AEST**. |
| **Schedule for Custom Date** | Prompts for a specific date and time to trigger the generation. |

---

## 📧 Email Notifications

After the bulletin is generated, the system sends an email to everyone listed in the **⚙️ Settings** tab:
- **Success:** Contains a link to the live bulletin and a summary of the generation.
- **Issues Found:** A warning email listing any missing fields or translation failures that occurred during the process.

> **Tip:** If the bulletin looks incorrect after generation, fix the data in the Google Sheet and click **Bulletin → Generate Now** again to overwrite it.
