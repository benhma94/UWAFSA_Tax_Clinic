/**
 * Volunteer Schedule Viewer Functions
 * Provides functions for volunteers to view their schedules
 */

/**
 * Gets volunteer tags from the Volunteer Tags sheet (3-column format)
 * Column A: Name, Column B: Role Override (e.g., "Senior Mentor" or blank), Column C: Display Flair
 * Falls back to hardcoded VOLUNTEER_TAGS for display flairs if sheet doesn't exist
 * @returns {Object} { roleOverrides: {name: role}, displayTags: {name: tag} }
 */
function getVolunteerTagsFromSheet() {
  const emptyResult = { roleOverrides: {}, displayTags: {} };

  try {
    const ss = getSpreadsheet();
    const sheetName = CONFIG.SHEETS.VOLUNTEER_TAGS || 'Volunteer Tags';
    const sheet = ss.getSheetByName(sheetName);

    const roleOverrides = {};
    const displayTags = {};

    if (sheet && sheet.getLastRow() >= 2) {
      const lastRow = sheet.getLastRow();
      const numCols = Math.min(sheet.getLastColumn(), 3);
      const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

      for (const row of data) {
        const name = row[0]?.toString().trim();
        if (!name) continue;

        const roleOverride = (row[1] || '').toString().trim();
        const flair = (row[2] || '').toString().trim();

        if (roleOverride) {
          roleOverrides[name] = roleOverride;
          roleOverrides[name.toLowerCase()] = roleOverride;
        }

        if (flair) {
          displayTags[name] = flair;
          displayTags[name.toLowerCase()] = flair;
        }
      }
    }

    // Merge hardcoded VOLUNTEER_TAGS into display tags (sheet takes priority)
    const hardcodedTags = VOLUNTEER_TAGS || {};
    Object.keys(hardcodedTags).forEach(key => {
      if (!displayTags[key] && !displayTags[key.toLowerCase()]) {
        displayTags[key] = hardcodedTags[key];
        displayTags[key.toLowerCase()] = hardcodedTags[key];
      }
    });

    return { roleOverrides, displayTags };
  } catch (e) {
    Logger.log('Error reading volunteer tags: ' + e.message);
    // Fall back to hardcoded tags for display only
    const displayTags = {};
    const hardcodedTags = VOLUNTEER_TAGS || {};
    Object.keys(hardcodedTags).forEach(key => {
      displayTags[key] = hardcodedTags[key];
      displayTags[key.toLowerCase()] = hardcodedTags[key];
    });
    return { roleOverrides: {}, displayTags };
  }
}

/**
 * Gets a list of all volunteer names from the schedule
 * @returns {Array<string>} Array of volunteer names
 */
function getAllVolunteerNames() {
  return safeExecute(() => {
    const sheet = getScheduleSheet();
    const data = sheet.getDataRange().getValues();

    // Extract unique volunteer names from the schedule grid (rows 2-4, columns B-E)
    // Each cell contains comma-separated volunteer names
    const nameSet = {};

    for (let rowIdx = 1; rowIdx <= 3 && rowIdx < data.length; rowIdx++) {
      for (let colIdx = 1; colIdx <= 4 && colIdx < data[rowIdx].length; colIdx++) {
        const cellValue = data[rowIdx][colIdx]?.toString().trim() || '';
        if (cellValue && cellValue !== '(unfilled)') {
          cellValue.split(',').forEach(name => {
            const trimmed = name.trim();
            if (trimmed) {
              nameSet[trimmed] = true;
            }
          });
        }
      }
    }

    return Object.keys(nameSet).sort();
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
 * Gets the schedule sheet - tries to find the schedule sheet by looking for "Time / Day" header
 * @returns {Sheet} The schedule sheet, or null if not found
 */
function getScheduleSheet() {
  const ss = getSpreadsheet();

  // Helper: verify a sheet is a schedule sheet by checking for "Time / Day" header
  function isScheduleSheet(sheet) {
    try {
      const data = sheet.getDataRange().getValues();
      if (data.length > 0 && data[0][0] && data[0][0].toString().trim() === 'Time / Day') {
        return true;
      }
    } catch (e) {
      // Ignore read errors
    }
    return false;
  }

  // First, try common schedule sheet names
  const commonNames = ['Shift Schedule', 'Tax Clinic Shifts 2026', 'Tax Clinic Shifts 2025', 'Schedule Output', CONFIG.SHEETS.SCHEDULE_OUTPUT];
  for (const name of commonNames) {
    try {
      const sheet = ss.getSheetByName(name);
      if (sheet && isScheduleSheet(sheet)) {
        return sheet;
      }
    } catch (e) {
      continue;
    }
  }

  // If not found by name, scan all sheets
  const sheets = ss.getSheets();
  for (const sheet of sheets) {
    if (isScheduleSheet(sheet)) {
      return sheet;
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
    const data = sheet.getDataRange().getValues();

    // Get day labels from header row (columns 1-4)
    const headerRow = data[0];
    const dayLabels = [];
    for (let i = 1; i <= 4 && i < headerRow.length; i++) {
      const dayLabel = headerRow[i]?.toString().trim() || `Day ${i}`;
      dayLabels.push(simplifyDateFormat(dayLabel));
    }

    // Search through the schedule grid (rows 2-4, columns B-E) for the volunteer name
    const slotKeys = ['A', 'B', 'C'];
    const shifts = [];
    let volunteerName = '';

    for (let rowIdx = 1; rowIdx <= 3 && rowIdx < data.length; rowIdx++) {
      for (let colIdx = 1; colIdx <= 4 && colIdx < data[rowIdx].length; colIdx++) {
        const cellValue = data[rowIdx][colIdx]?.toString().trim() || '';
        if (!cellValue || cellValue === '(unfilled)') continue;

        // Check each name in the comma-separated cell
        const names = cellValue.split(',').map(n => n.trim()).filter(n => n);
        for (const name of names) {
          if (name.toLowerCase().includes(searchTerm.toLowerCase())) {
            volunteerName = name;
            // Map position to shift ID: row 1=A, 2=B, 3=C; col 1=D1, 2=D2, 3=D3, 4=D4
            const shiftId = `D${colIdx}${slotKeys[rowIdx - 1]}`;
            const label = SCHEDULE_CONFIG.getShiftLabel(shiftId, dayLabels);
            if (label) {
              shifts.push({ shiftId, day: label.day, time: label.time });
            }
          }
        }
      }
    }

    // Sort shifts by day and time
    shifts.sort((a, b) => {
      const aDayNum = parseInt(a.shiftId.charAt(1));
      const bDayNum = parseInt(b.shiftId.charAt(1));
      if (aDayNum !== bDayNum) return aDayNum - bDayNum;
      return a.shiftId.charCodeAt(2) - b.shiftId.charCodeAt(2);
    });

    // Get volunteer role to determine if mentor
    let volunteerRole = '';
    try {
      const ss = getSpreadsheet();
      const availSheet = ss.getSheetByName(CONFIG.SHEETS.SCHEDULE_AVAILABILITY);
      if (availSheet && availSheet.getLastRow() > 1) {
        const availData = availSheet.getRange(2, 1, availSheet.getLastRow() - 1, 5).getValues();
        for (const row of availData) {
          const firstName = row[1]?.toString().trim() || '';
          const lastName = row[2]?.toString().trim() || '';
          const role = row[4]?.toString().trim() || '';
          if (`${firstName} ${lastName}`.toLowerCase() === volunteerName.toLowerCase()) {
            volunteerRole = role;
            break;
          }
        }
      }
    } catch (e) {
      Logger.log('Warning: Could not read volunteer role: ' + e.message);
    }

    // Get volunteer's display tag
    let volunteerTag = null;
    if (volunteerName) {
      const tagData = getVolunteerTagsFromSheet();
      volunteerTag = tagData.displayTags[volunteerName] || tagData.displayTags[volunteerName.toLowerCase()] || null;
    }

    return { volunteerName, shifts, volunteerRole, volunteerTag };
  }, 'getVolunteerScheduleByName');
}

/**
 * Returns the median of a numeric array, rounded to the nearest integer. Returns null for empty arrays.
 */
function calcMedian_(arr) {
  if (!arr || !arr.length) return null;
  const sorted = arr.slice().sort(function(a, b) { return a - b; });
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? Math.round(sorted[mid])
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Gets personal tax return stats for a volunteer
 * @param {string} volunteerName - Exact volunteer name (case-insensitive match)
 * @param {string} filterDateStr - Optional clinic day label string (e.g. "Saturday March 21 2026")
 *   to filter stats to a specific day. If omitted, only all-time count is returned.
 * @returns {Object} Personal stats + clinic benchmark averages
 */
function getVolunteerPersonalStats(volunteerName, filterDateStr) {
  const emptyResult = {
    returnsAllTime: 0, returnsFiltered: null, totalVolunteerMinutes: 0,
    reviewedAllTime: 0, reviewedFiltered: null,
    medianMinutesPerReturn: null, overallMedianMinutesPerReturn: null,
    overallMedianReturnsPerFiler: null, overallMedianReviewsPerReviewer: null
  };

  try {
    const sheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return emptyResult;

    const cols = CONFIG.COLUMNS.TAX_RETURN_TRACKER;
    const numCols = cols.INCOMPLETE + 1; // = 10; covers REVIEWER(4) and SECONDARY_REVIEWER(5)
    const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

    const nameLower = volunteerName.toLowerCase();
    let filterDate = null;
    if (filterDateStr) {
      filterDate = new Date(filterDateStr);
    }

    let returnsAllTime = 0;
    let returnsFiltered = filterDate ? 0 : null;
    let reviewedAllTime = 0;
    let reviewedFiltered = filterDate ? 0 : null;

    // For overall benchmarks (all volunteers) — per-volunteer counts for median calculation
    const filerCounts = {};    // volunteerName → total returns
    const reviewerCounts = {}; // reviewerName → total reviews

    // Collect filing events for per-return timing calculation
    const volunteerFilings = []; // { clientId, filedAt } for this volunteer
    const allFilings = [];       // { clientId, filedAt, volunteer } for all volunteers

    for (const row of data) {
      const efile = (row[cols.EFILE] || '').toString().toLowerCase() === 'yes';
      const paper = (row[cols.PAPER] || '').toString().toLowerCase() === 'yes';
      const incomplete = (row[cols.INCOMPLETE] || '').toString().toLowerCase() === 'yes';
      if ((!efile && !paper) || incomplete) continue;

      const married = (row[cols.MARRIED] || '').toString().toLowerCase() === 'yes';
      const increment = married ? 2 : 1;
      const rowVolunteer = (row[cols.VOLUNTEER] || '').toString().trim().toLowerCase();
      const reviewer = (row[cols.REVIEWER] || '').toString().trim().toLowerCase();
      const secondaryReviewer = (row[cols.SECONDARY_REVIEWER] || '').toString().trim().toLowerCase();
      const clientId = (row[cols.CLIENT_ID] || '').toString().trim();
      const filedTimestamp = row[cols.TIMESTAMP];

      // Personal: returns filed
      if (rowVolunteer === nameLower) {
        returnsAllTime += increment;
        if (filterDate && filedTimestamp && new Date(filedTimestamp).toDateString() === filterDate.toDateString()) {
          returnsFiltered += increment;
        }
        if (clientId && filedTimestamp) {
          volunteerFilings.push({ clientId, filedAt: new Date(filedTimestamp) });
        }
      }

      // Personal: returns reviewed
      if (reviewer === nameLower || secondaryReviewer === nameLower) {
        reviewedAllTime += increment;
        if (filterDate && filedTimestamp && new Date(filedTimestamp).toDateString() === filterDate.toDateString()) {
          reviewedFiltered += increment;
        }
      }

      // Overall benchmarks — accumulate per-volunteer counts
      if (rowVolunteer) {
        filerCounts[rowVolunteer] = (filerCounts[rowVolunteer] || 0) + increment;
      }
      if (reviewer) {
        reviewerCounts[reviewer] = (reviewerCounts[reviewer] || 0) + increment;
      }
      if (secondaryReviewer) {
        reviewerCounts[secondaryReviewer] = (reviewerCounts[secondaryReviewer] || 0) + increment;
      }
      if (clientId && filedTimestamp && rowVolunteer) {
        allFilings.push({ clientId, filedAt: new Date(filedTimestamp), volunteer: rowVolunteer });
      }
    }

    // Volunteer time (existing)
    let totalVolunteerMinutes = 0;
    try {
      const signoutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
      const signoutLastRow = signoutSheet.getLastRow();
      if (signoutLastRow > 1) {
        const signoutCols = CONFIG.COLUMNS.SIGNOUT;
        const signoutData = signoutSheet.getRange(2, 1, signoutLastRow - 1, signoutCols.DURATION + 1).getDisplayValues();
        for (const row of signoutData) {
          const rowName = (row[signoutCols.VOLUNTEER_INFO] || '').trim().toLowerCase();
          if (rowName !== nameLower) continue;
          const parts = (row[signoutCols.DURATION] || '').trim().split(':');
          if (parts.length >= 2) {
            const h = parseInt(parts[0], 10) || 0;
            const m = parseInt(parts[1], 10) || 0;
            const s = parts.length >= 3 ? (parseInt(parts[2], 10) || 0) : 0;
            totalVolunteerMinutes += h * 60 + m + s / 60;
          }
        }
      }
    } catch (e) {
      Logger.log('Error reading volunteer time: ' + e.message);
    }

    // Per-return timing: assignment timestamp → filing timestamp
    let medianMinutesPerReturn = null;
    let overallMedianMinutesPerReturn = null;
    try {
      const assignSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
      const assignLastRow = assignSheet.getLastRow();
      if (assignLastRow > 1) {
        const aCols = CONFIG.COLUMNS.CLIENT_ASSIGNMENT;
        const assignData = assignSheet.getRange(2, 1, assignLastRow - 1, aCols.VOLUNTEER + 1).getValues();

        // Build map: clientId → [ {timestamp, volunteer} ]
        const assignmentMap = {};
        for (const aRow of assignData) {
          const ts = aRow[aCols.TIMESTAMP];
          const cid = (aRow[aCols.CLIENT_ID] || '').toString().trim();
          const vol = (aRow[aCols.VOLUNTEER] || '').toString().trim().toLowerCase();
          if (!cid || !ts || !vol) continue;
          if (!assignmentMap[cid]) assignmentMap[cid] = [];
          assignmentMap[cid].push({ timestamp: new Date(ts), volunteer: vol });
        }

        // Find best matching assignment for a filing event:
        // most-recent assignment by same volunteer that is at or before the filing timestamp
        function findBestAssignment(clientId, volunteer, filedAt) {
          const entries = assignmentMap[clientId];
          if (!entries) return null;
          let best = null;
          for (const entry of entries) {
            if (entry.volunteer !== volunteer) continue;
            if (entry.timestamp > filedAt) continue;
            if (!best || entry.timestamp > best.timestamp) best = entry;
          }
          return best;
        }

        // This volunteer's avg time per return
        const volunteerMinutes = [];
        for (const { clientId, filedAt } of volunteerFilings) {
          const assignment = findBestAssignment(clientId, nameLower, filedAt);
          if (assignment) {
            const mins = (filedAt - assignment.timestamp) / 60000;
            if (mins > 0 && mins < 480) volunteerMinutes.push(mins); // sanity: < 8 hrs
          }
        }
        if (volunteerMinutes.length > 0) {
          medianMinutesPerReturn = calcMedian_(volunteerMinutes);
        }

        // Overall median time per return (clinic benchmark)
        const allMinutes = [];
        for (const { clientId, filedAt, volunteer } of allFilings) {
          const assignment = findBestAssignment(clientId, volunteer, filedAt);
          if (assignment) {
            const mins = (filedAt - assignment.timestamp) / 60000;
            if (mins > 0 && mins < 480) allMinutes.push(mins);
          }
        }
        if (allMinutes.length > 0) {
          overallMedianMinutesPerReturn = calcMedian_(allMinutes);
        }
      }
    } catch (e) {
      Logger.log('Error computing per-return timing: ' + e.message);
    }

    return {
      returnsAllTime,
      returnsFiltered,
      totalVolunteerMinutes,
      reviewedAllTime,
      reviewedFiltered,
      medianMinutesPerReturn,
      overallMedianMinutesPerReturn,
      overallMedianReturnsPerFiler: calcMedian_(Object.values(filerCounts)),
      overallMedianReviewsPerReviewer: calcMedian_(Object.values(reviewerCounts))
    };
  } catch (e) {
    Logger.log('Error in getVolunteerPersonalStats: ' + e.message);
    return emptyResult;
  }
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
  const day = parts[2].replace(/,+$/, ''); // "21" (strip trailing comma if present)

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
    
    // Build volunteer role map from the Schedule Availability sheet
    const volunteerRoles = {};
    try {
      const ss = getSpreadsheet();
      const availSheet = ss.getSheetByName(CONFIG.SHEETS.SCHEDULE_AVAILABILITY);
      if (availSheet && availSheet.getLastRow() > 1) {
        const availData = availSheet.getRange(2, 1, availSheet.getLastRow() - 1, 5).getValues();
        for (const row of availData) {
          const firstName = row[1]?.toString().trim() || '';
          const lastName = row[2]?.toString().trim() || '';
          const role = row[4]?.toString().trim() || '';
          if (firstName && lastName && role) {
            volunteerRoles[`${firstName} ${lastName}`] = role;
          }
        }
      }
    } catch (e) {
      Logger.log('Warning: Could not read volunteer roles from availability sheet: ' + e.message);
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
      const simplifiedDay = simplifyDateFormat(day);
      for (let i = 1; i < headerRow.length; i++) {
        const headerValue = headerRow[i]?.toString().trim() || '';
        const simplifiedHeader = simplifyDateFormat(headerValue);
        if (simplifiedHeader === simplifiedDay) {
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

    // Map row indices to time slots for that day using SCHEDULE_CONFIG
    // Row 1 (index 0) is header, Row 2-4 (indices 1-3) are time slots A/B/C
    const timeSlotMap = {};
    ['A', 'B', 'C'].forEach((slotKey, index) => {
      const rowIndex = index + 1; // Row 2 is index 1, etc.
      const timeDisplay = SCHEDULE_CONFIG.TIME_SLOTS[slotKey].display;
      timeSlotMap[rowIndex] = `${actualDayLabel} ${timeDisplay}`;
    });
    
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

        // Sort by role (Mentor first, then Filer, then Frontline), then alphabetically within role
        const roleOrder = { 'Mentor': 1, 'Senior Mentor': 1, 'Filer': 2, 'Frontline': 3 };
        volunteers.sort((a, b) => {
          const roleA = volunteerRoles[a] || '';
          const roleB = volunteerRoles[b] || '';
          const orderA = roleOrder[roleA] || 99;
          const orderB = roleOrder[roleB] || 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.localeCompare(b);
        });

        schedule[timeSlot] = volunteers;
      } else {
        schedule[timeSlot] = [];
      }
    }
    
    // Build case-insensitive volunteer tags lookup
    const tagData = getVolunteerTagsFromSheet();
    const baseTags = tagData.displayTags || {};
    const volunteerTagsLookup = {};

    // Create a lowercase lookup map for case-insensitive matching
    Object.keys(baseTags).forEach(key => {
      volunteerTagsLookup[key] = baseTags[key];
      volunteerTagsLookup[key.toLowerCase()] = baseTags[key];
    });

    // Also add tags for all volunteers found in the schedule (match by lowercase)
    const normalizedTags = {};
    Object.keys(schedule).forEach(timeSlot => {
      schedule[timeSlot].forEach(volunteer => {
        const lowerName = volunteer.toLowerCase();
        // Check both exact match and lowercase match
        if (baseTags[volunteer]) {
          normalizedTags[volunteer] = baseTags[volunteer];
        } else if (volunteerTagsLookup[lowerName]) {
          normalizedTags[volunteer] = volunteerTagsLookup[lowerName];
        }
      });
    });

    // Return schedule with the actual day label for display
    return {
      schedule: schedule,
      volunteerRoles: volunteerRoles,
      volunteerTags: normalizedTags,  // Include custom display tags (case-insensitive matched)
      dayLabel: actualDayLabel  // Include the actual day label for display
    };
  }, 'getVolunteerScheduleByDay');
}
