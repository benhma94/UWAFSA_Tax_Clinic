/**
 * Volunteer Feedback Form Functions
 * Handles volunteer feedback form submissions from the static website
 */

/**
 * Saves volunteer feedback to the Volunteer Feedback sheet.
 * Called by doGet() in Router.gs when action=volunteerFeedback.
 *
 * @param {Object} params - URL parameters from the static form
 */
function submitVolunteerFeedback(params) {
  const sheet = getOrCreateVolunteerFeedbackSheet();

  sheet.appendRow([
    new Date(),
    (params.role || '').trim(),
    (params.enjoyed || '').trim(),
    (params.disliked || '').trim(),
    (params.improvement || '').trim(),
    (params.catbus2 || '').trim(),
    (params.recommendation || '').trim(),
    parseInt(params.knowledgeBefore) || '',
    parseInt(params.knowledgeAfterTraining) || '',
    parseInt(params.knowledgeAfterClinic) || '',
    (params.doAgain || '').trim(),
    (params.taxCareer || '').trim(),
    (params.otherComments || '').trim()
  ]);

  Logger.log('Volunteer feedback submitted: role=' + (params.role || 'N/A'));
}

/**
 * Gets or creates the Volunteer Feedback sheet with headers.
 * @returns {Sheet}
 */
function getOrCreateVolunteerFeedbackSheet() {
  const ss = getSpreadsheet();
  const sheetName = 'Volunteer Feedback';

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = [
      'Timestamp',
      'Role',
      'Enjoyed Most',
      'Disliked Most',
      'Improvement',
      'CATBUS 2.0 Features',
      'Recommendation to First Years',
      'Knowledge Before (1-10)',
      'Knowledge After Training (1-10)',
      'Knowledge After Clinic (1-10)',
      'Would Do Again',
      'Tax Career Outlook',
      'Other Comments'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 140);
    sheet.setColumnWidth(3, 280);
    sheet.setColumnWidth(4, 280);
    sheet.setColumnWidth(5, 280);
    sheet.setColumnWidth(6, 280);
    sheet.setColumnWidth(7, 280);
    sheet.setColumnWidth(12, 300);
    sheet.setColumnWidth(13, 300);
  }

  return sheet;
}
