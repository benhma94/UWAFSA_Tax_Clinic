/**
 * Schedule Change Notification Functions
 * Handles sending email notifications when volunteer schedules change
 */

/**
 * Builds HTML email body for schedule change notification
 * @param {string} name - Volunteer name
 * @param {Array<string>} oldShifts - Previous shift IDs
 * @param {Array<string>} newShifts - New shift IDs
 * @param {Array<string>} dayLabels - Labels for days 1-4
 * @returns {string} HTML email body
 */
function buildScheduleChangeEmailBody(name, oldShifts, newShifts, dayLabels) {
  const days = dayLabels || ['Day 1', 'Day 2', 'Day 3', 'Day 4'];
  const slotLabels = { 'A': 'Morning', 'B': 'Afternoon', 'C': 'Evening' };

  // Helper to format shift ID to readable string
  const formatShift = (shiftId) => {
    const dayIdx = parseInt(shiftId.charAt(1)) - 1;
    const slotKey = shiftId.charAt(2);
    const timeSlot = SCHEDULE_CONFIG.TIME_SLOTS[slotKey];
    return `${days[dayIdx]} - ${slotLabels[slotKey]} (${timeSlot.display})`;
  };

  const formatShiftList = (shifts) => {
    if (!shifts || shifts.length === 0) return '<em>None</em>';
    return '<ul style="margin: 5px 0; padding-left: 20px;">' +
      shifts.sort().map(s => `<li>${formatShift(s)}</li>`).join('') +
      '</ul>';
  };

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #8e0000;">Tax Clinic Schedule Update</h2>

      <p>Hi ${name},</p>

      <p>Your volunteer schedule for the UW AFSA Tax Clinic has been updated.</p>

      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #666;">Previous Shifts:</h3>
        ${formatShiftList(oldShifts)}

        <h3 style="color: #666;">New Shifts:</h3>
        ${formatShiftList(newShifts)}
      </div>

      <p>Please review the updated schedule. If you have any questions or concerns, please let us know.</p>

      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        — UW AFSA Tax Clinic
      </p>
    </div>
  `;
}

/**
 * Sends schedule change notification emails to affected volunteers
 * @param {Object} oldAssignments - Previous schedule {name: [shiftIds...]}
 * @param {Object} newAssignments - New schedule {name: [shiftIds...]}
 * @param {Array<Object>} volunteers - Volunteer objects with email addresses
 * @param {Array<string>} dayLabels - Labels for days 1-4
 * @returns {number} Number of emails sent
 */
function sendScheduleChangeNotifications(oldAssignments, newAssignments, volunteers, dayLabels) {
  if (!oldAssignments) {
    Logger.log('No previous schedule to compare - skipping notifications');
    return { count: 0, recipients: [] };
  }

  let emailsSent = 0;
  const notifiedRecipients = [];
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Build email lookup from volunteers array
  const volunteerEmails = {};
  for (const v of volunteers) {
    if (v.email) {
      volunteerEmails[v.name] = v.email;
    }
  }

  // Check each volunteer in the NEW schedule who was also in the OLD schedule
  for (const volunteer of volunteers) {
    const name = volunteer.name;
    const oldShifts = oldAssignments[name];
    const newShifts = newAssignments[name] || [];

    // Skip if volunteer wasn't in old schedule (new addition - don't notify per requirements)
    if (!oldShifts) continue;

    // Compare shifts (sort both for comparison)
    const oldSorted = [...oldShifts].sort().join(',');
    const newSorted = [...newShifts].sort().join(',');

    if (oldSorted === newSorted) continue; // No change

    // Shifts changed - send notification
    const email = volunteer.email;
    if (!email || !emailPattern.test(email)) {
      Logger.log(`Skipping notification for ${name}: invalid or missing email`);
      continue;
    }

    try {
      const subject = 'Your Tax Clinic Schedule Has Changed';
      const htmlBody = buildScheduleChangeEmailBody(name, oldShifts, newShifts, dayLabels);

      sendEmail({
        to: email,
        subject: subject,
        htmlBody: htmlBody
      }, 'sendScheduleChangeNotifications');

      Logger.log(`Schedule change notification sent to ${name} (${email})`);
      emailsSent++;
      notifiedRecipients.push({ name, email });
    } catch (e) {
      Logger.log(`Failed to send notification to ${name}: ${e.message}`);
    }
  }

  Logger.log(`Schedule change notifications sent: ${emailsSent}`);
  return { count: emailsSent, recipients: notifiedRecipients };
}
