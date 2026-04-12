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

// ─── Action Item helpers ─────────────────────────────────────────────────────

const ACTION_ITEM_HEADERS_ = [
  'Title', 'Description', 'Category', 'Due Date',
  'Responsible Individuals', 'Status', 'Reminders Sent',
  'Created At', 'Updated At'
];

/**
 * Returns or creates the "Action Items" sheet.
 */
function getOrCreateActionItemsSheet_() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(ACTION_ITEM_CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ACTION_ITEM_CONFIG.SHEET_NAME);
    sheet.appendRow(ACTION_ITEM_HEADERS_);
    sheet.getRange(1, 1, 1, ACTION_ITEM_HEADERS_.length).setFontWeight('bold');
  }
  return sheet;
}

/**
 * Returns all action items as an array of objects.
 * Each object includes `rowIndex` (1-based, offset for header).
 */
function getTodoItems() {
  const sheet = getOrCreateActionItemsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, ACTION_ITEM_HEADERS_.length).getValues();
  return data.map((row, i) => ({
    rowIndex:               i + 2,
    title:                  row[0],
    description:            row[1],
    category:               row[2],
    dueDate:                row[3] ? Utilities.formatDate(new Date(row[3]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
    responsibleIndividuals: row[4],
    status:                 row[5],
    remindersSent:          row[6],
    createdAt:              row[7] ? row[7].toString() : '',
    updatedAt:              row[8] ? row[8].toString() : ''
  }));
}

/**
 * Appends a new action item row.
 * @param {Object} data - { title, description, category, dueDate, responsibleIndividuals, status }
 */
function createTodoItem(data) {
  if (!data.title) throw new Error('Title is required.');
  if (!data.dueDate) throw new Error('Due date is required.');
  const sheet = getOrCreateActionItemsSheet_();
  const now = new Date();
  sheet.appendRow([
    data.title.trim(),
    (data.description || '').trim(),
    data.category || 'Clinic Prep',
    new Date(data.dueDate),
    (data.responsibleIndividuals || ''),
    data.status || 'Not Started',
    '',   // Reminders Sent — starts empty
    now,  // Created At
    now   // Updated At
  ]);
}

/**
 * Updates an existing action item by 1-based row index.
 * @param {number} rowIndex
 * @param {Object} data - { title, description, category, dueDate, responsibleIndividuals, status }
 */
function updateTodoItem(rowIndex, data) {
  if (!data.title) throw new Error('Title is required.');
  if (!data.dueDate) throw new Error('Due date is required.');
  const sheet = getOrCreateActionItemsSheet_();
  const now = new Date();
  // Read current row to preserve Reminders Sent and Created At
  const current = sheet.getRange(rowIndex, 1, 1, ACTION_ITEM_HEADERS_.length).getValues()[0];
  sheet.getRange(rowIndex, 1, 1, ACTION_ITEM_HEADERS_.length).setValues([[
    data.title.trim(),
    (data.description || '').trim(),
    data.category || 'Clinic Prep',
    new Date(data.dueDate),
    (data.responsibleIndividuals || ''),
    data.status || 'Not Started',
    current[6],  // Preserve Reminders Sent
    current[7],  // Preserve Created At
    now          // Updated At
  ]]);
}

/**
 * Deletes an action item by 1-based sheet row index.
 * @param {number} rowIndex
 */
function deleteTodoItem(rowIndex) {
  const sheet = getOrCreateActionItemsSheet_();
  sheet.deleteRow(rowIndex);
}
