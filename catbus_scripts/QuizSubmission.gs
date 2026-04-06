/**
 * Quiz Submission Functions
 * Handles writing quiz results and serving them to the marker review page.
 * Volunteers submit via the control sheet (?app=control) in quiz mode,
 * or directly via the quiz form (?app=quiz).
 * Markers review via quiz_review.html (?app=quizreview).
 *
 * Quiz Submissions sheet schema (11 columns):
 *   A=Timestamp, B=Volunteer, C=Partner, D=Email 1, E=Email 2,
 *   F=Status, G=Refund/Balance, H=ON-BEN Credit, I=GST/HST Credit,
 *   J=Notes, K=Files (JSON)
 */

/**
 * Writes a quiz submission row.
 * Called from ControlSheet.gs (Q-prefix finalize) and QuizControl.gs (submitQuizSession).
 * @param {string} volunteer - Volunteer name
 * @param {string} partner - Partner name (may be empty)
 * @param {string} clientId - Q-prefix client ID (e.g. 'Q001')
 * @param {Object} [receiptData] - { refund, onben, gst, notes }
 * @param {Array}  [rows]        - Unused (tax years not tracked)
 * @param {Array}  [fileUrls]    - Array of { name, url } for uploaded files
 */
function writeQuizSubmission(volunteer, partner, clientId, receiptData, rows, fileUrls) {
  const sheet = getOrCreateQuizSubmissionsSheet();
  const { email1, email2 } = lookupEmailsByName(volunteer, partner);
  const cols = CONFIG.COLUMNS.QUIZ_SUBMISSIONS;

  const row = new Array(cols.FILE_URLS + 1).fill('');
  row[cols.TIMESTAMP] = new Date();
  row[cols.VOLUNTEER] = sanitizeInput(volunteer, 100);
  row[cols.PARTNER]   = sanitizeInput(partner || '', 100);
  row[cols.EMAIL_1]   = email1;
  row[cols.EMAIL_2]   = email2;
  row[cols.STATUS]    = '';
  row[cols.REFUND]    = (receiptData && receiptData.refund) || '';
  row[cols.ONBEN]     = (receiptData && receiptData.onben)  || '';
  row[cols.GST]       = (receiptData && receiptData.gst)    || '';
  row[cols.NOTES]     = (receiptData && receiptData.notes)  || '';
  row[cols.FILE_URLS] = JSON.stringify(fileUrls || []);

  sheet.appendRow(row);
  Logger.log(`Quiz submission written: volunteer=${volunteer}, client=${clientId}`);
}

/**
 * Looks up email addresses for two volunteers by name from the Schedule Availability sheet.
 * @param {string} name1 - First volunteer's full name
 * @param {string} name2 - Second volunteer's full name (may be empty)
 * @returns {{ email1: string, email2: string }}
 */
function lookupEmailsByName(name1, name2) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.SCHEDULE_AVAILABILITY);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { email1: '', email2: '' };

    // Columns: A=Timestamp, B=FirstName, C=LastName, D=Email
    const data = sheet.getRange(2, 2, lastRow - 1, 3).getValues();
    const emailMap = {};

    for (const row of data) {
      const firstName = row[0]?.toString().trim() || '';
      const lastName  = row[1]?.toString().trim() || '';
      const email     = row[2]?.toString().trim() || '';
      if (firstName && lastName && email) {
        const fullName = `${firstName} ${lastName}`;
        if (!emailMap[fullName]) emailMap[fullName] = email;
      }
    }

    return {
      email1: emailMap[name1] || '',
      email2: (name2 && emailMap[name2]) ? emailMap[name2] : ''
    };
  } catch (e) {
    Logger.log('lookupEmailsByName error: ' + e.message);
    return { email1: '', email2: '' };
  }
}

/**
 * Returns all quiz submissions for the marker review dashboard.
 * @returns {Object[]} Array of submission objects sorted newest-first
 */
function getQuizSubmissionsForReview() {
  const sheet = getOrCreateQuizSubmissionsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const cols = CONFIG.COLUMNS.QUIZ_SUBMISSIONS;
  const numCols = cols.FILE_URLS + 1;
  const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  const submissions = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const volunteer = row[cols.VOLUNTEER]?.toString().trim();
    if (!volunteer) continue;

    const status = row[cols.STATUS]?.toString().trim() || '';
    if (status) continue;  // skip already-graded rows

    let parsedFileUrls = [];
    try { parsedFileUrls = JSON.parse(row[cols.FILE_URLS]?.toString() || '[]'); } catch (e) {}

    submissions.push({
      rowIndex:  i + 2,
      timestamp: row[cols.TIMESTAMP] ? new Date(row[cols.TIMESTAMP]).toLocaleString() : '',
      volunteer: volunteer,
      partner:   row[cols.PARTNER]?.toString().trim()   || '',
      email1:    row[cols.EMAIL_1]?.toString().trim()   || '',
      email2:    row[cols.EMAIL_2]?.toString().trim()   || '',
      status:    row[cols.STATUS]?.toString().trim()    || '',
      refund:    row[cols.REFUND]?.toString().trim()    || '',
      onben:     row[cols.ONBEN]?.toString().trim()     || '',
      gst:       row[cols.GST]?.toString().trim()       || '',
      notes:     row[cols.NOTES]?.toString().trim()     || '',
      fileUrls:  parsedFileUrls
    });
  }

  submissions.reverse();
  return submissions;
}

/**
 * Sends a Pass/Fail result email to the volunteer and updates the Status column.
 * @param {Object} data - { rowIndex, verdict, comments }
 * @returns {Object} { success, message }
 */
function sendQuizResult(data) {
  try {
    if (!data.rowIndex || !data.verdict) {
      return { success: false, message: 'Missing required fields.' };
    }

    const sheet = getOrCreateQuizSubmissionsSheet();
    const cols  = CONFIG.COLUMNS.QUIZ_SUBMISSIONS;
    const numCols = cols.FILE_URLS + 1;
    const row   = sheet.getRange(data.rowIndex, 1, 1, numCols).getValues()[0];

    const volunteer = row[cols.VOLUNTEER]?.toString().trim() || '';
    const partner   = row[cols.PARTNER]?.toString().trim()   || '';
    const email1    = row[cols.EMAIL_1]?.toString().trim()   || '';
    const email2    = row[cols.EMAIL_2]?.toString().trim()   || '';

    if (!email1) {
      return { success: false, message: 'No email address found for this submission.' };
    }

    const verdict      = data.verdict === 'Pass' ? 'PASS' : 'FAIL';
    const commentsLine = data.comments?.trim() || 'No additional comments.';
    const greeting     = partner
      ? `Hi ${volunteer} and ${partner},`
      : `Hi ${volunteer},`;
    const failLine     = verdict === 'FAIL' ? 'Please resubmit and try again.\n\n' : '';

    const body = `${greeting}\n\n` +
      `Your training quiz submission has been reviewed.\n\n` +
      `Result: ${verdict}\n\n` +
      `Comments:\n${commentsLine}\n\n` +
      `${failLine}` +
      `Thank you,\n` +
      `UW AFSA Tax Clinic`;

    const recipients = email2 ? `${email1},${email2}` : email1;

    MailApp.sendEmail({
      to: recipients,
      subject: 'Training Quiz Results',
      body: body,
      name: 'UW AFSA Tax Clinic'
    });

    sheet.getRange(data.rowIndex, cols.STATUS + 1).setValue(data.verdict);

    Logger.log(`Quiz result sent for row ${data.rowIndex}: ${data.verdict}`);
    return { success: true, message: `Result sent to ${volunteer}.` };

  } catch (error) {
    Logger.log('sendQuizResult error: ' + error.message);
    return { success: false, message: 'Failed to send result: ' + error.message };
  }
}

/**
 * Gets or creates the Quiz Submissions sheet with headers.
 * @returns {Sheet}
 */
function getOrCreateQuizSubmissionsSheet() {
  const ss        = getSpreadsheet();
  const sheetName = CONFIG.SHEETS.QUIZ_SUBMISSIONS;

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = ['Timestamp', 'Volunteer', 'Partner', 'Email 1', 'Email 2', 'Status',
                     'Refund/Balance', 'ON-BEN Credit', 'GST/HST Credit', 'Notes', 'Files'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  return sheet;
}
