/**
 * Queue Dashboard App Entry Point
 * This is the entry point for the Queue Dashboard web app deployment
 */

/**
 * Entry point for Queue Dashboard web app
 * @returns {HtmlOutput} The HTML output for the queue dashboard
 */
function doGetQueueDashboard() {
  return HtmlService.createTemplateFromFile('queue_dashboard')
    .evaluate()
    .setTitle('Tax Clinic Queue Master Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

