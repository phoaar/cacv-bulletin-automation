# 🚨 Troubleshooting: Permissions & Google Apps Script

If your admin staff are "unable to run" the scripts from the Google Sheet, it is likely due to one of the following reasons.

## 1. The "Authorization Required" & "Unverified App" Screen
When a user runs an internal script for the first time, Google shows a security warning because the script hasn't been "verified" by Google (which is normal for internal church tools).

### How to Fix:
1. When they click **Generate Now**, they will see "Authorization Required". Click **Continue**.
2. They will be asked to choose a Google Account.
3. They will see a screen saying **"Google hasn't verified this app"**.
4. They must click **"Advanced"** (small text on the left).
5. Click **"Go to Bulletin Automation (unsafe)"** at the bottom.
6. Click **"Allow"** on the next screen.

The script will now run. They only need to do this **once**.

---

## 2. "Editor" Access Required
To see the "Bulletin" menu and run scripts, users **must** have "Editor" access to the Google Sheet. 
* "Viewer" or "Commenter" access is not enough; the menu will not even appear for them.

### How to Fix:
* Open the Sheet, click **Share**, and ensure their email address is set to **Editor**.

---

## 3. Scheduling & "Ownership" Warning
Google has a strict security rule: **Only the person who scheduled a run can cancel it.**

* If **Aaron** schedules the bulletin for Friday, **Admin Staff** cannot see or cancel that scheduled trigger from their own account.
* I have updated the script to show a clearer warning if this happens. It will now say: 
  > "A bulletin run was scheduled by aaron@church.com. Google security prevents you from cancelling another user's trigger."

### How to Fix:
* If a run needs to be cancelled, the original person who scheduled it should do it.
* Alternatively, anyone can still click **"Generate Now"** at any time to push a bulletin immediately.

---

## 4. Error: "You do not have permission to perform that action"
I found a bug where the script tried to "Lock" the sheet headers automatically every time it was opened. If an admin didn't have specific "Protection" permissions, the whole script would crash.

### How to Fix:
* I have removed this automatic check. The "Bulletin" menu should now load reliably for everyone.
* If you need to re-lock the headers, use the new manual option: **Bulletin → Setup / Re-apply Protections**.
