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

const SHIFT_NAMES = [
  'Day 1 9:30-1:15', 'Day 1 1:00-4:45', 'Day 1 4:30-8:30',
  'Day 2 9:30-1:15', 'Day 2 1:00-4:45', 'Day 2 4:30-8:30',
  'Day 3 9:30-1:15', 'Day 3 1:00-4:45', 'Day 3 4:30-8:30',
  'Day 4 9:30-1:15', 'Day 4 1:00-4:45', 'Day 4 4:30-8:30'
];

const SHIFT_IDS = ['D1A', 'D1B', 'D1C', 'D2A', 'D2B', 'D2C', 'D3A', 'D3B', 'D3C', 'D4A', 'D4B', 'D4C'];

// Map availability string formats to shift IDs
const AVAILABILITY_TO_SHIFT_MAP = {
  'Day 1 9:30-1:15': 'D1A', 'Day 1 1:00-4:45': 'D1B', 'Day 1 4:30-8:30': 'D1C',
  'Day 2 9:30-1:15': 'D2A', 'Day 2 1:00-4:45': 'D2B', 'Day 2 4:30-8:30': 'D2C',
  'Day 3 9:30-1:15': 'D3A', 'Day 3 1:00-4:45': 'D3B', 'Day 3 4:30-8:30': 'D3C',
  'Day 4 9:30-1:15': 'D4A', 'Day 4 1:00-4:45': 'D4B', 'Day 4 4:30-8:30': 'D4C'
};

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
  return safeExecute(() => {
    if (!spreadsheetId || !sheetName) {
      throw new Error('Spreadsheet ID and sheet name are required');
    }
    
    const sheet = getScheduleSheet(spreadsheetId, sheetName);
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return [];
    }
    
    // Read all rows (assuming form responses format)
    // Column structure: Timestamp, First Name, Last Name, Email, Role, Number of Shifts, Consecutive Preference, Availability (comma-separated), Notes
    const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
    
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
      
      // Parse availability from comma-separated string
      // Format: "Day 1 9:30-1:15, Day 1 1:00-4:45, Day 2 9:30-1:15"
      const availability = [];
      if (availabilityString) {
        const availabilityItems = availabilityString.split(',').map(item => item.trim());
        availabilityItems.forEach(item => {
          // Map availability string to shift ID
          if (AVAILABILITY_TO_SHIFT_MAP[item]) {
            availability.push(AVAILABILITY_TO_SHIFT_MAP[item]);
          } else {
            // Try to match variations (case-insensitive, spacing variations)
            const normalizedItem = item.replace(/\s+/g, ' ');
            for (const [key, shiftId] of Object.entries(AVAILABILITY_TO_SHIFT_MAP)) {
              if (normalizedItem.toLowerCase() === key.toLowerCase()) {
                availability.push(shiftId);
                break;
              }
            }
          }
        });
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
    
    Logger.log(`Read ${volunteers.length} volunteers with availability`);
    return volunteers;
  }, 'readAvailabilityResponses');
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
 * @returns {Object} Schedule object with assignments
 */
function generateSchedule(spreadsheetId, availabilitySheetName, options = {}) {
  return safeExecute(() => {
    const {
      minVolunteersPerShift = 1,
      maxVolunteersPerShift = 999,
      prioritizeConsecutive = true
    } = options;
    
    // Read availability
    const volunteers = readAvailabilityResponses(spreadsheetId, availabilitySheetName);
    
    if (volunteers.length === 0) {
      throw new Error('No volunteer availability data found');
    }
    
    // Initialize schedule structure
    const schedule = {};
    SHIFT_IDS.forEach(shiftId => {
      schedule[shiftId] = [];
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
    
    // Phase 1: Assign volunteers who want consecutive shifts first
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
            const canAssignShift1 = schedule[shift1Id].length < maxVolunteersPerShift;
            const canAssignShift2 = schedule[shift2Id].length < maxVolunteersPerShift;
            const hasCapacity = (volunteerAssignments[volunteer.fullName].length + 2) <= volunteer.maxShifts;
            
            if (canAssignShift1 && canAssignShift2 && hasCapacity) {
              // Assign both consecutive shifts
              schedule[shift1Id].push(volunteer.fullName);
              schedule[shift2Id].push(volunteer.fullName);
              volunteerAssignments[volunteer.fullName].push(shift1Id, shift2Id);
              i++; // Skip next shift as it's already assigned
            }
          }
        }
      }
    }
    
    // Phase 2: Fill remaining shifts, prioritizing under-staffed shifts
    // Sort shifts by current assignment count (fewer = higher priority)
    const shiftPriorities = SHIFT_IDS.map(shiftId => ({
      shiftId,
      currentCount: schedule[shiftId].length,
      targetCount: minVolunteersPerShift
    })).sort((a, b) => {
      // Prioritize shifts that are below minimum
      if (a.currentCount < a.targetCount && b.currentCount >= b.targetCount) return -1;
      if (a.currentCount >= a.targetCount && b.currentCount < b.targetCount) return 1;
      return a.currentCount - b.currentCount;
    });
    
    // Try to fill each shift
    for (const { shiftId, currentCount, targetCount } of shiftPriorities) {
      // Find volunteers available for this shift who haven't hit their max
      const availableVolunteers = sortedVolunteers.filter(v => {
        const hasAvailability = v.availability.includes(shiftId);
        const underMax = volunteerAssignments[v.fullName].length < v.maxShifts;
        const notAssigned = !schedule[shiftId].includes(v.fullName);
        const shiftNotFull = schedule[shiftId].length < maxVolunteersPerShift;
        
        return hasAvailability && underMax && notAssigned && shiftNotFull;
      });
      
      // Assign volunteers to reach target
      while (schedule[shiftId].length < targetCount && availableVolunteers.length > 0) {
        // Pick volunteer with most remaining capacity
        availableVolunteers.sort((a, b) => {
          const aRemaining = a.maxShifts - volunteerAssignments[a.fullName].length;
          const bRemaining = b.maxShifts - volunteerAssignments[b.fullName].length;
          return bRemaining - aRemaining;
        });
        
        const volunteer = availableVolunteers.shift();
        if (volunteer) {
          schedule[shiftId].push(volunteer.fullName);
          volunteerAssignments[volunteer.fullName].push(shiftId);
        }
      }
      
      // Fill up to max if more volunteers are available
      while (schedule[shiftId].length < maxVolunteersPerShift && availableVolunteers.length > 0) {
        const volunteer = availableVolunteers.shift();
        if (volunteer) {
          schedule[shiftId].push(volunteer.fullName);
          volunteerAssignments[volunteer.fullName].push(shiftId);
          
          // Remove from available list for this shift if they've hit max
          if (volunteerAssignments[volunteer.fullName].length >= volunteer.maxShifts) {
            const index = availableVolunteers.findIndex(v => v.fullName === volunteer.fullName);
            if (index > -1) availableVolunteers.splice(index, 1);
          }
        }
      }
    }
    
    // Build result summary
    const result = {
      schedule,
      volunteerAssignments,
      summary: {
        totalShifts: SHIFT_IDS.length,
        totalVolunteers: volunteers.length,
        shiftsFilled: SHIFT_IDS.filter(id => schedule[id].length > 0).length,
        shiftsAtMinimum: SHIFT_IDS.filter(id => schedule[id].length >= minVolunteersPerShift).length,
        totalAssignments: Object.values(volunteerAssignments).reduce((sum, shifts) => sum + shifts.length, 0)
      },
      volunteers: volunteers.map(v => ({
        name: v.fullName,
        role: v.role || 'N/A',
        email: v.email,
        maxShifts: v.maxShifts,
        assignedShifts: volunteerAssignments[v.fullName] || [],
        assignedCount: (volunteerAssignments[v.fullName] || []).length
      }))
    };
    
    Logger.log(`Schedule generated: ${result.summary.shiftsFilled}/${result.summary.totalShifts} shifts filled`);
    return result;
  }, 'generateSchedule');
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
    if (!spreadsheetId || !outputSheetName) {
      throw new Error('Spreadsheet ID and output sheet name are required');
    }
    
    if (!scheduleResult || !scheduleResult.schedule) {
      throw new Error('Invalid schedule result data');
    }
    
    Logger.log(`Creating schedule sheet: ${outputSheetName}`);
    const ss = getScheduleSpreadsheet(spreadsheetId);
    
    // Delete existing sheet if it exists
    let sheet = ss.getSheetByName(outputSheetName);
    if (sheet) {
      Logger.log(`Deleting existing sheet: ${outputSheetName}`);
      ss.deleteSheet(sheet);
      // Small delay to ensure deletion completes
      Utilities.sleep(100);
    }
    
    // Create new sheet
    Logger.log(`Creating new sheet: ${outputSheetName}`);
    sheet = ss.insertSheet(outputSheetName);
    
    if (!sheet) {
      throw new Error(`Failed to create sheet: ${outputSheetName}`);
    }
    
    Logger.log(`Sheet created successfully: ${outputSheetName}`);
    
    // Default day labels if not provided
    const days = dayLabels || ['Day 1', 'Day 2', 'Day 3', 'Day 4'];
    
    // Create header row
    const headers = ['Time / Day', ...days];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');
    
    // Create shift rows (9:30-1:15, 1:00-4:45, 4:30-8:30 for each day)
    const times = ['9:30-1:15', '1:00-4:45', '4:30-8:30'];
    const schedule = scheduleResult.schedule;
    
    let rowNum = 2;
    for (let timeIdx = 0; timeIdx < 3; timeIdx++) {
      const row = [times[timeIdx]];
      
      for (let dayIdx = 0; dayIdx < 4; dayIdx++) {
        const shiftId = SHIFT_IDS[dayIdx * 3 + timeIdx];
        const volunteers = schedule[shiftId] || [];
        row.push(volunteers.join(', ') || '(unfilled)');
      }
      
      sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
      rowNum++;
    }
    
    // Add spacing
    rowNum++;
    
    // Add volunteer assignment summary
    sheet.getRange(rowNum, 1, 1, 1).setValue('VOLUNTEER ASSIGNMENTS').setFontWeight('bold');
    rowNum++;
    
    const summaryHeaders = ['Volunteer Name', 'Role', 'Email', 'Max Shifts', 'Assigned Shifts', 'Assigned Count'];
    const summaryHeaderRange = sheet.getRange(rowNum, 1, 1, summaryHeaders.length);
    summaryHeaderRange.setValues([summaryHeaders]);
    summaryHeaderRange.setFontWeight('bold');
    rowNum++;
    
    // Sort volunteers by name
    const sortedVolunteers = [...scheduleResult.volunteers].sort((a, b) => 
      a.name.localeCompare(b.name)
    );
    
    for (const vol of sortedVolunteers) {
      const row = [
        vol.name,
        vol.role || 'N/A',
        vol.email,
        vol.maxShifts,
        vol.assignedShifts.join(', ') || '(none)',
        vol.assignedCount
      ];
      
      // Highlight if over-assigned or under-utilized
      const range = sheet.getRange(rowNum, 1, 1, row.length);
      range.setValues([row]);
      
      if (vol.assignedCount > vol.maxShifts) {
        range.setBackground('#ffcccc'); // Red for over-assigned
      } else if (vol.assignedCount === 0 && vol.maxShifts > 0) {
        range.setBackground('#fff4cc'); // Yellow for unassigned
      }
      
      rowNum++;
    }
    
    // Add summary statistics
    rowNum += 2;
    const stats = [
      ['Summary Statistics', ''],
      ['Total Shifts', scheduleResult.summary.totalShifts],
      ['Shifts with Assignments', scheduleResult.summary.shiftsFilled],
      ['Shifts at Minimum', scheduleResult.summary.shiftsAtMinimum],
      ['Total Volunteers', scheduleResult.summary.totalVolunteers],
      ['Total Assignments', scheduleResult.summary.totalAssignments]
    ];
    
    sheet.getRange(rowNum, 1, stats.length, 2).setValues(stats);
    sheet.getRange(rowNum, 1, 1, 2).setFontWeight('bold');
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
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
  return safeExecute(() => {
    Logger.log('Starting schedule generation...');
    
    // Generate schedule
    const scheduleResult = generateSchedule(spreadsheetId, availabilitySheetName, options);
    
    // Output to sheet (same spreadsheet)
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
    
    Logger.log('Schedule generation complete');
    return scheduleResult;
  }, 'createSchedule');
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
  return safeExecute(() => {
    // Use main CATBUS spreadsheet
    const spreadsheetId = CONFIG.SPREADSHEET_ID;
    const availabilitySheetName = CONFIG.SHEETS.SCHEDULE_AVAILABILITY;
    return createSchedule(spreadsheetId, availabilitySheetName, outputSheetName, options);
  }, 'generateScheduleFromDashboard');
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
