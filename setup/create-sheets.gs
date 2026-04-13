/**
 * CATBUS Sheet Initializer
 * ========================
 * Run this script ONCE in the Apps Script editor of your CATBUS spreadsheet
 * to create all required sheet tabs with correct headers.
 *
 * HOW TO USE:
 *   1. Open your Google Spreadsheet.
 *   2. Go to Extensions > Apps Script.
 *   3. Delete any existing code in the editor.
 *   4. Paste this entire file into the editor.
 *   5. Click "Run" (▶) with the function "createCatbusSheets" selected.
 *   6. Authorize the script when prompted.
 *   7. A dialog will confirm which sheets were created.
 *
 * Sheets that already exist are left completely untouched.
 * Safe to run multiple times.
 */

function createCatbusSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = [];

  /**
   * Creates a sheet with bold blue headers if it does not already exist.
   * @param {string} name - Sheet tab name (must match Config.gs SHEETS constants exactly)
   * @param {string[]} headers - Column header labels in order
   * @param {function} [extraSetup] - Optional callback for additional formatting
   */
  function ensureSheet(name, headers, extraSetup) {
    if (ss.getSheetByName(name)) {
      log.push('  SKIP    ' + name + ' (already exists)');
      return;
    }

    const sheet = ss.insertSheet(name);

    if (headers && headers.length > 0) {
      const range = sheet.getRange(1, 1, 1, headers.length);
      range.setValues([headers]);
      range.setFontWeight('bold');
      range.setBackground('#4a86e8');
      range.setFontColor('#ffffff');
      range.setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headers.length);
    }

    if (extraSetup) extraSetup(sheet);

    log.push('  CREATE  ' + name);
  }

  // ── 1. Client Intake ─────────────────────────────────────────────────────────
  // Matches Config.gs COLUMNS.CLIENT_INTAKE (0-indexed)
  ensureSheet('Client Intake', [
    'Timestamp',           // 0
    'Household Size',      // 1
    'Filing Years',        // 2
    'Situations',          // 3
    'Notes',               // 4
    'Client ID',           // 5
    'Needs Senior Review', // 6
    'Is High Priority',    // 7
    'Documents',           // 8
  ]);

  // ── 2. Client Assignment ─────────────────────────────────────────────────────
  // Matches Config.gs COLUMNS.CLIENT_ASSIGNMENT
  ensureSheet('Client Assignment', [
    'Timestamp',  // 0
    'Client ID',  // 1
    'Volunteer',  // 2
    'Completed',  // 3
  ]);

  // ── 3. Tax Return Tracker ────────────────────────────────────────────────────
  // Matches Config.gs COLUMNS.TAX_RETURN_TRACKER
  ensureSheet('Tax Return Tracker', [
    'Timestamp',          // 0
    'Volunteer',          // 1
    'Client ID',          // 2
    'Tax Year',           // 3
    'Reviewer',           // 4
    'Secondary Reviewer', // 5
    'Married',            // 6
    'Efile',              // 7
    'Paper',              // 8
    'Incomplete',         // 9
    'Status',             // 10
  ]);

  // ── 4. Help Requests ─────────────────────────────────────────────────────────
  // Matches Config.gs COLUMNS.HELP_REQUESTS
  ensureSheet('Help Requests', [
    'Timestamp', // 0
    'Volunteer', // 1
    'Status',    // 2
  ]);

  // ── 5. Review Requests ───────────────────────────────────────────────────────
  // Matches Config.gs COLUMNS.REVIEW_REQUESTS
  ensureSheet('Review Requests', [
    'Timestamp',         // 0
    'Volunteer',         // 1
    'Status',            // 2
    'Client ID',         // 3
    'Tax Year',          // 4
    'Reviewer or Reason', // 5
  ]);

  // ── 6. Volunteer List ────────────────────────────────────────────────────────
  // Matches Config.gs COLUMNS.VOLUNTEER_LIST
  ensureSheet('Volunteer List', [
    'Timestamp',  // 0
    'Name',       // 1
    'Station',    // 2
    'Session ID', // 3
    'On Break',   // 4
  ]);

  // ── 7. SignOut ───────────────────────────────────────────────────────────────
  // Matches Config.gs COLUMNS.SIGNOUT
  ensureSheet('SignOut', [
    'Timestamp',  // 0
    'Volunteer',  // 1
    'Session ID', // 2
  ]);

  // ── 8. Shift Schedule ────────────────────────────────────────────────────────
  // ScheduleAutomation.gs regenerates this sheet each run (clears + rewrites).
  // Creating it upfront with a placeholder header avoids first-run errors.
  ensureSheet('Shift Schedule', [
    'Time / Day',
    'Day 1',
    'Day 2',
    'Day 3',
    'Day 4',
  ]);

  // ── 9. Schedule Availability ─────────────────────────────────────────────────
  // Matches AvailabilityForm.gs column structure
  ensureSheet('Schedule Availability', [
    'Timestamp',              // 0
    'First Name',             // 1
    'Last Name',              // 2
    'Email',                  // 3
    'Role',                   // 4
    'Number of Shifts',       // 5
    'Consecutive Preference', // 6
    'Availability',           // 7
    'Notes',                  // 8
    'Last Modified',          // 9
  ]);

  // ── 10. UFILE Keys ───────────────────────────────────────────────────────────
  // Matches Config.gs PRODUCT_CODE_CONFIG.COLUMNS
  ensureSheet('UFILE Keys', [
    'Year',                // 0
    'Key',                 // 1
    'Number of times used', // 2
  ]);

  // ── 12. Product Code Distribution Log ───────────────────────────────────────
  // Matches Config.gs PRODUCT_CODE_CONFIG.DISTRIBUTION_LOG_SHEET usage
  ensureSheet('Product Code Distribution Log', [
    'Timestamp',
    'Year',
    'Product Code',
    'Volunteer 1 Email',
    'Volunteer 1 Name',
    'Volunteer 1 Status',
    'Volunteer 2 Email',
    'Volunteer 2 Name',
    'Volunteer 2 Status',
    'Volunteer 3 Email',
    'Volunteer 3 Name',
    'Volunteer 3 Status',
  ]);

  // ── 13. Messages ─────────────────────────────────────────────────────────────
  // Matches Config.gs MESSAGING_CONFIG.COLUMNS
  ensureSheet('Messages', [
    'Timestamp',      // 0
    'FromName',       // 1
    'FromRole',       // 2
    'ToName',         // 3
    'ToSessionId',    // 4
    'Message',        // 5
    'MessageType',    // 6
    'ConversationId', // 7
    'Status',         // 8
    'ReadAt',         // 9
  ]);

  // ── 14. Volunteer Tags ───────────────────────────────────────────────────────
  // Simple two-column lookup used by the schedule viewer
  ensureSheet('Volunteer Tags', [
    'Volunteer Name',
    'Tag',
  ]);

  // ── 15. Quiz Submissions ─────────────────────────────────────────────────────
  // Matches QuizSubmission.gs column structure
  ensureSheet('Quiz Submissions', [
    'Timestamp',
    'Volunteer',
    'Partner',
    'Q1 - Missing Information',
    'Q2 - Additional Form',
    'Q4 - Refund/Payable ($)',
    'Q5 - Ontario Trillium Benefit ($)',
    'Q6 - Canada Essentials Benefit ($)',
    'Email 1',   // 8  - volunteer email for quiz result delivery
    'Email 2',   // 9  - partner email for quiz result delivery
    'Status',    // 10 - Pass/Fail verdict set by sendQuizResult()
  ], function(sheet) {
    // Format dollar columns (Q4, Q5, Q6 = cols 6, 7, 8) with accounting format
    const maxRows = sheet.getMaxRows();
    if (maxRows > 1) {
      sheet.getRange(2, 6, maxRows - 1, 3).setNumberFormat('"$"#,##0;"-$"#,##0');
    }
  });

  // NOTE: "Appointment Bookings" is intentionally omitted.
  // AppointmentBooking.gs creates it on demand via getOrCreateSheet().

  // ── Summary ──────────────────────────────────────────────────────────────────
  Logger.log('CATBUS Sheet Setup Complete:\n' + log.join('\n'));

  SpreadsheetApp.getUi().alert(
    'CATBUS Setup Complete',
    'Sheet operations:\n\n' + log.join('\n') +
    '\n\nYou can now copy this spreadsheet\'s ID from the URL and use it in setup.js.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
