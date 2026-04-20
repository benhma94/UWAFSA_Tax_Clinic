/**
 * Volunteer Application Functions
 * Handles volunteer application form submissions from the static website
 */

/**
 * Role-specific application sheet metadata.
 */
const APPLICATION_SOURCE_CONFIGS = [
  { role: 'filer', roleLabel: 'Filer', sheetName: 'Filer Applications', dataColCount: 13, emailCol: 4, firstCol: 1, prefCol: 2, lastCol: 3 },
  { role: 'frontline', roleLabel: 'Frontline', sheetName: 'Frontline Applications', dataColCount: 13, emailCol: 4, firstCol: 1, prefCol: 2, lastCol: 3 },
  { role: 'mentor', roleLabel: 'Mentor', sheetName: 'Mentor Applications', dataColCount: 14, emailCol: 1, firstCol: 2, prefCol: 3, lastCol: 4 }
];

const APPLICATION_LIFECYCLE_HEADERS = [
  'Decision',
  'Comment',
  'Decision Timestamp',
  'Decision Email Sent At',
  'Transferred At'
];

/**
 * Returns a copy of all application role source configs.
 * @returns {Object[]}
 */
function getAllApplicationSourceConfigs_() {
  return APPLICATION_SOURCE_CONFIGS.map(function(src) {
    return {
      role: src.role,
      roleLabel: src.roleLabel,
      sheetName: src.sheetName,
      dataColCount: src.dataColCount,
      emailCol: src.emailCol,
      firstCol: src.firstCol,
      prefCol: src.prefCol,
      lastCol: src.lastCol
    };
  });
}

/**
 * Returns application source config by role.
 * @param {string} role
 * @returns {Object}
 */
function getApplicationSourceConfig_(role) {
  var key = (role || '').toString().trim().toLowerCase();
  for (var i = 0; i < APPLICATION_SOURCE_CONFIGS.length; i++) {
    if (APPLICATION_SOURCE_CONFIGS[i].role === key) return APPLICATION_SOURCE_CONFIGS[i];
  }
  return null;
}

/**
 * Ensures lifecycle metadata columns exist for an application sheet.
 * @param {Sheet} sheet
 * @param {number} dataColCount
 */
function ensureApplicationLifecycleColumns_(sheet, dataColCount) {
  for (var i = 0; i < APPLICATION_LIFECYCLE_HEADERS.length; i++) {
    var col = dataColCount + 1 + i; // 1-based sheet index
    if (!sheet.getRange(1, col).getValue()) {
      sheet.getRange(1, col).setValue(APPLICATION_LIFECYCLE_HEADERS[i]).setFontWeight('bold');
    }
  }
}

/**
 * Returns lifecycle-related column indexes.
 * @param {number} dataColCount
 * @returns {Object}
 */
function getApplicationLifecycleColumns_(dataColCount) {
  return {
    decisionCol: dataColCount + 1,
    commentCol: dataColCount + 2,
    decisionTimestampCol: dataColCount + 3,
    decisionEmailSentAtCol: dataColCount + 4,
    transferredAtCol: dataColCount + 5,
    decisionIdx: dataColCount,
    commentIdx: dataColCount + 1,
    decisionTimestampIdx: dataColCount + 2,
    decisionEmailSentAtIdx: dataColCount + 3,
    transferredAtIdx: dataColCount + 4
  };
}

/**
 * Formats date-like values for UI output.
 * @param {*} value
 * @returns {string}
 */
function formatApplicationDateTime_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'M/d/yyyy h:mm a');
  }
  return value.toString().trim();
}

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
  var src = getApplicationSourceConfig_(role);
  if (!src) throw new Error('Unknown role: ' + role);

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(src.sheetName);
  if (!sheet) return [];

  ensureApplicationLifecycleColumns_(sheet, src.dataColCount);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var lastCol = sheet.getLastColumn();
  var numCols = Math.max(lastCol, src.dataColCount + APPLICATION_LIFECYCLE_HEADERS.length);
  var data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  var lifecycle = getApplicationLifecycleColumns_(src.dataColCount);

  var decisionColIdx = lifecycle.decisionIdx;
  var commentColIdx = lifecycle.commentIdx;
  var decisionTimestampColIdx = lifecycle.decisionTimestampIdx;
  var decisionEmailSentAtColIdx = lifecycle.decisionEmailSentAtIdx;
  var transferredAtColIdx = lifecycle.transferredAtIdx;

  var applications = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[1]) continue; // skip blank rows

    var status  = numCols > decisionColIdx ? (row[decisionColIdx] || '').toString().trim() : '';
    var comment = numCols > commentColIdx  ? (row[commentColIdx]  || '').toString().trim() : '';

    var app = {
      rowIndex: i + 2,
      role: src.role,
      roleLabel: src.roleLabel,
      status: status,
      comment: comment,
      decisionTimestamp: numCols > decisionTimestampColIdx ? formatApplicationDateTime_(row[decisionTimestampColIdx]) : '',
      decisionEmailSentAt: numCols > decisionEmailSentAtColIdx ? formatApplicationDateTime_(row[decisionEmailSentAtColIdx]) : '',
      transferredAt: numCols > transferredAtColIdx ? formatApplicationDateTime_(row[transferredAtColIdx]) : ''
    };

    var ts = row[0] ? Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), 'M/d/yyyy h:mm a') : '';

    if (src.role === 'filer' || src.role === 'frontline') {
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

    var src = getApplicationSourceConfig_(role);
    if (!src) {
      return { success: false, message: 'Unknown role: ' + role };
    }

    var ss    = getSpreadsheet();
    var sheet = ss.getSheetByName(src.sheetName);
    if (!sheet) return { success: false, message: 'Sheet not found: ' + src.sheetName };

    ensureApplicationLifecycleColumns_(sheet, src.dataColCount);

    var lifecycle = getApplicationLifecycleColumns_(src.dataColCount);
    var decisionCol = lifecycle.decisionCol;
    var commentCol = lifecycle.commentCol;
    var decisionTimestampCol = lifecycle.decisionTimestampCol;
    var decisionEmailSentAtCol = lifecycle.decisionEmailSentAtCol;
    var transferredAtCol = lifecycle.transferredAtCol;

    var previousDecision = (sheet.getRange(rowIndex, decisionCol).getValue() || '').toString().trim();
    var decisionChanged = previousDecision && previousDecision !== decision;

    sheet.getRange(rowIndex, decisionCol).setValue(decision);
    sheet.getRange(rowIndex, commentCol).setValue(comment);
    sheet.getRange(rowIndex, decisionTimestampCol).setValue(new Date());

    // If decision changed, clear downstream markers so batch actions can rerun cleanly.
    if (decisionChanged || decision === 'Reject') {
      sheet.getRange(rowIndex, decisionEmailSentAtCol).setValue('');
      sheet.getRange(rowIndex, transferredAtCol).setValue('');
    }

    Logger.log('Application decision saved: role=' + role + ', row=' + rowIndex + ', decision=' + decision + ', changed=' + decisionChanged);
    return { success: true, message: 'Decision saved.' };

  } catch (err) {
    Logger.log('saveApplicationDecision error: ' + err.message);
    return { success: false, message: 'Error saving decision: ' + err.message };
  }
}
