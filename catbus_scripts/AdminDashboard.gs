/**
 * Admin Dashboard Functions
 * Functions for the admin dashboard
 */

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
