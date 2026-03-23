/**
 * Admin Dashboard Functions
 * Functions for the admin dashboard
 */

/**
 * Gets alert dashboard data (help requests + review requests)
 * @returns {Object} Alert datasets
 */
function getAlertDashboardData() {
  const stationMap = getVolunteerStationMap_();
  const reviewRequests = getLiveReviewRequestsCached().map(req => {
    const intake = req.clientId ? getClientIntakeInfo(req.clientId) : null;
    return Object.assign({}, req, {
      needsSeniorReview: intake?.needsSeniorReview || false,
      station: stationMap[req.volunteer] || ''
    });
  });
  const helpRequests = getLiveHelpRequestsCached().map(req =>
    Object.assign({}, req, { station: stationMap[req.volunteer] || '' })
  );
  return {
    helpRequests,
    reviewRequests
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
    const stationMap = getVolunteerStationMap_();       // name → station string
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
      if (volunteer && clientId && !completed) {
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
        if (volunteer && clientId && !completed && !activeMap[volunteer]) {
          activeMap[volunteer] = { clientId, assignedTimestamp: timestamp };
        }
      }
    }

    // Remove quiz-station volunteers (practice returns, not real)
    // Check both the stored "Station Quiz – Name" prefix AND the current station map
    for (const volunteer of Object.keys(activeMap)) {
      const baseName = volunteer.includes('–') ? volunteer.split('–')[1].trim() : volunteer.trim();
      const stationFromPrefix = volunteer.includes('–')
        ? volunteer.split('–')[0].replace(/station/i, '').trim().toLowerCase()
        : '';
      if (stationFromPrefix === 'quiz' || (stationMap[baseName] || '').toLowerCase() === 'quiz') {
        delete activeMap[volunteer];
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
 * @param {string} [selectedDateStr] - Optional clinic date string to filter "today" data (e.g. "Saturday, March 21, 2026"). Omit for actual today.
 * @returns {Object} Dashboard datasets
 */
function getAdminDashboardData(selectedDateStr) {
  // Parse optional date filter
  let filterDate = null;
  if (selectedDateStr) {
    filterDate = new Date(selectedDateStr);
    filterDate.setHours(0, 0, 0, 0);
  }

  // Read tracker data once and pass to all three functions that need it
  const trackerData = readTrackerData_();
  return {
    activeReturns: getActiveReturns(),
    returnSummary: filterDate
      ? getReturnSummary(trackerData, filterDate)
      : getReturnSummaryCached(trackerData),
    performanceMetrics: getVolunteerPerformanceMetrics(trackerData, filterDate),
    reviewerLeaderboard: getReviewerLeaderboard(trackerData, filterDate),
    clinicDays: ELIGIBILITY_CONFIG.CLINIC_DATES
  };
}

/**
 * Reads the Tax Return Tracker sheet data once for shared use.
 * @returns {{ data: Array[], lastRow: number }}
 */
function readTrackerData_() {
  const sheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { data: [], lastRow: lastRow };
  const numRows = lastRow - 1;
  const numCols = CONFIG.COLUMNS.TAX_RETURN_TRACKER.PAPER + 1;
  const data = sheet.getRange(2, 1, numRows, numCols).getValues();
  return { data: data, lastRow: lastRow };
}

/**
 * Gets return completion summary with caching
 * @returns {Object} Summary with totalCompleted, completedToday, and hourlyCounts
 */
function getReturnSummaryCached(trackerData) {
  return getCachedOrFetch(
    CACHE_CONFIG.KEYS.RETURN_SUMMARY,
    () => getReturnSummary(trackerData, null),
    CACHE_CONFIG.TTL.RETURN_SUMMARY
  );
}

/**
 * Gets return completion summary
 * Optimized to read only necessary columns and rows
 * @param {Object} trackerData - Pre-read tracker data
 * @param {Date|null} filterDate - Optional date to filter "today" data; null = actual today
 * @returns {Object} Summary with totalCompleted, completedToday, and hourlyCounts
 */
function getReturnSummary(trackerData, filterDate) {
  return safeExecute(() => {
    // Use pre-read data if available, otherwise read from sheet
    var data;
    if (trackerData && trackerData.data) {
      data = trackerData.data;
    } else {
      const sheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return { totalCompleted: 0, completedToday: 0, hourlyCounts: {} };
      data = sheet.getRange(2, 1, lastRow - 1, CONFIG.COLUMNS.TAX_RETURN_TRACKER.PAPER + 1).getValues();
    }

    if (!data.length) {
      return {
        totalCompleted: 0,
        completedToday: 0,
        hourlyCounts: {}
      };
    }

    const today = filterDate ? new Date(filterDate) : new Date();
    today.setHours(0, 0, 0, 0);

    let totalCompleted = 0;
    let completedToday = 0;
    const hourlyCounts = {};

    for (let i = 0; i < data.length; i++) {
      const timestamp = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.TIMESTAMP];
      const efile = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.EFILE]?.toString().toLowerCase() === 'yes';
      const paper = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.PAPER]?.toString().toLowerCase() === 'yes';
      const married = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.MARRIED]?.toString().toLowerCase() === 'yes';
      const increment = married ? 2 : 1;

      if (efile || paper) {
        totalCompleted += increment;

        if (timestamp instanceof Date) {
          const ts = new Date(timestamp);
          const sameDay = ts.getFullYear() === today.getFullYear() &&
                         ts.getMonth() === today.getMonth() &&
                         ts.getDate() === today.getDate();

          if (sameDay) {
            completedToday += increment;

            const hour = ts.getHours();
            hourlyCounts[hour] = (hourlyCounts[hour] || 0) + increment;
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
 * Shows returns completed per volunteer with all-time and selected-day stats
 * @param {Object} trackerData - Pre-read tracker data
 * @param {Date|null} filterDate - Optional date to filter "today" data; null = actual today
 * @returns {Object} Performance data with topVolunteers and todayVolunteers arrays
 */
function getVolunteerPerformanceMetrics(trackerData, filterDate) {
  return safeExecute(() => {
    // Use pre-read data if available, otherwise read from sheet
    var data;
    if (trackerData && trackerData.data) {
      data = trackerData.data;
    } else {
      const sheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return { topVolunteers: [], todayVolunteers: [], totalVolunteers: 0, avgReturnsPerVolunteer: 0 };
      data = sheet.getRange(2, 1, lastRow - 1, CONFIG.COLUMNS.TAX_RETURN_TRACKER.PAPER + 1).getValues();
    }

    if (!data.length) {
      return {
        topVolunteers: [],
        todayVolunteers: [],
        totalVolunteers: 0,
        avgReturnsPerVolunteer: 0
      };
    }

    const today = filterDate ? new Date(filterDate) : new Date();
    today.setHours(0, 0, 0, 0);

    const volunteerCounts = {}; // All-time counts
    const volunteerCountsToday = {}; // Today's counts

    for (let i = 0; i < data.length; i++) {
      const timestamp = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.TIMESTAMP];
      const volunteer = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.VOLUNTEER]?.toString().trim();
      const efile = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.EFILE]?.toString().toLowerCase() === 'yes';
      const paper = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.PAPER]?.toString().toLowerCase() === 'yes';
      const married = data[i][CONFIG.COLUMNS.TAX_RETURN_TRACKER.MARRIED]?.toString().toLowerCase() === 'yes';
      const increment = married ? 2 : 1;

      if (!volunteer || (!efile && !paper)) continue;

      // All-time counting
      volunteerCounts[volunteer] = (volunteerCounts[volunteer] || 0) + increment;

      // Today counting
      if (timestamp instanceof Date) {
        const ts = new Date(timestamp);
        const sameDay = ts.getFullYear() === today.getFullYear() &&
                       ts.getMonth() === today.getMonth() &&
                       ts.getDate() === today.getDate();

        if (sameDay) {
          volunteerCountsToday[volunteer] = (volunteerCountsToday[volunteer] || 0) + increment;
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

/**
 * Gets reviewer leaderboard from Tax Return Tracker sheet.
 * Counts each reviewer once per return even if they appear in both REVIEWER and SECONDARY_REVIEWER.
 * @returns {Object} topReviewers and todayReviewers arrays
 */
/**
 * Scans Tax Return Tracker for duplicate rows (same CLIENT_ID + TAX_YEAR).
 * Read-only preview — does not delete anything.
 * @returns {Object} { total: number, duplicates: Array<{clientId, taxYear, count}> }
 */
function findDuplicateReturns() {
  const sheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { total: 0, duplicates: [] };

  const cols = CONFIG.COLUMNS.TAX_RETURN_TRACKER;
  const data = sheet.getRange(2, 1, lastRow - 1, cols.PAPER + 1).getValues();

  const groups = {};
  for (let i = 0; i < data.length; i++) {
    const clientId = data[i][cols.CLIENT_ID]?.toString().trim();
    const taxYear = data[i][cols.TAX_YEAR]?.toString().trim();
    if (!clientId || !taxYear) continue;
    const key = clientId + '|' + taxYear;
    groups[key] = (groups[key] || 0) + 1;
  }

  const duplicates = [];
  let total = 0;
  for (const [key, count] of Object.entries(groups)) {
    if (count <= 1) continue;
    const [clientId, taxYear] = key.split('|');
    const extras = count - 1;
    duplicates.push({ clientId, taxYear, count: extras });
    total += extras;
  }

  return { total, duplicates };
}

/**
 * Finds and removes duplicate rows in Tax Return Tracker.
 * Duplicates = same CLIENT_ID + TAX_YEAR. Keeps the most recent (latest timestamp).
 * Deletes rows bottom-up to preserve indices.
 * @returns {Object} { removed: number, duplicates: Array<{clientId, taxYear, kept}> }
 */
function removeDuplicateReturns() {
  const sheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { removed: 0, duplicates: [] };

  const cols = CONFIG.COLUMNS.TAX_RETURN_TRACKER;
  const numCols = cols.PAPER + 1;
  const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  // Group rows by CLIENT_ID + TAX_YEAR key
  const groups = {};
  for (let i = 0; i < data.length; i++) {
    const clientId = data[i][cols.CLIENT_ID]?.toString().trim();
    const taxYear = data[i][cols.TAX_YEAR]?.toString().trim();
    if (!clientId || !taxYear) continue;

    const key = clientId + '|' + taxYear;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ rowIndex: i + 2, timestamp: data[i][cols.TIMESTAMP] }); // +2 for 1-indexed + header
  }

  // Find rows to delete (keep most recent per group)
  const rowsToDelete = [];
  const duplicateInfo = [];
  for (const [key, rows] of Object.entries(groups)) {
    if (rows.length <= 1) continue;

    // Sort by timestamp descending — keep the first (most recent)
    rows.sort((a, b) => {
      const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
      const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
      return tb - ta;
    });

    const [clientId, taxYear] = key.split('|');
    duplicateInfo.push({ clientId, taxYear, kept: rows.length - 1 });

    for (let i = 1; i < rows.length; i++) {
      rowsToDelete.push(rows[i].rowIndex);
    }
  }

  // Delete from bottom up to preserve row indices
  rowsToDelete.sort((a, b) => b - a);
  for (const row of rowsToDelete) {
    sheet.deleteRow(row);
  }

  return { removed: rowsToDelete.length, duplicates: duplicateInfo };
}

function getReviewerLeaderboard(trackerData, filterDate) {
  return safeExecute(() => {
    // Use pre-read data if available, otherwise read from sheet
    var data;
    if (trackerData && trackerData.data) {
      data = trackerData.data;
    } else {
      const sheet = getSheet(CONFIG.SHEETS.TAX_RETURN_TRACKER);
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return { topReviewers: [], todayReviewers: [] };
      data = sheet.getRange(2, 1, lastRow - 1, CONFIG.COLUMNS.TAX_RETURN_TRACKER.PAPER + 1).getValues();
    }

    if (!data.length) {
      return { topReviewers: [], todayReviewers: [] };
    }

    const today = filterDate ? new Date(filterDate) : new Date();
    today.setHours(0, 0, 0, 0);

    const cols = CONFIG.COLUMNS.TAX_RETURN_TRACKER;

    const allTimeCounts = {};
    const todayCounts = {};

    for (let i = 0; i < data.length; i++) {
      const reviewer = data[i][cols.REVIEWER]?.toString().trim();
      const secondary = data[i][cols.SECONDARY_REVIEWER]?.toString().trim();
      const timestamp = data[i][cols.TIMESTAMP];
      const married = data[i][cols.MARRIED]?.toString().toLowerCase() === 'yes';
      const increment = married ? 2 : 1;

      if (!reviewer && !secondary) continue;

      const isToday = timestamp instanceof Date &&
        timestamp.getFullYear() === today.getFullYear() &&
        timestamp.getMonth() === today.getMonth() &&
        timestamp.getDate() === today.getDate();

      // Collect unique reviewers for this row
      const reviewersThisRow = new Set();
      if (reviewer) reviewersThisRow.add(reviewer);
      if (secondary && secondary.toLowerCase() !== reviewer?.toLowerCase()) reviewersThisRow.add(secondary);

      reviewersThisRow.forEach(name => {
        allTimeCounts[name] = (allTimeCounts[name] || 0) + increment;
        if (isToday) todayCounts[name] = (todayCounts[name] || 0) + increment;
      });
    }

    const topReviewers = Object.entries(allTimeCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const todayReviewers = Object.entries(todayCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { topReviewers, todayReviewers };
  }, 'getReviewerLeaderboard');
}
