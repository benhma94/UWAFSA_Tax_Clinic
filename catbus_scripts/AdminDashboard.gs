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
  const liveReviewRequests = getLiveReviewRequestsCached();
  const hasClientIds = liveReviewRequests.some(req => req.clientId);
  const intakeMap = hasClientIds ? buildClientIntakeMap_() : {};
  const reviewRequests = liveReviewRequests.map(req => {
    return Object.assign({}, req, {
      needsSeniorReview: req.clientId ? (intakeMap[req.clientId]?.needsSeniorReview || false) : false,
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
  const clinicDates = ELIGIBILITY_CONFIG.CLINIC_DATES || [];
  for (let i = 0; i < clinicDates.length; i++) {
    const d = new Date(clinicDates[i].replace(/^\w+,\s*/, '') + ' 12:00');
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
 * Reads the entire Client Intake sheet once and returns a map of clientId → intake info.
 * Use this to avoid per-client sheet reads inside loops.
 * @returns {Object} { clientId: { filingYears, situations, notes, needsSeniorReview, documents } }
 */
function buildClientIntakeMap_() {
  const map = {};
  try {
    const sheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return map;
    const numCols = CONFIG.COLUMNS.CLIENT_INTAKE.DOCUMENTS + 1;
    const data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
    for (const row of data) {
      const clientId = row[CONFIG.COLUMNS.CLIENT_INTAKE.CLIENT_ID]?.toString().trim();
      if (!clientId) continue;
      const needsSeniorReview = row[CONFIG.COLUMNS.CLIENT_INTAKE.NEEDS_SENIOR_REVIEW] === true ||
        row[CONFIG.COLUMNS.CLIENT_INTAKE.NEEDS_SENIOR_REVIEW]?.toString().toLowerCase() === 'true';
      let documents = [];
      try { documents = JSON.parse(row[CONFIG.COLUMNS.CLIENT_INTAKE.DOCUMENTS]?.toString().trim() || '[]'); } catch (e) {}
      map[clientId] = {
        filingYears: row[CONFIG.COLUMNS.CLIENT_INTAKE.FILING_YEARS]?.toString().split(',').map(y => y.trim()) || [],
        situations:  row[CONFIG.COLUMNS.CLIENT_INTAKE.SITUATIONS]?.toString().split(',').map(s => s.trim()) || [],
        notes:       row[CONFIG.COLUMNS.CLIENT_INTAKE.NOTES]?.toString().trim() || '',
        needsSeniorReview,
        documents
      };
    }
  } catch (e) {
    Logger.log('buildClientIntakeMap_: ' + e.message);
  }
  return map;
}

/**
 * Returns a map of { volunteerName: true } for volunteers currently on break.
 * Reads the Volunteer List sheet and excludes signed-out sessions.
 */
function getVolunteerBreakMap_() {
  try {
    const today = new Date().toDateString();
    const volSheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    const signOutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
    const volLastRow = volSheet.getLastRow();
    const signOutLastRow = signOutSheet.getLastRow();

    const volData = volLastRow > 1 ? volSheet.getRange(2, 1, volLastRow - 1, 5).getValues() : [];
    const signOutData = signOutLastRow > 1
      ? signOutSheet.getRange(2, 1, signOutLastRow - 1, 3).getValues()
      : [];
    const signedOutSessions = new Set(
      signOutData.map(r => r[CONFIG.COLUMNS.SIGNOUT.SESSION_ID]?.toString().trim())
    );

    const breakMap = {};
    for (const row of volData) {
      const ts        = row[CONFIG.COLUMNS.VOLUNTEER_LIST.TIMESTAMP];
      const name      = row[CONFIG.COLUMNS.VOLUNTEER_LIST.NAME]?.toString().trim();
      const sessionId = row[CONFIG.COLUMNS.VOLUNTEER_LIST.SESSION_ID]?.toString().trim();
      const onBreak   = row[CONFIG.COLUMNS.VOLUNTEER_LIST.ON_BREAK]?.toString().trim().toLowerCase();
      if (!name || !sessionId) continue;
      if (new Date(ts).toDateString() !== today) continue;
      if (signedOutSessions.has(sessionId)) continue;
      breakMap[name] = (onBreak === 'yes');
    }
    return breakMap;
  } catch (e) {
    Logger.log('getVolunteerBreakMap_: ' + e.message);
    return {};
  }
}

/**
 * Gets all currently active returns (volunteers working on a client right now)
 * Joins CLIENT_ASSIGNMENT timestamps and client intake info
 * @returns {Array} Array of active return objects with timing and client details
 */
function getActiveReturns(stationMap_) {
  return safeExecute(() => {
    // Compute shared context once before iterating volunteers
    const todayDayNum = getTodayClinicDayIndex_() + 1; // 1–4, or 0 if not a clinic day
    const currentSlotKey = getCurrentSlotKey_();        // 'A'|'B'|'C'|null
    const scheduleMap = buildVolunteerScheduleMap_();   // name → Set<shiftId>
    const stationMap = stationMap_ || getVolunteerStationMap_(); // name → station string
    const slotOrder = ['A', 'B', 'C'];

    // Read CLIENT_ASSIGNMENT sheet for active (non-complete) assignments
    const sheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const data = sheet.getRange(2, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1,
                                lastRow - 1, 4).getValues();

    // Find each volunteer's uncompleted assignment today.
    // Using completion status (not timestamp) as the active/done discriminator avoids issues
    // with reassignClientToVolunteer, which only updates the VOLUNTEER column in-place and
    // preserves the original assignment timestamp.
    const activeByBaseName = {}; // baseName → { volunteer, clientId, timestamp }
    for (let i = 0; i < data.length; i++) {
      const timestamp = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP];
      const clientId = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
      const volunteer = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
      const completed = data[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();

      if (!volunteer || !clientId || completed) continue; // skip completed rows
      const isToday = timestamp instanceof Date &&
        timestamp.getFullYear() === today.getFullYear() &&
        timestamp.getMonth() === today.getMonth() &&
        timestamp.getDate() === today.getDate();
      if (!isToday) continue;

      const baseName = volunteer.includes('–') ? volunteer.split('–')[1].trim() : volunteer.trim();
      // Each volunteer should have at most one uncompleted row; timestamp as tiebreaker
      if (!activeByBaseName[baseName] || timestamp > activeByBaseName[baseName].timestamp) {
        activeByBaseName[baseName] = { volunteer, clientId, timestamp };
      }
    }

    const activeMap = {};
    for (const row of Object.values(activeByBaseName)) {
      activeMap[row.volunteer] = { clientId: row.clientId, assignedTimestamp: row.timestamp };
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
    const intakeMap = buildClientIntakeMap_();
    const breakMap = getVolunteerBreakMap_();
    const activeReturns = [];
    for (const [volunteer, { clientId, assignedTimestamp }] of Object.entries(activeMap)) {
      const intakeInfo = intakeMap[clientId] || {};

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

      const baseName = volunteer.includes('–') ? volunteer.split('–')[1].trim() : volunteer.trim();
      activeReturns.push({
        volunteer,
        clientId,
        filingYears: (intakeInfo.filingYears || []).join(', '),
        situations: (intakeInfo.situations || []).filter(s => s).join(', '),
        notes: intakeInfo.notes || '',
        isHighPriority: clientId.startsWith('P'),
        needsSeniorReview: intakeInfo.needsSeniorReview || false,
        isOnBreak: breakMap[baseName] || false,
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
 * Gets signed-in filers with no active client assignment (idle filers).
 * Excludes quiz-station volunteers and non-filer stations.
 * @param {Object} trackerData - Pre-read tracker data from readTrackerData_()
 * @returns {Array} Array of { name, minutesIdle } sorted longest idle first
 */
function getIdleFilers(trackerData, stationMap_) {
  return safeExecute(() => {
    const now = Date.now();
    const today = new Date().toDateString();
    const nonFilerStations = CONFIG.SIGN_IN_OUT.NON_FILER_STATIONS;
    const stationMap = stationMap_ || getVolunteerStationMap_();

    // 1. Build set of base names with an active client assignment (excluding quiz)
    const activeBaseNames = new Set();
    const caSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    const caLastRow = caSheet.getLastRow();
    if (caLastRow > 1) {
      const checkRows = Math.min(CONFIG.PERFORMANCE.RECENT_ROWS_TO_CHECK, caLastRow - 1);
      const startRow = Math.max(2, caLastRow - checkRows + 1);
      const caData = caSheet.getRange(startRow, CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP + 1,
                                      checkRows, 4).getValues();
      for (const row of caData) {
        const volunteer = row[CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER]?.toString().trim();
        const clientId  = row[CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID]?.toString().trim();
        const completed = row[CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED]?.toString().trim().toLowerCase();
        if (!volunteer || !clientId || completed) continue;
        const baseName = volunteer.includes('–') ? volunteer.split('–')[1].trim() : volunteer;
        const prefixStation = volunteer.includes('–')
          ? volunteer.split('–')[0].replace(/station/i, '').trim().toLowerCase()
          : '';
        if (prefixStation === 'quiz' || (stationMap[baseName] || '').toLowerCase() === 'quiz') continue;
        activeBaseNames.add(baseName);
      }
    }

    // 2. Read signed-in filers today (not signed out, not quiz, not non-filer)
    const volSheet = getSheet(CONFIG.SHEETS.VOLUNTEER_LIST);
    const signOutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
    const volLastRow = volSheet.getLastRow();
    const signOutLastRow = signOutSheet.getLastRow();

    const volData = volLastRow > 1 ? volSheet.getRange(2, 1, volLastRow - 1, 5).getValues() : [];
    const signOutData = signOutLastRow > 1
      ? signOutSheet.getRange(2, 1, signOutLastRow - 1, 3).getValues()
      : [];
    const signedOutSessions = new Set(
      signOutData.map(r => r[CONFIG.COLUMNS.SIGNOUT.SESSION_ID]?.toString().trim())
    );

    // name → most recent sign-in Date; also track break status (last row wins)
    const signinTimes = {};
    const breakStatus = {};
    for (const row of volData) {
      const ts        = row[CONFIG.COLUMNS.VOLUNTEER_LIST.TIMESTAMP];
      const name      = row[CONFIG.COLUMNS.VOLUNTEER_LIST.NAME]?.toString().trim();
      const station   = row[CONFIG.COLUMNS.VOLUNTEER_LIST.STATION]?.toString().trim().toLowerCase();
      const sessionId = row[CONFIG.COLUMNS.VOLUNTEER_LIST.SESSION_ID]?.toString().trim();
      const onBreak   = row[CONFIG.COLUMNS.VOLUNTEER_LIST.ON_BREAK]?.toString().trim().toLowerCase();
      if (!name || !station || !sessionId) continue;
      if (new Date(ts).toDateString() !== today) continue;
      if (signedOutSessions.has(sessionId)) continue;
      if (nonFilerStations.some(s => station === s)) continue;
      if (station === 'quiz') continue;
      const tsDate = ts instanceof Date ? ts : new Date(ts);
      if (!signinTimes[name] || tsDate > signinTimes[name]) {
        signinTimes[name] = tsDate;
        breakStatus[name] = (onBreak === 'yes');
      }
    }

    // 3. Build volunteer → latest filing timestamp for today from tracker
    const latestTrackerTime = {};
    if (trackerData && trackerData.data) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      for (const row of trackerData.data) {
        const ts           = row[CONFIG.COLUMNS.TAX_RETURN_TRACKER.TIMESTAMP];
        const volunteerRaw = row[CONFIG.COLUMNS.TAX_RETURN_TRACKER.VOLUNTEER]?.toString().trim();
        if (!volunteerRaw || !(ts instanceof Date)) continue;
        if (ts < todayStart) continue;
        if (!latestTrackerTime[volunteerRaw] || ts > latestTrackerTime[volunteerRaw]) {
          latestTrackerTime[volunteerRaw] = ts;
        }
      }
    }

    // 4. Build idle filers list
    const idleFilers = [];
    for (const [name, signinTime] of Object.entries(signinTimes)) {
      if (activeBaseNames.has(name)) continue;
      const trackerTime = latestTrackerTime[name];
      const idleSince = (trackerTime && trackerTime > signinTime) ? trackerTime : signinTime;
      idleFilers.push({ name, minutesIdle: Math.floor((now - idleSince.getTime()) / 60000), isOnBreak: breakStatus[name] || false });
    }

    idleFilers.sort((a, b) => b.minutesIdle - a.minutesIdle);
    return idleFilers;
  }, 'getIdleFilers');
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

  // Read shared data once and pass to all functions that need it
  const trackerData = readTrackerData_();
  const stationMap = getVolunteerStationMap_();
  return {
    activeReturns: getActiveReturns(stationMap),
    idleFilers: getIdleFilers(trackerData, stationMap),
    returnSummary: filterDate
      ? getReturnSummary(trackerData, filterDate)
      : getReturnSummaryCached(trackerData),
    performanceMetrics: getVolunteerPerformanceMetrics(trackerData, filterDate),
    reviewerLeaderboard: getReviewerLeaderboard(trackerData, filterDate),
    concurrentTimeSeries: getConcurrentReturnTimeSeries(trackerData, filterDate, stationMap),
    clinicDays: ELIGIBILITY_CONFIG.CLINIC_DATES,
    clientFeatureBreakdown: getClientFeatureBreakdown(trackerData)
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
 * Gets concurrent active returns time-series for the target day.
 * Builds a step-function showing how many returns are in progress at each point in time.
 * Each client can have multiple tracker rows (one per tax year). Married rows count as 2.
 * @param {Object} trackerData - Pre-read tracker data from readTrackerData_()
 * @param {Date|null} filterDate - Optional date to filter; null = actual today
 * @returns {Object} { timeSeries: [{time: "HH:MM", count}], currentActive: number }
 */
function getConcurrentReturnTimeSeries(trackerData, filterDate, stationMap_) {
  return safeExecute(() => {
    const targetDay = filterDate ? new Date(filterDate) : new Date();
    targetDay.setHours(0, 0, 0, 0);

    function sameDay(ts) {
      return ts instanceof Date &&
        ts.getFullYear() === targetDay.getFullYear() &&
        ts.getMonth() === targetDay.getMonth() &&
        ts.getDate() === targetDay.getDate();
    }

    function fmtTime(d) {
      return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    // 1. Read Client Assignment for the target day
    const caSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    const caLastRow = caSheet.getLastRow();
    const stationMap = stationMap_ || getVolunteerStationMap_();
    // clientId → { assignTimestamp, volunteer, isCompleted }
    const clientMap = {};

    if (caLastRow > 1) {
      const caData = caSheet.getRange(2, 1, caLastRow - 1, 4).getValues();
      for (var i = 0; i < caData.length; i++) {
        var ts = caData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.TIMESTAMP];
        var clientId = (caData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.CLIENT_ID] || '').toString().trim();
        var volunteer = (caData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.VOLUNTEER] || '').toString().trim();
        var completed = (caData[i][CONFIG.COLUMNS.CLIENT_ASSIGNMENT.COMPLETED] || '').toString().trim();

        if (!clientId || !volunteer || !sameDay(ts)) continue;

        // Quiz station filter (same logic as getActiveReturns)
        var baseName = volunteer.indexOf('–') !== -1 ? volunteer.split('–')[1].trim() : volunteer.trim();
        var stationFromPrefix = volunteer.indexOf('–') !== -1
          ? volunteer.split('–')[0].replace(/station/i, '').trim().toLowerCase()
          : '';
        if (stationFromPrefix === 'quiz' || (stationMap[baseName] || '').toLowerCase() === 'quiz') continue;

        // Keep latest assignment per clientId (handles reassignments)
        if (!clientMap[clientId] || ts > clientMap[clientId].assignTimestamp) {
          clientMap[clientId] = {
            assignTimestamp: ts,
            volunteer: volunteer,
            isCompleted: completed !== ''
          };
        }
      }
    }

    // 2. Collect tracker rows per clientId for the target day
    // trackerRows[clientId] = [{ timestamp, weight }]
    var trackerRows = {};
    var data = (trackerData && trackerData.data) ? trackerData.data : [];
    for (var j = 0; j < data.length; j++) {
      var tTs = data[j][CONFIG.COLUMNS.TAX_RETURN_TRACKER.TIMESTAMP];
      var tClientId = (data[j][CONFIG.COLUMNS.TAX_RETURN_TRACKER.CLIENT_ID] || '').toString().trim();
      var efile = (data[j][CONFIG.COLUMNS.TAX_RETURN_TRACKER.EFILE] || '').toString().toLowerCase() === 'yes';
      var paper = (data[j][CONFIG.COLUMNS.TAX_RETURN_TRACKER.PAPER] || '').toString().toLowerCase() === 'yes';
      var married = (data[j][CONFIG.COLUMNS.TAX_RETURN_TRACKER.MARRIED] || '').toString().toLowerCase() === 'yes';

      if (!tClientId || !sameDay(tTs) || !(efile || paper)) continue;
      if (!trackerRows[tClientId]) trackerRows[tClientId] = [];
      trackerRows[tClientId].push({ timestamp: tTs, weight: married ? 2 : 1 });
    }

    // 3. Build events for each clientId (count clients, not returns)
    var events = [];
    for (var cid in clientMap) {
      var info = clientMap[cid];
      var rows = trackerRows[cid] || [];

      // +1 per client when assigned (count clients, not returns)
      events.push({ time: info.assignTimestamp, delta: 1 });

      // -1 when client is done
      if (info.isCompleted) {
        if (rows.length > 0) {
          // Find the latest tracker timestamp for this client
          var latestTs = rows[0].timestamp;
          for (var k = 1; k < rows.length; k++) {
            if (rows[k].timestamp > latestTs) latestTs = rows[k].timestamp;
          }
          events.push({ time: latestTs, delta: -1 });
        } else {
          // Completed but no tracker rows (no return filed) — cancel the +1
          events.push({ time: info.assignTimestamp, delta: -1 });
        }
      }
    }

    // 4. Sort by time, walk through to build time-series
    events.sort(function(a, b) { return a.time.getTime() - b.time.getTime(); });

    var timeSeries = [];
    var running = 0;
    for (var e = 0; e < events.length; e++) {
      running += events[e].delta;
      if (running < 0) running = 0; // safety clamp
      timeSeries.push({ time: fmtTime(events[e].time), count: running });
    }

    // currentActive: count clients whose most recent assignment today is not yet completed.
    // Derived from clientMap directly rather than from `running` (which can overcount when
    // completed assignments have no tracker rows, e.g. after volunteer sign-out cleanup).
    var currentActive = Object.keys(clientMap).filter(function(cid) {
      return !clientMap[cid].isCompleted;
    }).length;
    return { timeSeries: timeSeries, currentActive: currentActive };
  }, 'getConcurrentReturnTimeSeries');
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

/**
 * Gets breakdown of completed clients by feature (all-time).
 * Counts unique clients, not individual returns.
 * @param {Object} trackerData - Pre-read tracker data from readTrackerData_()
 * @returns {Object} { total, features: [{ label, count }] }
 */
function getClientFeatureBreakdown(trackerData) {
  return safeExecute(() => {
    const data = (trackerData && trackerData.data) ? trackerData.data : [];
    const cols = CONFIG.COLUMNS.TAX_RETURN_TRACKER;

    // Collect unique completed client IDs, latest tracker timestamp, and return counts
    const completedClientIds = new Set();
    const clientCompletionTime = new Map(); // clientId → latest tracker timestamp
    const clientReturnCount = new Map(); // clientId → number of completed returns (married = 2)
    for (let i = 0; i < data.length; i++) {
      const efile = data[i][cols.EFILE]?.toString().toLowerCase() === 'yes';
      const paper = data[i][cols.PAPER]?.toString().toLowerCase() === 'yes';
      if (efile || paper) {
        const clientId = data[i][cols.CLIENT_ID]?.toString().trim();
        if (clientId) {
          completedClientIds.add(clientId);
          const married = data[i][cols.MARRIED]?.toString().toLowerCase() === 'yes';
          const returnIncrement = married ? 2 : 1;
          clientReturnCount.set(clientId, (clientReturnCount.get(clientId) || 0) + returnIncrement);
          const ts = data[i][cols.TIMESTAMP];
          if (ts instanceof Date) {
            const prev = clientCompletionTime.get(clientId);
            if (!prev || ts.getTime() > prev.getTime()) {
              clientCompletionTime.set(clientId, ts);
            }
          }
        }
      }
    }

    if (completedClientIds.size === 0) {
      return { total: 0, avgMinutes: null, features: [] };
    }

    // Bulk-read Client Assignment sheet for start timestamps
    const assignSheet = getSheet(CONFIG.SHEETS.CLIENT_ASSIGNMENT);
    const assignLastRow = assignSheet.getLastRow();
    const assignCols = CONFIG.COLUMNS.CLIENT_ASSIGNMENT;
    const clientAssignTime = new Map(); // clientId → earliest assign timestamp
    if (assignLastRow > 1) {
      const assignData = assignSheet.getRange(2, 1, assignLastRow - 1, assignCols.VOLUNTEER + 1).getValues();
      for (let i = 0; i < assignData.length; i++) {
        const clientId = assignData[i][assignCols.CLIENT_ID]?.toString().trim();
        if (clientId && completedClientIds.has(clientId)) {
          const ts = assignData[i][assignCols.TIMESTAMP];
          if (ts instanceof Date) {
            const prev = clientAssignTime.get(clientId);
            if (!prev || ts.getTime() < prev.getTime()) {
              clientAssignTime.set(clientId, ts);
            }
          }
        }
      }
    }

    // Bulk-read Client Intake sheet
    const intakeSheet = getSheet(CONFIG.SHEETS.CLIENT_INTAKE);
    const intakeLastRow = intakeSheet.getLastRow();
    if (intakeLastRow <= 1) return { total: 0, avgMinutes: null, features: [] };

    const intakeCols = CONFIG.COLUMNS.CLIENT_INTAKE;
    const intakeData = intakeSheet.getRange(2, 1, intakeLastRow - 1, intakeCols.NEEDS_SENIOR_REVIEW + 1).getValues();

    // Build lookup: clientId -> { situations, needsSeniorReview, filingYears, completionMinutes }
    // Scan backwards so most-recent record wins for duplicate client IDs
    const clientMap = new Map();
    for (let i = intakeData.length - 1; i >= 0; i--) {
      const clientId = intakeData[i][intakeCols.CLIENT_ID]?.toString().trim();
      if (clientId && completedClientIds.has(clientId) && !clientMap.has(clientId)) {
        const filingYearsStr = intakeData[i][intakeCols.FILING_YEARS]?.toString() || '';
        const filingYears = filingYearsStr.split(',').map(y => y.trim()).filter(y => y);

        // Calculate completion time in minutes, normalized per return
        let completionMinutes = null;
        const assignTs = clientAssignTime.get(clientId);
        const completeTs = clientCompletionTime.get(clientId);
        if (assignTs && completeTs) {
          const diffMs = completeTs.getTime() - assignTs.getTime();
          if (diffMs > 0) {
            const totalMinutes = diffMs / 60000;
            const returnCount = clientReturnCount.get(clientId) || 1;
            completionMinutes = Math.round(totalMinutes / returnCount);
          }
        }

        clientMap.set(clientId, {
          situations: intakeData[i][intakeCols.SITUATIONS]?.toString() || '',
          needsSeniorReview: intakeData[i][intakeCols.NEEDS_SENIOR_REVIEW] === true ||
            intakeData[i][intakeCols.NEEDS_SENIOR_REVIEW]?.toString().toLowerCase() === 'true',
          filingYears: filingYears,
          completionMinutes: completionMinutes
        });
      }
    }

    // Count features and track per-feature completion times
    const featureLabels = ['Student', 'International Student', 'Married/Common-Law', 'Employed', 'First-Time Filer'];
    const allFeatureLabels = [...featureLabels, 'Senior Review', 'Multi-Year'];
    const counts = {};
    const timeSums = {};
    const timeCounts = {};
    allFeatureLabels.forEach(f => { counts[f] = 0; timeSums[f] = 0; timeCounts[f] = 0; });

    let totalTimeSum = 0;
    let totalTimeCount = 0;
    const clientFeatureData = []; // for baseline calculation

    for (const [, info] of clientMap) {
      const situations = info.situations.split(',').map(s => s.trim()).filter(s => s);
      const hasTime = info.completionMinutes !== null;

      if (hasTime) {
        totalTimeSum += info.completionMinutes;
        totalTimeCount++;
      }

      // Track which features this client matches
      const matchedFeatures = [];

      for (const label of featureLabels) {
        if (situations.includes(label)) {
          counts[label]++;
          matchedFeatures.push(label);
        }
      }
      if (info.needsSeniorReview) {
        counts['Senior Review']++;
        matchedFeatures.push('Senior Review');
      }
      if (info.filingYears.length > 1) {
        counts['Multi-Year']++;
        matchedFeatures.push('Multi-Year');
      }

      // Accumulate time for matched features
      if (hasTime) {
        for (const label of matchedFeatures) {
          timeSums[label] += info.completionMinutes;
          timeCounts[label]++;
        }
      }

      clientFeatureData.push({ matchedFeatures: matchedFeatures, completionMinutes: info.completionMinutes });
    }

    // Compute Student-only baseline: avg normalized time for clients whose only feature is Student
    let baselineSum = 0, baselineCount = 0;
    for (const entry of clientFeatureData) {
      if (entry.matchedFeatures.length === 1 && entry.matchedFeatures[0] === 'Student' && entry.completionMinutes !== null) {
        baselineSum += entry.completionMinutes;
        baselineCount++;
      }
    }
    const baselineAvg = baselineCount > 0 ? Math.round(baselineSum / baselineCount) : null;

    const features = allFeatureLabels.map(label => {
      const avgMinutes = timeCounts[label] > 0 ? Math.round(timeSums[label] / timeCounts[label]) : null;
      let deltaMinutes = null;
      if (label !== 'Student' && avgMinutes !== null && baselineAvg !== null) {
        deltaMinutes = avgMinutes - baselineAvg;
      }
      // For Student, show the Student-only baseline as the avg so deltas align visually
      const displayAvg = (label === 'Student' && baselineAvg !== null) ? baselineAvg : avgMinutes;
      return { label: label, count: counts[label], avgMinutes: displayAvg, deltaMinutes: deltaMinutes };
    });

    const overallAvg = totalTimeCount > 0 ? Math.round(totalTimeSum / totalTimeCount) : null;

    return { total: clientMap.size, avgMinutes: overallAvg, baselineAvg: baselineAvg, features: features };
  }, 'getClientFeatureBreakdown');
}
