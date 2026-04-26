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
      ? readSheetData(intakeSheet, 8, 2, 1, intakeLastRow - 1)
      : [];

    // Build set of actively assigned client IDs - only read if there are assignments
    const assignedClientIds = new Set();
    if (assignmentLastRow > 1) {
      const assignmentData = readSheetData(assignmentSheet, 3, 2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID + 1, assignmentLastRow - 1);
      assignmentData.forEach(row => {
        const clientId = row[0]?.toString().trim();
        const completed = row[2]?.toString().trim().toLowerCase();
        if (clientId && completed !== 'unassigned') assignedClientIds.add(clientId);
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
 * Builds a consistent response payload for queue assignment operations.
 * @param {boolean} success - Whether the operation succeeded
 * @param {string} message - User-facing result message
 * @param {string} [conflictType] - Optional conflict type identifier
 * @returns {{success: boolean, message: string, conflict: boolean, conflictType: string}}
 */
function buildAssignmentResponse_(success, message, conflictType) {
  return {
    success: !!success,
    message: message || '',
    conflict: !success,
    conflictType: conflictType || ''
  };
}

/**
 * Assigns a client to a volunteer
 * Optimized to check only recent assignments instead of entire sheet
 * Enforces rule: Each volunteer can only have ONE active client at a time
 * @param {string} clientId - Client ID
 * @param {string} volunteerName - Volunteer name
 * @returns {{success: boolean, message: string, conflict: boolean, conflictType: string}}
 */
function assignClientToVolunteer(clientId, volunteerName) {
  return safeExecute(() => {
    // Sanitize inputs
    clientId = sanitizeInput(clientId, 10);
    volunteerName = sanitizeInput(volunteerName, 100);
    
    if (!clientId || !volunteerName) {
      return buildAssignmentResponse_(false, 'Client ID and volunteer name are required', 'validation_error');
    }
    
    if (!validateClientID(clientId)) {
      return buildAssignmentResponse_(false, `Invalid client ID format: ${clientId}`, 'validation_error');
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
        const intakeData = readSheetData(intakeSheet, 1, 2, clientIdCol, intakeLastRow - 1);
        for (let i = 0; i < intakeData.length; i++) {
          const currentClientId = intakeData[i][0]?.toString().trim();
          if (currentClientId === clientId) {
            found = true;
            break;
          }
        }
      }

      if (!found) {
        return buildAssignmentResponse_(false, `Client ID ${clientId} not found in intake`, 'client_not_found');
      }

      // Check all assignments for conflicts (single read, scan from most recent)
      // IMPORTANT: Each volunteer can only have ONE active client at a time
      const assignmentLastRow = assignmentSheet.getLastRow();
      if (assignmentLastRow > 1) {
        const numRows = assignmentLastRow - 1;
        const assignmentData = readSheetData(assignmentSheet, 3, 2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID + 1, numRows);

        for (let i = assignmentData.length - 1; i >= 0; i--) {
          const assignedClient = assignmentData[i][0]?.toString().trim();
          const assignedVolunteer = assignmentData[i][1]?.toString().trim();
          const completed = assignmentData[i][2]?.toString().trim().toLowerCase();

          if (completed) continue;

          // Check if client is already assigned to someone else
          if (assignedClient === clientId) {
            return buildAssignmentResponse_(false, `Client ${clientId} is already assigned to ${assignedVolunteer}`, 'client_already_assigned');
          }

          // Check if volunteer already has an active client (one client at a time rule)
          if (assignedVolunteer === volunteerName) {
            return buildAssignmentResponse_(
              false,
              `${volunteerName} is already assigned to client ${assignedClient}. Please complete that assignment first.`,
              'volunteer_busy'
            );
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
    bumpAssignmentRevision_();

    return buildAssignmentResponse_(true, `Client ${clientId} has been assigned to ${volunteerName}.`);
  }, 'assignClientToVolunteer');
}

/**
 * Reads the Shift Schedule sheet and returns a map of volunteerName (lowercase) → [slotKeys]
 * for today's clinic date. Returns an empty object if the sheet is missing or today is not a clinic day.
 */
function buildTodayShiftMap() {
  try {
    const sheet = getSpreadsheet().getSheetByName(CONFIG.SHEETS.SCHEDULE_OUTPUT);
    if (!sheet || sheet.getLastRow() < 4) return {};

    // Row 1: headers ['Time / Day', Day1Label, Day2Label, Day3Label, Day4Label]
    // Rows 2-4: slot A, B, C data (comma-separated volunteer names per day)
    const data = readSheetData(sheet, 5, 1, 1, 4);
    const headers = data[0];

    // Find which column matches today
    const todayLabel = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'EEEE, MMMM d, yyyy');
    let todayColIndex = -1;
    for (let col = 1; col <= 4; col++) {
      if (headers[col] && headers[col].toString().trim() === todayLabel) {
        todayColIndex = col;
        break;
      }
    }
    if (todayColIndex === -1) return {};

    // Build map: lowercaseName → [slotKeys]
    const slotKeys = ['A', 'B', 'C'];
    const shiftMap = {};
    for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
      const cellValue = data[slotIdx + 1][todayColIndex] || '';
      const names = cellValue.split(',').map(n => n.trim()).filter(Boolean);
      for (const name of names) {
        const key = name.toLowerCase();
        if (!shiftMap[key]) shiftMap[key] = [];
        shiftMap[key].push(slotKeys[slotIdx]);
      }
    }
    return shiftMap;
  } catch (e) {
    Logger.log('buildTodayShiftMap error (non-fatal): ' + e.message);
    return {};
  }
}

/**
 * Returns true if the current time is within 30 minutes of the end of the volunteer's
 * last scheduled slot for today. Uses SCHEDULE_CONFIG.TIME_SLOTS for end times.
 */
function isNearShiftEnd(slots) {
  if (!slots || slots.length === 0) return false;

  const slotOrder = { 'A': 0, 'B': 1, 'C': 2 };
  const lastSlot = slots.slice().sort((a, b) => slotOrder[a] - slotOrder[b]).pop();

  const endStr = SCHEDULE_CONFIG.TIME_SLOTS[lastSlot].end; // e.g. '1:15'
  const [rawHour, rawMin] = endStr.split(':').map(Number);
  // Hours < 9 are PM (clinic runs 9:45 AM – 8:00 PM)
  const endHour = rawHour < 9 ? rawHour + 12 : rawHour;

  const now = new Date();
  const shiftEnd = new Date(now);
  shiftEnd.setHours(endHour, rawMin, 0, 0);

  return (shiftEnd - now) <= 30 * 60 * 1000;
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
      ? readSheetData(volunteerSheet, 5, 2, 1, volunteerLastRow - 1)
      : [];

    // Read only SESSION_ID column from sign-out
    const signOutData = signOutLastRow > 1
      ? readSheetData(signOutSheet, 1, 2, CONFIG.COLUMNS.SIGNOUT.SESSION_ID + 1, signOutLastRow - 1)
      : [];
    const signedOutIds = new Set(signOutData.map(row => row[0]?.toString().trim()).filter(Boolean));

    // Build busy-volunteer set from recent assignment rows.
    // Read all 4 columns (Timestamp, ClientID, Volunteer, Completed) starting from col A.
    const today = new Date().toDateString();
    const now = new Date();
    const busyVolunteers = new Set();
    if (assignmentLastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK, assignmentLastRow - 1);
      const startRow = Math.max(2, assignmentLastRow - checkRows + 1);
      // Read from col 1 (Timestamp) through col 4 (Completed)
      const assignmentData = readSheetData(assignmentSheet, 4, startRow, 1, checkRows);

      assignmentData.forEach(row => {
        const label     = row[CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString() || '';
        const completed = row[CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
        const name = label.includes('–') ? label.split('–')[1].trim() : label.trim();
        if (!name) return;
        if (!completed) {
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
      // Read Timestamp, Volunteer, and up to Incomplete in one batch read
      const numCols = CONFIG.COLUMNS.TAX_RETURN_TRACKER.INCOMPLETE + 1;
      const trackerData = readSheetData(trackerSheet, numCols, 2, 1, trackerLastRow - 1);
      for (let i = 0; i < trackerData.length; i++) {
        const ts         = trackerData[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.TIMESTAMP];
        const name       = trackerData[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.VOLUNTEER]?.toString().trim();
        const incomplete = trackerData[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.INCOMPLETE]?.toString().trim().toLowerCase();
        if (!name || !ts) continue;
        if (new Date(ts).toDateString() === today && incomplete !== 'yes') {
          completedCountMap[name] = (completedCountMap[name] || 0) + 1;
        }
      }
    }

    // Build shift map for near-end-of-shift filtering
    const todayShiftMap = buildTodayShiftMap();

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

      if (signedOutIds.has(sessionId)) continue;
      if (busyVolunteers.has(name)) continue;
      if (onBreak === 'yes') continue;

      // Exclude volunteers within 30 min of their last shift end (if schedule data exists)
      const scheduledSlots = todayShiftMap[name.toLowerCase()];
      if (scheduledSlots && isNearShiftEnd(scheduledSlots)) continue;

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
    const data = readSheetData(sheet, 5, 2, 1, lastRow - 1);

    const signOutData = signOutSheet.getLastRow() > 1
      ? readSheetData(signOutSheet, 3, 2, 1, signOutSheet.getLastRow() - 1)
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
    setCellValue(sheet, sheetRow, CONFIG.COLUMNS.VOLUNTEER_LIST.ON_BREAK, isOnBreak ? 'yes' : '');

    // Invalidate caches so queue and control sheet reflect the change immediately
    invalidateMultiple([
      CACHE_CONFIG.KEYS.QUEUE,
      CACHE_CONFIG.KEYS.VOLUNTEERS_AND_CLIENTS,
      CACHE_CONFIG.KEYS.VOLUNTEER_LIST
    ]);

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
      const volunteerData = readSheetData(volunteerSheet, 4, 2, 1, volunteerLastRow - 1);
      const signOutData = signOutLastRow > 1
        ? readSheetData(signOutSheet, 3, 2, 1, signOutLastRow - 1)
        : [];
      const signedOutIds = new Set(signOutData.map(r => r[2]?.toString().trim()).filter(Boolean));

      const nonFilerStations = CONFIG.SIGN_IN_OUT.NON_FILER_STATIONS;
      volunteerData.forEach(row => {
        const ts        = row[CONFIG.COLUMNS.VOLUNTEER_LIST.TIMESTAMP];
        const name      = row[CONFIG.COLUMNS.VOLUNTEER_LIST.NAME]?.toString().trim();
        const station   = row[CONFIG.COLUMNS.VOLUNTEER_LIST.STATION]?.toString().trim();
        const sessionId = row[CONFIG.COLUMNS.VOLUNTEER_LIST.SESSION_ID]?.toString().trim();
        if (!name || !sessionId) return;
        if (new Date(ts).toDateString() !== today) return;
        if (station && nonFilerStations.some(r => station.toLowerCase() === r)) return;
        if (!signedOutIds.has(sessionId)) activeVolunteerNames.add(name);
      });
    }

    // Build priority map from intake
    const priorityMap = {};
    const intakeLastRow = intakeSheet.getLastRow();
    if (intakeLastRow > 1) {
      const intakeData = readSheetData(intakeSheet, 8, 2, 1, intakeLastRow - 1);
      intakeData.forEach(row => {
        const cId = row[CONFIG.COLUMNS.CLIENT_INTAKE.CLIENT_ID]?.toString().trim();
        const isPriority = row[CONFIG.COLUMNS.CLIENT_INTAKE.IS_HIGH_PRIORITY] === true ||
                           row[CONFIG.COLUMNS.CLIENT_INTAKE.IS_HIGH_PRIORITY]?.toString().toLowerCase() === 'true';
        if (cId) priorityMap[cId] = isPriority;
      });
    }

    const now = new Date();
    const active = [];
    const assignmentData = readSheetData(assignmentSheet, 4, 2, 1, assignmentLastRow - 1);
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
 * Updates the existing assignment row in-place (volunteer name + timestamp).
 * @param {string} clientId - Client ID to reassign
 * @param {string} newVolunteerName - New volunteer name (display text)
 * @returns {{success: boolean, message: string, conflict: boolean, conflictType: string}}
 */
function reassignClientToVolunteer(clientId, newVolunteerName) {
  return safeExecute(() => {
    clientId = sanitizeInput(clientId, 10);
    newVolunteerName = sanitizeInput(newVolunteerName, 100);

    if (!clientId || !newVolunteerName) {
      return buildAssignmentResponse_(false, 'Client ID and volunteer name are required', 'validation_error');
    }

    if (!validateClientID(clientId)) {
      return buildAssignmentResponse_(false, `Invalid client ID format: ${clientId}`, 'validation_error');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const assignmentSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
      const assignmentLastRow = assignmentSheet.getLastRow();

      if (assignmentLastRow <= 1) {
        return buildAssignmentResponse_(false, `Client ${clientId} is not currently assigned`, 'assignment_not_found');
      }

      const assignmentData = getSheetData(CONFIG.SHEETS.CLIENT_ASSIGNMENT, 4, 2, 1);

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
        return buildAssignmentResponse_(false, `Client ${clientId} is not currently assigned`, 'assignment_not_found');
      }

      // Check that the new volunteer isn't already busy with another client
      for (let i = 0; i < assignmentData.length; i++) {
        const assignedVolunteer = assignmentData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
        const completed = assignmentData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
        if (assignedVolunteer === newVolunteerName && !completed) {
          const busyClient = assignmentData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
          return buildAssignmentResponse_(false, `${newVolunteerName} is already assigned to client ${busyClient}`, 'volunteer_busy');
        }
      }

      // Update only the VOLUNTEER column in-place, preserving the original assignment
      // timestamp. This keeps the graph's time-series accurate (the client has been
      // "in progress" since the original assignment, regardless of which volunteer has them).
      const rowNumber = activeRowIndex + 2; // +2: skip header (row 1) + 0-indexed
      setCellValue(assignmentSheet, rowNumber, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER, newVolunteerName);
    } finally {
      lock.releaseLock();
    }

    invalidateMultiple([
      CACHE_CONFIG.KEYS.QUEUE,
      CACHE_CONFIG.KEYS.VOLUNTEER_LIST,
      CACHE_CONFIG.KEYS.VOLUNTEERS_AND_CLIENTS
    ]);
    bumpAssignmentRevision_();

    return buildAssignmentResponse_(true, `Client ${clientId} has been reassigned to ${newVolunteerName}`);
  }, 'reassignClientToVolunteer');
}

/**
 * Unassigns a client from their current volunteer and returns them to the queue.
 * Preserves assignment history by marking the row unassigned.
 * @param {string} clientId - Client ID to unassign
 * @returns {{success: boolean, message: string, conflict: boolean, conflictType: string}}
 */
function unassignClient(clientId) {
  return safeExecute(() => {
    clientId = sanitizeInput(clientId, 10);

    if (!clientId) {
      return buildAssignmentResponse_(false, 'Client ID is required', 'validation_error');
    }

    if (!validateClientID(clientId)) {
      return buildAssignmentResponse_(false, `Invalid client ID format: ${clientId}`, 'validation_error');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const assignmentSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
      const assignmentLastRow = assignmentSheet.getLastRow();

      if (assignmentLastRow <= 1) {
        return buildAssignmentResponse_(false, `Client ${clientId} is not currently assigned`, 'assignment_not_found');
      }

      const assignmentData = getSheetData(CONFIG.SHEETS.CLIENT_ASSIGNMENT, 4, 2, 1);

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
        return buildAssignmentResponse_(false, `Client ${clientId} is not currently assigned`, 'assignment_not_found');
      }

      const rowNumber = activeRowIndex + 2;
      setCellValue(assignmentSheet, rowNumber, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED, 'unassigned');
    } finally {
      lock.releaseLock();
    }

    invalidateMultiple([
      CACHE_CONFIG.KEYS.QUEUE,
      CACHE_CONFIG.KEYS.VOLUNTEER_LIST,
      CACHE_CONFIG.KEYS.VOLUNTEERS_AND_CLIENTS
    ]);
    bumpAssignmentRevision_();

    return buildAssignmentResponse_(true, `Client ${clientId} has been returned to the queue`);
  }, 'unassignClient');
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
      const intakeData = readSheetData(intakeSheet, 1, 2, clientIdCol, intakeLastRow - 1);
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
      const assignmentData = readSheetData(assignmentSheet, 2, 2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID + 1, assignmentLastRow - 1);
      for (let i = 0; i < assignmentData.length; i++) {
        const assignedClient = assignmentData[i][0]?.toString().trim();
        const completed = assignmentData[i][1]?.toString().trim().toLowerCase();

        if (assignedClient === clientId && completed !== 'complete' && completed !== 'reassigned' && completed !== 'unassigned') {
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
      CACHE_CONFIG.KEYS.VOLUNTEER_LIST,
      CACHE_CONFIG.KEYS.VOLUNTEERS_AND_CLIENTS
    ]);
    bumpAssignmentRevision_();

    return {success: true, message: 'Client removed from queue'};
  }, 'removeClientFromQueue');
}
