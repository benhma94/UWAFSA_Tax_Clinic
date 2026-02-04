/**
 * Client Intake App Entry Point
 * This is the entry point for the Client Intake web app deployment
 */

/**
 * Entry point for Client Intake web app
 * @returns {HtmlOutput} The HTML output for the intake form
 */
function doGetClientIntake() {
  return HtmlService.createTemplateFromFile('catbus_intake_form')
    .evaluate()
    .setTitle('AFSA Tax Clinic Intake Form')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
