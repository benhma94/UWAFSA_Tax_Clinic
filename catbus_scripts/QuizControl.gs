/**
 * Quiz Control Functions
 * Generates Q-prefix client IDs for quiz mode in control_sheet_form.html.
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

