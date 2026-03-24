/**
 * Schedule Automation Functions
 * Automates schedule generation from volunteer availability form responses
 */

const SHIFT_IDS = SCHEDULE_CONFIG.getAllShiftIds();

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
 * Ensures every volunteer of a given role has at least `minShifts` assignments.
 * Used by Phase 3 (filers) and Phase 3.5 (frontline) — extracted to avoid duplication.
 */
function ensureRoleMinShifts(roleCategory, minShifts, sortedVolunteers, schedule,
                              volunteerAssignments, shiftRoleCounts, lockedShiftIds, hardCap) {
  const underAssigned = sortedVolunteers
    .filter(v => v.roleCategory === roleCategory &&
                 volunteerAssignments[v.fullName].length < minShifts &&
                 v.maxShifts >= minShifts)
    .sort((a, b) => volunteerAssignments[a.fullName].length - volunteerAssignments[b.fullName].length);

  for (const vol of underAssigned) {
    while (volunteerAssignments[vol.fullName].length < minShifts &&
           volunteerAssignments[vol.fullName].length < vol.maxShifts) {
      const availableShifts = vol.availability.filter(shiftId =>
        !lockedShiftIds.has(shiftId) &&
        !schedule[shiftId].includes(vol.fullName) &&
        (!hardCap || shiftRoleCounts[shiftId][roleCategory] < hardCap)
      );
      if (availableShifts.length === 0) break;
      availableShifts.sort((a, b) => schedule[a].length - schedule[b].length);
      const bestShift = availableShifts[0];
      schedule[bestShift].push(vol.fullName);
      volunteerAssignments[vol.fullName].push(bestShift);
      shiftRoleCounts[bestShift][roleCategory]++;
    }
  }

  const stillUnder = sortedVolunteers.filter(v =>
    v.roleCategory === roleCategory && v.maxShifts >= minShifts &&
    volunteerAssignments[v.fullName].length < minShifts
  );
  if (stillUnder.length > 0) {
    Logger.log(`Warning: ${stillUnder.length} ${roleCategory}s could not reach ${minShifts} shifts`);
    stillUnder.forEach(v => Logger.log(`  ${v.fullName}: ${volunteerAssignments[v.fullName].length}/${minShifts}`));
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
 * Reads volunteer availability from form responses sheet
 * @param {string} spreadsheetId - Spreadsheet ID containing form responses
 * @param {string} sheetName - Name of the sheet containing form responses
 * @returns {Array<Object>} Array of volunteer availability objects
 */
function readAvailabilityResponses(spreadsheetId, sheetName) {
  if (!spreadsheetId || !sheetName) {
    throw new Error('Spreadsheet ID and sheet name are required');
  }

  // Cache spreadsheet to avoid multiple opens
  const ss = getScheduleSpreadsheet(spreadsheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in spreadsheet`);
  }
  
  // OPTIMIZED: Get both last row and last column in single operation
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(10, sheet.getLastColumn()); // Ensure we read at least 10 columns

  if (lastRow <= 1) {
    return [];
  }

  const maxRows = Math.min(lastRow - 1, 1000);
  const data = sheet.getRange(2, 1, maxRows, 10).getValues();
  

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
        timestamp: row[0] instanceof Date ? row[0] : new Date(row[0]),
        lastModified: row[9] instanceof Date ? row[9] : (row[9] ? new Date(row[9]) : null)
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
    prioritizeConsecutive = true,
    lockedAssignments: lockedAssignmentsOpt = {},
    lockedShiftIds: lockedShiftIdsOpt = [],
    excludeVolunteers: excludeVolunteersOpt = new Set()
  } = options;

  const lockedShiftIds = new Set(lockedShiftIdsOpt);

  const FILER_HARD_CAP = SCHEDULE_CONFIG.FILER_HARD_CAP;
  const ROLE_MIN_PER_SHIFT = SCHEDULE_CONFIG.ROLE_MIN_PER_SHIFT;

  const volunteers = readAvailabilityResponses(spreadsheetId, availabilitySheetName);

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

    // === PARTIAL UPDATE: Pre-populate locked assignments ===
    for (const [name, shifts] of Object.entries(lockedAssignmentsOpt)) {
      const volData = volunteers.find(v => v.fullName === name);
      const roleCategory = volData ? volData.roleCategory : 'filer';
      if (!volunteerAssignments[name]) volunteerAssignments[name] = [];
      for (const shiftId of shifts) {
        if (!SHIFT_IDS.includes(shiftId)) continue;
        if (!schedule[shiftId].includes(name)) {
          schedule[shiftId].push(name);
          volunteerAssignments[name].push(shiftId);
          shiftRoleCounts[shiftId][roleCategory]++;
        }
      }
    }
    // Only run the algorithm for volunteers who are explicitly excluded (unchanged in partial update)
    // Note: volunteers in lockedAssignments but NOT in excludeVolunteers still participate
    // in future shift scheduling — their pre-populated past shifts count toward maxShifts
    const activeVolunteers = volunteers.filter(v => !excludeVolunteersOpt.has(v.fullName));
    if (excludeVolunteersOpt.size > 0 || lockedShiftIds.size > 0) {
      Logger.log('Partial update: ' + excludeVolunteersOpt.size + ' excluded volunteers, ' + lockedShiftIds.size + ' locked shifts');
    }

    // Sort volunteers by availability count (fewer available = higher priority to assign)
    // This helps fill harder shifts first
    const sortedVolunteers = [...activeVolunteers].sort((a, b) => {
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
      if (lockedShiftIds.has(shiftId)) continue;
      fillRoleMinimum(shiftId, 'filer', ROLE_MIN_PER_SHIFT, sortedVolunteers, schedule,
                      volunteerAssignments, shiftRoleCounts, 999, FILER_HARD_CAP);
      fillRoleMinimum(shiftId, 'mentor', ROLE_MIN_PER_SHIFT, sortedVolunteers, schedule,
                      volunteerAssignments, shiftRoleCounts, 999, null);
      fillRoleMinimum(shiftId, 'frontline', ROLE_MIN_PER_SHIFT, sortedVolunteers, schedule,
                      volunteerAssignments, shiftRoleCounts, 999, null);
    }

    // PHASE 1.5: Assign Internal Services volunteers to ALL their available shifts (guaranteed)
    const internalServicesVols = sortedVolunteers.filter(v => v.roleCategory === 'internalServices');
    for (const volunteer of internalServicesVols) {
      for (const shiftId of volunteer.availability) {
        if (lockedShiftIds.has(shiftId)) continue;
        if (!schedule[shiftId].includes(volunteer.fullName)) {
          schedule[shiftId].push(volunteer.fullName);
          volunteerAssignments[volunteer.fullName].push(shiftId);
          shiftRoleCounts[shiftId].internalServices++;
        }
      }
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

            // Filter out already-assigned, locked, and hard-capped shifts
            chain = chain.filter(id =>
              !schedule[id].includes(volunteer.fullName) &&
              !lockedShiftIds.has(id) &&
              (volunteer.roleCategory !== 'filer' || shiftRoleCounts[id].filer < FILER_HARD_CAP)
            );

            // Re-extract longest consecutive sub-chain (filtering may have created gaps)
            let bestSub = [];
            let currentSub = chain.length > 0 ? [chain[0]] : [];
            for (let j = 1; j < chain.length; j++) {
              if (areShiftsConsecutive(chain[j - 1], chain[j])) {
                currentSub.push(chain[j]);
              } else {
                if (currentSub.length > bestSub.length) bestSub = currentSub;
                currentSub = [chain[j]];
              }
            }
            if (currentSub.length > bestSub.length) bestSub = currentSub;
            chain = bestSub;

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
    
    // PHASE 3: Ensure every filer has a minimum number of shift assignments
    Logger.log('Ensuring filer minimum of ' + SCHEDULE_CONFIG.FILER_MIN_SHIFTS + ' shifts...');
    ensureRoleMinShifts('filer', SCHEDULE_CONFIG.FILER_MIN_SHIFTS, sortedVolunteers, schedule,
                        volunteerAssignments, shiftRoleCounts, lockedShiftIds, FILER_HARD_CAP);

    // PHASE 3.5: Ensure every frontline volunteer has a minimum number of shift assignments
    Logger.log('Ensuring frontline minimum of ' + SCHEDULE_CONFIG.FRONTLINE_MIN_SHIFTS + ' shifts...');
    ensureRoleMinShifts('frontline', SCHEDULE_CONFIG.FRONTLINE_MIN_SHIFTS, sortedVolunteers, schedule,
                        volunteerAssignments, shiftRoleCounts, lockedShiftIds, null);

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
    const numShifts = SHIFT_IDS.length;

    // Compute role totals once, then update incrementally after each assignment
    const roleTotals = {};
    for (const role of roles) {
      roleTotals[role] = SHIFT_IDS.reduce((sum, id) => sum + shiftRoleCounts[id][role], 0);
    }

    let madeAssignment = true;
    while (madeAssignment) {
      madeAssignment = false;

      let bestShift = null;
      let bestRole = null;
      let bestDeficit = -Infinity;

      for (const shiftId of SHIFT_IDS) {
        if (lockedShiftIds.has(shiftId)) continue;
        for (const role of roles) {
          // Hard cap: skip filer assignments for shifts at the filer limit
          if (role === 'filer' && shiftRoleCounts[shiftId].filer >= FILER_HARD_CAP) continue;

          const deficit = (roleTotals[role] / numShifts) - shiftRoleCounts[shiftId][role];
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
          if (lockedShiftIds.has(shiftId)) continue;
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
      const baseCandidates = shiftToVolunteers[bestShift].filter(v =>
        v.roleCategory !== 'internalServices' && // Already fully assigned in Phase 1.5
        volunteerAssignments[v.fullName].length < v.maxShifts &&
        !schedule[bestShift].includes(v.fullName) &&
        (v.roleCategory !== 'filer' || shiftRoleCounts[bestShift].filer < FILER_HARD_CAP)
      );

      // Prefer non-consecutive assignments for volunteers who don't want consecutive shifts.
      // Fall back to all candidates if no non-consecutive option exists, so maxShifts is reachable.
      const nonConsecutiveCandidates = baseCandidates.filter(v =>
        v.preferConsecutive || !wouldCreateConsecutive(bestShift, volunteerAssignments[v.fullName])
      );
      let candidates = nonConsecutiveCandidates.length > 0 ? nonConsecutiveCandidates : baseCandidates;

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
        roleTotals[volunteer.roleCategory]++;
        madeAssignment = true;
      }
    }

    // PHASE 6: Volunteer satisfaction — fill remaining capacity volunteer-centrically
    const satisfactionVols = sortedVolunteers
      .filter(v => v.roleCategory !== 'internalServices' &&
                   volunteerAssignments[v.fullName].length < v.maxShifts)
      .sort((a, b) => {
        const aRemaining = a.maxShifts - volunteerAssignments[a.fullName].length;
        const bRemaining = b.maxShifts - volunteerAssignments[b.fullName].length;
        return aRemaining - bRemaining;
      });

    for (const vol of satisfactionVols) {
      while (volunteerAssignments[vol.fullName].length < vol.maxShifts) {
        const validShifts = vol.availability.filter(shiftId =>
          !lockedShiftIds.has(shiftId) &&
          !schedule[shiftId].includes(vol.fullName) &&
          (vol.roleCategory !== 'filer' || shiftRoleCounts[shiftId].filer < FILER_HARD_CAP)
        );
        if (validShifts.length === 0) break;
        validShifts.sort((a, b) => schedule[a].length - schedule[b].length);
        const bestShift = validShifts[0];
        schedule[bestShift].push(vol.fullName);
        volunteerAssignments[vol.fullName].push(bestShift);
        shiftRoleCounts[bestShift][vol.roleCategory]++;
        roleTotals[vol.roleCategory]++;
      }
    }

    // Calculate shortfalls (shifts where role minimums weren't met)
    const shortfalls = [];
    const roleLabels = { filer: 'Filer', mentor: 'Mentor', frontline: 'Frontline', internalServices: 'Internal Services' };
    for (const shiftId of SHIFT_IDS) {
      for (const [role, label] of Object.entries(roleLabels)) {
        if (shiftRoleCounts[shiftId][role] < ROLE_MIN_PER_SHIFT) {
          shortfalls.push({ shiftId, role: label, target: ROLE_MIN_PER_SHIFT, actual: shiftRoleCounts[shiftId][role] });
        }
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
      
      const ss = getScheduleSpreadsheet(spreadsheetId);

      // Delete existing sheet if it exists, then create fresh
      let sheet = ss.getSheetByName(outputSheetName);
      if (sheet) ss.deleteSheet(sheet);
      sheet = ss.insertSheet(outputSheetName);
      SpreadsheetApp.flush();

      if (!sheet) {
        throw new Error(`Failed to create sheet: ${outputSheetName}`);
      }

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
      
      // Write all data in one batch operation
      try {
        const dataRange = sheet.getRange(1, 1, allData.length, headers.length);
        dataRange.setValues(allData);
      } catch (error) {
        Logger.log('Error writing batch data: ' + error.message);
        Logger.log('Data shape: ' + allData.length + ' rows, checking first row length: ' + (allData[0] ? allData[0].length : 'null'));
        throw new Error('Failed to write schedule data: ' + error.message);
      }
      
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
      
      return true;
    } catch (error) {
      Logger.log('ERROR in outputScheduleToSheet: ' + error.message);
      throw new Error('outputScheduleToSheet failed: ' + error.message);
    }
  }, 'outputScheduleToSheet');
}

/**
 * Reads the existing schedule from the output sheet before regeneration
 * Returns a map of volunteer name -> array of shift IDs
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} outputSheetName - Name of the schedule sheet
 * @returns {Object|null} Map of {volunteerName: [shiftIds...]} or null if no sheet exists
 */
function readExistingSchedule(spreadsheetId, outputSheetName) {
  try {
    const ss = getScheduleSpreadsheet(spreadsheetId);
    const sheet = ss.getSheetByName(outputSheetName);
    if (!sheet) return null;

    // Schedule grid is rows 2-4 (Morning/Afternoon/Evening), columns B-E (Days 1-4)
    // Row 1 is header: ['Time / Day', Day1, Day2, Day3, Day4]
    const data = sheet.getRange(2, 2, 3, 4).getValues(); // 3 rows, 4 columns starting at B2

    const volunteerAssignments = {};
    const slotKeys = ['A', 'B', 'C']; // Morning, Afternoon, Evening

    for (let timeIdx = 0; timeIdx < 3; timeIdx++) {
      for (let dayIdx = 0; dayIdx < 4; dayIdx++) {
        const cellValue = data[timeIdx][dayIdx];
        if (!cellValue || cellValue === '(unfilled)') continue;

        const shiftId = `D${dayIdx + 1}${slotKeys[timeIdx]}`;
        const volunteers = cellValue.toString().split(',').map(v => v.trim()).filter(v => v);

        for (const volunteer of volunteers) {
          if (!volunteerAssignments[volunteer]) {
            volunteerAssignments[volunteer] = [];
          }
          volunteerAssignments[volunteer].push(shiftId);
        }
      }
    }

    Logger.log('Read existing schedule with ' + Object.keys(volunteerAssignments).length + ' volunteers');
    return volunteerAssignments;
  } catch (e) {
    Logger.log('Error reading existing schedule: ' + e.message);
    return null;
  }
}


/**
 * Gets the timestamp of the last successful schedule generation from script properties.
 * @returns {Date|null} Last generation timestamp, or null if never generated.
 */
function getLastGenerationTimestamp() {
  const val = PropertiesService.getScriptProperties().getProperty('SCHEDULE_LAST_GENERATED');
  return val ? new Date(val) : null;
}

/**
 * Saves the current time as the last schedule generation timestamp.
 */
function setLastGenerationTimestamp() {
  PropertiesService.getScriptProperties().setProperty(
    'SCHEDULE_LAST_GENERATED', new Date().toISOString()
  );
}

/**
 * Returns shift IDs for clinic days that fall before today's date.
 * @param {Array<string>} dayLabels - Array of 4 day label strings (e.g. 'Saturday March 21 2026')
 * @returns {Array<string>} Array of shift IDs for past days (e.g. ['D1A','D1B','D1C'])
 */
function getPastShiftIds(dayLabels) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pastShiftIds = [];
  (dayLabels || SCHEDULE_CONFIG.DEFAULT_DAY_LABELS).forEach((label, dayIdx) => {
    const d = new Date(label);
    if (!isNaN(d) && d < today) {
      ['A', 'B', 'C'].forEach(slot => pastShiftIds.push(`D${dayIdx + 1}${slot}`));
    }
  });
  Logger.log('Past shift IDs (before today): ' + pastShiftIds.join(', '));
  return pastShiftIds;
}

/**
 * Identifies which volunteers have changed their availability since the last generation.
 * De-duplicates by name (keeps most recent submission per volunteer).
 * @param {Array<Object>} volunteers - Volunteer objects from readAvailabilityResponses (include timestamp field)
 * @param {Object} oldAssignments - Existing schedule {name: [shiftIds]} from readExistingSchedule
 * @param {Date|null} lastGenTimestamp - Timestamp of last generation, or null if none
 * @returns {Set<string>} Set of volunteer full names that should be re-scheduled
 */
function getChangedVolunteerNames(volunteers, oldAssignments, lastGenTimestamp) {
  // De-duplicate: keep most recent submission per name
  const latestByName = {};
  for (const v of volunteers) {
    if (!latestByName[v.fullName] || v.timestamp > latestByName[v.fullName].timestamp) {
      latestByName[v.fullName] = v;
    }
  }

  const changedNames = new Set();

  if (!lastGenTimestamp) {
    // No prior generation: treat everyone as changed (full generation behavior)
    for (const name of Object.keys(latestByName)) changedNames.add(name);
    Logger.log('No prior generation timestamp — treating all ' + changedNames.size + ' volunteers as changed');
    return changedNames;
  }

  // New volunteers not in old schedule → changed
  for (const name of Object.keys(latestByName)) {
    if (!oldAssignments[name]) changedNames.add(name);
  }

  // Volunteers with a form submission newer than last generation → changed
  // Use lastModified (updated on resubmission) over timestamp (preserved on resubmission)
  for (const [name, v] of Object.entries(latestByName)) {
    const lastActivity = v.lastModified || v.timestamp;
    if (lastActivity && lastActivity > lastGenTimestamp) changedNames.add(name);
  }

  Logger.log('Changed volunteers (' + changedNames.size + '): ' + [...changedNames].join(', '));
  return changedNames;
}

// Mentor team functions moved to MentorTeams.gs
// Schedule notification functions moved to ScheduleNotifications.gs


/**
 * Main function to generate and output schedule in one step
 * @param {string} spreadsheetId - Spreadsheet ID containing availability responses
 * @param {string} availabilitySheetName - Name of sheet with availability responses
 * @param {string} outputSheetName - Name of sheet to create/update (in same spreadsheet)
 * @param {Object} options - Configuration options
 * @returns {Object} Schedule result object
 */
function createSchedule(spreadsheetId, availabilitySheetName, outputSheetName, options = {}) {
  const { partialUpdate, lockPastShifts, notifyChanges, dayLabels } = options;
  const usePartial = partialUpdate || lockPastShifts;

  // Read existing schedule if needed (for partial update or change notifications)
  let oldAssignments = null;
  if (usePartial || notifyChanges) {
    oldAssignments = readExistingSchedule(spreadsheetId, outputSheetName) || {};
  }

  // Build locked assignments, locked shift IDs, and excluded volunteers
  let lockedAssignments = {};
  let lockedShiftIds = [];
  let excludeVolunteers = new Set();

  if (lockPastShifts) {
    const pastShifts = getPastShiftIds(dayLabels);
    lockedShiftIds = pastShifts;
    for (const [name, shifts] of Object.entries(oldAssignments)) {
      const pastAssigned = shifts.filter(s => pastShifts.includes(s));
      if (pastAssigned.length > 0) {
        lockedAssignments[name] = (lockedAssignments[name] || []).concat(pastAssigned);
      }
    }
  }

  if (partialUpdate) {
    const lastGenTimestamp = getLastGenerationTimestamp();
    const formVolunteers = readAvailabilityResponses(spreadsheetId, availabilitySheetName);
    const changedNames = getChangedVolunteerNames(formVolunteers, oldAssignments, lastGenTimestamp);
    for (const [name, shifts] of Object.entries(oldAssignments)) {
      if (!changedNames.has(name)) {
        excludeVolunteers.add(name);
        const futureAssigned = shifts.filter(s => !lockedShiftIds.includes(s));
        if (futureAssigned.length > 0) {
          lockedAssignments[name] = (lockedAssignments[name] || []).concat(futureAssigned);
        }
      }
    }
  }

  // Pass locked state into generateSchedule
  const scheduleOptions = { ...options, lockedAssignments, lockedShiftIds, excludeVolunteers };
  const scheduleResult = generateSchedule(spreadsheetId, availabilitySheetName, scheduleOptions);

  // Output to sheet
  const outputResult = outputScheduleToSheet(spreadsheetId, scheduleResult, outputSheetName, options.dayLabels);

  if (!outputResult) {
    throw new Error('Failed to create schedule sheet');
  }

  // Verify sheet was created
  const ss = getScheduleSpreadsheet(spreadsheetId);
  const createdSheet = ss.getSheetByName(outputSheetName);
  if (!createdSheet) {
    throw new Error(`Schedule sheet "${outputSheetName}" was not created successfully`);
  }

  // Send change notifications if enabled
  let notificationsSent = 0;
  let notificationRecipients = [];
  if (options.notifyChanges && oldAssignments) {
    const notifResult = sendScheduleChangeNotifications(
      oldAssignments,
      scheduleResult.volunteerAssignments,
      scheduleResult.volunteers,
      options.dayLabels
    );
    notificationsSent = notifResult.count;
    notificationRecipients = notifResult.recipients;
  }

  // Record generation timestamp (used by "Preserve unchanged volunteers" partial update)
  setLastGenerationTimestamp();

  // Add notifications count and recipients to result
  scheduleResult.notificationsSent = notificationsSent;
  scheduleResult.notificationRecipients = notificationRecipients;

  // Add previous mentor designations for dashboard pre-selection
  scheduleResult.previousSeniorMentors = getSeniorMentorDesignations();
  scheduleResult.previousFirstTimeMentors = getFirstTimeMentorDesignations();

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
    const spreadsheetId = CONFIG.SPREADSHEET_ID;
    const availabilitySheetName = CONFIG.SHEETS.SCHEDULE_AVAILABILITY;

    // Don't nest safeExecute - just call directly to avoid deep call stack
    const result = createSchedule(spreadsheetId, availabilitySheetName, outputSheetName, options);
    return result;
  } catch (error) {
    Logger.log('ERROR in generateScheduleFromDashboard: ' + error.message);
    throw new Error('Schedule generation failed: ' + (error.message || error.toString()));
  }
}

/**
 * Diagnostic function to check availability sheet data.
 * Called from schedule_dashboard.html to verify data before generation.
 * @returns {Object} Debug information
 */
function debugAvailabilitySheet() {
  return safeExecute(() => {
    const sheetName = CONFIG.SHEETS.SCHEDULE_AVAILABILITY;
    const ss = getScheduleSpreadsheet(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return {
        error: `Sheet "${sheetName}" not found in spreadsheet`,
        availableSheets: ss.getSheets().map(s => s.getName()),
        note: 'The Schedule Availability sheet does not exist. Please create it using the availability form.'
      };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return {
        error: 'No data found in Schedule Availability sheet',
        note: 'Sheet exists but has no data. Please submit the availability form to populate data.'
      };
    }

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const numSampleRows = Math.min(3, lastRow - 1);
    const sampleData = sheet.getRange(2, 1, numSampleRows, lastCol).getValues()
      .map(row => row.map(cell => cell instanceof Date ? cell.toISOString() : cell));

    return {
      sheetName: sheetName,
      totalRows: lastRow - 1,
      headers: headers,
      sampleData: sampleData,
      note: 'Data format looks good! Your availability data is properly formatted.',
      recommendation: 'Click "Generate Schedule" to create the shift schedule. The data is ready!'
    };
  }, 'debugAvailabilitySheet');
}

/**
 * Analyzes the current schedule's volunteer distribution without regenerating.
 * Reads the existing Shift Schedule sheet and availability data to compute:
 * - Per-shift headcounts by role
 * - Per-volunteer shift counts
 * - Consecutive shift pair analysis (Morning+Afternoon, Afternoon+Evening per day)
 * @returns {Object} Distribution analysis result
 */
function getVolunteerDistribution() {
  return safeExecute(() => {
    const spreadsheetId = CONFIG.SPREADSHEET_ID;
    const outputSheetName = CONFIG.SHEETS.SCHEDULE_OUTPUT;

    // Read the existing schedule from the sheet
    const existingAssignments = readExistingSchedule(spreadsheetId, outputSheetName);
    if (!existingAssignments) {
      return { error: 'No existing schedule found. Please generate a schedule first.' };
    }

    // Read availability to get role info for each volunteer
    const volunteers = readAvailabilityResponses(spreadsheetId, CONFIG.SHEETS.SCHEDULE_AVAILABILITY);
    const roleMap = {};
    for (const v of volunteers) {
      roleMap[v.fullName] = classifyRole(v.role);
    }

    // Build schedule (shiftId -> [names]) from volunteerAssignments (name -> [shiftIds])
    const schedule = {};
    for (const shiftId of SHIFT_IDS) {
      schedule[shiftId] = [];
    }
    for (const [name, shifts] of Object.entries(existingAssignments)) {
      for (const shiftId of shifts) {
        if (schedule[shiftId]) {
          schedule[shiftId].push(name);
        }
      }
    }

    // Compute per-shift role counts
    const shiftRoleCounts = {};
    for (const shiftId of SHIFT_IDS) {
      const counts = { filer: 0, mentor: 0, frontline: 0, internalServices: 0 };
      for (const name of schedule[shiftId]) {
        const role = roleMap[name] || 'filer';
        counts[role]++;
      }
      shiftRoleCounts[shiftId] = counts;
    }

    // Compute per-volunteer shift counts
    const volunteerShiftCounts = {};
    for (const [name, shifts] of Object.entries(existingAssignments)) {
      volunteerShiftCounts[name] = {
        count: shifts.length,
        role: roleMap[name] || 'unknown',
        shifts: shifts.sort((a, b) => SHIFT_IDS.indexOf(a) - SHIFT_IDS.indexOf(b))
      };
    }

    // Compute consecutive shift analysis
    // For each day, count unique volunteers across combined time windows (union)
    const consecutiveAnalysis = [];
    for (let dayIdx = 0; dayIdx < SCHEDULE_CONFIG.DAYS_COUNT; dayIdx++) {
      const dayNum = dayIdx + 1;
      const shiftA = 'D' + dayNum + 'A';
      const shiftB = 'D' + dayNum + 'B';
      const shiftC = 'D' + dayNum + 'C';

      const setA = new Set(schedule[shiftA] || []);
      const setB = new Set(schedule[shiftB] || []);
      const setC = new Set(schedule[shiftC] || []);

      // Union counts: unique volunteers across combined time windows
      const morningAfternoonCount = new Set([...setA, ...setB]).size;
      const afternoonEveningCount = new Set([...setB, ...setC]).size;
      const allThreeCount = new Set([...setA, ...setB, ...setC]).size;

      consecutiveAnalysis.push({
        day: dayNum,
        morningAfternoonCount,
        afternoonEveningCount,
        allThreeCount
      });
    }

    // Compute shift count distribution (how many volunteers have 1 shift, 2 shifts, etc.)
    const shiftCountDistribution = {};
    for (const [name, info] of Object.entries(volunteerShiftCounts)) {
      const count = info.count;
      if (!shiftCountDistribution[count]) {
        shiftCountDistribution[count] = 0;
      }
      shiftCountDistribution[count]++;
    }

    // Role distribution summary
    const roleCounts = { filer: 0, mentor: 0, frontline: 0, internalServices: 0, unknown: 0 };
    for (const info of Object.values(volunteerShiftCounts)) {
      roleCounts[info.role] = (roleCounts[info.role] || 0) + 1;
    }

    return {
      totalVolunteers: Object.keys(existingAssignments).length,
      totalAssignments: Object.values(existingAssignments).reduce((sum, s) => sum + s.length, 0),
      shiftRoleCounts: shiftRoleCounts,
      consecutiveAnalysis: consecutiveAnalysis,
      roleCounts: roleCounts
    };
  }, 'getVolunteerDistribution');
}
