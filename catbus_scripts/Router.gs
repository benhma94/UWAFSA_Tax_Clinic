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
      return doGet_Messaging(e);
    default:
      return doGetClientIntake(); // Default fallback to intake
  }
}
