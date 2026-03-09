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
