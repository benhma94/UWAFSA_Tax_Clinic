/**
 * Expense Tracking Backend
 * Handles receipt OCR, expense logging, and PDF report generation.
 *
 * One-time setup: Run initExpensesSetup() from the Apps Script editor before first use.
 * Requires: Drive Advanced Service enabled in appsscript.json (already added).
 */

/**
 * OCRs a receipt image using Google Drive's built-in OCR.
 * Converts the image to a Google Doc, extracts the text, then deletes the temp doc.
 *
 * @param {string} base64Data - Base64-encoded image data
 * @param {string} mimeType - MIME type (e.g. 'image/jpeg', 'image/png')
 * @returns {Object} { amount, date, vendor, rawText }
 */
function ocrReceipt_(base64Data, mimeType) {
  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, 'receipt_ocr_temp');
  var resource = { title: 'receipt_ocr_temp' };
  var file = Drive.Files.insert(resource, blob, { convert: true });
  try {
    var doc = DocumentApp.openById(file.id);
    var text = doc.getBody().getText();
    return parseReceiptText_(text);
  } finally {
    try { DriveApp.getFileById(file.id).setTrashed(true); } catch (e) { /* ignore */ }
  }
}

/**
 * Parses raw OCR text to extract expense fields.
 * Returns best-guess values; the user always reviews before submitting.
 *
 * @param {string} text - Raw OCR text from receipt
 * @returns {Object} { amount, date, vendor, rawText }
 */
function parseReceiptText_(text) {
  var result = { amount: '', date: '', vendor: '', rawText: text };
  if (!text) return result;

  // Amount: first try to find values explicitly labeled as total/due/balance.
  // Prefer the last matching total line on the receipt (bottom-most), which is
  // usually the actual payable total. Ignore subtotal lines.
  var lines = text.split(/\r?\n/);
  var strongTotalLabelRegex = /\b(grand\s*total|total\s*due|amount\s*due|balance\s*due|net\s*total)\b/i;
  var genericTotalLabelRegex = /(^|[^a-z])total([^a-z]|$)/i;
  var lineAmountRegex = /\$\s*(\d{1,4}(?:[,]\d{3})*(?:[.]\d{2})?|\d{1,4}[.]\d{2})|\b(\d{1,4}(?:[,]\d{3})*[.]\d{2})\b/g;
  var labeledTotal = null;

  for (var li = 0; li < lines.length; li++) {
    var line = lines[li] || '';
    var lowerLine = line.toLowerCase();
    if (/\bsub\s*total\b/.test(lowerLine)) continue;

    var priority = 0;
    if (strongTotalLabelRegex.test(line)) {
      priority = 2;
    } else if (genericTotalLabelRegex.test(line)) {
      priority = 1;
    }
    if (!priority) continue;

    var amountMatch;
    var lineAmounts = [];
    lineAmountRegex.lastIndex = 0;
    while ((amountMatch = lineAmountRegex.exec(line)) !== null) {
      var raw = amountMatch[1] || amountMatch[2] || '';
      var amountVal = parseFloat(raw.replace(/,/g, ''));
      if (!isNaN(amountVal) && amountVal > 0 && amountVal < 100000) {
        lineAmounts.push(amountVal);
      }
    }

    if (lineAmounts.length === 0) continue;

    // Most receipts place the relevant value at the end of the total line.
    var lineTotal = lineAmounts[lineAmounts.length - 1];
    if (!labeledTotal || priority > labeledTotal.priority || (priority === labeledTotal.priority && li > labeledTotal.lineIndex)) {
      labeledTotal = {
        amount: lineTotal,
        priority: priority,
        lineIndex: li
      };
    }
  }

  if (labeledTotal) {
    result.amount = labeledTotal.amount.toFixed(2);
  }

  var amounts = [];
  var amountRegex = /\$?\s*(\d{1,4}(?:[,]\d{3})*(?:[.]\d{2})?|\d{1,4}[.]\d{2})/g;
  var match;
  while ((match = amountRegex.exec(text)) !== null) {
    var val = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0 && val < 100000) amounts.push(val);
  }
  if (!result.amount && amounts.length > 0) {
    result.amount = Math.max.apply(null, amounts).toFixed(2);
  }

  // Date: look for common formats (MM/DD/YYYY, Month DD YYYY, YYYY-MM-DD, etc.)
  var datePatterns = [
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4})\b/i,
    /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/
  ];
  for (var p = 0; p < datePatterns.length; p++) {
    var dateMatch = text.match(datePatterns[p]);
    if (dateMatch) { result.date = dateMatch[1]; break; }
  }

  // Vendor: first meaningful non-empty line (usually the store name)
  var vendorLines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 2; });
  if (vendorLines.length > 0) result.vendor = vendorLines[0].substring(0, 80);

  return result;
}

/**
 * OCRs a receipt and returns parsed fields for the frontend to display.
 * Called via google.script.run.
 *
 * @param {string} base64Data - Base64-encoded image
 * @param {string} mimeType - Image MIME type
 * @returns {Object} { success, amount, date, vendor, rawText } or { success: false, message }
 */
function ocrReceiptForReview(base64Data, mimeType) {
  try {
    var parsed = ocrReceipt_(base64Data, mimeType);
    return { success: true, amount: parsed.amount, date: parsed.date, vendor: parsed.vendor, rawText: parsed.rawText };
  } catch (err) {
    Logger.log('ocrReceiptForReview error: ' + err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Test DocumentApp authorization by creating and removing a temporary doc.
 * Use this to force the deployer to accept the Documents permission.
 *
 * @returns {{success: boolean, message: string}}
 */
function ensureDocumentAuthorization() {
  try {
    var doc = DocumentApp.create('CATBUS Authorization Test');
    DriveApp.getFileById(doc.getId()).setTrashed(true);
    return { success: true, message: 'Documents permission is granted.' };
  } catch (err) {
    Logger.log('ensureDocumentAuthorization error: ' + err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Normalizes text fields for storage/report rendering.
 *
 * @param {*} value
 * @param {number} maxLen
 * @returns {string}
 */
function normalizeExpenseText_(value, maxLen) {
  var text = (value || '').toString().trim();
  if (!text) return '';
  return text.substring(0, maxLen || 255);
}

/**
 * Normalizes amount values by stripping currency symbols and commas.
 *
 * @param {*} value
 * @returns {number}
 */
function normalizeExpenseAmount_(value) {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : Math.round(value * 100) / 100;
  }
  var cleaned = (value || '').toString().replace(/[$,\s]/g, '');
  var parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

/**
 * Normalizes supported date values to yyyy-MM-dd.
 *
 * @param {*} value
 * @returns {string}
 */
function normalizeExpenseDate_(value) {
  if (!value) return '';
  var dateObj = (value instanceof Date) ? value : new Date(value);
  if (isNaN(dateObj.getTime())) return '';
  return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Accepts new object payload and old 3-argument signature.
 *
 * @param {Object|string} startDateOrPayload
 * @param {string} endDate
 * @param {string} submitterName
 * @returns {Object}
 */
function normalizeReportPayload_(startDateOrPayload, endDate, submitterName) {
  if (startDateOrPayload && typeof startDateOrPayload === 'object') {
    return {
      startDate: startDateOrPayload.startDate || '',
      endDate: startDateOrPayload.endDate || '',
      submitterName: normalizeExpenseText_(startDateOrPayload.submitterName, 120),
      requestDate: startDateOrPayload.requestDate || '',
      email: normalizeExpenseText_(startDateOrPayload.email, 120),
      address: normalizeExpenseText_(startDateOrPayload.address, 200),
      department: normalizeExpenseText_(startDateOrPayload.department, 120),
      deliveryNote: normalizeExpenseText_(startDateOrPayload.deliveryNote, 200)
    };
  }

  return {
    startDate: startDateOrPayload || '',
    endDate: endDate || '',
    submitterName: normalizeExpenseText_(submitterName, 120),
    requestDate: '',
    email: '',
    address: '',
    department: '',
    deliveryNote: ''
  };
}

/**
 * Saves a receipt image to Drive and logs the expense to the Expenses sheet.
 * Called via google.script.run.
 *
 * @param {Object} data
 * @param {string} data.base64Image - Base64-encoded receipt image (optional)
 * @param {string} data.mimeType - Image MIME type
 * @param {string} data.expenseDate - Date of expense (YYYY-MM-DD)
 * @param {string} data.category - Expense category
 * @param {string} data.vendor - Vendor name
 * @param {string} data.description - Optional description
 * @param {number|string} data.amount - Expense amount
 * @param {string} data.submittedBy - Name of person submitting
 * @returns {Object} { success, message }
 */
function submitExpense(data) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(EXPENSE_CONFIG.SHEET_NAME);
    if (!sheet) throw new Error('Expenses sheet not found. Run initExpensesSetup() first.');

    var receiptUrl = '';
    if (data.base64Image) {
      var folderId = PropertiesService.getScriptProperties().getProperty('EXPENSE_RECEIPTS_FOLDER_ID');
      if (folderId) {
        var folder = DriveApp.getFolderById(folderId);
        var ext = (data.mimeType === 'image/png') ? '.png' : (data.mimeType === 'application/pdf') ? '.pdf' : '.jpg';
        var blob = Utilities.newBlob(Utilities.base64Decode(data.base64Image), data.mimeType, 'receipt_' + Date.now() + ext);
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        receiptUrl = file.getUrl();
      }
    }

    var normalizedDate = normalizeExpenseDate_(data.expenseDate);
    var normalizedVendor = normalizeExpenseText_(data.vendor, 120);
    var normalizedDescription = normalizeExpenseText_(data.description, 300);
    var normalizedAmount = normalizeExpenseAmount_(data.amount);

    if (normalizedAmount <= 0) {
      throw new Error('Amount must be greater than zero.');
    }

    if (!normalizedVendor) {
      Logger.log('submitExpense warning: vendor was blank after normalization.');
    }
    if (!normalizedDate) {
      Logger.log('submitExpense warning: expenseDate was blank/invalid after normalization.');
    }

    sheet.appendRow([
      new Date(),
      normalizedDate,
      data.category || '',
      normalizedVendor,
      normalizedDescription,
      normalizedAmount,
      receiptUrl,
      data.submittedBy || ''
    ]);

    return { success: true, message: 'Expense saved.' };
  } catch (err) {
    Logger.log('submitExpense error: ' + err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Retrieves expenses within a date range.
 * Called via google.script.run.
 *
 * @param {string} startDate - Start date (YYYY-MM-DD), or '' for all
 * @param {string} endDate - End date (YYYY-MM-DD), or '' for all
 * @returns {Object} { success, expenses: Array } or { success: false, message }
 */
function getExpenses(startDate, endDate) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(EXPENSE_CONFIG.SHEET_NAME);
    if (!sheet) return { success: false, message: 'Expenses sheet not found. Run initExpensesSetup() first.' };

    var data = sheet.getDataRange().getValues();
    var col = EXPENSE_CONFIG.COLUMNS;
    var tz = Session.getScriptTimeZone();
    var expenses = [];
    var start = startDate ? new Date(startDate) : null;
    var end = endDate ? new Date(endDate + 'T23:59:59') : null;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rawDate = row[col.EXPENSE_DATE];
      var expDate = rawDate ? new Date(rawDate) : null;
      if (start && expDate && expDate < start) continue;
      if (end && expDate && expDate > end) continue;

      expenses.push({
        rowIndex: i + 1,
        timestamp: row[col.TIMESTAMP] ? row[col.TIMESTAMP].toString() : '',
        expenseDate: expDate ? Utilities.formatDate(expDate, tz, 'yyyy-MM-dd') : (rawDate ? rawDate.toString() : ''),
        category: row[col.CATEGORY] || '',
        vendor: row[col.VENDOR] || '',
        description: row[col.DESCRIPTION] || '',
        amount: parseFloat(row[col.AMOUNT]) || 0,
        receiptUrl: row[col.RECEIPT_URL] || '',
        submittedBy: row[col.SUBMITTED_BY] || ''
      });
    }

    return { success: true, expenses: expenses };
  } catch (err) {
    Logger.log('getExpenses error: ' + err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Deletes an expense row by its 1-based sheet row index.
 * Called via google.script.run.
 *
 * @param {number} rowIndex - 1-based row number in the Expenses sheet
 * @returns {Object} { success, message }
 */
function deleteExpense(rowIndex) {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(EXPENSE_CONFIG.SHEET_NAME);
    if (!sheet) return { success: false, message: 'Expenses sheet not found.' };
    sheet.deleteRow(rowIndex);
    return { success: true, message: 'Expense deleted.' };
  } catch (err) {
    Logger.log('deleteExpense error: ' + err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Generates a formatted PDF expense report and saves it to Drive.
 * Called via google.script.run.
 *
 * @param {Object|string} startDateOrPayload - Report payload object or legacy start date
 * @param {string=} endDate - Legacy end date when using old signature
 * @param {string=} submitterName - Legacy submitter name when using old signature
 * @returns {Object} { success, url, total, fileName } or { success: false, message }
 */
function generateExpenseReport(startDateOrPayload, endDate, submitterName) {
  try {
    var payload = normalizeReportPayload_(startDateOrPayload, endDate, submitterName);
    var result = getExpenses(payload.startDate, payload.endDate);
    if (!result.success) return result;
    var expenses = result.expenses;

    var total = expenses.reduce(function(sum, e) { return sum + e.amount; }, 0);
    total = Math.round(total * 100) / 100;
    var tz = Session.getScriptTimeZone();
    var now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var requestDate = normalizeExpenseDate_(payload.requestDate) || now;
    var requestDateLong = Utilities.formatDate(new Date(requestDate), tz, 'MMMM d, yyyy');
    var rangeLabel = (payload.startDate && payload.endDate) ? (payload.startDate + ' to ' + payload.endDate) :
      payload.startDate ? ('from ' + payload.startDate) :
      payload.endDate ? ('to ' + payload.endDate) : 'All Dates';
    var docTitle = 'Cheque Request - ' + (payload.submitterName || 'Unnamed') + ' - ' + now;

    var doc = DocumentApp.create(docTitle);
    var body = doc.getBody();
    body.setMarginTop(36).setMarginBottom(36).setMarginLeft(54).setMarginRight(54);

    var titlePara = body.appendParagraph('CHEQUE REQUEST');
    titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING1)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    var checklist = [
      '- [ ] Original hard copy itemized AND debit/credit receipt OR full screenshot of bank statement showing transaction',
      '- [ ] For online purchases, have a confirmation of order AND ALL items above',
      '- [ ] For Uber, include trip summary with to/from addresses and cost AND ALL items above',
      '- [ ] If gift or prizes, include recipient names, emails, phone numbers, addresses, and WATIAM ID (if applicable)'
    ];
    checklist.forEach(function(item) {
      body.appendParagraph(item);
    });

    body.appendParagraph('');
    body.appendParagraph('DATE: ' + requestDateLong + '    EVENT ID #: _______________    WATIAM ID of Student: ______________');
    body.appendParagraph('');
    body.appendParagraph('Cheque Made Payable to (Capital Letters): ' + (payload.submitterName ? payload.submitterName.toUpperCase() : '_____________________________________________'));
    body.appendParagraph('');
    body.appendParagraph('Purpose of Cheque: ____________________________________________________________________');
    body.appendParagraph('                   Reimbursement of AFSA Tax Clinic Costs');
    body.appendParagraph('');
    body.appendParagraph('Event: Tax Clinic                        Committee/Club: ' + (payload.department || 'AFSA IS'));
    body.appendParagraph('Contact Email: ' + (payload.email || '_________________________________________________________________________'));
    body.appendParagraph('');
    body.appendParagraph('All Cheques Will be Available for Pick Up at the SLC Turnkey Desk:    [ ] I Understand');
    body.appendParagraph('');
    body.appendParagraph('Mailing Address (if unable to pick up at SLC Turnkey Desk): (Put N/A if Picking Up Cheque at SLC Turnkey Desk)');
    body.appendParagraph((payload.address || '______________________________________________________') + '    _______________________');
    if (payload.deliveryNote) {
      body.appendParagraph('Delivery/Pickup Note: ' + payload.deliveryNote);
    }

    body.appendParagraph('');
    var expenseRows = Math.max(4, expenses.length);
    for (var er = 0; er < expenseRows; er++) {
      var exp = expenses[er];
      var vendorLabel = exp ? (normalizeExpenseText_(exp.vendor, 40) || '___________________________') : '___________________________';
      var amountLabel = exp ? ('$' + exp.amount.toFixed(2)) : '$ ________________________';
      body.appendParagraph('Acc #: 1150 -               Vendor: ' + vendorLabel + '          ' + amountLabel);
      body.appendParagraph('');
    }

    var subtotalBeforeTax = total;
    var taxPaid = 0;
    body.appendParagraph('                                            Subtotal Before Tax               $ ' + subtotalBeforeTax.toFixed(2));
    body.appendParagraph('                                              Tax Paid                        $ ' + taxPaid.toFixed(2));
    body.appendParagraph('                                              Total                           $ ' + total.toFixed(2));
    body.appendParagraph('');
    body.appendParagraph('Accounting and Finance Authorization (please leave blank, for office use only)').setBold(true);
    body.appendParagraph('');
    body.appendParagraph('VP/Exec Authorization_________________________              VP Finance____________________________');
    body.appendParagraph('Please note that only original receipts will be accepted and all receipts must be attached to the form.').setItalic(true);
    body.appendParagraph('Expense Period: ' + rangeLabel);
    body.appendParagraph('Total Expenses Submitted: ' + expenses.length + ' item(s)');

    doc.saveAndClose();

    var pdf = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF);
    pdf.setName(docTitle + '.pdf');

    var folderId = PropertiesService.getScriptProperties().getProperty('EXPENSE_RECEIPTS_FOLDER_ID');
    var pdfFile = folderId
      ? DriveApp.getFolderById(folderId).createFile(pdf)
      : DriveApp.createFile(pdf);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    DriveApp.getFileById(doc.getId()).setTrashed(true);

    return { success: true, url: pdfFile.getUrl(), total: total, fileName: docTitle + '.pdf' };
  } catch (err) {
    Logger.log('generateExpenseReport error: ' + err.message);
    return { success: false, message: err.message };
  }
}

/**
 * One-time setup: creates the Expenses sheet and a Drive folder for receipts.
 * Run manually from the Apps Script editor before first use.
 *
 * @returns {Object} { success, message }
 */
function initExpensesSetup() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // Create Expenses sheet if needed
    var sheet = ss.getSheetByName(EXPENSE_CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(EXPENSE_CONFIG.SHEET_NAME);
      var headers = ['Timestamp', 'Expense Date', 'Category', 'Vendor', 'Description', 'Amount', 'Receipt URL', 'Submitted By'];
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#8e0000');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 160); // Timestamp
      sheet.setColumnWidth(2, 100); // Date
      sheet.setColumnWidth(3, 160); // Category
      sheet.setColumnWidth(4, 180); // Vendor
      sheet.setColumnWidth(5, 220); // Description
      sheet.setColumnWidth(6, 90);  // Amount
      sheet.setColumnWidth(7, 200); // Receipt URL
      sheet.setColumnWidth(8, 140); // Submitted By
      Logger.log('Created Expenses sheet.');
    } else {
      Logger.log('Expenses sheet already exists.');
    }

    // Create Drive folder for receipts if not already done
    var existingFolderId = PropertiesService.getScriptProperties().getProperty('EXPENSE_RECEIPTS_FOLDER_ID');
    if (!existingFolderId) {
      var folder = DriveApp.createFolder('CATBUS Expense Receipts');
      PropertiesService.getScriptProperties().setProperty('EXPENSE_RECEIPTS_FOLDER_ID', folder.getId());
      Logger.log('Created Drive folder: CATBUS Expense Receipts (' + folder.getId() + ')');
    } else {
      Logger.log('Drive folder already set up: ' + existingFolderId);
    }

    return { success: true, message: 'Setup complete. Expenses sheet and Drive folder are ready.' };
  } catch (err) {
    Logger.log('initExpensesSetup error: ' + err.message);
    return { success: false, message: err.message };
  }
}
