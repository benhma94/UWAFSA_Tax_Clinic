/**
 * Admin Dashboard Functions
 * Functions for the admin dashboard
 */

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

    // Optimization: Only read necessary columns (Timestamp, EFILE, PAPER)
    // Read all rows (or limit by PERFORMANCE.RETURN_SUMMARY_DAYS if configured)
    const numRows = lastRow - 1;
    const timestampCol = CONFIG.COLUMNS.TAX_RETURN_TRACKER.TIMESTAMP + 1;
    const efileCol = CONFIG.COLUMNS.TAX_RETURN_TRACKER.EFILE + 1;
    const paperCol = CONFIG.COLUMNS.TAX_RETURN_TRACKER.PAPER + 1;

    const data = sheet.getRange(2, timestampCol, numRows, 3).getValues();

    let totalCompleted = 0;
    let completedToday = 0;
    const hourlyCounts = {};

    for (let i = 0; i < data.length; i++) {
      const timestamp = data[i][0];
      const efile = data[i][1]?.toString().toLowerCase() === 'yes';
      const paper = data[i][2]?.toString().toLowerCase() === 'yes';

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
