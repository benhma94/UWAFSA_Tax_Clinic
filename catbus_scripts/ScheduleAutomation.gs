/**
 * Schedule Automation Functions
 * Automates schedule generation from volunteer availability form responses
 * 
 * Assumes Google Form responses are in a sheet with columns:
 * - Timestamp
 * - First Name
 * - Last Name
 * - Email Address
 * - Shifts preferred (number)
 * - Would you prefer consecutive shifts (Yes/No)
 * - 12 availability checkboxes (Day 1 Morning, Day 1 Afternoon, Day 1 Evening, etc.)
 */

/**
 * Shift structure:
 * - 4 days, each with 3 shifts (9:30-1:15, 1:00-4:45, 4:30-8:30)
 * - Total: 12 shifts
 * - Shift IDs: D1A (9:30-1:15), D1B (1:00-4:45), D1C (4:30-8:30), etc.
 */

// Shift IDs - stable identifiers for each shift (never change these)
// Display formatting is handled by SCHEDULE_CONFIG in Config.gs
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
 */
function fillRoleMinimum(shiftId, roleCategory, minimum, volunteers, schedule,
                         volunteerAssignments, shiftRoleCounts, maxPerShift) {
  const currentCount = shiftRoleCounts[shiftId][roleCategory];
  const needed = minimum - currentCount;

  if (needed <= 0) return;

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

  // Read all rows (assuming form responses format)
  // Column structure: Timestamp, First Name, Last Name, Email, Role, Number of Shifts, Consecutive Preference, Availability (comma-separated)
  // Note: Only reading columns 1-8 (through Availability) as Notes and Last Modified columns are not used
  Logger.log('Reading ' + (lastRow - 1) + ' data rows, 8 columns');
  
  // OPTIMIZED: Limit data read to prevent memory issues with very large sheets
  const maxRows = Math.min(lastRow - 1, 1000); // Cap at 1000 rows to prevent timeout
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
 * Generates an optimized schedule from volunteer availability
 * @param {string} spreadsheetId - Spreadsheet ID containing availability responses
 * @param {string} availabilitySheetName - Name of sheet with availability responses
 * @param {Object} options - Configuration options
 * @param {Object} options.shiftMinimums - Per-shift role targets: { 'D1A': {filer: N, mentor: N, frontline: N}, ... }
 * @returns {Object} Schedule object with assignments
 */
function generateSchedule(spreadsheetId, availabilitySheetName, options = {}) {
  const {
    prioritizeConsecutive = true,
    shiftMinimums = {} // Per-shift role targets, defaults to {filer: 1, mentor: 1, frontline: 1} for each shift
  } = options;

  // Helper to get shift minimums with defaults
  const getShiftMins = (shiftId) => {
    const mins = shiftMinimums[shiftId] || {};
    return {
      filer: mins.filer !== undefined ? mins.filer : 1,
      mentor: mins.mentor !== undefined ? mins.mentor : 1,
      frontline: mins.frontline !== undefined ? mins.frontline : 1
    };
  };

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
      shiftRoleCounts[shiftId] = { filer: 0, mentor: 0, frontline: 0 };
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

    // PHASE 1: Fill per-shift role targets
    Logger.log('Filling per-shift role targets...');

    for (const shiftId of SHIFT_IDS) {
      const shiftMins = getShiftMins(shiftId);
      Logger.log(`${shiftId} targets: filer=${shiftMins.filer}, mentor=${shiftMins.mentor}, frontline=${shiftMins.frontline}`);

      // Fill filers first (highest priority)
      if (shiftMins.filer > 0) {
        fillRoleMinimum(shiftId, 'filer', shiftMins.filer, sortedVolunteers, schedule,
                        volunteerAssignments, shiftRoleCounts, 999);
      }

      // Then mentors
      if (shiftMins.mentor > 0) {
        fillRoleMinimum(shiftId, 'mentor', shiftMins.mentor, sortedVolunteers, schedule,
                        volunteerAssignments, shiftRoleCounts, 999);
      }

      // Then frontline
      if (shiftMins.frontline > 0) {
        fillRoleMinimum(shiftId, 'frontline', shiftMins.frontline, sortedVolunteers, schedule,
                        volunteerAssignments, shiftRoleCounts, 999);
      }
    }

    // Log role target results
    for (const shiftId of SHIFT_IDS) {
      const counts = shiftRoleCounts[shiftId];
      Logger.log(`${shiftId} after role targets: filers=${counts.filer}, mentors=${counts.mentor}, frontline=${counts.frontline}`);
    }

    // PHASE 2: Assign volunteers who want consecutive shifts
    if (prioritizeConsecutive) {
      const consecutiveVolunteers = sortedVolunteers.filter(v => v.preferConsecutive);

      for (const volunteer of consecutiveVolunteers) {
        if (volunteerAssignments[volunteer.fullName].length >= volunteer.maxShifts) continue;

        // Try to find consecutive shifts in their availability
        for (let i = 0; i < volunteer.availability.length - 1; i++) {
          const shift1Id = volunteer.availability[i];
          const shift2Id = volunteer.availability[i + 1];

          if (areShiftsConsecutive(shift1Id, shift2Id)) {
            // Check if we can assign both shifts
            const canAssignShift1 = !schedule[shift1Id].includes(volunteer.fullName);
            const canAssignShift2 = !schedule[shift2Id].includes(volunteer.fullName);
            const hasCapacity = (volunteerAssignments[volunteer.fullName].length + 2) <= volunteer.maxShifts;

            if (canAssignShift1 && canAssignShift2 && hasCapacity) {
              // Assign both consecutive shifts
              schedule[shift1Id].push(volunteer.fullName);
              schedule[shift2Id].push(volunteer.fullName);
              volunteerAssignments[volunteer.fullName].push(shift1Id, shift2Id);
              // Track role counts
              shiftRoleCounts[shift1Id][volunteer.roleCategory]++;
              shiftRoleCounts[shift2Id][volunteer.roleCategory]++;
              i++; // Skip next shift as it's already assigned
            }
          }
        }
      }
    }
    
    // PHASE 3: Fill remaining shifts, prioritizing under-staffed shifts
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

    // Sort shifts by current assignment count (fewer = higher priority)
    // Calculate target as sum of role minimums for each shift
    const shiftPriorities = SHIFT_IDS.map(shiftId => {
      const shiftMins = getShiftMins(shiftId);
      const targetCount = shiftMins.filer + shiftMins.mentor + shiftMins.frontline;
      return {
        shiftId,
        currentCount: schedule[shiftId].length,
        targetCount
      };
    }).sort((a, b) => {
      // Prioritize shifts that are below their total target
      if (a.currentCount < a.targetCount && b.currentCount >= b.targetCount) return -1;
      if (a.currentCount >= a.targetCount && b.currentCount < b.targetCount) return 1;
      return a.currentCount - b.currentCount;
    });

    // Try to fill each shift - OPTIMIZED to avoid repeated filtering
    for (const { shiftId } of shiftPriorities) {
      // Get volunteers available for this shift (from pre-built index)
      const potentialVolunteers = shiftToVolunteers[shiftId];

      // Filter only those who can still take shifts
      const availableVolunteers = potentialVolunteers.filter(v => {
        const underMax = volunteerAssignments[v.fullName].length < v.maxShifts;
        const notAssigned = !schedule[shiftId].includes(v.fullName);
        return underMax && notAssigned;
      });

      // Sort by remaining capacity (descending) - do this once
      availableVolunteers.sort((a, b) => {
        const aRemaining = a.maxShifts - volunteerAssignments[a.fullName].length;
        const bRemaining = b.maxShifts - volunteerAssignments[b.fullName].length;
        return bRemaining - aRemaining;
      });

      // Assign all available volunteers to fill remaining capacity
      let assigned = 0;
      for (const volunteer of availableVolunteers) {
        schedule[shiftId].push(volunteer.fullName);
        volunteerAssignments[volunteer.fullName].push(shiftId);
        // Track role counts
        shiftRoleCounts[shiftId][volunteer.roleCategory]++;
        assigned++;
      }

      Logger.log(`Shift ${shiftId}: assigned ${assigned} volunteers (total: ${schedule[shiftId].length})`);
    }
    
    // Calculate shortfalls (shifts where role targets weren't met)
    const shortfalls = [];
    for (const shiftId of SHIFT_IDS) {
      const shiftMins = getShiftMins(shiftId);
      const counts = shiftRoleCounts[shiftId];

      if (counts.filer < shiftMins.filer) {
        shortfalls.push({ shiftId, role: 'Filer', target: shiftMins.filer, actual: counts.filer });
      }
      if (counts.mentor < shiftMins.mentor) {
        shortfalls.push({ shiftId, role: 'Mentor', target: shiftMins.mentor, actual: counts.mentor });
      }
      if (counts.frontline < shiftMins.frontline) {
        shortfalls.push({ shiftId, role: 'Frontline', target: shiftMins.frontline, actual: counts.frontline });
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
        shortfalls: shortfalls, // Shifts where role targets weren't met
        roleDistribution: {
          filers: volunteers.filter(v => v.roleCategory === 'filer').length,
          mentors: volunteers.filter(v => v.roleCategory === 'mentor').length,
          frontline: volunteers.filter(v => v.roleCategory === 'frontline').length
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
      
      // Add volunteer assignment section header
      const volunteerHeaderRow = ['VOLUNTEER ASSIGNMENTS'];
      // Pad to match column count
      while (volunteerHeaderRow.length < headers.length) {
        volunteerHeaderRow.push('');
      }
      allData.push(volunteerHeaderRow);
      formatRanges.push({ row: allData.length, type: 'volunteerHeader' });
      
      // Add summary headers
      const summaryHeaders = ['Volunteer Name', 'Role', 'Email', 'Max Shifts', 'Assigned Shifts', 'Assigned Count'];
      // Pad to match column count
      while (summaryHeaders.length < headers.length) {
        summaryHeaders.push('');
      }
      allData.push(summaryHeaders);
      formatRanges.push({ row: allData.length, type: 'summaryHeader' });
      
      // Sort volunteers by name and build all volunteer rows
      if (!scheduleResult.volunteers || !Array.isArray(scheduleResult.volunteers)) {
        Logger.log('Warning: scheduleResult.volunteers is not an array, using empty array');
        scheduleResult.volunteers = [];
      }
      
      const sortedVolunteers = [...scheduleResult.volunteers].sort((a, b) => {
        const nameA = (a && a.name) ? a.name : '';
        const nameB = (b && b.name) ? b.name : '';
        return nameA.localeCompare(nameB);
      });
      
      const highlightedRows = []; // Track rows that need background colors
      
      for (const vol of sortedVolunteers) {
        if (!vol) continue; // Skip null/undefined entries
        
        const assignedShifts = Array.isArray(vol.assignedShifts) ? vol.assignedShifts : [];
        const row = [
          vol.name || '',
          vol.role || 'N/A',
          vol.email || '',
          vol.maxShifts || 0,
          assignedShifts.join(', ') || '(none)',
          vol.assignedCount || 0
        ];
        
        // Pad row to match column count
        while (row.length < headers.length) {
          row.push('');
        }
        
        allData.push(row);
        
        // Track rows that need highlighting
        if (vol.assignedCount > vol.maxShifts) {
          highlightedRows.push({ row: allData.length, color: '#ffcccc' }); // Red for over-assigned
        } else if (vol.assignedCount === 0 && vol.maxShifts > 0) {
          highlightedRows.push({ row: allData.length, color: '#fff4cc' }); // Yellow for unassigned
        }
      }
      
      // Add spacing before stats - pad empty rows
      allData.push(new Array(headers.length).fill(''));
      allData.push(new Array(headers.length).fill(''));
      
      // Add summary statistics
      const statsStartRow = allData.length + 1; // Track where stats start (1-indexed)
      const stats = [
        ['Summary Statistics', ''],
        ['Total Shifts', scheduleResult.summary.totalShifts],
        ['Shifts with Assignments', scheduleResult.summary.shiftsFilled],
        ['Shifts at Minimum', scheduleResult.summary.shiftsAtMinimum],
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
        // Continue - formatting is not critical
      }
      
      // Format volunteer section header
      try {
        const volHeaderEntry = formatRanges.find(f => f.type === 'volunteerHeader');
        if (volHeaderEntry && volHeaderEntry.row > 0 && volHeaderEntry.row <= allData.length) {
          const volHeaderRange = sheet.getRange(volHeaderEntry.row, 1, 1, 1);
          volHeaderRange.setFontWeight('bold');
        }
      } catch (e) {
        Logger.log('Warning: Could not format volunteer header: ' + e.message);
      }
      
      // Format summary header row
      try {
        const sumHeaderEntry = formatRanges.find(f => f.type === 'summaryHeader');
        if (sumHeaderEntry && sumHeaderEntry.row > 0 && sumHeaderEntry.row <= allData.length) {
          const sumHeaderRange = sheet.getRange(sumHeaderEntry.row, 1, 1, summaryHeaders.length);
          sumHeaderRange.setFontWeight('bold');
        }
      } catch (e) {
        Logger.log('Warning: Could not format summary header: ' + e.message);
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
      
      // Apply background colors to highlighted rows (batch by color)
      try {
        const redRows = highlightedRows.filter(h => h.color === '#ffcccc').map(h => h.row).filter(r => r > 0 && r <= allData.length);
        const yellowRows = highlightedRows.filter(h => h.color === '#fff4cc').map(h => h.row).filter(r => r > 0 && r <= allData.length);
        
        if (redRows.length > 0) {
          for (const rowNum of redRows) {
            try {
              const range = sheet.getRange(rowNum, 1, 1, summaryHeaders.length);
              range.setBackground('#ffcccc');
            } catch (e) {
              Logger.log(`Warning: Could not highlight row ${rowNum}: ` + e.message);
            }
          }
        }
        
        if (yellowRows.length > 0) {
          for (const rowNum of yellowRows) {
            try {
              const range = sheet.getRange(rowNum, 1, 1, summaryHeaders.length);
              range.setBackground('#fff4cc');
            } catch (e) {
              Logger.log(`Warning: Could not highlight row ${rowNum}: ` + e.message);
            }
          }
        }
      } catch (e) {
        Logger.log('Warning: Could not apply row highlighting: ' + e.message);
        // Continue - highlighting is not critical
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
