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
  var resource = { title: 'receipt_ocr_temp', mimeType: MimeType.GOOGLE_DOCS };
  var file = Drive.Files.insert(resource, blob, { convert: true, ocr: true });
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

  // Amount: find all dollar-like values and pick the largest (likely the total)
  var amounts = [];
  var amountRegex = /\$?\s*(\d{1,4}(?:[,]\d{3})*(?:[.]\d{2})?|\d{1,4}[.]\d{2})/g;
  var match;
  while ((match = amountRegex.exec(text)) !== null) {
    var val = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0 && val < 100000) amounts.push(val);
  }
  if (amounts.length > 0) {
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
  var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 2; });
  if (lines.length > 0) result.vendor = lines[0].substring(0, 80);

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

    sheet.appendRow([
      new Date(),
      data.expenseDate || '',
      data.category || '',
      data.vendor || '',
      data.description || '',
      parseFloat(data.amount) || 0,
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
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} submitterName - Name for the report header
 * @returns {Object} { success, url, total, fileName } or { success: false, message }
 */
function generateExpenseReport(startDate, endDate, submitterName) {
  try {
    var result = getExpenses(startDate, endDate);
    if (!result.success) return result;
    var expenses = result.expenses;

    var total = expenses.reduce(function(sum, e) { return sum + e.amount; }, 0);
    var tz = Session.getScriptTimeZone();
    var now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var rangeLabel = (startDate && endDate) ? (startDate + ' to ' + endDate) :
                     startDate ? ('from ' + startDate) :
                     endDate ? ('to ' + endDate) : 'All Dates';
    var docTitle = 'Expense Report - ' + rangeLabel + ' - ' + now;

    // Build Google Doc
    var doc = DocumentApp.create(docTitle);
    var body = doc.getBody();
    body.setMarginTop(36).setMarginBottom(36).setMarginLeft(54).setMarginRight(54);

    var titlePara = body.appendParagraph('AFSA Tax Clinic');
    titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING1)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    var subtitlePara = body.appendParagraph('Expense Reimbursement Report');
    subtitlePara.setHeading(DocumentApp.ParagraphHeading.HEADING2)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    body.appendParagraph('').setSpacingAfter(6);

    var meta = [
      'Submitted by: ' + (submitterName || 'N/A'),
      'Report Period: ' + rangeLabel,
      'Generated: ' + now,
      'Total Expenses: ' + expenses.length
    ];
    meta.forEach(function(line) {
      body.appendParagraph(line).setSpacingAfter(2);
    });

    body.appendParagraph('').setSpacingAfter(6);

    // Expense table
    var tableData = [['Date', 'Category', 'Vendor', 'Description', 'Amount (CAD)']];
    expenses.forEach(function(e) {
      tableData.push([
        e.expenseDate || '',
        e.category || '',
        e.vendor || '',
        e.description || '',
        '$' + e.amount.toFixed(2)
      ]);
    });
    tableData.push(['', '', '', 'TOTAL', '$' + total.toFixed(2)]);

    var table = body.appendTable(tableData);

    // Style header row
    var headerRow = table.getRow(0);
    for (var c = 0; c < 5; c++) {
      var cell = headerRow.getCell(c);
      cell.editAsText().setBold(true);
      cell.setBackgroundColor('#8e0000');
      cell.editAsText().setForegroundColor('#ffffff');
    }

    // Style total row
    var totalRow = table.getRow(tableData.length - 1);
    for (var c = 0; c < 5; c++) {
      totalRow.getCell(c).editAsText().setBold(true);
    }

    body.appendParagraph('').setSpacingAfter(20);
    body.appendParagraph('Signature: ______________________________    Date: ________________');
    body.appendParagraph('');
    body.appendParagraph('Please attach original receipts to this report when submitting for reimbursement.')
      .setItalic(true);

    doc.saveAndClose();

    // Export as PDF
    var pdf = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF);
    pdf.setName(docTitle + '.pdf');

    // Save PDF alongside receipts if folder exists, otherwise root Drive
    var folderId = PropertiesService.getScriptProperties().getProperty('EXPENSE_RECEIPTS_FOLDER_ID');
    var pdfFile = folderId
      ? DriveApp.getFolderById(folderId).createFile(pdf)
      : DriveApp.createFile(pdf);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Clean up the intermediate Google Doc
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
