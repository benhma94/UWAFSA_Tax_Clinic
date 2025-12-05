/**
 * Control Sheet Functions
 * Functions for the volunteer control sheet
 */

/**
 * Returns a mapping of volunteer names to their assigned (but not completed) client
 * Optimized to read only recent assignments (last N rows) for better performance with 100 volunteers
 * Note: Each volunteer can only have ONE active client at a time
 * @returns {Object} Object mapping volunteer names to arrays of client IDs (array for backward compatibility)
 */
function getVolunteersAndClients() {
  return safeExecute(() => {
    const sheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    const lastRow = sheet.getLastRow();
    
    // Optimization: Only read last N assignments (most are recent and active)
    // This dramatically reduces API calls when 100 volunteers are accessing
    // Since each volunteer has only one client, we use direct mapping internally
    const volunteerToClient = {}; // Single client per volunteer
    
    if (lastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      
      // Read only necessary columns: Volunteer (2), Client ID (1), Completed (3)
      const data = sheet.getRange(startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER, 
                                   checkRows, 3).getValues();
      
      for (let i = 0; i < data.length; i++) {
        const volunteer = data[i][0]?.toString().trim();
        const client = data[i][1]?.toString().trim();
        const completed = data[i][2]?.toString().trim().toLowerCase();
        
        if (volunteer && client && completed !== 'complete') {
          // Since each volunteer has only one client, we can use direct assignment
          // If somehow there are duplicates, the last one found will be used
          // (but the assignment function should prevent this)
          volunteerToClient[volunteer] = client;
        }
      }
      
      // Check older rows if needed (unlikely but possible)
      if (lastRow > CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK) {
        const olderRows = lastRow - CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK;
        const olderData = sheet.getRange(2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER, 
                                          olderRows, 3).getValues();
        for (let i = 0; i < olderData.length; i++) {
          const volunteer = olderData[i][0]?.toString().trim();
          const client = olderData[i][1]?.toString().trim();
          const completed = olderData[i][2]?.toString().trim().toLowerCase();
          
          // Only add if not already found in recent rows
          if (volunteer && client && completed !== 'complete' && !volunteerToClient[volunteer]) {
            volunteerToClient[volunteer] = client;
          }
        }
      }
    }
    
    // Convert to array format for backward compatibility with existing HTML/JS code
    // HTML expects arrays, so we'll convert single client to array
    const volunteerToClients = {};
    for (const [volunteer, client] of Object.entries(volunteerToClient)) {
      volunteerToClients[volunteer] = [client];
    }
    
    return volunteerToClients;
  }, 'getVolunteersAndClients');
}

/**
 * Gets client intake information by client ID
 * Optimized to search from bottom up (most recent clients first) and read only necessary columns
 * @param {string} clientID - Client ID
 * @returns {Object|null} Client intake info or null if not found
 */
function getClientIntakeInfo(clientID) {
  return safeExecute(() => {
    if (!validateClientID(clientID)) {
      return null;
    }
    
    const sheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return null;
    }
    
    // Optimization: Search from bottom up (most recent clients first)
    // Read only necessary columns: Client ID (5), Filing Years (2), Situations (3), Notes (4), Needs Senior Review (6)
    const clientIdCol = CONFIG.COLUMNS.CLIENT_INTAKE.CLIENT_ID + 1;
    const numRows = lastRow - 1;
    
    // Read Client ID column first to find the row
    const clientIdData = sheet.getRange(2, clientIdCol, numRows, 1).getValues();
    
    // Search from bottom up (most recent first)
    for (let i = clientIdData.length - 1; i >= 0; i--) {
      const id = clientIdData[i][0]?.toString().trim();
      
      if (id === clientID) {
        // Found it! Now read only the necessary columns for this row
        const rowNum = i + 2; // +2 because we start from row 2
        const rowData = sheet.getRange(rowNum, CONFIG.COLUMNS.CLIENT_INTAKE.FILING_YEARS + 1, 1, 5).getValues()[0];
        
        const needsSeniorReview = rowData[4] === true || 
                                  rowData[4]?.toString().toLowerCase() === 'true';
        const filingYears = rowData[0]?.toString().split(',').map(y => y.trim()) || [];
        const situations = rowData[1]?.toString().split(',').map(s => s.trim()) || [];
        const notes = rowData[2]?.toString().trim() || '';
        
        return {
          filingYears: filingYears,
          situations: situations,
          notes: notes,
          needsSeniorReview: needsSeniorReview
        };
      }
    }
    
    return null;
  }, 'getClientIntakeInfo');
}

/**
 * Returns a sorted list of mentor names from Volunteer List (signed in today)
 * Optimized with caching (30-60 second TTL) to reduce API calls when 100 volunteers access
 * @returns {Object} Object with reviewers and seniors arrays
 */
function getMentorList() {
  return safeExecute(() => {
    const cacheKey = 'mentorList';
    const cacheExpiryKey = 'mentorListExpiry';
    const cacheTTL = CONFIG.PERFORMANCE.MENTOR_LIST_CACHE_TTL;
    
    // Try to use cache, but fall back to direct read if cache fails
    let useCache = true;
    let cached = null;
    let expiry = null;
    
    try {
      const properties = PropertiesService.getScriptProperties();
      cached = properties.getProperty(cacheKey);
      expiry = properties.getProperty(cacheExpiryKey);
      
      // Check if cache is valid
      if (cached && expiry) {
        const now = new Date().getTime();
        const expiryTime = parseInt(expiry);
        if (now < expiryTime) {
          // Cache is valid, return cached data
          return JSON.parse(cached);
        }
      }
    } catch (cacheError) {
      // Cache service failed, fall back to direct read
      Logger.log(`Cache error in getMentorList: ${cacheError.message}`);
      useCache = false;
    }
    
    // Cache expired or doesn't exist, fetch fresh data
    const volunteerSheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    const lastRow = volunteerSheet.getLastRow();
    
    if (lastRow <= 1) {
      const emptyResult = { reviewers: [], seniors: [] };
      // Try to cache empty result, but don't fail if cache fails
      if (useCache) {
        try {
          const properties = PropertiesService.getScriptProperties();
          properties.setProperty(cacheKey, JSON.stringify(emptyResult));
          properties.setProperty(cacheExpiryKey, (new Date().getTime() + cacheTTL * 1000).toString());
        } catch (cacheError) {
          Logger.log(`Cache write error (non-fatal): ${cacheError.message}`);
        }
      }
      return emptyResult;
    }
    
    // Optimization: Only read necessary columns (Timestamp, Name, Role)
    const data = volunteerSheet.getRange(2, 1, lastRow - 1, 3).getValues();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const mentorsToday = new Set();
    const seniorMentorsToday = new Set();
    
    for (let i = 0; i < data.length; i++) {
      const timestamp = data[i][0]; // Column A: Timestamp
      const name = data[i][1]?.toString().trim();
      const role = data[i][2]?.toString().trim().toLowerCase();
      
      if (name && timestamp instanceof Date) {
        const signedInDate = new Date(timestamp);
        signedInDate.setHours(0, 0, 0, 0);
        
        const isToday = signedInDate.getTime() === today.getTime();
        
        if (isToday) {
          if (role === 'mentor') mentorsToday.add(name);
          if (role === 'senior mentor') seniorMentorsToday.add(name);
        }
      }
    }
    
    const allReviewers = new Set([...mentorsToday, ...seniorMentorsToday]);
    
    const result = {
      reviewers: [...allReviewers].sort(),
      seniors: [...seniorMentorsToday].sort()
    };
    
    // Try to cache the result, but don't fail if cache fails
    if (useCache) {
      try {
        const properties = PropertiesService.getScriptProperties();
        properties.setProperty(cacheKey, JSON.stringify(result));
        properties.setProperty(cacheExpiryKey, (new Date().getTime() + cacheTTL * 1000).toString());
      } catch (cacheError) {
        Logger.log(`Cache write error (non-fatal): ${cacheError.message}`);
        // Continue without caching - function still works
      }
    }
    
    return result;
  }, 'getMentorList');
}

/**
 * Finalizes returns and stores per-tax-year data to the tracker
 * @param {string} volunteer - Volunteer name
 * @param {string} client - Client ID
 * @param {Array<Object>} rows - Array of tax year data objects
 * @returns {boolean} True if successful
 */
function finalizeReturnsAndStore(volunteer, client, rows) {
  return safeExecute(() => {
    if (!volunteer || !client || !rows || rows.length === 0) {
      throw new Error('Volunteer, client, and at least one tax year are required');
    }
    
    if (!validateClientID(client)) {
      throw new Error(`Invalid client ID format: ${client}`);
    }
    
    // Batch validation: Collect all errors first, then fail with all errors at once
    const validationErrors = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      
      if (!validateTaxYear(row.taxYear)) {
        validationErrors.push(`Row ${rowNum}: Invalid tax year "${row.taxYear}"`);
      }
      if (!row.reviewer || !row.reviewer.trim()) {
        validationErrors.push(`Row ${rowNum}: Reviewer is required`);
      }
      if (!row.taxYear) {
        validationErrors.push(`Row ${rowNum}: Tax year is required`);
      }
    }
    
    // If there are validation errors, throw with all errors at once
    if (validationErrors.length > 0) {
      throw new Error(`Validation errors:\n${validationErrors.join('\n')}`);
    }
    
    // 1. Mark client as Complete in 'Client Assignment'
    const assignSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    const lastRow = assignSheet.getLastRow();
    
    let marked = false;
    if (lastRow > 1) {
      // Optimization: Check only recent assignments (last N rows) - most are recent
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      const assignData = assignSheet.getRange(startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER, 
                                               checkRows, 2).getValues();
      
      for (let i = 0; i < assignData.length; i++) {
        const v = assignData[i][0]?.toString().trim();
        const c = assignData[i][1]?.toString().trim();
        
        if (v === volunteer && c === client) {
          const rowNum = startRow + i;
          assignSheet.getRange(rowNum, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED + 1)
            .setValue('Complete');
          marked = true;
          break;
        }
      }
      
      // If not found in recent rows, check older rows (unlikely but possible)
      if (!marked && lastRow > CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK) {
        const olderRows = lastRow - CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK;
        const olderData = assignSheet.getRange(2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER, 
                                                 olderRows, 2).getValues();
        for (let i = 0; i < olderData.length; i++) {
          const v = olderData[i][0]?.toString().trim();
          const c = olderData[i][1]?.toString().trim();
          
          if (v === volunteer && c === client) {
            const rowNum = i + 2;
            assignSheet.getRange(rowNum, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED + 1)
              .setValue('Complete');
            marked = true;
            break;
          }
        }
      }
    }
    
    if (!marked) {
      throw new Error(`Assignment not found for volunteer ${volunteer} and client ${client}`);
    }
    
    // 2. Append tax year data to 'Tax Return Tracker'
    const trackerSheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
    const toAppend = rows.map(r => [
      new Date(),
      sanitizeInput(volunteer, 100),
      sanitizeInput(client, 10),
      sanitizeInput(r.taxYear, 10),
      sanitizeInput(r.reviewer, 100),
      sanitizeInput(r.secondaryReviewer || '', 100),
      r.married ? 'Yes' : 'No',
      r.efile ? 'Yes' : '',
      r.paper ? 'Yes' : '',
      r.incomplete ? 'Yes' : ''
    ]);
    
    if (toAppend.length > 0) {
      trackerSheet.getRange(
        trackerSheet.getLastRow() + 1,
        1,
        toAppend.length,
        toAppend[0].length
      ).setValues(toAppend);
    }
    
    logAudit('Returns Finalized', `Volunteer: ${volunteer}, Client: ${client}, Years: ${rows.map(r => r.taxYear).join(', ')}`);
    return true;
  }, 'finalizeReturnsAndStore');
}
