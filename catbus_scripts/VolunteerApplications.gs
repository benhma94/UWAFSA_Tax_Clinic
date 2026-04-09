/**
 * Volunteer Application Functions
 * Handles volunteer application form submissions from the static website
 */

/**
 * Saves a volunteer application to the appropriate sheet based on role.
 * Called by doPost() in Router.gs when action=volunteerApplication.
 *
 * @param {Object} params - POST parameters from the static form
 */
function submitVolunteerApplication(params) {
  const role = (params.role || '').trim().toLowerCase();

  if (role === 'filer') {
    const firstName = (params.firstName || '').trim();
    const lastName = (params.lastName || '').trim();

    let resumeUrl = '';
    if (params.resumeBase64) {
      resumeUrl = saveResumeToDrive(params.resumeBase64, firstName, lastName);
    }

    const sheet = getOrCreateSheet('Filer Applications', [
      'Timestamp', 'First Name', 'Preferred Name', 'Last Name', 'Email', 'Program',
      'Term', 'Area of Affiliation', 'Other Languages', 'Resume URL',
      'Why Volunteer', 'Time Management Example', 'Willing to Commit'
    ]);
    sheet.appendRow([
      new Date(),
      firstName,
      (params.preferredName || '').trim(),
      lastName,
      (params.email || '').trim(),
      (params.program || '').trim(),
      (params.term || '').trim(),
      (params.areaOfAffiliation || '').trim(),
      (params.otherLanguages || '').trim(),
      resumeUrl,
      (params.whyVolunteer || '').trim(),
      (params.timeManagement || '').trim(),
      (params.willingToCommit || '').trim()
    ]);

  } else if (role === 'frontline') {
    const firstName = (params.firstName || '').trim();
    const lastName = (params.lastName || '').trim();

    let resumeUrl = '';
    if (params.resumeBase64) {
      resumeUrl = saveResumeToDrive(params.resumeBase64, firstName, lastName);
    }

    const sheet = getOrCreateSheet('Frontline Applications', [
      'Timestamp', 'First Name', 'Preferred Name', 'Last Name', 'Email', 'Program',
      'Term', 'Area of Affiliation', 'Other Languages', 'Resume URL',
      'Why Volunteer', 'Time Management Example', 'Willing to Commit'
    ]);
    sheet.appendRow([
      new Date(),
      firstName,
      (params.preferredName || '').trim(),
      lastName,
      (params.email || '').trim(),
      (params.program || '').trim(),
      (params.term || '').trim(),
      (params.areaOfAffiliation || '').trim(),
      (params.otherLanguages || '').trim(),
      resumeUrl,
      (params.whyVolunteer || '').trim(),
      (params.timeManagement || '').trim(),
      (params.willingToCommit || '').trim()
    ]);

  } else if (role === 'mentor') {
    const sheet = getOrCreateSheet('Mentor Applications', [
      'Timestamp', 'Email', 'First Name', 'Preferred Name', 'Last Name', 'Program',
      'Year/Term', 'Other Languages', 'T-Shirt Size', 'Previously Volunteered',
      'Tax Experience', 'Case Study Q1', 'Case Study Q2', 'Case Study Q3'
    ]);
    sheet.appendRow([
      new Date(),
      (params.email || '').trim(),
      (params.firstName || '').trim(),
      (params.preferredName || '').trim(),
      (params.lastName || '').trim(),
      (params.program || '').trim(),
      (params.term || '').trim(),
      (params.otherLanguages || '').trim(),
      (params.tshirtSize || '').trim(),
      (params.previouslyVolunteered || '').trim(),
      (params.taxExperience || '').trim(),
      (params.caseQ1 || '').trim(),
      (params.caseQ2 || '').trim(),
      (params.caseQ3 || '').trim()
    ]);

  } else {
    // Fallback for unknown roles
    const sheet = getOrCreateSheet('Volunteer Applications', [
      'Timestamp', 'First Name', 'Last Name', 'Email', 'Program', 'Year of Study',
      'Prior Experience', 'Additional Comments'
    ]);
    sheet.appendRow([
      new Date(),
      (params.firstName || '').trim(),
      (params.lastName || '').trim(),
      (params.email || '').trim(),
      (params.program || '').trim(),
      (params.yearOfStudy || '').trim(),
      (params.priorExperience || '').trim(),
      (params.additionalComments || '').trim()
    ]);
  }

  Logger.log('Volunteer application saved: ' + (params.firstName || '') + ' ' + (params.lastName || '') + ' (' + role + ')');
}

/**
 * Saves a base64-encoded PDF resume to a Google Drive folder.
 * @param {string} base64Data - Base64-encoded PDF content
 * @param {string} firstName
 * @param {string} lastName
 * @returns {string} Shareable Google Drive URL
 */
function saveResumeToDrive(base64Data, firstName, lastName) {
  const fileName = firstName + ' ' + lastName + ' - Resume.pdf';
  const resumeFolder = DriveApp.getFolderById(RESUME_FOLDER_ID);

  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, 'application/pdf', fileName);
  const file = resumeFolder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

/**
 * Gets or creates a sheet with the given name and headers.
 * @param {string} sheetName
 * @param {string[]} headers
 * @returns {Sheet}
 */
function getOrCreateSheet(sheetName, headers) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160); // Timestamp
    // Widen the last two columns (typically long text fields)
    if (headers.length >= 2) sheet.setColumnWidth(headers.length, 300);
    if (headers.length >= 3) sheet.setColumnWidth(headers.length - 1, 300);
  }

  return sheet;
}

/**
 * @deprecated Use getOrCreateSheet() instead.
 */
function getOrCreateVolunteerApplicationsSheet() {
  return getOrCreateSheet('Volunteer Applications', [
    'Timestamp', 'First Name', 'Last Name', 'Email', 'Program', 'Year of Study',
    'Prior Experience', 'Additional Comments'
  ]);
}

/**
 * Returns all volunteer applications for a given role, pending entries first.
 * Decision and Comment columns are appended dynamically after the data columns.
 *
 * @param {string} role - 'filer' | 'frontline' | 'mentor'
 * @returns {Object[]}
 */
function getVolunteerApplications(role) {
  role = (role || '').trim().toLowerCase();

  var sheetName, dataColCount;
  if (role === 'filer') {
    sheetName = 'Filer Applications';
    dataColCount = 13;
  } else if (role === 'frontline') {
    sheetName = 'Frontline Applications';
    dataColCount = 13;
  } else if (role === 'mentor') {
    sheetName = 'Mentor Applications';
    dataColCount = 14;
  } else {
    throw new Error('Unknown role: ' + role);
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var lastCol = sheet.getLastColumn();
  var numCols = Math.max(lastCol, dataColCount);
  var data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  var decisionColIdx = dataColCount;      // 0-based index into row array
  var commentColIdx  = dataColCount + 1;

  var applications = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[1]) continue; // skip blank rows

    var status  = numCols > decisionColIdx ? (row[decisionColIdx] || '').toString().trim() : '';
    var comment = numCols > commentColIdx  ? (row[commentColIdx]  || '').toString().trim() : '';

    var app = { rowIndex: i + 2, status: status, comment: comment };

    var ts = row[0] ? Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), 'M/d/yyyy h:mm a') : '';

    if (role === 'filer' || role === 'frontline') {
      app.timestamp         = ts;
      app.firstName         = (row[1]  || '').toString().trim();
      app.preferredName     = (row[2]  || '').toString().trim();
      app.lastName          = (row[3]  || '').toString().trim();
      app.email             = (row[4]  || '').toString().trim();
      app.program           = (row[5]  || '').toString().trim();
      app.term              = (row[6]  || '').toString().trim();
      app.areaOfAffiliation = (row[7]  || '').toString().trim();
      app.otherLanguages    = (row[8]  || '').toString().trim();
      app.resumeUrl         = (row[9]  || '').toString().trim();
      app.whyVolunteer      = (row[10] || '').toString().trim();
      app.timeManagement    = (row[11] || '').toString().trim();
      app.willingToCommit   = (row[12] || '').toString().trim();
    } else {
      app.timestamp             = ts;
      app.email                 = (row[1]  || '').toString().trim();
      app.firstName             = (row[2]  || '').toString().trim();
      app.preferredName         = (row[3]  || '').toString().trim();
      app.lastName              = (row[4]  || '').toString().trim();
      app.program               = (row[5]  || '').toString().trim();
      app.term                  = (row[6]  || '').toString().trim();
      app.otherLanguages        = (row[7]  || '').toString().trim();
      app.tshirtSize            = (row[8]  || '').toString().trim();
      app.previouslyVolunteered = (row[9]  || '').toString().trim();
      app.taxExperience         = (row[10] || '').toString().trim();
      app.caseQ1                = (row[11] || '').toString().trim();
      app.caseQ2                = (row[12] || '').toString().trim();
      app.caseQ3                = (row[13] || '').toString().trim();
    }

    applications.push(app);
  }

  // Pending entries first, then decided (stable within each group)
  applications.sort(function(a, b) {
    return (!a.status ? 0 : 1) - (!b.status ? 0 : 1);
  });

  return applications;
}

/**
 * Writes an Accept/Reject decision and optional comment to the application sheet.
 * Appends Decision/Comment column headers on first write (idempotent).
 *
 * @param {Object} params
 * @param {string} params.role      - 'filer' | 'frontline' | 'mentor'
 * @param {number} params.rowIndex  - 1-based sheet row
 * @param {string} params.decision  - 'Accept' | 'Reject'
 * @param {string} [params.comment]
 * @returns {{ success: boolean, message: string }}
 */
function saveApplicationDecision(params) {
  try {
    var role     = (params.role     || '').trim().toLowerCase();
    var rowIndex = parseInt(params.rowIndex);
    var decision = (params.decision || '').trim();
    var comment  = (params.comment  || '').trim();

    if (!role || !rowIndex || !decision) {
      return { success: false, message: 'Missing required fields.' };
    }
    if (decision !== 'Accept' && decision !== 'Reject') {
      return { success: false, message: 'Decision must be Accept or Reject.' };
    }

    var sheetName, dataColCount;
    if (role === 'filer') {
      sheetName = 'Filer Applications';
      dataColCount = 13;
    } else if (role === 'frontline') {
      sheetName = 'Frontline Applications';
      dataColCount = 13;
    } else if (role === 'mentor') {
      sheetName = 'Mentor Applications';
      dataColCount = 14;
    } else {
      return { success: false, message: 'Unknown role: ' + role };
    }

    var ss    = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, message: 'Sheet not found: ' + sheetName };

    var decisionCol = dataColCount + 1; // 1-based
    var commentCol  = dataColCount + 2;

    // Write headers if missing (idempotent)
    if (!sheet.getRange(1, decisionCol).getValue()) {
      sheet.getRange(1, decisionCol).setValue('Decision').setFontWeight('bold');
      sheet.getRange(1, commentCol).setValue('Comment').setFontWeight('bold');
    }

    sheet.getRange(rowIndex, decisionCol).setValue(decision);
    sheet.getRange(rowIndex, commentCol).setValue(comment);

    Logger.log('Application decision saved: role=' + role + ', row=' + rowIndex + ', decision=' + decision);
    return { success: true, message: 'Decision saved.' };

  } catch (err) {
    Logger.log('saveApplicationDecision error: ' + err.message);
    return { success: false, message: 'Error saving decision: ' + err.message };
  }
}
