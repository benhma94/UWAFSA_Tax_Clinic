/**
 * Archive & Rollforward
 * Admin-only tools to archive the current year's data and prepare the
 * spreadsheet for the next clinic year.
 */

/**
 * Creates a full archive copy of the main spreadsheet in the same Drive folder.
 * All tabs are copied. The archive spreadsheet is named "CATBUS Archive YYYY".
 *
 * @returns {{ url: string, name: string }}
 */
function archiveCurrentData() {
  const ss = getSpreadsheet();
  const year = new Date().getFullYear();
  const archiveName = 'CATBUS Archive ' + year;

  // Find the parent Drive folder of the main spreadsheet
  const parentFolder = DriveApp.getFileById(ss.getId()).getParents().next();

  // Create a new blank spreadsheet then move it to the correct folder
  const archiveSs = SpreadsheetApp.create(archiveName);
  DriveApp.getFileById(archiveSs.getId()).moveTo(parentFolder);

  // Copy every sheet from the source to the archive
  const sheets = ss.getSheets();
  for (const sheet of sheets) {
    sheet.copyTo(archiveSs);
  }

  // Remove the default blank "Sheet1" that SpreadsheetApp.create() adds
  const defaultSheet = archiveSs.getSheetByName('Sheet1');
  if (defaultSheet && archiveSs.getSheets().length > 1) {
    archiveSs.deleteSheet(defaultSheet);
  }

  return { url: archiveSs.getUrl(), name: archiveName };
}

/**
 * Saves new clinic dates (entered by admin during rollforward) to Script Properties.
 * Config.gs reads this override at runtime, falling back to the hardcoded 2026 dates.
 *
 * @param {Object} config  { dates: [{date: string, room: string, mapsUrl: string}] }
 * @returns {{ success: boolean }}
 */
function saveClinicDates(config) {
  const dates = config && config.dates;
  if (!dates || dates.length !== 4) {
    throw new Error('Exactly 4 clinic dates are required.');
  }
  for (var i = 0; i < dates.length; i++) {
    if (!dates[i].date || !dates[i].date.trim()) {
      throw new Error('Date ' + (i + 1) + ' is empty.');
    }
    if (!dates[i].room || !dates[i].room.trim()) {
      throw new Error('Room for date ' + (i + 1) + ' is empty.');
    }
  }
  PropertiesService.getScriptProperties().setProperty(
    'CLINIC_DATES_OVERRIDE',
    JSON.stringify(dates)
  );
  return { success: true };
}

/**
 * Clears operational data from year-specific sheets (header row preserved).
 * UFILE Keys and Product Code Distribution Log are preserved.
 *
 * @returns {{ results: Array<{sheet: string, status: string, note: string}> }}
 */
function rollforwardData() {
  const ss = getSpreadsheet();

  const SHEETS_TO_CLEAR = [
    CONFIG.SHEETS.CLIENT_INTAKE,
    CONFIG.SHEETS.CLIENT_ASSIGNMENT,
    CONFIG.SHEETS.HELP_REQUESTS,
    CONFIG.SHEETS.REVIEW_REQUESTS,
    CONFIG.SHEETS.TAX_RETURN_TRACKER,
    CONFIG.SHEETS.VOLUNTEER_LIST,
    CONFIG.SHEETS.SIGNOUT,
    CONFIG.SHEETS.SCHEDULE_AVAILABILITY,
    CONFIG.SHEETS.SCHEDULE_OUTPUT,
    CONFIG.SHEETS.MESSAGES,
    APPOINTMENT_CONFIG.SHEET_NAME,
  ];

  const SHEETS_PRESERVED = [
    { name: CONFIG.SHEETS.PRODUCT_CODES,
      note: 'Keys are reusable — add new year\'s keys manually' },
    { name: CONFIG.SHEETS.PRODUCT_CODE_DISTRIBUTION_LOG,
      note: 'Historical record kept' }
  ];

  const results = [];

  for (const sheetName of SHEETS_TO_CLEAR) {
    const result = { sheet: sheetName, status: '', note: '' };
    try {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        result.status = 'skipped';
        result.note = 'Sheet not found';
      } else {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          sheet.deleteRows(2, lastRow - 1);
          result.status = 'cleared';
          result.note = (lastRow - 1) + ' row(s) removed';
        } else {
          result.status = 'already empty';
          result.note = 'No data rows to remove';
        }
      }
    } catch (e) {
      result.status = 'error';
      result.note = e.message;
    }
    results.push(result);
  }

  for (const entry of SHEETS_PRESERVED) {
    results.push({ sheet: entry.name, status: 'preserved', note: entry.note });
  }

  return { results };
}
