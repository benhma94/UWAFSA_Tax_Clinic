/**
 * Availability Form Functions
 * Handles submission and storage of volunteer availability form responses
 */

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
    
    // Format availability as comma-separated string for storage
    const availabilityString = formData.availability.join(', ');
    
    // Prepare row data
    const timestamp = new Date();
    const row = [
      timestamp,
      formData.firstName.trim(),
      formData.lastName.trim(),
      formData.email.trim(),
      formData.role,
      formData.numShifts,
      formData.consecutive || 'No',
      availabilityString,
      formData.notes || ''
    ];
    
    // Append to sheet
    sheet.appendRow(row);
    
    Logger.log(`Availability submitted: ${formData.firstName} ${formData.lastName} (${formData.email})`);
    
    return {
      success: true,
      message: 'Availability submitted successfully'
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
      'Notes'
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
