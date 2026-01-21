/**
 * Appointment Booking Functions
 * Handles Google Form submissions for complex case appointments
 * Generates Priority Client IDs and sends confirmation emails
 */

/**
 * Trigger function for Google Form submissions
 * Set up as an installable trigger on the form's linked spreadsheet
 * @param {Object} e - Form submit event object
 */
function onAppointmentFormSubmit(e) {
  try {
    // Get form response data from the event
    const response = e.namedValues;

    if (!response) {
      Logger.log('No form response data found in event');
      return;
    }

    // Extract form fields (matching actual Google Form fields)
    const appointmentData = {
      timestamp: new Date(),
      email: getFormValue(response, 'Email'),
      preferredDate: getFormValue(response, 'Preferred Date'),
      preferredTime: getFormValue(response, 'Preferred Time'),
      situations: getFormValue(response, 'Which of the following situations apply to you?')
    };

    // Validate required fields
    if (!appointmentData.email) {
      Logger.log('Missing required field: email');
      return;
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(appointmentData.email)) {
      Logger.log('Invalid email format: ' + appointmentData.email);
      return;
    }

    // Generate Priority Client ID (pass the form response sheet)
    const formResponseSheet = e.range.getSheet();
    const clientId = generatePriorityClientID(formResponseSheet);
    appointmentData.clientId = clientId;

    // Update the form response row with the client ID
    updateFormResponseWithClientId(e.range, clientId);

    // Send confirmation email
    sendAppointmentConfirmation(appointmentData);

    Logger.log(`Appointment booked: ${clientId} for ${appointmentData.email} on ${appointmentData.preferredDate} at ${appointmentData.preferredTime}`);

  } catch (error) {
    Logger.log('Error processing appointment form submission: ' + error.message);
  }
}

/**
 * Helper function to safely get form values
 * @param {Object} namedValues - Form named values object
 * @param {string} fieldName - Name of the field to get
 * @returns {string} Field value or empty string
 */
function getFormValue(namedValues, fieldName) {
  const value = namedValues[fieldName];
  if (Array.isArray(value) && value.length > 0) {
    return value[0].trim();
  }
  return '';
}

/**
 * Generates a unique Priority Client ID (P001, P002, etc.)
 * Uses LockService to prevent race conditions
 * @param {Sheet} formResponseSheet - The sheet containing form responses
 * @returns {string} Generated client ID
 */
function generatePriorityClientID(formResponseSheet) {
  const lock = LockService.getScriptLock();

  try {
    // Wait up to 10 seconds for lock
    lock.waitLock(CONFIG.PERFORMANCE.LOCK_TIMEOUT_MS || 10000);

    // Find Client ID column in the form response sheet
    const headers = formResponseSheet.getRange(1, 1, 1, formResponseSheet.getLastColumn()).getValues()[0];
    let clientIdColIndex = headers.indexOf('Client ID');

    // If no Client ID column exists yet, start from P001
    if (clientIdColIndex === -1) {
      return 'P001';
    }

    const lastRow = formResponseSheet.getLastRow();
    if (lastRow <= 1) {
      return 'P001'; // Only header row exists
    }

    // Read all client IDs from the sheet
    const data = formResponseSheet.getRange(2, clientIdColIndex + 1, lastRow - 1, 1).getValues();

    // Find highest existing priority ID
    let maxNumber = 0;
    for (let i = 0; i < data.length; i++) {
      const clientId = data[i][0];
      if (clientId && typeof clientId === 'string' && clientId.startsWith('P')) {
        const num = parseInt(clientId.substring(1), 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }

    // Generate next ID
    const nextNumber = maxNumber + 1;
    const clientId = 'P' + String(nextNumber).padStart(3, '0');

    return clientId;

  } finally {
    lock.releaseLock();
  }
}

/**
 * Updates the form response row with the generated client ID
 * @param {Range} responseRange - Range of the form response row
 * @param {string} clientId - Generated client ID
 */
function updateFormResponseWithClientId(responseRange, clientId) {
  try {
    const sheet = responseRange.getSheet();
    const row = responseRange.getRow();

    // Find or create Client ID column
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let clientIdCol = headers.indexOf('Client ID') + 1;

    if (clientIdCol === 0) {
      // Add Client ID column
      clientIdCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, clientIdCol).setValue('Client ID');
    }

    // Set the client ID
    sheet.getRange(row, clientIdCol).setValue(clientId);

  } catch (error) {
    Logger.log('Error updating form response with client ID: ' + error.message);
  }
}

/**
 * Gets or creates the appointment booking sheet
 * @returns {Sheet} The appointment sheet
 */
function getOrCreateAppointmentSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(APPOINTMENT_CONFIG.SHEET_NAME);

  if (!sheet) {
    // Create the sheet with headers
    sheet = ss.insertSheet(APPOINTMENT_CONFIG.SHEET_NAME);
    const headers = ['Timestamp', 'Full Name', 'Email', 'Phone', 'Preferred Date', 'Preferred Time', 'Client ID', 'Confirmation Sent'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  return sheet;
}

/**
 * Sends appointment confirmation email
 * @param {Object} data - Appointment data
 */
function sendAppointmentConfirmation(data) {
  try {
    const emailBody = buildConfirmationEmailBody(data);
    const subject = `Tax Clinic Appointment Confirmation - ${data.clientId}`;

    MailApp.sendEmail({
      to: data.email,
      subject: subject,
      htmlBody: emailBody
    });

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
            <p><strong>Location:</strong> TBD</p>
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
            <p style="margin-bottom: 0;">For a complete checklist, visit <a href="http://taxclinic.uwaterloo.ca" style="color: #8e0000;">taxclinic.uwaterloo.ca</a></p>
          </div>

          <p>If you need to cancel or reschedule your appointment, please email us at <a href="mailto:taxclinic@uwafsa.com" style="color: #8e0000;">taxclinic@uwafsa.com</a>.</p>

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
 * Test function to manually test email sending
 * Run this to verify email template and sending works
 */
function testAppointmentConfirmation() {
  const testData = {
    fullName: 'Test User',
    email: 'your-email@example.com', // Change to your email for testing
    phone: '555-1234',
    preferredDate: 'Saturday, March 21, 2026',
    preferredTime: '10:00 AM',
    clientId: 'P999'
  };

  sendAppointmentConfirmation(testData);
  Logger.log('Test email sent!');
}

// ============================================================================
// FORM CREATION AND SETUP FUNCTIONS
// Run these once to create the Google Form and set up the trigger
// ============================================================================

/**
 * Creates the Appointment Booking Google Form
 * Run this once to create the form, then set up the trigger
 * @returns {Object} Form URL and edit URL
 */
function createAppointmentBookingForm() {
  // Create form
  const form = FormApp.create('AFSA Tax Clinic - Book Appointment');

  // Set form description
  form.setDescription(
    'Book an appointment for complex tax situations at the UW AFSA Tax Clinic.\n\n' +
    'You will receive a confirmation email with your Client ID after submitting.'
  );

  // Set confirmation message
  form.setConfirmationMessage(
    'Thank you for booking!\n\n' +
    'You will receive a confirmation email shortly with your Client ID.\n' +
    'Please bring this ID to your appointment.'
  );

  // Full Name (required)
  form.addTextItem()
    .setTitle('Full Name')
    .setRequired(true);

  // Email (required with validation)
  form.addTextItem()
    .setTitle('Email')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .requireTextIsEmail()
      .build());

  // Phone Number (optional)
  form.addTextItem()
    .setTitle('Phone Number')
    .setRequired(false)
    .setHelpText('Optional - for contact if needed');

  // Preferred Date (multiple choice)
  form.addMultipleChoiceItem()
    .setTitle('Preferred Date')
    .setChoiceValues([
      'Saturday, March 21, 2026',
      'Sunday, March 22, 2026',
      'Saturday, March 28, 2026',
      'Sunday, March 29, 2026'
    ])
    .setRequired(true);

  // Preferred Time (multiple choice) - last slot at 6 PM to allow buffer before 7:30 close
  form.addMultipleChoiceItem()
    .setTitle('Preferred Time')
    .setChoiceValues([
      '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM',
      '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'
    ])
    .setRequired(true);

  // Link form to spreadsheet
  const ss = getSpreadsheet();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // Get URLs
  const publishedUrl = form.getPublishedUrl();
  const editUrl = form.getEditUrl();

  Logger.log('Form created successfully!');
  Logger.log('Published URL (for clients): ' + publishedUrl);
  Logger.log('Edit URL (for admins): ' + editUrl);

  return {
    publishedUrl: publishedUrl,
    editUrl: editUrl,
    formId: form.getId()
  };
}

/**
 * Sets up the form submit trigger for the appointment form
 * Run this after creating the form
 */
function setupAppointmentFormTrigger() {
  const ss = getSpreadsheet();

  // Check if trigger already exists
  const triggers = ScriptApp.getUserTriggers(ss);
  const existingTrigger = triggers.find(t =>
    t.getHandlerFunction() === 'onAppointmentFormSubmit'
  );

  if (existingTrigger) {
    Logger.log('Trigger already exists. Delete it first if you want to recreate.');
    return;
  }

  // Create new trigger
  ScriptApp.newTrigger('onAppointmentFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  Logger.log('Form submit trigger created successfully!');
}

// ============================================================================
// APPOINTMENT PRE-LOADING FUNCTIONS (DEPRECATED)
// These functions have been replaced by manual Appointment ID lookup in the intake form.
// Appointment clients now provide their P-ID at check-in, which is simpler and more reliable.
// ============================================================================

// NOTE: The following functions have been removed:
// - preloadUpcomingAppointments() - No longer needed; receptionists enter appointment ID manually
// - parseAppointmentTime() - Was only used by preloadUpcomingAppointments
// - setupAppointmentPreloadTrigger() - No longer needed
// - deleteAppointmentPreloadTrigger() - Run this once to clean up any existing trigger, then remove

/**
 * One-time cleanup function to remove the preload trigger if it exists.
 * Run this once after deploying this update, then this function can be removed.
 */
function cleanupPreloadTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let found = false;
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'preloadUpcomingAppointments') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Preload trigger deleted');
      found = true;
    }
  });
}
