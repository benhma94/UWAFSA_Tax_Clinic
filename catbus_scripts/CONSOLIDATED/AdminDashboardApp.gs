/**
 * Admin Dashboard App Entry Point
 * This is the entry point for the Admin Dashboard web app deployment
 */

/**
 * Entry point for Admin Dashboard web app
 * @returns {HtmlOutput} The HTML output for the admin dashboard
 */
function doGetAdminDashboard() {
  return HtmlService.createHtmlOutputFromFile('admin_dashboard')
    .setTitle('Live Help Request Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
