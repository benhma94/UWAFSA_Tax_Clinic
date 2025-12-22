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
    
    // Use LockService to serialize ID generation and prevent race conditions
    const lock = LockService.getScriptLock();
    
    try {
      // Try to acquire lock with configured timeout
      if (!lock.tryLock(CONFIG.PERFORMANCE.LOCK_TIMEOUT_MS)) {
        throw new Error('System is busy generating client ID. Please try again.');
      }
      
      const sheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
      
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
            var clientID = `${letter}${String(num).padStart(3, '0')}`;
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
        var clientID = 'A001';
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
      
      logAudit('Client Intake Created', `Client ID: ${clientID}`, Session.getActiveUser().getEmail());
      return clientID;
    } finally {
      // Always release the lock
      lock.releaseLock();
    }
  }, 'storeMainFormData');
}

/**
 * Submits initial client intake eligibility data
 * @param {Object} data - Eligibility form data
 * @returns {boolean} True if successful
 */
function submitClientIntake(data) {
  return safeExecute(() => {
    const sheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
    
    const row = [
      new Date(),
      data.tuition || '',
      data.incomeLimit || '',
      data.documentsReady || '',
      data.selfEmployment || '',
      data.bankruptcyOrDeceased || '',
      data.rentalOrGains || '',
      data.foreignProperty || '',
      data.householdCount || '',
      data.yearsNeeded || '',
      data.specialSituations || '',
      data.ticketNumber || '',
      data.allPresent || '',
      data.needsReview || false
    ];
    
    sheet.appendRow(row);
    logAudit('Client Intake Eligibility Submitted', `Ticket: ${data.ticketNumber || 'N/A'}`);
    return true;
  }, 'submitClientIntake');
}
