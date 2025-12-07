/**
 * Volunteer Schedule Viewer Functions
 * Provides functions for volunteers to view their schedules
 */

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
    
    // Map shift IDs to human-readable format
    const shiftIdToLabel = {
      'D1A': { day: 'Day 1', time: '9AM-1PM' },
      'D1B': { day: 'Day 1', time: '1PM-5PM' },
      'D1C': { day: 'Day 1', time: '5PM-9PM' },
      'D2A': { day: 'Day 2', time: '9AM-1PM' },
      'D2B': { day: 'Day 2', time: '1PM-5PM' },
      'D2C': { day: 'Day 2', time: '5PM-9PM' },
      'D3A': { day: 'Day 3', time: '9AM-1PM' },
      'D3B': { day: 'Day 3', time: '1PM-5PM' },
      'D3C': { day: 'Day 3', time: '5PM-9PM' },
      'D4A': { day: 'Day 4', time: '9AM-1PM' },
      'D4B': { day: 'Day 4', time: '1PM-5PM' },
      'D4C': { day: 'Day 4', time: '5PM-9PM' }
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
      const dayOrder = { 'Day 1': 1, 'Day 2': 2, 'Day 3': 3, 'Day 4': 4 };
      const timeOrder = { '9AM-1PM': 1, '1PM-5PM': 2, '5PM-9PM': 3 };
      
      if (dayOrder[a.day] !== dayOrder[b.day]) {
        return dayOrder[a.day] - dayOrder[b.day];
      }
      return timeOrder[a.time] - timeOrder[b.time];
    });
    
    return {
      volunteerName: volunteerName,
      shifts: shifts
    };
  }, 'getVolunteerScheduleByName');
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
    let dayColumn = -1;
    const headerRow = data[0];
    
    // Header format: ['Time / Day', 'Day 1', 'Day 2', 'Day 3', 'Day 4']
    for (let i = 1; i < headerRow.length; i++) {
      const headerValue = headerRow[i]?.toString().trim() || '';
      if (headerValue === day) {
        dayColumn = i;
        break;
      }
    }
    
    if (dayColumn === -1) {
      return { schedule: {}, volunteerRoles: volunteerRoles };
    }
    
    // Map row indices to time slots for that day
    // Row 1 (index 0) is header, Row 2 (index 1) is 9AM-1PM, Row 3 (index 2) is 1PM-5PM, Row 4 (index 3) is 5PM-9PM
    const timeSlotMap = {
      1: `${day} 9AM-1PM`,   // Row 2 (index 1) - 9AM-1PM
      2: `${day} 1PM-5PM`,   // Row 3 (index 2) - 1PM-5PM
      3: `${day} 5PM-9PM`    // Row 4 (index 3) - 5PM-9PM
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
        
        schedule[timeSlot] = volunteers;
      } else {
        schedule[timeSlot] = [];
      }
    }
    
    return { schedule: schedule, volunteerRoles: volunteerRoles };
  }, 'getVolunteerScheduleByDay');
}
