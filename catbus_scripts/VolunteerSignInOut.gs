/**
 * Volunteer Sign-In/Out Functions
 * Handles volunteer sign-in and sign-out functionality
 */

/**
 * Gets available stations (not currently in use today)
 * @returns {Array<string>} Array of available station names
 */
function getAvailableStations() {
  return safeExecute(() => {
    const signInSheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    const signOutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
    
    const stationList = Array.from({ length: CONFIG.SIGN_IN_OUT.STATION_COUNT }, (_, i) => (i + 1).toString());
    const exceptionStations = CONFIG.SIGN_IN_OUT.EXCEPTION_STATIONS;
    const today = new Date().toDateString();
    
    const signInData = signInSheet.getDataRange().getValues();
    const signOutData = signOutSheet.getDataRange().getValues();
    const activeStations = new Set();
    
    // Get all signed-out session IDs for today
    const signedOutIds = new Set();
    for (let i = 1; i < signOutData.length; i++) {
      const outDate = new Date(signOutData[i][CONFIG.COLUMNS.SIGNOUT.TIMESTAMP]).toDateString();
      const outId = signOutData[i][CONFIG.COLUMNS.SIGNOUT.SESSION_ID]?.toString().trim();
      if (outDate === today && outId) {
        signedOutIds.add(outId);
      }
    }
    
    // Find stations that are active (signed in but not signed out)
    for (let i = 1; i < signInData.length; i++) {
      const date = new Date(signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.TIMESTAMP]).toDateString();
      const station = signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.STATION]?.toString().trim();
      const sessionId = signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.SESSION_ID]?.toString().trim();
      
      if (date === today && station && sessionId && !signedOutIds.has(sessionId) && !exceptionStations.includes(station)) {
        activeStations.add(station);
      }
    }
    
    // Filter out active stations
    const availableStations = stationList.filter(s => !activeStations.has(s));
    const sortedStations = availableStations.sort((a, b) => parseInt(a) - parseInt(b));
    
    // Exception stations first, then sorted numeric stations
    return [...exceptionStations, ...sortedStations];
  }, 'getAvailableStations');
}

/**
 * Gets active volunteer sessions (signed in but not signed out today)
 * @returns {Array<Object>} Array of active session objects with name, time, sessionId, and station
 */
function getActiveSessions() {
  return safeExecute(() => {
    const signInSheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    const signOutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
    const today = new Date().toDateString();
    
    const signInData = signInSheet.getDataRange().getValues();
    const signOutData = signOutSheet.getDataRange().getValues();
    
    // Get all signed-out session IDs for today
    const signedOutIds = new Set();
    for (let i = 1; i < signOutData.length; i++) {
      const outDate = new Date(signOutData[i][CONFIG.COLUMNS.SIGNOUT.TIMESTAMP]).toDateString();
      const outId = signOutData[i][CONFIG.COLUMNS.SIGNOUT.SESSION_ID]?.toString().trim();
      if (outDate === today && outId) {
        signedOutIds.add(outId);
      }
    }
    
    const activeSessions = [];
    
    for (let i = 1; i < signInData.length; i++) {
      const date = new Date(signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.TIMESTAMP]).toDateString();
      const name = signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.NAME]?.toString().trim();
      const station = signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.STATION]?.toString().trim();
      const sessionId = signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.SESSION_ID]?.toString().trim();
      const timestamp = signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.TIMESTAMP];
      
      if (date === today && name && sessionId && !signedOutIds.has(sessionId)) {
        const time = Utilities.formatDate(new Date(timestamp), Session.getScriptTimeZone(), 'HH:mm');
        activeSessions.push({
          name: name,
          station: station || 'N/A',
          sessionId: sessionId,
          time: time,
          displayText: `${name} @ ${time} • Station ${station || 'N/A'}`
        });
      }
    }
    
    // Sort by name
    activeSessions.sort((a, b) => a.name.localeCompare(b.name));
    
    return activeSessions;
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
    // Validate inputs
    if (!volunteerName || !volunteerName.trim()) {
      throw new Error('Volunteer name is required');
    }
    
    if (!station || !station.trim()) {
      throw new Error('Station is required');
    }
    
    // Check if station is available
    const availableStations = getAvailableStations();
    if (!availableStations.includes(station)) {
      throw new Error(`Station "${station}" is not available. Please select another station.`);
    }
    
    const sheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    
    // Generate session ID
    const sessionId = Utilities.getUuid();
    const timestamp = new Date();
    
    // Append sign-in record
    sheet.appendRow([
      timestamp,
      volunteerName.trim(),
      station.trim(),
      sessionId
    ]);
    
    Logger.log(`Volunteer signed in: ${volunteerName} at station ${station} (${sessionId})`);
    
    return {
      success: true,
      sessionId: sessionId,
      timestamp: timestamp,
      volunteerName: volunteerName.trim(),
      station: station.trim()
    };
  }, 'signInVolunteer');
}

/**
 * Signs out a volunteer by session ID
 * @param {string} sessionId - Session ID to sign out
 * @returns {Object} Sign-out result
 */
function signOutVolunteer(sessionId) {
  return safeExecute(() => {
    // Validate input
    if (!sessionId || !sessionId.trim()) {
      throw new Error('Session ID is required');
    }
    
    // Find the volunteer record
    const signInSheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    const signInData = signInSheet.getDataRange().getValues();
    
    let volunteerName = '';
    let found = false;
    
    // Find the session in sign-in data
    for (let i = 1; i < signInData.length; i++) {
      const rowSessionId = signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.SESSION_ID]?.toString().trim();
      if (rowSessionId === sessionId.trim()) {
        volunteerName = signInData[i][CONFIG.COLUMNS.VOLUNTEER_LIST.NAME]?.toString().trim();
        found = true;
        break;
      }
    }
    
    if (!found) {
      throw new Error('Session ID not found. Please check and try again.');
    }
    
    // Check if already signed out today
    const signOutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
    const signOutData = signOutSheet.getDataRange().getValues();
    const today = new Date().toDateString();
    
    for (let i = 1; i < signOutData.length; i++) {
      const outDate = new Date(signOutData[i][CONFIG.COLUMNS.SIGNOUT.TIMESTAMP]).toDateString();
      const outId = signOutData[i][CONFIG.COLUMNS.SIGNOUT.SESSION_ID]?.toString().trim();
      if (outDate === today && outId === sessionId.trim()) {
        throw new Error('This session is already signed out.');
      }
    }
    
    // Record sign-out
    const timestamp = new Date();
    signOutSheet.appendRow([
      timestamp,
      volunteerName || sessionId, // Store volunteer name or session ID if name not found
      sessionId.trim()
    ]);
    
    Logger.log(`Volunteer signed out: ${volunteerName} (${sessionId})`);
    
    return {
      success: true,
      sessionId: sessionId.trim(),
      timestamp: timestamp,
      volunteerName: volunteerName
    };
  }, 'signOutVolunteer');
}

/**
 * Gets current sign-in statistics
 * @returns {Object} Statistics about current sign-ins
 */
function getSignInStats() {
  return safeExecute(() => {
    const activeSessions = getActiveSessions();
    const availableStations = getAvailableStations();
    
    const regularStations = availableStations.filter(s => 
      !CONFIG.SIGN_IN_OUT.EXCEPTION_STATIONS.includes(s)
    );
    
    return {
      activeVolunteers: activeSessions.length,
      availableStations: regularStations.length,
      totalStations: CONFIG.SIGN_IN_OUT.STATION_COUNT,
      activeSessions: activeSessions
    };
  }, 'getSignInStats');
}

/**
 * Gets consolidated volunteer data from external spreadsheet
 * Used for autocomplete in sign-in form
 * @returns {Array<Object>} Array of objects with {name: string, role: string}
 */
function getConsolidatedVolunteerData() {
  return safeExecute(() => {
    try {
      const externalConfig = CONFIG.EXTERNAL_SPREADSHEETS.CONSOLIDATED_VOLUNTEERS;
      Logger.log(`Opening external spreadsheet: ${externalConfig.ID}`);
      Logger.log(`Looking for sheet: ${externalConfig.SHEET_NAME}`);

      const ss = SpreadsheetApp.openById(externalConfig.ID);
      const sheet = ss.getSheetByName(externalConfig.SHEET_NAME);

      if (!sheet) {
        Logger.log(`Sheet "${externalConfig.SHEET_NAME}" not found in external spreadsheet`);
        Logger.log(`Available sheets: ${ss.getSheets().map(s => s.getName()).join(', ')}`);
        return [];
      }

      const data = sheet.getDataRange().getValues();
      Logger.log(`Sheet has ${data.length} rows`);

      // Log first few rows to debug
      if (data.length > 0) {
        Logger.log(`Header row (row 0): ${JSON.stringify(data[0])}`);
      }
      if (data.length > 1) {
        Logger.log(`Sample data row (row 1): ${JSON.stringify(data[1])}`);
        Logger.log(`  - Column A (index 0): "${data[1][0]}"`);
        Logger.log(`  - Column H (index 7): "${data[1][7]}"`);
      }

      const volunteers = [];

      // Skip header row (index 0), start from row 1
      for (let i = 1; i < data.length; i++) {
        const role = data[i][externalConfig.COLUMNS.ROLE]?.toString().trim() || '';
        const name = data[i][externalConfig.COLUMNS.NAME]?.toString().trim() || '';

        // Only include rows with valid names
        if (name && name.length > 0) {
          volunteers.push({
            name: name,
            role: role || 'N/A'
          });
        }
      }

      // Sort by name for consistent ordering
      volunteers.sort((a, b) => a.name.localeCompare(b.name));

      Logger.log(`Loaded ${volunteers.length} volunteers from consolidated sheet`);
      if (volunteers.length > 0) {
        Logger.log(`Sample volunteer: ${JSON.stringify(volunteers[0])}`);
      }

      return volunteers;

    } catch (error) {
      Logger.log(`Error accessing external spreadsheet: ${error.message}`);
      Logger.log(`Error stack: ${error.stack}`);
      // Return empty array if external sheet is not accessible
      // This allows the form to still work without autocomplete
      return [];
    }
  }, 'getConsolidatedVolunteerData');
}

/**
 * TEST FUNCTION - Run this directly in Apps Script editor to debug
 * Shows detailed information about the consolidated sheet data
 */
function testConsolidatedSheet() {
  const externalConfig = CONFIG.EXTERNAL_SPREADSHEETS.CONSOLIDATED_VOLUNTEERS;

  Logger.log('=== TESTING CONSOLIDATED SHEET ACCESS ===');
  Logger.log(`Spreadsheet ID: ${externalConfig.ID}`);
  Logger.log(`Sheet Name: ${externalConfig.SHEET_NAME}`);

  try {
    const ss = SpreadsheetApp.openById(externalConfig.ID);
    Logger.log('✓ Successfully opened spreadsheet');

    const allSheets = ss.getSheets();
    Logger.log(`\nAvailable sheets (${allSheets.length}):`);
    allSheets.forEach((s, i) => {
      Logger.log(`  ${i + 1}. "${s.getName()}"`);
    });

    const sheet = ss.getSheetByName(externalConfig.SHEET_NAME);
    if (!sheet) {
      Logger.log(`\n✗ ERROR: Sheet "${externalConfig.SHEET_NAME}" not found!`);
      return;
    }

    Logger.log(`\n✓ Found sheet: "${externalConfig.SHEET_NAME}"`);

    const data = sheet.getDataRange().getValues();
    Logger.log(`\nSheet has ${data.length} rows x ${data[0]?.length || 0} columns`);

    // Show first 5 rows with all columns
    Logger.log('\n=== FIRST 5 ROWS (All Columns) ===');
    for (let i = 0; i < Math.min(5, data.length); i++) {
      Logger.log(`\nRow ${i}:`);
      for (let j = 0; j < data[i].length; j++) {
        const colLetter = String.fromCharCode(65 + j); // A, B, C, etc.
        const value = data[i][j];
        Logger.log(`  Column ${colLetter} (index ${j}): "${value}"`);
      }
    }

    // Specifically check columns A and H
    Logger.log('\n=== CHECKING TARGET COLUMNS (A and H) ===');
    Logger.log(`Column A is index: ${externalConfig.COLUMNS.ROLE}`);
    Logger.log(`Column H is index: ${externalConfig.COLUMNS.NAME}`);

    for (let i = 0; i < Math.min(10, data.length); i++) {
      const role = data[i][externalConfig.COLUMNS.ROLE];
      const name = data[i][externalConfig.COLUMNS.NAME];
      Logger.log(`Row ${i}: Role="${role}" | Name="${name}"`);
    }

    Logger.log('\n=== TEST COMPLETE ===');

  } catch (error) {
    Logger.log(`\n✗ ERROR: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
  }
}
