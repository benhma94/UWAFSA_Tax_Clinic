/**
 * Client Feedback Form Functions
 * Handles feedback form submissions from the static website
 */

/**
 * Saves client feedback to the Client Feedback sheet.
 * Called by doGet() in Router.gs when action=feedback.
 *
 * @param {Object} params - URL parameters from the static form
 */
function submitFeedback(params) {
  const sheet = getOrCreateFeedbackSheet();

  sheet.appendRow([
    new Date(),
    parseInt(params.waitTime) || '',
    parseInt(params.receptionist) || '',
    parseInt(params.taxFiler) || '',
    parseInt(params.location) || '',
    parseInt(params.overall) || '',
    (params.heardFrom || '').trim(),
    (params.faculty || '').trim(),
    (params.transportation || '').trim(),
    (params.otherFeedback || '').trim()
  ]);

  Logger.log('Feedback submitted: overall=' + (params.overall || 'N/A'));
}

/**
 * Gets or creates the Client Feedback sheet with headers.
 * @returns {Sheet}
 */
function getOrCreateFeedbackSheet() {
  const ss = getSpreadsheet();
  const sheetName = 'Client Feedback';

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = [
      'Timestamp',
      'Wait Time (1-5)',
      'Receptionist Helpfulness (1-5)',
      'Tax Filer Performance (1-5)',
      'Location Accessibility (1-5)',
      'Overall Experience (1-5)',
      'How Did You Hear',
      'Faculty',
      'Transportation',
      'Other Feedback'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(7, 220);
    sheet.setColumnWidth(9, 180);
    sheet.setColumnWidth(10, 300);
  }

  return sheet;
}
