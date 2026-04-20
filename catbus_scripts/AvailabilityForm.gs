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
 * Maps roster roles to availability form roles.
 * @param {string} role - Role from Consolidated Volunteer List
 * @returns {string} Availability role
 */
function mapAvailabilityRole_(role) {
  const key = (role || '').toString().trim().toLowerCase();
  if (key === 'senior mentor' || key === 'mentor') return 'Mentor';
  if (key === 'filer') return 'Filer';
  if (key === 'frontline' || key === 'receptionist') return 'Frontline';
  if (key === 'internal services') return 'Internal Services';
  return '';
}

/**
 * Splits a full name into first/last name.
 * @param {string} fullName - Full volunteer name
 * @returns {{firstName: string, lastName: string}}
 */
function splitVolunteerName_(fullName) {
  const parts = (fullName || '').toString().trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  };
}

/**
 * Returns availability profile data for a volunteer dashboard search result.
 * @param {string} volunteerName - Volunteer full name
 * @returns {{volunteerName: string, hasExistingSubmission: boolean, data: Object}}
 */
function getVolunteerAvailabilityForDashboard(volunteerName) {
  return safeExecute(() => {
    const targetName = (volunteerName || '').toString().trim();
    if (!targetName) {
      throw new Error('Volunteer name is required');
    }

    const volunteers = getConsolidatedVolunteerList_();
    const rosterMatch = volunteers.find(v =>
      (v.name || '').toString().trim().toLowerCase() === targetName.toLowerCase()
    );

    const splitName = splitVolunteerName_(rosterMatch ? rosterMatch.name : targetName);
    const baseData = {
      firstName: splitName.firstName,
      lastName: splitName.lastName,
      email: rosterMatch && rosterMatch.email ? rosterMatch.email.toString().trim() : '',
      role: mapAvailabilityRole_(rosterMatch ? rosterMatch.role : ''),
      numShifts: '',
      consecutive: 'No',
      availability: [],
      notes: ''
    };

    let hasExistingSubmission = false;
    if (baseData.email) {
      const existing = checkExistingVolunteer(baseData.email);
      if (existing && existing.exists && existing.data) {
        hasExistingSubmission = true;
        return {
          volunteerName: targetName,
          hasExistingSubmission: true,
          data: {
            firstName: existing.data.firstName || baseData.firstName,
            lastName: existing.data.lastName || baseData.lastName,
            email: existing.data.email || baseData.email,
            role: existing.data.role || baseData.role,
            numShifts: existing.data.numShifts || '',
            consecutive: existing.data.consecutive || 'No',
            availability: existing.data.availability || [],
            notes: existing.data.notes || ''
          }
        };
      }
    }

    return {
      volunteerName: targetName,
      hasExistingSubmission: hasExistingSubmission,
      data: baseData
    };
  }, 'getVolunteerAvailabilityForDashboard');
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
