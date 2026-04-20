/**
 * Appointment Booking Functions
 * Handles appointment bookings from the static screening page.
 * Generates Priority Client IDs, sends confirmation emails, and sends 2-day reminder emails.
 */

// ============================================================================
// DIRECT SUBMISSION HANDLER (replaces Google Form flow)
// Called by doGet() in Router.gs when action=appointmentBooking
// ============================================================================

/**
 * Handles appointment booking submissions from the static screening page.
 * Writes to 'Appointment Bookings' sheet, generates a Priority Client ID,
 * and sends a confirmation email.
 * @param {Object} params - URL parameters from the fetch request
 */
function submitAppointmentBooking(params) {
  const email = (params.email || '').trim();
  const preferredDate = (params.preferredDate || '').trim();
  const preferredTime = (params.preferredTime || '').trim();
  const taxYears = parseInt(params.taxYears || '0', 10);
  const hasChildren = params.hasChildren === 'yes';
  const hasForeignIncome = params.hasForeignIncome === 'yes';

  // Validate required fields
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailPattern.test(email)) throw new Error('Invalid email: ' + email);

  // Build situations string from screening answers (compatible with buildConfirmationEmailBody)
  const situationsList = [];
  if (taxYears >= 3) situationsList.push('Three or more years of late tax returns');
  if (hasChildren) situationsList.push('Childcare expenses');
  if (hasForeignIncome) situationsList.push('Foreign co-op income');
  const situations = situationsList.join('; ');

  const sheet = getOrCreateAppointmentBookingsSheet();
  const clientId = generatePriorityClientIdDirect(sheet);

  // Read headers and write data by column name, not position
  // This is robust against pre-existing sheets with different column orders
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = new Array(headers.length).fill('');
  const setCol = (headerName, value) => {
    const idx = headers.indexOf(headerName);
    if (idx >= 0) rowData[idx] = value;
  };
  setCol('Timestamp', new Date());
  setCol('Email', email);
  setCol('Preferred Date', preferredDate);
  setCol('Preferred Time', preferredTime);
  setCol('Situations', situations);
  setCol('Client ID', clientId);
  sheet.appendRow(rowData);

  const lastRow = sheet.getLastRow();
  const statusColIdx = headers.indexOf('Confirmation Sent');

  try {
    sendAppointmentConfirmation({ email, preferredDate, preferredTime, situations, clientId });
    if (statusColIdx >= 0) sheet.getRange(lastRow, statusColIdx + 1).setValue('Sent');
    Logger.log('Appointment booked: ' + clientId + ' for ' + email + ' on ' + preferredDate);
  } catch (err) {
    if (statusColIdx >= 0) sheet.getRange(lastRow, statusColIdx + 1).setValue('Failed');
    Logger.log('Email failed for ' + clientId + ': ' + err.message);
  }
}

/**
 * Gets or creates the 'Appointment Bookings' sheet with headers.
 * @returns {Sheet}
 */
function getOrCreateAppointmentBookingsSheet() {
  const ss = getSpreadsheet();
  const sheetName = 'Appointment Bookings';
  const expectedHeaders = [
    'Timestamp', 'Email',
    'Preferred Date', 'Preferred Time', 'Situations',
    'Client ID', 'Confirmation Sent', 'Reminder Sent'
  ];

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(expectedHeaders);
  } else {
    // Add any missing headers at the end so column-name lookups work correctly
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missing = expectedHeaders.filter(h => !existingHeaders.includes(h));
    if (missing.length > 0) {
      sheet.getRange(1, existingHeaders.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  return sheet;
}

/**
 * Generates the next Priority Client ID (P001, P002, ...) from the Appointment Bookings sheet.
 * Uses LockService to prevent race conditions.
 * @param {Sheet} bookingSheet
 * @returns {string}
 */
function generatePriorityClientIdDirect(bookingSheet) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.PERFORMANCE.LOCK_TIMEOUT_MS || 10000);

    const lastRow = bookingSheet.getLastRow();
    if (lastRow <= 1) return 'P001';

    const headers = bookingSheet.getRange(1, 1, 1, bookingSheet.getLastColumn()).getValues()[0];
    const clientIdCol = headers.indexOf('Client ID') + 1;
    if (clientIdCol === 0) return 'P001';

    const data = bookingSheet.getRange(2, clientIdCol, lastRow - 1, 1).getValues();
    let maxNumber = 0;
    for (const [id] of data) {
      if (id && typeof id === 'string' && id.startsWith('P')) {
        const num = parseInt(id.substring(1), 10);
        if (!isNaN(num) && num > maxNumber) maxNumber = num;
      }
    }
    return 'P' + String(maxNumber + 1).padStart(3, '0');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Returns the location for a given clinic date.
 * Falls back to ELIGIBILITY_CONFIG.CLINIC_LOCATION if the date is not mapped.
 * @param {string} date - Date string matching a key in ELIGIBILITY_CONFIG.DATE_LOCATIONS
 * @returns {{room: string, mapsUrl: string|null}}
 */
function getLocationForDate(date) {
  const loc = ELIGIBILITY_CONFIG.DATE_LOCATIONS[date];
  return loc || { room: ELIGIBILITY_CONFIG.CLINIC_LOCATION, mapsUrl: null };
}

/**
 * Sends appointment confirmation email
 * @param {Object} data - Appointment data
 */
function sendAppointmentConfirmation(data) {
  try {
    const emailBody = buildConfirmationEmailBody(data);
    const subject = `Tax Clinic Appointment Confirmation - ${data.clientId}`;
  const inviteAttachment = createAppointmentInviteBlob(data);

    sendEmail({
      to: data.email,
      subject: subject,
      body: `Your appointment is confirmed for ${data.preferredDate} at ${data.preferredTime}. Please see the attached calendar invite.`,
      htmlBody: emailBody,
      name: 'UW AFSA Tax Clinic',
      attachments: [inviteAttachment]
    }, 'sendAppointmentConfirmation');

    Logger.log(`Confirmation email sent to ${data.email} for ${data.clientId}`);

  } catch (error) {
    Logger.log('Error sending confirmation email: ' + error.message);
    throw error;
  }
}

/**
 * Builds the HTML email body for appointment confirmation
 * @param {Object} data - Appointment data
 * @returns {string} HTML email body
 */
function buildConfirmationEmailBody(data) {
  const situations = (data.situations || '').toLowerCase();

  const location = getLocationForDate(data.preferredDate);
  const locationDisplay = location.mapsUrl
    ? `<a href="${location.mapsUrl}" style="color: #8e0000;">${location.room}</a>`
    : location.room;

  // Build situation-specific document requirements
  let situationDocs = '';

  // Match: "More than three years of late tax returns"
  if (situations.includes('late tax returns') || situations.includes('three years')) {
    situationDocs += `
              <li><strong>For multiple tax years:</strong> Tax slips for each year being filed, Notice of Assessment for each prior year (if available)</li>`;
  }

  // Match: "Childcare expenses"
  if (situations.includes('childcare')) {
    situationDocs += `
              <li><strong>For childcare expenses:</strong> Child's SIN or ITN, childcare receipts (daycare, after-school programs), custody agreement (if applicable)</li>`;
  }

  // Match: "Foreign co-op income"
  if (situations.includes('foreign co-op')) {
    situationDocs += `
              <li><strong>For foreign co-op income:</strong> Foreign income documentation (pay stubs, tax forms), dates of arrival in Canada, work permit or visa documentation</li>`;
  }

  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #8e0000;">Tax Clinic Appointment Confirmation</h2>

          <p>Dear Client,</p>

          <p>Your appointment at the UW AFSA Tax Clinic has been confirmed.</p>

          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #27ae60;">
            <h3 style="margin-top: 0; color: #27ae60;">Your Client ID</h3>
            <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #27ae60;">${data.clientId}</p>
            <p style="font-size: 14px; color: #666;">Please bring this ID with you to your appointment.</p>
          </div>

          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #8e0000;">Appointment Details</h3>
            <p><strong>Date:</strong> ${data.preferredDate}</p>
            <p><strong>Time:</strong> ${data.preferredTime}</p>
            <p><strong>Location:</strong> ${locationDisplay}</p>
          </div>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="margin-top: 0; color: #856404;">What to Bring</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Government-issued photo ID</li>
              <li>Social Insurance Number (SIN) or Individual Tax Number (ITN)</li>
              <li>All tax slips (T4, T4A, T5, T2202, etc.)</li>
              <li>Previous year's Notice of Assessment (if not filing for the first time)</li>
              <li>Rent receipts (if applicable)</li>${situationDocs}
            </ul>
            <p style="margin-bottom: 0;">For a complete checklist, visit <a href="${CONFIG.CLINIC_WEBSITE_URL}" style="color: #8e0000;">taxclinic.uwaterloo.ca</a></p>
          </div>

          <p>If you need to cancel or reschedule your appointment, please email us at <a href="mailto:${CONFIG.CLINIC_EMAIL}" style="color: #8e0000;">${CONFIG.CLINIC_EMAIL}</a>.</p>

          <p>We look forward to seeing you!</p>

          <p>Best regards,<br>
          UW AFSA Tax Clinic</p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated confirmation email from the UW AFSA Tax Clinic.
          </p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Constructs an .ics calendar invite blob for the appointment.
 * @param {Object} data
 * @returns {Blob}
 */
function createAppointmentInviteBlob(data) {
  const startDate = parseAppointmentDateTime(data.preferredDate, data.preferredTime);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour default duration

  const dtstamp = formatIcsDateTime(new Date());
  const dtstart = formatIcsDateTime(startDate);
  const dtend = formatIcsDateTime(endDate);
  const uidDomain = (CONFIG.CLINIC_WEBSITE_URL || 'taxclinic.uwaterloo.ca')
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9.-]/g, '') || 'taxclinic.uwaterloo.ca';
  const uid = `${data.clientId}-${Date.now()}@${uidDomain}`;
  const location = getLocationForDate(data.preferredDate).room;

  const description = `Appointment at UW AFSA Tax Clinic\nClient ID: ${data.clientId}\nDate: ${data.preferredDate}\nTime: ${data.preferredTime}\nLocation: ${location}\n\nPlease bring photo ID, SIN/ITN, tax slips, and supporting documents.`;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UW AFSA Tax Clinic//Appointment Invite//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    'SUMMARY:UW AFSA Tax Clinic Appointment',
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `ORGANIZER;CN=UW AFSA Tax Clinic:mailto:${CONFIG.CLINIC_EMAIL}`,
    `ATTENDEE;CN=Client;RSVP=TRUE:mailto:${data.email}`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const icsContent = icsLines.join('\r\n');
  return Utilities.newBlob(icsContent, 'text/calendar;charset=utf-8', `${data.clientId}-appointment.ics`);
}

/**
 * Formats a Date object for ICS as UTC timestamp.
 * @param {Date} date
 * @returns {string}
 */
function formatIcsDateTime(date) {
  return Utilities.formatDate(date, 'GMT', "yyyyMMdd'T'HHmmss'Z'");
}

/**
 * Parses preferred date and time strings into a Date object.
 * @param {string} dateStr
 * @param {string} timeStr
 * @returns {Date}
 */
function parseAppointmentDateTime(dateStr, timeStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return new Date();
  }

  let hours = 0;
  let minutes = 0;
  const timeMatch = (timeStr || '').match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3] ? timeMatch[3].toUpperCase() : null;
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  }

  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Escapes text for use in ICS fields.
 * @param {string} value
 * @returns {string}
 */
function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}


// ============================================================================
// APPOINTMENT REMINDER EMAILS (2 days before appointment)
// ============================================================================

/**
 * Scans the Appointment Bookings sheet and sends a reminder email to any client
 * whose appointment is exactly 2 days from today, if not already reminded.
 * Intended to be called by a daily time-based trigger.
 */
function sendAppointmentReminders() {
  const sheet = getOrCreateAppointmentBookingsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return; // No bookings

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const getIdx = name => headers.indexOf(name);

  const emailIdx       = getIdx('Email');
  const dateIdx        = getIdx('Preferred Date');
  const timeIdx        = getIdx('Preferred Time');
  const situationsIdx  = getIdx('Situations');
  const clientIdIdx    = getIdx('Client ID');
  const reminderIdx    = getIdx('Reminder Sent');

  // Target date: 2 days from today (midnight-normalized in script timezone)
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  data.forEach((row, i) => {
    const preferredDate = (row[dateIdx] || '').toString().trim();
    if (!preferredDate) return;

    // Skip if already reminded
    if ((row[reminderIdx] || '').toString().trim()) return;

    // Parse the date string (e.g. "Saturday, March 21, 2026")
    const appointmentDate = new Date(preferredDate);
    if (isNaN(appointmentDate.getTime())) return;

    const apptMidnight = new Date(
      appointmentDate.getFullYear(),
      appointmentDate.getMonth(),
      appointmentDate.getDate()
    );

    if (apptMidnight.getTime() !== targetDate.getTime()) return;

    const sheetRow = i + 2; // 1-indexed, offset for header row
    const reminderColNum = reminderIdx + 1;

    try {
      sendAppointmentReminderEmail({
        email:         (row[emailIdx] || '').toString().trim(),
        preferredDate: preferredDate,
        preferredTime: (row[timeIdx] || '').toString().trim(),
        situations:    (row[situationsIdx] || '').toString().trim(),
        clientId:      (row[clientIdIdx] || '').toString().trim()
      });
      sheet.getRange(sheetRow, reminderColNum).setValue('Sent');
      Logger.log('Reminder sent: ' + row[clientIdIdx] + ' to ' + row[emailIdx]);
    } catch (err) {
      sheet.getRange(sheetRow, reminderColNum).setValue('Failed');
      Logger.log('Reminder failed for ' + row[clientIdIdx] + ': ' + err.message);
    }
  });
}

/**
 * Sends a reminder email to a client 2 days before their appointment.
 * @param {Object} data - { email, preferredDate, preferredTime, situations, clientId }
 */
function sendAppointmentReminderEmail(data) {
  const emailBody = buildReminderEmailBody(data);
  const subject = `Reminder: Your Tax Clinic Appointment is in 2 Days – ${data.clientId}`;
  sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: emailBody,
    name: 'UW AFSA Tax Clinic'
  }, 'sendAppointmentReminderEmail');
}

/**
 * Builds the HTML body for the 2-day reminder email.
 * Includes situation-specific document reminders based on the client's complexity flags.
 * @param {Object} data - { email, preferredDate, preferredTime, situations, clientId }
 * @returns {string} HTML email body
 */
function buildReminderEmailBody(data) {
  const situations = (data.situations || '').toLowerCase();

  const location = getLocationForDate(data.preferredDate);
  const locationDisplay = location.mapsUrl
    ? `<a href="${location.mapsUrl}" style="color: #8e0000;">${location.room}</a>`
    : location.room;

  // Situation-specific document reminders (mirrors buildConfirmationEmailBody)
  let situationDocs = '';

  if (situations.includes('late tax returns') || situations.includes('three years')) {
    situationDocs += `
              <li><strong>For multiple tax years:</strong> Tax slips for each year being filed, Notice of Assessment for each prior year (if available)</li>`;
  }

  if (situations.includes('childcare')) {
    situationDocs += `
              <li><strong>For childcare expenses:</strong> Child's SIN or ITN, childcare receipts (daycare, after-school programs), custody agreement (if applicable)</li>`;
  }

  if (situations.includes('foreign co-op')) {
    situationDocs += `
              <li><strong>For foreign co-op income:</strong> Foreign tax return (should be completed before arrival to tax clinic), Foreign income documentation (pay stubs, tax forms), dates of arrival in Canada.</li>`;
  }

  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #8e0000;">Tax Clinic Appointment Reminder</h2>

          <p>Dear Client,</p>

          <p>This is a friendly reminder that your appointment at the UW AFSA Tax Clinic is <strong>in 2 days</strong>.</p>

          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #27ae60;">
            <h3 style="margin-top: 0; color: #27ae60;">Your Client ID</h3>
            <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #27ae60;">${data.clientId}</p>
            <p style="font-size: 14px; color: #666;">Please bring this ID with you to your appointment.</p>
          </div>

          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #8e0000;">Appointment Details</h3>
            <p><strong>Date:</strong> ${data.preferredDate}</p>
            <p><strong>Time:</strong> ${data.preferredTime}</p>
            <p><strong>Location:</strong> ${locationDisplay}</p>
          </div>

          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <h3 style="margin-top: 0; color: #856404;">What to Bring</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Government-issued photo ID</li>
              <li>Social Insurance Number (SIN) or Individual Tax Number (ITN)</li>
              <li>All tax slips (T4, T4A, T5, T2202, etc.)</li>
              <li>Previous year's Notice of Assessment (if not filing for the first time)</li>
              <li>Rent receipts (if applicable)</li>${situationDocs}
            </ul>
            <p style="margin-bottom: 0;">For a complete checklist, visit <a href="${CONFIG.CLINIC_WEBSITE_URL}" style="color: #8e0000;">taxclinic.uwaterloo.ca</a></p>
          </div>

          <p>We look forward to seeing you!</p>

          <p>Best regards,<br>
          UW AFSA Tax Clinic</p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated reminder from the UW AFSA Tax Clinic.
          </p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Sets up a daily time-based trigger to run sendAppointmentReminders() at 9 AM.
 * Run this once from the Apps Script editor.
 */
function setupReminderTrigger() {
  // Avoid duplicates
  const existing = ScriptApp.getProjectTriggers().find(
    t => t.getHandlerFunction() === 'sendAppointmentReminders'
  );
  if (existing) {
    Logger.log('Reminder trigger already exists.');
    return;
  }

  ScriptApp.newTrigger('sendAppointmentReminders')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log('Daily reminder trigger created — will run at 9 AM each day.');
}

