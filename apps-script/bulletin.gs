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
    .addItem('📄 View Print Version',        'viewPrintVersion')
    .addSeparator()
    .addItem('🗓 Next Service',               'nextService')
    .addSeparator()
    .addItem('🕐 Schedule for This Week',    'scheduleForThisWeek')
    .addItem('📅 Schedule for Custom Date',  'scheduleCustom')
    .addItem('❌ Cancel Scheduled Run',      'cancelSchedule')
    .addSeparator()
    .addItem('🧪 Send Test Notification',    'sendTestNotification')
    .addSeparator()
    .addItem('🛡️ Re-apply Protections',      'applySheetProtections')
    .addItem('✨ Refresh Formatting',        'setupConditionalFormatting')
    .addSeparator()
    .addItem('⚙️  Setup (first time)',       'setup')
    .addToUi();

  applySheetProtections();
  setupConditionalFormatting();
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

  var props = PropertiesService.getScriptProperties();
  props.setProperty('GITHUB_TOKEN', tokenResult.getResponseText().trim());

  ui.alert('✓ Setup complete', 'GitHub token saved.\n\nNotification recipients are managed in the ⚙️ Settings tab.\n\nYou can now use "Generate Now" and "Schedule for This Week".', ui.ButtonSet.OK);
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Calculate Easter Sunday for a given year (Anonymous Gregorian algorithm).
 */
function getEasterSunday_(year) {
  var a = year % 19;
  var b = Math.floor(year / 100);
  var c = year % 100;
  var d = Math.floor(b / 4);
  var e = b % 4;
  var f = Math.floor((b + 8) / 25);
  var g = Math.floor((b - f + 1) / 3);
  var h = (19 * a + b - d - g + 15) % 30;
  var i = Math.floor(c / 4);
  var k = c % 4;
  var l = (32 + 2 * e + 2 * i - h - k) % 7;
  var m = Math.floor((a + 11 * h + 22 * l) / 451);
  var month = Math.floor((h + l - 7 * m + 114) / 31);
  var day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Given the current service date, return the next service date and label.
 *
 * Rules:
 *  - If current service is NOT a Sunday (e.g. Good Friday, Christmas Day),
 *    always advance to the next Sunday.
 *  - If current service IS a Sunday, check whether Good Friday or Christmas Day
 *    (non-Sunday) falls before the next Sunday. If so, return that date instead.
 *  - Otherwise return next Sunday (+7 days).
 *
 * Returns: { date: Date, label: string|null }
 *   label is 'Good Friday', 'Christmas Day', or null (regular Sunday).
 */
function getNextServiceDate_(currentDate) {
  var dayOfWeek = currentDate.getDay(); // 0=Sun … 6=Sat

  // Current service is a special day (non-Sunday) → jump to next Sunday
  if (dayOfWeek !== 0) {
    var daysToSunday = 7 - dayOfWeek;
    return { date: new Date(currentDate.getTime() + daysToSunday * 24 * 60 * 60 * 1000), label: null };
  }

  // Current service is a Sunday — look for special services in the next 6 days
  var nextSunday = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  var year       = currentDate.getFullYear();
  var candidates = [];

  // Good Friday = Easter Sunday − 2 days (check this year and next year)
  for (var y = year; y <= year + 1; y++) {
    var easter     = getEasterSunday_(y);
    var goodFriday = new Date(easter.getTime() - 2 * 24 * 60 * 60 * 1000);
    if (goodFriday > currentDate && goodFriday < nextSunday) {
      candidates.push({ date: goodFriday, label: 'Good Friday' });
    }
  }

  // Christmas Day — only a special service if it does NOT fall on a Sunday
  var christmas = new Date(year, 11, 25); // Dec 25 this year
  if (christmas.getDay() !== 0 && christmas > currentDate && christmas < nextSunday) {
    candidates.push({ date: christmas, label: 'Christmas Day' });
  }

  // Return the earliest special date found, or next Sunday if none
  if (candidates.length > 0) {
    candidates.sort(function(a, b) { return a.date - b.date; });
    return candidates[0];
  }

  return { date: nextSunday, label: null };
}

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
    '⚡ Ready to generate?',
    'This will build and publish the bulletin for ' + dateStr + '.\n\nProceed?',
    ui.ButtonSet.OK_CANCEL
  );
  if (result !== ui.Button.OK) return;

  var success = triggerGitHubWorkflow();
  if (success) {
    ui.alert(
      '✓ Bulletin on its way!',
      'The bulletin for ' + dateStr + ' is being built.\n\n' +
      'The live page will be ready in about 60 seconds:\n' +
      'https://' + GITHUB_OWNER + '.github.io/' + GITHUB_REPO + '/',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert('Error', 'Could not trigger generation. Please check your GitHub token in ⚙️ Setup.', ui.ButtonSet.OK);
  }
}

// ── VIEW PRINT VERSION ───────────────────────────────────────────────────────

function viewPrintVersion() {
  var printUrl = 'https://' + GITHUB_OWNER + '.github.io/' + GITHUB_REPO + '/print.html';
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;padding:16px 20px;">' +
    '<p style="margin:0 0 10px;font-size:13px;color:#555;">Opens the print-ready bulletin in a new tab.<br>Use <strong>Cmd+P</strong> (Mac) or <strong>Ctrl+P</strong> (Windows) to print or save as PDF.</p>' +
    '<a href="' + printUrl + '" target="_blank" ' +
    'style="display:inline-block;padding:9px 18px;background:#3D4A2A;color:#fff;' +
    'text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">' +
    '📄 Open Print Version →</a>' +
    '<p style="margin:12px 0 0;font-size:11px;color:#999;">Make sure you\'ve run Generate Now first to get the latest version.</p>' +
    '</div>'
  ).setHeight(130).setWidth(380);
  SpreadsheetApp.getUi().showModalDialog(html, 'Print Version');
}

// ── NEXT SERVICE ─────────────────────────────────────────────────────────────

function nextService() {
  var ui  = SpreadsheetApp.getUi();
  var ss  = SpreadsheetApp.getActive();

  var currentDateStr = getServiceDate();
  var currentDate    = getServiceDateRaw();

  // Detect next service date — automatically handles Good Friday and Christmas Day
  var next       = getNextServiceDate_(currentDate);
  var newDate    = next.date;
  var newDateStr = Utilities.formatDate(newDate, TIMEZONE, 'EEEE d MMMM yyyy');
  var serviceLabel = next.label ? ' (' + next.label + ')' : '';

  var result = ui.alert(
    '🗓 Next Service',
    'This will prepare the sheet for the next service:\n\n' +
    '• Set Service Date to ' + newDateStr + serviceLabel + '\n' +
    '• Auto-fill service team from Roster\n' +
    '• Clear sermon and Order of Service\n' +
    '• Delete announcements not marked "Keep next week?"\n' +
    '• Delete prayer items not marked "Keep next week?"\n\n' +
    'Current date: ' + currentDateStr + '\n\nContinue?',
    ui.ButtonSet.OK_CANCEL
  );
  if (result !== ui.Button.OK) return;

  // ── 1. Advance service date to next Sunday ─────────────────────────────────
  var detailSheet = ss.getSheetByName('📋 Service Details');
  detailSheet.getRange('B6').setValue(newDate);

  // ── 2. Find the team for the new service date by searching the full roster ──
  // Roster is kept permanently — search all rows for the one matching newDate.
  // Roster columns: A=Date B=Preacher C=Chair D=Worship E=Music F=PP G=PA H=ChiefUsher I=Ushers
  var rosterSheet   = ss.getSheetByName('👥 Roster');
  var rosterLastRow = rosterSheet.getLastRow();
  var upcomingTeam  = {};
  if (rosterLastRow >= 5) {
    var rosterData      = rosterSheet.getRange(5, 1, rosterLastRow - 4, 11).getValues();
    var newDateMidnight = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
    for (var ri = 0; ri < rosterData.length; ri++) {
      var rVal     = rosterData[ri][0]; // Date text e.g. "1 Mar"
      var rYearVal = rosterData[ri][1]; // Year number e.g. 2026
      if (!rVal) continue;
      var rDate;
      if (rVal instanceof Date) {
        // Legacy: full Date object stored in cell
        rDate = new Date(rVal.getFullYear(), rVal.getMonth(), rVal.getDate());
      } else {
        // Text date + Year column
        var parsed = new Date(String(rVal).trim() + ' ' + String(rYearVal || '').trim());
        rDate = isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
      if (!rDate || isNaN(rDate.getTime())) continue;
      if (rDate.getTime() === newDateMidnight.getTime()) {
        upcomingTeam = {
          'Preacher':       String(rosterData[ri][2]  || '').trim(),
          'Chairperson':    String(rosterData[ri][3]  || '').trim(),
          'Worship Leader': String(rosterData[ri][4]  || '').trim(),
          'Music / Band':   String(rosterData[ri][5]  || '').trim(),
          'PowerPoint':     String(rosterData[ri][6]  || '').trim(),
          'PA / Sound':     String(rosterData[ri][7]  || '').trim(),
          'Chief Usher':    String(rosterData[ri][8]  || '').trim(),
          'Ushers':         String(rosterData[ri][9]  || '').trim(),
          'Morning Tea':    String(rosterData[ri][10] || '').trim(),
        };
        break;
      }
    }
  }

  // ── 3. Clear sermon fields; auto-fill team from roster; clear attendance ───
  // Clear: Sermon Title, Scripture Reference, Attendance fields
  // Auto-fill from roster: Preacher, Chairperson, Worship Leader, Music/Band, PP, PA, Chief Usher, Ushers
  var clearFields = [
    'Sermon Title', 'Scripture Reference',
    'Attendance (English)', 'Attendance (Chinese)', "Attendance (Children's)"
  ];
  var teamFields = [
    'Preacher', 'Chairperson', 'Worship Leader', 'Music / Band',
    'PowerPoint', 'PA / Sound', 'Chief Usher', 'Ushers', 'Morning Tea'
  ];
  var detailData = detailSheet.getRange('A:B').getValues();
  for (var i = 0; i < detailData.length; i++) {
    var label = String(detailData[i][0]).trim();
    if (clearFields.indexOf(label) !== -1) {
      detailSheet.getRange(i + 1, 2).clearContent();
    } else if (teamFields.indexOf(label) !== -1) {
      var val = upcomingTeam[label];
      if (val !== undefined) {
        detailSheet.getRange(i + 1, 2).setValue(val || '');
      }
    }
  }

  // ── 4. Clear Order of Service details (col C); auto-link sermon/scripture ──
  // Keeps items (col B) and types (col D) intact.
  // Sermon rows → formula showing "Title — Preacher · Scripture" from Service Details
  // Scripture rows → formula showing Scripture Reference from Service Details
  // All other detail cells → cleared
  var orderSheet   = ss.getSheetByName('🗓 Order of Service');
  var orderLastRow = orderSheet.getLastRow();
  if (orderLastRow > 4) {
    // VLOOKUP helper — pulls a field value from the Service Details key-value tab
    var sd = "'📋 Service Details'!A:B";
    var lu = function(key) { return 'IFERROR(VLOOKUP("' + key + '",' + sd + ',2,0),"")'; };

    var sermonFormula = '=' + lu('Sermon Title') +
      '&IF(' + lu('Preacher') + '="","","  —  "&' + lu('Preacher') + ')';
    var scriptureFormula = '=' + lu('Scripture Reference');

    var orderData = orderSheet.getRange(5, 1, orderLastRow - 4, 4).getValues();
    for (var oRow = 0; oRow < orderData.length; oRow++) {
      var oType      = String(orderData[oRow][3]).trim().toLowerCase(); // col D = Type
      var detailCell = orderSheet.getRange(5 + oRow, 3);
      if (oType === 'sermon') {
        detailCell.setFormula(sermonFormula);
      } else if (oType === 'scripture') {
        detailCell.setFormula(scriptureFormula);
      } else {
        detailCell.clearContent();
      }
    }
  }

  // ── 5. Announcements: delete rows where "Keep next week?" (col D) ≠ "Yes" ──
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

  // ── 6. Prayer Items: delete rows where "Keep next week?" (col C) ≠ "Yes" ───
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

  // ── 7. Re-apply colour highlights ─────────────────────────────────────────
  setupConditionalFormatting();

  // ── 8. Summary ────────────────────────────────────────────────────────────
  var teamFilled = Object.keys(upcomingTeam).filter(function(k) { return upcomingTeam[k]; }).length;
  ui.alert(
    '✓ Next Service Ready',
    'Next service: ' + newDateStr + serviceLabel + '\n\n' +
    teamFilled + ' service team field(s) auto-filled from roster.\n' +
    keptAnnouncements + ' announcement(s) carried forward, ' + deletedAnnouncements + ' removed.\n' +
    keptPrayer + ' prayer item(s) carried forward, ' + deletedPrayer + ' removed.\n\n' +
    'Still needed: Sermon Title, Scripture Reference, Order of Service.',
    ui.ButtonSet.OK
  );
}

// ── VISUAL CLARITY: COLOUR-CODE SERVICE DETAILS ──────────────────────────────


// ── SHEET PROTECTION: LOCK HEADERS & INSTRUCTIONS ─────────────────────────────

function applySheetProtections() {
  var ss = SpreadsheetApp.getActive();
  var sheets = ss.getSheets();
  var me = Session.getEffectiveUser();

  sheets.forEach(function(sheet) {
    var name = sheet.getName();

    // 1. Remove existing protections on this sheet
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(function(p) { p.remove(); });

    // 2. Lock Header Rows (1-4) on data tabs
    var dataTabs = ['📋 Service Details', '🗓 Order of Service', '📢 Announcements', '🙏 Prayer Items', '👥 Roster', '📅 Events', '💰 Offering'];
    if (dataTabs.indexOf(name) !== -1) {
      var headerRange = sheet.getRange('1:4');
      var p = headerRange.protect().setDescription('Header Protection — Row 1-4');
      p.removeEditors(p.getEditors());
      if (p.canEdit()) p.addEditor(me);
    }

    // 3. Lock Column A in key-value tabs (Service Details & Settings)
    if (name === '📋 Service Details' || name === '⚙️  Settings') {
      var colA = sheet.getRange('A:A');
      var p = colA.protect().setDescription('Label Protection — Column A');
      p.removeEditors(p.getEditors());
      if (p.canEdit()) p.addEditor(me);
    }

    // 4. Lock Column A (#) in list tabs
    var listTabs = ['🗓 Order of Service', '📢 Announcements'];
    if (listTabs.indexOf(name) !== -1) {
      var colA = sheet.getRange('A:A');
      var p = colA.protect().setDescription('Auto-Number Protection — Column A');
      p.removeEditors(p.getEditors());
      if (p.canEdit()) p.addEditor(me);
    }

    // 5. Full Lock for Instruction Tab
    if (name === 'ℹ️ Instructions') {
      var p = sheet.protect().setDescription('Instructions Protection');
      p.removeEditors(p.getEditors());
      if (p.canEdit()) p.addEditor(me);
    }
  });
}

// ── VISUAL CLARITY: DYNAMIC CONDITIONAL FORMATTING ────────────────────────────

function setupConditionalFormatting() {
  var ss = SpreadsheetApp.getActive();

  // 1. SERVICE DETAILS: Required Yellow / Completed White
  var detailSheet = ss.getSheetByName('📋 Service Details');
  if (detailSheet) {
    var range = detailSheet.getRange('B:B');
    var rules = [];

    // Yellow if empty (Required)
    var yellowFields = [
      'Service Date', 'Sermon Title', 'Scripture Reference', 'Preacher', 'Chairperson',
      'Worship Leader', 'Music / Band', 'PowerPoint', 'PA / Sound', 'Chief Usher', 'Ushers', 'Morning Tea'
    ];
    var yellowText = yellowFields.join('|');

    // Rule: IF Column A matches a yellowField AND Column B is empty → Yellow
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(ISBLANK(B1), REGEXMATCH(A1, "' + yellowText + '"))')
      .setBackground('#FFF9C4')
      .setRanges([range])
      .build());

    // Rule: IF Column A matches a yellowField AND Column B is NOT empty → White (None)
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(NOT(ISBLANK(B1)), REGEXMATCH(A1, "' + yellowText + '"))')
      .setBackground('#FFFFFF')
      .setBorderColor('#E0E0E0')
      .setRanges([range])
      .build());

    detailSheet.setConditionalFormatRules(rules);
  }

  // 2. ORDER OF SERVICE: Formula Safeguard (Red if formula overwritten)
  var orderSheet = ss.getSheetByName('🗓 Order of Service');
  if (orderSheet) {
    var range = orderSheet.getRange('C5:C100');
    var rules = [];

    // Rule: IF row is 'Sermon' or 'Scripture' and cell doesn't start with '=' → Red
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(OR($D5="Sermon", $D5="Scripture"), NOT(ISFORMULA(C5)), NOT(ISBLANK(C5)))')
      .setBackground('#FFEBEE')
      .setFontColor('#B71C1C')
      .build());

    orderSheet.setConditionalFormatRules(rules);
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
  var success    = triggerGitHubWorkflow();
  var recipients = getNotificationEmails_();

  if (recipients.length > 0) {
    var dateStr     = getServiceDate();
    var publishedAt = Utilities.formatDate(new Date(), TIMEZONE, 'EEEE d MMMM yyyy \'at\' h:mm a');
    if (success) {
      MailApp.sendEmail(
        recipients.join(', '),
        '✓ CACV Bulletin is live — ' + dateStr,
        'The bulletin for ' + dateStr + ' has been published successfully.\n' +
        'Published: ' + publishedAt + '\n\n' +
        'View it at: https://' + GITHUB_OWNER + '.github.io/' + GITHUB_REPO + '/'
      );
    } else {
      MailApp.sendEmail(
        recipients.join(', '),
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

// ── TEST NOTIFICATION ─────────────────────────────────────────────────────────

function sendTestNotification() {
  var ui         = SpreadsheetApp.getUi();
  var recipients = getNotificationEmails_();

  if (recipients.length === 0) {
    ui.alert(
      'No recipients configured',
      'Please add email addresses to the "Notification Emails" field in the ⚙️ Settings tab first.',
      ui.ButtonSet.OK
    );
    return;
  }

  var result = ui.alert(
    '🧪 Send Test Notification',
    'This will send a test email to:\n' + recipients.join('\n') + '\n\nProceed?',
    ui.ButtonSet.OK_CANCEL
  );
  if (result !== ui.Button.OK) return;

  try {
    MailApp.sendEmail(
      recipients.join(', '),
      '🧪 CACV Bulletin — Test Notification',
      'This is a test notification from the CACV Bulletin Automation system.\n\n' +
      'If you received this email, your notification settings are configured correctly.\n\n' +
      'Notification recipients: ' + recipients.join(', ')
    );
    ui.alert('✓ Test email sent', 'Test notification sent to:\n' + recipients.join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('❌ Failed to send', 'Error: ' + e.message + '\n\nPlease check the email addresses in the ⚙️ Settings tab.', ui.ButtonSet.OK);
  }
}

// ── INTERNAL ─────────────────────────────────────────────────────────────────

/**
 * Read notification email recipients from the Settings tab (cell B1 beside "Notification Emails").
 * Returns an array of trimmed, non-empty email strings.
 */
function getNotificationEmails_() {
  var settingsSheet = SpreadsheetApp.getActive().getSheetByName('⚙️  Settings');
  if (!settingsSheet) return [];
  var data = settingsSheet.getRange('A:B').getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === 'Notification Emails') {
      var emailStr = String(data[i][1]).trim();
      return emailStr
        ? emailStr.split(',').map(function(e) { return e.trim(); }).filter(Boolean)
        : [];
    }
  }
  return [];
}

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
