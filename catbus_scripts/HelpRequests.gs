/**
 * Help Request Functions
 * Wrapper functions for help request management using the generic RequestHandler
 */

/**
 * Sends a help request for a volunteer
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function sendHelpRequest(volunteer) {
  return sendRequest(volunteer, 'HELP');
}

/**
 * Clears a help request for a volunteer
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function clearHelpRequest(volunteer) {
  return updateRequestStatus(
    volunteer,
    'HELP',
    [CONFIG.HELP_STATUS.ACTIVE, CONFIG.HELP_STATUS.ESCALATED, CONFIG.HELP_STATUS.IN_PROGRESS],
    CONFIG.HELP_STATUS.CLEARED
  );
}

/**
 * Escalates a help request for a volunteer
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function escalateHelpRequest(volunteer) {
  return updateRequestStatus(
    volunteer,
    'HELP',
    [CONFIG.HELP_STATUS.ACTIVE, CONFIG.HELP_STATUS.IN_PROGRESS],
    CONFIG.HELP_STATUS.ESCALATED
  );
}

/**
 * Marks a help request as In Progress (claimed by a helper from the alert dashboard)
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function markHelpInProgress(volunteer) {
  return updateRequestStatus(
    volunteer,
    'HELP',
    CONFIG.HELP_STATUS.ACTIVE,
    CONFIG.HELP_STATUS.IN_PROGRESS
  );
}

/**
 * Gets the current help status for a volunteer
 * @param {string} volunteer - Volunteer name
 * @returns {string} Status: "active", "escalated", or "cleared"
 */
function getHelpStatus(volunteer) {
  const status = getRequestStatus(volunteer, 'HELP');
  return status || CONFIG.HELP_STATUS.CLEARED.toLowerCase();
}

/**
 * Gets all currently active or escalated help requests
 * @returns {Array<Object>} Array of help request objects
 */
function getLiveHelpRequests() {
  return getLiveRequests('HELP');
}

/**
 * Gets all currently active or escalated help requests with caching
 * @returns {Array<Object>} Array of help request objects
 */
function getLiveHelpRequestsCached() {
  return getCachedOrFetch(
    CACHE_CONFIG.KEYS.HELP_REQUESTS,
    () => getLiveHelpRequests(),
    CACHE_CONFIG.TTL.HELP_REQUESTS
  );
}
