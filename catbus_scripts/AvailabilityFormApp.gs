/**
 * Availability Form App Entry Point
 * This is the entry point for the Availability Form web app deployment
 */

/**
 * Entry point for Availability Form web app
 * @returns {HtmlOutput} The HTML output for the availability form
 */
function doGetAvailabilityForm() {
  return HtmlService.createHtmlOutputFromFile('availability_form')
    .setTitle('Volunteer Availability Form')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
