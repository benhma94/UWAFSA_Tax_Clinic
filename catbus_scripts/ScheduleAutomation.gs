/**
 * Schedule Automation Functions
 * Automates schedule generation from volunteer availability form responses
 */

const SHIFT_IDS = ['D1A', 'D1B', 'D1C', 'D2A', 'D2B', 'D2C', 'D3A', 'D3B', 'D3C', 'D4A', 'D4B', 'D4C'];

/**
 * Classifies a volunteer's role into standard categories
 * @param {string} role - Role string from availability form
 * @returns {string} Normalized role: 'filer', 'mentor', or 'frontline'
 */
function classifyRole(role) {
  const roleLower = (role || '').toLowerCase();

  if (roleLower.includes('mentor') || roleLower.includes('senior')) {
    return 'mentor';
  }
  if (roleLower.includes('frontline') || roleLower.includes('front line') || roleLower.includes('receptionist')) {
    return 'frontline';
  }
  if (roleLower.includes('internal services')) {
    return 'internalServices';
  }
  return 'filer'; // Default
}

/**
 * Fills a specific role minimum for a shift
 * @param {string} shiftId - The shift ID (e.g., 'D1A')
 * @param {string} roleCategory - Role category: 'filer', 'mentor', or 'frontline'
 * @param {number} minimum - Minimum number of this role needed
 * @param {Array} volunteers - Array of volunteer objects
 * @param {Object} schedule - Schedule object mapping shiftId to volunteer names
 * @param {Object} volunteerAssignments - Object mapping volunteer names to assigned shifts
 * @param {Object} shiftRoleCounts - Object tracking role counts per shift
 * @param {number} maxPerShift - Maximum volunteers per shift
 * @param {number} filerHardCap - Hard maximum filers per shift (only enforced for filer role)
 */
function fillRoleMinimum(shiftId, roleCategory, minimum, volunteers, schedule,
                         volunteerAssignments, shiftRoleCounts, maxPerShift, filerHardCap) {
  const currentCount = shiftRoleCounts[shiftId][roleCategory];
  const needed = minimum - currentCount;

  if (needed <= 0) return;

  // Enforce filer hard cap
  if (roleCategory === 'filer' && filerHardCap && shiftRoleCounts[shiftId].filer >= filerHardCap) return;

  // Find available volunteers of this role category for this shift
  const candidates = volunteers.filter(v =>
    v.roleCategory === roleCategory &&
    v.availability.includes(shiftId) &&
    volunteerAssignments[v.fullName].length < v.maxShifts &&
    !schedule[shiftId].includes(v.fullName) &&
    schedule[shiftId].length < maxPerShift
  );

  // Sort by remaining capacity (fewer remaining = higher priority to fill first)
  candidates.sort((a, b) => {
    const aRemaining = a.maxShifts - volunteerAssignments[a.fullName].length;
    const bRemaining = b.maxShifts - volunteerAssignments[b.fullName].length;
    return aRemaining - bRemaining;
  });

  // Assign up to needed count
  for (let i = 0; i < Math.min(needed, candidates.length); i++) {
    // Enforce filer hard cap during assignment loop
    if (roleCategory === 'filer' && filerHardCap && shiftRoleCounts[shiftId].filer >= filerHardCap) break;

    const volunteer = candidates[i];
    schedule[shiftId].push(volunteer.fullName);
    volunteerAssignments[volunteer.fullName].push(shiftId);
    shiftRoleCounts[shiftId][roleCategory]++;
  }
}

/**
 * Gets a spreadsheet by ID (for schedule automation, may be different from main CATBUS spreadsheet)
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {Spreadsheet} The spreadsheet object
 */
function getScheduleSpreadsheet(spreadsheetId) {
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * Gets a sheet from a specific spreadsheet
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Name of the sheet
 * @returns {Sheet} The sheet object
 */
function getScheduleSheet(spreadsheetId, sheetName) {
  const ss = getScheduleSpreadsheet(spreadsheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in spreadsheet`);
  }
  return sheet;
}

/**
 * Reads volunteer availability from form responses sheet
 * @param {string} spreadsheetId - Spreadsheet ID containing form responses
 * @param {string} sheetName - Name of the sheet containing form responses
 * @returns {Array<Object>} Array of volunteer availability objects
 */
function readAvailabilityResponses(spreadsheetId, sheetName) {
  if (!spreadsheetId || !sheetName) {
    throw new Error('Spreadsheet ID and sheet name are required');
  }

  Logger.log('Reading availability from spreadsheet: ' + spreadsheetId + ', sheet: ' + sheetName);

  // OPTIMIZED: Cache spreadsheet to avoid multiple opens
  const ss = getScheduleSpreadsheet(spreadsheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in spreadsheet`);
  }
  
  // OPTIMIZED: Get both last row and last column in single operation
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(8, sheet.getLastColumn()); // Ensure we read at least 8 columns

  Logger.log('Sheet has ' + lastRow + ' rows (including header)');

  if (lastRow <= 1) {
    Logger.log('No data rows found');
    return [];
  }

  Logger.log('Reading ' + (lastRow - 1) + ' data rows');

  const maxRows = Math.min(lastRow - 1, 1000);
  const data = sheet.getRange(2, 1, maxRows, 8).getValues();
  
  // Small delay after large read operation
  if (maxRows > 100) {
    Utilities.sleep(100);
  }

  const volunteers = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    // Skip empty rows
    if (!row[0] && !row[1] && !row[2]) continue;

    const firstName = row[1]?.toString().trim() || '';
    const lastName = row[2]?.toString().trim() || '';
    const email = row[3]?.toString().trim() || '';
    const role = row[4]?.toString().trim() || '';
    const maxShifts = parseInt(row[5]) || 0;
    const preferConsecutive = (row[6]?.toString().trim().toLowerCase() === 'yes');
    const availabilityString = row[7]?.toString().trim() || '';

    // Parse availability from comma-separated shift IDs
    // Format: "D1A,D1B,D2C" (shift IDs stored directly, no parsing needed!)
    const availability = [];
    if (availabilityString) {
      const shiftIds = availabilityString.split(',').map(id => id.trim());
      shiftIds.forEach(shiftId => {
        if (!shiftId) return; // Skip empty items

        // Validate shift ID
        if (SHIFT_IDS.includes(shiftId)) {
          availability.push(shiftId);
        } else {
          Logger.log(`Warning: Invalid shift ID "${shiftId}" for ${firstName} ${lastName}. Valid IDs: ${SHIFT_IDS.join(', ')}`);
        }
      });

      availability.sort((a, b) => SHIFT_IDS.indexOf(a) - SHIFT_IDS.indexOf(b));

      if (availability.length === 0 && shiftIds.length > 0) {
        Logger.log(`Warning: Volunteer ${firstName} ${lastName} has availability "${availabilityString}" but no valid shift IDs were found`);
      }
    }

    if (firstName && lastName && availability.length > 0 && maxShifts > 0) {
      volunteers.push({
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email,
        role,
        maxShifts,
        preferConsecutive,
        availability,
        assignedShifts: [] // Will be populated during scheduling
      });
    }
  }

  Logger.log(`Successfully read ${volunteers.length} volunteers with availability`);
  return volunteers;
}

/**
 * Checks if two shifts are consecutive (same day, adjacent times)
 * @param {string} shift1 - Shift ID (e.g., 'D1A')
 * @param {string} shift2 - Shift ID (e.g., 'D1B')
 * @returns {boolean} True if consecutive
 */
function areShiftsConsecutive(shift1, shift2) {
  const day1 = shift1.substring(0, 2); // 'D1', 'D2', etc.
  const day2 = shift2.substring(0, 2);
  
  if (day1 !== day2) return false; // Different days, not consecutive
  
  const time1 = shift1.substring(2); // 'A' (9:30-1:15), 'B' (1:00-4:45), 'C' (4:30-8:30)
  const time2 = shift2.substring(2);
  
  // Consecutive time slots: A->B, B->C
  return (time1 === 'A' && time2 === 'B') || (time1 === 'B' && time2 === 'C');
}

/**
 * Checks if adding a new shift would create a consecutive pair with any existing shifts
 * @param {string} newShift - Shift ID to check (e.g., 'D1B')
 * @param {Array<string>} existingShifts - Already-assigned shift IDs
 * @returns {boolean} True if newShift is consecutive with any existing shift
 */
function wouldCreateConsecutive(newShift, existingShifts) {
  return existingShifts.some(existing =>
    areShiftsConsecutive(existing, newShift) || areShiftsConsecutive(newShift, existing)
  );
}

/**
 * Generates an optimized schedule from volunteer availability
 * @param {string} spreadsheetId - Spreadsheet ID containing availability responses
 * @param {string} availabilitySheetName - Name of sheet with availability responses
 * @param {Object} options - Configuration options
 * @returns {Object} Schedule object with assignments
 */
function generateSchedule(spreadsheetId, availabilitySheetName, options = {}) {
  const {
    prioritizeConsecutive = true
  } = options;

  const FILER_HARD_CAP = 50; // Hard maximum filers per shift
  const ROLE_MIN_PER_SHIFT = 1; // Global minimum of each role per shift

  Logger.log('Reading availability from: ' + availabilitySheetName);

  // Read availability - removed safeExecute wrapper to reduce call stack depth
  const volunteers = readAvailabilityResponses(spreadsheetId, availabilitySheetName);

  Logger.log('Found ' + volunteers.length + ' volunteers with availability');

  if (volunteers.length === 0) {
    throw new Error('No volunteer availability data found. Please ensure volunteers have submitted the availability form.');
  }

    // Classify all volunteers by role
    volunteers.forEach(v => {
      v.roleCategory = classifyRole(v.role);
    });

    // Initialize schedule structure
    const schedule = {};
    SHIFT_IDS.forEach(shiftId => {
      schedule[shiftId] = [];
    });

    // Initialize role tracking per shift
    const shiftRoleCounts = {};
    SHIFT_IDS.forEach(shiftId => {
      shiftRoleCounts[shiftId] = { filer: 0, mentor: 0, frontline: 0, internalServices: 0 };
    });

    // Track assignments per volunteer
    const volunteerAssignments = {};
    volunteers.forEach(v => {
      volunteerAssignments[v.fullName] = [];
    });
    
    // Sort volunteers by availability count (fewer available = higher priority to assign)
    // This helps fill harder shifts first
    const sortedVolunteers = [...volunteers].sort((a, b) => {
      // First, prioritize those who want consecutive shifts
      if (prioritizeConsecutive) {
        if (a.preferConsecutive && !b.preferConsecutive) return -1;
        if (!a.preferConsecutive && b.preferConsecutive) return 1;
      }
      // Then by fewer available shifts (harder to schedule)
      return a.availability.length - b.availability.length;
    });

    // PHASE 1: Guarantee global minimum of each role per shift
    Logger.log(`Filling per-shift role minimums (${ROLE_MIN_PER_SHIFT} each)...`);

    for (const shiftId of SHIFT_IDS) {
      fillRoleMinimum(shiftId, 'filer', ROLE_MIN_PER_SHIFT, sortedVolunteers, schedule,
                      volunteerAssignments, shiftRoleCounts, 999, FILER_HARD_CAP);
      fillRoleMinimum(shiftId, 'mentor', ROLE_MIN_PER_SHIFT, sortedVolunteers, schedule,
                      volunteerAssignments, shiftRoleCounts, 999, null);
      fillRoleMinimum(shiftId, 'frontline', ROLE_MIN_PER_SHIFT, sortedVolunteers, schedule,
                      volunteerAssignments, shiftRoleCounts, 999, null);
    }

    // Log role target results
    for (const shiftId of SHIFT_IDS) {
      const counts = shiftRoleCounts[shiftId];
      Logger.log(`${shiftId} after role minimums: filers=${counts.filer}, mentors=${counts.mentor}, frontline=${counts.frontline}`);
    }

    // PHASE 1.5: Assign Internal Services volunteers to ALL their available shifts (guaranteed)
    const internalServicesVols = sortedVolunteers.filter(v => v.roleCategory === 'internalServices');
    for (const volunteer of internalServicesVols) {
      for (const shiftId of volunteer.availability) {
        if (!schedule[shiftId].includes(volunteer.fullName)) {
          schedule[shiftId].push(volunteer.fullName);
          volunteerAssignments[volunteer.fullName].push(shiftId);
          shiftRoleCounts[shiftId].internalServices++;
        }
      }
      Logger.log(`Internal Services: ${volunteer.fullName} assigned to ${volunteerAssignments[volunteer.fullName].length} shifts`);
    }

    // PHASE 2: Assign volunteers who prefer consecutive shifts
    if (prioritizeConsecutive) {
      const consecutiveVolunteers = sortedVolunteers.filter(v => v.preferConsecutive);

      for (const volunteer of consecutiveVolunteers) {
        if (volunteerAssignments[volunteer.fullName].length >= volunteer.maxShifts) continue;

        // Find consecutive chains in sorted availability (e.g., A→B→C)
        for (let i = 0; i < volunteer.availability.length; i++) {
          // Find end of consecutive chain starting at i
          let chainEnd = i;
          while (chainEnd + 1 < volunteer.availability.length &&
                 areShiftsConsecutive(volunteer.availability[chainEnd], volunteer.availability[chainEnd + 1])) {
            chainEnd++;
          }

          if (chainEnd > i) { // Chain of 2+ shifts found
            let chain = volunteer.availability.slice(i, chainEnd + 1);

            // Filter out already-assigned shifts (from Phase 1)
            chain = chain.filter(id => !schedule[id].includes(volunteer.fullName));

            // Enforce filer hard cap on each shift
            if (volunteer.roleCategory === 'filer') {
              chain = chain.filter(id => shiftRoleCounts[id].filer < FILER_HARD_CAP);
            }

            // Trim to remaining capacity
            const remaining = volunteer.maxShifts - volunteerAssignments[volunteer.fullName].length;
            if (chain.length > remaining) {
              chain = chain.slice(0, remaining);
            }

            // Assign all shifts in chain (only if 2+ remain after filtering)
            if (chain.length >= 2) {
              chain.forEach(id => {
                schedule[id].push(volunteer.fullName);
                volunteerAssignments[volunteer.fullName].push(id);
                shiftRoleCounts[id][volunteer.roleCategory]++;
              });
            }

            i = chainEnd; // Skip past the chain
          }
        }
      }
    }
    
    // PHASE 3: Ensure every filer has a minimum of 3 shift assignments
    const FILER_MIN_SHIFTS = 3;
    Logger.log('Ensuring filer minimum of ' + FILER_MIN_SHIFTS + ' shifts...');
    {
      // Get filers who are under the minimum and whose maxShifts allows it
      const underAssignedFilers = sortedVolunteers
        .filter(v => v.roleCategory === 'filer' &&
                     volunteerAssignments[v.fullName].length < FILER_MIN_SHIFTS &&
                     v.maxShifts >= FILER_MIN_SHIFTS)
        .sort((a, b) => volunteerAssignments[a.fullName].length - volunteerAssignments[b.fullName].length);

      for (const filer of underAssignedFilers) {
        while (volunteerAssignments[filer.fullName].length < FILER_MIN_SHIFTS &&
               volunteerAssignments[filer.fullName].length < filer.maxShifts) {
          // Find available shifts for this filer, preferring shifts with lowest headcount
          const availableShifts = filer.availability.filter(shiftId =>
            !schedule[shiftId].includes(filer.fullName) &&
            shiftRoleCounts[shiftId].filer < FILER_HARD_CAP
          );

          if (availableShifts.length === 0) break;

          // Pick the shift with the fewest current volunteers
          availableShifts.sort((a, b) => schedule[a].length - schedule[b].length);
          const bestShift = availableShifts[0];

          schedule[bestShift].push(filer.fullName);
          volunteerAssignments[filer.fullName].push(bestShift);
          shiftRoleCounts[bestShift].filer++;
        }
      }

      // Log results
      const stillUnder = sortedVolunteers.filter(v =>
        v.roleCategory === 'filer' &&
        v.maxShifts >= FILER_MIN_SHIFTS &&
        volunteerAssignments[v.fullName].length < FILER_MIN_SHIFTS
      );
      if (stillUnder.length > 0) {
        Logger.log(`Warning: ${stillUnder.length} filers could not reach ${FILER_MIN_SHIFTS} shifts (limited availability)`);
        stillUnder.forEach(v => Logger.log(`  ${v.fullName}: ${volunteerAssignments[v.fullName].length}/${FILER_MIN_SHIFTS} shifts`));
      } else {
        Logger.log('All eligible filers have at least ' + FILER_MIN_SHIFTS + ' shifts');
      }
    }

    // PHASE 4: Fill remaining shifts, balancing role distribution across shifts
    // OPTIMIZED: Build availability index once instead of filtering repeatedly
    const shiftToVolunteers = {};
    SHIFT_IDS.forEach(shiftId => {
      shiftToVolunteers[shiftId] = [];
    });

    // Build reverse index: for each shift, which volunteers are available
    sortedVolunteers.forEach(v => {
      v.availability.forEach(shiftId => {
        if (shiftToVolunteers[shiftId]) {
          shiftToVolunteers[shiftId].push(v);
        }
      });
    });

    // Round-robin: repeatedly assign one volunteer to the (shift, role) pair with the
    // largest deficit vs. the cross-shift average, ensuring even role distribution
    const roles = ['filer', 'mentor', 'frontline', 'internalServices'];
    let madeAssignment = true;
    while (madeAssignment) {
      madeAssignment = false;

      // For each (shift, role) pair, compute deficit = avgRoleCount - thisShiftRoleCount
      // Pick the pair with the largest deficit that has assignable candidates
      let bestShift = null;
      let bestRole = null;
      let bestDeficit = -Infinity;

      // Compute average role counts across all shifts
      const avgRoleCounts = {};
      for (const role of roles) {
        const total = SHIFT_IDS.reduce((sum, id) => sum + shiftRoleCounts[id][role], 0);
        avgRoleCounts[role] = total / SHIFT_IDS.length;
      }

      for (const shiftId of SHIFT_IDS) {
        for (const role of roles) {
          // Hard cap: skip filer assignments for shifts at the filer limit
          if (role === 'filer' && shiftRoleCounts[shiftId].filer >= FILER_HARD_CAP) continue;

          const deficit = avgRoleCounts[role] - shiftRoleCounts[shiftId][role];
          if (deficit <= bestDeficit) continue;

          // Check if any volunteer of this role can be assigned here
          const hasCandidates = shiftToVolunteers[shiftId].some(v =>
            v.roleCategory === role &&
            volunteerAssignments[v.fullName].length < v.maxShifts &&
            !schedule[shiftId].includes(v.fullName)
          );

          if (hasCandidates) {
            bestShift = shiftId;
            bestRole = role;
            bestDeficit = deficit;
          }
        }
      }

      // Fallback: if no role-specific deficit found, fall back to lowest total headcount
      if (!bestShift) {
        let bestCount = Infinity;
        for (const shiftId of SHIFT_IDS) {
          const currentCount = schedule[shiftId].length;
          if (currentCount >= bestCount) continue;
          const hasCandidates = shiftToVolunteers[shiftId].some(v =>
            volunteerAssignments[v.fullName].length < v.maxShifts &&
            !schedule[shiftId].includes(v.fullName)
          );
          if (hasCandidates) {
            bestShift = shiftId;
            bestCount = currentCount;
          }
        }
      }

      if (!bestShift) break;

      // Pick the best volunteer for this shift, preferring the target role
      // Enforce filer hard cap: exclude filers if shift is at the cap
      let candidates = shiftToVolunteers[bestShift].filter(v =>
        v.roleCategory !== 'internalServices' && // Already fully assigned in Phase 1.5
        volunteerAssignments[v.fullName].length < v.maxShifts &&
        !schedule[bestShift].includes(v.fullName) &&
        (v.roleCategory !== 'filer' || shiftRoleCounts[bestShift].filer < FILER_HARD_CAP) &&
        // Avoid creating consecutive shifts for volunteers who don't want them
        (v.preferConsecutive || !wouldCreateConsecutive(bestShift, volunteerAssignments[v.fullName]))
      );

      // Prefer candidates matching the target role
      if (bestRole) {
        const roleMatched = candidates.filter(v => v.roleCategory === bestRole);
        if (roleMatched.length > 0) {
          candidates = roleMatched;
        }
      }

      candidates.sort((a, b) => {
        // If assigning to a Day 4 shift, prefer volunteers who already have D1-D3 shifts
        if (bestShift.startsWith('D4')) {
          const aHasEarlier = volunteerAssignments[a.fullName].some(id => !id.startsWith('D4'));
          const bHasEarlier = volunteerAssignments[b.fullName].some(id => !id.startsWith('D4'));
          if (aHasEarlier && !bHasEarlier) return -1;
          if (!aHasEarlier && bHasEarlier) return 1;
        }
        // Then by most remaining capacity
        const aRemaining = a.maxShifts - volunteerAssignments[a.fullName].length;
        const bRemaining = b.maxShifts - volunteerAssignments[b.fullName].length;
        return bRemaining - aRemaining;
      });

      if (candidates.length > 0) {
        const volunteer = candidates[0];
        schedule[bestShift].push(volunteer.fullName);
        volunteerAssignments[volunteer.fullName].push(bestShift);
        shiftRoleCounts[bestShift][volunteer.roleCategory]++;
        madeAssignment = true;
      }
    }

    // Log final counts
    for (const shiftId of SHIFT_IDS) {
      Logger.log(`Shift ${shiftId}: ${schedule[shiftId].length} volunteers`);
    }
    
    // Calculate shortfalls (shifts where role minimums weren't met)
    const shortfalls = [];
    for (const shiftId of SHIFT_IDS) {
      const counts = shiftRoleCounts[shiftId];

      if (counts.filer < ROLE_MIN_PER_SHIFT) {
        shortfalls.push({ shiftId, role: 'Filer', target: ROLE_MIN_PER_SHIFT, actual: counts.filer });
      }
      if (counts.mentor < ROLE_MIN_PER_SHIFT) {
        shortfalls.push({ shiftId, role: 'Mentor', target: ROLE_MIN_PER_SHIFT, actual: counts.mentor });
      }
      if (counts.frontline < ROLE_MIN_PER_SHIFT) {
        shortfalls.push({ shiftId, role: 'Frontline', target: ROLE_MIN_PER_SHIFT, actual: counts.frontline });
      }
      if (counts.internalServices < ROLE_MIN_PER_SHIFT) {
        shortfalls.push({ shiftId, role: 'Internal Services', target: ROLE_MIN_PER_SHIFT, actual: counts.internalServices });
      }
    }

    if (shortfalls.length > 0) {
      Logger.log(`Warning: ${shortfalls.length} role targets could not be fully met`);
      shortfalls.forEach(sf => {
        Logger.log(`  ${sf.shiftId} ${sf.role}: ${sf.actual}/${sf.target}`);
      });
    }

    // Build result summary
    const result = {
      schedule,
      volunteerAssignments,
      shiftRoleCounts, // Include role distribution per shift
      summary: {
        totalShifts: SHIFT_IDS.length,
        totalVolunteers: volunteers.length,
        shiftsFilled: SHIFT_IDS.filter(id => schedule[id].length > 0).length,
        totalAssignments: Object.values(volunteerAssignments).reduce((sum, shifts) => sum + shifts.length, 0),
        shortfalls: shortfalls,
        roleDistribution: {
          filers: volunteers.filter(v => v.roleCategory === 'filer').length,
          mentors: volunteers.filter(v => v.roleCategory === 'mentor').length,
          frontline: volunteers.filter(v => v.roleCategory === 'frontline').length,
          internalServices: volunteers.filter(v => v.roleCategory === 'internalServices').length
        }
      },
      volunteers: volunteers.map(v => ({
        name: v.fullName,
        role: v.role || 'N/A',
        roleCategory: v.roleCategory,
        email: v.email,
        maxShifts: v.maxShifts,
        assignedShifts: volunteerAssignments[v.fullName] || [],
        assignedCount: (volunteerAssignments[v.fullName] || []).length
      }))
    };

  Logger.log(`Schedule generated: ${result.summary.shiftsFilled}/${result.summary.totalShifts} shifts filled`);
  return result;
}

/**
 * Outputs schedule to a formatted Google Sheet
 * @param {string} spreadsheetId - Spreadsheet ID to output schedule to
 * @param {Object} scheduleResult - Result from generateSchedule()
 * @param {string} outputSheetName - Name of sheet to create/update
 * @param {Array<string>} dayLabels - Optional labels for the 4 days (e.g., ['Saturday', 'Sunday', 'Monday', 'Tuesday'])
 * @returns {boolean} True if successful
 */
function outputScheduleToSheet(spreadsheetId, scheduleResult, outputSheetName, dayLabels = null) {
  return safeExecute(() => {
    try {
      if (!spreadsheetId || !outputSheetName) {
        throw new Error('Spreadsheet ID and output sheet name are required');
      }
      
      if (!scheduleResult || !scheduleResult.schedule) {
        Logger.log('Error: scheduleResult structure: ' + JSON.stringify(Object.keys(scheduleResult || {})));
        throw new Error('Invalid schedule result data - schedule property missing');
      }
      
      Logger.log(`Creating schedule sheet: ${outputSheetName}`);
      Logger.log(`Schedule result has ${Object.keys(scheduleResult.schedule || {}).length} shifts`);
      Logger.log(`Schedule result has ${(scheduleResult.volunteers || []).length} volunteers`);
      
      const ss = getScheduleSpreadsheet(spreadsheetId);
      
      // Delete existing sheet if it exists
      let sheet = ss.getSheetByName(outputSheetName);
      if (sheet) {
        Logger.log(`Deleting existing sheet: ${outputSheetName}`);
        ss.deleteSheet(sheet);
        // Delay to ensure deletion completes
        Utilities.sleep(500);
      }
      
      // Create new sheet
      Logger.log(`Creating new sheet: ${outputSheetName}`);
      sheet = ss.insertSheet(outputSheetName);
      
      if (!sheet) {
        throw new Error(`Failed to create sheet: ${outputSheetName}`);
      }
      
      Logger.log(`Sheet created successfully: ${outputSheetName}`);
      
      // Small delay after sheet creation
      Utilities.sleep(200);
      
      // Default day labels if not provided
      const days = dayLabels || ['Day 1', 'Day 2', 'Day 3', 'Day 4'];
      
      // Build all data arrays first (OPTIMIZED: batch write instead of individual writes)
      const allData = [];
      const formatRanges = []; // Track ranges that need special formatting
      
      // Create header row
      const headers = ['Time / Day', ...days];
      allData.push(headers);
      
      // Create shift rows using display labels from config
      const times = ['A', 'B', 'C'].map(slotKey => SCHEDULE_CONFIG.TIME_SLOTS[slotKey].display);
      const schedule = scheduleResult.schedule;
      
      for (let timeIdx = 0; timeIdx < 3; timeIdx++) {
        const row = [times[timeIdx]];
        
        for (let dayIdx = 0; dayIdx < 4; dayIdx++) {
          const shiftId = SHIFT_IDS[dayIdx * 3 + timeIdx];
          const volunteers = schedule[shiftId] || [];
          row.push(volunteers.join(', ') || '(unfilled)');
        }
        
        allData.push(row);
      }
      
      // Add spacing row (empty) - pad with empty strings to match column count
      const emptyRow = new Array(headers.length).fill('');
      allData.push(emptyRow);
      
      // Build chart source data for 4 stacked bar charts (one per day)
      // Each block: header row + 3 data rows (Morning, Afternoon, Evening) with role counts
      const chartDataBlocks = [];
      const shiftLabels = ['Morning', 'Afternoon', 'Evening'];
      const slotKeys = ['A', 'B', 'C'];

      for (let dayIdx = 0; dayIdx < 4; dayIdx++) {
        const dayStartRow = allData.length + 1; // 1-indexed row in sheet

        // Header row for this day's chart data
        const chartHeader = [days[dayIdx], 'Filers', 'Mentors', 'Frontline', 'Internal Services'];
        while (chartHeader.length < headers.length) chartHeader.push('');
        allData.push(chartHeader);

        // Data rows for each shift
        for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
          const shiftId = `D${dayIdx + 1}${slotKeys[slotIdx]}`;
          const counts = scheduleResult.shiftRoleCounts[shiftId] || { filer: 0, mentor: 0, frontline: 0, internalServices: 0 };
          const row = [shiftLabels[slotIdx], counts.filer, counts.mentor, counts.frontline, counts.internalServices];
          while (row.length < headers.length) row.push('');
          allData.push(row);
        }

        chartDataBlocks.push({
          dayLabel: days[dayIdx],
          headerRow: dayStartRow,        // 1-indexed
          dataStartRow: dayStartRow + 1, // first data row (Morning)
          dataEndRow: dayStartRow + 3    // last data row (Evening)
        });

        // Empty separator row between days
        allData.push(new Array(headers.length).fill(''));
      }
      
      // Add summary statistics
      const statsStartRow = allData.length + 1; // Track where stats start (1-indexed)
      const stats = [
        ['Summary Statistics', ''],
        ['Total Shifts', scheduleResult.summary.totalShifts],
        ['Shifts with Assignments', scheduleResult.summary.shiftsFilled],
        ['Filer Hard Cap', '50 per shift'],
        ['Filer Min Shifts', '3 per filer'],
        ['Total Volunteers', scheduleResult.summary.totalVolunteers],
        ['Total Assignments', scheduleResult.summary.totalAssignments]
      ];
      
      // Pad stats rows
      stats.forEach(row => {
        while (row.length < headers.length) {
          row.push('');
        }
        allData.push(row);
      });
      
      formatRanges.push({ row: statsStartRow, type: 'statsHeader' });
      
      // Validate all rows have correct column count
      for (let i = 0; i < allData.length; i++) {
        if (!allData[i] || !Array.isArray(allData[i])) {
          Logger.log(`Warning: Row ${i + 1} is not an array, fixing...`);
          allData[i] = new Array(headers.length).fill('');
        } else if (allData[i].length !== headers.length) {
          Logger.log(`Warning: Row ${i + 1} has ${allData[i].length} columns, expected ${headers.length}, fixing...`);
          while (allData[i].length < headers.length) {
            allData[i].push('');
          }
          allData[i] = allData[i].slice(0, headers.length);
        }
      }
      
      // OPTIMIZED: Write all data in one batch operation
      Logger.log(`Writing ${allData.length} rows, ${headers.length} columns in batch...`);
      try {
        const dataRange = sheet.getRange(1, 1, allData.length, headers.length);
        dataRange.setValues(allData);
      } catch (error) {
        Logger.log('Error writing batch data: ' + error.message);
        Logger.log('Data shape: ' + allData.length + ' rows, checking first row length: ' + (allData[0] ? allData[0].length : 'null'));
        throw new Error('Failed to write schedule data: ' + error.message);
      }
      
      // Small delay after large write
      Utilities.sleep(300);
      
      // OPTIMIZED: Apply formatting in batches
      // Format header row (row 1)
      try {
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#4285f4');
        headerRange.setFontColor('#ffffff');
        headerRange.setHorizontalAlignment('center');
      } catch (e) {
        Logger.log('Warning: Could not format header row: ' + e.message);
      }

      // Format chart data header rows (light gray background, bold)
      for (const block of chartDataBlocks) {
        try {
          const chartHeaderRange = sheet.getRange(block.headerRow, 1, 1, 4);
          chartHeaderRange.setFontWeight('bold');
          chartHeaderRange.setBackground('#e8eaed');
        } catch (e) {
          Logger.log('Warning: Could not format chart data header: ' + e.message);
        }
      }

      // Format stats header
      try {
        const statsHeaderEntry = formatRanges.find(f => f.type === 'statsHeader');
        if (statsHeaderEntry && statsHeaderEntry.row > 0 && statsHeaderEntry.row <= allData.length) {
          const statsHeaderRange = sheet.getRange(statsHeaderEntry.row, 1, 1, 2);
          statsHeaderRange.setFontWeight('bold');
        }
      } catch (e) {
        Logger.log('Warning: Could not format stats header: ' + e.message);
      }

      // Small delay before final operations
      Utilities.sleep(200);
      
      // Auto-resize columns (limit to first 10 columns to avoid timeout)
      try {
        sheet.autoResizeColumns(1, Math.min(headers.length, 10));
      } catch (e) {
        Logger.log('Auto-resize warning: ' + e.message);
        // Continue if auto-resize fails
      }
      
      // Freeze header row
      try {
        sheet.setFrozenRows(1);
      } catch (e) {
        Logger.log('Warning: Could not freeze header row: ' + e.message);
        // Continue - freezing is not critical
      }
      
      // Final verification that sheet exists and has data
      const verifySheet = ss.getSheetByName(outputSheetName);
      if (!verifySheet) {
        throw new Error(`Sheet verification failed: ${outputSheetName} was not found after creation`);
      }
      
      const lastRow = verifySheet.getLastRow();
      if (lastRow < 1) {
        throw new Error(`Sheet verification failed: ${outputSheetName} appears to be empty`);
      }
      
      Logger.log(`Schedule successfully output to sheet: ${outputSheetName} (${lastRow} rows)`);
      return true;
    } catch (error) {
      Logger.log('ERROR in outputScheduleToSheet: ' + error.message);
      Logger.log('ERROR Stack: ' + (error.stack || 'No stack trace'));
      Logger.log('Error type: ' + (error.name || 'Unknown'));
      
      // Re-throw with more context
      throw new Error('outputScheduleToSheet failed: ' + error.message + (error.stack ? ' | Stack: ' + error.stack.substring(0, 200) : ''));
    }
  }, 'outputScheduleToSheet');
}

/**
 * Main function to generate and output schedule in one step
 * @param {string} spreadsheetId - Spreadsheet ID containing availability responses
 * @param {string} availabilitySheetName - Name of sheet with availability responses
 * @param {string} outputSheetName - Name of sheet to create/update (in same spreadsheet)
 * @param {Object} options - Configuration options
 * @returns {Object} Schedule result object
 */
function createSchedule(spreadsheetId, availabilitySheetName, outputSheetName, options = {}) {
  Logger.log('Starting schedule generation...');

  // Generate schedule - this is the heavy computation
  Logger.log('Calling generateSchedule...');
  const scheduleResult = generateSchedule(spreadsheetId, availabilitySheetName, options);
  Logger.log('Schedule generated with ' + scheduleResult.summary.totalAssignments + ' assignments');

  // OPTIMIZED: Add delay between computation and spreadsheet operations
  Utilities.sleep(300);

  // Output to sheet (same spreadsheet)
  Logger.log('Writing schedule to sheet...');
  const outputResult = outputScheduleToSheet(spreadsheetId, scheduleResult, outputSheetName, options.dayLabels);

  if (!outputResult) {
    throw new Error('Failed to create schedule sheet');
  }

  // OPTIMIZED: Small delay before verification
  Utilities.sleep(200);

  // Verify sheet was created
  const ss = getScheduleSpreadsheet(spreadsheetId);
  const createdSheet = ss.getSheetByName(outputSheetName);
  if (!createdSheet) {
    throw new Error(`Schedule sheet "${outputSheetName}" was not created successfully`);
  }

  Logger.log('Schedule generation complete');
  return scheduleResult;
}

/**
 * Extracts spreadsheet ID from a Google Sheets URL
 * @param {string} url - Google Sheets URL
 * @returns {string} Spreadsheet ID
 */
function extractSpreadsheetId(url) {
  // Handle various URL formats:
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
  // SPREADSHEET_ID (direct ID)
  
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL');
  }
  
  const trimmed = url.trim();
  
  // If it's already just an ID (no slashes)
  if (!trimmed.includes('/')) {
    return trimmed;
  }
  
  // Extract ID from URL
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  throw new Error('Could not extract spreadsheet ID from URL');
}

/**
 * Gets list of sheet names from a spreadsheet
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {Array<string>} Array of sheet names
 */
function getSheetNames(spreadsheetId) {
  return safeExecute(() => {
    const ss = getScheduleSpreadsheet(spreadsheetId);
    return ss.getSheets().map(sheet => sheet.getName());
  }, 'getSheetNames');
}

/**
 * Extracts spreadsheet ID from URL and returns sheet names
 * Used by the dashboard UI
 * @param {string} url - Google Sheets URL or ID
 * @returns {Array<string>} Array of sheet names
 */
function extractSpreadsheetIdAndGetSheets(url) {
  return safeExecute(() => {
    const spreadsheetId = extractSpreadsheetId(url);
    return getSheetNames(spreadsheetId);
  }, 'extractSpreadsheetIdAndGetSheets');
}

/**
 * Main function called from dashboard UI to generate schedule
 * Uses the main CATBUS spreadsheet and configured availability sheet
 * @param {string} outputSheetName - Name of sheet to create/update
 * @param {Object} options - Configuration options
 * @returns {Object} Schedule result object
 */
function generateScheduleFromDashboard(outputSheetName, options = {}) {
  try {
    Logger.log('=== SCHEDULE GENERATION START ===');
    Logger.log('Output sheet: ' + outputSheetName);
    Logger.log('Options: ' + JSON.stringify(options));

    // Use main CATBUS spreadsheet
    const spreadsheetId = CONFIG.SPREADSHEET_ID;
    const availabilitySheetName = CONFIG.SHEETS.SCHEDULE_AVAILABILITY;

    // Don't nest safeExecute - just call directly to avoid deep call stack
    Logger.log('Calling createSchedule...');
    Logger.log('Spreadsheet ID: ' + spreadsheetId);
    Logger.log('Availability sheet: ' + availabilitySheetName);
    
    const result = createSchedule(spreadsheetId, availabilitySheetName, outputSheetName, options);

    Logger.log('=== SCHEDULE GENERATION COMPLETE ===');
    return result;
  } catch (error) {
    Logger.log('ERROR in generateScheduleFromDashboard: ' + error.message);
    Logger.log('Error type: ' + (error.name || 'Unknown'));
    Logger.log('Stack: ' + (error.stack || 'No stack trace'));
    Logger.log('Full error: ' + JSON.stringify(error));
    
    // Preserve original error message if it's informative
    const errorMsg = error.message || error.toString();
    throw new Error('Schedule generation failed: ' + errorMsg);
  }
}

/**
 * Gets schedule statistics for a generated schedule
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} scheduleSheetName - Name of the schedule sheet
 * @returns {Object} Statistics object
 */
function getScheduleStats(spreadsheetId, scheduleSheetName) {
  return safeExecute(() => {
    const sheet = getScheduleSheet(spreadsheetId, scheduleSheetName);
    
    // This would parse the existing schedule sheet if needed
    // For now, just return basic info
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    return {
      sheetName: scheduleSheetName,
      lastRow,
      lastCol,
      message: 'Use createSchedule() to generate a new schedule or parse existing sheet'
    };
  }, 'getScheduleStats');
}

/**
 * Diagnostic function to check availability sheet data
 * Returns raw data from the first few rows to help debug issues
 * @returns {Object} Debug information
 */
function debugAvailabilitySheet() {
  return safeExecute(() => {
    const spreadsheetId = CONFIG.SPREADSHEET_ID;
    const sheetName = CONFIG.SHEETS.SCHEDULE_AVAILABILITY;

    // First, check if spreadsheet and sheet exist
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const allSheets = ss.getSheets().map(s => s.getName());

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return {
        error: `Sheet "${sheetName}" not found in spreadsheet`,
        requestedSheetName: sheetName,
        availableSheets: allSheets,
        spreadsheetId: spreadsheetId,
        note: 'The Schedule Availability sheet does not exist. Please check the sheet name or create it using the availability form.'
      };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow <= 1) {
      return {
        error: 'No data found in Schedule Availability sheet',
        sheetName: sheetName,
        lastRow: lastRow,
        lastCol: lastCol,
        note: 'Sheet exists but has no data. Please submit the availability form to populate data.'
      };
    }

    // Read headers
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // Read first 3 data rows (or all if less than 3)
    const numSampleRows = Math.min(3, lastRow - 1);
    const sampleData = sheet.getRange(2, 1, numSampleRows, lastCol).getValues();

    // DON'T call readAvailabilityResponses - it causes nested safeExecute and "system busy"
    // Instead do a quick inline check
    let quickTest = { success: true, volunteers: 0 };
    try {
      const testData = sheet.getRange(2, 1, Math.min(10, lastRow - 1), 8).getValues();
      let count = 0;
      for (let i = 0; i < testData.length; i++) {
        const firstName = testData[i][1]?.toString().trim();
        const lastName = testData[i][2]?.toString().trim();
        const availability = testData[i][7]?.toString().trim();
        if (firstName && lastName && availability) {
          count++;
        }
      }
      quickTest.volunteers = count;
    } catch (e) {
      quickTest.success = false;
      quickTest.error = e.message;
    }

    // Convert Date objects to strings for JSON serialization
    const serializedSampleData = sampleData.map(row =>
      row.map(cell => cell instanceof Date ? cell.toISOString() : cell)
    );

    return {
      sheetName: sheetName,
      totalRows: lastRow - 1,
      totalColumns: lastCol,
      headers: headers,
      sampleData: serializedSampleData,
      quickTest: quickTest,
      expectedFormat: 'Columns: Timestamp, First Name, Last Name, Email, Role, Number of Shifts, Consecutive Preference, Availability',
      note: 'Data format looks good! Your availability data is properly formatted.',
      recommendation: 'Click "Generate Schedule" to create the shift schedule. The data is ready!'
    };
  }, 'debugAvailabilitySheet');
}
