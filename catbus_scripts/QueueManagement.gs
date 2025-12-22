/**
 * Queue Management Functions
 * Functions for managing the client queue and assignments
 */

/**
 * Gets the current client queue (unassigned clients)
 * Optimized to read only necessary data instead of entire sheets
 * @returns {Array<Object>} Array of client queue objects
 */
function getClientQueue() {
  return safeExecute(() => {
    const intakeSheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
    const assignmentSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    
    // Optimization: Only read rows that have data
    const intakeLastRow = intakeSheet.getLastRow();
    const assignmentLastRow = assignmentSheet.getLastRow();
    
    // Read only necessary columns: Timestamp (0), Client ID (5), Priority (7), Documents (8)
    const intakeData = intakeLastRow > 1
      ? intakeSheet.getRange(2, 1, intakeLastRow - 1, 8).getValues()
      : [];

    // Build set of assigned client IDs - only read if there are assignments
    const assignedClientIds = new Set();
    if (assignmentLastRow > 1) {
      const assignmentData = assignmentSheet.getRange(2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID + 1,
                                                      assignmentLastRow - 1, 1).getValues();
      assignmentData.forEach(row => {
        const clientId = row[0]?.toString().trim();
        if (clientId) assignedClientIds.add(clientId);
      });
    }

    const queue = [];
    const now = new Date();

    for (let i = 0; i < intakeData.length; i++) {
      const timestamp = intakeData[i][CONFIG.COLUMNS.CLIENT_INTAKE.TIMESTAMP];
      const clientId = intakeData[i][CONFIG.COLUMNS.CLIENT_INTAKE.CLIENT_ID]?.toString().trim();
      const isHighPriority = intakeData[i][CONFIG.COLUMNS.CLIENT_INTAKE.IS_HIGH_PRIORITY] === true ||
                            intakeData[i][CONFIG.COLUMNS.CLIENT_INTAKE.IS_HIGH_PRIORITY]?.toString().toLowerCase() === 'true';

      if (clientId && !assignedClientIds.has(clientId)) {
        queue.push({
          clientId,
          waitTime: formatElapsedTime(now - new Date(timestamp)),
          isHighPriority: isHighPriority,
          row: i + 2 // +2 because we start from row 2 (1-indexed)
        });
      }
    }
    
    return queue;
  }, 'getClientQueue');
}

/**
 * Assigns a client to a volunteer
 * Optimized to check only recent assignments instead of entire sheet
 * Enforces rule: Each volunteer can only have ONE active client at a time
 * @param {string} clientId - Client ID
 * @param {string} volunteerName - Volunteer name
 * @returns {boolean} True if successful
 */
function assignClientToVolunteer(clientId, volunteerName) {
  return safeExecute(() => {
    // Sanitize inputs
    clientId = sanitizeInput(clientId, 10);
    volunteerName = sanitizeInput(volunteerName, 100);
    
    if (!clientId || !volunteerName) {
      throw new Error('Client ID and volunteer name are required');
    }
    
    if (!validateClientID(clientId)) {
      throw new Error(`Invalid client ID format: ${clientId}`);
    }
    
    const intakeSheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
    const assignmentSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    
    // Optimization: Only read client ID column to verify existence
    const intakeLastRow = intakeSheet.getLastRow();
    let found = false;
    if (intakeLastRow > 1) {
      const clientIdCol = CONFIG.COLUMNS.CLIENT_INTAKE.CLIENT_ID + 1;
      const intakeData = intakeSheet.getRange(2, clientIdCol, intakeLastRow - 1, 1).getValues();
      for (let i = 0; i < intakeData.length; i++) {
        const currentClientId = intakeData[i][0]?.toString().trim();
        if (currentClientId === clientId) {
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      throw new Error(`Client ID ${clientId} not found in intake`);
    }
    
    // Optimization: Check only recent assignments (last N rows) for conflicts
    // Most assignments are recent, so this is much faster than reading entire sheet
    // IMPORTANT: Each volunteer can only have ONE active client at a time
    const assignmentLastRow = assignmentSheet.getLastRow();
    if (assignmentLastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK, assignmentLastRow - 1);
      const startRow = Math.max(2, assignmentLastRow - checkRows + 1);
      // Read Volunteer, Client ID, and Completed columns
      const assignmentData = assignmentSheet.getRange(startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER, 
                                                       checkRows, 3).getValues();
      
      for (let i = 0; i < assignmentData.length; i++) {
        const assignedVolunteer = assignmentData[i][0]?.toString().trim();
        const assignedClient = assignmentData[i][1]?.toString().trim();
        const completed = assignmentData[i][2]?.toString().trim().toLowerCase();
        
        // Check if client is already assigned to someone else
        if (assignedClient === clientId && completed !== 'complete') {
          throw new Error(`Client ${clientId} is already assigned to ${assignedVolunteer}`);
        }
        
        // IMPORTANT: Check if volunteer already has an active client (one client at a time rule)
        if (assignedVolunteer === volunteerName && completed !== 'complete') {
          throw new Error(`${volunteerName} is already assigned to client ${assignedClient}. Please complete that assignment first.`);
        }
      }
      
      // If not found in recent rows, check older rows for volunteer's active assignment
      if (assignmentLastRow > CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK) {
        const olderRows = assignmentLastRow - CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK;
        const olderData = assignmentSheet.getRange(2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER, 
                                                    olderRows, 3).getValues();
        for (let i = 0; i < olderData.length; i++) {
          const assignedVolunteer = olderData[i][0]?.toString().trim();
          const completed = olderData[i][2]?.toString().trim().toLowerCase();
          
          if (assignedVolunteer === volunteerName && completed !== 'complete') {
            const assignedClient = olderData[i][1]?.toString().trim();
            throw new Error(`${volunteerName} is already assigned to client ${assignedClient}. Please complete that assignment first.`);
          }
        }
      }
    }
    
    // Log assignment
    assignmentSheet.appendRow([
      new Date(),
      clientId,
      volunteerName
    ]);

    // Invalidate cache since queue data changed
    invalidateMultiple([
      CACHE_CONFIG.KEYS.QUEUE,
      CACHE_CONFIG.KEYS.VOLUNTEER_LIST
    ]);

    logAudit('Client Assigned', `Client: ${clientId}, Volunteer: ${volunteerName}`);
    return true;
  }, 'assignClientToVolunteer');
}

/**
 * Gets available volunteers (signed in today, not signed out, not mentors/receptionists)
 * Optimized to read only necessary data
 * @returns {Array<string>} Array of volunteer names in format "Station X – Name"
 */
function getAvailableVolunteers() {
  return safeExecute(() => {
    const volunteerSheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    const signOutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
    const assignmentSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    
    // Optimization: Only read rows that have data
    const volunteerLastRow = volunteerSheet.getLastRow();
    const signOutLastRow = signOutSheet.getLastRow();
    const assignmentLastRow = assignmentSheet.getLastRow();
    
    // Read columns: Timestamp (0), Name (1), Station (2), SessionId (3), Role (4) if exists
    const volunteerData = volunteerLastRow > 1
      ? volunteerSheet.getRange(2, 1, volunteerLastRow - 1, 5).getValues()
      : [];
    
    const signOutData = signOutLastRow > 1
      ? signOutSheet.getRange(2, 1, signOutLastRow - 1, 3).getValues()
      : [];
    
    // Build set of currently busy volunteers - only check recent assignments
    const busyVolunteers = new Set();
    if (assignmentLastRow > 1) {
      // Only check last N assignments (most are recent)
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK, assignmentLastRow - 1);
      const startRow = Math.max(2, assignmentLastRow - checkRows + 1);
      const assignmentData = assignmentSheet.getRange(startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER + 1, 
                                                       checkRows, 2).getValues();
      
      assignmentData.forEach(row => {
        const completed = row[1]?.toString().trim().toLowerCase();
        if (completed !== 'complete') {
          const label = row[0]?.toString() || '';
          const name = label.includes('–') 
            ? label.split('–')[1].trim() 
            : label.trim();
          if (name) busyVolunteers.add(name);
        }
      });
    }
    
    const today = new Date().toDateString();
    const activeVolunteers = [];
    
    for (let i = 0; i < volunteerData.length; i++) {
      const signInDate = new Date(volunteerData[i][0]).toDateString();
      const name = volunteerData[i][1]?.toString().trim();
      const station = volunteerData[i][2]?.toString().trim();
      const sessionId = volunteerData[i][3]?.toString().trim();
      const role = volunteerData[i][4]?.toString().trim().toLowerCase() || '';
      
      if (!name || !station || !sessionId) continue;
      // Exclude mentors, senior mentors, and receptionists
      // Check both station and role fields
      const stationLower = station.toLowerCase();
      if (stationLower === 'mentor' || 
          stationLower === 'senior mentor' || 
          stationLower.includes('senior') ||
          stationLower === 'receptionist' ||
          role === 'mentor' ||
          role === 'senior mentor' ||
          role.includes('senior')) continue;
      if (signInDate !== today) continue;
      
      // Check if signed out
      const signedOut = signOutData.some(row => {
        const outId = row[2]?.toString().trim();
        return outId === sessionId;
      });
      
      if (signedOut) continue;
      if (busyVolunteers.has(name)) continue;
      
      activeVolunteers.push(`Station ${station} – ${name}`);
    }
    
    return activeVolunteers.sort((a, b) => {
      const getNum = s => parseInt(s.split('–')[0].replace('Station', '').trim());
      return getNum(a) - getNum(b);
    });
  }, 'getAvailableVolunteers');
}

/**
 * Gets queue data including clients and volunteers
 * @returns {Object} Object with clients and volunteers arrays
 */
function getQueueData() {
  return safeExecute(() => {
    return {
      clients: getClientQueue(),
      volunteers: getAvailableVolunteers()
    };
  }, 'getQueueData');
}

/**
 * Removes a client from the queue before they are assigned
 * Records cancellation in Tax Return Tracker with INCOMPLETE status
 * @param {string} clientId - Client ID to remove
 * @param {string} reason - Reason for removal
 * @returns {Object} Object with success status and message
 */
function removeClientFromQueue(clientId, reason) {
  return safeExecute(() => {
    // Sanitize inputs
    clientId = sanitizeInput(clientId, 10);
    reason = sanitizeInput(reason, 500);

    if (!clientId || !reason) {
      return {success: false, message: 'Client ID and reason are required'};
    }

    if (!validateClientID(clientId)) {
      return {success: false, message: `Invalid client ID format: ${clientId}`};
    }

    const intakeSheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
    const assignmentSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    const trackerSheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);

    // Verify client exists in intake sheet
    const intakeLastRow = intakeSheet.getLastRow();
    let clientFound = false;

    if (intakeLastRow > 1) {
      const clientIdCol = CONFIG.COLUMNS.CLIENT_INTAKE.CLIENT_ID + 1;
      const intakeData = intakeSheet.getRange(2, clientIdCol, intakeLastRow - 1, 1).getValues();
      for (let i = 0; i < intakeData.length; i++) {
        const currentClientId = intakeData[i][0]?.toString().trim();
        if (currentClientId === clientId) {
          clientFound = true;
          break;
        }
      }
    }

    if (!clientFound) {
      return {success: false, message: 'Client not found'};
    }

    // Check if client is already assigned
    const assignmentLastRow = assignmentSheet.getLastRow();
    if (assignmentLastRow > 1) {
      const assignmentData = assignmentSheet.getRange(2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID + 1,
                                                      assignmentLastRow - 1, 2).getValues();
      for (let i = 0; i < assignmentData.length; i++) {
        const assignedClient = assignmentData[i][0]?.toString().trim();
        const completed = assignmentData[i][1]?.toString().trim().toLowerCase();

        if (assignedClient === clientId && completed !== 'complete') {
          return {success: false, message: 'Cannot remove assigned client'};
        }
      }
    }

    // Record removal in Tax Return Tracker with INCOMPLETE status
    trackerSheet.appendRow([
      new Date(),                          // Timestamp
      'Reception',                         // Volunteer
      clientId,                            // Client ID
      '',                                  // Tax Year (empty)
      '',                                  // Reviewer (empty)
      '',                                  // Secondary Reviewer (empty)
      '',                                  // Married (empty)
      '',                                  // E-file (empty)
      '',                                  // Paper (empty)
      'Yes',                               // INCOMPLETE
      'REMOVED FROM QUEUE: ' + reason      // Notes/Reason
    ]);

    // Invalidate cache
    invalidateMultiple([
      CACHE_CONFIG.KEYS.QUEUE,
      CACHE_CONFIG.KEYS.VOLUNTEER_LIST
    ]);

    // Log audit
    logAudit('Queue Removal', `Client: ${clientId}, Reason: ${reason}`);

    return {success: true, message: 'Client removed from queue'};
  }, 'removeClientFromQueue');
}
