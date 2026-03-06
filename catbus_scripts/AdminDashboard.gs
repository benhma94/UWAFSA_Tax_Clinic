/**
 * Admin Dashboard Functions
 * Functions for the admin dashboard
 */

/**
 * Gets alert dashboard data (help requests + review requests)
 * @returns {Object} Alert datasets
 */
function getAlertDashboardData() {
  return {
    helpRequests: getLiveHelpRequestsCached(),
    reviewRequests: getLiveReviewRequestsCached()
  };
}

/**
 * Converts a SCHEDULE_CONFIG 'H:MM' time string to minutes since midnight.
 * Hours < 9 are treated as PM (e.g. '1:15' → 13:15, '9:45' → 9:45 AM).
 * @param {string} t - Time string like '9:45' or '1:15'
 * @returns {number} Minutes since midnight
 */
function shiftTimeToMins_(t) {
  const [h, m] = t.split(':').map(Number);
  return (h < 9 ? h + 12 : h) * 60 + m;
}

/**
 * Returns the 0-based index of today in CONFIG.CLINIC_DATES, or -1 if today
 * is not a clinic day.
 * @returns {number} 0–3, or -1
 */
function getTodayClinicDayIndex_() {
  const today = new Date();
  const clinicDates = CONFIG.CLINIC_DATES || [];
  for (let i = 0; i < clinicDates.length; i++) {
    const d = new Date(clinicDates[i]);
    if (d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()) {
      return i;
    }
  }
  return -1;
}

/**
 * Returns the current shift slot key ('A', 'B', or 'C') based on wall-clock
 * time and SCHEDULE_CONFIG.TIME_SLOTS. During overlap windows, favours the
 * later-starting shift. Returns null outside all shift hours.
 * @returns {string|null}
 */
function getCurrentSlotKey_() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Sort latest-starting first so overlaps favour the newer shift
  const slots = Object.entries(SCHEDULE_CONFIG.TIME_SLOTS)
    .map(([key, s]) => ({ key, start: shiftTimeToMins_(s.start), end: shiftTimeToMins_(s.end) }))
    .sort((a, b) => b.start - a.start);

  for (const slot of slots) {
    if (currentMinutes >= slot.start && currentMinutes < slot.end) {
      return slot.key;
    }
  }
  return null;
}

/**
 * Reads the Generated Schedule sheet and returns a map of volunteer name →
 * Set of assigned shift IDs (e.g. 'D1A', 'D2C').
 * Returns an empty object if the sheet is missing or empty.
 * @returns {Object} { volunteerName: Set<string> }
 */
function buildVolunteerScheduleMap_() {
  const result = {};
  try {
    const sheet = getSheet(CONFIG.SHEETS.SCHEDULE_OUTPUT);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return result;

    // Rows 2-4 = slots A/B/C; cols 2-5 = days 1-4 (1-indexed in sheet)
    const numRows = Math.min(3, lastRow - 1);
    const data = sheet.getRange(2, 1, numRows, 5).getValues();
    const slotKeys = ['A', 'B', 'C'];

    for (let r = 0; r < data.length; r++) {
      for (let c = 1; c <= 4; c++) { // cols 1-4 = days 1-4 in the row array
        const cell = data[r][c]?.toString().trim();
        if (!cell || cell === '(unfilled)') continue;
        const shiftId = `D${c}${slotKeys[r]}`;
        const names = cell.split(',').map(n => n.trim()).filter(Boolean);
        for (const name of names) {
          if (!result[name]) result[name] = new Set();
          result[name].add(shiftId);
        }
      }
    }
  } catch (e) {
    Logger.log('buildVolunteerScheduleMap_: ' + e.message);
  }
  return result;
}

/**
 * Gets all currently active returns (volunteers working on a client right now)
 * Joins CLIENT_ASSIGNMENT timestamps and client intake info
 * @returns {Array} Array of active return objects with timing and client details
 */
function getActiveReturns() {
  return safeExecute(() => {
    // Compute shared context once before iterating volunteers
    const todayDayNum = getTodayClinicDayIndex_() + 1; // 1–4, or 0 if not a clinic day
    const currentSlotKey = getCurrentSlotKey_();        // 'A'|'B'|'C'|null
    const scheduleMap = buildVolunteerScheduleMap_();   // name → Set<shiftId>
    const slotOrder = ['A', 'B', 'C'];

    // Read CLIENT_ASSIGNMENT sheet for active (non-complete) assignments
    const sheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const now = Date.now();
    const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK, lastRow - 1);
    const startRow = Math.max(2, lastRow - checkRows + 1);
    const data = sheet.getRange(startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1,
                                checkRows, 4).getValues();

    // Build map: volunteerName → { clientId, assignedTimestamp }
    const activeMap = {};
    for (let i = 0; i < data.length; i++) {
      const timestamp = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP];
      const clientId = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
      const volunteer = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
      const completed = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
      if (volunteer && clientId && completed !== 'complete') {
        activeMap[volunteer] = { clientId, assignedTimestamp: timestamp };
      }
    }

    // Also check older rows if some volunteers aren't in the recent window
    if (lastRow > CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK) {
      const olderRows = lastRow - CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK;
      const olderData = sheet.getRange(2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1,
                                       olderRows, 4).getValues();
      for (let i = 0; i < olderData.length; i++) {
        const timestamp = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP];
        const clientId = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
        const volunteer = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
        const completed = olderData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
        if (volunteer && clientId && completed !== 'complete' && !activeMap[volunteer]) {
          activeMap[volunteer] = { clientId, assignedTimestamp: timestamp };
        }
      }
    }

    // Build result cards by enriching with client intake info and elapsed times
    const activeReturns = [];
    for (const [volunteer, { clientId, assignedTimestamp }] of Object.entries(activeMap)) {
      const intakeInfo = getClientIntakeInfo(clientId) || {};

      const minutesOnClient = assignedTimestamp instanceof Date
        ? Math.floor((now - assignedTimestamp.getTime()) / 60000)
        : null;

      // Per-volunteer shift end: walk forward through consecutive slots today
      let minutesUntilShiftEnd = null;
      if (todayDayNum > 0 && currentSlotKey) {
        // Normalize name (strip "Station X – " prefix if present)
        const baseName = volunteer.includes('–')
          ? volunteer.split('–')[1].trim()
          : volunteer.trim();

        const volunteerShifts = scheduleMap[baseName] || new Set();
        const currentSlotIdx = slotOrder.indexOf(currentSlotKey);

        // Find last consecutive scheduled slot starting from current
        let lastSlotIdx = currentSlotIdx;
        for (let i = currentSlotIdx + 1; i < slotOrder.length; i++) {
          if (volunteerShifts.has(`D${todayDayNum}${slotOrder[i]}`)) {
            lastSlotIdx = i;
          } else {
            break;
          }
        }

        const lastSlotEnd = SCHEDULE_CONFIG.TIME_SLOTS[slotOrder[lastSlotIdx]]?.end;
        if (lastSlotEnd) {
          const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
          minutesUntilShiftEnd = shiftTimeToMins_(lastSlotEnd) - nowMins;
        }
      }

      activeReturns.push({
        volunteer,
        clientId,
        filingYears: (intakeInfo.filingYears || []).join(', '),
        situations: (intakeInfo.situations || []).filter(s => s).join(', '),
        notes: intakeInfo.notes || '',
        isHighPriority: clientId.startsWith('P'),
        needsSeniorReview: intakeInfo.needsSeniorReview || false,
        minutesOnClient,
        minutesUntilShiftEnd
      });
    }

    // Sort: longest working time first
    activeReturns.sort((a, b) => (b.minutesOnClient || 0) - (a.minutesOnClient || 0));
    return activeReturns;
  }, 'getActiveReturns');
}

/**
 * Gets admin dashboard data (stats + active returns, no alerts)
 * @returns {Object} Dashboard datasets
 */
function getAdminDashboardData() {
  return {
    activeReturns: getActiveReturns(),
    returnSummary: getReturnSummaryCached(),
    performanceMetrics: getVolunteerPerformanceMetrics()
  };
}

/**
 * Gets return completion summary with caching
 * @returns {Object} Summary with totalCompleted, completedToday, and hourlyCounts
 */
function getReturnSummaryCached() {
  return getCachedOrFetch(
    CACHE_CONFIG.KEYS.RETURN_SUMMARY,
    () => getReturnSummary(),
    CACHE_CONFIG.TTL.RETURN_SUMMARY
  );
}

/**
 * Gets return completion summary
 * Optimized to read only necessary columns and rows
 * @returns {Object} Summary with totalCompleted, completedToday, and hourlyCounts
 */
function getReturnSummary() {
  return safeExecute(() => {
    const sheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      return {
        totalCompleted: 0,
        completedToday: 0,
        hourlyCounts: {}
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Read all columns so we can use config-based indices
    const numRows = lastRow - 1;
    const numCols = CONFIG.COLUMNS.TAX_RETURN_TRACKER.PAPER + 1; // Read up to PAPER column
    const data = sheet.getRange(2, 1, numRows, numCols).getValues();

    let totalCompleted = 0;
    let completedToday = 0;
    const hourlyCounts = {};

    for (let i = 0; i < data.length; i++) {
      const timestamp = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.TIMESTAMP];
      const efile = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.EFILE]?.toString().toLowerCase() === 'yes';
      const paper = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.PAPER]?.toString().toLowerCase() === 'yes';

      if (efile || paper) {
        totalCompleted++;

        if (timestamp instanceof Date) {
          const ts = new Date(timestamp);
          const sameDay = ts.getFullYear() === today.getFullYear() &&
                         ts.getMonth() === today.getMonth() &&
                         ts.getDate() === today.getDate();

          if (sameDay) {
            completedToday++;

            const hour = ts.getHours();
            hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
          }
        }
      }
    }

    return {
      totalCompleted,
      completedToday,
      hourlyCounts
    };
  }, 'getReturnSummary');
}

/**
 * Gets volunteer performance metrics
 * Shows returns completed per volunteer with all-time and today stats
 * @returns {Object} Performance data with topVolunteers and todayVolunteers arrays
 */
function getVolunteerPerformanceMetrics() {
  return safeExecute(() => {
    const sheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      return {
        topVolunteers: [],
        todayVolunteers: [],
        totalVolunteers: 0,
        avgReturnsPerVolunteer: 0
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Read necessary columns: Timestamp, Volunteer, EFILE, PAPER
    const numRows = lastRow - 1;
    const data = sheet.getRange(2, 1, numRows, 9).getValues();

    const volunteerCounts = {}; // All-time counts
    const volunteerCountsToday = {}; // Today's counts

    for (let i = 0; i < data.length; i++) {
      const timestamp = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.TIMESTAMP];
      const volunteer = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.VOLUNTEER]?.toString().trim();
      const efile = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.EFILE]?.toString().toLowerCase() === 'yes';
      const paper = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.PAPER]?.toString().toLowerCase() === 'yes';

      if (!volunteer || (!efile && !paper)) continue;

      // All-time counting
      volunteerCounts[volunteer] = (volunteerCounts[volunteer] || 0) + 1;

      // Today counting
      if (timestamp instanceof Date) {
        const ts = new Date(timestamp);
        const sameDay = ts.getFullYear() === today.getFullYear() &&
                       ts.getMonth() === today.getMonth() &&
                       ts.getDate() === today.getDate();

        if (sameDay) {
          volunteerCountsToday[volunteer] = (volunteerCountsToday[volunteer] || 0) + 1;
        }
      }
    }

    // Convert to arrays and sort
    const topVolunteers = Object.entries(volunteerCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    const todayVolunteers = Object.entries(volunteerCountsToday)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 today

    const totalVolunteers = Object.keys(volunteerCounts).length;
    const totalReturns = Object.values(volunteerCounts).reduce((sum, count) => sum + count, 0);
    const avgReturnsPerVolunteer = totalVolunteers > 0 ? Math.round(totalReturns / totalVolunteers * 10) / 10 : 0;

    return {
      topVolunteers,
      todayVolunteers,
      totalVolunteers,
      avgReturnsPerVolunteer
    };
  }, 'getVolunteerPerformanceMetrics');
}
