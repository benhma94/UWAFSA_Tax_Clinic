/**
 * Volunteer Management Backend
 * Provides volunteer data and email sending for the Volunteer Management admin page.
 */

/**
 * Returns the full consolidated volunteer list for the management UI.
 * Called client-side via google.script.run.getVolunteerManagementData()
 *
 * @returns {Array<Object>} Array of {name, firstName, lastName, email, role,
 *                          efileNum, attendedTraining}, sorted alphabetically by name.
 */
function getVolunteerManagementData() {
  const volunteers = getConsolidatedVolunteerList_();
  volunteers.sort((a, b) => a.name.localeCompare(b.name));
  return volunteers;
}

/**
 * Returns volunteers on the Consolidated Volunteer List who have never appeared
 * in the Volunteer List (sign-in) or SignOut sheet — i.e., did zero clinic shifts.
 * Intended for post-clinic use when both sheets are expected to exist.
 *
 * @returns {Array<{name: string, email: string, role: string}>} Sorted alphabetically by name.
 */
function getNoShowVolunteers() {
  const ss = getSpreadsheet();
  const appearedNames = new Set();
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const signInSheet = ss.getSheetByName(CONFIG.SHEETS.VOLUNTEER_LIST);
  if (!signInSheet) throw new Error('Volunteer List sheet not found.');
  if (signInSheet.getLastRow() >= 2) {
    const data = signInSheet.getRange(2, 1, signInSheet.getLastRow() - 1,
                   CONFIG.COLUMNS.VOLUNTEER_LIST.NAME + 1).getValues();
    data.forEach(r => {
      const n = (r[CONFIG.COLUMNS.VOLUNTEER_LIST.NAME] || '').toString().trim().toLowerCase();
      if (n) appearedNames.add(n);
    });
  }

  const signOutSheet = ss.getSheetByName(CONFIG.SHEETS.SIGNOUT);
  if (!signOutSheet) throw new Error('SignOut sheet not found.');
  if (signOutSheet.getLastRow() >= 2) {
    const data = signOutSheet.getRange(2, 1, signOutSheet.getLastRow() - 1,
                   CONFIG.COLUMNS.SIGNOUT.VOLUNTEER_INFO + 1).getValues();
    data.forEach(r => {
      const info = (r[CONFIG.COLUMNS.SIGNOUT.VOLUNTEER_INFO] || '').toString().trim();
      if (info && !UUID_REGEX.test(info)) appearedNames.add(info.toLowerCase());
    });
  }

  // Read consolidated list directly to get both legal and preferred first names,
  // since a volunteer may have signed in under either variant.
  const cols = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST;
  const rosterSheet = ss.getSheetByName(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  if (!rosterSheet || rosterSheet.getLastRow() <= 1) return [];
  const numCols = cols.ATTENDED_TRAINING + 1;
  const rosterData = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, numCols).getValues();

  const noShows = [];
  rosterData.forEach(row => {
    const legal    = (row[cols.FIRST_NAME_LEGAL]  || '').toString().trim();
    const preferred = (row[cols.PREFERRED_NAME]   || '').toString().trim();
    const last     = (row[cols.LAST_NAME]         || '').toString().trim();
    const email    = (row[cols.EMAIL]             || '').toString().trim().toLowerCase();
    const role     = (row[cols.ROLE]              || '').toString().trim();

    if (!email) return;
    if (role.toLowerCase() === 'drop') return; // Dropped volunteers are expected absences, not no-shows

    // Build all plausible name variants this volunteer might have used at sign-in
    const firstName = preferred || legal;
    const displayName = `${firstName} ${last}`.trim();
    if (!displayName) return;

    const variants = new Set([displayName.toLowerCase()]);
    if (preferred && legal && preferred !== legal) {
      variants.add(`${legal} ${last}`.trim().toLowerCase());   // legal first name variant
      variants.add(`${preferred} ${last}`.trim().toLowerCase()); // preferred first name variant (already in via displayName, but explicit)
    }

    const appeared = [...variants].some(v => appearedNames.has(v));
    if (!appeared) {
      noShows.push({ name: displayName, email, role });
    }
  });

  return noShows.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Updates the role of a volunteer in the Consolidated Volunteer List, matched by email.
 *
 * @param {string} email   - Volunteer email (matched case-insensitively)
 * @param {string} newRole - New role value (e.g. 'Drop')
 * @returns {{ success: true }}
 */
function updateVolunteerRole(email, newRole) {
  if (!email || !email.trim()) throw new Error('Email is required.');
  if (!newRole || !newRole.trim()) throw new Error('New role is required.');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  if (!sheet) throw new Error('Consolidated Volunteer List sheet not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Volunteer not found: ' + email);

  const emailColSheet = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST.EMAIL + 1; // 1-based
  const roleColSheet  = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST.ROLE + 1;  // 1-based
  const emailData = sheet.getRange(2, emailColSheet, lastRow - 1, 1).getValues();
  const emailKey = email.trim().toLowerCase();

  for (let i = 0; i < emailData.length; i++) {
    if ((emailData[i][0] || '').toString().trim().toLowerCase() === emailKey) {
      sheet.getRange(i + 2, roleColSheet).setValue(newRole.trim());
      return { success: true };
    }
  }
  throw new Error('Volunteer not found: ' + email);
}

/**
 * Updates a volunteer's profile in the Consolidated Volunteer List and all matching
 * Schedule Availability rows for the same volunteer name.
 *
 * @param {string} name      - Existing volunteer display name (case-insensitive)
 * @param {string} firstName - New first name
 * @param {string} lastName  - New last name
 * @param {string} newEmail  - New email address
 * @returns {{ success: true, email: string, updatedAvailabilityRows: number, message: string }}
 */
function updateVolunteerProfile(name, firstName, lastName, newEmail) {
  const displayName = (name || '').toString().trim();
  const newFirstName = (firstName || '').toString().trim();
  const newLastName = (lastName || '').toString().trim();
  const normalizedEmail = normalizeEmail(newEmail);

  if (!displayName) throw new Error('Volunteer name is required.');
  if (!newFirstName || !newLastName) throw new Error('Both first and last name are required.');
  if (!normalizedEmail) throw new Error('A valid email is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  const ss = getSpreadsheet();
  const rosterSheet = ss.getSheetByName(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  if (!rosterSheet || rosterSheet.getLastRow() <= 1) throw new Error('Consolidated Volunteer List sheet not found.');

  const cols = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST;
  const numCols = cols.ATTENDED_TRAINING + 1;
  const rosterData = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, numCols).getValues();

  let rosterMatchRow = null;
  let rosterFirstName = '';
  let rosterLastName = '';

  const targetLower = displayName.toLowerCase();
  for (let i = 0; i < rosterData.length; i++) {
    const row = rosterData[i];
    const legal = (row[cols.FIRST_NAME_LEGAL] || '').toString().trim();
    const preferred = (row[cols.PREFERRED_NAME] || '').toString().trim();
    const last = (row[cols.LAST_NAME] || '').toString().trim();
    const existingFirstName = preferred || legal;
    const existingDisplay = `${existingFirstName} ${last}`.trim();
    if (existingDisplay.toLowerCase() === targetLower) {
      rosterMatchRow = i + 2;
      rosterFirstName = existingFirstName;
      rosterLastName = last;
      break;
    }
  }

  if (!rosterMatchRow) {
    throw new Error('Volunteer not found in Consolidated Volunteer List.');
  }

  const rosterRowData = rosterData[rosterMatchRow - 2];
  const previousEmail = normalizeEmail(rosterRowData[cols.EMAIL] || '');
  const volunteerRole = (rosterRowData[cols.ROLE] || '').toString().trim();

  const newDisplayName = `${newFirstName} ${newLastName}`.trim().toLowerCase();
  for (let i = 0; i < rosterData.length; i++) {
    const row = rosterData[i];
    const legal = (row[cols.FIRST_NAME_LEGAL] || '').toString().trim();
    const preferred = (row[cols.PREFERRED_NAME] || '').toString().trim();
    const last = (row[cols.LAST_NAME] || '').toString().trim();
    const existingFirstName = preferred || legal;
    const existingDisplay = `${existingFirstName} ${last}`.trim().toLowerCase();
    if (existingDisplay === newDisplayName && i + 2 !== rosterMatchRow) {
      throw new Error('That name is already in use by another volunteer.');
    }
  }

  // Prevent email duplication across roster rows.
  for (let i = 0; i < rosterData.length; i++) {
    const rowEmail = normalizeEmail(rosterData[i][cols.EMAIL] || '');
    if (rowEmail && rowEmail === normalizedEmail && i + 2 !== rosterMatchRow) {
      throw new Error('That email is already assigned to another volunteer.');
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    rosterSheet.getRange(rosterMatchRow, cols.PREFERRED_NAME + 1).setValue(newFirstName);
    rosterSheet.getRange(rosterMatchRow, cols.LAST_NAME + 1).setValue(newLastName);
    rosterSheet.getRange(rosterMatchRow, cols.EMAIL + 1).setValue(normalizedEmail);

    const availabilitySheet = getOrCreateAvailabilitySheet();
    const lastRow = availabilitySheet.getLastRow();
    let updatedRows = 0;

    if (lastRow > 1) {
      const availabilityData = availabilitySheet.getRange(2, 1, lastRow - 1, 10).getValues();
      for (let i = 0; i < availabilityData.length; i++) {
        const row = availabilityData[i];
        const currentFirst = (row[1] || '').toString().trim().toLowerCase();
        const currentLast = (row[2] || '').toString().trim().toLowerCase();
        if (currentFirst === rosterFirstName.toLowerCase() && currentLast === rosterLastName.toLowerCase()) {
          availabilitySheet.getRange(i + 2, 2).setValue(newFirstName);
          availabilitySheet.getRange(i + 2, 3).setValue(newLastName);
          availabilitySheet.getRange(i + 2, 4).setValue(normalizedEmail);
          updatedRows++;
        }
      }
    }

    try {
      syncVolunteerOnboardingIdentity(previousEmail, normalizedEmail, `${newFirstName} ${newLastName}`.trim(), volunteerRole);
    } catch (syncErr) {
      Logger.log('syncVolunteerOnboardingIdentity error: ' + syncErr.message);
    }

    const message = `Profile updated for ${newFirstName} ${newLastName}. ${updatedRows} availability row${updatedRows === 1 ? '' : 's'} updated.`;
    return { success: true, email: normalizedEmail, updatedAvailabilityRows: updatedRows, message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Updates the role of multiple volunteers in the Consolidated Volunteer List in one call.
 * Much faster than calling updateVolunteerRole() once per volunteer.
 *
 * @param {string[]} emails  - Volunteer emails to update (matched case-insensitively)
 * @param {string}   newRole - New role value (e.g. 'Drop')
 * @returns {{ success: true, updated: number, notFound: string[] }}
 */
function updateVolunteerRolesBatch(emails, newRole) {
  if (!emails || !emails.length) throw new Error('No emails provided.');
  if (!newRole || !newRole.trim()) throw new Error('New role is required.');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  if (!sheet) throw new Error('Consolidated Volunteer List sheet not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, updated: 0, notFound: emails };

  const emailColSheet = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST.EMAIL + 1;
  const roleColSheet  = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST.ROLE + 1;
  const emailData = sheet.getRange(2, emailColSheet, lastRow - 1, 1).getValues();

  const targets = new Set(emails.map(e => e.trim().toLowerCase()));
  const notFound = new Set(targets);
  let updated = 0;

  for (let i = 0; i < emailData.length; i++) {
    const rowEmail = (emailData[i][0] || '').toString().trim().toLowerCase();
    if (targets.has(rowEmail)) {
      sheet.getRange(i + 2, roleColSheet).setValue(newRole.trim());
      notFound.delete(rowEmail);
      updated++;
    }
  }

  return { success: true, updated: updated, notFound: [...notFound] };
}

/**
 * Returns all accepted applicants from the three application sheets, flagging any
 * who are already on the Consolidated Volunteer List.
 *
 * @returns {Array<Object>} Each entry: {role, email, firstName, preferredName, lastName, alreadyOnList}
 */
function getAcceptedApplications() {
  // Build a set of emails already on the Consolidated Volunteer List
  const existing = getConsolidatedVolunteerList_();
  const existingEmails = {};
  for (var i = 0; i < existing.length; i++) {
    existingEmails[existing[i].email.toLowerCase()] = true;
  }

  const results = [];
  const SOURCES = getAllApplicationSourceConfigs_();

  var ss = getSpreadsheet();
  for (var s = 0; s < SOURCES.length; s++) {
    var src = SOURCES[s];
    var sheet = ss.getSheetByName(src.sheetName);
    if (!sheet) continue;

    ensureApplicationLifecycleColumns_(sheet, src.dataColCount);

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) continue;

    var lifecycle = getApplicationLifecycleColumns_(src.dataColCount);
    var lastCol = Math.max(sheet.getLastColumn(), src.dataColCount + APPLICATION_LIFECYCLE_HEADERS.length);
    var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var decisionCol = lifecycle.decisionIdx; // 0-based index

    for (var r = 0; r < data.length; r++) {
      var row = data[r];
      if (!row[0] && !row[src.firstCol]) continue;

      var decision = (row[decisionCol] || '').toString().trim();
      if (decision !== 'Accept') continue;

      var email = (row[src.emailCol] || '').toString().trim();
      results.push({
        rowIndex:     r + 2,
        role:         src.roleLabel,
        email:        email,
        firstName:    (row[src.firstCol] || '').toString().trim(),
        preferredName:(row[src.prefCol]  || '').toString().trim(),
        lastName:     (row[src.lastCol]  || '').toString().trim(),
        decisionEmailSentAt: formatApplicationDateTime_(row[lifecycle.decisionEmailSentAtIdx]),
        transferredAt: formatApplicationDateTime_(row[lifecycle.transferredAtIdx]),
        alreadyOnList: !!existingEmails[email.toLowerCase()]
      });
    }
  }

  // Sort: new entries first, then already-on-list
  results.sort(function(a, b) {
    return (a.alreadyOnList ? 1 : 0) - (b.alreadyOnList ? 1 : 0) || a.lastName.localeCompare(b.lastName);
  });

  return results;
}

/**
 * Returns the integrated volunteer application queue for the management UI.
 *
 * @returns {{byRole: Object, all: Object[], summary: Object}}
 */
function getVolunteerApplicationWorkflowData() {
  var roleOrder = ['mentor', 'frontline', 'filer'];
  var byRole = {};
  var all = [];
  var summary = {
    total: 0,
    pendingReview: 0,
    acceptedAwaitingEmail: 0,
    rejectedAwaitingEmail: 0,
    acceptedEmailed: 0,
    rejectedEmailed: 0,
    transferred: 0
  };

  for (var i = 0; i < roleOrder.length; i++) {
    var role = roleOrder[i];
    var apps = getVolunteerApplications(role) || [];
    byRole[role] = [];

    for (var j = 0; j < apps.length; j++) {
      var app = apps[j];
      var displayFirst = app.preferredName || app.firstName || '';
      var displayName = (displayFirst + ' ' + (app.lastName || '')).trim();
      var stage = getVolunteerApplicationStage_(app);
      var enriched = Object.assign({}, app, {
        role: role,
        roleLabel: app.roleLabel || role.charAt(0).toUpperCase() + role.slice(1),
        displayName: displayName,
        workflowStage: stage,
        workflowKey: role + ':' + app.rowIndex
      });

      byRole[role].push(enriched);
      all.push(enriched);
      summary.total++;
      if (stage === 'pending-review') summary.pendingReview++;
      else if (stage === 'accepted-awaiting-email') summary.acceptedAwaitingEmail++;
      else if (stage === 'rejected-awaiting-email') summary.rejectedAwaitingEmail++;
      else if (stage === 'accepted-emailed') summary.acceptedEmailed++;
      else if (stage === 'rejected-emailed') summary.rejectedEmailed++;
      else if (stage === 'transferred') summary.transferred++;
    }
  }

  return { byRole: byRole, all: all, summary: summary };
}

/**
 * Sends acceptance or rejection emails in batch for selected application rows.
 *
 * @param {{decision: string, items: Array<{role: string, rowIndex: number}>}} request
 * @returns {{success: boolean, sent: number, skippedAlreadySent: number, skippedDecisionMismatch: number, skippedMissingData: number, errors: string[]}}
 */
function sendVolunteerApplicationDecisionEmails(request) {
  var payload = request || {};
  var decision = (payload.decision || '').toString().trim();
  if (decision !== 'Accept' && decision !== 'Reject') {
    throw new Error('Decision must be Accept or Reject.');
  }

  var items = normalizeWorkflowItems_(payload.items);
  if (!items.length) {
    throw new Error('No applications selected.');
  }

  var messageConfig = VOLUNTEER_APPLICATION_WORKFLOW_CONFIG.DECISION_EMAIL;
  var subject = decision === 'Accept' ? messageConfig.ACCEPT_SUBJECT : messageConfig.REJECT_SUBJECT;
  var template = decision === 'Accept' ? messageConfig.ACCEPT_BODY : messageConfig.REJECT_BODY;

  var ss = getSpreadsheet();
  var sent = 0;
  var skippedAlreadySent = 0;
  var skippedDecisionMismatch = 0;
  var skippedMissingData = 0;
  var errors = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var src = getApplicationSourceConfig_(item.role);
    if (!src) {
      skippedMissingData++;
      continue;
    }

    var sheet = ss.getSheetByName(src.sheetName);
    if (!sheet) {
      skippedMissingData++;
      continue;
    }

    ensureApplicationLifecycleColumns_(sheet, src.dataColCount);
    var lifecycle = getApplicationLifecycleColumns_(src.dataColCount);
    if (item.rowIndex < 2 || item.rowIndex > sheet.getLastRow()) {
      skippedMissingData++;
      continue;
    }

    var lastCol = Math.max(sheet.getLastColumn(), src.dataColCount + APPLICATION_LIFECYCLE_HEADERS.length);
    var row = sheet.getRange(item.rowIndex, 1, 1, lastCol).getValues()[0];
    var rowDecision = (row[lifecycle.decisionIdx] || '').toString().trim();
    if (rowDecision !== decision) {
      skippedDecisionMismatch++;
      continue;
    }

    var alreadySent = (row[lifecycle.decisionEmailSentAtIdx] || '').toString().trim();
    if (alreadySent) {
      skippedAlreadySent++;
      continue;
    }

    var email = (row[src.emailCol] || '').toString().trim();
    if (!email) {
      skippedMissingData++;
      continue;
    }

    var preferredName = (row[src.prefCol] || '').toString().trim();
    var legalName = (row[src.firstCol] || '').toString().trim();
    var firstName = preferredName || legalName || 'Volunteer';
    var body = buildApplicationWorkflowTextTemplate_(template, {
      firstName: firstName,
      role: src.roleLabel,
      clinicEmail: CONFIG.CLINIC_EMAIL
    });

    try {
      sendEmail({
        to: email,
        subject: subject,
        body: body,
        name: 'AFSA Tax Clinic',
        replyTo: CONFIG.CLINIC_EMAIL
      }, 'VolunteerApplicationDecisionEmail');
      sheet.getRange(item.rowIndex, lifecycle.decisionEmailSentAtCol).setValue(new Date());
      sent++;
    } catch (err) {
      errors.push(item.role + ' row ' + item.rowIndex + ': ' + err.message);
    }
  }

  return {
    success: errors.length === 0,
    sent: sent,
    skippedAlreadySent: skippedAlreadySent,
    skippedDecisionMismatch: skippedDecisionMismatch,
    skippedMissingData: skippedMissingData,
    errors: errors
  };
}

/**
 * Transfers accepted applications to the consolidated roster and sends onboarding steps.
 * Marks Transferred At only after instruction email succeeds.
 *
 * @param {{items: Array<{role: string, rowIndex: number}>}} request
 * @returns {{success: boolean, added: number, alreadyOnList: number, instructionEmailsSent: number, skippedAlreadyTransferred: number, skippedDecisionMismatch: number, skippedMissingData: number, errors: string[]}}
 */
function transferAcceptedApplicationsAndSendInstructions(request) {
  var payload = request || {};
  var items = normalizeWorkflowItems_(payload.items);
  if (!items.length) {
    throw new Error('No applications selected.');
  }

  var ss = getSpreadsheet();
  var rosterSheet = ss.getSheetByName(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  if (!rosterSheet) throw new Error('Consolidated Volunteer List sheet not found.');

  var cols = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST;
  var existingEmails = {};
  var rosterLastRow = rosterSheet.getLastRow();
  if (rosterLastRow >= 2) {
    var emailCol = cols.EMAIL + 1;
    var emailData = rosterSheet.getRange(2, emailCol, rosterLastRow - 1, 1).getValues();
    for (var e = 0; e < emailData.length; e++) {
      var rosterEmail = (emailData[e][0] || '').toString().trim().toLowerCase();
      if (rosterEmail) existingEmails[rosterEmail] = true;
    }
  }

  var template = VOLUNTEER_APPLICATION_WORKFLOW_CONFIG.HANDOFF_EMAIL.BODY;
  var subject = VOLUNTEER_APPLICATION_WORKFLOW_CONFIG.HANDOFF_EMAIL.SUBJECT;

  var added = 0;
  var alreadyOnList = 0;
  var instructionEmailsSent = 0;
  var skippedAlreadyTransferred = 0;
  var skippedDecisionMismatch = 0;
  var skippedMissingData = 0;
  var errors = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var src = getApplicationSourceConfig_(item.role);
    if (!src) {
      skippedMissingData++;
      continue;
    }

    var sheet = ss.getSheetByName(src.sheetName);
    if (!sheet) {
      skippedMissingData++;
      continue;
    }

    ensureApplicationLifecycleColumns_(sheet, src.dataColCount);
    var lifecycle = getApplicationLifecycleColumns_(src.dataColCount);
    if (item.rowIndex < 2 || item.rowIndex > sheet.getLastRow()) {
      skippedMissingData++;
      continue;
    }

    var lastCol = Math.max(sheet.getLastColumn(), src.dataColCount + APPLICATION_LIFECYCLE_HEADERS.length);
    var row = sheet.getRange(item.rowIndex, 1, 1, lastCol).getValues()[0];
    var decision = (row[lifecycle.decisionIdx] || '').toString().trim();
    if (decision !== 'Accept') {
      skippedDecisionMismatch++;
      continue;
    }

    var transferredAt = (row[lifecycle.transferredAtIdx] || '').toString().trim();
    if (transferredAt) {
      skippedAlreadyTransferred++;
      continue;
    }

    var email = (row[src.emailCol] || '').toString().trim();
    if (!email) {
      skippedMissingData++;
      continue;
    }

    var firstName = (row[src.firstCol] || '').toString().trim();
    var preferredName = (row[src.prefCol] || '').toString().trim();
    var lastName = (row[src.lastCol] || '').toString().trim();
    var emailKey = email.toLowerCase();

    if (!existingEmails[emailKey]) {
      var newRow = ['', '', '', '', '', '', '', ''];
      newRow[cols.ROLE] = src.roleLabel;
      newRow[cols.EMAIL] = email;
      newRow[cols.FIRST_NAME_LEGAL] = firstName;
      newRow[cols.PREFERRED_NAME] = preferredName;
      newRow[cols.LAST_NAME] = lastName;
      rosterSheet.appendRow(newRow);
      existingEmails[emailKey] = true;
      added++;
    } else {
      alreadyOnList++;
    }

    var displayFirst = preferredName || firstName || 'Volunteer';
    var body = buildApplicationWorkflowTextTemplate_(template, {
      firstName: displayFirst,
      role: src.roleLabel,
      clinicEmail: CONFIG.CLINIC_EMAIL
    });

    try {
      sendEmail({
        to: email,
        subject: subject,
        body: body,
        name: 'AFSA Tax Clinic',
        replyTo: CONFIG.CLINIC_EMAIL
      }, 'VolunteerApplicationHandoffEmail');
      sheet.getRange(item.rowIndex, lifecycle.transferredAtCol).setValue(new Date());
      instructionEmailsSent++;
    } catch (err) {
      errors.push(item.role + ' row ' + item.rowIndex + ': ' + err.message);
    }
  }

  return {
    success: errors.length === 0,
    added: added,
    alreadyOnList: alreadyOnList,
    instructionEmailsSent: instructionEmailsSent,
    skippedAlreadyTransferred: skippedAlreadyTransferred,
    skippedDecisionMismatch: skippedDecisionMismatch,
    skippedMissingData: skippedMissingData,
    errors: errors
  };
}

function getVolunteerApplicationStage_(app) {
  var status = (app.status || '').toString().trim();
  var emailed = !!(app.decisionEmailSentAt || '').toString().trim();
  var transferred = !!(app.transferredAt || '').toString().trim();

  if (!status) return 'pending-review';
  if (status === 'Reject') return emailed ? 'rejected-emailed' : 'rejected-awaiting-email';
  if (status === 'Accept') {
    if (transferred) return 'transferred';
    return emailed ? 'accepted-emailed' : 'accepted-awaiting-email';
  }
  return 'pending-review';
}

function normalizeWorkflowItems_(items) {
  if (!Array.isArray(items)) return [];
  var seen = {};
  var out = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i] || {};
    var role = (item.role || '').toString().trim().toLowerCase();
    var rowIndex = parseInt(item.rowIndex, 10);
    if (!role || !rowIndex || rowIndex < 2) continue;
    var key = role + ':' + rowIndex;
    if (seen[key]) continue;
    seen[key] = true;
    out.push({ role: role, rowIndex: rowIndex });
  }

  return out;
}

function buildApplicationWorkflowTextTemplate_(template, values) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, function(match, key) {
    return values && values.hasOwnProperty(key) ? String(values[key]) : '';
  });
}

/**
 * Transfers a list of accepted applicants to the Consolidated Volunteer List.
 * Skips any entry whose email already exists in the list.
 *
 * @param {Array<Object>} volunteers - Array of {role, email, firstName, preferredName, lastName}
 * @returns {{ success: boolean, added: number, skipped: number }}
 */
function transferToConsolidatedList(volunteers) {
  if (!volunteers || volunteers.length === 0) {
    return { success: true, added: 0, skipped: 0 };
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  if (!sheet) {
    throw new Error('Consolidated Volunteer List sheet not found.');
  }

  // Build current email set from the sheet
  var existingEmails = {};
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var emailCol = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST.EMAIL + 1; // 1-based
    var emails = sheet.getRange(2, emailCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < emails.length; i++) {
      var e = (emails[i][0] || '').toString().trim().toLowerCase();
      if (e) existingEmails[e] = true;
    }
  }

  var added = 0, skipped = 0;
  var cols = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST;

  for (var v = 0; v < volunteers.length; v++) {
    var vol = volunteers[v];
    var emailKey = (vol.email || '').trim().toLowerCase();
    if (!emailKey || existingEmails[emailKey]) {
      skipped++;
      continue;
    }

    // Build row matching column order (8 cols: ROLE, EMAIL, FIRST_NAME_LEGAL, PREFERRED_NAME, LAST_NAME, EFILE_NUM, PASSWORD, ATTENDED_TRAINING)
    var newRow = ['', '', '', '', '', '', '', ''];
    newRow[cols.ROLE]            = vol.role || '';
    newRow[cols.EMAIL]           = vol.email || '';
    newRow[cols.FIRST_NAME_LEGAL]= vol.firstName || '';
    newRow[cols.PREFERRED_NAME]  = vol.preferredName || '';
    newRow[cols.LAST_NAME]       = vol.lastName || '';

    sheet.appendRow(newRow);
    existingEmails[emailKey] = true;
    added++;
  }

  Logger.log('transferToConsolidatedList: added=' + added + ', skipped=' + skipped);
  return { success: true, added: added, skipped: skipped };
}

/**
 * Returns all rows from the Volunteer Alumni sheet for the management UI.
 * Discovers dynamic year columns by scanning the header row.
 *
 * @returns {Array<Object>} Array of alumni objects sorted by last name then first name.
 *   Each object: { email, firstNameLegal, preferredName, lastName,
 *                  totalReturns, totalHours, blacklisted, blacklistReason, lastUpdated,
 *                  years: { "2024": { returns, hours }, ... } }
 */
function getAlumniData() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.VOLUNTEER_ALUMNI);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const cols = CONFIG.COLUMNS.VOLUNTEER_ALUMNI;
  const lastCol  = sheet.getLastColumn();
  const lastRow  = sheet.getLastRow();

  // Read header row to discover year columns
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const yearCols = {}; // { "2024": { returnsCol: 0-based, hoursCol: 0-based }, ... }
  for (let i = cols.LAST_UPDATED + 1; i < headerRow.length; i++) {
    const h = (headerRow[i] || '').toString().trim();
    const match = h.match(/^(\d{4})_(RETURNS|HOURS)$/);
    if (match) {
      const yr = match[1];
      if (!yearCols[yr]) yearCols[yr] = {};
      if (match[2] === 'RETURNS') yearCols[yr].returnsCol = i;
      else                        yearCols[yr].hoursCol   = i;
    }
  }

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const result = data.map(row => {
    const years = {};
    for (const yr of Object.keys(yearCols)) {
      const yc = yearCols[yr];
      const returns = Number(row[yc.returnsCol]) || 0;
      const hours   = Number(row[yc.hoursCol])   || 0;
      if (returns > 0 || hours > 0 || typeof row[yc.returnsCol] === 'number') {
        years[yr] = { returns, hours };
      }
    }
    return {
      email:           (row[cols.EMAIL]            || '').toString().trim(),
      firstNameLegal:  (row[cols.FIRST_NAME_LEGAL] || '').toString().trim(),
      preferredName:   (row[cols.PREFERRED_NAME]   || '').toString().trim(),
      lastName:        (row[cols.LAST_NAME]        || '').toString().trim(),
      totalReturns:    Number(row[cols.TOTAL_RETURNS]) || 0,
      totalHours:      Number(row[cols.TOTAL_HOURS])   || 0,
      blacklisted:     row[cols.BLACKLISTED] === true,
      blacklistReason: (row[cols.BLACKLIST_REASON] || '').toString().trim(),
      lastUpdated:     row[cols.LAST_UPDATED] instanceof Date
                         ? row[cols.LAST_UPDATED].toISOString()
                         : (row[cols.LAST_UPDATED] || '').toString(),
      years
    };
  }).filter(v => v.email);

  result.sort((a, b) => {
    const lastCmp = a.lastName.localeCompare(b.lastName);
    if (lastCmp !== 0) return lastCmp;
    const aFirst = a.preferredName || a.firstNameLegal;
    const bFirst = b.preferredName || b.firstNameLegal;
    return aFirst.localeCompare(bFirst);
  });

  return result;
}

/**
 * Sets or clears the blacklist flag for a volunteer in the Volunteer Alumni sheet.
 *
 * @param {string}  email       - Volunteer email (matched case-insensitively)
 * @param {boolean} blacklisted - true to blacklist, false to clear
 * @param {string}  reason      - Required when blacklisted=true; pass '' when clearing
 * @returns {{ success: true }}
 */
function setVolunteerBlacklist(email, blacklisted, reason) {
  if (!email || !email.trim()) throw new Error('Email is required.');
  if (blacklisted && (!reason || !reason.trim())) {
    throw new Error('A reason is required when blacklisting a volunteer.');
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.VOLUNTEER_ALUMNI);
  if (!sheet) throw new Error('Volunteer Alumni sheet not found. Run "Archive Volunteer Stats" first.');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Volunteer not found: ' + email);

  const cols = CONFIG.COLUMNS.VOLUNTEER_ALUMNI;
  const emailColSheet = cols.EMAIL + 1; // 1-based
  const emailData = sheet.getRange(2, emailColSheet, lastRow - 1, 1).getValues();
  const emailKey = email.trim().toLowerCase();

  for (let i = 0; i < emailData.length; i++) {
    if ((emailData[i][0] || '').toString().trim().toLowerCase() === emailKey) {
      const rowIdx = i + 2; // 1-based
      sheet.getRange(rowIdx, cols.BLACKLISTED + 1, 1, 2)
           .setValues([[blacklisted === true, blacklisted ? (reason || '').trim() : '']]);
      return { success: true };
    }
  }
  throw new Error('Volunteer not found in Alumni sheet: ' + email);
}

/**
 * Sends a BCC email to the given list of email addresses from the clinic account.
 * Called client-side via google.script.run.sendVolunteerBccEmail(...)
 *
 * @param {string[]} emails - Recipient email addresses (sent as BCC)
 * @param {string} subject  - Email subject line
 * @param {string} body     - Plain-text email body
 * @returns {Object} { success: true }
 */
function sendVolunteerBccEmail(emails, subject, body) {
  if (!emails || emails.length === 0) throw new Error('No recipients selected.');
  if (!subject || !subject.trim()) throw new Error('Subject is required.');
  if (!body || !body.trim()) throw new Error('Body is required.');

  // Send from clinic account. "to" is the clinic address so the BCC list isn't exposed.
  sendEmail({
    to: CONFIG.CLINIC_EMAIL,
    subject: subject.trim(),
    body: body.trim(),
    bcc: emails.join(','),
    name: 'AFSA Tax Clinic',
    replyTo: CONFIG.CLINIC_EMAIL
  }, 'VolunteerMassBccEmail');

  return { success: true };
}

/**
 * Scans SignOut and Tax Return Tracker for volunteer name strings that cannot be
 * matched to any entry in the Consolidated Volunteer List. Returns a sorted array
 * of unmatched name records with activity context, so admins can identify and fix
 * typos before running archiveVolunteerStats().
 *
 * Read-only — makes no changes to any sheet.
 *
 * @returns {Array<{name: string, sources: string[], signOutCount: number, totalHours: number, returnsCount: number}>}
 */
function getUnmatchedVolunteerNames() {
  const ss = getSpreadsheet();

  // ── A. Build name→volunteer map (same logic as archiveVolunteerStats) ─────
  const rosterSheet = ss.getSheetByName(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  if (!rosterSheet || rosterSheet.getLastRow() <= 1) {
    throw new Error('Consolidated Volunteer List is empty or missing.');
  }
  const rosterCols    = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST;
  const numRosterCols = rosterCols.ATTENDED_TRAINING + 1;
  const rosterData    = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, numRosterCols).getValues();

  const nameToVolunteer = {};
  for (const row of rosterData) {
    const email     = (row[rosterCols.EMAIL]           || '').toString().trim().toLowerCase();
    if (!email) continue;
    const legal     = (row[rosterCols.FIRST_NAME_LEGAL] || '').toString().trim();
    const preferred = (row[rosterCols.PREFERRED_NAME]   || '').toString().trim();
    const last      = (row[rosterCols.LAST_NAME]        || '').toString().trim();

    const variants = new Set();
    if (preferred && last) variants.add(`${preferred} ${last}`.toLowerCase());
    if (legal && last)     variants.add(`${legal} ${last}`.toLowerCase());
    for (const v of variants) nameToVolunteer[v] = email;
  }

  // Map: original name string → { sources: Set, signOutCount, minutesTotal, returnsCount }
  const unmatched = {};
  function getOrCreate(name) {
    if (!unmatched[name]) {
      unmatched[name] = { sources: new Set(), signOutCount: 0, minutesTotal: 0, returnsCount: 0 };
    }
    return unmatched[name];
  }

  // ── B. Scan SignOut sheet ─────────────────────────────────────────────────
  // Uses getDisplayValues() — DURATION is a formula cell, must read as formatted string
  const signoutSheet = ss.getSheetByName(CONFIG.SHEETS.SIGNOUT);
  if (signoutSheet && signoutSheet.getLastRow() > 1) {
    const soCols  = CONFIG.COLUMNS.SIGNOUT;
    const numCols = soCols.DURATION + 1;
    const soData  = signoutSheet.getRange(2, 1, signoutSheet.getLastRow() - 1, numCols).getDisplayValues();
    for (const row of soData) {
      const name = (row[soCols.VOLUNTEER_INFO] || '').toString().trim();
      if (!name || nameToVolunteer[name.toLowerCase()]) continue;
      const entry = getOrCreate(name);
      entry.sources.add('SignOut');
      entry.signOutCount++;
      const parts = (row[soCols.DURATION] || '').trim().split(':');
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const s = parts.length >= 3 ? (parseInt(parts[2], 10) || 0) : 0;
        entry.minutesTotal += h * 60 + m + s / 60;
      }
    }
  }

  // ── C. Scan Tax Return Tracker ────────────────────────────────────────────
  // Only counts rows where efile or paper = "yes" (same guard as archiveVolunteerStats)
  const trackerSheet = ss.getSheetByName(CONFIG.SHEETS.TAX_RETURN_TRACKER);
  if (trackerSheet && trackerSheet.getLastRow() > 1) {
    const tc      = CONFIG.COLUMNS.TAX_RETURN_TRACKER;
    const numCols = tc.PAPER + 1;
    const trackerData = trackerSheet.getRange(2, 1, trackerSheet.getLastRow() - 1, numCols).getValues();
    for (const row of trackerData) {
      const volunteerName = (row[tc.VOLUNTEER] || '').toString().trim();
      const efile   = (row[tc.EFILE]   || '').toString().toLowerCase() === 'yes';
      const paper   = (row[tc.PAPER]   || '').toString().toLowerCase() === 'yes';
      const married = (row[tc.MARRIED] || '').toString().toLowerCase() === 'yes';
      if (!volunteerName || (!efile && !paper)) continue;
      if (nameToVolunteer[volunteerName.toLowerCase()]) continue;
      const entry = getOrCreate(volunteerName);
      entry.sources.add('Tax Return Tracker');
      entry.returnsCount += married ? 2 : 1;
    }
  }

  // ── D. Shape and return ───────────────────────────────────────────────────
  return Object.keys(unmatched)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(name => {
      const e = unmatched[name];
      return {
        name,
        sources:      Array.from(e.sources).sort(),
        signOutCount: e.signOutCount,
        totalHours:   Math.round(e.minutesTotal / 60 * 100) / 100,
        returnsCount: e.returnsCount
      };
    });
}

/**
 * Returns whether a volunteer already has an EFILE# and/or password on file.
 * Never returns the actual credential values — booleans only.
 *
 * @param {string} name  Display name (case-insensitive match).
 * @returns {{ hasEfileNum: boolean, hasPassword: boolean }}
 */
function getVolunteerCredentialStatus(name) {
  const nameLower = (name || '').trim().toLowerCase();
  if (!nameLower) throw new Error('Name is required.');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  if (!sheet || sheet.getLastRow() <= 1) throw new Error('Volunteer list not found.');

  const cols = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST;
  const numCols = cols.PASSWORD + 1;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, numCols).getValues();

  for (const row of data) {
    const legal     = (row[cols.FIRST_NAME_LEGAL] || '').toString().trim();
    const preferred = (row[cols.PREFERRED_NAME]   || '').toString().trim();
    const last      = (row[cols.LAST_NAME]        || '').toString().trim();
    const firstName = preferred || legal;
    const displayName = `${firstName} ${last}`.trim().toLowerCase();

    if (displayName === nameLower) {
      return {
        hasEfileNum: !!(row[cols.EFILE_NUM] || '').toString().trim(),
        hasPassword: !!(row[cols.PASSWORD]  || '').toString().trim()
      };
    }
  }

  throw new Error('Volunteer not found.');
}

/**
 * Writes EFILE# and/or password for a volunteer, but ONLY if the field is currently blank.
 * Existing values are never overwritten.
 *
 * @param {string} name      Display name (case-insensitive match).
 * @param {string} efileNum  EFILE# to store, or '' to skip.
 * @param {string} password  uFile password to store, or '' to skip.
 * @returns {{ efileNumWritten: boolean, passwordWritten: boolean }}
 */
function submitVolunteerCredentials(name, efileNum, password) {
  const nameLower   = (name     || '').trim().toLowerCase();
  const efileVal    = (efileNum || '').trim();
  const passwordVal = (password || '').trim();

  if (!nameLower) throw new Error('Name is required.');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  if (!sheet || sheet.getLastRow() <= 1) throw new Error('Volunteer list not found.');

  const cols = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST;
  const numCols = cols.PASSWORD + 1;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, numCols).getValues();

  for (let i = 0; i < data.length; i++) {
    const row       = data[i];
    const legal     = (row[cols.FIRST_NAME_LEGAL] || '').toString().trim();
    const preferred = (row[cols.PREFERRED_NAME]   || '').toString().trim();
    const last      = (row[cols.LAST_NAME]        || '').toString().trim();
    const firstName = preferred || legal;
    const displayName = `${firstName} ${last}`.trim().toLowerCase();

    if (displayName !== nameLower) continue;

    const sheetRow = i + 2; // 1-indexed, offset by header row
    let efileNumWritten = false;
    let passwordWritten = false;

    const existingEfile    = (row[cols.EFILE_NUM] || '').toString().trim();
    const existingPassword = (row[cols.PASSWORD]  || '').toString().trim();

    if (efileVal && !existingEfile) {
      sheet.getRange(sheetRow, cols.EFILE_NUM + 1).setValue(efileVal);
      efileNumWritten = true;
    }
    if (passwordVal && !existingPassword) {
      sheet.getRange(sheetRow, cols.PASSWORD + 1).setValue(passwordVal);
      passwordWritten = true;
    }

    return { efileNumWritten, passwordWritten };
  }

  throw new Error('Volunteer not found.');
}

/**
 * Returns the UFILE product keys issued to a volunteer, looked up by display name.
 * Searches the Product Code Distribution Log for rows where the volunteer's email
 * appears in any of the three volunteer slots with status 'Sent'.
 *
 * @param {string} name  Display name (case-insensitive match).
 * @returns {Array<{year: number, code: string}>} Sorted by year descending. Empty if none found.
 */
function getVolunteerProductKeys(name) {
  const nameLower = (name || '').trim().toLowerCase();
  if (!nameLower) throw new Error('Name is required.');

  // Step 1: resolve display name → email
  const ss = getSpreadsheet();
  const rosterSheet = ss.getSheetByName(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  if (!rosterSheet || rosterSheet.getLastRow() <= 1) throw new Error('Volunteer list not found.');

  const cols = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST;
  const rosterData = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, cols.PASSWORD + 1).getValues();

  let volunteerEmail = null;
  for (const row of rosterData) {
    const legal     = (row[cols.FIRST_NAME_LEGAL] || '').toString().trim();
    const preferred = (row[cols.PREFERRED_NAME]   || '').toString().trim();
    const last      = (row[cols.LAST_NAME]        || '').toString().trim();
    const firstName = preferred || legal;
    const displayName = `${firstName} ${last}`.trim().toLowerCase();
    if (displayName === nameLower) {
      volunteerEmail = (row[cols.EMAIL] || '').toString().trim().toLowerCase();
      break;
    }
  }

  if (!volunteerEmail) return [];

  // Step 2: scan distribution log for this email
  const logSheet = getOrCreateDistributionLogSheet();
  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) return [];

  const logData = logSheet.getRange(2, 1, lastRow - 1, 12).getValues();
  const seen = new Set();
  const keys = [];

  for (const row of logData) {
    const year = row[1];
    const code = (row[2] || '').toString().trim();
    if (!code) continue;

    const pairs = [
      { email: row[3], status: row[5] },
      { email: row[6], status: row[8] },
      { email: row[9], status: row[11] },
    ];

    for (const { email, status } of pairs) {
      if ((email || '').toString().trim().toLowerCase() === volunteerEmail
          && (status || '').toString().trim() === 'Sent') {
        const dedupeKey = `${year}:${code}`;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          keys.push({ year: Number(year), code });
        }
        break;
      }
    }
  }

  keys.sort((a, b) => b.year - a.year);
  return keys;
}
