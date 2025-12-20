/**
 * CATBUS Configuration
 * Centralized configuration for all CATBUS scripts
 */

const CONFIG = {
  // Spreadsheet ID - Update this if you need to change spreadsheets
  SPREADSHEET_ID: '1W669LwuA8IpB03BlmhwnUkkupMZW2Cg0I_6cvSp0pwI',

  // External Spreadsheet for Volunteer Data
  EXTERNAL_SPREADSHEETS: {
    CONSOLIDATED_VOLUNTEERS: {
      ID: '1HvJ3HFwcQySPaRMk0_5XIDo7qcjnhiah4DEM23Dknqg',
      SHEET_NAME: 'Consolidated List',
      COLUMNS: {
        ROLE: 0,        // Column A - Role (e.g., "Mentor")
        NAME: 7         // Column H - Volunteer names
      }
    }
  },

  // Sheet Names
  SHEETS: {
    CLIENT_INTAKE: 'Client Intake',
    CLIENT_ASSIGNMENT: 'Client Assignment',
    HELP_REQUESTS: 'Help Requests',
    REVIEW_REQUESTS: 'Review Requests',
    TAX_RETURN_TRACKER: 'Tax Return Tracker',
    VOLUNTEER_LIST: 'Volunteer List',
    SIGNOUT: 'SignOut',
    SCHEDULE_AVAILABILITY: 'Schedule Availability', // Form responses for volunteer availability
    SCHEDULE_OUTPUT: 'Schedule Output' // Generated schedule
  },
  
  // Column Mappings (0-indexed)
  COLUMNS: {
    CLIENT_INTAKE: {
      TIMESTAMP: 0,
      HOUSEHOLD_SIZE: 1,
      FILING_YEARS: 2,
      SITUATIONS: 3,
      NOTES: 4,
      CLIENT_ID: 5,
      NEEDS_SENIOR_REVIEW: 6,
      IS_HIGH_PRIORITY: 7
    },
    CLIENT_ASSIGNMENT: {
      TIMESTAMP: 0,
      CLIENT_ID: 1,
      VOLUNTEER: 2,
      COMPLETED: 3
    },
    HELP_REQUESTS: {
      TIMESTAMP: 0,
      VOLUNTEER: 1,
      STATUS: 2
    },
    REVIEW_REQUESTS: {
      TIMESTAMP: 0,
      VOLUNTEER: 1,
      STATUS: 2
    },
    TAX_RETURN_TRACKER: {
      TIMESTAMP: 0,
      VOLUNTEER: 1,
      CLIENT_ID: 2,
      TAX_YEAR: 3,
      REVIEWER: 4,
      SECONDARY_REVIEWER: 5,
      MARRIED: 6,
      EFILE: 7,
      PAPER: 8,
      INCOMPLETE: 9
    },
    VOLUNTEER_LIST: {
      TIMESTAMP: 0,
      NAME: 1,
      STATION: 2,
      SESSION_ID: 3
    },
    SIGNOUT: {
      TIMESTAMP: 0,
      VOLUNTEER_INFO: 1,
      SESSION_ID: 2
    }
  },
  
  // Sign-In/Out Configuration
  SIGN_IN_OUT: {
    STATION_COUNT: 150, // Number of stations (1-150)
    EXCEPTION_STATIONS: ['Mentor', 'Senior Mentor', 'Receptionist'] // Stations always available
  },
  
  // Help Request Status Values
  HELP_STATUS: {
    ACTIVE: 'Active',
    ESCALATED: 'Escalated',
    CLEARED: 'Cleared'
  },
  
  // Review Request Status Values
  REVIEW_STATUS: {
    REQUESTED: 'Requested',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
  },
  
  // Timezone
  TIMEZONE: 'America/New_York',
  
  // Performance Configuration
  PERFORMANCE: {
    // Number of recent rows to check for assignments/requests (most are recent)
    RECENT_ROWS_TO_CHECK: 500,
    // Number of recent help requests to check
    RECENT_HELP_REQUESTS_TO_CHECK: 200,
    // Number of recent review requests to check
    RECENT_REVIEW_REQUESTS_TO_CHECK: 200,
    // Cache TTL for mentor list (seconds)
    MENTOR_LIST_CACHE_TTL: 45,
    // Lock timeout for client ID generation (milliseconds)
    LOCK_TIMEOUT_MS: 10000,
    // Number of days of return data to read for summary (0 = all)
    RETURN_SUMMARY_DAYS: 0 // 0 means read all, set to number of days to limit
  }
};

/**
 * Get the main spreadsheet
 * @returns {Spreadsheet} The spreadsheet object
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Get a specific sheet by name
 * @param {string} sheetName - Name of the sheet
 * @returns {Sheet} The sheet object
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  return sheet;
}
