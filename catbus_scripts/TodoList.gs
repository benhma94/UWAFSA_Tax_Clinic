/**
 * TodoList.gs
 * CRUD for the "Action Items" and "Coordinators" sheets,
 * plus the daily reminder trigger for the To-Do List feature.
 */

// ─── Coordinator helpers ────────────────────────────────────────────────────

/**
 * Returns or creates the "Coordinators" sheet.
 * Columns: Name | Email
 */
function getOrCreateCoordinatorsSheet_() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(ACTION_ITEM_CONFIG.COORDINATORS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ACTION_ITEM_CONFIG.COORDINATORS_SHEET_NAME);
    sheet.appendRow(['Name', 'Email']);
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  }
  return sheet;
}

/**
 * Returns all coordinators as an array of { rowIndex, name, email }.
 * rowIndex is 1-based (including header row offset).
 */
function getCoordinators() {
  const sheet = getOrCreateCoordinatorsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  return data
    .map((row, i) => ({ rowIndex: i + 2, name: row[0], email: row[1] }))
    .filter(c => c.name || c.email);
}

/**
 * Appends a new coordinator row.
 * @param {Object} data - { name: string, email: string }
 */
function addCoordinator(data) {
  if (!data || !data.name || !data.email) throw new Error('Name and email are required.');
  const sheet = getOrCreateCoordinatorsSheet_();
  sheet.appendRow([data.name.trim(), data.email.trim()]);
}

/**
 * Deletes a coordinator by 1-based sheet row index.
 * @param {number} rowIndex
 */
function deleteCoordinator(rowIndex) {
  const sheet = getOrCreateCoordinatorsSheet_();
  sheet.deleteRow(rowIndex);
}
