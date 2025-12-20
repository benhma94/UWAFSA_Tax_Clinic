/**
 * Volunteer Schedule Viewer Functions
 * Provides functions for volunteers to view their schedules
 */

/**
 * Gets a list of all volunteer names from the schedule
 * @returns {Array<string>} Array of volunteer names
 */
function getAllVolunteerNames() {
  return safeExecute(() => {
    const sheet = getScheduleSheet();
    const data = sheet.getDataRange().getValues();
    
    // Find volunteer assignments section
    let assignmentsStartRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().toUpperCase().includes('VOLUNTEER ASSIGNMENTS')) {
        assignmentsStartRow = i + 2; // Skip header row
        break;
      }
    }
    
    if (assignmentsStartRow === -1) {
      return [];
    }
    
    const volunteerNames = [];
    
    // Read all volunteer names
    for (let i = assignmentsStartRow; i < data.length; i++) {
      const name = data[i][0]?.toString().trim() || '';
      
      if (name && name !== '(none)' && !name.toLowerCase().includes('summary')) {
        volunteerNames.push(name);
      }
    }
    
    return volunteerNames.sort();
  }, 'getAllVolunteerNames');
}

/**
 * Gets the day labels from the schedule sheet header
 * @returns {Array<string>} Array of day labels (e.g., ['Sat, Mar 21', 'Sun, Mar 22', ...])
 */
function getDayLabels() {
  return safeExecute(() => {
    const sheet = getScheduleSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length === 0) {
      return ['Day 1', 'Day 2', 'Day 3', 'Day 4'];
    }

    const headerRow = data[0];
    const dayLabels = [];

    // Header format: ['Time / Day', Day1, Day2, Day3, Day4]
    // Skip column 0 (Time / Day) and read columns 1-4
    for (let i = 1; i <= 4 && i < headerRow.length; i++) {
      const dayLabel = headerRow[i]?.toString().trim() || `Day ${i}`;
      // Simplify the date format
      dayLabels.push(simplifyDateFormat(dayLabel));
    }

    // Fill in defaults if not enough columns
    while (dayLabels.length < 4) {
      dayLabels.push(`Day ${dayLabels.length + 1}`);
    }

    return dayLabels;
  }, 'getDayLabels');
}

/**
 * Gets the schedule sheet - tries to find the schedule sheet by looking for "VOLUNTEER ASSIGNMENTS" header
 * @returns {Sheet} The schedule sheet, or null if not found
 */
function getScheduleSheet() {
  const ss = getSpreadsheet();
  
  // First, try common schedule sheet names
  const commonNames = ['Tax Clinic Shifts 2026', 'Tax Clinic Shifts 2025', 'Schedule Output', CONFIG.SHEETS.SCHEDULE_OUTPUT];
  for (const name of commonNames) {
    try {
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        // Verify it's a schedule sheet by checking for "VOLUNTEER ASSIGNMENTS"
        const data = sheet.getDataRange().getValues();
        for (let i = 0; i < Math.min(50, data.length); i++) {
          if (data[i][0] && data[i][0].toString().toUpperCase().includes('VOLUNTEER ASSIGNMENTS')) {
            return sheet;
          }
        }
      }
    } catch (e) {
      // Continue to next name
      continue;
    }
  }
  
  // If not found by name, look through all sheets for one with "VOLUNTEER ASSIGNMENTS"
  const sheets = ss.getSheets();
  for (const sheet of sheets) {
    try {
      const data = sheet.getDataRange().getValues();
      // Check first 50 rows for the volunteer assignments header
      for (let i = 0; i < Math.min(50, data.length); i++) {
        if (data[i][0] && data[i][0].toString().toUpperCase().includes('VOLUNTEER ASSIGNMENTS')) {
          return sheet;
        }
      }
    } catch (e) {
      // Skip sheets that can't be read
      continue;
    }
  }
  
  // If still not found, throw an error
  throw new Error('No schedule sheet found. Please generate a schedule first using the Assignment tool.');
}

/**
 * Gets schedule data for a volunteer by searching for their name
 * @param {string} searchTerm - Name to search for (case-insensitive)
 * @returns {Object} Object containing volunteer name and assigned shifts
 */
function getVolunteerScheduleByName(searchTerm) {
  return safeExecute(() => {
    const sheet = getScheduleSheet();

    // Read the schedule data
    const data = sheet.getDataRange().getValues();

    // Get day labels from header row (columns 1-4)
    const headerRow = data[0];
    const dayLabels = [];
    for (let i = 1; i <= 4 && i < headerRow.length; i++) {
      const dayLabel = headerRow[i]?.toString().trim() || `Day ${i}`;
      // Parse the date to simplify format (e.g., "Saturday March 21" -> "Sat, Mar 21")
      dayLabels.push(simplifyDateFormat(dayLabel));
    }

    // Find volunteer assignments section
    let assignmentsStartRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().includes('VOLUNTEER ASSIGNMENTS')) {
        assignmentsStartRow = i + 2; // Skip header row
        break;
      }
    }

    if (assignmentsStartRow === -1) {
      return { shifts: [] };
    }

    // Map shift IDs to human-readable format with actual dates
    const shiftIdToLabel = {
      'D1A': { day: dayLabels[0] || 'Day 1', time: '9:30-1:15' },
      'D1B': { day: dayLabels[0] || 'Day 1', time: '1:00-4:45' },
      'D1C': { day: dayLabels[0] || 'Day 1', time: '4:30-8:30' },
      'D2A': { day: dayLabels[1] || 'Day 2', time: '9:30-1:15' },
      'D2B': { day: dayLabels[1] || 'Day 2', time: '1:00-4:45' },
      'D2C': { day: dayLabels[1] || 'Day 2', time: '4:30-8:30' },
      'D3A': { day: dayLabels[2] || 'Day 3', time: '9:30-1:15' },
      'D3B': { day: dayLabels[2] || 'Day 3', time: '1:00-4:45' },
      'D3C': { day: dayLabels[2] || 'Day 3', time: '4:30-8:30' },
      'D4A': { day: dayLabels[3] || 'Day 4', time: '9:30-1:15' },
      'D4B': { day: dayLabels[3] || 'Day 4', time: '1:00-4:45' },
      'D4C': { day: dayLabels[3] || 'Day 4', time: '4:30-8:30' }
    };

    // Read volunteer assignments
    const shifts = [];
    let volunteerName = '';

    for (let i = assignmentsStartRow; i < data.length; i++) {
      const name = data[i][0]?.toString().trim() || '';
      const assignedShiftsString = data[i][4]?.toString().trim() || ''; // Column E (index 4)

      if (!name || name === '(none)') continue;

      // Check if name matches search term
      if (name.toLowerCase().includes(searchTerm.toLowerCase())) {
        volunteerName = name;

        // Parse assigned shifts
        if (assignedShiftsString && assignedShiftsString !== '(none)') {
          const shiftIds = assignedShiftsString.split(',').map(s => s.trim());

          shiftIds.forEach(shiftId => {
            if (shiftIdToLabel[shiftId]) {
              shifts.push({
                shiftId: shiftId,
                day: shiftIdToLabel[shiftId].day,
                time: shiftIdToLabel[shiftId].time
              });
            }
          });
        }
      }
    }

    // Sort shifts by day and time
    shifts.sort((a, b) => {
      // Extract day number from shift ID for sorting
      const getDayNum = (shiftId) => parseInt(shiftId.charAt(1));
      const getTimeNum = (shiftId) => shiftId.charCodeAt(2) - 65; // A=0, B=1, C=2

      const aDayNum = getDayNum(a.shiftId);
      const bDayNum = getDayNum(b.shiftId);

      if (aDayNum !== bDayNum) {
        return aDayNum - bDayNum;
      }
      return getTimeNum(a.shiftId) - getTimeNum(b.shiftId);
    });

    return {
      volunteerName: volunteerName,
      shifts: shifts
    };
  }, 'getVolunteerScheduleByName');
}

/**
 * Simplifies date format from "Saturday March 21" to "Sat, Mar 21"
 * @param {string} dateString - Full date string
 * @returns {string} Simplified date string
 */
function simplifyDateFormat(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return dateString;
  }

  // Try to parse the date string (e.g., "Saturday March 21" or "Saturday March 21 2026")
  const parts = dateString.trim().split(/\s+/);

  if (parts.length < 3) {
    return dateString; // Can't parse, return original
  }

  const dayOfWeek = parts[0]; // "Saturday"
  const month = parts[1];      // "March"
  const day = parts[2];        // "21"

  // Abbreviate day of week (first 3 characters)
  const dayAbbr = dayOfWeek.substring(0, 3);

  // Abbreviate month (first 3 characters)
  const monthAbbr = month.substring(0, 3);

  return `${dayAbbr}, ${monthAbbr} ${day}`;
}

/**
 * Gets all volunteers scheduled for a specific day
 * @param {string} day - Day to view (e.g., "Day 1", "Day 2")
 * @param {string} filterRole - Optional role filter (Mentor, Frontline, Filer)
 * @returns {Object} Object containing schedule for that day grouped by time slot, and volunteer roles
 */
function getVolunteerScheduleByDay(day, filterRole = '') {
  return safeExecute(() => {
    const sheet = getScheduleSheet();
    
    // Read the schedule grid (first few rows)
    const data = sheet.getDataRange().getValues();
    
    // Build volunteer role map from volunteer assignments section
    const volunteerRoles = {};
    let assignmentsStartRow = -1;
    
    // Find volunteer assignments section
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().toUpperCase().includes('VOLUNTEER ASSIGNMENTS')) {
        assignmentsStartRow = i + 2; // Skip header row
        break;
      }
    }
    
    // Read volunteer roles if assignments section exists
    if (assignmentsStartRow > 0) {
      for (let i = assignmentsStartRow; i < data.length; i++) {
        const name = data[i][0]?.toString().trim() || '';
        const role = data[i][1]?.toString().trim() || ''; // Column B (index 1) is Role
        
        if (name && role && name !== '(none)' && role !== 'N/A') {
          volunteerRoles[name] = role;
        }
      }
    }
    
    // Find the day column in the header row
    // The schedule structure is always: ['Time / Day', Day1, Day2, Day3, Day4]
    // Can match by exact header text (e.g., "Saturday March 21") or by day number
    let dayColumn = -1;
    const headerRow = data[0];

    // First, try to match by exact header text (for full date labels like "Saturday March 21 2026")
    for (let i = 1; i < headerRow.length; i++) {
      const headerValue = headerRow[i]?.toString().trim() || '';
      if (headerValue === day) {
        dayColumn = i;
        break;
      }
    }

    // If not found, try matching simplified format (e.g., "Sat, Mar 21" matches "Saturday March 21 2026")
    if (dayColumn === -1) {
      for (let i = 1; i < headerRow.length; i++) {
        const headerValue = headerRow[i]?.toString().trim() || '';
        const simplifiedHeader = simplifyDateFormat(headerValue);
        if (simplifiedHeader === day) {
          dayColumn = i;
          break;
        }
      }
    }

    // If not found, try to extract day number from "Day 1", "Day 2", "Day 3", "Day 4"
    if (dayColumn === -1) {
      const dayMatch = day.match(/Day\s*(\d+)/i);
      if (dayMatch) {
        const dayNumber = parseInt(dayMatch[1]);
        if (dayNumber >= 1 && dayNumber <= 4) {
          // Day 1 = column 1, Day 2 = column 2, Day 3 = column 3, Day 4 = column 4
          dayColumn = dayNumber;
        }
      }
    }
    
    // Validate column exists
    if (dayColumn === -1 || dayColumn >= headerRow.length) {
      Logger.log(`Could not find column for day: ${day}. Header row: ${JSON.stringify(headerRow)}`);
      return { schedule: {}, volunteerRoles: volunteerRoles };
    }
    
    // Get the actual day label from the header for display and simplify it
    const actualDayLabel = simplifyDateFormat(headerRow[dayColumn]?.toString().trim() || day);
    Logger.log(`Found day column ${dayColumn} for day: ${day}. Header value: ${actualDayLabel}`);

    // Map row indices to time slots for that day
    // Row 1 (index 0) is header, Row 2 (index 1) is 9:30-1:15, Row 3 (index 2) is 1:00-4:45, Row 4 (index 3) is 4:30-8:30
    const timeSlotMap = {
      1: `${actualDayLabel} 9:30-1:15`,   // Row 2 (index 1) - 9:30-1:15
      2: `${actualDayLabel} 1:00-4:45`,   // Row 3 (index 2) - 1:00-4:45
      3: `${actualDayLabel} 4:30-8:30`    // Row 4 (index 3) - 4:30-8:30
    };
    
    const schedule = {};
    
    // Read time slots (rows 2-4, indices 1-3)
    // Row 0 is header, so we start at index 1
    for (let rowIndex = 1; rowIndex <= 3 && rowIndex < data.length; rowIndex++) {
      const timeSlot = timeSlotMap[rowIndex];
      const volunteersString = data[rowIndex][dayColumn]?.toString().trim() || '';
      
      if (volunteersString && volunteersString !== '(unfilled)') {
        // Split by comma and trim, filter out empty strings
        let volunteers = volunteersString.split(',').map(v => v.trim()).filter(v => v && v.length > 0);

        // Filter by role if specified
        if (filterRole && filterRole.trim()) {
          volunteers = volunteers.filter(volunteer => {
            const role = volunteerRoles[volunteer];
            return role === filterRole.trim();
          });
        }

        // Sort alphabetically
        volunteers.sort((a, b) => a.localeCompare(b));

        schedule[timeSlot] = volunteers;
      } else {
        schedule[timeSlot] = [];
      }
    }
    
    // Return schedule with the actual day label for display
    return { 
      schedule: schedule, 
      volunteerRoles: volunteerRoles,
      dayLabel: actualDayLabel  // Include the actual day label for display
    };
  }, 'getVolunteerScheduleByDay');
}
