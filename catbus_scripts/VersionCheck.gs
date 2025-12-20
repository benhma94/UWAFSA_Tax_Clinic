/**
 * Version check endpoint
 */
function doGetVersionCheck() {
  const version = "2024-12-19-V102-DATE-SERIALIZATION-FIX";
  const html = HtmlService.createHtmlOutput(`
    <h1>CATBUS Version Check</h1>
    <p><strong>Version:</strong> ${version}</p>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    <p><strong>checkExistingVolunteer function exists:</strong> ${typeof checkExistingVolunteer === 'function' ? 'YES' : 'NO'}</p>
    <hr>
    <p>If you see this version, setTimeout has been removed from availability_form.html.</p>
  `);
  return html;
}

/**
 * Simple echo test to verify parameter passing works
 */
function echoTest(message) {
  Logger.log('=== echoTest called ===');
  Logger.log('Received message: ' + message);
  Logger.log('Message type: ' + typeof message);
  return {
    received: message,
    type: typeof message,
    timestamp: new Date().toISOString()
  };
}

/**
 * Debug version of checkExistingVolunteer that returns step-by-step status
 */
function debugCheckExistingVolunteer(email) {
  const debug = {
    step: 0,
    email: email,
    emailType: typeof email,
    error: null
  };

  try {
    debug.step = 1; // Received parameter

    const sheet = getOrCreateAvailabilitySheet();
    debug.step = 2; // Got sheet

    const lastRow = sheet.getLastRow();
    debug.step = 3; // Got last row
    debug.lastRow = lastRow;

    if (lastRow < 2) {
      debug.step = 4; // Sheet empty
      return debug;
    }

    const allData = sheet.getRange(1, 1, lastRow, 10).getValues();
    debug.step = 5; // Got data
    debug.rowCount = allData.length;

    const headerRow = allData[0];
    let emailColIndex = -1;
    for (let i = 0; i < headerRow.length; i++) {
      if (headerRow[i] && headerRow[i].toString().toLowerCase().includes('email')) {
        emailColIndex = i;
        break;
      }
    }
    debug.step = 6; // Found email column
    debug.emailColIndex = emailColIndex;

    if (emailColIndex === -1) {
      debug.error = 'Email column not found';
      return debug;
    }

    const normalizedEmail = normalizeEmail(email);
    debug.step = 7; // Normalized email
    debug.normalizedEmail = normalizedEmail;

    // Check first data row as sample
    if (allData.length > 1) {
      const firstRow = allData[1];
      const firstRowEmail = normalizeEmail(firstRow[emailColIndex]);
      debug.step = 8; // Got first row email
      debug.firstRowEmail = firstRowEmail;
      debug.match = (firstRowEmail === normalizedEmail);

      // Try to return the actual data structure like checkExistingVolunteer does
      if (firstRowEmail === normalizedEmail) {
        debug.step = 9; // Found match, building result

        // Convert Date objects to strings for serialization
        const timestamp = firstRow[0] instanceof Date ? firstRow[0].toISOString() : firstRow[0];
        const lastModified = firstRow[9] instanceof Date ? firstRow[9].toISOString() : (firstRow[9] || null);

        const result = {
          exists: true,
          rowIndex: 2, // First data row
          data: {
            timestamp: timestamp,
            firstName: firstRow[1],
            lastName: firstRow[2],
            email: firstRow[emailColIndex],
            role: firstRow[4],
            numShifts: firstRow[5],
            consecutive: firstRow[6],
            availability: firstRow[7] ? firstRow[7].toString().split(', ') : [],
            notes: firstRow[8] || '',
            lastModified: lastModified
          }
        };
        debug.step = 10; // Built result successfully
        debug.resultBuilt = true;
        debug.availabilityCount = result.data.availability.length;
        // Try to return the actual result
        return result;
      }
    }

    return debug;
  } catch (error) {
    debug.error = error.toString();
    debug.errorMessage = error.message;
    debug.errorStack = error.stack;
    return debug;
  }
}
