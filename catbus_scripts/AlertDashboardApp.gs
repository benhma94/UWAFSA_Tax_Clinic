/**
 * Alert Dashboard App Entry Point
 * Serves the alert dashboard for help requests and review requests
 */

/**
 * Entry point for Alert Dashboard web app
 * @returns {HtmlOutput} The HTML output for the alert dashboard
 */
function doGetAlertDashboard() {
  const template = HtmlService.createTemplateFromFile('alert_dashboard');
  template.baseUrl = ScriptApp.getService().getUrl();
  return template.evaluate()
    .setTitle('Alert Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}
