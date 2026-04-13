/**
 * Control Sheet Functions
 * Functions for the volunteer control sheet
 */

function getRequestPollSnapshot_(fullVolunteerLabel, volunteerNameOnly) {
  const helpSnapshot = getRequestSnapshotForVolunteer_('HELP', fullVolunteerLabel);
  const reviewSnapshot = getRequestSnapshotForVolunteer_('REVIEW', volunteerNameOnly);

  let reviewResult = null;
  if (reviewSnapshot && reviewSnapshot.status === CONFIG.REVIEW_STATUS.APPROVED) {
    reviewResult = {
      resolved: true,
      approved: true,
      reviewerName: reviewSnapshot.reviewerOrReason || '',
      taxYear: reviewSnapshot.taxYear || ''
    };
  } else if (reviewSnapshot && reviewSnapshot.status === CONFIG.REVIEW_STATUS.RETURNED) {
    reviewResult = {
      resolved: true,
      approved: false,
      reason: reviewSnapshot.reviewerOrReason || '',
      taxYear: reviewSnapshot.taxYear || ''
    };
  }

  return {
    helpStatus: helpSnapshot
      ? helpSnapshot.status.toLowerCase()
      : CONFIG.HELP_STATUS.CLEARED.toLowerCase(),
    reviewResult
  };
}

/**
 * Returns volunteer/client data for the control sheet.
 * Includes all signed-in filer names (not just those with active clients),
 * the client map, and current break status.
 * @returns {{ clientMap: Object, allFilerNames: string[], breakStatus: Object }}
 */
function getVolunteersAndClients() {
  return safeExecute(() => {
    return getCachedOrFetch(
      CACHE_CONFIG.KEYS.VOLUNTEERS_AND_CLIENTS,
      () => {
        const today = new Date().toDateString();

        // --- Build client map from CLIENT_ASSIGNMENT sheet ---
        const assignSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
        const lastRow = assignSheet.getLastRow();
        const volunteerToClient = {};

        if (lastRow > 1) {
          const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK, lastRow - 1);
          const startRow = Math.max(2, lastRow - checkRows + 1);
          const data = readSheetData(assignSheet, 4, startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1, checkRows);
          for (let i = 0; i < data.length; i++) {
            const client    = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
            const label     = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim() || '';
            const volunteer = label.includes('–') ? label.split('–')[1].trim() : label;
            const completed = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
            if (volunteer && client && completed !== 'complete' && completed !== 'reassigned' && completed !== 'unassigned') {
              volunteerToClient[volunteer] = client;
            }
          }
        }

        const clientMap = {};
        for (const [volunteer, client] of Object.entries(volunteerToClient)) {
          clientMap[volunteer] = [client];
        }

        // --- Build list of all signed-in filer volunteers + break status ---
        const volunteerSheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
        const signOutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
        const volLastRow = volunteerSheet.getLastRow();
        const signOutLastRow = signOutSheet.getLastRow();

        const volData = volLastRow > 1
          ? readSheetData(volunteerSheet, 5, 2, 1, volLastRow - 1)
          : [];

        const signOutData = signOutLastRow > 1
          ? readSheetData(signOutSheet, 3, 2, 1, signOutLastRow - 1)
          : [];

        const signedOutSessions = new Set(signOutData.map(r => r[CONFIG.COLUMNS.SIGNOUT.SESSION_ID]?.toString().trim()));
        const nonFilerStations = CONFIG.SIGN_IN_OUT.NON_FILER_STATIONS;

        const allFilerNames = [];
        const breakStatus = {};
        const trainingVolunteers = [];
        const quizVolunteers = [];

        for (const row of volData) {
          const name      = row[CONFIG.COLUMNS.VOLUNTEER_LIST.NAME]?.toString().trim();
          const station   = row[CONFIG.COLUMNS.VOLUNTEER_LIST.STATION]?.toString().trim().toLowerCase();
          const sessionId = row[CONFIG.COLUMNS.VOLUNTEER_LIST.SESSION_ID]?.toString().trim();
          const onBreak   = row[CONFIG.COLUMNS.VOLUNTEER_LIST.ON_BREAK]?.toString().trim().toLowerCase();

          if (!name || !station || !sessionId) continue;

          const signInDate = new Date(row[CONFIG.COLUMNS.VOLUNTEER_LIST.TIMESTAMP]).toDateString();
          if (signInDate !== today && station !== 'quiz') continue;

          if (signedOutSessions.has(sessionId)) continue;

          const isTrainingStation = station === 'training';
          const isQuizStation     = station === 'quiz';

          // Exclude non-filer stations except training and quiz (they get their own modes)
          if (nonFilerStations.some(r => station === r) && !isTrainingStation && !isQuizStation) continue;

          if (!allFilerNames.includes(name)) allFilerNames.push(name);
          // Last row for this volunteer wins for break status
          breakStatus[name] = (onBreak === 'yes');

          if (isTrainingStation && !trainingVolunteers.includes(name)) {
            trainingVolunteers.push(name);
          }
          if (isQuizStation && !quizVolunteers.includes(name)) {
            quizVolunteers.push(name);
          }
        }

        return { clientMap, allFilerNames, breakStatus, trainingVolunteers, quizVolunteers };
      },
      CACHE_CONFIG.TTL.VOLUNTEERS_AND_CLIENTS
    );
  }, 'getVolunteersAndClients');
}

/**
 * Consolidated polling endpoint for the control sheet.
 * Returns both help status and review approval result in a single call,
 * reducing from 2 google.script.run calls to 1 per poll cycle.
 * @param {string} volunteer - Full volunteer string (may include station prefix)
 * @returns {{ helpStatus: string, reviewResult: Object|null }}
 */
function getVolunteerPollingStatus(volunteer) {
  return safeExecute(() => {
    const volunteerNameOnly = volunteer.includes('–')
      ? volunteer.split('–')[1].trim()
      : volunteer.trim();

    const volunteersData = getVolunteersAndClients();
    const allFilerNames = (volunteersData && volunteersData.allFilerNames) ? volunteersData.allFilerNames : null;
    const pollSnapshot = getRequestPollSnapshot_(volunteer, volunteerNameOnly);

    return {
      helpStatus: pollSnapshot.helpStatus,
      reviewResult: pollSnapshot.reviewResult,
      mentors: getMentorList(),
      allFilerNames: allFilerNames
    };
  }, 'getVolunteerPollingStatus');
}

/**
 * Inner helper — reads client intake info without safeExecute wrapper.
 * Called by getClientIntakeInfo and getClientData.
 */
function getClientIntakeInfoInner(clientID) {
  if (!validateClientID(clientID)) return null;

  const sheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  const clientIdCol = CONFIG.COLUMNS.CLIENT_INTAKE.CLIENT_ID + 1;
  const clientIdData = readSheetData(sheet, 1, 2, clientIdCol, lastRow - 1);

  for (let i = clientIdData.length - 1; i >= 0; i--) {
    if (clientIdData[i][0]?.toString().trim() === clientID) {
      const rowNum = i + 2;
      const rowData = sheet.getRange(rowNum, CONFIG.COLUMNS.CLIENT_INTAKE.FILING_YEARS + 1, 1, 7).getValues()[0];
      const needsSeniorReview = rowData[4] === true || rowData[4]?.toString().toLowerCase() === 'true';
      let documents = [];
      try {
        documents = JSON.parse(rowData[6]?.toString().trim() || '[]');
      } catch (e) {
        Logger.log(`Error parsing documents JSON for client ${clientID}: ${e.message}`);
      }
      return {
        filingYears: rowData[0]?.toString().split(',').map(y => y.trim()) || [],
        situations:  rowData[1]?.toString().split(',').map(s => s.trim()) || [],
        notes:       rowData[2]?.toString().trim() || '',
        needsSeniorReview,
        documents
      };
    }
  }
  return null;
}

/**
 * Gets client intake information by client ID
 * @param {string} clientID - Client ID
 * @returns {Object|null} Client intake info or null if not found
 */
function getClientIntakeInfo(clientID) {
  return safeExecute(() => getClientIntakeInfoInner(clientID), 'getClientIntakeInfo');
}

/**
 * Returns a sorted list of mentor names from Volunteer List (signed in today)
 * Optimized with caching (30-60 second TTL) to reduce API calls when 100 volunteers access
 * @returns {Object} Object with reviewers and seniors arrays
 */
function getMentorList() {
  return safeExecute(() => {
    return getCachedOrFetch(
      CACHE_CONFIG.KEYS.MENTOR_LIST,
      () => {
        const volunteerSheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
        const lastRow = volunteerSheet.getLastRow();

        if (lastRow <= 1) {
          return { reviewers: [], seniors: [] };
        }

        const data = readSheetData(volunteerSheet, 4, 2, 1, lastRow - 1);

        // Build set of signed-out session IDs (recent rows only — avoids full history scan)
        const signedOutIds = new Set();
        try {
          const signOutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
          const lastSignOut = signOutSheet.getLastRow();
          if (lastSignOut > 1) {
            const rowsToRead = Math.min(lastSignOut - 1, 500);
            const startRow = Math.max(2, lastSignOut - rowsToRead + 1);
            const recentData = readSheetData(signOutSheet, signOutSheet.getLastColumn(), startRow, 1, rowsToRead);
            for (const row of recentData) {
              const outId = row[CONFIG.COLUMNS.SIGNOUT.SESSION_ID]?.toString().trim();
              if (outId) signedOutIds.add(outId);
            }
          }
        } catch (e) {
          Logger.log('Warning: Could not read sign-out data: ' + e.message);
        }

        const mentorsToday = new Set();

        for (let i = 0; i < data.length; i++) {
          const timestamp = data[i][0];
          const name = data[i][1]?.toString().trim();
          const role = data[i][2]?.toString().trim().toLowerCase();
          const sessionId = data[i][3]?.toString().trim();

          if (name && timestamp instanceof Date) {
            // Include any mentor currently signed in (not yet signed out), regardless of sign-in date
            if ((role === 'mentor' || role === 'senior mentor') && !signedOutIds.has(sessionId)) {
              mentorsToday.add(name);
            }
          }
        }

        return {
          reviewers: [...mentorsToday].sort(),
          seniors: []
        };
      },
      CACHE_CONFIG.TTL.MENTOR_LIST
    );
  }, 'getMentorList');
}

/**
 * Finds the row number of a volunteer+client assignment in the Client Assignment sheet
 * Searches recent rows first (optimized), then older rows if not found
 * @param {Sheet} assignSheet - The Client Assignment sheet
 * @param {string} volunteer - Volunteer name
 * @param {string} clientID - Client ID
 * @returns {number} Row number (1-indexed) or -1 if not found
 */
function findAssignmentRow(assignSheet, volunteer, clientID) {
  const lastRow = assignSheet.getLastRow();
  if (lastRow <= 1) return -1;

  const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK, lastRow - 1);
  const startRow = Math.max(2, lastRow - checkRows + 1);

  const assignData = readSheetData(assignSheet, 4, startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1, checkRows);

  for (let i = 0; i < assignData.length; i++) {
    const c = assignData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
    const vRaw = assignData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim() || '';
    const v = vRaw.includes('–') ? vRaw.split('–')[1].trim() : vRaw;
    if (v === volunteer && c === clientID) {
      return startRow + i;
    }
  }

  if (lastRow > CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK) {
    const olderRows = lastRow - CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK;
    const olderData = readSheetData(assignSheet, 4, 2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1, olderRows);
    for (let i = 0; i < olderData.length; i++) {
      const c = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
      const vRaw = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim() || '';
      const v = vRaw.includes('–') ? vRaw.split('–')[1].trim() : vRaw;
      if (v === volunteer && c === clientID) {
        return i + 2;
      }
    }
  }

  return -1;
}

/**
 * Finds an existing row in the Tax Return Tracker by clientID, taxYear, and status.
 * Used to prevent duplicates and support status-aware updates (including couples handling).
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} trackerSheet
 * @param {string} clientID
 * @param {string} taxYear
 * @param {string|null} preferredStatus
 *   - 'Emailed': returns the first row with STATUS === 'Emailed' for this client+year
 *   - null: returns the first row whose STATUS is NOT 'Finalized' (blank or 'Emailed')
 * @returns {number} 1-indexed row number, or -1 if not qualifying row found
 */
function findTrackerRowByStatus(trackerSheet, clientID, taxYear, preferredStatus) {
  const lastRow = trackerSheet.getLastRow();
  if (lastRow <= 1) return -1;

  const clientColIdx = CONFIG.COLUMNS.TAX_RETURN_TRACKER.CLIENT_ID;
  const yearColIdx   = CONFIG.COLUMNS.TAX_RETURN_TRACKER.TAX_YEAR;
  const statusColIdx = CONFIG.COLUMNS.TAX_RETURN_TRACKER.STATUS;
  const numCols      = statusColIdx + 1; // read through STATUS column

  const allData = readSheetData(trackerSheet, numCols, 2, 1, lastRow - 1);

  for (let i = 0; i < allData.length; i++) {
    const rowClient = allData[i][clientColIdx]?.toString().trim();
    const rowYear   = allData[i][yearColIdx]?.toString().trim();
    if (rowClient !== clientID || rowYear !== taxYear) continue;

    const rowStatus = allData[i][statusColIdx]?.toString().trim();

    if (preferredStatus === CONFIG.TRACKER_STATUS.EMAILED) {
      // Only match rows explicitly marked 'Emailed'
      if (rowStatus === CONFIG.TRACKER_STATUS.EMAILED) return i + 2;
    } else {
      // null: match any row that is not yet 'Finalized'
      if (rowStatus !== CONFIG.TRACKER_STATUS.FINALIZED) return i + 2;
    }
  }
  return -1;
}

function buildTrackerRowIndex_(trackerSheet) {
  const lastRow = trackerSheet.getLastRow();
  const index = {};
  if (lastRow <= 1) return index;

  const statusColIdx = CONFIG.COLUMNS.TAX_RETURN_TRACKER.STATUS;
  const data = readSheetData(trackerSheet, statusColIdx + 1, 2, 1, lastRow - 1);

  for (let i = 0; i < data.length; i++) {
    const rowClient = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.CLIENT_ID]?.toString().trim();
    const rowYear = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.TAX_YEAR]?.toString().trim();
    if (!rowClient || !rowYear) continue;

    const key = `${rowClient}|${rowYear}`;
    if (!index[key]) index[key] = [];
    index[key].push({
      rowNum: i + 2,
      status: data[i][statusColIdx]?.toString().trim() || ''
    });
  }

  return index;
}

/**
 * Finalizes returns and stores per-tax-year data to the tracker
 * @param {string} volunteer - Volunteer name
 * @param {string} client - Client ID
 * @param {Array<Object>} rows - Array of tax year data objects
 * @returns {boolean} True if successful
 */
function finalizeReturnsAndStore(volunteer, client, rows, meta) {
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

    // --- Training mode: skip assignment + tracker ---
    if (/^T\d{3}$/.test(clientID)) {
      Logger.log(`Training client ${clientID} — skipping Tax Return Tracker`);
      return true;
    }

    // --- Quiz mode: skip tracker, write to Quiz Submissions, mark assignment complete ---
    if (/^Q\d{3}$/.test(clientID)) {
      Logger.log(`Quiz client ${clientID} — writing to Quiz Submissions`);

      // Mark Client Assignment complete so the quiz client doesn't stay active in the queue
      const assignSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
      const assignRowNum = findAssignmentRow(assignSheet, volunteer, clientID);
      if (assignRowNum > 0) {
        assignSheet.getRange(assignRowNum, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED + 1).setValue('Complete');
        Logger.log(`Marked quiz assignment complete at row ${assignRowNum}`);
      }

      const volunteerNameOnly = volunteer.includes('–') ? volunteer.split('–')[1].trim() : volunteer.trim();
      const receiptData = {
        refund: (meta && meta.refund) || '',
        onben:  (meta && meta.onben)  || '',
        gst:    (meta && meta.gst)    || '',
        notes:  (meta && meta.notes)  || ''
      };
      // Upload files to Drive here (deferred from receipt step to avoid UI hang)
      let fileUrls = (meta && meta.fileUrls) || [];
      if (meta && meta.fileDataArray && meta.fileDataArray.length > 0) {
        fileUrls = uploadQuizFilesToDrive_(meta.fileDataArray, clientID);
      }
      writeQuizSubmission(volunteerNameOnly, (meta && meta.partner) || '', clientID, receiptData, rows, fileUrls);
      return true;
    }

    // 1. Mark client as Complete in 'Client Assignment'
    const assignSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    const assignRowNum = findAssignmentRow(assignSheet, volunteer, clientID);

    if (assignRowNum > 0) {
      assignSheet.getRange(assignRowNum, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED + 1)
        .setValue('Complete');
      Logger.log(`Marked assignment complete at row ${assignRowNum}`);
    } else {
      throw new Error(`Assignment not found for volunteer ${volunteer} and client ${clientID}`);
    }

    // 2. Write incomplete returns to Tax Return Tracker.
    // Efile/paper returns are already tracked by trackReturnOnEmailSent() when the receipt email
    // is sent, so we only need to record returns that were marked incomplete (no email sent).
    const incompleteRows = rows.filter(r => r.incomplete);
    if (incompleteRows.length > 0) {
      const trackerSheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
      if (!trackerSheet) {
        throw new Error('Tax Return Tracker sheet not found');
      }

      const volunteerNameOnly = volunteer.includes('–')
        ? volunteer.split('–')[1].trim()
        : volunteer.trim();

      const numCols = CONFIG.COLUMNS.TAX_RETURN_TRACKER.STATUS + 1;
      const trackerIndex = buildTrackerRowIndex_(trackerSheet);
      const rowsToAppend = [];

      try {
        for (const r of incompleteRows) {
          // Skip if an entry already exists for this client+year (e.g. previously recorded)
          const existingRows = trackerIndex[`${clientID}|${r.taxYear}`] || [];
          const hasOpenEntry = existingRows.some(entry => entry.status !== CONFIG.TRACKER_STATUS.FINALIZED);
          if (hasOpenEntry) {
            Logger.log(`Tracker entry already exists for client ${clientID}, year ${r.taxYear} — skipping`);
            continue;
          }
          rowsToAppend.push([
            new Date(),
            sanitizeInput(volunteerNameOnly, 100),
            sanitizeInput(clientID, 10),
            sanitizeInput(r.taxYear, 10),
            '', // Reviewer (none for incomplete)
            '', // Secondary reviewer
            r.married ? 'Yes' : 'No',
            '',  // Efile
            '',  // Paper
            'Yes', // Incomplete
            CONFIG.TRACKER_STATUS.INCOMPLETE
          ]);
        }
        if (rowsToAppend.length > 0) {
          const startRow = trackerSheet.getLastRow() + 1;
          Logger.log(`Appending ${rowsToAppend.length} Incomplete tracker rows starting at row ${startRow}`);
          trackerSheet.getRange(startRow, 1, rowsToAppend.length, numCols).setValues(rowsToAppend);
        }
      } catch (writeError) {
        Logger.log(`Error writing to Tax Return Tracker: ${writeError.message}`);
        throw new Error(`Failed to write to Tax Return Tracker: ${writeError.message}`);
      }
    }

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

    // --- Quiz mode: nothing to clean up ---
    if (/^Q\d{3}$/.test(clientID)) {
      Logger.log(`Quiz client ${clientID} — skipping Tax Return Tracker (cancel)`);
      return true;
    }

    // --- Training mode: skip assignment + tracker ---
    if (/^T\d{3}$/.test(clientID)) {
      Logger.log(`Training client ${clientID} — skipping Tax Return Tracker (cancel)`);
      return true;
    }
    
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
    const assignRowNum = findAssignmentRow(assignSheet, volunteer, clientID);

    if (assignRowNum > 0) {
      assignSheet.getRange(assignRowNum, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED + 1)
        .setValue('Complete');
      Logger.log(`Marked assignment complete at row ${assignRowNum} for cancellation`);
    } else {
      Logger.log(`Assignment not found for ${volunteer}/${clientID}, proceeding with cancellation recording`);
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
    
    return true;
  }, 'cancelClientAndStore');
}

/**
 * Inner helper — reads tracker status without safeExecute wrapper.
 * Called by getClientData.
 */
function getClientTrackerStatusInner(clientID) {
  if (!clientID?.trim()) return [];

  const trackerSheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
  if (!trackerSheet) return [];

  const lastRow = trackerSheet.getLastRow();
  if (lastRow <= 1) return [];

  const clientColIdx = CONFIG.COLUMNS.TAX_RETURN_TRACKER.CLIENT_ID;
  const yearColIdx   = CONFIG.COLUMNS.TAX_RETURN_TRACKER.TAX_YEAR;
  const statusColIdx = CONFIG.COLUMNS.TAX_RETURN_TRACKER.STATUS;
  const allData = trackerSheet.getRange(2, 1, lastRow - 1, statusColIdx + 1).getValues();
  const trimmedID = clientID.trim();

  const result = [];
  for (const row of allData) {
    if (row[clientColIdx]?.toString().trim() === trimmedID) {
      result.push({
        taxYear: row[yearColIdx]?.toString().trim() || '',
        status:  row[statusColIdx]?.toString().trim() || ''
      });
    }
  }
  return result;
}

/**
 * Returns both client intake info and tracker status in a single server call.
 * Replaces two parallel google.script.run calls with one, halving round-trip latency.
 * @param {string} clientID - Client ID to look up
 * @returns {{intakeInfo: Object|null, trackerStatus: Array}}
 */
function getClientData(clientID) {
  return safeExecute(() => {
    return {
      intakeInfo:    getClientIntakeInfoInner(clientID),
      trackerStatus: getClientTrackerStatusInner(clientID)
    };
  }, 'getClientData');
}
