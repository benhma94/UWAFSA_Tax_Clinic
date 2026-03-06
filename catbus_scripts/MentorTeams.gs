/**
 * Mentor Team Hierarchy Functions
 * Manages mentor-to-senior mentor team assignments
 */

/**
 * Reads the list of designated senior mentors from the Mentor Teams sheet
 * @returns {Array<string>} Array of senior mentor names
 */
function getSeniorMentorDesignations() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.MENTOR_TEAMS);

    if (!sheet) {
      Logger.log('Mentor Teams sheet not found - no senior designations');
      return [];
    }

    // Senior designations are stored in row 1, starting at column F
    // Format: "Senior Mentors:" in F1, then names in G1, H1, etc.
    const lastCol = sheet.getLastColumn();
    if (lastCol < 6) return []; // No senior data

    const headerRow = sheet.getRange(1, 6, 1, Math.max(1, lastCol - 5)).getValues()[0];

    // Skip the "Senior Mentors:" label and get names
    const seniors = [];
    for (let i = 1; i < headerRow.length; i++) {
      const name = headerRow[i]?.toString().trim();
      if (name) seniors.push(name);
    }

    Logger.log('Senior mentor designations: ' + seniors.join(', '));
    return seniors;
  } catch (e) {
    Logger.log('Error reading senior designations: ' + e.message);
    return [];
  }
}

/**
 * Reads the list of designated first-time mentors from the Mentor Teams sheet
 * @returns {Array<string>} Array of first-time mentor names
 */
function getFirstTimeMentorDesignations() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.MENTOR_TEAMS);

    if (!sheet) {
      return [];
    }

    const lastCol = sheet.getLastColumn();
    if (lastCol < 6 || sheet.getLastRow() < 2) return [];

    // First-time designations are stored in row 2, starting at column F
    // Format: "First-Time Mentors:" in F2, then names in G2, H2, etc.
    const row2 = sheet.getRange(2, 6, 1, Math.max(1, lastCol - 5)).getValues()[0];

    const firstTimers = [];
    for (let i = 1; i < row2.length; i++) {
      const name = row2[i]?.toString().trim();
      if (name) firstTimers.push(name);
    }

    Logger.log('First-time mentor designations: ' + firstTimers.join(', '));
    return firstTimers;
  } catch (e) {
    Logger.log('Error reading first-time designations: ' + e.message);
    return [];
  }
}

/**
 * Finds the best matching mentor based on shift overlap
 * @param {Object} volunteer - Volunteer to match
 * @param {Array<Object>} candidates - Potential mentor/senior matches
 * @param {Object} dayShifts - Map of name -> shifts for current day
 * @param {Object} assignmentCounts - Map of name -> number already assigned (for load balancing)
 * @returns {Object|null} Best matching candidate or null
 */
function findBestOverlapMentor(volunteer, candidates, dayShifts, assignmentCounts = {}) {
  if (!candidates || candidates.length === 0) return null;

  const volunteerShifts = new Set(dayShifts[volunteer.fullName] || []);
  let bestCandidate = null;
  let maxOverlap = -1;
  let minAssignments = Infinity;

  for (const candidate of candidates) {
    const candidateShifts = dayShifts[candidate.fullName] || [];
    const overlap = candidateShifts.filter(s => volunteerShifts.has(s)).length;
    const assignments = assignmentCounts[candidate.fullName] || 0;

    // Prefer higher overlap, then fewer assignments (load balancing)
    if (overlap > maxOverlap || (overlap === maxOverlap && assignments < minAssignments)) {
      maxOverlap = overlap;
      minAssignments = assignments;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

/**
 * Computes day-based mentor-to-senior mentor teams
 * @param {Object} volunteerAssignments - Map of volunteer name -> assigned shift IDs
 * @param {Array<Object>} volunteers - Array of volunteer objects from schedule result
 * @param {Array<string>} seniorMentorNames - Names of designated senior mentors
 * @param {Array<string>} dayLabels - Labels for days 1-4
 * @param {Array<string>} firstTimeMentorNames - Names of first-time mentors (only these get assigned to seniors)
 * @returns {Object} Teams structure with day-based assignments
 */
function computeMentorTeams(volunteerAssignments, volunteers, seniorMentorNames, dayLabels, firstTimeMentorNames) {
  const teams = {};
  const days = dayLabels || ['Day 1', 'Day 2', 'Day 3', 'Day 4'];

  // Track how many mentors are assigned to each senior (for load balancing)
  const seniorAssignmentCounts = {};
  seniorMentorNames.forEach(name => { seniorAssignmentCounts[name] = 0; });

  for (let dayNum = 1; dayNum <= 4; dayNum++) {
    const dayPrefix = `D${dayNum}`;
    const dayLabel = days[dayNum - 1];
    teams[dayLabel] = { mentorToSenior: {} };

    // Get each volunteer's shifts for this day
    const dayShifts = {};
    for (const [name, shifts] of Object.entries(volunteerAssignments)) {
      dayShifts[name] = (shifts || []).filter(s => s.startsWith(dayPrefix)).sort();
    }

    // Get all mentors (including seniors)
    const allMentors = volunteers.filter(v => v.roleCategory === 'mentor');

    // Separate seniors from first-time mentors working this day
    // Only first-time mentors get assigned to seniors; experienced mentors work independently
    const firstTimeSet = new Set(firstTimeMentorNames || []);
    const seniors = allMentors.filter(m =>
      seniorMentorNames.includes(m.name) && dayShifts[m.name]?.length > 0
    );
    const regularMentors = allMentors.filter(m =>
      firstTimeSet.has(m.name) && dayShifts[m.name]?.length > 0
    );

    Logger.log(`${dayLabel}: ${regularMentors.length} first-time mentors, ${seniors.length} seniors working`);

    // PASS 1: Distribute mentors evenly among seniors (round-robin)
    const assignmentCounts = {};
    seniors.forEach(s => { assignmentCounts[s.name] = 0; });

    for (const mentor of regularMentors) {
      if (!dayShifts[mentor.name]?.length) {
        teams[dayLabel].mentorToSenior[mentor.name] = null;
        continue;
      }

      // Find senior with fewest assignments (round-robin effect)
      let assignedSenior = seniors.length > 0
        ? seniors.reduce((min, s) =>
            (assignmentCounts[s.name] || 0) < (assignmentCounts[min.name] || 0) ? s : min
          , seniors[0])
        : null;

      teams[dayLabel].mentorToSenior[mentor.name] = assignedSenior?.name || null;
      if (assignedSenior) {
        assignmentCounts[assignedSenior.name]++;
      }
    }

    // PASS 2: Fix no-overlap cases by reassigning
    for (const mentor of regularMentors) {
      const currentSenior = teams[dayLabel].mentorToSenior[mentor.name];
      if (!currentSenior) continue;

      const mentorShifts = dayShifts[mentor.name] || [];
      const seniorShifts = dayShifts[currentSenior] || [];
      const hasOverlap = mentorShifts.some(s => seniorShifts.includes(s));

      if (!hasOverlap) {
        // Find a senior who DOES share shifts
        const betterSenior = seniors.find(s => {
          const sShifts = dayShifts[s.name] || [];
          return mentorShifts.some(ms => sShifts.includes(ms));
        });

        if (betterSenior && betterSenior.name !== currentSenior) {
          Logger.log(`  Reassigning ${mentor.name}: ${currentSenior} -> ${betterSenior.name} (no overlap fix)`);
          teams[dayLabel].mentorToSenior[mentor.name] = betterSenior.name;
        }
      }
    }

    // Log final assignments
    for (const mentor of regularMentors) {
      const seniorName = teams[dayLabel].mentorToSenior[mentor.name];
      const sharedShifts = seniorName
        ? (dayShifts[mentor.name] || []).filter(s => (dayShifts[seniorName] || []).includes(s))
        : [];
      Logger.log(`  ${mentor.name} -> ${seniorName || 'Unassigned'} (shared: ${sharedShifts.join(', ') || 'none'})`);
    }
  }

  return teams;
}

/**
 * Outputs mentor teams to a dedicated sheet
 * @param {Object} teams - Teams structure from computeMentorTeams
 * @param {Array<string>} seniorMentorNames - Designated senior names (for header storage)
 * @param {Array<string>} firstTimeMentorNames - Designated first-time mentor names
 * @returns {boolean} Success status
 */
function outputMentorTeamsToSheet(teams, seniorMentorNames, firstTimeMentorNames) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // Delete existing sheet if it exists
    let sheet = ss.getSheetByName(CONFIG.SHEETS.MENTOR_TEAMS);
    if (sheet) {
      ss.deleteSheet(sheet);
    }

    // Create new sheet
    sheet = ss.insertSheet(CONFIG.SHEETS.MENTOR_TEAMS);

    // Build data rows
    const allData = [];

    // Determine max width needed for designation rows
    const maxDesignations = Math.max(seniorMentorNames.length, (firstTimeMentorNames || []).length);

    // Row 1: Header with senior designations stored in columns F+
    const headerRow = ['Day', 'Mentor', 'Reports To (Senior)', 'Shared Shifts', '', 'Senior Mentors:'];
    seniorMentorNames.forEach(name => headerRow.push(name));
    // Pad to consistent width
    while (headerRow.length < 6 + 1 + maxDesignations) headerRow.push('');
    allData.push(headerRow);

    // Row 2: First-time mentor designations in columns F+
    const firstTimeRow = ['', '', '', '', '', 'First-Time Mentors:'];
    (firstTimeMentorNames || []).forEach(name => firstTimeRow.push(name));
    while (firstTimeRow.length < headerRow.length) firstTimeRow.push('');
    allData.push(firstTimeRow);

    // Data rows (starting at row 3) - one per first-time mentor per day
    for (const [dayLabel, dayData] of Object.entries(teams)) {
      for (const [mentorName, seniorName] of Object.entries(dayData.mentorToSenior)) {
        const row = [dayLabel, mentorName, seniorName || 'Unassigned', ''];
        // Pad to match header length
        while (row.length < headerRow.length) row.push('');
        allData.push(row);
      }
    }

    // Write data
    if (allData.length > 0) {
      sheet.getRange(1, 1, allData.length, headerRow.length).setValues(allData);
    }

    // Format header
    const headerRange = sheet.getRange(1, 1, 1, 4);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');

    // Format senior designations header (row 1, columns F+)
    if (seniorMentorNames.length > 0) {
      const seniorHeaderRange = sheet.getRange(1, 6, 1, 1 + seniorMentorNames.length);
      seniorHeaderRange.setFontWeight('bold');
      seniorHeaderRange.setBackground('#e8eaed');
    }

    // Format first-time mentor designations (row 2, columns F+)
    if ((firstTimeMentorNames || []).length > 0) {
      const firstTimeRange = sheet.getRange(2, 6, 1, 1 + firstTimeMentorNames.length);
      firstTimeRange.setFontWeight('bold');
      firstTimeRange.setBackground('#fef3e0');
    }

    sheet.autoResizeColumns(1, Math.min(headerRow.length, 10));

    Logger.log('Mentor Teams sheet created with ' + (allData.length - 2) + ' assignments');
    return true;
  } catch (e) {
    Logger.log('Error creating Mentor Teams sheet: ' + e.message);
    return false;
  }
}

/**
 * Formats a Date object to a schedule label string like "Saturday March 21, 2026".
 * @param {Date} d
 * @returns {string}
 */
function formatDateToScheduleLabel(d) {
  const tz = Session.getScriptTimeZone();
  const dayOfWeek = Utilities.formatDate(d, tz, 'EEEE');
  const month     = Utilities.formatDate(d, tz, 'MMMM');
  const day       = Utilities.formatDate(d, tz, 'd');
  const year      = Utilities.formatDate(d, tz, 'yyyy');
  return `${dayOfWeek} ${month} ${day}, ${year}`;
}

/**
 * Main entry point called from dashboard to compute and save mentor teams
 * @param {Array<string>} seniorMentorNames - Names designated as senior mentors
 * @param {Array<string>} firstTimeMentorNames - Names designated as first-time mentors
 * @returns {Object} Result with team summary
 */
function computeAndSaveTeams(seniorMentorNames, firstTimeMentorNames) {
  try {
    Logger.log('Computing mentor teams with seniors: ' + seniorMentorNames.join(', '));
    Logger.log('First-time mentors: ' + (firstTimeMentorNames || []).join(', '));

    // Read the existing schedule to get volunteer assignments
    const spreadsheetId = CONFIG.SPREADSHEET_ID;
    const scheduleSheetName = CONFIG.SHEETS.SCHEDULE_OUTPUT;

    const existingAssignments = readExistingSchedule(spreadsheetId, scheduleSheetName);
    if (!existingAssignments) {
      throw new Error('No schedule found. Please generate a schedule first.');
    }

    // Read volunteer data to get role information
    const availabilitySheetName = CONFIG.SHEETS.SCHEDULE_AVAILABILITY;
    const volunteers = readAvailabilityResponses(spreadsheetId, availabilitySheetName);

    // Map volunteer data by name
    const volunteerMap = {};
    volunteers.forEach(v => {
      v.roleCategory = classifyRole(v.role);
      volunteerMap[v.fullName] = v;
    });

    // Create volunteer objects for schedule result format
    const volunteerObjects = Object.entries(existingAssignments).map(([name, shifts]) => {
      const v = volunteerMap[name];
      return {
        name: name,
        fullName: name,
        roleCategory: v?.roleCategory || 'filer',
        email: v?.email || ''
      };
    });

    // Get day labels from schedule sheet
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const scheduleSheet = ss.getSheetByName(scheduleSheetName);
    let dayLabels = ['Day 1', 'Day 2', 'Day 3', 'Day 4'];
    if (scheduleSheet) {
      const headerRow = scheduleSheet.getRange(1, 2, 1, 4).getValues()[0];
      if (headerRow[0]) {
        dayLabels = headerRow.map(d => {
          if (!d) return 'Day';
          if (d instanceof Date) {
            return formatDateToScheduleLabel(d);
          }
          // If it's a string with time/timezone info, strip it
          return d.toString().replace(/\s+\d{1,2}:\d{2}:\d{2}.*$/, '').trim();
        });
      }
    }

    // Compute teams (only first-time mentors get assigned to seniors)
    const teams = computeMentorTeams(existingAssignments, volunteerObjects, seniorMentorNames, dayLabels, firstTimeMentorNames);

    // Output to sheet
    outputMentorTeamsToSheet(teams, seniorMentorNames, firstTimeMentorNames);

    // Calculate summary
    let totalAssignments = 0;
    let unassignedCount = 0;
    const summary = {};

    for (const [dayLabel, dayData] of Object.entries(teams)) {
      const dayAssignments = Object.values(dayData.mentorToSenior);
      const assigned = dayAssignments.filter(s => s !== null).length;
      const unassigned = dayAssignments.filter(s => s === null).length;

      totalAssignments += assigned;
      unassignedCount += unassigned;
      summary[dayLabel] = { assigned, unassigned };
    }

    return {
      success: true,
      teams: teams,
      seniorMentors: seniorMentorNames,
      firstTimeMentors: firstTimeMentorNames || [],
      summary: summary,
      totalAssignments: totalAssignments,
      unassignedCount: unassignedCount,
      message: `Teams computed: ${totalAssignments} first-time mentor pairings across 4 days`
    };
  } catch (e) {
    Logger.log('Error in computeAndSaveTeams: ' + e.message);
    return {
      success: false,
      error: e.message
    };
  }
}
