/**
 * Router for Web App Deployments
 * Routes requests to the correct app based on query parameter
 */

/**
 * Main entry point for all web app deployments
 * Routes to the correct app based on the 'app' query parameter
 * Defaults to 'intake' if no parameter is provided
 *
 * @param {Object} e - Event object with query parameters
 * @returns {HtmlOutput} The HTML output for the requested app
 */
function doGet(e) {
  // Handle API actions from static web pages (GET with action= parameter)
  const action = e?.parameter?.action;
  if (action === 'volunteerApplication') {
    try {
      submitVolunteerApplication(e.parameter);
      return ContentService.createTextOutput('OK');
    } catch (err) {
      Logger.log('volunteerApplication error: ' + err.message);
      return ContentService.createTextOutput('Error: ' + err.message);
    }
  }

  if (action === 'appointmentBooking') {
    try {
      submitAppointmentBooking(e.parameter);
      return ContentService.createTextOutput('OK');
    } catch (err) {
      Logger.log('appointmentBooking error: ' + err.message);
      return ContentService.createTextOutput('Error: ' + err.message);
    }
  }

  if (action === 'feedback') {
    try {
      submitFeedback(e.parameter);
      return ContentService.createTextOutput('OK');
    } catch (err) {
      Logger.log('feedback error: ' + err.message);
      return ContentService.createTextOutput('Error: ' + err.message);
    }
  }

  if (action === 'volunteerFeedback') {
    try {
      submitVolunteerFeedback(e.parameter);
      return ContentService.createTextOutput('OK');
    } catch (err) {
      Logger.log('volunteerFeedback error: ' + err.message);
      return ContentService.createTextOutput('Error: ' + err.message);
    }
  }

  if (action === 'getEligibilityConfig') {
    return ContentService.createTextOutput(JSON.stringify(ELIGIBILITY_CONFIG))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const ALLOW = HtmlService.XFrameOptionsMode.ALLOWALL;
  const baseUrl = ScriptApp.getService().getUrl();
  const app = e?.parameter?.app || 'intake';

  switch (app) {
    case 'intake':
      return loadPage('catbus_intake_form', 'AFSA Tax Clinic Intake Form', { xframe: ALLOW, vars: { websiteUrl: CONFIG.CLINIC_WEBSITE_URL + '/catbus' } });
    case 'queue':
      return loadPage('queue_dashboard', 'Tax Clinic Queue Master Dashboard', { xframe: ALLOW, vars: { websiteUrl: CONFIG.CLINIC_WEBSITE_URL + '/catbus' } });
    case 'control':
      return loadPage('control_sheet_form', 'AFSA Tax Clinic Control Sheet', { xframe: ALLOW, vars: { websiteUrl: CONFIG.CLINIC_WEBSITE_URL + '/catbus' } });
    case 'admin':
      return loadPage('admin_dashboard', 'Admin Dashboard', { vars: { baseUrl, adminWebsiteUrl: CONFIG.CLINIC_WEBSITE_URL + '/admin' } });
    case 'alerts':
      return loadPage('alert_dashboard', 'Alert Dashboard', { vars: { baseUrl, adminWebsiteUrl: CONFIG.CLINIC_WEBSITE_URL + '/admin' } });
    case 'signin':
    case 'signinout':
      return loadPage('volunteer_signinout', 'Volunteer Sign-In / Sign-Out', { vars: { websiteUrl: CONFIG.CLINIC_WEBSITE_URL + '/catbus' } });
    case 'volunteer':
      return loadPage('volunteer_dashboard', 'Volunteer Dashboard', { xframe: ALLOW });
    case 'schedule':
    case 'scheduleviewer':
      return loadPage('volunteer_schedule_dashboard', 'Schedule by Day', { xframe: ALLOW });
    case 'assignment':
      return loadPage('schedule_dashboard', 'Tax Clinic Schedule Generator', { xframe: ALLOW });
    case 'availability':
      return loadPage('availability_form', 'Volunteer Availability Form', { xframe: ALLOW, sandbox: true });
    case 'productcodes':
      return loadPage('product_code_dashboard', 'Product Code Distribution');
    case 'quiz':
      return loadPage('quiz_submission', 'Tax Clinic Training Quiz', { xframe: ALLOW });
    case 'quizreview':
      return loadPage('quiz_review', 'Quiz Review');
    default:
      return loadPage('catbus_intake_form', 'AFSA Tax Clinic Intake Form', { xframe: ALLOW });
  }
}

/**
 * Handles POST requests from static web pages (e.g. volunteer application form).
 * Uses URL-encoded form data (e.parameter) since fetch is called with no-cors mode.
 *
 * @param {Object} e - Event object with POST parameters
 * @returns {TextOutput}
 */
function doPost(e) {
  try {
    const action = e?.parameter?.action;
    if (action === 'volunteerApplication') {
      submitVolunteerApplication(e.parameter);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    Logger.log('doPost: unknown action: ' + action);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
