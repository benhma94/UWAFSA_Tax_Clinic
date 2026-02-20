/**
 * Volunteer Schedule Viewer App Entry Point
 * This is the entry point for the Volunteer Schedule Viewer web app deployment
 */

/**
 * Entry point for Volunteer Schedule Viewer web app
 * @returns {HtmlOutput} The HTML output for the schedule viewer
 */
function doGetVolunteerScheduleViewer() {
  return HtmlService.createTemplateFromFile('volunteer_schedule_dashboard')
    .evaluate()
    .setTitle('Volunteer Schedule Viewer')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
