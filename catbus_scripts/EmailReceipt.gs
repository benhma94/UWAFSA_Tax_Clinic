/**
 * Email Receipt Functions
 * Backend functions for email receipt functionality
 */

/**
 * Sends receipt email to client with optional file attachments
 * @param {Object} emailData - Email data object
 * @param {string} emailData.clientEmail - Client email address
 * @param {string} emailData.refundBalance - Refund/Balance Owing information
 * @param {string} emailData.refundLabel - Label for refund/balance ("Refund" or "Balance Owing")
 * @param {string} emailData.gstHst - GST/HST amount
 * @param {string} emailData.onBen - Ontario Benefit amount
 * @param {string} emailData.other - Other Amounts (formatted currency)
 * @param {string} emailData.notes - Additional notes (text)
 * @param {number} emailData.totalAmount - Total sum of all numeric amounts
 * @param {string} emailData.ufilePassword - UFILE password
 * @param {string} emailData.efileConfirmation - E-File confirmation number (only for efile)
 * @param {string} filingStatus - Filing status (efile or paper)
 * @param {string} taxYear - Tax year (e.g., "2024")
 * @param {Array} fileDataArray - Array of file objects with {name, data (base64), mimeType}
 * @returns {Object} Result object with success status
 */
function sendReceiptEmail(emailData, filingStatus, taxYear, fileDataArray) {
  try {
    // Validate inputs
    if (!emailData || !emailData.clientEmail) {
      throw new Error('Client email is required');
    }

    const clientEmail = emailData.clientEmail.trim();
    
    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(clientEmail)) {
      throw new Error('Invalid email address format');
    }

    // Build email body
    const emailBody = buildReceiptEmailBody(emailData, filingStatus);
    
    // Build email subject with tax year
    const taxYearDisplay = taxYear ? taxYear.trim() : '';
    const subject = taxYearDisplay ? `Tax Year ${taxYearDisplay} Tax Return Receipt` : `Tax Return Receipt - ${filingStatus.toUpperCase()}`;

    // Convert base64 file data to blobs for attachments
    const attachments = [];
    if (fileDataArray && fileDataArray.length > 0) {
      fileDataArray.forEach(fileData => {
        try {
          // Convert base64 to blob
          const base64Data = fileData.data;
          const byteCharacters = Utilities.base64Decode(base64Data);
          const blob = Utilities.newBlob(byteCharacters, fileData.mimeType, fileData.name);
          attachments.push(blob);
        } catch (fileError) {
          Logger.log('Error processing file ' + fileData.name + ': ' + fileError.message);
          // Continue with other files even if one fails
        }
      });
    }

    // Send email with attachments (if any)
    const emailOptions = {
      to: clientEmail,
      subject: subject,
      htmlBody: emailBody
    };

    if (attachments.length > 0) {
      emailOptions.attachments = attachments;
    }

    MailApp.sendEmail(emailOptions);

    Logger.log(`Receipt email sent successfully to ${clientEmail}${attachments.length > 0 ? ' with ' + attachments.length + ' attachment(s)' : ''}`);
    
    return {
      success: true,
      message: 'Email sent successfully',
      recipient: clientEmail,
      attachmentCount: attachments.length
    };

  } catch (error) {
    Logger.log('Error sending receipt email: ' + error.message);
    throw new Error('Failed to send email: ' + error.message);
  }
}

/**
 * Formats a number as currency in accounting format ($X,XXX.XX)
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
  const formatted = Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + formatted;
}

/**
 * Builds the HTML email body for the receipt
 * @param {Object} emailData - Email data object
 * @param {string} filingStatus - Filing status
 * @returns {string} HTML email body
 */
function buildReceiptEmailBody(emailData, filingStatus) {
  const filingStatusDisplay = filingStatus === 'efile' ? 'EFILE' : 'Paper';
  
  let body = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #8e0000;">Tax Return Receipt</h2>
          
          <p>Dear Client,</p>
          
          <p>Thank you for attending the UW AFSA Tax Clinic:</p>
          
          ${filingStatus === 'efile' ? `
            <p>Your return was successfully filed via E-FILE.</p>
          ` : ''}
          
          ${filingStatus === 'paper' ? `
            <p>It was indicated that your return was completed via Paper File. You are responsible for mailing this return to the CRA in order to complete your return.</p>
          ` : ''}
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #8e0000;">Return Summary:</h3>
            
            ${emailData.refundBalance && emailData.refundLabel ? `
              <p><strong>${emailData.refundLabel}:</strong> ${emailData.refundBalance}</p>
            ` : ''}
            
            ${emailData.gstHst ? `
              <p><strong>GST/HST Credit:</strong> ${emailData.gstHst}, paid over 4 quarterly payments</p>
            ` : ''}
            
            ${emailData.onBen ? `
              <p><strong>Ontario Trillium Benefit:</strong> ${emailData.onBen}, paid over 12 monthly payments</p>
            ` : ''}
            
            ${emailData.other ? `
              <p><strong>Other Amounts:</strong> ${emailData.other}</p>
            ` : ''}
            
            ${emailData.ufilePassword ? `
              <p><strong>UFILE Password:</strong> ${emailData.ufilePassword}</p>
            ` : ''}
            
            ${emailData.efileConfirmation ? `
              <p><strong>E-File Confirmation Number:</strong> ${emailData.efileConfirmation}</p>
            ` : ''}
          </div>
          
          ${emailData.totalAmount !== undefined && emailData.totalAmount !== null && emailData.totalAmount !== 0 ? `
            <div style="background-color: ${emailData.totalAmount >= 0 ? '#e8f5e9' : '#ffebee'}; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${emailData.totalAmount >= 0 ? '#27ae60' : '#c0392b'};">
              ${emailData.totalAmount >= 0 ? `
                <p style="margin: 0; font-size: 1.1em; font-weight: bold; color: #27ae60;">
                  <strong>Total amounts to be paid to you over the course of the year:</strong> ${formatCurrency(Math.abs(emailData.totalAmount))}
                </p>
              ` : `
                <p style="margin: 0; font-size: 1.1em; font-weight: bold; color: #c0392b;">
                  <strong>Net balance owed by you after all credits:</strong> ${formatCurrency(Math.abs(emailData.totalAmount))}
                </p>
              `}
            </div>
          ` : ''}
          
          ${emailData.notes ? `
            <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px; border-left: 4px solid #8e0000;">
              <h3 style="margin-top: 0; color: #8e0000;">Notes:</h3>
              <p style="white-space: pre-wrap; margin: 0;">${emailData.notes}</p>
            </div>
          ` : ''}
          
          <p>For Post-Filing questions, please go to <a href="https://taxclinic.uwaterloo.ca/PostFiling" style="color: #8e0000; text-decoration: underline;">taxclinic.uwaterloo.ca/PostFiling</a>. If you have any further questions, please contact the Tax Clinic.</p>
          
          <p>Thank you,<br>
          UW AFSA Tax Clinic</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated email from the UW AFSA Tax Clinic. Please note that these receipts are automatically deleted from our outbox and are not retained.
          </p>
        </div>
      </body>
    </html>
  `;
  
  return body;
}

/**
 * Test function to check email quota
 * @returns {Object} Quota information
 */
function checkEmailQuota() {
  try {
    const remaining = MailApp.getRemainingDailyQuota();
    const estimatedTotal = remaining >= 100 ? 1500 : 100;
    
    return {
      remaining: remaining,
      estimatedTotal: estimatedTotal,
      used: estimatedTotal - remaining
    };
  } catch (error) {
    Logger.log('Error checking email quota: ' + error.message);
    return {
      error: error.message
    };
  }
}