/**
 * Review Request Functions
 * Wrapper functions for review request management using the generic RequestHandler
 */

/**
 * Sends a review request for a volunteer
 * @param {string} volunteer - Volunteer name
 * @param {string} [clientId] - Client ID being reviewed
 * @param {string} [taxYear] - Tax year being reviewed
 * @returns {boolean} True if successful
 */
function sendReviewRequest(volunteer, clientId, taxYear) {
  const extraData = (clientId || taxYear) ? { clientId: clientId || '', taxYear: taxYear || '' } : null;
  return sendRequest(volunteer, 'REVIEW', extraData);
}

/**
 * Cancels a review request for a volunteer
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function cancelReviewRequest(volunteer) {
  return updateRequestStatus(
    volunteer,
    'REVIEW',
    [CONFIG.REVIEW_STATUS.REQUESTED, CONFIG.REVIEW_STATUS.IN_PROGRESS],
    CONFIG.REVIEW_STATUS.CANCELLED
  );
}

/**
 * Marks a review request as In Progress (claimed by a reviewer from the alert dashboard)
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function markReviewInProgress(volunteer) {
  return updateRequestStatus(
    volunteer,
    'REVIEW',
    CONFIG.REVIEW_STATUS.REQUESTED,
    CONFIG.REVIEW_STATUS.IN_PROGRESS
  );
}

/**
 * Completes a review request for a volunteer
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function completeReviewRequest(volunteer) {
  return updateRequestStatus(
    volunteer,
    'REVIEW',
    CONFIG.REVIEW_STATUS.REQUESTED,
    CONFIG.REVIEW_STATUS.COMPLETED
  );
}

/**
 * Gets the current review request status for a volunteer
 * @param {string} volunteer - Volunteer name
 * @returns {string} Status: "requested", "completed", "cancelled", or ""
 */
function getReviewRequestStatus(volunteer) {
  return getRequestStatus(volunteer, 'REVIEW');
}

/**
 * Gets all currently requested review requests
 * @returns {Array<Object>} Array of review request objects
 */
function getLiveReviewRequests() {
  return getLiveRequests('REVIEW');
}

/**
 * Gets all currently requested review requests with caching
 * @returns {Array<Object>} Array of review request objects
 */
function getLiveReviewRequestsCached() {
  return getCachedOrFetch(
    CACHE_CONFIG.KEYS.REVIEW_REQUESTS,
    () => getLiveReviewRequests(),
    CACHE_CONFIG.TTL.REVIEW_REQUESTS
  );
}

/**
 * Approves a review request remotely (called from reviewer page)
 * Sets STATUS to 'Approved' and stores reviewer name
 * @param {string} volunteer - Volunteer name (bare, no station prefix)
 * @param {string} reviewerName - Name of the approving reviewer
 * @returns {boolean} True if successful
 */
function approveReviewRemotely(volunteer, reviewerName) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    reviewerName = sanitizeInput(reviewerName, 100);
    if (!volunteer || !reviewerName) throw new Error('Volunteer and reviewer name are required');

    const cols = CONFIG.COLUMNS.REVIEW_REQUESTS;
    const sheet = getSheet(CONFIG.SHEETS.REVIEW_REQUESTS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return true;

    const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK, lastRow - 1);
    const startRow = Math.max(2, lastRow - checkRows + 1);
    const data = sheet.getRange(startRow, 1, checkRows, 6).getValues();

    for (let i = data.length - 1; i >= 0; i--) {
      const v = data[i][cols.VOLUNTEER]?.toString().trim();
      const status = data[i][cols.STATUS]?.toString().trim();
      if (v === volunteer && (status === CONFIG.REVIEW_STATUS.REQUESTED || status === CONFIG.REVIEW_STATUS.IN_PROGRESS)) {
        const rowNum = startRow + i;
        sheet.getRange(rowNum, cols.STATUS + 1).setValue(CONFIG.REVIEW_STATUS.APPROVED);
        sheet.getRange(rowNum, cols.REVIEWER_OR_REASON + 1).setValue(reviewerName);
        invalidateCache(CACHE_CONFIG.KEYS.REVIEW_REQUESTS);
        return true;
      }
    }
    return true;
  }, 'approveReviewRemotely');
}

/**
 * Returns a review for corrections remotely (called from reviewer page)
 * Sets STATUS to 'Returned' and stores the reason
 * @param {string} volunteer - Volunteer name (bare, no station prefix)
 * @param {string} reason - Reason for returning (may be empty)
 * @returns {boolean} True if successful
 */
function returnReviewRemotely(volunteer, reason) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    reason = sanitizeInput(reason || '', 500);
    if (!volunteer) throw new Error('Volunteer name is required');

    const cols = CONFIG.COLUMNS.REVIEW_REQUESTS;
    const sheet = getSheet(CONFIG.SHEETS.REVIEW_REQUESTS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return true;

    const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK, lastRow - 1);
    const startRow = Math.max(2, lastRow - checkRows + 1);
    const data = sheet.getRange(startRow, 1, checkRows, 6).getValues();

    for (let i = data.length - 1; i >= 0; i--) {
      const v = data[i][cols.VOLUNTEER]?.toString().trim();
      const status = data[i][cols.STATUS]?.toString().trim();
      if (v === volunteer && (status === CONFIG.REVIEW_STATUS.REQUESTED || status === CONFIG.REVIEW_STATUS.IN_PROGRESS)) {
        const rowNum = startRow + i;
        sheet.getRange(rowNum, cols.STATUS + 1).setValue(CONFIG.REVIEW_STATUS.RETURNED);
        sheet.getRange(rowNum, cols.REVIEWER_OR_REASON + 1).setValue(reason);
        invalidateCache(CACHE_CONFIG.KEYS.REVIEW_REQUESTS);
        return true;
      }
    }
    return true;
  }, 'returnReviewRemotely');
}

/**
 * Polls for a remote approval or return result for a volunteer's review request
 * Called by the control sheet every 10 seconds
 * @param {string} volunteer - Volunteer name (bare, no station prefix)
 * @returns {Object|null} Resolution object or null if still pending
 */
function getReviewApprovalResult(volunteer) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) return null;

    const cols = CONFIG.COLUMNS.REVIEW_REQUESTS;
    const sheet = getSheet(CONFIG.SHEETS.REVIEW_REQUESTS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK, lastRow - 1);
    const startRow = Math.max(2, lastRow - checkRows + 1);
    const data = sheet.getRange(startRow, 1, checkRows, 6).getValues();

    for (let i = data.length - 1; i >= 0; i--) {
      const v = data[i][cols.VOLUNTEER]?.toString().trim();
      const status = data[i][cols.STATUS]?.toString().trim();

      if (v !== volunteer) continue;

      if (status === CONFIG.REVIEW_STATUS.APPROVED) {
        return {
          resolved: true,
          approved: true,
          reviewerName: data[i][cols.REVIEWER_OR_REASON]?.toString().trim() || '',
          taxYear: data[i][cols.TAX_YEAR]?.toString().trim() || ''
        };
      }

      if (status === CONFIG.REVIEW_STATUS.RETURNED) {
        return {
          resolved: true,
          approved: false,
          reason: data[i][cols.REVIEWER_OR_REASON]?.toString().trim() || '',
          taxYear: data[i][cols.TAX_YEAR]?.toString().trim() || ''
        };
      }
    }

    return null;
  }, 'getReviewApprovalResult');
}

/**
 * Marks a resolved review as Completed so control sheet stops seeing it
 * Called by the control sheet after consuming an Approved or Returned result
 * @param {string} volunteer - Volunteer name (bare, no station prefix)
 * @returns {boolean} True if successful
 */
function completeReviewApproval(volunteer) {
  return updateRequestStatus(
    volunteer,
    'REVIEW',
    [CONFIG.REVIEW_STATUS.APPROVED, CONFIG.REVIEW_STATUS.RETURNED],
    CONFIG.REVIEW_STATUS.COMPLETED
  );
}

/**
 * Builds a map of volunteer name → station string from the Volunteer List sheet.
 * @returns {Object} { volunteerName: stationString }
 */
function getVolunteerStationMap_() {
  const map = {};
  try {
    const sheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return map;
    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (const row of data) {
      const name = row[CONFIG.COLUMNS.VOLUNTEER_LIST.NAME]?.toString().trim();
      const station = row[CONFIG.COLUMNS.VOLUNTEER_LIST.STATION]?.toString().trim();
      if (name && station) map[name] = station;
    }
  } catch (e) {}
  return map;
}

/**
 * Gets enriched live review requests for the reviewer dashboard page
 * Returns only 'Requested' status with full context (clientId, taxYear, station)
 * @returns {Array<Object>} Array of enriched review request objects
 */
function getReviewDashboardData() {
  const stationMap = getVolunteerStationMap_();
  return getLiveReviewRequests().map(req => {
    const intake = req.clientId ? getClientIntakeInfo(req.clientId) : null;
    return Object.assign({}, req, {
      needsSeniorReview: intake?.needsSeniorReview || false,
      station: stationMap[req.volunteer] || ''
    });
  });
}
