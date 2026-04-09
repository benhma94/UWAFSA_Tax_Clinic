/**
 * Volunteer Management Backend
 * Provides volunteer data and email sending for the Volunteer Management admin page.
 */

/**
 * Returns the full consolidated volunteer list for the management UI.
 * Called client-side via google.script.run.getVolunteerManagementData()
 *
 * @returns {Array<Object>} Array of {name, firstName, lastName, email, role,
 *                          efileNum, attendedTraining}, sorted alphabetically by name.
 */
function getVolunteerManagementData() {
  const volunteers = getConsolidatedVolunteerList_();
  volunteers.sort((a, b) => a.name.localeCompare(b.name));
  return volunteers;
}

/**
 * Sends a BCC email to the given list of email addresses from the clinic account.
 * Called client-side via google.script.run.sendVolunteerBccEmail(...)
 *
 * @param {string[]} emails - Recipient email addresses (sent as BCC)
 * @param {string} subject  - Email subject line
 * @param {string} body     - Plain-text email body
 * @returns {Object} { success: true }
 */
function sendVolunteerBccEmail(emails, subject, body) {
  if (!emails || emails.length === 0) throw new Error('No recipients selected.');
  if (!subject || !subject.trim()) throw new Error('Subject is required.');
  if (!body || !body.trim()) throw new Error('Body is required.');

  // Send from clinic account. "to" is the clinic address so the BCC list isn't exposed.
  GmailApp.sendEmail(SECRETS.CLINIC_EMAIL, subject.trim(), body.trim(), {
    bcc: emails.join(','),
    name: 'AFSA Tax Clinic'
  });

  return { success: true };
}
