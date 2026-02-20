/**
 * Product Code Distribution Functions
 * Distributes product codes to volunteer pairs via email
 *
 * Priority: Filers first, then Mentors
 * Excluded: Frontline/Receptionist volunteers
 * Incremental: Skips volunteers who already received a code
 */

/**
 * Gets emails that have already been successfully sent a code for the given year
 * @param {number} year - The year to check
 * @returns {Set<string>} Set of lowercase email addresses
 */
function getAlreadyDistributedEmails(year) {
  const sheet = getOrCreateDistributionLogSheet();
  const lastRow = sheet.getLastRow();
  const distributed = new Set();

  if (lastRow < 2) return distributed;

  // Columns: 0=Timestamp, 1=Year, 2=Code, 3=V1Email, 4=V1Name, 5=V1Status, 6=V2Email, 7=V2Name, 8=V2Status
  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();

  for (const row of data) {
    const logYear = parseInt(row[1], 10);
    if (logYear !== year) continue;

    const v1Email = row[3]?.toString().trim().toLowerCase();
    const v1Status = row[5]?.toString().trim();
    const v2Email = row[6]?.toString().trim().toLowerCase();
    const v2Status = row[8]?.toString().trim();

    if (v1Email && v1Status === 'Sent') distributed.add(v1Email);
    if (v2Email && v2Status === 'Sent') distributed.add(v2Email);
  }

  return distributed;
}

/**
 * Main function to distribute product codes to volunteers
 * Each code is sent to exactly 2 unique volunteers
 * Skips volunteers who have already received a code for this year
 * @param {number} year - The year to filter codes by (e.g., 2025)
 * @returns {Object} Distribution results
 */
function distributeProductCodes(year) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(CONFIG.PERFORMANCE.LOCK_TIMEOUT_MS || 10000);

    // Get available product codes for the specified year
    const codesData = getAvailableProductCodes(year);
    if (codesData.length === 0) {
      return { success: false, message: 'No available codes found for year ' + year };
    }

    // Get all eligible volunteers, then filter out those who already received a code
    const allVolunteers = getVolunteerEmailsForCodes();
    const alreadySent = getAlreadyDistributedEmails(year);
    const volunteers = allVolunteers.filter(v => !alreadySent.has(v.email));

    if (volunteers.length < 2) {
      return {
        success: false,
        message: 'Not enough new volunteers to distribute to. ' +
          alreadySent.size + ' volunteer(s) already have codes.'
      };
    }

    // Calculate how many codes we can distribute
    const maxPairs = Math.floor(volunteers.length / 2);
    const codesToDistribute = Math.min(codesData.length, maxPairs);

    if (codesToDistribute === 0) {
      return { success: false, message: 'Not enough volunteers for distribution' };
    }

    // Shuffle within each role group to randomize, but maintain filer priority
    const { filers, mentors } = separateByRole(volunteers);
    const shuffled = [...shuffleArray([...filers]), ...shuffleArray([...mentors])];

    // Create pairs and distribute
    const results = [];
    const logSheet = getOrCreateDistributionLogSheet();
    const codeSheet = getOrCreateProductCodesSheet();

    for (let i = 0; i < codesToDistribute; i++) {
      const codeInfo = codesData[i];
      const volunteer1 = shuffled[i * 2];
      const volunteer2 = shuffled[i * 2 + 1];

      const sent1 = sendCodeEmail(volunteer1.email, volunteer1.name, codeInfo.key, year);
      const sent2 = sendCodeEmail(volunteer2.email, volunteer2.name, codeInfo.key, year);

      // Update usage count in Product Codes sheet
      if (sent1 || sent2) {
        const newUsageCount = codeInfo.timesUsed + (sent1 ? 1 : 0) + (sent2 ? 1 : 0);
        codeSheet.getRange(codeInfo.row, PRODUCT_CODE_CONFIG.COLUMNS.TIMES_USED + 1)
          .setValue(newUsageCount);
      }

      // Log to distribution log sheet
      logSheet.appendRow([
        new Date(),
        year,
        codeInfo.key,
        volunteer1.email,
        volunteer1.name,
        sent1 ? 'Sent' : 'Failed',
        volunteer2.email,
        volunteer2.name,
        sent2 ? 'Sent' : 'Failed'
      ]);

      results.push({
        code: codeInfo.key,
        volunteer1: volunteer1.email,
        volunteer2: volunteer2.email,
        sent1: sent1,
        sent2: sent2
      });
    }

    const codesRemaining = codesData.length - codesToDistribute;
    const volunteersRemaining = volunteers.length - (codesToDistribute * 2);

    return {
      success: true,
      year: year,
      distributed: codesToDistribute,
      remaining: codesRemaining,
      alreadyHadCodes: alreadySent.size,
      volunteersWithoutCodes: volunteersRemaining,
      results: results
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Gets available product codes for a given year (usage < 2)
 * @param {number} year - The year to filter by
 * @returns {Array<{key: string, timesUsed: number, row: number}>}
 */
function getAvailableProductCodes(year) {
  const sheet = getOrCreateProductCodesSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

  const available = [];
  for (let i = 0; i < data.length; i++) {
    const rowYear = parseInt(data[i][PRODUCT_CODE_CONFIG.COLUMNS.YEAR], 10);
    const key = data[i][PRODUCT_CODE_CONFIG.COLUMNS.KEY]?.toString().trim();
    const timesUsed = parseInt(data[i][PRODUCT_CODE_CONFIG.COLUMNS.TIMES_USED], 10) || 0;

    if (rowYear === year && key && timesUsed < 2) {
      available.push({
        key,
        timesUsed,
        row: i + 2
      });
    }
  }

  return available;
}

/**
 * Gets volunteer emails from Schedule Availability sheet
 * Prioritizes: Filers first, then Mentors
 * Excludes: Frontline volunteers
 * @returns {Array<{email: string, name: string, role: string}>}
 */
function getVolunteerEmailsForCodes() {
  const sheet = getSheet(CONFIG.SHEETS.SCHEDULE_AVAILABILITY);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  // Columns: 0=Timestamp, 1=FirstName, 2=LastName, 3=Email, 4=Role
  const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  const filers = [];
  const mentors = [];
  const seenEmails = new Set();

  for (const row of data) {
    const firstName = row[1]?.toString().trim() || '';
    const lastName = row[2]?.toString().trim() || '';
    const email = row[3]?.toString().trim().toLowerCase() || '';
    const role = row[4]?.toString().trim().toLowerCase() || '';

    if (!email || !email.includes('@') || seenEmails.has(email)) continue;

    if (role.includes('frontline') || role.includes('front line') || role.includes('receptionist')) {
      continue;
    }

    seenEmails.add(email);
    const volunteer = {
      email,
      name: (firstName + ' ' + lastName).trim() || email,
      role
    };

    if (role.includes('mentor') || role.includes('senior')) {
      mentors.push(volunteer);
    } else {
      filers.push(volunteer);
    }
  }

  return [...filers, ...mentors];
}

/**
 * Sends product code email to a volunteer
 * @param {string} email - Volunteer email
 * @param {string} name - Volunteer name
 * @param {string} code - Product code
 * @returns {boolean} True if sent successfully
 */
function sendCodeEmail(email, name, code, year) {
  try {
    var subject = PRODUCT_CODE_CONFIG.EMAIL_SUBJECT || 'Your Tax Clinic Product Code';
    var body = buildCodeEmailBody(name, code, year);

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: body,
      name: 'UW AFSA Tax Clinic'
    });

    Logger.log('Sent code to ' + email);
    return true;

  } catch (error) {
    Logger.log('Failed to send to ' + email + ': ' + error.message);
    return false;
  }
}

/**
 * Sends a single test email to taxclinic@uwafsa.com with dummy data
 * Used to preview email format without affecting real distribution
 * @returns {Object} Result with success status and message
 */
function sendTestCodeEmail() {
  try {
    var testEmail = CONFIG.CLINIC_EMAIL;
    var testName = 'Test Volunteer';
    var testCode = 'CVTN - TEST - XXXX - DEMO';
    var subject = (PRODUCT_CODE_CONFIG.EMAIL_SUBJECT || 'Your Tax Clinic Product Code') + ' [TEST]';
    var testYear = new Date().getFullYear();
    var body = buildCodeEmailBody(testName, testCode, testYear);

    MailApp.sendEmail({
      to: testEmail,
      subject: subject,
      htmlBody: body,
      name: 'UW AFSA Tax Clinic'
    });

    return { success: true, message: 'Test email sent to ' + testEmail };
  } catch (error) {
    return { success: false, message: 'Failed to send test email: ' + error.message };
  }
}

/**
 * Builds HTML email body for product code
 * @param {string} name - Volunteer name
 * @param {string} code - Product code
 * @param {number} year - The distribution year
 * @returns {string} HTML email body
 */
function buildCodeEmailBody(name, code, year) {
  return '<!DOCTYPE html>' +
    '<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">' +
    '<div style="max-width: 600px; margin: 0 auto; padding: 20px;">' +
    '<h2 style="color: #8e0000;">Your UFILE Product Code</h2>' +
    '<p>Hi ' + name + ',</p>' +
    '<p>Please find below your product key for UFILE ' + year + '.</p>' +
    '<p>This code can be used ONCE. Please ensure that you use it on the computer you plan on using at the Tax Clinic. ' +
    'Product keys are limited, and if you use one in error, we cannot guarantee that another one will be distributed to you.</p>' +
    '<p>Your product key is:</p>' +
    '<div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">' +
    '<span style="font-size: 24px; font-weight: bold; font-family: monospace; letter-spacing: 2px;">' +
    code + '</span></div>' +
    '<p>You can download the software at <a href="https://www.ufile.ca/products/ufile-cvitp">https://www.ufile.ca/products/ufile-cvitp</a>.</p>' +
    '<p>EFILE has <strong>NOT</strong> opened up yet, and you will not be able to file any returns with this software until that happens. ' +
    'We highly recommend you do not file any returns until you attend training.</p>' +
    '<p>For other installation instructions, please see ' +
    '<a href="https://www.dropbox.com/scl/fi/v9rkp49y20gu5v29ai1uc/TAX-CLINIC-2026-UFILE-SET-UP-INSTRUCTIONS.docx?rlkey=bkjts0tmjycvhsw87jxugsa1w&st=yp10g6ay&dl=0">this link</a>.</p>' +
    '<p>UW AFSA Tax Clinic Team</p>' +
    '</div></body></html>';
}

/**
 * Separates volunteers into filers and mentors
 * @param {Array} volunteers - Array of volunteer objects with role property
 * @returns {{filers: Array, mentors: Array}}
 */
function separateByRole(volunteers) {
  const filers = [];
  const mentors = [];

  for (const v of volunteers) {
    const role = v.role?.toLowerCase() || '';
    if (role.includes('mentor') || role.includes('senior')) {
      mentors.push(v);
    } else {
      filers.push(v);
    }
  }

  return { filers, mentors };
}

/**
 * Shuffles array randomly (Fisher-Yates algorithm)
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Gets or creates the Product Codes sheet
 * @returns {Sheet} The Product Codes sheet
 */
function getOrCreateProductCodesSheet() {
  const ss = getSpreadsheet();
  const sheetName = PRODUCT_CODE_CONFIG?.SHEET_NAME || 'Product Codes';

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = ['Year', 'Key', 'Number of times used'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  return sheet;
}

/**
 * Gets or creates the Distribution Log sheet
 * @returns {Sheet} The Distribution Log sheet
 */
function getOrCreateDistributionLogSheet() {
  const ss = getSpreadsheet();
  const sheetName = PRODUCT_CODE_CONFIG?.DISTRIBUTION_LOG_SHEET || 'Product Code Distribution Log';

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = ['Timestamp', 'Year', 'Product Code',
                     'Volunteer 1 Email', 'Volunteer 1 Name', 'Volunteer 1 Status',
                     'Volunteer 2 Email', 'Volunteer 2 Name', 'Volunteer 2 Status'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  return sheet;
}

/**
 * Gets volunteer list for the dropdown, with indication of who already has a code
 * @param {number} year - The year to check distribution status
 * @returns {Array<{email: string, name: string, role: string, hasCode: boolean}>}
 */
function getVolunteerListForDropdown(year) {
  const volunteers = getVolunteerEmailsForCodes();
  const alreadySent = getAlreadyDistributedEmails(year);

  var list = volunteers.map(function(v) {
    return {
      email: v.email,
      name: v.name,
      role: v.role,
      hasCode: alreadySent.has(v.email)
    };
  });

  list.sort(function(a, b) {
    return a.name.localeCompare(b.name);
  });

  return list;
}

/**
 * Sends a product code to a specific individual volunteer
 * @param {string} email - The volunteer's email address
 * @param {number} year - The year to distribute for
 * @returns {Object} Result with success status, message, and code
 */
function sendCodeToIndividual(email, year) {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(CONFIG.PERFORMANCE.LOCK_TIMEOUT_MS || 10000);

    // Look up volunteer name
    var volunteers = getVolunteerEmailsForCodes();
    var volunteer = null;
    for (var i = 0; i < volunteers.length; i++) {
      if (volunteers[i].email === email.toLowerCase().trim()) {
        volunteer = volunteers[i];
        break;
      }
    }

    if (!volunteer) {
      return { success: false, message: 'Volunteer not found: ' + email };
    }

    // Check if volunteer already received a code this year
    var alreadySent = getAlreadyDistributedEmails(year);
    if (alreadySent.has(volunteer.email)) {
      return { success: false, message: volunteer.name + ' has already received a code for ' + year };
    }

    // Get next available code
    var codes = getAvailableProductCodes(year);
    if (codes.length === 0) {
      return { success: false, message: 'No available codes for year ' + year };
    }

    var codeInfo = codes[0];
    var sent = sendCodeEmail(volunteer.email, volunteer.name, codeInfo.key, year);

    if (sent) {
      // Update usage count
      var codeSheet = getOrCreateProductCodesSheet();
      codeSheet.getRange(codeInfo.row, PRODUCT_CODE_CONFIG.COLUMNS.TIMES_USED + 1)
        .setValue(codeInfo.timesUsed + 1);

      // Log to distribution log (volunteer 2 fields blank for individual send)
      var logSheet = getOrCreateDistributionLogSheet();
      logSheet.appendRow([
        new Date(),
        year,
        codeInfo.key,
        volunteer.email,
        volunteer.name,
        'Sent',
        '',
        '',
        ''
      ]);
    }

    return {
      success: sent,
      message: sent
        ? 'Code sent to ' + volunteer.name + ' (' + volunteer.email + ')'
        : 'Failed to send email to ' + volunteer.email,
      code: sent ? codeInfo.key : null
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Preview distribution without sending emails
 * Shows who would receive codes and who already has them
 * @param {number} year - The year to preview
 * @returns {Object} Preview data
 */
function previewDistribution(year) {
  const codes = getAvailableProductCodes(year);
  const allVolunteers = getVolunteerEmailsForCodes();
  const alreadySent = getAlreadyDistributedEmails(year);
  const remaining = allVolunteers.filter(v => !alreadySent.has(v.email));
  const { filers, mentors } = separateByRole(remaining);

  const maxPairs = Math.floor(remaining.length / 2);
  const codesToDistribute = Math.min(codes.length, maxPairs);

  return {
    year: year,
    totalAvailableCodes: codes.length,
    totalVolunteers: allVolunteers.length,
    alreadyDistributed: alreadySent.size,
    remainingVolunteers: remaining.length,
    filerCount: filers.length,
    mentorCount: mentors.length,
    possiblePairs: maxPairs,
    willDistribute: codesToDistribute,
    codesRemaining: codes.length - codesToDistribute,
    volunteersWithoutCodes: remaining.length - (codesToDistribute * 2)
  };
}

/**
 * Gets the recent distribution log entries for the UI
 * @param {number} year - The year to filter by
 * @returns {Array<Object>} Recent log entries
 */
function getDistributionLog(year) {
  const sheet = getOrCreateDistributionLogSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  const entries = [];

  for (let i = data.length - 1; i >= 0; i--) {
    const logYear = parseInt(data[i][1], 10);
    if (logYear !== year) continue;

    entries.push({
      timestamp: data[i][0],
      code: data[i][2],
      v1Email: data[i][3],
      v1Name: data[i][4],
      v1Status: data[i][5],
      v2Email: data[i][6],
      v2Name: data[i][7],
      v2Status: data[i][8]
    });

    if (entries.length >= 50) break;
  }

  return entries;
}
