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
    SCHEDULE_OUTPUT: 'Schedule Output', // Generated schedule
    PRODUCT_CODES: 'Product Codes', // Product codes for distribution
    PRODUCT_CODE_DISTRIBUTION_LOG: 'Product Code Distribution Log', // Distribution tracking
    VOLUNTEER_TAGS: 'Volunteer Tags', // Custom display tags for volunteers
    MESSAGES: 'Messages' // Internal messaging between managers and volunteers
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
      IS_HIGH_PRIORITY: 7,
      DOCUMENTS: 8
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

/**
 * Appointment Booking Configuration
 * Settings for complex case appointment bookings via Google Form
 */
const APPOINTMENT_CONFIG = {
  // Sheet name for appointment bookings (form responses will be here)
  SHEET_NAME: 'Appointment Bookings',

  // Column mappings (0-indexed) - matches actual Google Form response columns
  // Form fields: Timestamp, Email, Preferred Date, Preferred Time, Situations, Client ID
  COLUMNS: {
    TIMESTAMP: 0,
    EMAIL: 1,
    PREFERRED_DATE: 2,
    PREFERRED_TIME: 3,
    SITUATIONS: 4,
    CLIENT_ID: 5,
    CONFIRMATION_SENT: 6
  },

  // Client ID settings
  CLIENT_ID_PREFIX: 'P', // Priority prefix
  CLIENT_ID_PAD_LENGTH: 3 // P001, P002, etc.
};

/**
 * Eligibility Configuration
 * Centralized values for the pre-screening questionnaire
 * NOTE: These values are mirrored in appointment_screening.html's CONFIG object.
 * When updating these values, also update the HTML file.
 */
const ELIGIBILITY_CONFIG = {
  // Income thresholds for non-tuition filers
  INCOME_LIMITS: {
    INDIVIDUAL: 40000,
    COUPLE: 50000,
    PER_DEPENDANT: 5000
  },

  // Appointment booking Google Form URL
  BOOKING_FORM_URL: 'https://forms.gle/yeHteMXsHYVBhdSF6',

  // Clinic dates (must match SCHEDULE_CONFIG.DEFAULT_DAY_LABELS)
  CLINIC_DATES: [
    'Saturday, March 21, 2026',
    'Sunday, March 22, 2026',
    'Saturday, March 28, 2026',
    'Sunday, March 29, 2026'
  ],

  // Clinic operating hours for walk-ins
  CLINIC_HOURS: '10:00 AM - 7:30 PM',

  // Clinic location (TBD until confirmed)
  CLINIC_LOCATION: 'TBD',

  // Complexity thresholds
  COMPLEXITY: {
    MAX_SIMPLE_TAX_YEARS: 4  // 5+ years = complex case
  }
};

/**
 * Schedule Configuration
 * Centralized source of truth for shift definitions and display mappings
 * This allows frontend to change time slots and day labels without touching backend code
 */
const SCHEDULE_CONFIG = {
  // Shift structure
  DAYS_COUNT: 4,
  SLOTS_PER_DAY: 3,

  // Time slot definitions (for display only - backend only uses A/B/C)
  TIME_SLOTS: {
    'A': { start: '9:45', end: '1:15', display: '9:45 AM - 1:15 PM', label: 'Morning' },
    'B': { start: '1:00', end: '4:30', display: '1:00 PM - 4:30 PM', label: 'Afternoon' },
    'C': { start: '4:15', end: '8:00', display: '4:15 PM - 8:00 PM', label: 'Evening' }
  },

  // Default day labels (can be overridden in schedule generation)
  DEFAULT_DAY_LABELS: [
    'Saturday March 21, 2026',
    'Sunday March 22, 2026',
    'Saturday March 28, 2026',
    'Sunday March 29, 2026'
  ],

  // Shift ID to metadata mapping
  SHIFTS: {
    'D1A': { dayIndex: 0, slotIndex: 0, slotKey: 'A' },
    'D1B': { dayIndex: 0, slotIndex: 1, slotKey: 'B' },
    'D1C': { dayIndex: 0, slotIndex: 2, slotKey: 'C' },
    'D2A': { dayIndex: 1, slotIndex: 0, slotKey: 'A' },
    'D2B': { dayIndex: 1, slotIndex: 1, slotKey: 'B' },
    'D2C': { dayIndex: 1, slotIndex: 2, slotKey: 'C' },
    'D3A': { dayIndex: 2, slotIndex: 0, slotKey: 'A' },
    'D3B': { dayIndex: 2, slotIndex: 1, slotKey: 'B' },
    'D3C': { dayIndex: 2, slotIndex: 2, slotKey: 'C' },
    'D4A': { dayIndex: 3, slotIndex: 0, slotKey: 'A' },
    'D4B': { dayIndex: 3, slotIndex: 1, slotKey: 'B' },
    'D4C': { dayIndex: 3, slotIndex: 2, slotKey: 'C' }
  },

  /**
   * Get display label for a shift ID
   * @param {string} shiftId - Shift ID like "D1A"
   * @param {string[]} dayLabels - Optional custom day labels
   * @returns {Object} {day: "Saturday March 21", time: "9:45-1:15", full: "Saturday March 21 9:45-1:15"}
   */
  getShiftLabel: function(shiftId, dayLabels) {
    const shift = this.SHIFTS[shiftId];
    if (!shift) return null;

    const dayLabel = (dayLabels && dayLabels[shift.dayIndex]) || this.DEFAULT_DAY_LABELS[shift.dayIndex] || `Day ${shift.dayIndex + 1}`;
    const timeSlot = this.TIME_SLOTS[shift.slotKey];

    return {
      day: dayLabel,
      time: timeSlot ? timeSlot.display : '',
      full: `${dayLabel} ${timeSlot ? timeSlot.display : ''}`
    };
  },

  /**
   * Get shift ID from day index and slot key
   * @param {number} dayIndex - Day index (0-3)
   * @param {string} slotKey - Slot key ('A', 'B', or 'C')
   * @returns {string} Shift ID like "D1A"
   */
  getShiftId: function(dayIndex, slotKey) {
    return `D${dayIndex + 1}${slotKey}`;
  },

  /**
   * Get all shift IDs for a given day index
   * @param {number} dayIndex - Day index (0-3)
   * @returns {string[]} Array of shift IDs like ["D1A", "D1B", "D1C"]
   */
  getShiftsForDay: function(dayIndex) {
    return Object.keys(this.SHIFTS).filter(id => this.SHIFTS[id].dayIndex === dayIndex);
  },

  /**
   * Get all valid shift IDs
   * @returns {string[]} Array of all shift IDs
   */
  getAllShiftIds: function() {
    return Object.keys(this.SHIFTS);
  },

  /**
   * Validate a shift ID
   * @param {string} shiftId - Shift ID to validate
   * @returns {boolean} True if valid
   */
  isValidShiftId: function(shiftId) {
    return this.SHIFTS.hasOwnProperty(shiftId);
  }
};

/**
 * Product Code Distribution Configuration
 * Settings for distributing product codes to volunteers via email
 */
const PRODUCT_CODE_CONFIG = {
  // Product codes sheet (in main CATBUS spreadsheet)
  SHEET_NAME: 'Product Codes',

  // Column mappings (0-indexed)
  COLUMNS: {
    YEAR: 0,           // Column A: Year (e.g., 2026)
    KEY: 1,            // Column B: Product code/key
    TIMES_USED: 2      // Column C: Number of times used
  },

  // Distribution tracking sheet
  DISTRIBUTION_LOG_SHEET: 'Product Code Distribution Log',

  // Email settings
  EMAIL_SUBJECT: 'Your Tax Clinic Product Code'
};

/**
 * Internal Messaging Configuration
 * Settings for manager-volunteer messaging system
 */
const MESSAGING_CONFIG = {
  // Sheet name for messages
  SHEET_NAME: 'Messages',

  // Column mappings (0-indexed)
  COLUMNS: {
    TIMESTAMP: 0,
    FROM_NAME: 1,
    FROM_ROLE: 2,
    TO_NAME: 3,
    TO_SESSION_ID: 4,
    MESSAGE: 5,
    MESSAGE_TYPE: 6,
    CONVERSATION_ID: 7,
    STATUS: 8,
    READ_AT: 9
  },

  // Polling interval for checking new messages (milliseconds)
  POLL_INTERVAL_MS: 10000, // 10 seconds

  // Maximum messages to return in queries
  MAX_MESSAGES_TO_SHOW: 50,

  // Auto-archive messages older than this many days
  MESSAGE_RETENTION_DAYS: 7
};

/**
 * Custom Volunteer Tags
 * Fun display tags for specific volunteers (shown in schedule viewer only)
 * Map volunteer full name to their custom tag
 */
const VOLUNTEER_TAGS = {
  // Example: 'John Smith': 'The Tax Wizard',
  'Ben Ma': "Unpaid Tax Slave"
};
