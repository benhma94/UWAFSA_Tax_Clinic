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
  }))
  .filter(item => item.title || item.status);
}

/**
 * Appends a new action item row.
 * @param {Object} data - { title, description, category, dueDate, responsibleIndividuals, status }
 */
function createTodoItem(data) {
  if (!data) throw new Error('data is required.');
  if (!data.title) throw new Error('Title is required.');
  if (!data.dueDate) throw new Error('Due date is required.');
  const sheet = getOrCreateActionItemsSheet_();
  const now = new Date();
  sheet.appendRow([
    data.title.trim(),
    (data.description || '').trim(),
    data.category || 'Clinic Prep',
    new Date(data.dueDate),
    (data.responsibleIndividuals || '').trim(),
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
  if (rowIndex < 2) throw new Error('rowIndex must be >= 2 (row 1 is the header).');
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
    (data.responsibleIndividuals || '').trim(),
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
  if (rowIndex < 2) throw new Error('rowIndex must be >= 2 (row 1 is the header).');
  const sheet = getOrCreateActionItemsSheet_();
  sheet.deleteRow(rowIndex);
}

// ─── Email Reminders ─────────────────────────────────────────────────────────

/**
 * Daily trigger function. Scans all non-Done action items and sends
 * consolidated reminder emails for tasks hitting a threshold today.
 * Run setupTodoReminderTrigger() once to register this as a daily 9 AM trigger.
 */
function sendTaskReminders() {
  const items = getTodoItems().filter(item => item.status !== 'Done');
  if (!items.length) return;

  const coordinators = getCoordinators();
  if (!coordinators.length) {
    Logger.log('sendTaskReminders: no coordinators configured, skipping.');
    return;
  }

  const recipientEmails = coordinators.map(c => c.email).filter(Boolean).join(', ');
  if (!recipientEmails) {
    Logger.log('sendTaskReminders: no valid coordinator emails, skipping.');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group tasks by threshold hit today
  const byThreshold = {};  // e.g. { 14: [...], 7: [...], 1: [...] }

  const sheet = getOrCreateActionItemsSheet_();
  const remindersSentColNum = ACTION_ITEM_HEADERS_.indexOf('Reminders Sent') + 1;

  items.forEach(item => {
    if (!item.dueDate) return;
    const due = new Date(item.dueDate);
    due.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((due - today) / (1000 * 60 * 60 * 24));

    const alreadySent = (item.remindersSent || '').toString().split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));

    ACTION_ITEM_CONFIG.REMINDER_THRESHOLDS.forEach(threshold => {
      if (daysUntil === threshold && !alreadySent.includes(threshold)) {
        if (!byThreshold[threshold]) byThreshold[threshold] = [];
        byThreshold[threshold].push({ item, daysUntil });
      }
    });
  });

  // Collect all tasks to remind — defer sheet writes until after email send
  const allReminders = [];
  const sheetUpdates = [];

  Object.keys(byThreshold).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).forEach(threshold => {
    byThreshold[threshold].forEach(({ item }) => {
      allReminders.push({ item, daysUntil: parseInt(threshold, 10) });
      const current = (item.remindersSent || '').toString().trim();
      sheetUpdates.push({
        rowIndex: item.rowIndex,
        updated: current ? current + ',' + threshold : String(threshold)
      });
    });
  });

  if (!allReminders.length) return;

  // Build consolidated email
  const taskRows = allReminders
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map(({ item, daysUntil }) => {
      const urgencyLabel = daysUntil === 1 ? '⚠️ Due Tomorrow' : `Due in ${daysUntil} days`;
      return `<tr>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtmlServer(item.title)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtmlServer(item.category)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtmlServer(item.dueDate)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtmlServer(item.responsibleIndividuals || '—')}</td>
        <td style="padding:8px;border:1px solid #ddd;font-weight:bold;">${urgencyLabel}</td>
      </tr>`;
    }).join('');

  const htmlBody = `
    <h2 style="color:#8e0000;">CATBUS: Upcoming Task Deadlines</h2>
    <p>The following tasks have deadlines approaching:</p>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;">
      <thead>
        <tr style="background:#f2f2f2;">
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Task</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Category</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Due Date</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Responsible</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Urgency</th>
        </tr>
      </thead>
      <tbody>${taskRows}</tbody>
    </table>
    <p style="color:#666;font-size:0.9em;">This is an automated reminder from CATBUS.</p>
  `;

  sendEmail({
    to: recipientEmails,
    subject: `[CATBUS] Task Reminders — ${allReminders.length} task(s) due soon`,
    htmlBody: htmlBody,
    name: 'CATBUS'
  }, 'sendTaskReminders');

  // Persist Reminders Sent only after successful send
  sheetUpdates.forEach(({ rowIndex, updated }) => {
    sheet.getRange(rowIndex, remindersSentColNum).setValue(updated);
  });

  Logger.log(`sendTaskReminders: sent reminder for ${allReminders.length} task(s) to ${recipientEmails}`);
}

/**
 * One-time setup: registers sendTaskReminders() as a daily 9 AM trigger.
 * Run this once from the Apps Script editor.
 */
function setupTodoReminderTrigger() {
  const existing = ScriptApp.getProjectTriggers().find(
    t => t.getHandlerFunction() === 'sendTaskReminders'
  );
  if (existing) {
    Logger.log('Todo reminder trigger already exists — skipping.');
    return;
  }
  ScriptApp.newTrigger('sendTaskReminders')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
  Logger.log('Daily todo reminder trigger created — will run at 9 AM each day.');
}
