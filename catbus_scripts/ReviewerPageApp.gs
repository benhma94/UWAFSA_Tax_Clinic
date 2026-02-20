/**
 * Reviewer Page App Entry Point
 * Provides a dedicated interface for mentors to review and approve returns remotely
 */

/**
 * Serves the reviewer dashboard HTML page
 * @param {Object} e - Event object from doGet
 * @returns {HtmlOutput} The HTML page
 */
function doGetReviewerPage() {
  return HtmlService.createTemplateFromFile('reviewer_page')
    .evaluate()
    .setTitle('CATBUS Reviewer Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
