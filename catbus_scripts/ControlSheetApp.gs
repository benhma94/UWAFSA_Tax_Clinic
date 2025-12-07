/**
 * Control Sheet App Entry Point
 * This is the entry point for the Control Sheet web app deployment
 */

/**
 * Entry point for Control Sheet web app
 * @returns {HtmlOutput} The HTML output for the control sheet form
 */
function doGetControlSheet() {
  return HtmlService.createHtmlOutputFromFile('control_sheet_form')
    .setTitle('AFSA Tax Clinic Control Sheet')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
