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
 * @returns {Object} Result with success status and number of changes applied
 */
function saveVolunteerScheduleEdits(volunteerName, shiftUpdates) {
  return safeExecute(() => {
    if (!volunteerName || !volunteerName.trim()) {
      throw new Error('Volunteer name is required');
    }

    const sheet = getScheduleSheet();
    let changeCount = 0;

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
    }

    return { success: true, changesApplied: changeCount };
  }, 'saveVolunteerScheduleEdits');
}
