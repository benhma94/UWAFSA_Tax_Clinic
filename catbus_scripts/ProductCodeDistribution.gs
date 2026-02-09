/**
 * Product Code Distribution Functions
 * Distributes product codes to volunteer pairs via email
 *
 * Priority: Filers first, then Mentors
 * Excluded: Frontline/Receptionist volunteers
 */

/**
 * Main function to distribute product codes to volunteers
 * Each code is sent to exactly 2 unique volunteers
 * @param {number} year - The year to filter codes by (e.g., 2026)
 * @returns {Object} Distribution results
 */
function distributeProductCodes(year) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(CONFIG.PERFORMANCE.LOCK_TIMEOUT_MS || 10000);

    // Get available product codes for the specified year
    const codesData = getAvailableProductCodes(year);
    if (codesData.length === 0) {
      Logger.log(`No available codes found for year ${year}`);
      return { success: false, message: `No available codes found for year ${year}` };
    }

    // Get volunteer emails from Schedule Availability
    const volunteers = getVolunteerEmailsForCodes();
    if (volunteers.length < 2) {
      Logger.log('Need at least 2 volunteers');
      return { success: false, message: 'Need at least 2 volunteers' };
    }

    // Calculate how many codes we can distribute
    const maxPairs = Math.floor(volunteers.length / 2);
    const codesToDistribute = Math.min(codesData.length, maxPairs);

    if (codesToDistribute === 0) {
      Logger.log('Not enough volunteers for distribution');
      return { success: false, message: 'Not enough volunteers for distribution' };
    }

    // Volunteers are already ordered: filers first, then mentors
    // Shuffle within each group to randomize, but maintain priority
    const { filers, mentors } = separateByRole(volunteers);
    const shuffledFilers = shuffleArray([...filers]);
    const shuffledMentors = shuffleArray([...mentors]);
    const shuffled = [...shuffledFilers, ...shuffledMentors];

    // Create pairs and distribute
    const results = [];
    const logSheet = getOrCreateDistributionLogSheet();
    const codeSheet = getOrCreateProductCodesSheet();

    for (let i = 0; i < codesToDistribute; i++) {
      const codeInfo = codesData[i];
      const volunteer1 = shuffled[i * 2];
      const volunteer2 = shuffled[i * 2 + 1];

      // Send emails to both volunteers
      const sent1 = sendCodeEmail(volunteer1.email, volunteer1.name, codeInfo.key);
      const sent2 = sendCodeEmail(volunteer2.email, volunteer2.name, codeInfo.key);

      // Update "Number of times used" in Product Codes sheet
      if (sent1 || sent2) {
        const newUsageCount = codeInfo.timesUsed + (sent1 ? 1 : 0) + (sent2 ? 1 : 0);
        codeSheet.getRange(codeInfo.row, PRODUCT_CODE_CONFIG.COLUMNS.TIMES_USED + 1)
          .setValue(newUsageCount);
      }

      // Log to distribution log sheet
      logSheet.appendRow([
        new Date(),                    // Timestamp
        year,                          // Year
        codeInfo.key,                  // Product Code
        volunteer1.email,              // Volunteer 1 Email
        volunteer1.name,               // Volunteer 1 Name
        sent1 ? 'Sent' : 'Failed',     // Volunteer 1 Status
        volunteer2.email,              // Volunteer 2 Email
        volunteer2.name,               // Volunteer 2 Name
        sent2 ? 'Sent' : 'Failed'      // Volunteer 2 Status
      ]);

      results.push({
        code: codeInfo.key,
        volunteer1: volunteer1.email,
        volunteer2: volunteer2.email,
        success: sent1 && sent2
      });
    }

    const codesRemaining = codesData.length - codesToDistribute;

    Logger.log(`Distribution complete: ${codesToDistribute} codes sent, ${codesRemaining} remaining`);

    return {
      success: true,
      year: year,
      distributed: codesToDistribute,
      remaining: codesRemaining,
      totalVolunteers: volunteers.length,
      results
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

  if (lastRow < 2) return []; // Only header or empty

  // Read all data: Year, Key, Times Used
  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

  const available = [];
  for (let i = 0; i < data.length; i++) {
    const rowYear = parseInt(data[i][PRODUCT_CODE_CONFIG.COLUMNS.YEAR], 10);
    const key = data[i][PRODUCT_CODE_CONFIG.COLUMNS.KEY]?.toString().trim();
    const timesUsed = parseInt(data[i][PRODUCT_CODE_CONFIG.COLUMNS.TIMES_USED], 10) || 0;

    // Only include codes for the specified year with usage < 2
    if (rowYear === year && key && timesUsed < 2) {
      available.push({
        key,
        timesUsed,
        row: i + 2  // +2 because data starts at row 2 (1-indexed)
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

    // Skip invalid or duplicate emails
    if (!email || !email.includes('@') || seenEmails.has(email)) continue;

    // Exclude frontline volunteers
    if (role.includes('frontline') || role.includes('front line') || role.includes('receptionist')) {
      continue;
    }

    seenEmails.add(email);
    const volunteer = {
      email,
      name: `${firstName} ${lastName}`.trim() || email,
      role
    };

    // Categorize by role priority
    if (role.includes('mentor') || role.includes('senior')) {
      mentors.push(volunteer);
    } else {
      // Default to filer if not a mentor/senior
      filers.push(volunteer);
    }
  }

  // Return filers first, then mentors (maintains priority order)
  return [...filers, ...mentors];
}

/**
 * Sends product code email to a volunteer
 * @param {string} email - Volunteer email
 * @param {string} name - Volunteer name
 * @param {string} code - Product code
 * @returns {boolean} True if sent successfully
 */
function sendCodeEmail(email, name, code) {
  try {
    const subject = PRODUCT_CODE_CONFIG.EMAIL_SUBJECT || 'Your Tax Clinic Product Code';
    const body = buildCodeEmailBody(name, code);

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: body
    });

    Logger.log(`Sent code to ${email}`);
    return true;

  } catch (error) {
    Logger.log(`Failed to send to ${email}: ${error.message}`);
    return false;
  }
}

/**
 * Builds HTML email body for product code
 * @param {string} name - Volunteer name
 * @param {string} code - Product code
 * @returns {string} HTML email body
 */
function buildCodeEmailBody(name, code) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #8e0000;">Tax Clinic - Your Product Code</h2>

        <p>Dear ${name},</p>

        <p>Thank you for volunteering at the UW AFSA Tax Clinic!</p>

        <p>Your product code is:</p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <span style="font-size: 24px; font-weight: bold; font-family: monospace; letter-spacing: 2px;">
            ${code}
          </span>
        </div>

        <p>Please keep this code safe. This code has been shared with one other volunteer.</p>

        <p>Best regards,<br>UW AFSA Tax Clinic Team</p>
      </div>
    </body>
    </html>
  `;
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
 * Preview distribution without sending emails
 * Use this to verify pairing before actual distribution
 * @param {number} year - The year to preview
 * @returns {Object} Preview data
 */
function previewDistribution(year) {
  const codes = getAvailableProductCodes(year);
  const volunteers = getVolunteerEmailsForCodes();
  const { filers, mentors } = separateByRole(volunteers);

  const maxPairs = Math.floor(volunteers.length / 2);
  const codesToDistribute = Math.min(codes.length, maxPairs);

  const result = {
    year: year,
    totalAvailableCodes: codes.length,
    totalVolunteers: volunteers.length,
    filerCount: filers.length,
    mentorCount: mentors.length,
    possiblePairs: maxPairs,
    willDistribute: codesToDistribute,
    willRemain: codes.length - codesToDistribute,
    availableCodes: codes.map(c => c.key),
    filerEmails: filers.map(v => v.email),
    mentorEmails: mentors.map(v => v.email)
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
