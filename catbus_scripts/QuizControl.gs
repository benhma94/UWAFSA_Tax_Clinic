/**
 * Quiz Control Functions
 * Generates Q-prefix client IDs and handles quiz form submissions.
 * createQuizClient: called from control_sheet_form.html and quiz_control_form.html.
 * submitQuizSession: called from quiz_control_form.html on final submit.
 */

/**
 * Generates a Q-prefix quiz client ID (Q001, Q002, ...) for internal routing.
 * The ID is not stored in Quiz Submissions; it is only used within the current
 * session to route the control sheet to the quiz path in ControlSheet.gs.
 * Uses the current row count of the Quiz Submissions sheet as a simple counter.
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
      // lastRow includes the header row, so data rows = lastRow - 1.
      // Next ID = data rows + 1 (i.e. lastRow), giving a monotonically increasing number.
      const num = sheet.getLastRow(); // 1 when sheet has only headers → produces Q001
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
