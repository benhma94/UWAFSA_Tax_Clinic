/**
 * Quiz Submission Functions
 * Handles volunteer quiz responses for training scenarios
 */

/**
 * Returns a sorted list of volunteer names from the Schedule Availability sheet
 * @returns {string[]} Sorted array of full names
 */
function getVolunteersForQuiz() {
  const sheet = getSheet(CONFIG.SHEETS.SCHEDULE_AVAILABILITY);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  // Columns: 0=Timestamp, 1=FirstName, 2=LastName, 3=Email, 4=Role
  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

  const names = [];
  const seen = new Set();

  for (const row of data) {
    const firstName = row[1]?.toString().trim() || '';
    const lastName = row[2]?.toString().trim() || '';
    if (!firstName && !lastName) continue;

    const fullName = (firstName + ' ' + lastName).trim();
    if (fullName && !seen.has(fullName)) {
      seen.add(fullName);
      names.push(fullName);
    }
  }

  names.sort((a, b) => a.localeCompare(b));
  return names;
}

/**
 * Saves a quiz submission to the Quiz Submissions sheet
 * @param {Object} data - { volunteerName, partnerName, answer1, answer2 }
 * @returns {Object} { success: boolean, message: string }
 */
function submitQuizResponse(data) {
  try {
    if (!data.volunteerName || !data.volunteerName.trim()) {
      return { success: false, message: 'Volunteer name is required.' };
    }
    if (!data.answer1 || !data.answer1.trim()) {
      return { success: false, message: 'Answer to Question 1 is required.' };
    }
    if (!data.answer2 || !data.answer2.trim()) {
      return { success: false, message: 'Answer to Question 2 is required.' };
    }
    if (data.refundPayable === undefined || data.refundPayable === null || data.refundPayable === '') {
      return { success: false, message: 'Total refund or payable (Q4) is required.' };
    }
    if (data.ontarioTrillium === undefined || data.ontarioTrillium === null || data.ontarioTrillium === '') {
      return { success: false, message: 'Ontario Trillium Benefit (Q5) is required.' };
    }
    if (data.canadaEssentials === undefined || data.canadaEssentials === null || data.canadaEssentials === '') {
      return { success: false, message: 'Canada Essentials and Grocery Benefit (Q6) is required.' };
    }

    const sheet = getOrCreateQuizSubmissionsSheet();

    sheet.appendRow([
      new Date(),
      data.volunteerName.trim(),
      data.partnerName ? data.partnerName.trim() : '',
      data.answer1.trim(),
      data.answer2.trim(),
      Math.round(Number(data.refundPayable)),
      Math.round(Number(data.ontarioTrillium)),
      Math.round(Number(data.canadaEssentials))
    ]);

    Logger.log('Quiz submission saved for: ' + data.volunteerName);
    return { success: true, message: 'Quiz submitted successfully!' };

  } catch (error) {
    Logger.log('Quiz submission error: ' + error.message);
    return { success: false, message: 'Failed to save submission: ' + error.message };
  }
}

/**
 * Returns all quiz submissions for the review dashboard.
 * @returns {Object[]} Array of submission objects sorted newest-first
 */
function getQuizSubmissionsForReview() {
  const sheet = getOrCreateQuizSubmissionsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const submissions = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const volunteer = row[1] ? row[1].toString().trim() : '';
    if (!volunteer) continue;

    submissions.push({
      rowIndex: i + 2, // 1-indexed sheet row
      timestamp: row[0] ? new Date(row[0]).toLocaleString() : '',
      volunteer: volunteer,
      partner: row[2] ? row[2].toString().trim() : '',
      q1: row[3] ? row[3].toString().trim() : '',
      q2: row[4] ? row[4].toString().trim() : '',
      q4: row[5] !== '' ? row[5] : '',
      q5: row[6] !== '' ? row[6] : '',
      q6: row[7] !== '' ? row[7] : '',
      email1: row[8] ? row[8].toString().trim() : '',
      email2: row[9] ? row[9].toString().trim() : '',
      status: row[10] ? row[10].toString().trim() : ''
    });
  }

  submissions.reverse();
  return submissions;
}

/**
 * Sends quiz result email and updates the Status column.
 * @param {Object} data - { rowIndex, verdict, comments }
 * @returns {Object} { success, message }
 */
function sendQuizResult(data) {
  try {
    if (!data.rowIndex || !data.verdict) {
      return { success: false, message: 'Missing required fields.' };
    }

    const sheet = getOrCreateQuizSubmissionsSheet();
    const row = sheet.getRange(data.rowIndex, 1, 1, 11).getValues()[0];

    const volunteer = row[1] ? row[1].toString().trim() : '';
    const partner = row[2] ? row[2].toString().trim() : '';
    const email1 = row[8] ? row[8].toString().trim() : '';
    const email2 = row[9] ? row[9].toString().trim() : '';

    if (!email1) {
      return { success: false, message: 'No email address found for this submission.' };
    }

    const verdict = data.verdict === 'Pass' ? 'PASS' : 'FAIL';
    const commentsLine = data.comments && data.comments.trim()
      ? data.comments.trim()
      : 'No additional comments.';

    const greeting = partner
      ? 'Hi ' + volunteer + ' and ' + partner + ','
      : 'Hi ' + volunteer + ',';

    const failLine = verdict === 'FAIL' ? 'Please resubmit and try again.\n\n' : '';

    const body = greeting + '\n\n' +
      'Your quiz submission has been reviewed.\n\n' +
      'Result: ' + verdict + '\n\n' +
      'Comments:\n' + commentsLine + '\n\n' +
      failLine +
      'Thank you,\n' +
      'UW AFSA Tax Clinic';

    const recipients = email2 ? email1 + ',' + email2 : email1;

    MailApp.sendEmail({
      to: recipients,
      subject: 'Training Quiz Results',
      body: body,
      name: 'UW AFSA Tax Clinic'
    });

    // Update Status column (col K = index 11)
    sheet.getRange(data.rowIndex, 11).setValue(data.verdict);

    Logger.log('Quiz result sent for row ' + data.rowIndex + ': ' + data.verdict);
    return { success: true, message: 'Result sent to ' + volunteer + '.' };

  } catch (error) {
    Logger.log('sendQuizResult error: ' + error.message);
    return { success: false, message: 'Failed to send result: ' + error.message };
  }
}

/**
 * Gets or creates the Quiz Submissions sheet with headers
 * @returns {Sheet}
 */
function getOrCreateQuizSubmissionsSheet() {
  const ss = getSpreadsheet();
  const sheetName = 'Quiz Submissions';

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = ['Timestamp', 'Volunteer', 'Partner', 'Q1 - Missing Information', 'Q2 - Additional Form', 'Q4 - Refund/Payable ($)', 'Q5 - Ontario Trillium Benefit ($)', 'Q6 - Canada Essentials Benefit ($)'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    // Format dollar columns (F, G, H) with accounting format
    sheet.getRange(2, 6, sheet.getMaxRows() - 1, 3).setNumberFormat('"$"#,##0;"-$"#,##0');
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  return sheet;
}
