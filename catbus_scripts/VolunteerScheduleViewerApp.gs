/**
 * Volunteer Schedule Viewer App Entry Point
 * This is the entry point for the Volunteer Schedule Viewer web app deployment
 */

/**
 * Entry point for Volunteer Schedule Viewer web app
 * @returns {HtmlOutput} The HTML output for the schedule viewer
 */
function doGetVolunteerScheduleViewer() {
  return HtmlService.createHtmlOutputFromFile('volunteer_schedule_dashboard')
    .setTitle('Volunteer Schedule Viewer')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
