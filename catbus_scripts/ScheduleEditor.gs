/**
 * Schedule Editor Functions
 * Provides functions for manually editing individual volunteer schedules
 */

/**
 * Gets a map of all shift IDs to boolean indicating if the volunteer is assigned
 * @param {string} volunteerName - Exact volunteer name
 * @returns {Object} Map of shift ID -> boolean (e.g., {D1A: true, D1B: false, ...})
 */
function getVolunteerShiftMap(volunteerName) {
  return safeExecute(() => {
    if (!volunteerName || !volunteerName.trim()) {
      throw new Error('Volunteer name is required');
    }

    const sheet = getScheduleSheet();
    const data = sheet.getDataRange().getValues();
    const slotKeys = ['A', 'B', 'C'];
    const shiftMap = {};

    // Initialize all 12 shifts to false
    SCHEDULE_CONFIG.getAllShiftIds().forEach(id => { shiftMap[id] = false; });

    // Scan schedule grid: rows 1-3 (0-indexed), columns 1-4 (0-indexed)
    for (let rowIdx = 1; rowIdx <= 3 && rowIdx < data.length; rowIdx++) {
      for (let colIdx = 1; colIdx <= 4 && colIdx < data[rowIdx].length; colIdx++) {
        const cellValue = data[rowIdx][colIdx]?.toString().trim() || '';
        if (!cellValue || cellValue === '(unfilled)') continue;

        const names = cellValue.split(',').map(n => n.trim());
        const shiftId = 'D' + colIdx + slotKeys[rowIdx - 1];

        if (names.some(n => n.toLowerCase() === volunteerName.trim().toLowerCase())) {
          shiftMap[shiftId] = true;
        }
      }
    }

    return shiftMap;
  }, 'getVolunteerShiftMap');
}

/**
 * Batch saves schedule edits for a volunteer across all shifts
 * @param {string} volunteerName - Exact volunteer name
 * @param {Object} shiftUpdates - Map of shift ID -> boolean (true = assign, false = remove)
 * @param {boolean} [sendEmail] - If true, send schedule change notification email
 * @returns {Object} Result with success status, changes applied, and email status
 */
function saveVolunteerScheduleEdits(volunteerName, shiftUpdates, sendEmail) {
  return safeExecute(() => {
    if (!volunteerName || !volunteerName.trim()) {
      throw new Error('Volunteer name is required');
    }

    const sheet = getScheduleSheet();
    let changeCount = 0;
    const oldShifts = [];
    const newShifts = [];

    for (const [shiftId, shouldBeAssigned] of Object.entries(shiftUpdates)) {
      if (!SCHEDULE_CONFIG.isValidShiftId(shiftId)) continue;

      const shift = SCHEDULE_CONFIG.SHIFTS[shiftId];
      // Sheet is 1-indexed: row = slotIndex + 2 (skip header), col = dayIndex + 2 (skip time label col)
      const row = shift.slotIndex + 2;
      const col = shift.dayIndex + 2;

      const cell = sheet.getRange(row, col);
      const currentValue = cell.getValue()?.toString().trim() || '';

      let names = [];
      if (currentValue && currentValue !== '(unfilled)') {
        names = currentValue.split(',').map(n => n.trim()).filter(n => n);
      }

      const nameIndex = names.findIndex(n => n.toLowerCase() === volunteerName.trim().toLowerCase());

      // Track old state for email notification
      if (nameIndex !== -1) {
        oldShifts.push(shiftId);
      }

      let changed = false;

      if (shouldBeAssigned && nameIndex === -1) {
        names.push(volunteerName.trim());
        changed = true;
      } else if (!shouldBeAssigned && nameIndex !== -1) {
        names.splice(nameIndex, 1);
        changed = true;
      }

      if (changed) {
        const newValue = names.length > 0 ? names.join(', ') : '(unfilled)';
        cell.setValue(newValue);
        changeCount++;
      }

      // Track new state for email notification
      if (shouldBeAssigned) {
        newShifts.push(shiftId);
      }
    }

    const result = { success: true, changesApplied: changeCount, emailSent: false, emailError: null };

    // Send notification email if requested and changes were made
    if (sendEmail && changeCount > 0) {
      try {
        const email = lookupVolunteerEmail_(volunteerName);
        if (!email) {
          result.emailError = 'No email found for this volunteer';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          result.emailError = 'Invalid email address on file';
        } else {
          // Only include future shifts in the email
          const pastShiftIds = getPastShiftIds();
          const futureOldShifts = oldShifts.filter(s => !pastShiftIds.includes(s));
          const futureNewShifts = newShifts.filter(s => !pastShiftIds.includes(s));
          const htmlBody = buildScheduleChangeEmailBody(
            volunteerName, futureOldShifts, futureNewShifts, SCHEDULE_CONFIG.DEFAULT_DAY_LABELS
          );
          sendEmail({
            to: email,
            subject: 'Your Tax Clinic Schedule Has Changed',
            htmlBody: htmlBody
          }, 'sendScheduleChangeEmail');
          result.emailSent = true;
        }
      } catch (e) {
        result.emailError = e.message || 'Failed to send email';
      }
    }

    return result;
  }, 'saveVolunteerScheduleEdits');
}

/**
 * Looks up a volunteer's email from the Consolidated Volunteer List
 * @param {string} volunteerName - Full name (first + last)
 * @returns {string|null} Email address or null if not found
 */
function lookupVolunteerEmail_(volunteerName) {
  const target = volunteerName.trim().toLowerCase();
  const match = getConsolidatedVolunteerList_().find(v => v.name.toLowerCase() === target);
  return match ? match.email : null;
}
