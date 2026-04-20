/**
 * CATBUS Configuration
 * Centralized configuration for all CATBUS scripts
 */

// Folder ID for filer application resume uploads (defined in Secrets.gs)
const RESUME_FOLDER_ID = SECRETS.RESUME_FOLDER_ID;

// Folder ID for quiz submission file uploads (defined in Secrets.gs)
const QUIZ_FOLDER_ID = SECRETS.QUIZ_FOLDER_ID;

const CONFIG = {
  SPREADSHEET_ID: SECRETS.SPREADSHEET_ID,

  // Sheet Names
  SHEETS: {
    CLIENT_INTAKE: 'Client Intake',
    CLIENT_ASSIGNMENT: 'Client Assignment',
    HELP_REQUESTS: 'Help Requests',
    REVIEW_REQUESTS: 'Review Requests',
    TAX_RETURN_TRACKER: 'Tax Return Tracker',
    VOLUNTEER_LIST: 'Volunteer List',
    SIGNOUT: 'SignOut',
    CONSOLIDATED_VOLUNTEER_LIST: 'Consolidated Volunteer List', // Master volunteer roster
    SCHEDULE_AVAILABILITY: 'Schedule Availability', // Form responses for volunteer availability
    SCHEDULE_OUTPUT: 'Shift Schedule', // Generated schedule
    PRODUCT_CODES: 'UFILE Keys', // Product codes for distribution
    PRODUCT_CODE_DISTRIBUTION_LOG: 'Product Code Distribution Log', // Distribution tracking
    VOLUNTEER_TAGS: 'Volunteer Tags', // Custom display tags for volunteers
    MESSAGES: 'Messages', // Internal messaging between managers and volunteers
    TRAINING_LOG: 'Training Log', // Training session log (T-prefix clients)
    QUIZ_SUBMISSIONS: 'Quiz Submissions', // Quiz session submissions
    VOLUNTEER_ALUMNI: 'Volunteer Alumni', // Permanent alumni roster (survives rollforward)
    ACTION_ITEMS: 'Action Items',          // Coordinator to-do list and task tracking
    COORDINATORS: 'Coordinators',          // Coordinator contact list for reminders
    VOLUNTEER_ONBOARDING: 'Volunteer Onboarding Checklist', // Volunteer onboarding checklist progress
  },

  // Clinic contact info (used in emails and public pages)
  CLINIC_EMAIL: SECRETS.CLINIC_EMAIL,
  CLINIC_WEBSITE_URL: SECRETS.CLINIC_WEBSITE_URL,
  
  // Column Mappings (0-indexed)
  COLUMNS: {
    CONSOLIDATED_VOLUNTEER_LIST: {
      ROLE: 0,
      EMAIL: 1,
      FIRST_NAME_LEGAL: 2,
      PREFERRED_NAME: 3,
      LAST_NAME: 4,
      EFILE_NUM: 5,
      PASSWORD: 6,
      ATTENDED_TRAINING: 7
    },
    VOLUNTEER_ALUMNI: {
      EMAIL: 0,
      FIRST_NAME_LEGAL: 1,
      PREFERRED_NAME: 2,
      LAST_NAME: 3,
      TOTAL_RETURNS: 4,
      TOTAL_HOURS: 5,
      BLACKLISTED: 6,
      BLACKLIST_REASON: 7,
      LAST_UPDATED: 8
      // Columns 9+ are dynamic year pairs: {YEAR}_RETURNS, {YEAR}_HOURS
      // Column positions derived at runtime by scanning the header row
    },
    CLIENT_INTAKE: {
      TIMESTAMP: 0,
      HOUSEHOLD_SIZE: 1,
      FILING_YEARS: 2,
      SITUATIONS: 3,
      NOTES: 4,
      CLIENT_ID: 5,
      NEEDS_SENIOR_REVIEW: 6,
      IS_HIGH_PRIORITY: 7,
      DOCUMENTS: 8,
      SENIOR_YEARS: 9
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
      STATUS: 2,
      CLIENT_ID: 3,
      TAX_YEAR: 4,
      REVIEWER_OR_REASON: 5
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
      INCOMPLETE: 9,
      STATUS: 10
    },
    VOLUNTEER_LIST: {
      TIMESTAMP: 0,
      NAME: 1,
      STATION: 2,
      SESSION_ID: 3,
      ON_BREAK: 4
    },
    SIGNOUT: {
      TIMESTAMP: 0,
      VOLUNTEER_INFO: 1,
      SESSION_ID: 2,
      DURATION: 3
    },
    TRAINING_LOG: {
      TIMESTAMP: 0,
      VOLUNTEER: 1,
      CLIENT_ID: 2,
      STATUS: 3
    },
    QUIZ_SUBMISSIONS: {
      TIMESTAMP: 0,
      VOLUNTEER: 1,
      PARTNER: 2,
      EMAIL_1: 3,
      EMAIL_2: 4,
      STATUS: 5,
      REFUND: 6,
      ONBEN: 7,
      GST: 8,
      NOTES: 9,
      FILE_URLS: 10
    },
    VOLUNTEER_ONBOARDING: {
      EMAIL: 0,
      VOLUNTEER_NAME: 1,
      ROLE: 2,
      TASK_KEY: 3,
      TASK_LABEL: 4,
      TASK_DESCRIPTION: 5,
      IS_COMPLETE: 6,
      COMPLETED_AT: 7,
      UPDATED_AT: 8
    }
  },
  
  SIGN_IN_OUT: {
    STATION_COUNT: 50,
    EXCEPTION_STATIONS: ['Mentor', 'Senior Mentor', 'Frontline', 'Internal Services', 'Quiz', 'Training'],
    NON_FILER_STATIONS: ['mentor', 'senior mentor', 'frontline', 'internal services', 'training', 'quiz']
  },
  
  // Help Request Status Values
  HELP_STATUS: {
    ACTIVE: 'Active',
    ESCALATED: 'Escalated',
    IN_PROGRESS: 'In Progress', // helper claimed from alert dashboard
    CLEARED: 'Cleared'
  },
  
  // Tax Return Tracker Status Values
  TRACKER_STATUS: {
    EMAILED: 'Emailed',
    FINALIZED: 'Finalized',
    INCOMPLETE: 'Incomplete'
  },

  // Review Request Status Values
  REVIEW_STATUS: {
    REQUESTED: 'Requested',
    IN_PROGRESS: 'In Progress', // reviewer claimed from alert dashboard
    APPROVED: 'Approved',    // reviewer approved remotely
    RETURNED: 'Returned',    // reviewer returned for corrections remotely
    COMPLETED: 'Completed',  // control sheet consumed the approval/return result
    CANCELLED: 'Cancelled'   // local cancel from control sheet
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
  },

  // Public website status polling and queue transparency settings
  PUBLIC_STATUS: {
    CACHE_TTL_SECONDS: 45,
    QUEUE_BANDS: {
      LOW_MAX: 5,
      MEDIUM_MAX: 12
    },
    VOLUNTEER_BANDS: {
      LOW_MAX: 2,
      MEDIUM_MAX: 6
    }
  }
};

/**
 * Get the main spreadsheet
 * @returns {Spreadsheet} The spreadsheet object
 */
var _cachedSpreadsheet = null;
function getSpreadsheet() {
  if (!_cachedSpreadsheet) {
    _cachedSpreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return _cachedSpreadsheet;
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
 * Centralized values for the pre-screening questionnaire.
 * Exposed to the public appointment_screening.html page via the
 * ?action=getEligibilityConfig endpoint in Router.gs.
 */
const ELIGIBILITY_CONFIG = {
  // Income thresholds for non-tuition filers
  INCOME_LIMITS: {
    INDIVIDUAL: 40000,
    COUPLE: 55000,
    PER_DEPENDANT: 5000
  },

  // Appointment booking Google Form URL
  BOOKING_FORM_URL: SECRETS.BOOKING_FORM_URL,

  // Clinic dates (must match SCHEDULE_CONFIG.DEFAULT_DAY_LABELS)
  CLINIC_DATES: [
    'Saturday, March 21, 2026',
    'Sunday, March 22, 2026',
    'Saturday, March 28, 2026',
    'Sunday, March 29, 2026'
  ],

  // Clinic operating hours for walk-ins
  CLINIC_HOURS: '10:00 AM - 7:30 PM',

  // Clinic location fallback (used if date not found in DATE_LOCATIONS)
  CLINIC_LOCATION: 'TBD',

  // Per-date location mapping for appointment confirmation emails
  DATE_LOCATIONS: {
    'Saturday, March 21, 2026': { room: 'STC 1012', mapsUrl: 'https://maps.app.goo.gl/BfzfkUicXcDb6QNS8' },
    'Sunday, March 22, 2026':   { room: 'STC 1012', mapsUrl: 'https://maps.app.goo.gl/BfzfkUicXcDb6QNS8' },
    'Saturday, March 28, 2026': { room: 'RCH 301',  mapsUrl: 'https://maps.app.goo.gl/Z6pM2eRKRk65TpsQ9' },
    'Sunday, March 29, 2026':   { room: 'STC 1012', mapsUrl: 'https://maps.app.goo.gl/BfzfkUicXcDb6QNS8' }
  },

  // Complexity thresholds
  COMPLEXITY: {
    MAX_SIMPLE_TAX_YEARS: 2  // 3+ years = complex case
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

  // Algorithm constraints
  FILER_HARD_CAP: 50,       // Max filers per shift
  FILER_MIN_SHIFTS: 3,      // Minimum shifts each filer gets
  FRONTLINE_MIN_SHIFTS: 3,  // Minimum shifts each frontline volunteer gets
  ROLE_MIN_PER_SHIFT: 1,    // Minimum volunteers of each role per shift

  // Time slot definitions (for display only - backend only uses A/B/C)
  TIME_SLOTS: {
    'A': { start: '9:45', end: '1:15', display: '9:45 AM - 1:15 PM', label: 'Morning' },
    'B': { start: '1:00', end: '4:30', display: '1:00 PM - 4:30 PM', label: 'Afternoon' },
    'C': { start: '4:15', end: '8:00', display: '4:15 PM - 8:00 PM', label: 'Evening' }
  },

  // Default day labels (can be overridden in schedule generation)
  DEFAULT_DAY_LABELS: [
    'Saturday March 21 2026',
    'Sunday March 22 2026',
    'Saturday March 28 2026',
    'Sunday March 29 2026'
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

// Apply any clinic date overrides saved via the Archive & Rollforward page.
// If a 'CLINIC_DATES_OVERRIDE' Script Property exists, it replaces the hardcoded
// ELIGIBILITY_CONFIG clinic dates/locations and SCHEDULE_CONFIG day labels.
(function applyClinicDatesOverride_() {
  try {
    var cache = CacheService.getScriptCache();
    var raw = cache.get('CLINIC_DATES_OVERRIDE');
    if (raw === null) {
      raw = PropertiesService.getScriptProperties().getProperty('CLINIC_DATES_OVERRIDE');
      cache.put('CLINIC_DATES_OVERRIDE', raw || '', 600); // 10-min TTL
    }
    if (!raw) return;
    var entries = JSON.parse(raw); // [{date, room, mapsUrl}]
    if (!Array.isArray(entries) || entries.length !== 4) return;

    // Override ELIGIBILITY_CONFIG
    ELIGIBILITY_CONFIG.CLINIC_DATES = entries.map(function(e) { return e.date; });
    var newLocations = {};
    entries.forEach(function(e) {
      newLocations[e.date] = { room: e.room, mapsUrl: e.mapsUrl || '' };
    });
    ELIGIBILITY_CONFIG.DATE_LOCATIONS = newLocations;

    // Override SCHEDULE_CONFIG — derive no-comma label from date string
    SCHEDULE_CONFIG.DEFAULT_DAY_LABELS = entries.map(function(e) {
      return e.date.replace(/,/g, '');
    });
  } catch (err) {
    Logger.log('applyClinicDatesOverride_: ' + err.message);
  }
})();

/**
 * Product Code Distribution Configuration
 * Settings for distributing product codes to volunteers via email
 */
const PRODUCT_CODE_CONFIG = {
  // Product codes sheet (in main CATBUS spreadsheet)
  SHEET_NAME: 'UFILE Keys',

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
 * Volunteer application workflow messaging configuration.
 */
const VOLUNTEER_APPLICATION_WORKFLOW_CONFIG = {
  DECISION_EMAIL: {
    ACCEPT_SUBJECT: 'AFSA Tax Clinic Volunteer Application - Accepted',
    ACCEPT_BODY: [
      'Hi {{firstName}},',
      '',
      'Thank you for applying to the AFSA Tax Clinic as a {{role}} volunteer.',
      'We are happy to share that your application has been accepted.',
      '',
      'You will receive your onboarding instructions in a follow-up message once your profile is transferred to the active volunteer roster.',
      '',
      'If you have questions, please reply to this email.',
      '',
      'AFSA Tax Clinic Team'
    ].join('\n'),
    REJECT_SUBJECT: 'AFSA Tax Clinic Volunteer Application - Update',
    REJECT_BODY: [
      'Hi {{firstName}},',
      '',
      'Thank you for applying to the AFSA Tax Clinic as a {{role}} volunteer and for taking the time to complete the application.',
      'After review, we are not able to offer a position for this cycle.',
      '',
      'We appreciate your interest and hope you will consider applying again in a future term.',
      '',
      'AFSA Tax Clinic Team'
    ].join('\n')
  },
  HANDOFF_EMAIL: {
    SUBJECT: 'AFSA Tax Clinic Next Steps - Complete Your Volunteer Onboarding',
    BODY: [
      'Hi {{firstName}},',
      '',
      'Welcome to the AFSA Tax Clinic volunteer team. You are now on the consolidated volunteer roster as a {{role}} volunteer.',
      '',
      'Please complete the following steps:',
      '1) ASAP after acceptance (about 1 hour):',
      '   a) Register for the CRA CVITP program',
      '   b) Register for an EFILE number',
      '   c) File your own tax return if you have not done so before',
      '2) February 28: Attend the mandatory training session (8 hours)',
      '2.5) Week after training: Complete the case-based test (1 hour)',
      '3) March 21, 22, 28, 29: Volunteer at least 3 shifts across clinic dates',
      '',
      'If anything is unclear, contact us at {{clinicEmail}}.',
      '',
      'AFSA Tax Clinic Team'
    ].join('\n')
  }
};

/**
 * Returns schedule config data for frontend consumption
 * Eliminates need for hardcoded time slots and day labels in HTML files
 * @returns {Object} Schedule configuration for frontend
 */
function getScheduleConfig() {
  return {
    timeSlots: SCHEDULE_CONFIG.TIME_SLOTS,
    dayLabels: SCHEDULE_CONFIG.DEFAULT_DAY_LABELS,
    daysCount: SCHEDULE_CONFIG.DAYS_COUNT,
    slotsPerDay: SCHEDULE_CONFIG.SLOTS_PER_DAY
  };
}

/**
 * Returns the web app deployment URL for use by HtmlService-served pages.
 * Called via google.script.run from pages that can't load webpage/config.js.
 */
function getWebAppUrl() {
  return SECRETS.WEBAPP_URL;
}

/**
 * Custom Volunteer Tags
 * Fun display tags for specific volunteers (shown in schedule viewer only)
 * Map volunteer full name to their custom tag
 */
const VOLUNTEER_TAGS = {
  // Example: 'John Smith': 'The Tax Wizard',
  'Ben Ma': "Unpaid Tax Slave"
};

/**
 * Configuration for the Expense Tracker feature.
 */
const EXPENSE_CONFIG = {
  SHEET_NAME: 'Expenses',
  COLUMNS: {
    TIMESTAMP: 0,
    EXPENSE_DATE: 1,
    CATEGORY: 2,
    VENDOR: 3,
    DESCRIPTION: 4,
    AMOUNT: 5,
    RECEIPT_URL: 6,
    SUBMITTED_BY: 7
  },
  CATEGORIES: ['Office Supplies', 'Food & Refreshments', 'Printing / Photocopying', 'Transportation', 'Other']
};

/**
 * Configuration for the coordinator To-Do List feature.
 */
const ACTION_ITEM_CONFIG = {
  REMINDER_THRESHOLDS: [14, 7, 1],   // days before due date (calendar days)
  SHEET_NAME: 'Action Items',
  COORDINATORS_SHEET_NAME: 'Coordinators'
};

/**
 * Configuration for volunteer-facing onboarding checklist tasks.
 */
const VOLUNTEER_ONBOARDING_CONFIG = {
  SHEET_NAME: 'Volunteer Onboarding Checklist',
  TASKS: {
    EVERYONE: [
      {
        key: 'join_discord',
        label: 'Join the Tax Clinic Discord',
         description: 'Join the clinic Discord server to receive announcements and team updates.',
         selfComplete: true
       },
       {
         key: 'sign_up_cvitp',
         label: 'Sign up for CVITP',
         description: 'Register for the CRA Community Volunteer Income Tax Program (CVITP).',
         selfComplete: true
       }
     ],
     EFILE_REQUIRED_ROLES: ['filer', 'mentor', 'senior mentor'],
     EFILE_TASK: {
       key: 'register_efile',
       label: 'Register for an EFILE number',
       description: 'Complete EFILE registration so you can submit tax returns during clinic shifts.',
       selfComplete: true
     },
     FILER_ONLY: [
       {
         key: 'attend_training',
         label: 'Attend mandatory training',
         description: 'Attend the required training session by signing in at the Training station.',
         selfComplete: false
       },
       {
         key: 'pass_quiz',
         label: 'Pass the post-training quiz',
         description: 'This task is automatically completed when you pass the quiz.',
         selfComplete: false
       }
     ]
   }
};
