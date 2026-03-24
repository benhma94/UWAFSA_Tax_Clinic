/**
 * Client Intake Functions
 * Functions specific to the client intake process
 */

/**
 * Stores main form data and generates client ID
 * Uses LockService to prevent race conditions when multiple receptionists submit simultaneously
 * @param {Object} formData - Form data object
 * @returns {string} Generated client ID
 */
function storeMainFormData(formData) {
  return safeExecute(() => {
    // Sanitize and validate input
    if (!formData || !formData.filingYears || formData.filingYears.length === 0) {
      throw new Error('At least one filing year is required');
    }

    // Sanitize form data
    formData.householdsize = sanitizeInput(formData.householdsize, 10);
    formData.notes = sanitizeInput(formData.notes, 1000);
    formData.filingYears = formData.filingYears.map(y => sanitizeInput(y, 10));
    formData.situations = formData.situations ? formData.situations.map(s => sanitizeInput(s, 50)) : [];

    // Check if client has a pre-booked appointment ID
    const appointmentId = formData.appointmentId ? sanitizeInput(formData.appointmentId, 10).toUpperCase() : null;
    const hasValidAppointmentId = appointmentId && /^P\d{3}$/.test(appointmentId);

    // Use LockService to serialize ID generation and prevent race conditions
    const lock = LockService.getScriptLock();

    try {
      // Try to acquire lock with configured timeout
      if (!lock.tryLock(CONFIG.PERFORMANCE.LOCK_TIMEOUT_MS)) {
        throw new Error('System is busy generating client ID. Please try again.');
      }

      const sheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);

      let clientID;

      // If appointment ID provided, use it directly (no generation needed)
      if (hasValidAppointmentId) {
        clientID = appointmentId;
        Logger.log(`Using pre-booked appointment ID: ${clientID}`);
      } else {
        // Get last row to optimize - only read what we need
        const lastRow = sheet.getLastRow();
        const clientIdCol = CONFIG.COLUMNS.CLIENT_INTAKE.CLIENT_ID + 1;

        // Only read rows that have data (optimization: don't read entire sheet)
        const numRows = lastRow > 1 ? lastRow - 1 : 0;
        if (numRows > 0) {
          const allData = sheet.getRange(2, clientIdCol, numRows, 1).getValues();
          const idMap = {};

          for (let row of allData) {
            if (!row[0]) continue; // skip blank
            let entry = row[0].toString().trim();
            if (validateClientID(entry)) {
              const letter = entry[0];
              const num = parseInt(entry.substring(1));
              if (!idMap[letter]) idMap[letter] = new Set();
              idMap[letter].add(num);
            }
          }

          // Generate next available ID safely
          let letter = 'A';
          while (true) {
            let usedNums = idMap[letter] || new Set();
            let num = 1;
            while (usedNums.has(num)) num++;

            if (num <= 999) {
              clientID = `${letter}${String(num).padStart(3, '0')}`;
              break;
            }

            // If we run out of numbers, move to next letter
            letter = String.fromCharCode(letter.charCodeAt(0) + 1);
            if (letter > 'Z') {
              throw new Error('Client ID limit reached (A-Z999)');
            }
          }
        } else {
          // First client - start with A001
          clientID = 'A001';
        }
      }
      
      // Append the row
      sheet.appendRow([
        new Date(),
        formData.householdsize,
        formData.filingYears.join(', '),
        formData.situations.join(', '),
        formData.notes || '',
        clientID,
        formData.needsSeniorReview || false,
        formData.isHighPriority || false,
        JSON.stringify(formData.documents || [])
      ]);
      
      return clientID;
    } finally {
      // Always release the lock
      lock.releaseLock();
    }
  }, 'storeMainFormData');
}

/**
 * Fetches current intake data for a client by ID (for pre-filling the edit modal)
 * @param {string} clientId - Client ID to look up
 * @returns {Object} { householdSize, filingYears, situations, notes, needsSeniorReview, isHighPriority }
 */
function getClientIntakeData(clientId) {
  return safeExecute(() => {
    if (!clientId || !validateClientID(clientId)) {
      throw new Error('Invalid client ID: ' + clientId);
    }

    const sheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error('Client not found: ' + clientId);

    const cols = CONFIG.COLUMNS.CLIENT_INTAKE;
    const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();

    // Scan backward (most recent row first)
    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      if (row[cols.CLIENT_ID] === clientId) {
        const filingYearsRaw = row[cols.FILING_YEARS];
        const situationsRaw = row[cols.SITUATIONS];
        return {
          householdSize: row[cols.HOUSEHOLD_SIZE],
          filingYears: filingYearsRaw ? filingYearsRaw.toString().split(',').map(s => s.trim()).filter(Boolean) : [],
          situations: situationsRaw ? situationsRaw.toString().split(',').map(s => s.trim()).filter(Boolean) : [],
          notes: row[cols.NOTES] || '',
          needsSeniorReview: row[cols.NEEDS_SENIOR_REVIEW] === true || row[cols.NEEDS_SENIOR_REVIEW] === 'TRUE',
          isHighPriority: row[cols.IS_HIGH_PRIORITY] === true || row[cols.IS_HIGH_PRIORITY] === 'TRUE',
        };
      }
    }

    throw new Error('Client not found: ' + clientId);
  }, 'getClientIntakeData');
}

/**
 * Updates editable intake fields for an existing client record
 * Does not modify TIMESTAMP, CLIENT_ID, or DOCUMENTS columns
 * @param {string} clientId - Client ID to update
 * @param {Object} formData - { householdSize, filingYears[], situations[], notes, needsSeniorReview, isHighPriority }
 * @returns {{ success: boolean }}
 */
function updateClientIntake(clientId, formData) {
  return safeExecute(() => {
    if (!clientId || !validateClientID(clientId)) {
      throw new Error('Invalid client ID: ' + clientId);
    }
    if (!formData || !formData.filingYears || formData.filingYears.length === 0) {
      throw new Error('At least one filing year is required');
    }

    // Sanitize inputs
    formData.notes = sanitizeInput(formData.notes || '', 1000);
    formData.filingYears = formData.filingYears.map(y => sanitizeInput(y, 10));
    formData.situations = formData.situations ? formData.situations.map(s => sanitizeInput(s, 50)) : [];

    const lock = LockService.getScriptLock();
    try {
      if (!lock.tryLock(CONFIG.PERFORMANCE.LOCK_TIMEOUT_MS)) {
        throw new Error('System is busy. Please try again.');
      }

      const sheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) throw new Error('Client not found: ' + clientId);

      const cols = CONFIG.COLUMNS.CLIENT_INTAKE;
      const idColVals = sheet.getRange(2, cols.CLIENT_ID + 1, lastRow - 1, 1).getValues();

      // Scan backward to find the row
      let targetRow = -1;
      for (let i = idColVals.length - 1; i >= 0; i--) {
        if (idColVals[i][0] === clientId) {
          targetRow = i + 2; // +2: 1-indexed row + skip header
          break;
        }
      }

      if (targetRow === -1) throw new Error('Client not found: ' + clientId);

      // Update only editable columns (leave TIMESTAMP, CLIENT_ID, DOCUMENTS untouched)
      sheet.getRange(targetRow, cols.HOUSEHOLD_SIZE + 1).setValue(Number(formData.householdSize) || 1);
      sheet.getRange(targetRow, cols.FILING_YEARS + 1).setValue(formData.filingYears.join(', '));
      sheet.getRange(targetRow, cols.SITUATIONS + 1).setValue(formData.situations.join(', '));
      sheet.getRange(targetRow, cols.NOTES + 1).setValue(formData.notes);
      sheet.getRange(targetRow, cols.NEEDS_SENIOR_REVIEW + 1).setValue(formData.needsSeniorReview === true);
      sheet.getRange(targetRow, cols.IS_HIGH_PRIORITY + 1).setValue(formData.isHighPriority === true);

      return { success: true };
    } finally {
      lock.releaseLock();
    }
  }, 'updateClientIntake');
}

