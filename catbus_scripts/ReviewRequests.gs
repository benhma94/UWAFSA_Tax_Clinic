/**
 * Review Request Functions
 * Wrapper functions for review request management using the generic RequestHandler
 */

/**
 * Sends a review request for a volunteer
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function sendReviewRequest(volunteer) {
  return sendRequest(volunteer, 'REVIEW');
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
    CONFIG.REVIEW_STATUS.REQUESTED,
    CONFIG.REVIEW_STATUS.CANCELLED
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
