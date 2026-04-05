/**
 * Quiz Control Functions
 * Generates Q-prefix client IDs and handles quiz form submissions.
 * createQuizClient: called from control_sheet_form.html and quiz_control_form.html.
 * submitQuizSession: called from quiz_control_form.html on final submit.
 */

/**
 * Generates the next available Q-prefix quiz client ID (Q001, Q002, ...).
 * Scans the Quiz Submissions sheet for existing Q-numbers.
 * @returns {string} New client ID (e.g. 'Q001')
 */
function createQuizClient() {
  return safeExecute(() => {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(CONFIG.PERFORMANCE.LOCK_TIMEOUT_MS)) {
      throw new Error('System is busy, please try again');
    }

    try {
      const sheet = getSheet(CONFIG.SHEETS.QUIZ_SUBMISSIONS);
      const lastRow = sheet.getLastRow();
      const existingNumbers = new Set();

      if (lastRow > 1) {
        const idCol = CONFIG.COLUMNS.QUIZ_SUBMISSIONS.CLIENT_ID + 1;
        const data = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
        for (const row of data) {
          const id = row[0]?.toString().trim();
          if (/^Q\d{3}$/.test(id)) existingNumbers.add(parseInt(id.slice(1), 10));
        }
      }

      let num = 1;
      while (existingNumbers.has(num)) num++;
      if (num > 999) throw new Error('Quiz client IDs exhausted (Q001–Q999)');

      return 'Q' + String(num).padStart(3, '0');
    } finally {
      lock.releaseLock();
    }
  }, 'createQuizClient');
}

/**
 * Handles final submission from quiz_control_form.html.
 * Uploads any attached files to Google Drive, then writes the quiz submission record.
 * @param {string} volunteer   - Volunteer name
 * @param {string} clientId    - Q-prefix client ID (e.g. 'Q001')
 * @param {Array}  rows        - [{taxYear, filingStatus, married}]
 * @param {Object} receiptData - {refund, onben, gst, efileConfirmation, notes}
 * @param {Array}  filesArray  - [{name, data (base64), mimeType}] (may be empty)
 * @returns {boolean} true on success
 */
function submitQuizSession(volunteer, clientId, rows, receiptData, filesArray) {
  return safeExecute(() => {
    if (!volunteer || !clientId) throw new Error('Volunteer and client ID are required.');

    const fileUrls = [];
    if (filesArray && filesArray.length > 0) {
      const folder = DriveApp.getFolderById(QUIZ_FOLDER_ID);
      for (const f of filesArray) {
        const bytes = Utilities.base64Decode(f.data);
        const blob  = Utilities.newBlob(bytes, f.mimeType, f.name);
        const file  = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileUrls.push({ name: f.name, url: file.getUrl() });
      }
    }

    writeQuizSubmission(volunteer, '', clientId, receiptData || {}, rows || [], fileUrls);
    return true;
  }, 'submitQuizSession');
}
