/**
 * Utility Functions
 * Shared utility functions for error handling, validation, etc.
 */

/**
 * Includes an HTML file's content for use with GAS templated HTML
 * Used in HTML files as: <?!= include('shared_scripts') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Loads an HTML template as a web app page.
 * @param {string} htmlFile - Template filename (no .html extension)
 * @param {string} title - Page title
 * @param {Object} [options]
 * @param {HtmlService.XFrameOptionsMode} [options.xframe] - Defaults to DEFAULT
 * @param {Object} [options.vars] - Template variables to set on the template object
 * @param {boolean} [options.sandbox] - If true, sets IFRAME sandbox mode
 * @returns {HtmlOutput}
 */
function loadPage(htmlFile, title, options) {
  const opts = options || {};
  const t = HtmlService.createTemplateFromFile(htmlFile);
  if (opts.vars) Object.assign(t, opts.vars);
  let out = t.evaluate()
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(opts.xframe !== undefined ? opts.xframe : HtmlService.XFrameOptionsMode.DEFAULT);
  if (opts.sandbox) out = out.setSandboxMode(HtmlService.SandboxMode.IFRAME);
  return out;
}

/**
 * Wraps a function in error handling with retry logic for rate limits
 * @param {Function} operation - The function to execute
 * @param {string} context - Context description for logging
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {*} The result of the operation
 */
function safeExecute(operation, context = 'Operation', maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return operation();
    } catch (error) {
      lastError = error;
      const errorMsg = error.message || error.toString();
      
      // Check if it's a rate limit, quota, or transient timeout error
      const isRateLimit = errorMsg.toLowerCase().includes('rate') ||
                         errorMsg.toLowerCase().includes('quota') ||
                         errorMsg.toLowerCase().includes('too many') ||
                         errorMsg.toLowerCase().includes('service invoked') ||
                         errorMsg.toLowerCase().includes('timed out');

      if (isRateLimit && attempt < maxRetries - 1) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        const delay = 500 * Math.pow(2, attempt);
        Logger.log(`${context} Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        Utilities.sleep(delay);
        continue;
      }
      
      // Not a rate limit error, or max retries reached
      Logger.log(`${context} Error: ${errorMsg}`);
      Logger.log(`Stack: ${error.stack}`);
      
      // Translate to user-friendly error
      throw translateError(error, context);
    }
  }
  
  // If we get here, all retries failed
  Logger.log(`${context} Failed after ${maxRetries} attempts`);
  throw translateError(lastError, context);
}

/**
 * Translates technical errors to user-friendly messages
 * @param {Error} error - The error object
 * @param {string} context - Context description
 * @returns {Error} User-friendly error
 */
function translateError(error, context = 'Operation') {
  const errorMsg = error.message || error.toString();
  const lowerMsg = errorMsg.toLowerCase();
  
  // Rate limit errors
  if (lowerMsg.includes('rate') || lowerMsg.includes('quota') || 
      lowerMsg.includes('too many') || lowerMsg.includes('service invoked')) {
    return new Error('The system is busy right now. Please try again in a moment.');
  }
  
  // Not found errors
  if (lowerMsg.includes('not found') || lowerMsg.includes('does not exist')) {
    if (lowerMsg.includes('client')) {
      return new Error('Client ID not found. Please check the ID and try again.');
    }
    return new Error('The requested information was not found. Please try again.');
  }
  
  // Already assigned/duplicate errors
  if (lowerMsg.includes('already assigned') || lowerMsg.includes('already exists')) {
    if (lowerMsg.includes('client')) {
      const match = errorMsg.match(/already assigned to (.+)/i);
      if (match) {
        return new Error(`This client has already been assigned to ${match[1]}.`);
      }
      return new Error('This client has already been assigned to another volunteer.');
    }
    return new Error('This item already exists. Please check and try again.');
  }
  
  // Validation errors
  if (lowerMsg.includes('invalid') || lowerMsg.includes('required')) {
    return new Error(errorMsg); // Keep validation messages as-is (they're usually clear)
  }
  
  // Lock timeout errors
  if (lowerMsg.includes('busy generating') || lowerMsg.includes('lock')) {
    return new Error('The system is busy processing another request. Please try again in a moment.');
  }

  // Quiz station — volunteer hasn't passed the quiz yet
  if (lowerMsg.includes('quiz station')) {
    return new Error('Volunteer has not yet passed the quiz, please direct them to a part of the room to complete the quiz');
  }

  // Already signed in (volunteer duplicate)
  if (lowerMsg.includes('already signed in')) {
    return new Error('This volunteer is already signed in. Please sign out first.');
  }

  // Station not available
  if (lowerMsg.includes('not available')) {
    return new Error('This station is not available. Please select another station.');
  }

  // Already signed out
  if (lowerMsg.includes('already signed out')) {
    return new Error('This volunteer has already been signed out.');
  }

  // Generic fallback - keep original message but make it more user-friendly
  if (errorMsg.startsWith(context)) {
    return error; // Already has context
  }
  
  return new Error(`${context} failed. Please try again. If the problem persists, contact support.`);
}

/**
 * Validates client ID format (e.g., A001, B123)
 * @param {string} clientID - Client ID to validate
 * @returns {boolean} True if valid format
 */
function validateClientID(clientID) {
  if (!clientID || typeof clientID !== 'string') {
    return false;
  }
  return /^[A-Z]\d{3}$/.test(clientID.trim());
}

/**
 * Validates tax year
 * @param {string|number} year - Tax year to validate
 * @returns {boolean} True if valid
 */
function validateTaxYear(year) {
  const currentYear = new Date().getFullYear();
  const yearNum = parseInt(year);
  return yearNum >= currentYear - 10 && yearNum <= currentYear;
}

/**
 * Gets available tax years (current year and previous 9 years)
 * @returns {Array<string>} Array of tax year strings
 */
function getAvailableTaxYears() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());
}

/**
 * Formats elapsed time in milliseconds to human-readable string
 * @param {number} milliseconds - Time in milliseconds
 * @returns {string} Formatted time (e.g., "2h 30m" or "45m")
 */
function formatElapsedTime(milliseconds) {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Parses wait time string to minutes
 * @param {string} waitStr - Wait time string (e.g., "2h 30m")
 * @returns {number} Total minutes
 */
function parseWaitTimeToMinutes(waitStr) {
  const parts = waitStr.split(' ');
  let total = 0;
  for (const part of parts) {
    if (part.endsWith('h')) {
      total += parseInt(part) * 60;
    }
    if (part.endsWith('m')) {
      total += parseInt(part);
    }
  }
  return total;
}

/**
 * Sanitizes string input by trimming and limiting length
 * @param {string} input - Input string to sanitize
 * @param {number} maxLength - Maximum length (default: 1000)
 * @returns {string} Sanitized string
 */
function sanitizeInput(input, maxLength = 1000) {
  if (input === null || input === undefined) {
    return '';
  }
  let str = String(input).trim();
  if (str.length > maxLength) str = str.substring(0, maxLength);
  // Prevent formula injection: prefix values that would execute as spreadsheet formulas
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  return str;
}

/**
 * Validates the admin password submitted from the frontend.
 * Called via google.script.run from _PasswordGate.html on admin pages.
 * @param {string} password - Password entered by the user
 * @returns {boolean} True if the password matches SECRETS.ADMIN_PASSWORD
 */
function checkAdminPassword(password) {
  return typeof password === 'string' && password === SECRETS.ADMIN_PASSWORD;
}

/**
 * Formats a Date object to a schedule-style label string
 * @param {Date} date - Date to format
 * @returns {string} Formatted string like "Saturday March 21 2026"
 */
function formatDateToScheduleLabel(date) {
  if (!(date instanceof Date)) return date;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${dayNames[date.getDay()]} ${monthNames[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;
}

/**
 * Escapes HTML special characters for safe embedding in HTML emails
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
function escapeHtmlServer(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates volunteer name format
 * @param {string} volunteerName - Volunteer name to validate
 * @returns {boolean} True if valid format
 */
function validateVolunteerName(volunteerName) {
  if (!volunteerName || typeof volunteerName !== 'string') {
    return false;
  }
  const trimmed = volunteerName.trim();
  // Allow "Station X – Name" format or just name
  return trimmed.length > 0 && trimmed.length <= 100;
}
