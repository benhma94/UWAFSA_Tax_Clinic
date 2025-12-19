/**
 * Generic Request Handler
 * Consolidated request management functions for both Help and Review requests
 * Eliminates code duplication by providing a unified interface
 */

/**
 * Configuration for different request types
 */
const REQUEST_TYPES = {
  HELP: {
    sheet: CONFIG.SHEETS.HELP_REQUESTS,
    columns: CONFIG.COLUMNS.HELP_REQUESTS,
    statuses: CONFIG.HELP_STATUS,
    checkLimit: CONFIG.PERFORMANCE.RECENT_HELP_REQUESTS_TO_CHECK,
    activeStatuses: [CONFIG.HELP_STATUS.ACTIVE, CONFIG.HELP_STATUS.ESCALATED],
    primaryStatus: CONFIG.HELP_STATUS.ACTIVE
  },
  REVIEW: {
    sheet: CONFIG.SHEETS.REVIEW_REQUESTS,
    columns: CONFIG.COLUMNS.REVIEW_REQUESTS,
    statuses: CONFIG.REVIEW_STATUS,
    checkLimit: CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK,
    activeStatuses: [CONFIG.REVIEW_STATUS.REQUESTED],
    primaryStatus: CONFIG.REVIEW_STATUS.REQUESTED
  }
};

/**
 * Sends a request for a volunteer
 * Generic function that works for both help and review requests
 * @param {string} volunteer - Volunteer name
 * @param {string} requestType - 'HELP' or 'REVIEW'
 * @returns {boolean} True if successful
 */
function sendRequest(volunteer, requestType) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) {
      throw new Error('Volunteer name is required');
    }

    const config = REQUEST_TYPES[requestType];
    const sheet = getSheet(config.sheet);
    const lastRow = sheet.getLastRow();

    // Optimization: Only check last N requests (most are recent)
    if (lastRow > 1) {
      const checkRows = Math.min(config.checkLimit, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const data = sheet.getRange(startRow, config.columns.VOLUNTEER + 1, checkRows, 2).getValues();

      // Check from most recent backwards for existing active request
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i][0]?.toString().trim();
        const status = data[i][1]?.toString().trim();

        if (v === volunteer && status === config.primaryStatus) {
          // Already has active request
          return true;
        }
      }
    }

    // Add new request
    sheet.appendRow([
      new Date(),
      volunteer,
      config.primaryStatus
    ]);

    logAudit(`${requestType} Request Sent`, `Volunteer: ${volunteer}`);
    return true;
  }, `send${requestType}Request`);
}

/**
 * Updates a request status for a volunteer
 * Generic function that works for any status change
 * @param {string} volunteer - Volunteer name
 * @param {string} requestType - 'HELP' or 'REVIEW'
 * @param {string} fromStatus - Status to search for (or array of statuses)
 * @param {string} toStatus - New status to set
 * @returns {boolean} True if successful
 */
function updateRequestStatus(volunteer, requestType, fromStatus, toStatus) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) {
      throw new Error('Volunteer name is required');
    }

    const config = REQUEST_TYPES[requestType];
    const sheet = getSheet(config.sheet);
    const lastRow = sheet.getLastRow();

    const fromStatuses = Array.isArray(fromStatus) ? fromStatus : [fromStatus];

    // Optimization: Only check last N requests (most are recent)
    if (lastRow > 1) {
      const checkRows = Math.min(config.checkLimit, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const data = sheet.getRange(startRow, config.columns.VOLUNTEER + 1,
                                   checkRows, 2).getValues();

      // Check from most recent backwards
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i][0]?.toString().trim();
        const status = data[i][1]?.toString().trim();

        if (v === volunteer && fromStatuses.some(fs => fs.toLowerCase() === status.toLowerCase())) {
          const rowNum = startRow + i;
          sheet.getRange(rowNum, config.columns.STATUS + 1).setValue(toStatus);
          logAudit(`${requestType} Request Updated`, `Volunteer: ${volunteer}, Status: ${toStatus}`);
          return true;
        }
      }

      // If not found in recent rows, check older rows (unlikely but possible)
      if (lastRow > config.checkLimit) {
        const olderRows = lastRow - config.checkLimit;
        const olderData = sheet.getRange(2, config.columns.VOLUNTEER + 1,
                                          olderRows, 2).getValues();
        for (let i = olderData.length - 1; i >= 0; i--) {
          const v = olderData[i][0]?.toString().trim();
          const status = olderData[i][1]?.toString().trim();

          if (v === volunteer && fromStatuses.some(fs => fs.toLowerCase() === status.toLowerCase())) {
            const rowNum = i + 2;
            sheet.getRange(rowNum, config.columns.STATUS + 1).setValue(toStatus);
            logAudit(`${requestType} Request Updated`, `Volunteer: ${volunteer}, Status: ${toStatus}`);
            return true;
          }
        }
      }
    }

    return true; // Already updated or doesn't exist
  }, `update${requestType}RequestStatus`);
}

/**
 * Gets the current request status for a volunteer
 * @param {string} volunteer - Volunteer name
 * @param {string} requestType - 'HELP' or 'REVIEW'
 * @returns {string} Current status or empty string
 */
function getRequestStatus(volunteer, requestType) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) {
      return '';
    }

    const config = REQUEST_TYPES[requestType];
    const sheet = getSheet(config.sheet);
    const lastRow = sheet.getLastRow();

    // Optimization: Only check last N requests (most are recent)
    if (lastRow > 1) {
      const checkRows = Math.min(config.checkLimit, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const data = sheet.getRange(startRow, config.columns.VOLUNTEER + 1, checkRows, 2).getValues();

      // Check from most recent to oldest
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i][0]?.toString().trim();
        const status = data[i][1]?.toString().trim();

        if (v === volunteer && config.activeStatuses.some(as => as.toLowerCase() === status.toLowerCase())) {
          return status.toLowerCase();
        }
      }
    }

    return '';
  }, `get${requestType}RequestStatus`);
}

/**
 * Gets all currently active requests
 * @param {string} requestType - 'HELP' or 'REVIEW'
 * @returns {Array<Object>} Array of request objects
 */
function getLiveRequests(requestType) {
  return safeExecute(() => {
    const config = REQUEST_TYPES[requestType];
    const sheet = getSheet(config.sheet);
    const lastRow = sheet.getLastRow();

    // Optimization: Only read rows with data and only necessary columns
    const data = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, 3).getValues()
      : [];

    const now = new Date();
    const output = [];

    for (let i = 0; i < data.length; i++) {
      const timestamp = data[i][config.columns.TIMESTAMP];
      const volunteer = data[i][config.columns.VOLUNTEER]?.toString().trim();
      const status = data[i][config.columns.STATUS]?.toString().trim();

      if (!timestamp || !volunteer || !status) continue;
      if (!config.activeStatuses.some(as => as.toLowerCase() === status.toLowerCase())) continue;

      const minutesAgo = Math.floor((now - new Date(timestamp)) / 60000);

      output.push({
        volunteer,
        timestamp: Utilities.formatDate(new Date(timestamp), Session.getScriptTimeZone(), 'M/d/yyyy HH:mm'),
        status: status.toLowerCase(),
        minutesAgo,
        rawTimestamp: new Date(timestamp).getTime()
      });
    }

    // Sort by time waited (descending: oldest first)
    output.sort((a, b) => b.minutesAgo - a.minutesAgo);

    return output;
  }, `getLive${requestType}Requests`);
}
