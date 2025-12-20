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
  return safeExecute(() => {
    const sheet = getOrCreateAvailabilitySheet();
    const lastRow = sheet.getLastRow();

    // If sheet is empty (only header), return not found
    if (lastRow < 2) {
      return { exists: false };
    }

    // Only read the columns we need for lookup (all columns)
    const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    const normalizedEmail = normalizeEmail(email);

    // Search for email match (column index 3 = email)
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowEmail = normalizeEmail(row[3]);

      if (rowEmail === normalizedEmail) {
        // Found existing volunteer - return their data
        return {
          exists: true,
          rowIndex: i + 2, // +2 for 1-based indexing and header row
          data: {
            timestamp: row[0],
            firstName: row[1],
            lastName: row[2],
            email: row[3],
            role: row[4],
            numShifts: row[5],
            consecutive: row[6],
            availability: row[7] ? row[7].split(', ') : [],
            notes: row[8] || '',
            lastModified: row[9] || null
          }
        };
      }
    }

    return { exists: false };
  }, 'checkExistingVolunteer');
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

    // Validate role-specific requirements
    if (formData.role === 'Mentor') {
      // Mentors can request any number of shifts (1-12)
      if (!formData.numShifts || formData.numShifts < 1 || formData.numShifts > 12) {
        throw new Error('Number of shifts must be between 1 and 12');
      }
    } else {
      // Non-mentors must request 3-12 shifts
      if (!formData.numShifts || formData.numShifts < 3 || formData.numShifts > 12) {
        throw new Error('Number of shifts must be between 3 and 12');
      }
      
      if (formData.role === 'Filer' && formData.numShifts < 3) {
        throw new Error('Filers must choose at least 3 shifts');
      }
    }
    
    if (!formData.availability || formData.availability.length === 0) {
      throw new Error('Please select at least one available time slot');
    }
    
    // Validate that selected availability slots meet the minimum requirement (at least as many slots as requested shifts)
    if (formData.availability.length < formData.numShifts) {
      throw new Error(`You selected ${formData.availability.length} time slot${formData.availability.length !== 1 ? 's' : ''} but requested ${formData.numShifts} shift${formData.numShifts !== 1 ? 's' : ''}. Please select at least ${formData.numShifts} time slot${formData.numShifts !== 1 ? 's' : ''} to meet your requested number of shifts.`);
    }

    // Get or create the availability sheet
    const sheet = getOrCreateAvailabilitySheet();

    // Check if volunteer already exists
    const existingVolunteer = checkExistingVolunteer(formData.email);

    // Format availability as comma-separated string for storage
    const availabilityString = formData.availability.join(', ');

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
