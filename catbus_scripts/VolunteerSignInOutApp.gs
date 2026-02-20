/**
 * Volunteer Sign-In/Out App Entry Point
 * This is the entry point for the Volunteer Sign-In/Out web app deployment
 */

/**
 * Entry point for Volunteer Sign-In/Out web app
 * @returns {HtmlOutput} The HTML output for the sign-in/out interface
 */
function doGetVolunteerSignInOut() {
  return HtmlService.createTemplateFromFile('volunteer_signinout')
    .evaluate()
    .setTitle('Volunteer Sign-In / Sign-Out')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
