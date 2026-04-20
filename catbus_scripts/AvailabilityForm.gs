/**
 * Availability Form Functions
 * Handles submission and storage of volunteer availability form responses
 */

/**
 * Normalizes email for consistent comparison
 * @param {string} email - Email to normalize
 * @returns {string} Normalized email
 */
function normalizeEmail(email) {
  return email ? email.toString().trim().toLowerCase() : '';
}

/**
 * Checks if a volunteer with the given email already exists
 * @param {string} email - Email to search for
 * @returns {Object} Existing volunteer data or {exists: false}
 */
function checkExistingVolunteer(email) {
  try {
    const sheet = getOrCreateAvailabilitySheet();
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return { exists: false };
    }

    const allData = sheet.getRange(1, 1, lastRow, 10).getValues();

    // Find the email column index by looking at the header
    const headerRow = allData[0];
    let emailColIndex = -1;
    for (let i = 0; i < headerRow.length; i++) {
      if (headerRow[i] && headerRow[i].toString().toLowerCase().includes('email')) {
        emailColIndex = i;
        break;
      }
    }

    if (emailColIndex === -1) {
      Logger.log('Email column not found in header');
      return { exists: false, error: 'Email column not found' };
    }

    const normalizedEmail = normalizeEmail(email);

    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      const rowEmail = normalizeEmail(row[emailColIndex]);

      if (rowEmail === normalizedEmail) {
        const timestamp = row[0] instanceof Date ? row[0].toISOString() : row[0];
        const lastModified = row[9] instanceof Date ? row[9].toISOString() : (row[9] || null);

        return {
          exists: true,
          rowIndex: i + 1,
          data: {
            timestamp: timestamp,
            firstName: row[1],
            lastName: row[2],
            email: row[emailColIndex],
            role: row[4],
            numShifts: row[5],
            consecutive: row[6],
            availability: row[7] ? row[7].toString().split(/,\s*/) : [],
            notes: row[8] || '',
            lastModified: lastModified
          }
        };
      }
    }

    return { exists: false };
  } catch (error) {
    Logger.log('checkExistingVolunteer error: ' + error.message);
    return { exists: false, error: error.message };
  }
}

/**
 * Checks if a volunteer with the given full name already exists in the Schedule Availability sheet.
 * Used to detect duplicate sign-ups under different email addresses.
 * @param {string} firstName - First name to search for
 * @param {string} lastName - Last name to search for
 * @returns {Object} { exists: true, maskedEmail } or { exists: false }
 */
function checkAvailabilityNameExists(firstName, lastName) {
  try {
    const sheet = getOrCreateAvailabilitySheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { exists: false };

    const allData = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    const normFirst = firstName.trim().toLowerCase();
    const normLast = lastName.trim().toLowerCase();

    for (let i = 0; i < allData.length; i++) {
      const row = allData[i];
      if (row[1].toString().trim().toLowerCase() === normFirst &&
          row[2].toString().trim().toLowerCase() === normLast) {
        const email = row[3].toString();
        const atIdx = email.indexOf('@');
        let maskedEmail;
        if (atIdx > 2) {
          maskedEmail = email.substring(0, 2) + '***' + email.substring(atIdx);
        } else if (atIdx > 0) {
          maskedEmail = email.substring(0, 1) + '***' + email.substring(atIdx);
        } else {
          maskedEmail = '***';
        }
        return { exists: true, maskedEmail: maskedEmail };
      }
    }
    return { exists: false };
  } catch (error) {
    Logger.log('checkAvailabilityNameExists error: ' + error.message);
    return { exists: false };
  }
}

/**
 * Returns volunteer names, emails, and roles from the Consolidated Volunteer List
 * for autocomplete on the availability form.
 * @returns {Array<{name: string, email: string, role: string}>}
 */
function getVolunteersForAutocomplete() {
  return getConsolidatedVolunteerList_().map(v => ({
    name: v.name,
    email: v.email,
    role: v.role
  }));
}

/**
 * Submits availability form data to the schedule availability sheet
 * @param {Object} formData - Form data object containing availability information
 * @returns {Object} Success result
 */
function submitAvailabilityForm(formData) {
  return safeExecute(() => {
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.role) {
      throw new Error('Missing required fields');
    }

    // Validate role against allowed values
    const allowedRoles = ['Filer', 'Mentor', 'Frontline', 'Internal Services'];
    if (!allowedRoles.includes(formData.role)) {
      throw new Error('Invalid role selected');
    }

    // Validate role-specific requirements
    if (formData.role === 'Mentor' || formData.role === 'Internal Services') {
      // Mentors and Internal Services can request any number of shifts (1-12)
      if (!formData.numShifts || formData.numShifts < 1 || formData.numShifts > 12) {
        throw new Error('Number of shifts must be between 1 and 12');
      }
    } else {
      // Non-mentors must request 3-12 shifts
      if (!formData.numShifts || formData.numShifts < 3 || formData.numShifts > 12) {
        throw new Error('Number of shifts must be between 3 and 12');
      }
    }
    
    if (!formData.availability || formData.availability.length === 0) {
      throw new Error('Please select at least one available time slot');
    }
    
    // Validate that selected availability slots meet the minimum requirement (at least as many slots as requested shifts)
    if (formData.availability.length < formData.numShifts) {
      throw new Error(`You selected ${formData.availability.length} time slot${formData.availability.length !== 1 ? 's' : ''} but requested ${formData.numShifts} shift${formData.numShifts !== 1 ? 's' : ''}. Please select at least ${formData.numShifts} time slot${formData.numShifts !== 1 ? 's' : ''} to meet your requested number of shifts.`);
    }

    // Lock to prevent race condition on concurrent submissions for the same email
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      // Get or create the availability sheet
      const sheet = getOrCreateAvailabilitySheet();

      // Check if volunteer already exists
      const existingVolunteer = checkExistingVolunteer(formData.email);

      // Format availability as comma-separated string for storage
      // Now stores shift IDs like "D1A,D1B,D2C" instead of "Day 1 9:45-1:15, Day 1 1:00-4:45"
      const availabilityString = formData.availability.join(',');

      // Prepare timestamps
      const now = new Date();
      const timestamp = existingVolunteer.exists ? existingVolunteer.data.timestamp || now : now;
      const lastModified = now;

      // Prepare row data (with Last Modified column)
      const row = [
        timestamp,
        formData.firstName.trim(),
        formData.lastName.trim(),
        formData.email.trim(),
        formData.role,
        formData.numShifts,
        formData.consecutive || 'No',
        availabilityString,
        formData.notes || '',
        lastModified
      ];

      let isUpdate = false;

      if (existingVolunteer.exists) {
        // Update existing row
        sheet.getRange(existingVolunteer.rowIndex, 1, 1, row.length).setValues([row]);
        Logger.log(`Availability updated: ${formData.firstName} ${formData.lastName} (${formData.email})`);
        isUpdate = true;
      } else {
        // Append new row
        sheet.appendRow(row);
        Logger.log(`Availability submitted: ${formData.firstName} ${formData.lastName} (${formData.email})`);
      }

      return {
        success: true,
        message: isUpdate ? 'Availability updated successfully' : 'Availability submitted successfully',
        isUpdate: isUpdate
      };
    } finally {
      lock.releaseLock();
    }
  }, 'submitAvailabilityForm');
}

/**
 * Retrieves a volunteer's submitted availability by their full name.
 * Used by the volunteer dashboard to display the "My Availability" tab.
 * @param {string} name - Full name to search for (case-insensitive, partial match)
 * @returns {Object} Availability data or {found: false}
 */
function getVolunteerAvailabilityByName(name) {
  return safeExecute(() => {
    if (!name || !name.trim()) {
      return { found: false };
    }

    const sheet = getOrCreateAvailabilitySheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { found: false };
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    const searchLower = name.trim().toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row[1] && !row[2]) continue;

      const firstName = (row[1] || '').toString().trim();
      const lastName = (row[2] || '').toString().trim();
      const fullName = (firstName + ' ' + lastName).trim();
      const fullNameLower = fullName.toLowerCase();

      let score = 0;
      if (fullNameLower === searchLower) {
        score = 3;
      } else if (fullNameLower.includes(searchLower) || searchLower.includes(fullNameLower)) {
        score = 2;
      } else if (firstName.toLowerCase().includes(searchLower) || lastName.toLowerCase().includes(searchLower)) {
        score = 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { row, fullName };
      }
    }

    if (!bestMatch) {
      return { found: false };
    }

    const row = bestMatch.row;
    const availabilityString = (row[7] || '').toString().trim();
    const shiftIds = availabilityString ? availabilityString.split(/,\s*/).filter(s => s) : [];

    // Resolve shift IDs to human-readable labels using SCHEDULE_CONFIG
    const shifts = shiftIds.map(shiftId => {
      const label = SCHEDULE_CONFIG.getShiftLabel(shiftId);
      return label ? { shiftId, day: label.day, time: label.time } : null;
    }).filter(s => s !== null);

    const lastModified = row[9] instanceof Date ? row[9].toISOString() : (row[9] ? row[9].toString() : null);

    return {
      found: true,
      volunteerName: bestMatch.fullName,
      role: (row[4] || '').toString().trim(),
      numShifts: parseInt(row[5]) || 0,
      consecutive: (row[6] || '').toString().trim(),
      shifts: shifts,
      notes: (row[8] || '').toString().trim(),
      lastModified: lastModified
    };
  }, 'getVolunteerAvailabilityByName');
}

/**
 * Gets or creates the schedule availability sheet with proper headers
 * @returns {Sheet} The schedule availability sheet
 */
function getOrCreateAvailabilitySheet() {
  const sheetName = CONFIG.SHEETS.SCHEDULE_AVAILABILITY;
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Set headers
    const headers = [
      'Timestamp',
      'First Name',
      'Last Name',
      'Email',
      'Role',
      'Number of Shifts',
      'Consecutive Preference',
      'Availability',
      'Notes',
      'Last Modified'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
  }
  
  return sheet;
}
