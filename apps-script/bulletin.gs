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
    .addItem('⚡ Generate Now',            'generateNow')
    .addSeparator()
    .addItem('🕐 Schedule for Sunday',     'scheduleForSunday')
    .addItem('📅 Schedule for Custom Date', 'scheduleCustom')
    .addItem('❌ Cancel Scheduled Run',    'cancelSchedule')
    .addSeparator()
    .addItem('⚙️  Setup (first time)',     'setup')
    .addToUi();
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

  ui.alert('✓ Setup complete', 'GitHub token and admin email saved.\n\nYou can now use "Generate Now" and "Schedule for Sunday".', ui.ButtonSet.OK);
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function getServiceDate() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('📋 Service Details');
  // Service Date is in column B, row 6
  return sheet.getRange('B6').getValue();
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

// ── SCHEDULE FOR SUNDAY ──────────────────────────────────────────────────────

function scheduleForSunday() {
  var ui      = SpreadsheetApp.getUi();
  var dateStr = getServiceDate();

  // Parse service date and schedule for Saturday night at 9:00 pm
  var serviceDate = new Date(dateStr);
  var runTime     = new Date(serviceDate);
  runTime.setDate(serviceDate.getDate() - 1); // Saturday
  runTime.setHours(21, 0, 0, 0);              // 9:00 pm

  var runDateFormatted = Utilities.formatDate(runTime, TIMEZONE, 'EEEE d MMM \'at\' h:mm a');

  var result = ui.alert(
    'Schedule Bulletin',
    'Schedule bulletin for ' + dateStr + '?\n\n' +
    'It will go live automatically on ' + runDateFormatted + '.',
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
    'Enter the time to publish (Melbourne time).\n\nFormat: HH:MM (24-hour, e.g. 21:00 for 9:00 pm)',
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
    var dateStr = getServiceDate();
    if (success) {
      MailApp.sendEmail(
        adminEmail,
        '✓ CACV Bulletin is live — ' + dateStr,
        'The bulletin for ' + dateStr + ' has been published successfully.\n\n' +
        'View it at: https://' + GITHUB_OWNER + '.github.io/' + GITHUB_REPO + '/'
      );
    } else {
      MailApp.sendEmail(
        adminEmail,
        '⚠️ CACV Bulletin generation failed — ' + dateStr,
        'The scheduled bulletin generation for ' + dateStr + ' failed.\n\n' +
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
