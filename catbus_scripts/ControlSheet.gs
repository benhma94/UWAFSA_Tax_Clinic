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
      
      // Read all columns starting from TIMESTAMP to ensure correct mapping
      // Columns: TIMESTAMP (0), CLIENT_ID (1), VOLUNTEER (2), COMPLETED (3)
      const data = sheet.getRange(startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1, 
                                   checkRows, 4).getValues();
      
      for (let i = 0; i < data.length; i++) {
        const client = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
        const volunteer = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
        const completed = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
        
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
        // Read all columns starting from TIMESTAMP to ensure correct mapping
        const olderData = sheet.getRange(2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1, 
                                          olderRows, 4).getValues();
        for (let i = 0; i < olderData.length; i++) {
          const client = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
          const volunteer = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
          const completed = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
          
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
    
    // Trim and validate client ID
    const trimmedClient = client.trim();
    if (!validateClientID(trimmedClient)) {
      Logger.log(`Invalid client ID format: "${client}" (trimmed: "${trimmedClient}")`);
      throw new Error(`Invalid client ID format: "${trimmedClient}". Expected format: A001 (one letter followed by 3 digits).`);
    }
    
    // Use trimmed client ID for the rest of the function
    const clientID = trimmedClient;
    
    // Batch validation: Collect all errors first, then fail with all errors at once
    const validationErrors = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      
      if (!validateTaxYear(row.taxYear)) {
        validationErrors.push(`Row ${rowNum}: Invalid tax year "${row.taxYear}"`);
      }
      // Reviewer not required at submission - will be set during review
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
      
      // Read all columns starting from TIMESTAMP to ensure correct mapping
      // Columns: TIMESTAMP (0), CLIENT_ID (1), VOLUNTEER (2), COMPLETED (3)
      const assignData = assignSheet.getRange(startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1, 
                                               checkRows, 4).getValues();
      
      for (let i = 0; i < assignData.length; i++) {
        const c = assignData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
        const v = assignData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
        
        Logger.log(`Checking assignment ${i}: Volunteer="${v}", Client="${c}" vs looking for Volunteer="${volunteer}", Client="${clientID}"`);
        
        // Compare trimmed values
        if (v === volunteer && c === clientID) {
          const rowNum = startRow + i;
          assignSheet.getRange(rowNum, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED + 1)
            .setValue('Complete');
          marked = true;
          Logger.log(`Found and marked assignment at row ${rowNum}`);
          break;
        }
      }
      
      // If not found in recent rows, check older rows (unlikely but possible)
      if (!marked && lastRow > CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK) {
        const olderRows = lastRow - CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK;
        // Read all columns starting from TIMESTAMP to ensure correct mapping
        const olderData = assignSheet.getRange(2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1, 
                                               olderRows, 4).getValues();
        for (let i = 0; i < olderData.length; i++) {
          const c = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
          const v = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
          
          Logger.log(`Checking older assignment ${i}: Volunteer="${v}", Client="${c}" vs looking for Volunteer="${volunteer}", Client="${clientID}"`);
          
          if (v === volunteer && c === clientID) {
            const rowNum = i + 2;
            assignSheet.getRange(rowNum, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED + 1)
              .setValue('Complete');
            marked = true;
            Logger.log(`Found and marked older assignment at row ${rowNum}`);
            break;
          }
        }
      }
    }
    
    if (!marked) {
      Logger.log(`Assignment not found - Volunteer: "${volunteer}", Client: "${clientID}"`);
      throw new Error(`Assignment not found for volunteer ${volunteer} and client ${clientID}`);
    }
    
    // 2. Append tax year data directly to 'Tax Return Tracker'
    const trackerSheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
    
    if (!trackerSheet) {
      throw new Error('Tax Return Tracker sheet not found');
    }
    
    // Extract just the volunteer's actual name (remove "Station X –" prefix if present)
    const volunteerNameOnly = volunteer.includes('–') 
      ? volunteer.split('–')[1].trim() 
      : volunteer.trim();
    
    const toAppend = rows.map(r => [
      new Date(),
      sanitizeInput(volunteerNameOnly, 100),
      sanitizeInput(clientID, 10),
      sanitizeInput(r.taxYear, 10),
      sanitizeInput(r.reviewer || '', 100), // Reviewer name
      sanitizeInput(r.secondaryReviewer || '', 100),
      r.married ? 'Yes' : 'No',
      r.efile ? 'Yes' : '',
      r.paper ? 'Yes' : '',
      r.incomplete ? 'Yes' : ''
    ]);
    
    Logger.log(`Finalizing ${toAppend.length} returns for volunteer ${volunteer}, client ${clientID}`);
    Logger.log(`Data to append: ${JSON.stringify(toAppend)}`);
    
    if (toAppend.length > 0) {
      const lastRow = trackerSheet.getLastRow();
      const startRow = lastRow + 1;
      const numRows = toAppend.length;
      const numCols = toAppend[0].length;
      
      Logger.log(`Writing to Tax Return Tracker: row ${startRow}, ${numRows} rows, ${numCols} cols`);
      
      try {
        trackerSheet.getRange(startRow, 1, numRows, numCols).setValues(toAppend);
        Logger.log(`Successfully wrote ${numRows} rows to Tax Return Tracker`);
      } catch (writeError) {
        Logger.log(`Error writing to Tax Return Tracker: ${writeError.message}`);
        throw new Error(`Failed to write to Tax Return Tracker: ${writeError.message}`);
      }
    } else {
      Logger.log('Warning: No rows to append to Tax Return Tracker');
      throw new Error('No tax year data to append');
    }
    
    logAudit('Returns Finalized', `Volunteer: ${volunteer}, Client: ${clientID}, Years: ${rows.map(r => r.taxYear).join(', ')}`);
    return true;
  }, 'finalizeReturnsAndStore');
}

/**
 * Cancels a client and marks returns as incomplete in Tax Return Tracker
 * @param {string} volunteer - Volunteer name
 * @param {string} client - Client ID
 * @param {Array} rows - Array of tax year data with cancellation reason
 * @returns {boolean} True if successful
 */
function cancelClientAndStore(volunteer, client, rows) {
  return safeExecute(() => {
    if (!volunteer || !client || !rows || rows.length === 0) {
      throw new Error('Volunteer, client, and at least one tax year are required');
    }
    
    // Trim and validate client ID
    const trimmedClient = client.trim();
    if (!validateClientID(trimmedClient)) {
      Logger.log(`Invalid client ID format: "${client}" (trimmed: "${trimmedClient}")`);
      throw new Error(`Invalid client ID format: "${trimmedClient}". Expected format: A001 (one letter followed by 3 digits).`);
    }
    
    const clientID = trimmedClient;
    
    // Validate rows
    const validationErrors = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      
      if (!validateTaxYear(row.taxYear)) {
        validationErrors.push(`Row ${rowNum}: Invalid tax year "${row.taxYear}"`);
      }
      if (!row.taxYear) {
        validationErrors.push(`Row ${rowNum}: Tax year is required`);
      }
    }
    
    if (validationErrors.length > 0) {
      throw new Error(`Validation errors:\n${validationErrors.join('\n')}`);
    }
    
    // Mark client as Complete in 'Client Assignment' (same as finalization)
    const assignSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    const lastRow = assignSheet.getLastRow();
    
    let marked = false;
    if (lastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK, lastRow - 1);
      const startRow = Math.max(2, lastRow - checkRows + 1);
      
      const assignData = assignSheet.getRange(startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1, 
                                               checkRows, 4).getValues();
      
      for (let i = 0; i < assignData.length; i++) {
        const c = assignData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
        const v = assignData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
        
        if (v === volunteer && c === clientID) {
          const rowNum = startRow + i;
          assignSheet.getRange(rowNum, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED + 1)
            .setValue('Complete');
          marked = true;
          Logger.log(`Found and marked assignment at row ${rowNum} for cancellation`);
          break;
        }
      }
      
      // Check older rows if needed
      if (!marked && lastRow > CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK) {
        const olderRows = lastRow - CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK;
        const olderData = assignSheet.getRange(2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1, 
                                               olderRows, 4).getValues();
        for (let i = 0; i < olderData.length; i++) {
          const c = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
          const v = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
          
          if (v === volunteer && c === clientID) {
            const rowNum = i + 2;
            assignSheet.getRange(rowNum, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED + 1)
              .setValue('Complete');
            marked = true;
            Logger.log(`Found and marked older assignment at row ${rowNum} for cancellation`);
            break;
          }
        }
      }
    }
    
    if (!marked) {
      Logger.log(`Assignment not found - Volunteer: "${volunteer}", Client: "${clientID}"`);
      // Don't throw error - still record the cancellation
      Logger.log('Proceeding with cancellation recording despite assignment not found');
    }
    
    // Append to 'Tax Return Tracker' with INCOMPLETE='Yes'
    const trackerSheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
    
    if (!trackerSheet) {
      throw new Error('Tax Return Tracker sheet not found');
    }
    
    // Get cancellation reason from first row (all rows should have the same reason)
    const cancellationReason = rows[0].reason || 'Client cancelled';
    
    // Append to Tax Return Tracker with INCOMPLETE='Yes'
    // Format: TIMESTAMP, VOLUNTEER, CLIENT_ID, TAX_YEAR, REVIEWER, SECONDARY_REVIEWER, MARRIED, EFILE, PAPER, INCOMPLETE
    // Store cancellation reason in REVIEWER column as "CANCELLED: [reason]"
    
    // Extract just the volunteer's actual name (remove "Station X –" prefix if present)
    const volunteerNameOnly = volunteer.includes('–') 
      ? volunteer.split('–')[1].trim() 
      : volunteer.trim();
    
    const toAppend = rows.map(r => [
      new Date(),
      sanitizeInput(volunteerNameOnly, 100),
      sanitizeInput(clientID, 10),
      sanitizeInput(r.taxYear, 10),
      `CANCELLED: ${sanitizeInput(cancellationReason, 100)}`, // Store cancellation reason in Reviewer column
      '', // SECONDARY_REVIEWER = empty
      r.married ? 'Yes' : 'No',
      '', // EFILE = empty
      '', // PAPER = empty
      'Yes' // INCOMPLETE = Yes
    ]);
    
    Logger.log(`Cancelling ${toAppend.length} returns for volunteer ${volunteer}, client ${clientID}`);
    Logger.log(`Cancellation reason: ${cancellationReason}`);
    Logger.log(`Data to append: ${JSON.stringify(toAppend)}`);
    
    if (toAppend.length > 0) {
      const lastRow = trackerSheet.getLastRow();
      const startRow = lastRow + 1;
      const numRows = toAppend.length;
      const numCols = toAppend[0].length; // Should be 10 columns
      
      Logger.log(`Writing to Tax Return Tracker: row ${startRow}, ${numRows} rows, ${numCols} cols`);
      
      try {
        trackerSheet.getRange(startRow, 1, numRows, numCols).setValues(toAppend);
        Logger.log(`Successfully wrote ${numRows} rows to Tax Return Tracker`);
      } catch (writeError) {
        Logger.log(`Error writing to Tax Return Tracker: ${writeError.message}`);
        throw new Error(`Failed to write to Tax Return Tracker: ${writeError.message}`);
      }
    } else {
      Logger.log('Warning: No rows to append to Tax Return Tracker');
      throw new Error('No tax year data to append');
    }
    
    logAudit('Client Cancelled', `Volunteer: ${volunteer}, Client: ${clientID}, Years: ${rows.map(r => r.taxYear).join(', ')}, Reason: ${cancellationReason}`);
    return true;
  }, 'cancelClientAndStore');
}
