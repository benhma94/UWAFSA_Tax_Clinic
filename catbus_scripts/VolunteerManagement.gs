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

  return getConsolidatedVolunteerList_()
    .filter(v => !appearedNames.has(v.name.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(v => ({ name: v.name, email: v.email, role: v.role }));
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

  const SOURCES = [
    { sheetName: 'Filer Applications',     role: 'Filer',     dataColCount: 13, emailCol: 4, firstCol: 1, prefCol: 2, lastCol: 3 },
    { sheetName: 'Frontline Applications', role: 'Frontline', dataColCount: 13, emailCol: 4, firstCol: 1, prefCol: 2, lastCol: 3 },
    { sheetName: 'Mentor Applications',    role: 'Mentor',    dataColCount: 14, emailCol: 1, firstCol: 2, prefCol: 3, lastCol: 4 }
  ];

  var ss = getSpreadsheet();
  for (var s = 0; s < SOURCES.length; s++) {
    var src = SOURCES[s];
    var sheet = ss.getSheetByName(src.sheetName);
    if (!sheet) continue;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) continue;

    var lastCol = Math.max(sheet.getLastColumn(), src.dataColCount + 2);
    var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var decisionCol = src.dataColCount; // 0-based index

    for (var r = 0; r < data.length; r++) {
      var row = data[r];
      if (!row[0] && !row[src.firstCol]) continue;

      var decision = (row[decisionCol] || '').toString().trim();
      if (decision !== 'Accept') continue;

      var email = (row[src.emailCol] || '').toString().trim();
      results.push({
        role:         src.role,
        email:        email,
        firstName:    (row[src.firstCol] || '').toString().trim(),
        preferredName:(row[src.prefCol]  || '').toString().trim(),
        lastName:     (row[src.lastCol]  || '').toString().trim(),
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
  GmailApp.sendEmail(SECRETS.CLINIC_EMAIL, subject.trim(), body.trim(), {
    bcc: emails.join(','),
    name: 'AFSA Tax Clinic'
  });

  return { success: true };
}
