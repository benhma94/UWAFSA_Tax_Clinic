/**
 * Raffle Draw Functions
 * Returns volunteer data weighted by hours volunteered for the raffle draw UI.
 */

/**
 * Returns all volunteers with their draw count (1 draw per partial hour volunteered).
 * @returns {Array<Object>} Array of { name, role, draws } sorted alphabetically by name
 */
function getRaffleVolunteerData() {
  return safeExecute(() => {
    // Build hours map from SignOut sheet (DURATION column is a formula result — use getDisplayValues)
    const signoutSheet = getSheet(CONFIG.SHEETS.SIGNOUT);
    const minutesByVolunteer = {};

    if (signoutSheet) {
      const lastRow = signoutSheet.getLastRow();
      if (lastRow > 1) {
        const signoutCols = CONFIG.COLUMNS.SIGNOUT;
        const numCols = signoutCols.DURATION + 1;
        const data = signoutSheet.getRange(2, 1, lastRow - 1, numCols).getDisplayValues();
        for (const row of data) {
          const name = (row[signoutCols.VOLUNTEER_INFO] || '').trim();
          if (!name) continue;
          const parts = (row[signoutCols.DURATION] || '').trim().split(':');
          if (parts.length >= 2) {
            const h = parseInt(parts[0], 10) || 0;
            const m = parseInt(parts[1], 10) || 0;
            const s = parts.length >= 3 ? (parseInt(parts[2], 10) || 0) : 0;
            const minutes = h * 60 + m + s / 60;
            minutesByVolunteer[name.toLowerCase()] = (minutesByVolunteer[name.toLowerCase()] || 0) + minutes;
          }
        }
      }
    }

    // Get all volunteers from Consolidated Volunteer List (raw data for both name variants)
    const rosterSheet = getSheet(CONFIG.SHEETS.CONSOLIDATED_VOLUNTEER_LIST);
    const rosterLastRow = rosterSheet.getLastRow();
    const cols = CONFIG.COLUMNS.CONSOLIDATED_VOLUNTEER_LIST;
    const rosterData = rosterLastRow > 1
      ? rosterSheet.getRange(2, 1, rosterLastRow - 1, cols.ATTENDED_TRAINING + 1).getValues()
      : [];

    const result = rosterData
      .filter(row => {
        const email    = (row[cols.EMAIL]            || '').toString().trim();
        const preferred = (row[cols.PREFERRED_NAME]  || '').toString().trim();
        const legal    = (row[cols.FIRST_NAME_LEGAL] || '').toString().trim();
        const last     = (row[cols.LAST_NAME]        || '').toString().trim();
        return email && (preferred || legal) && last;
      })
      .map(row => {
        const preferred = (row[cols.PREFERRED_NAME]  || '').toString().trim();
        const legal    = (row[cols.FIRST_NAME_LEGAL] || '').toString().trim();
        const last     = (row[cols.LAST_NAME]        || '').toString().trim();
        const role     = (row[cols.ROLE]             || '').toString().trim();
        const firstName = preferred || legal;
        const displayName = `${firstName} ${last}`.trim();

        // Try both preferred+last and legal+last variants to handle sign-in name mismatches
        const nameVariants = new Set([displayName.toLowerCase()]);
        if (preferred && legal && preferred !== legal) {
          nameVariants.add(`${legal} ${last}`.trim().toLowerCase());
        }
        const totalMinutes = [...nameVariants].reduce((sum, n) => sum + (minutesByVolunteer[n] || 0), 0);
        const draws = Math.ceil(totalMinutes / 60);
        return { name: displayName, role, draws };
      });

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result.filter(v => v.draws >= 3);
  }, 'getRaffleVolunteerData');
}
