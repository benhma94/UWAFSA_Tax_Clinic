/**
 * Test function to debug checkExistingVolunteer
 * Run this directly from Apps Script editor
 */
function testCheckExistingVolunteer() {
  const testEmail = 'ben.ma.94@live.com';

  Logger.log('=== Testing checkExistingVolunteer ===');
  Logger.log('Test email: ' + testEmail);

  try {
    const result = checkExistingVolunteer(testEmail);
    Logger.log('Result: ' + JSON.stringify(result));

    if (result.exists) {
      Logger.log('SUCCESS: Found volunteer');
      Logger.log('First Name: ' + result.data.firstName);
      Logger.log('Last Name: ' + result.data.lastName);
      Logger.log('Email: ' + result.data.email);
      Logger.log('Role: ' + result.data.role);
      Logger.log('Availability: ' + result.data.availability);
    } else {
      Logger.log('No volunteer found');
      if (result.error) {
        Logger.log('Error: ' + result.error);
      }
    }
  } catch (error) {
    Logger.log('EXCEPTION: ' + error.message);
    Logger.log('Stack: ' + error.stack);
  }

  Logger.log('=== Test Complete ===');
}

/**
 * Test to verify sheet access
 */
function testSheetAccess() {
  Logger.log('=== Testing Sheet Access ===');

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    Logger.log('Opened spreadsheet: ' + ss.getName());

    const sheetName = CONFIG.SHEETS.SCHEDULE_AVAILABILITY;
    Logger.log('Looking for sheet: ' + sheetName);

    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log('Sheet not found! Available sheets:');
      const sheets = ss.getSheets();
      sheets.forEach(s => Logger.log('  - ' + s.getName()));
    } else {
      Logger.log('Found sheet: ' + sheet.getName());
      Logger.log('Last row: ' + sheet.getLastRow());
      Logger.log('Last column: ' + sheet.getLastColumn());

      // Get first row (header)
      if (sheet.getLastRow() > 0) {
        const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
        const headers = headerRange.getValues()[0];
        Logger.log('Headers: ' + JSON.stringify(headers));
      }
    }
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log('Stack: ' + error.stack);
  }

  Logger.log('=== Test Complete ===');
}
