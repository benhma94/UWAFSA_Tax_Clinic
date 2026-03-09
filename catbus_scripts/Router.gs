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

  const app = e?.parameter?.app || 'intake'; // Default to intake if no parameter

  switch(app) {
    case 'intake':
      return doGetClientIntake();
    case 'queue':
      return doGetQueueDashboard();
    case 'control':
      return doGetControlSheet();
    case 'admin':
      return doGetAdminDashboard();
    case 'alerts':
      return doGetAlertDashboard();
    case 'schedule':
      return doGetVolunteerScheduleViewer();
    case 'assignment':
      return doGetScheduleDashboard();
    case 'scheduleviewer':
    case 'scheduleview':
      return doGetVolunteerScheduleViewer(); // Keep for backwards compatibility
    case 'availability':
    case 'availabilityform':
      return doGetAvailabilityForm();
    case 'signin':
    case 'signinout':
      return doGetVolunteerSignInOut();
    case 'messaging':
      return doGetMessaging();
    case 'productcodes':
      return doGetProductCodeDistribution();
    case 'reviewer':
      return doGetReviewerPage();
    case 'quiz':
      return doGetQuizSubmission();
    case 'quizreview':
      return doGetQuizReview();
    default:
      return doGetClientIntake(); // Default fallback to intake
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
