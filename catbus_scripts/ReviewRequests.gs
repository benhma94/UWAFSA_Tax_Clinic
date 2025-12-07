/**
 * Review Request Functions
 * Consolidated review request management functions
 * Simplified to track by volunteer only (like help requests)
 */

/**
 * Sends a review request for a volunteer
 * Optimized to check only recent requests instead of entire sheet
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function sendReviewRequest(volunteer) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) {
      throw new Error('Volunteer name is required');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.REVIEW_REQUESTS);
    const lastRow = sheet.getLastRow();
    
    // Optimization: Only check last N requests (most are recent)
    if (lastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const data = sheet.getRange(startRow, CONFIG.COLUMNS.REVIEW_REQUESTS.VOLUNTEER + 1, checkRows, 2).getValues();
      
      // Check from most recent backwards for existing requested review
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i][0]?.toString().trim();
        const status = data[i][1]?.toString().trim().toLowerCase();
        
        if (v === volunteer && status === CONFIG.REVIEW_STATUS.REQUESTED.toLowerCase()) {
          // Already has active request
          return true;
        }
      }
    }
    
    // Add new review request
    sheet.appendRow([
      new Date(),
      volunteer,
      CONFIG.REVIEW_STATUS.REQUESTED
    ]);
    
    logAudit('Review Request Sent', `Volunteer: ${volunteer}`);
    return true;
  }, 'sendReviewRequest');
}

/**
 * Cancels a review request for a volunteer
 * Optimized to check only recent requests instead of entire sheet
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function cancelReviewRequest(volunteer) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) {
      throw new Error('Volunteer name is required');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.REVIEW_REQUESTS);
    const lastRow = sheet.getLastRow();
    
    // Optimization: Only check last N requests (most are recent)
    if (lastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const data = sheet.getRange(startRow, CONFIG.COLUMNS.REVIEW_REQUESTS.VOLUNTEER + 1, 
                                   checkRows, 2).getValues();
      
      // Check from most recent backwards
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i][0]?.toString().trim();
        const status = data[i][1]?.toString().trim().toLowerCase();
        
        if (v === volunteer && status === CONFIG.REVIEW_STATUS.REQUESTED.toLowerCase()) {
          const rowNum = startRow + i;
          sheet.getRange(rowNum, CONFIG.COLUMNS.REVIEW_REQUESTS.STATUS + 1)
            .setValue(CONFIG.REVIEW_STATUS.CANCELLED);
          logAudit('Review Request Cancelled', `Volunteer: ${volunteer}`);
          return true;
        }
      }
      
      // If not found in recent rows, check older rows (unlikely but possible)
      if (lastRow > CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK) {
        const olderRows = lastRow - CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK;
        const olderData = sheet.getRange(2, CONFIG.COLUMNS.REVIEW_REQUESTS.VOLUNTEER + 1, 
                                          olderRows, 2).getValues();
        for (let i = olderData.length - 1; i >= 0; i--) {
          const v = olderData[i][0]?.toString().trim();
          const status = olderData[i][1]?.toString().trim().toLowerCase();
          
          if (v === volunteer && status === CONFIG.REVIEW_STATUS.REQUESTED.toLowerCase()) {
            const rowNum = i + 2;
            sheet.getRange(rowNum, CONFIG.COLUMNS.REVIEW_REQUESTS.STATUS + 1)
              .setValue(CONFIG.REVIEW_STATUS.CANCELLED);
            logAudit('Review Request Cancelled', `Volunteer: ${volunteer}`);
            return true;
          }
        }
      }
    }
    
    return true; // Already cancelled or doesn't exist
  }, 'cancelReviewRequest');
}

/**
 * Completes a review request for a volunteer
 * Optimized to check only recent requests instead of entire sheet
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function completeReviewRequest(volunteer) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) {
      throw new Error('Volunteer name is required');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.REVIEW_REQUESTS);
    const lastRow = sheet.getLastRow();
    
    // Optimization: Only check last N requests (most are recent)
    if (lastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const data = sheet.getRange(startRow, CONFIG.COLUMNS.REVIEW_REQUESTS.VOLUNTEER + 1, 
                                   checkRows, 2).getValues();
      
      // Check from most recent backwards
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i][0]?.toString().trim();
        const status = data[i][1]?.toString().trim().toLowerCase();
        
        if (v === volunteer && status === CONFIG.REVIEW_STATUS.REQUESTED.toLowerCase()) {
          const rowNum = startRow + i;
          sheet.getRange(rowNum, CONFIG.COLUMNS.REVIEW_REQUESTS.STATUS + 1)
            .setValue(CONFIG.REVIEW_STATUS.COMPLETED);
          logAudit('Review Request Completed', `Volunteer: ${volunteer}`);
          return true;
        }
      }
      
      // If not found in recent rows, check older rows (unlikely but possible)
      if (lastRow > CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK) {
        const olderRows = lastRow - CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK;
        const olderData = sheet.getRange(2, CONFIG.COLUMNS.REVIEW_REQUESTS.VOLUNTEER + 1, 
                                          olderRows, 2).getValues();
        for (let i = olderData.length - 1; i >= 0; i--) {
          const v = olderData[i][0]?.toString().trim();
          const status = olderData[i][1]?.toString().trim().toLowerCase();
          
          if (v === volunteer && status === CONFIG.REVIEW_STATUS.REQUESTED.toLowerCase()) {
            const rowNum = i + 2;
            sheet.getRange(rowNum, CONFIG.COLUMNS.REVIEW_REQUESTS.STATUS + 1)
              .setValue(CONFIG.REVIEW_STATUS.COMPLETED);
            logAudit('Review Request Completed', `Volunteer: ${volunteer}`);
            return true;
          }
        }
      }
    }
    
    return true; // Already completed or doesn't exist
  }, 'completeReviewRequest');
}

/**
 * Gets the current review request status for a volunteer
 * Optimized to check only recent requests
 * @param {string} volunteer - Volunteer name
 * @returns {string} Status: "requested", "completed", "cancelled", or ""
 */
function getReviewRequestStatus(volunteer) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) {
      return '';
    }
    
    const sheet = getSheet(CONFIG.SHEETS.REVIEW_REQUESTS);
    const lastRow = sheet.getLastRow();
    
    // Optimization: Only check last N requests (most are recent)
    if (lastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_REVIEW_REQUESTS_TO_CHECK, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const data = sheet.getRange(startRow, CONFIG.COLUMNS.REVIEW_REQUESTS.VOLUNTEER + 1, checkRows, 2).getValues();
      
      // Check from most recent to oldest
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i][0]?.toString().trim();
        const status = data[i][1]?.toString().trim().toLowerCase();
        
        if (v === volunteer && 
            (status === CONFIG.REVIEW_STATUS.REQUESTED.toLowerCase() || 
             status === CONFIG.REVIEW_STATUS.COMPLETED.toLowerCase())) {
          return status;
        }
      }
    }
    
    return '';
  }, 'getReviewRequestStatus');
}

/**
 * Gets all currently requested review requests
 * Optimized to read only necessary columns
 * @returns {Array<Object>} Array of review request objects
 */
function getLiveReviewRequests() {
  return safeExecute(() => {
    const sheet = getSheet(CONFIG.SHEETS.REVIEW_REQUESTS);
    const lastRow = sheet.getLastRow();
    
    // Optimization: Only read rows with data and only necessary columns
    const data = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, 3).getValues()
      : [];
    
    const now = new Date();
    const output = [];

    for (let i = 0; i < data.length; i++) {
      const timestamp = data[i][CONFIG.COLUMNS.REVIEW_REQUESTS.TIMESTAMP];
      const volunteer = data[i][CONFIG.COLUMNS.REVIEW_REQUESTS.VOLUNTEER]?.toString().trim();
      const status = data[i][CONFIG.COLUMNS.REVIEW_REQUESTS.STATUS]?.toString().trim().toLowerCase();

      if (!timestamp || !volunteer || !status) continue;
      if (status !== CONFIG.REVIEW_STATUS.REQUESTED.toLowerCase()) continue;

      const minutesAgo = Math.floor((now - new Date(timestamp)) / 60000);

      output.push({
        volunteer,
        timestamp: Utilities.formatDate(new Date(timestamp), Session.getScriptTimeZone(), 'M/d/yyyy HH:mm'),
        status,
        minutesAgo,
        rawTimestamp: new Date(timestamp).getTime()
      });
    }

    // Sort by time waited (descending: oldest first)
    output.sort((a, b) => b.minutesAgo - a.minutesAgo);

    return output;
  }, 'getLiveReviewRequests');
}
