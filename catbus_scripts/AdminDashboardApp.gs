/**
 * Admin Dashboard App Entry Point
 * This is the entry point for the Admin Dashboard web app deployment
 */

/**
 * Entry point for Admin Dashboard web app
 * @returns {HtmlOutput} The HTML output for the admin dashboard
 */
function doGetAdminDashboard() {
  const template = HtmlService.createTemplateFromFile('admin_dashboard');
  template.baseUrl = ScriptApp.getService().getUrl();
  return template.evaluate()
    .setTitle('Admin Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.SAMEORIGIN);
}
