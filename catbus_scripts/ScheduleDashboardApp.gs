/**
 * Schedule Dashboard App Entry Point
 * This is the entry point for the Schedule Dashboard web app deployment
 */

/**
 * Entry point for Schedule Dashboard web app
 * @returns {HtmlOutput} The HTML output for the schedule dashboard
 */
function doGetScheduleDashboard() {
  return HtmlService.createTemplateFromFile('schedule_dashboard')
    .evaluate()
    .setTitle('Tax Clinic Schedule Generator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
