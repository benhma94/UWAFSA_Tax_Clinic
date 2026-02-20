/**
 * Messaging Admin App Entry Point
 * Provides the web interface for managers to send messages to volunteers
 */

/**
 * Serves the messaging admin HTML page
 * @param {Object} e - Event object from doGet
 * @returns {HtmlOutput} The HTML page
 */
function doGetMessaging() {
  return HtmlService.createTemplateFromFile('messaging_admin')
    .evaluate()
    .setTitle('CATBUS Messaging')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
