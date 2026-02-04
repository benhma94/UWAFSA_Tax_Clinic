/**
 * Messaging Admin App Entry Point
 * Provides the web interface for managers to send messages to volunteers
 */

/**
 * Serves the messaging admin HTML page
 * @param {Object} e - Event object from doGet
 * @returns {HtmlOutput} The HTML page
 */
function doGet_Messaging(e) {
  return HtmlService.createTemplateFromFile('messaging_admin')
    .evaluate()
    .setTitle('CATBUS Messaging')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
