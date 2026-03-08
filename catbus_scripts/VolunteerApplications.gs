/**
 * Volunteer Application Functions
 * Handles volunteer application form submissions from the static website
 */

/**
 * Saves a volunteer application to the Volunteer Applications sheet.
 * Called by doPost() in Router.gs when action=volunteerApplication.
 *
 * @param {Object} params - URL-encoded POST parameters from the static form
 */
function submitVolunteerApplication(params) {
  const sheet = getOrCreateVolunteerApplicationsSheet();

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

  Logger.log('Volunteer application saved: ' + (params.firstName || '') + ' ' + (params.lastName || ''));
}

/**
 * Gets or creates the Volunteer Applications sheet with headers.
 * @returns {Sheet}
 */
function getOrCreateVolunteerApplicationsSheet() {
  const ss = getSpreadsheet();
  const sheetName = 'Volunteer Applications';

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = [
      'Timestamp',
      'First Name',
      'Last Name',
      'Email',
      'Program',
      'Year of Study',
      'Prior Experience',
      'Additional Comments'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(7, 300);
    sheet.setColumnWidth(8, 300);
  }

  return sheet;
}
