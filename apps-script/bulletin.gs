// ── CACV Bulletin Automation — Google Apps Script ──────────────────────────
// Paste this entire file into: Extensions → Apps Script → Code.gs
// Then run setup() once to configure your GitHub token.
// ────────────────────────────────────────────────────────────────────────────

var GITHUB_OWNER   = 'phoaar';
var GITHUB_REPO    = 'cacv-bulletin-automation';
var WORKFLOW_FILE  = 'generate-bulletin.yml';
var PUBLISH_BRANCH = 'main';
var TIMEZONE       = 'Australia/Melbourne';

// ── MENU ────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Bulletin')
    .addItem('⚡ Generate Now',              'generateNow')
    .addSeparator()
    .addItem('🗓 New Week',                  'newWeek')
    .addSeparator()
    .addItem('🕐 Schedule for This Week',    'scheduleForThisWeek')
    .addItem('📅 Schedule for Custom Date',  'scheduleCustom')
    .addItem('❌ Cancel Scheduled Run',      'cancelSchedule')
    .addSeparator()
    .addItem('⚙️  Setup (first time)',       'setup')
    .addToUi();

  highlightNewWeekFields();
}

// ── SETUP (run once) ─────────────────────────────────────────────────────────

function setup() {
  var ui = SpreadsheetApp.getUi();

  var tokenResult = ui.prompt(
    '⚙️ Setup — GitHub Token',
    'Paste your GitHub Personal Access Token below.\n(Needs "Actions: Read and write" permission)',
    ui.ButtonSet.OK_CANCEL
  );
  if (tokenResult.getSelectedButton() !== ui.Button.OK) return;

  var emailResult = ui.prompt(
    '⚙️ Setup — Admin Email',
    'Enter the admin email address to receive confirmation emails:',
    ui.ButtonSet.OK_CANCEL
  );
  if (emailResult.getSelectedButton() !== ui.Button.OK) return;

  var props = PropertiesService.getScriptProperties();
  props.setProperty('GITHUB_TOKEN', tokenResult.getResponseText().trim());
  props.setProperty('ADMIN_EMAIL',  emailResult.getResponseText().trim());

  ui.alert('✓ Setup complete', 'GitHub token and admin email saved.\n\nYou can now use "Generate Now" and "Schedule for This Week".', ui.ButtonSet.OK);
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function getServiceDate() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('📋 Service Details');
  // Service Date is in column B, row 6
  var value = sheet.getRange('B6').getValue();
  // Sheets returns date cells as JS Date objects — format to "Sunday 22 February 2026"
  if (value instanceof Date) {
    return Utilities.formatDate(value, TIMEZONE, 'EEEE d MMMM yyyy');
  }
  return String(value);
}

function getServiceDateRaw() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('📋 Service Details');
  var value = sheet.getRange('B6').getValue();
  if (value instanceof Date) return value;
  // Try to parse string into a date
  return new Date(value);
}

function triggerGitHubWorkflow() {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    SpreadsheetApp.getUi().alert(
      'Setup required',
      'GitHub token not configured.\nPlease run Bulletin → ⚙️ Setup first.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return false;
  }

  var url = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO +
            '/actions/workflows/' + WORKFLOW_FILE + '/dispatches';

  var response = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept':        'application/vnd.github.v3+json',
      'Content-Type':  'application/json',
    },
    payload:            JSON.stringify({ ref: PUBLISH_BRANCH }),
    muteHttpExceptions: true,
  });

  return response.getResponseCode() === 204;
}

// ── GENERATE NOW ─────────────────────────────────────────────────────────────

function generateNow() {
  var ui      = SpreadsheetApp.getUi();
  var dateStr = getServiceDate();

  var result = ui.alert(
    'Generate Bulletin',
    'Generate bulletin for ' + dateStr + ' now?\n\nThe live page will update in about 60 seconds.',
    ui.ButtonSet.OK_CANCEL
  );
  if (result !== ui.Button.OK) return;

  var success = triggerGitHubWorkflow();
  if (success) {
    ui.alert(
      '✓ Generating',
      'Bulletin for ' + dateStr + ' is being generated.\n\nThe live page will update in about 60 seconds.',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert('Error', 'Could not trigger generation. Please check your GitHub token in ⚙️ Setup.', ui.ButtonSet.OK);
  }
}

// ── NEW WEEK ─────────────────────────────────────────────────────────────────

function newWeek() {
  var ui  = SpreadsheetApp.getUi();
  var ss  = SpreadsheetApp.getActive();

  var currentDateStr = getServiceDate();
  var result = ui.alert(
    '🗓 New Week',
    'This will prepare the sheet for the next week:\n\n' +
    '• Advance Service Date by 7 days\n' +
    '• Clear sermon, team, and Order of Service\n' +
    '• Delete announcements not marked "Keep next week?"\n' +
    '• Delete prayer items not marked "Keep next week?"\n' +
    '• Remove the top roster row (current week)\n\n' +
    'Current date: ' + currentDateStr + '\n\nContinue?',
    ui.ButtonSet.OK_CANCEL
  );
  if (result !== ui.Button.OK) return;

  // ── 1. Advance service date by 7 days ──────────────────────────────────────
  var detailSheet = ss.getSheetByName('📋 Service Details');
  var currentDate = getServiceDateRaw();
  var newDate     = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  detailSheet.getRange('B6').setValue(newDate);

  // ── 2. Clear per-service fields in Service Details ─────────────────────────
  // Find and clear: Sermon Title, Scripture Reference, Preacher, Chairperson,
  // Worship Leader, Music / Band, PowerPoint, PA / Sound, Chief Usher, Ushers,
  // Attendance (English), Attendance (Chinese), Attendance (Children's)
  var clearFields = [
    'Sermon Title', 'Scripture Reference', 'Preacher', 'Chairperson',
    'Worship Leader', 'Music / Band', 'PowerPoint', 'PA / Sound',
    'Chief Usher', 'Ushers', 'Attendance (English)', 'Attendance (Chinese)',
    "Attendance (Children's)"
  ];
  var detailData = detailSheet.getRange('A:B').getValues();
  for (var i = 0; i < detailData.length; i++) {
    var label = String(detailData[i][0]).trim();
    if (clearFields.indexOf(label) !== -1) {
      detailSheet.getRange(i + 1, 2).clearContent();
    }
  }

  // ── 3. Clear Order of Service (all data rows) ──────────────────────────────
  var orderSheet = ss.getSheetByName('🗓 Order of Service');
  var orderLastRow = orderSheet.getLastRow();
  if (orderLastRow > 4) {
    orderSheet.getRange(5, 1, orderLastRow - 4, orderSheet.getLastColumn()).clearContent();
  }

  // ── 4. Announcements: delete rows where "Keep next week?" (col D) ≠ "Yes" ──
  // Columns: A=# B=Title C=Body D=Keep? E=Language
  var announceSheet = ss.getSheetByName('📢 Announcements');
  var announceLastRow = announceSheet.getLastRow();
  var keptAnnouncements = 0;
  var deletedAnnouncements = 0;

  // Iterate bottom-up so row deletion doesn't shift indices
  for (var r = announceLastRow; r >= 5; r--) {
    var rowData = announceSheet.getRange(r, 1, 1, 4).getValues()[0];
    var title   = String(rowData[1]).trim();
    if (!title) continue; // skip blank rows
    var keep = String(rowData[3]).trim().toLowerCase();
    if (keep === 'yes') {
      keptAnnouncements++;
    } else {
      announceSheet.deleteRow(r);
      deletedAnnouncements++;
    }
  }

  // ── 5. Prayer Items: delete rows where "Keep next week?" (col C) ≠ "Yes" ───
  // Columns: A=Group B=Point C=Keep?
  var prayerSheet = ss.getSheetByName('🙏 Prayer Items');
  var prayerLastRow = prayerSheet.getLastRow();
  var keptPrayer = 0;
  var deletedPrayer = 0;

  for (var p = prayerLastRow; p >= 5; p--) {
    var pRowData = prayerSheet.getRange(p, 1, 1, 3).getValues()[0];
    var point    = String(pRowData[1]).trim();
    if (!point) continue; // skip blank rows
    var pKeep = String(pRowData[2]).trim().toLowerCase();
    if (pKeep === 'yes') {
      keptPrayer++;
    } else {
      prayerSheet.deleteRow(p);
      deletedPrayer++;
    }
  }

  // ── 6. Remove first data row from Roster (current week) ───────────────────
  var rosterSheet = ss.getSheetByName('👥 Roster');
  var rosterLastRow = rosterSheet.getLastRow();
  if (rosterLastRow >= 5) {
    // Row 5 is the first data row (rows 1-4 are header/instructions)
    rosterSheet.deleteRow(5);
  }

  // ── 7. Re-apply colour highlights ─────────────────────────────────────────
  highlightNewWeekFields();

  // ── 8. Summary ────────────────────────────────────────────────────────────
  var newDateStr = Utilities.formatDate(newDate, TIMEZONE, 'EEEE d MMMM yyyy');
  ui.alert(
    '✓ New Week Started',
    'New week started — ' + newDateStr + '\n\n' +
    keptAnnouncements + ' announcement(s) carried forward, ' + deletedAnnouncements + ' removed.\n' +
    keptPrayer + ' prayer item(s) carried forward, ' + deletedPrayer + ' removed.\n\n' +
    'Don\'t forget to fill in the sermon details, team, and Order of Service!',
    ui.ButtonSet.OK
  );
}

// ── VISUAL CLARITY: COLOUR-CODE SERVICE DETAILS ──────────────────────────────

function highlightNewWeekFields() {
  var ss          = SpreadsheetApp.getActive();
  var detailSheet = ss.getSheetByName('📋 Service Details');
  if (!detailSheet) return;

  // Colours
  var YELLOW = '#FFF9C4'; // needs to be filled in before Sunday
  var GREY   = '#F5F5F5'; // filled in AFTER the service
  var GREEN  = '#E8F5E9'; // stable / carries over

  // Fields that need filling in (yellow)
  var yellowFields = [
    'Service Date', 'Sermon Title', 'Scripture Reference', 'Preacher', 'Chairperson',
    'Worship Leader', 'Music / Band', 'PowerPoint', 'PA / Sound', 'Chief Usher', 'Ushers'
  ];

  // Fields filled in after the service (grey)
  var greyFields = [
    'Attendance (English)', 'Attendance (Chinese)', "Attendance (Children's)"
  ];

  // Fields that are stable (green)
  var greenFields = ['Venue'];

  var data = detailSheet.getRange('A:B').getValues();
  for (var i = 0; i < data.length; i++) {
    var label = String(data[i][0]).trim();
    if (!label) continue;
    var cell = detailSheet.getRange(i + 1, 2);

    if (yellowFields.indexOf(label) !== -1) {
      cell.setBackground(YELLOW);
    } else if (greyFields.indexOf(label) !== -1) {
      cell.setBackground(GREY);
    } else if (greenFields.indexOf(label) !== -1) {
      cell.setBackground(GREEN);
    }
  }
}

// ── SCHEDULE FOR THIS WEEK ────────────────────────────────────────────────────

function scheduleForThisWeek() {
  var ui      = SpreadsheetApp.getUi();
  var dateStr = getServiceDate();

  // Default: publish on the Friday before the Sunday service at 12:00pm (noon)
  var serviceDate = getServiceDateRaw();
  var runTime     = new Date(serviceDate.getTime());
  runTime.setDate(serviceDate.getDate() - 2); // Friday (Sunday - 2)
  runTime.setHours(12, 0, 0, 0);              // 12:00pm noon

  var runDateFormatted = Utilities.formatDate(runTime, TIMEZONE, 'EEEE d MMM \'at\' h:mm a');

  var result = ui.alert(
    'Schedule Bulletin',
    'Schedule bulletin for ' + dateStr + '?\n\n' +
    'It will go live automatically on ' + runDateFormatted + ' (Melbourne time).',
    ui.ButtonSet.OK_CANCEL
  );
  if (result !== ui.Button.OK) return;

  // Remove any existing scheduled trigger first
  deleteTriggers_();

  // Create new one-time trigger
  ScriptApp.newTrigger('onScheduledRun')
    .timeBased()
    .at(runTime)
    .create();

  ui.alert(
    '✓ Scheduled',
    'Bulletin will go live automatically on ' + runDateFormatted + '.\n\n' +
    'To cancel, use Bulletin → ❌ Cancel Scheduled Run.',
    ui.ButtonSet.OK
  );
}

// ── SCHEDULE FOR CUSTOM DATE ─────────────────────────────────────────────────

function scheduleCustom() {
  var ui      = SpreadsheetApp.getUi();
  var dateStr = getServiceDate();

  var dateResult = ui.prompt(
    '📅 Schedule — Date',
    'Enter the date to publish the bulletin (bulletin is for ' + dateStr + ').\n\nFormat: DD/MM/YYYY',
    ui.ButtonSet.OK_CANCEL
  );
  if (dateResult.getSelectedButton() !== ui.Button.OK) return;

  var timeResult = ui.prompt(
    '📅 Schedule — Time',
    'Enter the time to publish (Melbourne time).\n\nFormat: HH:MM (24-hour, e.g. 12:00 for noon)',
    ui.ButtonSet.OK_CANCEL
  );
  if (timeResult.getSelectedButton() !== ui.Button.OK) return;

  // Parse date (DD/MM/YYYY) and time (HH:MM)
  var dateParts = dateResult.getResponseText().trim().split('/');
  var timeParts = timeResult.getResponseText().trim().split(':');

  if (dateParts.length !== 3 || timeParts.length !== 2) {
    ui.alert('Invalid format', 'Please use DD/MM/YYYY for date and HH:MM for time.', ui.ButtonSet.OK);
    return;
  }

  var day   = parseInt(dateParts[0], 10);
  var month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
  var year  = parseInt(dateParts[2], 10);
  var hours = parseInt(timeParts[0], 10);
  var mins  = parseInt(timeParts[1], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hours) || isNaN(mins)) {
    ui.alert('Invalid format', 'Please use DD/MM/YYYY for date and HH:MM for time.', ui.ButtonSet.OK);
    return;
  }

  var runTime = new Date(year, month, day, hours, mins, 0, 0);
  if (runTime <= new Date()) {
    ui.alert('Invalid date', 'The scheduled time is in the past. Please enter a future date and time.', ui.ButtonSet.OK);
    return;
  }

  var runDateFormatted = Utilities.formatDate(runTime, TIMEZONE, 'EEEE d MMM \'at\' h:mm a');

  var result = ui.alert(
    'Confirm Schedule',
    'Schedule bulletin for ' + dateStr + '?\n\n' +
    'It will go live on ' + runDateFormatted + '.',
    ui.ButtonSet.OK_CANCEL
  );
  if (result !== ui.Button.OK) return;

  // Remove any existing scheduled trigger first
  deleteTriggers_();

  ScriptApp.newTrigger('onScheduledRun')
    .timeBased()
    .at(runTime)
    .create();

  ui.alert(
    '✓ Scheduled',
    'Bulletin will go live on ' + runDateFormatted + '.\n\n' +
    'To cancel, use Bulletin → ❌ Cancel Scheduled Run.',
    ui.ButtonSet.OK
  );
}

// ── SCHEDULED TRIGGER HANDLER ────────────────────────────────────────────────

function onScheduledRun() {
  var success = triggerGitHubWorkflow();

  var adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (adminEmail) {
    var dateStr    = getServiceDate();
    var publishedAt = Utilities.formatDate(new Date(), TIMEZONE, 'EEEE d MMMM yyyy \'at\' h:mm a');
    if (success) {
      MailApp.sendEmail(
        adminEmail,
        '✓ CACV Bulletin is live — ' + dateStr,
        'The bulletin for ' + dateStr + ' has been published successfully.\n' +
        'Published: ' + publishedAt + '\n\n' +
        'View it at: https://' + GITHUB_OWNER + '.github.io/' + GITHUB_REPO + '/'
      );
    } else {
      MailApp.sendEmail(
        adminEmail,
        '⚠️ CACV Bulletin generation failed — ' + dateStr,
        'The scheduled bulletin generation for ' + dateStr + ' failed.\n' +
        'Attempted: ' + publishedAt + '\n\n' +
        'Please use "Generate Now" from the sheet to retry, or contact your administrator.'
      );
    }
  }

  // Clean up the one-time trigger
  deleteTriggers_();
}

// ── CANCEL SCHEDULE ──────────────────────────────────────────────────────────

function cancelSchedule() {
  var count = deleteTriggers_();
  var ui    = SpreadsheetApp.getUi();
  if (count > 0) {
    ui.alert('✓ Cancelled', 'The scheduled bulletin run has been cancelled.', ui.ButtonSet.OK);
  } else {
    ui.alert('Nothing to cancel', 'No bulletin run is currently scheduled.', ui.ButtonSet.OK);
  }
}

// ── INTERNAL ─────────────────────────────────────────────────────────────────

function deleteTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  var count    = 0;
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'onScheduledRun') {
      ScriptApp.deleteTrigger(t);
      count++;
    }
  });
  return count;
}
