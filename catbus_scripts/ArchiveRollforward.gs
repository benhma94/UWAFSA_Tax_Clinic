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
  CacheService.getScriptCache().remove('CLINIC_DATES_OVERRIDE');
  return { success: true };
}

/**
 * Archives per-volunteer stats (returns filed, hours volunteered) into the permanent
 * Volunteer Alumni sheet before the rollforward clears operational data.
 *
 * Must be run AFTER archiveCurrentData() (Phase 1) and BEFORE rollforwardData() (Phase 3),
 * so that the Consolidated Volunteer List, Tax Return Tracker, and SignOut sheet are still intact.
 *
 * The Alumni sheet uses fixed columns 0–8 (EMAIL through LAST_UPDATED) plus dynamic year
 * column pairs appended as needed: {YEAR}_RETURNS, {YEAR}_HOURS (starting at column 9).
 * Totals (TOTAL_RETURNS, TOTAL_HOURS) are recomputed as the sum of all year columns.
 *
 * @param {number} year  The clinic year being archived (e.g. 2026)
 * @returns {{ processed: number, inserted: number, updated: number, unmatched: string[], year: number }}
 */
function archiveVolunteerStats(year) {
  const ss = getSpreadsheet();
  const cols = CONFIG.COLUMNS.VOLUNTEER_ALUMNI;

  // ── A. Build name→volunteer map from Consolidated Volunteer List ──────────
  // Register both preferred+last and legal+last name variants, same approach
  // as getNoShowVolunteers() in VolunteerManagement.gs.
  const rosterSheet = ss.getSheetByName(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  if (!rosterSheet || rosterSheet.getLastRow() <= 1) {
    throw new Error('Consolidated Volunteer List is empty or missing.');
  }
  const rosterCols = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST;
  const numRosterCols = rosterCols.ATTENDED_TRAINING + 1;
  const rosterData = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, numRosterCols).getValues();

  // Map: lowercased name variant → { email, firstNameLegal, preferredName, lastName, role }
  const nameToVolunteer = {};
  const volunteersByEmail = {}; // keyed by lowercase email — canonical record per volunteer

  for (const row of rosterData) {
    const email = (row[rosterCols.EMAIL] || '').toString().trim().toLowerCase();
    if (!email) continue;
    const legal     = (row[rosterCols.FIRST_NAME_LEGAL] || '').toString().trim();
    const preferred = (row[rosterCols.PREFERRED_NAME]   || '').toString().trim();
    const last      = (row[rosterCols.LAST_NAME]        || '').toString().trim();
    const role      = (row[rosterCols.ROLE]             || '').toString().trim();
    const record = { email, firstNameLegal: legal, preferredName: preferred, lastName: last, role };

    volunteersByEmail[email] = record;

    const firstName = preferred || legal;
    const displayName = `${firstName} ${last}`.trim().toLowerCase();
    if (displayName) nameToVolunteer[displayName] = record;

    if (preferred && legal && preferred !== legal) {
      const legalVariant = `${legal} ${last}`.trim().toLowerCase();
      if (legalVariant) nameToVolunteer[legalVariant] = record;
    }
  }

  // ── B. Compute hours per email from SignOut sheet ──────────────────────────
  // DURATION is a formula cell — use getDisplayValues() and parse H:MM or HH:MM:SS.
  const minutesByEmail = {};
  const unmatchedNames = new Set();

  const signoutSheet = ss.getSheetByName(CONFIG.SHEETS.SIGNOUT);
  if (signoutSheet && signoutSheet.getLastRow() > 1) {
    const soCols = CONFIG.COLUMNS.SIGNOUT;
    const numCols = soCols.DURATION + 1;
    const soData = signoutSheet.getRange(2, 1, signoutSheet.getLastRow() - 1, numCols).getDisplayValues();
    for (const row of soData) {
      const name = (row[soCols.VOLUNTEER_INFO] || '').toString().trim();
      if (!name) continue;
      const vol = nameToVolunteer[name.toLowerCase()];
      if (!vol) {
        unmatchedNames.add(name);
        continue;
      }
      const parts = (row[soCols.DURATION] || '').trim().split(':');
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const s = parts.length >= 3 ? (parseInt(parts[2], 10) || 0) : 0;
        minutesByEmail[vol.email] = (minutesByEmail[vol.email] || 0) + h * 60 + m + s / 60;
      }
    }
  }

  // ── C. Compute returns per email from Tax Return Tracker ───────────────────
  // Same logic as getVolunteerPerformanceMetrics() in AdminDashboard.gs.
  const returnsByEmail = {};
  const trackerSheet = ss.getSheetByName(CONFIG.SHEETS.TAX_RETURN_TRACKER);
  if (trackerSheet && trackerSheet.getLastRow() > 1) {
    const tc = CONFIG.COLUMNS.TAX_RETURN_TRACKER;
    const numCols = tc.PAPER + 1;
    const trackerData = trackerSheet.getRange(2, 1, trackerSheet.getLastRow() - 1, numCols).getValues();
    for (const row of trackerData) {
      const volunteerName = (row[tc.VOLUNTEER] || '').toString().trim();
      const efile   = (row[tc.EFILE]  || '').toString().toLowerCase() === 'yes';
      const paper   = (row[tc.PAPER]  || '').toString().toLowerCase() === 'yes';
      const married = (row[tc.MARRIED] || '').toString().toLowerCase() === 'yes';
      if (!volunteerName || (!efile && !paper)) continue;
      const vol = nameToVolunteer[volunteerName.toLowerCase()];
      if (!vol) {
        unmatchedNames.add(volunteerName);
        continue;
      }
      returnsByEmail[vol.email] = (returnsByEmail[vol.email] || 0) + (married ? 2 : 1);
    }
  }

  // ── D. Get or create Alumni sheet ─────────────────────────────────────────
  let alumniSheet = ss.getSheetByName(CONFIG.SHEETS.VOLUNTEER_ALUMNI);
  if (!alumniSheet) {
    alumniSheet = ss.insertSheet(CONFIG.SHEETS.VOLUNTEER_ALUMNI);
    const headers = ['EMAIL', 'FIRST_NAME_LEGAL', 'PREFERRED_NAME', 'LAST_NAME',
                     'TOTAL_RETURNS', 'TOTAL_HOURS', 'BLACKLISTED', 'BLACKLIST_REASON', 'LAST_UPDATED'];
    alumniSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    alumniSheet.setFrozenRows(1);
    alumniSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  // ── E. Read header row — build existing email index and discover year columns ──
  const lastAlumniCol = Math.max(alumniSheet.getLastColumn(), cols.LAST_UPDATED + 1);
  const headerRow = alumniSheet.getRange(1, 1, 1, lastAlumniCol).getValues()[0];

  // Map: col header string → 0-based index
  const headerIndex = {};
  for (let i = 0; i < headerRow.length; i++) {
    const h = (headerRow[i] || '').toString().trim();
    if (h) headerIndex[h] = i;
  }

  // ── F. Find or create year columns ────────────────────────────────────────
  const yearReturnsKey = year + '_RETURNS';
  const yearHoursKey   = year + '_HOURS';
  let yearReturnsCol, yearHoursCol; // 0-based

  if (yearReturnsKey in headerIndex) {
    yearReturnsCol = headerIndex[yearReturnsKey];
    yearHoursCol   = headerIndex[yearHoursKey];
  } else {
    // Append two new columns after the last existing column
    yearReturnsCol = lastAlumniCol;      // 0-based index for new col
    yearHoursCol   = lastAlumniCol + 1;
    alumniSheet.getRange(1, yearReturnsCol + 1).setValue(yearReturnsKey);
    alumniSheet.getRange(1, yearHoursCol   + 1).setValue(yearHoursKey);
    headerIndex[yearReturnsKey] = yearReturnsCol;
    headerIndex[yearHoursKey]   = yearHoursCol;
  }

  // Total columns needed now
  const totalCols = Math.max(lastAlumniCol, yearHoursCol + 1);

  // ── G. Build existing Alumni email→row-index map ───────────────────────────
  const alumniLastRow = alumniSheet.getLastRow();
  // Map: lowercase email → 1-based row number in sheet
  const emailToRow = {};
  let existingData = [];
  if (alumniLastRow > 1) {
    existingData = alumniSheet.getRange(2, 1, alumniLastRow - 1, totalCols).getValues();
    for (let i = 0; i < existingData.length; i++) {
      const e = (existingData[i][cols.EMAIL] || '').toString().trim().toLowerCase();
      if (e) emailToRow[e] = i + 2; // 1-based row
    }
  }

  // Helper: collect all year column pairs from headerIndex and sum them for a data row
  function computeTotals(row) {
    let totalReturns = 0;
    let totalHours   = 0;
    for (const key of Object.keys(headerIndex)) {
      if (key.endsWith('_RETURNS') && /^\d{4}_RETURNS$/.test(key)) {
        totalReturns += Number(row[headerIndex[key]]) || 0;
      }
      if (key.endsWith('_HOURS') && /^\d{4}_HOURS$/.test(key)) {
        totalHours += Number(row[headerIndex[key]]) || 0;
      }
    }
    return { totalReturns, totalHours };
  }

  // ── G. Upsert each volunteer ───────────────────────────────────────────────
  let inserted = 0;
  let updated  = 0;
  const now = new Date();

  for (const email of Object.keys(volunteersByEmail)) {
    const vol = volunteersByEmail[email];
    const returnsThisYear = returnsByEmail[email] || 0;
    const hoursThisYear   = Math.round((minutesByEmail[email] || 0) / 60 * 100) / 100;

    if (email in emailToRow) {
      // ── Existing row: update in-place ──
      const rowIdx = emailToRow[email]; // 1-based
      const dataIdx = rowIdx - 2;      // 0-based index into existingData
      const row = existingData[dataIdx].slice(); // copy

      // Safety guard: if year already archived (cell has a numeric value, even 0), skip accumulation.
      const existingYearReturns = row[yearReturnsCol];
      if (typeof existingYearReturns === 'number') {
        // Already archived this year — skip accumulation, but update name fields
        row[cols.FIRST_NAME_LEGAL] = vol.firstNameLegal;
        row[cols.PREFERRED_NAME]   = vol.preferredName;
        row[cols.LAST_NAME]        = vol.lastName;
        row[cols.LAST_UPDATED]     = now;
        // Pad row to totalCols if needed
        while (row.length < totalCols) row.push('');
        alumniSheet.getRange(rowIdx, 1, 1, totalCols).setValues([row]);
        updated++;
        continue;
      }

      // Write year stats
      row[yearReturnsCol] = returnsThisYear;
      row[yearHoursCol]   = hoursThisYear;

      // Recompute totals from all year columns
      const { totalReturns, totalHours } = computeTotals(row);
      row[cols.TOTAL_RETURNS] = totalReturns;
      row[cols.TOTAL_HOURS]   = Math.round(totalHours * 100) / 100;

      // Update name fields (may have changed)
      row[cols.FIRST_NAME_LEGAL] = vol.firstNameLegal;
      row[cols.PREFERRED_NAME]   = vol.preferredName;
      row[cols.LAST_NAME]        = vol.lastName;
      row[cols.LAST_UPDATED]     = now;

      // Pad row to totalCols if needed
      while (row.length < totalCols) row.push('');
      alumniSheet.getRange(rowIdx, 1, 1, totalCols).setValues([row]);
      updated++;

    } else {
      // ── New row: build and append ──
      const newRow = new Array(totalCols).fill('');
      newRow[cols.EMAIL]          = email;
      newRow[cols.FIRST_NAME_LEGAL] = vol.firstNameLegal;
      newRow[cols.PREFERRED_NAME] = vol.preferredName;
      newRow[cols.LAST_NAME]      = vol.lastName;
      newRow[cols.TOTAL_RETURNS]  = returnsThisYear;
      newRow[cols.TOTAL_HOURS]    = hoursThisYear;
      newRow[cols.BLACKLISTED]    = false;
      newRow[cols.BLACKLIST_REASON] = '';
      newRow[cols.LAST_UPDATED]   = now;
      newRow[yearReturnsCol]      = returnsThisYear;
      newRow[yearHoursCol]        = hoursThisYear;

      alumniSheet.appendRow(newRow);
      emailToRow[email] = alumniSheet.getLastRow(); // track for future reference
      inserted++;
    }
  }

  return {
    processed: inserted + updated,
    inserted,
    updated,
    unmatched: [...unmatchedNames],
    year
  };
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
    CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST,
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
