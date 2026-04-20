/**
 * Volunteer onboarding checklist functions.
 * Provides role-based tasks and volunteer completion tracking.
 */

const VOLUNTEER_ONBOARDING_HEADERS_ = [
  'Email',
  'Volunteer Name',
  'Role',
  'Task Key',
  'Task Label',
  'Task Description',
  'Is Complete',
  'Completed At',
  'Updated At'
];

function getOrCreateVolunteerOnboardingSheet_() {
  const ss = getSpreadsheet();
  const sheetName = VOLUNTEER_ONBOARDING_CONFIG.SHEET_NAME || CONFIG.SHEETS.VOLUNTEER_ONBOARDING;
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(VOLUNTEER_ONBOARDING_HEADERS_);
    sheet.getRange(1, 1, 1, VOLUNTEER_ONBOARDING_HEADERS_.length).setFontWeight('bold');
  }
  return sheet;
}

function normalizeOnboardingRole_(role) {
  return (role || '').toString().trim().toLowerCase();
}

function parseOnboardingBool_(value) {
  if (value === true || value === false) return value;
  const text = (value || '').toString().trim().toLowerCase();
  return text === 'true' || text === 'yes' || text === '1';
}

function resolveVolunteerOnboardingIdentity_(volunteerName, volunteerRole) {
  const targetName = (volunteerName || '').toString().trim();
  if (!targetName) throw new Error('Volunteer name is required.');

  const volunteers = getConsolidatedVolunteerList_();
  const exact = volunteers.find(v => (v.name || '').toString().trim().toLowerCase() === targetName.toLowerCase());

  const role = exact && exact.role ? exact.role : (volunteerRole || '').toString().trim();
  const email = exact && exact.email ? normalizeEmail(exact.email) : '';
  const name = exact && exact.name ? exact.name : targetName;

  return {
    email: email,
    name: name,
    role: role,
    key: email || `name:${name.toLowerCase()}`
  };
}

function getOnboardingTasksForRole_(role) {
  const everyone = (VOLUNTEER_ONBOARDING_CONFIG.TASKS.EVERYONE || []).slice();
  const roleKey = normalizeOnboardingRole_(role);
  const efileRoles = VOLUNTEER_ONBOARDING_CONFIG.TASKS.EFILE_REQUIRED_ROLES || [];
  if (efileRoles.indexOf(roleKey) !== -1) {
    everyone.push(VOLUNTEER_ONBOARDING_CONFIG.TASKS.EFILE_TASK);
  }
  return everyone;
}

function ensureVolunteerOnboardingRows_(identity, tasks) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getOrCreateVolunteerOnboardingSheet_();
    const cols = CONFIG.COLUMNS.VOLUNTEER_ONBOARDING;
    const lastRow = sheet.getLastRow();
    const numCols = cols.UPDATED_AT + 1;

    const rows = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, numCols).getValues()
      : [];

    const existingTaskKeys = {};
    for (let i = 0; i < rows.length; i++) {
      const rowKey = normalizeEmail(rows[i][cols.EMAIL] || '') || (`name:${(rows[i][cols.VOLUNTEER_NAME] || '').toString().trim().toLowerCase()}`);
      if (rowKey !== identity.key) continue;
      const taskKey = (rows[i][cols.TASK_KEY] || '').toString().trim();
      if (taskKey) existingTaskKeys[taskKey] = true;
    }

    const now = new Date();
    const toAppend = [];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (existingTaskKeys[task.key]) continue;
      toAppend.push([
        identity.email,
        identity.name,
        identity.role,
        task.key,
        task.label,
        task.description,
        false,
        '',
        now
      ]);
    }

    if (toAppend.length) {
      sheet.getRange(lastRow + 1, 1, toAppend.length, numCols).setValues(toAppend);
    }
  } finally {
    lock.releaseLock();
  }
}

function getVolunteerOnboardingChecklist(volunteerName, volunteerRole) {
  return safeExecute(() => {
    const identity = resolveVolunteerOnboardingIdentity_(volunteerName, volunteerRole);
    const tasks = getOnboardingTasksForRole_(identity.role);

    if (!tasks.length) {
      return {
        volunteerName: identity.name,
        role: identity.role,
        tasks: [],
        completedCount: 0,
        totalCount: 0
      };
    }

    ensureVolunteerOnboardingRows_(identity, tasks);

    const sheet = getOrCreateVolunteerOnboardingSheet_();
    const cols = CONFIG.COLUMNS.VOLUNTEER_ONBOARDING;
    const lastRow = sheet.getLastRow();
    const numCols = cols.UPDATED_AT + 1;

    const rows = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, numCols).getValues()
      : [];

    const rowByTaskKey = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowKey = normalizeEmail(row[cols.EMAIL] || '') || (`name:${(row[cols.VOLUNTEER_NAME] || '').toString().trim().toLowerCase()}`);
      if (rowKey !== identity.key) continue;
      const taskKey = (row[cols.TASK_KEY] || '').toString().trim();
      if (!taskKey) continue;
      rowByTaskKey[taskKey] = {
        rowIndex: i + 2,
        row: row
      };
    }

    const resultTasks = tasks.map(task => {
      const entry = rowByTaskKey[task.key];
      const row = entry ? entry.row : null;
      const isComplete = row ? parseOnboardingBool_(row[cols.IS_COMPLETE]) : false;
      const completedAt = row && row[cols.COMPLETED_AT]
        ? Utilities.formatDate(new Date(row[cols.COMPLETED_AT]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
        : '';

      return {
        taskKey: task.key,
        label: task.label,
        description: task.description,
        isComplete: isComplete,
        completedAt: completedAt,
        rowIndex: entry ? entry.rowIndex : null
      };
    });

    const completedCount = resultTasks.filter(task => task.isComplete).length;

    return {
      volunteerName: identity.name,
      role: identity.role,
      tasks: resultTasks,
      completedCount: completedCount,
      totalCount: resultTasks.length
    };
  }, 'getVolunteerOnboardingChecklist');
}

function setVolunteerOnboardingTaskComplete(volunteerName, taskKey, isComplete, volunteerRole) {
  return safeExecute(() => {
    const normalizedTaskKey = (taskKey || '').toString().trim();
    if (!normalizedTaskKey) throw new Error('Task key is required.');

    const identity = resolveVolunteerOnboardingIdentity_(volunteerName, volunteerRole);
    const tasks = getOnboardingTasksForRole_(identity.role);
    const taskExists = tasks.some(task => task.key === normalizedTaskKey);
    if (!taskExists) {
      throw new Error('Task not available for this role.');
    }

    ensureVolunteerOnboardingRows_(identity, tasks);

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getOrCreateVolunteerOnboardingSheet_();
      const cols = CONFIG.COLUMNS.VOLUNTEER_ONBOARDING;
      const lastRow = sheet.getLastRow();
      const numCols = cols.UPDATED_AT + 1;
      const rows = lastRow > 1
        ? sheet.getRange(2, 1, lastRow - 1, numCols).getValues()
        : [];

      let targetRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowKey = normalizeEmail(row[cols.EMAIL] || '') || (`name:${(row[cols.VOLUNTEER_NAME] || '').toString().trim().toLowerCase()}`);
        if (rowKey !== identity.key) continue;
        const rowTaskKey = (row[cols.TASK_KEY] || '').toString().trim();
        if (rowTaskKey === normalizedTaskKey) {
          targetRowIndex = i + 2;
          break;
        }
      }

      if (targetRowIndex < 2) {
        throw new Error('Checklist task was not found.');
      }

      const now = new Date();
      const checked = !!isComplete;
      sheet.getRange(targetRowIndex, cols.IS_COMPLETE + 1).setValue(checked);
      sheet.getRange(targetRowIndex, cols.COMPLETED_AT + 1).setValue(checked ? now : '');
      sheet.getRange(targetRowIndex, cols.UPDATED_AT + 1).setValue(now);
    } finally {
      lock.releaseLock();
    }

    const checklist = getVolunteerOnboardingChecklist(identity.name, identity.role);
    return {
      success: true,
      taskKey: normalizedTaskKey,
      isComplete: !!isComplete,
      completedCount: checklist.completedCount,
      totalCount: checklist.totalCount
    };
  }, 'setVolunteerOnboardingTaskComplete');
}

function syncVolunteerOnboardingIdentity(oldEmail, newEmail, volunteerName, role) {
  const priorKey = normalizeEmail(oldEmail || '');
  const nextEmail = normalizeEmail(newEmail || '');
  if (!priorKey || !nextEmail || priorKey === nextEmail) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getOrCreateVolunteerOnboardingSheet_();
    const cols = CONFIG.COLUMNS.VOLUNTEER_ONBOARDING;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const numCols = cols.UPDATED_AT + 1;
    const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
    const now = new Date();

    for (let i = 0; i < data.length; i++) {
      const rowEmail = normalizeEmail(data[i][cols.EMAIL] || '');
      if (rowEmail !== priorKey) continue;
      const rowIndex = i + 2;
      sheet.getRange(rowIndex, cols.EMAIL + 1).setValue(nextEmail);
      if (volunteerName) sheet.getRange(rowIndex, cols.VOLUNTEER_NAME + 1).setValue(volunteerName);
      if (role) sheet.getRange(rowIndex, cols.ROLE + 1).setValue(role);
      sheet.getRange(rowIndex, cols.UPDATED_AT + 1).setValue(now);
    }
  } finally {
    lock.releaseLock();
  }
}
