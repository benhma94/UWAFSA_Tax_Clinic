/**
 * Volunteer Sign-In/Out Functions
 * Handles volunteer sign-in and sign-out functionality
 */

function buildVolunteerSessionState_() {
  const ss = getSpreadsheet();
  const signInSheet = ss.getSheetByName(CONFIG.SHEETS.VOLUNTEER_LIST);
  const signOutSheet = ss.getSheetByName(CONFIG.SHEETS.SIGNOUT);
  const cols = CONFIG.COLUMNS.VOLUNTEER_LIST;

  if (!signInSheet || !signOutSheet) {
    return {
      signInSheet,
      signOutSheet,
      signInData: [],
      signedOutIds: new Set(),
      activeStations: new Set(),
      activeSessions: [],
      activeSessionById: {},
      activeSessionByName: {}
    };
  }

  const signInData = signInSheet.getLastRow() > 1
    ? signInSheet.getRange(2, 1, signInSheet.getLastRow() - 1, cols.SESSION_ID + 1).getValues()
    : [];
  const signOutData = signOutSheet.getLastRow() > 1
    ? signOutSheet.getRange(2, CONFIG.COLUMNS.SIGNOUT.SESSION_ID + 1, signOutSheet.getLastRow() - 1, 1).getValues()
    : [];

  const signedOutIds = new Set(signOutData.map(row => row[0]?.toString().trim()).filter(Boolean));
  const exceptionStations = new Set(CONFIG.SIGN_IN_OUT.EXCEPTION_STATIONS);
  const activeStations = new Set();
  const activeSessions = [];
  const activeSessionById = {};
  const activeSessionByName = {};

  for (let i = 0; i < signInData.length; i++) {
    const timestamp = signInData[i][cols.TIMESTAMP];
    const name = signInData[i][cols.NAME]?.toString().trim();
    const station = signInData[i][cols.STATION]?.toString().trim();
    const sessionId = signInData[i][cols.SESSION_ID]?.toString().trim();
    if (!name || !sessionId || signedOutIds.has(sessionId)) continue;

    if (station && !exceptionStations.has(station)) {
      activeStations.add(station);
    }

    const time = Utilities.formatDate(new Date(timestamp), Session.getScriptTimeZone(), 'HH:mm');
    const session = {
      name,
      station: station || 'N/A',
      sessionId,
      timestamp,
      time,
      displayText: `${name} @ ${time} • Station ${station || 'N/A'}`
    };
    activeSessions.push(session);
    activeSessionById[sessionId] = session;
    activeSessionByName[name.toLowerCase()] = session;
  }

  activeSessions.sort((a, b) => a.name.localeCompare(b.name));

  return {
    signInSheet,
    signOutSheet,
    signInData,
    signedOutIds,
    activeStations,
    activeSessions,
    activeSessionById,
    activeSessionByName
  };
}

/**
 * Gets available stations (not currently in use today)
 * @returns {Array<string>} Array of available station names
 */
function getAvailableStations() {
  return safeExecute(() => {
    const stationList = Array.from({ length: CONFIG.SIGN_IN_OUT.STATION_COUNT }, (_, i) => (i + 1).toString());
    const exceptionStations = CONFIG.SIGN_IN_OUT.EXCEPTION_STATIONS;
    const sessionState = buildVolunteerSessionState_();

    if (!sessionState.signInSheet || !sessionState.signOutSheet) {
      return [...exceptionStations, ...stationList];
    }

    const availableStations = stationList.filter(s => !sessionState.activeStations.has(s));
    const sortedStations = availableStations.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    return [...exceptionStations, ...sortedStations];
  }, 'getAvailableStations');
}

/**
 * Gets active volunteer sessions (signed in but not signed out today)
 * @returns {Array<Object>} Array of active session objects with name, time, sessionId, and station
 */
function getActiveSessions() {
  return safeExecute(() => {
    const sessionState = buildVolunteerSessionState_();
    if (!sessionState.signInSheet || !sessionState.signOutSheet) return [];
    return sessionState.activeSessions;
  }, 'getActiveSessions');
}

/**
 * Signs in a volunteer
 * @param {string} volunteerName - Name of the volunteer
 * @param {string} station - Station number or exception station name
 * @returns {Object} Sign-in result with sessionId and timestamp
 */
function signInVolunteer(volunteerName, station) {
  return safeExecute(() => {
    if (!volunteerName || !volunteerName.trim()) {
      throw new Error('Volunteer name is required');
    }
    if (!station || !station.trim()) {
      throw new Error('Station is required');
    }

    const normalizedName = volunteerName.trim();
    const normalizedStation = station.trim();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sessionState = buildVolunteerSessionState_();
      const availableStations = [...CONFIG.SIGN_IN_OUT.EXCEPTION_STATIONS,
        ...Array.from({ length: CONFIG.SIGN_IN_OUT.STATION_COUNT }, (_, i) => (i + 1).toString())
          .filter(s => !sessionState.activeStations.has(s))
      ];

      if (!availableStations.includes(normalizedStation)) {
        throw new Error(`Station "${normalizedStation}" is not available. Please select another station.`);
      }

      const existingSession = sessionState.activeSessionByName[normalizedName.toLowerCase()];
      if (existingSession) {
        if (existingSession.station === 'Quiz') {
          throw new Error(`${normalizedName} is already signed in at the quiz station.`);
        }
        throw new Error(`${normalizedName} is already signed in. Please sign out first.`);
      }

      const sheet = getOrCreateSignInSheet_();
      const sessionId = Utilities.getUuid();
      const timestamp = new Date();

      sheet.appendRow([timestamp, normalizedName, normalizedStation, sessionId]);

      Logger.log(`Volunteer signed in: ${normalizedName} at station ${normalizedStation} (${sessionId})`);
      invalidateCache(CACHE_CONFIG.KEYS.MENTOR_LIST);

      return {
        success: true,
        sessionId,
        timestamp,
        volunteerName: normalizedName,
        station: normalizedStation
      };
    } finally {
      lock.releaseLock();
    }
  }, 'signInVolunteer');
}

/**
 * Signs out a volunteer by session ID
 * @param {string} sessionId - Session ID to sign out
 * @returns {Object} Sign-out result
 */
function signOutVolunteer(sessionId) {
  return safeExecute(() => {
    if (!sessionId || !sessionId.trim()) {
      throw new Error('Session ID is required');
    }

    const sessionState = buildVolunteerSessionState_();
    const session = sessionState.activeSessionById[sessionId.trim()];
    if (!session) {
      throw new Error('Session ID not found. Please check and try again.');
    }

    const signOutSheet = getOrCreateSignOutSheet_();
    const timestamp = new Date();
    signOutSheet.appendRow([timestamp, session.name || sessionId, sessionId.trim()]);

    Logger.log(`Volunteer signed out: ${session.name} (${sessionId})`);
    invalidateCache(CACHE_CONFIG.KEYS.MENTOR_LIST);

    return {
      success: true,
      sessionId: sessionId.trim(),
      timestamp,
      volunteerName: session.name
    };
  }, 'signOutVolunteer');
}

/**
 * Gets or creates the Volunteer List (sign-in) sheet with headers.
 * @returns {Sheet}
 */
function getOrCreateSignInSheet_() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.VOLUNTEER_LIST);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    sheet.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Name', 'Station', 'Session ID']]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    Logger.log('Created Volunteer List sheet');
  }
  return sheet;
}

/**
 * Gets or creates the SignOut sheet with headers.
 * @returns {Sheet}
 */
function getOrCreateSignOutSheet_() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.SIGNOUT);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.SIGNOUT);
    sheet.getRange(1, 1, 1, 3).setValues([['Timestamp', 'Volunteer', 'Session ID']]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    Logger.log('Created SignOut sheet');
  }
  return sheet;
}

/**
 * Gets current sign-in statistics
 * @returns {Object} Statistics about current sign-ins
 */
function getSignInStats() {
  return safeExecute(() => {
    const activeSessions = getActiveSessions();
    const availableStations = getAvailableStations();
    const regularStations = availableStations.filter(s => !CONFIG.SIGN_IN_OUT.EXCEPTION_STATIONS.includes(s));

    return {
      activeVolunteers: activeSessions.length,
      availableStations: regularStations.length,
      totalStations: CONFIG.SIGN_IN_OUT.STATION_COUNT,
      activeSessions
    };
  }, 'getSignInStats');
}

/**
 * Clears stale volunteer sessions (signed in but never signed out) older than hoursThreshold hours.
 * Writes a sign-out record for each stale session so they stop appearing as active.
 * @param {number} hoursThreshold - Sessions older than this many hours are cleared (default 12)
 * @returns {Object} { cleared: number } count of sessions cleared
 */
function clearStaleSessions(hoursThreshold) {
  return safeExecute(() => {
    hoursThreshold = hoursThreshold || 12;
    const sessionState = buildVolunteerSessionState_();
    const cutoff = new Date(Date.now() - hoursThreshold * 3600000);
    const now = new Date();
    const rows = [];
    const signedOutIds = new Set(sessionState.signedOutIds);

    for (let i = 0; i < sessionState.signInData.length; i++) {
      const name = sessionState.signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.NAME]?.toString().trim();
      const sessionId = sessionState.signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.SESSION_ID]?.toString().trim();
      const timestamp = sessionState.signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.TIMESTAMP];

      if (!name || !sessionId || signedOutIds.has(sessionId)) continue;
      if (new Date(timestamp) < cutoff) {
        rows.push([now, name, sessionId]);
        signedOutIds.add(sessionId);
      }
    }

    if (rows.length > 0) {
      const signOutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
      signOutSheet.getRange(signOutSheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
      invalidateCache(CACHE_CONFIG.KEYS.MENTOR_LIST);
      Logger.log(`clearStaleSessions: cleared ${rows.length} sessions older than ${hoursThreshold}h`);

      const staleNames = new Set(rows.map(r => r[1]));
      const assignmentSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
      const assignLastRow = assignmentSheet.getLastRow();
      if (assignLastRow > 1) {
        const assignData = assignmentSheet.getRange(
          2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1, assignLastRow - 1, 4
        ).getValues();
        for (let i = 0; i < assignData.length; i++) {
          const vol = assignData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
          const completed = assignData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
          if (vol && staleNames.has(vol) && completed !== 'complete' && completed !== 'reassigned' && completed !== 'unassigned') {
            assignmentSheet.getRange(i + 2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED + 1).setValue('complete');
          }
        }
        invalidateMultiple([
          CACHE_CONFIG.KEYS.QUEUE,
          CACHE_CONFIG.KEYS.VOLUNTEER_LIST
        ]);
      }
    }

    return { cleared: rows.length };
  }, 'clearStaleSessions');
}

/**
 * Reads the Consolidated Volunteer List sheet and returns all volunteers.
 * This is the shared helper used across the app for volunteer identity data.
 * Schedule Availability is still used for shift-specific data.
 * @returns {Array<Object>} Array of {name, firstName, lastName, email, role, efileNum, attendedTraining}
 */
function getConsolidatedVolunteerList_() {
  const sheet = getSheet(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const cols = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST;
  const numCols = cols.ATTENDED_TRAINING + 1;
  const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  return data.map(row => {
    const preferred = row[cols.PREFERRED_NAME]?.toString().trim() || '';
    const legal = row[cols.FIRST_NAME_LEGAL]?.toString().trim() || '';
    const last = row[cols.LAST_NAME]?.toString().trim() || '';
    const firstName = preferred || legal;
    return {
      name: `${firstName} ${last}`.trim(),
      firstName,
      lastName: last,
      email: row[cols.EMAIL]?.toString().trim().toLowerCase() || '',
      role: row[cols.ROLE]?.toString().trim() || '',
      efileNum: row[cols.EFILE_NUM]?.toString().trim() || '',
      attendedTraining: row[cols.ATTENDED_TRAINING]
    };
  }).filter(v => v.name && v.email);
}

/**
 * Gets consolidated volunteer data for autocomplete in the sign-in form.
 * @returns {Array<Object>} Array of objects with {name: string, role: string}
 */
function getConsolidatedVolunteerData() {
  return safeExecute(() => {
    const volunteers = getConsolidatedVolunteerList_().map(v => ({
      name: v.name,
      role: v.role || 'N/A'
    }));

    Logger.log(`Loaded ${volunteers.length} volunteers from Consolidated Volunteer List`);

    const tagData = getVolunteerTagsFromSheet();
    const roleOverrides = tagData.roleOverrides || {};

    for (const volunteer of volunteers) {
      const override = roleOverrides[volunteer.name] || roleOverrides[volunteer.name.toLowerCase()];
      if (override && override.toLowerCase() !== 'senior mentor') {
        volunteer.role = override;
      }
    }

    volunteers.sort((a, b) => a.name.localeCompare(b.name));
    return volunteers;
  }, 'getConsolidatedVolunteerData');
}
