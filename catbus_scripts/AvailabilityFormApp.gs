/**
 * Availability Form App Entry Point
 * This is the entry point for the Availability Form web app deployment
 */

/**
 * Entry point for Availability Form web app
 * @returns {HtmlOutput} The HTML output for the availability form
 */
function doGetAvailabilityForm() {
  return HtmlService.createTemplateFromFile('availability_form')
    .evaluate()
    .setTitle('Volunteer Availability Form')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
