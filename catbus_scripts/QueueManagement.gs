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

    // Lock to prevent race condition on concurrent assignment attempts
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
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
        const assignmentData = assignmentSheet.getRange(startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID + 1,
                                                         checkRows, 3).getValues();

        for (let i = 0; i < assignmentData.length; i++) {
          const assignedClient = assignmentData[i][0]?.toString().trim();
          const assignedVolunteer = assignmentData[i][1]?.toString().trim();
          const completed = assignmentData[i][2]?.toString().trim().toLowerCase();

          // Check if client is already assigned to someone else
          if (assignedClient === clientId && completed !== 'complete' && completed !== 'reassigned') {
            throw new Error(`Client ${clientId} is already assigned to ${assignedVolunteer}`);
          }

          // IMPORTANT: Check if volunteer already has an active client (one client at a time rule)
          if (assignedVolunteer === volunteerName && completed !== 'complete' && completed !== 'reassigned') {
            throw new Error(`${volunteerName} is already assigned to client ${assignedClient}. Please complete that assignment first.`);
          }
        }

        // If not found in recent rows, check older rows for volunteer's active assignment
        if (assignmentLastRow > CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK) {
          const olderRows = assignmentLastRow - CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK;
          const olderData = assignmentSheet.getRange(2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID + 1,
                                                      olderRows, 3).getValues();
          for (let i = 0; i < olderData.length; i++) {
            const assignedVolunteer = olderData[i][1]?.toString().trim();
            const completed = olderData[i][2]?.toString().trim().toLowerCase();

            if (assignedVolunteer === volunteerName && completed !== 'complete' && completed !== 'reassigned') {
              const assignedClient = olderData[i][0]?.toString().trim();
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
    } finally {
      lock.releaseLock();
    }

    // Invalidate cache since queue data changed
    invalidateMultiple([
      CACHE_CONFIG.KEYS.QUEUE,
      CACHE_CONFIG.KEYS.VOLUNTEER_LIST,
      CACHE_CONFIG.KEYS.VOLUNTEERS_AND_CLIENTS
    ]);

    return true;
  }, 'assignClientToVolunteer');
}

/**
 * Gets available volunteers (signed in today, not signed out, not mentors/receptionists)
 * Sorted by idle time (longest idle first) so queue managers prioritize waiting volunteers.
 * @returns {Array<Object>} Array of {name, station, displayText, idleMinutes}
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

    // Read columns: Timestamp (0), Name (1), Station (2), SessionId (3), ON_BREAK (4)
    const volunteerData = volunteerLastRow > 1
      ? volunteerSheet.getRange(2, 1, volunteerLastRow - 1, 5).getValues()
      : [];

    const signOutData = signOutLastRow > 1
      ? signOutSheet.getRange(2, 1, signOutLastRow - 1, 3).getValues()
      : [];

    // Build busy-volunteer set from recent assignment rows.
    // Read all 4 columns (Timestamp, ClientID, Volunteer, Completed) starting from col A.
    const today = new Date().toDateString();
    const now = new Date();
    const busyVolunteers = new Set();
    if (assignmentLastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK, assignmentLastRow - 1);
      const startRow = Math.max(2, assignmentLastRow - checkRows + 1);
      // Read from col 1 (Timestamp) through col 4 (Completed)
      const assignmentData = assignmentSheet.getRange(startRow, 1, checkRows, 4).getValues();

      assignmentData.forEach(row => {
        const label     = row[CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString() || '';
        const completed = row[CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
        const name = label.includes('–') ? label.split('–')[1].trim() : label.trim();
        if (!name) return;
        if (completed !== 'complete' && completed !== 'reassigned') {
          busyVolunteers.add(name);
        }
      });
    }

    // Count tax years filed today per volunteer from Tax Return Tracker.
    // Each tracker row = 1 tax year = 1 return (multiple rows per client are possible).
    const completedCountMap = {}; // volunteerName -> count of tax years filed today
    const trackerSheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
    const trackerLastRow = trackerSheet ? trackerSheet.getLastRow() : 0;
    if (trackerLastRow > 1) {
      // Read Timestamp (col 1), Volunteer (col 2), Incomplete (col 10)
      const numCols = CONFIG.COLUMNS.TAX_RETURN_TRACKER.INCOMPLETE + 1;
      const trackerData = trackerSheet.getRange(2, 1, trackerLastRow - 1, numCols).getValues();
      trackerData.forEach(row => {
        const ts         = row[CONFIG.COLUMNS.TAX_RETURN_TRACKER.TIMESTAMP];
        const name       = row[CONFIG.COLUMNS.TAX_RETURN_TRACKER.VOLUNTEER]?.toString().trim();
        const incomplete = row[CONFIG.COLUMNS.TAX_RETURN_TRACKER.INCOMPLETE]?.toString().trim().toLowerCase();
        if (!name || !ts) return;
        if (new Date(ts).toDateString() === today && incomplete !== 'yes') {
          completedCountMap[name] = (completedCountMap[name] || 0) + 1;
        }
      });
    }

    const activeVolunteers = [];

    for (let i = 0; i < volunteerData.length; i++) {
      const signInTimestamp = volunteerData[i][0];
      const signInDate = new Date(signInTimestamp).toDateString();
      const name = volunteerData[i][1]?.toString().trim();
      const station = volunteerData[i][2]?.toString().trim();
      const sessionId = volunteerData[i][3]?.toString().trim();
      const onBreak = volunteerData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.ON_BREAK]?.toString().trim().toLowerCase();

      if (!name || !station || !sessionId) continue;
      // Exclude non-filer stations (mentors, frontline, internal services)
      const stationLower = station.toLowerCase();
      const nonFilerStations = CONFIG.SIGN_IN_OUT.NON_FILER_STATIONS;
      if (nonFilerStations.some(r => stationLower === r)) continue;
      if (signInDate !== today) continue;

      // Check if signed out
      const signedOut = signOutData.some(row => {
        const outId = row[2]?.toString().trim();
        return outId === sessionId;
      });

      if (signedOut) continue;
      if (busyVolunteers.has(name)) continue;
      if (onBreak === 'yes') continue;

      activeVolunteers.push({
        name,
        station,
        displayText: `Station ${station} – ${name}`,
        returnsCompleted: completedCountMap[name] || 0
      });
    }

    // Sort by returns completed ascending (fewest first)
    return activeVolunteers.sort((a, b) => a.returnsCompleted - b.returnsCompleted);
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
      volunteers: getAvailableVolunteers(),
      activeAssignments: getActiveAssignments()
    };
  }, 'getQueueData');
}

/**
 * Sets or clears a volunteer's on-break status in the Volunteer List sheet.
 * Finds the volunteer's most recent active session for today and updates column E (ON_BREAK).
 * @param {string} volunteerName - Volunteer's name
 * @param {boolean} isOnBreak - true to go on break, false to return
 * @returns {{ success: boolean, isOnBreak: boolean }}
 */
function setVolunteerBreakStatus(volunteerName, isOnBreak) {
  return safeExecute(() => {
    if (!volunteerName || !volunteerName.trim()) throw new Error('Volunteer name is required');

    const sheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    const signOutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) throw new Error('No volunteers found');

    const today = new Date().toDateString();
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

    const signOutData = signOutSheet.getLastRow() > 1
      ? signOutSheet.getRange(2, 1, signOutSheet.getLastRow() - 1, 3).getValues()
      : [];
    const signedOutSessions = new Set(signOutData.map(r => r[CONFIG.COLUMNS.SIGNOUT.SESSION_ID]?.toString().trim()));

    const nameLower = volunteerName.trim().toLowerCase();
    let targetRowIndex = -1;

    // Find the most recent active session for this volunteer today
    for (let i = data.length - 1; i >= 0; i--) {
      const ts        = data[i][CONFIG.COLUMNS.VOLUNTEER_LIST.TIMESTAMP];
      const name      = data[i][CONFIG.COLUMNS.VOLUNTEER_LIST.NAME]?.toString().trim();
      const sessionId = data[i][CONFIG.COLUMNS.VOLUNTEER_LIST.SESSION_ID]?.toString().trim();
      if (new Date(ts).toDateString() !== today) continue;
      if (name.toLowerCase() !== nameLower) continue;
      if (signedOutSessions.has(sessionId)) continue;
      targetRowIndex = i;
      break;
    }

    if (targetRowIndex === -1) throw new Error(`No active sign-in found for ${volunteerName}`);

    const sheetRow = targetRowIndex + 2; // +1 for 0-index, +1 for header row
    sheet.getRange(sheetRow, CONFIG.COLUMNS.VOLUNTEER_LIST.ON_BREAK + 1).setValue(isOnBreak ? 'yes' : '');

    // Invalidate caches so queue and control sheet reflect the change immediately
    invalidateMultiple([CACHE_CONFIG.KEYS.VOLUNTEERS_AND_CLIENTS, CACHE_CONFIG.KEYS.VOLUNTEER_LIST]);

    Logger.log(`Break status for ${volunteerName}: ${isOnBreak ? 'ON BREAK' : 'AVAILABLE'}`);
    return { success: true, isOnBreak: isOnBreak };
  }, 'setVolunteerBreakStatus');
}

/**
 * Gets all currently active (unfinished) client assignments
 * @returns {Array<Object>} Array of {clientId, volunteerName, assignedAt, isHighPriority}
 */
function getActiveAssignments() {
  return safeExecute(() => {
    const assignmentSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    const intakeSheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
    const volunteerSheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    const signOutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
    const assignmentLastRow = assignmentSheet.getLastRow();

    if (assignmentLastRow <= 1) return [];

    // Build set of currently signed-in volunteers (signed in today, not signed out)
    const today = new Date().toDateString();
    const activeVolunteerNames = new Set();
    const volunteerLastRow = volunteerSheet.getLastRow();
    const signOutLastRow = signOutSheet.getLastRow();
    if (volunteerLastRow > 1) {
      const volunteerData = volunteerSheet.getRange(2, 1, volunteerLastRow - 1, 4).getValues();
      const signOutData = signOutLastRow > 1
        ? signOutSheet.getRange(2, 1, signOutLastRow - 1, 3).getValues()
        : [];
      const signedOutIds = new Set(signOutData.map(r => r[2]?.toString().trim()).filter(Boolean));

      volunteerData.forEach(row => {
        const ts        = row[CONFIG.COLUMNS.VOLUNTEER_LIST.TIMESTAMP];
        const name      = row[CONFIG.COLUMNS.VOLUNTEER_LIST.NAME]?.toString().trim();
        const sessionId = row[CONFIG.COLUMNS.VOLUNTEER_LIST.SESSION_ID]?.toString().trim();
        if (!name || !sessionId) return;
        if (new Date(ts).toDateString() !== today) return;
        if (!signedOutIds.has(sessionId)) activeVolunteerNames.add(name);
      });
    }

    // Build priority map from intake
    const priorityMap = {};
    const intakeLastRow = intakeSheet.getLastRow();
    if (intakeLastRow > 1) {
      const intakeData = intakeSheet.getRange(2, 1, intakeLastRow - 1, 8).getValues();
      intakeData.forEach(row => {
        const cId = row[CONFIG.COLUMNS.CLIENT_INTAKE.CLIENT_ID]?.toString().trim();
        const isPriority = row[CONFIG.COLUMNS.CLIENT_INTAKE.IS_HIGH_PRIORITY] === true ||
                           row[CONFIG.COLUMNS.CLIENT_INTAKE.IS_HIGH_PRIORITY]?.toString().toLowerCase() === 'true';
        if (cId) priorityMap[cId] = isPriority;
      });
    }

    const now = new Date();
    const active = [];
    const assignmentData = assignmentSheet.getRange(2, 1, assignmentLastRow - 1, 4).getValues();
    assignmentData.forEach(row => {
      const ts        = row[CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP];
      const clientId  = row[CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
      const volunteer = row[CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
      const completed = row[CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();

      // Extract bare name (remove "Station X –" prefix if present)
      const name = volunteer && volunteer.includes('–') ? volunteer.split('–')[1].trim() : volunteer;

      // Only show assignments where the volunteer is currently signed in
      if (clientId && volunteer && !completed && activeVolunteerNames.has(name)) {
        active.push({
          clientId,
          volunteerName: volunteer,
          assignedAt: ts ? formatElapsedTime(now - new Date(ts)) : 'Unknown',
          isHighPriority: priorityMap[clientId] || false
        });
      }
    });

    return active;
  }, 'getActiveAssignments');
}

/**
 * Reassigns an active client to a different volunteer
 * Marks the old assignment as "reassigned" (frees original volunteer, preserves audit trail)
 * and appends a new assignment row for the new volunteer.
 * @param {string} clientId - Client ID to reassign
 * @param {string} newVolunteerName - New volunteer name (display text)
 * @returns {Object} {success, message}
 */
function reassignClientToVolunteer(clientId, newVolunteerName) {
  return safeExecute(() => {
    clientId = sanitizeInput(clientId, 10);
    newVolunteerName = sanitizeInput(newVolunteerName, 100);

    if (!clientId || !newVolunteerName) {
      return { success: false, message: 'Client ID and volunteer name are required' };
    }

    if (!validateClientID(clientId)) {
      return { success: false, message: `Invalid client ID format: ${clientId}` };
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const assignmentSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
      const assignmentLastRow = assignmentSheet.getLastRow();

      if (assignmentLastRow <= 1) {
        return { success: false, message: `Client ${clientId} is not currently assigned` };
      }

      const assignmentData = assignmentSheet.getRange(2, 1, assignmentLastRow - 1, 4).getValues();

      // Find the active assignment row for this client
      let activeRowIndex = -1;
      for (let i = 0; i < assignmentData.length; i++) {
        const assignedClient = assignmentData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
        const completed = assignmentData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
        if (assignedClient === clientId && !completed) {
          activeRowIndex = i;
          break;
        }
      }

      if (activeRowIndex === -1) {
        return { success: false, message: `Client ${clientId} is not currently assigned` };
      }

      // Check that the new volunteer isn't already busy with another client
      for (let i = 0; i < assignmentData.length; i++) {
        const assignedVolunteer = assignmentData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
        const completed = assignmentData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
        if (assignedVolunteer === newVolunteerName && completed !== 'complete' && completed !== 'reassigned') {
          const busyClient = assignmentData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
          return { success: false, message: `${newVolunteerName} is already assigned to client ${busyClient}` };
        }
      }

      // Mark the old assignment as "reassigned" (frees the original volunteer)
      const oldRowNumber = activeRowIndex + 2; // +2: skip header (row 1) + 0-indexed
      assignmentSheet.getRange(oldRowNumber, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED + 1).setValue('reassigned');

      // Append new assignment for the new volunteer
      assignmentSheet.appendRow([
        new Date(),
        clientId,
        newVolunteerName
      ]);
    } finally {
      lock.releaseLock();
    }

    invalidateMultiple([
      CACHE_CONFIG.KEYS.QUEUE,
      CACHE_CONFIG.KEYS.VOLUNTEER_LIST,
      CACHE_CONFIG.KEYS.VOLUNTEERS_AND_CLIENTS
    ]);

    return { success: true, message: `Client ${clientId} has been reassigned to ${newVolunteerName}` };
  }, 'reassignClientToVolunteer');
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

        if (assignedClient === clientId && completed !== 'complete' && completed !== 'reassigned') {
          return {success: false, message: 'Cannot remove assigned client'};
        }
      }
    }

    // Add to assignment sheet to remove from queue (marked as complete so volunteer isn't blocked)
    assignmentSheet.appendRow([
      new Date(),                          // Timestamp
      clientId,                            // Client ID
      'REMOVED',                           // Volunteer (special marker)
      'complete'                           // Completed status
    ]);

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

    return {success: true, message: 'Client removed from queue'};
  }, 'removeClientFromQueue');
}
