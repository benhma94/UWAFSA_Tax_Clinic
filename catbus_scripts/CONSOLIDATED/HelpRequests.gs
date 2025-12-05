/**
 * Help Request Functions
 * Consolidated help request management functions
 */

/**
 * Sends a help request for a volunteer
 * Optimized to check only recent requests instead of entire sheet
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function sendHelpRequest(volunteer) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) {
      throw new Error('Volunteer name is required');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.HELP_REQUESTS);
    const lastRow = sheet.getLastRow();
    
    // Optimization: Only check last N requests (most are recent)
    if (lastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_HELP_REQUESTS_TO_CHECK, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const data = sheet.getRange(startRow, CONFIG.COLUMNS.HELP_REQUESTS.VOLUNTEER + 1, checkRows, 2).getValues();
      
      // Check from most recent backwards
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i][0] === volunteer && data[i][1] === CONFIG.HELP_STATUS.ACTIVE) {
          // Already has active request
          return true;
        }
      }
    }
    
    // Add new help request
    sheet.appendRow([
      new Date(),
      volunteer,
      CONFIG.HELP_STATUS.ACTIVE
    ]);
    
    logAudit('Help Request Sent', `Volunteer: ${volunteer}`);
    return true;
  }, 'sendHelpRequest');
}

/**
 * Clears a help request for a volunteer
 * Optimized to check only recent requests instead of entire sheet
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function clearHelpRequest(volunteer) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) {
      throw new Error('Volunteer name is required');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.HELP_REQUESTS);
    const lastRow = sheet.getLastRow();
    
    // Optimization: Only check last N requests (most are recent)
    if (lastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_HELP_REQUESTS_TO_CHECK, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const data = sheet.getRange(startRow, CONFIG.COLUMNS.HELP_REQUESTS.VOLUNTEER + 1, 
                                   checkRows, 2).getValues();
      
      // Check from most recent backwards
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i][0]?.toString().trim();
        const status = data[i][1]?.toString().trim().toLowerCase();
        
        if (v === volunteer && 
            (status === CONFIG.HELP_STATUS.ACTIVE.toLowerCase() || 
             status === CONFIG.HELP_STATUS.ESCALATED.toLowerCase())) {
          const rowNum = startRow + i;
          sheet.getRange(rowNum, CONFIG.COLUMNS.HELP_REQUESTS.STATUS + 1)
            .setValue(CONFIG.HELP_STATUS.CLEARED);
          logAudit('Help Request Cleared', `Volunteer: ${volunteer}`);
          return true;
        }
      }
      
      // If not found in recent rows, check older rows (unlikely but possible)
      if (lastRow > CONFIG.PERFORMANCE.RECENT_HELP_REQUESTS_TO_CHECK) {
        const olderRows = lastRow - CONFIG.PERFORMANCE.RECENT_HELP_REQUESTS_TO_CHECK;
        const olderData = sheet.getRange(2, CONFIG.COLUMNS.HELP_REQUESTS.VOLUNTEER + 1, 
                                          olderRows, 2).getValues();
        for (let i = olderData.length - 1; i >= 0; i--) {
          const v = olderData[i][0]?.toString().trim();
          const status = olderData[i][1]?.toString().trim().toLowerCase();
          
          if (v === volunteer && 
              (status === CONFIG.HELP_STATUS.ACTIVE.toLowerCase() || 
               status === CONFIG.HELP_STATUS.ESCALATED.toLowerCase())) {
            const rowNum = i + 2;
            sheet.getRange(rowNum, CONFIG.COLUMNS.HELP_REQUESTS.STATUS + 1)
              .setValue(CONFIG.HELP_STATUS.CLEARED);
            logAudit('Help Request Cleared', `Volunteer: ${volunteer}`);
            return true;
          }
        }
      }
    }
    
    return true; // Already cleared or doesn't exist
  }, 'clearHelpRequest');
}

/**
 * Escalates a help request for a volunteer
 * Optimized to check only recent requests instead of entire sheet
 * @param {string} volunteer - Volunteer name
 * @returns {boolean} True if successful
 */
function escalateHelpRequest(volunteer) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) {
      throw new Error('Volunteer name is required');
    }
    
    const sheet = getSheet(CONFIG.SHEETS.HELP_REQUESTS);
    const lastRow = sheet.getLastRow();
    
    // Optimization: Only check last N requests (most are recent)
    if (lastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_HELP_REQUESTS_TO_CHECK, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const data = sheet.getRange(startRow, CONFIG.COLUMNS.HELP_REQUESTS.VOLUNTEER + 1, 
                                   checkRows, 2).getValues();
      
      // Check from most recent backwards
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i][0]?.toString().trim();
        const status = data[i][1]?.toString().trim().toLowerCase();
        
        if (v === volunteer && status === CONFIG.HELP_STATUS.ACTIVE.toLowerCase()) {
          const rowNum = startRow + i;
          sheet.getRange(rowNum, CONFIG.COLUMNS.HELP_REQUESTS.STATUS + 1)
            .setValue(CONFIG.HELP_STATUS.ESCALATED);
          logAudit('Help Request Escalated', `Volunteer: ${volunteer}`);
          return true;
        }
      }
      
      // If not found in recent rows, check older rows (unlikely but possible)
      if (lastRow > CONFIG.PERFORMANCE.RECENT_HELP_REQUESTS_TO_CHECK) {
        const olderRows = lastRow - CONFIG.PERFORMANCE.RECENT_HELP_REQUESTS_TO_CHECK;
        const olderData = sheet.getRange(2, CONFIG.COLUMNS.HELP_REQUESTS.VOLUNTEER + 1, 
                                          olderRows, 2).getValues();
        for (let i = olderData.length - 1; i >= 0; i--) {
          const v = olderData[i][0]?.toString().trim();
          const status = olderData[i][1]?.toString().trim().toLowerCase();
          
          if (v === volunteer && status === CONFIG.HELP_STATUS.ACTIVE.toLowerCase()) {
            const rowNum = i + 2;
            sheet.getRange(rowNum, CONFIG.COLUMNS.HELP_REQUESTS.STATUS + 1)
              .setValue(CONFIG.HELP_STATUS.ESCALATED);
            logAudit('Help Request Escalated', `Volunteer: ${volunteer}`);
            return true;
          }
        }
      }
    }
    
    return false; // No active request found
  }, 'escalateHelpRequest');
}

/**
 * Gets the current help status for a volunteer
 * Optimized to check only recent requests
 * @param {string} volunteer - Volunteer name
 * @returns {string} Status: "active", "escalated", or "cleared"
 */
function getHelpStatus(volunteer) {
  return safeExecute(() => {
    volunteer = sanitizeInput(volunteer, 100);
    if (!volunteer) {
      return CONFIG.HELP_STATUS.CLEARED.toLowerCase();
    }
    
    const sheet = getSheet(CONFIG.SHEETS.HELP_REQUESTS);
    const lastRow = sheet.getLastRow();
    
    // Optimization: Only check last N requests (most are recent)
    if (lastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_HELP_REQUESTS_TO_CHECK, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const data = sheet.getRange(startRow, CONFIG.COLUMNS.HELP_REQUESTS.VOLUNTEER + 1, checkRows, 2).getValues();
      
      // Check from most recent to oldest
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i][0]?.toString().trim();
        const status = data[i][1]?.toString().trim().toLowerCase();
        
        if (v === volunteer && 
            (status === CONFIG.HELP_STATUS.ACTIVE.toLowerCase() || 
             status === CONFIG.HELP_STATUS.ESCALATED.toLowerCase())) {
          return status;
        }
      }
    }
    
    return CONFIG.HELP_STATUS.CLEARED.toLowerCase();
  }, 'getHelpStatus');
}

/**
 * Gets all currently active or escalated help requests
 * Optimized to read only necessary columns
 * @returns {Array<Object>} Array of help request objects
 */
function getLiveHelpRequests() {
  return safeExecute(() => {
    const sheet = getSheet(CONFIG.SHEETS.HELP_REQUESTS);
    const lastRow = sheet.getLastRow();
    
    // Optimization: Only read rows with data and only necessary columns
    const data = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, 3).getValues()
      : [];
    
    const now = new Date();
    const output = [];

    for (let i = 0; i < data.length; i++) {
      const timestamp = data[i][CONFIG.COLUMNS.HELP_REQUESTS.TIMESTAMP];
      const volunteer = data[i][CONFIG.COLUMNS.HELP_REQUESTS.VOLUNTEER]?.toString().trim();
      const status = data[i][CONFIG.COLUMNS.HELP_REQUESTS.STATUS]?.toString().trim().toLowerCase();

      if (!timestamp || !volunteer || !status) continue;
      if (status !== CONFIG.HELP_STATUS.ACTIVE.toLowerCase() && 
          status !== CONFIG.HELP_STATUS.ESCALATED.toLowerCase()) continue;

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
  }, 'getLiveHelpRequests');
}
